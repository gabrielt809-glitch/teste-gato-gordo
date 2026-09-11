/* Gato Gordo — Modal UX v2
   Camada de apresentação da Nova Transação.
   A lógica financeira continua no app.js. */
(function () {
  'use strict';

  const modal = () => document.getElementById('modal');
  const inner = () => document.getElementById('modal-content-inner');

  const SVG = {
    transfer: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h12"/><path d="m15 3 4 4-4 4"/><path d="M17 17H5"/><path d="m9 21-4-4 4-4"/></svg>',
    bank: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 9 9-5 9 5"/><path d="M5 10v7M9 10v7M15 10v7M19 10v7"/><path d="M3 20h18"/></svg>'
  };

  function buttonOption(value, label, icon) {
    return `<button type="button" class="gg-choice" data-value="${value}" aria-pressed="false">${icon ? `<span class="gg-choice-icon">${icon}</span>` : ''}<span>${label}</span></button>`;
  }

  function syncChoiceGroup(select, group) {
    if (!select || !group) return;
    group.querySelectorAll('.gg-choice').forEach(btn => {
      const active = btn.dataset.value === select.value;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function makeChoiceGroup(select, options, className) {
    if (!select) return null;
    const existing = select.nextElementSibling;
    if (select.dataset.ggChoiceReady === 'true') return existing;
    const group = document.createElement('div');
    group.className = `gg-choice-group ${className || ''}`;
    group.setAttribute('role', 'group');
    group.innerHTML = options.map(o => buttonOption(o.value, o.label, o.icon || '')).join('');
    select.hidden = true;
    select.setAttribute('aria-hidden', 'true');
    select.dataset.ggChoiceReady = 'true';
    select.insertAdjacentElement('afterend', group);
    group.addEventListener('click', event => {
      const btn = event.target.closest('.gg-choice');
      if (!btn) return;
      select.value = btn.dataset.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      syncChoiceGroup(select, group);
    });
    syncChoiceGroup(select, group);
    return group;
  }

  function addHandle() {
    const sheet = modal()?.querySelector('.modal-content');
    if (!sheet || sheet.querySelector('.gg-modal-handle')) return;
    const handle = document.createElement('div');
    handle.className = 'gg-modal-handle';
    handle.setAttribute('aria-hidden', 'true');
    sheet.prepend(handle);
  }

  function addContextCard(content, cardSelect) {
    if (content.querySelector('.gg-card-context')) return;
    const card = cardSelect?.options[cardSelect.selectedIndex];
    const wrap = document.createElement('div');
    wrap.className = 'gg-card-context';
    wrap.innerHTML = `<div class="gg-context-icon">💳</div><div><strong>Compra no cartão</strong><span>Será adicionada à fatura de ${card ? card.textContent.trim() : 'seu cartão'}</span></div>`;
    const heading = content.querySelector('h3');
    heading?.insertAdjacentElement('afterend', wrap);
  }

  function addTransferFlow(content, accountSelect, destinationSelect) {
    if (!accountSelect || !destinationSelect || content.querySelector('.gg-transfer-flow')) return;
    const wrap = document.createElement('div');
    wrap.className = 'gg-transfer-flow';

    const makeNode = (title, select) => {
      const option = select.options[select.selectedIndex];
      const node = document.createElement('div');
      node.className = 'gg-transfer-node';
      node.innerHTML = `<span class="gg-transfer-kicker">${title}</span><span class="gg-transfer-account"><span class="gg-transfer-icon">${SVG.bank}</span><span class="gg-transfer-name">${option ? option.textContent.trim() : 'Selecionar conta'}</span><span class="gg-transfer-chevron">⌄</span></span>`;
      node.addEventListener('click', () => select.focus());
      return node;
    };

    const from = makeNode('De', accountSelect);
    const arrow = document.createElement('div');
    arrow.className = 'gg-transfer-arrow';
    arrow.innerHTML = '↓';
    const to = makeNode('Para', destinationSelect);
    wrap.append(from, arrow, to);

    accountSelect.hidden = true;
    destinationSelect.hidden = true;
    accountSelect.setAttribute('aria-hidden', 'true');
    destinationSelect.setAttribute('aria-hidden', 'true');
    accountSelect.parentElement.appendChild(wrap);

    const refresh = () => {
      const selects = [accountSelect, destinationSelect];
      wrap.querySelectorAll('.gg-transfer-node').forEach((node, i) => {
        const option = selects[i].options[selects[i].selectedIndex];
        const name = node.querySelector('.gg-transfer-name');
        if (name) name.textContent = option ? option.textContent.trim() : 'Selecionar conta';
      });
    };
    accountSelect.addEventListener('change', refresh);
    destinationSelect.addEventListener('change', refresh);
  }

  function improveTransaction(content) {
    const type = document.getElementById('f-trans-tipo');
    const recurrence = document.getElementById('f-trans-recorrencia');
    const amount = document.getElementById('f-trans-valor');
    const desc = document.getElementById('f-trans-desc');
    const date = document.getElementById('f-trans-data');
    if (!amount || !desc || !date) return;

    content.classList.add('gg-transaction-form');
    addHandle();

    const heading = content.querySelector('h3');
    const cardContext = !type && !!document.getElementById('f-trans-cartao-group');
    if (heading) {
      heading.textContent = cardContext ? 'Nova compra no cartão' : (heading.textContent.includes('Editar') ? 'Editar transação' : 'Nova transação');
      heading.classList.add('gg-transaction-title');
    }

    if (type && !type.dataset.ggChoiceReady) {
      const allowed = [...type.options].map(option => option.value);
      const typeOptions = [
        { value: 'despesa', label: 'Despesa', icon: '−' },
        { value: 'receita', label: 'Receita', icon: '+' },
        { value: 'transferencia', label: 'Transferência', icon: SVG.transfer },
        { value: 'cartao', label: 'Cartão', icon: '💳' }
      ].filter(option => allowed.includes(option.value));
      makeChoiceGroup(type, typeOptions, 'gg-type-choices');
    }

    if (recurrence && !recurrence.dataset.ggChoiceReady) {
      makeChoiceGroup(recurrence, [
        { value: 'nenhuma', label: 'Nenhuma' },
        { value: 'mensal', label: 'Mensal' },
        { value: 'semanal', label: 'Semanal' },
        { value: 'quinzenal', label: 'Quinzenal' },
        { value: 'parcelado', label: 'Parcelado' }
      ].filter(option => [...recurrence.options].some(o => o.value === option.value)), 'gg-recurrence-choices');
    }

    amount.classList.add('gg-amount-input');
    amount.setAttribute('inputmode', 'decimal');
    amount.setAttribute('placeholder', 'R$ 0,00');
    amount.setAttribute('aria-label', 'Valor');

    const amountLabel = [...content.querySelectorAll('label')].find(l => l.textContent.trim().toLowerCase().startsWith('valor'));
    if (amountLabel) amountLabel.textContent = 'Valor';

    content.querySelectorAll('label').forEach(label => label.classList.add('gg-form-label'));
    const save = [...content.querySelectorAll('button')].find(b => /^salvar/i.test(b.textContent.trim()));
    if (save) {
      save.classList.add('gg-save-button');
      save.textContent = 'Salvar';
    }

    const accountGroup = document.getElementById('f-trans-conta-group');
    const destinationGroup = document.getElementById('f-trans-dest-group');
    if (accountGroup) accountGroup.classList.add('gg-origin-group');
    if (destinationGroup) destinationGroup.classList.add('gg-destination-group');

    const updateVisibility = () => {
      const currentType = type ? type.value : 'cartao';
      const categoryGroup = document.getElementById('f-trans-categoria-group');
      if (categoryGroup) categoryGroup.classList.toggle('gg-hidden-context', currentType === 'transferencia' || currentType === 'cartao');
      content.classList.toggle('gg-is-transfer', currentType === 'transferencia');
      content.classList.toggle('gg-is-card', currentType === 'cartao' || cardContext);

      const typeGroup = document.getElementById('f-trans-tipo-group');
      if (typeGroup) typeGroup.classList.toggle('gg-type-hidden', currentType === 'cartao');

      const group = type?.nextElementSibling;
      if (type && group?.classList.contains('gg-choice-group')) syncChoiceGroup(type, group);

      if (currentType === 'transferencia') {
        addTransferFlow(content, accountGroup?.querySelector('select') || document.getElementById('f-trans-conta'), document.getElementById('f-trans-conta-dest'));
      }
    };

    if (type) type.addEventListener('change', updateVisibility);
    updateVisibility();

    if (cardContext) addContextCard(content, document.getElementById('f-trans-cartao'));

    const transferAccount = document.getElementById('f-trans-conta');
    const transferDestination = document.getElementById('f-trans-conta-dest');
    if (type?.value === 'transferencia') addTransferFlow(content, transferAccount, transferDestination);
  }

  function enhance() {
    const m = modal();
    const content = inner();
    if (!m || !content) return;
    const visible = !m.classList.contains('hidden');
    if (!visible) {
      m.classList.remove('gg-modal-v2');
      return;
    }
    m.classList.add('gg-modal-v2');
    addHandle();
    if (document.getElementById('f-trans-valor')) improveTransaction(content);
  }

  function init() {
    const m = modal();
    const content = inner();
    if (!m || !content) return;
    const observer = new MutationObserver(enhance);
    observer.observe(m, { attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
    observer.observe(content, { childList: true, subtree: true, characterData: true });
    document.addEventListener('focusin', event => {
      if (!m.classList.contains('gg-modal-v2') || !event.target.closest('#modal')) return;
      setTimeout(() => event.target.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 80);
    });
    enhance();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();