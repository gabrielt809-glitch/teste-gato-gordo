const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {IDBFactory} = require('fake-indexeddb');
const read = file => fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const profile = {nome:'Gabriel',senhaAtiva:false,pin:null,contas:[],cartoes:[],transacoes:[],metas:[],categorias:[]};
async function until(condition) {
 for (let i=0;i<100;i++){if(condition())return;await new Promise(r=>setTimeout(r,5));}
 throw Error('A interface não chegou ao estado esperado');
}
async function boot(values={}) {
 const {Window}=await import('happy-dom');
 const window=new Window({url:'https://example.com/gato/index.html',settings:{enableJavaScriptEvaluation:true,disableJavaScriptFileLoading:true,disableCSSFileLoading:true}});
 Object.defineProperty(window,'indexedDB',{value:new IDBFactory(),configurable:true});
 window.HTMLCanvasElement.prototype.getContext=()=>({});
 window.Chart=class {destroy(){} update(){}};
 const requests=[];window.fetch=async url=>{requests.push(url);return {json:async()=>({timestamp:0})};};
 window.alert=()=>{};window.confirm=()=>false;
 for(const [key,value] of Object.entries(values))window.localStorage.setItem(key,value);
 window.document.write(read('index.html').replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,''));
 const append=window.document.body.appendChild.bind(window.document.body);
 window.document.body.appendChild=node=>{
  if(node.tagName==='SCRIPT' && node.getAttribute('src')==='js/app.js')node.onerror=null;
  return append(node);
 };
 for(const file of ['js/backup.js','js/storage.js','js/sync-config.js','js/bootstrap.js'])window.eval(read(file));
 await until(()=>window.document.querySelector('script[src="js/app.js"]')||window.document.querySelector('dialog[open]'));
 if(window.document.querySelector('script[src="js/app.js"]'))window.eval(read('js/app.js'));
 return {window,requests,close:async()=>{window.gatoStorage.close();await window.happyDOM.abort();window.close();}};
}
test('primeiro acesso mantém onboarding e não faz conexão de sincronização',async()=>{
 const app=await boot();
 try{assert.ok(app.window.document.getElementById('new-perfil-nome'));assert.match(app.window.document.body.textContent,/Já tenho um backup/);assert.equal(app.requests.length,0);}
 finally{await app.close();}
});
test('perfil existente abre dashboard e menu com cópias automáticas e data de exportação',async()=>{
 const app=await boot({gato_gordo_perfis:JSON.stringify([profile])});
 try{
  const w=app.window;assert.equal(w.document.getElementById('app-container').classList.contains('hidden'),false);
  w.abrirMenu();assert.match(w.document.getElementById('detalhe-conteudo').textContent,/Nenhum arquivo de backup exportado ainda/);
  w.gatoStorage.setItem('gato_gordo_last_file_backup','2026-09-10T12:00:00Z');w.abrirMenu();assert.match(w.document.getElementById('detalhe-conteudo').textContent,/Última exportação:/);
  await w.abrirCopiasAutomaticas();assert.match(w.document.querySelector('dialog[open]').textContent,/Baixar cópia de/);assert.equal(app.requests.length,0);
 }finally{await app.close();}
});
test('dados corrompidos abrem recuperação sem executar app.js ou apagar o original',async()=>{
 const app=await boot({gato_gordo_perfis:'{broken'});
 try{const w=app.window;assert.equal(w.document.querySelector('script[src="js/app.js"]'),null);assert.match(w.document.querySelector('dialog[open]').textContent,/Recuperar o Gato Gordo/);assert.equal(w.localStorage.getItem('gato_gordo_perfis'),'{broken');}
 finally{await app.close();}
});
test('desconectar invalida uma resposta de sincronização que ainda está chegando',async()=>{
 const app=await boot({gato_gordo_perfis:JSON.stringify([profile])});
 try{
  const w=app.window;let resolveTimestamp;const calls=[];
  w.fetch=url=>{calls.push(url);return new Promise(resolve=>resolveTimestamp=()=>resolve({json:async()=>({timestamp:100})}));};
  w.abrirConfigSync();w.document.getElementById('f-sync-url').value='https://script.google.com/macros/s/TEST_DEPLOYMENT/exec';w.salvarConfigSync();
  assert.equal(calls.length,1);w.desconectarSync();resolveTimestamp();await new Promise(r=>setTimeout(r,20));
  assert.equal(calls.length,1);assert.equal(w.localStorage.getItem('gato_gordo_sync_paused'),'true');assert.equal(w.localStorage.getItem('gato_gordo_sync_url'),null);
 }finally{await app.close();}
});
test('mudança externa bloqueia edição com aviso de recuperação',async()=>{
 const app=await boot({gato_gordo_perfis:JSON.stringify([profile])});
 try{
  const w=app.window;w.localStorage.setItem('gato_gordo_perfis','[]');w.gatoStorage.handleExternalChange('gato_gordo_perfis');
  assert.match(w.document.querySelector('dialog[open]').textContent,/outra aba/);assert.throws(()=>w.gatoStorage.setItem('gato_gordo_perfis',JSON.stringify([profile])));assert.equal(w.localStorage.getItem('gato_gordo_perfis'),'[]');
 }finally{await app.close();}
});
test('backup sem grupos pode abrir a área compartilhada',async()=>{
 const app=await boot({gato_gordo_perfis:JSON.stringify([profile]),gato_gordo_grupos:'[]'});
 try{app.window.switchTab('compartilhado');assert.equal(app.window.document.getElementById('tab-compartilhado').classList.contains('hidden'),false);assert.equal(app.requests.length,0);}
 finally{await app.close();}
});
