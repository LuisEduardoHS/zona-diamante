import { leerFoto } from '../js/features/ar/filtros-foto.js';
const visor=document.getElementById('visor'), resultados=document.getElementById('results');
window.addEventListener('message',event=>{
    if(event.origin===location.origin && event.source===visor.contentWindow && event.data?.tipo==='fixture-error') {
        let log=document.getElementById('fixture-errors');
        if(!log){log=document.createElement('pre');log.id='fixture-errors';document.body.append(log);}
        log.textContent+=event.data.mensaje+'\n';
    }
});
const size=document.getElementById('size'), cuenta=document.getElementById('account');
let visual=false;
const esperar=async(cond,timeout=20000)=>{const inicio=performance.now();while(!cond()){if(performance.now()-inicio>timeout)throw new Error('Timeout en comprobación de navegador');await new Promise(r=>setTimeout(r,40));}};
const encuadrar=()=>{const [w,h]=size.value.split('x').map(Number);visor.width=w;visor.height=h;const escala=Math.min(1,(innerWidth-24)/w,visual?(innerHeight-150)/h:1);visor.style.transform=`scale(${escala})`;document.getElementById('marco').style.height=`${h*escala}px`;};
encuadrar();size.addEventListener('change',encuadrar);window.addEventListener('resize',encuadrar);
document.getElementById('visual').addEventListener('click',()=>{visual=!visual;resultados.hidden=visual;document.querySelector('body>p').hidden=visual;encuadrar();});
document.getElementById('layout').addEventListener('click',()=>{
    const doc=visor.contentDocument,w=visor.contentWindow.innerWidth,h=visor.contentWindow.innerHeight;
    const modal=doc.querySelector('dialog[open]'),errors=[];
    if(doc.documentElement.scrollWidth>w+1)errors.push('desbordamiento horizontal');
    if(modal){
        const r=modal.getBoundingClientRect();if(r.left<-.5||r.top<-.5||r.right>w+.5||r.bottom>h+.5)errors.push('modal fuera del viewport');
        for(const row of modal.querySelectorAll('.foto-acciones')){
            const botones=[...row.querySelectorAll('button')];
            if(botones.length===2){const a=botones[0].getBoundingClientRect(),b=botones[1].getBoundingClientRect();if(a.width&&b.width&&a.right>b.left+.5)errors.push('acciones superpuestas');}
        }
        for(const button of modal.querySelectorAll('button')){const r=button.getBoundingClientRect();if(r.width&&r.height&&r.height<43.5)errors.push('control táctil pequeño: '+button.textContent);}
    }
    resultados.textContent=(errors.length?'FAIL: '+errors.join('; '):'PASS: viewport '+w+'×'+h+', sin overflow horizontal ni modal/acciones fuera de límites')+'\nModal: '+(modal?.id||'ninguno');resultados.hidden=false;
});
cuenta.addEventListener('change',()=>{visor.src='/__ar?estado='+cuenta.value;});
for(const boton of document.querySelectorAll('[data-target]'))boton.addEventListener('click',()=>{
    visor.contentDocument.getElementById('target-'+boton.dataset.target).emit('targetFound');resultados.textContent='Detección simulada. No es una prueba de escaneo físico.';
});
document.getElementById('lost').addEventListener('click',()=>{
    for(let i=0;i<4;i++)visor.contentDocument.getElementById('target-'+i).emit('targetLost');
});
document.getElementById('tests').addEventListener('click',async()=>{
    const doc=visor.contentDocument, win=visor.contentWindow, $=id=>doc.getElementById(id);
    const shareDescriptors=Object.fromEntries(['share','canShare'].map(key=>[key,Object.getOwnPropertyDescriptor(win.navigator,key)]));
    const pruebas=[]; const check=(ok,nombre)=>{if(!ok)throw new Error(nombre);pruebas.push(nombre);};
    resultados.textContent='Ejecutando pruebas con Canvas/Blob reales…';
    try{
        await esperar(()=>$('ar-status').textContent.includes('Apunta'));
        $('target-0').emit('targetFound'); await esperar(()=>!$('btn-inspeccionar').disabled);
        $('btn-info-equipo').click(); await esperar(()=>$('ar-equipo-panel').open);
        check($('ar-equipo-nombre').textContent==='Algodoneros','Panel usa datos reales');
        $('target-1').emit('targetFound'); $('target-0').emit('targetLost');
        check($('ar-equipo-nombre').textContent==='Algodoneros','Panel conserva equipo durante cambio');
        check($('ar-equipo-ficha').href.endsWith('pages/equipos/equipo.html?id=algodoneros-ul'),'Ficha es la ruta del carrusel');
        $('ar-equipo-cerrar').click(); check(!$('ar-equipo-panel').open,'Cierre de panel');
        $('target-0').emit('targetFound'); await esperar(()=>!$('btn-inspeccionar').disabled);
        $('btn-inspeccionar').click(); await esperar(()=>!$('foto-controles').hidden);
        $('btn-info-inspector').click();await esperar(()=>$('ar-equipo-panel').open);
        check($('ar-equipo-nombre').textContent==='Algodoneros','Información también disponible desde el visor 3D');
        $('ar-equipo-cerrar').click();
        $('btn-tomar-foto').click(); await esperar(()=>$('foto-preview').open);
        const originalBlob=await fetch($('foto-imagen').src).then(r=>r.blob());
        const original=await leerFoto(originalBlob);
        check(original.width>0&&original.height>0&&Math.max(original.width,original.height)<=2048,'Captura real video+WebGL con límite de resolución');
        const colors=new Set();for(let i=0;i<original.data.length;i+=400)colors.add(original.data.slice(i,i+3).join(','));
        check(colors.size>20,'Composición contiene imagen no vacía');
        $('btn-editar-foto').click(); await esperar(()=>!$('foto-editor').hidden&&$('foto-editor-status').textContent.includes('Vista previa'));
        check($('foto-preview').dataset.modo==='editing','Entrada al editor');
        for(const filtro of ['original','vivido','calido','frio','mono','vintage','cine']){
            const boton=doc.querySelector('[data-filtro="'+filtro+'"]');boton.click();
            check(boton.getAttribute('aria-pressed')==='true','Selección filtro '+filtro);
        }
        doc.querySelector('[data-filtro="mono"]').click();
        $('foto-comparar').click();const originalCompare=$('foto-imagen').src;
        check($('foto-comparar').getAttribute('aria-pressed')==='true','Comparar original');
        $('foto-comparar').click();
        $('foto-ajuste').value='70';$('foto-ajuste').dispatchEvent(new win.Event('input',{bubbles:true}));
        check($('foto-ajuste-valor').textContent==='70','Intensidad responde');
        $('foto-ajuste').value='100';$('foto-ajuste').dispatchEvent(new win.Event('input',{bubbles:true}));
        $('foto-editar-confirmar').click(); await esperar(()=>$('foto-preview').dataset.estado==='confirmed'&&$('foto-editor').hidden);
        const confirmedURL=$('foto-imagen').src, editedBlob=await fetch(confirmedURL).then(r=>r.blob()), edited=await leerFoto(editedBlob);
        check(edited.width===original.width&&edited.height===original.height,'Exportación conserva dimensiones');
        let difference=0,grayError=0;for(let i=0;i<edited.data.length;i+=400){difference+=Math.abs(edited.data[i]-original.data[i]);grayError+=Math.abs(edited.data[i]-edited.data[i+1]);}
        check(difference>100,'Exportación contiene filtro en píxeles');check(grayError<edited.data.length/400*4,'Archivo B/N es neutro tras JPEG');
        $('btn-editar-foto').click();await esperar(()=>!$('foto-editor').hidden);
        doc.querySelector('[data-foto-tab="ajustes"]').click();
        for(const ajuste of ['brillo','contraste','saturacion','temperatura']){
            doc.querySelector('[data-foto-ajuste="'+ajuste+'"]').click();$('foto-ajuste').value='30';$('foto-ajuste').dispatchEvent(new win.Event('input',{bubbles:true}));
            check($('foto-ajuste-valor').textContent==='30','Slider '+ajuste);
        }
        $('foto-editar-cancelar').click();check($('foto-imagen').src===confirmedURL,'Cancelar conserva última confirmación');
        $('btn-editar-foto').click();await esperar(()=>!$('foto-editor').hidden);
        $('foto-restablecer').click();$('foto-editar-confirmar').click();await esperar(()=>$('foto-editor').hidden);
        const restored=await fetch($('foto-imagen').src).then(r=>r.arrayBuffer());
        check(restored.byteLength===originalBlob.size,'Restablecer/confirmar recupera original sin doble procesamiento');
        $('btn-editar-foto').click();await esperar(()=>!$('foto-editor').hidden);
        doc.querySelector('[data-foto-tab="ajustes"]').click();doc.querySelector('[data-foto-ajuste="brillo"]').click();
        $('foto-ajuste').value='40';$('foto-ajuste').dispatchEvent(new win.Event('input',{bubbles:true}));
        $('foto-editar-confirmar').click();await esperar(()=>$('foto-editor').hidden);
        const manualBlob=await fetch($('foto-imagen').src).then(r=>r.blob()), manual=await leerFoto(manualBlob);
        let masBrillo=0;for(let i=0;i<manual.data.length;i+=400)masBrillo+=manual.data[i]-original.data[i];
        check(masBrillo>100,'Brillo manual confirmado modifica píxeles exportados');
        $('btn-guardar-foto').click();check($('foto-preview-status').textContent.includes('Descarga iniciada'),'Guardar exporta archivo preparado');
        // Test file-share success, user cancellation and unsupported fallback
        // through the real handler; the OS share sheet itself is not simulated as physical validation.
        let shared;
        Object.defineProperty(win.navigator,'canShare',{configurable:true,value:()=>true});
        Object.defineProperty(win.navigator,'share',{configurable:true,value:async payload=>{shared=payload.files[0];}});
        $('btn-compartir-foto').disabled=false;$('btn-compartir-foto').click();await esperar(()=>!$('btn-cerrar-foto').disabled);
        check(shared?.size===manualBlob.size,'Compartir recibe el archivo editado confirmado');
        Object.defineProperty(win.navigator,'share',{configurable:true,value:async()=>{throw new win.DOMException('Cancelado','AbortError');}});
        $('btn-compartir-foto').click();await esperar(()=>$('foto-preview-status').textContent.includes('No se completó'));
        check($('foto-preview').open,'Cancelar share conserva foto');
        $('btn-cerrar-foto').click();check($('foto-confirmar-descarte').open&&!$('foto-preview').open,'Descarte sin modales anidados');
        $('btn-conservar-foto').click();check($('foto-preview').open,'Conservar vuelve a foto');
        $('btn-cerrar-foto').click();$('btn-confirmar-descarte').click();check(!$('foto-preview').open&&!$('foto-imagen').hasAttribute('src'),'Descartar limpia imagen');
        await esperar(()=>!doc.querySelector('video').paused);await new Promise(r=>setTimeout(r,80));
        $('btn-tomar-foto').click();await esperar(()=>$('foto-preview').open);check($('foto-preview').dataset.estado==='captured','Segunda captura sin estado editado residual');
        $('btn-cerrar-foto').click();$('btn-confirmar-descarte').click();$('btn-cerrar-inspector').click();
        check($('foto-controles').hidden,'Volver al escáner');
        resultados.textContent=`PASS: ${pruebas.length} comprobaciones reales de navegador\n`+pruebas.join('\n');
    }catch(error){resultados.textContent='FAIL: '+error.message+'\nCompletadas: '+pruebas.join(', ');}
    finally { for(const [key,descriptor] of Object.entries(shareDescriptors)) {
        if(descriptor)Object.defineProperty(win.navigator,key,descriptor);else delete win.navigator[key];
    } }
});
document.getElementById('cleanup').addEventListener('click',async()=>{
    const video=visor.contentDocument.querySelector('video'),tracks=video?.srcObject?.getTracks()||[];
    visor.src='/index.html';await esperar(()=>tracks.every(t=>t.readyState==='ended'));
    resultados.textContent='PASS: navegación fuera detuvo '+tracks.length+' pistas de video. Volver crea un contexto nuevo.';
});

