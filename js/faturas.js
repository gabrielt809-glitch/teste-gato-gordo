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
        if (root.GatoFinance?.parseDate) root.GatoFinance.parseDate(date);
        else if (typeof date !== 'string' || !/^\\d{4}-\\d{2}-\\d{2}$/.test(date)) throw new Error('Informe uma data válida.');
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

    function removePayment(profile, paymentId) {
        const index = (profile?.transacoes || []).findIndex(t => t.id === paymentId && t.tipo === 'pagamento_fatura');
        if (index < 0) throw new Error('Pagamento de fatura não encontrado.');
        const payment = profile.transacoes[index];
        const card = (profile.cartoes || []).find(c => c.id === payment.cartaoId);
        if (!card) throw new Error('Cartão do pagamento não encontrado.');
        profile.transacoes.splice(index, 1);
        card.utilizado = (cents(card.utilizado || 0) + cents(payment.valor || 0)) / 100;
        return payment;
    }

    root.GatoFaturas = {
        parseMonthLabel,
        invoiceTransactions,
        payments,
        invoiceSummary,
        applyPayment,
        removePayment,
        meses: MESES
    };

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

    // Pagamentos de fatura não são despesas comuns do cartão. Ao removê-los,
    // o limite utilizado precisa voltar a subir (a operação inversa de pagar).
    const confirmarExcluirOriginal = root.confirmarExcluirTransacao;
    if (typeof confirmarExcluirOriginal === 'function') {
        root.confirmarExcluirTransacao = function (id) {
            const profile = getProfile();
            const payment = profile?.transacoes?.find(t => t.id === id && t.tipo === 'pagamento_fatura');
            if (!payment) return confirmarExcluirOriginal(id);

            root.mostrarConfirmacao(
                `Excluir o pagamento de ${payment.descricao}? O valor será devolvido ao limite utilizado do cartão e a saída da conta deixará de aparecer no saldo.`,
                () => {
                    try {
                        const fresh = getProfile();
                        const removed = removePayment(fresh, id);
                        saveProfile(fresh);
                        root.renderPessoal();
                        const cardIndex = fresh.cartoes.findIndex(c => c.id === removed.cartaoId);
                        if (cardIndex >= 0 && typeof root.abrirTelaCartao === 'function') root.abrirTelaCartao(cardIndex);
                        root.mostrarToast('Pagamento excluído e limite do cartão restaurado.');
                    } catch (error) { root.mostrarAlerta(error.message); }
                },
                { titulo: 'Excluir pagamento', perigo: true, textoConfirmar: 'Excluir' }
            );
        };
    }

    // Um pagamento de fatura não pode ser editado como uma transação comum:
    // seus campos têm semântica própria (fatura, cartão e conta de pagamento).
    const openModalOriginal = root.openModal;
    if (typeof openModalOriginal === 'function') {
        root.openModal = function (tipo, editId, ...rest) {
            if (tipo === 'transacao' && editId !== null && editId !== undefined) {
                const profile = getProfile();
                const payment = profile?.transacoes?.find(t => t.id === editId && t.tipo === 'pagamento_fatura');
                if (payment) {
                    const card = profile.cartoes.find(c => c.id === payment.cartaoId);
                    const account = profile.contas.find(c => c.id === payment.contaId);
                    const modal = document.getElementById('modal');
                    const content = document.getElementById('modal-content-inner');
                    modal.classList.remove('hidden');
                    content.innerHTML = `
                        <div class="space-y-4">
                            <div class="text-center">
                                <div class="w-14 h-14 rounded-2xl bg-green-500/10 text-green-400 flex items-center justify-center mx-auto mb-3 text-2xl">✓</div>
                                <h3 class="text-lg font-bold">Pagamento de fatura</h3>
                                <p class="text-xs text-gray-500 mt-1">${payment.descricao}</p>
                            </div>
                            <div class="card-premium rounded-xl p-4 space-y-2 text-sm">
                                <div class="flex justify-between"><span class="text-gray-500">Valor</span><strong>R$ ${Number(payment.valor).toFixed(2).replace('.', ',')}</strong></div>
                                <div class="flex justify-between"><span class="text-gray-500">Cartão</span><span>${card?.nome || '—'}</span></div>
                                <div class="flex justify-between"><span class="text-gray-500">Conta</span><span>${account?.nome || '—'}</span></div>
                                <div class="flex justify-between"><span class="text-gray-500">Data</span><span>${payment.data}</span></div>
                            </div>
                            <button onclick="confirmarExcluirTransacao(${payment.id})" class="w-full bg-red-500/10 text-red-400 font-bold py-3 rounded-xl">Excluir pagamento</button>
                            <button onclick="closeModal()" class="w-full py-2 text-gray-500 text-xs">Fechar</button>
                        </div>
                    `;
                    return;
                }
            }
            return openModalOriginal(tipo, editId, ...rest);
        };
    }
})(globalThis);
