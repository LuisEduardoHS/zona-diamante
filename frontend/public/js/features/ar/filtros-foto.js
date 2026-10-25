export const FILTROS = Object.freeze([
    { id:'original', nombre:'Original' }, { id:'vivido', nombre:'Vívido', contraste:18, saturacion:32 },
    { id:'calido', nombre:'Cálido', temperatura:32, brillo:3 },
    { id:'frio', nombre:'Frío', temperatura:-32, contraste:5 },
    { id:'mono', nombre:'B/N', saturacion:-100, contraste:15 },
    { id:'vintage', nombre:'Vintage', sepia:0.65, contraste:-12, temperatura:12 },
    { id:'cine', nombre:'Cine', contraste:24, saturacion:-26, temperatura:-12 },
]);
export const AJUSTES_INICIALES = Object.freeze({ filtro:'original', intensidad:100, brillo:0, contraste:0, saturacion:0, temperatura:0 });
const limitar = (v,min,max) => Math.min(max,Math.max(min,Number.isFinite(Number(v)) ? Number(v) : 0));
export function normalizarAjustes(value={}) {
    return { filtro:FILTROS.some(f=>f.id===value.filtro) ? value.filtro : 'original',
        intensidad:limitar(value.intensidad ?? 100,0,100),
        ...Object.fromEntries(['brillo','contraste','saturacion','temperatura'].map(k=>[k,limitar(value[k] ?? 0,-100,100)])) };
}

// Pixel transform shared by preview, thumbnails and full-resolution export.
// Always reads immutable original pixels; changing filters never compounds.
export function transformarPixeles(source, value={}, destination=new Uint8ClampedArray(source.length)) {
    const p=normalizarAjustes(value), filtro=FILTROS.find(f=>f.id===p.filtro), intensidad=p.intensidad/100;
    const aplicar=(r,g,b,c,s,t,brillo) => {
        const factor=1+c/100, lum=.2126*r+.7152*g+.0722*b, sat=1+s/100;
        return [((lum+(r-lum)*sat)-127.5)*factor+127.5+brillo*1.5+t*.45,
            ((lum+(g-lum)*sat)-127.5)*factor+127.5+brillo*1.5,
            ((lum+(b-lum)*sat)-127.5)*factor+127.5+brillo*1.5-t*.45];
    };
    const transformar=(r,g,b)=>{
        let [fr,fg,fb]=aplicar(r,g,b,filtro.contraste||0,filtro.saturacion||0,filtro.temperatura||0,filtro.brillo||0);
        if(filtro.sepia) {
            const s=filtro.sepia;
            [fr,fg,fb]=[fr*(1-s)+(r*.393+g*.769+b*.189)*s,fg*(1-s)+(r*.349+g*.686+b*.168)*s,fb*(1-s)+(r*.272+g*.534+b*.131)*s];
        }
        return aplicar(r+(fr-r)*intensidad,g+(fg-g)*intensidad,b+(fb-b)*intensidad,p.contraste,p.saturacion,p.temperatura,p.brillo);
    };
    // Every adjustment is affine. Compose once to avoid millions of temporary
    // arrays/objects per full-resolution image on mobile.
    const base=transformar(0,0,0), rojo=transformar(255,0,0), verde=transformar(0,255,0), azul=transformar(0,0,255);
    const matriz=base.map((offset,c)=>[(rojo[c]-offset)/255,(verde[c]-offset)/255,(azul[c]-offset)/255,offset]);
    for(let i=0;i<source.length;i+=4) {
        const r=source[i],g=source[i+1],b=source[i+2];
        for(let c=0;c<3;c++)destination[i+c]=r*matriz[c][0]+g*matriz[c][1]+b*matriz[c][2]+matriz[c][3];
        destination[i+3]=source[i+3];
    }
    return destination;
}

export async function leerFoto(blob,maxDimension=2048) {
    let imagen, url;
    try {
        if(typeof createImageBitmap==='function') imagen=await createImageBitmap(blob);
        else {
            url=URL.createObjectURL(blob); imagen=new Image(); imagen.src=url;
            await imagen.decode();
        }
        const escala=Math.min(1,maxDimension/Math.max(imagen.width,imagen.height));
        const canvas=document.createElement('canvas');
        canvas.width=Math.max(1,Math.round(imagen.width*escala)); canvas.height=Math.max(1,Math.round(imagen.height*escala));
        const ctx=canvas.getContext('2d',{willReadFrequently:true});
        if(!ctx) throw new Error('No se pudo preparar el editor de fotos.');
        ctx.drawImage(imagen,0,0,canvas.width,canvas.height);
        const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
        canvas.width=canvas.height=0;
        return pixels;
    } finally { imagen?.close?.(); if(url) URL.revokeObjectURL(url); }
}

export async function exportarFoto(original,parametros,{signal}={}) {
    const {width,height,data}=original;
    if(signal?.aborted) throw new DOMException('Edición cancelada','AbortError');
    const destino=new Uint8ClampedArray(data.length);
    // Yield between blocks so a large export doesn't freeze mobile controls.
    const bloque=width*4*48;
    for(let inicio=0;inicio<data.length;inicio+=bloque) {
        if(signal?.aborted) throw new DOMException('Edición cancelada','AbortError');
        transformarPixeles(data.subarray(inicio,inicio+bloque),parametros,destino.subarray(inicio,inicio+bloque));
        await new Promise(resolve=>setTimeout(resolve,0));
    }
    const canvas=document.createElement('canvas'); canvas.width=width; canvas.height=height;
    try {
        const ctx=canvas.getContext('2d');
        if(!ctx) throw new Error('No se pudo exportar la foto.');
        ctx.putImageData(new ImageData(destino,width,height),0,0);
        const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b ? resolve(b) : reject(new Error('No se pudo crear la imagen editada.')),'image/jpeg',.94));
        if(signal?.aborted) throw new DOMException('Edición cancelada','AbortError');
        return blob;
    } finally { canvas.width=canvas.height=0; }
}
