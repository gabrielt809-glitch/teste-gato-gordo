/* Faturas e pagamentos: preserva compras no histórico e registra a quitação separadamente. */
(function (root) {
    'use strict';

    const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

    function cents(value) {
        const n = Number(value);
        if (!Number.isFinite(n)) throw new Error('Valor monetário inválido.');
        return Math.round((n + Number.EPSILON) * 100);
    }

    function parseMonthLabel(text, fallbackDate) {
        const source = String(text || '').toLowerCase();
        const match = source.match(new RegExp(`(${MESES.join('|')})\\s+de\\s+(\\d{4})`));
        if (match) return { month: MESES.indexOf(match[1]), year: Number(match[2]) };
        const d = fallbackDate || new Date();
        return { month: d.getMonth(), year: d.getFullYear() };
    }

    function invoiceTransactions(profile, cardId, month, year) {
        return (profile?.transacoes || []).filter(t => {
            if (t.cartaoId !== cardId) return false;
            if (t.tipo !== 'despesa-cartao' && t.tipo !== 'cartao') return false;
            const d = new Date(String(t.data) + 'T00:00:00');
            return d.getMonth() === month && d.getFullYear() === year;
        });
    }

    function payments(profile, cardId, month, year) {
        return (profile?.transacoes || []).filter(t =>
            t.tipo === 'pagamento_fatura' && t.cartaoId === cardId &&
            Number(t.faturaMes) === month && Number(t.faturaAno) === year
        );
    }

    function invoiceSummary(profile, cardId, month, year) {
        const purchases = invoiceTransactions(profile, cardId, month, year);
        const paid = payments(profile, cardId, month, year);
        const total = purchases.reduce((sum, t) => sum + Number(t.valor || 0), 0);
        const totalPaid = paid.reduce((sum, t) => sum + Number(t.valor || 0), 0);
        return {
            total,
            paid: totalPaid,
            open: Math.max(0, total - totalPaid),
            purchases,
            payments: paid
        };
    }

    function applyPayment(profile, options) {
        const { cardId, accountId, month, year, amount, date, id } = options || {};
        const card = (profile?.cartoes || []).find(c => c.id === cardId);
        const account = (profile?.contas || []).find(c => c.id === accountId);
        if (!card) throw new Error('Cartão não encontrado.');
        if (!account) throw new Error('Conta de pagamento não encontrada.');
        const valueCents = cents(amount);
        if (valueCents <= 0) throw new Error('Informe um valor de pagamento maior que zero.');
        const summary = invoiceSummary(profile, cardId, month, year);
        if (valueCents > cents(summary.open)) throw new Error('O pagamento não pode ser maior que o valor em aberto da fatura.');
        const payment = {
            id: id || Date.now(),
            tipo: 'pagamento_fatura',
            descricao: `Pagamento Fatura ${MESES[month]} de ${year}: ${card.nome}`,
            valor: valueCents / 100,
            data: date,
            contaId: accountId,
            cartaoId: cardId,
            faturaMes: month,
            faturaAno: year
        };
        profile.transacoes.push(payment);
        card.utilizado = Math.max(0, (cents(card.utilizado || 0) - valueCents) / 100);
        return payment;
    }

    root.GatoFaturas = { parseMonthLabel, invoiceTransactions, payments, invoiceSummary, applyPayment, meses: MESES };

    if (typeof document === 'undefined') return;

    function getProfile() {
        try {
            const profiles = JSON.parse(root.gatoStorage.getItem('gato_gordo_perfis') || '[]');
            return profiles[0] || null;
        } catch (_) { return null; }
    }

    function saveProfile(profile) {
        const profiles = JSON.parse(root.gatoStorage.getItem('gato_gordo_perfis') || '[]');
        if (!profiles.length) throw new Error('Perfil não encontrado.');
        profiles[0] = profile;
        root.gatoStorage.setItem('gato_gordo_perfis', JSON.stringify(profiles));
    }

    function currentPeriod() {
        const detail = document.getElementById('detalhe-conteudo');
        const label = detail?.querySelector('span.font-semibold.text-sm')?.textContent || '';
        return parseMonthLabel(label);
    }

    function openPaymentModal(cardIndex) {
        const profile = getProfile();
        const card = profile?.cartoes?.[cardIndex];
        if (!profile || !card) return root.mostrarAlerta('Cartão não encontrado.');
        const period = currentPeriod();
        const summary = invoiceSummary(profile, card.id, period.month, period.year);
        if (summary.open <= 0) return root.mostrarAlerta('Esta fatura não possui valor em aberto.');
        if (!profile.contas?.length) return root.mostrarAlerta('Crie uma conta para pagar a fatura.');

        const modal = document.getElementById('modal');
        const content = document.getElementById('modal-content-inner');
        modal.classList.remove('hidden');
        content.innerHTML = `
            <div class="space-y-4">
                <div>
                    <h3 class="text-lg font-bold">Pagar fatura</h3>
                    <p class="text-xs text-gray-500 mt-1">${card.nome} • ${MESES[period.month]} de ${period.year}</p>
                </div>
                <div class="card-premium rounded-xl p-4">
                    <div class="flex justify-between text-sm"><span>Em aberto</span><strong class="text-red-400">R$ ${summary.open.toFixed(2).replace('.', ',')}</strong></div>
                    <div class="flex justify-between text-xs text-gray-500 mt-2"><span>Já pago</span><span>R$ ${summary.paid.toFixed(2).replace('.', ',')}</span></div>
                </div>
                <label class="text-xs text-gray-400">Conta de pagamento</label>
                <select id="f-fatura-conta" class="w-full p-3 rounded-xl">
                    ${profile.contas.map(c => `<option value="${c.id}">${c.nome}</option>`).join('')}
                </select>
                <label class="text-xs text-gray-400">Valor do pagamento</label>
                <input id="f-fatura-valor" type="number" min="0.01" max="${summary.open.toFixed(2)}" step="0.01" value="${summary.open.toFixed(2)}" class="w-full p-3 rounded-xl">
                <label class="text-xs text-gray-400">Data do pagamento</label>
                <input id="f-fatura-data" type="date" value="${root.GatoFinance?.dateKey?.() || new Date().toISOString().slice(0,10)}" class="w-full p-3 rounded-xl">
                <button id="btn-pagar-fatura" class="w-full bg-amber-500 text-black font-bold py-3 rounded-xl">Registrar pagamento</button>
                <button onclick="closeModal()" class="w-full py-2 text-gray-500 text-xs">Cancelar</button>
            </div>
        `;
        document.getElementById('btn-pagar-fatura').onclick = () => {
            try {
                const amount = Number(document.getElementById('f-fatura-valor').value);
                const accountId = Number(document.getElementById('f-fatura-conta').value);
                const date = document.getElementById('f-fatura-data').value;
                const fresh = getProfile();
                applyPayment(fresh, { cardId: card.id, accountId, month: period.month, year: period.year, amount, date });
                saveProfile(fresh);
                root.closeModal();
                root.renderPessoal();
                root.abrirTelaCartao(cardIndex);
                root.mostrarToast('Pagamento registrado sem apagar as compras da fatura.');
            } catch (error) { root.mostrarAlerta(error.message); }
        };
    }

    root.pagarFatura = openPaymentModal;
})(globalThis);
