import { RUTAS, ruta, baseURL } from '../../app/rutas.js';
import { observarEstadoSesion, obtenerEstadoSesion, establecerEstadoSesion } from '../auth/session.js';
import { createGameEngine } from './game-engine.js';
import { validateRules } from './game-state.js';
import { validateArt, preloadSprites } from './game-media.js';
import { installSprites, createGameView, resultPresentation } from './game-view.js';
import { bindBatInput } from './game-input.js';
import { createOfficialEngine } from './game-official.js';
import { getGameServerClient } from '../../api/game-client.js';

const mounts = new WeakMap();
export function iniciarJuego(signal, { clock = {}, fetcher = fetch } = {}) {
    const root = document.getElementById('game-beta');
    if (!root || signal?.aborted) return null;
    if (mounts.has(root)) return mounts.get(root);
    const lifecycle = new AbortController(), options = {signal:lifecycle.signal};
    const $ = id => root.querySelector('#'+id);
    let rules, manifest, sprites=[], engine=null, draw=null, screen='home', stopped=false;
    let user='guest', authenticated=false, completionId=null, starting=false, generation=0, officialRun=false, rewardsAvailable=true;
    const storage = {getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value)};
    const show = next => {
        screen=next; root.dataset.screen=next;
        for (const panel of root.querySelectorAll('[data-game-screen]')) panel.hidden=panel.dataset.gameScreen!==next;
        if(next==='home')$('game-title').focus({preventScroll:true});
        if(next==='result')$('game-result-title').focus({preventScroll:true});
    };
    function access() {
        $('game-day-label').textContent=authenticated?'Reto del día':'Reto de bateo';
        $('game-access-note').textContent=authenticated?(rewardsAvailable?'10 lanzamientos · meta de 5 hits':'Práctica · cupo diario agotado'):'Práctica · sin puntos';
        $('game-start').textContent='Iniciar';
        $('game-start').disabled=!rules||starting;
    }
    function clearNetwork() {
        for(const id of ['game-network-note','game-reconnect','game-demo','game-login'])$(id).hidden=true;
        $('game-reconnect').disabled=false;
    }
    function finish(state) {
        if(completionId===state.id)return;
        completionId=state.id;
        const result=resultPresentation(state);
        $('game-result-label').textContent=state.outcome==='won'?'¡Victoria!':'Derrota';
        $('game-result-rule').textContent=`${state.stats.hits} hits de ${state.stats.resolved} lanzamientos`;
        $('game-account-points').textContent=result.credited===null?'—':`+${result.credited}`;
        $('game-balance').textContent=result.balance===null?'—':result.balance;
        $('game-result-reward').textContent=result.note;
        $('game-result-bonus').hidden=!result.bonus;
        $('game-result-bonus').textContent=result.bonus?`Bonus +${result.bonus} · racha máxima ×${state.stats.bestStreak}`:'';
        $('game-award-toast').hidden=!result.toast;$('game-award-toast').textContent=result.toast||'';
        if(state.official){const auth=obtenerEstadoSesion();if(auth.user?.id===user&&result.balance!==null)establecerEstadoSesion({...auth,profile:{...auth.profile,points_balance:result.balance}});}
        clearNetwork();root.dataset.outcome=state.outcome;show('result');
    }
    async function start({fresh=false,practice=false}={}) {
        if(!rules||stopped||starting||screen==='play')return;
        fresh=fresh||completionId!==null; engine?.destroy();engine=null;draw?.destroy();completionId=null;
        starting=true;const ticket=++generation;const official=authenticated&&!practice;officialRun=official;access();clearNetwork();
        $('game-hit').disabled=true;
        draw=createGameView(root,rules,sprites,manifest);let viewRules=JSON.stringify(rules);
        $('game-session-note').textContent=official?'Partida oficial':'Práctica · sin puntos';
        root.querySelector('[data-game-screen="play"]').setAttribute('aria-label',official?'Partida oficial':'Partida de práctica');
        const onFrame=state=>{if(stopped||ticket!==generation)return;draw(state);if(state.phase==='finished')finish(state);};
        try {
            if(official){
                $('game-network-note').hidden=false;$('game-network-note').textContent='Conectando partida…';
                const api=await getGameServerClient();if(stopped||ticket!==generation)return;
                engine=createOfficialEngine({api,storage,user,mode:'unified',rules,fresh,onFrame,
                    onSnapshot:s=>{if(stopped||ticket!==generation)return;
                        rewardsAvailable=s.rewarded_today<s.daily_limit;
                        $('game-session-note').textContent=!s.rules.economy.enabled?'Práctica · premios desactivados':rewardsAvailable?'Partida oficial':'Práctica · cupo diario agotado';
                        const next=JSON.stringify(s.rules);if(next!==viewRules){draw.destroy();draw=createGameView(root,s.rules,sprites,manifest);viewRules=next;}
                        clearNetwork();
                        if(['expired','abandoned'].includes(s.phase)){show('home');$('game-network-note').hidden=false;$('game-network-note').textContent=s.phase==='expired'?'La partida expiró sin premio. Puedes iniciar otra.':'Partida abandonada sin premio.';}
                    },
                    onError:error=>{if(stopped||ticket!==generation)return;
                        $('game-network-note').hidden=false;$('game-reconnect').hidden=false;
                        if(error.status===401){$('game-reconnect').hidden=true;$('game-login').hidden=false;$('game-network-note').textContent='Tu sesión venció. Inicia sesión para recuperar tu partida.';}
                        else if(error.status===429||String(error.message).includes('latency')){
                            $('game-network-note').textContent=error.status===429?'Límite temporal alcanzado. Puedes practicar sin puntos.':'La conexión es lenta para jugar por puntos. Puedes practicar.';
                            $('game-demo').hidden=false;
                        }else $('game-network-note').textContent='Sin respuesta del servidor. Reintenta para recuperar la partida; su reloj continúa.';
                    }});
            }else engine=createGameEngine({rules,mode:'unified',id:'practice:'+crypto.randomUUID(),...clock,onFrame});
            if(stopped||ticket!==generation)return;
            show('play');const operation=engine.start();if(official)await operation;
            if(!stopped&&ticket===generation&&screen==='play')$('game-field').focus({preventScroll:true});
        }catch(error){
            if(stopped||ticket!==generation)return;
            $('game-network-note').hidden=false;$('game-network-note').textContent='No pudimos conectar. Reintenta para recuperar tu partida.';$('game-reconnect').hidden=false;
        }finally{if(ticket===generation){starting=false;access();}}
    }
    $('game-start').addEventListener('click',()=>start(),options);
    $('game-replay').addEventListener('click',()=>start({fresh:true,practice:!officialRun}),options);
    $('game-demo').addEventListener('click',()=>{engine?.destroy();show('home');void start({practice:true,fresh:true});},options);
    $('game-reconnect').addEventListener('click',async()=>{
        const ticket=generation;$('game-reconnect').disabled=true;
        try{if(engine)await engine.resume();else{show('home');void start();}}
        finally{if(!stopped&&ticket===generation)$('game-reconnect').disabled=false;}
    },options);
    const resumePlay=async()=>{const ticket=generation;await engine?.resume();if(!stopped&&ticket===generation&&screen==='play')$('game-field').focus({preventScroll:true});};
    $('game-pause').addEventListener('click',()=>{if(engine?.state?.phase==='paused')void resumePlay();else void engine?.pause();},options);
    $('game-resume').addEventListener('click',resumePlay,options);
    $('game-exit').addEventListener('click',async()=>{
        const ticket=generation;$('game-exit').disabled=true;
        try{const success=await engine?.abandon();if(stopped||ticket!==generation)return;
            if(success===false&&officialRun)return;
            engine?.destroy();show('home');clearNetwork();access();
        }finally{if(!stopped&&ticket===generation)$('game-exit').disabled=false;}
    },options);
    for(const id of ['game-collection','game-top-collection'])$(id).href=ruta(RUTAS.coleccion);
    $('game-login').href=ruta(RUTAS.login)+'?next='+encodeURIComponent(ruta(RUTAS.juego));
    bindBatInput($('game-hit'),{signal:lifecycle.signal,active:()=>screen==='play',swing:()=>engine?.swing()});
    document.addEventListener('visibilitychange',()=>{if(document.hidden)void engine?.pause();},options);
    window.addEventListener('blur',()=>{if(screen==='play')void engine?.pause();},options);
    document.addEventListener('toggle',event=>{if(screen==='play'&&event.target.matches?.('dialog[open]'))void engine?.pause();},{...options,capture:true});
    const unsubscribe=observarEstadoSesion(auth=>{
        if(auth.cargando)return;
        const next=auth.user?.id||'guest';
        if(next!==user){generation++;engine?.destroy();engine=null;draw?.destroy();draw=null;starting=false;completionId=null;rewardsAvailable=true;$('game-exit').disabled=false;clearNetwork();show('home');user=next;}
        authenticated=Boolean(auth.user);access();
    });
    const ready=(async()=>{
        const load=async path=>{const response=await fetcher(ruta(path),{signal:lifecycle.signal,cache:'no-cache'});if(!response.ok)throw new Error('Resources unavailable');return response.json();};
        try{
            [rules,manifest]=await Promise.all([load('data/game-beta-rules.json'),load('data/game-beta-art.json')]);
            validateRules(rules);if(!rules.modes.unified)throw new Error('Unified rules unavailable');validateArt(manifest);
            sprites=await preloadSprites(manifest,{base:baseURL,signal:lifecycle.signal});if(stopped)return;
            installSprites($('game-batter'),sprites,manifest);
            const missing=sprites.filter(s=>!s.available).length;
            $('game-resource-note').hidden=!missing;$('game-resource-note').textContent=missing?'Faltan dibujos del bateador. Mostramos los disponibles.':'';
            $('game-loading').hidden=true;$('game-loading-error').hidden=true;access();
        }catch(error){if(stopped||error.name==='AbortError')return;$('game-loading').hidden=true;$('game-loading-error').hidden=false;$('game-loading-error').textContent='No pudimos preparar el juego. Recarga para reintentar.';}
    })();
    let preservePageShow=false;
    const restored=event=>{if(event.persisted&&stopped)location.reload();};
    function cleanup(){if(stopped)return;stopped=true;generation++;engine?.destroy();draw?.destroy();unsubscribe();lifecycle.abort();if(!preservePageShow)window.removeEventListener('pageshow',restored);mounts.delete(root);}
    const handle={ready,get state(){return engine?.state||null;},destroy:cleanup};
    mounts.set(root,handle);signal?.addEventListener('abort',cleanup,{once:true});
    window.addEventListener('pagehide',event=>{preservePageShow=event.persisted;cleanup();},options);window.addEventListener('pageshow',restored);
    return handle;
}
