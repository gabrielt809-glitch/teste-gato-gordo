/* Inicializa a persistência antes de carregar o app e apresenta recuperação sem apagar dados. */
(function () {
    'use strict';
    let fatalDialog = null;
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
    document.getElementById('login-form').textContent = 'Abrindo seus dados…';
    storage.init().then(result => {
        if (!result.ready) { recoveryScreen(result); return; }
        const script = document.createElement('script'); script.src = 'js/app.js';
        script.onerror = () => {
            const view = dialog('Não foi possível abrir o app', true);
            element('p', 'Seus dados foram preservados. Tente recarregar com conexão.', view);
            button(view, 'Recarregar', () => location.reload());
            button(view, 'Baixar dados para recuperação', downloadRaw);
        };
        document.body.appendChild(script);
    }).catch(error => recoveryScreen({reason:'Não foi possível iniciar o armazenamento: ' + error.message,snapshots:[]}));
})();
