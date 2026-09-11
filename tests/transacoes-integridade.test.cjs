const {test,afterEach}=require('node:test');
const assert=require('node:assert/strict');

function limpar(){
  for(const key of ['gatoStorage','GatoFinance','mostrarAlerta','salvarTransacaoAcao','excluirTransacaoAcao','excluirConta','excluirCartao','GatoMutacoesFinanceiras']) delete global[key];
  delete require.cache[require.resolve('../js/transacoes-integridade.js')];
}
afterEach(limpar);

function setup(audit){
  global.gatoStorage={getItem:()=>JSON.stringify([{contas:[],cartoes:[],transacoes:[]}])};
  global.GatoFinance={audit:()=>audit};
  global.mostrarAlerta=(m)=>{global.__alert=m;};
  global.salvarTransacaoAcao=()=>{global.__calls=(global.__calls||0)+1;};
  global.excluirTransacaoAcao=()=>{global.__calls=(global.__calls||0)+1;};
  global.excluirConta=()=>{global.__calls=(global.__calls||0)+1;};
  global.excluirCartao=()=>{global.__calls=(global.__calls||0)+1;};
  const oldSetInterval=global.setInterval, oldClearInterval=global.clearInterval;
  global.setInterval=(fn)=>{fn();return 1;};
  global.clearInterval=()=>{};
  require('../js/transacoes-integridade.js');
  global.setInterval=oldSetInterval; global.clearInterval=oldClearInterval;
}

test('bloqueia mutações quando a auditoria encontra erros',()=>{
  setup({ok:false,errors:['Conta inexistente: 99'],warnings:[]});
  global.salvarTransacaoAcao(1,'apenas');
  global.excluirTransacaoAcao(1,'apenas');
  global.excluirConta(0); global.excluirCartao(0);
  assert.equal(global.__calls,undefined);
  assert.match(global.__alert,/Operação bloqueada/);
});

test('permite mutações quando o estado está consistente',()=>{
  setup({ok:true,errors:[],warnings:[]});
  global.salvarTransacaoAcao(1,'apenas');
  global.excluirTransacaoAcao(1,'apenas');
  global.excluirConta(0); global.excluirCartao(0);
  assert.equal(global.__calls,4);
});

test('warnings não impedem operação',()=>{
  setup({ok:true,errors:[],warnings:['Cartão diverge do histórico']});
  global.salvarTransacaoAcao(1,'apenas');
  assert.equal(global.__calls,1);
});
