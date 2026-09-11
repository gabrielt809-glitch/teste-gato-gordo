/* Sprint Premium: Home/dashboard visual sem alterar a lógica financeira existente. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  let month = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  let lastSignature = '';

  const money = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const dateKey = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const monthKey = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  const monthName = d => d.toLocaleDateString('pt-BR', { month:'long', year:'numeric' });
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

  function profile() {
    try { return JSON.parse(localStorage.getItem('gato_gordo_perfis') || '[]')[0] || null; }
    catch (_) { return null; }
  }
  function transactionsFor(p, d) {
    const key = monthKey(d);
    return (p.transacoes || []).filter(t => typeof t.data === 'string' && t.data.slice(0,7) === key);
  }
  function totals(p, d, cutoffToday = false) {
    const list = transactionsFor(p,d);
    const today = dateKey(new Date());
    let income = 0, expense = 0;
    list.forEach(t => {
      if (cutoffToday && t.data > today) return;
      const v = Math.abs(Number(t.valor || 0));
      if (t.tipo === 'receita') income += v;
      else if (['despesa','despesa-cartao','cartao','pagamento_fatura'].includes(t.tipo)) expense += v;
    });
    return { income, expense };
  }
  function currentBalance(p, d) {
    if (window.GatoFinance && typeof GatoFinance.balance === 'function') {
      try { return GatoFinance.balance(p, dateKey(new Date(d.getFullYear(), d.getMonth()+1, 0))); } catch (_) {}
    }
    return (p.contas || []).reduce((sum,c) => sum + Number(c.saldoInicial || 0), 0);
  }
  function projectedBalance(p, d) {
    if (window.GatoFinance && typeof GatoFinance.monthSummary === 'function') {
      try { return GatoFinance.monthSummary(p,d.getFullYear(),d.getMonth()).projected; } catch (_) {}
    }
    return currentBalance(p,d);
  }
  function iconFor(t) {
    if (t.tipo === 'receita') return '↗';
    if (t.tipo === 'transferencia') return '⇄';
    if (t.tipo === 'despesa-cartao' || t.tipo === 'cartao') return '▣';
    return '↘';
  }
  function labelForType(t) {
    if (t.tipo === 'receita') return 'Receita';
    if (t.tipo === 'transferencia') return 'Transferência';
    if (t.tipo === 'despesa-cartao' || t.tipo === 'cartao') return 'Cartão';
    return 'Despesa';
  }
  function isFuture(t) { return t.data > dateKey(new Date()); }

  function render() {
    const p = profile();
    const app = $('app-container');
    const tab = $('tab-pessoal');
    if (!p || !app || app.classList.contains('hidden') || !tab) return;

    tab.classList.add('premium-mode');
    let home = $('home-premium');
    if (!home) {
      home = document.createElement('div');
      home.id = 'home-premium';
      tab.insertBefore(home, tab.firstChild);
    }

    const actual = totals(p, month, month.getFullYear() === new Date().getFullYear() && month.getMonth() === new Date().getMonth());
    const previous = totals(p, new Date(month.getFullYear(), month.getMonth()-1, 1), false);
    const balance = currentBalance(p, month);
    const projected = projectedBalance(p, month);
    const isCurrentMonth = monthKey(month) === monthKey(new Date());

    const futureExpenses = transactionsFor(p, month).filter(t => isFuture(t) && ['despesa','despesa-cartao','cartao'].includes(t.tipo)).reduce((s,t) => s + Math.abs(Number(t.valor || 0)), 0);
    const spendable = isCurrentMonth ? Math.max(0, balance - futureExpenses) : Math.max(0, projected);
    const expenseDelta = previous.expense > 0 ? ((actual.expense - previous.expense) / previous.expense) * 100 : null;

    const upcoming = [];
    transactionsFor(p, month).filter(t => isFuture(t) && ['despesa','despesa-cartao','cartao'].includes(t.tipo)).forEach(t => upcoming.push({ date:t.data, title:t.descricao || 'Despesa', meta:'Vencimento previsto', value:-Math.abs(Number(t.valor||0)), icon:'↘' }));
    (p.cartoes || []).forEach(c => {
      if (!c.diaVencimento) return;
      const due = new Date(month.getFullYear(), month.getMonth(), Number(c.diaVencimento));
      if (due >= new Date()) upcoming.push({ date:dateKey(due), title:`Fatura ${c.nome || 'Cartão'}`, meta:`Vence dia ${c.diaVencimento}`, value:-Math.abs(Number(c.utilizado||0)), icon:'▣' });
    });
    upcoming.sort((a,b) => a.date.localeCompare(b.date));

    const recent = transactionsFor(p, month).slice().sort((a,b) => String(b.data).localeCompare(String(a.data))).slice(0,4);
    const cards = (p.cartoes || []).slice(0,4);
    const goals = (p.metas || []).slice(0,3);

    const largestCategory = (() => {
      const map = {};
      transactionsFor(p,month).filter(t => ['despesa','despesa-cartao','cartao'].includes(t.tipo)).forEach(t => {
        const key = t.categoria || 'Outros'; map[key] = (map[key] || 0) + Math.abs(Number(t.valor||0));
      });
      return Object.entries(map).sort((a,b)=>b[1]-a[1])[0] || null;
    })();

    const greeting = p.nome ? `Olá, ${escapeHtml(p.nome.split(' ')[0])} 👋` : 'Olá 👋';
    const deltaText = expenseDelta === null ? 'Sem histórico anterior' : `${Math.abs(expenseDelta).toFixed(0)}% ${expenseDelta <= 0 ? 'abaixo' : 'acima'} do mês anterior`;
    const deltaClass = expenseDelta !== null && expenseDelta > 0 ? 'premium-negative' : 'premium-positive';

    home.innerHTML = `
      <div class="premium-greeting">
        <div class="premium-eyebrow">Visão geral</div>
        <h2>${greeting}</h2>
      </div>

      <div class="premium-period">
        <button type="button" onclick="window.gatoPremiumMonth(-1)" aria-label="Mês anterior">‹</button>
        <strong>${escapeHtml(monthName(month))}</strong>
        <button type="button" onclick="window.gatoPremiumMonth(1)" aria-label="Próximo mês">›</button>
      </div>

      <section class="premium-hero">
        <div class="premium-hero-label">Saldo disponível</div>
        <div class="premium-balance">${money(balance)}</div>
        <div class="premium-balance-sub">Projeção ao fim do mês: ${money(projected)}</div>
        <div class="premium-stats">
          <div class="premium-stat"><div class="premium-stat-label">Receitas</div><div class="premium-stat-value premium-positive">${money(actual.income)}</div></div>
          <div class="premium-stat"><div class="premium-stat-label">Despesas</div><div class="premium-stat-value premium-negative">${money(actual.expense)}</div></div>
        </div>
      </section>

      <section class="premium-section">
        <div class="premium-section-head"><h3>Quanto posso gastar?</h3><span>estimativa</span></div>
        <div class="premium-spend">
          <div><small>${isCurrentMonth ? 'Saldo menos compromissos futuros' : 'Projeção do período'}</small><strong>${money(spendable)}</strong></div>
          <div class="premium-spend-badge">✓</div>
        </div>
      </section>

      <section class="premium-section">
        <div class="premium-section-head"><h3>Ações rápidas</h3><span>1 toque</span></div>
        <div class="premium-actions">
          <button class="premium-action" onclick="fabAction('receita')"><div class="premium-action-icon" style="background:rgba(74,222,128,.12);color:#4ade80">↗</div><span>Receita</span></button>
          <button class="premium-action" onclick="fabAction('despesa')"><div class="premium-action-icon" style="background:rgba(251,113,133,.12);color:#fb7185">↘</div><span>Despesa</span></button>
          <button class="premium-action" onclick="fabAction('transferencia')"><div class="premium-action-icon" style="background:rgba(245,158,11,.12);color:#fbbf24">⇄</div><span>Transferir</span></button>
          <button class="premium-action" onclick="fabAction('cartao')"><div class="premium-action-icon" style="background:rgba(96,165,250,.12);color:#60a5fa">▣</div><span>Cartão</span></button>
        </div>
      </section>

      <section class="premium-section">
        <div class="premium-section-head"><h3>Próximos vencimentos</h3><span>${upcoming.length} itens</span></div>
        <div class="premium-list">${upcoming.length ? upcoming.slice(0,4).map(x => `<div class="premium-row"><div class="premium-row-icon">${x.icon}</div><div class="premium-row-main"><div class="premium-row-title">${escapeHtml(x.title)}</div><div class="premium-row-meta">${escapeHtml(new Date(x.date+'T12:00:00').toLocaleDateString('pt-BR'))} · ${escapeHtml(x.meta)}</div></div><div class="premium-row-value premium-negative">${money(x.value)}</div></div>`).join('') : '<div class="premium-empty">Nenhum vencimento próximo. Você está em dia. ✨</div>'}</div>
      </section>

      <section class="premium-section">
        <div class="premium-section-head"><h3>Cartões</h3><span>${cards.length} ativos</span></div>
        <div class="premium-card-grid">${cards.length ? cards.map(c => { const used=Math.max(0,Number(c.utilizado||0)), limit=Math.max(0,Number(c.limite||0)), pct=limit?Math.min(100,(used/limit)*100):0; return `<div class="premium-card"><div class="premium-card-name">${escapeHtml(c.nome||'Cartão')}</div><div class="premium-card-number">${c.diaVencimento ? `vence dia ${escapeHtml(c.diaVencimento)}` : 'sem vencimento'}</div><div class="premium-card-amount">${money(used)}</div><div class="premium-card-limit">de ${money(limit)}</div><div class="premium-progress"><i style="width:${pct}%"></i></div></div>`; }).join('') : '<div class="premium-empty" style="grid-column:1/-1">Nenhum cartão cadastrado.</div>'}</div>
      </section>

      <section class="premium-section">
        <div class="premium-section-head"><h3>Últimas movimentações</h3><span>${recent.length} recentes</span></div>
        <div class="premium-list">${recent.length ? recent.map(t => { const income=t.tipo==='receita'; const transfer=t.tipo==='transferencia'; const value=Number(t.valor||0); return `<div class="premium-row"><div class="premium-row-icon">${iconFor(t)}</div><div class="premium-row-main"><div class="premium-row-title">${escapeHtml(t.descricao||'Movimentação')}</div><div class="premium-row-meta">${escapeHtml(new Date(t.data+'T12:00:00').toLocaleDateString('pt-BR'))} · ${labelForType(t)}</div></div><div class="premium-row-value ${income?'premium-positive':transfer?'':'premium-negative'}">${income?'+':'-'}${money(Math.abs(value))}</div></div>`; }).join('') : '<div class="premium-empty">Ainda não há movimentações neste mês.</div>'}</div>
      </section>

      <section class="premium-section">
        <div class="premium-section-head"><h3>Metas</h3><span>${goals.length} em destaque</span></div>
        <div class="premium-list">${goals.length ? goals.map(g => { const current=Number(g.valorAtual ?? g.valorGuardado ?? g.valor ?? 0); const target=Number(g.valorMeta ?? g.meta ?? g.objetivo ?? 0); const pct=target?Math.min(100,Math.max(0,current/target*100)):0; return `<div class="premium-row"><div class="premium-row-icon">🎯</div><div class="premium-row-main"><div class="premium-row-title">${escapeHtml(g.nome||'Meta')}</div><div class="premium-row-meta">${money(current)} de ${money(target)}</div></div><div class="premium-row-value">${pct.toFixed(0)}%</div></div>`; }).join('') : '<div class="premium-empty">Crie uma meta para acompanhar seu progresso.</div>'}</div>
      </section>

      <section class="premium-section">
        <div class="premium-section-head"><h3>Insights</h3><span>automáticos</span></div>
        <div class="premium-insight"><strong class="${deltaClass}">${deltaText}</strong><p>Comparação das despesas registradas no período selecionado.</p></div>
        ${largestCategory ? `<div class="premium-insight"><strong>Maior categoria: ${escapeHtml(largestCategory[0])}</strong><p>${money(largestCategory[1])} concentrados nesta categoria no mês.</p></div>` : ''}
        <div class="premium-insight"><strong>Projeção de saldo: ${money(projected)}</strong><p>Estimativa baseada nos lançamentos registrados até agora.</p></div>
      </section>
    `;
  }

  window.gatoPremiumMonth = function(delta) {
    month = new Date(month.getFullYear(), month.getMonth()+delta, 1);
    render();
  };

  function tick() {
    const p = profile();
    const app = $('app-container');
    if (!p || !app || app.classList.contains('hidden')) return;
    const signature = JSON.stringify([p.contas,p.cartoes,p.transacoes,p.metas,monthKey(month)]);
    if (signature !== lastSignature) { lastSignature = signature; render(); }
  }

  const start = () => { tick(); setInterval(tick, 1200); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true}); else start();
})();
