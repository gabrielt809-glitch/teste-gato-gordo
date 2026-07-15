(function() {
    let perfis = JSON.parse(localStorage.getItem('gato_gordo_perfis') || '[]');
    let perfilLogado = null;
    let telaAtual = 'pessoal';
    let detalheContaId = null;
    let detalheCartaoId = null;

    // --- Sincronização Compartilhada (Google Sheets via Apps Script) ---
    let syncUrl = localStorage.getItem('gato_gordo_sync_url') || 'https://script.google.com/macros/s/AKfycbyS7pjLcrMj9pnJjfw_uwqFsGCY468_qUN3-k9CinkJ1thGZYNryo_rgcH9u5UxUe6nbw/exec';
    let syncIntervalId = null;
    let syncEmAndamento = false;
    
    // Função Centralizada para Controle de UI
    function updateUIState(novaTela) {
        if (novaTela) telaAtual = novaTela;
        
        const fab = document.getElementById('fab-container');
        const abas = document.getElementById('app-abas');
        const detalhe = document.getElementById('tela-detalhe');
        const barraInf = document.getElementById('barra-inferior');
        const btnVoltar = document.getElementById('btn-voltar');
        const subtitulo = document.getElementById('subtitulo-header');

        // Lógica Absoluta de Visibilidade
        if (telaAtual === 'pessoal') {
            if (fab) { fab.classList.remove('hidden'); fab.classList.remove('bottom-6'); fab.classList.add('bottom-24'); }
            if (abas) abas.classList.remove('hidden');
            if (detalhe) detalhe.classList.add('hidden');
            if (barraInf) barraInf.classList.remove('hidden');
            if (btnVoltar) btnVoltar.classList.add('hidden');
            if (subtitulo) subtitulo.textContent = 'Finanças Pessoais';
        } 
        else if (telaAtual === 'compartilhado') {
            if (fab) fab.classList.add('hidden');
            if (abas) abas.classList.remove('hidden');
            if (detalhe) detalhe.classList.add('hidden');
            if (barraInf) barraInf.classList.remove('hidden');
            if (btnVoltar) btnVoltar.classList.add('hidden');
            if (subtitulo) subtitulo.textContent = 'Finanças Compartilhadas';
        }
        else if (telaAtual === 'detalhe-conta' || telaAtual === 'detalhe-cartao') {
            if (fab) { fab.classList.remove('hidden'); fab.classList.remove('bottom-24'); fab.classList.add('bottom-6'); } // Reaproveita o FAB persistente (não fica preso na animação da tela)
            const fabMenu = document.getElementById('fab-menu');
            if (fabMenu) { fabMenu.classList.add('hidden'); fabMenu.classList.remove('flex'); }
            const fabIcon = document.getElementById('fab-icon');
            if (fabIcon) fabIcon.style.transform = 'rotate(0deg)';
            if (abas) abas.classList.add('hidden');
            if (detalhe) detalhe.classList.remove('hidden');
            if (barraInf) barraInf.classList.add('hidden');
            if (btnVoltar) btnVoltar.classList.remove('hidden');
            if (subtitulo) subtitulo.textContent = telaAtual === 'detalhe-conta' ? 'Extrato' : 'Cartão';
        }
        else if (telaAtual === 'login') {
            if (fab) fab.classList.add('hidden');
            document.getElementById('app-container').classList.add('hidden');
            document.getElementById('login-screen').classList.remove('hidden');
        }
    }
    let mesRefPessoal = new Date().getMonth();
    let anoRefPessoal = new Date().getFullYear();
    let mesRefCompart = new Date().getMonth();
    let anoRefCompart = new Date().getFullYear();
    let myChart = null;

    // --- Grupos Compartilhados (múltiplos, independentes entre si) ---
    // Cada grupo tem: id (código curto pra convite), nome, pessoas, contas, regra.
    let gruposCompart = JSON.parse(localStorage.getItem('gato_gordo_grupos') || 'null');
    if (!gruposCompart) {
        // Migração: quem já usava a versão com um único grupo compartilhado vira o primeiro grupo.
        const antigo = JSON.parse(localStorage.getItem('gato_gordo_compart') || 'null');
        gruposCompart = [{
            id: gerarIdGrupo(),
            nome: 'Compartilhado',
            pessoas: (antigo && antigo.pessoas) || [],
            contas: (antigo && antigo.contas) || [],
            regra: (antigo && antigo.regra) || 'proporcional'
        }];
    }
    let grupoAtivoId = localStorage.getItem('gato_gordo_grupo_ativo') || (gruposCompart[0] && gruposCompart[0].id) || null;
    let syncTimestamps = JSON.parse(localStorage.getItem('gato_gordo_sync_ts_map') || '{}');

    function salvarPerfis() { localStorage.setItem('gato_gordo_perfis', JSON.stringify(perfis)); }

    function gerarIdGrupo() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    function grupoAtivo() {
        return gruposCompart.find(g => g.id === grupoAtivoId) || gruposCompart[0];
    }

    function salvarGrupos() {
        localStorage.setItem('gato_gordo_grupos', JSON.stringify(gruposCompart));
    }

    function salvarCompart() {
        salvarGrupos();
        syncEnviar();
    }

    // Envia o estado do grupo ativo pra planilha (cada grupo fica numa linha própria, identificado pelo id).
    async function syncEnviar() {
        const g = grupoAtivo();
        if (!syncUrl || !g) return;
        try {
            const resp = await fetch(syncUrl, {
                method: 'POST',
                body: JSON.stringify({ grupoId: g.id, dados: { nome: g.nome, pessoas: g.pessoas, contas: g.contas, regra: g.regra } })
            });
            const json = await resp.json();
            if (json && json.timestamp) {
                syncTimestamps[g.id] = json.timestamp;
                localStorage.setItem('gato_gordo_sync_ts_map', JSON.stringify(syncTimestamps));
            }
        } catch (e) {
            console.warn('Falha ao sincronizar (enviar):', e);
        }
    }

    // Confere se tem algo mais novo na planilha pro grupo ativo e, se tiver, baixa e atualiza a tela.
    async function syncVerificarEBaixar(forcar) {
        const g = grupoAtivo();
        if (!syncUrl || !g || syncEmAndamento) return;
        syncEmAndamento = true;
        try {
            const respTs = await fetch(`${syncUrl}?acao=timestamp&grupoId=${g.id}`);
            const jsonTs = await respTs.json();
            const remoto = jsonTs.timestamp || 0;
            const ultimoLocal = syncTimestamps[g.id] || 0;
            if (forcar || remoto > ultimoLocal) {
                const resp = await fetch(`${syncUrl}?grupoId=${g.id}`);
                const json = await resp.json();
                const novosDados = JSON.parse(json.dados || '{}');
                if (novosDados && (novosDados.pessoas || novosDados.contas)) {
                    g.pessoas = novosDados.pessoas || [];
                    g.contas = novosDados.contas || [];
                    if (novosDados.regra) g.regra = novosDados.regra;
                    salvarGrupos();
                }
                syncTimestamps[g.id] = json.timestamp || remoto;
                localStorage.setItem('gato_gordo_sync_ts_map', JSON.stringify(syncTimestamps));
                if (telaAtual === 'compartilhado') renderCompart();
            }
        } catch (e) {
            console.warn('Falha ao sincronizar (baixar):', e);
        } finally {
            syncEmAndamento = false;
        }
    }

    function iniciarPollingSync() {
        if (!syncUrl || syncIntervalId) return;
        syncVerificarEBaixar(false);
        syncIntervalId = setInterval(() => syncVerificarEBaixar(false), 7000);
    }

    function pararPollingSync() {
        if (syncIntervalId) { clearInterval(syncIntervalId); syncIntervalId = null; }
    }

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) pararPollingSync();
        else if (telaAtual === 'compartilhado') iniciarPollingSync();
    });

    window.abrirConfigSync = function() {
        const modal = document.getElementById('modal');
        const content = document.getElementById('modal-content-inner');
        modal.classList.remove('hidden');
        content.innerHTML = `
            <h3 class="text-lg font-bold mb-2">Sincronização Compartilhada</h3>
            <p class="text-xs text-gray-500 mb-4">Cole aqui o link do Apps Script gerado a partir da planilha do Google Sheets. Esse mesmo link deve ser colado no aparelho da outra pessoa pra sincronizar os dois.</p>
            <input id="f-sync-url" value="${syncUrl || ''}" placeholder="https://script.google.com/macros/s/..." class="w-full p-3 rounded-xl mb-3 text-xs">
            <button onclick="salvarConfigSync()" class="w-full bg-amber-500 text-black font-bold py-3 rounded-xl mb-2">Salvar e Sincronizar</button>
            ${syncUrl ? `
            <button onclick="copiarLinkConvite()" class="w-full bg-white/5 text-xs font-bold py-3 rounded-xl mb-2">📋 Copiar link para convidar</button>
            <button onclick="desconectarSync()" class="w-full text-red-400 text-xs font-bold py-3 rounded-xl">Desconectar</button>` : ''}
        `;
    };

    window.salvarConfigSync = function() {
        const url = document.getElementById('f-sync-url').value.trim();
        if (!url) return;
        syncUrl = url;
        localStorage.setItem('gato_gordo_sync_url', url);
        closeModal();
        mostrarToast('Sincronização configurada! Buscando dados...');
        syncVerificarEBaixar(true);
        if (telaAtual === 'compartilhado') iniciarPollingSync();
    };

    window.copiarLinkConvite = function() {
        if (!syncUrl) return;
        navigator.clipboard.writeText(syncUrl).then(() => mostrarToast('Link copiado! Envie pra quem vai compartilhar com você.'));
    };

    window.desconectarSync = function() {
        syncUrl = null;
        localStorage.removeItem('gato_gordo_sync_url');
        pararPollingSync();
        closeModal();
        mostrarToast('Sincronização desconectada');
    };
    function perfil() { return perfis.find(p => p.nome === perfilLogado); }
    function salvarPessoal() { salvarPerfis(); }

    function fmt(v) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v); }

    // --- Extrato agrupado por dia (usado nas telas de conta e cartão) ---
    function agruparTransacoesPorDia(transacoes) {
        const ordenadas = transacoes.slice().sort((a, b) => {
            const diffData = new Date(b.data) - new Date(a.data);
            if (diffData !== 0) return diffData;
            return (b.id || 0) - (a.id || 0);
        });
        const grupos = [];
        let grupoAtual = null;
        ordenadas.forEach(t => {
            if (!grupoAtual || grupoAtual.data !== t.data) {
                grupoAtual = { data: t.data, transacoes: [] };
                grupos.push(grupoAtual);
            }
            grupoAtual.transacoes.push(t);
        });
        return grupos;
    }

    function formatarCabecalhoDia(dataStr) {
        const data = new Date(dataStr + 'T00:00:00');
        const hoje = new Date(); hoje.setHours(0,0,0,0);
        const ontem = new Date(hoje); ontem.setDate(ontem.getDate() - 1);
        const dataPorExtenso = data.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
        if (data.getTime() === hoje.getTime()) return `Hoje, ${dataPorExtenso}`;
        if (data.getTime() === ontem.getTime()) return `Ontem, ${dataPorExtenso}`;
        const texto = data.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
        return texto.charAt(0).toUpperCase() + texto.slice(1).replace('.', '');
    }

    // contexto.contaId (opcional): usado pra saber se uma transferência é entrada ou saída daquela conta.
    function linhaExtratoHtml(t, contexto) {
        contexto = contexto || {};
        const isReceita = t.tipo === 'receita' || (t.tipo === 'transferencia' && contexto.contaId && t.contaDestinoId === contexto.contaId);
        const icone = t.tipo === 'transferencia' ? '⇄' : (isReceita ? '↑' : '↓');
        return `
            <div class="card-premium rounded-xl p-3 flex justify-between items-center">
                <div class="flex items-center gap-3 min-w-0">
                    <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isReceita ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}">${icone}</div>
                    <p class="text-sm font-medium truncate">${t.descricao}</p>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                    <p class="text-sm font-bold ${isReceita ? 'text-green-400' : 'text-red-400'}">${isReceita ? '+' : '-'} ${fmt(Math.abs(t.valor))}</p>
                    <button onclick="openModal('transacao', ${t.id})" class="text-gray-600 hover:text-amber-400 transition-colors p-1">✎</button>
                    <button onclick="confirmarExcluirTransacao(${t.id})" class="text-gray-600 hover:text-red-400 transition-colors p-1">✕</button>
                </div>
            </div>
        `;
    }

    function renderExtratoAgrupadoHtml(transacoes, contexto) {
        const grupos = agruparTransacoesPorDia(transacoes);
        if (grupos.length === 0) return '<p class="text-gray-500 text-center py-4 text-sm">Nenhuma transação neste período</p>';
        return grupos.map(grupo => {
            const totalDia = grupo.transacoes.reduce((s, t) => {
                const isReceita = t.tipo === 'receita' || (t.tipo === 'transferencia' && contexto && contexto.contaId && t.contaDestinoId === contexto.contaId);
                return s + (isReceita ? t.valor : -t.valor);
            }, 0);
            return `
                <div class="mb-4 last:mb-0">
                    <div class="flex justify-between items-center px-1 mb-2">
                        <h4 class="text-[11px] font-bold text-gray-500 uppercase tracking-wider">${formatarCabecalhoDia(grupo.data)}</h4>
                        <span class="text-[11px] font-semibold ${totalDia >= 0 ? 'text-green-400' : 'text-red-400'}">${totalDia >= 0 ? '+' : '-'} ${fmt(Math.abs(totalDia))}</span>
                    </div>
                    <div class="space-y-2">
                        ${grupo.transacoes.map(t => linhaExtratoHtml(t, contexto)).join('')}
                    </div>
                </div>
            `;
        }).join('');
    }
    function nomeMesAno(m, a) {
        const meses = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
        return `${meses[m]} de ${a}`;
    }

    // --- LOGIN / ONBOARDING (um único perfil por aparelho) ---
    let onboardingNomeTemp = '';
    let pinBuffer = '';
    let pinOnComplete = null;
    let pinContainerAtivo = null;

    // Teclado numérico próprio (0-9) pra digitar o PIN sem nunca abrir o teclado nativo do aparelho.
    function renderPinPad(container, titulo, subtitulo, onComplete) {
        pinBuffer = '';
        pinOnComplete = onComplete;
        pinContainerAtivo = container;
        container.innerHTML = `
            <div class="login-step">
                <div class="text-center mb-8">
                    <h3 class="text-xl font-bold tracking-tight">${titulo}</h3>
                    ${subtitulo ? `<p class="text-xs text-gray-500 mt-2">${subtitulo}</p>` : ''}
                </div>
                <div class="flex justify-center gap-4 mb-10">
                    ${[0,1,2,3].map(() => `<div class="pin-dot w-4 h-4 rounded-full border-2 border-white/15"></div>`).join('')}
                </div>
                <div class="grid grid-cols-3 gap-4 max-w-[260px] mx-auto">
                    ${[1,2,3,4,5,6,7,8,9].map(n => `<button type="button" onclick="pinDigitar(${n})" class="pin-key aspect-square rounded-2xl bg-white/[0.04] border border-white/5 text-2xl font-semibold">${n}</button>`).join('')}
                    <div></div>
                    <button type="button" onclick="pinDigitar(0)" class="pin-key aspect-square rounded-2xl bg-white/[0.04] border border-white/5 text-2xl font-semibold">0</button>
                    <button type="button" onclick="pinApagar()" class="pin-key aspect-square rounded-2xl flex items-center justify-center text-xl text-gray-400">⌫</button>
                </div>
            </div>
        `;
    }

    function atualizarPontosPin() {
        if (!pinContainerAtivo) return;
        pinContainerAtivo.querySelectorAll('.pin-dot').forEach((dot, i) => {
            const preenchido = i < pinBuffer.length;
            dot.classList.toggle('bg-amber-500', preenchido);
            dot.classList.toggle('border-amber-500', preenchido);
            dot.classList.toggle('pin-filled', preenchido);
        });
    }

    window.pinDigitar = function(n) {
        if (pinBuffer.length >= 4) return;
        pinBuffer += String(n);
        atualizarPontosPin();
        if (pinBuffer.length === 4) {
            const valor = pinBuffer;
            setTimeout(() => pinOnComplete && pinOnComplete(valor), 150);
        }
    };

    window.pinApagar = function() {
        pinBuffer = pinBuffer.slice(0, -1);
        atualizarPontosPin();
    };

    // Feedback de PIN correto: os pontos piscam em verde antes de avançar.
    function pinSucesso(onFim) {
        if (!pinContainerAtivo) { onFim && onFim(); return; }
        const dots = pinContainerAtivo.querySelectorAll('.pin-dot');
        dots.forEach(d => d.classList.add('pin-sucesso'));
        setTimeout(() => onFim && onFim(), 220);
    }

    // Feedback de PIN incorreto: os pontos tremem e piscam em vermelho, depois reseta.
    function pinErro(onRetry) {
        if (!pinContainerAtivo) { pinBuffer = ''; onRetry && onRetry(); return; }
        const wrapper = pinContainerAtivo.querySelector('.pin-dot')?.parentElement;
        const dots = pinContainerAtivo.querySelectorAll('.pin-dot');
        dots.forEach(d => d.classList.add('pin-erro'));
        wrapper?.classList.add('pin-shake');
        if (navigator.vibrate) navigator.vibrate(200);
        setTimeout(() => {
            pinBuffer = '';
            onRetry && onRetry();
        }, 500);
    }

    window.renderLogin = function() {
        const container = document.getElementById('login-form');
        if (perfis.length === 0) {
            // Primeiro acesso: só pergunta o nome.
            container.innerHTML = `
                <div class="space-y-4 login-step">
                    <div class="space-y-2">
                        <label class="text-[10px] text-gray-500 uppercase tracking-widest ml-2">Como podemos te chamar?</label>
                        <input id="new-perfil-nome" placeholder="Ex: Gabriel" class="w-full p-4 rounded-2xl bg-white/5 border border-white/10 focus:border-amber-500 transition-all outline-none">
                    </div>
                    <button onclick="onboardingNomeContinuar()" class="w-full bg-amber-500 text-black font-bold py-4 rounded-2xl shadow-lg shadow-amber-500/20 active:scale-95 transition-transform">Continuar</button>
                </div>
            `;
            document.getElementById('new-perfil-nome')?.focus();
        } else {
            // Só existe um perfil por aparelho: ou pede o PIN, ou entra direto.
            const p = perfis[0];
            perfilLogado = p.nome;
            if (p.senhaAtiva && p.pin) {
                mostrarPinDesbloqueio(p);
            } else {
                logarSucesso();
            }
        }
    };

    function mostrarPinDesbloqueio(p) {
        const container = document.getElementById('login-form');
        renderPinPad(container, `Olá, ${p.nome}`, 'Digite seu PIN para entrar', (pin) => {
            if (pin === p.pin) {
                pinSucesso(() => logarSucesso());
            } else {
                pinErro(() => mostrarPinDesbloqueio(p));
            }
        });
    }

    window.onboardingNomeContinuar = function() {
        const nome = document.getElementById('new-perfil-nome').value.trim();
        if (!nome) return alert('Digite seu nome');
        onboardingNomeTemp = nome;
        mostrarEtapaSenhaOnboarding();
    };

    function mostrarEtapaSenhaOnboarding() {
        const container = document.getElementById('login-form');
        container.innerHTML = `
            <div class="space-y-5 text-center login-step">
                <div class="space-y-2">
                    <h3 class="text-xl font-bold tracking-tight">Proteger o app com PIN?</h3>
                    <p class="text-xs text-gray-500 leading-relaxed px-2">Um PIN de 4 números protege o acesso ao abrir o app. Dá pra mudar isso depois em Configurações.</p>
                </div>
                <div class="grid grid-cols-1 gap-3 pt-2">
                    <button onclick="onboardingEscolherSenha(true)" class="w-full bg-amber-500 text-black font-bold py-4 rounded-2xl shadow-lg shadow-amber-500/20 active:scale-95 transition-transform flex items-center justify-center gap-2">
                        <span>🔒</span> Sim, quero um PIN
                    </button>
                    <button onclick="onboardingEscolherSenha(false)" class="w-full card-premium text-white font-bold py-4 rounded-2xl active:scale-95 transition-transform">Não, entrar direto</button>
                </div>
            </div>
        `;
    }

    window.onboardingEscolherSenha = function(querPin) {
        if (!querPin) {
            criarPerfilFinal(false, null);
            return;
        }
        onboardingCriarPin();
    };

    function onboardingCriarPin() {
        const container = document.getElementById('login-form');
        renderPinPad(container, 'Crie seu PIN', 'Escolha 4 números', (pin1) => {
            renderPinPad(container, 'Confirme seu PIN', 'Digite novamente para confirmar', (pin2) => {
                if (pin1 === pin2) {
                    pinSucesso(() => criarPerfilFinal(true, pin1));
                } else {
                    mostrarToast('Os PINs não coincidem, tente de novo');
                    onboardingCriarPin();
                }
            });
        });
    }

    function criarPerfilFinal(senhaAtiva, pin) {
        // Categorias padrão com limites zerados
        const categoriasPadrao = [
            { id: 1, nome: 'Alimentação', icone: '🍎', limite: 0 },
            { id: 2, nome: 'Lazer', icone: '🍿', limite: 0 },
            { id: 3, nome: 'Saúde', icone: '🏥', limite: 0 },
            { id: 4, nome: 'Transporte', icone: '🚗', limite: 0 },
            { id: 5, nome: 'Educação', icone: '📚', limite: 0 },
            { id: 6, nome: 'Moradia', icone: '🏠', limite: 0 },
            { id: 7, nome: 'Outros', icone: '📦', limite: 0 }
        ];

        perfis.push({
            nome: onboardingNomeTemp,
            senhaAtiva,
            pin,
            contas: [],
            cartoes: [],
            transacoes: [],
            metas: [],
            categorias: categoriasPadrao
        });
        perfilLogado = onboardingNomeTemp;
        salvarPerfis();
        logarSucesso();
    }

    function logarSucesso() {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        updateUIState('pessoal');
        renderPessoal();
        verificarNotificacoes();
        verificarConviteLink();
        syncVerificarEBaixar(false);
    }

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
        const dados = { perfis, grupos: gruposCompart };
        const blob = new Blob([JSON.stringify(dados)], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `backup_gato_gordo_${new Date().getTime()}.json`;
        link.click();
        mostrarToast('☁️ Backup baixado com sucesso!');
    };

    window.mudarRegraCompart = function(regra) {
        grupoAtivo().regra = regra;
        salvarCompart(); renderCompart();
    };

    // "Sair" agora bloqueia o app (pede o PIN de novo), já que só existe 1 perfil por aparelho.
    window.logout = function() {
        updateUIState('login');
        renderLogin();
    };

    // --- SEGURANÇA (PIN) ---
    function abrirModalPin(titulo, subtitulo, onComplete) {
        const modal = document.getElementById('modal');
        const content = document.getElementById('modal-content-inner');
        modal.classList.remove('hidden');
        renderPinPad(content, titulo, subtitulo, onComplete);
    }

    function abrirFluxoCriarPin(onFinalizado) {
        const modal = document.getElementById('modal');
        const content = document.getElementById('modal-content-inner');
        modal.classList.remove('hidden');
        renderPinPad(content, 'Crie um novo PIN', 'Escolha 4 números', (pin1) => {
            renderPinPad(content, 'Confirme o novo PIN', 'Digite novamente para confirmar', (pin2) => {
                if (pin1 === pin2) {
                    onFinalizado(pin1);
                } else {
                    mostrarToast('Os PINs não coincidem, tente de novo');
                    abrirFluxoCriarPin(onFinalizado);
                }
            });
        });
    }

    window.toggleSenhaAtiva = function() {
        const p = perfil();
        if (p.senhaAtiva) {
            const tentar = () => {
                abrirModalPin('Confirme seu PIN atual', 'Digite o PIN para desativar o bloqueio', (pin) => {
                    if (pin === p.pin) {
                        pinSucesso(() => {
                            p.senhaAtiva = false;
                            p.pin = null;
                            salvarPerfis(); closeModal(); abrirMenu();
                            mostrarToast('Bloqueio por PIN desativado');
                        });
                    } else {
                        pinErro(tentar);
                    }
                });
            };
            tentar();
        } else {
            abrirFluxoCriarPin((novoPin) => {
                p.senhaAtiva = true;
                p.pin = novoPin;
                salvarPerfis(); closeModal(); abrirMenu();
                mostrarToast('Bloqueio por PIN ativado');
            });
        }
    };

    window.iniciarAlterarPin = function() {
        const p = perfil();
        const tentar = () => {
            abrirModalPin('Confirme seu PIN atual', 'Digite o PIN atual para continuar', (pinAtual) => {
                if (pinAtual !== p.pin) {
                    pinErro(tentar);
                    return;
                }
                pinSucesso(() => {
                    abrirFluxoCriarPin((novoPin) => {
                        p.pin = novoPin;
                        salvarPerfis(); closeModal();
                        mostrarToast('PIN alterado com sucesso');
                    });
                });
            });
        };
        tentar();
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
                    <button onclick="abrirCategorias()" class="w-full card-premium p-4 rounded-2xl flex items-center gap-4">
                        <span class="text-xl">🏷️</span>
                        <div class="text-left">
                            <p class="font-bold text-sm">Categorias e Limites</p>
                            <p class="text-[10px] text-gray-500">Definir tetos de gastos mensais</p>
                        </div>
                    </button>

                    <div class="w-full card-premium p-4 rounded-2xl flex items-center justify-between gap-4">
                        <div class="flex items-center gap-4">
                            <span class="text-xl">🔒</span>
                            <div class="text-left">
                                <p class="font-bold text-sm">Bloqueio por PIN</p>
                                <p class="text-[10px] text-gray-500">${p.senhaAtiva ? 'Ativado' : 'Desativado'}</p>
                            </div>
                        </div>
                        <button onclick="toggleSenhaAtiva()" class="w-12 h-7 rounded-full relative transition-all shrink-0 ${p.senhaAtiva ? 'bg-amber-500' : 'bg-white/10'}">
                            <span class="absolute top-1 ${p.senhaAtiva ? 'right-1' : 'left-1'} w-5 h-5 bg-white rounded-full transition-all"></span>
                        </button>
                    </div>
                    ${p.senhaAtiva ? `
                    <button onclick="iniciarAlterarPin()" class="w-full card-premium p-4 rounded-2xl flex items-center gap-4">
                        <span class="text-xl">🔑</span>
                        <div class="text-left">
                            <p class="font-bold text-sm">Alterar PIN</p>
                            <p class="text-[10px] text-gray-500">Definir um novo PIN de acesso</p>
                        </div>
                    </button>
                    <button onclick="logout()" class="w-full card-premium p-4 rounded-2xl flex items-center gap-4 text-red-400">
                        <span class="text-xl">🚪</span>
                        <div class="text-left">
                            <p class="font-bold text-sm">Bloquear App</p>
                            <p class="text-[10px] text-red-400/50">Exigir o PIN para acessar novamente</p>
                        </div>
                    </button>` : ''}

                    <button onclick="abrirConfigSync()" class="w-full card-premium p-4 rounded-2xl flex items-center gap-4">
                        <span class="text-xl">🔗</span>
                        <div class="text-left">
                            <p class="font-bold text-sm">Sincronização Compartilhada</p>
                            <p class="text-[10px] text-gray-500">${syncUrl ? 'Conectado' : 'Não configurado'}</p>
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

        const receitas = transMes.filter(t => t.tipo === 'receita' && t.categoria !== 'Metas').reduce((s, t) => s + t.valor, 0);
        const despesas = transMes.filter(t => (t.tipo === 'despesa' || t.tipo === 'despesa-cartao') && t.categoria !== 'Metas').reduce((s, t) => s + t.valor, 0);
        
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
                    <button onclick="abrirGuardarMeta(${i})" class="flex-1 bg-amber-500/10 text-amber-400 py-1 rounded-lg text-[10px] font-bold">GUARDAR</button>
                    <button onclick="abrirResgatarMeta(${i})" class="flex-1 bg-white/5 text-gray-300 py-1 rounded-lg text-[10px] font-bold">RESGATAR</button>
                    <button onclick="excluirMeta(${i})" class="text-red-400/50 text-[10px] px-2">✕</button>
                </div>
            </div>
        `).join('') || '<p class="text-gray-500 text-center py-4 text-sm">Nenhuma meta criada ainda</p>';

        // Inserir Limites de Categoria
        const listaLimites = document.getElementById('lista-limites');
        if (listaLimites) {
            const categoriasComLimite = (p.categorias || []).filter(c => c.limite > 0);
            listaLimites.innerHTML = categoriasComLimite.map(cat => {
                const gastoCat = transMes.filter(t => t.categoria === cat.nome && (t.tipo === 'despesa' || t.tipo === 'despesa-cartao')).reduce((s, t) => s + t.valor, 0);
                const pct = Math.min((gastoCat / cat.limite) * 100, 100);
                const cor = pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-orange-500' : 'bg-green-500';
                return `
                    <div class="card-premium rounded-2xl p-4">
                        <div class="flex justify-between items-center mb-2">
                            <div class="flex items-center gap-2">
                                <span>${cat.icone}</span>
                                <p class="font-medium text-sm">${cat.nome}</p>
                            </div>
                            <p class="text-[10px] ${pct >= 100 ? 'text-red-400 font-bold' : 'text-gray-400'}">${fmt(gastoCat)} / ${fmt(cat.limite)}</p>
                        </div>
                        <div class="progress-bar"><div class="progress-fill ${cor}" style="width:${pct}%"></div></div>
                    </div>
                `;
            }).join('') || '<p class="text-gray-500 text-center py-4 text-sm">Nenhum limite definido — defina em "Gerenciar"</p>';
        }


        updateChart(transMes);
    };

    function updateChart(trans) {
        const ctx = document.getElementById('chart-gastos');
        if (!ctx) return;
        
        const categorias = {};
        trans.filter(t => (t.tipo === 'despesa' || t.tipo === 'despesa-cartao') && t.categoria !== 'Metas').forEach(t => {
            const cat = t.categoria || 'Outros';
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

    window.abrirGuardarMeta = function(idx) {
        const p = perfil();
        const m = p.metas[idx];
        if (!p.contas.length) return alert('Cadastre uma conta primeiro');
        const modal = document.getElementById('modal');
        const content = document.getElementById('modal-content-inner');
        modal.classList.remove('hidden');
        content.innerHTML = `
            <h3 class="text-lg font-bold mb-1">Guardar em "${m.nome}"</h3>
            <p class="text-xs text-gray-500 mb-4">O valor sai da conta escolhida e vai pra essa meta.</p>
            <label class="text-xs text-gray-400">Valor</label>
            <input id="f-meta-valor" type="number" step="0.01" placeholder="0,00" class="w-full p-3 rounded-xl mb-3 mt-1">
            <label class="text-xs text-gray-400">De qual conta sai o dinheiro?</label>
            <select id="f-meta-conta" class="w-full p-3 rounded-xl mb-3 mt-1">
                ${p.contas.map(c => `<option value="${c.id}">${c.nome}</option>`).join('')}
            </select>
            <button onclick="confirmarGuardarMeta(${idx})" class="w-full bg-amber-500 text-black font-bold py-3 rounded-xl">Guardar</button>
        `;
    };

    window.confirmarGuardarMeta = function(idx) {
        const p = perfil();
        const m = p.metas[idx];
        const valor = parseFloat(document.getElementById('f-meta-valor').value);
        const contaId = parseInt(document.getElementById('f-meta-conta').value);
        if (!valor || valor <= 0 || !contaId) return alert('Preencha os campos corretamente');

        p.transacoes.push({
            id: Date.now(),
            tipo: 'despesa',
            descricao: `Guardado na meta "${m.nome}"`,
            valor,
            data: new Date().toISOString().split('T')[0],
            contaId,
            categoria: 'Metas'
        });
        m.atual += valor;

        salvarPessoal();
        closeModal();
        renderPessoal();
        atualizarTelaDetalheAposSalvar(contaId, null);
        mostrarToast(`${fmt(valor)} guardado em "${m.nome}"`);
    };

    window.abrirResgatarMeta = function(idx) {
        const p = perfil();
        const m = p.metas[idx];
        if (m.atual <= 0) return mostrarToast('Essa meta ainda não tem saldo pra resgatar');
        if (!p.contas.length) return alert('Cadastre uma conta primeiro');
        const modal = document.getElementById('modal');
        const content = document.getElementById('modal-content-inner');
        modal.classList.remove('hidden');
        content.innerHTML = `
            <h3 class="text-lg font-bold mb-1">Resgatar de "${m.nome}"</h3>
            <p class="text-xs text-gray-500 mb-4">O valor sai dessa meta e volta pra conta escolhida. Disponível: ${fmt(m.atual)}</p>
            <label class="text-xs text-gray-400">Valor</label>
            <input id="f-meta-valor-resgate" type="number" step="0.01" max="${m.atual}" placeholder="0,00" class="w-full p-3 rounded-xl mb-3 mt-1">
            <label class="text-xs text-gray-400">Pra qual conta vai o dinheiro?</label>
            <select id="f-meta-conta-resgate" class="w-full p-3 rounded-xl mb-3 mt-1">
                ${p.contas.map(c => `<option value="${c.id}">${c.nome}</option>`).join('')}
            </select>
            <button onclick="confirmarResgatarMeta(${idx})" class="w-full bg-amber-500 text-black font-bold py-3 rounded-xl">Resgatar</button>
        `;
    };

    window.confirmarResgatarMeta = function(idx) {
        const p = perfil();
        const m = p.metas[idx];
        const valor = parseFloat(document.getElementById('f-meta-valor-resgate').value);
        const contaId = parseInt(document.getElementById('f-meta-conta-resgate').value);
        if (!valor || valor <= 0 || !contaId) return alert('Preencha os campos corretamente');
        if (valor > m.atual) return alert('Esse valor é maior do que o disponível na meta');

        p.transacoes.push({
            id: Date.now(),
            tipo: 'receita',
            descricao: `Resgatado da meta "${m.nome}"`,
            valor,
            data: new Date().toISOString().split('T')[0],
            contaId,
            categoria: 'Metas'
        });
        m.atual -= valor;

        salvarPessoal();
        closeModal();
        renderPessoal();
        atualizarTelaDetalheAposSalvar(contaId, null);
        mostrarToast(`${fmt(valor)} resgatado de "${m.nome}"`);
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
        updateUIState(tab);

        const tabPessoal = document.getElementById('tab-pessoal');
        const tabCompart = document.getElementById('tab-compartilhado');
        const btnPessoal = document.getElementById('btn-pessoal');
        const btnCompart = document.getElementById('btn-compartilhado');

        if (tab === 'pessoal') {
            if (tabPessoal) tabPessoal.classList.remove('hidden');
            if (tabCompart) tabCompart.classList.add('hidden');
            if (btnPessoal) { btnPessoal.classList.add('tab-active'); btnPessoal.classList.remove('text-gray-400'); }
            if (btnCompart) { btnCompart.classList.remove('tab-active'); btnCompart.classList.add('text-gray-400'); }
            renderPessoal();
            pararPollingSync();
        } else {
            if (tabCompart) tabCompart.classList.remove('hidden');
            if (tabPessoal) tabPessoal.classList.add('hidden');
            if (btnCompart) { btnCompart.classList.add('tab-active'); btnCompart.classList.remove('text-gray-400'); }
            if (btnPessoal) { btnPessoal.classList.remove('tab-active'); btnPessoal.classList.add('text-gray-400'); }
            renderCompart();
            iniciarPollingSync();
            const p = perfil();
            if (p && !p.viuOnboardingCompart) {
                p.viuOnboardingCompart = true;
                salvarPessoal();
                setTimeout(() => mostrarOnboardingCompart(), 300);
            }
        }
    };

    window.abrirTelaCartao = function(idx) {
      const p = perfil();
      const cartao = p.cartoes[idx];
      if (!cartao) return;
      detalheCartaoId = cartao.id;
      detalheContaId = null;
      
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
                ${renderExtratoAgrupadoHtml(transCartaoMes, {})}
            </div>
          </div>
          
          <button onclick="voltarParaApp()" class="w-full glass py-3 rounded-xl text-gray-400 text-sm">Voltar</button>
        </div>
      `;
      document.getElementById('detalhe-conteudo').innerHTML = html;
      updateUIState('detalhe-cartao');
    };

    window.abrirTelaConta = function(idx) {
        const conta = perfil()?.contas[idx];
        if (!conta) return;
        detalheContaId = conta.id;
        detalheCartaoId = null;
        
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
                    <h3 class="text-lg font-semibold px-1">Extrato do Mês</h3>
                    <div>
                        ${renderExtratoAgrupadoHtml(transContaMes, { contaId: conta.id })}
                    </div>
                </div>

                <button onclick="voltarParaApp()" class="w-full glass py-3 rounded-xl text-gray-400 text-sm">Voltar</button>
            </div>
        `;
        document.getElementById('detalhe-conteudo').innerHTML = html;
        updateUIState('detalhe-conta');
    };

    window.voltarParaApp = function() {
        if (telaAtual === 'detalhe-conta' || telaAtual === 'detalhe-cartao') {
            updateUIState('pessoal');
        } else {
            updateUIState(telaAtual);
        }
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

        let removidas = [];
        if (modo === 'apenas') {
            removidas = p.transacoes.filter(x => x.id === id);
            p.transacoes = p.transacoes.filter(x => x.id !== id);
        } else if (modo === 'proximas') {
            removidas = p.transacoes.filter(x => x.serieId === t.serieId && new Date(x.data) >= new Date(t.data));
            p.transacoes = p.transacoes.filter(x => x.serieId !== t.serieId || new Date(x.data) < new Date(t.data));
        } else if (modo === 'todas') {
            removidas = p.transacoes.filter(x => x.serieId === t.serieId);
            p.transacoes = p.transacoes.filter(x => x.serieId !== t.serieId);
        }

        // Toda transação de cartão excluída devolve o valor ao limite disponível daquele cartão.
        removidas.forEach(x => {
            if (x.cartaoId) {
                const cartao = p.cartoes.find(c => c.id === x.cartaoId);
                if (cartao) cartao.utilizado = Math.max(0, (cartao.utilizado || 0) - x.valor);
            }
        });

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

    window.openModal = function(tipo, editId = null, contaPreSelecionada = null, cartaoPreSelecionado = null, tipoTransacaoInicial = null) {
      const modal = document.getElementById('modal');
      const content = document.getElementById('modal-content-inner');
      modal.classList.remove('hidden');
      if (tipo === 'conta') formConta(content, editId);
      else if (tipo === 'cartao') formCartao(content, editId);
      else if (tipo === 'pessoa') formPessoa(content, editId);
      else if (tipo === 'conta-compartilhada') formContaCompart(content, editId);
      else if (tipo === 'transacao') formTransacao(content, editId, contaPreSelecionada, cartaoPreSelecionado, tipoTransacaoInicial);
      else if (tipo === 'meta') formMeta(content, editId);
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

    function formTransacao(content, editId, contaPre, cartaoPre, tipoInicial) {
        const p = perfil();
        // Contexto: de onde o modal foi aberto, para adaptar o formulário e não oferecer opções sem sentido.
        // - 'cartao': aberto pelo FAB da tela de um cartão específico -> é sempre um lançamento de cartão, nesse cartão.
        // - 'conta':  aberto pelo FAB da tela de uma conta específica -> nunca é um lançamento de cartão.
        // - 'livre':  aberto pelo FAB da home ou pelo "+ Nova" da lista de transações -> todas as opções fazem sentido.
        const contexto = editId !== null ? 'livre' : (cartaoPre ? 'cartao' : (contaPre ? 'conta' : 'livre'));

        const tipoPadrao = tipoInicial || (contexto === 'cartao' ? 'cartao' : 'despesa');
        const t = editId !== null
            ? p.transacoes.find(x => x.id === editId)
            : { tipo: tipoPadrao, valor: 0, descricao: '', data: new Date().toISOString().split('T')[0], contaId: contaPre || (p.contas[0]?.id || ''), recorrencia: 'nenhuma' };

        const opcoesTipo = [
            { valor: 'despesa', label: 'Despesa' },
            { valor: 'receita', label: 'Receita' },
            { valor: 'transferencia', label: 'Transferência' },
            { valor: 'cartao', label: 'Cartão de Crédito' },
        ].filter(op => contexto !== 'conta' || op.valor !== 'cartao'); // na tela de conta, cartão não faz sentido

        content.innerHTML = `
            <h3 class="text-lg font-bold mb-4">${editId !== null ? 'Editar' : 'Nova'} Transação</h3>
            <div class="space-y-3">
                <div class="grid grid-cols-2 gap-3">
                    <div id="f-trans-tipo-group" class="${contexto === 'cartao' ? 'hidden' : ''}">
                        <label class="text-xs text-gray-400">Tipo</label>
                        <select id="f-trans-tipo" class="w-full p-3 rounded-xl" onchange="toggleTransDestino()">
                            ${opcoesTipo.map(op => `<option value="${op.valor}" ${t.tipo===op.valor?'selected':''}>${op.label}</option>`).join('')}
                        </select>
                    </div>
                    ${contexto === 'cartao' ? `
                    <div>
                        <label class="text-xs text-gray-400">Tipo</label>
                        <div class="w-full p-3 rounded-xl bg-white/5 text-sm">💳 Cartão de Crédito</div>
                    </div>` : ''}
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
                <div id="f-trans-categoria-group">
                    <label class="text-xs text-gray-400">Categoria</label>
                    <select id="f-trans-categoria" class="w-full p-3 rounded-xl">
                        ${(p.categorias || []).map(cat => `<option value="${cat.nome}" ${t.categoria === cat.nome ? 'selected' : ''}>${cat.icone} ${cat.nome}</option>`).join('')}
                    </select>
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
                ${contexto === 'cartao' ? `<p class="text-xs text-gray-500 -mt-2">💳 Lançamento na fatura de <strong>${p.cartoes.find(c => c.id === cartaoPre)?.nome || ''}</strong></p>` : ''}
                <div id="f-trans-dest-group" class="hidden">
                    <label class="text-xs text-gray-400">Conta Destino</label>
                    <select id="f-trans-conta-dest" class="w-full p-3 rounded-xl">
                        ${p.contas.map(c => `<option value="${c.id}">${c.nome}</option>`).join('')}
                    </select>
                </div>
                <button onclick="salvarTransacao(${editId})" class="w-full bg-amber-500 text-black font-bold py-3 rounded-xl mt-2">Salvar</button>
            </div>
        `;
        window.toggleTransDestino = function() {
            const tipo = contexto === 'cartao' ? 'cartao' : document.getElementById('f-trans-tipo').value;
            document.getElementById('f-trans-dest-group').classList.toggle('hidden', tipo !== 'transferencia');
            document.getElementById('f-trans-conta-group').classList.toggle('hidden', tipo === 'cartao');
            document.getElementById('f-trans-cartao-group').classList.toggle('hidden', tipo !== 'cartao' || contexto === 'cartao');
        };
        window.toggleParcelas = function() {
            const rec = document.getElementById('f-trans-recorrencia').value;
            document.getElementById('f-trans-parcelas-group').classList.toggle('hidden', rec !== 'parcelado');
        };
        setTimeout(() => { toggleTransDestino(); toggleParcelas(); }, 0);
    }

    // Se o usuário estiver dentro da tela de uma conta ou de um cartão quando salva uma transação,
    // reabre essa tela pra refletir o novo lançamento na hora (sem precisar navegar de mês pra "forçar" o refresh).
    function atualizarTelaDetalheAposSalvar(contaId, cartaoId) {
        const p = perfil();
        if (telaAtual === 'detalhe-conta' && contaId) {
            const idx = p.contas.findIndex(c => c.id === contaId);
            if (idx !== -1) abrirTelaConta(idx);
        } else if (telaAtual === 'detalhe-cartao' && cartaoId) {
            const idx = p.cartoes.findIndex(c => c.id === cartaoId);
            if (idx !== -1) abrirTelaCartao(idx);
        }
    }

    let pendingTransacaoValores = null;

    // Ajusta o limite utilizado do cartão quando uma transação existente é editada:
    // devolve o valor antigo e cobra o valor novo (cobre também troca de cartão, se acontecer).
    function ajustarUtilizadoCartao(p, cartaoIdAntigo, valorAntigo, cartaoIdNovo, valorNovo) {
        if (cartaoIdAntigo) {
            const cAntigo = p.cartoes.find(c => c.id === cartaoIdAntigo);
            if (cAntigo) cAntigo.utilizado = Math.max(0, (cAntigo.utilizado || 0) - (valorAntigo || 0));
        }
        if (cartaoIdNovo) {
            const cNovo = p.cartoes.find(c => c.id === cartaoIdNovo);
            if (cNovo) cNovo.utilizado = (cNovo.utilizado || 0) + (valorNovo || 0);
        }
    }

    window.salvarTransacaoAcao = function(editId, modo, valoresParam) {
        const p = perfil();
        const t = p.transacoes.find(x => x.id === editId);
        if (!t) return;

        // Os campos do formulário já podem não existir mais (a tela de escolha de recorrência
        // substitui o conteúdo do modal), então usamos os valores capturados antes dessa troca.
        const v = valoresParam || pendingTransacaoValores;
        if (!v) return;
        const { tipo, descricao, valor, data, contaId, cartaoId, contaDestinoId, categoria } = v;

        if (modo === 'apenas') {
            ajustarUtilizadoCartao(p, t.cartaoId, t.valor, cartaoId, valor);
            Object.assign(t, { tipo, descricao, valor, data, contaId, cartaoId, contaDestinoId, categoria });
        } else if (modo === 'proximas') {
            p.transacoes.forEach(x => {
                if (x.serieId === t.serieId && new Date(x.data) >= new Date(t.data)) {
                    ajustarUtilizadoCartao(p, x.cartaoId, x.valor, cartaoId, valor);
                    Object.assign(x, { tipo, descricao, valor, contaId, cartaoId, contaDestinoId, categoria });
                }
            });
        } else if (modo === 'todas') {
            p.transacoes.forEach(x => {
                if (x.serieId === t.serieId) {
                    ajustarUtilizadoCartao(p, x.cartaoId, x.valor, cartaoId, valor);
                    Object.assign(x, { tipo, descricao, valor, contaId, cartaoId, contaDestinoId, categoria });
                }
            });
        }

        pendingTransacaoValores = null;
        salvarPessoal(); renderPessoal(); closeModal();
        atualizarTelaDetalheAposSalvar(contaId, cartaoId);
        mostrarToast('Alterações salvas com sucesso');
    };

    window.salvarTransacao = function(editId) {
        const p = perfil();
        const tipo = document.getElementById('f-trans-tipo').value;
        const recorrencia = document.getElementById('f-trans-recorrencia').value;
        const descricao = document.getElementById('f-trans-desc').value;
        const valorTotal = parseFloat(document.getElementById('f-trans-valor').value) || 0;
        const dataStr = document.getElementById('f-trans-data').value;
        
        if (!descricao || valorTotal <= 0) return alert('Preencha os campos corretamente');

        if (editId) {
            const t = p.transacoes.find(x => x.id === editId);
            if (t && t.serieId) {
                pendingTransacaoValores = {
                    tipo, descricao, valor: valorTotal, data: dataStr,
                    contaId: parseInt(document.getElementById('f-trans-conta')?.value),
                    cartaoId: parseInt(document.getElementById('f-trans-cartao')?.value),
                    contaDestinoId: parseInt(document.getElementById('f-trans-conta-dest')?.value),
                    categoria: document.getElementById('f-trans-categoria')?.value,
                };
                const html = `
                    <div class="space-y-6">
                        <div class="text-center">
                            <div class="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </div>
                            <h3 class="text-xl font-bold">Editar Transação Recorrente</h3>
                            <p class="text-gray-500 text-sm mt-2">Como deseja aplicar as alterações nesta série?</p>
                        </div>
                        <div class="grid grid-cols-1 gap-3">
                            <button onclick="salvarTransacaoAcao(${editId}, 'apenas')" class="w-full card-premium p-4 rounded-2xl text-left hover:border-amber-500/50">
                                <p class="font-bold text-sm">Somente esta</p>
                                <p class="text-[10px] text-gray-500">Altera apenas o lançamento selecionado</p>
                            </button>
                            <button onclick="salvarTransacaoAcao(${editId}, 'proximas')" class="w-full card-premium p-4 rounded-2xl text-left hover:border-amber-500/50">
                                <p class="font-bold text-sm">Esta e as próximas</p>
                                <p class="text-[10px] text-gray-500">Altera esta e todos os lançamentos futuros da série</p>
                            </button>
                            <button onclick="salvarTransacaoAcao(${editId}, 'todas')" class="w-full card-premium p-4 rounded-2xl text-left hover:border-amber-500/50">
                                <p class="font-bold text-sm text-amber-400">Todas</p>
                                <p class="text-[10px] text-amber-400/50">Altera todos os lançamentos passados e futuros desta série</p>
                            </button>
                        </div>
                        <button onclick="closeModal()" class="w-full py-4 text-gray-500 text-xs font-bold uppercase tracking-widest">Cancelar</button>
                    </div>
                `;
                document.getElementById('modal-content-inner').innerHTML = html;
                return;
            } else if (t) {
                salvarTransacaoAcao(editId, 'apenas', {
                    tipo, descricao, valor: valorTotal, data: dataStr,
                    contaId: parseInt(document.getElementById('f-trans-conta')?.value),
                    cartaoId: parseInt(document.getElementById('f-trans-cartao')?.value),
                    contaDestinoId: parseInt(document.getElementById('f-trans-conta-dest')?.value),
                    categoria: document.getElementById('f-trans-categoria')?.value,
                });
                return;
            }
        }

        let contaIdSalva = null;
        let cartaoIdSalvo = null;

        if (tipo === 'cartao') {
            const cartaoId = parseInt(document.getElementById('f-trans-cartao').value);
            cartaoIdSalvo = cartaoId;
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
                        cartaoId: cartaoId,
                        categoria: document.getElementById('f-trans-categoria')?.value
                    });
            }
        } else {
            const contaId = parseInt(document.getElementById('f-trans-conta').value);
            contaIdSalva = contaId;
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
                        contaDestinoId,
                        categoria: document.getElementById('f-trans-categoria').value
                    });
                }
            } else {
                p.transacoes.push({ 
                    id: Date.now(), 
                    tipo, 
                    descricao, 
                    valor: valorTotal, 
                    data: dataStr, 
                    contaId, 
                    contaDestinoId,
                    categoria: document.getElementById('f-trans-categoria').value
                });
            }
        }
        
        salvarPessoal(); renderPessoal(); closeModal();
        atualizarTelaDetalheAposSalvar(contaIdSalva, cartaoIdSalvo);
    };

    function renderChipsGrupos() {
        const container = document.getElementById('lista-grupos-compart');
        if (!container) return;
        container.innerHTML = `
            ${gruposCompart.map(g => `
                <button onclick="trocarGrupoCompart('${g.id}')" class="shrink-0 px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${g.id === grupoAtivoId ? 'bg-amber-500 text-black' : 'card-premium text-gray-400'}">${g.nome}</button>
            `).join('')}
            <button onclick="abrirNovoGrupo()" class="shrink-0 w-9 h-9 rounded-full card-premium text-gray-400 flex items-center justify-center text-lg">+</button>
            <button onclick="abrirGerenciarGrupos()" class="shrink-0 w-9 h-9 rounded-full card-premium text-gray-400 flex items-center justify-center text-sm">⚙️</button>
            <button onclick="abrirConvidarGrupo()" class="shrink-0 px-3 py-2 rounded-full text-xs font-bold whitespace-nowrap card-premium text-amber-400">🔗 Convidar</button>
        `;
    }

    window.trocarGrupoCompart = function(id) {
        if (id === grupoAtivoId) return;
        grupoAtivoId = id;
        localStorage.setItem('gato_gordo_grupo_ativo', id);
        renderCompart();
        syncVerificarEBaixar(true);
    };

    window.abrirNovoGrupo = function() {
        const modal = document.getElementById('modal');
        const content = document.getElementById('modal-content-inner');
        modal.classList.remove('hidden');
        content.innerHTML = `
            <h3 class="text-lg font-bold mb-2">Novo Grupo Compartilhado</h3>
            <p class="text-xs text-gray-500 mb-4">Dê um nome pro grupo (ex: "Eu e Ana", "Casa da minha irmã"). Depois de criado, dá pra convidar outras pessoas por link.</p>
            <input id="f-novo-grupo-nome" placeholder="Nome do grupo" class="w-full p-3 rounded-xl mb-3">
            <button onclick="criarNovoGrupo()" class="w-full bg-amber-500 text-black font-bold py-3 rounded-xl">Criar Grupo</button>
        `;
    };

    window.criarNovoGrupo = function() {
        const nome = document.getElementById('f-novo-grupo-nome').value.trim();
        if (!nome) return;
        const novoGrupo = { id: gerarIdGrupo(), nome, pessoas: [], contas: [], regra: 'proporcional' };
        gruposCompart.push(novoGrupo);
        salvarGrupos();
        grupoAtivoId = novoGrupo.id;
        localStorage.setItem('gato_gordo_grupo_ativo', novoGrupo.id);
        closeModal();
        renderCompart();
        mostrarToast(`Grupo "${nome}" criado!`);
    };

    // Tela dedicada pra ver todos os grupos e renomear/excluir cada um.
    window.abrirGerenciarGrupos = function() {
        const modal = document.getElementById('modal');
        const content = document.getElementById('modal-content-inner');
        modal.classList.remove('hidden');
        content.innerHTML = `
            <h3 class="text-lg font-bold mb-4">Gerenciar Grupos</h3>
            <div class="space-y-2 mb-4">
                ${gruposCompart.map(g => `
                    <div class="card-premium rounded-xl p-3 flex items-center justify-between gap-2">
                        <span class="font-medium text-sm truncate ${g.id === grupoAtivoId ? 'text-amber-400' : ''}">${g.nome}</span>
                        <div class="flex items-center gap-3 shrink-0">
                            <button onclick="renomearGrupo('${g.id}')" class="text-gray-400 hover:text-amber-400 p-1">✎</button>
                            <button onclick="confirmarExcluirGrupo('${g.id}')" class="text-red-400 p-1">✕</button>
                        </div>
                    </div>
                `).join('')}
            </div>
            <button onclick="abrirNovoGrupo()" class="w-full card-premium text-xs font-bold py-3 rounded-xl">+ Criar Novo Grupo</button>
        `;
    };

    window.renomearGrupo = function(id) {
        const g = gruposCompart.find(x => x.id === id);
        if (!g) return;
        const novoNome = prompt('Novo nome do grupo:', g.nome);
        if (novoNome && novoNome.trim()) {
            g.nome = novoNome.trim();
            salvarGrupos();
            syncEnviar();
            renderCompart();
            abrirGerenciarGrupos();
        }
    };

    window.confirmarExcluirGrupo = function(id) {
        if (gruposCompart.length <= 1) {
            mostrarToast('Você precisa ter pelo menos um grupo');
            return;
        }
        const g = gruposCompart.find(x => x.id === id);
        if (!g) return;
        if (!confirm(`Remover o grupo "${g.nome}" deste aparelho? Quem mais estiver nele continua vendo os dados normalmente, só sai daqui.`)) return;
        gruposCompart = gruposCompart.filter(x => x.id !== id);
        salvarGrupos();
        if (grupoAtivoId === id) {
            grupoAtivoId = gruposCompart[0].id;
            localStorage.setItem('gato_gordo_grupo_ativo', grupoAtivoId);
        }
        renderCompart();
        abrirGerenciarGrupos();
    };

    window.abrirConvidarGrupo = function() {
        const g = grupoAtivo();
        if (!syncUrl) {
            mostrarToast('Configure a Sincronização em Configurações primeiro');
            return;
        }
        const link = `${location.origin}${location.pathname}?grupo=${g.id}&nome=${encodeURIComponent(g.nome)}`;
        const modal = document.getElementById('modal');
        const content = document.getElementById('modal-content-inner');
        modal.classList.remove('hidden');
        content.innerHTML = `
            <h3 class="text-lg font-bold mb-2">Convidar pro grupo "${g.nome}"</h3>
            <p class="text-xs text-gray-500 mb-4">Envie esse link pra quem você quer que compartilhe esse grupo com você. A pessoa abre o link e aceita entrar — cada grupo fica separado dos demais.</p>
            <div class="bg-white/5 rounded-xl p-3 text-xs break-all mb-3">${link}</div>
            <button onclick="copiarLinkGrupo('${link}')" class="w-full bg-amber-500 text-black font-bold py-3 rounded-xl">📋 Copiar Link</button>
        `;
    };

    window.copiarLinkGrupo = function(link) {
        navigator.clipboard.writeText(link).then(() => mostrarToast('Link copiado! Envie pra quem vai compartilhar esse grupo.'));
    };

    // Onboarding: aparece só na primeira vez que a pessoa abre a aba Compartilhado.
    window.mostrarOnboardingCompart = function() {
        const g = grupoAtivo();
        const modal = document.getElementById('modal');
        const content = document.getElementById('modal-content-inner');
        modal.classList.remove('hidden');
        content.innerHTML = `
            <div class="text-center mb-5">
                <div class="text-4xl mb-2">👥</div>
                <h3 class="text-lg font-bold">Bem-vindo à aba Compartilhada!</h3>
                <p class="text-xs text-gray-500 mt-2 leading-relaxed px-1">Aqui você divide contas com outras pessoas — cônjuge, família, república etc. Dá pra ter vários grupos ao mesmo tempo, cada um com seus próprios participantes e contas, sem se misturar.</p>
            </div>
            <label class="text-xs text-gray-400 ml-1">Como quer chamar esse primeiro grupo?</label>
            <input id="f-onboarding-grupo-nome" value="${g.nome}" placeholder="Ex: Eu e Ana" class="w-full p-3 rounded-xl mb-3 mt-1">
            <button onclick="concluirOnboardingCompart()" class="w-full bg-amber-500 text-black font-bold py-3 rounded-xl mb-2">Continuar</button>
            <p class="text-[10px] text-gray-600 text-center px-2">Depois é só tocar em "🔗 Convidar" pra chamar alguém, ou no "+" pra criar outro grupo separado.</p>
        `;
    };

    window.concluirOnboardingCompart = function() {
        const nome = document.getElementById('f-onboarding-grupo-nome').value.trim();
        const g = grupoAtivo();
        if (nome) {
            g.nome = nome;
            salvarGrupos();
            syncEnviar();
        }
        closeModal();
        renderCompart();
    };

    // Se o app foi aberto a partir de um link de convite (?grupo=ID&nome=Nome), pergunta se quer entrar.
    function verificarConviteLink() {
        const params = new URLSearchParams(location.search);
        const grupoId = params.get('grupo');
        if (!grupoId) return;
        const nomeGrupo = params.get('nome') ? decodeURIComponent(params.get('nome')) : 'Grupo Compartilhado';
        window.history.replaceState({}, '', location.pathname);
        if (gruposCompart.some(g => g.id === grupoId)) {
            mostrarToast(`Você já faz parte do grupo "${nomeGrupo}"`);
            return;
        }
        if (confirm(`Entrar no grupo compartilhado "${nomeGrupo}"?`)) {
            gruposCompart.push({ id: grupoId, nome: nomeGrupo, pessoas: [], contas: [], regra: 'proporcional' });
            grupoAtivoId = grupoId;
            localStorage.setItem('gato_gordo_grupo_ativo', grupoId);
            salvarGrupos();
            mostrarToast(`Entrou no grupo "${nomeGrupo}"!`);
            syncVerificarEBaixar(true);
        }
    }

    // --- COMPARTILHADO ---
    function renderCompart() {
        renderChipsGrupos();
        document.getElementById('mes-referencia-compart').textContent = nomeMesAno(mesRefCompart, anoRefCompart);
        document.getElementById('mes-atual-compart').textContent = nomeMesAno(mesRefCompart, anoRefCompart);
        
        if (!grupoAtivo().regra) grupoAtivo().regra = 'proporcional';

        const contasMes = grupoAtivo().contas.filter(c => {
            const d = new Date(c.data + 'T00:00:00');
            return d.getMonth() === mesRefCompart && d.getFullYear() === anoRefCompart;
        });

        const resumo = document.getElementById('resumo-mensal-compart');
        const totalDespesas = contasMes.reduce((s, c) => s + c.valor, 0);
        const totalSalarios = grupoAtivo().pessoas.reduce((s, p) => s + (p.salario || 0), 0);
        
        let rateioHtml = `
            <div class="flex justify-between mb-2 border-b border-white/5 pb-2">
                <span>Total Despesas:</span>
                <span class="font-bold text-amber-400">${fmt(totalDespesas)}</span>
            </div>
            <div class="flex gap-2 mb-3">
                <button onclick="mudarRegraCompart('proporcional')" class="flex-1 text-[10px] py-1 rounded-md ${grupoAtivo().regra==='proporcional'?'bg-amber-500 text-black font-bold':'bg-white/5 text-gray-500'}">PROPORCIONAL</button>
                <button onclick="mudarRegraCompart('igual')" class="flex-1 text-[10px] py-1 rounded-md ${grupoAtivo().regra==='igual'?'bg-amber-500 text-black font-bold':'bg-white/5 text-gray-500'}">IGUALITÁRIA</button>
            </div>
        `;
        
        if (grupoAtivo().pessoas.length > 0) {
            grupoAtivo().pessoas.forEach(p => {
                let valorDevido = 0;
                let info = '';
                if (grupoAtivo().regra === 'proporcional') {
                    const percentual = totalSalarios > 0 ? (p.salario || 0) / totalSalarios : 0;
                    valorDevido = totalDespesas * percentual;
                    info = `${(percentual * 100).toFixed(1)}%`;
                } else {
                    valorDevido = totalDespesas / grupoAtivo().pessoas.length;
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
        listaPessoas.innerHTML = grupoAtivo().pessoas.map((p, i) => `
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
            const originalIdx = grupoAtivo().contas.findIndex(dc => dc.id === c.id);
            const dataVenc = new Date(c.data + 'T00:00:00');
            const hoje = new Date();
            hoje.setHours(0,0,0,0);
            const diffDias = Math.ceil((dataVenc - hoje) / (1000 * 60 * 60 * 24));
            const isUrgente = diffDias <= 3 && diffDias >= 0 && !c.pago;
            const isReceita = c.tipo === 'receita' || (c.tipo === undefined && c.valor < 0);

            return `
                <div class="card-premium rounded-2xl p-4 ${c.pago ? 'opacity-50' : ''} ${isUrgente ? 'border-l-4 border-red-500' : ''}">
                    <div class="flex items-center justify-between gap-3">
                        <div class="flex items-center gap-3 min-w-0">
                            <input type="checkbox" ${c.pago ? 'checked' : ''} onchange="togglePagoContaCompart(${originalIdx})" class="w-5 h-5 rounded-lg border-white/10 bg-white/5 text-amber-500 shrink-0">
                            <div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isReceita ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}">${isReceita ? '↑' : '↓'}</div>
                            <p class="font-medium text-sm truncate ${c.pago ? 'line-through text-gray-500' : ''}">${c.descricao}</p>
                        </div>
                        <p class="text-sm font-bold shrink-0 ${isReceita ? 'text-green-400' : 'text-red-400'}">${isReceita ? '+' : '-'} ${fmt(Math.abs(c.valor))}</p>
                    </div>
                    <div class="flex items-center justify-between gap-3 mt-2 pl-[3.25rem]">
                        <div class="flex items-center gap-2 min-w-0">
                            <span class="text-[10px] text-gray-500 shrink-0">${dataVenc.toLocaleDateString('pt-BR')}</span>
                            ${c.pago
                                ? '<span class="text-[9px] bg-white/5 text-gray-400 px-1.5 py-0.5 rounded-md font-bold uppercase shrink-0">Pago</span>'
                                : (isUrgente ? '<span class="text-[9px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-md font-bold uppercase shrink-0">Vence logo</span>' : '')}
                        </div>
                        <div class="flex items-center gap-3 shrink-0">
                            <button onclick="openModal('conta-compartilhada', ${c.id})" class="text-gray-600 hover:text-amber-400 transition-colors p-1">✎</button>
                            <button onclick="excluirContaCompart(${originalIdx})" class="text-gray-600 hover:text-red-400 transition-colors p-1">✕</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('') || '<p class="text-gray-500 text-center py-2">Nenhuma conta este mês</p>';
    }
    
    window.togglePagoContaCompart = function(idx) {
        grupoAtivo().contas[idx].pago = !grupoAtivo().contas[idx].pago;
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
        grupoAtivo().pessoas.push({ nome, salario });
        salvarCompart(); renderCompart(); closeModal();
    };

    function formContaCompart(content, editId) {
        const c = editId !== null ? grupoAtivo().contas.find(x => x.id === editId) : { tipo: 'despesa', descricao: '', valor: 0, data: new Date().toISOString().split('T')[0], recorrencia: 'nenhuma' };
        // Compatibilidade com contas criadas antes do campo "tipo" existir: infere pelo sinal do valor.
        const tipoAtual = c.tipo || (c.valor < 0 ? 'receita' : 'despesa');
        content.innerHTML = `
            <h3 class="text-lg font-bold mb-4">${editId !== null ? 'Editar' : 'Nova'} Conta Compartilhada</h3>
            <div class="space-y-3">
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="text-xs text-gray-400">Tipo</label>
                        <select id="f-comp-tipo" class="w-full p-3 rounded-xl">
                            <option value="despesa" ${tipoAtual==='despesa'?'selected':''}>Despesa</option>
                            <option value="receita" ${tipoAtual==='receita'?'selected':''}>Receita</option>
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
                <input id="f-comp-desc" value="${c.descricao}" placeholder="Ex: Mercado, Aluguel" class="w-full p-3 rounded-xl">
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="text-xs text-gray-400">Valor Total</label>
                        <input id="f-comp-valor" type="number" step="0.01" value="${Math.abs(c.valor)}" placeholder="0,00" class="w-full p-3 rounded-xl">
                    </div>
                    <div>
                        <label class="text-xs text-gray-400">Data</label>
                        <input id="f-comp-data" type="date" value="${c.data}" class="w-full p-3 rounded-xl">
                    </div>
                </div>
                <button onclick="salvarContaComp(${editId})" class="w-full bg-amber-500 text-black font-bold py-3 rounded-xl mt-2">Salvar</button>
            </div>
        `;
    }
    let pendingContaCompartValores = null;
    window.salvarContaCompartAcao = function(editId, modo, valoresParam) {
        const c = grupoAtivo().contas.find(x => x.id === editId);
        if (!c) return;

        // Os campos do formulário já podem não existir mais (a tela de escolha de recorrência
        // substitui o conteúdo do modal), então usamos os valores capturados antes dessa troca.
        const v = valoresParam || pendingContaCompartValores;
        if (!v) return;
        const { tipo, descricao, valorTotal, data } = v;
        const valorFinal = tipo === 'receita' ? -valorTotal : valorTotal;

        if (modo === 'apenas') {
            Object.assign(c, { descricao, valor: valorFinal, tipo, data });
        } else if (modo === 'proximas') {
            grupoAtivo().contas.forEach(x => {
                if (x.serieId === c.serieId && new Date(x.data) >= new Date(c.data)) {
                    Object.assign(x, { descricao, valor: valorFinal, tipo });
                }
            });
        } else if (modo === 'todas') {
            grupoAtivo().contas.forEach(x => {
                if (x.serieId === c.serieId) {
                    Object.assign(x, { descricao, valor: valorFinal, tipo });
                }
            });
        }

        pendingContaCompartValores = null;
        salvarCompart(); renderCompart(); closeModal();
        mostrarToast('Alterações salvas com sucesso');
    };

    window.salvarContaComp = function(editId) {
        const tipo = document.getElementById('f-comp-tipo').value;
        const recorrencia = document.getElementById('f-comp-recorrencia').value;
        const descricao = document.getElementById('f-comp-desc').value;
        const valorTotal = parseFloat(document.getElementById('f-comp-valor').value) || 0;
        const dataStr = document.getElementById('f-comp-data').value;
        if (!descricao || valorTotal <= 0) return;
        const valorFinal = tipo === 'receita' ? -valorTotal : valorTotal;

        if (editId) {
            const c = grupoAtivo().contas.find(x => x.id === editId);
            if (c && c.serieId) {
                pendingContaCompartValores = { tipo, descricao, valorTotal, data: dataStr };
                const html = `
                    <div class="space-y-6">
                        <div class="text-center">
                            <div class="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </div>
                            <h3 class="text-xl font-bold">Editar Conta Recorrente</h3>
                            <p class="text-gray-500 text-sm mt-2">Como deseja aplicar as alterações nesta série?</p>
                        </div>
                        <div class="grid grid-cols-1 gap-3">
                            <button onclick="salvarContaCompartAcao(${editId}, 'apenas')" class="w-full card-premium p-4 rounded-2xl text-left hover:border-amber-500/50">
                                <p class="font-bold text-sm">Somente esta</p>
                                <p class="text-[10px] text-gray-500">Altera apenas o lançamento selecionado</p>
                            </button>
                            <button onclick="salvarContaCompartAcao(${editId}, 'proximas')" class="w-full card-premium p-4 rounded-2xl text-left hover:border-amber-500/50">
                                <p class="font-bold text-sm">Esta e as próximas</p>
                                <p class="text-[10px] text-gray-500">Altera esta e todos os lançamentos futuros da série</p>
                            </button>
                            <button onclick="salvarContaCompartAcao(${editId}, 'todas')" class="w-full card-premium p-4 rounded-2xl text-left hover:border-amber-500/50">
                                <p class="font-bold text-sm text-amber-400">Todas</p>
                                <p class="text-[10px] text-amber-400/50">Altera todos os lançamentos passados e futuros desta série</p>
                            </button>
                        </div>
                        <button onclick="closeModal()" class="w-full py-4 text-gray-500 text-xs font-bold uppercase tracking-widest">Cancelar</button>
                    </div>
                `;
                document.getElementById('modal-content-inner').innerHTML = html;
                return;
            } else if (c) {
                salvarContaCompartAcao(editId, 'apenas', { tipo, descricao, valorTotal, data: dataStr });
                return;
            }
        }

        if (recorrencia !== 'nenhuma') {
            const dataBase = new Date(dataStr + 'T00:00:00');
            const serieId = Date.now();
            const numCiclos = 24;
            for (let i = 0; i < numCiclos; i++) {
                const novaData = new Date(dataBase);
                if (recorrencia === 'semanal') novaData.setDate(dataBase.getDate() + (i * 7));
                else if (recorrencia === 'quinzenal') novaData.setDate(dataBase.getDate() + (i * 15));
                else novaData.setMonth(dataBase.getMonth() + i);
                
                grupoAtivo().contas.push({ id: Date.now() + i, serieId, descricao, valor: valorFinal, tipo, data: novaData.toISOString().split('T')[0], pago: false });
            }
        } else {
            grupoAtivo().contas.push({ id: Date.now(), descricao, valor: valorFinal, tipo, data: dataStr, pago: false });
        }
        salvarCompart(); renderCompart(); closeModal();
    };

    window.excluirPessoa = function(i) { grupoAtivo().pessoas.splice(i, 1); salvarCompart(); renderCompart(); };
    
    window.excluirContaCompart = function(idx) {
        const c = grupoAtivo().contas[idx];
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
        const c = grupoAtivo().contas.find(x => x.id === id);
        if (!c) return;

        if (modo === 'apenas') {
            grupoAtivo().contas = grupoAtivo().contas.filter(x => x.id !== id);
        } else if (modo === 'proximas') {
            grupoAtivo().contas = grupoAtivo().contas.filter(x => x.serieId !== c.serieId || new Date(x.data) < new Date(c.data));
        } else if (modo === 'todas') {
            grupoAtivo().contas = grupoAtivo().contas.filter(x => x.serieId !== c.serieId);
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

    window.abrirCategorias = function() {
        const p = perfil();
        if (!p.categorias) p.categorias = [];
        
        const html = `
            <div class="space-y-6">
                <div class="text-center">
                    <h3 class="text-xl font-bold">Categorias e Limites</h3>
                    <p class="text-gray-500 text-sm">Defina quanto deseja gastar por mês</p>
                </div>
                
                <div class="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                    ${p.categorias.map((cat, idx) => `
                        <div class="card-premium p-4 rounded-2xl">
                            <div class="flex items-center gap-3 mb-3">
                                <span class="text-xl">${cat.icone}</span>
                                <span class="font-bold text-sm">${cat.nome}</span>
                            </div>
                            <div class="space-y-1">
                                <label class="text-[10px] text-gray-500 uppercase tracking-widest">Limite Mensal</label>
                                <div class="flex items-center gap-2">
                                    <span class="text-gray-400 text-sm">R$</span>
                                    <input type="number" step="0.01" value="${cat.limite}" 
                                        onchange="atualizarLimiteCategoria(${idx}, this.value)"
                                        class="w-full bg-transparent border-none p-0 text-lg font-bold focus:ring-0">
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
                
                <button onclick="voltarParaApp()" class="w-full glass py-4 rounded-2xl text-gray-500 text-sm font-bold uppercase tracking-widest">Voltar</button>
            </div>
        `;
        document.getElementById('app-abas').classList.add('hidden');
        document.getElementById('tela-detalhe').classList.remove('hidden');
        document.getElementById('detalhe-conteudo').innerHTML = html;
        document.getElementById('btn-voltar').classList.remove('hidden');
        document.getElementById('subtitulo-header').textContent = 'Categorias';
    };

    window.atualizarLimiteCategoria = function(idx, valor) {
        const p = perfil();
        p.categorias[idx].limite = parseFloat(valor) || 0;
        salvarPessoal();
        mostrarToast('Limite atualizado!');
    };

    window.fabPrincipalClick = function() {
        if (telaAtual === 'detalhe-conta' && detalheContaId) {
            openModal('transacao', null, detalheContaId);
        } else if (telaAtual === 'detalhe-cartao' && detalheCartaoId) {
            openModal('transacao', null, null, detalheCartaoId);
        } else {
            toggleFabMenu();
        }
    };

    window.toggleFabMenu = function() {
        const menu = document.getElementById('fab-menu');
        const icon = document.getElementById('fab-icon');
        const isHidden = menu.classList.contains('hidden');
        
        if (isHidden) {
            menu.classList.remove('hidden');
            menu.classList.add('flex');
            icon.style.transform = 'rotate(45deg)';
        } else {
            menu.classList.add('hidden');
            menu.classList.remove('flex');
            icon.style.transform = 'rotate(0deg)';
        }
    };

    window.fabAction = function(tipo) {
        toggleFabMenu(); // Fecha o menu
        // Abre o modal de transação já com o tipo certo pré-selecionado (Receita, Despesa, Cartão ou Transferência)
        openModal('transacao', null, null, null, tipo);
    };

    // Início
    renderLogin();
})();
