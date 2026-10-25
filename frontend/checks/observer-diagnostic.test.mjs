import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const script=await readFile(new URL('./observer-diagnostic.js',import.meta.url),'utf8');
function entorno(){
    const events={},records=[],warnings=[];
    const nativeError=new TypeError('parameter 1 is not of type Node');
    class NativeObserver{
        observe(target){if(!target?.nodeType)throw nativeError;return 'native-result';}
    }
    const window={addEventListener:(name,fn)=>{events[name]=fn;}};window.parent=window;
    const context=vm.createContext({window,MutationObserver:NativeObserver,
        location:{href:'http://127.0.0.1:4176/__ar'},document:{readyState:'loading'},
        fetch:async(path,options)=>{records.push(JSON.parse(options.body));},
        console:{warn:(...args)=>warnings.push(args)},Date,Error,Reflect,JSON});
    vm.runInContext(script,context);
    return{events,records,warnings,NativeObserver,nativeError};
}
test('diagnóstico devuelve el resultado nativo sin bloquear observación válida',()=>{
    const e=entorno(),node={nodeType:1,id:'foto-preview',isConnected:true};
    assert.equal(new e.NativeObserver().observe(node,{}),'native-result');
    assert.equal(e.records.at(-1).kind,'observe-ok');
    assert.equal(e.records.at(-1).target.id,'foto-preview');
});
test('un target inválido conserva y vuelve a lanzar exactamente la excepción nativa',()=>{
    const e=entorno();assert.throws(()=>new e.NativeObserver().observe(null,{}),error=>error===e.nativeError);
    assert.equal(e.records.at(-1).kind,'observe-error');
    assert.match(e.records.at(-1).error,/TypeError/);assert.ok(e.records.at(-1).stack);
});
test('se registran errores globales sin preventDefault ni supresión de consola',()=>{
    const e=entorno();const event={message:'failed',filename:'camera.js',lineno:7,colno:4,error:new Error('failed'),preventDefault(){assert.fail('must never suppress');}};
    e.events.error(event);assert.equal(e.records.at(-1).kind,'window-error');assert.equal(e.records.at(-1).filename,'camera.js');
});
test('se registran rechazos de promesa sin consumirlos',()=>{
    const e=entorno();e.events.unhandledrejection({reason:new Error('rejected'),preventDefault(){assert.fail('must not suppress');}});
    assert.equal(e.records.at(-1).kind,'unhandled-rejection');assert.match(e.records.at(-1).message,/rejected/);
});
