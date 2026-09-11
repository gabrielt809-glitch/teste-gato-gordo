(function (root) {
    'use strict';
    const originalOpenModal = root.openModal;
    const originalSalvarTransacao = root.salvarTransacao;
    const originalConfirmarExcluir = root.confirmarExcluirTransacao;
    if (typeof originalOpenModal !== 'function' || typeof originalSalvarTransacao !== 'function') return;

    function storedProfile() {
        try {
            const raw = root.gatoStorage?.getItem('gato_gordo_perfis');
            const list = raw ? JSON.parse(raw) : [];
            return list[0] || null;
        } catch (_) { return null; }
    }
    function tx(id) { return storedProfile()?.transacoes?.find(t => t.id === id) || null; }
    function series(id) {
        const p = storedProfile();
        return (p?.transacoes || []).filter(t => t.parcelamentoId === id).sort((a,b) => (a.parcelaNumero || 0) - (b.parcelaNumero || 0));
    }
    function baseDescription(value) { return String(value || '').replace(/\s+\(\d+\/\d+\)$/, '').trim(); }
    function valuesFromForm(id) {
        const p = storedProfile();
        const t = tx(id);
        if (!p || !t) throw new Error('Parcelamento não encontrado.');
        const tipo = document.getElementById('f-trans-tipo')?.value || 'cartao';
        const normalized = root.GatoTransacoes.normalize(p, {
            tipo,
            descricao: document.getElementById('f-trans-desc')?.value,
            valor: document.getElementById('f-trans-valor')?.value,
            data: document.getElementById('f-trans-data')?.value,
            contaId: document.getElementById('f-trans-conta')?.value,
            cartaoId: document.getElementById('f-trans-cartao')?.value,
            contaDestinoId: document.getElementById('f-trans-conta-dest')?.value,
            categoria: document.getElementById('f-trans-categoria')?.value || ''
        });
        if (normalized.tipo !== 'despesa-cartao') throw new Error('Uma compra parcelada precisa continuar em um cartão.');
        return normalized;
    }
    function persistParcelMetadata(parcelamentoId) {
        try {
            const p = storedProfile();
            const group = (p?.transacoes || []).filter(t => t.parcelamentoId === parcelamentoId).sort((a,b) => (a.parcelaNumero||0)-(b.parcelaNumero||0));
            if (!group.length) return false;
            const total = group.reduce((s,t) => s + Number(t.valor || 0), 0);
            const first = group[0];
            group.forEach(t => {
                t.totalParcelas = group.length;
                t.valorTotal = Math.round(total * 100) / 100;
                t.compraData = first.data;
                t.descricao = `${baseDescription(t.descricao)} (${t.parcelaNumero || 1}/${group.length})`;
            });
            root.gatoStorage.setItem('gato_gordo_perfis', JSON.stringify([p]));
            return true;
        } catch (_) { return false; }
    }
    function choice(id, values) {
        const t = tx(id); const group = series(t?.parcelamentoId);
        const modal = document.getElementById('modal');
        const content = document.getElementById('modal-content-inner');
        modal.classList.remove('hidden');
        root.GatoParcelamentos._pending = { id, values };
        content.innerHTML = `
          <div class="space-y-6">
            <div class="text-center"><div class="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">💳</div><h3 class="text-xl font-bold">Editar Parcelamento</h3><p class="text-gray-500 text-sm mt-2">Parcela ${t?.parcelaNumero || '?'} de ${group.length}. Escolha o alcance da alteração.</p></div>
            <div class="grid grid-cols-1 gap-3">
              <button onclick="GatoParcelamentos.aplicar('apenas')" class="w-full card-premium p-4 rounded-2xl text-left"><p class="font-bold text-sm">Somente esta parcela</p><p class="text-[10px] text-gray-500">Altera apenas a parcela selecionada.</p></button>
              <button onclick="GatoParcelamentos.aplicar('proximas')" class="w-full card-premium p-4 rounded-2xl text-left"><p class="font-bold text-sm">Esta e as próximas</p><p class="text-[10px] text-gray-500">Aplica o novo valor/data a partir desta parcela.</p></button>
              <button onclick="GatoParcelamentos.aplicar('todas')" class="w-full card-premium p-4 rounded-2xl text-left"><p class="font-bold text-sm text-amber-400">Todas as parcelas</p><p class="text-[10px] text-amber-400/50">Aplica o novo valor/data a todo o parcelamento.</p></button>
            </div>
            <button onclick="GatoParcelamentos.cancelar()" class="w-full py-4 text-gray-500 text-xs font-bold uppercase tracking-widest">Cancelar</button>
          </div>`;
    }

    root.GatoParcelamentos = {
        _pending: null,
        aplicar(modo) {
            const pending = this._pending;
            if (!pending) return;
            const t = tx(pending.id);
            if (!t?.parcelamentoId) return;
            const group = series(t.parcelamentoId);
            const selected = group.findIndex(x => x.id === pending.id);
            const targets = modo === 'apenas' ? [group[selected]] : modo === 'proximas' ? group.slice(selected) : group;
            const v = pending.values;
            const valor = Number(v.valor);
            if (!Number.isFinite(valor) || valor <= 0) return root.mostrarAlerta('Informe um valor de parcela maior que zero.');
            const total = group.length;
            const newDesc = baseDescription(v.descricao);
            targets.forEach(x => {
                const index = group.findIndex(g => g.id === x.id);
                const data = modo === 'apenas' ? v.data : root.GatoFinance.addMonths(v.data, index - selected);
                root.salvarTransacaoAcao(x.id, 'apenas', {
                    tipo: 'despesa-cartao', descricao: `${newDesc} (${x.parcelaNumero}/${total})`, valor, data,
                    contaId: null, cartaoId: v.cartaoId, contaDestinoId: null, categoria: v.categoria
                });
            });
            persistParcelMetadata(t.parcelamentoId);
            this._pending = null;
            root.closeModal?.();
            root.renderPessoal?.();
            if (root.abrirTelaCartao && v.cartaoId) {
                const p = storedProfile(); const idx = p?.cartoes?.findIndex(c => c.id === Number(v.cartaoId));
                if (idx >= 0) root.abrirTelaCartao(idx);
            }
            root.mostrarToast?.('Parcelamento atualizado');
            setTimeout(() => { try { root.location?.reload?.(); } catch (_) {} }, 250);
        },
        cancelar() { this._pending = null; root.closeModal?.(); }
    };

    root.openModal = function(tipo, editId = null, contaPre = null, cartaoPre = null, tipoInicial = null) {
        originalOpenModal(tipo, editId, contaPre, cartaoPre, tipoInicial);
        if (tipo !== 'transacao' || editId === null) return;
        const t = tx(editId);
        if (!t?.parcelamentoId) return;
        const label = document.getElementById('f-trans-valor')?.parentElement?.querySelector('label');
        if (label) label.textContent = 'Valor da parcela';
        const valor = document.getElementById('f-trans-valor');
        if (valor) valor.value = Number(t.valor || 0).toFixed(2);
        const rec = document.getElementById('f-trans-recorrencia');
        if (rec) { rec.value = 'parcelado'; rec.disabled = true; }
        const parcelas = document.getElementById('f-trans-parcelas-num');
        if (parcelas) { parcelas.value = t.totalParcelas || series(t.parcelamentoId).length; parcelas.disabled = true; }
    };

    root.salvarTransacao = function(editId) {
        const t = tx(editId);
        if (!t?.parcelamentoId) return originalSalvarTransacao(editId);
        try { choice(editId, valuesFromForm(editId)); }
        catch (error) { root.mostrarAlerta?.(error.message); }
    };

    if (typeof originalConfirmarExcluir === 'function') {
        root.confirmarExcluirTransacao = function(id) {
            const t = tx(id);
            if (!t?.parcelamentoId) return originalConfirmarExcluir(id);
            const group = series(t.parcelamentoId);
            const modal = document.getElementById('modal');
            const content = document.getElementById('modal-content-inner');
            modal.classList.remove('hidden');
            content.innerHTML = `
              <div class="space-y-6"><div class="text-center"><div class="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">🗑️</div><h3 class="text-xl font-bold">Excluir parcela</h3><p class="text-gray-500 text-sm mt-2">Esta é a parcela ${t.parcelaNumero || '?'} de ${group.length}.</p></div>
              <div class="grid grid-cols-1 gap-3">
                <button onclick="excluirTransacaoAcao(${id}, 'apenas')" class="w-full card-premium p-4 rounded-2xl text-left"><p class="font-bold text-sm">Somente esta parcela</p><p class="text-[10px] text-gray-500">Libera apenas o valor desta parcela no limite.</p></button>
                <button onclick="excluirTransacaoAcao(${id}, 'proximas')" class="w-full card-premium p-4 rounded-2xl text-left"><p class="font-bold text-sm">Esta e as próximas</p><p class="text-[10px] text-gray-500">Remove o restante do compromisso futuro.</p></button>
                <button onclick="excluirTransacaoAcao(${id}, 'todas')" class="w-full card-premium p-4 rounded-2xl text-left"><p class="font-bold text-sm text-red-400">Todas as parcelas</p><p class="text-[10px] text-red-400/50">Remove o parcelamento inteiro.</p></button>
              </div><button onclick="closeModal()" class="w-full py-4 text-gray-500 text-xs font-bold uppercase tracking-widest">Cancelar</button></div>`;
        };
    }
})(globalThis);

