const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../js/backup.js');
const api = globalThis.GatoBackup;
const profile = { nome: 'Gabriel', senhaAtiva: true, pin: '1234', contas: [], cartoes: [], transacoes: [{ valor: 10 }], metas: [], categorias: [] };
const data = () => ({ perfis: [structuredClone(profile)], grupos: [{ id: 'ABC123', nome: 'Casa', pessoas: [], contas: [], regra: 'igual' }], settings: { syncUrl: 'https://example.com', activeGroupId: 'ABC123', syncTimestamps: { ABC123: 123 } } });
class Storage {
    constructor(entries = {}) { this.map = new Map(Object.entries(entries)); }
    getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
    setItem(k, v) { this.map.set(k, String(v)); }
    removeItem(k) { this.map.delete(k); }
}
test('backup v2 preserva perfil, PIN, grupos e configurações', () => {
    const input = data(); const backup = api.create(input);
    assert.equal(backup.version, 2); assert.ok(Date.parse(backup.createdAt));
    assert.deepEqual(api.normalize(JSON.parse(JSON.stringify(backup))), { ...input, settings: { ...input.settings, syncPaused: false } });
});
test('backup antigo é aceito, inclusive coleções opcionais ausentes', () => {
    const result = api.normalize({ perfis: [{ nome: 'Antigo' }], grupos: data().grupos });
    assert.deepEqual(result.perfis[0].categorias, []);
    assert.equal(result.settings.activeGroupId, 'ABC123');
});
test('formatos incorretos e estruturas corrompidas são rejeitados', () => {
    for (const bad of [null, {}, [], { ...api.create(data()), version: 3 }, { perfis: 'x', grupos: [] }, { perfis: [null], grupos: [] }]) assert.throws(() => api.normalize(bad));
    const bad = api.create(data()); bad.data.perfis[0].transacoes = {}; assert.throws(() => api.normalize(bad));
    const pin = api.create(data()); pin.data.perfis[0].pin = null; assert.throws(() => api.normalize(pin));
});
test('restaura somente as chaves do app e pausa sincronização', () => {
    const store = new Storage({ outro_app: 'preservado', gato_gordo_perfis: '[]', gato_gordo_compart: '{}' });
    api.restore(store, api.create(data()), api.create({ perfis: [], grupos: [], settings: {} }));
    assert.equal(store.getItem('outro_app'), 'preservado');
    assert.equal(store.getItem('gato_gordo_sync_paused'), 'true');
    assert.equal(store.getItem('gato_gordo_compart'), null);
    assert.equal(JSON.parse(store.getItem('gato_gordo_pre_restore_v2')).before.gato_gordo_perfis, '[]');
});
test('arquivo inválido não modifica armazenamento nem cópia anterior', () => {
    const store = new Storage({ gato_gordo_perfis: '[]' }); const before = [...store.map];
    assert.throws(() => api.restore(store, {}, {})); assert.deepEqual([...store.map], before);
});
test('falta de espaço para recuperação aborta antes de sobrescrever', () => {
    const store = new Storage({ gato_gordo_perfis: '[]' });
    store.setItem = () => { throw new Error('QuotaExceededError'); };
    assert.throws(() => api.restore(store, api.create(data()), {}));
    assert.equal(store.getItem('gato_gordo_perfis'), '[]');
});
test('falha durante gravação restaura valores anteriores e mantém cópia', () => {
    const store = new Storage({ gato_gordo_perfis: '[]', gato_gordo_grupos: '[]', outro: 'ok' });
    const write = store.setItem.bind(store); let fail = true;
    store.setItem = (k, v) => { if (k === 'gato_gordo_grupos' && fail) { fail = false; throw new Error('quota'); } write(k, v); };
    assert.throws(() => api.restore(store, api.create(data()), api.create({ perfis: [], grupos: [], settings: {} })));
    assert.equal(store.getItem('gato_gordo_perfis'), '[]'); assert.equal(store.getItem('gato_gordo_grupos'), '[]');
    assert.equal(store.getItem('outro'), 'ok'); assert.ok(store.getItem('gato_gordo_pre_restore_v2'));
});
