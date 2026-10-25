import { FILTROS, AJUSTES_INICIALES, normalizarAjustes, leerFoto, exportarFoto, transformarPixeles } from './filtros-foto.js';

export function iniciarEditorFoto({ imagen, alConfirmar, mostrarConfirmada }) {
    const $=id=>document.getElementById(id);
    const dialogo=$('foto-preview'), panel=$('foto-editor'), abrir=$('btn-editar-foto');
    const tira=$('foto-filtros'), slider=$('foto-ajuste'), valor=$('foto-ajuste-valor'), etiqueta=$('foto-ajuste-label');
    const estado=$('foto-editor-status'), confirmar=$('foto-editar-confirmar');
    const comparar=$('foto-comparar');
    let original=null, originalURL=null, previewURL=null, pixels=null;
    let confirmados={...AJUSTES_INICIALES}, borrador={...confirmados};
    let editando=false, ocupado=false, comparando=false, herramienta='intensidad';
    let versionFoto=0, versionPreview=0, controlador=null, exportacion=null, frame=null;
    const miniaturas=new Map();
    for(const filtro of FILTROS) {
        const boton=document.createElement('button'); boton.type='button'; boton.dataset.filtro=filtro.id;
        const img=document.createElement('img'); img.alt='';
        const nombre=document.createElement('span'); nombre.textContent=filtro.nombre;
        boton.append(img,nombre); tira.append(boton); miniaturas.set(filtro.id,img);
        boton.addEventListener('click',()=>{ if(ocupado)return; borrador.filtro=filtro.id; actualizar(); programar(); });
    }
    const cancelarPreview=()=>{ ++versionPreview; controlador?.abort(); if(frame!==null)cancelAnimationFrame(frame); frame=null; };
    const actualizar=()=>{
        panel.hidden=!editando; dialogo.dataset.modo=editando ? 'editing' : 'preview';
        $('foto-titulo').textContent=editando ? 'Edita tu foto' : 'Tu momento 3D';
        $('btn-cerrar-foto').setAttribute('aria-label',editando ? 'Cancelar edición' : 'Cerrar vista previa');
        for(const boton of tira.querySelectorAll('button')) boton.setAttribute('aria-pressed',String(boton.dataset.filtro===borrador.filtro));
        for(const boton of document.querySelectorAll('[data-foto-ajuste]')) boton.setAttribute('aria-pressed',String(boton.dataset.fotoAjuste===herramienta));
        slider.min=herramienta==='intensidad' ? '0' : '-100'; slider.max='100'; slider.value=borrador[herramienta];
        valor.textContent=String(borrador[herramienta]);
        etiqueta.textContent=({intensidad:'Intensidad',brillo:'Brillo',contraste:'Contraste',saturacion:'Saturación',temperatura:'Temperatura'})[herramienta];
        for(const control of panel.querySelectorAll('button,input')) control.disabled=ocupado && control.id!=='foto-editar-cancelar';
        comparar.setAttribute('aria-pressed',String(comparando));
        comparar.textContent=comparando ? 'Volver a edición' : 'Ver original';
    };
    const programar=()=>{
        cancelarPreview();
        const solicitud=versionPreview;
        if(!pixels || !editando)return;
        frame=requestAnimationFrame(async()=>{
            frame=null; controlador=new AbortController();
            try {
                const blob=await exportarFoto(pixels,borrador,{signal:controlador.signal});
                if(solicitud!==versionPreview || !editando)return;
                if(previewURL)URL.revokeObjectURL(previewURL);
                previewURL=URL.createObjectURL(blob);
                if(!comparando)imagen.src=previewURL;
                estado.textContent='Vista previa · los cambios se guardan al confirmar.';
            } catch(error) { if(error.name!=='AbortError')estado.textContent='No pudimos actualizar la vista previa. Inténtalo de nuevo.'; }
        });
    };
    const generarMiniaturas=()=>{
        const base=document.createElement('canvas'); base.width=pixels.width; base.height=pixels.height;
        base.getContext('2d').putImageData(pixels,0,0);
        const mini=document.createElement('canvas'); mini.width=60; mini.height=80;
        const ctx=mini.getContext('2d'); ctx.drawImage(base,0,0,60,80);
        const fuente=ctx.getImageData(0,0,60,80);
        for(const f of FILTROS) {
            ctx.putImageData(new ImageData(transformarPixeles(fuente.data,{filtro:f.id}),60,80),0,0);
            miniaturas.get(f.id).src=mini.toDataURL('image/jpeg',.7);
        }
        base.width=base.height=mini.width=mini.height=0;
    };
    const cancelar=()=>{
        cancelarPreview(); exportacion?.abort(); ocupado=false; editando=false; comparando=false;
        borrador={...confirmados}; actualizar(); mostrarConfirmada(); abrir.focus();
    };
    abrir.addEventListener('click',async()=>{
        if(!original || editando)return;
        const foto=versionFoto;
        editando=true; comparando=false; borrador={...confirmados}; actualizar();
        estado.textContent='Preparando el editor…';
        try {
            const fuente=pixels || await leerFoto(original,640);
            if(foto!==versionFoto || !editando)return;
            pixels=fuente; generarMiniaturas(); programar(); slider.focus();
        } catch { if(foto===versionFoto)estado.textContent='No pudimos abrir la foto. Cancela e inténtalo de nuevo.'; }
    });
    for(const tab of document.querySelectorAll('[data-foto-tab]')) tab.addEventListener('click',()=>{
        const filtros=tab.dataset.fotoTab==='filtros';
        $('foto-filtros').hidden=!filtros; $('foto-ajustes-manuales').hidden=filtros;
        herramienta=filtros ? 'intensidad' : 'brillo';
        for(const item of document.querySelectorAll('[data-foto-tab]'))item.setAttribute('aria-pressed',String(item===tab));
        actualizar();
    });
    for(const boton of document.querySelectorAll('[data-foto-ajuste]')) boton.addEventListener('click',()=>{
        herramienta=boton.dataset.fotoAjuste;
        for(const item of document.querySelectorAll('[data-foto-ajuste]'))item.setAttribute('aria-pressed',String(item===boton));
        actualizar();
    });
    slider.addEventListener('input',()=>{ borrador[herramienta]=Number(slider.value); actualizar(); programar(); });
    comparar.addEventListener('click',()=>{
        comparando=!comparando; imagen.src=comparando ? originalURL : (previewURL || originalURL); actualizar();
    });
    $('foto-restablecer').addEventListener('click',()=>{ borrador={...AJUSTES_INICIALES}; comparando=false; actualizar(); programar(); });
    $('foto-editar-cancelar').addEventListener('click',cancelar);
    confirmar.addEventListener('click',async()=>{
        if(!original || ocupado)return;
        const foto=versionFoto, ajustes=normalizarAjustes(borrador);
        cancelarPreview(); ocupado=true; actualizar(); estado.textContent='Aplicando a la foto completa…';
        exportacion=new AbortController(); const signal=exportacion.signal;
        try {
            const sinCambios=ajustes.filtro==='original' && ['brillo','contraste','saturacion','temperatura'].every(k=>ajustes[k]===0);
            const resultado=sinCambios ? original : await exportarFoto(await leerFoto(original),ajustes,{signal});
            if(signal.aborted || foto!==versionFoto || !editando)return;
            alConfirmar(new File([resultado],original.name,{type:resultado.type}));
            confirmados=ajustes; editando=false; comparando=false; mostrarConfirmada();
            abrir.focus();
        } catch(error) { if(error.name!=='AbortError')estado.textContent='No pudimos confirmar la edición. La foto anterior sigue disponible.'; }
        finally { if(foto===versionFoto) { ocupado=false; actualizar(); } }
    });
    const limpiar=()=>{
        ++versionFoto; cancelarPreview(); exportacion?.abort(); original=null; pixels=null;
        for(const url of [originalURL,previewURL])if(url)URL.revokeObjectURL(url);
        originalURL=previewURL=null; editando=ocupado=comparando=false;
        confirmados={...AJUSTES_INICIALES}; borrador={...confirmados};
        for(const img of miniaturas.values())img.removeAttribute('src');
        herramienta='intensidad'; $('foto-filtros').hidden=false; $('foto-ajustes-manuales').hidden=true;
        for(const tab of document.querySelectorAll('[data-foto-tab]'))tab.setAttribute('aria-pressed',String(tab.dataset.fotoTab==='filtros'));
        actualizar(); estado.textContent='';
    };
    window.addEventListener('pagehide',limpiar,{once:true});
    return { get editando(){return editando;}, cancelar, limpiar,
        cargar(archivo) { limpiar(); original=archivo; originalURL=URL.createObjectURL(archivo); } };
}
