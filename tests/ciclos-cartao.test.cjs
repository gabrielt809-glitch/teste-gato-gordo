const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(require.resolve('../js/ciclos-cartao.js'), 'utf8');
const context = { console };
vm.createContext(context);
vm.runInContext(source, context);
const C = context.GatoCiclosCartao;

const card = { id: 10, diaFechamento: 12, diaVencimento: 20 };
const setembro = C.cycle(card, 8, 2026);
assert.equal(setembro.start, '2026-08-13');
assert.equal(setembro.end, '2026-09-12');
assert.equal(setembro.dueDate, '2026-09-20');
assert.equal(C.cycleForDate(card, '2026-08-13').month, 8);
assert.equal(C.cycleForDate(card, '2026-09-12').month, 8);
assert.equal(C.cycleForDate(card, '2026-09-13').month, 9);
assert.equal(C.cycleForDate(card, '2026-10-01').month, 9);

const profile = {
  cartoes: [card],
  transacoes: [
    { id: 1, tipo: 'despesa-cartao', cartaoId: 10, valor: 100, data: '2026-08-12' },
    { id: 2, tipo: 'despesa-cartao', cartaoId: 10, valor: 200, data: '2026-08-13' },
    { id: 3, tipo: 'despesa-cartao', cartaoId: 10, valor: 300, data: '2026-09-12' },
    { id: 4, tipo: 'despesa-cartao', cartaoId: 10, valor: 400, data: '2026-09-13' },
    { id: 5, tipo: 'despesa', cartaoId: 10, valor: 999, data: '2026-09-10' }
  ]
};
const cicloSetembro = C.transactionsForCycle(profile, 10, 8, 2026);
assert.equal(cicloSetembro.length, 2);
assert.equal(cicloSetembro.reduce((sum, t) => sum + t.valor, 0), 500);
assert.deepEqual(Array.from(cicloSetembro).map(t => t.id), [2, 3]);
const cicloOutubro = C.transactionsForCycle(profile, 10, 9, 2026);
assert.equal(cicloOutubro.length, 1);
assert.equal(cicloOutubro[0].id, 4);

const febCard = { diaFechamento: 31, diaVencimento: 5 };
const feb = C.cycle(febCard, 1, 2026);
assert.equal(feb.end, '2026-02-28');
assert.equal(feb.start, '2026-02-01');
assert.equal(feb.dueDate, '2026-03-05');

console.log('ciclos-cartao: 14 assertions passed');
