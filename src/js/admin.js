// ============================================================
// DATA MODEL
// ============================================================
import { supabase } from './supabase.js'
import { Auth } from './auth.js'

const ESTADOS={INICIADA:'iniciada',AGUARDA:'aguarda_confirmacao',CONFIRMADA:'confirmada',REJEITADA:'rejeitada'};
const PERFIS=['igreja','empresa','freelancer','pessoal','outro'];
const PERFIL_LABELS={igreja:'Igreja / Ministério',empresa:'Empresa',freelancer:'Freelancer',pessoal:'Aprendiz',outro:'Outro'};

function defaultConfig(){return{data_inicio:'',num_modulos:18,duracao:'30 dias',valor_total:45000,parcelas:3,valor_parcela:15000,inscricoes_ativas:true,regra_liberacao_codigo:'primeira_parcela',iban:'AO06 0055 0000 0856 1941 0152',titular_iban:'Adilson Amado â€” Comércio e Prestação de Serviços',whatsapp_comprovativo:'941 679 799',link_grupo:'',textos_landing:{}}}

// ============================================================
// DATABASE
// ============================================================
const DB={
  _k:'aacademy_db',_data:null,
  load(){
    if(!this._data){
      const r=localStorage.getItem(this._k);
      if(r){this._data=JSON.parse(r)}else{
        this._data={inscricoes:[],configuracoes:defaultConfig(),counter:0,presencas:[]};
      }
    }
    if(!this._data.presencas)this._data.presencas=[];
    return this._data;
  },
  async refresh(){
    const {data: inscricoes,error: inscricoesError} = await supabase.from('inscricoes').select('*').order('criado_em', {ascending:false});
    if(inscricoesError)throw inscricoesError;
    const {data: configuracoes,error: configuracoesError} = await supabase.from('configuracoes').select('*').limit(1).single();
    if(configuracoesError)throw configuracoesError;
    const {data: sessoes,error: sessoesError} = await supabase.from('presencas_sessoes').select('*,presencas_registos(*)').order('data', {ascending:false});
    if(sessoesError)throw sessoesError;
    this._data = {
      inscricoes: inscricoes || [],
      configuracoes,
      counter: inscricoes ? inscricoes.length : 0,
      presencas: (sessoes || []).map(s=>({
        id:s.id,titulo:s.titulo,data:s.data,criado_em:s.criado_em,criado_por:s.criado_por,
        presentes:(s.presencas_registos||[]).filter(r=>r.presente).map(r=>r.inscricao_id),
        ausentes:(s.presencas_registos||[]).filter(r=>!r.presente).map(r=>r.inscricao_id)
      }))
    };
    this.save();
    return this._data;
  },
  save(){localStorage.setItem(this._k,JSON.stringify(this._data))},
  async saveInscricao(id,u){
    const {error} = await supabase.from('inscricoes').update(u).eq('id', id);
    if(!error){const i=this.getInscricao(id);if(i)Object.assign(i,u)}
    return !error;
  },
  getInscricao(id){return this._data.inscricoes.find(i=>i.id===id)},
  initSync(){
    window.addEventListener('storage',e=>{
      if(e.key===this._k&&e.newValue){
        try{this._data=JSON.parse(e.newValue);App.render()}catch(err){console.error('DB sync error:',err)}
      }
    });
  }
};
DB.initSync();

// ============================================================
// AUTH UI
// ============================================================
const AuthUI = {
  async handleLogin() {
    const e = document.getElementById('loginEmail').value.trim()
    const p = document.getElementById('loginPass').value
    const errorEl = document.getElementById('loginError')

    try {
      await Auth.login(e, p)
      errorEl.style.display = 'none'
      this.showApp()
    } catch (err) {
      errorEl.textContent = err.message
      errorEl.style.display = 'block'
    }
  },

  async handleLogout() {
    await Auth.logout()
    document.getElementById('loginScreen').classList.remove('hidden')
    document.getElementById('appMain').classList.add('hidden')
  },

  async init() {
    const logged = await Auth.init()
    if (logged) {
      this.showApp()
    }
  },

  async showApp() {
    document.getElementById('loginScreen').classList.add('hidden')
    document.getElementById('appMain').classList.remove('hidden')
    document.getElementById('userName').textContent = Auth.currentUser.nome
    document.getElementById('userAvatar').textContent = Auth.currentUser.nome.substring(0, 2).toUpperCase()
    await DB.refresh()
    Notif.init()
    App.go('dashboard')
    repairRenderedEncoding(document.body)
  }
}

// ============================================================
// NOTIFICAÃ‡Ã•ES
// ============================================================
const Notif={
  _k:'aacademy_notifs',
  _data:null,

  load(){if(this._data)return this._data;const r=localStorage.getItem(this._k);this._data=r?JSON.parse(r):[];return this._data},
  save(){localStorage.setItem(this._k,JSON.stringify(this._data))},

  init(){this._scanNewInscricoes();this._renderBadge();this._renderList()},

  _scanNewInscricoes(){
    const db=DB.load();const notifs=this.load();
    const lastCheck=localStorage.getItem(this._k+'_lastScan')||'';
    db.inscricoes.forEach(i=>{
      if(!notifs.find(n=>n.inscricao_id===i.id)){
        notifs.unshift({id:Date.now()+i.id,inscricao_id:i.id,tipo:'nova_inscricao',titulo:`Nova inscrição: ${escapeHtml(i.nome_completo)}`,descricao:`${escapeHtml(i.codigo_referencia)} Â· ${escapeHtml(PERFIL_LABELS[i.perfil]||i.perfil)} Â· ${i.modalidade_pagamento==='integral'?'Integral':i.numero_parcelas+'x parcelado'}`,lida:false,data:i.data_inscricao});
      }
    });
    localStorage.setItem(this._k+'_lastScan',new Date().toISOString());
    this._data=notifs;this.save();
  },

  addCustom(tipo,titulo,descricao){const notifs=this.load();notifs.unshift({id:Date.now(),inscricao_id:null,tipo,titulo,descricao,lida:false,data:new Date().toISOString()});this.save();this._renderBadge();this._renderList()},

  toggle(){const dd=document.getElementById('notifDropdown');dd.classList.toggle('open')},

  _renderBadge(){
    const notifs=this.load();const unread=notifs.filter(n=>!n.lida).length;
    const badge=document.getElementById('notifBadge');
    if(badge){badge.textContent=unread;badge.dataset.count=unread}
  },

  _renderList(){
    const notifs=this.load();const list=document.getElementById('notifList');if(!list)return;
    if(notifs.length===0){list.innerHTML='<div class="notif-empty">Sem notificações</div>';return}
    list.innerHTML=notifs.slice(0,30).map(n=>`<div class="notif-item ${n.lida?'':'unread'}" onclick="Notif.clickItem(${n.id})">
      <span class="av notif-icon" style="background:${n.tipo==='nova_inscricao'?'linear-gradient(135deg,#22a34c,#8fd14f)':n.tipo==='pagamento_confirmado'?'linear-gradient(135deg,#1e88e5,#42a5f5)':n.tipo==='presenca'?'linear-gradient(135deg,#ec407a,#f06292)':'linear-gradient(135deg,#fb8c00,#ffa726)'}">
        ${n.tipo==='nova_inscricao'?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>':n.tipo==='pagamento_confirmado'?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>':'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>'}
      </span>
      <div class="notif-content"><p><b>${escapeHtml(n.titulo)}</b></p><p class="notif-time">${escapeHtml(n.descricao)}</p><p class="notif-time">${this._timeAgo(n.data)}</p></div>
    </div>`).join('');
  },

  _timeAgo(iso){
    if(!iso)return'';const diff=Date.now()-new Date(iso).getTime();const mins=Math.floor(diff/60000);
    if(mins<1)return'Agora';if(mins<60)return`há ${mins}min`;const hrs=Math.floor(mins/60);if(hrs<24)return`há ${hrs}h`;const days=Math.floor(hrs/24);return`há ${days}d`;
  },

  clickItem(id){
    const notifs=this.load();const n=notifs.find(x=>x.id===id);if(n){n.lida=true;this.save();this._renderBadge();this._renderList();
      if(n.inscricao_id){App.openDetail(n.inscricao_id)}}
    document.getElementById('notifDropdown').classList.remove('open');
  },

  markAllRead(e){e.stopPropagation();const notifs=this.load();notifs.forEach(n=>n.lida=true);this.save();this._renderBadge();this._renderList()}
};

// Fechar dropdown ao clicar fora
document.addEventListener('click',e=>{const b=document.getElementById('notifBell');if(b&&!b.contains(e.target))document.getElementById('notifDropdown')?.classList.remove('open')});

