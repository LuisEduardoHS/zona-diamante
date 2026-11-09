import { createGameEngine } from './game-engine.js';
import { validateRules } from './game-state.js';

// No request is made by swing(), pause(), resume() or the animation loop.
// Only a reservation and the final input transcript reach the server.
export function createBufferedEngine({ queue, fresh = false, onFrame = () => {},
    onSnapshot = () => {}, onError = () => {}, ...clock }) {
    const abort = new AbortController();
    let alive = true, local = null, run = null, state = null, started = false;
    let checkpoint = '', queued = false, storageFault = false, booting = null;
    const project = value => ({ ...value, official: true, buffered: true,
        rewardPending: value.phase === 'finished', serverBusy: false });
    const unsubscribe = queue.subscribe(event => {
        if (!alive || event.type !== 'receipt' || event.result.id !== run?.id || state?.phase !== 'finished') return;
        const snapshot = event.result;
        state = { ...state, rewardPending: false, serverResult: snapshot,
            ...(snapshot.phase === 'completed' ? { stats: snapshot.stats, outcome: snapshot.outcome } : {}) };
        onSnapshot(snapshot); onFrame(state);
    });
    function failed(error) {
        if (alive && !abort.signal.aborted) onError(error);
    }
    function render(value) {
        if (!alive) return;
        run.state = value;
        try {
            if (!storageFault && value.phase === 'finished' && !queued) {
                queue.enqueue(run); queued = true;
            } else if (!storageFault && !queued) {
                const signature = `${value.phase}:${value.pitchIndex}:${value.stats.resolved}:${value.pausedFrom}`;
                if (signature !== checkpoint) { queue.saveActive(run); checkpoint = signature; }
            }
        } catch (error) {
            storageFault = true;
            failed(Object.assign(Error('No pudimos guardar la partida en este dispositivo. Libera espacio y reintenta.'), { code: 'storage' }));
            local?.pause(); return;
        }
        state = { ...project(value), ...(storageFault ? { networkError: true } : {}) };
        onFrame(state);
        if (queued && value.phase === 'finished') void queue.flush();
    }
    function play() {
        validateRules(run.snapshot.rules);
        let initial = run.state;
        if (initial && !['finished', 'abandoned'].includes(initial.phase)) {
            initial = initial.phase === 'paused' ? initial : { ...initial, phase: 'paused', pausedFrom: initial.phase };
        }
        local = createGameEngine({ ...clock, rules: run.snapshot.rules, mode: 'survival', id: run.id,
            initialState: initial, onFrame: render,
            onResolved(input) { run.events.push(input); } });
        onSnapshot(run.snapshot); local.start();
    }
    function boot(retry = false) {
        if (booting) return booting;
        booting = (async () => {
            await Promise.resolve();
            try {
                const recover = !fresh || retry;
                run = recover ? queue.active : null;
                if (!run && recover && queue.outbox.length) {
                    run = queue.outbox.at(-1); queued = true;
                    state = project(run.state); onSnapshot(run.snapshot); onFrame(state);
                    void queue.flush(); return true;
                }
                if (!run) {
                    if (queue.pending >= 10) throw Error('Hay varias partidas pendientes de puntos. Reconecta para confirmarlas o juega en práctica.');
                    run = { key: crypto.randomUUID(), id: null, snapshot: null, state: null, events: [] };
                    queue.saveActive(run); // Retain the key BEFORE reserving an official game.
                }
                if (!run.id) {
                    const snapshot = await queue.api.start(run.key, abort.signal);
                    if (!alive) return false;
                    if (snapshot.transport !== 'buffered-1' || snapshot.mode !== 'survival') throw Error('Partida no disponible.');
                    if (snapshot.phase !== 'waiting') { queue.saveActive(null); throw Error('La partida guardada venció. Reintenta para comenzar otra.'); }
                    run = { ...run, id: snapshot.id, snapshot };
                    queue.saveActive(run);
                }
                if (!alive) return false;
                play(); void queue.flush(); return true;
            } catch (error) { failed(error); return false; }
            finally { booting = null; }
        })();
        return booting;
    }
    return {
        get state() { return state; },
        start() { if (started) return; started = true; return boot(); },
        swing() { return !storageFault && Boolean(local?.swing()); },
        pause() { local?.pause(); },
        async resume() {
            if (!alive) return false;
            if (storageFault) {
                try { queue.saveActive(run); storageFault = false; }
                catch (error) { failed(error); return false; }
                // A full journal can fail exactly at the final frame. Publish
                // that frame again so its transcript enters the durable outbox.
                if (local) render(local.state);
            }
            if (!local && !queued) return boot(true);
            if (queued) return queue.flush();
            local.resume(); return true;
        },
        abandon() { if (!alive) return false; local?.abandon(); queue.saveActive(null); return true; },
        retryRewards() { return queue.flush(); },
        destroy() {
            if (!alive) return;
            local?.pause(); alive = false; abort.abort(); unsubscribe(); local?.destroy();
        },
    };
}
