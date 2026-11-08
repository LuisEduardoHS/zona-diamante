import { obtenerCalendarioPartidos, obtenerLogosPartidos } from '../../api/matches-client.js';
import { RUTAS, ruta } from '../../app/rutas.js';
import { TIMEZONE, html, today, validDate, shiftDate, calendarLabel, filterGames, gameCard, actualizarLogosPartidos } from '../partidos/model.js';
import { crearMovimientoCalendario } from '../partidos/movimiento-calendario.js';

// These pages describe the LMB franchises. Charros' winter team has a different ID.
export const EQUIPOS_CALENDARIO = Object.freeze({
    'sultanes-mty': Object.freeze({ league: 'lmb', id: 562 }),
    'dorados-chi': Object.freeze({ league: 'lmb', id: 575 }),
    'charros-jal': Object.freeze({ league: 'lmb', id: 6304 }),
    'algodoneros-ul': Object.freeze({ league: 'lmb', id: 447 }),
});

export function iniciarCalendarioEquipo(container, equipo, signal) {
    const root = container.querySelector('.equipo-calendar');
    if (!root || signal?.aborted) return;
    const movimiento = crearMovimientoCalendario(signal);
    const config = Object.hasOwn(EQUIPOS_CALENDARIO, equipo.id) ? EQUIPOS_CALENDARIO[equipo.id] : null;
    const $ = name => root.querySelector(`[data-equipo-calendar="${name}"]`);
    if (!config) {
        $('controles').hidden = true; $('actualizar').hidden = true;
        $('juegos').setAttribute('aria-busy', 'false');
        $('juegos').textContent = 'Consulta los partidos disponibles en el calendario general.';
        return;
    }
    const dateParam = new URL(location.href).searchParams.get('fecha');
    let date = validDate(dateParam) ? dateParam : today();
    let data = null, logos = new Map(), request, version = 0, loading = false, lastRequest = 0;
    const maxYear = Number(today().slice(0, 4)) + 1;
    $('fecha').max = `${maxYear}-12-31`;
    function controls() {
        $('fecha').value = date;
        $('titulo-fecha').textContent = calendarLabel(date);
        $('anterior').disabled = !validDate(shiftDate(date, -1), maxYear);
        $('siguiente').disabled = !validDate(shiftDate(date, 1), maxYear);
        $('completo').href = `${ruta(RUTAS.partidos)}?${new URLSearchParams({ liga: config.league, fecha: date, equipo: config.id })}`;
    }
    function notice(text = '') { $('aviso').hidden = !text; $('aviso').textContent = text; }
    function render({ animar = true } = {}) {
        if (!data || signal?.aborted) return;
        movimiento.limpiar($('juegos'));
        const games = filterGames(data.games, String(config.id));
        $('juegos').innerHTML = games.length ? games.map(game => gameCard(game, logos, ruta)).join('')
            : `<p class="equipo-calendar-empty">${html(equipo.nombre)} no tiene partidos programados en LMB para esta fecha. Puedes elegir otro día.</p>`;
        if (animar) movimiento.revelar($('juegos').children, { distancia: 12 });
        const updated = new Date(data.updated_at);
        const time = new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: TIMEZONE }).format(updated);
        $('actualizacion').textContent = `${data.stale ? 'Últimos datos disponibles' : 'Actualizado'} · ${today(updated) === today() ? '' : calendarLabel(today(updated)) + ', '}${time} h`;
    }
    async function load({ background = false } = {}) {
        request?.abort(); request = new AbortController();
        const current = ++version, sameDate = data?.date === date;
        if (!sameDate) {
            data = null;
            movimiento.limpiar($('juegos'));
            $('juegos').innerHTML = '<p class="equipo-calendar-empty">Consultando los partidos del equipo…</p>';
            $('actualizacion').textContent = '';
        }
        loading = true; lastRequest = Date.now();
        $('juegos').setAttribute('aria-busy', 'true'); $('actualizar').disabled = true;
        notice();
        try {
            const result = await obtenerCalendarioPartidos(config.league, date, {
                signal: AbortSignal.any([request.signal, ...(signal ? [signal] : [])]),
            });
            if (current !== version || signal?.aborted) return;
            data = result; render({ animar: !background });
            if (data.stale) notice('Mostramos los últimos datos guardados. Los horarios y marcadores pueden haber cambiado.');
        } catch (error) {
            if (current !== version || signal?.aborted || request.signal.aborted) return;
            if (data) notice('No pudimos actualizar los partidos. Conservamos la última jornada consultada.');
            else {
                movimiento.limpiar($('juegos'));
                $('juegos').innerHTML = '<div class="equipo-calendar-empty"><p>No pudimos consultar los partidos del equipo.</p><button type="button" data-calendar-action="retry">Volver a intentar</button></div>';
                if (!background) movimiento.revelar($('juegos').children, { distancia: 12 });
                $('actualizacion').textContent = 'Sin conexión con los resultados';
            }
        } finally {
            if (current === version && !signal?.aborted) {
                loading = false; $('juegos').setAttribute('aria-busy', 'false'); $('actualizar').disabled = false;
            }
        }
    }
    function selectDate(value) {
        if (!validDate(value, maxYear)) { $('fecha').value = date; return; }
        const changed = value !== date;
        date = value; controls();
        if (changed) movimiento.acentuar($('titulo-fecha'));
        const url = new URL(location.href); url.searchParams.set('fecha', date);
        history.replaceState(history.state, '', url);
        void load();
    }
    root.addEventListener('click', event => {
        const button = event.target.closest('button');
        if (!button || button.disabled) return;
        const action = button.dataset.equipoCalendar;
        if (action === 'anterior') selectDate(shiftDate(date, -1));
        else if (action === 'siguiente') selectDate(shiftDate(date, 1));
        else if (action === 'hoy') selectDate(today());
        else if (action === 'actualizar' || button.dataset.calendarAction === 'retry') void load();
    }, { signal });
    $('fecha').addEventListener('change', () => selectDate($('fecha').value), { signal });
    root.addEventListener('error', event => { if (event.target.matches?.('.partido-logo img')) event.target.remove(); }, { capture: true, signal });
    const refresh = () => {
        if (!document.hidden && !loading && Date.now() - lastRequest >= 60000 && (date === today() || data?.games.some(game => game.status === 'live'))) void load({ background: true });
    };
    const timer = setInterval(refresh, 60000);
    document.addEventListener('visibilitychange', refresh, { signal });
    signal?.addEventListener('abort', () => { ++version; request?.abort(); clearInterval(timer); }, { once: true });
    controls();
    void obtenerLogosPartidos().then(result => { if (!signal?.aborted) { logos = result; actualizarLogosPartidos($('juegos'), logos, ruta); } });
    void load();
}
