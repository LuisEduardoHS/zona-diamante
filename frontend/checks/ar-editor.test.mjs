import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const cargar=async path=>import('data:text/javascript;base64,'+Buffer.from(await readFile(new URL(path,import.meta.url),'utf8')).toString('base64'));
const {FILTROS,AJUSTES_INICIALES,transformarPixeles,normalizarAjustes,exportarFoto}=await cargar('../public/js/features/ar/filtros-foto.js');
const original=new Uint8ClampedArray([50,100,180,255,200,70,25,128,30,210,100,255]);

test('Original conserva exactamente los píxeles y el alfa sin modificar la fuente',()=>{
    const copia=original.slice();
    assert.deepEqual(transformarPixeles(original),original);
    assert.deepEqual(original,copia);
});
test('los siete filtros producen resultados diferentes y reproducibles desde el original',()=>{
    const resultados=FILTROS.map(f=>Array.from(transformarPixeles(original,{filtro:f.id})).join(','));
    assert.equal(new Set(resultados).size,7);
    for(const filtro of FILTROS) assert.deepEqual(transformarPixeles(original,{filtro:filtro.id}),transformarPixeles(original,{filtro:filtro.id}));
});
test('intensidad cero elimina el filtro sin acumular efectos',()=>{
    for(const filtro of FILTROS)assert.deepEqual(transformarPixeles(original,{filtro:filtro.id,intensidad:0}),original);
    assert.deepEqual(transformarPixeles(original,AJUSTES_INICIALES),original);
});
for(const ajuste of ['brillo','contraste','saturacion','temperatura']) test(`ajuste ${ajuste} modifica píxeles en ambos sentidos`,()=>{
    assert.notDeepEqual(transformarPixeles(original,{[ajuste]:50}),original);
    assert.notDeepEqual(transformarPixeles(original,{[ajuste]:-50}),original);
    assert.notDeepEqual(transformarPixeles(original,{[ajuste]:50}),transformarPixeles(original,{[ajuste]:-50}));
});
test('blanco y negro es neutro y los filtros preservan transparencia',()=>{
    const resultado=transformarPixeles(original,{filtro:'mono'});
    for(let i=0;i<resultado.length;i+=4) { assert.equal(resultado[i],resultado[i+1]); assert.equal(resultado[i],resultado[i+2]); assert.equal(resultado[i+3],original[i+3]); }
});
test('entradas inválidas se normalizan sin NaN ni valores fuera de rango',()=>{
    assert.deepEqual(normalizarAjustes({filtro:'<script>',intensidad:999,brillo:NaN,contraste:-999,temperatura:Infinity}),
        {...AJUSTES_INICIALES,intensidad:100,contraste:-100});
});
test('exportación cancelada no crea un canvas ni un archivo',async()=>{
    const controller=new AbortController(); controller.abort();
    await assert.rejects(exportarFoto({width:1,height:1,data:original.slice(0,4)},{},{signal:controller.signal}),{name:'AbortError'});
});

const contextoSource=(await readFile(new URL('../public/js/features/ar/contexto-equipo.js',import.meta.url),'utf8'))
    .replace(/^import .*$/mg,'');
const {crearContextoEquipo,EQUIPOS_MARCADOR}=await import('data:text/javascript;base64,'+Buffer.from(contextoSource).toString('base64'));
test('marcadores coinciden exactamente con los IDs del carrusel',async()=>{
    const equipos=JSON.parse(await readFile(new URL('../public/data/equipos.json',import.meta.url),'utf8'));
    assert.equal(EQUIPOS_MARCADOR.length,4);
    for(const id of EQUIPOS_MARCADOR)assert.ok(equipos.some(e=>e.id===id));
});
test('el panel conserva su equipo al perder, recuperar o cambiar marcador',()=>{
    const contexto=crearContextoEquipo();
    contexto.detectar(3); assert.equal(contexto.abrir(),'sultanes-mty');
    contexto.detectar(null); assert.equal(contexto.lectura,'sultanes-mty');
    contexto.detectar(1); assert.equal(contexto.lectura,'sultanes-mty');
    contexto.cerrar(); assert.equal(contexto.lectura,null); assert.equal(contexto.abrir(),'charros-jal');
});
test('marcadores inválidos no seleccionan un equipo',()=>{
    const contexto=crearContextoEquipo(); for(const index of [-1,4,null,undefined,'invalid']) { contexto.detectar(index); assert.equal(contexto.actual,null); }
});

