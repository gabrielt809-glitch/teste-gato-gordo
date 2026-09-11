/* Gato Gordo — Sprint Premium: enhancement não destrutivo dos modais. */
(function () {
  'use strict';

  const modal = () => document.getElementById('modal');
  const inner = () => document.getElementById('modal-content-inner');

  function fieldAfterLabel(label) {
    let node = label.nextElementSibling;
    while (node && !/^(INPUT|SELECT|TEXTAREA)$/i.test(node.tagName)) node = node.nextElementSibling;
    return node;
  }

  function enhance() {
    const m = modal();
    const content = inner();
    if (!m || !content) return;

    const visible = !m.classList.contains('hidden') && getComputedStyle(m).display !== 'none';
    if (!visible) {
      m.classList.remove('modal-premium', 'modal-premium--transaction');
      return;
    }

    m.classList.add('modal-premium');

    const heading = content.querySelector('h3');
    const title = heading ? heading.textContent.trim().toLowerCase() : '';
    const isTransaction = title.includes('nova transação') || title.includes('editar transação');
    m.classList.toggle('modal-premium--transaction', isTransaction);

    content.querySelectorAll('label').forEach(label => {
      const text = label.textContent.trim().toLowerCase();
      const field = fieldAfterLabel(label);
      if (!field) return;

      field.classList.remove('modal-field-amount', 'modal-field-description');
      if (text.includes('valor')) field.classList.add('modal-field-amount');
      if (text.includes('descrição')) field.classList.add('modal-field-description');
    });

    content.querySelectorAll('button').forEach(button => {
      const text = button.textContent.trim().toLowerCase();
      if (text === 'salvar' || text.startsWith('salvar ')) button.classList.add('modal-premium-primary');
      if (text === '×' || text === 'x' || text.includes('fechar')) button.classList.add('modal-premium-close');
    });

    content.querySelectorAll('p').forEach(p => {
      const text = p.textContent.trim().toLowerCase();
      if (text.includes('recorrências geram') || text.includes('recorrencias geram')) p.classList.add('modal-helper');
    });
  }

  function init() {
    const m = modal();
    const content = inner();
    if (!m || !content) return;

    const observer = new MutationObserver(enhance);
    observer.observe(m, { attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
    observer.observe(content, { childList: true, subtree: true, characterData: true });

    document.addEventListener('focusin', event => {
      if (m.classList.contains('modal-premium') && event.target.closest('#modal')) {
        setTimeout(() => event.target.scrollIntoView({ block: 'center', behavior: 'smooth' }), 120);
      }
    });

    enhance();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
