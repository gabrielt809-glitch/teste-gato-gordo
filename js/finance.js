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
                if (t.tipo === 'despesa' || t.tipo === 'transferencia') total -= value;
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
    root.GatoFinance = { cents, dateKey, parseDate, addMonths, addDays, splitAmount, balance, monthSummary };
})(globalThis);
