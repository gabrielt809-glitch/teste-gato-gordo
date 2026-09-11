(function (root) {
    'use strict';

    // Camada de fronteira: mantém a implementação legada em app.js/parcelamentos.js,
    // mas centraliza o contrato de segurança das mutações financeiras.
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
        if (typeof original !== 'function') return;
        root[nome] = function (...args) {
            if (!auditar(acao)) return;
            return original.apply(this, args);
        };
    }

    // Exposto para testes e para futuras extrações: a próxima etapa pode mover
    // a implementação das ações para cá sem alterar a UI que já chama essas APIs.
    root.GatoMutacoesFinanceiras = {
        auditBefore: auditar,
        install: instalar
    };

    instalar('salvarTransacaoAcao', 'editar transação');
    instalar('excluirTransacaoAcao', 'excluir transação');
    instalar('excluirConta', 'excluir conta');
    instalar('excluirCartao', 'excluir cartão');
})(globalThis);
