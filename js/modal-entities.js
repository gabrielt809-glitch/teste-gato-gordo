/* Gato Gordo — camada visual dos modais de entidades.
 * Não altera regras financeiras nem os handlers existentes: apenas reorganiza
 * e enriquece a apresentação de Conta, Cartão, Meta e confirmações.
 */
(function () {
    'use strict';

    const STYLE_ID = 'gg-modal-entities-style';

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            #modal .gg-entity-form .gg-entity-hero {
                display:flex; align-items:center; gap:14px; margin:0 0 22px;
                padding:14px 0 18px; border-bottom:1px solid rgba(255,255,255,.07);
            }
            #modal .gg-entity-form .gg-entity-icon {
                width:52px; height:52px; flex:0 0 52px; display:grid; place-items:center;
                border-radius:17px; background:rgba(245,158,11,.10); color:#f59e0b;
                font-size:24px; border:1px solid rgba(245,158,11,.13);
            }
            #modal .gg-entity-form .gg-entity-hero h3 {
                margin:0 !important; font-size:22px; line-height:1.15; letter-spacing:-.02em;
            }
            #modal .gg-entity-form .gg-entity-subtitle {
                margin-top:5px; color:rgba(156,163,175,.8); font-size:12px; line-height:1.4;
            }
            #modal .gg-entity-form .gg-field-section {
                padding:14px; border-radius:18px; background:rgba(255,255,255,.025);
                border:1px solid rgba(255,255,255,.055); margin-top:12px;
            }
            #modal .gg-entity-form .gg-field-section:first-of-type { margin-top:0; }
            #modal .gg-entity-form .gg-section-label {
                display:block; margin:0 0 9px; color:rgba(156,163,175,.78);
                font-size:10px; font-weight:800; letter-spacing:.11em; text-transform:uppercase;
            }
            #modal .gg-entity-form .gg-money-field {
                min-height:74px !important; height:auto !important; padding:14px 16px !important;
                font-size:25px !important; font-weight:800 !important; letter-spacing:-.02em;
            }
            #modal .gg-entity-form .gg-appearance-row { margin-top:12px; }
            #modal .gg-entity-form .gg-save-button {
                margin-top:16px !important; min-height:56px !important; border-radius:17px !important;
                font-size:15px !important; letter-spacing:.01em;
            }
            #modal .gg-entity-form .gg-secondary-note {
                color:rgba(156,163,175,.62); font-size:11px; line-height:1.45; margin-top:8px;
            }
            #modal .gg-card-form .gg-entity-icon { background:rgba(59,130,246,.11); color:#60a5fa; border-color:rgba(96,165,250,.15); }
            #modal .gg-card-form .gg-limit-section { border-color:rgba(59,130,246,.12); background:rgba(59,130,246,.035); }
            #modal .gg-card-form .gg-money-field { color:#fff; }
            #modal .gg-danger-confirm .gg-confirm-icon {
                width:58px; height:58px; margin:0 auto 14px; display:grid; place-items:center;
                border-radius:19px; background:rgba(239,68,68,.11); color:#f87171;
                border:1px solid rgba(248,113,113,.13); font-size:25px;
            }
            #modal .gg-danger-confirm h3 { font-size:21px !important; }
            #modal .gg-danger-confirm .gg-confirm-copy {
                margin:8px 0 22px; color:rgba(209,213,219,.82); font-size:13px; line-height:1.55;
            }
            #modal .gg-danger-confirm .gg-confirm-actions { gap:10px !important; }
            #modal .gg-danger-confirm .gg-confirm-actions button { min-height:52px; border-radius:16px; }
            @media (max-width:600px) {
                #modal .gg-entity-form .gg-entity-hero { padding-top:2px; margin-bottom:16px; }
                #modal .gg-entity-form .gg-field-section { padding:12px; }
                #modal .gg-entity-form .gg-money-field { font-size:24px !important; }
            }
        `;
        document.head.appendChild(style);
    }

    function firstHeading(inner) {
        return inner.querySelector('h3, h2, h1');
    }

    function hero(inner, icon, subtitle) {
        if (inner.querySelector('.gg-entity-hero')) return;
        const heading = firstHeading(inner);
        if (!heading) return;
        const wrap = document.createElement('div');
        wrap.className = 'gg-entity-hero';
        const iconEl = document.createElement('div');
        iconEl.className = 'gg-entity-icon';
        iconEl.textContent = icon;
        const copy = document.createElement('div');
        const title = document.createElement('h3');
        title.textContent = heading.textContent.trim();
        const sub = document.createElement('p');
        sub.className = 'gg-entity-subtitle';
        sub.textContent = subtitle;
        copy.append(title, sub);
        wrap.append(iconEl, copy);
        heading.replaceWith(wrap);
    }

    function sectionize(inner, selector, className, label) {
        const field = inner.querySelector(selector);
        if (!field || field.closest('.gg-field-section')) return;
        const group = document.createElement('div');
        group.className = `gg-field-section ${className || ''}`.trim();
        const labelEl = document.createElement('span');
        labelEl.className = 'gg-section-label';
        labelEl.textContent = label;
        field.parentNode.insertBefore(group, field);
        group.append(labelEl, field);
    }

    function markSave(inner) {
        const save = [...inner.querySelectorAll('button')].find(b => /salvar|criar|guardar|resgatar|adicionar/i.test(b.textContent || ''));
        if (save) save.classList.add('gg-save-button');
    }

    function decorateAccount(inner) {
        if (inner.classList.contains('gg-account-form')) return;
        inner.classList.add('gg-entity-form', 'gg-account-form');
        hero(inner, '🏦', inner.querySelector('#f-conta-nome')?.value ? 'Atualize os dados da sua conta' : 'Cadastre onde seu dinheiro fica');
        const name = inner.querySelector('#f-conta-nome');
        const saldo = inner.querySelector('#f-conta-saldo');
        const appearance = inner.querySelector('#f-conta-icone')?.closest('.grid');
        if (name) name.classList.add('gg-primary-input');
        if (saldo) saldo.classList.add('gg-money-field');
        if (appearance) appearance.classList.add('gg-appearance-row');
        sectionize(inner, '#f-conta-nome', 'gg-name-section', 'Identificação');
        sectionize(inner, '#f-conta-tipo', 'gg-type-section', 'Tipo de conta');
        sectionize(inner, '#f-conta-saldo', 'gg-balance-section', 'Saldo inicial');
        markSave(inner);
    }

    function decorateCard(inner) {
        if (inner.classList.contains('gg-card-form')) return;
        inner.classList.add('gg-entity-form', 'gg-card-form');
        const editing = /^editar/i.test(firstHeading(inner)?.textContent || '');
        hero(inner, '💳', editing ? 'Atualize os dados e o limite do cartão' : 'Cadastre um cartão para acompanhar a fatura');
        const limit = inner.querySelector('#f-cartao-limite');
        const appearance = inner.querySelector('#f-cartao-icone')?.closest('.grid');
        if (limit) limit.classList.add('gg-money-field');
        if (appearance) appearance.classList.add('gg-appearance-row');
        sectionize(inner, '#f-cartao-nome', 'gg-name-section', 'Identificação');
        sectionize(inner, '#f-cartao-limite', 'gg-limit-section', 'Limite do cartão');
        sectionize(inner, '#f-cartao-fecha', 'gg-cycle-section', 'Ciclo da fatura');
        markSave(inner);
    }

    function decorateMeta(inner) {
        if (inner.classList.contains('gg-meta-form')) return;
        inner.classList.add('gg-entity-form', 'gg-meta-form');
        hero(inner, '🎯', 'Defina um objetivo e acompanhe seu progresso');
        const money = inner.querySelector('input[id*="meta"][id*="valor"], input[id*="meta"][id*="objetivo"]');
        if (money) money.classList.add('gg-money-field');
        markSave(inner);
    }

    function decorateConfirmation(inner) {
        if (inner.classList.contains('gg-danger-confirm') || inner.classList.contains('gg-neutral-confirm')) return;
        const heading = firstHeading(inner);
        const buttons = [...inner.querySelectorAll('button')];
        if (!heading || buttons.length < 2) return;
        const isDanger = /excluir|remover|apagar|desconectar|cancelar/i.test(heading.textContent || '') || buttons.some(b => /excluir|remover|apagar/i.test(b.textContent || ''));
        if (!isDanger && !/confirmar/i.test(buttons.at(-1)?.textContent || '')) return;
        inner.classList.add('gg-danger-confirm');
        const icon = document.createElement('div');
        icon.className = 'gg-confirm-icon';
        icon.textContent = isDanger ? '⚠️' : '✓';
        heading.parentNode.insertBefore(icon, heading);
        const copy = inner.querySelector('p');
        if (copy) copy.classList.add('gg-confirm-copy');
        const row = buttons[0]?.parentElement;
        if (row) row.classList.add('gg-confirm-actions');
    }

    function decorate(inner) {
        if (!inner) return;
        injectStyles();
        if (inner.querySelector('#f-conta-nome')) return decorateAccount(inner);
        if (inner.querySelector('#f-cartao-nome')) return decorateCard(inner);
        if (inner.querySelector('#f-meta-nome') || inner.querySelector('#f-meta-objetivo')) return decorateMeta(inner);
        decorateConfirmation(inner);
    }

    function observe() {
        const modal = document.getElementById('modal');
        const inner = document.getElementById('modal-content-inner');
        if (!modal || !inner) return false;
        const run = () => setTimeout(() => decorate(inner), 0);
        new MutationObserver(run).observe(inner, { childList: true, subtree: true });
        new MutationObserver(run).observe(modal, { attributes: true, attributeFilter: ['class', 'style'] });
        run();
        return true;
    }

    function init() {
        if (observe()) return;
        const timer = setInterval(() => { if (observe()) clearInterval(timer); }, 100);
        setTimeout(() => clearInterval(timer), 10000);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
    else init();
})();