const {crearCargaModelo}=await cargar('../public/js/features/ar/carga-modelo.js');
test('una carga 3D anterior no sustituye al equipo más reciente',async()=>{
    const resolver={},aplicados=[];
    const loader=crearCargaModelo({cargar:ruta=>new Promise(resolve=>{resolver[ruta]=resolve;}),aplicar:(modelo,index)=>aplicados.push([modelo,index]),error:()=>assert.fail('unexpected load error')});
    const uno=loader.solicitar(0,'one'),dos=loader.solicitar(1,'two');await Promise.resolve();
    resolver.two('Charros');await dos;resolver.one('Algodoneros');await uno;
    assert.deepEqual(aplicados,[['Charros',1]]);
});
test('volver a un equipo pendiente comparte carga y aplica una sola vez',async()=>{
    const resolver={},aplicados=[],llamadas=[];
    const loader=crearCargaModelo({cargar:ruta=>{llamadas.push(ruta);return new Promise(resolve=>{resolver[ruta]=resolve;});},aplicar:m=>aplicados.push(m),error:()=>{}});
    const first=loader.solicitar(0,'one'),second=loader.solicitar(1,'two'),third=loader.solicitar(0,'one');await Promise.resolve();
    resolver.one('Algodoneros');await Promise.all([first,third]);resolver.two('Charros');await second;
    assert.deepEqual(llamadas,['one','two']);assert.deepEqual(aplicados,['Algodoneros']);
});
test('salir durante una carga libera el modelo y no lo muestra',async()=>{
    let resolver;const liberados=[];
    const loader=crearCargaModelo({cargar:()=>new Promise(r=>{resolver=r;}),aplicar:()=>assert.fail('must not display'),error:()=>{},liberar:m=>liberados.push(m)});
    const pending=loader.solicitar(0,'one');await Promise.resolve();loader.destruir();resolver('mesh');await pending;
    assert.deepEqual(liberados,['mesh']);
});
test('regresar al modelo actual invalida una carga de otro equipo aún pendiente',async()=>{
    let resolver;const aplicados=[];
    const loader=crearCargaModelo({cargar:()=>new Promise(r=>{resolver=r;}),aplicar:m=>aplicados.push(m),error:()=>{}});
    const pending=loader.solicitar(1,'charros');await Promise.resolve();loader.cancelar();resolver('Charros');await pending;
    assert.deepEqual(aplicados,[]);
});
const {detenerRecursosAR}=await cargar('../public/js/features/ar/recursos-ar.js');
test('salir antes de recibir cámara invalida el video pendiente sin llamar stop inseguro',()=>{
    let removido=false,renderer=false;
    const sistema={video:{remove(){removido=true;}},stop(){assert.fail('not initialized');}};
    detenerRecursosAR({systems:{'mindar-image-system':sistema},renderer:{dispose(){renderer=true;}}});
    assert.equal(sistema.video,null);assert.ok(removido&&renderer);
});
test('un fallo de stop no impide apagar pistas, liberar controlador y renderer',()=>{
    const liberados=[];
    const sistema={controller:{dispose(){liberados.push('controller');}},video:{srcObject:{getTracks:()=>[{stop(){liberados.push('track');}}]},remove(){liberados.push('video');}},stop(){throw new Error('partially initialized');}};
    detenerRecursosAR({systems:{'mindar-image-system':sistema},renderer:{dispose(){liberados.push('renderer');}}});
    assert.deepEqual(liberados,['controller','track','video','renderer']);assert.equal(sistema.video,null);
});
test('salir con cámara lista usa la parada del sistema sin disponer el controlador dos veces',()=>{
    let stops=0;
    const sistema={controller:{dispose(){assert.fail('already stopped');}},video:{srcObject:{getTracks:()=>[]},remove(){}},stop(){stops++;}};
    detenerRecursosAR({systems:{'mindar-image-system':sistema}});assert.equal(stops,1);assert.equal(sistema.video,null);
});
