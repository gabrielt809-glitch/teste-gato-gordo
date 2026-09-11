(function (root) {
    'use strict';

    let instalado = false;

    function perfilAtual() {
        try {
            const raw = root.gatoStorage?.getItem('gato_gordo_perfis');
            const perfis = raw ? JSON.parse(raw) : [];
            return perfis[0] || null;
        } catch (_) { return null; }
    }

    function auditar(acao) {
        const p = perfilAtual();
        if (!p || typeof root.GatoFinance?.audit !== 'function') return true;
        const resultado = root.GatoFinance.audit(p);
        if (resultado.ok) return true;
        const detalhe = resultado.errors?.slice(0, 3).join(' | ') || 'inconsistência financeira detectada';
        root.mostrarAlerta?.(`Operação bloqueada para proteger seus dados: ${detalhe}`);
        console.warn(`[Gato Gordo] Mutação bloqueada (${acao})`, resultado);
        return false;
    }

    function instalar(nome, acao) {
        const original = root[nome];
        if (typeof original !== 'function' || original.__gatoIntegrityWrapped) return false;
        const wrapped = function (...args) {
            if (!auditar(acao)) return;
            return original.apply(this, args);
        };
        wrapped.__gatoIntegrityWrapped = true;
        wrapped.__gatoIntegrityOriginal = original;
        root[nome] = wrapped;
        return true;
    }

    function tentarInstalar() {
        if (instalado) return;
        const nomes = [
            ['salvarTransacaoAcao', 'editar transação'],
            ['excluirTransacaoAcao', 'excluir transação'],
            ['excluirConta', 'excluir conta'],
            ['excluirCartao', 'excluir cartão']
        ];
        const encontrados = nomes.filter(([nome]) => typeof root[nome] === 'function').length;
        if (!encontrados) return;
        nomes.forEach(([nome, acao]) => instalar(nome, acao));
        instalado = true;
        root.GatoMutacoesFinanceiras = { auditBefore: auditar, install: instalar };
    }

    // app.js é carregado dinamicamente pelo bootstrap; o retry desacopla a ordem
    // de carregamento e prepara a futura extração das ações do app.js.
    tentarInstalar();
    const timer = root.setInterval(() => {
        tentarInstalar();
        if (instalado) root.clearInterval(timer);
    }, 50);
    root.addEventListener?.('load', tentarInstalar, { once: true });
})(globalThis);
