/* Camada local de persistência: dados atuais + cópias automáticas em IndexedDB. */
(function (root) {
    'use strict';
    const PREFIX = 'gato_gordo_';
    const DATA_KEYS = ['perfis', 'grupos', 'compart', 'grupo_ativo', 'sync_url', 'sync_ts_map', 'sync_paused'].map(k => PREFIX + k);
    const ALLOWED = new Set([...DATA_KEYS, PREFIX + 'pre_restore_v2', PREFIX + 'last_file_backup']);
    const HISTORY_LIMIT = 5;
    const HISTORY_INTERVAL = 10 * 60 * 1000;
    const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
    const assert = (ok, message) => { if (!ok) throw new Error(message); };

    function validate(values) {
        assert(isObject(values), 'Dados locais inválidos.');
        const read = (name, fallback) => values[PREFIX + name] == null ? fallback : JSON.parse(values[PREFIX + name]);
        const records = (v, name) => assert(Array.isArray(v) && v.every(isObject), name + ' inválidos.');
        const perfis = read('perfis', []);
        records(perfis, 'Perfis');
        for (const p of perfis) {
            assert(typeof p.nome === 'string' && p.nome.trim(), 'Perfil sem nome.');
            for (const key of ['contas', 'cartoes', 'transacoes']) records(p[key], key);
            for (const key of ['metas', 'categorias']) if (p[key] !== undefined) records(p[key], key);
            assert(!p.senhaAtiva || (typeof p.pin === 'string' && /^\d{4}$/.test(p.pin)), 'PIN do perfil inválido.');
        }
        const grupos = read('grupos', null);
        if (grupos !== null) {
            records(grupos, 'Grupos');
            for (const g of grupos) {
                assert(typeof g.id === 'string' && g.id && typeof g.nome === 'string', 'Grupo inválido.');
                records(g.pessoas, 'Pessoas'); records(g.contas, 'Contas compartilhadas');
            }
        }
        const antigo = read('compart', null);
        if (antigo !== null) {
            assert(isObject(antigo), 'Grupo antigo inválido.');
            if (antigo.pessoas !== undefined) records(antigo.pessoas, 'Pessoas');
            if (antigo.contas !== undefined) records(antigo.contas, 'Contas compartilhadas');
        }
        assert(isObject(read('sync_ts_map', {})), 'Datas de sincronização inválidas.');
        return { perfis, grupos, antigo };
    }
    function hasData(values) {
        try { const v = validate(values); return v.perfis.length > 0 || Boolean(v.grupos?.length) || Boolean(v.antigo); }
        catch (_) { return false; }
    }
    function toBackup(values) {
        const v = validate(values);
        const grupos = v.grupos || (v.antigo ? [{ id: 'LEGADO', nome: 'Compartilhado', pessoas: v.antigo.pessoas || [], contas: v.antigo.contas || [], regra: v.antigo.regra || 'proporcional' }] : []);
        return { perfis: v.perfis.map(p => ({ contas: [], cartoes: [], transacoes: [], metas: [], categorias: [], ...p })), grupos, settings: {
            activeGroupId: values[PREFIX + 'grupo_ativo'] || grupos[0]?.id || null,
            syncUrl: values[PREFIX + 'sync_url'] || '',
            syncTimestamps: JSON.parse(values[PREFIX + 'sync_ts_map'] || '{}'),
            syncPaused: values[PREFIX + 'sync_paused'] === 'true'
        }};
    }
    function openDB(indexedDB, name) {
        return new Promise((resolve, reject) => {
            if (!indexedDB) { reject(new Error('IndexedDB indisponível.')); return; }
            let ended = false;
            const timer = setTimeout(() => { ended = true; reject(new Error('Não foi possível abrir as cópias automáticas.')); }, 5000);
            const req = indexedDB.open(name, 1);
            req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains('snapshots')) req.result.createObjectStore('snapshots', { keyPath: 'id' }); };
            req.onerror = () => { clearTimeout(timer); ended = true; reject(req.error); };
            req.onblocked = () => { clearTimeout(timer); ended = true; reject(new Error('Feche outras abas para liberar as cópias automáticas.')); };
            req.onsuccess = () => {
                clearTimeout(timer);
                if (ended) { req.result.close(); return; }
                ended = true;
                req.result.onversionchange = () => req.result.close();
                resolve(req.result);
            };
        });
    }
    const list = db => new Promise((resolve, reject) => {
        const tx = db.transaction('snapshots', 'readonly');
        const req = tx.objectStore('snapshots').getAll();
        tx.oncomplete = () => resolve(req.result.sort((a, b) => b.createdAt - a.createdAt));
        tx.onabort = () => reject(tx.error || new Error('Falha ao ler as cópias automáticas.'));
        tx.onerror = () => {};
    });
    function persist(db, values, now) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction('snapshots', 'readwrite');
            const store = tx.objectStore('snapshots');
            const req = store.getAll();
            req.onsuccess = () => {
                const history = req.result.filter(s => s.id !== 'latest').sort((a, b) => b.createdAt - a.createdAt);
                const previous = req.result.find(s => s.id === 'latest');
                const different = previous && JSON.stringify(previous.values) !== JSON.stringify(values);
                if (different && (!history.length || now - history[0].createdAt >= HISTORY_INTERVAL)) {
                    const saved = { ...previous, id: 'history-' + now, createdAt: now, dataCreatedAt: previous.createdAt };
                    store.put(saved); history.unshift(saved);
                }
                for (const old of history.slice(HISTORY_LIMIT)) store.delete(old.id);
                store.put({ id: 'latest', createdAt: now, values });
            };
            tx.oncomplete = () => resolve(now);
            tx.onabort = () => reject(tx.error || new Error('Falha ao gravar a cópia automática.'));
            tx.onerror = () => {};
        });
    }
    function create(options = {}) {
        const local = options.local;
        const emit = options.onStatus || (() => {});
        const now = options.now || Date.now;
        let db = null, expected = null, blocked = false, timer = null, batchDepth = 0;
        let queue = Promise.resolve(true), lastAutomatic = null, warning = '';
        const readAll = () => Object.fromEntries(DATA_KEYS.map(key => [key, local.getItem(key)]));
        const status = () => ({ automaticAvailable: Boolean(db), lastAutomatic, warning, blocked });
        function report(message, fatal = false) { warning = message; if (fatal) blocked = true; emit(status()); }
        function checkFresh() {
            assert(!blocked, 'Recarregue o app antes de continuar.');
            const actual = readAll();
            if (expected && JSON.stringify(actual) !== JSON.stringify(expected)) {
                report('Os dados mudaram em outra aba. Recarregue este app antes de continuar.', true);
                throw new Error(warning);
            }
        }
        function schedule() {
            if (!db || batchDepth || blocked) return;
            clearTimeout(timer);
            timer = setTimeout(() => { timer = null; flush(); }, 200);
        }
        function flush() {
            clearTimeout(timer); timer = null;
            if (!db || blocked) return Promise.resolve(false);
            let values;
            try { checkFresh(); values = readAll(); validate(values); }
            catch (e) { report('A cópia automática não foi atualizada: ' + e.message); return Promise.resolve(false); }
            queue = queue.then(async () => {
                try {
                    lastAutomatic = await persist(db, values, now());
                    warning = ''; emit(status()); return true;
                } catch (_) {
                    report('A cópia automática não pôde ser salva. Seus dados atuais continuam neste aparelho; exporte um backup.');
                    return false;
                }
            });
            return queue;
        }
        function write(key, value, remove) {
            assert(ALLOWED.has(key), 'Chave fora do armazenamento do Gato Gordo.');
            checkFresh();
            try { if (remove) local.removeItem(key); else local.setItem(key, String(value)); }
            catch (_) {
                // Operações em lote (restauração) cuidam do rollback antes de sinalizar erro.
                if (!batchDepth) report('Não foi possível salvar a alteração. Baixe os dados desta sessão antes de sair.', true);
                throw new Error('Não foi possível gravar no armazenamento deste aparelho.');
            }
            if (DATA_KEYS.includes(key)) expected = readAll();
            schedule();
        }
        async function init() {
            let primaryError = null;
            try { expected = readAll(); validate(expected); }
            catch (e) { primaryError = e; }
            let snapshots = [];
            try {
                db = await openDB(options.indexedDB, options.databaseName || 'gato-gordo-local-backups');
                snapshots = await list(db);
                lastAutomatic = snapshots.find(s => s.id === 'latest')?.createdAt || null;
            } catch (_) { report('Cópias automáticas indisponíveis neste navegador. Exporte um backup para guardar seus dados.'); }
            const candidates = snapshots.filter(s => hasData(s.values));
            const missing = expected && candidates.some(snapshot => {
                const previous = validate(snapshot.values);
                return (expected[PREFIX + 'perfis'] === null && previous.perfis.length > 0) ||
                    (expected[PREFIX + 'grupos'] === null && expected[PREFIX + 'compart'] === null && Boolean(previous.grupos?.length || previous.antigo));
            });
            if (primaryError || (missing && candidates.length)) {
                return { ready: false, reason: primaryError ? 'Não foi possível ler os dados locais. Eles foram preservados para recuperação.' : 'Encontramos cópias automáticas de dados que não estão mais no armazenamento principal.', snapshots: candidates };
            }
            // Só cria/atualiza cópias depois de validar a origem. Nunca substitui uma cópia válida com JSON corrompido.
            await flush();
            return { ready: true, snapshots };
        }
        function batch(callback) {
            checkFresh(); clearTimeout(timer); timer = null; batchDepth++;
            let success = false;
            try { const result = callback(); success = true; return result; }
            finally { batchDepth--; expected = readAll(); if (success) schedule(); }
        }
        return {
            init, flush, status, toBackup,
            getItem: key => { assert(ALLOWED.has(key), 'Chave inválida.'); return local.getItem(key); },
            setItem: (key, value) => write(key, value, false), removeItem: key => write(key, null, true), batch,
            listSnapshots: async () => db ? (await list(db)).filter(s => { try { validate(s.values); return true; } catch (_) { return false; } }) : [],
            readRaw: () => ({ app: 'gato-gordo-raw-recovery', createdAt: new Date(now()).toISOString(), values: readAll(), previousRestore: local.getItem(PREFIX + 'pre_restore_v2') }),
            handleExternalChange: key => { if (DATA_KEYS.includes(key) || key === null) { try { checkFresh(); } catch (_) {} } },
            close: () => { clearTimeout(timer); if (db) db.close(); }
        };
    }
    root.GatoStorage = { create, validate, toBackup, DATA_KEYS };
})(globalThis);
