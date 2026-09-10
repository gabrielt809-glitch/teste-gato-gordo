(function(root){
'use strict';
const originalOpen = root.abrirTelaCartao;
if (typeof originalOpen !== 'function') return;
function profile(){ try { const raw=root.gatoStorage?.getItem('gato_gordo_perfis'); const list=raw?JSON.parse(raw):[]; return list[0]||null; } catch(_){ return null; } }
function months(){return ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];}
function fmt(v){return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v);}
function getCycles(card,p,month,year){
 const out=[];
 for(let i=0;i<3;i++){
  let m=month+i, y=year+Math.floor(m/12); m%=12;
  const cycle=root.GatoCiclosCartao.cycle(card,m,y);
  const purchases=root.GatoCiclosCartao.transactionsForCycle(p,card.id,m,y);
  const total=purchases.reduce((s,t)=>s+Number(t.valor||0),0);
  const paid=(p.transacoes||[]).filter(t=>t.tipo==='pagamento_fatura'&&t.cartaoId===card.id&&Number(t.faturaMes)===m&&Number(t.faturaAno)===y).reduce((s,t)=>s+Number(t.valor||0),0);
  out.push({month:m,year:y,cycle,total,open:Math.max(0,total-paid),count:purchases.length});
 }
 return out;
}
root.abrirTelaCartao=function(idx){
 originalOpen(idx);
 const p=profile(), card=p?.cartoes?.[idx];
 if(!p||!card||!root.GatoCiclosCartao) return;
 const label=document.getElementById('mes-atual-pessoal')?.textContent||'';
 const names=months();
 const match=label.toLowerCase().match(/(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+(\d{4})/);
 if(!match) return;
 const m=names.indexOf(match[1]), y=Number(match[2]);
 const data=getCycles(card,p,m,y);
 const host=document.getElementById('detalhe-conteudo'); if(!host) return;
 const block=document.createElement('div'); block.className='card-premium rounded-2xl p-4 mt-4';
 block.innerHTML=`<div class="flex items-center justify-between mb-3"><div><p class="text-[10px] text-gray-500 uppercase tracking-wider">Próximas faturas</p><p class="text-xs text-gray-400 mt-1">Projeção dos próximos 3 ciclos</p></div><span class="text-lg">📅</span></div>${data.map(x=>`<div class="flex items-center justify-between py-2 border-t border-white/5"><div><p class="text-sm font-medium">${names[x.month]} de ${x.year}</p><p class="text-[10px] text-gray-500">${root.GatoCiclosCartao.formatRange(x.cycle)} • ${x.count} lançamento${x.count===1?'':'s'}</p></div><div class="text-right"><p class="text-sm font-bold ${x.total>0?'text-red-400':'text-gray-500'}">${fmt(x.total)}</p>${x.open!==x.total?`<p class="text-[10px] text-green-400">Em aberto: ${fmt(x.open)}</p>`:''}</div></div>`).join('')}`;
 const cards=host.querySelectorAll('.space-y-4 > *');
 if(cards.length) cards[cards.length-1].insertAdjacentElement('beforebegin',block); else host.appendChild(block);
};
})(globalThis);
