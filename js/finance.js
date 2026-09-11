/* Datas locais e cálculos monetários compartilhados, sem acesso ao DOM ou armazenamento. */
(function (root) {
    'use strict';
    function cents(value) {
        const number = Number(value);
        if (!Number.isFinite(number)) throw new Error('Valor monetário inválido.');
        const result = Math.sign(number) * Math.round((Math.abs(number) + Number.EPSILON) * 100);
        if (!Number.isSafeInteger(result)) throw new Error('Valor monetário muito alto.');
        return result;
    }
    function dateKey(date = new Date()) {
        return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
    }
    function parseDate(value) {
        if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Informe uma data válida.');
        const [year,month,day] = value.split('-').map(Number);
        const date = new Date(year,month-1,day,12);
        if (year < 1900 || year > 9999 || dateKey(date) !== value) throw new Error('Informe uma data válida.');
        return date;
    }
    function addMonths(value, count) {
        const base = parseDate(value);
        const target = new Date(base.getFullYear(),base.getMonth()+count,1,12);
        const lastDay = new Date(target.getFullYear(),target.getMonth()+1,0,12).getDate();
        target.setDate(Math.min(base.getDate(),lastDay));
        const result = dateKey(target); parseDate(result); return result;
    }
    function addDays(value, count) {
        const date = parseDate(value); date.setDate(date.getDate()+count);
        const result = dateKey(date); parseDate(result); return result;
    }
    function splitAmount(value, count) {
        const total = cents(value);
        if (!Number.isInteger(count) || count < 1 || count > 120 || total < count) throw new Error('Use de 1 a 120 parcelas, com pelo menos R$ 0,01 em cada uma.');
        const base = Math.floor(total/count), remainder = total%count;
        return Array.from({length:count},(_,i)=>(base+(i<remainder?1:0))/100);
    }
    function balance(profile, cutoff = dateKey(), accountIds) {
        parseDate(cutoff);
        const ids = new Set(accountIds || profile.contas.map(c=>c.id));
        let total = profile.contas.filter(c=>ids.has(c.id)).reduce((sum,c)=>sum+cents(c.saldoInicial || 0),0);
        for (const t of profile.transacoes) {
            if (typeof t.data !== 'string' || t.data > cutoff) continue;
            const value = cents(t.valor || 0);
            if (ids.has(t.contaId)) {
                if (t.tipo === 'receita') total += value;
                if (t.tipo === 'despesa' || t.tipo === 'pagamento_fatura' || t.tipo === 'transferencia') total -= value;
            }
            if (t.tipo === 'transferencia' && ids.has(t.contaDestinoId)) total += value;
        }
        if (!Number.isSafeInteger(total)) throw new Error('Saldo fora do limite suportado.');
        return total/100;
    }
    function monthSummary(profile, year, month, today = dateKey()) {
        const first = dateKey(new Date(year,month,1,12));
        const last = dateKey(new Date(year,month+1,0,12));
        const cutoff = today < last ? today : last;
        return { initial: balance(profile,addDays(first,-1)), current: balance(profile,cutoff), projected: balance(profile,last), cutoff };
    }

    // Diagnóstico não destrutivo: identifica inconsistências antes que uma edição as agrave.
    function audit(profile) {
        const errors = [], warnings = [];
        if (!profile || typeof profile !== 'object') return { ok:false, errors:['Perfil inválido.'], warnings:[] };
        const contas = Array.isArray(profile.contas) ? profile.contas : [];
        const cartoes = Array.isArray(profile.cartoes) ? profile.cartoes : [];
        const transacoes = Array.isArray(profile.transacoes) ? profile.transacoes : [];
        const accountIds = new Set(), cardIds = new Set(), transactionIds = new Set();
        for (const c of contas) {
            if (accountIds.has(c.id)) errors.push(`Conta duplicada: ${c.id}.`);
            accountIds.add(c.id);
        }
        for (const c of cartoes) {
            if (cardIds.has(c.id)) errors.push(`Cartão duplicado: ${c.id}.`);
            cardIds.add(c.id);
            if (c.utilizado !== undefined) {
                try { if (cents(c.utilizado) < 0) errors.push(`Utilização negativa no cartão ${c.id}.`); }
                catch (_) { errors.push(`Utilização inválida no cartão ${c.id}.`); }
            }
        }
        const cardPurchases = new Map(), cardPayments = new Map();
        for (const t of transacoes) {
            if (transactionIds.has(t.id)) errors.push(`Lançamento duplicado: ${t.id}.`);
            transactionIds.add(t.id);
            try { parseDate(t.data); } catch (_) { errors.push(`Data inválida no lançamento ${t.id}.`); }
            try { if (cents(t.valor) <= 0) errors.push(`Valor inválido no lançamento ${t.id}.`); }
            catch (_) { errors.push(`Valor inválido no lançamento ${t.id}.`); }
            if (t.tipo === 'transferencia') {
                if (!accountIds.has(t.contaId)) errors.push(`Conta de origem inexistente no lançamento ${t.id}.`);
                if (!accountIds.has(t.contaDestinoId)) errors.push(`Conta de destino inexistente no lançamento ${t.id}.`);
                if (t.contaId === t.contaDestinoId) errors.push(`Transferência para a mesma conta no lançamento ${t.id}.`);
            } else if (t.tipo === 'despesa-cartao' || t.tipo === 'cartao') {
                if (!cardIds.has(t.cartaoId)) errors.push(`Cartão inexistente no lançamento ${t.id}.`);
                if (t.contaId !== null && t.contaId !== undefined) warnings.push(`Compra no cartão ${t.id} ainda possui conta associada.`);
                if (cardIds.has(t.cartaoId)) cardPurchases.set(t.cartaoId, (cardPurchases.get(t.cartaoId) || 0) + cents(t.valor));
            } else if (t.tipo === 'pagamento_fatura') {
                if (!accountIds.has(t.contaId)) errors.push(`Conta de pagamento inexistente no lançamento ${t.id}.`);
                if (!cardIds.has(t.cartaoId)) errors.push(`Cartão da fatura inexistente no lançamento ${t.id}.`);
                if (cardIds.has(t.cartaoId)) cardPayments.set(t.cartaoId, (cardPayments.get(t.cartaoId) || 0) + cents(t.valor));
            } else if (t.contaId !== null && t.contaId !== undefined && !accountIds.has(t.contaId)) {
                errors.push(`Conta inexistente no lançamento ${t.id}.`);
            }
        }
        for (const card of cartoes) {
            if (card.utilizado === undefined) continue;
            const purchases = cardPurchases.get(card.id) || 0;
            const payments = cardPayments.get(card.id) || 0;
            const expected = Math.max(0, purchases - payments);
            try {
                if (cents(card.utilizado) !== expected) warnings.push(`Utilização do cartão ${card.id} diverge do histórico (armazenado ${cents(card.utilizado)/100}; calculado ${expected/100}).`);
            } catch (_) {}
        }
        return { ok: errors.length === 0, errors, warnings };
    }

    root.GatoFinance = { cents, dateKey, parseDate, addMonths, addDays, splitAmount, balance, monthSummary, audit };
})(globalThis);
