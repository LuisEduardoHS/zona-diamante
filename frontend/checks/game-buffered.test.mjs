import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGame, rules } from './game-module-loader.mjs';
const { bufferedJournal, createBufferedRewardQueue } = await loadGame('game-reward-queue.js');
const { createBufferedEngine } = await loadGame('game-buffered.js');
const { resultPresentation } = await loadGame('game-view.js');
const memory = () => { const map = new Map(); return { getItem: key => map.get(key), setItem: (key, value) => map.set(key, value) }; };
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const reserve = id => ({ id, transport: 'buffered-1', mode: 'survival', phase: 'waiting', rules,
    stats: {}, reward: { status: 'pending' }, rewarded_today: 0, daily_limit: 3, points_balance: 0 });

function setup({ storage = memory(), user = 'one', online = false, lostReply = false } = {}) {
    let time = 0, next = 0, starts = 0, completes = 0, balance = 0, available = online;
    const frames = new Map(), timers = new Map(), errors = [], sent = [], snapshots = [];
    const journal = bufferedJournal(storage, user);
    const api = { start: async () => reserve('game-' + (++starts)), complete: async (id, events) => {
        completes++; sent.push({ id, events: structuredClone(events) });
        if (!available) throw Error('offline');
        balance = 40;
        if (lostReply && completes === 1) throw Error('response lost after commit');
        return { ...reserve(id), phase: 'completed', outcome: 'won', points_balance: balance,
            stats: { resolved: events.length, hits: events.length - 3, misses: 3, bestStreak: events.length - 3 },
            reward: { status: 'confirmed', points_awarded: 40 } };
    } };
    const queue = createBufferedRewardQueue({ api, journal, setTimer: fn => { timers.set(++next, fn); return next; }, clearTimer: id => timers.delete(id) });
    let engine;
    function make(fresh = false) {
        engine = createBufferedEngine({ queue, fresh, now: () => time,
            requestFrame: fn => { frames.set(++next, fn); return next; }, cancelFrame: id => frames.delete(id),
            onError: error => errors.push(error), onFrame: state => snapshots.push(state) });
        return engine;
    }
    make();
    function step(ms) { time += ms; const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(fn => fn(time)); }
    function shot(hit = true) { assert.equal(engine.state.phase, 'pitch'); step(hit ? engine.state.plan.contactMs - engine.state.elapsed : 0); engine.swing(); step(engine.state.last.duration + .01); }
    return { get engine() { return engine; }, queue, journal, errors, frames, timers, sent, snapshots,
        get starts() { return starts; }, get completes() { return completes; }, get balance() { return balance; },
        setOnline(value) { available = value; }, step, shot, make,
        destroy() { engine.destroy(); queue.destroy(); },
    };
}

test('la partida no usa probes ni peticiones por lanzamiento, swing o pausa', async () => {
    const r = setup();
    try {
        await r.engine.start(); r.step(3000);
        for (let n = 0; n < 10; n++) r.shot();
        const at = r.engine.state.elapsed;
        r.engine.pause(); r.step(60000); assert.equal(r.engine.state.elapsed, at);
        await r.engine.resume();
        assert.equal(r.starts, 1); assert.equal(r.completes, 0);
        assert.equal(r.engine.state.stats.hits, 10); assert.equal(r.errors.length, 0);
    } finally { r.destroy(); }
});

test('terminar sin red conserva jugadas y muestra puntos pendientes, nunca acreditados', async () => {
    const r = setup();
    try {
        await r.engine.start(); r.step(3000);
        for (let n = 0; n < 10; n++) r.shot();
        for (let n = 0; n < 3; n++) r.shot(false);
        await r.queue.flush();
        assert.equal(r.engine.state.phase, 'finished'); assert.equal(r.engine.state.rewardPending, true);
        assert.equal(r.queue.pending, 1); assert.equal(r.queue.active, null);
        assert.deepEqual(r.journal.read().outbox[0].events.map(e => e.pitch), Array.from({ length: 13 }, (_, n) => n + 1));
        assert.equal(resultPresentation(r.engine.state).credited, null);
        assert.match(resultPresentation(r.engine.state).note, /guardada/);
        r.setOnline(true); await r.queue.flush();
        assert.equal(r.queue.pending, 0); assert.equal(r.engine.state.rewardPending, false);
        assert.equal(resultPresentation(r.engine.state).credited, 40);
    } finally { r.destroy(); }
});

test('una cola inicialmente vacía puede confirmar la primera partida después', async () => {
    const r = setup({ online: true });
    try {
        await r.queue.flush(); await r.engine.start(); r.step(3000);
        for (let n = 0; n < 3; n++) r.shot(false);
        await r.queue.flush(); assert.equal(r.completes, 1); assert.equal(r.queue.pending, 0);
    } finally { r.destroy(); }
});

