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
    if (select.dataset.ggChoiceReady === 'true') return select.nextElementSibling;
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
    let wrap = content.querySelector('.gg-card-context');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'gg-card-context';
      const heading = content.querySelector('h3');
      heading?.insertAdjacentElement('afterend', wrap);
    }
    const card = cardSelect?.options[cardSelect.selectedIndex];
    wrap.innerHTML = `<div class="gg-context-icon">💳</div><div><strong>Compra no cartão</strong><span>Será adicionada à fatura de ${card ? card.textContent.trim() : 'seu cartão'}</span></div>`;
  }

  function addTransferFlow(content, accountSelect, destinationSelect) {
    if (!accountSelect || !destinationSelect) return null;
    let wrap = content.querySelector('.gg-transfer-flow');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'gg-transfer-flow';
      const accountGroup = accountSelect.closest('#f-trans-conta-group');
      accountGroup?.appendChild(wrap);
    }

    const makeNode = (title, select) => {
      const option = select.options[select.selectedIndex];
      const node = document.createElement('div');
      node.className = 'gg-transfer-node';
      node.innerHTML = `<span class="gg-transfer-kicker">${title}</span><span class="gg-transfer-account"><span class="gg-transfer-icon">${SVG.bank}</span><span class="gg-transfer-name">${option ? option.textContent.trim() : 'Selecionar conta'}</span><span class="gg-transfer-chevron">⌄</span></span>`;
      node.addEventListener('click', () => select.focus());
      return node;
    };

    if (!wrap.dataset.ready) {
      wrap.innerHTML = '';
      wrap.append(makeNode('De', accountSelect));
      const arrow = document.createElement('div');
      arrow.className = 'gg-transfer-arrow';
      arrow.innerHTML = '↓';
      wrap.appendChild(arrow);
      wrap.append(makeNode('Para', destinationSelect));
      wrap.dataset.ready = 'true';

      accountSelect.hidden = true;
      destinationSelect.hidden = true;
      accountSelect.setAttribute('aria-hidden', 'true');
      destinationSelect.setAttribute('aria-hidden', 'true');

      const refresh = () => {
        [accountSelect, destinationSelect].forEach((select, i) => {
          const option = select.options[select.selectedIndex];
          const name = wrap.querySelectorAll('.gg-transfer-node')[i]?.querySelector('.gg-transfer-name');
          if (name) name.textContent = option ? option.textContent.trim() : 'Selecionar conta';
        });
      };
      accountSelect.addEventListener('change', refresh);
      destinationSelect.addEventListener('change', refresh);
    }
    return wrap;
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
    const fixedCardContext = !type && !!document.getElementById('f-trans-cartao-group');
    if (heading) {
      heading.textContent = fixedCardContext ? 'Nova compra no cartão' : (heading.textContent.includes('Editar') ? 'Editar transação' : 'Nova transação');
      heading.classList.add('gg-transaction-title');
    }

    if (type && !type.dataset.ggChoiceReady) {
      const allowed = [...type.options].map(option => option.value);
      makeChoiceGroup(type, [
        { value: 'despesa', label: 'Despesa', icon: '−' },
        { value: 'receita', label: 'Receita', icon: '+' },
        { value: 'transferencia', label: 'Transferência', icon: SVG.transfer },
        { value: 'cartao', label: 'Cartão', icon: '💳' }
      ].filter(option => allowed.includes(option.value)), 'gg-type-choices');
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
    if (save) { save.classList.add('gg-save-button'); save.textContent = 'Salvar'; }

    const accountSelect = document.getElementById('f-trans-conta');
    const destinationSelect = document.getElementById('f-trans-conta-dest');
    const accountGroup = document.getElementById('f-trans-conta-group');
    const destinationGroup = document.getElementById('f-trans-dest-group');
    if (accountGroup) accountGroup.classList.add('gg-origin-group');
    if (destinationGroup) destinationGroup.classList.add('gg-destination-group');

    const updateVisibility = () => {
      const currentType = type ? type.value : 'cartao';
      const categoryGroup = document.getElementById('f-trans-categoria-group');
      categoryGroup?.classList.toggle('gg-hidden-context', currentType === 'transferencia' || currentType === 'cartao');
      content.classList.toggle('gg-is-transfer', currentType === 'transferencia');
      content.classList.toggle('gg-is-card', currentType === 'cartao' || fixedCardContext);
      document.getElementById('f-trans-tipo-group')?.classList.toggle('gg-type-hidden', currentType === 'cartao' || fixedCardContext);

      const choiceGroup = type?.nextElementSibling;
      if (type && choiceGroup?.classList.contains('gg-choice-group')) syncChoiceGroup(type, choiceGroup);

      const transferFlow = currentType === 'transferencia' ? addTransferFlow(content, accountSelect, destinationSelect) : content.querySelector('.gg-transfer-flow');
      transferFlow?.classList.toggle('gg-hidden-context', currentType !== 'transferencia');

      const cardGroup = document.getElementById('f-trans-cartao-group');
      cardGroup?.classList.toggle('gg-hidden-context', currentType !== 'cartao' || fixedCardContext);
      if (currentType === 'cartao') addContextCard(content, document.getElementById('f-trans-cartao'));
      content.querySelector('.gg-card-context')?.classList.toggle('gg-hidden-context', currentType !== 'cartao' && !fixedCardContext);
    };

    if (type) type.addEventListener('change', updateVisibility);
    updateVisibility();
  }

  function enhance() {
    const m = modal();
    const content = inner();
    if (!m || !content) return;
    if (m.classList.contains('hidden')) { m.classList.remove('gg-modal-v2'); return; }
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