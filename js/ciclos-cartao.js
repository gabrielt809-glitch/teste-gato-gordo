/* Ciclos de cartão: transforma fechamento/vencimento em datas reais de fatura. */
(function (root) {
    'use strict';

    const DAY_MS = 24 * 60 * 60 * 1000;

    function parseDate(value) {
        if (value instanceof Date && !Number.isNaN(value.getTime())) {
            return new Date(value.getFullYear(), value.getMonth(), value.getDate());
        }
        if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            throw new Error('Data inválida.');
        }
        const [year, month, day] = value.split('-').map(Number);
        const d = new Date(year, month - 1, day);
        if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) throw new Error('Data inválida.');
        return d;
    }

    function dateKey(value) {
        const d = parseDate(value);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    function daysInMonth(year, monthIndex) {
        return new Date(year, monthIndex + 1, 0).getDate();
    }

    function validDay(value, fallback) {
        const n = Number(value);
        return Number.isInteger(n) && n >= 1 && n <= 31 ? n : fallback;
    }

    function closingDate(card, monthIndex, year) {
        const day = Math.min(validDay(card?.diaFechamento, 1), daysInMonth(year, monthIndex));
        return new Date(year, monthIndex, day);
    }

    function addDays(value, amount) {
        const d = parseDate(value);
        d.setDate(d.getDate() + amount);
        return d;
    }

    function addMonthsClamped(value, amount, preferredDay) {
        const d = parseDate(value);
        const target = new Date(d.getFullYear(), d.getMonth() + amount, 1);
        const day = Math.min(preferredDay || d.getDate(), daysInMonth(target.getFullYear(), target.getMonth()));
        return new Date(target.getFullYear(), target.getMonth(), day);
    }

    // O ciclo identificado por mês/ano é o ciclo que fecha naquele mês.
    // Ex.: fechamento dia 12 => ciclo de setembro = 13/08 a 12/09.
    function cycle(card, monthIndex, year) {
        const end = closingDate(card, monthIndex, year);
        const start = addDays(end, -1);
        start.setDate(start.getDate());
        // O início correto é o dia seguinte ao fechamento anterior.
        const previousEnd = addMonthsClamped(end, -1, validDay(card?.diaFechamento, 1));
        const startDate = addDays(previousEnd, 1);
        return {
            month: monthIndex,
            year,
            start: dateKey(startDate),
            end: dateKey(end),
            closingDate: dateKey(end),
            dueDate: dateKey(dueDate(card, end))
        };
    }

    function dueDate(card, endDate) {
        const end = parseDate(endDate);
        const dueDay = validDay(card?.diaVencimento, 10);
        const dueMonth = dueDay > end.getDate() ? end : new Date(end.getFullYear(), end.getMonth() + 1, 1);
        return new Date(dueMonth.getFullYear(), dueMonth.getMonth(), Math.min(dueDay, daysInMonth(dueMonth.getFullYear(), dueMonth.getMonth())));
    }

    function cycleForDate(card, value) {
        const d = parseDate(value);
        const closingDay = validDay(card?.diaFechamento, 1);
        let month = d.getMonth();
        let year = d.getFullYear();
        if (d.getDate() > Math.min(closingDay, daysInMonth(year, month))) {
            const next = new Date(year, month + 1, 1);
            month = next.getMonth();
            year = next.getFullYear();
        }
        return cycle(card, month, year);
    }

    function sameCycle(card, value, monthIndex, year) {
        const c = cycleForDate(card, value);
        return c.month === monthIndex && c.year === year;
    }

    function transactionsForCycle(profile, cardId, monthIndex, year) {
        const card = (profile?.cartoes || []).find(c => c.id === cardId);
        if (!card) return [];
        return (profile.transacoes || []).filter(t => {
            if (t.cartaoId !== cardId) return false;
            if (t.tipo !== 'despesa-cartao' && t.tipo !== 'cartao') return false;
            try { return sameCycle(card, t.data, monthIndex, year); }
            catch (_) { return false; }
        });
    }

    function formatDate(value) {
        return parseDate(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    }

    function formatRange(c) {
        return `${formatDate(c.start)} – ${formatDate(c.end)}`;
    }

    function daysUntil(value, today) {
        const target = parseDate(value);
        const base = parseDate(today || new Date().toISOString().slice(0, 10));
        return Math.round((target - base) / DAY_MS);
    }

    function isCurrent(card, monthIndex, year, today) {
        const d = parseDate(today || new Date().toISOString().slice(0, 10));
        const c = cycleForDate(card, d);
        return c.month === monthIndex && c.year === year;
    }

    root.GatoCiclosCartao = {
        parseDate,
        dateKey,
        closingDate,
        dueDate,
        cycle,
        cycleForDate,
        transactionsForCycle,
        formatRange,
        daysUntil,
        isCurrent
    };

    if (typeof document === 'undefined') return;

    // A tela antiga continua sendo usada para contas. Aqui substituímos apenas o detalhe do cartão.
    const abrirTelaCartaoOriginal = root.abrirTelaCartao;
    if (typeof abrirTelaCartaoOriginal !== 'function') return;

    root.abrirTelaCartao = function (idx) {
        const p = typeof root.perfil === 'function' ? root.perfil() : null;
        // app.js mantém perfil() no escopo do IIFE, portanto usamos o storage como fallback.
        let profile = p;
        if (!profile) {
            try {
                const profiles = JSON.parse(root.gatoStorage?.getItem('gato_gordo_perfis') || '[]');
                profile = profiles[0] || null;
            } catch (_) {}
        }
        const cartao = profile?.cartoes?.[idx];
        if (!cartao) return abrirTelaCartaoOriginal(idx);

        const monthLabel = document.getElementById('mes-atual-pessoal')?.textContent || '';
        const match = monthLabel.toLowerCase().match(/(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+(\d{4})/);
        if (!match) return abrirTelaCartaoOriginal(idx);
        const months = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
        const month = months.indexOf(match[1]);
        const year = Number(match[2]);
        const c = cycle(cartao, month, year);
        const purchases = transactionsForCycle(profile, cartao.id, month, year);
        const total = purchases.reduce((sum, t) => sum + Number(t.valor || 0), 0);
        const payments = (profile.transacoes || []).filter(t => t.tipo === 'pagamento_fatura' && t.cartaoId === cartao.id && Number(t.faturaMes) === month && Number(t.faturaAno) === year);
        const paid = payments.reduce((sum, t) => sum + Number(t.valor || 0), 0);
        const open = Math.max(0, total - paid);
        const pct = cartao.limite > 0 ? (cartao.utilizado / cartao.limite * 100) : 0;
        const cor = pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-yellow-500' : 'bg-emerald-500';
        const hoje = new Date().toISOString().slice(0, 10);
        const diasVenc = daysUntil(c.dueDate, hoje);
        const vencInfo = diasVenc < 0 ? 'Vencida' : diasVenc === 0 ? 'Vence hoje' : `Vence em ${diasVenc} dia${diasVenc === 1 ? '' : 's'}`;
        const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
        const fmt = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
        const meses = months;
        const nomeMes = `${meses[month]} de ${year}`;
        const extrato = purchases.slice().sort((a,b) => String(b.data).localeCompare(String(a.data)) || (Number(b.id)||0)-(Number(a.id)||0)).map(t => `
            <div class="card-premium rounded-xl p-3 flex justify-between items-center">
                <div class="flex items-center gap-3 min-w-0">
                    <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-red-500/20 text-red-400">↓</div>
                    <div class="min-w-0"><p class="text-sm font-medium truncate">${esc(t.descricao)}</p><p class="text-[10px] text-gray-500">${formatDate(t.data)}</p></div>
                </div>
                <div class="flex items-center gap-2 shrink-0"><p class="text-sm font-bold text-red-400">- ${fmt(Math.abs(t.valor))}</p><button onclick="openModal('transacao', ${t.id})" class="text-gray-600 hover:text-amber-400 p-1">✎</button><button onclick="confirmarExcluirTransacao(${t.id})" class="text-gray-600 hover:text-red-400 p-1">✕</button></div>
            </div>
        `).join('') || '<p class="text-gray-500 text-center py-4 text-sm">Nenhuma compra neste ciclo</p>';

        const html = `
            <div class="space-y-4 pb-20">
              <div class="glass rounded-2xl p-5">
                <div class="flex items-center justify-between">
                    <h2 class="text-xl font-bold">${esc(cartao.nome)}</h2>
                    <div class="flex items-center gap-3"><button onclick="openModal('cartao', ${idx})" class="text-gray-400 hover:text-amber-400 p-1">✎</button><button onclick="excluirCartao(${idx})" class="text-gray-400 hover:text-red-400 p-1">✕</button></div>
                </div>
                <div class="grid grid-cols-2 gap-2 mt-2 text-[10px] text-gray-400 uppercase tracking-wider"><p>Fecha: Dia ${cartao.diaFechamento}</p><p>Vence: Dia ${cartao.diaVencimento}</p></div>
                <div class="mt-4"><div class="flex justify-between text-sm mb-1"><span>Total Utilizado</span><span class="font-semibold text-amber-400">${fmt(cartao.utilizado)}</span></div><div class="flex justify-between text-sm mb-2"><span>Disponível</span><span>${fmt(cartao.limite - cartao.utilizado)}</span></div><div class="progress-bar"><div class="progress-fill ${cor}" style="width:${Math.min(pct,100)}%"></div></div></div>
              </div>
              <div class="flex items-center justify-between glass rounded-2xl p-3"><button onclick="mudarMesDetalhe(-1, 'cartao', ${idx})" class="text-amber-400 text-lg font-bold px-2">&lt;</button><span class="font-semibold text-sm">${nomeMes}</span><button onclick="mudarMesDetalhe(1, 'cartao', ${idx})" class="text-amber-400 text-lg font-bold px-2">&gt;</button></div>
              <div class="card-premium rounded-2xl p-4">
                <div class="flex justify-between items-start gap-3"><div><p class="text-[10px] text-gray-500 uppercase tracking-wider">Ciclo da fatura</p><p class="font-semibold mt-1">${formatRange(c)}</p><p class="text-[10px] text-gray-500 mt-1">Fechamento em ${formatDate(c.end)} • Vencimento em ${formatDate(c.dueDate)}</p></div><span class="text-[10px] px-2 py-1 rounded-full ${diasVenc < 0 ? 'bg-red-500/10 text-red-400' : diasVenc <= 3 ? 'bg-amber-500/10 text-amber-400' : 'bg-white/5 text-gray-400'}">${vencInfo}</span></div>
                <div class="flex justify-between items-end mt-4"><div><p class="text-xs text-gray-500">Total do ciclo</p><p class="text-2xl font-bold text-red-400">${fmt(total)}</p>${paid > 0 ? `<p class="text-[10px] text-green-400 mt-1">Pago: ${fmt(paid)} • Em aberto: ${fmt(open)}</p>` : ''}</div><button onclick="pagarFatura(${idx})" class="text-[10px] bg-green-500/20 text-green-400 px-3 py-2 rounded-lg font-bold">${open > 0 ? 'PAGAR FATURA' : 'QUITADA'}</button></div>
              </div>
              <div class="space-y-2"><h3 class="text-lg font-semibold px-1">Compras do ciclo</h3>${extrato}</div>
              <button onclick="voltarParaApp()" class="w-full glass py-3 rounded-xl text-gray-400 text-sm">Voltar</button>
            </div>`;
        document.getElementById('detalhe-conteudo').innerHTML = html;
        if (typeof root.updateUIState === 'function') root.updateUIState('detalhe-cartao');
        else abrirTelaCartaoOriginal(idx);
    };
})(globalThis);
