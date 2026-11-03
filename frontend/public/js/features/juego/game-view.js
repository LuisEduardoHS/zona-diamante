import { ballPosition, CONTACT, contactCue, frameFor, usableFrame, spriteTransform } from './game-media.js';

export const RESULT_LABELS = {perfect:'¡Perfecto!',hit:'¡Hit!',early:'Muy pronto',late:'Muy tarde',no_swing:'Sin swing',pending:'Confirmando…'};
const text = (node,value) => { if (node.textContent !== String(value)) node.textContent = String(value); };
export function installSprites(container, sprites, manifest) {
    container.replaceChildren();
    sprites.forEach((frame,index) => {
        if (!frame.available) return;
        const img = document.createElement('img'); img.src = frame.url; img.alt = ''; img.draggable = false;
        img.dataset.frame = String(index); img.style.transform = spriteTransform(frame,manifest.canvas);
        img.hidden = index !== usableFrame(0,sprites); container.append(img);
    });
    const placeholder = document.createElement('span'); placeholder.className = 'game-art-placeholder';
    placeholder.textContent = 'Bateador no disponible'; placeholder.hidden = sprites.some(s => s.available); container.append(placeholder);
}
// Only confirmed server snapshots can populate credited points and balance.
export function resultPresentation(state) {
    const result=state.serverResult, reward=result?.reward;
    const confirmed=state.official && state.phase==='finished' && result?.phase==='completed';
    const credited=confirmed ? reward.points_awarded : null;
    const bonus=confirmed && credited>0 ? (reward.extra_hit_bonus || 0)+(reward.streak_bonus || 0) : 0;
    const note=!confirmed ? 'Práctica · sin puntos de cuenta.'
        : reward.status==='daily_limit' ? 'Cupo diario agotado · esta partida no genera puntos.'
        : reward.status==='disabled' ? 'Recompensas desactivadas · sin puntos.'
        : reward.status==='lost' ? `Necesitas ${result.rules?.modes?.[state.mode]?.targetHits || 5} hits para ganar puntos.`
        : reward.status==='no_participation' ? 'Sin premio: faltaron intentos de bateo.'
        : credited>0 ? 'Puntos acreditados en tu cuenta.' : 'Sin puntos en esta partida.';
    return {credited,balance:confirmed?result.points_balance:null,bonus,note,
        toast:confirmed&&reward.status==='confirmed'&&credited>0?`+ ${credited} puntos`:null};
}
export function createGameView(root, rules, sprites, manifest, motion) {
    const $ = id => root.querySelector('#'+id), images = [...$('game-batter').querySelectorAll('[data-frame]')];
    let lastPose = -2, lastProgress = '', segments=[];
    let previousStats=null, previousCountdown=null, lastFeedback=null;
    const field = $('game-scene');
    let fieldWidth = field.clientWidth, fieldHeight = field.clientHeight;
    const resize = new ResizeObserver(([entry]) => { fieldWidth = entry.contentRect.width; fieldHeight = entry.contentRect.height; });
    resize.observe(field);
    $('game-contact').style.left = CONTACT.x*100+'%'; $('game-contact').style.top = CONTACT.y*100+'%';
    const draw = state => {
        const paused = state.phase === 'paused', phase = paused ? state.pausedFrom : state.phase;
        const mode = rules.modes[state.mode];
        const endless=state.mode==='survival';
        root.dataset.phase = state.phase;
        root.dataset.network = state.networkError ? 'error' : '';
        root.dataset.result = phase === 'feedback' ? state.last?.type || '' : '';
        root.dataset.cue = contactCue(state);
        text($('game-hits'),state.stats.hits); text($('game-target'),`/${mode.targetHits || mode.targetStreak}`);
        text($('game-misses'),endless?`${state.stats.misses}/${mode.maxMisses}`:state.stats.misses);
        text($('game-streak'),endless?`Extras ×${state.stats.hits}`:`Racha ×${state.stats.streak}`);
        $('game-streak').hidden=endless?state.stats.hits<=mode.targetHits:state.stats.streak===0;
        $('game-streak').setAttribute('aria-label',endless?`${state.stats.hits} hits, racha máxima ${state.stats.bestStreak}`:`Racha actual ${state.stats.streak}, máxima ${state.stats.bestStreak}`);
        text($('game-progress'),endless?state.stats.resolved:`${state.stats.resolved}/${mode.maxPitches}`);
        if(previousStats){
            if(state.stats.hits>previousStats.hits){motion?.pulse($('game-hits'));if(state.stats.hits>mode.targetHits)motion?.pulse($('game-streak'));}
            if(state.stats.misses>previousStats.misses)motion?.pulse($('game-misses'),'miss');
            if(state.stats.resolved>previousStats.resolved)motion?.pulse($('game-progress'));
        }
        previousStats={...state.stats};
        root.dataset.extras=String(endless&&state.stats.hits>mode.targetHits);
        const segmentCount=endless?mode.targetHits:mode.maxPitches;
        if(segments.length!==segmentCount){
            segments=Array.from({length:segmentCount},()=>document.createElement('span'));
            $('game-goal-progress').replaceChildren(...segments);lastProgress='';
        }
        const progress=`${state.id}:${state.stats.resolved}`;
        if(progress!==lastProgress){
            if(endless){segments.forEach((s,i)=>{s.className=i<state.stats.hits?'is-hit':'';});}
            else {
                if(state.stats.resolved===0)segments.forEach(s=>{s.className='';});
                segments.forEach((s,i)=>{if(i<state.stats.resolved&&!s.className)s.className='is-complete';});
                if(state.stats.resolved&&['hit','perfect'].includes(state.last?.type))segments[state.stats.resolved-1].className='is-hit';
            }
            $('game-goal-progress').setAttribute('aria-label',endless?`${state.stats.hits} de ${mode.targetHits} hits. ${state.stats.misses} de ${mode.maxMisses} fallos.`:`${state.stats.resolved} de ${mode.maxPitches} lanzamientos completados`);lastProgress=progress;
        }
        $('game-hit').disabled = state.phase !== 'pitch' || state.serverBusy;
        $('game-pause').disabled = Boolean(state.networkError) || ['finished','abandoned'].includes(state.phase);
        $('game-pause').setAttribute('aria-label',paused ? 'Reanudar' : 'Pausar');
        $('game-pause').setAttribute('aria-pressed',String(paused));
        if(motion)motion.visible($('game-paused'),paused&&!state.networkError);
        else $('game-paused').hidden = !paused || Boolean(state.networkError);
        text($('game-paused').querySelector('p'),state.networkError?'Reconecta para recuperar la partida.':state.official?'El lanzamiento actual sigue corriendo en el servidor.':'Reanuda cuando estés listo.');
        $('game-countdown').hidden = phase !== 'countdown' || paused;
        text($('game-countdown-number'),Math.max(1,Math.ceil((rules.timing.countdownMs - state.elapsed)/1000)));
        if(phase==='countdown'&&!paused){const number=$('game-countdown-number').textContent;if(number!==previousCountdown)motion?.pulse($('game-countdown-number'),'countdown');previousCountdown=number;}
        const pose = usableFrame(frameFor(state,manifest),sprites);
        if (pose !== lastPose) { images.forEach(img => { img.hidden = Number(img.dataset.frame) !== pose; }); lastPose = pose; }
        $('game-batter').dataset.pose = String(pose);
        const ball = ballPosition(state);
        $('game-ball').hidden = !ball.visible;
        $('game-ball').style.transform = `translate(${ball.x*fieldWidth}px,${ball.y*fieldHeight}px) translate(-50%,-50%) scale(${ball.scale})`;
        $('game-pitcher').style.setProperty('--throw',phase === 'pitch' && state.elapsed < 240 ? '-55deg' : '0deg');
        const cue=contactCue(state);
        const message=paused?'En pausa':phase==='preparing'?'Prepárate':phase==='countdown'?'Prepárate':phase==='feedback'?RESULT_LABELS[state.last.type]:cue==='contact'?'¡Batea!':cue==='late'?'Muy tarde':'Espera…';
        text($('game-feedback'),message);
        $('game-feedback').dataset.result = phase === 'feedback' ? state.last.type : '';
        const feedback=phase==='feedback'?`${state.id}:${state.stats.resolved}:${state.last.type}`:null;
        if(feedback&&feedback!==lastFeedback){
            motion?.pulse($('game-feedback'),['hit','perfect'].includes(state.last.type)?'score':'miss');
            if(['hit','perfect'].includes(state.last.type))motion?.effect($('game-contact'),[
                {transform:'translate(-50%,-50%) scale(1)',opacity:1},
                {transform:'translate(-50%,-50%) scale(1.65)',opacity:0}
            ],{duration:430});
        }
        lastFeedback=feedback;
    };
    draw.destroy = () => resize.disconnect();
    return draw;
}
