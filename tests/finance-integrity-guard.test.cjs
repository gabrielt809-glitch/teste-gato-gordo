const {test, afterEach}=require('node:test');
const assert=require('node:assert/strict');

afterEach(()=>{
  delete global.openModal;
  delete global.salvarTransacao;
  delete global.confirmarExcluirTransacao;
  delete global.salvarTransacaoAcao;
  delete global.excluirTransacaoAcao;
  delete global.gatoStorage;
  delete global.GatoFinance;
  delete global.GatoFinanceIntegrityGuard;
  delete global.mostrarAlerta;
  delete global.mostrarToast;
  delete require.cache[require.resolve('../js/parcelamentos.js')];
});

function setup(result){
  global.openModal=()=>{};
  global.salvarTransacao=()=>{};
  global.confirmarExcluirTransacao=()=>{};
  global.salvarTransacaoAcao=()=>{global.__called=(global.__called||0)+1;};
  global.excluirTransacaoAcao=()=>{global.__called=(global.__called||0)+1;};
  global.gatoStorage={getItem:()=>JSON.stringify([{contas:[],cartoes:[],transacoes:[]}])};
  global.GatoFinance={audit:()=>result};
  global.mostrarAlerta=(message)=>{global.__alert=message;};
  require('../js/parcelamentos.js');
}

test('guard bloqueia edição e exclusão quando a auditoria encontra erros',()=>{
  setup({ok:false,errors:['Conta inexistente: 99'],warnings:[]});
  assert.equal(global.GatoFinanceIntegrityGuard.auditBefore('teste'),false);
  global.salvarTransacaoAcao(1,'apenas');
  global.excluirTransacaoAcao(1,'apenas');
  assert.equal(global.__called,undefined);
  assert.match(global.__alert,/Operação bloqueada/);
});

test('guard permite mutações quando o estado está consistente',()=>{
  setup({ok:true,errors:[],warnings:[]});
  global.salvarTransacaoAcao(1,'apenas');
  global.excluirTransacaoAcao(1,'apenas');
  assert.equal(global.__called,2);
});

test('guard não bloqueia apenas por warnings',()=>{
  setup({ok:true,errors:[],warnings:['Cartão diverge do histórico']});
  global.salvarTransacaoAcao(1,'apenas');
  assert.equal(global.__called,1);
});
