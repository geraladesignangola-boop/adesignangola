import { supabase } from './supabase.js'

const mb=document.getElementById('mbtn'),menu=document.getElementById('menu'),menuOverlay=document.getElementById('menuOverlay');
mb.addEventListener('click',()=>{
  menu.classList.toggle('open');
  menuOverlay.classList.toggle('open');
  document.body.style.overflow=menu.classList.contains('open')?'hidden':'';
});
menuOverlay.addEventListener('click',()=>{
  menu.classList.remove('open');
  menuOverlay.classList.remove('open');
  document.body.style.overflow='';
});
menu.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{
  menu.classList.remove('open');
  menuOverlay.classList.remove('open');
  document.body.style.overflow='';
}));

const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('on');io.unobserve(e.target)}}),{threshold:.12});
document.querySelectorAll('.reveal').forEach(el=>io.observe(el));

setTimeout(()=>{document.querySelectorAll('.reveal:not(.on)').forEach(el=>el.classList.add('on'))},1500);

/* Accordion das fases */
document.querySelectorAll('.phase-h').forEach(header=>{
  header.addEventListener('click',()=>{
    const card=header.closest('.phase');
    const wasOpen=card.classList.contains('open');
    card.classList.toggle('open');
  });
});

/* Formulário adaptativo multi-passo */
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

/* Seleção de perfil */
chips.forEach(chip=>{
  chip.addEventListener('click',()=>{
    chips.forEach(c=>c.classList.remove('active'));
    chip.classList.add('active');
    selectedProfile=chip.dataset.profile;
    perfilInput.value=selectedProfile;
    
    conditionals.forEach(block=>{
      block.hidden=block.dataset.for!==selectedProfile;
    });
    
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
  if(profileData[selectedProfile]){
    desc.textContent=profileData[selectedProfile].text;
  }
}

/* Navegação entre passos */
function goToStep(step){
  if(step<1||step>4)return;
  
  panels.forEach(p=>p.classList.remove('active'));
  steps.forEach((s,i)=>{
    s.classList.remove('active','done');
    if(i+1<step)s.classList.add('done');
    if(i+1===step)s.classList.add('active');
  });
  lines.forEach((l,i)=>{
    l.classList.toggle('done',i+1<step);
  });
  
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
    if(!field.value||field.value.trim()===''){
      field.classList.add('error');
      valid=false;
    }else{
      field.classList.add('valid');
    }
  });
  
  return valid;
}

btnNext.addEventListener('click',()=>{
  if(currentStep===1&&!selectedProfile){
    alert('Por favor seleciona como te descreves antes de continuar.');
    return;
  }
  
  if(!validateStep(currentStep)){
    const firstError=document.querySelector(`[data-panel="${currentStep}"] .error`);
    if(firstError)firstError.focus();
    return;
  }
  
  goToStep(currentStep+1);
});

btnBack.addEventListener('click',()=>{
  goToStep(currentStep-1);
});

/* Pagamento */
document.querySelectorAll('.pay-opt').forEach(opt=>{
  opt.addEventListener('click',()=>{
    document.querySelectorAll('.pay-opt').forEach(o=>o.classList.remove('selected'));
    opt.classList.add('selected');
    opt.querySelector('input').checked=true;
  });
});

/* Resumo */
function buildSummary(){
  const cfg=getAcademyConfig();
  const nome=form.querySelector('[name="nome"]').value;
  const email=form.querySelector('[name="email"]').value;
  const whatsapp=form.querySelector('[name="whatsapp"]').value;
  const pagamento=form.querySelector('[name="pagamento"]:checked').value;
  
  let html=`
    <div class="rf-summary-item"><b>Perfil</b>${profileDescriptions[selectedProfile]||selectedProfile}</div>
    <div class="rf-summary-item"><b>Nome</b>${nome}</div>
    <div class="rf-summary-item"><b>E-mail</b>${email}</div>
    <div class="rf-summary-item"><b>WhatsApp</b>${whatsapp}</div>
    <div class="rf-summary-item"><b>Pagamento</b>${pagamento==='integral'?'Integral - Kz '+Number(cfg.valor_total||CFG_VALOR).toLocaleString('pt-BR'):(cfg.parcelas||CFG_PARCELAS)+'x - Kz '+Number(cfg.valor_parcela||CFG_VALOR_PARCELA).toLocaleString('pt-BR')}</div>
  `;
  
  summaryGrid.innerHTML=html;
}

/* Read config from admin panel */
function getAcademyConfig(){
  try{ return JSON.parse(localStorage.getItem('aacademy_config') || '{}'); }
  catch(e){ return {}; }
}
const _cfg = getAcademyConfig();
const CFG_IBAN = _cfg.iban || 'AO06 0055 0000 0856 1941 0152';
const CFG_TITULAR = _cfg.titular_iban || 'Adilson Amado — Comércio e Prestação de Serviços';
const CFG_WHATSAPP = _cfg.whatsapp_comprovativo || '941 679 799';
const CFG_VALOR = _cfg.valor_total || 45000;
const CFG_PARCELAS = _cfg.parcelas || 3;
const CFG_VALOR_PARCELA = _cfg.valor_parcela || 15000;
let inscricoesAtivas = _cfg.inscricoes_ativas !== false;

const inscricoes=JSON.parse(localStorage.getItem('inscricoes')||'{}');

async function syncAcademyConfig(){
  const {data,error}=await supabase.from('configuracoes').select('*').limit(1).maybeSingle();
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
  if(form) form.hidden=!inscricoesAtivas;
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
    try{
      await navigator.clipboard.writeText(value);
    }catch{
      const input=document.createElement('textarea');input.value=value;input.style.position='fixed';input.style.opacity='0';document.body.appendChild(input);input.select();document.execCommand('copy');input.remove();
    }
    const original=button.textContent;button.textContent='Copiado!';setTimeout(()=>{button.textContent=original},1600);
  });
});

