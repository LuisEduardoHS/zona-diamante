import { RUTAS, ruta, baseURL } from '../../app/rutas.js';
import { observarEstadoSesion, obtenerEstadoSesion, establecerEstadoSesion } from '../auth/session.js';
import { createGameEngine } from './game-engine.js';
import { validateRules } from './game-state.js';
import { validateArt, preloadSprites } from './game-media.js';
import { installSprites, createGameView } from './game-view.js';
import { bindBatInput } from './game-input.js';
import { createPracticeSession, practiceRecords } from './game-session.js';
import { createOfficialEngine, officialJournal } from './game-official.js';
import { getGameServerClient } from '../../api/game-client.js';

const mounts = new WeakMap();
export function iniciarJuego(signal, { clock = {}, fetcher = fetch } = {}) {
    const root = document.getElementById('game-beta');
    if (!root || signal?.aborted) return null;
    if (mounts.has(root)) return mounts.get(root);
    const lifecycle = new AbortController(), options = {signal:lifecycle.signal};
    const $ = id => root.querySelector('#'+id);
    let rules, manifest, sprites = [], engine = null, mode = 'classic', screen = 'home', stopped = false;
    let user = 'guest', authenticated = false, pendingAction = null, completionId = null, starting = false, generation = 0, officialRun=false, confirming=false;
    const adapter = createPracticeSession();
    const storage = {getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value)};
    let records = practiceRecords(storage,user);
    const show = next => {
        screen = next; root.dataset.screen = next;
        for (const panel of root.querySelectorAll('[data-game-screen]')) panel.hidden = panel.dataset.gameScreen !== next;
        if (next !== 'play') $('game-title').focus({preventScroll:true});
        if(rules)modeInfo();
    };
    function modeInfo() {
        if (!rules) return;
        const m = rules.modes[mode];
        $('game-classic-goal').textContent = `${rules.modes.classic.maxPitches} lanzamientos · ${rules.modes.classic.targetHits} bateos para ganar`;
        $('game-streak-goal').textContent = `${rules.modes.streak.targetStreak} bateos consecutivos · hasta ${rules.modes.streak.maxPitches} lanzamientos`;
        $('game-help-score').textContent = `Bateo válido: ${rules.scoring.hit} puntos de partida. Perfecto: ${rules.scoring.perfect}. Fallo: ${rules.scoring.miss}.`;
        $('game-record-mode').textContent = m.name;
        $('game-start').textContent = `${authenticated?'Jugar oficial':'Comenzar'} ${m.name}`;
        let recovering=false;
        try{recovering=authenticated&&completionId===null&&Boolean(officialJournal(storage,user).read()?.id);}catch{}
        if(recovering)$('game-start').textContent='Recuperar última partida';
        $('game-mode-description').textContent = mode === 'classic' ? `${m.maxPitches} lanzamientos. Gana con al menos ${m.targetHits} bateos al terminar.` : `Hasta ${m.maxPitches} lanzamientos. Consigue ${m.targetStreak} bateos seguidos; cada fallo reinicia la racha.`;
        const old = records.read(mode);
        $('game-record-score').textContent = old.score; $('game-record-streak').textContent = old.streak;
        $('game-planned-rewards').hidden = !authenticated;
        const economics=rules.economy;
        $('game-planned-rewards').textContent = authenticated ? `Partida oficial: ${economics.completion} puntos al completar con al menos 3 bateos intentados. Victoria: ${economics.completion+(mode==='classic'?economics.classicBonus:economics.streakBonus)} puntos en total. Máximo ${economics.dailyRewardedGames} partidas premiadas al día; puedes seguir jugando después. El servidor confirma cada resultado.` : '';
        const officialScreen=['play','result'].includes(screen)?officialRun:authenticated;
        $('game-practice-badge').textContent = officialScreen?'BETA · OFICIAL':'BETA · PRÁCTICA';
        root.querySelector('[data-game-screen="play"]').setAttribute('aria-label',officialScreen?'Partida oficial':'Partida de práctica');
        $('game-home-session').textContent=authenticated?'Sesión iniciada · partidas oficiales disponibles':'Práctica local · sin puntos de cuenta';
        $('game-help-context').textContent=officialScreen?'En oficial, sólo los resultados y puntos confirmados por el servidor son definitivos.':'Práctica local: el resultado y el récord de este dispositivo no acreditan puntos de cuenta.';
        $('game-access-note').textContent = recovering?'Se recuperará la última partida y su modalidad. Después podrás volver a jugar o cambiar de modalidad.':authenticated?'Partidas oficiales con puntos confirmados por el servidor.':'Esta demostración no entrega puntos ni cartas. Inicia sesión para jugar por puntos.';
        $('game-login').hidden = authenticated;
        $('game-demo').hidden = !authenticated;
        $('game-help-official').hidden = !officialScreen;
        root.querySelectorAll('[data-mode]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.mode === mode)));
    }
    function finish(state) {
        if (completionId === state.id) return;
        completionId = state.id;
        const result = state.official ? state.serverResult : adapter.complete(state);
        if (!state.official && result.reward.status !== 'unavailable') throw new Error('Unexpected practice reward');
        records.save(mode,state.stats);
        $('game-result-title').textContent = state.outcome === 'won' ? '¡Buen turno, victoria!' : 'El próximo turno es tuyo';
        $('game-result-label').textContent = state.outcome === 'won' ? 'OBJETIVO CONSEGUIDO' : 'PARTIDA TERMINADA · DERROTA';
        $('game-final-score').textContent = state.stats.score;
        $('game-final-hits').textContent = state.stats.hits;
        $('game-final-misses').textContent = state.stats.misses;
        $('game-final-streak').textContent = state.stats.bestStreak;
        $('game-final-perfects').textContent = state.stats.perfects;
        $('game-result-rule').textContent = mode === 'classic' ? `${state.stats.hits} de ${rules.modes.classic.targetHits} bateos necesarios, en ${state.stats.resolved} lanzamientos.` : `Mejor racha: ${state.stats.bestStreak} de ${rules.modes.streak.targetStreak}, en ${state.stats.resolved} lanzamientos.`;
        $('game-account-points').textContent = state.official ? `Puntos de cuenta · +${result.reward.points_awarded}` : 'Puntos de cuenta · —';
        $('game-result-reward').textContent = !state.official ? 'No disponible · práctica local. Esta partida no modifica tu saldo ni entrega cartas.'
            : result.reward.status==='confirmed' ? `Recompensa confirmada. Saldo: ${result.points_balance} puntos. ${result.rewarded_today} de ${result.daily_limit} partidas premiadas hoy.`
            : result.reward.status==='daily_limit' ? `Límite diario alcanzado. Sin nuevo crédito. Saldo: ${result.points_balance}. Puedes seguir jugando.`
            : result.reward.status==='disabled' ? `Recompensas temporalmente desactivadas. Saldo: ${result.points_balance}.`
            : `Sin premio: se requieren al menos 3 intentos de bateo. Saldo: ${result.points_balance}.`;
        if(state.official){const auth=obtenerEstadoSesion();if(auth.user?.id===user)establecerEstadoSesion({...auth,profile:{...auth.profile,points_balance:result.points_balance}});}
        for(const dialog of root.querySelectorAll('dialog[open]'))dialog.close();
        root.dataset.outcome = state.outcome;
        modeInfo(); show('result');
    }
    async function start({fresh=false,practice=false}={}) {
        if (!rules || stopped || starting) return;
        if (screen === 'play' && engine?.state.phase !== 'finished' && pendingAction !== 'restart') return;
        fresh=fresh||completionId!==null;engine?.destroy(); completionId = null;starting=true;const ticket=++generation;
        const official=authenticated&&!practice;officialRun=official;$('game-hit').disabled=true;
        let draw = createGameView(root,rules,sprites,manifest);
        const onFrame=state=>{if(stopped||ticket!==generation)return;draw(state);if(state.phase==='finished')finish(state);};
        try{
            if(official){
                $('game-network-note').hidden=false;$('game-network-note').textContent='Conectando con la partida oficial…';
                const api=await getGameServerClient();if(stopped||ticket!==generation)return;
                engine=createOfficialEngine({api,storage,user,mode,rules,fresh,onFrame,
                    onSnapshot:s=>{if(stopped||ticket!==generation)return;mode=s.mode;rules=s.rules;draw=createGameView(root,rules,sprites,manifest);modeInfo();
                        $('game-network-note').hidden=true;$('game-reconnect').hidden=true;
                        if(['expired','abandoned'].includes(s.phase)){show('home');$('game-network-note').hidden=false;$('game-network-note').textContent=s.phase==='expired'?'La partida expiró sin premio. Puedes comenzar otra.':'Partida abandonada sin premio.';}},
                    onError:error=>{if(stopped||ticket!==generation)return;$('game-network-note').hidden=false;
                        $('game-reconnect').hidden=false;
                        if(error.status===401){$('game-reconnect').hidden=true;$('game-login').hidden=false;$('game-login').textContent='Volver a iniciar sesión';$('game-network-note').textContent='Tu sesión venció. Inicia sesión de nuevo para recuperar esta partida y cualquier premio confirmado.';show('modes');$('game-login').hidden=false;}
                        else if(error.status===429){$('game-network-note').textContent='Alcanzaste el límite temporal de solicitudes. Puedes practicar sin puntos o intentarlo después.';show('modes');}
                        else if(String(error.message).includes('latency')){const note='La conexión supera el límite de latencia para jugar por puntos. Puedes practicar sin puntos o intentarlo cuando mejore.';$('game-network-note').textContent=note;show('modes');void engine.abandon().then(()=>{if(!stopped&&ticket===generation){show('modes');$('game-network-note').hidden=false;$('game-network-note').textContent=note;}});}
                        else $('game-network-note').textContent='No pudimos confirmar la operación oficial. Reintenta la conexión para recuperar el estado. El tiempo del servidor sigue corriendo; no se inventó un premio.';}});
            }else{const session=adapter.start(mode);engine=createGameEngine({rules,mode,id:session.id,...clock,onFrame});}
            if(stopped||ticket!==generation)return;
            show('play');modeInfo();const operation=engine.start();if(official)await operation;if(!stopped&&ticket===generation)$('game-field').focus({preventScroll:true});
        }catch(error){if(stopped||ticket!==generation)return;$('game-network-note').hidden=false;$('game-network-note').textContent='No pudimos conectar la partida. Recarga para recuperar el estado oficial.';}
        finally{if(ticket===generation)starting=false;}
    }
    async function requestConfirmation(action) {
        if(stopped||confirming)return;
        if (!engine || screen !== 'play') { if(action === 'exit')show('home'); return; }
        const ticket=generation;confirming=true;
        try{const operation=engine.pause();if(engine.state?.official)await operation;
        if(stopped||ticket!==generation||!root.isConnected)return;pendingAction = action;
        // The clock sync in pause can finish the last feedback frame.
        if (screen !== 'play') { pendingAction = null; return; }
        $('game-confirm-title').textContent = action === 'restart' ? '¿Empezar de nuevo?' : '¿Salir de este turno?';
        $('game-confirm-copy').textContent = officialRun?'Abandonarás esta partida oficial sin premio si aún no estaba finalizada. Si no hay conexión, sólo podrás cerrar la vista y recuperar después.':'Se perderá el progreso de esta partida de práctica.';
        if(!$('game-confirm').open)$('game-confirm').showModal();
        }finally{if(ticket===generation)confirming=false;}
    }
    $('game-play').addEventListener('click',()=>show('modes'),options);
    for (const button of root.querySelectorAll('[data-mode]')) button.addEventListener('click',()=>{mode=button.dataset.mode;modeInfo();},options);
    $('game-start').addEventListener('click',start,options);
    $('game-demo').addEventListener('click',()=>start({practice:true,fresh:true}),options);
    $('game-reconnect').addEventListener('click',async()=>{const ticket=generation;$('game-reconnect').disabled=true;try{await engine?.resume();}finally{if(!stopped&&ticket===generation)$('game-reconnect').disabled=false;}},options);
    $('game-replay').addEventListener('click',()=>start({fresh:true,practice:!officialRun}),options);
    $('game-change-mode').addEventListener('click',()=>show('modes'),options);
    $('game-result-home').addEventListener('click',()=>show('home'),options);
    $('game-back').addEventListener('click',()=>show('home'),options);
    $('game-pause').addEventListener('click',()=>{if(engine?.state.phase==='paused')engine.resume();else engine?.pause();},options);
    $('game-resume').addEventListener('click',()=>engine?.resume(),options);
    $('game-restart').addEventListener('click',()=>requestConfirmation('restart'),options);
    $('game-exit').addEventListener('click',()=>requestConfirmation('exit'),options);
    $('game-confirm-no').addEventListener('click',()=>$('game-confirm').close(),options);
    $('game-confirm').addEventListener('close',()=>{pendingAction=null;},options); // Cancel stays safely paused.
    $('game-confirm-yes').addEventListener('click',async()=>{
        const action = pendingAction;if(!action||$('game-confirm-yes').disabled)return;const ticket=generation;$('game-confirm-yes').disabled=true;
        const operation=engine?.abandon();const abandoned=engine.state?.official?await operation:operation;
        if(stopped||ticket!==generation)return;$('game-confirm-yes').disabled=false;
        if(abandoned===false&&officialRun){engine.destroy();$('game-confirm').close();show('home');return;}
        if (action === 'restart') void start({fresh:true,practice:!officialRun}); else show('home');
        $('game-confirm').close();
    },options);
    for (const button of root.querySelectorAll('[data-help]')) button.addEventListener('click',()=>{
        engine?.pause(); $('game-help').showModal();
    },options);
    $('game-help-close').addEventListener('click',()=>$('game-help').close(),options);
    $('game-collection').href = ruta(RUTAS.coleccion);
    $('game-login').href=ruta(RUTAS.login)+'?next='+encodeURIComponent(ruta(RUTAS.juego));
    bindBatInput($('game-hit'),{signal:lifecycle.signal,active:()=>screen==='play',swing:()=>engine?.swing()});
    document.addEventListener('visibilitychange',()=>{if(document.hidden)engine?.pause();},options);
    const unsubscribe = observarEstadoSesion(auth=>{
        if(auth.cargando)return;
        const next = auth.user?.id || 'guest';
        if(next!==user){generation++;engine?.destroy();engine=null;starting=false;confirming=false;pendingAction=null;$('game-confirm-yes').disabled=false;$('game-reconnect').disabled=false;$('game-reconnect').hidden=true;for(const dialog of root.querySelectorAll('dialog[open]'))dialog.close();show('home');user=next;records=practiceRecords(storage,user);}
        authenticated=Boolean(auth.user);modeInfo();
    });
    const ready = (async()=>{
        const load = async path=>{
            const response=await fetcher(ruta(path),{signal:lifecycle.signal,cache:'no-cache'});
            if(!response.ok)throw new Error('No pudimos cargar los recursos del juego.');return response.json();
        };
        try {
            [rules,manifest]=await Promise.all([load('data/game-beta-rules.json'),load('data/game-beta-art.json')]);
            validateRules(rules);validateArt(manifest);
            sprites=await preloadSprites(manifest,{base:baseURL,signal:lifecycle.signal});
            if(stopped)return;
            installSprites($('game-batter'),sprites,manifest);
            const available=sprites.find(s=>s.available);
            if(available){$('game-hero-batter').src=available.url;$('game-hero-batter').hidden=false;}
            const missing=sprites.filter(s=>!s.available).length;
            $('game-resource-note').hidden=!missing;
            $('game-resource-note').textContent=missing === sprites.length ? 'Dibujos no disponibles. Se muestra un marcador provisional; la práctica sigue disponible.' : missing ? `${missing} dibujo(s) no disponibles. Puedes jugar con el arte restante.` : '';
            $('game-loading').hidden=true;$('game-play').disabled=false;$('game-start').disabled=false;
            $('game-loading-error').hidden=true;modeInfo();
        } catch(error) {
            if(stopped||error.name==='AbortError')return;
            $('game-loading').hidden=true;$('game-loading-error').hidden=false;
            $('game-loading-error').textContent='No pudimos preparar el juego. Recarga para volver a intentar.';
        }
    })();
    let preservePageShow = false;
    const restored = event => { if(event.persisted && stopped)location.reload(); };
    function cleanup(){if(stopped)return;stopped=true;generation++;engine?.destroy();unsubscribe();lifecycle.abort();if(!preservePageShow)window.removeEventListener('pageshow',restored);for(const dialog of root.querySelectorAll('dialog[open]'))dialog.close();mounts.delete(root);}
    const handle={ready,get state(){return engine?.state||null;},destroy:cleanup};
    mounts.set(root,handle);signal?.addEventListener('abort',cleanup,{once:true});
    window.addEventListener('pagehide',event=>{preservePageShow=event.persisted;cleanup();},options);
    window.addEventListener('pageshow',restored);
    return handle;
}
