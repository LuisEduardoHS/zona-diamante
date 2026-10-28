export function validateRules(rules) {
    if (!rules || typeof rules.version !== 'string' || !rules.version.length) throw new Error('Configuración de juego inválida.');
    for (const mode of ['classic', 'streak']) {
        const m = rules.modes?.[mode];
        if (!m || !Number.isInteger(m.maxPitches) || m.maxPitches < 1 || m.maxPitches > 100) throw new Error('Modalidad inválida.');
        const goal = mode === 'classic' ? m.targetHits : m.targetStreak;
        if (!Number.isInteger(goal) || goal < 1 || goal > m.maxPitches) throw new Error('Objetivo inválido.');
    }
    const t = rules.timing;
    if (!t || Object.values(t).some(v => !Number.isFinite(v) || v <= 0 || v > 60000)
        || !(t.perfectWindowMs < t.validWindowMs && t.validWindowMs < t.contactMs && t.contactMs + t.validWindowMs < t.flightMs)) throw new Error('Tiempos de juego inválidos.');
    for (const key of ['countdownMs','flightMs','contactMs','validWindowMs','perfectWindowMs','feedbackMs']) if (!Number.isFinite(t[key])) throw new Error('Faltan tiempos de juego.');
    const d = rules.difficulty;
    if (!d || !Number.isInteger(d.tierEvery) || d.tierEvery < 1 || !d.tierFactors?.length || !d.pitchFactors?.length
        || [...d.tierFactors,...d.pitchFactors].some(v => !Number.isFinite(v) || v < .5 || v > 1.5)) throw new Error('Dificultad inválida.');
    if (!rules.scoring || ['hit','perfect','miss'].some(k => !Number.isInteger(rules.scoring[k]) || rules.scoring[k] < 0)) throw new Error('Puntuación inválida.');
    return rules;
}

export function pitchPlan(rules, index) {
    const d = rules.difficulty;
    const tier = Math.min(Math.floor((index - 1) / d.tierEvery), d.tierFactors.length - 1);
    const factor = d.tierFactors[tier] * d.pitchFactors[(index - 1) % d.pitchFactors.length];
    const timing = Object.fromEntries(['flightMs','contactMs','validWindowMs','perfectWindowMs'].map(k => [k,rules.timing[k] * factor]));
    return { ...timing, index, tier: tier + 1 };
}
export function classifySwing(elapsed, plan) {
    if (!Number.isFinite(elapsed) || elapsed < 0) return 'invalid';
    const distance = Math.abs(elapsed - plan.contactMs);
    if (distance <= plan.perfectWindowMs + 1e-7) return 'perfect';
    if (distance <= plan.validWindowMs + 1e-7) return 'hit';
    return elapsed < plan.contactMs ? 'early' : 'late';
}
export function createMatch(rules, mode, id = 'practice') {
    validateRules(rules);
    if (!['classic','streak'].includes(mode)) throw new Error('Modalidad desconocida.');
    return { id, mode, phase:'countdown', elapsed:0, pitchIndex:0, plan:null, last:null, outcome:null,
        stats:{ resolved:0, hits:0, misses:0, perfects:0, score:0, streak:0, bestStreak:0 }, pausedFrom:null };
}
export const terminal = state => ['finished','abandoned'].includes(state.phase);
function resolve(state, type, rules) {
    const hit = type === 'hit' || type === 'perfect', old = state.stats;
    const streak = hit ? old.streak + 1 : 0;
    const stats = { resolved:old.resolved + 1, hits:old.hits + Number(hit), misses:old.misses + Number(!hit),
        perfects:old.perfects + Number(type === 'perfect'), score:old.score + (hit ? rules.scoring[type] : rules.scoring.miss),
        streak, bestStreak:Math.max(old.bestStreak,streak) };
    const mode = rules.modes[state.mode];
    let outcome = null;
    if (state.mode === 'streak' && streak >= mode.targetStreak) outcome = 'won';
    else if (stats.resolved === mode.maxPitches) outcome = state.mode === 'classic' && stats.hits >= mode.targetHits ? 'won' : 'lost';
    return { ...state, phase:'feedback', elapsed:0, stats, outcome,
        last:{ type, at:state.elapsed, duration:Math.max(rules.timing.feedbackMs, hit ? 0 : state.plan.flightMs - state.elapsed) } };
}
export function swing(state, rules) {
    if (state.phase !== 'pitch') return state;
    return resolve(state, classifySwing(state.elapsed,state.plan), rules);
}
export function advance(state, delta, rules) {
    if (!Number.isFinite(delta) || delta < 0) throw new Error('Tiempo inválido.');
    if (terminal(state) || state.phase === 'paused') return state;
    let next = state, remaining = delta;
    for (let guard = 0; guard < 310; guard++) {
        const duration = next.phase === 'countdown' ? rules.timing.countdownMs : next.phase === 'pitch' ? next.plan.flightMs : next.last.duration;
        const step = Math.min(remaining, duration - next.elapsed);
        next = { ...next, elapsed:next.elapsed + step }; remaining -= step;
        if (next.elapsed < duration) return next;
        if (next.phase === 'countdown') next = { ...next,phase:'pitch',elapsed:0,pitchIndex:1,plan:pitchPlan(rules,1) };
        else if (next.phase === 'pitch') next = resolve(next,'no_swing',rules);
        else if (next.outcome) return { ...next, phase:'finished', elapsed:0 };
        else next = { ...next,phase:'pitch',elapsed:0,pitchIndex:next.pitchIndex + 1,plan:pitchPlan(rules,next.pitchIndex + 1),last:null };
        if (!remaining) return next;
    }
    throw new Error('Límite de pasos de simulación.');
}
export function pause(state) {
    return terminal(state) || state.phase === 'paused' ? state : { ...state,phase:'paused',pausedFrom:state.phase };
}
export function resume(state) {
    return state.phase === 'paused' ? { ...state,phase:state.pausedFrom,pausedFrom:null } : state;
}
export function abandon(state) {
    return terminal(state) ? state : { ...state,phase:'abandoned',outcome:null,pausedFrom:null };
}
