const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const context = {
  console,
  GatoFinance: { parseDate(value) { if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Data inválida.'); } },
  GatoFaturas: { meses: ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'], legado: true }
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(require.resolve('../js/ciclos-cartao.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(require.resolve('../js/faturas-ciclos.js'), 'utf8'), context);

const profile = {
  contas: [{ id: 1, nome: 'Nubank' }],
  cartoes: [{ id: 10, nome: 'Visa', diaFechamento: 12, diaVencimento: 20, utilizado: 500 }],
  transacoes: [
    { id: 1, tipo: 'despesa-cartao', cartaoId: 10, valor: 200, data: '2026-08-13' },
    { id: 2, tipo: 'despesa-cartao', cartaoId: 10, valor: 300, data: '2026-09-12' },
    { id: 3, tipo: 'despesa-cartao', cartaoId: 10, valor: 400, data: '2026-09-13' }
  ]
};

const summary = context.GatoFaturas.invoiceSummary(profile, 10, 8, 2026);
assert.equal(summary.total, 500);
assert.equal(summary.open, 500);
assert.equal(summary.ciclo.start, '2026-08-13');
assert.equal(summary.ciclo.end, '2026-09-12');
assert.equal(summary.ciclo.dueDate, '2026-09-20');

const payment = context.GatoFaturas.applyPayment(profile, {
  cardId: 10, accountId: 1, month: 8, year: 2026, amount: 100, date: '2026-09-15', id: 900
});
assert.equal(payment.faturaInicio, '2026-08-13');
assert.equal(payment.faturaFechamento, '2026-09-12');
assert.equal(payment.faturaVencimento, '2026-09-20');
assert.equal(profile.cartoes[0].utilizado, 400);
assert.equal(context.GatoFaturas.invoiceSummary(profile, 10, 8, 2026).open, 400);
assert.equal(context.GatoFaturas.invoiceSummary(profile, 10, 9, 2026).total, 400);

assert.throws(() => context.GatoFaturas.applyPayment(profile, {
  cardId: 10, accountId: 1, month: 8, year: 2026, amount: 401, date: '2026-09-16'
}), /maior que o valor em aberto/);

console.log('faturas-ciclos: 10 assertions passed');
