/* Integra ciclos reais de cartão ao módulo de faturas sem apagar o histórico legado. */
(function (root) {
    'use strict';
    const C = root.GatoCiclosCartao;
    const F = root.GatoFaturas;
    if (!C || !F) return;

    function cycleTransactions(profile, cardId, month, year) { return C.transactionsForCycle(profile, cardId, month, year); }
    function cyclePayments(profile, cardId, month, year) {
        return (profile?.transacoes || []).filter(t => t.tipo === 'pagamento_fatura' && t.cartaoId === cardId && Number(t.faturaMes) === month && Number(t.faturaAno) === year);
    }
    function invoiceSummary(profile, cardId, month, year) {
        const purchases = cycleTransactions(profile, cardId, month, year);
        const paid = cyclePayments(profile, cardId, month, year);
        const total = purchases.reduce((sum, t) => sum + Number(t.valor || 0), 0);
        const totalPaid = paid.reduce((sum, t) => sum + Number(t.valor || 0), 0);
        const card = (profile?.cartoes || []).find(c => c.id === cardId);
        return { total, paid: totalPaid, open: Math.max(0, total - totalPaid), purchases, payments: paid, ciclo: card ? C.cycle(card, month, year) : null };
    }
    function applyPayment(profile, options) {
        const { cardId, accountId, month, year, amount, date, id } = options || {};
        const card = (profile?.cartoes || []).find(c => c.id === cardId);
        const account = (profile?.contas || []).find(c => c.id === accountId);
        if (!card) throw new Error('Cartão não encontrado.');
        if (!account) throw new Error('Conta de pagamento não encontrada.');
        const value = Number(amount);
        const valueCents = Math.round((value + Number.EPSILON) * 100);
        if (!Number.isFinite(valueCents) || valueCents <= 0) throw new Error('Informe um valor de pagamento maior que zero.');
        root.GatoFinance?.parseDate?.(date);
        const summary = invoiceSummary(profile, cardId, month, year);
        if (valueCents > Math.round((summary.open + Number.EPSILON) * 100)) throw new Error('O pagamento não pode ser maior que o valor em aberto da fatura.');
        const ciclo = summary.ciclo;
        const payment = {
            id: id || Date.now(), tipo: 'pagamento_fatura', descricao: `Pagamento Fatura ${F.meses[month]} de ${year}: ${card.nome}`,
            valor: valueCents / 100, data: date, contaId: accountId, cartaoId: cardId, faturaMes: month, faturaAno: year,
            faturaInicio: ciclo?.start || null, faturaFechamento: ciclo?.end || null, faturaVencimento: ciclo?.dueDate || null
        };
        profile.transacoes.push(payment);
        card.utilizado = Math.max(0, (Math.round(Number(card.utilizado || 0) * 100) - valueCents) / 100);
        return payment;
    }
    root.GatoFaturas = { ...F, invoiceTransactions: cycleTransactions, invoiceSummary, applyPayment };
    if (typeof document === 'undefined') return;

    function getProfile() { try { return JSON.parse(root.gatoStorage.getItem('gato_gordo_perfis') || '[]')[0] || null; } catch (_) { return null; } }
    function currentPeriod() {
        const detail = document.getElementById('detalhe-conteudo');
        const rootEl = detail?.querySelector('[data-fatura-mes][data-fatura-ano]');
        if (rootEl) return { month: Number(rootEl.dataset.faturaMes), year: Number(rootEl.dataset.faturaAno) };
        const label = detail?.querySelector('span.font-semibold.text-sm')?.textContent || '';
        return F.parseMonthLabel(label);
    }
    root.pagarFatura = function (cardIndex) {
        const profile = getProfile();
        const card = profile?.cartoes?.[cardIndex];
        if (!profile || !card) return root.mostrarAlerta('Cartão não encontrado.');
        const period = currentPeriod();
        const summary = invoiceSummary(profile, card.id, period.month, period.year);
        if (summary.open <= 0) return root.mostrarAlerta('Esta fatura não possui valor em aberto.');
        if (!profile.contas?.length) return root.mostrarAlerta('Crie uma conta para pagar a fatura.');
        const ciclo = summary.ciclo;
        const money = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
        const modal = document.getElementById('modal');
        const content = document.getElementById('modal-content-inner');
        modal.classList.remove('hidden');
        content.innerHTML = `
            <div class="space-y-4"><div><h3 class="text-lg font-bold">Pagar fatura</h3><p class="text-xs text-gray-500 mt-1">${card.nome} • ${ciclo ? C.formatRange(ciclo) : `${F.meses[period.month]} de ${period.year}`}</p></div>
            ${ciclo ? `<div class="card-premium rounded-xl p-4"><div class="flex justify-between text-xs text-gray-500"><span>Fechamento</span><span>${ciclo.end}</span></div><div class="flex justify-between text-xs text-gray-500 mt-1"><span>Vencimento</span><span>${ciclo.dueDate}</span></div></div>` : ''}
            <div class="card-premium rounded-xl p-4"><div class="flex justify-between text-sm"><span>Em aberto</span><strong class="text-red-400">${money(summary.open)}</strong></div><div class="flex justify-between text-xs text-gray-500 mt-2"><span>Já pago</span><span>${money(summary.paid)}</span></div></div>
            <label class="text-xs text-gray-400">Conta de pagamento</label><select id="f-fatura-conta" class="w-full p-3 rounded-xl">${profile.contas.map(c => `<option value="${c.id}">${c.nome}</option>`).join('')}</select>
            <label class="text-xs text-gray-400">Valor do pagamento</label><input id="f-fatura-valor" type="number" min="0.01" max="${summary.open.toFixed(2)}" step="0.01" value="${summary.open.toFixed(2)}" class="w-full p-3 rounded-xl">
            <label class="text-xs text-gray-400">Data do pagamento</label><input id="f-fatura-data" type="date" value="${root.GatoFinance?.dateKey?.() || new Date().toISOString().slice(0,10)}" class="w-full p-3 rounded-xl">
            <button id="btn-pagar-fatura" class="w-full bg-amber-500 text-black font-bold py-3 rounded-xl">Registrar pagamento</button><button onclick="closeModal()" class="w-full py-2 text-gray-500 text-xs">Cancelar</button></div>`;
        document.getElementById('btn-pagar-fatura').onclick = () => {
            try {
                const amount = Number(document.getElementById('f-fatura-valor').value);
                const accountId = Number(document.getElementById('f-fatura-conta').value);
                const date = document.getElementById('f-fatura-data').value;
                const fresh = getProfile();
                applyPayment(fresh, { cardId: card.id, accountId, month: period.month, year: period.year, amount, date });
                const profiles = JSON.parse(root.gatoStorage.getItem('gato_gordo_perfis') || '[]'); profiles[0] = fresh;
                root.gatoStorage.setItem('gato_gordo_perfis', JSON.stringify(profiles));
                root.closeModal(); root.renderPessoal(); root.abrirTelaCartao(cardIndex); root.mostrarToast('Pagamento registrado sem apagar as compras da fatura.');
            } catch (error) { root.mostrarAlerta(error.message); }
        };
    };
})(globalThis);