// ============================================================
// UTILITIES
// ============================================================
function escapeHtml(s){if(!s)return'';const d=document.createElement('div');d.textContent=String(s);return d.innerHTML}
function normalize(s){return(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')}
function inlineArg(value){return JSON.stringify(value).replace(/"/g,'&quot;')}
function formatDate(iso){if(!iso)return'â€”';return new Date(iso).toLocaleDateString('pt-BR')}
function formatDateTime(iso){if(!iso)return'â€”';const d=new Date(iso);return d.toLocaleDateString('pt-BR')+' '+d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}
function paidAmount(insc){if(insc.modalidade_pagamento==='integral')return Number(insc.valor_total||0);return(insc.parcelas||[]).filter(p=>p.estado==='confirmada').reduce((sum,p)=>sum+Number(p.valor||0),0)}
function pendingAmount(insc){if(insc.modalidade_pagamento==='integral'&&insc.estado!==ESTADOS.CONFIRMADA)return Number(insc.valor_total||0);return(insc.parcelas||[]).filter(p=>p.estado==='pendente').reduce((sum,p)=>sum+Number(p.valor||0),0)}
function repairMojibake(value){
  if(typeof value!=='string'||!/[ÃÂâð]/.test(value))return value;
  const cp1252={'€':0x80,'‚':0x82,'ƒ':0x83,'„':0x84,'…':0x85,'†':0x86,'‡':0x87,'ˆ':0x88,'‰':0x89,'Š':0x8a,'‹':0x8b,'Œ':0x8c,'Ž':0x8e,'‘':0x91,'’':0x92,'“':0x93,'”':0x94,'•':0x95,'–':0x96,'—':0x97,'˜':0x98,'™':0x99,'š':0x9a,'›':0x9b,'œ':0x9c,'ž':0x9e,'Ÿ':0x9f};
  try{return new TextDecoder('utf-8',{fatal:true}).decode(new Uint8Array(Array.from(value).map(ch=>cp1252[ch]??ch.charCodeAt(0))))}catch{return value}
}
function repairRenderedEncoding(root){if(!root)return;const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);nodes.forEach(node=>{node.nodeValue=repairMojibake(node.nodeValue)});root.querySelectorAll('input,textarea,select,option').forEach(el=>{['placeholder','title'].forEach(attr=>{if(el.hasAttribute(attr))el.setAttribute(attr,repairMojibake(el.getAttribute(attr)))});if('value'in el)el.value=repairMojibake(el.value)})}
function estadoBadge(e){const m={iniciada:'b-gray',aguarda_confirmacao:'b-orange',confirmada:'b-green',rejeitada:'b-red'};const l={iniciada:'Iniciada',aguarda_confirmacao:'Aguarda',confirmada:'Confirmada',rejeitada:'Rejeitada'};return`<span class="badge ${m[e]||'b-gray'}">${l[e]||e}</span>`}
function perfilBadge(p){return`<span class="profile-tag">${PERFIL_LABELS[p]||p}</span>`}
function toast(m){const t=document.createElement('div');t.className='toast';t.textContent=repairMojibake(m);document.body.appendChild(t);setTimeout(()=>t.remove(),3000)}
function avColor(n){const c=['#1e3a5f','#1e88e5','#ec407a','#fb8c00','#7e57c2','#22a34c','#e91e63','#00897b'];return c[(normalize(n).charCodeAt(0)||0)%c.length]}

// ============================================================
// APP
// ============================================================
const App={
  currentRoute:'dashboard',_detailId:null,
  go(r){this.closeModal();this.currentRoute=r;document.querySelectorAll('.mainnav a').forEach(a=>a.classList.remove('active'));const i=['dashboard','inscricoes','presenca','settings','reports','parcerias','curso','pacotes'].indexOf(r);const n=document.querySelectorAll('.mainnav a');if(i>=0&&n[i])n[i].classList.add('active');document.querySelectorAll('.bottom-nav-item').forEach(b=>b.classList.remove('active'));const bottomItem=document.querySelector(`.bottom-nav-item[data-page="${r}"]`);if(bottomItem)bottomItem.classList.add('active');document.querySelectorAll('.drawer-nav-item').forEach(d=>d.classList.remove('active'));const drawerItem=document.querySelector(`.drawer-nav-item[data-page="${r}"]`);if(drawerItem)drawerItem.classList.add('active');this.render()},
  render(){const c=document.getElementById('app-content');c.innerHTML='';switch(this.currentRoute){case'dashboard':c.appendChild(Modules.dashboard());break;case'inscricoes':c.appendChild(Modules.inscricoes());break;case'inscricao':c.appendChild(Modules.inscricaoDetail());break;case'presenca':c.appendChild(Modules.presenca());break;case'presenca_nova':c.appendChild(Modules.presencaNova());break;case'presenca_ver':c.appendChild(Modules.presencaVer());break;case'settings':c.appendChild(Modules.settings());break;case'reports':c.appendChild(Modules.reports());break;case'parcerias':c.appendChild(Modules.parcerias());break;case'curso':c.appendChild(Modules.curso());break;case'pacotes':c.appendChild(Modules.pacotes());break}repairRenderedEncoding(c)},
  openModal(t,b,f){const body=document.getElementById('modalBody');document.getElementById('modalTitle').textContent=t;body.innerHTML=b;document.getElementById('modalFooter').innerHTML=f||'';document.getElementById('modal').classList.add('open');body.scrollTop=0;repairRenderedEncoding(document.getElementById('modal'))},
  closeModal(){document.getElementById('modal').classList.remove('open')},
  globalSearch(term){if(!term||term.length<2)return;const t=normalize(term);const m=DB.load().inscricoes.filter(i=>normalize(i.nome_completo).includes(t)||(i.codigo_referencia&&i.codigo_referencia.toLowerCase().includes(term.toLowerCase())));if(m.length===1){this._detailId=m[0].id;this.currentRoute='inscricao';this.render()}else if(m.length>1){this.currentRoute='inscricoes';this.render();setTimeout(()=>{const inp=document.getElementById('filterNome');if(inp){inp.value=term;Modules.applyFilters()}},50)}},
  openDetail(id){
    this._detailId=id;
    const detail=Modules.inscricaoDetail();
    document.getElementById('modalTitle').textContent='Detalhes da inscrição';
    document.getElementById('modalBody').replaceChildren(detail);
    document.getElementById('modalFooter').innerHTML='';
    document.getElementById('modal').classList.add('open');
    document.getElementById('modalBody').scrollTop=0;
    repairRenderedEncoding(document.getElementById('modal'));
  }
};

// ============================================================
// MODULES
// ============================================================
const Modules={

  // ========== DASHBOARD ==========
  dashboard(){
    const db=DB.load();const insc=db.inscricoes;const cfg=db.configuracoes;
    const total=insc.length;
    const aguarda=insc.filter(i=>i.estado===ESTADOS.AGUARDA).length;
    const confirmadas=insc.filter(i=>i.estado===ESTADOS.CONFIRMADA).length;
    const rejeitadas=insc.filter(i=>i.estado===ESTADOS.REJEITADA).length;
    const taxa=total>0?Math.round(confirmadas/total*100):0;
    const receitaConf=insc.filter(i=>i.estado===ESTADOS.CONFIRMADA).reduce((s,i)=>s+paidAmount(i),0);
    const receitaPend=insc.filter(i=>i.estado!==ESTADOS.REJEITADA).reduce((s,i)=>s+pendingAmount(i),0);
    const perfis={};PERFIS.forEach(p=>perfis[p]=0);insc.forEach(i=>{if(perfis[i.perfil]!==undefined)perfis[i.perfil]++});
    const antigos=insc.filter(i=>i.estado===ESTADOS.AGUARDA).sort((a,b)=>new Date(a.data_inscricao)-new Date(b.data_inscricao)).slice(0,5);
    const div=document.createElement('div');

    // Welcome
    div.innerHTML=`<div class="card welcome"><h2>Olá, ${escapeHtml(Auth.currentUser?.nome||'Admin')} ðŸ‘‹</h2><div style="display:flex;gap:10px"><button class="btn btn-primary" onclick="App.go('inscricoes')">Ver inscritos</button><button class="btn btn-outline" onclick="App.go('settings')">Definições</button></div></div>`;

    // Row A: stats + revenue
    const rowA=document.createElement('div');rowA.className='row row-a';
    rowA.innerHTML=`
      <div class="stack">
        <div class="pair">
          <div class="card"><h3>Total de Inscrições</h3><div class="stat-num">${total} <span class="trend t-gr">â–² real</span></div><p class="muted">Inscrições recebidas</p>
            <svg class="spark" viewBox="0 0 300 70" preserveAspectRatio="none"><path d="M0 55 C30 35,55 18,85 32 S145 60,175 42 S235 12,265 28 S290 36,300 22" fill="rgba(34,163,76,.12)"/><path d="M0 55 C30 35,55 18,85 32 S145 60,175 42 S235 12,265 28 S290 36,300 22" fill="none" stroke="#22a34c" stroke-width="2"/></svg>
          </div>
          <div class="card"><h3>Taxa de Confirmação</h3><div class="stat-num">${taxa}% <span class="trend t-gr">â–² real</span></div><p class="muted">Inscrições confirmadas / total</p>
            <svg class="spark" viewBox="0 0 300 70" preserveAspectRatio="none"><path d="M0 50 C35 55,60 25,90 30 S150 55,185 38 S245 20,300 35" fill="rgba(30,136,229,.12)"/><path d="M0 50 C35 55,60 25,90 30 S150 55,185 38 S245 20,300 35" fill="none" stroke="#1e88e5" stroke-width="2"/></svg>
          </div>
        </div>
        <div class="card"><h3>MatrÃ­culas por Perfil</h3><p class="muted">Distribuição dos inscritos por perfil.</p>
          <div class="rings">
            ${PERFIS.filter(p=>perfis[p]>0).map((p,idx)=>{const cl=['#22a34c','#1e88e5','#ec407a','#fb8c00','#7e57c2'];return`<div class="ring"><div class="ring-wrap"><canvas id="ring${idx}"></canvas><span class="ring-c">${perfis[p]}</span></div><div><b>${PERFIL_LABELS[p]}</b><span>${perfis[p]}</span></div></div>`}).join('')||'<p class="muted">Sem dados</p>'}
          </div>
        </div>
      </div>
      <div class="card"><h3>Receita</h3><p class="muted">Receita consolidada de inscrições.</p>
        <div class="mini-stats">
          <div><span>Confirmada</span><b>Kz ${receitaConf.toLocaleString('pt-BR')}</b></div>
          <div><span>Pendente</span><b>Kz ${receitaPend.toLocaleString('pt-BR')}</b></div>
          <div><span>Confirmadas</span><b>${confirmadas}</b></div>
          <div><span>Rejeitadas</span><b>${rejeitadas}</b></div>
        </div>
        <div class="chart-box"><canvas id="chLine"></canvas></div>
      </div>`;
    div.appendChild(rowA);

    // Pills
    const pills=document.createElement('div');pills.className='pills stagger';
    pills.innerHTML=`
      <div class="pill-card p-green" onclick="App.go('inscricoes')"><span class="ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></span><div><em>Receita Confirmada</em><strong>Kz ${receitaConf.toLocaleString('pt-BR')} <small>total</small></strong></div></div>
      <div class="pill-card p-blue" onclick="App.go('inscricoes')"><span class="ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></span><div><em>Inscrições</em><strong>${total} <small>recebidas</small></strong></div></div>
      <div class="pill-card p-pink" onclick="App.go('inscricoes')"><span class="ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></span><div><em>Confirmadas</em><strong>${confirmadas} <small>alunos</small></strong></div></div>
      <div class="pill-card p-orange" onclick="App.go('inscricoes')"><span class="ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg></span><div><em>Aguarda</em><strong>${aguarda} <small>por confirmar</small></strong></div></div>`;
    div.appendChild(pills);

    // Row B: recent + timeline
    const rowB=document.createElement('div');rowB.className='row row-b';
    const recentRows=insc.slice(-5).reverse().map(i=>`<tr onclick="App.openDetail(${inlineArg(i.id)})" style="cursor:pointer"><td><div class="student"><span class="av" style="background:${avColor(i.nome_completo)}">${escapeHtml(i.nome_completo?.substring(0,2).toUpperCase()||'??')}</span><div><b>${escapeHtml(i.nome_completo)}</b><span>${escapeHtml(i.codigo_referencia||'â€”')}</span></div></div></td><td>${formatDate(i.data_inscricao)}</td><td>${perfilBadge(i.perfil)}</td><td>${estadoBadge(i.estado)}</td><td class="dots">â‹¯</td></tr>`).join('');
    rowB.innerHTML=`
      <div class="card"><div class="welcome" style="margin-bottom:6px"><h3>Inscritos Recentes</h3><button class="btn btn-outline btn-sm" onclick="App.go('inscricoes')">Ver todos</button></div>
        <table><thead><tr><th>INSCRIÃ‡ÃƒO</th><th>DATA</th><th>PERFIL</th><th>ESTADO</th><th></th></tr></thead><tbody>${recentRows||'<tr><td colspan="5" style="text-align:center;color:#8a94a6;padding:30px">Nenhuma inscrição ainda</td></tr>'}</tbody></table>
      </div>
      <div class="card"><h3>Atividades Recentes</h3><div class="timeline">
        ${insc.slice(-3).reverse().map(i=>`<div class="tl-item"><h4>${escapeHtml(i.nome_completo)}</h4><p>${escapeHtml(i.codigo_referencia)} Â· ${i.modalidade_pagamento==='integral'?'Integral':i.numero_parcelas+'x parcelado'}</p><span class="when">ðŸ•“ ${formatDate(i.data_inscricao)}</span></div>`).join('')||'<div class="tl-item"><h4>Sem atividade</h4><p>Aguardando inscrições</p></div>'}
      </div></div>`;
    div.appendChild(rowB);

    // Action needed
    if(antigos.length>0){
      const act=document.createElement('div');act.className='card action-needed-card';
      act.innerHTML=`<h3 style="color:#fb8c00">Ação Necessária â€” Aguarda Confirmação</h3><p class="muted" style="margin-bottom:10px">Inscrições mais antigas que precisam de confirmação:</p>
        <table><thead><tr><th>NOME</th><th>DATA</th><th>PERFIL</th><th>PAGAMENTO</th><th></th></tr></thead><tbody>${antigos.map(i=>`<tr><td><div class="student"><span class="av" style="background:${avColor(i.nome_completo)}">${escapeHtml(i.nome_completo?.substring(0,2).toUpperCase()||'??')}</span><div><b>${escapeHtml(i.nome_completo)}</b><span>${escapeHtml(i.codigo_referencia)}</span></div></div></td><td>${formatDate(i.data_inscricao)}</td><td>${perfilBadge(i.perfil)}</td><td>${i.modalidade_pagamento==='integral'?'Integral':i.numero_parcelas+'x'}</td><td><button class="btn btn-primary btn-sm" onclick="App.openDetail(${inlineArg(i.id)})">Confirmar</button></td></tr>`).join('')}</tbody></table>`;
      div.appendChild(act);
    }

    setTimeout(()=>this._initDashboardCharts(insc,cfg,perfis),100);
    return div;
  },

  _initDashboardCharts(insc,cfg,perfis){
    Chart.defaults.font.family="'Inter',sans-serif";Chart.defaults.color='#94a3b8';Chart.defaults.plugins.legend.display=false;
    // Line chart
    const ctx=document.getElementById('chLine');
    if(ctx){
      const months=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];const now=new Date();const labels=[];const data=[];
      for(let i=5;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1);labels.push(months[d.getMonth()]);data.push(insc.filter(ins=>{const dt=new Date(ins.data_inscricao);return dt.getMonth()===d.getMonth()&&dt.getFullYear()===d.getFullYear()&&ins.estado===ESTADOS.CONFIRMADA}).reduce((s,ins)=>s+paidAmount(ins),0))}
      new Chart(ctx,{type:'line',data:{labels,datasets:[{data,borderColor:'#22a34c',backgroundColor:'rgba(34,163,76,.10)',fill:true,tension:.45,borderWidth:2.5,pointRadius:0}]},options:{maintainAspectRatio:false,plugins:{tooltip:{callbacks:{label:c=>' Kz '+c.parsed.y.toLocaleString('pt-BR')}}},scales:{y:{ticks:{callback:v=>'Kz'+(v/1000)+'k'},grid:{color:'#f0f3f6'}},x:{grid:{display:false}}}}});
    }
    // Rings
    const ringColors=['#22a34c','#1e88e5','#ec407a','#fb8c00','#7e57c2'];
    PERFIS.filter(p=>perfis[p]>0).forEach((p,idx)=>{const c=document.getElementById('ring'+idx);if(c)new Chart(c,{type:'doughnut',data:{datasets:[{data:[perfis[p],insc.length-perfis[p]||1],backgroundColor:[ringColors[idx],'#eef1f5'],borderWidth:0}]},options:{cutout:'76%',maintainAspectRatio:false,plugins:{tooltip:{enabled:false}}}})});
  },

  // ========== INSCRITOS ==========
  inscricoes(){
    const db=DB.load();const insc=db.inscricoes;const div=document.createElement('div');
    const total=insc.length;
    const confirmadas=insc.filter(i=>i.estado===ESTADOS.CONFIRMADA).length;
    const aguarda=insc.filter(i=>i.estado===ESTADOS.AGUARDA||i.estado===ESTADOS.INICIADA).length;
    const rejeitadas=insc.filter(i=>i.estado===ESTADOS.REJEITADA).length;
    const recentes=insc.filter(i=>{const d=new Date(i.data_inscricao);const now=new Date();return(now-d)/(1000*60*60*24)<=7}).length;

    // Header
    const hdr=document.createElement('div');hdr.className='card welcome';
    hdr.innerHTML=`<div><h2>Inscritos</h2><p class="muted">${total} inscrição${total!==1?'ões':''} no total</p></div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-outline btn-sm" onclick="Modules.exportCSV()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Exportar CSV
        </button>
      </div>`;
    div.appendChild(hdr);

    // Stats
    const stats=document.createElement('div');stats.className='insc-stats-grid';
    stats.innerHTML=`
      <div class="insc-stat-card insc-stat-total">
        <div class="insc-stat-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>
        <div class="insc-stat-info"><span class="insc-stat-num">${total}</span><span class="insc-stat-label">Total</span></div>
      </div>
      <div class="insc-stat-card insc-stat-confirmado">
        <div class="insc-stat-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>
        <div class="insc-stat-info"><span class="insc-stat-num">${confirmadas}</span><span class="insc-stat-label">Confirmadas</span></div>
      </div>
      <div class="insc-stat-card insc-stat-aguarda">
        <div class="insc-stat-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg></div>
        <div class="insc-stat-info"><span class="insc-stat-num">${aguarda}</span><span class="insc-stat-label">Aguarda</span></div>
      </div>
      <div class="insc-stat-card insc-stat-rejeitado">
        <div class="insc-stat-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg></div>
        <div class="insc-stat-info"><span class="insc-stat-num">${rejeitadas}</span><span class="insc-stat-label">Rejeitadas</span></div>
      </div>
      <div class="insc-stat-card insc-stat-recentes">
        <div class="insc-stat-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div>
        <div class="insc-stat-info"><span class="insc-stat-num">${recentes}</span><span class="insc-stat-label">Últimos 7 dias</span></div>
      </div>`;
    div.appendChild(stats);

    // Filters
    const f=document.createElement('div');f.className='insc-filters-card card';
    f.innerHTML=`<div class="insc-filters-row">
        <div class="insc-search-box">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" id="filterNome" placeholder="Pesquisar por nome ou código..." oninput="Modules.applyFilters()">
        </div>
        <div class="insc-filter-group">
          <select id="filterEstado" onchange="Modules.applyFilters()">
            <option value="">Todos os estados</option>
            <option value="iniciada">Iniciada</option>
            <option value="aguarda_confirmacao">Aguarda confirmação</option>
            <option value="confirmada">Confirmada</option>
            <option value="rejeitada">Rejeitada</option>
          </select>
          <select id="filterPerfil" onchange="Modules.applyFilters()">
            <option value="">Todos os perfis</option>
            ${PERFIS.map(p=>`<option value="${p}">${PERFIL_LABELS[p]}</option>`).join('')}
          </select>
          <select id="filterPagamento" onchange="Modules.applyFilters()">
            <option value="">Todas as formas</option>
            <option value="integral">Integral</option>
            <option value="parcelado">Parcelado</option>
          </select>
          <input type="date" id="filterDataInicio" onchange="Modules.applyFilters()" title="Data início">
          <input type="date" id="filterDataFim" onchange="Modules.applyFilters()" title="Data fim">
        </div>
      </div>
      <div class="insc-active-filters" id="activeFilters"></div>`;
    div.appendChild(f);

    // List card
    const listCard=document.createElement('div');listCard.className='card insc-list-card';
    listCard.innerHTML=`<div class="insc-list-header">
        <span class="insc-list-count" id="inscListCount">${total} inscrição${total!==1?'ões':''}</span>
      </div>
      <div class="insc-list" id="inscList">
        ${total===0?`<div class="pacotes-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--gray-300)" stroke-width="1.5"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          <h4>Nenhuma inscrição ainda</h4>
          <p>As inscrições aparecerão aqui quando forem recebidas.</p>
        </div>`:
        insc.map(i=>{
          const initials=i.nome_completo?.substring(0,2).toUpperCase()||'??';
          const color=avColor(i.nome_completo);
          const pagamento=i.modalidade_pagamento==='integral'?'Integral':`${i.numero_parcelas}x parcelado`;
          return`<div class="insc-list-row" data-id="${i.id}" data-nome="${normalize(i.nome_completo)}" data-estado="${i.estado}" data-perfil="${i.perfil}" data-pagamento="${i.modalidade_pagamento}" data-data="${i.data_inscricao}">
            <div class="insc-row-avatar" style="background:${color}">${initials}</div>
            <div class="insc-row-info">
              <div class="insc-row-name">${escapeHtml(i.nome_completo)}</div>
              <div class="insc-row-meta">
                <span class="insc-row-code">${escapeHtml(i.codigo_referencia)}</span>
                <span class="insc-row-date">${formatDate(i.data_inscricao)}</span>
              </div>
            </div>
            <div class="insc-row-badges">
              ${perfilBadge(i.perfil)}
              <span class="badge b-gray">${pagamento}</span>
              ${estadoBadge(i.estado)}
            </div>
            <button class="btn btn-outline btn-sm insc-row-btn" onclick="App.openDetail(${inlineArg(i.id)})">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              Ver
            </button>
          </div>`}).join('')}
      </div>`;
    div.appendChild(listCard);
    return div;
  },

  applyFilters(){
    const n=normalize(document.getElementById('filterNome')?.value||'');const e=document.getElementById('filterEstado')?.value||'';const p=document.getElementById('filterPerfil')?.value||'';const pg=document.getElementById('filterPagamento')?.value||'';const di=document.getElementById('filterDataInicio')?.value||'';const df=document.getElementById('filterDataFim')?.value||'';
    let visible=0;const total=document.querySelectorAll('.insc-list-row').length;
    document.querySelectorAll('.insc-list-row').forEach(r=>{if(!r.dataset.id)return;const show=(!n||r.dataset.nome.includes(n)||r.dataset.id.includes(n))&&(!e||r.dataset.estado===e)&&(!p||r.dataset.perfil===p)&&(!pg||r.dataset.pagamento===pg)&&(!di||r.dataset.data>=di)&&(!df||r.dataset.data<=df+'T23:59:59');r.style.display=show?'':'none';if(show)visible++});
    const countEl=document.getElementById('inscListCount');if(countEl)countEl.textContent=visible===total?`${total} inscrição${total!==1?'ões':''}`:`${visible} de ${total} inscrição${total!==1?'ões':''}`;
    // Active filters indicator
    const filtersEl=document.getElementById('activeFilters');
    if(filtersEl){const filters=[];if(n)filters.push(`Pesquisa: "${n}"`);if(e)filters.push(`Estado: ${e}`);if(p)filters.push(`Perfil: ${PERFIL_LABELS[p]||p}`);if(pg)filters.push(`Pagamento: ${pg}`);if(di)filters.push(`De: ${di}`);if(df)filters.push(`Até: ${df}`);filtersEl.innerHTML=filters.length?`<div class="insc-active-filters-row">${filters.map(f=>`<span class="insc-filter-tag">${f}<button onclick="Modules.clearFilter('${f.split(':')[0]}')">&times;</button></span>`).join('')}<button class="insc-clear-all" onclick="Modules.clearAllFilters()">Limpar filtros</button></div>`:''}
  },

  clearFilter(type){
    const map={Pesquisa:'filterNome',Estado:'filterEstado',Perfil:'filterPerfil',Pagamento:'filterPagamento',De:'filterDataInicio',Até:'filterDataFim'};
    const el=document.getElementById(map[type]);if(el)el.value='';
    this.applyFilters();
  },

  clearAllFilters(){
    ['filterNome','filterEstado','filterPerfil','filterPagamento','filterDataInicio','filterDataFim'].forEach(id=>{const el=document.getElementById(id);if(el)el.value=''});
    this.applyFilters();
  },

  exportCSV(){
    const db=DB.load();const h=['Nome','Email','Telefone','Cidade','Perfil','Pagamento','Estado','Código Ref','Código Conclusão','Data Inscrição','Data Confirmação'];
    const rows=db.inscricoes.map(i=>[i.nome_completo,i.email,i.telefone,i.cidade,PERFIL_LABELS[i.perfil]||i.perfil,i.modalidade_pagamento,i.estado,i.codigo_referencia,i.codigo_conclusao||'',formatDate(i.data_inscricao),formatDate(i.data_confirmacao)]);
    let csv='\uFEFF'+h.join(';')+'\n';rows.forEach(r=>{csv+=r.map(c=>`"${(c||'').toString().replace(/"/g,'""')}"`).join(';')+'\n'});
    const b=new Blob([repairMojibake(csv)],{type:'text/csv;charset=utf-8'});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download='inscricoes_aacademy.csv';a.click();toast('CSV exportado!');
  },

  // ========== DETALHE INSCRITO ==========
  inscricaoDetail(){
    const db=DB.load();const insc=db.inscricoes.find(i=>i.id===App._detailId);
    if(!insc){App.go('inscricoes');return document.createElement('div')}
    const cfg=db.configuracoes;const div=document.createElement('div');
    div.innerHTML=`<button class="btn btn-outline" onclick="App.go('inscricoes')" style="margin-bottom:14px">â† Voltar à lista</button>`;

    // Header
    const hdr=document.createElement('div');hdr.className='card welcome';
    hdr.innerHTML=`<div><h2>${escapeHtml(insc.nome_completo)}</h2><p class="muted">${escapeHtml(insc.codigo_referencia)} Â· ${PERFIL_LABELS[insc.perfil]||insc.perfil} Â· <span style="color:${insc.tipo_inscricao==='renovacao'?'#ec407a':'#22a34c'};font-weight:700">${insc.tipo_inscricao==='renovacao'?'Renovação':'Nova MatrÃ­cula'}</span></p></div><div style="display:flex;gap:8px;align-items:center"><select class="filter-input" id="tipoInscSelect" onchange="Modules.toggleTipoInscricao(${insc.id})" style="font-size:.75rem;padding:5px 8px"><option value="nova" ${insc.tipo_inscricao!=='renovacao'?'selected':''}>Nova MatrÃ­cula</option><option value="renovacao" ${insc.tipo_inscricao==='renovacao'?'selected':''}>Renovação</option></select>${estadoBadge(insc.estado)}</div>`;
    div.appendChild(hdr);

    // Grid
    const grid=document.createElement('div');grid.className='row row-2 modal-detail-grid';

    // LEFT
    const left=document.createElement('div');left.className='card modal-info-card';
    left.innerHTML=`
      <div class="settings-section"><h3>Dados Pessoais</h3>
        <div class="form-row"><div class="form-group"><label>Nome</label><input value="${escapeHtml(insc.nome_completo)}" readonly></div><div class="form-group"><label>Email</label><input value="${insc.email||'â€”'}" readonly></div></div>
        <div class="form-row"><div class="form-group"><label>Telefone</label><input value="${insc.telefone||'â€”'}" readonly></div><div class="form-group"><label>Cidade</label><input value="${insc.cidade||'â€”'}" readonly></div></div>
      </div>
      <div class="settings-section"><h3>Perfil: ${PERFIL_LABELS[insc.perfil]}</h3>${Modules._renderProfileFields(insc)}</div>
      <div class="settings-section"><h3>Pagamento</h3>
        <div class="form-row"><div class="form-group"><label>Modalidade</label><input value="${insc.modalidade_pagamento==='integral'?'Integral â€” Kz '+cfg.valor_total.toLocaleString('pt-BR'):insc.numero_parcelas+'x parcelado'}" readonly></div><div class="form-group"><label>Data Inscrição</label><input value="${formatDate(insc.data_inscricao)}" readonly></div></div>
        ${insc.codigo_conclusao?`<div class="form-group"><label>Código de Conclusão</label><input value="${insc.codigo_conclusao}" readonly style="font-weight:800;color:#22a34c;font-size:1.1rem"></div>`:''}
        ${insc.data_confirmacao?`<div class="form-group"><label>Data Confirmação</label><input value="${formatDateTime(insc.data_confirmacao)}" readonly></div>`:''}
      </div>`;
    grid.appendChild(left);

    // RIGHT
    const right=document.createElement('div');right.className='stack modal-actions-column';

    // Actions
    const act=document.createElement('div');act.className='card modal-actions-card';
    let aH='<h3>Ações</h3>';
    if(insc.estado===ESTADOS.AGUARDA||insc.estado===ESTADOS.INICIADA){
      if(insc.modalidade_pagamento==='integral'){aH+=`<button class="btn btn-primary" onclick="Modules.confirmPayment(${inlineArg(insc.id)})" style="width:100%;justify-content:center;margin-bottom:8px">Confirmar Pagamento Integral</button>`}
      else{aH+=`<p class="muted" style="margin-bottom:10px">Pagamento parcelado:</p>`;insc.parcelas.forEach((p,idx)=>{if(p.estado==='pendente'){const atr=p.prazo&&new Date(p.prazo)<new Date();aH+=`<button class="btn ${atr?'btn-danger':'btn-primary'} btn-sm" onclick="Modules.confirmParcela(${inlineArg(insc.id)},${inlineArg(p.id)})" style="width:100%;justify-content:center;margin-bottom:6px">Confirmar Parcela ${p.numero_parcela} â€” Kz ${p.valor.toLocaleString('pt-BR')}${atr?' (ATRASADA)':''}</button>`}})}
      aH+=`<hr style="margin:12px 0;border:none;border-top:1px solid #eef1f5"><button class="btn btn-danger" onclick="Modules.rejectInscricao(${inlineArg(insc.id)})" style="width:100%;justify-content:center">Rejeitar Inscrição</button>`;
    }else if(insc.estado===ESTADOS.CONFIRMADA){
      aH+=`<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:14px;margin-bottom:10px;text-align:center"><p style="font-weight:800;color:#15803d;font-size:1rem">Código de Conclusão</p><p style="font-size:1.3rem;font-weight:800;color:#0f5c2e;margin:6px 0">${insc.codigo_conclusao}</p>${cfg.link_grupo?`<p style="font-size:.82rem;margin-top:8px">Grupo: <a href="${cfg.link_grupo}" target="_blank" style="color:#22a34c;font-weight:700">${cfg.link_grupo}</a></p>`:''}</div>`;
      aH+=`<button class="btn btn-outline" onclick="Modules.reopenInscricao(${inlineArg(insc.id)})" style="width:100%;justify-content:center">Reabrir Inscrição</button>`;
    }else if(insc.estado===ESTADOS.REJEITADA){
      aH+=`<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:14px;margin-bottom:10px"><p style="font-weight:700;color:#ef4444">Inscrição rejeitada</p>${insc._motivo_rejeicao?`<p class="muted" style="margin-top:6px">Motivo: ${insc._motivo_rejeicao}</p>`:''}</div>`;
      aH+=`<button class="btn btn-outline" onclick="Modules.reopenInscricao(${inlineArg(insc.id)})" style="width:100%;justify-content:center">Reabrir Inscrição</button>`;
    }
    act.innerHTML=aH;right.appendChild(act);

    // Parcelas
    if(insc.modalidade_pagamento==='parcelado'&&insc.parcelas.length>0){
      const pc=document.createElement('div');pc.className='card modal-section-card';let pH='<h3>Parcelas</h3>';
      insc.parcelas.forEach(p=>{const c=p.estado==='confirmada'?'pago':(p.prazo&&new Date(p.prazo)<new Date()?'atrasada':'pendente');pH+=`<div class="parcela-card ${c}"><div><b>Parcela ${p.numero_parcela} de ${insc.numero_parcelas}</b><br><span class="muted">Kz ${p.valor.toLocaleString('pt-BR')}${p.prazo?' Â· Prazo: '+formatDate(p.prazo):''}</span></div><span class="badge ${p.estado==='confirmada'?'b-green':'b-orange'}">${p.estado==='confirmada'?'Confirmada':'Pendente'}</span></div>`});
      pc.innerHTML=pH;right.appendChild(pc);
    }

    // History
    if(insc.historico_estados&&insc.historico_estados.length>0){
      const hc=document.createElement('div');hc.className='card modal-section-card';let hH='<h3>Histórico de Estados</h3><div class="timeline">';
      const el={iniciada:'Iniciada',aguarda_confirmacao:'Aguarda confirmação',confirmada:'Confirmada',rejeitada:'Rejeitada'};
      insc.historico_estados.forEach(h=>{hH+=`<div class="tl-item"><h4>${el[h.estado]||h.estado}</h4><span class="when">ðŸ•“ ${formatDateTime(h.timestamp)}</span></div>`});
      hH+='</div>';hc.innerHTML=hH;right.appendChild(hc);
    }

    // Notes
    const nc=document.createElement('div');nc.className='card modal-section-card';let nH='<h3>Notas Internas</h3>';
    if(insc.notas_internas&&insc.notas_internas.length>0){nH+='<div style="margin-bottom:12px">';insc.notas_internas.forEach(n=>{nH+=`<div style="background:#eef1f0;border-radius:6px;padding:10px;margin-bottom:8px"><p style="font-size:.82rem">${n.texto}</p><p class="muted" style="font-size:.72rem;margin-top:4px">${n.autor} Â· ${formatDateTime(n.timestamp)}</p></div>`});nH+='</div>'}
    nH+=`<div class="form-group"><textarea id="newNote" placeholder="Escrever nota interna..." rows="2"></textarea></div><button class="btn btn-outline btn-sm" onclick="Modules.addNote(${inlineArg(insc.id)})">Adicionar Nota</button>`;
    nc.innerHTML=nH;right.appendChild(nc);

    grid.appendChild(right);div.appendChild(grid);return div;
  },

  _renderProfileFields(insc){
    const cs=insc.campos_especificos||{};const fl={igreja_nome:'Nome da igreja',igreja_funcao:'Função',igreja_membros:'NÂº de membros',igreja_ramo:'Ramo',empresa_nome:'Nome da empresa',empresa_cargo:'Cargo',empresa_setor:'Setor',empresa_func:'NÂº de funcionários',free_experiencia:'Experiência',free_nivel:'NÃ­vel',free_nicho:'Nicho',free_portfolio:'Portfólio',pessoal_motivo:'Motivação',pessoal_experiencia:'Experiência anterior',pessoal_software:'Software',pessoal_objetivo:'Objetivo',outro_texto:'Motivação',outro_area:'Área de interesse'};
    const k=Object.keys(cs);if(k.length===0)return'<p class="muted">Sem campos especÃ­ficos registados</p>';
    let h='<div class="form-row">';k.forEach((k,i)=>{if(i>0&&i%2===0)h+='</div><div class="form-row">';h+=`<div class="form-group"><label>${fl[k]||k}</label><input value="${cs[k]||'â€”'}" readonly></div>`});h+='</div>';return h;
  },

// ========== ACTIONS ==========
  async confirmPayment(id){
    try{
      if(!Auth.isAdmin())throw new Error('Apenas administradores podem confirmar pagamentos');
      const insc=DB.getInscricao(id);if(!insc)return;
      const body=`
        <div style="text-align:center;padding:8px 0 16px">
          <div style="width:48px;height:48px;background:rgba(34,197,94,.1);border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <p style="color:var(--muted);font-size:.88rem">Confirmar pagamento de <b style="color:var(--cream)">${escapeHtml(insc.nome_completo)}</b>?</p>
          <p style="color:var(--muted);font-size:.78rem;margin-top:4px">${escapeHtml(insc.codigo_referencia)} · ${insc.modalidade_pagamento==='integral'?'Pagamento integral':'Parcelado'}</p>
        </div>`;
      const footer=`
        <button class="btn btn-outline" onclick="App.closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="App.closeModal();Modules._doConfirmPayment('${id}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
          Confirmar
        </button>`;
      App.openModal('Confirmar Pagamento',body,footer);
    }catch(e){console.error('confirmPayment error:',e);toast('Erro: '+e.message)}
  },
  async _doConfirmPayment(id){
    try{
      const insc=DB.getInscricao(id);if(!insc)return;
      const now=new Date().toISOString();
      const updates={estado:ESTADOS.CONFIRMADA,data_confirmacao:now,historico_estados:[...(insc.historico_estados||[]),{estado:ESTADOS.CONFIRMADA,timestamp:now}]};
      if(!await DB.saveInscricao(insc.id,updates))throw new Error('Não foi possível atualizar a inscrição na base de dados');
      await DB.refresh();
      const updated=DB.getInscricao(id);
      const code=updated?.codigo_conclusao||'';
      Notif.addCustom('pagamento_confirmado',`Pagamento confirmado: ${escapeHtml(insc.nome_completo)}`,`${escapeHtml(insc.codigo_referencia)} · Codigo: ${code}`);toast(`Confirmado! Codigo: ${code}`);App.closeModal();App.render();
    }catch(e){console.error('_doConfirmPayment error:',e);toast('Erro: '+e.message)}
  },
  async confirmParcela(inscId,parcelaIdx){
    try{
      if(!Auth.isAdmin())throw new Error('Apenas administradores podem confirmar parcelas');
      const db=DB.load();const insc=DB.getInscricao(inscId);if(!insc)return;const p=insc.parcelas.find(parcela=>String(parcela.id)===String(parcelaIdx))||insc.parcelas[parcelaIdx];if(!p||p.estado==='confirmada')return;
      const body=`
        <div style="text-align:center;padding:8px 0 16px">
          <div style="width:48px;height:48px;background:rgba(59,130,246,.1);border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
          </div>
          <p style="color:var(--muted);font-size:.88rem">Confirmar pagamento da <b style="color:var(--cream)">Parcela ${p.numero_parcela}</b>?</p>
          <p style="color:var(--muted);font-size:.78rem;margin-top:4px">${escapeHtml(insc.nome_completo)} · Kz ${Number(p.valor).toLocaleString('pt-BR')}</p>
        </div>`;
      const footer=`
        <button class="btn btn-outline" onclick="App.closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="App.closeModal();Modules._doConfirmParcela('${inscId}','${parcelaIdx}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
          Confirmar
        </button>`;
      App.openModal('Confirmar Parcela',body,footer);
    }catch(e){console.error('confirmParcela error:',e);toast('Erro: '+e.message)}
  },
  async _doConfirmParcela(inscId,parcelaIdx){
    try{
      const db=DB.load();const insc=DB.getInscricao(inscId);if(!insc)return;const p=insc.parcelas.find(parcela=>String(parcela.id)===String(parcelaIdx))||insc.parcelas[parcelaIdx];if(!p||p.estado==='confirmada')return;
      const now=new Date().toISOString();p.estado='confirmada';p.data_confirmacao=now;insc.historico_estados=[...(insc.historico_estados||[]),{estado:`parcela_${p.numero_parcela}_confirmada`,timestamp:now}];
      const cfg=db.configuracoes;const allPaid=insc.parcelas.every(p=>p.estado==='confirmada');const firstPaid=insc.parcelas[0].estado==='confirmada';
      let shouldConfirm=false;
      if(cfg.regra_liberacao_codigo==='primeira_parcela'&&firstPaid&&insc.estado!==ESTADOS.CONFIRMADA){shouldConfirm=true;toast('1a parcela paga! A confirmar...')}
      else if(cfg.regra_liberacao_codigo==='pagamento_total'&&allPaid&&insc.estado!==ESTADOS.CONFIRMADA){shouldConfirm=true;toast('Total pago! A confirmar...')}
      else{toast(`Parcela ${p.numero_parcela} confirmada`)}
      const updates={parcelas:insc.parcelas,historico_estados:insc.historico_estados};
      if(shouldConfirm){updates.estado=ESTADOS.CONFIRMADA;updates.data_confirmacao=now}
      if(!await DB.saveInscricao(inscId,updates))throw new Error('Não foi possível atualizar a parcela na base de dados');
      await DB.refresh();App.closeModal();App.render();
    }catch(e){console.error('_doConfirmParcela error:',e);toast('Erro: '+e.message)}
  },
  async rejectInscricao(id){
    try{
      if(!Auth.isAdmin())throw new Error('Apenas administradores podem rejeitar inscrições');
      const insc=DB.getInscricao(id);if(!insc)return;
      const body=`
        <div style="text-align:center;padding:8px 0 16px">
          <div style="width:48px;height:48px;background:rgba(239,68,68,.1);border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          </div>
          <p style="color:var(--muted);font-size:.88rem">Tem certeza que deseja rejeitar a inscrição de <b style="color:var(--cream)">${escapeHtml(insc.nome_completo)}</b>?</p>
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label style="font-size:.78rem;font-weight:600;color:var(--muted);margin-bottom:6px;display:block">Motivo da rejeição (opcional)</label>
          <textarea id="rejectMotivo" rows="3" placeholder="Ex: Documentos em falta, pagamento não confirmado..." style="width:100%;background:var(--card);border:1.5px solid var(--card-border);border-radius:8px;padding:10px 12px;color:var(--cream);font-family:inherit;font-size:.88rem;resize:vertical;outline:none"></textarea>
        </div>`;
      const footer=`
        <button class="btn btn-outline" onclick="App.closeModal()">Cancelar</button>
        <button class="btn btn-danger" onclick="Modules._confirmReject('${id}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          Rejeitar
        </button>`;
      App.openModal('Rejeitar Inscrição',body,footer);
      setTimeout(()=>document.getElementById('rejectMotivo')?.focus(),150);
    }catch(e){console.error('rejectInscricao error:',e);toast('Erro: '+e.message)}
  },
  async _confirmReject(id){
    try{
      const m=document.getElementById('rejectMotivo')?.value||'';
      const insc=DB.getInscricao(id);if(!insc)return;const now=new Date().toISOString();
      const updates={estado:ESTADOS.REJEITADA,motivo_rejeicao:m,historico_estados:[...(insc.historico_estados||[]),{estado:ESTADOS.REJEITADA,timestamp:now,motivo:m}]};
      if(!await DB.saveInscricao(insc.id,updates))throw new Error('Não foi possível atualizar a inscrição na base de dados');Object.assign(insc,updates);DB.save();toast('Inscrição rejeitada');App.closeModal();App.render();
    }catch(e){console.error('_confirmReject error:',e);toast('Erro: '+e.message)}
  },
async reopenInscricao(id){
    try{
  if(!Auth.isAdmin())throw new Error('Apenas administradores podem reabrir inscrições');
      const insc=DB.getInscricao(id);if(!insc)return;
      const body=`
        <div style="text-align:center;padding:8px 0 16px">
          <div style="width:48px;height:48px;background:rgba(59,130,246,.1);border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
          </div>
          <p style="color:var(--muted);font-size:.88rem">Reabrir a inscrição de <b style="color:var(--cream)">${escapeHtml(insc.nome_completo)}</b>?</p>
          <p style="color:var(--muted);font-size:.78rem;margin-top:4px">${escapeHtml(insc.codigo_referencia)} · Estado atual: ${insc.estado==='rejeitada'?'Rejeitada':'Confirmada'}</p>
        </div>`;
      const footer=`
        <button class="btn btn-outline" onclick="App.closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="App.closeModal();Modules._doReopen('${id}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
          Reabrir
        </button>`;
      App.openModal('Reabrir Inscrição',body,footer);
    }catch(e){console.error('reopenInscricao error:',e);toast('Erro: '+e.message)}
  },
  async _doReopen(id){
    try{
      const insc=DB.getInscricao(id);if(!insc)return;const now=new Date().toISOString();const prev=insc.estado;
      const updates={estado:ESTADOS.AGUARDA,codigo_conclusao:null,data_confirmacao:null,motivo_rejeicao:'',parcelas:(insc.parcelas||[]).map(p=>({...p,estado:'pendente',data_confirmacao:null})),historico_estados:[...(insc.historico_estados||[]),{estado:ESTADOS.AGUARDA,timestamp:now,nota:`Reaberto de "${prev}"`}]};
      if(!await DB.saveInscricao(insc.id,updates))throw new Error('Não foi possível atualizar a inscrição na base de dados');Object.assign(insc,updates);DB.save();toast('Inscrição reaberta');App.closeModal();App.render();
    }catch(e){console.error('_doReopen error:',e);toast('Erro: '+e.message)}
  },
  async addNote(id){
    try{
      if(!Auth.isAdmin())throw new Error('Apenas administradores podem adicionar notas');
      const ta=document.getElementById('newNote');const t=ta?.value?.trim();if(!t)return;const insc=DB.getInscricao(id);if(!insc)return;
      const notas=[...(insc.notas_internas||[]),{autor:Auth.currentUser?.nome||'Admin',texto:t,timestamp:new Date().toISOString()}];
      if(!await DB.saveInscricao(insc.id,{notas_internas:notas}))throw new Error('Não foi possível guardar a nota na base de dados');insc.notas_internas=notas;DB.save();toast('Nota adicionada');App.render();
    }catch(e){console.error('addNote error:',e);toast('Erro: '+e.message)}
  },
  async toggleTipoInscricao(id){
    try{
      if(!Auth.isAdmin())throw new Error('Apenas administradores podem alterar o tipo de inscrição');
      const val=document.getElementById('tipoInscSelect')?.value;if(!val)return;const insc=DB.getInscricao(id);if(!insc)return;
      const updates={tipo_inscricao:val,historico_estados:[...(insc.historico_estados||[]),{estado:insc.estado,timestamp:new Date().toISOString(),nota:`Tipo alterado para "${val}"`}]};
      if(!await DB.saveInscricao(insc.id,updates))throw new Error('Não foi possível atualizar o tipo na base de dados');Object.assign(insc,updates);DB.save();toast('Tipo atualizado');App.render();
    }catch(e){console.error('toggleTipoInscricao error:',e);toast('Erro: '+e.message)}
  },

  // ========== PRESENÃ‡A ==========
  presenca(){
    const db=DB.load();const sessoes=db.presencas||[];const insc=db.inscricoes.filter(i=>i.estado===ESTADOS.CONFIRMADA);const div=document.createElement('div');
    const totalSessoes=sessoes.length;
    const totalRegistos=sessoes.reduce((s,se)=>s+(se.presentes?.length||0)+(se.ausentes?.length||0),0);
    const totalPresentes=sessoes.reduce((s,se)=>s+(se.presentes?.length||0),0);
    const taxaGlobal=totalRegistos>0?Math.round(totalPresentes/totalRegistos*100):0;

    div.innerHTML=`<div class="card welcome"><div><h2>Controlo de Presença</h2><p class="muted">Registar quem compareceu e quem faltou em cada sessão.</p></div><div style="display:flex;gap:10px"><button class="btn btn-primary" onclick="App.go('presenca_nova')">Nova Sessão</button></div></div>`;

    // Stats
    const statsRow=document.createElement('div');statsRow.className='pills stagger';
    statsRow.innerHTML=`
      <div class="pill-card p-green"><span class="ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></span><div><em>Sessões</em><strong>${totalSessoes} <small>registadas</small></strong></div></div>
      <div class="pill-card p-blue"><span class="ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></span><div><em>Alunos Confirmados</em><strong>${insc.length} <small>no curso</small></strong></div></div>
      <div class="pill-card p-pink"><span class="ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></span><div><em>Total Presenças</em><strong>${totalPresentes} <small>registos</small></strong></div></div>
      <div class="pill-card p-orange"><span class="ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg></span><div><em>Taxa Global</em><strong>${taxaGlobal}% <small>presença</small></strong></div></div>`;
    div.appendChild(statsRow);

    // Session list
    const card=document.createElement('div');card.className='card';
    if(sessoes.length===0){
      card.innerHTML=`<div style="text-align:center;padding:40px"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#b6c2cc" stroke-width="1.5"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg><h3 style="margin-top:12px;color:#8a94a6;font-size:.92rem">Nenhuma sessão registada</h3><p class="muted" style="margin:8px 0 16px">Crie a primeira sessão para começar a controlar a presença.</p><button class="btn btn-primary" onclick="App.go('presenca_nova')">Criar Sessão</button></div>`;
    } else {
      let h=`<div class="welcome" style="margin-bottom:14px"><h3>Sessões (${sessoes.length})</h3><button class="btn btn-outline btn-sm" onclick="Modules.exportPresencaCSV()">Exportar CSV</button></div>`;
      h+=`<table><thead><tr><th>SESSÃƒO</th><th>DATA</th><th>PRESENÃ‡AS</th><th>TAXA</th><th></th></tr></thead><tbody>`;
      sessoes.slice().reverse().forEach(s=>{
        const total=(s.presentes?.length||0)+(s.ausentes?.length||0);
        const taxa=total>0?Math.round((s.presentes?.length||0)/total*100):0;
        const barColor=taxa>=80?'#22a34c':taxa>=50?'#fb8c00':'#ef4444';
        h+=`<tr style="cursor:pointer" onclick="Modules.viewPresenca(${s.id})"><td><b>${s.titulo||'Sem tÃ­tulo'}</b></td><td>${formatDate(s.data)}</td><td><span style="font-weight:800">${s.presentes?.length||0}</span> <span class="muted">/ ${total}</span></td><td><div style="display:flex;align-items:center;gap:8px"><div class="attd-progress" style="width:80px"><i style="width:${taxa}%"></i></div><span style="font-weight:800;font-size:.82rem;color:${barColor}">${taxa}%</span></div></td><td><button class="btn btn-outline btn-sm" onclick="event.stopPropagation();Modules.viewPresenca(${s.id})">Ver</button></td></tr>`;
      });
      h+=`</tbody></table>`;
      card.innerHTML=h;
    }
    div.appendChild(card);
    return div;
  },

  presencaNova(){
    const db=DB.load();const insc=db.inscricoes.filter(i=>i.estado===ESTADOS.CONFIRMADA);const div=document.createElement('div');
    const today=new Date().toISOString().split('T')[0];
    div.innerHTML=`<button class="btn btn-outline" onclick="App.go('presenca')" style="margin-bottom:14px">â† Voltar</button>
      <div class="card welcome"><h2>Nova Sessão de Presença</h2></div>`;

    const form=document.createElement('div');form.className='card';
    form.innerHTML=`
      <div class="settings-section"><h3>Dados da Sessão</h3>
        <div class="form-row">
          <div class="form-group"><label>TÃ­tulo da Sessão</label><input id="attdTitulo" placeholder="Ex: Aula 1 â€” Introdução ao Design"></div>
          <div class="form-group"><label>Data</label><input type="date" id="attdData" value="${today}"></div>
        </div>
      </div>
      <div class="settings-section"><h3>Marcar Presença (${insc.length} alunos confirmados)</h3>
        ${insc.length===0?'<p class="muted">Nenhum aluno confirmado no curso. Confirme inscrições primeiro.</p>':''}
        <div class="attd-checklist" id="attdChecklist">
          ${insc.map(i=>`<div class="attd-row"><input type="checkbox" id="attd_${i.id}" value="${i.id}" checked><label for="attd_${i.id}"><span class="av" style="background:${avColor(i.nome_completo)}">${escapeHtml(i.nome_completo?.substring(0,2).toUpperCase()||'??')}</span>${escapeHtml(i.nome_completo)} <span class="muted" style="font-size:.72rem">${escapeHtml(i.codigo_referencia||'')}</span></label></div>`).join('')}
        </div>
        <div style="margin-top:12px;display:flex;gap:10px">
          <button class="btn btn-outline btn-sm" onclick="Modules._toggleAllAttd(true)">Marcar todos</button>
          <button class="btn btn-outline btn-sm" onclick="Modules._toggleAllAttd(false)">Desmarcar todos</button>
        </div>
      </div>
      <div style="margin-top:18px;display:flex;gap:10px">
        <button class="btn btn-primary" onclick="Modules.savePresenca(${JSON.stringify(insc.map(i=>i.id)).replace(/"/g,'&quot;')})">Guardar Sessão</button>
        <button class="btn btn-outline" onclick="App.go('presenca')">Cancelar</button>
      </div>`;
    div.appendChild(form);return div;
  },

  _toggleAllAttd(checked){document.querySelectorAll('#attdChecklist input[type=checkbox]').forEach(cb=>cb.checked=checked)},

  async savePresenca(allIds){
    const titulo=document.getElementById('attdTitulo')?.value?.trim();const data=document.getElementById('attdData')?.value;
    if(!titulo){toast('Escreva o tÃ­tulo da sessão');return}
    if(!data){toast('Selecione a data');return}
    const db=DB.load();if(!db.presencas)db.presencas=[];
    const presentes=[];const ausentes=[];
    allIds.forEach(id=>{const cb=document.getElementById('attd_'+id);if(cb&&cb.checked)presentes.push(id);else ausentes.push(id)});
    const {data:sessao,error}=await supabase.from('presencas_sessoes').insert({titulo,data,criado_por:Auth.currentUser?.id}).select().single();
    if(error){console.error('savePresenca error:',error);toast('Erro: '+error.message);return}
    const registos=allIds.map(inscricao_id=>({sessao_id:sessao.id,inscricao_id,presente:presentes.includes(inscricao_id)}));
    const {error:registosError}=await supabase.from('presencas_registos').insert(registos);
    if(registosError){await supabase.from('presencas_sessoes').delete().eq('id',sessao.id);console.error('savePresenca records error:',registosError);toast('Erro ao guardar presenças: '+registosError.message);return}
    await DB.refresh();Notif.addCustom('presenca',`Sessão registada: ${titulo}`,`${presentes.length} presentes, ${ausentes.length} ausentes Â· ${data}`);toast(`Sessão "${titulo}" guardada!`);App.go('presenca');
  },

  presencaVer(){
    const db=DB.load();const sessao=(db.presencas||[]).find(s=>s.id===App._detailId);if(!sessao){App.go('presenca');return document.createElement('div')}
    const insc=db.inscricoes.filter(i=>i.estado===ESTADOS.CONFIRMADA);
    const div=document.createElement('div');
    div.innerHTML=`<button class="btn btn-outline" onclick="App.go('presenca')" style="margin-bottom:14px">â† Voltar</button>`;

    const total=(sessao.presentes?.length||0)+(sessao.ausentes?.length||0);
    const presentes=total-sessao.ausentes?.length||0;
    const taxa=total>0?Math.round(presentes/total*100):0;
    const barColor=taxa>=80?'#22a34c':taxa>=50?'#fb8c00':'#ef4444';

    // Header
    const hdr=document.createElement('div');hdr.className='card welcome';
    hdr.innerHTML=`<div><h2>${sessao.titulo}</h2><p class="muted">${formatDate(sessao.data)} Â· Registado por ${sessao.criado_por||'Admin'}</p></div><div><button class="btn btn-danger btn-sm" onclick="Modules.deletePresenca(${sessao.id})">Eliminar</button></div>`;
    div.appendChild(hdr);

    // Stats bar
    const stats=document.createElement('div');stats.className='card';
    stats.innerHTML=`<div class="attd-stats-bar">
      <div><span>Total Alunos</span><b>${total}</b></div>
      <div><span>Presentes</span><b style="color:#22a34c">${presentes}</b></div>
      <div><span>Ausentes</span><b style="color:#ef4444">${sessao.ausentes?.length||0}</b></div>
      <div><span>Taxa</span><b style="color:${barColor}">${taxa}%</b></div>
    </div>
    <div class="attd-progress"><i style="width:${taxa}%"></i></div>`;
    div.appendChild(stats);

    // Present list
    const presCard=document.createElement('div');presCard.className='card';
    let pH=`<h3>Presentes (${presentes})</h3>`;
    const presInsc=insc.filter(i=>(sessao.presentes||[]).includes(i.id));
    if(presInsc.length===0){pH+=`<p class="muted">Nenhum aluno presente registado.</p>`}
    else{pH+=presInsc.map(i=>`<div class="attd-row"><span class="av" style="background:${avColor(i.nome_completo)}">${escapeHtml(i.nome_completo?.substring(0,2).toUpperCase()||'??')}</span><label>${escapeHtml(i.nome_completo)} <span class="muted" style="font-size:.72rem">${escapeHtml(i.codigo_referencia||'')}</span></label><span class="badge b-green" style="font-size:.64rem">Presente</span></div>`).join('')}
    presCard.innerHTML=pH;div.appendChild(presCard);

    // Absent list
    const ausCard=document.createElement('div');ausCard.className='card';
    let aH=`<h3>Ausentes (${sessao.ausentes?.length||0})</h3>`;
    const ausInsc=insc.filter(i=>(sessao.ausentes||[]).includes(i.id));
    if(ausInsc.length===0){aH+=`<p class="muted">Todos os alunos presentes!</p>`}
    else{aH+=ausInsc.map(i=>`<div class="attd-row"><span class="av" style="background:${avColor(i.nome_completo)}">${escapeHtml(i.nome_completo?.substring(0,2).toUpperCase()||'??')}</span><label>${escapeHtml(i.nome_completo)} <span class="muted" style="font-size:.72rem">${escapeHtml(i.codigo_referencia||'')}</span></label><span class="badge b-red" style="font-size:.64rem">Ausente</span></div>`).join('')}
    ausCard.innerHTML=aH;div.appendChild(ausCard);

    return div;
  },

  viewPresenca(id){App._detailId=id;App.currentRoute='presenca_ver';App.render()},

  async deletePresenca(id){
    const body=`
      <div style="text-align:center;padding:8px 0 16px">
        <div style="width:48px;height:48px;background:rgba(239,68,68,.1);border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </div>
        <p style="color:var(--muted);font-size:.88rem">Eliminar esta sessão de presença?</p>
        <p style="color:var(--muted);font-size:.78rem;margin-top:4px">Esta ação não pode ser desfeita.</p>
      </div>`;
    const footer=`
      <button class="btn btn-outline" onclick="App.closeModal()">Cancelar</button>
      <button class="btn btn-danger" onclick="App.closeModal();Modules._doDeletePresenca('${id}')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        Eliminar
      </button>`;
    App.openModal('Eliminar Sessão',body,footer);
  },
  async _doDeletePresenca(id){
    const {error}=await supabase.from('presencas_sessoes').delete().eq('id',id);
    if(error){toast('Erro: '+error.message);return}
    await DB.refresh();toast('Sessão eliminada');App.go('presenca');
  },

  exportPresencaCSV(){
    const db=DB.load();const sessoes=db.presencas||[];const insc=db.inscricoes.filter(i=>i.estado===ESTADOS.CONFIRMADA);
    if(sessoes.length===0){toast('Nenhuma sessão para exportar');return}
    const h=['Sessão','Data','Total','Presentes','Ausentes','Taxa %'];
    const rows=sessoes.map(s=>{const t=(s.presentes?.length||0)+(s.ausentes?.length||0);const p=s.presentes?.length||0;return[s.titulo,formatDate(s.data),t,p,t-p,t>0?Math.round(p/t*100):0]});
    let csv='\uFEFF'+h.join(';')+'\n';rows.forEach(r=>{csv+=r.map(c=>`"${(c||'').toString().replace(/"/g,'""')}"`).join(';')+'\n'});
    const b=new Blob([repairMojibake(csv)],{type:'text/csv;charset=utf-8'});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download='presenca_aacademy.csv';a.click();toast('CSV exportado!');
  },

  // ========== SETTINGS ==========
  settings(){
    const db=DB.load();const cfg=db.configuracoes;const div=document.createElement('div');
    div.innerHTML=`<div class="card welcome"><h2>Definições</h2></div>`;
    const card=document.createElement('div');card.className='card';
    card.innerHTML=`
      <div class="settings-section"><h3>Dados do Curso</h3>
        <div class="form-row"><div class="form-group"><label>Nome do Curso</label><input id="cfgNome" value="Curso de Design Gráfico"></div><div class="form-group"><label>Data de InÃ­cio</label><input type="date" id="cfgDataInicio" value="${cfg.data_inicio||''}"></div></div>
        <div class="form-row"><div class="form-group"><label>NÂº de Módulos</label><input type="number" id="cfgModulos" value="${cfg.num_modulos}"></div><div class="form-group"><label>Duração</label><input id="cfgDuracao" value="${cfg.duracao}"></div></div>
      </div>
      <div class="settings-section"><h3>Inscrições</h3>
        <p class="muted" style="margin-bottom:12px">Controla se novos alunos podem enviar o formulário de inscrição.</p>
        <button type="button" class="btn ${cfg.inscricoes_ativas !== false ? 'btn-primary' : 'btn-outline'}" onclick="Modules.toggleInscricoes()" id="cfgInscricoesBtn">${cfg.inscricoes_ativas !== false ? 'Desativar inscrições' : 'Ativar inscrições'}</button>
        <span id="cfgInscricoesStatus" class="badge ${cfg.inscricoes_ativas !== false ? 'b-green' : 'b-red'}" style="margin-left:10px">${cfg.inscricoes_ativas !== false ? 'Ativas' : 'Desativadas'}</span>
      </div>
      <div class="settings-section"><h3>Preço e Parcelamento</h3>
        <div class="form-row"><div class="form-group"><label>Valor Total (Kz)</label><input type="number" id="cfgValor" value="${cfg.valor_total}"></div><div class="form-group"><label>NÂº de Parcelas</label><input type="number" id="cfgParcelas" value="${cfg.parcelas}"></div></div>
        <div class="form-row"><div class="form-group"><label>Valor por Parcela (Kz)</label><input type="number" id="cfgValorParcela" value="${cfg.valor_parcela}"></div><div class="form-group"><label>Regra de Libertação do Código</label><select id="cfgRegra"><option value="primeira_parcela" ${cfg.regra_liberacao_codigo==='primeira_parcela'?'selected':''}>Após 1Âª parcela</option><option value="pagamento_total" ${cfg.regra_liberacao_codigo==='pagamento_total'?'selected':''}>Após pagamento total</option></select></div></div>
      </div>
      <div class="settings-section"><h3>Dados de Pagamento</h3>
        <div class="form-group"><label>IBAN</label><input id="cfgIban" value="${cfg.iban}"></div>
        <div class="form-group"><label>Titular</label><input id="cfgTitular" value="${cfg.titular_iban}"></div>
        <div class="form-group"><label>WhatsApp para Comprovativo</label><input id="cfgWhatsapp" value="${cfg.whatsapp_comprovativo}"></div>
      </div>
      <div class="settings-section"><h3>Modalidades de Pagamento</h3>
        <p class="muted" style="margin-bottom:12px">Informação apresentada ao inscrito após submeter a inscrição.</p>
        <div class="form-row">
          <div class="form-group"><label>Multicaixa Express (nº telefone)</label><input id="cfgExpress" value="${cfg.express_number||''}" placeholder="941 679 799"></div>
          <div class="form-group"><label>Nome no Express</label><input id="cfgExpressNome" value="${cfg.express_nome||''}" placeholder="Adilson Amado"></div>
        </div>
        <div class="form-group"><label>PayPal (email)</label><input id="cfgPaypal" value="${cfg.paypal_email||''}" placeholder="email@exemplo.com"></div>
      </div>
      <button class="btn btn-primary" onclick="Modules.saveSettings()">Guardar Alterações</button>
      <div class="settings-section" style="margin-top:30px;border-top:2px solid #fecaca;padding-top:20px">
        <h3 style="color:#ef4444">Zona de Perigo</h3>
        <div style="margin-bottom:16px">
          <p class="muted" style="margin-bottom:8px">Apagar todos os inscritos, presenças e histórico.</p>
          <button type="button" class="btn btn-danger btn-sm" onclick="Modules.resetInscritosData()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            Apagar Dados dos Inscritos
          </button>
        </div>
        <div style="border-top:1px solid #fecaca;padding-top:12px">
          <p class="muted" style="margin-bottom:8px">Apagar TUDO: inscritos, pacotes, módulos e parcerias.</p>
          <button type="button" class="btn btn-danger" onclick="Modules.resetAllData()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            Apagar Tudo
          </button>
        </div>
      </div>`;
    div.appendChild(card);return div;
  },
  async toggleInscricoes(){
    const db=DB.load();
    const novoEstado=db.configuracoes.inscricoes_ativas===false;
    try{
      const {data,error}=await supabase.rpc('definir_inscricoes_ativas',{p_ativas:novoEstado});
      if(error)throw error;
      db.configuracoes.inscricoes_ativas=data===true;
      DB.save();
      const btn=document.getElementById('cfgInscricoesBtn');
      const status=document.getElementById('cfgInscricoesStatus');
      if(btn){btn.textContent=db.configuracoes.inscricoes_ativas?'Desativar inscrições':'Ativar inscrições';btn.className=`btn ${db.configuracoes.inscricoes_ativas?'btn-primary':'btn-outline'}`}
      if(status){status.textContent=db.configuracoes.inscricoes_ativas?'Ativas':'Desativadas';status.className=`badge ${db.configuracoes.inscricoes_ativas?'b-green':'b-red'}`}
      toast(db.configuracoes.inscricoes_ativas?'Inscrições ativadas!':'Inscrições desativadas!');
    }catch(e){console.error('toggleInscricoes error:',e);toast('Erro: '+e.message)}
  },
  async saveSettings(){
    try {
      const db=DB.load();const cfg=db.configuracoes;
      cfg.data_inicio=document.getElementById('cfgDataInicio').value;cfg.num_modulos=parseInt(document.getElementById('cfgModulos').value)||18;cfg.duracao=document.getElementById('cfgDuracao').value;cfg.valor_total=parseInt(document.getElementById('cfgValor').value)||45000;cfg.parcelas=parseInt(document.getElementById('cfgParcelas').value)||3;cfg.valor_parcela=parseInt(document.getElementById('cfgValorParcela').value)||15000;cfg.regra_liberacao_codigo=document.getElementById('cfgRegra').value;cfg.iban=document.getElementById('cfgIban').value;cfg.titular_iban=document.getElementById('cfgTitular').value;cfg.whatsapp_comprovativo=document.getElementById('cfgWhatsapp').value;cfg.express_number=document.getElementById('cfgExpress').value;cfg.express_nome=document.getElementById('cfgExpressNome').value;cfg.paypal_email=document.getElementById('cfgPaypal').value;
      const {data: cfgRow} = await supabase.from('configuracoes').select('id').limit(1).single();
      if(!cfgRow?.id){throw new Error('Configuração não encontrada na base de dados')}
      const {error}=await supabase.from('configuracoes').update(cfg).eq('id',cfgRow.id);
      if(error)throw error;
      DB.save();localStorage.setItem('aacademy_config',JSON.stringify(cfg));toast('Definições guardadas!');
    } catch(e) {console.error('saveSettings error:',e);toast('Erro: '+e.message)}
  },

  async resetAllData(){
    const body=`
      <div style="text-align:center;padding:8px 0 16px">
        <div style="width:52px;height:52px;background:rgba(239,68,68,.12);border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        </div>
        <h3 style="color:#ef4444;margin-bottom:8px">Apagar Tudo</h3>
        <p style="color:var(--muted);font-size:.85rem;line-height:1.5">Isto vai apagar <b style="color:#ef4444">TODOS</b> os dados do sistema:</p>
        <ul style="text-align:left;color:var(--muted);font-size:.82rem;margin:8px 0 0 20px;line-height:1.8">
          <li>Inscrições e presenças</li>
          <li>Pacotes do curso</li>
          <li>Módulos do curso</li>
          <li>Parcerias e códigos</li>
        </ul>
        <p style="color:var(--muted);font-size:.78rem;margin-top:8px">Apenas as <b>configurações</b> e <b>contas de admin</b> serão mantidas.</p>
        <p style="color:#ef4444;font-weight:700;font-size:.82rem;margin-top:8px">Esta ação é IRREVERSÍVEL.</p>
      </div>
      <div class="form-group" style="margin-bottom:0">
        <label style="font-size:.78rem;font-weight:600;color:var(--muted);margin-bottom:6px;display:block">Digite <b style="color:#ef4444">APAGAR TUDO</b> para confirmar</label>
        <input id="resetConfirmInput" placeholder="APAGAR TUDO" style="width:100%;background:var(--card);border:1.5px solid var(--card-border);border-radius:8px;padding:10px 12px;color:var(--cream);font-family:inherit;font-size:.88rem;outline:none">
      </div>`;
    const footer=`
      <button class="btn btn-outline" onclick="App.closeModal()">Cancelar</button>
      <button class="btn btn-danger" onclick="Modules._confirmReset()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        Apagar Tudo
      </button>`;
    App.openModal('Apagar Todos os Dados',body,footer);
    setTimeout(()=>document.getElementById('resetConfirmInput')?.focus(),150);
  },
  async _confirmReset(){
    const val=document.getElementById('resetConfirmInput')?.value||'';
    if(val!=='APAGAR TUDO'){toast('Confirmação cancelada.');App.closeModal();return}
    try{
      toast('A apagar dados...');
      const{error}=await supabase.rpc('reset_all_data');
      if(error)throw error;
      localStorage.removeItem('aacademy_db');
      localStorage.removeItem('aacademy_config');
      localStorage.removeItem('aacademy_notifs');
      localStorage.removeItem('inscricoes');
      toast('Todos os dados foram apagados!');
      App.closeModal();
      DB._data=null;
      await DB.refresh();
      App.render();
    }catch(e){console.error('_confirmReset error:',e);toast('Erro ao apagar dados: '+e.message)}
  },

  resetInscritosData(){
    const body=`
      <div style="text-align:center;padding:8px 0 16px">
        <div style="width:52px;height:52px;background:rgba(239,68,68,.12);border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        </div>
        <h3 style="color:#ef4444;margin-bottom:8px">Apagar Dados dos Inscritos</h3>
        <p style="color:var(--muted);font-size:.85rem;line-height:1.5">Isto vai apagar <b style="color:#ef4444">TODOS</b> os dados dos inscritos:</p>
        <ul style="text-align:left;color:var(--muted);font-size:.82rem;margin:8px 0 0 20px;line-height:1.8">
          <li>Inscrições (todas)</li>
          <li>Presenças e sessões</li>
          <li>Histórico de estados</li>
        </ul>
        <p style="color:var(--muted);font-size:.78rem;margin-top:8px">Os <b>pacotes</b>, <b>módulos</b> e <b>configurações</b> serão mantidos.</p>
        <p style="color:#ef4444;font-weight:700;font-size:.82rem;margin-top:8px">Esta ação é IRREVERSÍVEL.</p>
      </div>
      <div class="form-group" style="margin-bottom:0">
        <label style="font-size:.78rem;font-weight:600;color:var(--muted);margin-bottom:6px;display:block">Digite <b style="color:#ef4444">APAGAR INSCRITOS</b> para confirmar</label>
        <input id="resetInscConfirmInput" placeholder="APAGAR INSCRITOS" style="width:100%;background:var(--card);border:1.5px solid var(--card-border);border-radius:8px;padding:10px 12px;color:var(--cream);font-family:inherit;font-size:.88rem;outline:none">
      </div>`;
    const footer=`
      <button class="btn btn-outline" onclick="App.closeModal()">Cancelar</button>
      <button class="btn btn-danger" onclick="Modules._confirmResetInscritos()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        Apagar Inscritos
      </button>`;
    App.openModal('Apagar Dados dos Inscritos',body,footer);
    setTimeout(()=>document.getElementById('resetInscConfirmInput')?.focus(),150);
  },
  async _confirmResetInscritos(){
    const val=document.getElementById('resetInscConfirmInput')?.value||'';
    if(val!=='APAGAR INSCRITOS'){toast('Confirmação cancelada.');App.closeModal();return}
    try{
      toast('A apagar dados dos inscritos...');
      const{error}=await supabase.rpc('reset_inscritos_data');
      if(error)throw error;
      localStorage.removeItem('aacademy_db');
      localStorage.removeItem('inscricoes');
      toast('Dados dos inscritos apagados!');
      App.closeModal();
      DB._data=null;
      await DB.refresh();
      App.render();
    }catch(e){console.error('_confirmResetInscritos error:',e);toast('Erro ao apagar dados: '+e.message)}
  },

  // ========== REPORTS ==========
  reports(){
    const db=DB.load();const insc=db.inscricoes;const cfg=db.configuracoes;const div=document.createElement('div');
    const total=insc.length;const conf=insc.filter(i=>i.estado===ESTADOS.CONFIRMADA).length;const ag=insc.filter(i=>i.estado===ESTADOS.AGUARDA).length;const rej=insc.filter(i=>i.estado===ESTADOS.REJEITADA).length;
    const receita=insc.filter(i=>i.estado===ESTADOS.CONFIRMADA).reduce((s,i)=>s+paidAmount(i),0);

    // Vendas últimos 6 meses
    const months=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const now=new Date();
    const meses=[];const receitaNova=[];const receitaRenov=[];const matriculasNova=[];const matriculasRenov=[];
    for(let i=5;i>=0;i--){
      const d=new Date(now.getFullYear(),now.getMonth()-i,1);
      const label=months[d.getMonth()]+' '+d.getFullYear();
      meses.push(label);
      const noMes=insc.filter(ins=>{const dt=new Date(ins.data_inscricao);return dt.getMonth()===d.getMonth()&&dt.getFullYear()===d.getFullYear()});
      const novas=noMes.filter(ins=>ins.tipo_inscricao!=='renovacao');
      const renov=noMes.filter(ins=>ins.tipo_inscricao==='renovacao');
      const cfg=db.configuracoes;
      receitaNova.push(novas.filter(ins=>ins.estado===ESTADOS.CONFIRMADA).reduce((s,ins)=>s+paidAmount(ins),0));
      receitaRenov.push(renov.filter(ins=>ins.estado===ESTADOS.CONFIRMADA).reduce((s,ins)=>s+paidAmount(ins),0));
      matriculasNova.push(novas.length);
      matriculasRenov.push(renov.length);
    }
    const totalNovas=matriculasNova.reduce((a,b)=>a+b,0);
    const totalRenov=matriculasRenov.reduce((a,b)=>a+b,0);
    const receitaTotalMes=receitaNova.map((v,i)=>v+receitaRenov[i]);
    const mediaMes=receitaTotalMes.length>0?Math.round(receitaTotalMes.reduce((a,b)=>a+b,0)/receitaTotalMes.length):0;

    div.innerHTML=`<div class="card welcome"><div><h2>Relatório de Vendas</h2><p class="muted">Receita mensal comparando novas matrÃ­culas e renovações nos últimos 6 meses.</p></div><div style="display:flex;gap:10px"><button class="btn btn-outline" onclick="Modules.exportCSV()">Exportar CSV</button></div></div>`;

    // 4 pills vendas
    const pills=document.createElement('div');pills.className='pills stagger';
    pills.innerHTML=`
      <div class="pill-card p-green"><span class="ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></span><div><em>Receita Total (6m)</em><strong>Kz ${receita.toLocaleString('pt-BR')}</strong></div></div>
      <div class="pill-card p-blue"><span class="ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></span><div><em>Novas MatrÃ­culas</em><strong>${totalNovas} <small>inscritos</small></strong></div></div>
      <div class="pill-card p-pink"><span class="ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></span><div><em>Renovações</em><strong>${totalRenov} <small>renovados</small></strong></div></div>
      <div class="pill-card p-orange"><span class="ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg></span><div><em>Média Mensal</em><strong>Kz ${mediaMes.toLocaleString('pt-BR')}</strong></div></div>`;
    div.appendChild(pills);

    // Row A: Gráfico de barras receita + doughnut novas vs renovações
    const rowA=document.createElement('div');rowA.className='row row-2';
    rowA.innerHTML=`
      <div class="card"><h3>Receita Mensal â€” Novas MatrÃ­culas vs Renovações</h3><p class="muted">Ãšltimos 6 meses.</p><div class="chart-box"><canvas id="chVendasBar"></canvas></div></div>
      <div class="card"><h3>Distribuição de Vendas</h3><p class="muted">Proporção novas matrÃ­culas vs renovações.</p><div class="rings"><div class="ring"><div class="ring-wrap"><canvas id="ringVendas"></canvas><span class="ring-c">${total}</span></div><div><b>Total Inscrições</b><span>${total}</span></div></div></div><div class="pair" style="margin-top:20px"><div style="text-align:center"><p class="muted">Novas MatrÃ­culas</p><b style="font-size:1.5rem;color:#22a34c">${totalNovas}</b></div><div style="text-align:center"><p class="muted">Renovações</p><b style="font-size:1.5rem;color:#ec407a">${totalRenov}</b></div></div></div>`;
    div.appendChild(rowA);

    // Row B: Tabela mensal + métricas
    const rowB=document.createElement('div');rowB.className='row row-2';
    let tabelaH='<table><thead><tr><th>MÃŠS</th><th>NOVAS</th><th>RENOVAÃ‡Ã•ES</th><th>RECEITA NOVAS</th><th>RECEITA RENOVAÃ‡Ã•ES</th><th>TOTAL</th></tr></thead><tbody>';
    meses.forEach((m,i)=>{
      const totalMes=receitaNova[i]+receitaRenov[i];
      tabelaH+=`<tr><td><b>${m}</b></td><td>${matriculasNova[i]}</td><td>${matriculasRenov[i]}</td><td>Kz ${receitaNova[i].toLocaleString('pt-BR')}</td><td>Kz ${receitaRenov[i].toLocaleString('pt-BR')}</td><td><b>Kz ${totalMes.toLocaleString('pt-BR')}</b></td></tr>`;
    });
    tabelaH+=`<tr style="background:#f7fbf8;font-weight:800"><td>TOTAL</td><td>${totalNovas}</td><td>${totalRenov}</td><td>Kz ${receitaNova.reduce((a,b)=>a+b,0).toLocaleString('pt-BR')}</td><td>Kz ${receitaRenov.reduce((a,b)=>a+b,0).toLocaleString('pt-BR')}</td><td style="color:#22a34c">Kz ${receita.toLocaleString('pt-BR')}</td></tr>`;
    tabelaH+='</tbody></table>';
    rowB.innerHTML=`
      <div class="card"><h3>Visão Geral de Vendas</h3><p class="muted" style="margin-bottom:10px">Detalhe mês a mês.</p>${tabelaH}</div>
      <div class="card"><h3>Métricas de Vendas</h3>
        <div class="settings-section"><h3>Resumo</h3>
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eef1f5"><span>Receita Confirmada</span><b style="color:#22a34c">Kz ${receita.toLocaleString('pt-BR')}</b></div>
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eef1f5"><span>Receita Pendente</span><b style="color:#fb8c00">Kz ${insc.filter(i=>i.estado!==ESTADOS.REJEITADA).reduce((s,i)=>s+pendingAmount(i),0).toLocaleString('pt-BR')}</b></div>
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eef1f5"><span>Média por Inscrição</span><b>Kz ${conf>0?Math.round(receita/conf).toLocaleString('pt-BR'):'0'}</b></div>
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eef1f5"><span>Taxa de Conversão</span><b style="color:#22a34c">${total>0?Math.round(conf/total*100):0}%</b></div>
          <div style="display:flex;justify-content:space-between;padding:8px 0"><span>Valor Total Curso</span><b>Kz ${cfg.valor_total.toLocaleString('pt-BR')}</b></div>
        </div>
        <div class="settings-section"><h3>Por Perfil</h3>${PERFIS.map(p=>{const count=insc.filter(i=>i.perfil===p).length;const rec=insc.filter(i=>i.perfil===p&&i.estado===ESTADOS.CONFIRMADA).reduce((s,i)=>s+paidAmount(i),0);return`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eef1f5"><span>${PERFIL_LABELS[p]} (${count})</span><b>Kz ${rec.toLocaleString('pt-BR')}</b></div>`}).join('')}</div>
        <div class="settings-section"><h3>Por Pagamento</h3>
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eef1f5"><span>Integral (${insc.filter(i=>i.modalidade_pagamento==='integral').length})</span><b>Kz ${insc.filter(i=>i.modalidade_pagamento==='integral'&&i.estado===ESTADOS.CONFIRMADA).reduce((s,i)=>s+cfg.valor_total,0).toLocaleString('pt-BR')}</b></div>
          <div style="display:flex;justify-content:space-between;padding:6px 0"><span>Parcelado (${insc.filter(i=>i.modalidade_pagamento==='parcelado').length})</span><b>Kz ${insc.filter(i=>i.modalidade_pagamento==='parcelado'&&i.estado===ESTADOS.CONFIRMADA).reduce((s,i)=>s+i.parcelas.filter(pp=>pp.estado==='confirmada').length*cfg.valor_parcela,0).toLocaleString('pt-BR')}</b></div>
        </div>
      </div>`;
    div.appendChild(rowB);

    // Row C: Vagas por Pacote
    const rowC=document.createElement('div');rowC.className='row row-1';
    (async()=>{
      const{data:pacotes}=await supabase.from('pacotes').select('*').order('ordem',{ascending:true}).order('valor',{ascending:true});
      const{data:inscPacotes}=await supabase.from('inscricoes').select('pacote_id,estado,modalidade_pagamento,parcelas').in('estado',['confirmada','aguarda_confirmacao']);
      const pacoteStats=(pacotes||[]).map(p=>{
        const inscP=(inscPacotes||[]).filter(i=>i.pacote_id===p.id);
        const inscritos=inscP.length;
        const vagas=p.vagas||0;
        const ocupacao=vagas>0?Math.round(inscritos/vagas*100):(inscritos>0?100:0);
        const receitaConfirmada=inscP.filter(i=>i.estado==='confirmada').reduce((s,i)=>{
          if(i.modalidade_pagamento==='integral')return s+Number(p.valor);
          return s+(i.parcelas||[]).filter(pp=>pp.estado==='confirmada').reduce((ss,pp)=>ss+Number(pp.valor||0),0);
        },0);
        const receitaPotencial=vagas>0?vagas*Number(p.valor):0;
        return{...p,inscritos,ocupacao,receitaConfirmada,receitaPotencial};
      });
      const totalVagas=pacoteStats.reduce((s,p)=>s+(p.vagas||0),0);
      const totalInscPacotes=pacoteStats.reduce((s,p)=>s+p.inscritos,0);
      const totalReceitaPacotes=pacoteStats.reduce((s,p)=>s+p.receitaConfirmada,0);
      const totalPotencial=pacoteStats.reduce((s,p)=>s+p.receitaPotencial,0);
      rowC.innerHTML=`
        <div class="card">
          <h3>Vagas e Receita por Turma</h3>
          <p class="muted" style="margin-bottom:14px">Capacidade, ocupação e receita por pacote.</p>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px">
            <div style="background:linear-gradient(135deg,rgba(34,197,94,.08),rgba(34,197,94,.02));border:1px solid rgba(34,197,94,.15);border-radius:10px;padding:12px;text-align:center">
              <span style="display:block;font-size:.65rem;font-weight:700;text-transform:uppercase;color:var(--green-600);margin-bottom:2px">Vagas Totais</span>
              <span style="display:block;font-size:1.5rem;font-weight:900;color:var(--green-700)">${totalVagas||'∞'}</span>
              <span style="font-size:.7rem;color:var(--muted)">${totalInscPacotes} preenchidas</span>
            </div>
            <div style="background:linear-gradient(135deg,rgba(59,130,246,.08),rgba(59,130,246,.02));border:1px solid rgba(59,130,246,.15);border-radius:10px;padding:12px;text-align:center">
              <span style="display:block;font-size:.65rem;font-weight:700;text-transform:uppercase;color:var(--blue-600);margin-bottom:2px">Receita Confirmada</span>
              <span style="display:block;font-size:1.5rem;font-weight:900;color:var(--blue-700)">Kz ${totalReceitaPacotes.toLocaleString('pt-BR')}</span>
              <span style="font-size:.7rem;color:var(--muted)">${totalVagas>0?Math.round(totalInscPacotes/totalVagas*100):0}% ocupação</span>
            </div>
            <div style="background:linear-gradient(135deg,rgba(249,115,22,.08),rgba(249,115,22,.02));border:1px solid rgba(249,115,22,.15);border-radius:10px;padding:12px;text-align:center">
              <span style="display:block;font-size:.65rem;font-weight:700;text-transform:uppercase;color:var(--orange-600);margin-bottom:2px">Potencial Máximo</span>
              <span style="display:block;font-size:1.5rem;font-weight:900;color:var(--orange-700)">Kz ${totalPotencial.toLocaleString('pt-BR')}</span>
              <span style="font-size:.7rem;color:var(--muted)">se todas as vagas forem preenchidas</span>
            </div>
          </div>
          <table style="width:100%">
            <thead><tr><th>TURMA</th><th>VAGAS</th><th>INSCRITOS</th><th>OCUPAÇÃO</th><th>PREÇO</th><th>RECEITA</th><th>POTENCIAL</th></tr></thead>
            <tbody>
              ${pacoteStats.map(p=>{
                const vagasColor=p.vagas>0?(p.ocupacao>=100?'#ef4444':p.ocupacao>=70?'#f59e0b':'#22c55e'):'var(--muted)';
                return`<tr>
                  <td><b>${p.nome}</b><br><span style="font-size:.7rem;color:var(--muted)">${p.slug}</span></td>
                  <td>${p.vagas||'∞'}</td>
                  <td><b>${p.inscritos}</b></td>
                  <td><div style="display:flex;align-items:center;gap:6px"><div style="width:50px;height:6px;background:#e5e7eb;border-radius:3px;overflow:hidden"><div style="width:${Math.min(p.ocupacao,100)}%;height:100%;background:${vagasColor};border-radius:3px"></div></div><span style="font-weight:700;font-size:.75rem;color:${vagasColor}">${p.ocupacao}%</span></div></td>
                  <td>Kz ${Number(p.valor).toLocaleString('pt-BR')}</td>
                  <td style="color:#22a34c;font-weight:700">Kz ${p.receitaConfirmada.toLocaleString('pt-BR')}</td>
                  <td style="color:#f97316;font-weight:700">Kz ${p.receitaPotencial.toLocaleString('pt-BR')}</td>
                </tr>`}).join('')}
            </tbody>
          </table>
        </div>`;
      div.appendChild(rowC);
    })();

    setTimeout(()=>this._initReportsCharts(receitaNova,receitaRenov,meses,totalNovas,totalRenov),100);
    return div;
  },

  _initReportsCharts(receitaNova,receitaRenov,meses,totalNovas,totalRenov){
    Chart.defaults.font.family="'Inter',sans-serif";Chart.defaults.color='#94a3b8';
    // Bar chart
    const ctx=document.getElementById('chVendasBar');
    if(ctx){
      new Chart(ctx,{type:'bar',data:{labels:meses,datasets:[{label:'Novas MatrÃ­culas',data:receitaNova,backgroundColor:'#22a34c',borderRadius:4,barPercentage:.7},{label:'Renovações',data:receitaRenov,backgroundColor:'#ec407a',borderRadius:4,barPercentage:.7}]},options:{maintainAspectRatio:false,plugins:{legend:{display:true,position:'top',labels:{usePointStyle:true,pointStyle:'circle',padding:16,font:{size:11,weight:'700'}}},tooltip:{callbacks:{label:c=>c.dataset.label+': Kz '+c.parsed.y.toLocaleString('pt-BR')}}},scales:{y:{stacked:false,ticks:{callback:v=>'Kz'+(v/1000)+'k'},grid:{color:'#f0f3f6'}},x:{grid:{display:false}}}}});
    }
    // Doughnut
    const ring=document.getElementById('ringVendas');
    if(ring){
      new Chart(ring,{type:'doughnut',data:{datasets:[{data:[totalNovas,totalRenov||1],backgroundColor:['#22a34c','#ec407a'],borderWidth:0}]},options:{cutout:'72%',maintainAspectRatio:false,plugins:{tooltip:{enabled:false}}}});
    }
  },

  // ========== PACOTES ==========
  pacotes(){
    const div=document.createElement('div');

    // Page header
    const hdr=document.createElement('div');hdr.className='card welcome';
    hdr.innerHTML=`<div><h2>Pacotes do Curso</h2><p class="muted">Crie e gere os pacotes de inscrição com preços, parcelas e benefícios.</p></div>
      <button class="btn btn-primary" onclick="Modules._openCreatePacoteModal()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Criar Pacote
      </button>`;
    div.appendChild(hdr);

    // Packages list
    const listCard=document.createElement('div');listCard.className='card pacotes-list-card';
    listCard.id='pacotesList';
    listCard.innerHTML=`<div class="pacotes-list-header"><h3>Pacotes</h3></div><div class="pacotes-loading"><div class="pacotes-skeleton"></div><div class="pacotes-skeleton"></div></div>`;
    div.appendChild(listCard);

    setTimeout(()=>Modules.loadPacotes(),100);
    return div;
  },

  _openCreatePacoteModal(){
    const body=`
      <div class="pacotes-form-grid">
        <div class="form-group"><label>Slug (ID único)</label><input id="pacSlug" placeholder="Ex: vip"></div>
        <div class="form-group"><label>Nome do Pacote</label><input id="pacNome" placeholder="Ex: VIP"></div>
        <div class="form-group"><label>Valor (Kz)</label><input type="number" id="pacValor" min="0" placeholder="45000"></div>
        <div class="form-group"><label>Nº de Parcelas</label><input type="number" id="pacParcelas" value="3" min="1"></div>
        <div class="form-group"><label>Vagas (0 = ilimitado)</label><input type="number" id="pacVagas" value="0" min="0" placeholder="0"></div>
        <div class="form-group pacotes-form-full"><label>Descrição (uma linha por item)</label><textarea id="pacDesc" rows="3" placeholder="Benefício 1&#10;Benefício 2&#10;Benefício 3"></textarea></div>
        <div class="form-group pacotes-form-full"><label>Link do Grupo (WhatsApp/Telegram)</label><input id="pacLinkGrupo" placeholder="https://chat.whatsapp.com/..."></div>
        <div class="form-group pacotes-form-check">
          <label class="pacotes-checkbox-label"><input type="checkbox" id="pacMentoria"> <span class="pacotes-checkbox-text">Inclui mentoria</span></label>
        </div>
      </div>`;
    const footer=`
      <button class="btn btn-outline" onclick="App.closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="Modules.criarPacote()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Criar Pacote
      </button>`;
    App.openModal('Novo Pacote',body,footer);
    setTimeout(()=>document.getElementById('pacSlug')?.focus(),150);
  },

  async loadPacotes(){
    const el=document.getElementById('pacotesList');
    if(!el)return;
    let{data,error}=await supabase.from('pacotes').select('*').order('ordem',{ascending:true}).order('valor',{ascending:true});

    // Fallback if ordem column doesn't exist
    if(error&&error.message?.includes('ordem')){
      const fallback=await supabase.from('pacotes').select('*').order('valor');
      data=fallback.data;error=fallback.error;
    }

    if(error){
      el.innerHTML=`<div class="pacotes-list-header"><h3>Pacotes</h3></div>
        <div class="pacotes-empty">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--error)" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          <p>Erro ao carregar: ${error.message}</p>
        </div>`;
      return;
    }

    if(!data||data.length===0){
      el.innerHTML=`<div class="pacotes-list-header"><h3>Pacotes</h3></div>
        <div class="pacotes-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--gray-300)" stroke-width="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
          <h4>Nenhum pacote criado</h4>
          <p>Crie o primeiro pacote usando o formulário acima.</p>
        </div>`;
      return;
    }

    // Ensure ordem field exists on all packages
    let hasOrdem=true;
    try{
      const needsUpdate=data.filter((p,i)=>p.ordem===null||p.ordem===undefined||p.ordem!==i);
      if(needsUpdate.length>0){
        await Promise.all(data.map((p,i)=>supabase.from('pacotes').update({ordem:i}).eq('id',p.id)));
        data.forEach((p,i)=>p.ordem=i);
      }
    }catch(e){hasOrdem=false}

    const activeCount=data.filter(p=>p.ativo).length;

    // Count inscriptions per pacote
    const vagasMap={};
    try{
      const{data:inscCounts}=await supabase.from('inscricoes').select('pacote_id').in('estado',['confirmada','aguarda_confirmacao']);
      if(inscCounts){inscCounts.forEach(i=>{if(i.pacote_id){vagasMap[i.pacote_id]=(vagasMap[i.pacote_id]||0)+1}})}
    }catch(e){}

    el.innerHTML=`<div class="pacotes-list-header">
        <h3>Pacotes <span class="pacotes-count">${data.length}</span></h3>
        <span class="muted">${activeCount} ativo${activeCount!==1?'s':''}</span>
      </div>
      <div class="pacotes-grid">
        ${data.map((p,idx)=>{
          const valorKz=Number(p.valor).toLocaleString('pt-BR');
          const parcelaKz=Number(p.valor_parcela).toLocaleString('pt-BR');
          const accentColor=p.ativo?'var(--primary-500)':'var(--gray-400)';
          const isFirst=idx===0;
          const isLast=idx===data.length-1;
          const inscritos=vagasMap[p.id]||0;
          const vagas=p.vagas||0;
          return`<div class="pacote-card ${p.ativo?'':'pacote-card-inactive'}" style="--accent:${accentColor}">
            <div class="pacote-card-header">
              ${hasOrdem?`<div class="pacote-card-order">
                <button class="pacote-order-btn" onclick="Modules._movePacote('${p.id}',-1)" ${isFirst?'disabled':''} title="Mover para cima">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>
                </button>
                <span class="pacote-order-num">${idx+1}</span>
                <button class="pacote-order-btn" onclick="Modules._movePacote('${p.id}',1)" ${isLast?'disabled':''} title="Mover para baixo">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
              </div>`:''}
              <div class="pacote-card-badge ${p.ativo?'badge-active':'badge-inactive'}">${p.ativo?'Ativo':'Inativo'}</div>
              ${p.inclui_mentoria?'<div class="pacote-card-mentoria"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> Mentoria</div>':''}
            </div>
            <div class="pacote-card-body">
              <h4 class="pacote-card-name">${p.nome}</h4>
              <p class="pacote-card-slug">${p.slug}</p>
              ${p.descricao?`<ul class="pacote-card-desc">${p.descricao.split('\n').filter(l=>l.trim()).map(l=>`<li><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--primary-500)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> ${l.trim()}</li>`).join('')}</ul>`:''}
              <div class="pacote-card-price">
                <span class="pacote-card-amount">Kz ${valorKz}</span>
                <span class="pacote-card-installments">${p.parcelas}x de Kz ${parcelaKz}</span>
              </div>
              ${vagas>0?`<div class="pacote-card-vagas ${inscritos>=vagas?'vagas-full':''}">
                <span class="vagas-count">${inscritos}</span><span class="vagas-sep">/</span><span class="vagas-total">${vagas}</span> vagas
                ${inscritos>=vagas?'<span class="vagas-badge-full">Esgotado</span>':''}
              </div>`:''}
            </div>
            <div class="pacote-card-footer">
              <button class="btn btn-outline btn-sm" onclick="Modules.editarPacote('${p.id}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Editar
              </button>
              <button class="btn btn-sm ${p.ativo?'btn-outline btn-toggle-off':'btn-primary btn-toggle-on'}" onclick="Modules.togglePacote('${p.id}',${!p.ativo})">
                ${p.ativo?'Desativar':'Ativar'}
              </button>
            </div>
          </div>`}).join('')}
      </div>`;
  },

  async criarPacote(){
    const slug=document.getElementById('pacSlug').value.trim().toLowerCase();
    const nome=document.getElementById('pacNome').value.trim();
    const valor=Number(document.getElementById('pacValor').value);
    const parcelas=Number(document.getElementById('pacParcelas').value)||3;
    const vagas=Number(document.getElementById('pacVagas').value)||0;
    const desc=document.getElementById('pacDesc').value.trim();
    const linkGrupo=document.getElementById('pacLinkGrupo').value.trim();
    const mentoria=document.getElementById('pacMentoria').checked;
    if(!slug||!nome||!valor){toast('Preencha slug, nome e valor.');return}
    const valorParcela=Math.round(valor/parcelas*100)/100;
    const{error}=await supabase.from('pacotes').insert({slug,nome,valor,parcelas,valor_parcela:valorParcela,vagas,inclui_mentoria:mentoria,descricao:desc,link_grupo:linkGrupo||null,ativo:true});
    if(error){toast('Erro: '+error.message);return}
    toast('Pacote criado!');
    App.closeModal();
    Modules.loadPacotes();
  },

  async togglePacote(id,ativo){
    const{error}=await supabase.from('pacotes').update({ativo}).eq('id',id);
    if(error){toast('Erro: '+error.message);return}
    toast(ativo?'Pacote ativado!':'Pacote desativado!');
    Modules.loadPacotes();
  },

  async _movePacote(id,direction){
    let{data}=await supabase.from('pacotes').select('*').order('ordem',{ascending:true}).order('valor',{ascending:true});
    // Fallback if ordem column doesn't exist
    if(!data){const fb=await supabase.from('pacotes').select('*').order('valor');data=fb.data}
    if(!data||data.length<2)return;
    const idx=data.findIndex(p=>p.id===id);
    if(idx===-1)return;
    const newIdx=idx+direction;
    if(newIdx<0||newIdx>=data.length)return;
    // Swap ordem values
    const currentOrdem=data[idx].ordem??idx;
    const targetOrdem=data[newIdx].ordem??newIdx;
    const{error}=await Promise.all([
      supabase.from('pacotes').update({ordem:targetOrdem}).eq('id',data[idx].id),
      supabase.from('pacotes').update({ordem:currentOrdem}).eq('id',data[newIdx].id)
    ]);
    if(error){toast('Adicione a coluna "ordem" (int4) na tabela pacotes no Supabase para ordenar.');return}
    this.loadPacotes();
  },

  async editarPacote(id){
    const{data}=await supabase.from('pacotes').select('*').eq('id',id).single();
    if(!data)return;
    const body=`
      <div class="pacotes-edit-form">
        <div class="form-row">
          <div class="form-group"><label>Nome</label><input id="editPacNome" value="${data.nome}"></div>
          <div class="form-group"><label>Slug</label><input id="editPacSlug" value="${data.slug}"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Valor (Kz)</label><input type="number" id="editPacValor" value="${data.valor}"></div>
          <div class="form-group"><label>Parcelas</label><input type="number" id="editPacParcelas" value="${data.parcelas}" min="1"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Vagas (0 = ilimitado)</label><input type="number" id="editPacVagas" value="${data.vagas||0}" min="0"></div>
          <div class="form-group"></div>
        </div>
        <div class="form-group"><label>Descrição (uma linha por item)</label><textarea id="editPacDesc" rows="3" placeholder="Benefício 1&#10;Benefício 2&#10;Benefício 3">${data.descricao||''}</textarea></div>
        <div class="form-group"><label>Link do Grupo (WhatsApp/Telegram)</label><input id="editPacLinkGrupo" value="${data.link_grupo||''}" placeholder="https://chat.whatsapp.com/..."></div>
        <div class="form-group">
          <label class="pacotes-checkbox-label"><input type="checkbox" id="editPacMentoria" ${data.inclui_mentoria?'checked':''}> <span class="pacotes-checkbox-text">Inclui mentoria</span></label>
        </div>
      </div>`;
    const footer=`
      <button class="btn btn-outline" onclick="App.closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="Modules._saveEditPacote('${data.id}')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
        Guardar
      </button>`;
    App.openModal('Editar Pacote — '+data.nome,body,footer);
  },

  async _saveEditPacote(id){
    const nome=document.getElementById('editPacNome')?.value?.trim();
    const slug=document.getElementById('editPacSlug')?.value?.trim().toLowerCase();
    const valor=Number(document.getElementById('editPacValor')?.value);
    const parcelas=Number(document.getElementById('editPacParcelas')?.value)||3;
    const vagas=Number(document.getElementById('editPacVagas')?.value)||0;
    const desc=document.getElementById('editPacDesc')?.value?.trim()||'';
    const linkGrupo=document.getElementById('editPacLinkGrupo')?.value?.trim()||'';
    const mentoria=document.getElementById('editPacMentoria')?.checked||false;
    if(!nome||!slug||!valor){toast('Preencha nome, slug e valor.');return}
    const valorParcela=Math.round(valor/parcelas*100)/100;
    const{error}=await supabase.from('pacotes').update({nome,slug,valor:Number(valor),parcelas:Number(parcelas),valor_parcela:valorParcela,vagas,descricao:desc,link_grupo:linkGrupo||null,inclui_mentoria:mentoria}).eq('id',id);
    if(error){toast('Erro: '+error.message);return}
    toast('Pacote atualizado!');
    App.closeModal();
    Modules.loadPacotes();
  },

  // ========== PARCERIAS ==========
  parcerias(){
    const div=document.createElement('div');

    const hdr=document.createElement('div');hdr.className='card welcome';
    hdr.innerHTML=`<div><h2>Parcerias</h2><p class="muted">Crie e gere códigos de desconto para parceiros.</p></div>
      <button class="btn btn-primary" onclick="Modules._openCreateParceriaModal()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Novo Código
      </button>`;
    div.appendChild(hdr);

    const listCard=document.createElement('div');listCard.className='card parcerias-list-card';
    listCard.id='parceriasList';
    listCard.innerHTML=`<div class="parcerias-list-header"><h3>Códigos</h3></div><div class="pacotes-loading"><div class="pacotes-skeleton"></div><div class="pacotes-skeleton"></div></div>`;
    div.appendChild(listCard);

    setTimeout(()=>Modules.loadParcerias(),100);
    return div;
  },

  _openCreateParceriaModal(){
    const body=`
      <div class="pacotes-form-grid">
        <div class="form-group"><label>Código</label><input id="parcCodigo" placeholder="Ex: IGREJA-BAIRRO" style="text-transform:uppercase"></div>
        <div class="form-group"><label>Nome do Parceiro</label><input id="parcNome" placeholder="Ex: Igreja Batista"></div>
        <div class="form-group"><label>Desconto (%)</label><input type="number" id="parcPercentual" value="10" min="1" max="100"></div>
        <div class="form-group"><label>Limite de usos</label><input type="number" id="parcLimite" placeholder="Ilimitado"></div>
      </div>`;
    const footer=`
      <button class="btn btn-outline" onclick="App.closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="Modules.criarParceria()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Criar Código
      </button>`;
    App.openModal('Novo Código de Parceria',body,footer);
    setTimeout(()=>document.getElementById('parcCodigo')?.focus(),150);
  },

  async loadParcerias(){
    const{data,error}=await supabase.from('codigos_parceria').select('*').order('criado_em',{ascending:false});
    const el=document.getElementById('parceriasList');
    if(!el)return;

    if(error){
      el.innerHTML=`<div class="parcerias-list-header"><h3>Códigos</h3></div>
        <div class="pacotes-empty"><p>Erro ao carregar: ${error.message}</p></div>`;
      return;
    }

    if(!data||data.length===0){
      el.innerHTML=`<div class="parcerias-list-header"><h3>Códigos</h3></div>
        <div class="pacotes-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--gray-300)" stroke-width="1.5"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
          <h4>Nenhum código criado</h4>
          <p>Crie o primeiro código de parceria usando o botão acima.</p>
        </div>`;
      return;
    }

    const activeCount=data.filter(p=>p.ativo).length;
    el.innerHTML=`<div class="parcerias-list-header">
        <h3>Códigos <span class="pacotes-count">${data.length}</span></h3>
        <span class="muted">${activeCount} ativo${activeCount!==1?'s':''}</span>
      </div>
      <div class="parcerias-grid">
        ${data.map(p=>{
          const usos=p.usos_atuais||0;
          const limite=p.limite_usos||null;
          const usoPercent=limite?Math.round(usos/limite*100):null;
          return`<div class="parceria-card ${p.ativo?'':'parceria-card-inactive'}">
            <div class="parceria-card-header">
              <div class="parceria-card-code">${p.codigo}</div>
              <div class="parceria-card-badge ${p.ativo?'badge-active':'badge-inactive'}">${p.ativo?'Ativo':'Inativo'}</div>
            </div>
            <div class="parceria-card-body">
              <h4 class="parceria-card-partner">${p.nome_parceiro||'Sem nome'}</h4>
              <div class="parceria-card-discount">
                <span class="parceria-card-percent">-${p.percentual_desconto}%</span>
                <span class="parceria-card-discount-label">desconto</span>
              </div>
              <div class="parceria-card-usage">
                <div class="parceria-card-usage-text">
                  <span>Usos</span>
                  <span>${limite?`${usos} / ${limite}`:`${usos} · Sem limite`}</span>
                </div>
                ${limite?`<div class="prog" style="width:100%"><i style="width:${Math.min(usoPercent,100)}%;background:${usoPercent>=90?'var(--error)':usoPercent>=60?'var(--warning)':'var(--primary-500)'}"></i></div>`:''}
              </div>
            </div>
            <div class="parceria-card-footer">
              <button class="btn btn-sm ${p.ativo?'btn-outline btn-toggle-off':'btn-primary btn-toggle-on'}" onclick="Modules.toggleParceria('${p.id}',${!p.ativo})">
                ${p.ativo?'Desativar':'Ativar'}
              </button>
            </div>
          </div>`;
        }).join('')}
      </div>`;
  },

  async criarParceria(){
    const codigo=document.getElementById('parcCodigo').value.trim().toUpperCase();
    const nome=document.getElementById('parcNome').value.trim();
    const percentual=Number(document.getElementById('parcPercentual').value);
    const limite=document.getElementById('parcLimite').value?Number(document.getElementById('parcLimite').value):null;
    if(!codigo||!nome||!percentual){toast('Preencha código, nome e percentual.');return}
    const{error}=await supabase.from('codigos_parceria').insert({codigo,nome_parceiro:nome,percentual_desconto:percentual,limite_usos:limite,criado_por:Auth.currentUser?.id});
    if(error){toast('Erro: '+error.message);return}
    toast('Código criado!');
    App.closeModal();
    Modules.loadParcerias();
  },

  async toggleParceria(id,ativo){
    const{error}=await supabase.from('codigos_parceria').update({ativo}).eq('id',id);
    if(error){toast('Erro: '+error.message);return}
    toast(ativo?'Código ativado!':'Código desativado!');
    Modules.loadParcerias();
  },

  // ========== CURSO ==========
  curso(){
    const db=DB.load();const cfg=db.configuracoes;const div=document.createElement('div');

    const hdr=document.createElement('div');hdr.className='card welcome';
    hdr.innerHTML=`<div><h2>Gerir Curso</h2><p class="muted">Módulos, estrutura e dados gerais do curso.</p></div>`;
    div.appendChild(hdr);

    // Dados Gerais
    const dadosCard=document.createElement('div');dadosCard.className='card';
    dadosCard.innerHTML=`
      <div class="curso-section-header">
        <h3>Dados Gerais do Curso</h3>
      </div>
      <div class="curso-dados-grid">
        <div class="form-group"><label>Descrição do Curso</label><textarea id="cfgDescCurso" rows="3">${cfg.descricao_curso||''}</textarea></div>
        <div class="form-group"><label>Público-Alvo</label><textarea id="cfgPublicoAlvo" rows="3">${cfg.publico_alvo||''}</textarea></div>
        <div class="form-group"><label>Ferramentas</label><input id="cfgFerramentas" value="${cfg.ferramentas||''}"></div>
        <div class="form-group"><label>Carga Horária</label><input id="cfgCargaHoraria" value="${cfg.carga_horaria||''}"></div>
        <div class="form-group"><label>Certificado</label><input id="cfgCertificado" value="${cfg.certificado||''}"></div>
        <div class="form-group"><label>Localização</label><input id="cfgLocalizacao" value="${cfg.localizacao||''}"></div>
        <div class="form-group"><label>Link da Localização</label><input id="cfgLocalizacaoLink" value="${cfg.localizacao_link||''}" placeholder="https://maps..."></div>
        <div class="form-group"><label>Horário</label><input id="cfgHorario" value="${cfg.horario||''}"></div>
      </div>
      <div class="curso-section-footer">
        <button class="btn btn-primary" onclick="Modules.saveCursoSettings()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          Guardar Dados
        </button>
      </div>`;
    div.appendChild(dadosCard);

    // Módulos
    const modCard=document.createElement('div');modCard.className='card curso-modulos-card';modCard.id='modulosList';
    modCard.innerHTML=`<div class="curso-modulos-loading"><div class="pacotes-skeleton"></div></div>`;
    div.appendChild(modCard);

    setTimeout(()=>Modules.loadModulos(),100);
    return div;
  },

  _selectedMods: new Set(),

  _openBulkModal(){
    const db=DB.load();
    const fases=db.configuracoes?.fases_curso||[{n:1,nome:'Fundamentos e Criação'},{n:2,nome:'Comunicação e Identidade'},{n:3,nome:'Mercado e Projeto Final'}];
    const faseOpts=fases.map(f=>`<option value="${f.n}">Fase ${f.n} — ${f.nome}</option>`).join('');
    const body=`
      <div class="curso-bulk-form">
        <p class="muted" style="margin-bottom:12px">Cole vários módulos de uma vez. Formato: <code style="background:var(--gray-100);padding:2px 6px;border-radius:4px;font-family:var(--font-mono);font-size:.8rem">nº | nome | descrição</code> (um por linha)</p>
        <div class="form-group"><textarea id="modBulk" rows="10" placeholder="1 | Introdução ao Design | O que é design gráfico&#10;2 | Fundamentos | Linha, forma, cor, tipografia&#10;3 | Cor | Teoria da cor e paletas" style="width:100%;padding:12px;border:1.5px solid var(--gray-200);border-radius:var(--radius-lg);font-family:var(--font-mono);font-size:.85rem;resize:vertical;background:var(--gray-50)"></textarea></div>
        <div class="form-row">
          <div class="form-group"><label>Fase</label><select id="modFaseBulk">${faseOpts}</select></div>
        </div>
      </div>`;
    const footer=`
      <button class="btn btn-outline" onclick="App.closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="Modules.addModulosBulk()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Adicionar Todos
      </button>`;
    App.openModal('Adicionar Módulos em Lote',body,footer);
    setTimeout(()=>document.getElementById('modBulk')?.focus(),150);
  },

  async loadModulos(){
    const el=document.getElementById('modulosList');
    if(!el)return;
    const{data,error}=await supabase.from('modulos_curso').select('*').order('fase').order('ordem');

    if(error){
      el.innerHTML=`<div class="curso-modulos-header"><h3>Módulos</h3></div><div class="pacotes-empty"><p>Erro: ${error.message}</p></div>`;
      return;
    }

    if(!data||data.length===0){
      el.innerHTML=`<div class="curso-modulos-header">
          <div class="curso-modulos-title"><h3>Módulos</h3></div>
          <div class="curso-modulos-actions">
            <button class="btn btn-outline btn-sm" onclick="Modules._openBulkModal()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Adicionar em Lote
            </button>
          </div>
        </div>
        <div class="pacotes-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--gray-300)" stroke-width="1.5"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
          <h4>Nenhum módulo encontrado</h4>
          <p>Clica em "Adicionar em Lote" para começar.</p>
        </div>`;
      return;
    }

    this._selectedMods=new Set();
    const defaultFases=[{n:1,nome:'Fundamentos e Criação',color:'#22c55e'},{n:2,nome:'Comunicação e Identidade',color:'#3b82f6'},{n:3,nome:'Mercado e Projeto Final',color:'#f97316'}];
    const db=DB.load();
    const savedFases=db.configuracoes?.fases_curso||null;
    const fases=savedFases&&savedFases.length?savedFases:defaultFases;
    const faseNames={};
    fases.forEach(f=>{
      const firstMod=data.find(m=>m.fase===f.n);
      faseNames[f.n]=firstMod?.fase_nome||f.nome;
    });
    const activeCount=data.filter(m=>m.ativo).length;
    const maxFaseNum=Math.max(...data.map(m=>m.fase),...fases.map(f=>f.n),3);

    let html=`<div class="curso-modulos-header">
        <div class="curso-modulos-title">
          <h3>Módulos <span class="pacotes-count">${data.length}</span></h3>
          <span class="muted">${activeCount} ativo${activeCount!==1?'s':''}</span>
        </div>
        <div class="curso-modulos-actions">
          <button class="btn btn-outline btn-sm" onclick="Modules._openAddFaseModal()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Adicionar Fase
          </button>
          <button class="btn btn-outline btn-sm" onclick="Modules._openBulkModal()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Adicionar em Lote
          </button>
          <button class="btn btn-primary btn-sm" onclick="Modules.saveModulos()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            Guardar Alterações
          </button>
        </div>
      </div>
      <div class="curso-modulos-select-bar" id="modSelectBar">
        <label class="curso-select-all-label">
          <input type="checkbox" id="modSelectAll" onchange="Modules._toggleSelectAll(this.checked)">
          <span>Selecionar todos</span>
        </label>
        <div class="curso-select-actions" id="modSelectActions" style="display:none">
          <button class="btn btn-sm btn-outline" onclick="Modules._batchToggleMods(true)">Ativar selecionados</button>
          <button class="btn btn-sm btn-outline" onclick="Modules._batchToggleMods(false)">Desativar selecionados</button>
          <button class="btn btn-sm btn-danger" onclick="Modules._batchDeleteMods()">Eliminar selecionados</button>
        </div>
        <span class="curso-select-count" id="modSelectCount"></span>
      </div>`;

    const faseOptions=fases.map(f=>`<option value="${f.n}">Fase ${f.n}</option>`).join('');

    fases.forEach(f=>{
      const mods=data.filter(m=>m.fase===f.n);
      const faseName=faseNames[f.n];
      html+=`<div class="curso-fase-group">
        <div class="curso-fase-header" style="--fase-color:${f.color}">
          <span class="curso-fase-dot" style="background:${f.color}"></span>
          <span class="curso-fase-name">Fase ${f.n}</span>
          <span class="curso-fase-label">${faseName}</span>
          <button class="curso-fase-edit" onclick="Modules._renameFase(${f.n},'${faseName.replace(/'/g,"\\'")}')" title="Renomear fase">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <span class="curso-fase-count">${mods.length} módulo${mods.length!==1?'s':''}</span>
        </div>
        <div class="curso-mod-list">
          ${mods.length===0?`<div class="curso-mod-empty">Nenhum módulo nesta fase</div>`:
          mods.map(m=>`<div class="curso-mod-row ${m.ativo?'':'curso-mod-inactive'}" data-id="${m.id}">
            <label class="curso-mod-check">
              <input type="checkbox" class="mod-checkbox" data-id="${m.id}" onchange="Modules._onModSelect()">
            </label>
            <span class="curso-mod-num">${String(m.numero).padStart(2,'0')}</span>
            <div class="curso-mod-fields">
              <input class="mod-name" data-id="${m.id}" value="${m.nome}" placeholder="Nome do módulo">
              <input class="mod-desc" data-id="${m.id}" value="${m.descricao||''}" placeholder="Descrição (opcional)">
            </div>
            <select class="curso-mod-fase" data-id="${m.id}" onchange="Modules._moveModuloFase('${m.id}',Number(this.value))">
              ${fases.map(fa=>`<option value="${fa.n}"${m.fase===fa.n?' selected':''}>Fase ${fa.n}</option>`).join('')}
            </select>
            <div class="curso-mod-status">
              <span class="badge ${m.ativo?'b-green':'b-gray'}" style="cursor:pointer" onclick="Modules.toggleModulo('${m.id}',${!m.ativo})">${m.ativo?'Ativo':'Inativo'}</span>
            </div>
            <button class="curso-mod-delete" onclick="Modules.deleteModulo('${m.id}','${m.nome}')" title="Eliminar">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>`).join('')}
        </div>
      </div>`;
    });

    el.innerHTML=html;
  },

  _onModSelect(){
    const checkboxes=document.querySelectorAll('.mod-checkbox:checked');
    this._selectedMods=new Set(Array.from(checkboxes).map(cb=>cb.dataset.id));
    const bar=document.getElementById('modSelectActions');
    const count=document.getElementById('modSelectCount');
    const allCb=document.getElementById('modSelectAll');
    if(bar)bar.style.display=this._selectedMods.size>0?'flex':'none';
    if(count)count.textContent=this._selectedMods.size>0?`${this._selectedMods.size} selecionado${this._selectedMods.size!==1?'s':''}`:'';
    if(allCb){const total=document.querySelectorAll('.mod-checkbox').length;allCb.checked=total>0&&this._selectedMods.size===total}
  },

  _toggleSelectAll(checked){
    document.querySelectorAll('.mod-checkbox').forEach(cb=>{cb.checked=checked});
    this._onModSelect();
  },

  async _batchToggleMods(ativo){
    if(this._selectedMods.size===0)return;
    const ids=Array.from(this._selectedMods);
    await Promise.all(ids.map(id=>supabase.from('modulos_curso').update({ativo}).eq('id',id)));
    toast(`${ids.length} módulo${ids.length!==1?'s':''} ${ativo?'ativado':'desativado'}${ids.length!==1?'s':''}!`);
    this.loadModulos();
  },

  async _batchDeleteMods(){
    if(this._selectedMods.size===0)return;
    const ids=Array.from(this._selectedMods);
    const count=ids.length;
    const body=`
      <div style="text-align:center;padding:8px 0 16px">
        <div style="width:48px;height:48px;background:rgba(239,68,68,.1);border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </div>
        <p style="color:var(--muted);font-size:.88rem">Eliminar <b style="color:var(--cream)">${count} módulo${count!==1?'s':''}</b> selecionado${count!==1?'s':''}?</p>
        <p style="color:var(--muted);font-size:.78rem;margin-top:4px">Esta ação não pode ser desfeita.</p>
      </div>`;
    const footer=`
      <button class="btn btn-outline" onclick="App.closeModal()">Cancelar</button>
      <button class="btn btn-danger" onclick="App.closeModal();Modules._doBatchDeleteMods()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        Eliminar ${count}
      </button>`;
    App.openModal('Eliminar Módulos',body,footer);
  },
  async _doBatchDeleteMods(){
    const ids=Array.from(this._selectedMods);
    const count=ids.length;
    await Promise.all(ids.map(id=>supabase.from('modulos_curso').delete().eq('id',id)));
    toast(`${count} módulo${count!==1?'s':''} eliminado${count!==1?'s':''}!`);
    this.loadModulos();
  },

  _renameFase(faseNum,currentName){
    const body=`
      <div class="curso-bulk-form">
        <div class="form-group">
          <label>Nome da Fase ${faseNum}</label>
          <input id="faseRenameInput" value="${currentName}" style="width:100%;padding:10px;border:1.5px solid var(--gray-200);border-radius:var(--radius-lg);font-size:var(--text-base)">
        </div>
      </div>`;
    const footer=`
      <button class="btn btn-outline" onclick="App.closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="Modules._saveFaseName(${faseNum})">Guardar Nome</button>`;
    App.openModal(`Renomear Fase ${faseNum}`,body,footer);
    setTimeout(()=>{const inp=document.getElementById('faseRenameInput');if(inp){inp.focus();inp.select()}},150);
  },

  async _saveFaseName(faseNum){
    const newName=document.getElementById('faseRenameInput')?.value?.trim();
    if(!newName){toast('Escreve um nome para a fase.');return}
    const{error}=await supabase.from('modulos_curso').update({fase_nome:newName}).eq('fase',faseNum);
    if(error){toast('Erro: '+error.message);return}
    toast(`Fase ${faseNum} renomeada!`);
    App.closeModal();
    this.loadModulos();
  },

  _openAddFaseModal(){
    const db=DB.load();
    const fases=db.configuracoes?.fases_curso||[{n:1,nome:'Fundamentos e Criação',color:'#22c55e'},{n:2,nome:'Comunicação e Identidade',color:'#3b82f6'},{n:3,nome:'Mercado e Projeto Final',color:'#f97316'}];
    const nextNum=Math.max(...fases.map(f=>f.n))+1;
    const colors=['#22c55e','#3b82f6','#f97316','#a855f7','#ec4899','#14b8a6','#f59e0b','#ef4444'];
    const nextColor=colors[fases.length%colors.length];
    const body=`
      <div class="curso-bulk-form">
        <div class="form-row">
          <div class="form-group" style="flex:2">
            <label>Nome da Fase ${nextNum}</label>
            <input id="faseNewName" placeholder="Ex: Projetos Práticos" style="width:100%;padding:10px;border:1.5px solid var(--gray-200);border-radius:var(--radius-lg);font-size:var(--text-base)">
          </div>
          <div class="form-group" style="flex:0 0 auto">
            <label>Cor</label>
            <input id="faseNewColor" type="color" value="${nextColor}" style="width:48px;height:40px;padding:2px;border:1.5px solid var(--gray-200);border-radius:var(--radius-lg);cursor:pointer">
          </div>
        </div>
      </div>`;
    const footer=`
      <button class="btn btn-outline" onclick="App.closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="Modules._saveFase(${nextNum})">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Criar Fase ${nextNum}
      </button>`;
    App.openModal(`Nova Fase`,body,footer);
    setTimeout(()=>document.getElementById('faseNewName')?.focus(),150);
  },

  async _saveFase(num){
    const name=document.getElementById('faseNewName')?.value?.trim();
    const color=document.getElementById('faseNewColor')?.value||'#6366f1';
    if(!name){toast('Escreve um nome para a fase.');return}
    const db=DB.load();
    const fases=db.configuracoes?.fases_curso||[{n:1,nome:'Fundamentos e Criação',color:'#22c55e'},{n:2,nome:'Comunicação e Identidade',color:'#3b82f6'},{n:3,nome:'Mercado e Projeto Final',color:'#f97316'}];
    fases.push({n:num,nome:name,color});
    db.configuracoes.fases_curso=fases;
    const{data:cfgRow}=await supabase.from('configuracoes').select('id').limit(1).single();
    if(cfgRow?.id){
      await supabase.from('configuracoes').update({fases_curso:fases}).eq('id',cfgRow.id);
    }
    DB.save();
    toast(`Fase ${num} criada!`);
    App.closeModal();
    this.loadModulos();
  },

  async _moveModuloFase(id,newFase){
    const db=DB.load();
    const fases=db.configuracoes?.fases_curso||[{n:1,nome:'Fundamentos e Criação'},{n:2,nome:'Comunicação e Identidade'},{n:3,nome:'Mercado e Projeto Final'}];
    const fase=fases.find(f=>f.n===newFase);
    const faseNome=fase?.nome||`Fase ${newFase}`;
    const{error}=await supabase.from('modulos_curso').update({fase:newFase,fase_nome:faseNome}).eq('id',id);
    if(error){toast('Erro: '+error.message);return}
    toast(`Módulo movido para Fase ${newFase}!`);
    this.loadModulos();
  },

  async saveModulos(){
    const inputs=document.querySelectorAll('.mod-name');
    const updates=[];
    inputs.forEach(inp=>{
      const id=inp.dataset.id;
      const nome=inp.value.trim();
      const desc=document.querySelector(`.mod-desc[data-id="${id}"]`)?.value.trim()||'';
      if(nome)updates.push(supabase.from('modulos_curso').update({nome,descricao:desc}).eq('id',id));
    });
    await Promise.all(updates);
    toast('Módulos atualizados!');
  },

  async addModulosBulk(){
    const texto=document.getElementById('modBulk')?.value?.trim();
    if(!texto){toast('Cole os módulos primeiro.');return}
    const fase=Number(document.getElementById('modFaseBulk').value);
    const db=DB.load();
    const fases=db.configuracoes?.fases_curso||[{n:1,nome:'Fundamentos e Criação'},{n:2,nome:'Comunicação e Identidade'},{n:3,nome:'Mercado e Projeto Final'}];
    const faseObj=fases.find(f=>f.n===fase);
    const faseNome=faseObj?.nome||`Fase ${fase}`;
    const linhas=texto.split('\n').filter(l=>l.trim());
    const mods=[];
    for(const l of linhas){
      const partes=l.split('|').map(p=>p.trim());
      if(partes.length<2)continue;
      const numero=parseInt(partes[0]);
      const nome=partes[1];
      const desc=partes[2]||'';
      if(!numero||!nome)continue;
      mods.push({fase,fase_nome:faseNome,numero,nome,descricao:desc,ordem:numero,ativo:true});
    }
    if(mods.length===0){toast('Nenhum módulo válido. Formato: nº | nome | descrição');return}
    const{error}=await supabase.from('modulos_curso').insert(mods);
    if(error){toast('Erro: '+error.message);return}
    toast(`${mods.length} módulo${mods.length!==1?'s':''} adicionado${mods.length!==1?'s':''}!`);
    App.closeModal();
    Modules.loadModulos();
  },

  async toggleModulo(id,ativo){
    const{error}=await supabase.from('modulos_curso').update({ativo}).eq('id',id);
    if(error){toast('Erro: '+error.message);return}
    Modules.loadModulos();
  },

  async deleteModulo(id,nome){
    const body=`
      <div style="text-align:center;padding:8px 0 16px">
        <div style="width:48px;height:48px;background:rgba(239,68,68,.1);border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </div>
        <p style="color:var(--muted);font-size:.88rem">Eliminar módulo <b style="color:var(--cream)">"${nome}"</b>?</p>
        <p style="color:var(--muted);font-size:.78rem;margin-top:4px">Esta ação não pode ser desfeita.</p>
      </div>`;
    const footer=`
      <button class="btn btn-outline" onclick="App.closeModal()">Cancelar</button>
      <button class="btn btn-danger" onclick="App.closeModal();Modules._doDeleteModulo('${id}')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        Eliminar
      </button>`;
    App.openModal('Eliminar Módulo',body,footer);
  },
  async _doDeleteModulo(id){
    const{error}=await supabase.from('modulos_curso').delete().eq('id',id);
    if(error){toast('Erro: '+error.message);return}
    toast('Módulo eliminado!');
    Modules.loadModulos();
  },

  async saveCursoSettings(){
    try{
      const db=DB.load();const cfg=db.configuracoes;
      cfg.descricao_curso=document.getElementById('cfgDescCurso').value;
      cfg.publico_alvo=document.getElementById('cfgPublicoAlvo').value;
      cfg.ferramentas=document.getElementById('cfgFerramentas').value;
      cfg.carga_horaria=document.getElementById('cfgCargaHoraria').value;
      cfg.certificado=document.getElementById('cfgCertificado').value;
      cfg.localizacao=document.getElementById('cfgLocalizacao').value;
      cfg.localizacao_link=document.getElementById('cfgLocalizacaoLink').value;
      cfg.horario=document.getElementById('cfgHorario').value;
      const{data:cfgRow}=await supabase.from('configuracoes').select('id').limit(1).single();
      if(!cfgRow?.id)throw new Error('Configuração não encontrada');
      const{error}=await supabase.from('configuracoes').update(cfg).eq('id',cfgRow.id);
      if(error)throw error;
      DB.save();toast('Dados do curso guardados!');
    }catch(e){toast('Erro: '+e.message)}
  }
};

