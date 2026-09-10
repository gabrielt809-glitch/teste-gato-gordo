const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
function worker() {
 const events = {}; const entries = new Map(); const deleted = []; let offline = false; let claims = 0;
 const scope = 'https://example.com/gato/';
 const key = value => typeof value === 'string' ? value : value.url;
 const cache = {
  addAll: async urls => { for (const url of urls) entries.set(url, new Response('local:' + url)); },
  put: async (url, response) => entries.set(key(url), response),
  match: async url => entries.get(key(url))?.clone()
 };
 const context = {
  URL, Request, Response, console,
  self: { registration:{scope}, location:{origin:'https://example.com'}, clients:{claim:async()=>claims++}, addEventListener:(type,handler)=>events[type]=handler },
  caches: {open:async()=>cache,keys:async()=>['other-app','gato-gordo-'+encodeURIComponent(scope)+'-v0'],delete:async name=>deleted.push(name)},
  fetch:async request=>{ if(offline) throw Error('offline'); return new Response('remote:'+key(request)); }
 };
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8'),context);
 const dispatch = async(type,event={})=>{let work;events[type]({...event,waitUntil:p=>work=p,respondWith:p=>work=p});return work?await work:undefined;};
 return {dispatch,entries,deleted,goOffline:()=>offline=true,claims:()=>claims};
}
test('instala arquivos essenciais e bibliotecas; ativa sem apagar outro app',async()=>{
 const w=worker();await w.dispatch('install');await w.dispatch('activate');
 assert.ok(w.entries.has('https://example.com/gato/js/backup.js'));
 assert.ok(w.entries.has('https://cdn.jsdelivr.net/npm/chart.js'));
 assert.equal(w.claims(),1);assert.equal(w.deleted.length,1);assert.ok(!w.deleted.includes('other-app'));
 for(const url of w.entries.keys()) if(url.startsWith('https://example.com/gato/')) {
  const relative=url.split('/gato/')[1]||'index.html';
  // Imagens são arquivos já existentes no repositório; não são fixtures de teste.
  if(!relative.startsWith('assets/')) assert.ok(fs.existsSync(path.join(__dirname,'..',relative)),relative);
 }
});
test('reabre página, scripts e ícone com query string sem rede',async()=>{
 const w=worker();await w.dispatch('install');w.goOffline();
 for(const url of ['https://example.com/gato/index.html','https://example.com/gato/js/app.js','https://example.com/gato/assets/app_icon_dark.png?v=3','https://cdn.tailwindcss.com/']) {
  const response=await w.dispatch('fetch',{request:new Request(url)});assert.equal(response.status,200);assert.ok(await response.text());
 }
});
test('não intercepta sincronização, POST nem recursos de outros projetos',async()=>{
 const w=worker();
 for(const req of [new Request('https://script.google.com/macros/s/test/exec'),new Request('https://example.com/gato/index.html',{method:'POST',body:'private'}),new Request('https://example.com/other/index.html')]) assert.equal(await w.dispatch('fetch',{request:req}),undefined);
});
