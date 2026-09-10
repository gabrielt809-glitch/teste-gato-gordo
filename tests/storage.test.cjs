const {test} = require('node:test');
const assert = require('node:assert/strict');
const {IDBFactory} = require('fake-indexeddb');
require('../js/storage.js');
require('../js/backup.js');
const API = globalThis.GatoStorage;
const backup = globalThis.GatoBackup;
const profile = name => ({nome:name,senhaAtiva:false,contas:[],cartoes:[],transacoes:[],metas:[],categorias:[]});
class Local {
 constructor(values={}) {this.values=new Map(Object.entries(values));}
 getItem(key) {return this.values.get(key)??null;}
 setItem(key,value) {this.values.set(key,String(value));}
 removeItem(key) {this.values.delete(key);}
}
function fixture(values) {
 const local=new Local(values||{gato_gordo_perfis:JSON.stringify([profile('Gabriel')]),outro_app:'preservar'});
 const indexedDB=new IDBFactory();
 const status=[];
 const create=extra=>API.create({local,indexedDB,onStatus:s=>status.push(s),...extra});
 return {local,indexedDB,status,create};
}
test('dados existentes são copiados para IndexedDB sem alterar a origem',async()=>{
 const f=fixture();const before=[...f.local.values];const s=f.create();
 try {
  assert.equal((await s.init()).ready,true);
  assert.deepEqual([...f.local.values],before);
  const snapshots=await s.listSnapshots();assert.equal(snapshots.length,1);
  assert.equal(JSON.parse(snapshots[0].values.gato_gordo_perfis)[0].nome,'Gabriel');
 } finally {s.close();}
});
test('JSON corrompido oferece recuperação e não substitui a cópia válida',async()=>{
 const f=fixture();let s=f.create();await s.init();s.close();
 f.local.setItem('gato_gordo_perfis','{broken');s=f.create();
 try {
  const result=await s.init();assert.equal(result.ready,false);assert.equal(result.snapshots.length,1);
  assert.equal(f.local.getItem('gato_gordo_perfis'),'{broken');
  assert.equal(JSON.parse((await s.listSnapshots())[0].values.gato_gordo_perfis)[0].nome,'Gabriel');
 } finally {s.close();}
});
test('dados principais apagados não apagam as cópias automáticas',async()=>{
 const f=fixture();let s=f.create();await s.init();s.close();f.local.removeItem('gato_gordo_perfis');s=f.create();
 try {const result=await s.init();assert.equal(result.ready,false);assert.ok(result.snapshots.length);assert.equal(f.local.getItem('gato_gordo_perfis'),null);}
 finally{s.close();}
});
test('perfil estruturalmente inválido não inicia o app',async()=>{
 const f=fixture({gato_gordo_perfis:JSON.stringify([{nome:'Sem contas'}])});const s=f.create();
 try{assert.equal((await s.init()).ready,false);assert.equal((await s.listSnapshots()).length,0);}
 finally{s.close();}
});
test('IndexedDB indisponível mantém dados atuais e apresenta aviso',async()=>{
 const f=fixture();const s=f.create({indexedDB:null});
 try{assert.equal((await s.init()).ready,true);s.setItem('gato_gordo_perfis',JSON.stringify([profile('Novo')]));assert.equal(JSON.parse(f.local.getItem('gato_gordo_perfis'))[0].nome,'Novo');assert.match(s.status().warning,/indisponíveis/);}
 finally{s.close();}
});
test('falha na segunda cópia não perde gravação no armazenamento principal',async()=>{
 const f=fixture();const s=f.create();await s.init();s.close();
 s.setItem('gato_gordo_perfis',JSON.stringify([profile('Novo')]));
 assert.equal(await s.flush(),false);assert.equal(JSON.parse(f.local.getItem('gato_gordo_perfis'))[0].nome,'Novo');assert.match(s.status().warning,/não pôde ser salva/);
 s.close();
});
test('limita histórico a cinco versões além da cópia mais recente',async()=>{
 let clock=100000;const f=fixture();const s=f.create({now:()=>clock});
 try{
  await s.init();
  for(let i=0;i<9;i++){clock+=601000;s.setItem('gato_gordo_perfis',JSON.stringify([profile('Versão '+i)]));await s.flush();}
  const snaps=await s.listSnapshots();assert.equal(snaps.length,6);assert.equal(JSON.parse(snaps.find(x=>x.id==='latest').values.gato_gordo_perfis)[0].nome,'Versão 8');
 }finally{s.close();}
});
test('aba desatualizada é bloqueada antes de sobrescrever outra aba',async()=>{
 const f=fixture();const a=f.create(),b=f.create();
 try{
  await a.init();await b.init();
  a.setItem('gato_gordo_perfis',JSON.stringify([profile('Aba A')]));await a.flush();
  assert.throws(()=>b.setItem('gato_gordo_perfis',JSON.stringify([profile('Aba B')])));
  assert.equal(b.status().blocked,true);assert.equal(JSON.parse(f.local.getItem('gato_gordo_perfis'))[0].nome,'Aba A');
 }finally{a.close();b.close();}
});
test('falta de espaço bloqueia novas edições e preserva os dados gravados',async()=>{
 const f=fixture();const s=f.create();
 try{
  await s.init();f.local.setItem=()=>{throw Error('QuotaExceededError');};
  assert.throws(()=>s.setItem('gato_gordo_perfis','[]'));assert.equal(s.status().blocked,true);assert.equal(JSON.parse(f.local.getItem('gato_gordo_perfis'))[0].nome,'Gabriel');
 }finally{s.close();}
});
test('restauração em lote guarda somente o estado final na cópia automática',async()=>{
 const f=fixture();const s=f.create();
 try{
  await s.init();const current=backup.create(API.toBackup(s.readRaw().values));
  const next=backup.create({perfis:[profile('Restaurado')],grupos:[],settings:{}});
  backup.restore(s,next,current);await s.flush();
  const latest=(await s.listSnapshots()).find(x=>x.id==='latest');
  assert.equal(JSON.parse(latest.values.gato_gordo_perfis)[0].nome,'Restaurado');assert.equal(latest.values.gato_gordo_sync_paused,'true');
  assert.equal(JSON.parse(s.getItem('gato_gordo_pre_restore_v2')).backup.data.perfis[0].nome,'Gabriel');assert.equal(f.local.getItem('outro_app'),'preservar');
 }finally{s.close();}
});
test('falha durante restauração em lote recupera a origem e conserva IndexedDB',async()=>{
 const f=fixture();const s=f.create();
 try{
  await s.init();const write=f.local.setItem.bind(f.local);let fail=true;
  f.local.setItem=(k,v)=>{if(k==='gato_gordo_grupos'&&fail){fail=false;throw Error('quota');}write(k,v);};
  const current=backup.create(API.toBackup(s.readRaw().values));
  assert.throws(()=>backup.restore(s,backup.create({perfis:[profile('Novo')],grupos:[],settings:{}}),current));
  assert.equal(JSON.parse(s.getItem('gato_gordo_perfis'))[0].nome,'Gabriel');
  assert.equal(JSON.parse((await s.listSnapshots()).find(x=>x.id==='latest').values.gato_gordo_perfis)[0].nome,'Gabriel');assert.equal(s.status().blocked,false);
 }finally{s.close();}
});
test('não permite escrever chaves de outro aplicativo',async()=>{
 const f=fixture();const s=f.create();
 try{await s.init();assert.throws(()=>s.setItem('outro_app','alterar'));assert.equal(f.local.getItem('outro_app'),'preservar');}
 finally{s.close();}
});
test('perda só dos perfis também oferece recuperação, mesmo com grupos presentes',async()=>{
 const f=fixture({gato_gordo_perfis:JSON.stringify([profile('Gabriel')]),gato_gordo_grupos:JSON.stringify([{id:'CASA',nome:'Casa',pessoas:[],contas:[],regra:'igual'}])});
 let s=f.create();await s.init();s.close();f.local.removeItem('gato_gordo_perfis');s=f.create();
 try{assert.equal((await s.init()).ready,false);assert.equal(f.local.getItem('gato_gordo_perfis'),null);}
 finally{s.close();}
});