/* Submissão do formulário */
btnSubmit.addEventListener('click',async(e)=>{
  e.preventDefault();
  const liveCfg=await syncAcademyConfig();
  if(liveCfg.inscricoes_ativas===false){
    setEnrollmentAvailability(false);
    alert('Ainda não começámos as inscrições. Fica atento às nossas redes sociais. Em breve anunciaremos a abertura.');
    return;
  }
  if(!validateStep(currentStep)){
    alert('Por favor preenche todos os campos obrigatórios antes de continuar.');
    const firstError=document.querySelector(`[data-panel="${currentStep}"] .error`);
    if(firstError)firstError.focus();
    return;
  }
  
  const code='ADG-'+new Date().getFullYear()+'-'+Math.floor(1000+Math.random()*9000);
  refCode.textContent=code;
  
  const nome=form.querySelector('[name="nome"]').value;
  const perfil=profileDescriptions[selectedProfile]||selectedProfile;
  const pagamento=form.querySelector('[name="pagamento"]:checked').value;
  updateWhatsappLink(liveCfg,nome,code,pagamento);
  const email=form.querySelector('[name="email"]').value;
  const whatsapp=form.querySelector('[name="whatsapp"]').value;
  const cidade=form.querySelector('[name="cidade"]').value;
  const canal=form.querySelector('[name="canal"]')?.value || '';
  
  /* Collect profile-specific fields */
  const camposEspecificos={};
  const activeConditional=document.querySelector(`.rf-conditional[data-for="${selectedProfile}"]`);
  if(activeConditional){
    activeConditional.querySelectorAll('input,select,textarea').forEach(f=>{
      if(f.name && f.value) camposEspecificos[f.name]=f.value;
    });
  }
  
  const inscricaoLocal={
    nome_completo:nome,
    email:email,
    telefone:whatsapp,
    cidade:cidade,
    perfil:selectedProfile,
    perfil_label:perfil,
    campos_especificos:camposEspecificos,
    modalidade_pagamento:pagamento,
    numero_parcelas:pagamento==='parcelado'?CFG_PARCELAS:1,
    estado:'aguarda_confirmacao',
    codigo_referencia:code,
    codigo_conclusao:null,
    data_inscricao:new Date().toISOString(),
    data_confirmacao:null,
    canal:canal
  };

  const inscricaoData = {
    nome_completo: nome,
    email: email,
    telefone: whatsapp,
    cidade: cidade,
    perfil: selectedProfile,
    perfil_label: perfil,
    campos_especificos: camposEspecificos,
    valor_total: liveCfg.valor_total || CFG_VALOR,
    modalidade_pagamento: pagamento,
    numero_parcelas: pagamento === 'parcelado' ? (liveCfg.parcelas || CFG_PARCELAS) : 1,
    estado: 'aguarda_confirmacao',
    codigo_referencia: code,
    canal: canal,
    tipo_inscricao: 'nova',
    parcelas: pagamento === 'parcelado'
      ? Array.from({length: liveCfg.parcelas || CFG_PARCELAS}, (_, i) => ({
          id: i + 1,
          numero_parcela: i + 1,
          valor: liveCfg.valor_parcela || CFG_VALOR_PARCELA,
          estado: 'pendente',
          data_confirmacao: null
        }))
      : [],
    notas_internas: [],
    historico_estados: [{estado: 'aguarda_confirmacao', timestamp: new Date().toISOString()}]
  };

  const {error}=await supabase.from('inscricoes').insert(inscricaoData);
  if(error){
    console.error('Erro ao enviar inscrição:',error);
    alert('Não foi possível enviar a inscrição. Verifica a ligação e tenta novamente.');
    return;
  }

  inscricoes[code]=inscricaoLocal;
  localStorage.setItem('inscricoes',JSON.stringify(inscricoes));

  form.hidden=true;
  nextSteps.hidden=false;
  nextSteps.scrollIntoView({behavior:'smooth',block:'center'});
});

