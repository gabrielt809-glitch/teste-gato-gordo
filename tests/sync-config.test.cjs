const {test}=require('node:test');
const assert=require('node:assert/strict');
require('../js/sync-config.js');
const config=globalThis.GatoSyncConfig;
const url='https://script.google.com/macros/s/USER_DEPLOYMENT-123/exec';
const storage=values=>({getItem:key=>values[key]??null});
test('instalação nova nunca conecta a uma URL padrão',()=>assert.equal(config.configured(storage({})),''));
test('mantém apenas a implantação HTTPS explicitamente configurada',()=>assert.equal(config.configured(storage({gato_gordo_sync_url:url})),url));
test('pausa sobrevive ao recarregamento',()=>assert.equal(config.configured(storage({gato_gordo_sync_url:url,gato_gordo_sync_paused:'true'})),''));
test('rejeita links executáveis, domínios falsos, credenciais e URLs de edição',()=>{
 for(const invalid of ['javascript:alert(1)','http://script.google.com/macros/s/x/exec','https://script.google.com.evil.com/macros/s/x/exec','https://user:pass@script.google.com/macros/s/x/exec','https://script.google.com/macros/s/x/dev',url+'?token=x',url+'#x'])assert.throws(()=>config.normalize(invalid));
});
test('configuração inválida antiga não inicia chamadas de rede',()=>assert.equal(config.configured(storage({gato_gordo_sync_url:'https://example.com'})),''));
test('dados incompletos ou corrompidos da nuvem são rejeitados antes de substituir o grupo',()=>{
 for(const data of [null,[],{pessoas:[]},{contas:[]},{pessoas:[],contas:[null]},{pessoas:[],contas:[],nome:{}},{regra:'outra'}])assert.throws(()=>config.validateGroup(data));
 assert.deepEqual(config.validateGroup({pessoas:[],contas:[],regra:'igual'}),{pessoas:[],contas:[],regra:'igual'});
 assert.deepEqual(config.validateGroup({}),{});
});
