(function () {
    'use strict';
    const banner = document.createElement('div');
    banner.setAttribute('role', 'status');
    banner.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:100;padding:6px 12px calc(6px + env(safe-area-inset-bottom));text-align:center;background:#78350f;color:#fff;font:12px sans-serif;pointer-events:none';
    banner.textContent = 'Sem conexão • dados salvos neste aparelho; sincronização indisponível';
    document.body.appendChild(banner);
    const update = () => { banner.hidden = navigator.onLine; };
    addEventListener('online', update); addEventListener('offline', update); update();

    // Carrega a fronteira de integridade depois do bootstrap. O módulo aguarda
    // as APIs dinâmicas do app e então passa a proteger as mutações financeiras.
    const integrity = document.createElement('script');
    integrity.src = 'js/transacoes-integridade.js';
    integrity.onerror = () => console.warn('Camada de integridade não carregou; funcionalidades financeiras continuam disponíveis.');
    document.body.appendChild(integrity);

    // Sprint Premium: camada visual isolada da lógica financeira.
    const premiumCss = document.createElement('link');
    premiumCss.rel = 'stylesheet';
    premiumCss.href = 'css/premium-home.css';
    document.head.appendChild(premiumCss);
    const premiumHome = document.createElement('script');
    premiumHome.src = 'js/premium-home.js';
    premiumHome.defer = true;
    premiumHome.onerror = () => console.warn('Home Premium não carregou; a Home original continua disponível.');
    document.body.appendChild(premiumHome);

    if ('serviceWorker' in navigator && isSecureContext) {
        addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(error => {
                console.warn('Não foi possível preparar o modo offline:', error);
            });
        });
    }
})();
