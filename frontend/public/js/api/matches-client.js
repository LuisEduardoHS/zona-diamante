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

let logoManifest;
export function obtenerLogosPartidos() {
    logoManifest ||= fetch(ruta('data/match-logos.json')).then(response => {
        if (!response.ok) throw new Error('Logos unavailable');
        return response.json();
    }).then(data => new Map(data.logos.filter(logo => /^assets\/img\/partidos\/\d+\.svg$/.test(logo.path)).map(logo => [logo.id, logo.path])))
        .catch(() => { logoManifest = null; return new Map(); });
    return logoManifest;
}
