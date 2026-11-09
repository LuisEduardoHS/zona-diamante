// Local records are pending inputs, never account balances or earned currency.
export function bufferedJournal(storage, user) {
    const key = 'zd:game:buffered:' + user;
    return {
        read() {
            const raw = storage.getItem(key);
            if (!raw) return { version: 1, active: null, outbox: [] };
            const data = JSON.parse(raw);
            if (data?.version !== 1 || !Array.isArray(data.outbox) || !(data.active === null || typeof data.active === 'object')) throw Error('No pudimos leer las partidas guardadas.');
            return data;
        },
        write(data) {
            try { storage.setItem(key, JSON.stringify(data)); }
            catch (cause) { throw Object.assign(Error('No pudimos guardar la partida en este dispositivo. Libera espacio y reintenta.', { cause }), { code: 'storage' }); }
        },
    };
}

export function createBufferedRewardQueue({ api, journal, canSync = () => true,
    setTimer = (fn, ms) => setTimeout(fn, ms), clearTimer = id => clearTimeout(id), onError = () => {} }) {
    const abort = new AbortController(), listeners = new Set();
    let alive = true, inFlight = null, timer = null, failures = 0, lastError = null;
    const data = () => journal.read();
    const notify = event => { if (alive) for (const listener of listeners) listener(event); };
    function changed() { try { notify({ type: 'pending', count: data().outbox.length, error: lastError }); } catch (error) { onError(error); } }
    function saveActive(run) { const next = data(); next.active = run; journal.write(next); }
    function enqueue(run) {
        const next = data();
        if (!next.outbox.some(row => row.id === run.id)) next.outbox.push(run);
        if (next.active?.id === run.id) next.active = null;
        journal.write(next); changed();
    }
    function schedule() {
        if (!alive || timer !== null) return;
        try { if (!data().outbox.length) return; } catch (error) { onError(error); return; }
        timer = setTimer(() => { timer = null; void flush(); }, Math.min(30000, 2000 * 2 ** Math.min(failures, 4)));
    }
    function flush() {
        if (!alive) return Promise.resolve(false);
        if (inFlight) return inFlight;
        if (timer !== null) { clearTimer(timer); timer = null; }
        if (!canSync()) { schedule(); return Promise.resolve(false); }
        inFlight = (async () => {
            // Assign inFlight before an empty queue can complete synchronously.
            await Promise.resolve();
            try {
                while (alive) {
                    const run = data().outbox[0];
                    if (!run) { lastError = null; failures = 0; changed(); return true; }
                    const result = await api.complete(run.id, run.events, abort.signal);
                    if (!alive) return false;
                    if (result.id !== run.id || result.transport !== 'buffered-1'
                        || !['completed', 'expired'].includes(result.phase)) throw Error('Resultado sin confirmar.');
                    // Read again: a new active game may have been saved during this request.
                    const next = data(); next.outbox = next.outbox.filter(row => row.id !== run.id);
                    journal.write(next); lastError = null; failures = 0;
                    notify({ type: 'receipt', result, run }); changed();
                }
            } catch (error) {
                if (alive && !abort.signal.aborted) { lastError = error; failures++; changed(); onError(error); }
                return false;
            } finally { inFlight = null; if (alive) schedule(); }
        })();
        return inFlight;
    }
    return {
        get api() { return api; }, get journal() { return journal; },
        get pending() { return data().outbox.length; },
        get active() { return data().active; }, get outbox() { return data().outbox; },
        saveActive, enqueue, flush,
        subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
        destroy() { alive = false; abort.abort(); if (timer !== null) clearTimer(timer); timer = null; listeners.clear(); },
    };
}
