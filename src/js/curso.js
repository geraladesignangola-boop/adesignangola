import { supabase } from './supabase.js'

const cores=[{fase:1,cor:'#ff4311'},{fase:2,cor:'#1e88e5'},{fase:3,cor:'#22a34c'}]
const toolCores=['#ff4311','#31a8ff','#3b3b3b']

async function init(){
  const[cfgRes,modsRes,pacRes]=await Promise.all([
    supabase.from('configuracoes').select('*').limit(1).single(),
    supabase.from('modulos_curso').select('*').order('fase').order('ordem'),
    supabase.from('pacotes').select('*,turmas(*)').eq('ativo',true).order('valor')
  ])

  const cfg=cfgRes.data||{}
  const mods=modsRes.data||[]
  const pacs=pacRes.data||[]

  renderHero(cfg)
  renderSobre(cfg)
  renderFerramentas(cfg)
  renderEstrutura(mods)
  renderPublico(cfg)
  renderPricing(pacs)
}

function renderHero(cfg){
  const nome=document.getElementById('cursoNome')
  const sub=document.getElementById('cursoSub')
  const meta=document.getElementById('cursoMeta')
  if(nome)nome.textContent=cfg.nome_curso||'Design Gráfico'

  let subTxt=cfg.descricao_curso||'Curso completo de Design Gráfico.'
  if(sub)sub.textContent=subTxt

  const items=[]
  if(cfg.data_inicio&&cfg.data_confirmada){
    const d=new Date(cfg.data_inicio+'T00:00:00')
    const meses=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
    items.push({icon:'calendar',label:monthsFull[d.getMonth()]+' '+d.getFullYear()})
  }else{
    items.push({icon:'calendar',label:'Data a definir'})
  }
  if(cfg.horario)items.push({icon:'clock',label:cfg.horario})
  if(cfg.localizacao)items.push({icon:'map',label:cfg.localizacao})
  if(cfg.duracao)items.push({icon:'clock',label:cfg.duracao})
  if(cfg.carga_horaria)items.push({icon:'zap',label:cfg.carga_horaria})

  const icons={
    calendar:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    clock:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    map:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
    zap:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>'
  }
  if(meta)meta.innerHTML=items.map(i=>`<div class="curso-meta-item">${icons[i.icon]||''}<b>${i.label}</b></div>`).join('')
}

const monthsFull=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

function renderSobre(cfg){
  const desc=document.getElementById('cursoDescricao')
  if(desc)desc.textContent=cfg.descricao_curso||'Curso completo de Design Gráfico — 30 dias, 18 módulos, 3 fases.'

  const grid=document.getElementById('cursoInfoGrid')
  if(!grid)return
  const items=[]
  if(cfg.duracao)items.push({label:'Duração',value:cfg.duracao})
  if(cfg.num_modulos)items.push({label:'Módulos',value:cfg.num_modulos+' módulos'})
  if(cfg.carga_horaria)items.push({label:'Carga Horária',value:cfg.carga_horaria})
  if(cfg.certificado)items.push({label:'Certificado',value:cfg.certificado})
  grid.innerHTML=items.map(i=>`<div class="curso-info-card"><div class="label">${i.label}</div><div class="value">${i.value}</div></div>`).join('')
}

function renderFerramentas(cfg){
  const wrap=document.getElementById('cursoTools')
  if(!wrap)return
  const tools=(cfg.ferramentas||'').split(',').map(t=>t.trim()).filter(Boolean)
  wrap.innerHTML=tools.map((t,i)=>`<div class="curso-tool"><span class="curso-tool-dot" style="background:${toolCores[i%toolCores.length]}"></span>${t}</div>`).join('')
}

