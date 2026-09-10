/* Validação e criação de lançamentos. Nenhuma alteração no perfil antes de validar tudo. */
(function (root) {
    'use strict';
    const finance = () => root.GatoFinance;

    function normalize(profile, fields) {
        const tipo = fields.tipo === 'cartao' ? 'despesa-cartao' : fields.tipo;
        if (!['receita','despesa','transferencia','despesa-cartao'].includes(tipo)) throw new Error('Tipo de lançamento inválido.');
        const descricao = String(fields.descricao || '').trim();
        if (!descricao) throw new Error('Informe a descrição do lançamento.');
        const valor = finance().cents(fields.valor)/100;
        if (valor <= 0) throw new Error('Informe um valor maior que zero.');
        finance().parseDate(fields.data);
        const contaId = tipo === 'despesa-cartao' ? null : Number(fields.contaId);
        const cartaoId = tipo === 'despesa-cartao' ? Number(fields.cartaoId) : null;
        const contaDestinoId = tipo === 'transferencia' ? Number(fields.contaDestinoId) : null;
        if (tipo === 'despesa-cartao') {
            if (!profile.cartoes.some(c=>c.id===cartaoId)) throw new Error('Selecione um cartão válido.');
        } else if (!profile.contas.some(c=>c.id===contaId)) throw new Error('Selecione uma conta válida.');
        if (tipo === 'transferencia' && (contaId === contaDestinoId || !profile.contas.some(c=>c.id===contaDestinoId))) throw new Error('Escolha uma conta de destino diferente da origem.');
        return {tipo,descricao,valor,data:fields.data,contaId,cartaoId,contaDestinoId,categoria:fields.categoria || ''};
    }

    function create(profile, fields, clock = Date.now()) {
        const values = normalize(profile,fields);
        const recurrence = fields.recorrencia || 'nenhuma';
        if (!['nenhuma','mensal','semanal','quinzenal','parcelado'].includes(recurrence)) throw new Error('Recorrência inválida.');
        if (values.tipo === 'despesa-cartao' && !['nenhuma','parcelado'].includes(recurrence)) throw new Error('No cartão, escolha uma compra única ou parcelada.');

        const installment = recurrence === 'parcelado';
        const count = installment ? Number(fields.parcelas) : recurrence === 'nenhuma' ? 1 : 24;
        const amounts = installment ? finance().splitAmount(values.valor,count) : Array(count).fill(values.valor);
        let start = Math.floor(clock);
        for (const t of profile.transacoes) if (Number.isSafeInteger(t.id)) start = Math.max(start,t.id+1);
        if (!Number.isSafeInteger(start+count)) throw new Error('Não foi possível gerar identificadores para os lançamentos.');

        const parcelamentoId = installment ? start : null;
        const transactions = amounts.map((valor,i)=>({
            ...values,
            id:start+i,
            serieId:recurrence === 'nenhuma' ? null : start,
            parcelamentoId,
            parcelaNumero: installment ? i + 1 : null,
            totalParcelas: installment ? count : null,
            valorTotal: installment ? values.valor : null,
            compraData: installment ? values.data : null,
            descricao:installment ? `${values.descricao} (${i+1}/${count})` : values.descricao,
            valor,
            data:recurrence === 'semanal' ? finance().addDays(values.data,i*7) : recurrence === 'quinzenal' ? finance().addDays(values.data,i*15) : finance().addMonths(values.data,i)
        }));

        return {
            transactions,
            contaId:values.contaId,
            cartaoId:values.cartaoId,
            cardIncrease:values.tipo === 'despesa-cartao' ? transactions.reduce((sum,t)=>sum+finance().cents(t.valor),0)/100 : 0
        };
    }
    root.GatoTransacoes = { normalize, create };
})(globalThis);