test('recarga y desconexión recuperan la partida pausada sin otra reserva', async () => {
    const r = setup();
    try {
        await r.engine.start(); r.step(3000); r.shot(); r.step(300);
        r.engine.destroy(); const before = r.journal.read().active;
        assert.equal(before.state.phase, 'paused'); assert.equal(before.events.length, 1);
        r.make(); await r.engine.start(); assert.equal(r.starts, 1);
        assert.equal(r.engine.state.phase, 'paused'); assert.equal(r.engine.state.stats.hits, 1);
        await r.engine.resume(); r.shot(); assert.equal(r.engine.state.stats.hits, 2);
    } finally { r.destroy(); }
});

test('una respuesta perdida reenvía exactamente la misma partida y sus entradas', async () => {
    const r = setup({ online: true, lostReply: true });
    try {
        await r.engine.start(); r.step(3000); for (let n = 0; n < 3; n++) r.shot(false);
        await r.queue.flush(); assert.equal(r.queue.pending, 1);
        await r.queue.flush(); assert.equal(r.queue.pending, 0);
        assert.deepEqual(r.sent[0], r.sent[1]); assert.equal(r.balance, 40);
    } finally { r.destroy(); }
});

test('confirmar una partida anterior conserva una partida nueva que ya está en curso', async () => {
    const r = setup();
    try {
        await r.engine.start(); r.step(3000); for (let n = 0; n < 3; n++) r.shot(false);
        await r.queue.flush(); r.engine.destroy(); r.make(true); await r.engine.start();
        assert.equal(r.queue.pending, 1); assert.equal(r.queue.active.id, 'game-2');
        r.setOnline(true); await r.queue.flush();
        assert.equal(r.queue.active.id, 'game-2'); assert.equal(r.engine.state.id, 'game-2');
        assert.equal(r.engine.state.phase, 'countdown');
    } finally { r.destroy(); }
});

test('los intentos automáticos sin swing se guardan una sola vez y por usuario', async () => {
    const storage = memory(), r = setup({ storage });
    try {
        await r.engine.start(); r.step(20000); await r.queue.flush();
        assert.deepEqual(r.queue.outbox[0].events, [{ pitch: 1, at_ms: null }, { pitch: 2, at_ms: null }, { pitch: 3, at_ms: null }]);
        assert.equal(bufferedJournal(storage, 'another').read().outbox.length, 0);
        r.engine.destroy(); r.make(); await r.engine.start();
        assert.equal(r.starts, 1); assert.equal(r.engine.state.phase, 'finished');
        assert.equal(resultPresentation(r.engine.state).credited, null);
    } finally { r.destroy(); }
});

test('el fallo de almacenamiento no reserva una partida irrecuperable', async () => {
    const r = setup({ storage: { getItem: () => null, setItem: () => { throw Error('storage full'); } } });
    try {
        await r.engine.start(); assert.equal(r.starts, 0); assert.equal(r.errors.length, 1);
        assert.equal(r.engine.state, null);
    } finally { r.destroy(); }
});

test('abandonar elimina el intento local y permite iniciar otra partida', async () => {
    const r = setup();
    try {
        await r.engine.start(); r.step(3000); r.shot();
        r.engine.abandon(); r.engine.destroy();
        assert.equal(r.queue.active, null); assert.equal(r.queue.pending, 0);
        r.make(); await r.engine.start();
        assert.equal(r.starts, 2); assert.equal(r.engine.state.phase, 'countdown');
    } finally { r.destroy(); }
});

test('recuperar espacio al terminar guarda y confirma el resultado pendiente', async () => {
    const base = memory(); let full = false;
    const r = setup({ storage: { getItem: base.getItem, setItem(key, value) {
        if (full) throw Error('storage full'); base.setItem(key, value);
    } } });
    try {
        await r.engine.start(); r.step(3000);
        r.shot(false); r.shot(false);
        r.engine.swing(); full = true;
        r.step(r.engine.state.last.duration + .01);
        assert.equal(r.errors.at(-1).code, 'storage'); assert.equal(r.queue.pending, 0);
        full = false; await r.engine.resume();
        assert.equal(r.engine.state.phase, 'finished'); assert.equal(r.queue.pending, 1);
        assert.equal(r.queue.outbox[0].events.length, 3);
        r.setOnline(true); await r.queue.flush();
        assert.equal(r.queue.pending, 0); assert.equal(r.engine.state.rewardPending, false);
    } finally { r.destroy(); }
});