/* Proteção de mutações: não permite editar/excluir transações sobre um estado financeiro já inconsistente. */
(function (root) {
    'use strict';
    function profile() {
        try {
            const raw = root.gatoStorage?.getItem('gato_gordo_perfis');
            const list = raw ? JSON.parse(raw) : [];
            return list[0] || null;
        } catch (_) { return null; }
    }
    function auditBefore(action) {
        const p = profile();
        if (!p || !root.GatoFinance || typeof root.GatoFinance.audit !== 'function') return true;
        const result = root.GatoFinance.audit(p);
        if (result.ok) return true;
        const details = result.errors.slice(0, 3).join(' ');
        const message = `Operação bloqueada para proteger seus dados. Corrija primeiro a inconsistência financeira.${details ? ' ' + details : ''}`;
        if (typeof root.mostrarAlerta === 'function') root.mostrarAlerta(message);
        else if (typeof root.mostrarToast === 'function') root.mostrarToast('Operação bloqueada: dados inconsistentes.');
        console.warn('[GatoFinance] Mutação bloqueada:', action, result);
        return false;
    }
    function wrap(name) {
        const original = root[name];
        if (typeof original !== 'function' || original.__gatoIntegrityGuard) return;
        const guarded = function () {
            if (!auditBefore(name)) return;
            return original.apply(this, arguments);
        };
        guarded.__gatoIntegrityGuard = true;
        guarded.__gatoIntegrityOriginal = original;
        root[name] = guarded;
    }
    wrap('salvarTransacaoAcao');
    wrap('excluirTransacaoAcao');
    root.GatoFinanceIntegrityGuard = { auditBefore };
})(globalThis);
