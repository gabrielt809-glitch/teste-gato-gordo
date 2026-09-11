const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(require.resolve('../js/parcelamentos.js'), 'utf8');
let profile = {
  contas: [],
  cartoes: [{ id: 10, nome: 'Visa', limite: 5000, utilizado: 1200 }],
  transacoes: Array.from({ length: 6 }, (_, i) => ({
    id: i + 1,
    tipo: 'despesa-cartao',
    descricao: `Notebook (${i + 1}/6)`,
    valor: 200,
    data: `2026-${String(9 + i > 12 ? 1 : 9 + i).padStart(2, '0')}-12`,
    cartaoId: 10,
    parcelamentoId: 1,
    parcelaNumero: i + 1,
    totalParcelas: 6,
    valorTotal: 1200,
    compraData: '2026-09-12',
    categoria: 'Outros'
  }))
};
profile.transacoes[2].data = '2026-11-12';
profile.transacoes[3].data = '2026-12-12';
profile.transacoes[4].data = '2027-01-12';
profile.transacoes[5].data = '2027-02-12';

const storage = {
  getItem: () => JSON.stringify([profile]),
  setItem: (_key, value) => { profile = JSON.parse(value)[0]; }
};

const context = {
  console,
  setTimeout,
  gatoStorage: storage,
  GatoFinance: {
    addMonths(value, count) {
      const d = new Date(value + 'T00:00:00');
      d.setMonth(d.getMonth() + count);
      return d.toISOString().slice(0, 10);
    },
    cents(value) { return Math.round(Number(value) * 100); }
  },
  GatoTransacoes: {
    normalize(_profile, fields) {
      return {
        tipo: 'despesa-cartao', descricao: fields.descricao, valor: Number(fields.valor),
        data: fields.data, contaId: null, cartaoId: Number(fields.cartaoId),
        contaDestinoId: null, categoria: fields.categoria
      };
    }
  },
  openModal() {},
  salvarTransacao() {},
  confirmarExcluirTransacao() {},
  salvarTransacaoAcao(id, _modo, values) {
    const t = profile.transacoes.find(x => x.id === id);
    const oldCard = profile.cartoes.find(c => c.id === t.cartaoId);
    oldCard.utilizado -= t.valor;
    const newCard = profile.cartoes.find(c => c.id === Number(values.cartaoId));
    newCard.utilizado += values.valor;
    Object.assign(t, values);
    storage.setItem('gato_gordo_perfis', JSON.stringify([profile]));
  },
  closeModal() {},
  renderPessoal() {},
  abrirTelaCartao() {},
  mostrarToast() {},
  mostrarAlerta() {},
  location: { reload() {} }
};

vm.createContext(context);
vm.runInContext(source, context);

context.GatoParcelamentos._pending = {
  id: 2,
  values: {
    tipo: 'despesa-cartao', descricao: 'Notebook atualizado', valor: 250,
    data: '2026-10-12', cartaoId: 10, categoria: 'Eletrônicos'
  }
};
context.GatoParcelamentos.aplicar('proximas');

assert.equal(profile.cartoes[0].utilizado, 1450);
assert.deepEqual(profile.transacoes.slice(0, 2).map(t => [t.valor, t.data]), [
  [200, '2026-09-12'], [250, '2026-10-12']
]);
assert.deepEqual(profile.transacoes.slice(2).map(t => [t.valor, t.data]), [
  [250, '2026-11-12'], [250, '2026-12-12'], [250, '2027-01-12'], [250, '2027-02-12']
]);
assert.equal(profile.transacoes.reduce((sum, t) => sum + t.valor, 0), 1450);
assert.equal(profile.transacoes[5].valorTotal, 1450);

console.log('parcelamentos-edicao: PASS');
