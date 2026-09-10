const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const financeSource = fs.readFileSync(require.resolve('../js/finance.js'), 'utf8');
const transactionsSource = fs.readFileSync(require.resolve('../js/transacoes.js'), 'utf8');
const cyclesSource = fs.readFileSync(require.resolve('../js/ciclos-cartao.js'), 'utf8');
const context = { console };
vm.createContext(context);
vm.runInContext(financeSource, context);
vm.runInContext(transactionsSource, context);
vm.runInContext(cyclesSource, context);

const T = context.GatoTransacoes;
const C = context.GatoCiclosCartao;

const profile = {
  contas: [{ id: 1, nome: 'Conta', saldoInicial: 0 }],
  cartoes: [{ id: 10, nome: 'Visa', limite: 5000, utilizado: 0, diaFechamento: 12, diaVencimento: 20 }],
  transacoes: []
};

const result = T.create(profile, {
  tipo: 'despesa-cartao',
  descricao: 'Notebook',
  valor: 1200,
  data: '2026-09-12',
  cartaoId: 10,
  categoria: 'Eletrônicos',
  recorrencia: 'parcelado',
  parcelas: 6
}, 10000);
profile.transacoes.push(...result.transactions);

assert.equal(result.transactions.length, 6);
assert.equal(result.cardIncrease, 1200);
assert.equal(new Set(result.transactions.map(t => t.parcelamentoId)).size, 1);
assert.deepEqual(Array.from(result.transactions, t => t.parcelaNumero), [1, 2, 3, 4, 5, 6]);
assert.equal(new Set(result.transactions.map(t => t.totalParcelas)).size, 1);
assert.equal(result.transactions[0].valorTotal, 1200);
assert.equal(result.transactions[0].compraData, '2026-09-12');
assert.equal(result.transactions[0].data, '2026-09-12');
assert.equal(result.transactions[1].data, '2026-10-12');
assert.equal(result.transactions[5].data, '2027-02-12');

// Fechamento dia 12: 12/09 ainda pertence à fatura que fecha em 12/09.
const setembro = C.transactionsForCycle(profile, 10, 8, 2026);
assert.equal(setembro.length, 1);
assert.equal(setembro[0].parcelaNumero, 1);

// A parcela seguinte, em 12/10, pertence à fatura que fecha em 12/10.
const outubro = C.transactionsForCycle(profile, 10, 9, 2026);
assert.equal(outubro.length, 1);
assert.equal(outubro[0].parcelaNumero, 2);

// Compra feita depois do fechamento entra na próxima fatura desde a 1ª parcela.
const afterClosingProfile = {
  contas: [{ id: 1, nome: 'Conta', saldoInicial: 0 }],
  cartoes: [{ id: 10, nome: 'Visa', limite: 5000, utilizado: 0, diaFechamento: 12, diaVencimento: 20 }],
  transacoes: []
};
const afterClosing = T.create(afterClosingProfile, {
  tipo: 'despesa-cartao',
  descricao: 'Celular',
  valor: 900,
  data: '2026-09-13',
  cartaoId: 10,
  recorrencia: 'parcelado',
  parcelas: 3
}, 20000);
afterClosingProfile.transacoes.push(...afterClosing.transactions);

assert.equal(C.transactionsForCycle(afterClosingProfile, 10, 8, 2026).length, 0);
const outubroAfterClosing = C.transactionsForCycle(afterClosingProfile, 10, 9, 2026);
assert.equal(outubroAfterClosing.length, 1);
assert.equal(outubroAfterClosing[0].parcelaNumero, 1);

console.log('parcelamento-ciclos: 16 assertions passed');