/* Validação em tempo real */
form.querySelectorAll('input,select,textarea').forEach(field=>{
  field.addEventListener('blur',()=>{
    if(field.hasAttribute('required')){
      field.classList.remove('error','valid');
      if(!field.value||field.value.trim()===''){
        field.classList.add('error');
      }else{
        field.classList.add('valid');
      }
    }
  });
  field.addEventListener('input',()=>{
    if(field.classList.contains('error')&&field.value.trim()!==''){
      field.classList.remove('error');
      field.classList.add('valid');
    }
  });
});

/* Consulta de inscrição */
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
  
  if(!code||!code.match(/^ADG-\d{4}-\d{4}$/)){
    checkError.hidden=false;
    return;
  }
  
  let insc=inscricoes[code];
  if(!insc){
    const {data,error}=await supabase.rpc('consultar_inscricao_publica',{codigo:code});
    if(error){
      console.error('Erro ao consultar inscrição:',error);
      checkError.textContent='Não foi possível consultar agora. Tenta novamente.';
      checkError.hidden=false;
      return;
    }
    insc=Array.isArray(data)?data[0]||null:data;
  }
  checkResult.hidden=false;
  checkCard.className='check-card';
  checkIcon.className='check-icon';
  
  if(!insc){
    checkIcon.classList.add('pending');
    checkIcon.innerHTML='<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>';
    checkTitle.textContent='Código não encontrado';
    checkMsg.textContent='Verifica se o código está correto ou aguarda alguns minutos após a inscrição.';
    checkDetails.innerHTML='';
    checkDetails.hidden=true;
  }else if(insc.estado==='confirmada' || insc.status==='aprovado'){
    const _cfgL = getAcademyConfig();
    checkIcon.classList.add('approved');
    checkIcon.innerHTML='<svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>';
    checkTitle.textContent='Inscrição confirmada!';
    checkMsg.textContent='Parabéns! A tua inscrição foi confirmada.';
    checkDetails.hidden=false;
    let detailsHtml=`
      <div class="cd-row"><span class="cd-label">Nome</span><span class="cd-value">${insc.nome_completo||insc.nome||'—'}</span></div>
      <div class="cd-row"><span class="cd-label">Perfil</span><span class="cd-value">${insc.perfil_label||insc.perfil||'—'}</span></div>
      <div class="cd-row"><span class="cd-label">Pagamento</span><span class="cd-value">${insc.modalidade_pagamento==='integral'||insc.pagamento==='integral'?'Integral':'Parcelado'}</span></div>
    `;
    if(insc.codigo_conclusao){
      detailsHtml+=`<div class="cd-row"><span class="cd-label">Código de Conclusão</span><span class="cd-value" style="color:var(--g600);font-size:1.05rem">${insc.codigo_conclusao}</span></div>`;
    }
    if(_cfgL.link_grupo){
      detailsHtml+=`<div class="cd-row"><span class="cd-label">Grupo da Turma</span><span class="cd-value"><a href="${_cfgL.link_grupo}" target="_blank" style="color:var(--g600)">${_cfgL.link_grupo}</a></span></div>`;
    }
    checkDetails.innerHTML=detailsHtml;
  }else{
    checkIcon.classList.add('pending');
    checkIcon.innerHTML='<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>';
    checkTitle.textContent='Inscrição pendente';
    checkMsg.textContent='A tua inscrição está a ser processada. A confirmação é feita dentro do horário de atendimento (Seg-Sáb, 09h30–16h).';
    checkDetails.hidden=false;
    checkDetails.innerHTML=`
      <div class="cd-row"><span class="cd-label">Nome</span><span class="cd-value">${insc.nome_completo||insc.nome||'—'}</span></div>
      <div class="cd-row"><span class="cd-label">Estado</span><span class="cd-value">Aguardando confirmação</span></div>
    `;
  }
  
  checkResult.scrollIntoView({behavior:'smooth',block:'center'});
});