// ============================================================
// INIT
// ============================================================
window.AuthUI = AuthUI;
window.App = App;
window.Notif = Notif;
window.DB = DB;
window.Modules = Modules;

window.addEventListener('load',()=>{
  const db=DB.load();localStorage.setItem('aacademy_config',JSON.stringify(db.configuracoes));
  document.getElementById('loginPass')?.addEventListener('keydown',e=>{if(e.key==='Enter')AuthUI.handleLogin()});
  document.getElementById('loginEmail')?.addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('loginPass').focus()});
  AuthUI.init();
  
  // Topbar scroll shadow effect
  const topbar=document.querySelector('.topbar');
  if(topbar){
    let ticking=false;
    window.addEventListener('scroll',()=>{
      if(!ticking){
        window.requestAnimationFrame(()=>{
          topbar.classList.toggle('scrolled',window.scrollY>8);
          ticking=false;
        });
        ticking=true;
      }
    });
  }

  // Mobile menu toggle (desktop)
  const mobileMenuBtn=document.getElementById('mobileMenuBtn');
  const mainNav=document.getElementById('mainNav');
  const mainnavOverlay=document.getElementById('mainnavOverlay');
  
  if(mobileMenuBtn && mainNav && mainnavOverlay){
    mobileMenuBtn.addEventListener('click',()=>{
      mainNav.classList.toggle('open');
      mainnavOverlay.classList.toggle('open');
      document.body.style.overflow=mainNav.classList.contains('open')?'hidden':'';
    });
    
    mainnavOverlay.addEventListener('click',()=>{
      mainNav.classList.remove('open');
      mainnavOverlay.classList.remove('open');
      document.body.style.overflow='';
    });
    
    mainNav.querySelectorAll('a').forEach(a=>{
      a.addEventListener('click',()=>{
        mainNav.classList.remove('open');
        mainnavOverlay.classList.remove('open');
        document.body.style.overflow='';
      });
    });
  }
});

