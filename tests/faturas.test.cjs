const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(require.resolve('../js/faturas.js'), 'utf8');
const context = { console };
vm.createContext(context);
vm.runInContext(source, context);
const F = context.GatoFaturas;

const profile = {
  contas: [{ id: 1, nome: 'Nubank' }, { id: 2, nome: 'Itaú' }],
  cartoes: [{ id: 10, nome: 'Visa', utilizado: 1200 }],
  transacoes: [
    { id: 101, tipo: 'despesa-cartao', cartaoId: 10, valor: 100, data: '2026-09-05', descricao: 'Mercado' },
    { id: 102, tipo: 'despesa-cartao', cartaoId: 10, valor: 50, data: '2026-09-12', descricao: 'Uber' },
    { id: 103, tipo: 'despesa-cartao', cartaoId: 10, valor: 30, data: '2026-08-12', descricao: 'Agosto' }
  ]
};

const period = F.parseMonthLabel('setembro de 2026');
assert.equal(period.month, 8);
assert.equal(period.year, 2026);
assert.equal(F.invoiceSummary(profile, 10, 8, 2026).total, 150);
assert.equal(F.invoiceSummary(profile, 10, 8, 2026).open, 150);

const payment = F.applyPayment(profile, {
  cardId: 10, accountId: 2, month: 8, year: 2026,
  amount: 100, date: '2026-09-15', id: 900
});
assert.equal(payment.tipo, 'pagamento_fatura');
assert.equal(payment.contaId, 2);
assert.equal(payment.cartaoId, 10);
assert.equal(payment.faturaMes, 8);
assert.equal(profile.cartoes[0].utilizado, 1100);
assert.equal(profile.transacoes.filter(t => t.cartaoId === 10 && t.tipo === 'despesa-cartao').length, 3);
assert.equal(F.invoiceSummary(profile, 10, 8, 2026).open, 50);

assert.throws(() => F.applyPayment(profile, {
  cardId: 10, accountId: 1, month: 8, year: 2026,
  amount: 51, date: '2026-09-16'
}), /maior que o valor em aberto/);

const full = F.applyPayment(profile, {
  cardId: 10, accountId: 1, month: 8, year: 2026,
  amount: 50, date: '2026-09-17', id: 901
});
assert.equal(full.contaId, 1);
assert.equal(F.invoiceSummary(profile, 10, 8, 2026).open, 0);
assert.equal(profile.cartoes[0].utilizado, 1050);

console.log('faturas: 12 assertions passed');