checkCode.addEventListener('keydown',(e)=>{
  if(e.key==='Enter')checkBtn.click();
});

checkReset.addEventListener('click',()=>{
  checkResult.hidden=true;
  checkCode.value='';
  checkCode.focus();
});

/* ===== Apply config from admin panel ===== */
(async function applyConfig(){
  const cfg = await syncAcademyConfig();
  const iban = cfg.iban || 'AO06 0055 0000 0856 1941 0152';
  const titular = cfg.titular_iban || 'Adilson Amado — Comércio e Prestação de Serviços';
  const whatsapp = cfg.whatsapp_comprovativo || '941 679 799';
  const valor = cfg.valor_total || 45000;
  const parcelas = cfg.parcelas || 3;
  const valorParcela = cfg.valor_parcela || 15000;

  const ibanEl = document.getElementById('nsIban');
  if(ibanEl) ibanEl.textContent = iban;
  const titularEl = document.getElementById('nsTitular');
  if(titularEl) titularEl.textContent = 'Titular: ' + titular;
  const wppEl = document.getElementById('nsWhatsapp');
  if(wppEl) wppEl.textContent = whatsapp;

  const payIntLabel = document.getElementById('payIntegralLabel');
  if(payIntLabel) payIntLabel.textContent = 'Pagamento integral';
  const payIntDetail = document.getElementById('payIntegralDetail');
  if(payIntDetail) payIntDetail.textContent = 'Kz ' + valor.toLocaleString('pt-BR') + ' de uma vez';
  const payParcLabel = document.getElementById('payParceladoLabel');
  if(payParcLabel) payParcLabel.textContent = parcelas + 'x sem juros';
  const payParcDetail = document.getElementById('payParceladoDetail');
  if(payParcDetail) payParcDetail.textContent = parcelas + ' parcelas de Kz ' + valorParcela.toLocaleString('pt-BR');

  const landingPrice = document.getElementById('landingPrice');
  if(landingPrice) landingPrice.textContent = Number(valor).toLocaleString('pt-BR');
  const landingInstallments = document.getElementById('landingInstallments');
  if(landingInstallments) landingInstallments.textContent = parcelas + 'x de Kz ' + Number(valorParcela).toLocaleString('pt-BR');
})();