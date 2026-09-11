/* Gato Gordo — sistema visual compartilhado de modais. */
(function () {
  'use strict';

  const STYLE_ID = 'gg-modal-system-style';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #modal.modal-premium:not(.gg-modal-v2) { background:rgba(2,6,23,.72)!important; backdrop-filter:blur(18px) saturate(120%); -webkit-backdrop-filter:blur(18px) saturate(120%); padding:12px!important; }
      #modal.modal-premium:not(.gg-modal-v2) .modal-content { width:min(100%,560px)!important; max-height:min(90vh,860px)!important; margin:auto!important; padding:0!important; overflow:hidden!important; border:1px solid rgba(255,255,255,.08)!important; border-radius:28px!important; background:linear-gradient(180deg,rgba(15,23,42,.985),rgba(8,13,25,.995))!important; box-shadow:0 30px 90px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.035)!important; }
      #modal.modal-premium:not(.gg-modal-v2) #modal-content-inner { max-height:min(90vh,860px)!important; overflow-y:auto!important; overflow-x:hidden!important; -webkit-overflow-scrolling:touch; padding:24px 20px calc(24px + env(safe-area-inset-bottom))!important; }
      #modal.modal-premium:not(.gg-modal-v2) #modal-content-inner h3 { margin:0 48px 20px 0!important; font-size:1.45rem!important; line-height:1.15!important; letter-spacing:-.04em!important; font-weight:800!important; }
      #modal.modal-premium:not(.gg-modal-v2) #modal-content-inner label { display:block; margin:16px 0 7px!important; color:rgba(203,213,225,.62)!important; font-size:.78rem!important; font-weight:700!important; }
      #modal.modal-premium:not(.gg-modal-v2) #modal-content-inner input,
      #modal.modal-premium:not(.gg-modal-v2) #modal-content-inner select,
      #modal.modal-premium:not(.gg-modal-v2) #modal-content-inner textarea { width:100%!important; min-height:52px!important; box-sizing:border-box!important; border-radius:16px!important; border:1px solid rgba(255,255,255,.08)!important; background:rgba(255,255,255,.05)!important; color:#f8fafc!important; }
      #modal.modal-premium:not(.gg-modal-v2) #modal-content-inner input:focus,
      #modal.modal-premium:not(.gg-modal-v2) #modal-content-inner select:focus,
      #modal.modal-premium:not(.gg-modal-v2) #modal-content-inner textarea:focus { outline:none!important; border-color:rgba(245,158,11,.62)!important; box-shadow:0 0 0 4px rgba(245,158,11,.09)!important; }
      #modal.modal-premium:not(.gg-modal-v2) #modal-content-inner button { min-height:48px; border-radius:15px; transition:transform .16s ease,background .16s ease,border-color .16s ease; }
      #modal.modal-premium:not(.gg-modal-v2) #modal-content-inner button:active { transform:scale(.985); }
      #modal.modal-premium:not(.gg-modal-v2) .modal-premium-primary { width:100%!important; min-height:56px!important; margin-top:20px!important; border:0!important; border-radius:17px!important; background:linear-gradient(135deg,#f59e0b,#f97316)!important; color:#09090b!important; font-weight:800!important; box-shadow:0 10px 28px rgba(245,158,11,.18)!important; }
      #modal.modal-premium:not(.gg-modal-v2) .modal-premium-close { width:42px!important; min-height:42px!important; height:42px!important; padding:0!important; border-radius:50%!important; background:rgba(255,255,255,.055)!important; }
      #modal.modal-premium:not(.gg-modal-v2) .gg-modal-section { margin-top:20px; padding-top:18px; border-top:1px solid rgba(255,255,255,.07); }
      #modal.modal-premium:not(.gg-modal-v2) .gg-modal-section-title { margin:0 0 8px; color:#f8fafc; font-size:.84rem; font-weight:800; }
      #modal.modal-premium:not(.gg-modal-v2) .gg-modal-helper { margin:6px 0 12px; color:rgba(203,213,225,.48); font-size:.72rem; line-height:1.45; }
      @media(max-width:600px){
        #modal.modal-premium:not(.gg-modal-v2) { align-items:flex-end!important; padding:0!important; }
        #modal.modal-premium:not(.gg-modal-v2) .modal-content { width:100%!important; max-width:none!important; max-height:94vh!important; border-radius:28px 28px 0 0!important; animation:ggSystemSheetIn .28s cubic-bezier(.16,1,.3,1) both; }
        #modal.modal-premium:not(.gg-modal-v2) #modal-content-inner { max-height:94vh!important; padding-left:18px!important; padding-right:18px!important; }
        #modal.modal-premium:not(.gg-modal-v2) .gg-modal-system-handle { display:block; width:38px; height:4px; margin:8px auto 0; border-radius:999px; background:rgba(255,255,255,.23); }
      }
      @keyframes ggSystemSheetIn { from { transform:translateY(24px); opacity:.6; } to { transform:translateY(0); opacity:1; } }
      @media(prefers-reduced-motion:reduce){ #modal.modal-premium:not(.gg-modal-v2) .modal-content { animation:none!important; } }
    `;
    document.head.appendChild(style);
  }

  function decorate() {
    const modal = document.getElementById('modal');
    const sheet = modal?.querySelector('.modal-content');
    const inner = document.getElementById('modal-content-inner');
    if (!modal || !sheet || !inner || modal.classList.contains('gg-modal-v2')) return;
    modal.classList.add('gg-modal-system');
    if (window.matchMedia('(max-width: 600px)').matches && !sheet.querySelector('.gg-modal-system-handle')) {
      const handle = document.createElement('div');
      handle.className = 'gg-modal-system-handle';
      handle.setAttribute('aria-hidden', 'true');
      sheet.prepend(handle);
    }
    inner.querySelectorAll('input,select,textarea').forEach(field => {
      field.setAttribute('autocomplete', field.getAttribute('autocomplete') || 'off');
    });
  }

  function init() {
    injectStyles();
    const observer = new MutationObserver(() => requestAnimationFrame(decorate));
    observer.observe(document.body, { childList:true, subtree:true, attributes:true, attributeFilter:['class','style','hidden'] });
    decorate();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();