import { ballPosition, CONTACT, contactCue, frameFor, usableFrame, spriteTransform } from './game-media.js';

export const RESULT_LABELS = {perfect:'¡Perfecto!',hit:'¡Buen bateo!',early:'Muy temprano',late:'Muy tarde',no_swing:'Se fue la pelota',pending:'Validando bateo…'};
const text = (node,value) => { if (node.textContent !== String(value)) node.textContent = String(value); };
export function installSprites(container, sprites, manifest) {
    container.replaceChildren();
    sprites.forEach((frame,index) => {
        if (!frame.available) return;
        const img = document.createElement('img'); img.src = frame.url; img.alt = ''; img.draggable = false;
        img.dataset.frame = String(index); img.style.transform = spriteTransform(frame,manifest.canvas);
        img.hidden = true; container.append(img);
    });
    const placeholder = document.createElement('span'); placeholder.className = 'game-art-placeholder';
    placeholder.textContent = 'Bateador · arte no disponible'; placeholder.hidden = sprites.some(s => s.available); container.append(placeholder);
}
export function createGameView(root, rules, sprites, manifest) {
    const $ = id => root.querySelector('#'+id), images = [...$('game-batter').querySelectorAll('[data-frame]')];
    let lastPose = -2, lastMessage = '', lastGoal = '';
    // Cache projection dimensions; layout is read on resize, never on each RAF.
    const field = $('game-field');
    let fieldWidth = field.clientWidth, fieldHeight = field.clientHeight;
    const resize = new ResizeObserver(([entry]) => { fieldWidth = entry.contentRect.width; fieldHeight = entry.contentRect.height; });
    resize.observe(field);
    $('game-contact').style.left = CONTACT.x*100+'%'; $('game-contact').style.top = CONTACT.y*100+'%';
    const draw = state => {
        const paused = state.phase === 'paused', phase = paused ? state.pausedFrom : state.phase;
        const mode = rules.modes[state.mode];
        root.dataset.phase = state.phase;
        root.dataset.result = phase === 'feedback' ? state.last.type : '';
        root.dataset.cue = contactCue(state);
        text($('game-score'),state.stats.score); text($('game-hits'),state.stats.hits);
        text($('game-streak'),state.stats.streak); text($('game-best-streak'),state.stats.bestStreak);
        text($('game-progress'),`${state.pitchIndex || 0} / ${mode.maxPitches}`);
        text($('game-remaining'),Math.max(0,mode.maxPitches - state.stats.resolved));
        text($('game-goal'),state.mode === 'classic' ? `Objetivo: ${mode.targetHits} bateos en ${mode.maxPitches} lanzamientos` : `Objetivo: ${mode.targetStreak} bateos seguidos`);
        const target = state.mode === 'classic' ? mode.targetHits : mode.targetStreak;
        const achieved = Math.min(target,state.mode === 'classic' ? state.stats.hits : state.stats.streak);
        const goalKey = `${target}:${achieved}`;
        if (lastGoal !== goalKey) {
            lastGoal = goalKey;
            $('game-goal-progress').replaceChildren(...Array.from({length:target},(_,index) => {
                const dot = document.createElement('span'); dot.className = index < achieved ? 'is-complete' : ''; return dot;
            }));
            $('game-goal-progress').setAttribute('aria-label',`${achieved} de ${target} ${state.mode === 'classic' ? 'aciertos' : 'bateos seguidos'}`);
        }
        text($('game-mode-tag'),`${mode.name} · nivel ${state.plan?.tier || 1}`);
        $('game-hit').disabled = state.phase !== 'pitch' || state.serverBusy;
        $('game-pause').disabled = ['finished','abandoned'].includes(state.phase);
        text($('game-pause'),paused ? 'Reanudar' : 'Pausar');
        $('game-pause').setAttribute('aria-pressed',String(paused));
        $('game-paused').hidden = !paused;
        text($('game-paused').querySelector('p'),state.official?'El plazo del lanzamiento actual continúa en el servidor.':'Reanuda cuando estés listo.');
        $('game-countdown').hidden = phase !== 'countdown' || paused;
        text($('game-countdown-number'),Math.max(1,Math.ceil((rules.timing.countdownMs - state.elapsed)/1000)));
        const requestedPose = frameFor(state,manifest), pose = usableFrame(requestedPose,sprites);
        if (pose !== lastPose) { images.forEach(img => { img.hidden = Number(img.dataset.frame) !== pose; }); lastPose = pose; }
        $('game-batter').dataset.pose = String(pose);
        const ball = ballPosition(state);
        $('game-ball').hidden = !ball.visible;
        $('game-ball').style.transform = `translate(${ball.x*fieldWidth}px,${ball.y*fieldHeight}px) translate(-50%,-50%) scale(${ball.scale})`;
        $('game-pitcher').style.setProperty('--throw',phase === 'pitch' && state.elapsed < 240 ? '-55deg' : '0deg');
        const progress = state.plan ? Math.min(1,(phase === 'feedback' ? state.last.at : state.elapsed)/state.plan.flightMs) : 0;
        $('game-timing-cursor').style.left = progress*100+'%';
        if (state.plan) {
            for (const [id,window] of [['game-valid-window',state.plan.validWindowMs],['game-perfect-window',state.plan.perfectWindowMs]]) {
                $(id).style.left = (state.plan.contactMs-window)/state.plan.flightMs*100+'%';
                $(id).style.width = window*2/state.plan.flightMs*100+'%';
            }
        }
        const cue = contactCue(state);
        const message = paused ? 'Partida en pausa' : phase === 'preparing' ? 'Preparando lanzamiento…' : phase === 'countdown' ? 'Prepárate para batear' : phase === 'feedback' ? RESULT_LABELS[state.last.type] : cue === 'contact' ? '¡Ahora! Batea' : cue === 'late' ? 'Pasó el momento' : 'Espera la pelota…';
        const tip = phase === 'feedback' ? ({early:'Espera un poco más en la siguiente.',late:'Intenta un poco antes en la siguiente.',no_swing:'Toca Batear cuando la pelota llegue al aro.',hit:'Buen ritmo. Busca el centro de la franja.',perfect:'En el centro. ¡Sigue así!',pending:'El servidor está confirmando tu bateo.'}[state.last.type] || '') : 'Toca al llegar al aro · Espacio o Enter';
        text($('game-control-tip'),tip);
        if (message !== lastMessage) { text($('game-feedback'),message); lastMessage = message; }
        $('game-feedback').dataset.result = phase === 'feedback' ? state.last.type : '';
        $('game-field').dataset.result = phase === 'feedback' ? state.last.type : '';
    };
    draw.destroy = () => resize.disconnect();
    return draw;
}
