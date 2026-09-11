/* Inicializa a persistência antes de carregar o app e apresenta recuperação sem apagar dados. */
(function () {
    'use strict';
    let fatalDialog = null;
    let appStarted = false;
    let startupFinished = false;

    function element(tag, text, parent) {
        const el = document.createElement(tag);
        if (text) el.textContent = text;
        if (parent) parent.appendChild(el);
        return el;
    }
    function button(parent, text, action) {
        const el = element('button', text, parent);
        el.type = 'button';
        el.style.cssText = 'display:block;width:100%;padding:12px;margin-top:10px;border-radius:12px;border:1px solid #525252;background:#262626;color:white;text-align:left;font:inherit';
        el.addEventListener('click', action);
        return el;
    }
    function dialog(title, blocking) {
        const el = element('dialog', '', document.body);
        el.style.cssText = 'width:min(90vw,430px);max-height:85vh;overflow:auto;padding:22px;border:1px solid #525252;border-radius:20px;background:#171717;color:white;font:14px/1.6 sans-serif';
        element('h2', title, el).style.cssText = 'font-size:20px;font-weight:bold;margin:0 0 12px';
        if (blocking) el.addEventListener('cancel', e => e.preventDefault());
        else {
            button(el, 'Fechar', () => { el.close(); el.remove(); });
            el.addEventListener('close', () => el.remove());
        }
        el.showModal();
        return el;
    }
    function safeErrorMessage(error) {
        if (!error) return 'Erro desconhecido.';
        return error.message || String(error);
    }
    function showFatal(title, message, error) {
        console.error(title, error || message);
        if (document.getElementById('startup-fatal')) return;
        const view = element('div', '', document.body);
        view.id = 'startup-fatal';
        view.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:24px;background:#000;color:#fff;font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
        const card = element('div', '', view);
        card.style.cssText = 'width:min(100%,430px);padding:24px;border:1px solid #333;border-radius:22px;background:#171717;box-shadow:0 20px 60px rgba(0,0,0,.5)';
        element('div', '⚠️', card).style.cssText = 'font-size:34px;margin-bottom:12px';
        element('h2', title, card).style.cssText = 'font-size:20px;font-weight:700;margin:0 0 8px';
        element('p', message, card).style.cssText = 'color:#aaa;margin:0 0 14px';
        if (error) {
            const details = element('details', '', card);
            element('summary', 'Detalhes técnicos', details).style.cssText = 'cursor:pointer;color:#fbbf24';
            const pre = element('pre', safeErrorMessage(error), details);
            pre.style.cssText = 'white-space:pre-wrap;word-break:break-word;color:#999;font-size:11px;margin-top:10px';
        }
        button(card, 'Recarregar', () => location.reload());
        button(card, 'Baixar dados para recuperação', () => downloadRaw());
    }
    function handleRuntimeError(error) {
        if (!startupFinished || !appStarted) {
            showFatal('Não foi possível abrir o Gato Gordo', 'O app encontrou um erro durante a inicialização. Seus dados locais não foram apagados.', error);
        }
    }
    addEventListener('error', event => {
        const file = event.filename || '';
        if (!startupFinished || file.includes('/js/app.js') || file.includes('/js/bootstrap.js')) {
            handleRuntimeError(event.error || new Error(event.message || 'Erro de JavaScript.'));
        }
    });
    addEventListener('unhandledrejection', event => handleRuntimeError(event.reason instanceof Error ? event.reason : new Error(String(event.reason || 'Promise rejeitada.'))));

    const warning = element('div', '', document.body);
    warning.id = 'storage-warning'; warning.setAttribute('role', 'status');
    warning.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:110;padding:6px 12px calc(6px + env(safe-area-inset-top));background:#78350f;color:white;font:12px/1.4 sans-serif;text-align:center';
    warning.hidden = true;
    function showStatus(status) {
        warning.hidden = !status.warning;
        warning.textContent = status.warning;
        if (status.blocked && !fatalDialog) {
            fatalDialog = dialog('Precisamos proteger seus dados', true);
            element('p', status.warning, fatalDialog);
            button(fatalDialog, 'Baixar dados desta sessão', () => {
                if (window.backupNuvem) window.backupNuvem(); else downloadRaw();
            });
            element('p', 'Recarregar descarta alterações que não foram salvas. Exporte os dados antes de continuar.', fatalDialog);
            button(fatalDialog, 'Recarregar dados salvos', () => location.reload());
        }
    }
    let local;
    try { local = localStorage; }
    catch (_) { local = { getItem() { throw Error('Armazenamento indisponível.'); }, setItem() { throw Error('Armazenamento indisponível.'); }, removeItem() { throw Error('Armazenamento indisponível.'); } }; }
    let idb;
    try { idb = indexedDB; } catch (_) {}
    const storage = window.gatoStorage = GatoStorage.create({ local, indexedDB: idb, onStatus: showStatus });
    addEventListener('storage', event => storage.handleExternalChange(event.key));
    document.addEventListener('visibilitychange', () => { if (document.hidden) storage.flush(); });
    function downloadRaw() {
        try { GatoBackup.download(storage.readRaw(), 'gato_gordo_recuperacao_bruta'); }
        catch (_) { alert('O navegador não permitiu ler os dados locais. Tente baixar uma cópia automática disponível.'); }
    }
    const dateLabel = snapshot => new Date(snapshot.dataCreatedAt || snapshot.createdAt).toLocaleString('pt-BR');
    function downloadSnapshot(snapshot) {
        try { GatoBackup.download(GatoBackup.create(GatoStorage.toBackup(snapshot.values)), 'gato_gordo_copia_automatica'); }
        catch (error) { alert(error.message); }
    }
    async function recover(input) {
        const data = GatoBackup.normalize(input);
        if (!confirm(`Recuperar ${data.perfis.length} perfil(is) e ${data.grupos.length} grupo(s)? Os dados locais serão substituídos e a sincronização ficará pausada.`)) return;
        let previous = null;
        try { previous = GatoBackup.create(GatoStorage.toBackup(storage.readRaw().values)); } catch (_) {}
        GatoBackup.restore(storage, input, previous);
        await storage.flush();
        location.reload();
    }
    function importRecovery() {
        const input = element('input', '', document.body);
        input.type = 'file'; input.accept = '.json,application/json'; input.hidden = true;
        input.addEventListener('cancel', () => input.remove(), {once:true});
        input.addEventListener('change', async () => {
            try {
                const file = input.files[0]; if (!file) return;
                if (file.size > 20 * 1024 * 1024) throw Error('O arquivo excede o limite de 20 MB.');
                await recover(JSON.parse(await file.text()));
            } catch (error) { alert('Não foi possível recuperar: ' + error.message); }
            finally { input.remove(); }
        }, {once:true});
        input.click();
    }
    function recoveryScreen(result) {
        const view = dialog('Recuperar o Gato Gordo', true);
        element('p', result.reason, view);
        element('p', 'Você pode baixar os dados atuais antes de escolher uma cópia. Nada será substituído sem confirmação.', view);
        button(view, 'Baixar dados locais para recuperação', downloadRaw);
        button(view, 'Importar arquivo de backup', importRecovery);
        for (const snapshot of result.snapshots) {
            const row = element('section', '', view);
            element('p', 'Cópia de ' + dateLabel(snapshot), row);
            button(row, 'Baixar esta cópia', () => downloadSnapshot(snapshot));
            button(row, 'Recuperar esta cópia', async () => {
                try { await recover(GatoBackup.create(GatoStorage.toBackup(snapshot.values))); }
                catch (error) { alert('Não foi possível recuperar: ' + error.message); }
            });
        }
    }
    window.abrirCopiasAutomaticas = async function () {
        const view = dialog('Cópias automáticas', false);
        element('p', 'Guardadas apenas neste navegador. Limpar os dados do site também pode apagar estas cópias. Exporte arquivos para ter uma cópia fora do aparelho.', view);
        try {
            await storage.flush();
            const snapshots = await storage.listSnapshots();
            if (!snapshots.length) element('p', 'Nenhuma cópia automática disponível.', view);
            for (const snapshot of snapshots) button(view, 'Baixar cópia de ' + dateLabel(snapshot), () => downloadSnapshot(snapshot));
        } catch (_) { element('p', 'Não foi possível abrir as cópias automáticas.', view); }
    };
    function loadModalUX() {
        if (document.getElementById('gg-modal-v2-css')) return;
        const link = document.createElement('link');
        link.id = 'gg-modal-v2-css'; link.rel = 'stylesheet'; link.href = 'css/premium-modal.css?v=2';
        document.head.appendChild(link);
        const modalScript = document.createElement('script'); modalScript.src = 'js/premium-modal.js?v=2'; document.body.appendChild(modalScript);
        const orderScript = document.createElement('script'); orderScript.src = 'js/modal-order-fix.js?v=1'; document.body.appendChild(orderScript);
        const systemScript = document.createElement('script'); systemScript.src = 'js/modal-system.js?v=1'; document.body.appendChild(systemScript);
        const entityScript = document.createElement('script'); entityScript.src = 'js/modal-entities.js?v=3'; document.body.appendChild(entityScript);
        const actionsScript = document.createElement('script'); actionsScript.src = 'js/modal-actions.js?v=2'; document.body.appendChild(actionsScript);
    }
    function loadApp() {
        if (appStarted) return;
        appStarted = true;
        const script = document.createElement('script');
        script.src = 'js/app.js?v=1';
        script.onload = () => {
            startupFinished = true;
            loadModalUX();
            const ciclos = document.createElement('script'); ciclos.src = 'js/ciclos-cartao.js';
            ciclos.onload = () => {
                const faturas = document.createElement('script'); faturas.src = 'js/faturas.js';
                faturas.onload = () => {
                    const faturasCiclos = document.createElement('script'); faturasCiclos.src = 'js/faturas-ciclos.js';
                    faturasCiclos.onload = () => {
                        const parcelamentos = document.createElement('script'); parcelamentos.src = 'js/parcelamentos.js';
                        parcelamentos.onload = () => {
                            const projecao = document.createElement('script'); projecao.src = 'js/projecao-faturas.js';
                            projecao.onerror = () => console.warn('Módulo de projeção de faturas não carregou; o restante do cartão continua disponível.');
                            document.body.appendChild(projecao);
                        };
                        parcelamentos.onerror = () => console.warn('Módulo de parcelamentos não carregou; edição padrão continua disponível.');
                        document.body.appendChild(parcelamentos);
                    };
                    faturasCiclos.onerror = () => {
                        const parcelamentos = document.createElement('script'); parcelamentos.src = 'js/parcelamentos.js';
                        parcelamentos.onload = () => {
                            const projecao = document.createElement('script'); projecao.src = 'js/projecao-faturas.js';
                            document.body.appendChild(projecao);
                        };
                        document.body.appendChild(parcelamentos);
                    };
                    document.body.appendChild(faturasCiclos);
                };
                faturas.onerror = () => console.warn('Módulo de faturas não carregou; o restante do app continua disponível.');
                document.body.appendChild(faturas);
            };
            ciclos.onerror = () => console.warn('Módulo de ciclos não carregou; o detalhe antigo do cartão continua disponível.');
            document.body.appendChild(ciclos);
        };
        script.onerror = () => {
            startupFinished = true;
            showFatal('Não foi possível carregar o app', 'O arquivo principal não pôde ser carregado. Seus dados locais foram preservados.', new Error('Falha ao carregar js/app.js'));
        };
        document.body.appendChild(script);
    }
    document.getElementById('login-form').textContent = 'Abrindo seus dados…';

    // O app não pode ficar bloqueado esperando IndexedDB. O armazenamento principal
    // é o localStorage; as cópias automáticas são uma camada auxiliar. Se a inicialização
    // do backup travar no Safari/iOS, liberamos o app e deixamos a rotina continuar em segundo plano.
    const STARTUP_TIMEOUT = 3500;
    let startupTimer;
    const timeoutPromise = new Promise(resolve => {
        startupTimer = setTimeout(() => resolve({ ready: true, timedOut: true, snapshots: [] }), STARTUP_TIMEOUT);
    });
    Promise.race([storage.init(), timeoutPromise]).then(result => {
        clearTimeout(startupTimer);
        if (result.timedOut) {
            console.warn('Inicialização das cópias automáticas demorou; liberando o app sem bloquear a entrada.');
            loadApp();
            return;
        }
        if (!result.ready) { recoveryScreen(result); return; }
        loadApp();
    }).catch(error => {
        showFatal('Não foi possível iniciar o app', 'Seus dados foram preservados. Tente recarregar; nenhuma informação foi apagada.', error);
    });
})();
