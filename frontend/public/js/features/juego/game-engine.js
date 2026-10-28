import { createMatch, advance, swing, pause, resume, abandon, terminal } from './game-state.js';

// One loop, one clock, no timers per pitch and no frame-rate-dependent scoring.
export function createGameEngine({ rules, mode, id, now = () => performance.now(),
    requestFrame = fn => requestAnimationFrame(fn), cancelFrame = frame => cancelAnimationFrame(frame), onFrame = () => {} }) {
    let state = createMatch(rules,mode,id), lastTime = null, frame = null, alive = true, epoch = 0;
    const emit = () => onFrame(state);
    const sync = () => {
        const time = now();
        if (lastTime !== null) state = advance(state,Math.max(0,time - lastTime),rules);
        lastTime = time;
    };
    function schedule() {
        if (!alive || frame !== null || state.phase === 'paused' || terminal(state)) return;
        const ticket = epoch;
        frame = requestFrame(() => {
            if (!alive || ticket !== epoch) return;
            frame = null; sync(); emit(); schedule();
        });
    }
    const stopFrame = () => { epoch++; if (frame !== null) cancelFrame(frame); frame = null; };
    return {
        get state() { return state; },
        start() { if (!alive || lastTime !== null) return; lastTime = now(); emit(); schedule(); },
        swing() {
            if (!alive || state.phase !== 'pitch') return false;
            const pitch = state.pitchIndex; sync();
            if (state.phase !== 'pitch' || state.pitchIndex !== pitch) { emit(); return false; }
            const before = state; state = swing(state,rules); emit(); return before !== state;
        },
        pause() { if (!alive || state.phase === 'paused' || terminal(state)) return; sync(); state = pause(state); stopFrame(); emit(); },
        resume() { if (!alive || state.phase !== 'paused') return; state = resume(state); lastTime = now(); emit(); schedule(); },
        abandon() { if (!alive || terminal(state)) return; state = abandon(state); stopFrame(); emit(); },
        destroy() { if (!alive) return; alive = false; state = abandon(state); stopFrame(); }
    };
}
