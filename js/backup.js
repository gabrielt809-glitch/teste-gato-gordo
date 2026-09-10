/* Backups locais versionados. Nunca envia dados para a rede. */
(function (root) {
    'use strict';
    const PREFIX = 'gato_gordo_';
    const KEYS = ['perfis', 'grupos', 'compart', 'grupo_ativo', 'sync_url', 'sync_ts_map', 'sync_paused'];
    const JOURNAL = PREFIX + 'pre_restore_v2';
    const MAX_BYTES = 20 * 1024 * 1024;
    const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
    function assert(condition, message) { if (!condition) throw new Error(message); }
    function records(value, label) {
        assert(Array.isArray(value) && value.every(object), label + ' inválidos.');
    }
    function normalize(input) {
        assert(object(input), 'Arquivo de backup inválido.');
        const legacy = !Object.hasOwn(input, 'version') && !Object.hasOwn(input, 'app');
        if (!legacy) {
            assert(input.app === 'gato-gordo' && input.version === 2, 'Formato ou versão de backup não suportado.');
            assert(typeof input.createdAt === 'string' && Number.isFinite(Date.parse(input.createdAt)), 'Data do backup inválida.');
        }
        const data = legacy ? input : input.data;
        assert(object(data), 'Dados do backup ausentes.');
        records(data.perfis, 'Perfis');
        records(data.grupos, 'Grupos');
        for (const p of data.perfis) {
            assert(typeof p.nome === 'string' && p.nome.trim(), 'Perfil sem nome.');
            for (const key of ['contas', 'cartoes', 'transacoes', 'metas', 'categorias']) {
                if (legacy && p[key] === undefined) p[key] = [];
                records(p[key], key);
            }
            assert(p.senhaAtiva === undefined || typeof p.senhaAtiva === 'boolean', 'Bloqueio do perfil inválido.');
            assert(!p.senhaAtiva || (typeof p.pin === 'string' && /^\d{4}$/.test(p.pin)), 'PIN do perfil inválido.');
        }
        for (const g of data.grupos) {
            assert(typeof g.id === 'string' && g.id && typeof g.nome === 'string', 'Identificação de grupo inválida.');
            records(g.pessoas, 'Pessoas'); records(g.contas, 'Contas compartilhadas');
            assert(['proporcional', 'igual'].includes(g.regra), 'Regra de divisão inválida.');
        }
        assert(new Set(data.grupos.map(g => g.id)).size === data.grupos.length, 'Grupos duplicados.');
        const settings = legacy ? {} : data.settings;
        assert(object(settings), 'Configurações inválidas.');
        assert(settings.syncUrl === undefined || settings.syncUrl === null || typeof settings.syncUrl === 'string', 'Endereço de sincronização inválido.');
        assert(settings.syncTimestamps === undefined || (object(settings.syncTimestamps) && Object.values(settings.syncTimestamps).every(v => Number.isFinite(v) && v >= 0)), 'Datas de sincronização inválidas.');
        assert(settings.activeGroupId === undefined || settings.activeGroupId === null || typeof settings.activeGroupId === 'string', 'Grupo ativo inválido.');
        return { perfis: data.perfis, grupos: data.grupos, settings: {
            activeGroupId: data.grupos.some(g => g.id === settings.activeGroupId) ? settings.activeGroupId : (data.grupos[0]?.id || null),
            syncUrl: settings.syncUrl || '', syncTimestamps: settings.syncTimestamps || {},
            syncPaused: settings.syncPaused === true
        }};
    }
    function create(data) {
        const result = { app: 'gato-gordo', version: 2, createdAt: new Date().toISOString(), data };
        normalize(result);
        return result;
    }
    function restore(storage, input, currentBackup) {
        const data = normalize(input);
        const before = Object.fromEntries(KEYS.map(key => [PREFIX + key, storage.getItem(PREFIX + key)]));
        // Primeiro salva a recuperação; se faltar espaço, nada do app é sobrescrito.
        storage.setItem(JOURNAL, JSON.stringify({ backup: currentBackup, before }));
        const after = {
            perfis: JSON.stringify(data.perfis), grupos: JSON.stringify(data.grupos), compart: null,
            grupo_ativo: data.settings.activeGroupId, sync_url: data.settings.syncUrl,
            sync_ts_map: JSON.stringify(data.settings.syncTimestamps), sync_paused: 'true'
        };
        try {
            for (const [key, value] of Object.entries(after)) {
                if (value === null) storage.removeItem(PREFIX + key);
                else storage.setItem(PREFIX + key, value);
            }
        } catch (error) {
            // Libera as novas chaves antes de recolocar os valores antigos.
            for (const key of KEYS) storage.removeItem(PREFIX + key);
            try {
                for (const [key, value] of Object.entries(before)) if (value !== null) storage.setItem(key, value);
            } catch (_) {
                throw new Error('Falha ao recuperar automaticamente. A cópia anterior permanece salva para download.');
            }
            throw new Error('Não foi possível restaurar. Os dados anteriores foram mantidos.');
        }
    }
    function download(data, prefix) {
        const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
        const link = document.createElement('a');
        link.href = url; link.download = prefix + '_' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
        document.body.appendChild(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
    function init(options) {
        root.backupNuvem = () => {
            try { download(create(options.snapshot()), 'backup_gato_gordo_v2'); options.notify('Arquivo de backup preparado para salvar.'); }
            catch (e) { options.notify(e.message); }
        };
        root.baixarBackupAnterior = () => {
            try {
                const saved = JSON.parse(localStorage.getItem(JOURNAL) || 'null');
                assert(saved?.backup, 'Nenhuma cópia anterior à restauração disponível.');
                download(saved.backup, 'gato_gordo_antes_da_restauracao');
            } catch (e) { options.notify(e.message); }
        };
        root.restaurarBackup = () => {
            const picker = document.createElement('input');
            picker.type = 'file'; picker.accept = '.json,application/json'; picker.hidden = true;
            picker.addEventListener('cancel', () => picker.remove(), { once: true });
            picker.addEventListener('change', async () => {
                try {
                    const file = picker.files[0]; if (!file) return;
                    assert(file.size <= MAX_BYTES, 'O arquivo excede o limite de 20 MB.');
                    let input;
                    try { input = JSON.parse(await file.text()); } catch (_) { throw new Error('Não foi possível ler este arquivo JSON.'); }
                    const data = normalize(input);
                    if (!confirm(`Restaurar ${data.perfis.length} perfil(is) e ${data.grupos.length} grupo(s)? Isso substituirá os dados deste aparelho. Uma cópia anterior ficará disponível para download. A sincronização ficará pausada até você reconectá-la.`)) return;
                    const currentBackup = create(options.snapshot());
                    const resume = options.pause();
                    try { restore(localStorage, input, currentBackup); }
                    catch (e) { resume(); throw e; }
                    alert('Backup restaurado. O app será reaberto. A sincronização está pausada; confira os dados antes de reconectar.');
                    location.reload();
                } catch (e) { options.notify(e.message); }
                finally { picker.remove(); }
            }, { once: true });
            document.body.appendChild(picker); picker.click();
        };
    }
    root.GatoBackup = { normalize, create, restore, init };
})(globalThis);
