/* Aumentar VERSION a cada alteração nos arquivos essenciais. */
const VERSION = 'v4';
const PREFIX = 'gato-gordo-' + encodeURIComponent(self.registration.scope) + '-';
const CACHE = PREFIX + VERSION;
const LOCAL = [
    './', 'index.html', 'css/style.css',
    'js/backup.js', 'js/app.js', 'js/pwa.js', 'js/storage.js', 'js/sync-config.js',
    'js/bootstrap.js', 'js/finance.js', 'js/transacoes.js',
    'js/ciclos-cartao.js', 'js/faturas.js', 'js/faturas-ciclos.js',
    'js/parcelamentos.js', 'js/projecao-faturas.js',
    'manifest.json', 'assets/app_icon_dark.png', 'assets/cat_mascot.png', 'assets/logo.png'
];
const SCRIPTS = ['https://cdn.tailwindcss.com/', 'https://cdn.jsdelivr.net/npm/chart.js'];
const absolute = path => new URL(path, self.registration.scope).href;
const localURLs = new Set(LOCAL.map(absolute));
self.addEventListener('install', event => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE);
        await cache.addAll(LOCAL.map(absolute));
        // Esses scripts são necessários também no primeiro carregamento offline.
        for (const url of SCRIPTS) {
            const request = new Request(url, { mode: 'no-cors', cache: 'reload' });
            const response = await fetch(request);
            if (!response.ok && response.type !== 'opaque') throw new Error('Falha ao preparar o modo offline');
            await cache.put(url, response);
        }
    })());
});
self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        for (const name of await caches.keys()) if (name.startsWith(PREFIX) && name !== CACHE) await caches.delete(name);
        await self.clients.claim();
    })());
});
self.addEventListener('fetch', event => {
    const request = event.request;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);
    const local = url.origin === self.location.origin && localURLs.has(url.origin + url.pathname);
    const external = SCRIPTS.includes(url.href) || ['fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname);
    const navigation = request.mode === 'navigate' && local;
    // Não intercepta Apps Script, APIs nem outros projetos na mesma origem.
    if (!local && !external) return;
    event.respondWith((async () => {
        const cache = await caches.open(CACHE);
        const key = local ? (navigation ? absolute('index.html') : url.origin + url.pathname) : request;
        const cached = await cache.match(key);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok || response.type === 'opaque') await cache.put(key, response.clone());
        return response;
    })());
});
