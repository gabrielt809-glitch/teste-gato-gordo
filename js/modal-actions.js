/* Gato Gordo — estados especiais dos modais.
 * Camada visual: não altera regras financeiras nem handlers existentes.
 */
(function () {
    'use strict';

    const STYLE_ID = 'gg-modal-actions-style';

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            #modal .gg-action-hero {
                display:flex; align-items:center; gap:13px; padding:2px 0 18px;
                margin-bottom:16px; border-bottom:1px solid rgba(255,255,255,.07);
            }
            #modal .gg-action-icon {
                width:50px; height:50px; flex:0 0 50px; display:grid; place-items:center;
                border-radius:17px; background:rgba(245,158,11,.10); color:#fbbf24;
                border:1px solid rgba(245,158,11,.13); font-size:22px;
            }
            #modal .gg-action-hero h3 { margin:0 !important; font-size:21px !important; line-height:1.15; }
            #modal .gg-action-subtitle { margin:5px 0 0; color:rgba(156,163,175,.78); font-size:12px; line-height:1.45; }
            #modal .gg-action-value {
                margin:0 0 18px; padding:17px 16px; border-radius:19px;
                background:linear-gradient(135deg, rgba(245,158,11,.12), rgba(245,158,11,.035));
                border:1px solid rgba(245,158,11,.12);
            }
            #modal .gg-action-value-label { display:block; color:rgba(156,163,175,.75); font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:.07em; }
            #modal .gg-action-value input { margin-top:5px; min-height:64px !important; height:auto !important; padding:8px 0 !important; border:0 !important; background:transparent !important; box-shadow:none !important; font-size:31px !important; font-weight:850 !important; letter-spacing:-.035em; }
            #modal .gg-action-value input:focus { box-shadow:none !important; }
            #modal .gg-account-choice { margin-top:10px; }
            #modal .gg-account-choice label { display:block; margin-bottom:8px; }
            #modal .gg-action-note { color:rgba(156,163,175,.68); font-size:11px; line-height:1.5; margin:-5px 0 15px; }
            #modal .gg-action-primary { min-height:56px !important; border-radius:17px !important; font-size:15px !important; }

            #modal .gg-scope-actions { display:grid; gap:10px; margin-top:6px; }
            #modal .gg-scope-actions button {
                position:relative; width:100%; min-height:68px; padding:13px 14px 13px 48px;
                text-align:left; border-radius:17px; border:1px solid rgba(255,255,255,.07);
                background:rgba(255,255,255,.025); transition:transform .16s ease, border-color .16s ease, background .16s ease;
            }
            #modal .gg-scope-actions button::before {
                content:'✓'; position:absolute; left:15px; top:50%; transform:translateY(-50%);
                width:24px; height:24px; display:grid; place-items:center; border-radius:9px;
                background:rgba(245,158,11,.10); color:#fbbf24; font-size:12px; font-weight:900;
            }
            #modal .gg-scope-actions button:hover { transform:translateY(-1px); border-color:rgba(245,158,11,.30); background:rgba(245,158,11,.055); }
            #modal .gg-scope-actions button[aria-pressed="true"],
            #modal .gg-scope-actions button.selected,
            #modal .gg-scope-actions button.active {
                border-color:rgba(245,158,11,.45); background:rgba(245,158,11,.10);
                box-shadow:0 0 0 1px rgba(245,158,11,.08), 0 8px 22px rgba(0,0,0,.14);
            }
            #modal .gg-scope-actions button[aria-pressed="true"]::before,
            #modal .gg-scope-actions button.selected::before,
            #modal .gg-scope-actions button.active::before { background:#f59e0b; color:#111827; }
            #modal .gg-scope-actions button:nth-child(2)::before { content:'→'; }
            #modal .gg-scope-actions button:nth-child(3)::before { content:'∞'; }
            #modal .gg-scope-actions button p:first-child { font-size:14px !important; margin:0 0 4px !important; }
            #modal .gg-scope-actions button p:last-child { font-size:11px !important; color:rgba(156,163,175,.72) !important; margin:0 !important; line-height:1.35; }
            #modal .gg-scope-cancel { margin-top:4px !important; min-height:48px; }

            #modal .gg-danger-confirm .gg-danger-callout {
                margin:0 0 18px; padding:12px 13px; border-radius:15px;
                background:rgba(239,68,68,.055); border:1px solid rgba(239,68,68,.10);
                color:rgba(252,165,165,.88); font-size:11px; line-height:1.45;
            }
            #modal .gg-danger-confirm .gg-confirm-actions { display:grid; gap:10px; margin-top:18px; }
            #modal .gg-danger-confirm .gg-confirm-actions button { min-height:52px !important; border-radius:16px !important; }
            #modal .gg-danger-confirm .gg-danger-button { background:#ef4444 !important; color:#fff !important; border-color:#ef4444 !important; }
            #modal .gg-danger-confirm .gg-cancel-button { background:rgba(255,255,255,.045) !important; color:rgba(255,255,255,.84) !important; border-color:rgba(255,255,255,.10) !important; }

            #modal .gg-meta-progress {
                margin:0 0 18px; padding:15px 16px 14px; border-radius:19px;
                background:rgba(168,85,247,.07); border:1px solid rgba(168,85,247,.12);
            }
            #modal .gg-meta-progress-head { display:flex; justify-content:space-between; gap:12px; align-items:baseline; margin-bottom:9px; }
            #modal .gg-meta-progress-title { font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:.07em; color:rgba(216,180,254,.72); }
            #modal .gg-meta-progress-percent { font-size:14px; font-weight:900; color:#d8b4fe; }
            #modal .gg-meta-progress-track { height:8px; overflow:hidden; border-radius:999px; background:rgba(255,255,255,.07); }
            #modal .gg-meta-progress-bar { height:100%; width:0; border-radius:inherit; background:linear-gradient(90deg,#a855f7,#c084fc); transition:width .25s ease; }
            #modal .gg-meta-progress-values { display:flex; justify-content:space-between; gap:12px; margin-top:8px; font-size:10px; color:rgba(156,163,175,.72); }

            #modal .gg-modal-feedback { margin:8px 0 14px; padding:11px 13px; border-radius:14px; font-size:12px; line-height:1.45; }
            #modal .gg-modal-feedback.gg-feedback-error { background:rgba(239,68,68,.07); border:1px solid rgba(239,68,68,.13); color:#fca5a5; }
            #modal .gg-modal-feedback.gg-feedback-success { background:rgba(34,197,94,.07); border:1px solid rgba(34,197,94,.13); color:#86efac; }

            @media (max-width:600px) {
                #modal .gg-action-value input { font-size:29px !important; }
                #modal .gg-scope-actions button { min-height:72px; }
                #modal .gg-danger-confirm .gg-confirm-actions { gap:8px; }
            }
        `;
        document.head.appendChild(style);
    }

    function heading(inner) { return inner.querySelector('h1,h2,h3'); }
    function buttons(inner) { return [...inner.querySelectorAll('button')]; }

    function addHero(inner, icon, subtitle) {
        if (inner.querySelector('.gg-action-hero')) return;
        const h = heading(inner);
        if (!h) return;
        const wrap = document.createElement('div');
        wrap.className = 'gg-action-hero';
        const iconEl = document.createElement('div');
        iconEl.className = 'gg-action-icon';
        iconEl.textContent = icon;
        const copy = document.createElement('div');
        const title = document.createElement('h3');
        title.textContent = h.textContent.trim();
        const sub = document.createElement('p');
        sub.className = 'gg-action-subtitle';
        sub.textContent = subtitle;
        copy.append(title, sub);
        wrap.append(iconEl, copy);
        h.replaceWith(wrap);
    }

    function enhanceMetaAction(inner, isWithdraw) {
        if (inner.dataset.ggMetaAction === '1') return;
        const input = inner.querySelector(isWithdraw ? '#f-meta-valor-resgate' : '#f-meta-valor');
        const account = inner.querySelector(isWithdraw ? '#f-meta-conta-resgate' : '#f-meta-conta');
        if (!input || !account) return;
        inner.dataset.ggMetaAction = '1';

        const currentText = [...inner.querySelectorAll('p')].find(p => /disponível/i.test(p.textContent || ''));
        addHero(inner, isWithdraw ? '↩' : '🎯', isWithdraw ? 'O dinheiro volta para uma conta escolhida' : 'Reserve dinheiro sem perder o controle do saldo');

        const label = input.previousElementSibling;
        const valueWrap = document.createElement('div');
        valueWrap.className = 'gg-action-value';
        const valueLabel = document.createElement('span');
        valueLabel.className = 'gg-action-value-label';
        valueLabel.textContent = 'Valor';
        input.classList.add('gg-action-amount');
        if (label && label.tagName === 'LABEL') label.remove();
        input.parentNode.insertBefore(valueWrap, input);
        valueWrap.append(valueLabel, input);

        const accountLabel = account.previousElementSibling;
        const accountWrap = document.createElement('div');
        accountWrap.className = 'gg-account-choice';
        if (accountLabel && accountLabel.tagName === 'LABEL') accountWrap.appendChild(accountLabel);
        account.parentNode.insertBefore(accountWrap, account);
        accountWrap.appendChild(account);

        if (currentText) {
            currentText.classList.add('gg-action-note');
            if (isWithdraw) currentText.textContent = currentText.textContent.replace(/^.*?Disponível:/i, 'Disponível para resgate:');
        }

        const save = buttons(inner).find(b => /guardar|resgatar/i.test(b.textContent || ''));
        if (save) save.classList.add('gg-action-primary');
    }

    function enhanceMetaProgress(inner) {
        if (inner.dataset.ggMetaProgress === '1') return;
        const target = inner.querySelector('#f-meta-obj');
        const current = inner.querySelector('#f-meta-atual');
        if (!target || !current) return;
        inner.dataset.ggMetaProgress = '1';

        const wrap = document.createElement('div');
        wrap.className = 'gg-meta-progress';
        wrap.innerHTML = `
            <div class="gg-meta-progress-head">
                <span class="gg-meta-progress-title">Progresso da meta</span>
                <strong class="gg-meta-progress-percent">0%</strong>
            </div>
            <div class="gg-meta-progress-track"><div class="gg-meta-progress-bar"></div></div>
            <div class="gg-meta-progress-values"><span class="gg-meta-progress-current">Atual: R$ 0,00</span><span class="gg-meta-progress-target">Meta: R$ 0,00</span></div>
        `;
        const anchor = target.closest('div') || target.parentElement;
        if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(wrap, anchor);

        const parse = value => {
            const raw = String(value ?? '').replace(/[^0-9,.-]/g, '').trim();
            if (!raw) return 0;
            const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw;
            const number = Number(normalized);
            return Number.isFinite(number) ? Math.max(0, number) : 0;
        };
        const money = value => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        const render = () => {
            const targetValue = parse(target.value);
            const currentValue = parse(current.value);
            const ratio = targetValue > 0 ? Math.min(1, currentValue / targetValue) : 0;
            wrap.querySelector('.gg-meta-progress-percent').textContent = `${Math.round(ratio * 100)}%`;
            wrap.querySelector('.gg-meta-progress-bar').style.width = `${ratio * 100}%`;
            wrap.querySelector('.gg-meta-progress-current').textContent = `Atual: ${money(currentValue)}`;
            wrap.querySelector('.gg-meta-progress-target').textContent = `Meta: ${money(targetValue)}`;
        };
        ['input', 'change'].forEach(eventName => {
            target.addEventListener(eventName, render);
            current.addEventListener(eventName, render);
        });
        render();
    }

    function enhanceScope(inner) {
        if (inner.dataset.ggScopeAction === '1') return;
        const h = heading(inner);
        const scopeButtons = buttons(inner).filter(b => /somente esta|esta e as próximas|todas/i.test(b.textContent || ''));
        if (!h || scopeButtons.length < 2) return;
        inner.dataset.ggScopeAction = '1';
        addHero(inner, '✎', 'Escolha o alcance antes de aplicar a alteração');

        const first = scopeButtons[0];
        const group = document.createElement('div');
        group.className = 'gg-scope-actions';
        first.parentNode.insertBefore(group, first);
        scopeButtons.forEach(b => {
            b.classList.add('gg-scope-choice');
            group.appendChild(b);
        });

        const syncSelection = () => {
            scopeButtons.forEach(button => {
                const selected = button.getAttribute('aria-pressed') === 'true' || button.classList.contains('selected') || button.classList.contains('active');
                button.classList.toggle('gg-scope-selected', selected);
            });
        };
        scopeButtons.forEach(button => {
            button.addEventListener('click', () => setTimeout(syncSelection, 0), { passive: true });
        });
        syncSelection();

        const cancel = buttons(inner).find(b => /cancelar/i.test(b.textContent || ''));
        if (cancel) cancel.classList.add('gg-scope-cancel');
    }

    function enhanceDanger(inner) {
        if (inner.dataset.ggDangerAction === '1') return;
        const h = heading(inner);
        if (!h) return;
        const danger = /excluir|remover|apagar|desconectar/i.test(h.textContent || '');
        if (!danger) return;
        inner.dataset.ggDangerAction = '1';
        inner.classList.add('gg-danger-confirm');

        const copy = [...inner.querySelectorAll('p')].find(p => !p.closest('.gg-action-hero') && !p.closest('.gg-danger-callout'));
        if (copy && !inner.querySelector('.gg-danger-callout')) copy.classList.add('gg-danger-callout');

        const allButtons = buttons(inner);
        const destructive = allButtons.find(b => /excluir|remover|apagar|desconectar/i.test(b.textContent || ''));
        const cancel = allButtons.find(b => /cancelar|voltar/i.test(b.textContent || ''));
        const actionButtons = [destructive, cancel].filter(Boolean);
        if (actionButtons.length) {
            const row = document.createElement('div');
            row.className = 'gg-confirm-actions';
            const anchor = actionButtons[0];
            anchor.parentNode.insertBefore(row, anchor);
            actionButtons.forEach(button => {
                row.appendChild(button);
                if (button === destructive) button.classList.add('gg-danger-button');
                if (button === cancel) button.classList.add('gg-cancel-button');
            });
        }
    }

    function enhanceFeedback(inner) {
        const nodes = [...inner.querySelectorAll('[role="alert"], .text-red-500, .text-red-600, .text-green-500, .text-green-600')];
        nodes.forEach(node => {
            if (node.closest('.gg-action-hero, .gg-danger-callout, .gg-modal-feedback')) return;
            const text = (node.textContent || '').trim();
            if (!text) return;
            node.classList.add('gg-modal-feedback');
            const isSuccess = /sucesso|salvo|salva|concluído|concluída|realizado|realizada/i.test(text) || node.classList.contains('text-green-500') || node.classList.contains('text-green-600');
            node.classList.add(isSuccess ? 'gg-feedback-success' : 'gg-feedback-error');
        });
    }

    function enhance(inner) {
        if (!inner) return;
        injectStyles();
        const withdraw = inner.querySelector('#f-meta-valor-resgate');
        const deposit = inner.querySelector('#f-meta-valor');
        if (withdraw) enhanceMetaAction(inner, true);
        else if (deposit && inner.querySelector('#f-meta-conta')) enhanceMetaAction(inner, false);
        enhanceMetaProgress(inner);
        enhanceScope(inner);
        enhanceDanger(inner);
        enhanceFeedback(inner);
    }

    function init() {
        const modal = document.getElementById('modal');
        const inner = document.getElementById('modal-content-inner');
        if (!modal || !inner) return false;
        injectStyles();
        const run = () => setTimeout(() => enhance(inner), 0);
        new MutationObserver(run).observe(inner, { childList: true, subtree: true });
        new MutationObserver(run).observe(modal, { attributes: true, attributeFilter: ['class', 'style'] });
        run();
        return true;
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
    else init();
})();