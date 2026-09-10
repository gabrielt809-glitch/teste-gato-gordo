/* A sincronização só utiliza uma implantação do Apps Script configurada pelo usuário. */
(function (root) {
    'use strict';
    function normalize(value) {
        let url;
        try { url = new URL(value.trim()); } catch (_) { throw new Error('Cole um link HTTPS válido do Google Apps Script.'); }
        if (url.protocol !== 'https:' || url.hostname !== 'script.google.com' || url.port || url.username || url.password || url.search || url.hash || !/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url.pathname)) {
            throw new Error('Use o link publicado do Google Apps Script: https://script.google.com/macros/s/…/exec');
        }
        return url.href;
    }
    function configured(storage) {
        if (storage.getItem('gato_gordo_sync_paused') === 'true') return '';
        const raw = storage.getItem('gato_gordo_sync_url');
        if (!raw) return '';
        try { return normalize(raw); } catch (_) { return ''; }
    }
    function validateGroup(data) {
        const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
        if (!object(data)) throw new Error('O servidor retornou dados de grupo inválidos.');
        if (Object.hasOwn(data, 'pessoas') || Object.hasOwn(data, 'contas')) {
            if (!Array.isArray(data.pessoas) || !data.pessoas.every(object) || !Array.isArray(data.contas) || !data.contas.every(object)) {
                throw new Error('O servidor retornou um grupo incompleto. Os dados locais foram mantidos.');
            }
        }
        if (data.nome !== undefined && typeof data.nome !== 'string') throw new Error('Nome de grupo inválido.');
        if (data.regra !== undefined && !['igual', 'proporcional'].includes(data.regra)) throw new Error('Regra de divisão inválida.');
        return data;
    }
    root.GatoSyncConfig = { normalize, configured, validateGroup };
})(globalThis);
