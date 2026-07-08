(function() {
    // ========== ESTADO GLOBAL ==========
    const STORAGE_PESSOAL = 'gatogordo_pessoal_v6';
    const STORAGE_COMPART = 'gatogordo_compart_v6';

    let dadosPessoal = { perfis: {} };  // { nome: { contas, cartoes, transacoes, senha } }
    let perfilAtivo = null;
    let dadosCompart = { pessoas: [], contas: [] };

    let mesRefPessoal = new Date().getMonth();
    let anoRefPessoal = new Date().getFullYear();
    let mesRefCompart = new Date().getMonth();
    let anoRefCompart = new Date().getFullYear();

    let telaAtual = 'login'; // 'login', 'app', 'extrato-conta', 'detalhe-cartao'

    const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
    const dt = (iso) => iso ? new Date(iso).toLocaleDateString('pt-BR', { day:'2-digit', month:'short' }) : '';
    const hoje = new Date();
    const nomeMesAno = (m, a) => new Date(a, m).toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

    function carregarDados() {
      try {
        const p = localStorage.getItem(STORAGE_PESSOAL);
        if (p) dadosPessoal = JSON.parse(p);
        if (!dadosPessoal.perfis) dadosPessoal.perfis = {};
        const c = localStorage.getItem(STORAGE_COMPART);
        if (c) dadosCompart = JSON.parse(c);
      } catch(e) {}
    }
    function salvarPessoal() { localStorage.setItem(STORAGE_PESSOAL, JSON.stringify(dadosPessoal)); }
    function salvarCompart() { localStorage.setItem(STORAGE_COMPART, JSON.stringify(dadosCompart)); }

    function perfil() { return perfilAtivo ? dadosPessoal.perfis[perfilAtivo] : null; }

    // ========== ÍCONE ==========
    function gerarIcone() {
      const canvas = document.createElement('canvas');
      canvas.width = 180;
      canvas.height = 180;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0,0,180,180);
      ctx.beginPath();
      ctx.arc(90, 90, 80, 0, Math.PI*2);
      ctx.fillStyle = '#F97316';
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(40, 45); ctx.lineTo(55, 10); ctx.lineTo(75, 40); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(140, 45); ctx.lineTo(125, 10); ctx.lineTo(105, 40); ctx.fill();
      ctx.beginPath(); ctx.arc(60, 70, 14, 0, Math.PI*2); ctx.fillStyle = '#fff'; ctx.fill();
      ctx.beginPath(); ctx.arc(120, 70, 14, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(62, 70, 6, 0, Math.PI*2); ctx.fillStyle = '#000'; ctx.fill();
      ctx.beginPath(); ctx.arc(118, 70, 6, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(90, 100, 16, 12, 0, 0, Math.PI*2); ctx.fillStyle = '#fff'; ctx.fill();
      ctx.beginPath(); ctx.ellipse(90, 96, 4, 3, 0, 0, Math.PI*2); ctx.fillStyle = '#F97316'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(78, 106); ctx.quadraticCurveTo(90, 118, 102, 106); ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(45, 90); ctx.lineTo(15, 82); ctx.moveTo(45, 100); ctx.lineTo(15, 100); ctx.moveTo(45, 110); ctx.lineTo(15, 118); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(135, 90); ctx.lineTo(165, 82); ctx.moveTo(135, 100); ctx.lineTo(165, 100); ctx.moveTo(135, 110); ctx.lineTo(165, 118); ctx.stroke();
      ctx.font = 'bold 34px "Plus Jakarta Sans"'; ctx.fillStyle = '#FBBF24'; ctx.textAlign = 'center'; ctx.fillText('$', 90, 150);
      ctx.beginPath(); ctx.ellipse(68, 140, 10, 8, 0, 0, Math.PI*2); ctx.fillStyle = '#F97316'; ctx.fill();
      ctx.beginPath(); ctx.ellipse(112, 140, 10, 8, 0, 0, Math.PI*2); ctx.fill();
      const png = canvas.toDataURL('image/png');
      const favicon = document.getElementById('favicon');
      const appleIcon = document.getElementById('apple-touch-icon');
      if (favicon) favicon.href = png;
      if (appleIcon) appleIcon.href = png;
    }

    // ========== LOGIN ==========
    function mostrarLogin() {
      telaAtual = 'login';
      document.getElementById('app-container').classList.add('hidden');
      document.getElementById('login-screen').classList.remove('hidden');
      renderizarLogin();
    }

    function renderizarLogin() {
      const formDiv = document.getElementById('login-form');
      const perfis = Object.keys(dadosPessoal.perfis);
      if (perfis.length === 0) {
        formDiv.innerHTML = `
          <p class="text-sm text-gray-300 mb-3">Crie seu perfil para começar</p>
          <input id="login-nome" placeholder="Nome do perfil" class="w-full p-3 rounded-xl mb-2 text-sm">
          <input id="login-senha" type="password" placeholder="Senha" class="w-full p-3 rounded-xl mb-3 text-sm">
          <button onclick="criarPerfilLogin()" class="w-full bg-amber-500 text-black font-semibold py-3 rounded-xl text-sm">Criar perfil</button>
        `;
      } else {
        let botoesPerfis = perfis.map(nome => `<button onclick="selecionarPerfilLogin('${nome}')" class="w-full glass rounded-xl p-3 text-left hover:bg-white/5 transition text-sm">${nome}</button>`).join('');
        formDiv.innerHTML = `
          <p class="text-sm text-gray-300 mb-2">Selecione o perfil</p>
          <div class="space-y-2 mb-4">${botoesPerfis}</div>
          <div id="senha-group" class="hidden">
            <input id="login-senha" type="password" placeholder="Senha" class="w-full p-3 rounded-xl mb-2 text-sm">
            <p id="login-erro" class="text-red-400 text-xs mb-2 hidden">Senha incorreta</p>
            <button onclick="entrarPerfil()" class="w-full bg-amber-500 text-black font-semibold py-3 rounded-xl text-sm">Entrar</button>
          </div>
          <p class="text-xs text-gray-400 mt-3">ou</p>
          <button onclick="mostrarCriacaoPerfil()" class="w-full bg-amber-500/20 text-amber-400 py-3 rounded-xl text-sm mt-2">Criar novo perfil</button>
        `;
      }
    }

    window.selecionarPerfilLogin = function(nome) {
      window.perfilSelecionado = nome;
      document.getElementById('senha-group').classList.remove('hidden');
      document.getElementById('login-senha').focus();
    };

    window.mostrarCriacaoPerfil = function() {
      const formDiv = document.getElementById('login-form');
      formDiv.innerHTML = `
        <p class="text-sm text-gray-300 mb-3">Novo perfil</p>
        <input id="login-nome" placeholder="Nome do perfil" class="w-full p-3 rounded-xl mb-2 text-sm">
        <input id="login-senha" type="password" placeholder="Senha" class="w-full p-3 rounded-xl mb-3 text-sm">
        <button onclick="criarPerfilLogin()" class="w-full bg-amber-500 text-black font-semibold py-3 rounded-xl text-sm">Criar e entrar</button>
        <button onclick="renderizarLogin()" class="w-full text-gray-400 text-sm mt-2">Voltar</button>
      `;
    };

    window.entrarPerfil = function() {
      const nome = window.perfilSelecionado;
      const senha = document.getElementById('login-senha').value;
      const perfilData = dadosPessoal.perfis[nome];
      if (!perfilData || perfilData.senha !== senha) {
        document.getElementById('login-erro').classList.remove('hidden');
        return;
      }
      perfilAtivo = nome;
      document.getElementById('login-screen').classList.add('hidden');
      document.getElementById('app-container').classList.remove('hidden');
      telaAtual = 'app';
      renderizarApp();
    };

    window.criarPerfilLogin = function() {
      const nome = document.getElementById('login-nome').value.trim();
      const senha = document.getElementById('login-senha').value;
      if (!nome || !senha) return alert('Preencha todos os campos.');
      if (dadosPessoal.perfis[nome]) return alert('Perfil já existe.');
      dadosPessoal.perfis[nome] = { contas: [], cartoes: [], transacoes: [], senha: senha.trim() };
      salvarPessoal();
      perfilAtivo = nome;
      document.getElementById('login-screen').classList.add('hidden');
      document.getElementById('app-container').classList.remove('hidden');
      telaAtual = 'app';
      renderizarApp();
    };

    window.logout = function() {
      perfilAtivo = null;
      mostrarLogin();
    };

    function saldoConta(contaId) {
      const p = perfil();
      if (!p) return 0;
      const conta = p.contas.find(c => c.id === contaId);
      if (!conta) return 0;
      let saldo = conta.saldoInicial || 0;
      p.transacoes.forEach(t => {
        if (t.tipo === 'receita' && t.contaId === contaId) saldo += t.valor;
        if (t.tipo === 'despesa' && t.contaId === contaId) saldo -= t.valor;
        if (t.tipo === 'transferencia') {
          if (t.contaId === contaId) saldo -= t.valor;
          if (t.contaDestinoId === contaId) saldo += t.valor;
        }
      });
      return saldo;
    }

    function resumoMensal() {
      let rec = 0, desp = 0;
      perfil()?.transacoes.forEach(t => {
        const d = new Date(t.data);
        if (d.getMonth() === mesRefPessoal && d.getFullYear() === anoRefPessoal) {
          if (t.tipo === 'receita') rec += t.valor;
          else if (t.tipo === 'despesa') desp += t.valor;
        }
      });
      return { receitas: rec, despesas: desp, saldo: rec - desp };
    }

    function renderizarApp() {
      document.getElementById('app-abas').classList.remove('hidden');
      document.getElementById('tela-detalhe').classList.add('hidden');
      document.getElementById('barra-inferior').classList.remove('hidden');
      document.getElementById('btn-voltar').classList.add('hidden');
      renderPessoal();
      renderCompart();
      switchTab('pessoal');
    }

    window.voltarParaApp = function() {
      telaAtual = 'app';
      document.getElementById('app-abas').classList.remove('hidden');
      document.getElementById('tela-detalhe').classList.add('hidden');
      document.getElementById('barra-inferior').classList.remove('hidden');
      document.getElementById('btn-voltar').classList.add('hidden');
    };

    window.switchTab = function(tab) {
      if (telaAtual !== 'app') return;
      document.getElementById('tab-pessoal').classList.toggle('hidden', tab !== 'pessoal');
      document.getElementById('tab-compartilhado').classList.toggle('hidden', tab !== 'compartilhado');
      document.getElementById('btn-pessoal').classList.toggle('tab-active', tab === 'pessoal');
      document.getElementById('btn-pessoal').classList.toggle('text-gray-400', tab !== 'pessoal');
      document.getElementById('btn-compartilhado').classList.toggle('tab-active', tab === 'compartilhado');
      document.getElementById('btn-compartilhado').classList.toggle('text-gray-400', tab !== 'compartilhado');
    };

    window.mudarMes = function(delta) {
      mesRefPessoal += delta;
      if (mesRefPessoal < 0) { mesRefPessoal = 11; anoRefPessoal--; }
      else if (mesRefPessoal > 11) { mesRefPessoal = 0; anoRefPessoal++; }
      renderPessoal();
    };
    window.mudarMesComp = function(delta) {
      mesRefCompart += delta;
      if (mesRefCompart < 0) { mesRefCompart = 11; anoRefCompart--; }
      else if (mesRefCompart > 11) { mesRefCompart = 0; anoRefCompart++; }
      renderCompart();
    };

    function renderPessoal() {
      const p = perfil();
      if (!p) return;
      document.getElementById('mes-referencia-pessoal').textContent = nomeMesAno(mesRefPessoal, anoRefPessoal);
      document.getElementById('mes-atual-pessoal').textContent = nomeMesAno(mesRefPessoal, anoRefPessoal);
      const { receitas, despesas, saldo } = resumoMensal();
      document.getElementById('resumo-receitas-mes').textContent = fmt(receitas);
      document.getElementById('resumo-despesas-mes').textContent = fmt(despesas);
      document.getElementById('resumo-saldo-mes').textContent = fmt(saldo);
      const patrimonio = p.contas.reduce((s, c) => s + saldoConta(c.id), 0);
      document.getElementById('patrimonio-total').textContent = fmt(patrimonio);

      const listaContas = document.getElementById('lista-contas');
      listaContas.innerHTML = p.contas.map((c, i) => `
        <div class="card-premium rounded-2xl p-4 flex justify-between items-center cursor-pointer" onclick="abrirTelaConta(${i})">
          <div><p class="font-medium">${c.nome}</p><p class="text-xs text-gray-400">${c.tipo}</p></div>
          <div class="flex items-center gap-3">
            <span class="font-semibold text-amber-400">${fmt(saldoConta(c.id))}</span>
            <button onclick="event.stopPropagation(); openModal('conta', ${i})" class="text-gray-400 text-xs">✎</button>
            <button onclick="event.stopPropagation(); excluirConta(${i})" class="text-red-400 text-xs">✕</button>
          </div>
        </div>
      `).join('') || '<p class="text-gray-500 text-center py-4">Nenhuma conta</p>';

      const listaCartoes = document.getElementById('lista-cartoes');
      listaCartoes.innerHTML = p.cartoes.map((c, i) => {
        const pct = c.limite > 0 ? (c.utilizado / c.limite * 100) : 0;
        const cor = pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-yellow-500' : 'bg-emerald-500';
        return `
          <div class="card-premium rounded-2xl p-4 cursor-pointer" onclick="abrirTelaCartao(${i})">
            <div class="flex justify-between"><div><p class="font-medium">${c.nome}</p><p class="text-xs text-gray-400">Fecha ${c.fechamento?dt(c.fechamento):'n/d'}</p></div>
            <div class="flex gap-2"><button onclick="event.stopPropagation(); openModal('cartao', ${i})" class="text-gray-400 text-xs">✎</button><button onclick="event.stopPropagation(); excluirCartao(${i})" class="text-red-400 text-xs">✕</button></div></div>
            <div class="flex justify-between text-sm mb-2"><span>Utilizado: <strong class="text-amber-400">${fmt(c.utilizado)}</strong></span><span>Limite: ${fmt(c.limite)}</span></div>
            <div class="progress-bar"><div class="progress-fill ${cor}" style="width:${Math.min(pct,100)}%"></div></div>
          </div>`;
      }).join('') || '<p class="text-gray-500 text-center py-4">Nenhum cartão</p>';

      const transacoesGeral = p.transacoes.filter(t => {
        const d = new Date(t.data);
        return d.getMonth() === mesRefPessoal && d.getFullYear() === anoRefPessoal;
      }).sort((a,b) => new Date(b.data) - new Date(a.data)).slice(0, 10);
      const listaTransacoes = document.getElementById('lista-transacoes');
      listaTransacoes.innerHTML = transacoesGeral.map(t => {
        const sinal = t.tipo === 'receita' ? '+' : t.tipo === 'despesa' ? '-' : '↔';
        const cor = t.tipo === 'receita' ? 'text-green-400' : t.tipo === 'despesa' ? 'text-red-400' : 'text-blue-400';
        const contaNome = p.contas.find(c => c.id === t.contaId)?.nome || '';
        const detalhe = t.tipo === 'transferencia' ? `${contaNome} → ${p.contas.find(c => c.id === t.contaDestinoId)?.nome || ''}` : contaNome;
        return `
          <div class="card-premium rounded-xl p-3 flex justify-between items-center text-sm">
            <div><p class="font-medium">${t.descricao}</p><p class="text-xs text-gray-500">${dt(t.data)} • ${detalhe}</p></div>
            <div class="flex items-center gap-2"><span class="font-semibold ${cor}">${sinal} ${fmt(t.valor)}</span></div>
          </div>`;
      }).join('') || '<p class="text-gray-500 text-center py-2">Nenhuma transação</p>';
    }

    window.abrirTelaConta = function(idx) {
      const conta = perfil()?.contas[idx];
      if (!conta) return;
      const transacoes = perfil().transacoes.filter(t => t.contaId === conta.id || t.contaDestinoId === conta.id);
      const html = `
        <div class="space-y-4">
          <div class="glass rounded-2xl p-5">
            <h2 class="text-xl font-bold">${conta.nome}</h2>
            <p class="text-gray-400 text-sm capitalize">${conta.tipo}</p>
            <p class="text-3xl font-bold text-amber-400 mt-2">${fmt(saldoConta(conta.id))}</p>
          </div>
          <button onclick="voltarParaApp(); openModal('transacao', null, ${conta.id})" class="w-full bg-amber-500 text-black font-semibold py-3 rounded-xl">+ Nova transação</button>
          <div class="space-y-2">
            <h3 class="text-lg font-semibold">Extrato</h3>
            ${transacoes.sort((a,b) => new Date(b.data)-new Date(a.data)).map(t => {
              const sinal = t.tipo === 'receita' ? '+' : t.tipo === 'despesa' ? '-' : t.tipo === 'transferencia' && t.contaDestinoId === conta.id ? '+' : '-';
              const cor = sinal === '+' ? 'text-green-400' : 'text-red-400';
              return '<div class="card-premium rounded-xl p-3 flex justify-between text-sm"><div><p>'+t.descricao+'</p><p class="text-xs text-gray-500">'+dt(t.data)+'</p></div><span class="'+cor+' font-semibold">'+sinal+' '+fmt(t.valor)+'</span></div>';
            }).join('') || '<p class="text-gray-500 text-center">Sem movimentações</p>'}
          </div>
        </div>
      `;
      document.getElementById('detalhe-conteudo').innerHTML = html;
      document.getElementById('app-abas').classList.add('hidden');
      document.getElementById('tela-detalhe').classList.remove('hidden');
      document.getElementById('barra-inferior').classList.add('hidden');
      document.getElementById('btn-voltar').classList.remove('hidden');
      telaAtual = 'extrato-conta';
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
            <p class="text-gray-400 text-sm">Fecha ${cartao.fechamento ? dt(cartao.fechamento) : 'n/d'}</p>
            <div class="mt-4">
              <div class="flex justify-between text-sm mb-1"><span>Utilizado</span><span class="font-semibold text-amber-400">${fmt(cartao.utilizado)}</span></div>
              <div class="flex justify-between text-sm mb-2"><span>Limite</span><span>${fmt(cartao.limite)}</span></div>
              <div class="progress-bar"><div class="progress-fill ${cor}" style="width:${Math.min(pct,100)}%"></div></div>
            </div>
          </div>
          <button onclick="voltarParaApp()" class="w-full glass py-2 rounded-xl text-gray-300">Voltar</button>
        </div>
      `;
      document.getElementById('detalhe-conteudo').innerHTML = html;
      document.getElementById('app-abas').classList.add('hidden');
      document.getElementById('tela-detalhe').classList.remove('hidden');
      document.getElementById('barra-inferior').classList.add('hidden');
      document.getElementById('btn-voltar').classList.remove('hidden');
      telaAtual = 'detalhe-cartao';
    };

    window.openModal = function(tipo, editIndex = null, contaPreSelecionada = null) {
      const modal = document.getElementById('modal');
      const content = document.getElementById('modal-content-inner');
      modal.classList.remove('hidden');
      if (tipo === 'conta') formConta(content, editIndex);
      else if (tipo === 'cartao') formCartao(content, editIndex);
      else if (tipo === 'pessoa') formPessoa(content, editIndex);
      else if (tipo === 'conta-compartilhada') formContaCompart(content, editIndex);
      else if (tipo === 'transacao') formTransacao(content, editIndex, contaPreSelecionada);
    };
    window.closeModal = function() { document.getElementById('modal').classList.add('hidden'); };

    // --- FUNÇÕES DE FORMULÁRIO (A SEREM IMPLEMENTADAS) ---
    function formConta(content, editIndex) {
        const p = perfil();
        const c = editIndex !== null ? p.contas[editIndex] : { nome: '', tipo: 'corrente', saldoInicial: 0 };
        content.innerHTML = `
            <h3 class="text-lg font-bold mb-4">${editIndex !== null ? 'Editar' : 'Nova'} Conta</h3>
            <div class="space-y-3">
                <div>
                    <label class="text-xs text-gray-400 ml-1">Nome da Conta</label>
                    <input id="f-conta-nome" value="${c.nome}" placeholder="Ex: Nubank, Carteira" class="w-full p-3 rounded-xl">
                </div>
                <div>
                    <label class="text-xs text-gray-400 ml-1">Tipo</label>
                    <select id="f-conta-tipo" class="w-full p-3 rounded-xl">
                        <option value="corrente" ${c.tipo==='corrente'?'selected':''}>Corrente</option>
                        <option value="poupanca" ${c.tipo==='poupanca'?'selected':''}>Poupança</option>
                        <option value="investimento" ${c.tipo==='investimento'?'selected':''}>Investimento</option>
                        <option value="dinheiro" ${c.tipo==='dinheiro'?'selected':''}>Dinheiro</option>
                    </select>
                </div>
                <div>
                    <label class="text-xs text-gray-400 ml-1">Saldo Inicial</label>
                    <input id="f-conta-saldo" type="number" step="0.01" value="${c.saldoInicial}" placeholder="0,00" class="w-full p-3 rounded-xl">
                </div>
                <button onclick="salvarConta(${editIndex})" class="w-full bg-amber-500 text-black font-semibold py-3 rounded-xl mt-2 shadow-lg shadow-amber-500/20">Salvar Conta</button>
            </div>
        `;
    }
    window.salvarConta = function(idx) {
        const p = perfil();
        const nome = document.getElementById('f-conta-nome').value;
        const tipo = document.getElementById('f-conta-tipo').value;
        const saldo = parseFloat(document.getElementById('f-conta-saldo').value) || 0;
        if (!nome) return alert('Nome obrigatório');
        if (idx !== null) {
            p.contas[idx] = { ...p.contas[idx], nome, tipo, saldoInicial: saldo };
        } else {
            p.contas.push({ id: Date.now(), nome, tipo, saldoInicial: saldo });
        }
        salvarPessoal(); renderPessoal(); closeModal();
    };

    function formCartao(content, editIndex) {
        const p = perfil();
        const c = editIndex !== null ? p.cartoes[editIndex] : { nome: '', limite: 0, utilizado: 0, fechamento: '' };
        content.innerHTML = `
            <h3 class="text-lg font-bold mb-4">${editIndex !== null ? 'Editar' : 'Novo'} Cartão</h3>
            <div class="space-y-3">
                <div>
                    <label class="text-xs text-gray-400 ml-1">Nome do Cartão</label>
                    <input id="f-cartao-nome" value="${c.nome}" placeholder="Ex: Inter Platinum" class="w-full p-3 rounded-xl">
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="text-xs text-gray-400 ml-1">Limite</label>
                        <input id="f-cartao-limite" type="number" step="0.01" value="${c.limite}" placeholder="0,00" class="w-full p-3 rounded-xl">
                    </div>
                    <div>
                        <label class="text-xs text-gray-400 ml-1">Já Utilizado</label>
                        <input id="f-cartao-utilizado" type="number" step="0.01" value="${c.utilizado}" placeholder="0,00" class="w-full p-3 rounded-xl">
                    </div>
                </div>
                <button onclick="salvarCartao(${editIndex})" class="w-full bg-amber-500 text-black font-semibold py-3 rounded-xl mt-2 shadow-lg shadow-amber-500/20">Salvar Cartão</button>
            </div>
        `;
    }
    window.salvarCartao = function(idx) {
        const p = perfil();
        const nome = document.getElementById('f-cartao-nome').value;
        const limite = parseFloat(document.getElementById('f-cartao-limite').value) || 0;
        const utilizado = parseFloat(document.getElementById('f-cartao-utilizado').value) || 0;
        if (!nome) return alert('Nome obrigatório');
        if (idx !== null) {
            p.cartoes[idx] = { ...p.cartoes[idx], nome, limite, utilizado };
        } else {
            p.cartoes.push({ id: Date.now(), nome, limite, utilizado });
        }
        salvarPessoal(); renderPessoal(); closeModal();
    };

    function formTransacao(content, editIndex, contaPre) {
        const p = perfil();
        const t = editIndex !== null ? p.transacoes[editIndex] : { tipo: 'despesa', valor: 0, descricao: '', data: new Date().toISOString().split('T')[0], contaId: contaPre || (p.contas[0]?.id || '') };
        content.innerHTML = `
            <h3 class="text-lg font-bold mb-4">Nova Transação</h3>
            <div class="space-y-3">
                <div>
                    <label class="text-xs text-gray-400 ml-1">Tipo</label>
                    <select id="f-trans-tipo" class="w-full p-3 rounded-xl" onchange="toggleTransDestino()">
                        <option value="despesa" ${t.tipo==='despesa'?'selected':''}>Despesa</option>
                        <option value="receita" ${t.tipo==='receita'?'selected':''}>Receita</option>
                        <option value="transferencia" ${t.tipo==='transferencia'?'selected':''}>Transferência</option>
                    </select>
                </div>
                <div>
                    <label class="text-xs text-gray-400 ml-1">Descrição</label>
                    <input id="f-trans-desc" value="${t.descricao}" placeholder="Ex: Aluguel, Salário" class="w-full p-3 rounded-xl">
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="text-xs text-gray-400 ml-1">Valor</label>
                        <input id="f-trans-valor" type="number" step="0.01" value="${t.valor}" placeholder="0,00" class="w-full p-3 rounded-xl">
                    </div>
                    <div>
                        <label class="text-xs text-gray-400 ml-1">Data</label>
                        <input id="f-trans-data" type="date" value="${t.data}" class="w-full p-3 rounded-xl">
                    </div>
                </div>
                <div>
                    <label class="text-xs text-gray-400 ml-1">Conta</label>
                    <select id="f-trans-conta" class="w-full p-3 rounded-xl">
                        ${p.contas.map(c => `<option value="${c.id}" ${c.id==t.contaId?'selected':''}>${c.nome}</option>`).join('')}
                    </select>
                </div>
                <div id="f-trans-destino-group" class="hidden">
                    <label class="text-xs text-gray-400 ml-1">Para conta:</label>
                    <select id="f-trans-conta-dest" class="w-full p-3 rounded-xl">
                        ${p.contas.map(c => `<option value="${c.id}">${c.nome}</option>`).join('')}
                    </select>
                </div>
                <button onclick="salvarTransacao()" class="w-full bg-amber-500 text-black font-semibold py-3 rounded-xl mt-2 shadow-lg shadow-amber-500/20">Salvar Transação</button>
            </div>
        `;
        window.toggleTransDestino = () => {
            const tipo = document.getElementById('f-trans-tipo').value;
            const destGroup = document.getElementById('f-trans-destino-group');
            if (destGroup) destGroup.classList.toggle('hidden', tipo !== 'transferencia');
        };
        setTimeout(toggleTransDestino, 0);
    }
    window.salvarTransacao = function() {
        const p = perfil();
        const tipo = document.getElementById('f-trans-tipo').value;
        const descricao = document.getElementById('f-trans-desc').value;
        const valor = parseFloat(document.getElementById('f-trans-valor').value) || 0;
        const data = document.getElementById('f-trans-data').value;
        const contaId = parseInt(document.getElementById('f-trans-conta').value);
        const contaDestinoId = tipo === 'transferencia' ? parseInt(document.getElementById('f-trans-conta-dest').value) : null;
        
        if (!descricao || valor <= 0) return alert('Preencha os campos corretamente');
        p.transacoes.push({ id: Date.now(), tipo, descricao, valor, data, contaId, contaDestinoId });
        salvarPessoal(); renderPessoal(); closeModal();
        if (telaAtual === 'extrato-conta') abrirTelaConta(p.contas.findIndex(c => c.id === contaId));
    };

    // --- COMPARTILHADO ---
    function renderCompart() {
        document.getElementById('mes-referencia-compart').textContent = nomeMesAno(mesRefCompart, anoRefCompart);
        document.getElementById('mes-atual-compart').textContent = nomeMesAno(mesRefCompart, anoRefCompart);
        
        const listaPessoas = document.getElementById('lista-pessoas');
        listaPessoas.innerHTML = dadosCompart.pessoas.map((p, i) => `
            <div class="card-premium rounded-xl p-3 flex justify-between items-center">
                <span>${p.nome}</span>
                <button onclick="excluirPessoa(${i})" class="text-red-400 text-xs">✕</button>
            </div>
        `).join('') || '<p class="text-gray-500 text-center py-2">Nenhuma pessoa</p>';

        const listaContasComp = document.getElementById('lista-contas-compartilhadas');
        const contasMes = dadosCompart.contas.filter(c => {
            const d = new Date(c.data);
            return d.getMonth() === mesRefCompart && d.getFullYear() === anoRefCompart;
        });
        listaContasComp.innerHTML = contasMes.map((c, i) => `
            <div class="card-premium rounded-xl p-3 flex justify-between items-center">
                <div><p class="font-medium">${c.descricao}</p><p class="text-xs text-gray-500">${fmt(c.valor)}</p></div>
                <button onclick="excluirContaCompart(${i})" class="text-red-400 text-xs">✕</button>
            </div>
        `).join('') || '<p class="text-gray-500 text-center py-2">Nenhuma conta este mês</p>';

        const resumo = document.getElementById('resumo-mensal-compart');
        const total = contasMes.reduce((s, c) => s + c.valor, 0);
        const porPessoa = dadosCompart.pessoas.length > 0 ? total / dadosCompart.pessoas.length : 0;
        resumo.innerHTML = `
            <div class="flex justify-between"><span>Total:</span><span class="font-bold text-amber-400">${fmt(total)}</span></div>
            <div class="flex justify-between text-sm text-gray-400"><span>Por pessoa (${dadosCompart.pessoas.length}):</span><span>${fmt(porPessoa)}</span></div>
        `;
    }

    function formPessoa(content, editIndex) {
        content.innerHTML = `
            <h3 class="text-lg font-bold mb-4">Nova Pessoa</h3>
            <div class="space-y-3">
                <div>
                    <label class="text-xs text-gray-400 ml-1">Nome da Pessoa</label>
                    <input id="f-pessoa-nome" placeholder="Ex: Maria, João" class="w-full p-3 rounded-xl">
                </div>
                <button onclick="salvarPessoa()" class="w-full bg-amber-500 text-black font-semibold py-3 rounded-xl mt-2 shadow-lg shadow-amber-500/20">Adicionar Pessoa</button>
            </div>
        `;
    }
    window.salvarPessoa = function() {
        const nome = document.getElementById('f-pessoa-nome').value;
        if (!nome) return;
        dadosCompart.pessoas.push({ nome });
        salvarCompart(); renderCompart(); closeModal();
    };

    function formContaCompart(content, editIndex) {
        content.innerHTML = `
            <h3 class="text-lg font-bold mb-4">Nova Conta Compartilhada</h3>
            <div class="space-y-3">
                <div>
                    <label class="text-xs text-gray-400 ml-1">Descrição</label>
                    <input id="f-comp-desc" placeholder="Ex: Mercado, Aluguel" class="w-full p-3 rounded-xl">
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="text-xs text-gray-400 ml-1">Valor Total</label>
                        <input id="f-comp-valor" type="number" step="0.01" placeholder="0,00" class="w-full p-3 rounded-xl">
                    </div>
                    <div>
                        <label class="text-xs text-gray-400 ml-1">Data</label>
                        <input id="f-comp-data" type="date" value="${new Date().toISOString().split('T')[0]}" class="w-full p-3 rounded-xl">
                    </div>
                </div>
                <button onclick="salvarContaComp()" class="w-full bg-amber-500 text-black font-semibold py-3 rounded-xl mt-2 shadow-lg shadow-amber-500/20">Salvar Conta</button>
            </div>
        `;
    }
    window.salvarContaComp = function() {
        const descricao = document.getElementById('f-comp-desc').value;
        const valor = parseFloat(document.getElementById('f-comp-valor').value) || 0;
        const data = document.getElementById('f-comp-data').value;
        if (!descricao || valor <= 0) return;
        dadosCompart.contas.push({ descricao, valor, data });
        salvarCompart(); renderCompart(); closeModal();
    };

    window.excluirConta = (i) => { if(confirm('Excluir conta e transações?')) { const p = perfil(); const id = p.contas[i].id; p.contas.splice(i,1); p.transacoes = p.transacoes.filter(t => t.contaId !== id && t.contaDestinoId !== id); salvarPessoal(); renderPessoal(); } };
    window.excluirCartao = (i) => { if(confirm('Excluir cartão?')) { perfil().cartoes.splice(i,1); salvarPessoal(); renderPessoal(); } };
    window.excluirPessoa = (i) => { if(confirm('Excluir pessoa?')) { dadosCompart.pessoas.splice(i,1); salvarCompart(); renderCompart(); } };
    window.excluirContaCompart = (i) => { if(confirm('Excluir conta?')) { dadosCompart.contas.splice(i,1); salvarCompart(); renderCompart(); } };

    // Inicialização
    carregarDados();
    gerarIcone();
    mostrarLogin();
})();