// Reproduction control, confined to this local review page.
const ciclos=document.createElement('button'); ciclos.type='button';
ciclos.textContent='Probar ciclos de iframe'; ciclos.id='observer-cycles';
document.getElementById('cleanup').after(ciclos);
ciclos.addEventListener('click',async()=>{
    ciclos.disabled=true; let checks=0;
    const tracks=()=>[...(visor.contentDocument?.querySelector('video')?.srcObject?.getTracks()||[])];
    const listo=()=>visor.contentDocument?.getElementById('ar-status')?.textContent.includes('Apunta');
    const verificar=(condition,label)=>{if(!condition)throw new Error(label);++checks;};
    try{
        for(let i=0;i<5;i++){
            const anteriores=tracks(); visor.src='/__ar?estado=guest&observer_case=reload-'+i;
            await esperar(()=>visor.contentWindow.location.search.includes('reload-'+i)&&listo());
            const doc=visor.contentDocument,win=visor.contentWindow;
            verificar(['foto-preview','foto-confirmar-descarte','ar-equipo-panel'].every(id=>{
                const node=doc.getElementById(id);return node instanceof win.Node&&node.isConnected;
            }),'dialogs must be connected Nodes');
            await esperar(()=>anteriores.every(t=>t.readyState==='ended'));
            verificar(true,'previous tracks ended');
        }
        for(const delay of [0,20,80]){
            visor.src='/__ar?estado=guest&observer_case=cancel-'+delay;
            await new Promise(resolve=>setTimeout(resolve,delay));
            const anteriores=tracks(); visor.src='/index.html';
            await esperar(()=>visor.contentWindow.location.pathname==='/index.html'&&!visor.contentDocument?.querySelector('a-scene'));
            await esperar(()=>anteriores.every(t=>t.readyState==='ended'));
            verificar(true,'cancelled frame releases tracks');
        }
        visor.src='/__ar?estado=guest&observer_case=returned';await esperar(()=>listo());
        verificar(!visor.contentDocument.querySelector('dialog[open]'),'no modal remains open');
        resultados.textContent=`PASS: ${checks} comprobaciones de ciclo; 5 recargas, 3 cancelaciones tempranas y reentrada limpia.`;
    }catch(error){resultados.textContent='FAIL ciclos: '+error.message+'; completadas '+checks;}
    finally{ciclos.disabled=false;}
});
