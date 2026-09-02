// ============================================================
// DATA MODEL
// ============================================================
import { supabase } from './supabase.js'
import { Auth } from './auth.js'

const ESTADOS={INICIADA:'iniciada',AGUARDA:'aguarda_confirmacao',CONFIRMADA:'confirmada',REJEITADA:'rejeitada'};
const PERFIS=['igreja','empresa','freelancer','pessoal','outro'];
const PERFIL_LABELS={igreja:'Igreja / MinistÃ©rio',empresa:'Empresa',freelancer:'Freelancer',pessoal:'Aprendiz',outro:'Outro'};

function defaultConfig(){return{data_inicio:'',num_modulos:18,duracao:'30 dias',valor_total:45000,parcelas:3,valor_parcela:15000,inscricoes_ativas:true,regra_liberacao_codigo:'primeira_parcela',iban:'AO06 0055 0000 0856 1941 0152',titular_iban:'Adilson Amado â€” ComÃ©rcio e PrestaÃ§Ã£o de ServiÃ§os',whatsapp_comprovativo:'941 679 799',link_grupo:'',textos_landing:{}}}
function defaultUser(){return{id:1,nome:'Adilson',email:'admin@aacademy.ao',password:'admin123',role:'admin',criado_em:new Date().toISOString()}}

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
  async insertInscricao(row){
    const {data,error} = await supabase.from('inscricoes').insert(row).select().single();
    if(!error && data){this._data.inscricoes.unshift(data);this._data.counter++;}
    return {data,error};
  },
  getNextCode(){this._data.counter++;return`ADG-${new Date().getFullYear()}-${String(this._data.counter).padStart(3,'0')}`},
  getInscricao(id){return this._data.inscricoes.find(i=>i.id===id)},
  updateInscricao(id,u){const i=this.getInscricao(id);if(i){Object.assign(i,u);this.save()}return i}
};

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
        notifs.unshift({id:Date.now()+i.id,inscricao_id:i.id,tipo:'nova_inscricao',titulo:`Nova inscriÃ§Ã£o: ${i.nome_completo}`,descricao:`${i.codigo_referencia} Â· ${PERFIL_LABELS[i.perfil]||i.perfil} Â· ${i.modalidade_pagamento==='integral'?'Integral':i.numero_parcelas+'x parcelado'}`,lida:false,data:i.data_inscricao});
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
    if(notifs.length===0){list.innerHTML='<div class="notif-empty">Sem notificaÃ§Ãµes</div>';return}
    list.innerHTML=notifs.slice(0,30).map(n=>`<div class="notif-item ${n.lida?'':'unread'}" onclick="Notif.clickItem(${n.id})">
      <span class="av notif-icon" style="background:${n.tipo==='nova_inscricao'?'linear-gradient(135deg,#22a34c,#8fd14f)':n.tipo==='pagamento_confirmado'?'linear-gradient(135deg,#1e88e5,#42a5f5)':n.tipo==='presenca'?'linear-gradient(135deg,#ec407a,#f06292)':'linear-gradient(135deg,#fb8c00,#ffa726)'}">
        ${n.tipo==='nova_inscricao'?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>':n.tipo==='pagamento_confirmado'?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>':'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>'}
      </span>
      <div class="notif-content"><p><b>${n.titulo}</b></p><p class="notif-time">${n.descricao}</p><p class="notif-time">${this._timeAgo(n.data)}</p></div>
    </div>`).join('');
  },

  _timeAgo(iso){
    if(!iso)return'';const diff=Date.now()-new Date(iso).getTime();const mins=Math.floor(diff/60000);
    if(mins<1)return'Agora';if(mins<60)return`hÃ¡ ${mins}min`;const hrs=Math.floor(mins/60);if(hrs<24)return`hÃ¡ ${hrs}h`;const days=Math.floor(hrs/24);return`hÃ¡ ${days}d`;
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
  go(r){this.closeModal();this.currentRoute=r;document.querySelectorAll('.mainnav a').forEach(a=>a.classList.remove('active'));const i=['dashboard','inscricoes','presenca','settings','reports'].indexOf(r);const n=document.querySelectorAll('.mainnav a');if(i>=0&&n[i])n[i].classList.add('active');document.querySelectorAll('.bottom-nav-item').forEach(b=>b.classList.remove('active'));const bottomItem=document.querySelector(`.bottom-nav-item[data-page="${r}"]`);if(bottomItem)bottomItem.classList.add('active');this.render()},
  render(){const c=document.getElementById('app-content');c.innerHTML='';switch(this.currentRoute){case'dashboard':c.appendChild(Modules.dashboard());break;case'inscricoes':c.appendChild(Modules.inscricoes());break;case'inscricao':c.appendChild(Modules.inscricaoDetail());break;case'presenca':c.appendChild(Modules.presenca());break;case'presenca_nova':c.appendChild(Modules.presencaNova());break;case'presenca_ver':c.appendChild(Modules.presencaVer());break;case'settings':c.appendChild(Modules.settings());break;case'reports':c.appendChild(Modules.reports());break}repairRenderedEncoding(c)},
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
    div.innerHTML=`<div class="card welcome"><h2>OlÃ¡, ${Auth.currentUser?.nome||'Admin'} ðŸ‘‹</h2><div style="display:flex;gap:10px"><button class="btn btn-primary" onclick="App.go('inscricoes')">Ver inscritos</button><button class="btn btn-outline" onclick="App.go('settings')">DefiniÃ§Ãµes</button></div></div>`;

    // Row A: stats + revenue
    const rowA=document.createElement('div');rowA.className='row row-a';
    rowA.innerHTML=`
      <div class="stack">
        <div class="pair">
          <div class="card"><h3>Total de InscriÃ§Ãµes</h3><div class="stat-num">${total} <span class="trend t-gr">â–² real</span></div><p class="muted">InscriÃ§Ãµes recebidas</p>
            <svg class="spark" viewBox="0 0 300 70" preserveAspectRatio="none"><path d="M0 55 C30 35,55 18,85 32 S145 60,175 42 S235 12,265 28 S290 36,300 22" fill="rgba(34,163,76,.12)"/><path d="M0 55 C30 35,55 18,85 32 S145 60,175 42 S235 12,265 28 S290 36,300 22" fill="none" stroke="#22a34c" stroke-width="2"/></svg>
          </div>
          <div class="card"><h3>Taxa de ConfirmaÃ§Ã£o</h3><div class="stat-num">${taxa}% <span class="trend t-gr">â–² real</span></div><p class="muted">InscriÃ§Ãµes confirmadas / total</p>
            <svg class="spark" viewBox="0 0 300 70" preserveAspectRatio="none"><path d="M0 50 C35 55,60 25,90 30 S150 55,185 38 S245 20,300 35" fill="rgba(30,136,229,.12)"/><path d="M0 50 C35 55,60 25,90 30 S150 55,185 38 S245 20,300 35" fill="none" stroke="#1e88e5" stroke-width="2"/></svg>
          </div>
        </div>
        <div class="card"><h3>MatrÃ­culas por Perfil</h3><p class="muted">DistribuiÃ§Ã£o dos inscritos por perfil.</p>
          <div class="rings">
            ${PERFIS.filter(p=>perfis[p]>0).map((p,idx)=>{const cl=['#22a34c','#1e88e5','#ec407a','#fb8c00','#7e57c2'];return`<div class="ring"><div class="ring-wrap"><canvas id="ring${idx}"></canvas><span class="ring-c">${perfis[p]}</span></div><div><b>${PERFIL_LABELS[p]}</b><span>${perfis[p]}</span></div></div>`}).join('')||'<p class="muted">Sem dados</p>'}
          </div>
        </div>
      </div>
      <div class="card"><h3>Receita</h3><p class="muted">Receita consolidada de inscriÃ§Ãµes.</p>
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
    const pills=document.createElement('div');pills.className='pills';
    pills.innerHTML=`
      <div class="pill-card p-green" onclick="App.go('inscricoes')"><span class="ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></span><div><em>Receita Confirmada</em><strong>Kz ${receitaConf.toLocaleString('pt-BR')} <small>total</small></strong></div></div>
      <div class="pill-card p-blue" onclick="App.go('inscricoes')"><span class="ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></span><div><em>InscriÃ§Ãµes</em><strong>${total} <small>recebidas</small></strong></div></div>
      <div class="pill-card p-pink" onclick="App.go('inscricoes')"><span class="ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></span><div><em>Confirmadas</em><strong>${confirmadas} <small>alunos</small></strong></div></div>
      <div class="pill-card p-orange" onclick="App.go('inscricoes')"><span class="ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg></span><div><em>Aguarda</em><strong>${aguarda} <small>por confirmar</small></strong></div></div>`;
    div.appendChild(pills);

    // Row B: recent + timeline
    const rowB=document.createElement('div');rowB.className='row row-b';
    const recentRows=insc.slice(-5).reverse().map(i=>`<tr onclick="App.openDetail(${inlineArg(i.id)})" style="cursor:pointer"><td><div class="student"><span class="av" style="background:${avColor(i.nome_completo)}">${i.nome_completo.substring(0,2).toUpperCase()}</span><div><b>${i.nome_completo}</b><span>${i.codigo_referencia||'â€”'}</span></div></div></td><td>${formatDate(i.data_inscricao)}</td><td>${perfilBadge(i.perfil)}</td><td>${estadoBadge(i.estado)}</td><td class="dots">â‹¯</td></tr>`).join('');
    rowB.innerHTML=`
      <div class="card"><div class="welcome" style="margin-bottom:6px"><h3>Inscritos Recentes</h3><button class="btn btn-outline btn-sm" onclick="App.go('inscricoes')">Ver todos</button></div>
        <table><thead><tr><th>INSCRIÃ‡ÃƒO</th><th>DATA</th><th>PERFIL</th><th>ESTADO</th><th></th></tr></thead><tbody>${recentRows||'<tr><td colspan="5" style="text-align:center;color:#8a94a6;padding:30px">Nenhuma inscriÃ§Ã£o ainda</td></tr>'}</tbody></table>
      </div>
      <div class="card"><h3>Atividades Recentes</h3><div class="timeline">
        ${insc.slice(-3).reverse().map(i=>`<div class="tl-item"><h4>${i.nome_completo}</h4><p>${i.codigo_referencia} Â· ${i.modalidade_pagamento==='integral'?'Integral':i.numero_parcelas+'x parcelado'}</p><span class="when">ðŸ•“ ${formatDate(i.data_inscricao)}</span></div>`).join('')||'<div class="tl-item"><h4>Sem atividade</h4><p>Aguardando inscriÃ§Ãµes</p></div>'}
      </div></div>`;
    div.appendChild(rowB);

    // Action needed
    if(antigos.length>0){
      const act=document.createElement('div');act.className='card action-needed-card';
      act.innerHTML=`<h3 style="color:#fb8c00">AÃ§Ã£o NecessÃ¡ria â€” Aguarda ConfirmaÃ§Ã£o</h3><p class="muted" style="margin-bottom:10px">InscriÃ§Ãµes mais antigas que precisam de confirmaÃ§Ã£o:</p>
        <table><thead><tr><th>NOME</th><th>DATA</th><th>PERFIL</th><th>PAGAMENTO</th><th></th></tr></thead><tbody>${antigos.map(i=>`<tr><td><div class="student"><span class="av" style="background:${avColor(i.nome_completo)}">${i.nome_completo.substring(0,2).toUpperCase()}</span><div><b>${i.nome_completo}</b><span>${i.codigo_referencia}</span></div></div></td><td>${formatDate(i.data_inscricao)}</td><td>${perfilBadge(i.perfil)}</td><td>${i.modalidade_pagamento==='integral'?'Integral':i.numero_parcelas+'x'}</td><td><button class="btn btn-primary btn-sm" onclick="App.openDetail(${inlineArg(i.id)})">Confirmar</button></td></tr>`).join('')}</tbody></table>`;
      div.appendChild(act);
    }

    setTimeout(()=>this._initDashboardCharts(insc,cfg,perfis),100);
    return div;
  },

  _initDashboardCharts(insc,cfg,perfis){
    Chart.defaults.font.family="'Space Grotesk',sans-serif";Chart.defaults.color='#8a94a6';Chart.defaults.plugins.legend.display=false;
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
    const db=DB.load();const div=document.createElement('div');
    div.innerHTML=`<div class="card welcome"><h2>Inscritos (${db.inscricoes.length})</h2><button class="btn btn-primary" onclick="Modules.exportCSV()">Exportar CSV</button></div>`;
    const f=document.createElement('div');f.className='filters';
    f.innerHTML=`<input type="text" class="filter-input" id="filterNome" placeholder="Pesquisar por nome..." oninput="Modules.applyFilters()"><select class="filter-input" id="filterEstado" onchange="Modules.applyFilters()"><option value="">Todos os estados</option><option value="iniciada">Iniciada</option><option value="aguarda_confirmacao">Aguarda confirmaÃ§Ã£o</option><option value="confirmada">Confirmada</option><option value="rejeitada">Rejeitada</option></select><select class="filter-input" id="filterPerfil" onchange="Modules.applyFilters()"><option value="">Todos os perfis</option>${PERFIS.map(p=>`<option value="${p}">${PERFIL_LABELS[p]}</option>`).join('')}</select><select class="filter-input" id="filterPagamento" onchange="Modules.applyFilters()"><option value="">Todas as formas</option><option value="integral">Integral</option><option value="parcelado">Parcelado</option></select><input type="date" class="filter-input" id="filterDataInicio" onchange="Modules.applyFilters()"><input type="date" class="filter-input" id="filterDataFim" onchange="Modules.applyFilters()">`;
    div.appendChild(f);
    const card=document.createElement('div');card.className='card';
    const rows=db.inscricoes.map(i=>`<tr data-id="${i.id}" data-nome="${normalize(i.nome_completo)}" data-estado="${i.estado}" data-perfil="${i.perfil}" data-pagamento="${i.modalidade_pagamento}" data-data="${i.data_inscricao}"><td><div class="student"><span class="av" style="background:${avColor(i.nome_completo)}">${i.nome_completo.substring(0,2).toUpperCase()}</span><div><b>${i.nome_completo}</b><span>${i.codigo_referencia}</span></div></div></td><td>${formatDate(i.data_inscricao)}</td><td>${perfilBadge(i.perfil)}</td><td>${i.modalidade_pagamento==='integral'?'Integral':i.numero_parcelas+'x parcelado'}</td><td>${estadoBadge(i.estado)}</td><td><button class="btn btn-outline btn-sm" onclick="App.openDetail(${inlineArg(i.id)})">Ver</button></td></tr>`).join('');
    card.innerHTML=`<table><thead><tr><th>NOME</th><th>DATA</th><th>PERFIL</th><th>PAGAMENTO</th><th>ESTADO</th><th></th></tr></thead><tbody id="inscricoesBody">${rows||'<tr><td colspan="6" style="text-align:center;color:#8a94a6;padding:30px">Nenhuma inscriÃ§Ã£o ainda</td></tr>'}</tbody></table>`;
    div.appendChild(card);return div;
  },

  applyFilters(){
    const n=normalize(document.getElementById('filterNome')?.value||'');const e=document.getElementById('filterEstado')?.value||'';const p=document.getElementById('filterPerfil')?.value||'';const pg=document.getElementById('filterPagamento')?.value||'';const di=document.getElementById('filterDataInicio')?.value||'';const df=document.getElementById('filterDataFim')?.value||'';
    document.querySelectorAll('#inscricoesBody tr').forEach(r=>{if(!r.dataset.id)return;const show=(!n||r.dataset.nome.includes(n))&&(!e||r.dataset.estado===e)&&(!p||r.dataset.perfil===p)&&(!pg||r.dataset.pagamento===pg)&&(!di||r.dataset.data>=di)&&(!df||r.dataset.data<=df+'T23:59:59');r.style.display=show?'':'none'});
  },

  exportCSV(){
    const db=DB.load();const h=['Nome','Email','Telefone','Cidade','Perfil','Pagamento','Estado','CÃ³digo Ref','CÃ³digo ConclusÃ£o','Data InscriÃ§Ã£o','Data ConfirmaÃ§Ã£o'];
    const rows=db.inscricoes.map(i=>[i.nome_completo,i.email,i.telefone,i.cidade,PERFIL_LABELS[i.perfil]||i.perfil,i.modalidade_pagamento,i.estado,i.codigo_referencia,i.codigo_conclusao||'',formatDate(i.data_inscricao),formatDate(i.data_confirmacao)]);
    let csv='\uFEFF'+h.join(';')+'\n';rows.forEach(r=>{csv+=r.map(c=>`"${(c||'').toString().replace(/"/g,'""')}"`).join(';')+'\n'});
    const b=new Blob([repairMojibake(csv)],{type:'text/csv;charset=utf-8'});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download='inscricoes_aacademy.csv';a.click();toast('CSV exportado!');
  },

  // ========== DETALHE INSCRITO ==========
  inscricaoDetail(){
    const db=DB.load();const insc=db.inscricoes.find(i=>i.id===App._detailId);
    if(!insc){App.go('inscricoes');return document.createElement('div')}
    const cfg=db.configuracoes;const div=document.createElement('div');
    div.innerHTML=`<button class="btn btn-outline" onclick="App.go('inscricoes')" style="margin-bottom:14px">â† Voltar Ã  lista</button>`;

    // Header
    const hdr=document.createElement('div');hdr.className='card welcome';
    hdr.innerHTML=`<div><h2>${insc.nome_completo}</h2><p class="muted">${insc.codigo_referencia} Â· ${PERFIL_LABELS[insc.perfil]||insc.perfil} Â· <span style="color:${insc.tipo_inscricao==='renovacao'?'#ec407a':'#22a34c'};font-weight:700">${insc.tipo_inscricao==='renovacao'?'RenovaÃ§Ã£o':'Nova MatrÃ­cula'}</span></p></div><div style="display:flex;gap:8px;align-items:center"><select class="filter-input" id="tipoInscSelect" onchange="Modules.toggleTipoInscricao(${insc.id})" style="font-size:.75rem;padding:5px 8px"><option value="nova" ${insc.tipo_inscricao!=='renovacao'?'selected':''}>Nova MatrÃ­cula</option><option value="renovacao" ${insc.tipo_inscricao==='renovacao'?'selected':''}>RenovaÃ§Ã£o</option></select>${estadoBadge(insc.estado)}</div>`;
    div.appendChild(hdr);

    // Grid
    const grid=document.createElement('div');grid.className='row row-2 modal-detail-grid';

    // LEFT
    const left=document.createElement('div');left.className='card modal-info-card';
    left.innerHTML=`
      <div class="settings-section"><h3>Dados Pessoais</h3>
        <div class="form-row"><div class="form-group"><label>Nome</label><input value="${insc.nome_completo}" readonly></div><div class="form-group"><label>Email</label><input value="${insc.email||'â€”'}" readonly></div></div>
        <div class="form-row"><div class="form-group"><label>Telefone</label><input value="${insc.telefone||'â€”'}" readonly></div><div class="form-group"><label>Cidade</label><input value="${insc.cidade||'â€”'}" readonly></div></div>
      </div>
      <div class="settings-section"><h3>Perfil: ${PERFIL_LABELS[insc.perfil]}</h3>${Modules._renderProfileFields(insc)}</div>
      <div class="settings-section"><h3>Pagamento</h3>
        <div class="form-row"><div class="form-group"><label>Modalidade</label><input value="${insc.modalidade_pagamento==='integral'?'Integral â€” Kz '+cfg.valor_total.toLocaleString('pt-BR'):insc.numero_parcelas+'x parcelado'}" readonly></div><div class="form-group"><label>Data InscriÃ§Ã£o</label><input value="${formatDate(insc.data_inscricao)}" readonly></div></div>
        ${insc.codigo_conclusao?`<div class="form-group"><label>CÃ³digo de ConclusÃ£o</label><input value="${insc.codigo_conclusao}" readonly style="font-weight:800;color:#22a34c;font-size:1.1rem"></div>`:''}
        ${insc.data_confirmacao?`<div class="form-group"><label>Data ConfirmaÃ§Ã£o</label><input value="${formatDateTime(insc.data_confirmacao)}" readonly></div>`:''}
      </div>`;
    grid.appendChild(left);

    // RIGHT
    const right=document.createElement('div');right.className='stack modal-actions-column';

    // Actions
    const act=document.createElement('div');act.className='card modal-actions-card';
    let aH='<h3>AÃ§Ãµes</h3>';
    if(insc.estado===ESTADOS.AGUARDA||insc.estado===ESTADOS.INICIADA){
      if(insc.modalidade_pagamento==='integral'){aH+=`<button class="btn btn-primary" onclick="Modules.confirmPayment(${inlineArg(insc.id)})" style="width:100%;justify-content:center;margin-bottom:8px">Confirmar Pagamento Integral</button>`}
      else{aH+=`<p class="muted" style="margin-bottom:10px">Pagamento parcelado:</p>`;insc.parcelas.forEach((p,idx)=>{if(p.estado==='pendente'){const atr=p.prazo&&new Date(p.prazo)<new Date();aH+=`<button class="btn ${atr?'btn-danger':'btn-primary'} btn-sm" onclick="Modules.confirmParcela(${inlineArg(insc.id)},${inlineArg(p.id)})" style="width:100%;justify-content:center;margin-bottom:6px">Confirmar Parcela ${p.numero_parcela} â€” Kz ${p.valor.toLocaleString('pt-BR')}${atr?' (ATRASADA)':''}</button>`}})}
      aH+=`<hr style="margin:12px 0;border:none;border-top:1px solid #eef1f5"><button class="btn btn-danger" onclick="Modules.rejectInscricao(${inlineArg(insc.id)})" style="width:100%;justify-content:center">Rejeitar InscriÃ§Ã£o</button>`;
    }else if(insc.estado===ESTADOS.CONFIRMADA){
      aH+=`<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:14px;margin-bottom:10px;text-align:center"><p style="font-weight:800;color:#15803d;font-size:1rem">CÃ³digo de ConclusÃ£o</p><p style="font-size:1.3rem;font-weight:800;color:#0f5c2e;margin:6px 0">${insc.codigo_conclusao}</p>${cfg.link_grupo?`<p style="font-size:.82rem;margin-top:8px">Grupo: <a href="${cfg.link_grupo}" target="_blank" style="color:#22a34c;font-weight:700">${cfg.link_grupo}</a></p>`:''}</div>`;
      aH+=`<button class="btn btn-outline" onclick="Modules.reopenInscricao(${inlineArg(insc.id)})" style="width:100%;justify-content:center">Reabrir InscriÃ§Ã£o</button>`;
    }else if(insc.estado===ESTADOS.REJEITADA){
      aH+=`<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:14px;margin-bottom:10px"><p style="font-weight:700;color:#ef4444">InscriÃ§Ã£o rejeitada</p>${insc._motivo_rejeicao?`<p class="muted" style="margin-top:6px">Motivo: ${insc._motivo_rejeicao}</p>`:''}</div>`;
      aH+=`<button class="btn btn-outline" onclick="Modules.reopenInscricao(${inlineArg(insc.id)})" style="width:100%;justify-content:center">Reabrir InscriÃ§Ã£o</button>`;
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
      const hc=document.createElement('div');hc.className='card modal-section-card';let hH='<h3>HistÃ³rico de Estados</h3><div class="timeline">';
      const el={iniciada:'Iniciada',aguarda_confirmacao:'Aguarda confirmaÃ§Ã£o',confirmada:'Confirmada',rejeitada:'Rejeitada'};
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
    const cs=insc.campos_especificos||{};const fl={igreja_nome:'Nome da igreja',igreja_funcao:'FunÃ§Ã£o',igreja_membros:'NÂº de membros',igreja_ramo:'Ramo',empresa_nome:'Nome da empresa',empresa_cargo:'Cargo',empresa_setor:'Setor',empresa_func:'NÂº de funcionÃ¡rios',free_experiencia:'ExperiÃªncia',free_nivel:'NÃ­vel',free_nicho:'Nicho',free_portfolio:'PortfÃ³lio',pessoal_motivo:'MotivaÃ§Ã£o',pessoal_experiencia:'ExperiÃªncia anterior',pessoal_software:'Software',pessoal_objetivo:'Objetivo',outro_texto:'MotivaÃ§Ã£o',outro_area:'Ãrea de interesse'};
    const k=Object.keys(cs);if(k.length===0)return'<p class="muted">Sem campos especÃ­ficos registados</p>';
    let h='<div class="form-row">';k.forEach((k,i)=>{if(i>0&&i%2===0)h+='</div><div class="form-row">';h+=`<div class="form-group"><label>${fl[k]||k}</label><input value="${cs[k]||'â€”'}" readonly></div>`});h+='</div>';return h;
  },

// ========== ACTIONS ==========
  async confirmPayment(id){
    try{
      if(!Auth.isAdmin())throw new Error('Apenas administradores podem confirmar pagamentos');
      const db=DB.load();const insc=DB.getInscricao(id);if(!insc)return;if(!confirm(`Confirmar pagamento de ${insc.nome_completo}?`))return;
      const now=new Date().toISOString();
      const updates={estado:ESTADOS.CONFIRMADA,data_confirmacao:now,historico_estados:[...(insc.historico_estados||[]),{estado:ESTADOS.CONFIRMADA,timestamp:now}]};
      if(!await DB.saveInscricao(insc.id,updates))throw new Error('Não foi possível atualizar a inscrição na base de dados');
      await DB.refresh();
      const updated=DB.getInscricao(id);
      const code=updated?.codigo_conclusao||'';
      Notif.addCustom('pagamento_confirmado',`Pagamento confirmado: ${insc.nome_completo}`,`${insc.codigo_referencia} · Codigo: ${code}`);toast(`Confirmado! Codigo: ${code}`);App.closeModal();App.render();
    }catch(e){console.error('confirmPayment error:',e);toast('Erro: '+e.message)}
  },
  async confirmParcela(inscId,parcelaIdx){
    try{
      if(!Auth.isAdmin())throw new Error('Apenas administradores podem confirmar parcelas');
      const db=DB.load();const insc=DB.getInscricao(inscId);if(!insc)return;const p=insc.parcelas.find(parcela=>String(parcela.id)===String(parcelaIdx))||insc.parcelas[parcelaIdx];if(!p||p.estado==='confirmada')return;if(!confirm(`Confirmar parcela ${p.numero_parcela}?`))return;
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
    }catch(e){console.error('confirmParcela error:',e);toast('Erro: '+e.message)}
  },
  async rejectInscricao(id){
    try{
      if(!Auth.isAdmin())throw new Error('Apenas administradores podem rejeitar inscrições');
      const m=prompt('Motivo da rejeicao (opcional):');if(m===null)return;const db=DB.load();const insc=DB.getInscricao(id);if(!insc)return;const now=new Date().toISOString();
      const updates={estado:ESTADOS.REJEITADA,motivo_rejeicao:m||'',historico_estados:[...(insc.historico_estados||[]),{estado:ESTADOS.REJEITADA,timestamp:now,motivo:m||''}]};
      if(!await DB.saveInscricao(insc.id,updates))throw new Error('Não foi possível atualizar a inscrição na base de dados');Object.assign(insc,updates);DB.save();toast('Inscricao rejeitada');App.render();
    }catch(e){console.error('rejectInscricao error:',e);toast('Erro: '+e.message)}
  },
async reopenInscricao(id){
    try{
  if(!Auth.isAdmin())throw new Error('Apenas administradores podem reabrir inscrições');
      if(!confirm('Reabrir esta inscricao?'))return;const db=DB.load();const insc=DB.getInscricao(id);if(!insc)return;const now=new Date().toISOString();const prev=insc.estado;
      const updates={estado:ESTADOS.AGUARDA,codigo_conclusao:null,data_confirmacao:null,motivo_rejeicao:'',parcelas:(insc.parcelas||[]).map(p=>({...p,estado:'pendente',data_confirmacao:null})),historico_estados:[...(insc.historico_estados||[]),{estado:ESTADOS.AGUARDA,timestamp:now,nota:`Reaberto de "${prev}"`}]};
      if(!await DB.saveInscricao(insc.id,updates))throw new Error('Não foi possível atualizar a inscrição na base de dados');Object.assign(insc,updates);DB.save();toast('Inscricao reaberta');App.render();
    }catch(e){console.error('reopenInscricao error:',e);toast('Erro: '+e.message)}
  },
  async addNote(id){
    try{
      if(!Auth.isAdmin())throw new Error('Apenas administradores podem adicionar notas');
      const ta=document.getElementById('newNote');const t=ta?.value?.trim();if(!t)return;const db=DB.load();const insc=DB.getInscricao(id);if(!insc)return;
      const notas=[...(insc.notas_internas||[]),{autor:Auth.currentUser?.nome||'Admin',texto:t,timestamp:new Date().toISOString()}];
      if(!await DB.saveInscricao(insc.id,{notas_internas:notas}))throw new Error('Não foi possível guardar a nota na base de dados');insc.notas_internas=notas;DB.save();toast('Nota adicionada');App.render();
    }catch(e){console.error('addNote error:',e);toast('Erro: '+e.message)}
  },
  async toggleTipoInscricao(id){
    try{
      if(!Auth.isAdmin())throw new Error('Apenas administradores podem alterar o tipo de inscrição');
      const val=document.getElementById('tipoInscSelect')?.value;if(!val)return;const db=DB.load();const insc=DB.getInscricao(id);if(!insc)return;
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

    div.innerHTML=`<div class="card welcome"><div><h2>Controlo de PresenÃ§a</h2><p class="muted">Registar quem compareceu e quem faltou em cada sessÃ£o.</p></div><div style="display:flex;gap:10px"><button class="btn btn-primary" onclick="App.go('presenca_nova')">Nova SessÃ£o</button></div></div>`;

    // Stats
    const statsRow=document.createElement('div');statsRow.className='pills';
    statsRow.innerHTML=`
      <div class="pill-card p-green"><span class="ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></span><div><em>SessÃµes</em><strong>${totalSessoes} <small>registadas</small></strong></div></div>
      <div class="pill-card p-blue"><span class="ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></span><div><em>Alunos Confirmados</em><strong>${insc.length} <small>no curso</small></strong></div></div>
      <div class="pill-card p-pink"><span class="ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></span><div><em>Total PresenÃ§as</em><strong>${totalPresentes} <small>registos</small></strong></div></div>
      <div class="pill-card p-orange"><span class="ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg></span><div><em>Taxa Global</em><strong>${taxaGlobal}% <small>presenÃ§a</small></strong></div></div>`;
    div.appendChild(statsRow);

    // Session list
    const card=document.createElement('div');card.className='card';
    if(sessoes.length===0){
      card.innerHTML=`<div style="text-align:center;padding:40px"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#b6c2cc" stroke-width="1.5"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg><h3 style="margin-top:12px;color:#8a94a6;font-size:.92rem">Nenhuma sessÃ£o registada</h3><p class="muted" style="margin:8px 0 16px">Crie a primeira sessÃ£o para comeÃ§ar a controlar a presenÃ§a.</p><button class="btn btn-primary" onclick="App.go('presenca_nova')">Criar SessÃ£o</button></div>`;
    } else {
      let h=`<div class="welcome" style="margin-bottom:14px"><h3>SessÃµes (${sessoes.length})</h3><button class="btn btn-outline btn-sm" onclick="Modules.exportPresencaCSV()">Exportar CSV</button></div>`;
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
      <div class="card welcome"><h2>Nova SessÃ£o de PresenÃ§a</h2></div>`;

    const form=document.createElement('div');form.className='card';
    form.innerHTML=`
      <div class="settings-section"><h3>Dados da SessÃ£o</h3>
        <div class="form-row">
          <div class="form-group"><label>TÃ­tulo da SessÃ£o</label><input id="attdTitulo" placeholder="Ex: Aula 1 â€” IntroduÃ§Ã£o ao Design"></div>
          <div class="form-group"><label>Data</label><input type="date" id="attdData" value="${today}"></div>
        </div>
      </div>
      <div class="settings-section"><h3>Marcar PresenÃ§a (${insc.length} alunos confirmados)</h3>
        ${insc.length===0?'<p class="muted">Nenhum aluno confirmado no curso. Confirme inscriÃ§Ãµes primeiro.</p>':''}
        <div class="attd-checklist" id="attdChecklist">
          ${insc.map(i=>`<div class="attd-row"><input type="checkbox" id="attd_${i.id}" value="${i.id}" checked><label for="attd_${i.id}"><span class="av" style="background:${avColor(i.nome_completo)}">${i.nome_completo.substring(0,2).toUpperCase()}</span>${i.nome_completo} <span class="muted" style="font-size:.72rem">${i.codigo_referencia||''}</span></label></div>`).join('')}
        </div>
        <div style="margin-top:12px;display:flex;gap:10px">
          <button class="btn btn-outline btn-sm" onclick="Modules._toggleAllAttd(true)">Marcar todos</button>
          <button class="btn btn-outline btn-sm" onclick="Modules._toggleAllAttd(false)">Desmarcar todos</button>
        </div>
      </div>
      <div style="margin-top:18px;display:flex;gap:10px">
        <button class="btn btn-primary" onclick="Modules.savePresenca(${JSON.stringify(insc.map(i=>i.id)).replace(/"/g,'&quot;')})">Guardar SessÃ£o</button>
        <button class="btn btn-outline" onclick="App.go('presenca')">Cancelar</button>
      </div>`;
    div.appendChild(form);return div;
  },

  _toggleAllAttd(checked){document.querySelectorAll('#attdChecklist input[type=checkbox]').forEach(cb=>cb.checked=checked)},

  async savePresenca(allIds){
    const titulo=document.getElementById('attdTitulo')?.value?.trim();const data=document.getElementById('attdData')?.value;
    if(!titulo){toast('Escreva o tÃ­tulo da sessÃ£o');return}
    if(!data){toast('Selecione a data');return}
    const db=DB.load();if(!db.presencas)db.presencas=[];
    const presentes=[];const ausentes=[];
    allIds.forEach(id=>{const cb=document.getElementById('attd_'+id);if(cb&&cb.checked)presentes.push(id);else ausentes.push(id)});
    const {data:sessao,error}=await supabase.from('presencas_sessoes').insert({titulo,data,criado_por:Auth.currentUser?.id}).select().single();
    if(error){console.error('savePresenca error:',error);toast('Erro: '+error.message);return}
    const registos=allIds.map(inscricao_id=>({sessao_id:sessao.id,inscricao_id,presente:presentes.includes(inscricao_id)}));
    const {error:registosError}=await supabase.from('presencas_registos').insert(registos);
    if(registosError){await supabase.from('presencas_sessoes').delete().eq('id',sessao.id);console.error('savePresenca records error:',registosError);toast('Erro ao guardar presenças: '+registosError.message);return}
    await DB.refresh();Notif.addCustom('presenca',`SessÃ£o registada: ${titulo}`,`${presentes.length} presentes, ${ausentes.length} ausentes Â· ${data}`);toast(`SessÃ£o "${titulo}" guardada!`);App.go('presenca');
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
    else{pH+=presInsc.map(i=>`<div class="attd-row"><span class="av" style="background:${avColor(i.nome_completo)}">${i.nome_completo.substring(0,2).toUpperCase()}</span><label>${i.nome_completo} <span class="muted" style="font-size:.72rem">${i.codigo_referencia||''}</span></label><span class="badge b-green" style="font-size:.64rem">Presente</span></div>`).join('')}
    presCard.innerHTML=pH;div.appendChild(presCard);

    // Absent list
    const ausCard=document.createElement('div');ausCard.className='card';
    let aH=`<h3>Ausentes (${sessao.ausentes?.length||0})</h3>`;
    const ausInsc=insc.filter(i=>(sessao.ausentes||[]).includes(i.id));
    if(ausInsc.length===0){aH+=`<p class="muted">Todos os alunos presentes!</p>`}
    else{aH+=ausInsc.map(i=>`<div class="attd-row"><span class="av" style="background:${avColor(i.nome_completo)}">${i.nome_completo.substring(0,2).toUpperCase()}</span><label>${i.nome_completo} <span class="muted" style="font-size:.72rem">${i.codigo_referencia||''}</span></label><span class="badge b-red" style="font-size:.64rem">Ausente</span></div>`).join('')}
    ausCard.innerHTML=aH;div.appendChild(ausCard);

    return div;
  },

  viewPresenca(id){App._detailId=id;App.currentRoute='presenca_ver';App.render()},

  async deletePresenca(id){
    if(!confirm('Eliminar esta sessÃ£o de presenÃ§a?'))return;
    const {error}=await supabase.from('presencas_sessoes').delete().eq('id',id);
    if(error){toast('Erro: '+error.message);return}
    await DB.refresh();toast('SessÃ£o eliminada');App.go('presenca');
  },

  exportPresencaCSV(){
    const db=DB.load();const sessoes=db.presencas||[];const insc=db.inscricoes.filter(i=>i.estado===ESTADOS.CONFIRMADA);
    if(sessoes.length===0){toast('Nenhuma sessÃ£o para exportar');return}
    const h=['SessÃ£o','Data','Total','Presentes','Ausentes','Taxa %'];
    const rows=sessoes.map(s=>{const t=(s.presentes?.length||0)+(s.ausentes?.length||0);const p=s.presentes?.length||0;return[s.titulo,formatDate(s.data),t,p,t-p,t>0?Math.round(p/t*100):0]});
    let csv='\uFEFF'+h.join(';')+'\n';rows.forEach(r=>{csv+=r.map(c=>`"${(c||'').toString().replace(/"/g,'""')}"`).join(';')+'\n'});
    const b=new Blob([repairMojibake(csv)],{type:'text/csv;charset=utf-8'});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download='presenca_aacademy.csv';a.click();toast('CSV exportado!');
  },

  // ========== SETTINGS ==========
  settings(){
    const db=DB.load();const cfg=db.configuracoes;const div=document.createElement('div');
    div.innerHTML=`<div class="card welcome"><h2>DefiniÃ§Ãµes</h2></div>`;
    const card=document.createElement('div');card.className='card';
    card.innerHTML=`
      <div class="settings-section"><h3>Dados do Curso</h3>
        <div class="form-row"><div class="form-group"><label>Nome do Curso</label><input id="cfgNome" value="Curso de Design GrÃ¡fico"></div><div class="form-group"><label>Data de InÃ­cio</label><input type="date" id="cfgDataInicio" value="${cfg.data_inicio||''}"></div></div>
        <div class="form-row"><div class="form-group"><label>NÂº de MÃ³dulos</label><input type="number" id="cfgModulos" value="${cfg.num_modulos}"></div><div class="form-group"><label>DuraÃ§Ã£o</label><input id="cfgDuracao" value="${cfg.duracao}"></div></div>
      </div>
      <div class="settings-section"><h3>InscriÃ§Ãµes</h3>
        <p class="muted" style="margin-bottom:12px">Controla se novos alunos podem enviar o formulÃ¡rio de inscriÃ§Ã£o.</p>
        <button type="button" class="btn ${cfg.inscricoes_ativas !== false ? 'btn-primary' : 'btn-outline'}" onclick="Modules.toggleInscricoes()" id="cfgInscricoesBtn">${cfg.inscricoes_ativas !== false ? 'Desativar inscriÃ§Ãµes' : 'Ativar inscriÃ§Ãµes'}</button>
        <span id="cfgInscricoesStatus" class="badge ${cfg.inscricoes_ativas !== false ? 'b-green' : 'b-red'}" style="margin-left:10px">${cfg.inscricoes_ativas !== false ? 'Ativas' : 'Desativadas'}</span>
      </div>
      <div class="settings-section"><h3>PreÃ§o e Parcelamento</h3>
        <div class="form-row"><div class="form-group"><label>Valor Total (Kz)</label><input type="number" id="cfgValor" value="${cfg.valor_total}"></div><div class="form-group"><label>NÂº de Parcelas</label><input type="number" id="cfgParcelas" value="${cfg.parcelas}"></div></div>
        <div class="form-row"><div class="form-group"><label>Valor por Parcela (Kz)</label><input type="number" id="cfgValorParcela" value="${cfg.valor_parcela}"></div><div class="form-group"><label>Regra de LibertaÃ§Ã£o do CÃ³digo</label><select id="cfgRegra"><option value="primeira_parcela" ${cfg.regra_liberacao_codigo==='primeira_parcela'?'selected':''}>ApÃ³s 1Âª parcela</option><option value="pagamento_total" ${cfg.regra_liberacao_codigo==='pagamento_total'?'selected':''}>ApÃ³s pagamento total</option></select></div></div>
      </div>
      <div class="settings-section"><h3>Dados de Pagamento</h3>
        <div class="form-group"><label>IBAN</label><input id="cfgIban" value="${cfg.iban}"></div>
        <div class="form-group"><label>Titular</label><input id="cfgTitular" value="${cfg.titular_iban}"></div>
        <div class="form-group"><label>WhatsApp para Comprovativo</label><input id="cfgWhatsapp" value="${cfg.whatsapp_comprovativo}"></div>
      </div>
      <div class="settings-section"><h3>Grupo da Turma</h3>
        <div class="form-group"><label>Link do Grupo (WhatsApp/Telegram)</label><input id="cfgLinkGrupo" value="${cfg.link_grupo}" placeholder="https://..."></div>
        <p class="muted">Mostrado ao inscrito apenas apÃ³s confirmaÃ§Ã£o.</p>
      </div>
      <button class="btn btn-primary" onclick="Modules.saveSettings()">Guardar AlteraÃ§Ãµes</button>`;
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
      cfg.data_inicio=document.getElementById('cfgDataInicio').value;cfg.num_modulos=parseInt(document.getElementById('cfgModulos').value)||18;cfg.duracao=document.getElementById('cfgDuracao').value;cfg.valor_total=parseInt(document.getElementById('cfgValor').value)||45000;cfg.parcelas=parseInt(document.getElementById('cfgParcelas').value)||3;cfg.valor_parcela=parseInt(document.getElementById('cfgValorParcela').value)||15000;cfg.regra_liberacao_codigo=document.getElementById('cfgRegra').value;cfg.iban=document.getElementById('cfgIban').value;cfg.titular_iban=document.getElementById('cfgTitular').value;cfg.whatsapp_comprovativo=document.getElementById('cfgWhatsapp').value;cfg.link_grupo=document.getElementById('cfgLinkGrupo').value;
      const {data: cfgRow} = await supabase.from('configuracoes').select('id').limit(1).single();
      if(!cfgRow?.id){throw new Error('Configuração não encontrada na base de dados')}
      const {error}=await supabase.from('configuracoes').update(cfg).eq('id',cfgRow.id);
      if(error)throw error;
      DB.save();localStorage.setItem('aacademy_config',JSON.stringify(cfg));toast('Definições guardadas!');
    } catch(e) {console.error('saveSettings error:',e);toast('Erro: '+e.message)}
  },

  // ========== REPORTS ==========
  reports(){
    const db=DB.load();const insc=db.inscricoes;const cfg=db.configuracoes;const div=document.createElement('div');
    const total=insc.length;const conf=insc.filter(i=>i.estado===ESTADOS.CONFIRMADA).length;const ag=insc.filter(i=>i.estado===ESTADOS.AGUARDA).length;const rej=insc.filter(i=>i.estado===ESTADOS.REJEITADA).length;
    const receita=insc.filter(i=>i.estado===ESTADOS.CONFIRMADA).reduce((s,i)=>s+paidAmount(i),0);

    // Vendas Ãºltimos 6 meses
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

    div.innerHTML=`<div class="card welcome"><div><h2>RelatÃ³rio de Vendas</h2><p class="muted">Receita mensal comparando novas matrÃ­culas e renovaÃ§Ãµes nos Ãºltimos 6 meses.</p></div><div style="display:flex;gap:10px"><button class="btn btn-outline" onclick="Modules.exportCSV()">Exportar CSV</button></div></div>`;

    // 4 pills vendas
    const pills=document.createElement('div');pills.className='pills';
    pills.innerHTML=`
      <div class="pill-card p-green"><span class="ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></span><div><em>Receita Total (6m)</em><strong>Kz ${receita.toLocaleString('pt-BR')}</strong></div></div>
      <div class="pill-card p-blue"><span class="ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></span><div><em>Novas MatrÃ­culas</em><strong>${totalNovas} <small>inscritos</small></strong></div></div>
      <div class="pill-card p-pink"><span class="ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></span><div><em>RenovaÃ§Ãµes</em><strong>${totalRenov} <small>renovados</small></strong></div></div>
      <div class="pill-card p-orange"><span class="ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg></span><div><em>MÃ©dia Mensal</em><strong>Kz ${mediaMes.toLocaleString('pt-BR')}</strong></div></div>`;
    div.appendChild(pills);

    // Row A: GrÃ¡fico de barras receita + doughnut novas vs renovaÃ§Ãµes
    const rowA=document.createElement('div');rowA.className='row row-2';
    rowA.innerHTML=`
      <div class="card"><h3>Receita Mensal â€” Novas MatrÃ­culas vs RenovaÃ§Ãµes</h3><p class="muted">Ãšltimos 6 meses.</p><div class="chart-box"><canvas id="chVendasBar"></canvas></div></div>
      <div class="card"><h3>DistribuiÃ§Ã£o de Vendas</h3><p class="muted">ProporÃ§Ã£o novas matrÃ­culas vs renovaÃ§Ãµes.</p><div class="rings"><div class="ring"><div class="ring-wrap"><canvas id="ringVendas"></canvas><span class="ring-c">${total}</span></div><div><b>Total InscriÃ§Ãµes</b><span>${total}</span></div></div></div><div class="pair" style="margin-top:20px"><div style="text-align:center"><p class="muted">Novas MatrÃ­culas</p><b style="font-size:1.5rem;color:#22a34c">${totalNovas}</b></div><div style="text-align:center"><p class="muted">RenovaÃ§Ãµes</p><b style="font-size:1.5rem;color:#ec407a">${totalRenov}</b></div></div></div>`;
    div.appendChild(rowA);

    // Row B: Tabela mensal + mÃ©tricas
    const rowB=document.createElement('div');rowB.className='row row-2';
    let tabelaH='<table><thead><tr><th>MÃŠS</th><th>NOVAS</th><th>RENOVAÃ‡Ã•ES</th><th>RECEITA NOVAS</th><th>RECEITA RENOVAÃ‡Ã•ES</th><th>TOTAL</th></tr></thead><tbody>';
    meses.forEach((m,i)=>{
      const totalMes=receitaNova[i]+receitaRenov[i];
      tabelaH+=`<tr><td><b>${m}</b></td><td>${matriculasNova[i]}</td><td>${matriculasRenov[i]}</td><td>Kz ${receitaNova[i].toLocaleString('pt-BR')}</td><td>Kz ${receitaRenov[i].toLocaleString('pt-BR')}</td><td><b>Kz ${totalMes.toLocaleString('pt-BR')}</b></td></tr>`;
    });
    tabelaH+=`<tr style="background:#f7fbf8;font-weight:800"><td>TOTAL</td><td>${totalNovas}</td><td>${totalRenov}</td><td>Kz ${receitaNova.reduce((a,b)=>a+b,0).toLocaleString('pt-BR')}</td><td>Kz ${receitaRenov.reduce((a,b)=>a+b,0).toLocaleString('pt-BR')}</td><td style="color:#22a34c">Kz ${receita.toLocaleString('pt-BR')}</td></tr>`;
    tabelaH+='</tbody></table>';
    rowB.innerHTML=`
      <div class="card"><h3>VisÃ£o Geral de Vendas</h3><p class="muted" style="margin-bottom:10px">Detalhe mÃªs a mÃªs.</p>${tabelaH}</div>
      <div class="card"><h3>MÃ©tricas de Vendas</h3>
        <div class="settings-section"><h3>Resumo</h3>
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eef1f5"><span>Receita Confirmada</span><b style="color:#22a34c">Kz ${receita.toLocaleString('pt-BR')}</b></div>
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eef1f5"><span>Receita Pendente</span><b style="color:#fb8c00">Kz ${insc.filter(i=>i.estado!==ESTADOS.REJEITADA).reduce((s,i)=>s+pendingAmount(i),0).toLocaleString('pt-BR')}</b></div>
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eef1f5"><span>MÃ©dia por InscriÃ§Ã£o</span><b>Kz ${conf>0?Math.round(receita/conf).toLocaleString('pt-BR'):'0'}</b></div>
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eef1f5"><span>Taxa de ConversÃ£o</span><b style="color:#22a34c">${total>0?Math.round(conf/total*100):0}%</b></div>
          <div style="display:flex;justify-content:space-between;padding:8px 0"><span>Valor Total Curso</span><b>Kz ${cfg.valor_total.toLocaleString('pt-BR')}</b></div>
        </div>
        <div class="settings-section"><h3>Por Perfil</h3>${PERFIS.map(p=>{const count=insc.filter(i=>i.perfil===p).length;const rec=insc.filter(i=>i.perfil===p&&i.estado===ESTADOS.CONFIRMADA).reduce((s,i)=>s+paidAmount(i),0);return`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eef1f5"><span>${PERFIL_LABELS[p]} (${count})</span><b>Kz ${rec.toLocaleString('pt-BR')}</b></div>`}).join('')}</div>
        <div class="settings-section"><h3>Por Pagamento</h3>
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eef1f5"><span>Integral (${insc.filter(i=>i.modalidade_pagamento==='integral').length})</span><b>Kz ${insc.filter(i=>i.modalidade_pagamento==='integral'&&i.estado===ESTADOS.CONFIRMADA).reduce((s,i)=>s+cfg.valor_total,0).toLocaleString('pt-BR')}</b></div>
          <div style="display:flex;justify-content:space-between;padding:6px 0"><span>Parcelado (${insc.filter(i=>i.modalidade_pagamento==='parcelado').length})</span><b>Kz ${insc.filter(i=>i.modalidade_pagamento==='parcelado'&&i.estado===ESTADOS.CONFIRMADA).reduce((s,i)=>s+i.parcelas.filter(pp=>pp.estado==='confirmada').length*cfg.valor_parcela,0).toLocaleString('pt-BR')}</b></div>
        </div>
      </div>`;
    div.appendChild(rowB);

    setTimeout(()=>this._initReportsCharts(receitaNova,receitaRenov,meses,totalNovas,totalRenov),100);
    return div;
  },

  _initReportsCharts(receitaNova,receitaRenov,meses,totalNovas,totalRenov){
    Chart.defaults.font.family="'Space Grotesk',sans-serif";Chart.defaults.color='#8a94a6';
    // Bar chart
    const ctx=document.getElementById('chVendasBar');
    if(ctx){
      new Chart(ctx,{type:'bar',data:{labels:meses,datasets:[{label:'Novas MatrÃ­culas',data:receitaNova,backgroundColor:'#22a34c',borderRadius:4,barPercentage:.7},{label:'RenovaÃ§Ãµes',data:receitaRenov,backgroundColor:'#ec407a',borderRadius:4,barPercentage:.7}]},options:{maintainAspectRatio:false,plugins:{legend:{display:true,position:'top',labels:{usePointStyle:true,pointStyle:'circle',padding:16,font:{size:11,weight:'700'}}},tooltip:{callbacks:{label:c=>c.dataset.label+': Kz '+c.parsed.y.toLocaleString('pt-BR')}}},scales:{y:{stacked:false,ticks:{callback:v=>'Kz'+(v/1000)+'k'},grid:{color:'#f0f3f6'}},x:{grid:{display:false}}}}});
    }
    // Doughnut
    const ring=document.getElementById('ringVendas');
    if(ring){
      new Chart(ring,{type:'doughnut',data:{datasets:[{data:[totalNovas,totalRenov||1],backgroundColor:['#22a34c','#ec407a'],borderWidth:0}]},options:{cutout:'72%',maintainAspectRatio:false,plugins:{tooltip:{enabled:false}}}});
    }
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

