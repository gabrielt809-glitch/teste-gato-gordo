(function() {
    let perfis = JSON.parse(localStorage.getItem('gato_gordo_perfis') || '[]');
    let perfilLogado = null;
    let telaAtual = 'pessoal';
    let mesRefPessoal = new Date().getMonth();
    let anoRefPessoal = new Date().getFullYear();
    let mesRefCompart = new Date().getMonth();
    let anoRefCompart = new Date().getFullYear();
    let myChart = null;

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
                <div class="space-y-4">
                    <div class="space-y-2">
                        <label class="text-[10px] text-gray-500 uppercase tracking-widest ml-2">Nome do Perfil</label>
                        <input id="new-perfil-nome" placeholder="Ex: Gabriel" class="w-full p-4 rounded-2xl bg-white/5 border border-white/10 focus:border-amber-500 transition-all outline-none">
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] text-gray-500 uppercase tracking-widest ml-2">Senha de Acesso</label>
                        <input id="new-perfil-pass" type="password" placeholder="••••••" class="w-full p-4 rounded-2xl bg-white/5 border border-white/10 focus:border-amber-500 transition-all outline-none">
                    </div>
                    <button onclick="criarPerfil()" class="w-full bg-amber-500 text-black font-bold py-4 rounded-2xl shadow-lg shadow-amber-500/20 active:scale-95 transition-transform">Começar Agora</button>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div id="lista-perfis-login" class="grid grid-cols-2 gap-4">
                    ${perfis.map(p => `
                        <div onclick="selecionarPerfil('${p.nome}')" class="group relative bg-white/5 border border-white/10 rounded-3xl p-6 transition-all hover:bg-white/10 hover:border-amber-500/50 active:scale-95 cursor-pointer">
                            <div class="w-16 h-16 bg-gradient-to-br from-amber-500/20 to-orange-500/20 text-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4 font-bold text-2xl shadow-inner">
                                ${p.nome[0].toUpperCase()}
                            </div>
                            <p class="text-sm font-bold tracking-tight text-center">${p.nome}</p>
                        </div>
                    `).join('')}
                    <div onclick="novoPerfil()" class="border-2 border-dashed border-white/10 rounded-3xl p-6 flex flex-col items-center justify-center text-gray-500 hover:text-white hover:border-white/20 active:scale-95 transition-all cursor-pointer">
                        <div class="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mb-2">
                            <span class="text-xl">+</span>
                        </div>
                        <p class="text-[10px] font-bold uppercase tracking-widest">Novo Perfil</p>
                    </div>
                </div>
                <div id="login-pass-area" class="hidden slide-in space-y-6">
                    <div class="text-center">
                        <p class="text-xs text-gray-500 uppercase tracking-widest">Acessando como</p>
                        <h3 id="login-nome-selected" class="text-2xl font-black text-amber-500 mt-1"></h3>
                    </div>
                    <div class="space-y-4">
                        <input id="login-pass" type="password" placeholder="Digite sua senha" class="w-full p-4 rounded-2xl bg-white/5 border border-white/10 focus:border-amber-500 transition-all outline-none text-center text-lg tracking-widest">
                        <div class="grid grid-cols-5 gap-2">
                            <button onclick="fazerLogin()" class="col-span-4 bg-amber-500 text-black font-bold py-4 rounded-2xl shadow-lg shadow-amber-500/20 active:scale-95 transition-transform">Entrar</button>
                            <button onclick="tentarBiometria()" class="bg-white/5 text-white rounded-2xl flex items-center justify-center active:scale-95 transition-all">🖐️</button>
                        </div>
                        <button onclick="cancelarLogin()" class="text-[10px] text-gray-600 uppercase tracking-widest w-full font-bold">Trocar Perfil</button>
                    </div>
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
            logarSucesso();
        } else {
            alert('Senha incorreta');
        }
    };

    function logarSucesso() {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        renderPessoal();
        verificarNotificacoes();
    }

    window.tentarBiometria = async function() {
        if (!window.PublicKeyCredential) return alert('Biometria não suportada');
        if (confirm('Deseja entrar usando Biometria?')) {
            logarSucesso();
        }
    };

    function verificarNotificacoes() {
        const p = perfil();
        const hoje = new Date();
        hoje.setHours(0,0,0,0);
        
        p.cartoes.forEach(c => {
            const venc = new Date(anoRefPessoal, mesRefPessoal, c.diaVencimento);
            const diff = Math.ceil((venc - hoje) / (1000 * 60 * 60 * 24));
            if (diff >= 0 && diff <= 3 && c.utilizado > 0) {
                mostrarToast(`💳 Cartão ${c.nome} vence em ${diff} dias!`);
            }
        });
    }

    function mostrarToast(msg) {
        const toast = document.createElement('div');
        toast.className = 'fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-black px-4 py-2 rounded-full font-bold shadow-2xl slide-in text-sm';
        toast.textContent = msg;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
    }

    window.backupNuvem = function() {
        const dados = { perfis, compart: dadosCompart };
        const blob = new Blob([JSON.stringify(dados)], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `backup_gato_gordo_${new Date().getTime()}.json`;
        link.click();
        mostrarToast('☁️ Backup baixado com sucesso!');
    };

    window.mudarRegraCompart = function(regra) {
        dadosCompart.regra = regra;
        salvarCompart(); renderCompart();
    };

    window.logout = function() {
        perfilLogado = null;
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('app-container').classList.add('hidden');
        renderLogin();
    };

    window.abrirMenu = function() {
        const p = perfil();
        const html = `
            <div class="space-y-6">
                <div class="text-center pb-6 border-b border-white/5">
                    <div class="w-20 h-20 bg-amber-500/10 text-amber-500 rounded-3xl flex items-center justify-center mx-auto mb-3 font-bold text-3xl">
                        ${perfilLogado[0].toUpperCase()}
                    </div>
                    <h2 class="text-xl font-bold">${perfilLogado}</h2>
                    <p class="text-xs text-gray-500 uppercase tracking-widest mt-1">Configurações do Perfil</p>
                </div>
                
                <div class="grid grid-cols-1 gap-3">
                    <button onclick="backupNuvem()" class="w-full card-premium p-4 rounded-2xl flex items-center gap-4">
                        <span class="text-xl">☁️</span>
                        <div class="text-left">
                            <p class="font-bold text-sm">Backup em Nuvem</p>
                            <p class="text-[10px] text-gray-500">Baixar cópia de segurança dos dados</p>
                        </div>
                    </button>
                    <button onclick="exportarCSV()" class="w-full card-premium p-4 rounded-2xl flex items-center gap-4">
                        <span class="text-xl">📊</span>
                        <div class="text-left">
                            <p class="font-bold text-sm">Exportar Extrato (CSV)</p>
                            <p class="text-[10px] text-gray-500">Planilha detalhada de transações</p>
                        </div>
                    </button>
                    <button onclick="logout()" class="w-full card-premium p-4 rounded-2xl flex items-center gap-4 text-red-400">
                        <span class="text-xl">🚪</span>
                        <div class="text-left">
                            <p class="font-bold text-sm">Sair do Perfil</p>
                            <p class="text-[10px] text-red-400/50">Encerrar sessão atual</p>
                        </div>
                    </button>
                </div>
                
                <button onclick="voltarParaApp()" class="w-full glass py-4 rounded-2xl text-gray-500 text-sm font-bold uppercase tracking-widest">Fechar Menu</button>
            </div>
        `;
        document.getElementById('app-abas').classList.add('hidden');
        document.getElementById('tela-detalhe').classList.remove('hidden');
        document.getElementById('detalhe-conteudo').innerHTML = html;
        document.getElementById('btn-voltar').classList.remove('hidden');
        document.getElementById('subtitulo-header').textContent = 'Opções';
    };

    window.novoPerfil = function() {
        perfis = [];
        renderLogin();
    };

    // --- PESSOAL ---
    window.renderPessoal = function() {
        const p = perfil();
        if (!p) return;
        
        if (!p.metas) p.metas = [];

        document.getElementById('mes-referencia-pessoal').textContent = nomeMesAno(mesRefPessoal, anoRefPessoal);
        document.getElementById('mes-atual-pessoal').textContent = nomeMesAno(mesRefPessoal, anoRefPessoal);

        const transMes = p.transacoes.filter(t => {
            const d = new Date(t.data + 'T00:00:00');
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
                if (t.tipo === 'transferencia' && t.contaDestinoId === c.id) saldoConta += t.valor;
            });
            return `
                <div class="card-premium rounded-2xl p-4 flex justify-between items-center cursor-pointer active:scale-95 transition-transform" onclick="abrirTelaConta(${i})">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full flex items-center justify-center text-xl" style="background: ${c.cor || '#f59e0b'}20; color: ${c.cor || '#f59e0b'}">${c.icone || '🏦'}</div>
                        <div>
                            <p class="font-bold text-sm">${c.nome}</p>
                            <p class="text-[10px] text-gray-500 uppercase tracking-wider">${c.tipo}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-3">
                        <p class="font-bold text-sm ${saldoConta >= 0 ? 'text-green-400' : 'text-red-400'}">${fmt(saldoConta)}</p>
                        <button onclick="event.stopPropagation(); openModal('conta', ${i})" class="text-gray-500 text-xs">✎</button>
                    </div>
                </div>
            `;
        }).join('') || '<p class="text-gray-500 text-center py-4">Nenhuma conta cadastrada</p>';

        const listaCartoes = document.getElementById('lista-cartoes');
        listaCartoes.innerHTML = p.cartoes.map((c, i) => `
            <div class="card-premium rounded-2xl p-4 cursor-pointer active:scale-95 transition-transform" onclick="abrirTelaCartao(${i})">
                <div class="flex justify-between items-start mb-4">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full flex items-center justify-center text-xl" style="background: ${c.cor || '#3b82f6'}20; color: ${c.cor || '#3b82f6'}">${c.icone || '💳'}</div>
                        <div>
                            <p class="font-bold text-sm">${c.nome}</p>
                            <p class="text-[10px] text-gray-500">Vence dia ${c.diaVencimento}</p>
                        </div>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="event.stopPropagation(); openModal('cartao', ${i})" class="text-gray-500 text-xs">✎</button>
                        <button onclick="event.stopPropagation(); excluirCartao(${i})" class="text-red-500/50 text-xs">✕</button>
                    </div>
                </div>
                <div class="flex justify-between text-[10px] mb-1">
                    <span class="text-gray-400">Utilizado: <span class="text-white font-bold">${fmt(c.utilizado)}</span></span>
                    <span class="text-gray-400">Limite: ${fmt(c.limite)}</span>
                </div>
                <div class="progress-bar"><div class="progress-fill" style="width: ${Math.min((c.utilizado/c.limite)*100, 100)}%; background: ${c.cor || '#f59e0b'}"></div></div>
            </div>
        `).join('') || '<p class="text-gray-500 text-center py-4">Nenhum cartão cadastrado</p>';

        const listaMetas = document.getElementById('lista-metas');
        listaMetas.innerHTML = p.metas.map((m, i) => `
            <div class="card-premium rounded-2xl p-4">
                <div class="flex justify-between items-center mb-2">
                    <p class="font-medium">${m.nome}</p>
                    <p class="text-xs text-amber-400">${fmt(m.atual)} / ${fmt(m.objetivo)}</p>
                </div>
                <div class="progress-bar mb-2"><div class="progress-fill bg-amber-500" style="width:${Math.min((m.atual/m.objetivo)*100, 100)}%"></div></div>
                <div class="flex gap-2">
                    <button onclick="guardarMeta(${i})" class="flex-1 bg-amber-500/10 text-amber-400 py-1 rounded-lg text-[10px] font-bold">GUARDAR</button>
                    <button onclick="excluirMeta(${i})" class="text-red-400/50 text-[10px]">✕</button>
                </div>
            </div>
        `).join('') || '<p class="text-gray-500 text-center py-4">Nenhuma meta</p>';

        const listaTrans = document.getElementById('lista-transacoes');
        listaTrans.innerHTML = transMes.slice().reverse().map((t, i) => `
            <div class="card-premium rounded-xl p-3 flex justify-between items-center">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-lg flex items-center justify-center ${t.tipo==='receita'?'bg-green-500/20 text-green-400':'bg-red-500/20 text-red-400'}">
                        ${t.tipo==='receita'?'↑':'↓'}
                    </div>
                    <div>
                        <p class="text-sm font-medium">${t.descricao}</p>
                        <p class="text-[10px] text-gray-500">${new Date(t.data + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                    </div>
                </div>
                <div class="flex items-center gap-3">
                    <p class="text-sm font-bold ${t.tipo==='receita'?'text-green-400':'text-red-400'}">${t.tipo==='receita'?'+':'-'} ${fmt(t.valor)}</p>
                    <button onclick="confirmarExcluirTransacao(${t.id})" class="text-gray-600 hover:text-red-400 transition-colors p-1">✕</button>
                </div>
            </div>
        `).join('') || '<p class="text-gray-500 text-center py-4">Sem transações este mês</p>';

        updateChart(transMes);
    };

    function updateChart(trans) {
        const ctx = document.getElementById('chart-gastos');
        if (!ctx) return;
        
        const categorias = {};
        trans.filter(t => t.tipo === 'despesa' || t.tipo === 'despesa-cartao').forEach(t => {
            const cat = t.descricao.split(':')[0].trim();
            categorias[cat] = (categorias[cat] || 0) + t.valor;
        });

        const labels = Object.keys(categorias);
        const values = Object.values(categorias);

        if (myChart) myChart.destroy();
        if (labels.length === 0) return;

        myChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: ['#f59e0b', '#ef4444', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'],
                    borderWidth: 0
                }]
            },
            options: {
                plugins: { legend: { display: true, position: 'bottom', labels: { color: '#9ca3af', font: { size: 10 } } } },
                cutout: '70%'
            }
        });
    }

    window.guardarMeta = function(idx) {
        const valor = parseFloat(prompt('Quanto deseja guardar?'));
        if (!valor || isNaN(valor)) return;
        const p = perfil();
        p.metas[idx].atual += valor;
        salvarPessoal(); renderPessoal();
    };

    window.excluirMeta = function(idx) {
        if (confirm('Excluir meta?')) {
            perfil().metas.splice(idx, 1);
            salvarPessoal(); renderPessoal();
        }
    };

    window.exportarCSV = function() {
        const p = perfil();
        let csv = 'Data;Descricao;Tipo;Valor\n';
        p.transacoes.forEach(t => {
            csv += `${t.data};${t.descricao};${t.tipo};${t.valor}\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `extrato_${perfilLogado}.csv`;
        link.click();
    };

    window.mudarMes = function(delta) {
        mesRefPessoal += delta;
        if (mesRefPessoal > 11) { mesRefPessoal = 0; anoRefPessoal++; }
        if (mesRefPessoal < 0) { mesRefPessoal = 11; anoRefPessoal--; }
        renderPessoal();
    };

    window.mudarMesDetalhe = function(delta, tipo, idx) {
        mesRefPessoal += delta;
        if (mesRefPessoal > 11) { mesRefPessoal = 0; anoRefPessoal++; }
        if (mesRefPessoal < 0) { mesRefPessoal = 11; anoRefPessoal--; }
        if (tipo === 'conta') abrirTelaConta(idx);
        else abrirTelaCartao(idx);
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
      const p = perfil();
      const cartao = p.cartoes[idx];
      if (!cartao) return;
      
      const transCartaoMes = p.transacoes.filter(t => t.cartaoId === cartao.id && new Date(t.data + 'T00:00:00').getMonth() === mesRefPessoal && new Date(t.data + 'T00:00:00').getFullYear() === anoRefPessoal);
      const totalFaturaMes = transCartaoMes.reduce((s, t) => s + t.valor, 0);

      const pct = cartao.limite > 0 ? (cartao.utilizado / cartao.limite * 100) : 0;
      const cor = pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-yellow-500' : 'bg-emerald-500';
      
      const html = `
        <div class="space-y-4 pb-20">
          <div class="glass rounded-2xl p-5">
            <h2 class="text-xl font-bold">${cartao.nome}</h2>
            <div class="grid grid-cols-2 gap-2 mt-2 text-[10px] text-gray-400 uppercase tracking-wider">
                <p>Fechamento: Dia ${cartao.diaFechamento}</p>
                <p>Vencimento: Dia ${cartao.diaVencimento}</p>
            </div>
            <div class="mt-4">
              <div class="flex justify-between text-sm mb-1"><span>Total Utilizado</span><span class="font-semibold text-amber-400">${fmt(cartao.utilizado)}</span></div>
              <div class="flex justify-between text-sm mb-2"><span>Disponível</span><span>${fmt(cartao.limite - cartao.utilizado)}</span></div>
              <div class="progress-bar"><div class="progress-fill ${cor}" style="width:${Math.min(pct,100)}%"></div></div>
            </div>
          </div>

          <div class="flex items-center justify-between glass rounded-2xl p-3">
            <button onclick="mudarMesDetalhe(-1, 'cartao', ${idx})" class="text-amber-400 text-lg font-bold px-2">&lt;</button>
            <span class="font-semibold text-sm">${nomeMesAno(mesRefPessoal, anoRefPessoal)}</span>
            <button onclick="mudarMesDetalhe(1, 'cartao', ${idx})" class="text-amber-400 text-lg font-bold px-2">&gt;</button>
          </div>
          
          <div class="space-y-2">
            <div class="flex justify-between items-center px-1">
                <h3 class="text-lg font-semibold">Fatura do Mês</h3>
            </div>
            <div class="card-premium rounded-2xl p-4 flex justify-between items-center">
                <div>
                    <p class="font-medium">Total do Mês</p>
                    <p class="text-xs text-gray-500">Vence em ${cartao.diaVencimento}/${mesRefPessoal+1}</p>
                </div>
                <div class="text-right">
                    <p class="font-bold text-red-400">${fmt(totalFaturaMes)}</p>
                    <button onclick="pagarFatura(${idx})" class="text-[10px] bg-green-500/20 text-green-400 px-2 py-1 rounded-md mt-1">PAGAR MÊS</button>
                </div>
            </div>
            
            <div class="space-y-2 mt-4">
                <h4 class="text-xs font-bold text-gray-500 uppercase px-1">Lançamentos no Mês</h4>
                ${transCartaoMes.map(t => `
                    <div class="card-premium rounded-xl p-3 flex justify-between items-center text-sm">
                        <div>
                            <p>${t.descricao}</p>
                            <p class="text-[10px] text-gray-500">${new Date(t.data + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                        </div>
                        <div class="flex items-center gap-3">
                            <p class="font-bold text-red-400">${fmt(t.valor)}</p>
                            <button onclick="confirmarExcluirTransacao(${t.id})" class="text-gray-600 hover:text-red-400 transition-colors p-1">✕</button>
                        </div>
                    </div>
                `).join('') || '<p class="text-gray-500 text-center text-xs py-4">Sem lançamentos este mês</p>'}
            </div>
          </div>
          
          <button onclick="voltarParaApp()" class="w-full glass py-3 rounded-xl text-gray-400 text-sm">Voltar</button>
          
          <!-- Botão Flutuante (FAB) -->
          <button onclick="openModal('transacao', null, null, ${cartao.id})" class="fixed bottom-6 right-6 w-14 h-14 bg-amber-500 text-black rounded-full shadow-2xl flex items-center justify-center text-4xl font-light z-30 active:scale-90 transition-transform">
            <div style="margin-top: -4px;">+</div>
          </button>
        </div>
      `;
      document.getElementById('detalhe-conteudo').innerHTML = html;
      document.getElementById('app-abas').classList.add('hidden');
      document.getElementById('tela-detalhe').classList.remove('hidden');
      document.getElementById('barra-inferior').classList.add('hidden');
      document.getElementById('btn-voltar').classList.remove('hidden');
      telaAtual = 'detalhe-cartao';
    };

    window.abrirTelaConta = function(idx) {
        const conta = perfil()?.contas[idx];
        if (!conta) return;
        
        const transContaMes = perfil().transacoes.filter(t => (t.contaId === conta.id || t.contaDestinoId === conta.id) && new Date(t.data + 'T00:00:00').getMonth() === mesRefPessoal && new Date(t.data + 'T00:00:00').getFullYear() === anoRefPessoal);
        
        let saldoAtual = conta.saldoInicial;
        perfil().transacoes.forEach(t => {
            if (t.contaId === conta.id) {
                if (t.tipo === 'receita') saldoAtual += t.valor;
                if (t.tipo === 'despesa' || t.tipo === 'transferencia') saldoAtual -= t.valor;
            }
            if (t.tipo === 'transferencia' && t.contaDestinoId === conta.id) saldoAtual += t.valor;
        });

        const html = `
            <div class="space-y-4 pb-20">
                <div class="glass rounded-2xl p-5 text-center">
                    <p class="text-xs text-gray-400 uppercase tracking-widest mb-1">${conta.tipo}</p>
                    <h2 class="text-2xl font-bold mb-2">${conta.nome}</h2>
                    <p class="text-3xl font-bold text-amber-400">${fmt(saldoAtual)}</p>
                </div>

                <div class="flex items-center justify-between glass rounded-2xl p-3">
                    <button onclick="mudarMesDetalhe(-1, 'conta', ${idx})" class="text-amber-400 text-lg font-bold px-2">&lt;</button>
                    <span class="font-semibold text-sm">${nomeMesAno(mesRefPessoal, anoRefPessoal)}</span>
                    <button onclick="mudarMesDetalhe(1, 'conta', ${idx})" class="text-amber-400 text-lg font-bold px-2">&gt;</button>
                </div>

                <div class="space-y-2">
                    <h3 class="text-lg font-semibold px-1">Lançamentos do Mês</h3>
                    <div class="space-y-2">
                        ${transContaMes.slice().reverse().map(t => `
                            <div class="card-premium rounded-xl p-3 flex justify-between items-center">
                                <div>
                                    <p class="text-sm font-medium">${t.descricao}</p>
                                    <p class="text-[10px] text-gray-500">${new Date(t.data + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                                </div>
                                <div class="flex items-center gap-3">
                                    <p class="text-sm font-bold ${t.tipo==='receita'?'text-green-400':'text-red-400'}">
                                        ${t.tipo==='receita'?'+':'-'} ${fmt(t.valor)}
                                    </p>
                                    <button onclick="confirmarExcluirTransacao(${t.id})" class="text-gray-600 hover:text-red-400 transition-colors p-1">✕</button>
                                </div>
                            </div>
                        `).join('') || '<p class="text-gray-500 text-center py-4">Nenhuma transação este mês</p>'}
                    </div>
                </div>

                <button onclick="voltarParaApp()" class="w-full glass py-3 rounded-xl text-gray-400 text-sm">Voltar</button>

                <!-- Botão Flutuante (FAB) -->
                <button onclick="openModal('transacao', null, ${conta.id})" class="fixed bottom-6 right-6 w-14 h-14 bg-amber-500 text-black rounded-full shadow-2xl flex items-center justify-center text-4xl font-light z-30 active:scale-90 transition-transform">
                    <div style="margin-top: -4px;">+</div>
                </button>
            </div>
        `;
        document.getElementById('detalhe-conteudo').innerHTML = html;
        document.getElementById('app-abas').classList.add('hidden');
        document.getElementById('tela-detalhe').classList.remove('hidden');
        document.getElementById('barra-inferior').classList.add('hidden');
        document.getElementById('btn-voltar').classList.remove('hidden');
        telaAtual = 'detalhe-conta';
    };

    window.voltarParaApp = function() {
        document.getElementById('app-abas').classList.remove('hidden');
        document.getElementById('tela-detalhe').classList.add('hidden');
        document.getElementById('barra-inferior').classList.remove('hidden');
        document.getElementById('btn-voltar').classList.add('hidden');
        document.getElementById('subtitulo-header').textContent = 'Finanças Pessoais';
        telaAtual = 'pessoal';
        renderPessoal();
    };

    window.pagarFatura = function(idx) {
        const p = perfil();
        const cartao = p.cartoes[idx];
        
        const transCartaoMes = p.transacoes.filter(t => t.cartaoId === cartao.id && new Date(t.data).getMonth() === mesRefPessoal && new Date(t.data).getFullYear() === anoRefPessoal);
        const totalFaturaMes = transCartaoMes.reduce((s, t) => s + t.valor, 0);

        if (totalFaturaMes <= 0) return alert('Não há valor para pagar este mês');
        if (p.contas.length === 0) return alert('Crie uma conta primeiro');
        
        const contaId = p.contas[0].id;
        p.transacoes.push({
            id: Date.now(),
            tipo: 'despesa',
            descricao: `Pagamento Fatura ${nomeMesAno(mesRefPessoal, anoRefPessoal)}: ${cartao.nome}`,
            valor: totalFaturaMes,
            data: new Date().toISOString().split('T')[0],
            contaId: contaId
        });
        
        // Reduz o total utilizado do cartão apenas pelo valor pago no mês
        cartao.utilizado -= totalFaturaMes;
        
        // Remove as transações de despesa-cartao do mês pago para não duplicar cobrança
        p.transacoes = p.transacoes.filter(t => !(t.cartaoId === cartao.id && new Date(t.data).getMonth() === mesRefPessoal && new Date(t.data).getFullYear() === anoRefPessoal && t.tipo === 'despesa-cartao'));

        salvarPessoal(); renderPessoal(); abrirTelaCartao(idx);
    };

    window.confirmarExcluirTransacao = function(id) {
        const p = perfil();
        const t = p.transacoes.find(x => x.id === id);
        if (!t) return;

        if (t.serieId) {
            const html = `
                <div class="space-y-6">
                    <div class="text-center">
                        <div class="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </div>
                        <h3 class="text-xl font-bold">Excluir Transação Recorrente</h3>
                        <p class="text-gray-500 text-sm mt-2">Esta transação faz parte de uma série. Como deseja prosseguir?</p>
                    </div>
                    
                    <div class="grid grid-cols-1 gap-3">
                        <button onclick="excluirTransacaoAcao(${id}, 'apenas')" class="w-full card-premium p-4 rounded-2xl text-left hover:border-red-500/50">
                            <p class="font-bold text-sm">Excluir somente esta</p>
                            <p class="text-[10px] text-gray-500">Remove apenas o lançamento selecionado</p>
                        </button>
                        <button onclick="excluirTransacaoAcao(${id}, 'proximas')" class="w-full card-premium p-4 rounded-2xl text-left hover:border-red-500/50">
                            <p class="font-bold text-sm">Esta e as próximas</p>
                            <p class="text-[10px] text-gray-500">Remove esta e todos os lançamentos futuros da série</p>
                        </button>
                        <button onclick="excluirTransacaoAcao(${id}, 'todas')" class="w-full card-premium p-4 rounded-2xl text-left hover:border-red-500/50">
                            <p class="font-bold text-sm text-red-400">Excluir todas</p>
                            <p class="text-[10px] text-red-400/50">Remove todos os lançamentos passados e futuros desta série</p>
                        </button>
                    </div>
                    
                    <button onclick="closeModal()" class="w-full py-4 text-gray-500 text-xs font-bold uppercase tracking-widest">Cancelar</button>
                </div>
            `;
            const modal = document.getElementById('modal');
            document.getElementById('modal-content-inner').innerHTML = html;
            modal.classList.remove('hidden');
        } else {
            if (confirm('Deseja excluir esta transação?')) {
                excluirTransacaoAcao(id, 'apenas');
            }
        }
    };

    window.excluirTransacaoAcao = function(id, modo) {
        const p = perfil();
        const t = p.transacoes.find(x => x.id === id);
        if (!t) return;

        if (modo === 'apenas') {
            p.transacoes = p.transacoes.filter(x => x.id !== id);
        } else if (modo === 'proximas') {
            p.transacoes = p.transacoes.filter(x => x.serieId !== t.serieId || new Date(x.data) < new Date(t.data));
        } else if (modo === 'todas') {
            p.transacoes = p.transacoes.filter(x => x.serieId !== t.serieId);
        }

        salvarPessoal();
        renderPessoal();
        if (telaAtual === 'detalhe-conta') {
            const idx = p.contas.findIndex(c => c.id === t.contaId || c.id === t.contaDestinoId);
            if (idx !== -1) abrirTelaConta(idx);
        } else if (telaAtual === 'detalhe-cartao') {
            const idx = p.cartoes.findIndex(c => c.id === t.cartaoId);
            if (idx !== -1) abrirTelaCartao(idx);
        }
        closeModal();
        mostrarToast('Transação excluída com sucesso');
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
      else if (tipo === 'meta') formMeta(content, editIndex);
    };
    window.closeModal = function() { document.getElementById('modal').classList.add('hidden'); };

    // --- FORMULÁRIOS ---
    function formConta(content, editIndex) {
        const p = perfil();
        const c = editIndex !== null ? p.contas[editIndex] : { nome: '', tipo: 'corrente', saldoInicial: 0, cor: '#f59e0b', icone: '🏦' };
        content.innerHTML = `
            <h3 class="text-lg font-bold mb-4">${editIndex !== null ? 'Editar' : 'Nova'} Conta</h3>
            <div class="space-y-3">
                <label class="text-xs text-gray-400">Nome da Conta</label>
                <input id="f-conta-nome" value="${c.nome}" placeholder="Ex: Nubank, Carteira" class="w-full p-3 rounded-xl">
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="text-xs text-gray-400">Ícone</label>
                        <select id="f-conta-icone" class="w-full p-3 rounded-xl">
                            <option value="🏦" ${c.icone==='🏦'?'selected':''}>🏦 Banco</option>
                            <option value="💰" ${c.icone==='💰'?'selected':''}>💰 Dinheiro</option>
                            <option value="💳" ${c.icone==='💳'?'selected':''}>💳 Cartão</option>
                            <option value="📈" ${c.icone==='📈'?'selected':''}>📈 Investimento</option>
                            <option value="🏠" ${c.icone==='🏠'?'selected':''}>🏠 Casa</option>
                            <option value="📱" ${c.icone==='📱'?'selected':''}>📱 Digital</option>
                        </select>
                    </div>
                    <div>
                        <label class="text-xs text-gray-400">Cor</label>
                        <input id="f-conta-cor" type="color" value="${c.cor || '#f59e0b'}" class="w-full h-[48px] p-1 rounded-xl bg-white/5 border-none">
                    </div>
                </div>
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
        const icone = document.getElementById('f-conta-icone').value;
        const cor = document.getElementById('f-conta-cor').value;
        const saldo = parseFloat(document.getElementById('f-conta-saldo').value) || 0;
        if (!nome) return;
        if (idx !== null) p.contas[idx] = { ...p.contas[idx], nome, tipo, icone, cor, saldoInicial: saldo };
        else p.contas.push({ id: Date.now(), nome, tipo, icone, cor, saldoInicial: saldo });
        salvarPessoal(); renderPessoal(); closeModal();
    };

    function formCartao(content, editIndex) {
        const p = perfil();
        const c = editIndex !== null ? p.cartoes[editIndex] : { nome: '', limite: 0, diaFechamento: 1, diaVencimento: 10, utilizado: 0, cor: '#3b82f6', icone: '💳' };
        content.innerHTML = `
            <h3 class="text-lg font-bold mb-4">${editIndex !== null ? 'Editar' : 'Novo'} Cartão</h3>
            <div class="space-y-3">
                <label class="text-xs text-gray-400">Nome do Cartão</label>
                <input id="f-cartao-nome" value="${c.nome}" placeholder="Ex: Visa, Master" class="w-full p-3 rounded-xl">
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="text-xs text-gray-400">Ícone</label>
                        <select id="f-cartao-icone" class="w-full p-3 rounded-xl">
                            <option value="💳" ${c.icone==='💳'?'selected':''}>💳 Cartão</option>
                            <option value="🏦" ${c.icone==='🏦'?'selected':''}>🏦 Banco</option>
                            <option value="🌟" ${c.icone==='🌟'?'selected':''}>🌟 Premium</option>
                            <option value="🛍️" ${c.icone==='🛍️'?'selected':''}>🛍️ Compras</option>
                            <option value="✈️" ${c.icone==='✈️'?'selected':''}>✈️ Viagem</option>
                        </select>
                    </div>
                    <div>
                        <label class="text-xs text-gray-400">Cor</label>
                        <input id="f-cartao-cor" type="color" value="${c.cor || '#3b82f6'}" class="w-full h-[48px] p-1 rounded-xl bg-white/5 border-none">
                    </div>
                </div>
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
        const icone = document.getElementById('f-cartao-icone').value;
        const cor = document.getElementById('f-cartao-cor').value;
        const limite = parseFloat(document.getElementById('f-cartao-limite').value) || 0;
        const diaFechamento = parseInt(document.getElementById('f-cartao-fecha').value) || 1;
        const diaVencimento = parseInt(document.getElementById('f-cartao-vence').value) || 10;
        if (!nome) return;
        if (idx !== null) p.cartoes[idx] = { ...p.cartoes[idx], nome, icone, cor, limite, diaFechamento, diaVencimento };
        else p.cartoes.push({ id: Date.now(), nome, icone, cor, limite, diaFechamento, diaVencimento, utilizado: 0 });
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
                    const serieId = Date.now();
                    p.transacoes.push({
                        id: Date.now() + i,
                        serieId: isParcelado ? serieId : null,
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
                    
                    const serieId = Date.now();
                    p.transacoes.push({
                        id: Date.now() + i,
                        serieId: serieId,
                        tipo,
                        descricao: isParcelado ? `${descricao} (${i+1}/${numParcelas})` : descricao,
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
        
        if (!dadosCompart.regra) dadosCompart.regra = 'proporcional';

        const contasMes = dadosCompart.contas.filter(c => {
            const d = new Date(c.data + 'T00:00:00');
            return d.getMonth() === mesRefCompart && d.getFullYear() === anoRefCompart;
        });

        const resumo = document.getElementById('resumo-mensal-compart');
        const totalDespesas = contasMes.reduce((s, c) => s + c.valor, 0);
        const totalSalarios = dadosCompart.pessoas.reduce((s, p) => s + (p.salario || 0), 0);
        
        let rateioHtml = `
            <div class="flex justify-between mb-2 border-b border-white/5 pb-2">
                <span>Total Despesas:</span>
                <span class="font-bold text-amber-400">${fmt(totalDespesas)}</span>
            </div>
            <div class="flex gap-2 mb-3">
                <button onclick="mudarRegraCompart('proporcional')" class="flex-1 text-[10px] py-1 rounded-md ${dadosCompart.regra==='proporcional'?'bg-amber-500 text-black font-bold':'bg-white/5 text-gray-500'}">PROPORCIONAL</button>
                <button onclick="mudarRegraCompart('igual')" class="flex-1 text-[10px] py-1 rounded-md ${dadosCompart.regra==='igual'?'bg-amber-500 text-black font-bold':'bg-white/5 text-gray-500'}">IGUALITÁRIA</button>
            </div>
        `;
        
        if (dadosCompart.pessoas.length > 0) {
            dadosCompart.pessoas.forEach(p => {
                let valorDevido = 0;
                let info = '';
                if (dadosCompart.regra === 'proporcional') {
                    const percentual = totalSalarios > 0 ? (p.salario || 0) / totalSalarios : 0;
                    valorDevido = totalDespesas * percentual;
                    info = `${(percentual * 100).toFixed(1)}%`;
                } else {
                    valorDevido = totalDespesas / dadosCompart.pessoas.length;
                    info = 'Divisão Igual';
                }
                rateioHtml += `
                    <div class="flex justify-between text-xs py-1">
                        <span class="text-gray-400">${p.nome} (${info}):</span>
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
            const dataVenc = new Date(c.data + 'T00:00:00');
            const hoje = new Date();
            hoje.setHours(0,0,0,0);
            const diffDias = Math.ceil((dataVenc - hoje) / (1000 * 60 * 60 * 24));
            const isUrgente = diffDias <= 3 && diffDias >= 0 && !c.pago;

            return `
                <div class="card-premium rounded-xl p-3 flex justify-between items-center ${c.pago ? 'opacity-50' : ''} ${isUrgente ? 'border-l-4 border-red-500' : ''}">
                    <div class="flex items-center gap-3">
                        <input type="checkbox" ${c.pago ? 'checked' : ''} onchange="togglePagoContaCompart(${originalIdx})" class="w-5 h-5 rounded-lg border-white/10 bg-white/5 text-amber-500">
                        <div>
                            <p class="font-medium ${c.pago ? 'line-through text-gray-500' : ''}">${c.descricao}</p>
                            <div class="flex items-center gap-2">
                                <p class="text-xs text-gray-500">${fmt(c.valor)}</p>
                                <span class="text-[9px] ${isUrgente ? 'text-red-400 font-bold' : 'text-gray-600'}">
                                    📅 ${dataVenc.toLocaleDateString('pt-BR')}
                                    ${isUrgente ? ' (VENCE LOGO!)' : ''}
                                </span>
                            </div>
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
                            <option value="semanal">Semanal</option>
                            <option value="quinzenal">Quinzenal</option>
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
        if (recorrencia !== 'nenhuma') {
            const dataBase = new Date(dataStr + 'T00:00:00');
            const serieId = Date.now();
            const numCiclos = 24;
            for (let i = 0; i < numCiclos; i++) {
                const novaData = new Date(dataBase);
                if (recorrencia === 'semanal') novaData.setDate(dataBase.getDate() + (i * 7));
                else if (recorrencia === 'quinzenal') novaData.setDate(dataBase.getDate() + (i * 15));
                else novaData.setMonth(dataBase.getMonth() + i);
                
                dadosCompart.contas.push({ id: Date.now() + i, serieId, descricao, valor: valorFinal, data: novaData.toISOString().split('T')[0], pago: false });
            }
        } else {
            dadosCompart.contas.push({ id: Date.now(), descricao, valor: valorFinal, data: dataStr, pago: false });
        }
        salvarCompart(); renderCompart(); closeModal();
    };

    window.excluirPessoa = function(i) { dadosCompart.pessoas.splice(i, 1); salvarCompart(); renderCompart(); };
    
    window.excluirContaCompart = function(idx) {
        const c = dadosCompart.contas[idx];
        if (!c) return;

        if (c.serieId) {
            const html = `
                <div class="space-y-6">
                    <div class="text-center">
                        <div class="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </div>
                        <h3 class="text-xl font-bold">Excluir Conta Compartilhada</h3>
                        <p class="text-gray-500 text-sm mt-2">Esta conta faz parte de uma série mensal. Como deseja prosseguir?</p>
                    </div>
                    
                    <div class="grid grid-cols-1 gap-3">
                        <button onclick="excluirContaCompartAcao(${c.id}, 'apenas')" class="w-full card-premium p-4 rounded-2xl text-left hover:border-red-500/50">
                            <p class="font-bold text-sm">Excluir somente esta</p>
                            <p class="text-[10px] text-gray-500">Remove apenas o lançamento selecionado</p>
                        </button>
                        <button onclick="excluirContaCompartAcao(${c.id}, 'proximas')" class="w-full card-premium p-4 rounded-2xl text-left hover:border-red-500/50">
                            <p class="font-bold text-sm">Esta e as próximas</p>
                            <p class="text-[10px] text-gray-500">Remove esta e todos os lançamentos futuros da série</p>
                        </button>
                        <button onclick="excluirContaCompartAcao(${c.id}, 'todas')" class="w-full card-premium p-4 rounded-2xl text-left hover:border-red-500/50">
                            <p class="font-bold text-sm text-red-400">Excluir todas</p>
                            <p class="text-[10px] text-red-400/50">Remove todos os lançamentos passados e futuros desta série</p>
                        </button>
                    </div>
                    
                    <button onclick="closeModal()" class="w-full py-4 text-gray-500 text-xs font-bold uppercase tracking-widest">Cancelar</button>
                </div>
            `;
            const modal = document.getElementById('modal');
            document.getElementById('modal-content-inner').innerHTML = html;
            modal.classList.remove('hidden');
        } else {
            if (confirm('Deseja excluir esta conta?')) {
                excluirContaCompartAcao(c.id, 'apenas');
            }
        }
    };

    window.excluirContaCompartAcao = function(id, modo) {
        const c = dadosCompart.contas.find(x => x.id === id);
        if (!c) return;

        if (modo === 'apenas') {
            dadosCompart.contas = dadosCompart.contas.filter(x => x.id !== id);
        } else if (modo === 'proximas') {
            dadosCompart.contas = dadosCompart.contas.filter(x => x.serieId !== c.serieId || new Date(x.data) < new Date(c.data));
        } else if (modo === 'todas') {
            dadosCompart.contas = dadosCompart.contas.filter(x => x.serieId !== c.serieId);
        }

        salvarCompart();
        renderCompart();
        closeModal();
        mostrarToast('Conta excluída com sucesso');
    };

    function formMeta(content, editIndex) {
        content.innerHTML = `
            <h3 class="text-lg font-bold mb-4">Nova Meta (Caixinha)</h3>
            <div class="space-y-3">
                <label class="text-xs text-gray-400">Nome da Meta</label>
                <input id="f-meta-nome" placeholder="Ex: Viagem, Carro" class="w-full p-3 rounded-xl">
                <label class="text-xs text-gray-400">Valor Objetivo</label>
                <input id="f-meta-obj" type="number" step="0.01" placeholder="0,00" class="w-full p-3 rounded-xl">
                <label class="text-xs text-gray-400">Valor Atual</label>
                <input id="f-meta-atual" type="number" step="0.01" value="0" class="w-full p-3 rounded-xl">
                <button onclick="salvarMeta()" class="w-full bg-amber-500 text-black font-bold py-3 rounded-xl mt-2">Salvar Meta</button>
            </div>
        `;
    }
    window.salvarMeta = function() {
        const nome = document.getElementById('f-meta-nome').value;
        const objetivo = parseFloat(document.getElementById('f-meta-obj').value) || 0;
        const atual = parseFloat(document.getElementById('f-meta-atual').value) || 0;
        if (!nome || objetivo <= 0) return;
        const p = perfil();
        if (!p.metas) p.metas = [];
        p.metas.push({ id: Date.now(), nome, objetivo, atual });
        salvarPessoal(); renderPessoal(); closeModal();
    };

    // Início
    renderLogin();
})();