function renderEstrutura(mods){
  const sub=document.getElementById('cursoEstruturaSub')
  const wrap=document.getElementById('cursoFases')
  if(!wrap)return
  if(sub)sub.textContent=`${mods.length} módulos organizados em 3 fases progressivas.`

  const fases={1:{nome:'Fundamentos e Criação',mods:[]},2:{nome:'Comunicação e Identidade',mods:[]},3:{nome:'Mercado e Projeto Final',mods:[]}}
  mods.forEach(m=>{if(fases[m.fase])fases[m.fase].mods.push(m)})

  wrap.innerHTML=Object.entries(fases).map(([num,f])=>{
    const cor=cores.find(c=>c.fase==num)?.cor||'#ff4311'
    return`<div class="curso-fase">
      <div class="curso-fase-header">
        <span class="curso-fase-num" style="color:${cor}">${String(num).padStart(2,'0')}</span>
        <div class="curso-fase-info"><h3>${f.nome}</h3><span>Fase ${num} de 3</span></div>
        <span class="curso-fase-badge">${f.mods.length} módulos</span>
      </div>
      <div class="curso-fase-mods">${f.mods.map(m=>`<div class="curso-mod"><span class="curso-mod-num" style="color:${cor}">${String(m.numero).padStart(2,'0')}</span><div><div class="curso-mod-nome">${m.nome}</div>${m.descricao?`<div class="curso-mod-desc">${m.descricao}</div>`:''}</div></div>`).join('')}</div>
    </div>`
  }).join('')
}

function renderPublico(cfg){
  const el=document.getElementById('cursoPublicoTexto')
  if(el)el.textContent=cfg.publico_alvo||'Este curso é para todos que querem aprender design gráfico do zero ao nível profissional.'
}

function renderPricing(pacs){
  const wrap=document.getElementById('cursoPricing')
  if(!wrap)return
  const descs={
    online:['Tudo do pacote Normal','Formação via Zoom e Google Meet','Sessões ao vivo e interativas'],
    normal:['30 dias de formação prática','3 fases, 18 módulos e projeto final','Illustrator, Photoshop e Affinity','Portfólio pronto para apresentar'],
    pro:['Tudo do pacote Normal','Mentoria individualizada','Sessões ao vivo com profissionais','Suporte prioritário no grupo']
  }
  const tags={online:'Online',normal:'Presencial',pro:'Mais Popular'}
  const cors={online:'#0ea5e9',normal:'#ff4311',pro:'#8b5cf6'}
  const modalCores={online:'#0ea5e9',presencial:'#22c55e',híbrido:'#8b5cf6'}
  const modalLabels={online:'Online',presencial:'Presencial',híbrido:'Híbrido'}
  wrap.innerHTML=pacs.map(p=>{
    const c=cors[p.slug]||'#ff4311'
    const d=descs[p.slug]||[]
    const t=p.turmas?.[0]
    return`<div class="curso-price-card" style="border-color:${c}33">
      <span style="display:inline-block;background:${c};color:#fff;font-size:.65rem;font-weight:700;padding:3px 10px;border-radius:99px;margin-bottom:8px">${tags[p.slug]||p.slug}</span>
      <h3>${p.nome}</h3>
      <div class="curso-price" style="color:${c}">Kz ${Number(p.valor).toLocaleString('pt-BR')}</div>
      <div class="curso-price-sub">ou ${p.parcelas}x de Kz ${Number(p.valor_parcela).toLocaleString('pt-BR')} sem juros</div>
      ${t?`<div class="curso-turma-inline" style="margin:12px 0;padding:10px;background:${c}0a;border:1px solid ${c}22;border-radius:8px;font-size:.8rem">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px"><span class="badge" style="background:${modalCores[t.modalidade]||c};font-size:.6rem">${modalLabels[t.modalidade]||t.modalidade}</span></div>
        <div style="color:var(--muted)">${t.dia_semana} — ${t.hora_inicio} às ${t.hora_fim}</div>
        ${t.localizacao?`<div style="color:var(--muted);margin-top:2px">${t.localizacao}</div>`:''}
      </div>`:''}
      <ul>${d.map(i=>`<li>${i}</li>`).join('')}</ul>
      <a href="index.html#inscricao" class="btn btn-primary" style="width:100%;justify-content:center;border-color:${c};background:${c}">Inscrever-me</a>
    </div>`
  }).join('')
}

init()
