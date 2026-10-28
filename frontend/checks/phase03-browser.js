const frame=document.getElementById('app'),results=document.getElementById('results'),size=document.getElementById('size'),scenario=document.getElementById('scenario');
const {live}=await fetch('/__mode').then(r=>r.json());
const wait=async(fn)=>{const start=performance.now();while(!fn()){if(performance.now()-start>25000)throw Error('Timeout');await new Promise(r=>setTimeout(r,50));}};
function resize(){const [w,h]=size.value.split('x').map(Number);frame.width=w;frame.height=h;const scale=Math.min(1,(innerWidth-22)/w);frame.style.transform=`scale(${scale})`;document.getElementById('stage').style.height=`${h*scale}px`;}
const load=()=>{resize();if(!live)localStorage.removeItem('zd:collection:pending:11111111-1111-4111-8111-111111111111');results.textContent='Cargando escenario…';frame.src='/pages/coleccion/coleccion.html?scenario='+scenario.value+'&run='+Date.now();};
document.getElementById('load').onclick=load;size.onchange=resize;
document.getElementById('login').hidden=!live;
document.getElementById('login').onclick=async()=>{
 try{const account=await fetch('/__test-account').then(r=>r.json());frame.src='/pages/auth/login.html?next=/pages/coleccion/coleccion.html';await wait(()=>frame.contentDocument?.querySelector('[data-password-toggle][data-iniciado="true"]'));const doc=frame.contentDocument;doc.getElementById('login-correo').value=account.email;doc.getElementById('login-contrasena').value=account.password;doc.getElementById('login-form').requestSubmit();await wait(()=>frame.contentDocument?.getElementById('col-balance')?.textContent==='1,000');results.textContent='PASS: inicio de sesión real en Auth LOCAL; saldo inicial 1,000.';}catch(e){results.textContent='FAIL login: '+e.message;}
};
document.getElementById('layout').onclick=()=>{
 const doc=frame.contentDocument,w=frame.contentWindow.innerWidth,h=frame.contentWindow.innerHeight,errors=[];
 if(doc.documentElement.scrollWidth>w+1)errors.push('overflow horizontal');
 const dialog=doc.querySelector('dialog[open]');if(dialog){const r=dialog.getBoundingClientRect();if(r.left<0||r.top<0||r.right>w+1||r.bottom>h+1)errors.push('modal fuera de viewport');}
 const images=[...doc.querySelectorAll('#col-grid img')].filter(i=>!i.hidden);
 if(images.some(i=>i.complete&&i.naturalWidth===0))errors.push('imagen rota');
 const tiles=[...doc.querySelectorAll('[data-card]')];
 if(tiles.some(t=>t.getBoundingClientRect().width<44))errors.push('carta no táctil');
 results.textContent=errors.length?'FAIL: '+errors.join(', '):`PASS: ${w}×${h}; ${tiles.length} cartas; sin overflow, imágenes rotas ni modal fuera de límites.`;
};
document.getElementById('tests').onclick=async()=>{
 const checks=[],check=(ok,label)=>{if(!ok)throw Error(label);checks.push(label);};
 try{
  const doc=frame.contentDocument,$=id=>doc.getElementById(id);
  if(!live&&scenario.value==='server-error'){
   await wait(()=>!$('col-notice').hidden&&!$('col-refresh').disabled);
   check(doc.querySelectorAll('[data-card]').length===0,'No inventa cartas ante error HTTP');
   check(!$('col-notice').hidden,'Error de carga visible');check(!$('col-refresh').disabled,'Permite actualización segura');
   results.textContent=`PASS: ${checks.length} comprobaciones (FIXTURE HTTP: server-error)\n`+checks.join('\n');return;
  }
  await wait(()=>doc.querySelectorAll('[data-card]').length>0);
  const total=doc.querySelectorAll('[data-card]').length;check(total>0,'Catálogo dinámico');
  const team=doc.querySelector('[data-type="team"]');team.click();check([...doc.querySelectorAll('.col-face')].every(c=>c.classList.contains('col-face--team')),'Filtro de tipo');
  const select=$('col-team');select.value=select.options[1].value;select.dispatchEvent(new frame.contentWindow.Event('change'));check(doc.querySelectorAll('[data-card]').length===1,'Filtros de equipo y tipo combinados');
  doc.querySelector('[data-card]').click();check($('col-detail').open,'Detalle modal');check($('col-detail-title').textContent.length>0,'Identidad del catálogo');
  if(live||scenario.value!=='guest'){
   if(scenario.value==='poor'){check($('col-buy').disabled&&$('col-buy').textContent.includes('insuficientes'),'Saldo insuficiente bloquea compra');}
   else if(!['owned','server-error'].includes(scenario.value)){
    await wait(() => !$('col-buy').disabled);
    $('col-buy').click();check(!$('col-confirm').hidden,'Confirmación antes de gastar');
    $('col-cancel-buy').click();check($('col-confirm').hidden,'Cancelar sin compra');
    $('col-buy').click();$('col-confirm-buy').click();$('col-confirm-buy').click();
    await wait(()=>!$('col-detail-state').textContent.includes('Confirmando')&&!$('col-refresh').disabled);
    if(['uncertain','expired'].includes(scenario.value)){check(!$('col-recovery').hidden,'Respuesta incierta conserva recuperación');check(!$('col-notice').hidden,'Aviso visible sin éxito ficticio');}
    else{check($('col-detail-price').textContent.includes('colección'),'Propiedad confirmada');check($('col-balance').textContent==='750','Saldo del servidor después de comprar');}
   }
  }else{check(!$('col-detail-login').hidden,'Invitado recibe acceso a login');check($('col-buy').hidden,'Invitado no compra');}
  $('col-detail-close').click();check(!$('col-detail').open,'Cerrar detalle');check(doc.querySelectorAll('[data-card]').length===1,'Detalle conserva filtros');
  $('col-reset').click();check(doc.querySelectorAll('[data-card]').length===total,'Restablecer filtros');
  if(!live&&scenario.value==='owned'){
   doc.querySelector('.col-tile--owned').click();check($('col-detail-price').textContent.includes('colección'),'Propiedad existente visible');check($('col-buy').hidden,'Carta adquirida no se paga otra vez');$('col-detail-close').click();
  }
  doc.querySelector('[data-type="mascot"]').click();doc.querySelector('[data-card]').click();
  check($('col-buy').hidden,'Mascota jamás comprable');check(!$('col-detail-ar').hidden,'Acceso a AR');check($('col-detail-ar').href.includes('/pages/experiencias/camara.html'),'Ruta AR real');$('col-detail-close').click();
  if(live){frame.contentWindow.location.reload();await wait(()=>frame.contentDocument?.querySelector('.col-tile--owned'));check(frame.contentDocument.getElementById('col-balance').textContent==='750','Propiedad y saldo persisten tras recargar con Auth real');}
  results.textContent=`PASS: ${checks.length} comprobaciones (${live?'Auth + FastAPI + PostgreSQL LOCALES reales':'FIXTURE HTTP: '+scenario.value})\n`+checks.join('\n');
 }catch(e){results.textContent='FAIL: '+e.message+'\nCompletadas: '+checks.join(', ');}
};
load();
