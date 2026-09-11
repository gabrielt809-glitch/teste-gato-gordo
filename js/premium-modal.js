/* Gato Gordo — Modal UX v2
   Camada de apresentação para a Nova Transação. A lógica financeira continua no app.js. */
(function () {
  'use strict';

  const modal = () => document.getElementById('modal');
  const inner = () => document.getElementById('modal-content-inner');
  const SVG = {
    transfer: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h12"/><path d="m15 3 4 4-4 4"/><path d="M17 17H5"/><path d="m9 21-4-4 4-4"/></svg>'
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
    if (!select || select.dataset.ggChoiceReady === 'true') return select?.nextElementSibling;
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
    const m = modal();
    const sheet = m?.querySelector('.modal-content');
    if (!sheet || sheet.querySelector('.gg-modal-handle')) return;
    const handle = document.createElement('div');
    handle.className = 'gg-modal-handle';
    handle.setAttribute('aria-hidden', 'true');
    sheet.prepend(handle);
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

    let subtitle = content.querySelector('.gg-transaction-subtitle');
    if (cardContext && !subtitle) {
      subtitle = document.createElement('p');
      subtitle.className = 'gg-transaction-subtitle';
      const card = document.querySelector('#f-trans-cartao option:checked');
      subtitle.textContent = `💳 Compra adicionada à fatura ${card ? `do ${card.textContent.trim()}` : ''}`.trim();
      heading?.insertAdjacentElement('afterend', subtitle);
    }

    if (type) {
      makeChoiceGroup(type, [
        { value: 'despesa', label: 'Despesa', icon: '−' },
        { value: 'receita', label: 'Receita', icon: '+' },
        { value: 'transferencia', label: 'Transferência', icon: SVG.transfer },
        { value: 'cartao', label: 'Cartão', icon: '💳' }
      ], 'gg-type-choices');
    }

    if (recurrence) {
      makeChoiceGroup(recurrence, [
        { value: 'nenhuma', label: 'Nenhuma' },
        { value: 'mensal', label: 'Mensal' },
        { value: 'semanal', label: 'Semanal' },
        { value: 'quinzenal', label: 'Quinzenal' },
        { value: 'parcelado', label: 'Parcelado' }
      ], 'gg-recurrence-choices');
    }

    amount.classList.add('gg-amount-input');
    amount.setAttribute('inputmode', 'decimal');
    amount.setAttribute('placeholder', 'R$ 0,00');
    amount.setAttribute('aria-label', 'Valor');

    const amountLabel = [...content.querySelectorAll('label')].find(l => l.textContent.trim().toLowerCase().startsWith('valor'));
    if (amountLabel) amountLabel.textContent = 'Valor';

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
    };
    if (type) type.addEventListener('change', updateVisibility);
    updateVisibility();

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
