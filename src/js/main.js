import { supabase } from './supabase.js'

/* ═══════════════════════════════════════════
   MENU
   ═══════════════════════════════════════════ */
const mb=document.getElementById('mbtn'),pillNav=document.getElementById('pillNav'),menuOverlay=document.getElementById('menuOverlay');
if(mb){
  mb.addEventListener('click',()=>{
    pillNav.classList.toggle('open');
    menuOverlay.classList.toggle('open');
    document.body.style.overflow=pillNav.classList.contains('open')?'hidden':'';
  });
  menuOverlay?.addEventListener('click',()=>{
    pillNav.classList.remove('open');
    menuOverlay.classList.remove('open');
    document.body.style.overflow='';
  });
  pillNav?.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{
    pillNav.classList.remove('open');
    menuOverlay.classList.remove('open');
    document.body.style.overflow='';
  }));
}

/* ═══════════════════════════════════════════
   SCROLL DIRECTION & BIDIRECTIONAL REVEALS
   ═══════════════════════════════════════════ */
let lastScrollY=window.scrollY;

/* Element reveals — scroll-driven, bidirectional */
const revealEls=document.querySelectorAll('.reveal');

function checkReveals(){
  const vh=window.innerHeight;
  revealEls.forEach(el=>{
    const rect=el.getBoundingClientRect();
    const visible=rect.top<vh*0.88&&rect.bottom>vh*0.12;
    if(visible)el.classList.add('on');
    else el.classList.remove('on');
  });
}

/* Section entrance animations — scroll-driven */
const sectionAnims=[
  {id:'curso',type:'fade-up'},
  {id:'ferramentas',type:'scale-in'},
  {id:'grade',type:'slide-left'},
  {id:'jornada',type:'fade-up'},
  {id:'publico',type:'slide-right'},
  {id:'instrutor',type:'scale-in'},
  {id:'preco',type:'fade-up'},
  {id:'inscricao',type:'slide-left'},
  {id:'faq-section',type:'fade-up'},
  {id:'consultar',type:'scale-in'}
];

sectionAnims.forEach(cfg=>{
  const el=document.getElementById(cfg.id);
  if(!el)return;
  el.classList.add('section-reveal');
  el.dataset.animType=cfg.type;
});

function checkSections(){
  const vh=window.innerHeight;
  document.querySelectorAll('.section-reveal').forEach(section=>{
    const rect=section.getBoundingClientRect();
    const progress=Math.max(0,Math.min(1,(vh-rect.top)/(vh*0.5)));
    if(rect.top<vh*0.85&&rect.bottom>0){
      section.classList.add('section-visible');
      section.style.setProperty('--reveal-progress',progress);
    }else{
      section.classList.remove('section-visible');
    }
  });
}

/* Parallax glows */
const glows=document.querySelectorAll('.section-glow');
const ringsEls=document.querySelectorAll('.section-rings');

function checkGlows(){
  const vh=window.innerHeight;
  glows.forEach(glow=>{
    const rect=glow.parentElement.getBoundingClientRect();
    const center=rect.top+rect.height/2;
    const offset=(center-vh/2)*0.08;
    glow.style.transform=glow.classList.contains('section-glow--center')
      ?`translate(-50%,-50%) translateY(${offset}px)`
      :`translateY(${offset}px)`;
  });
  ringsEls.forEach(ring=>{
    const rect=ring.parentElement.getBoundingClientRect();
    const center=rect.top+rect.height/2;
    const offset=(center-vh/2)*0.05;
    ring.style.transform=`translateY(calc(-50% + ${offset}px))`;
  });
}

/* Hero parallax */
const heroShell=document.querySelector('.hero');
const heroRings=document.querySelector('.rings');
const heroPortrait=document.querySelector('.portrait');
const heroCopy=document.querySelector('.copy');

function checkHero(){
  const scrollY=window.scrollY;
  const heroH=heroShell?.offsetHeight||800;
  if(scrollY<heroH*1.2){
    const ratio=scrollY/heroH;
    if(heroRings)heroRings.style.transform=`translateY(calc(-50% + ${scrollY*0.15}px)) scale(${1+ratio*0.05})`;
    if(heroPortrait)heroPortrait.style.transform=`translateY(${scrollY*0.25}px)`;
    if(heroCopy)heroCopy.style.opacity=Math.max(0,1-ratio*1.8);
  }
  if(scrollY>100){pillNav?.classList.add('nav-scrolled')}else{pillNav?.classList.remove('nav-scrolled')}
}

/* Progress bar */
const progressBar=document.createElement('div');
progressBar.style.cssText='position:fixed;top:0;left:0;height:2px;background:linear-gradient(90deg,var(--orange),var(--orange-deep));z-index:9999;transition:width .1s linear;width:0;pointer-events:none';
document.body.appendChild(progressBar);

function checkProgress(){
  const scrollTop=document.documentElement.scrollTop||document.body.scrollTop;
  const scrollHeight=document.documentElement.scrollHeight-document.documentElement.clientHeight;
  progressBar.style.width=(scrollTop/scrollHeight)*100+'%';
}

/* Unified scroll handler — single rAF */
let scrollTicking=false;
window.addEventListener('scroll',()=>{
  if(!scrollTicking){
    requestAnimationFrame(()=>{
      checkReveals();
      checkSections();
      checkGlows();
      checkHero();
      checkProgress();
      scrollTicking=false;
    });
    scrollTicking=true;
  }
});

/* Initial check */
requestAnimationFrame(()=>{
  checkReveals();
  checkSections();
  checkGlows();
  checkHero();
  checkProgress();
});

