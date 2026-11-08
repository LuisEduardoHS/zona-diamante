import { solicitarBackend } from './backend-client.js';
import { ruta } from '../app/rutas.js';

export async function obtenerCalendarioPartidos(league, date, { signal } = {}) {
    const result = await solicitarBackend(`/api/v1/matches?${new URLSearchParams({ league, date })}`, {
        authenticated: false,
        signal: AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(25000)]),
    });
    if (!Array.isArray(result?.games) || !Array.isArray(result?.teams) || result.date !== date || result.league !== league) {
        throw new Error('No pudimos consultar esta jornada.');
    }
    return result;
}

export async function obtenerProximosPartidosEquipo(league, teamId, date, { signal } = {}) {
    const result = await solicitarBackend(`/api/v1/matches/next?${new URLSearchParams({ league, team_id: teamId, date })}`, {
        authenticated: false,
        signal: AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(25000)]),
    });
    if (!Array.isArray(result?.games) || !Array.isArray(result?.teams) || result.from_date !== date
        || result.league !== league || result.team_id !== teamId || typeof result.participating !== 'boolean'
        || !/^\d{4}-\d{2}-\d{2}$/.test(result.date) || result.date < date) {
        throw new Error('No pudimos consultar los próximos partidos.');
    }
    return result;
}

let logoManifest;
export function obtenerLogosPartidos() {
    logoManifest ||= fetch(ruta('data/match-logos.json')).then(response => {
        if (!response.ok) throw new Error('Logos unavailable');
        return response.json();
    }).then(data => new Map(data.logos.filter(logo => /^assets\/img\/partidos\/\d+\.svg$/.test(logo.path)).map(logo => [logo.id, logo.path])))
        .catch(() => { logoManifest = null; return new Map(); });
    return logoManifest;
}
