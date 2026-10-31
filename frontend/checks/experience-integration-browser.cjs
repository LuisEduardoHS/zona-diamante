// UI regression checks. Profile uses an explicit synthetic provider, no account writes.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const base=process.env.EXPERIENCE_URL||'http://127.0.0.1:4191';
const directory=path.resolve(__dirname,'../../docs/evidencias/fase04/experiencia');
const routes=['index.html','pages/equipos/equipo.html?id=sultanes-mty','pages/auth/login.html','pages/auth/registro.html','pages/auth/recuperar.html','pages/auth/restablecer.html','pages/experiencias/trivia.html','pages/coleccion/coleccion.html','pages/contenido/Informacion.html','pages/contenido/Ayuda.html','pages/experiencias/camara.html'];
(async()=>{
 await fs.mkdir(directory,{recursive:true});
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const report={scope:'Guest pages; catalog read over public API when available. No economic mutations or emails.',pages:[],profile:[]};
 try{
  for(const [width,height] of [[360,740],[390,844],[768,1024],[1440,900]]){
   for(const route of routes){
    const page=await browser.newPage({viewport:{width,height}}),errors=[],failed=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failed.push({url:new URL(r.url()).pathname,status:r.status()});});
    await page.goto(base+'/'+route,{waitUntil:'domcontentloaded'});
    await page.waitForSelector('#contenido-pagina',{state:'attached'});await page.waitForTimeout(150);
    const metrics=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,main:Boolean(document.querySelector('main')),title:document.title,emptyButtons:[...document.querySelectorAll('button')].filter(b=>!b.textContent.trim()&&!b.getAttribute('aria-label')&&!b.querySelector('.sr-only')).length}));
    report.pages.push({route,width,height,...metrics,errors,failed});assert.equal(metrics.overflow,false,`${route} ${width}: overflow`);
    if(route==='index.html'&&width===390)await page.screenshot({path:path.join(directory,'inicio-calendario-pendiente.png'),fullPage:true});
    await page.close();
   }
  }
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const synthetic={user:{id:'11111111-1111-4111-8111-111111111111',email:'qa@example.invalid'},profile:{displayName:'Cuenta de prueba',username:'qa_test',pointsBalance:100}};
  await page.route('**/js/features/auth/supabase-provider.js',route=>route.fulfill({contentType:'text/javascript',body:`
   const fixture=${JSON.stringify(synthetic)};
   export const proveedorSupabase={
    observarSesion:fn=>{fn({...fixture,cargando:false});return()=>{}},
    obtenerPerfil:()=>window.__holdProfile?new Promise(resolve=>window.__resolveProfile=resolve):Promise.resolve(fixture),
    actualizarPerfil:async()=>fixture,cerrarSesion:async()=>{},
    iniciarSesion:async()=>{},crearCuenta:async()=>{},solicitarRestablecimiento:async()=>{},restablecerContrasena:async()=>{}
   };` }));
  await page.goto(base+'/pages/auth/perfil.html');await page.waitForFunction(()=>document.querySelector('#perfil-nombre').value==='Cuenta de prueba');
  await page.locator('#perfil-nombre').fill('Otro nombre');await page.locator('#perfil-cancelar').click();
  const session=()=>page.evaluate(async()=>{const {obtenerEstadoSesion}=await import('/js/features/auth/session.js');return obtenerEstadoSesion();});
  assert.equal((await session()).user.id,synthetic.user.id);assert.equal(await page.locator('#perfil-nombre').inputValue(),'Cuenta de prueba');report.profile.push('Discard restores profile without losing authenticated user ID');
  await page.evaluate(()=>{
   window.__revoked=[];const revoke=URL.revokeObjectURL.bind(URL);URL.revokeObjectURL=url=>{window.__revoked.push(url);revoke(url)};
  });
  // Actual upload preview, never submitted or written to a server.
  await page.locator('#perfil-avatar').setInputFiles({name:'avatar.webp',mimeType:'image/webp',buffer:await fs.readFile(path.resolve(__dirname,'../public/assets/img/trivia/perrito-sultan.webp'))});
  const url=await page.locator('#perfil-avatar-imagen').getAttribute('src');assert.ok(url.startsWith('blob:'));
  const navigate=href=>page.evaluate(href=>{const a=document.createElement('a');a.href=href;document.body.append(a);a.click();a.remove();},href);
  await navigate('/index.html');await page.waitForSelector('.inicio-layout');assert.ok((await page.evaluate(()=>window.__revoked)).includes(url));report.profile.push('SPA navigation revokes unsaved avatar URL');
  await page.evaluate(()=>window.__holdProfile=true);await navigate('/pages/auth/perfil.html');await page.waitForFunction(()=>window.__resolveProfile);
  await navigate('/index.html');await page.waitForSelector('.inicio-layout');
  await page.evaluate(()=>window.__resolveProfile({user:{id:'stale'},profile:{displayName:'Stale'}}));await page.waitForTimeout(50);
  assert.equal((await session()).user.id,synthetic.user.id);report.profile.push('Late profile response cannot replace session after navigation');
  await page.close();
  await fs.writeFile(path.join(directory,'integration-browser.json'),JSON.stringify(report,null,2)+'\n');
  console.log(`PASS: ${report.pages.length} guest page/viewports without horizontal overflow; ${report.profile.length} profile regressions. See JSON for console/network findings.`);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