/* ═══════════════════════════════════════════
   STAGGERED GRID REVEALS
   ═══════════════════════════════════════════ */
const staggerObserver=new IntersectionObserver((entries)=>{
  entries.forEach(entry=>{
    if(entry.isIntersecting){
      const children=entry.target.children;
      Array.from(children).forEach((child,i)=>{
        if(child.classList.contains('reveal')){
          child.style.transitionDelay=`${i*100}ms`;
          setTimeout(()=>child.classList.add('on'),i*100+50);
        }
      });
      staggerObserver.unobserve(entry.target);
    }
  });
},{threshold:0.1});

document.querySelectorAll('.grid-4,.journey,.prof-stats,.phases,.faq').forEach(grid=>{
  if(grid.querySelector('.reveal')){
    staggerObserver.observe(grid);
  }
});

/* ═══════════════════════════════════════════
   COUNTER ANIMATION
   ═══════════════════════════════════════════ */
function animateCounter(el,target,duration=1500){
  const start=0;
  const startTime=performance.now();
  const suffix=el.textContent.replace(/[\d,\.+]/g,'');
  const hasPlus=el.textContent.includes('+');
  
  function update(currentTime){
    const elapsed=currentTime-startTime;
    const progress=Math.min(elapsed/duration,1);
    const eased=1-Math.pow(1-progress,3);
    const current=Math.floor(start+(target-start)*eased);
    el.textContent=current.toLocaleString('pt-BR')+(hasPlus?'+':'')+(suffix||'');
    if(progress<1)requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

const counterObserver=new IntersectionObserver((entries)=>{
  entries.forEach(entry=>{
    if(entry.isIntersecting){
      const el=entry.target;
      const text=el.textContent;
      const num=parseInt(text.replace(/\D/g,''));
      if(num&&!el.dataset.animated){
        el.dataset.animated='true';
        animateCounter(el,num);
      }
      counterObserver.unobserve(el);
    }
  });
},{threshold:0.5});

document.querySelectorAll('.prof-stat-num,.investment strong').forEach(el=>{
  counterObserver.observe(el);
});

/* ═══════════════════════════════════════════
   MAGNETIC BUTTONS
   ═══════════════════════════════════════════ */
document.querySelectorAll('.btn').forEach(btn=>{
  btn.addEventListener('mousemove',(e)=>{
    const rect=btn.getBoundingClientRect();
    const x=e.clientX-rect.left-rect.width/2;
    const y=e.clientY-rect.top-rect.height/2;
    btn.style.transform=`translate(${x*0.15}px,${y*0.15}px)`;
  });
  btn.addEventListener('mouseleave',()=>{
    btn.style.transform='';
    btn.style.transition='transform .3s ease';
    setTimeout(()=>btn.style.transition='',300);
  });
});

/* ═══════════════════════════════════════════
   SMOOTH ANCHOR SCROLL
   ═══════════════════════════════════════════ */
document.querySelectorAll('a[href^="#"]').forEach(a=>{
  a.addEventListener('click',(e)=>{
    const target=document.querySelector(a.getAttribute('href'));
    if(target){
      e.preventDefault();
      const offset=80;
      const top=target.getBoundingClientRect().top+window.scrollY-offset;
      window.scrollTo({top,behavior:'smooth'});
    }
  });
});

/* ═══════════════════════════════════════════
   CARD TILT ON HOVER
   ═══════════════════════════════════════════ */
document.querySelectorAll('.feat,.jstep,.prof-stat,.phase').forEach(card=>{
  card.addEventListener('mousemove',(e)=>{
    const rect=card.getBoundingClientRect();
    const x=(e.clientX-rect.left)/rect.width-0.5;
    const y=(e.clientY-rect.top)/rect.height-0.5;
    card.style.transform=`perspective(800px) rotateX(${y*-4}deg) rotateY(${x*4}deg) translateY(-4px)`;
  });
  card.addEventListener('mouseleave',()=>{
    card.style.transform='';
    card.style.transition='transform .4s ease';
    setTimeout(()=>card.style.transition='',400);
  });
});

/* ═══════════════════════════════════════════
   ACCORDION DAS FASES
   ═══════════════════════════════════════════ */
document.querySelectorAll('.phase-h').forEach(header=>{
  header.addEventListener('click',()=>{
    const card=header.closest('.phase');
    const wasOpen=card.classList.contains('open');
    document.querySelectorAll('.phase.open').forEach(p=>{if(p!==card)p.classList.remove('open')});
    card.classList.toggle('open');
  });
});

/* ═══════════════════════════════════════════
   FORMULÁRIO MULTI-PASSO
   ═══════════════════════════════════════════ */
const chips=document.querySelectorAll('.pchip');
const perfilInput=document.getElementById('perfilInput');
const conditionals=document.querySelectorAll('.rf-conditional');
const profileInfo=document.getElementById('profileInfo');
const profileBadge=document.getElementById('profileBadge');
const profileText=document.getElementById('profileText');
const panels=document.querySelectorAll('.rf-step-panel');
const steps=document.querySelectorAll('.step');
const lines=document.querySelectorAll('.step-line');
const btnNext=document.getElementById('btnNext');
const btnBack=document.getElementById('btnBack');
const btnSubmit=document.getElementById('btnSubmit');
const form=document.getElementById('regForm');
const nextSteps=document.getElementById('nextSteps');
const refCode=document.getElementById('refCode');
const summaryGrid=document.getElementById('summaryGrid');
let currentStep=1;
let selectedProfile='';
let pacotes=[];
let selectedPacote=null;
let codigoParceriaValido=null;

const profileData={
  igreja:{badge:'Igreja / Ministério',text:'Vamos personalizar o formulário para as necessidades da tua igreja ou ministério. Precisamos de informações específicas para oferecer a melhor experiência.',fields:['igreja_nome','igreja_funcao']},
  empresa:{badge:'Empresa',text:'Ótimo! Vamos adaptar o formulário para recolher informações relevantes para a tua empresa e equipa.',fields:['empresa_nome','empresa_cargo']},
  freelancer:{badge:'Freelancer',text:'Vamos conhecer melhor o teu perfil profissional para personalizarmos a tua experiência no curso.',fields:['free_experiencia','free_nivel']},
  pessoal:{badge:'Aprendiz',text:'Vamos descobrir a tua motivação para oferecer a melhor experiência de aprendizagem.',fields:['pessoal_motivo']},
  outro:{badge:'Personalizado',text:'Conta-nos mais sobre ti para personalizarmos a tua experiência.',fields:['outro_texto']}
};

const profileDescriptions={
  igreja:'Igreja / Ministério',
  empresa:'Empresa',
  freelancer:'Freelancer',
  pessoal:'Aprendiz',
  outro:'Outro'
};

/* ═══════════════════════════════════════════
   PACOTES
   ═══════════════════════════════════════════ */
async function loadPacotes(){
  let{data,error}=await supabase.from('pacotes').select('*').eq('ativo',true).order('ordem',{ascending:true}).order('valor',{ascending:true});
  // Fallback if ordem column doesn't exist
  if(error||!data){const fb=await supabase.from('pacotes').select('*').eq('ativo',true).order('valor');data=fb.data;error=fb.error}
  if(error||!data||!data.length){console.error('Erro ao carregar pacotes:',error);return}
  pacotes=data;

  // Gerar cards de preços na secção Investimento
  const priceCards=document.getElementById('priceCards');
  if(priceCards){
    const tagMap={online:{label:'ONLINE',cls:'tag--online'},normal:{label:'PRESENCIAL',cls:''},pro:{label:'MAIS POPULAR',cls:'tag--pro'}};
    const descMap={online:'Zoom & Google Meet',normal:'Formação completa',pro:'Formação + Mentoria'};
    const featureMap={
      online:['30 dias de formação ao vivo','3 fases, 18 módulos e projeto final','Illustrator, Photoshop e Affinity Designer','Portfólio pronto para apresentar'],
      normal:['30 dias de formação prática','3 fases, 18 módulos e projeto final','Illustrator, Photoshop e Affinity Designer','Portfólio pronto para apresentar'],
      pro:['Tudo do pacote Normal','Mentoria individualizada','Sessões ao vivo com profissionais','Suporte prioritário no grupo']
    };
    priceCards.innerHTML='';
    pacotes.forEach(pac=>{
      const tag=tagMap[pac.slug]||{label:pac.slug.toUpperCase(),cls:''};
      const feats=featureMap[pac.slug]||(pac.descricao?pac.descricao.split('\n').filter(l=>l.trim()).map(l=>l.trim()):['Curso completo']);
      const div=document.createElement('div');
      div.className='price reveal'+(pac.slug==='online'?' price--online':'')+(pac.slug==='pro'?' price--pro':'');
      div.innerHTML=`<span class="tag ${tag.cls}">${tag.label}</span><span class="p-old">${descMap[pac.slug]||pac.nome}</span><div class="p-new">Kz ${Number(pac.valor).toLocaleString('pt-BR')}</div><p class="p-parcel">ou <b>${pac.parcelas}x de Kz ${Number(pac.valor_parcela).toLocaleString('pt-BR')}</b> sem juros</p><ul>${feats.map(f=>'<li>'+f+'</li>').join('')}</ul><a href="#inscricao" class="btn btn-primary">Quero me inscrever agora <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg></a><p class="guarantee"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></svg>Pagamento integral ou parcelado</p>`;
      priceCards.appendChild(div);
    });
    // Re-init reveals for new elements
    priceCards.querySelectorAll('.reveal').forEach(el=>{
      const rect=el.getBoundingClientRect();
      const vh=window.innerHeight;
      if(rect.top<vh*0.88&&rect.bottom>vh*0.12)el.classList.add('on');
    });
  }

  // Gerar opções no formulário de inscrição
  const container=document.getElementById('packageOptions');
  if(container){
    container.innerHTML='';
    pacotes.forEach((pac,i)=>{
      const label=document.createElement('label');
      label.className='pay-opt'+(i===0?' selected':'');
      label.dataset.pacoteSlug=pac.slug;
      label.innerHTML=`<input type="radio" name="pacote" value="${pac.id}"${i===0?' checked':''}><span><b>${pac.nome} — Kz ${Number(pac.valor).toLocaleString('pt-BR')}</b><small>${pac.parcelas}x de Kz ${Number(pac.valor_parcela).toLocaleString('pt-BR')} sem juros</small></span>`;
      label.addEventListener('click',()=>{
        container.querySelectorAll('.pay-opt').forEach(o=>o.classList.remove('selected'));
        label.classList.add('selected');
        selectPacote(pac.slug);
      });
      container.appendChild(label);
    });
  }

  selectedPacote=pacotes[0];
  updatePaymentLabels();
}

function selectPacote(slug){
  selectedPacote=pacotes.find(p=>p.slug===slug)||null;
  updatePaymentLabels();
  updateSummaryPreview();
}

function updatePaymentLabels(){
  if(!selectedPacote)return;
  const valor=selectedPacote.valor;
  const parcelas=selectedPacote.parcelas;
  const valorParcela=selectedPacote.valor_parcela;
  const valorComDesconto=codigoParceriaValido?Math.round(valor*(1-codigoParceriaValido.percentual/100)):null;
  const valorFinal=valorComDesconto??valor;
  const payIntDetail=document.getElementById('payIntegralDetail');
  const payParcLabel=document.getElementById('payParceladoLabel');
  const payParcDetail=document.getElementById('payParceladoDetail');
  if(payIntDetail)payIntDetail.textContent='Kz '+Number(valorFinal).toLocaleString('pt-BR')+' de uma vez';
  if(payParcLabel)payParcLabel.textContent=parcelas+'x sem juros';
  if(payParcDetail)payParcDetail.textContent=parcelas+' parcelas de Kz '+Math.round(valorFinal/parcelas).toLocaleString('pt-BR');
}

function updateSummaryPreview(){
  const summaryEl=document.getElementById('rfSummary');
  if(!summaryEl||!selectedPacote)return;
  const valor=selectedPacote.valor;
  const valorComDesconto=codigoParceriaValido?Math.round(valor*(1-codigoParceriaValido.percentual/100)):null;
  const valorFinal=valorComDesconto??valor;
  let html=`<div class="rf-summary-item"><b>Pacote</b>${selectedPacote.nome} — Kz ${Number(valor).toLocaleString('pt-BR')}</div>`;
  if(valorComDesconto!==null){
    html+=`<div class="rf-summary-item"><b>Desconto</b>-${codigoParceriaValido.percentual}% (Kz ${Number(valor-valorComDesconto).toLocaleString('pt-BR')})</div>`;
    html+=`<div class="rf-summary-item" style="color:var(--orange)"><b>Valor final</b>Kz ${Number(valorFinal).toLocaleString('pt-BR')}</div>`;
  }
  summaryEl.querySelector('.rf-summary-grid').innerHTML=html;
}

/* Pacote selection */
document.querySelectorAll('#packageOptions .pay-opt').forEach(opt=>{
  opt.addEventListener('click',()=>{
    document.querySelectorAll('#packageOptions .pay-opt').forEach(o=>o.classList.remove('selected'));
    opt.classList.add('selected');
    opt.querySelector('input').checked=true;
    selectPacote(opt.dataset.pacoteSlug);
  });
});
document.querySelectorAll('#packageOptions input[type="radio"]').forEach(radio=>{
  radio.addEventListener('change',()=>{
    const opt=radio.closest('.pay-opt');
    if(opt)selectPacote(opt.dataset.pacoteSlug);
  });
});

/* ═══════════════════════════════════════════
   CÓDIGO DE PARCERIA
   ═══════════════════════════════════════════ */
const btnAplicarCodigo=document.getElementById('btnAplicarCodigo');
const codigoParceriaInput=document.getElementById('codigoParceria');
const codigoParceriaMsg=document.getElementById('codigoParceriaMsg');

btnAplicarCodigo?.addEventListener('click',async()=>{
  const codigo=codigoParceriaInput.value.trim().toUpperCase();
  if(!codigo){codigoParceriaMsg.textContent='Insere um código.';codigoParceriaMsg.style.color='#b42318';codigoParceriaMsg.hidden=false;return}
  btnAplicarCodigo.disabled=true;btnAplicarCodigo.textContent='A validar…';
  const{data,error}=await supabase.rpc('validar_codigo_parceria',{p_codigo:codigo});
  btnAplicarCodigo.disabled=false;btnAplicarCodigo.textContent='Aplicar';
  if(error||!data){codigoParceriaMsg.textContent='Erro ao validar código.';codigoParceriaMsg.style.color='#b42318';codigoParceriaMsg.hidden=false;return}
  if(data.valido){
    codigoParceriaValido={codigo,percentual:data.percentual};
    codigoParceriaMsg.textContent=`Código aplicado! ${data.percentual}% de desconto.`;
    codigoParceriaMsg.style.color='#16a34a';codigoParceriaMsg.hidden=false;
    codigoParceriaInput.disabled=true;btnAplicarCodigo.disabled=true;btnAplicarCodigo.textContent='Aplicado';
  }else{
    codigoParceriaValido=null;
    codigoParceriaMsg.textContent='Código inválido ou esgotado.';
    codigoParceriaMsg.style.color='#b42318';codigoParceriaMsg.hidden=false;
  }
  updatePaymentLabels();updateSummaryPreview();
});

codigoParceriaInput?.addEventListener('keydown',(e)=>{if(e.key==='Enter'){e.preventDefault();btnAplicarCodigo.click()}});

chips.forEach(chip=>{
  chip.addEventListener('click',()=>{
    chips.forEach(c=>c.classList.remove('active'));
    chip.classList.add('active');
    selectedProfile=chip.dataset.profile;
    perfilInput.value=selectedProfile;
    conditionals.forEach(block=>{block.hidden=block.dataset.for!==selectedProfile});
    if(profileData[selectedProfile]){
      profileBadge.textContent=profileData[selectedProfile].badge;
      profileText.textContent=profileData[selectedProfile].text;
      profileInfo.hidden=false;
    }
    updateStep3Desc();
  });
});

function updateStep3Desc(){
  const desc=document.getElementById('step3Desc');
  if(profileData[selectedProfile])desc.textContent=profileData[selectedProfile].text;
}

function goToStep(step){
  if(step<1||step>4)return;
  panels.forEach(p=>p.classList.remove('active'));
  steps.forEach((s,i)=>{
    s.classList.remove('active','done');
    if(i+1<step)s.classList.add('done');
    if(i+1===step)s.classList.add('active');
  });
  lines.forEach((l,i)=>l.classList.toggle('done',i+1<step));
  const panel=document.querySelector(`[data-panel="${step}"]`);
  if(panel)panel.classList.add('active');
  btnBack.hidden=step===1;
  btnNext.hidden=step===4;
  btnSubmit.hidden=step!==4;
  if(step===4)buildSummary();
  currentStep=step;
  form.scrollIntoView({behavior:'smooth',block:'start'});
}

function validateStep(step){
  const panel=document.querySelector(`[data-panel="${step}"]`);
  if(!panel)return true;
  const requiredFields=panel.querySelectorAll('[required]');
  let valid=true;
  requiredFields.forEach(field=>{
    field.classList.remove('error','valid');
    if(field.offsetParent===null)return;
    if(!field.value||field.value.trim()===''){field.classList.add('error');valid=false}
    else field.classList.add('valid');
  });
  return valid;
}

btnNext.addEventListener('click',()=>{
  if(currentStep===1&&!selectedProfile){alert('Por favor seleciona como te descreves antes de continuar.');return}
  if(!validateStep(currentStep)){
    const firstError=document.querySelector(`[data-panel="${currentStep}"] .error`);
    if(firstError)firstError.focus();
    return;
  }
  goToStep(currentStep+1);
});

btnBack.addEventListener('click',()=>goToStep(currentStep-1));

document.querySelectorAll('#payOptions .pay-opt').forEach(opt=>{
  opt.addEventListener('click',()=>{
    document.querySelectorAll('#payOptions .pay-opt').forEach(o=>o.classList.remove('selected'));
    opt.classList.add('selected');
    opt.querySelector('input').checked=true;
  });
});

function buildSummary(){
  const nome=form.querySelector('[name="nome"]').value;
  const email=form.querySelector('[name="email"]').value;
  const whatsapp=form.querySelector('[name="whatsapp"]').value;
  const pagamento=form.querySelector('[name="pagamento"]:checked').value;
  const pac=selectedPacote||pacotes[0];
  const valor=pac?pac.valor:0;
  const parcelas=pac?pac.parcelas:3;
  const valorParcela=pac?Math.round(pac.valor/pac.parcelas):0;
  const desconto=codigoParceriaValido?Math.round(valor*(1-codigoParceriaValido.percentual/100)):null;
  const valorFinal=desconto??valor;
  let html=`
    <div class="rf-summary-item"><b>Perfil</b>${profileDescriptions[selectedProfile]||selectedProfile}</div>
    <div class="rf-summary-item"><b>Nome</b>${nome}</div>
    <div class="rf-summary-item"><b>E-mail</b>${email}</div>
    <div class="rf-summary-item"><b>WhatsApp</b>${whatsapp}</div>
    <div class="rf-summary-item"><b>Pacote</b>${pac?pac.nome:'—'} — Kz ${Number(valor).toLocaleString('pt-BR')}</div>
  `;
  if(desconto!==null){
    html+=`<div class="rf-summary-item"><b>Desconto</b>-${codigoParceriaValido.percentual}%</div>`;
  }
  html+=`<div class="rf-summary-item"><b>Pagamento</b>${pagamento==='integral'?'Integral - Kz '+Number(valorFinal).toLocaleString('pt-BR'):parcelas+'x - Kz '+Math.round(valorFinal/parcelas).toLocaleString('pt-BR')}</div>`;
  summaryGrid.innerHTML=html;
}

/* Config */
function getAcademyConfig(){
  try{return JSON.parse(localStorage.getItem('aacademy_config')||'{}')}
  catch(e){return{}}
}
const _cfg=getAcademyConfig();
const CFG_WHATSAPP=_cfg.whatsapp_comprovativo||'941 679 799';
const CFG_PARCELAS=_cfg.parcelas||3;
let inscricoesAtivas=_cfg.inscricoes_ativas!==false;

const inscricoes=JSON.parse(localStorage.getItem('inscricoes')||'{}');

async function syncAcademyConfig(){
  const{data,error}=await supabase.from('configuracoes').select('*').limit(1).maybeSingle();
  if(error){console.error('Erro ao carregar configurações:',error);return getAcademyConfig()}
  if(data){localStorage.setItem('aacademy_config',JSON.stringify(data));inscricoesAtivas=data.inscricoes_ativas!==false;setEnrollmentAvailability(inscricoesAtivas);return data}
  return getAcademyConfig();
}

function setEnrollmentAvailability(active){
  inscricoesAtivas=active!==false;
  const status=document.getElementById('enrollmentStatus');
  const controls=form?.querySelectorAll('input,select,textarea,button');
  if(status){
    status.hidden=inscricoesAtivas;
    status.textContent='Ainda não começámos as inscrições. Fica atento às nossas redes sociais. Em breve anunciaremos a abertura.';
    status.style.color='#b42318';
    status.style.fontWeight='700';
  }
  if(form)form.hidden=!inscricoesAtivas;
  controls?.forEach(control=>{control.disabled=!inscricoesAtivas});
}

function whatsappNumber(value){
  const digits=String(value||'').replace(/\D/g,'');
  return digits.startsWith('244')?digits:(digits.startsWith('9')?'244'+digits:digits);
}

function updateWhatsappLink(cfg,nome='',code='',pagamento=''){
  const link=document.getElementById('nsWhatsappLink');
  if(!link)return;
  const number=whatsappNumber(cfg.whatsapp_comprovativo||CFG_WHATSAPP);
  const paymentLabel=pagamento==='parcelado'?'parcelado':'integral';
  const message=`Olá! Enviei o comprovativo de pagamento do curso de Design Gráfico.\nNome: ${nome||'—'}\nCódigo de referência: ${code||'—'}\nPagamento: ${paymentLabel}.`;
  link.href=`https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

document.querySelectorAll('.ns-copy').forEach(button=>{
  button.addEventListener('click',async()=>{
    const value=document.getElementById(button.dataset.copyTarget)?.textContent?.trim()||'';
    try{await navigator.clipboard.writeText(value)}
    catch{const input=document.createElement('textarea');input.value=value;input.style.position='fixed';input.style.opacity='0';document.body.appendChild(input);input.select();document.execCommand('copy');input.remove()}
    const original=button.textContent;button.textContent='Copiado!';setTimeout(()=>{button.textContent=original},1600);
  });
});

btnSubmit.addEventListener('click',async(e)=>{
  e.preventDefault();
  try{
  const liveCfg=await syncAcademyConfig();
  if(liveCfg.inscricoes_ativas===false){setEnrollmentAvailability(false);alert('Ainda não começámos as inscrições.');return}
  if(!selectedPacote){
    const checkedRadio=form.querySelector('input[name="pacote"]:checked');
    if(checkedRadio){
      selectedPacote=pacotes.find(p=>p.id===checkedRadio.value)||null;
    }
  }
  if(!selectedPacote){alert('Por favor seleciona um pacote.');return}

  // Check vagas availability
  if(selectedPacote.vagas&&selectedPacote.vagas>0){
    const{data:inscCount}=await supabase.from('inscricoes').select('id',{count:'exact',head:true}).eq('pacote_id',selectedPacote.id).in('estado',['confirmada','aguarda_confirmacao']);
    if(inscCount&&inscCount>=selectedPacote.vagas){alert('Não há vagas disponíveis para este pacote. Por favor escolhe outro.');return}
  }

  if(!validateStep(currentStep)){alert('Preenche todos os campos obrigatórios.');return}
  const code='ADG-'+new Date().getFullYear()+'-'+Math.floor(1000+Math.random()*9000);
  refCode.textContent=code;
  const nome=form.querySelector('[name="nome"]').value;
  const perfil=profileDescriptions[selectedProfile]||selectedProfile;
  const pagamento=form.querySelector('[name="pagamento"]:checked').value;
  updateWhatsappLink(liveCfg,nome,code,pagamento);
  const email=form.querySelector('[name="email"]').value;
  const whatsapp=form.querySelector('[name="whatsapp"]').value;
  const cidade=form.querySelector('[name="cidade"]').value;
  const canal=form.querySelector('[name="canal"]')?.value||'';
  const camposEspecificos={};
  const activeConditional=document.querySelector(`.rf-conditional[data-for="${selectedProfile}"]`);
  if(activeConditional)activeConditional.querySelectorAll('input,select,textarea').forEach(f=>{if(f.name&&f.value)camposEspecificos[f.name]=f.value});

  const inscricaoData={
    nome_completo:nome,email,telefone:whatsapp,cidade:cidade,perfil:selectedProfile,perfil_label:perfil,campos_especificos:camposEspecificos,
    pacote_id:selectedPacote?selectedPacote.id:null,
    codigo_parceria_usado:codigoParceriaValido?codigoParceriaValido.codigo:null,
    modalidade_pagamento:pagamento,
    estado:'aguarda_confirmacao',codigo_referencia:code,canal,tipo_inscricao:'nova',
    parcelas:pagamento==='parcelado'?Array.from({length:selectedPacote?selectedPacote.parcelas:3},(_,i)=>({id:i+1,numero_parcela:i+1,valor:Math.round((selectedPacote?selectedPacote.valor:0)/(selectedPacote?selectedPacote.parcelas:3)),estado:'pendente',data_confirmacao:null})):[],
    notas_internas:[],historico_estados:[{estado:'aguarda_confirmacao',timestamp:new Date().toISOString()}]
  };

  const{error}=await supabase.from('inscricoes').insert(inscricaoData);
  if(error){console.error('Erro ao enviar inscrição:',error);alert('Erro: '+error.message);return}

  inscricoes[code]={nome_completo:nome,email,telefone:whatsapp,cidade:cidade,perfil:selectedProfile,perfil_label:perfil,campos_especificos:camposEspecificos,modalidade_pagamento:pagamento,numero_parcelas:pagamento==='parcelado'?CFG_PARCELAS:1,estado:'aguarda_confirmacao',codigo_referencia:code,codigo_conclusao:null,data_inscricao:new Date().toISOString(),data_confirmacao:null,canal};
  localStorage.setItem('inscricoes',JSON.stringify(inscricoes));

  form.hidden=true;
  nextSteps.hidden=false;

  // Show amount and package name
  const amountBox=document.getElementById('nsAmountBox');
  const amountEl=document.getElementById('nsAmount');
  const pkgEl=document.getElementById('nsPkgName');
  if(selectedPacote&&amountBox&&amountEl&&pkgEl){
    amountBox.hidden=false;
    const valor=pagamento==='integral'?selectedPacote.valor:selectedPacote.valor_parcela;
    const label=pagamento==='integral'?`Pagamento integral — ${selectedPacote.parcelas}x de Kz ${Number(selectedPacote.valor_parcela).toLocaleString('pt-BR')}`:`1ª parcela de ${selectedPacote.parcelas}`;
    amountEl.textContent=`Kz ${Number(valor).toLocaleString('pt-BR')}`;
    pkgEl.textContent=`${selectedPacote.nome} — ${label}`;
  }

  const cfgNow=await syncAcademyConfig();
  let msgEl=document.getElementById('nsDateMsg');
  if(!msgEl){msgEl=document.createElement('div');msgEl.id='nsDateMsg';msgEl.style.cssText='margin-top:16px;padding:14px 18px;border-radius:10px;font-size:.85rem;line-height:1.5;text-align:center';nextSteps.querySelector('.ns-card').insertBefore(msgEl,nextSteps.querySelector('.ns-code'))}
  if(cfgNow.data_confirmada&&cfgNow.data_inicio){
    const d=new Date(cfgNow.data_inicio+'T00:00:00');
    const meses=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    let txt='O curso começa em '+String(d.getDate()).padStart(2,'0')+' de '+meses[d.getMonth()]+' de '+d.getFullYear();
    if(cfgNow.horario)txt+=', às '+cfgNow.horario;
    if(cfgNow.localizacao)txt+=', no(a) '+cfgNow.localizacao;
    txt+='.';
    msgEl.style.background='rgba(34,163,74,.1)';msgEl.style.border='1px solid rgba(34,163,74,.25)';msgEl.style.color='#22a34c';
    msgEl.textContent=txt;
  }else{
    msgEl.style.background='rgba(251,191,36,.08)';msgEl.style.border='1px solid rgba(251,191,36,.25)';msgEl.style.color='#fbbf24';
    msgEl.textContent='A data e localização do curso serão confirmadas em breve. Receberás toda a informação por WhatsApp.';
  }
  nextSteps.scrollIntoView({behavior:'smooth',block:'center'});
  }catch(err){console.error('Erro no submit:',err);alert('Erro: '+err.message)}
});

form.querySelectorAll('input,select,textarea').forEach(field=>{
  field.addEventListener('blur',()=>{
    if(field.hasAttribute('required')){
      field.classList.remove('error','valid');
      if(!field.value||field.value.trim()==='')field.classList.add('error');
      else field.classList.add('valid');
    }
  });
  field.addEventListener('input',()=>{
    if(field.classList.contains('error')&&field.value.trim()!==''){field.classList.remove('error');field.classList.add('valid')}
  });
});

/* Consulta */
const checkBtn=document.getElementById('checkBtn');
const checkCode=document.getElementById('checkCode');
const checkError=document.getElementById('checkError');
const checkResult=document.getElementById('checkResult');
const checkCard=document.getElementById('checkCard');
const checkIcon=document.getElementById('checkIcon');
const checkTitle=document.getElementById('checkTitle');
const checkMsg=document.getElementById('checkMsg');
const checkDetails=document.getElementById('checkDetails');
const checkReset=document.getElementById('checkReset');

checkBtn.addEventListener('click',async()=>{
  const code=checkCode.value.trim().toUpperCase();
  checkError.hidden=true;
  if(!code||!code.match(/^ADG-\d{4}-\d{4}$/)){checkError.hidden=false;return}

  // Always fetch fresh data from Supabase
  let insc=null;
  const{data,error}=await supabase.rpc('consultar_inscricao_publica',{codigo:code});
  if(error){checkError.textContent='Não foi possível consultar.';checkError.hidden=false;return}
  insc=Array.isArray(data)?data[0]||null:data;

  checkResult.hidden=false;
  checkCard.className='check-card';
  checkIcon.className='check-icon';
  const _cfgL=getAcademyConfig();

  if(!insc){
    checkIcon.classList.add('pending');
    checkIcon.innerHTML='<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>';
    checkTitle.textContent='Código não encontrado';
    checkMsg.textContent='Verifica se o código está correto.';
    checkDetails.hidden=true;
  }else if(insc.estado==='confirmada'||insc.status==='aprovado'){
    checkIcon.classList.add('approved');
    checkIcon.innerHTML='<svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>';
    checkTitle.textContent='Inscrição confirmada!';
    checkMsg.textContent='Parabéns! A tua inscrição foi confirmada.';
    checkDetails.hidden=false;
    let d=`<div class="cd-row"><span class="cd-label">Nome</span><span class="cd-value">${insc.nome_completo||insc.nome||'—'}</span></div>
      <div class="cd-row"><span class="cd-label">Perfil</span><span class="cd-value">${insc.perfil_label||insc.perfil||'—'}</span></div>
      <div class="cd-row"><span class="cd-label">Pagamento</span><span class="cd-value">${insc.modalidade_pagamento==='integral'||insc.pagamento==='integral'?'Integral':'Parcelado'}</span></div>`;
    if(insc.codigo_conclusao)d+=`<div class="cd-row"><span class="cd-label">Código</span><span class="cd-value" style="color:var(--orange)">${insc.codigo_conclusao}</span></div>`;
    // Try to get group link from package, fallback to global config
    let linkGrupo=_cfgL.link_grupo||'';
    if(insc.pacote_id&&!linkGrupo){
      try{const{data:pkg}=await supabase.from('pacotes').select('link_grupo').eq('id',insc.pacote_id).single();if(pkg?.link_grupo)linkGrupo=pkg.link_grupo}catch(e){}
    }else if(insc.pacote_id){
      try{const{data:pkg}=await supabase.from('pacotes').select('link_grupo').eq('id',insc.pacote_id).single();if(pkg?.link_grupo)linkGrupo=pkg.link_grupo}catch(e){}
    }
    if(linkGrupo)d+=`<div class="cd-row"><span class="cd-label">Grupo</span><span class="cd-value"><a href="${linkGrupo}" target="_blank" style="color:var(--orange)">${linkGrupo}</a></span></div>`;
    checkDetails.innerHTML=d;
  }else{
    checkIcon.classList.add('pending');
    checkIcon.innerHTML='<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>';
    checkTitle.textContent='Inscrição pendente';
    checkMsg.textContent='A tua inscrição está a ser processada.';
    checkDetails.hidden=false;
    checkDetails.innerHTML=`<div class="cd-row"><span class="cd-label">Nome</span><span class="cd-value">${insc.nome_completo||insc.nome||'—'}</span></div><div class="cd-row"><span class="cd-label">Estado</span><span class="cd-value">Aguardando confirmação</span></div>`;
  }
  checkResult.scrollIntoView({behavior:'smooth',block:'center'});
});

checkCode.addEventListener('keydown',(e)=>{if(e.key==='Enter')checkBtn.click()});
checkReset.addEventListener('click',()=>{checkResult.hidden=true;checkCode.value='';checkCode.focus()});

/* Apply config */
(async function applyConfig(){
  const cfg=await syncAcademyConfig();
  try{await loadPacotes()}catch(e){console.error('loadPacotes:',e)}
  const iban=cfg.iban||'AO06 0055 0000 0856 1941 0152';
  const titular=cfg.titular_iban||'Adilson Amado — Comércio e Prestação de Serviços';
  const whatsapp=cfg.whatsapp_comprovativo||'941 679 799';
  const express=cfg.express_number||'';
  const expressNome=cfg.express_nome||'';
  const paypal=cfg.paypal_email||'';

  // Payment methods
  const ibanEl=document.getElementById('nsIban');if(ibanEl)ibanEl.textContent=iban;
  const titularEl=document.getElementById('nsTitular');if(titularEl)titularEl.textContent='Titular: '+titular;
  const wppEl=document.getElementById('nsWhatsapp');if(wppEl)wppEl.textContent=whatsapp;
  const expressEl=document.getElementById('nsExpress');if(expressEl)expressEl.textContent=express||'—';
  const expressNomeEl=document.getElementById('nsExpressNome');if(expressNomeEl)expressNomeEl.textContent='Nome: '+(expressNome||'—');
  const paypalEl=document.getElementById('nsPaypal');if(paypalEl)paypalEl.textContent=paypal||'—';

  // Show/hide payment methods
  const methodIban=document.getElementById('nsMethodIban');if(methodIban)methodIban.hidden=false;
  const methodExpress=document.getElementById('nsMethodExpress');if(methodExpress)methodExpress.hidden=!(express||expressNome);
  const methodPaypal=document.getElementById('nsMethodPaypal');if(methodPaypal)methodPaypal.hidden=!paypal;

  // WhatsApp link — link do grupo do pacote selecionado
  const wppLink=document.getElementById('nsWhatsappLink');
  if(wppLink){
    const pkgLink=selectedPacote?.link_grupo||'';
    if(pkgLink){
      wppLink.href=pkgLink;
      wppLink.hidden=false;
    }else{
      wppLink.hidden=true;
    }
  }

  selectedPacote=pacotes[0];
  updateHero(cfg);
})();

function updateHero(cfg){
  if(!cfg)return;
  const status=document.getElementById('heroStatus');
  const dateTime=document.getElementById('heroDateTime');
  const dateText=document.getElementById('heroDateText');
  const localText=document.getElementById('heroLocalText');
  const localWrap=document.getElementById('heroLocation');
  const preBanner=document.getElementById('preEnrollBanner');
  const dotConfirm=document.getElementById('heroDotDate');
  const dots=document.querySelectorAll('.hero-dot');
  const inscricoesAtivas=cfg.inscricoes_ativas!==false;
  if(cfg.data_confirmada&&cfg.data_inicio){
    if(status)status.style.display='none';
    dots.forEach(d=>d.style.display='none');
    if(dateTime){
      const d=new Date(cfg.data_inicio+'T00:00:00');
      const meses=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
      let txt=String(d.getDate()).padStart(2,'0')+' '+meses[d.getMonth()]+' '+d.getFullYear();
      if(cfg.horario)txt+=' — '+cfg.horario;
      dateText.textContent=txt;dateTime.style.display='inline-flex';
    }
    if(dotConfirm)dotConfirm.style.display='';
    if(localText&&cfg.localizacao){localText.textContent=cfg.localizacao;localWrap.style.display='inline-flex'}
    if(cfg.localizacao_link&&localWrap){const link=document.createElement('a');link.href=cfg.localizacao_link;link.target='_blank';link.style.color='inherit';link.innerHTML=localWrap.innerHTML;localWrap.innerHTML='';localWrap.appendChild(link)}
    if(preBanner)preBanner.style.display='none';
  }else{
    if(status){
      if(inscricoesAtivas){
        status.textContent='INSCRIÇÕES ABERTAS';
        status.style.color='#22c55e';
      }else{
        status.textContent=cfg.hero_status_texto||'BREVEMENTE';
        status.style.color='';
      }
      status.style.display='';
    }
    if(localWrap)localWrap.style.display='none';
    dots.forEach(d=>d.style.display='none');
    if(dotConfirm)dotConfirm.style.display='none';
    if(dateTime)dateTime.style.display='none';
    if(preBanner)preBanner.style.display=inscricoesAtivas?'none':'flex';
  }
}