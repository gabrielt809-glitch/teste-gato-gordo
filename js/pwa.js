(function () {
    'use strict';
    const banner = document.createElement('div');
    banner.setAttribute('role', 'status');
    banner.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:100;padding:6px 12px calc(6px + env(safe-area-inset-bottom));text-align:center;background:#78350f;color:#fff;font:12px sans-serif;pointer-events:none';
    banner.textContent = 'Sem conexão • dados salvos neste aparelho; sincronização indisponível';
    document.body.appendChild(banner);
    const update = () => { banner.hidden = navigator.onLine; };
    addEventListener('online', update); addEventListener('offline', update); update();
    if ('serviceWorker' in navigator && isSecureContext) {
        addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(error => {
                console.warn('Não foi possível preparar o modo offline:', error);
            });
        });
    }
})();
