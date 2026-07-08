(function() {
    let perfis = JSON.parse(localStorage.getItem('gato_gordo_perfis') || '[]');
    let perfilLogado = null;
    let telaAtual = 'pessoal';
    let mesRefPessoal = new Date().getMonth();
    let anoRefPessoal = new Date().getFullYear();
    let mesRefCompart = new Date().getMonth();
    let anoRefCompart = new Date().getFullYear();

    const dadosCompart = JSON.parse(localStorage.getItem('gato_gordo_compart') || '{"pessoas":[], "contas":[]}');

    function salvarPerfis() { localStorage.setItem('gato_gordo_perfis', JSON.stringify(perfis)); }
    function salvarCompart() { localStorage.setItem('gato_gordo_compart', JSON.stringify(dadosCompart)); }
    function perfil() { return perfis.find(p => p.nome === perfilLogado); }
    function salvarPessoal() { salvarPerfis(); }

    function fmt(v) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v); }
    function nomeMesAno(m, a) {
        const meses = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
        return `${meses[m]} de ${a}`;
    }

    // --- LOGIN ---
    window.renderLogin = function() {
        const container = document.getElementById('login-form');
        if (perfis.length === 0) {
            container.innerHTML = `
                <div class="space-y-3">
                    <input id="new-perfil-nome" placeholder="Seu Nome" class="w-full p-3 rounded-xl">
                    <input id="new-perfil-pass" type="password" placeholder="Criar Senha" class="w-full p-3 rounded-xl">
                    <button onclick="criarPerfil()" class="w-full bg-amber-500 text-black font-bold py-3 rounded-xl shadow-lg">Começar</button>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="space-y-4">
                    <div class="grid grid-cols-2 gap-3" id="lista-perfis-login">
                        ${perfis.map(p => `
                            <button onclick="selecionarPerfil('${p.nome}')" class="card-premium p-4 rounded-2xl flex flex-col items-center gap-2">
                                <div class="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500 font-bold text-xl">${p.nome[0]}</div>
                                <span class="text-xs font-medium">${p.nome}</span>
                            </button>
                        `).join('')}
                    </div>
                    <div id="login-pass-area" class="hidden slide-in space-y-3">
                        <p class="text-xs text-gray-400">Senha para <span id="login-nome-selected" class="text-amber-400"></span></p>
                        <input id="login-pass" type="password" placeholder="Sua Senha" class="w-full p-3 rounded-xl">
                        <button onclick="fazerLogin()" class="w-full bg-amber-500 text-black font-bold py-3 rounded-xl">Entrar</button>
                        <button onclick="cancelarLogin()" class="text-xs text-gray-500 w-full">Voltar</button>
                    </div>
                    <button onclick="novoPerfil()" class="text-xs text-amber-400 mt-2">+ Novo Perfil</button>
                </div>
            `;
        }
    };

    window.selecionarPerfil = function(nome) {
        document.getElementById('lista-perfis-login').classList.add('hidden');
        document.getElementById('login-pass-area').classList.remove('hidden');
        document.getElementById('login-nome-selected').textContent = nome;
        perfilLogado = nome;
        document.getElementById('login-pass').focus();
    };

    window.cancelarLogin = function() {
        document.getElementById('lista-perfis-login').classList.remove('hidden');
        document.getElementById('login-pass-area').classList.add('hidden');
        perfilLogado = null;
    };

    window.criarPerfil = function() {
        const nome = document.getElementById('new-perfil-nome').value;
        const pass = document.getElementById('new-perfil-pass').value;
        if (!nome || !pass) return;
        perfis.push({ nome, pass, contas: [], cartoes: [], transacoes: [] });
        salvarPerfis();
        renderLogin();
    };

    window.fazerLogin = function() {
        const pass = document.getElementById('login-pass').value;
        const p = perfis.find(x => x.nome === perfilLogado);
        if (p && p.pass === pass) {
            document.getElementById('login-screen').classList.add('hidden');
            document.getElementById('app-container').classList.remove('hidden');
            renderPessoal();
        } else {
            alert('Senha incorreta');
        }
    };

    window.logout = function() {
        perfilLogado = null;
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('app-container').classList.add('hidden');
        renderLogin();
    };

    window.novoPerfil = function() {
        perfis = [];
        renderLogin();
    };

    // --- PESSOAL ---
    window.renderPessoal = function() {
        const p = perfil();
        if (!p) return;
        
        document.getElementById('mes-referencia-pessoal').textContent = nomeMesAno(mesRefPessoal, anoRefPessoal);
        document.getElementById('mes-atual-pessoal').textContent = nomeMesAno(mesRefPessoal, anoRefPessoal);

        const transMes = p.transacoes.filter(t => {
            const d = new Date(t.data);
            return d.getMonth() === mesRefPessoal && d.getFullYear() === anoRefPessoal;
        });

        const receitas = transMes.filter(t => t.tipo === 'receita').reduce((s, t) => s + t.valor, 0);
        const despesas = transMes.filter(t => t.tipo === 'despesa' || t.tipo === 'despesa-cartao').reduce((s, t) => s + t.valor, 0);
        
        document.getElementById('resumo-receitas-mes').textContent = fmt(receitas);
        document.getElementById('resumo-despesas-mes').textContent = fmt(despesas);
        document.getElementById('resumo-saldo-mes').textContent = fmt(receitas - despesas);

        let saldoTotal = p.contas.reduce((s, c) => s + c.saldoInicial, 0);
        p.transacoes.forEach(t => {
            if (t.tipo === 'receita') saldoTotal += t.valor;
            if (t.tipo === 'despesa') saldoTotal -= t.valor;
            // Transferência não muda o patrimônio total, apenas entre contas
        });
        document.getElementById('patrimonio-total').textContent = fmt(saldoTotal);

        const listaContas = document.getElementById('lista-contas');
        listaContas.innerHTML = p.contas.map((c, i) => {
            let saldoConta = c.saldoInicial;
            p.transacoes.forEach(t => {
                if (t.contaId === c.id) {
                    if (t.tipo === 'receita') saldoConta += t.valor;
                    if (t.tipo === 'despesa' || t.tipo === 'transferencia') saldoConta -= t.valor;
                }
                if (t.tipo === 'transferencia' && t.contaDestinoId === c.id) {
                    saldoConta += t.valor;
                }
            });
            return `
                <div class="card-premium rounded-2xl p-4 flex justify-between items-center" onclick="abrirTelaConta(${i})">
                    <div><p class="font-medium">${c.nome}</p><p class="text-[10px] text-gray-500 uppercase">${c.tipo}</p></div>
                    <p class="font-bold text-amber-400">${fmt(saldoConta)}</p>
                </div>
            `;
        }).join('') || '<p class="text-gray-500 text-center py-4">Nenhuma conta cadastrada</p>';

        const listaCartoes = document.getElementById('lista-cartoes');
        listaCartoes.innerHTML = p.cartoes.map((c, i) => `
            <div class="card-premium rounded-2xl p-4" onclick="abrirTelaCartao(${i})">
                <div class="flex justify-between items-center mb-2">
                    <p class="font-medium">${c.nome}</p>
                    <p class="text-xs text-gray-500">Fecha dia ${c.diaFechamento}</p>
                </div>
                <div class="flex justify-between text-xs mb-1">
                    <span class="text-gray-400">Utilizado: <span class="text-white">${fmt(c.utilizado)}</span></span>
                    <span class="text-gray-400">Limite: ${fmt(c.limite)}</span>
                </div>
                <div class="progress-bar"><div class="progress-fill bg-amber-500" style="width:${Math.min((c.utilizado/c.limite)*100, 100)}%"></div></div>
            </div>
        `).join('') || '<p class="text-gray-500 text-center py-4">Nenhum cartão cadastrado</p>';

        const listaTrans = document.getElementById('lista-transacoes');
        listaTrans.innerHTML = transMes.slice().reverse().map((t, i) => `
            <div class="card-premium rounded-xl p-3 flex justify-between items-center">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-lg flex items-center justify-center ${t.tipo==='receita'?'bg-green-500/20 text-green-400':'bg-red-500/20 text-red-400'}">
                        ${t.tipo==='receita'?'↑':'↓'}
                    </div>
                    <div>
                        <p class="text-sm font-medium">${t.descricao}</p>
                        <p class="text-[10px] text-gray-500">${new Date(t.data).toLocaleDateString('pt-BR')}</p>
                    </div>
                </div>
                <p class="text-sm font-bold ${t.tipo==='receita'?'text-green-400':'text-red-400'}">${t.tipo==='receita'?'+':'-'} ${fmt(t.valor)}</p>
            </div>
        `).join('') || '<p class="text-gray-500 text-center py-4">Sem transações este mês</p>';
    };

    window.mudarMes = function(delta) {
        mesRefPessoal += delta;
        if (mesRefPessoal > 11) { mesRefPessoal = 0; anoRefPessoal++; }
        if (mesRefPessoal < 0) { mesRefPessoal = 11; anoRefPessoal--; }
        renderPessoal();
    };

    window.switchTab = function(tab) {
        telaAtual = tab;
        document.getElementById('tab-pessoal').classList.toggle('hidden', tab !== 'pessoal');
        document.getElementById('tab-compartilhado').classList.toggle('hidden', tab !== 'compartilhado');
        document.getElementById('btn-pessoal').classList.toggle('tab-active', tab === 'pessoal');
        document.getElementById('btn-pessoal').classList.toggle('text-gray-400', tab !== 'pessoal');
        document.getElementById('btn-compartilhado').classList.toggle('tab-active', tab === 'compartilhado');
        document.getElementById('btn-compartilhado').classList.toggle('text-gray-400', tab !== 'compartilhado');
        if (tab === 'pessoal') renderPessoal();
        else renderCompart();
    };

    window.abrirTelaCartao = function(idx) {
      const cartao = perfil()?.cartoes[idx];
      if (!cartao) return;
      const pct = cartao.limite > 0 ? (cartao.utilizado / cartao.limite * 100) : 0;
      const cor = pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-yellow-500' : 'bg-emerald-500';
      const html = `
        <div class="space-y-4">
          <div class="glass rounded-2xl p-5">
            <h2 class="text-xl font-bold">${cartao.nome}</h2>
            <div class="grid grid-cols-2 gap-2 mt-2 text-[10px] text-gray-400 uppercase tracking-wider">
                <p>Fechamento: Dia ${cartao.diaFechamento}</p>
                <p>Vencimento: Dia ${cartao.diaVencimento}</p>
            </div>
            <div class="mt-4">
              <div class="flex justify-between text-sm mb-1"><span>Utilizado</span><span class="font-semibold text-amber-400">${fmt(cartao.utilizado)}</span></div>
              <div class="flex justify-between text-sm mb-2"><span>Disponível</span><span>${fmt(cartao.limite - cartao.utilizado)}</span></div>
              <div class="progress-bar"><div class="progress-fill ${cor}" style="width:${Math.min(pct,100)}%"></div></div>
            </div>
          </div>
          
          <div class="space-y-2">
            <div class="flex justify-between items-center px-1">
                <h3 class="text-lg font-semibold">Faturas</h3>
                <button onclick="openModal('transacao', null, null, ${cartao.id})" class="text-xs bg-amber-500 text-black px-3 py-1 rounded-full font-bold">+ Despesa</button>
            </div>
            <div class="card-premium rounded-2xl p-4 flex justify-between items-center">
                <div>
                    <p class="font-medium">Fatura Atual</p>
                    <p class="text-xs text-gray-500">Vence em ${cartao.diaVencimento}/${mesRefPessoal+1}</p>
                </div>
                <div class="text-right">
                    <p class="font-bold text-red-400">${fmt(cartao.utilizado)}</p>
                    <button onclick="pagarFatura(${idx})" class="text-[10px] bg-green-500/20 text-green-400 px-2 py-1 rounded-md mt-1">PAGAR</button>
                </div>
            </div>
          </div>
          
          <button onclick="voltarParaApp()" class="w-full glass py-3 rounded-xl text-gray-400 text-sm">Voltar</button>
        </div>
      `;
      document.getElementById('detalhe-conteudo').innerHTML = html;
      document.getElementById('app-abas').classList.add('hidden');
      document.getElementById('tela-detalhe').classList.remove('hidden');
      document.getElementById('barra-inferior').classList.add('hidden');
      document.getElementById('btn-voltar').classList.remove('hidden');
      telaAtual = 'detalhe-cartao';
    };

    window.voltarParaApp = function() {
        document.getElementById('app-abas').classList.remove('hidden');
        document.getElementById('tela-detalhe').classList.add('hidden');
        document.getElementById('barra-inferior').classList.remove('hidden');
        document.getElementById('btn-voltar').classList.add('hidden');
        telaAtual = 'pessoal';
        renderPessoal();
    };

    window.pagarFatura = function(idx) {
        const p = perfil();
        const cartao = p.cartoes[idx];
        if (cartao.utilizado <= 0) return alert('Não há valor para pagar');
        if (p.contas.length === 0) return alert('Crie uma conta primeiro');
        
        const contaId = p.contas[0].id;
        p.transacoes.push({
            id: Date.now(),
            tipo: 'despesa',
            descricao: `Pagamento Fatura: ${cartao.nome}`,
            valor: cartao.utilizado,
            data: new Date().toISOString().split('T')[0],
            contaId: contaId
        });
        cartao.utilizado = 0;
        salvarPessoal(); renderPessoal(); abrirTelaCartao(idx);
    };

    window.openModal = function(tipo, editIndex = null, contaPreSelecionada = null, cartaoPreSelecionado = null) {
      const modal = document.getElementById('modal');
      const content = document.getElementById('modal-content-inner');
      modal.classList.remove('hidden');
      if (tipo === 'conta') formConta(content, editIndex);
      else if (tipo === 'cartao') formCartao(content, editIndex);
      else if (tipo === 'pessoa') formPessoa(content, editIndex);
      else if (tipo === 'conta-compartilhada') formContaCompart(content, editIndex);
      else if (tipo === 'transacao') formTransacao(content, editIndex, contaPreSelecionada, cartaoPreSelecionado);
    };
    window.closeModal = function() { document.getElementById('modal').classList.add('hidden'); };

    // --- FORMULÁRIOS ---
    function formConta(content, editIndex) {
        const p = perfil();
        const c = editIndex !== null ? p.contas[editIndex] : { nome: '', tipo: 'corrente', saldoInicial: 0 };
        content.innerHTML = `
            <h3 class="text-lg font-bold mb-4">${editIndex !== null ? 'Editar' : 'Nova'} Conta</h3>
            <div class="space-y-3">
                <label class="text-xs text-gray-400">Nome da Conta</label>
                <input id="f-conta-nome" value="${c.nome}" placeholder="Ex: Nubank, Carteira" class="w-full p-3 rounded-xl">
                <label class="text-xs text-gray-400">Tipo</label>
                <select id="f-conta-tipo" class="w-full p-3 rounded-xl">
                    <option value="corrente" ${c.tipo==='corrente'?'selected':''}>Corrente</option>
                    <option value="poupanca" ${c.tipo==='poupanca'?'selected':''}>Poupança</option>
                    <option value="investimento" ${c.tipo==='investimento'?'selected':''}>Investimento</option>
                    <option value="dinheiro" ${c.tipo==='dinheiro'?'selected':''}>Dinheiro</option>
                </select>
                <label class="text-xs text-gray-400">Saldo Inicial</label>
                <input id="f-conta-saldo" type="number" step="0.01" value="${c.saldoInicial}" class="w-full p-3 rounded-xl">
                <button onclick="salvarConta(${editIndex})" class="w-full bg-amber-500 text-black font-bold py-3 rounded-xl mt-2">Salvar</button>
            </div>
        `;
    }
    window.salvarConta = function(idx) {
        const p = perfil();
        const nome = document.getElementById('f-conta-nome').value;
        const tipo = document.getElementById('f-conta-tipo').value;
        const saldo = parseFloat(document.getElementById('f-conta-saldo').value) || 0;
        if (!nome) return;
        if (idx !== null) p.contas[idx] = { ...p.contas[idx], nome, tipo, saldoInicial: saldo };
        else p.contas.push({ id: Date.now(), nome, tipo, saldoInicial: saldo });
        salvarPessoal(); renderPessoal(); closeModal();
    };

    function formCartao(content, editIndex) {
        const p = perfil();
        const c = editIndex !== null ? p.cartoes[editIndex] : { nome: '', limite: 0, diaFechamento: 1, diaVencimento: 10, utilizado: 0 };
        content.innerHTML = `
            <h3 class="text-lg font-bold mb-4">Novo Cartão</h3>
            <div class="space-y-3">
                <label class="text-xs text-gray-400">Nome do Cartão</label>
                <input id="f-cartao-nome" value="${c.nome}" placeholder="Ex: Visa, Master" class="w-full p-3 rounded-xl">
                <label class="text-xs text-gray-400">Limite</label>
                <input id="f-cartao-limite" type="number" step="0.01" value="${c.limite}" class="w-full p-3 rounded-xl">
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="text-xs text-gray-400">Dia Fechamento</label>
                        <input id="f-cartao-fecha" type="number" value="${c.diaFechamento}" class="w-full p-3 rounded-xl">
                    </div>
                    <div>
                        <label class="text-xs text-gray-400">Dia Vencimento</label>
                        <input id="f-cartao-vence" type="number" value="${c.diaVencimento}" class="w-full p-3 rounded-xl">
                    </div>
                </div>
                <button onclick="salvarCartao(${editIndex})" class="w-full bg-amber-500 text-black font-bold py-3 rounded-xl mt-2">Salvar</button>
            </div>
        `;
    }
    window.salvarCartao = function(idx) {
        const p = perfil();
        const nome = document.getElementById('f-cartao-nome').value;
        const limite = parseFloat(document.getElementById('f-cartao-limite').value) || 0;
        const diaFechamento = parseInt(document.getElementById('f-cartao-fecha').value) || 1;
        const diaVencimento = parseInt(document.getElementById('f-cartao-vence').value) || 10;
        if (!nome) return;
        if (idx !== null) p.cartoes[idx] = { ...p.cartoes[idx], nome, limite, diaFechamento, diaVencimento };
        else p.cartoes.push({ id: Date.now(), nome, limite, diaFechamento, diaVencimento, utilizado: 0 });
        salvarPessoal(); renderPessoal(); closeModal();
    };

    function formTransacao(content, editIndex, contaPre, cartaoPre) {
        const p = perfil();
        const t = editIndex !== null ? p.transacoes[editIndex] : { tipo: cartaoPre ? 'cartao' : 'despesa', valor: 0, descricao: '', data: new Date().toISOString().split('T')[0], contaId: contaPre || (p.contas[0]?.id || ''), recorrencia: 'nenhuma' };
        content.innerHTML = `
            <h3 class="text-lg font-bold mb-4">Nova Transação</h3>
            <div class="space-y-3">
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="text-xs text-gray-400">Tipo</label>
                        <select id="f-trans-tipo" class="w-full p-3 rounded-xl" onchange="toggleTransDestino()">
                            <option value="despesa" ${t.tipo==='despesa'?'selected':''}>Despesa</option>
                            <option value="receita" ${t.tipo==='receita'?'selected':''}>Receita</option>
                            <option value="transferencia" ${t.tipo==='transferencia'?'selected':''}>Transferência</option>
                            <option value="cartao" ${t.tipo==='cartao'?'selected':''}>Cartão de Crédito</option>
                        </select>
                    </div>
                    <div>
                        <label class="text-xs text-gray-400">Recorrência</label>
                        <select id="f-trans-recorrencia" class="w-full p-3 rounded-xl" onchange="toggleParcelas()">
                            <option value="nenhuma">Nenhuma</option>
                            <option value="mensal">Mensal</option>
                            <option value="semanal">Semanal</option>
                            <option value="quinzenal">Quinzenal</option>
                            <option value="parcelado">Parcelado</option>
                        </select>
                    </div>
                </div>
                <div id="f-trans-parcelas-group" class="hidden">
                    <label class="text-xs text-gray-400">Número de Parcelas</label>
                    <input id="f-trans-parcelas-num" type="number" value="1" class="w-full p-3 rounded-xl">
                </div>
                <label class="text-xs text-gray-400">Descrição</label>
                <input id="f-trans-desc" value="${t.descricao}" placeholder="Ex: Aluguel, Salário" class="w-full p-3 rounded-xl">
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="text-xs text-gray-400">Valor Total</label>
                        <input id="f-trans-valor" type="number" step="0.01" value="${t.valor}" class="w-full p-3 rounded-xl">
                    </div>
                    <div>
                        <label class="text-xs text-gray-400">Data</label>
                        <input id="f-trans-data" type="date" value="${t.data}" class="w-full p-3 rounded-xl">
                    </div>
                </div>
                <div id="f-trans-conta-group">
                    <label class="text-xs text-gray-400">Conta</label>
                    <select id="f-trans-conta" class="w-full p-3 rounded-xl">
                        ${p.contas.map(c => `<option value="${c.id}" ${c.id==t.contaId?'selected':''}>${c.nome}</option>`).join('')}
                    </select>
                </div>
                <div id="f-trans-cartao-group" class="hidden">
                    <label class="text-xs text-gray-400">Selecionar Cartão</label>
                    <select id="f-trans-cartao" class="w-full p-3 rounded-xl">
                        ${p.cartoes.map(c => `<option value="${c.id}" ${c.id==cartaoPre?'selected':''}>${c.nome}</option>`).join('')}
                    </select>
                </div>
                <div id="f-trans-dest-group" class="hidden">
                    <label class="text-xs text-gray-400">Conta Destino</label>
                    <select id="f-trans-conta-dest" class="w-full p-3 rounded-xl">
                        ${p.contas.map(c => `<option value="${c.id}">${c.nome}</option>`).join('')}
                    </select>
                </div>
                <button onclick="salvarTransacao()" class="w-full bg-amber-500 text-black font-bold py-3 rounded-xl mt-2">Salvar</button>
            </div>
        `;
        window.toggleTransDestino = function() {
            const tipo = document.getElementById('f-trans-tipo').value;
            document.getElementById('f-trans-dest-group').classList.toggle('hidden', tipo !== 'transferencia');
            document.getElementById('f-trans-conta-group').classList.toggle('hidden', tipo === 'cartao');
            document.getElementById('f-trans-cartao-group').classList.toggle('hidden', tipo !== 'cartao');
        };
        window.toggleParcelas = function() {
            const rec = document.getElementById('f-trans-recorrencia').value;
            document.getElementById('f-trans-parcelas-group').classList.toggle('hidden', rec !== 'parcelado');
        };
        setTimeout(() => { toggleTransDestino(); toggleParcelas(); }, 0);
    }

    window.salvarTransacao = function() {
        const p = perfil();
        const tipo = document.getElementById('f-trans-tipo').value;
        const recorrencia = document.getElementById('f-trans-recorrencia').value;
        const descricao = document.getElementById('f-trans-desc').value;
        const valorTotal = parseFloat(document.getElementById('f-trans-valor').value) || 0;
        const dataStr = document.getElementById('f-trans-data').value;
        
        if (!descricao || valorTotal <= 0) return alert('Preencha os campos corretamente');

        if (tipo === 'cartao') {
            const cartaoId = parseInt(document.getElementById('f-trans-cartao').value);
            const cartaoIdx = p.cartoes.findIndex(c => c.id === cartaoId);
            const cartao = p.cartoes[cartaoIdx];
            const isParcelado = recorrencia === 'parcelado';
            const numParcelas = isParcelado ? (parseInt(document.getElementById('f-trans-parcelas-num').value) || 1) : 1;
            const valorParcela = valorTotal / numParcelas;
            
            cartao.utilizado += valorTotal;
            
            const dataBase = new Date(dataStr + 'T00:00:00');
            for (let i = 0; i < numParcelas; i++) {
                const novaData = new Date(dataBase);
                novaData.setMonth(dataBase.getMonth() + i);
                p.transacoes.push({
                    id: Date.now() + i,
                    tipo: 'despesa-cartao',
                    descricao: isParcelado ? `${descricao} (${i+1}/${numParcelas})` : descricao,
                    valor: valorParcela,
                    data: novaData.toISOString().split('T')[0],
                    cartaoId: cartaoId
                });
            }
        } else {
            const contaId = parseInt(document.getElementById('f-trans-conta').value);
            const contaDestinoId = tipo === 'transferencia' ? parseInt(document.getElementById('f-trans-conta-dest').value) : null;
            
            if (recorrencia !== 'nenhuma') {
                const isParcelado = recorrencia === 'parcelado';
                const numCiclos = isParcelado ? (parseInt(document.getElementById('f-trans-parcelas-num').value) || 1) : 24;
                const valorCiclo = isParcelado ? (valorTotal / numCiclos) : valorTotal;
                const dataBase = new Date(dataStr + 'T00:00:00');
                
                for (let i = 0; i < numCiclos; i++) {
                    const novaData = new Date(dataBase);
                    if (recorrencia === 'semanal') novaData.setDate(dataBase.getDate() + (i * 7));
                    else if (recorrencia === 'quinzenal') novaData.setDate(dataBase.getDate() + (i * 15));
                    else novaData.setMonth(dataBase.getMonth() + i);
                    
                    p.transacoes.push({
                        id: Date.now() + i,
                        tipo,
                        descricao: isParcelado ? `${descricao} (${i+1}/${numCiclos})` : descricao,
                        valor: valorCiclo,
                        data: novaData.toISOString().split('T')[0],
                        contaId,
                        contaDestinoId
                    });
                }
            } else {
                p.transacoes.push({ id: Date.now(), tipo, descricao, valor: valorTotal, data: dataStr, contaId, contaDestinoId });
            }
        }
        
        salvarPessoal(); renderPessoal(); closeModal();
        if (telaAtual === 'detalhe-cartao') {
            const cartaoId = parseInt(document.getElementById('f-trans-cartao')?.value);
            if (cartaoId) {
                const idx = p.cartoes.findIndex(c => c.id === cartaoId);
                if (idx !== -1) abrirTelaCartao(idx);
            }
        }
    };

    // --- COMPARTILHADO ---
    function renderCompart() {
        document.getElementById('mes-referencia-compart').textContent = nomeMesAno(mesRefCompart, anoRefCompart);
        document.getElementById('mes-atual-compart').textContent = nomeMesAno(mesRefCompart, anoRefCompart);
        
        const contasMes = dadosCompart.contas.filter(c => {
            const d = new Date(c.data);
            return d.getMonth() === mesRefCompart && d.getFullYear() === anoRefCompart;
        });

        const resumo = document.getElementById('resumo-mensal-compart');
        const totalDespesas = contasMes.reduce((s, c) => s + c.valor, 0);
        const totalSalarios = dadosCompart.pessoas.reduce((s, p) => s + (p.salario || 0), 0);
        
        let rateioHtml = `<div class="flex justify-between mb-2 border-b border-white/5 pb-2"><span>Total Despesas:</span><span class="font-bold text-amber-400">${fmt(totalDespesas)}</span></div>`;
        
        if (dadosCompart.pessoas.length > 0 && totalSalarios > 0) {
            dadosCompart.pessoas.forEach(p => {
                const percentual = (p.salario || 0) / totalSalarios;
                const valorDevido = totalDespesas * percentual;
                rateioHtml += `
                    <div class="flex justify-between text-xs py-1">
                        <span class="text-gray-400">${p.nome} (${(percentual * 100).toFixed(1)}%):</span>
                        <span class="font-medium text-white">${fmt(valorDevido)}</span>
                    </div>
                `;
            });
        }
        resumo.innerHTML = rateioHtml;

        const listaPessoas = document.getElementById('lista-pessoas');
        listaPessoas.innerHTML = dadosCompart.pessoas.map((p, i) => `
            <div class="card-premium rounded-xl p-3 flex justify-between items-center">
                <div>
                    <p class="font-medium">${p.nome}</p>
                    <p class="text-[10px] text-gray-500">Salário: ${fmt(p.salario || 0)}</p>
                </div>
                <button onclick="excluirPessoa(${i})" class="text-red-400 text-xs">✕</button>
            </div>
        `).join('') || '<p class="text-gray-500 text-center py-2">Nenhuma pessoa</p>';

        const listaContasComp = document.getElementById('lista-contas-compartilhadas');
        listaContasComp.innerHTML = contasMes.map((c, i) => {
            const originalIdx = dadosCompart.contas.findIndex(dc => dc.id === c.id);
            return `
                <div class="card-premium rounded-xl p-3 flex justify-between items-center ${c.pago ? 'opacity-50' : ''}">
                    <div class="flex items-center gap-3">
                        <input type="checkbox" ${c.pago ? 'checked' : ''} onchange="togglePagoContaCompart(${originalIdx})" class="w-5 h-5 rounded-lg border-white/10 bg-white/5 text-amber-500">
                        <div>
                            <p class="font-medium ${c.pago ? 'line-through text-gray-500' : ''}">${c.descricao}</p>
                            <p class="text-xs text-gray-500">${fmt(c.valor)}</p>
                        </div>
                    </div>
                    <button onclick="excluirContaCompart(${originalIdx})" class="text-red-400 text-xs">✕</button>
                </div>
            `;
        }).join('') || '<p class="text-gray-500 text-center py-2">Nenhuma conta este mês</p>';
    }
    
    window.togglePagoContaCompart = function(idx) {
        dadosCompart.contas[idx].pago = !dadosCompart.contas[idx].pago;
        salvarCompart(); renderCompart();
    };

    window.mudarMesComp = function(delta) {
        mesRefCompart += delta;
        if (mesRefCompart > 11) { mesRefCompart = 0; anoRefCompart++; }
        if (mesRefCompart < 0) { mesRefCompart = 11; anoRefCompart--; }
        renderCompart();
    };

    function formPessoa(content, editIndex) {
        content.innerHTML = `
            <h3 class="text-lg font-bold mb-4">Nova Pessoa</h3>
            <div class="space-y-3">
                <label class="text-xs text-gray-400">Nome</label>
                <input id="f-p-nome" placeholder="Nome" class="w-full p-3 rounded-xl">
                <label class="text-xs text-gray-400">Salário</label>
                <input id="f-p-salario" type="number" step="0.01" placeholder="0,00" class="w-full p-3 rounded-xl">
                <button onclick="salvarPessoa()" class="w-full bg-amber-500 text-black font-bold py-3 rounded-xl mt-2">Salvar</button>
            </div>
        `;
    }
    window.salvarPessoa = function() {
        const nome = document.getElementById('f-p-nome').value;
        const salario = parseFloat(document.getElementById('f-p-salario').value) || 0;
        if (!nome) return;
        dadosCompart.pessoas.push({ nome, salario });
        salvarCompart(); renderCompart(); closeModal();
    };

    function formContaCompart(content, editIndex) {
        content.innerHTML = `
            <h3 class="text-lg font-bold mb-4">Nova Conta Compartilhada</h3>
            <div class="space-y-3">
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="text-xs text-gray-400">Tipo</label>
                        <select id="f-comp-tipo" class="w-full p-3 rounded-xl">
                            <option value="despesa">Despesa</option>
                            <option value="receita">Receita</option>
                        </select>
                    </div>
                    <div>
                        <label class="text-xs text-gray-400">Recorrência</label>
                        <select id="f-comp-recorrencia" class="w-full p-3 rounded-xl">
                            <option value="nenhuma">Nenhuma</option>
                            <option value="mensal">Mensal</option>
                        </select>
                    </div>
                </div>
                <label class="text-xs text-gray-400">Descrição</label>
                <input id="f-comp-desc" placeholder="Ex: Mercado, Aluguel" class="w-full p-3 rounded-xl">
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="text-xs text-gray-400">Valor Total</label>
                        <input id="f-comp-valor" type="number" step="0.01" placeholder="0,00" class="w-full p-3 rounded-xl">
                    </div>
                    <div>
                        <label class="text-xs text-gray-400">Data</label>
                        <input id="f-comp-data" type="date" value="${new Date().toISOString().split('T')[0]}" class="w-full p-3 rounded-xl">
                    </div>
                </div>
                <button onclick="salvarContaComp()" class="w-full bg-amber-500 text-black font-bold py-3 rounded-xl mt-2">Salvar</button>
            </div>
        `;
    }
    window.salvarContaComp = function() {
        const tipo = document.getElementById('f-comp-tipo').value;
        const recorrencia = document.getElementById('f-comp-recorrencia').value;
        const descricao = document.getElementById('f-comp-desc').value;
        const valorTotal = parseFloat(document.getElementById('f-comp-valor').value) || 0;
        const dataStr = document.getElementById('f-comp-data').value;
        if (!descricao || valorTotal <= 0) return;
        const valorFinal = tipo === 'receita' ? -valorTotal : valorTotal;
        if (recorrencia === 'mensal') {
            const dataBase = new Date(dataStr + 'T00:00:00');
            for (let i = 0; i < 24; i++) {
                const novaData = new Date(dataBase);
                novaData.setMonth(dataBase.getMonth() + i);
                dadosCompart.contas.push({ id: Date.now() + i, descricao, valor: valorFinal, data: novaData.toISOString().split('T')[0], pago: false });
            }
        } else {
            dadosCompart.contas.push({ id: Date.now(), descricao, valor: valorFinal, data: dataStr, pago: false });
        }
        salvarCompart(); renderCompart(); closeModal();
    };

    window.excluirPessoa = function(i) { dadosCompart.pessoas.splice(i, 1); salvarCompart(); renderCompart(); };
    window.excluirContaCompart = function(i) { dadosCompart.contas.splice(i, 1); salvarCompart(); renderCompart(); };

    // Início
    renderLogin();
})();
