const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const financeSource = fs.readFileSync(require.resolve('../js/finance.js'), 'utf8');
const transactionsSource = fs.readFileSync(require.resolve('../js/transacoes.js'), 'utf8');
const context = { console };
vm.createContext(context);
vm.runInContext(financeSource, context);
vm.runInContext(transactionsSource, context);
const Finance = context.GatoFinance;
const T = context.GatoTransacoes;

const profile = {
  contas: [
    { id: 1, nome: 'Nubank', saldoInicial: 1000 },
    { id: 2, nome: 'Itaú', saldoInicial: 0 }
  ],
  cartoes: [{ id: 10, nome: 'Visa', utilizado: 0 }],
  transacoes: []
};

const installment = T.create(profile, {
  tipo: 'despesa-cartao',
  descricao: 'Notebook',
  valor: 1200,
  data: '2026-09-30',
  cartaoId: 10,
  categoria: 'Outros',
  recorrencia: 'parcelado',
  parcelas: 6
}, 5000);

assert.equal(installment.transactions.length, 6);
assert.equal(installment.transactions.reduce((sum, t) => sum + t.valor, 0), 1200);
assert.deepEqual(installment.transactions.map(t => t.valor), [200, 200, 200, 200, 200, 200]);
assert.deepEqual(installment.transactions.map(t => t.data), [
  '2026-09-30', '2026-10-30', '2026-11-30',
  '2026-12-30', '2027-01-30', '2027-02-28'
]);
assert.equal(installment.transactions.every(t => t.serieId === 5000), true);
assert.equal(installment.cardIncrease, 1200);

const monthly = T.create(profile, {
  tipo: 'despesa',
  descricao: 'Aluguel',
  valor: 1800,
  data: '2026-01-31',
  contaId: 1,
  categoria: 'Moradia',
  recorrencia: 'mensal'
}, 6000);
assert.equal(monthly.transactions.length, 24);
assert.equal(monthly.transactions[0].data, '2026-01-31');
assert.equal(monthly.transactions[1].data, '2026-02-28');
assert.equal(monthly.transactions[23].data, '2027-12-31');
assert.equal(new Set(monthly.transactions.map(t => t.serieId)).size, 1);

const weekly = T.create(profile, {
  tipo: 'receita',
  descricao: 'Freela',
  valor: 100,
  data: '2026-09-01',
  contaId: 2,
  categoria: 'Outros',
  recorrencia: 'semanal'
}, 7000);
assert.equal(weekly.transactions.length, 24);
assert.equal(weekly.transactions[0].data, '2026-09-01');
assert.equal(weekly.transactions[1].data, '2026-09-08');
assert.equal(weekly.transactions[23].data, '2027-02-16');

assert.throws(() => T.create(profile, {
  tipo: 'despesa-cartao', descricao: 'Streaming', valor: 50,
  data: '2026-09-10', cartaoId: 10, recorrencia: 'mensal'
}), /No cartão/);

assert.throws(() => T.create(profile, {
  tipo: 'transferencia', descricao: 'Transferência', valor: 100,
  data: '2026-09-10', contaId: 1, contaDestinoId: 1, recorrencia: 'nenhuma'
}), /conta de destino/);

assert.equal(Finance.splitAmount(100, 3).reduce((sum, value) => sum + value, 0), 100);
assert.deepEqual(Finance.splitAmount(100, 3), [33.34, 33.33, 33.33]);

console.log('transacoes: 17 assertions passed');
