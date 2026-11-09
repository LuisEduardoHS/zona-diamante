import { observarEstadoSesion, obtenerEstadoSesion, establecerEstadoSesion } from '../auth/session.js';
import { getBufferedGameClient } from '../../api/game-client.js';
import { bufferedJournal, createBufferedRewardQueue } from './game-reward-queue.js';

let currentUser = null, pending = null, queue = null, generation = 0, installed = false;
function activate(user) {
    if (currentUser === user && pending) return pending;
    const ticket = ++generation;
    queue?.destroy(); queue = null; currentUser = user; pending = null;
    if (!user) return Promise.resolve(null);
    pending = getBufferedGameClient().then(api => {
        if (ticket !== generation) return null;
        queue = createBufferedRewardQueue({ api, journal: bufferedJournal(localStorage, user),
            canSync: () => !document.hidden && navigator.onLine !== false });
        queue.subscribe(event => {
            if (event.type !== 'receipt' || event.result.phase !== 'completed') return;
            const auth = obtenerEstadoSesion();
            if (auth.user?.id === user) establecerEstadoSesion({ ...auth,
                profile: { ...auth.profile, points_balance: event.result.points_balance } });
        });
        void queue.flush(); return queue;
    });
    return pending;
}
export function obtenerColaPremiosJuego(user) { return activate(user); }
export function iniciarPremiosPendientesJuego() {
    if (installed) return; installed = true;
    observarEstadoSesion(auth => { if (!auth.cargando) void activate(auth.user?.id || null).catch(() => {}); });
    window.addEventListener('online', () => { void queue?.flush(); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) void queue?.flush(); });
    window.addEventListener('pagehide', () => { ++generation; queue?.destroy(); queue = null; pending = null; }, { once: true });
    window.addEventListener('pageshow', event => { if (event.persisted) { currentUser = null; void activate(obtenerEstadoSesion().user?.id || null); } });
}
