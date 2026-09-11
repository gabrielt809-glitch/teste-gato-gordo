/* Gato Gordo — ordenação robusta do formulário de transação. */
(function () {
  'use strict';

  function buildLayout(content) {
    if (!content?.querySelector('#f-trans-valor')) return;
    const root = content.querySelector('.gg-transaction-form .space-y-3');
    if (!root || root.dataset.ggLayoutReady === 'true') return;

    const type = document.getElementById('f-trans-tipo');
    const recurrence = document.getElementById('f-trans-recorrencia');
    const amount = document.getElementById('f-trans-valor');
    const desc = document.getElementById('f-trans-desc');
    const date = document.getElementById('f-trans-data');
    const typeGroup = document.getElementById('f-trans-tipo-group');
    const recurrenceGroup = document.getElementById('f-trans-recorrencia-group') || recurrence?.parentElement;
    const categoryGroup = document.getElementById('f-trans-categoria-group');
    const accountGroup = document.getElementById('f-trans-conta-group');
    const cardGroup = document.getElementById('f-trans-cartao-group');
    const destinationGroup = document.getElementById('f-trans-dest-group');
    const parcelasGroup = document.getElementById('f-trans-parcelas-group');
    const save = root.querySelector('.gg-save-button');

    if (!amount || !desc || !date || !save) return;

    const amountCell = amount.parentElement;
    const dateCell = date.parentElement;
    const firstGrid = typeGroup?.parentElement?.classList.contains('grid')
      ? typeGroup.parentElement
      : recurrence?.closest('.grid');
    const fixedTypeCell = !type && firstGrid
      ? [...firstGrid.children].find(child => child !== recurrenceGroup)
      : null;
    if (recurrenceGroup) recurrenceGroup.classList.add('gg-field-block', 'gg-recurrence-block');

    const descLabel = [...root.children].find(el => el.tagName === 'LABEL' && /descri/i.test(el.textContent));
    const descWrap = document.createElement('div');
    descWrap.className = 'gg-field-block gg-desc-block';
    descWrap.append(descLabel, desc);

    const amountWrap = document.createElement('div');
    amountWrap.className = 'gg-field-block gg-amount-block';
    if (amountCell) amountWrap.append(...[...amountCell.childNodes]);

    const dateWrap = document.createElement('div');
    dateWrap.className = 'gg-field-block gg-date-block';
    if (dateCell) dateWrap.append(...[...dateCell.childNodes]);

    const layout = document.createElement('div');
    layout.className = 'gg-transaction-layout';

    const append = (...nodes) => nodes.flat().forEach(node => {
      if (node && node !== layout) layout.appendChild(node);
    });

    if (typeGroup) append(typeGroup);
    else if (fixedTypeCell) append(fixedTypeCell);
    append(amountWrap, descWrap, categoryGroup, dateWrap);

    // Recorrência é secundária e fica depois do fluxo principal.
    append(recurrenceGroup);
    const helper = [...root.children].find(el => el.tagName === 'P' && /recorr/i.test(el.textContent));
    append(helper, parcelasGroup);

    // Todos os contextos ficam no mesmo layout. A camada visual decide quais aparecem.
    const transferFlow = content.querySelector('.gg-transfer-flow');
    append(transferFlow, accountGroup, destinationGroup, cardGroup);
    append(save);

    root.appendChild(layout);
    root.dataset.ggLayoutReady = 'true';
    root.parentElement?.classList.add('gg-order-ready');
  }

  function refresh() {
    const modal = document.getElementById('modal');
    const content = document.getElementById('modal-content-inner');
    if (!modal || modal.classList.contains('hidden') || !content) return;
    if (content.querySelector('#f-trans-valor')) buildLayout(content);
  }

  function init() {
    const content = document.getElementById('modal-content-inner');
    const modal = document.getElementById('modal');
    if (!content || !modal) return;
    const observer = new MutationObserver(() => requestAnimationFrame(refresh));
    observer.observe(content, { childList: true, subtree: true });
    observer.observe(modal, { attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
    refresh();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
