import { obtenerCalendarioPartidos, obtenerProximosPartidosEquipo, obtenerLogosPartidos } from '../../api/matches-client.js';
import { RUTAS, ruta } from '../../app/rutas.js';
import { TIMEZONE, html, today, validDate, shiftDate, calendarLabel, filterGames, gameCard, actualizarLogosPartidos } from '../partidos/model.js';
import { crearMovimientoCalendario } from '../partidos/movimiento-calendario.js';

// Franchise IDs differ between leagues. Unión Laguna is not Guasave.
// Sultanes' historical winter ID remains available for past dates, not Jaguares'.
export const EQUIPOS_CALENDARIO = Object.freeze({
    'sultanes-mty': Object.freeze({ lmb: 562, lmp: 5483 }),
    'dorados-chi': Object.freeze({ lmb: 575, lmp: null }),
    'charros-jal': Object.freeze({ lmb: 6304, lmp: 674 }),
    'algodoneros-ul': Object.freeze({ lmb: 447, lmp: null }),
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
    const params = new URL(location.href).searchParams;
    const dateParam = params.get('fecha');
    const month = Number(today().slice(5, 7));
    let league = ['lmb', 'lmp'].includes(params.get('liga')) ? params.get('liga')
        : equipo.id === 'charros-jal' && (month >= 10 || month <= 1) ? 'lmp' : 'lmb';
    let date = validDate(dateParam) ? dateParam : today();
    let automatic = date === today();
    let data = null, dataKey = '', logos = new Map(), request, version = 0, loading = false, lastRequest = 0;
    const maxYear = Number(today().slice(0, 4)) + 1;
    $('fecha').max = `${maxYear}-12-31`;
    function controls() {
        root.querySelectorAll('[data-calendar-league]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.calendarLeague === league)));
        $('fecha').value = date;
        $('modo').textContent = automatic ? data?.games.length && date > today() ? 'Próximo partido' : 'Hoy y próximos partidos' : 'Jornada seleccionada';
        $('titulo-fecha').textContent = calendarLabel(date);
        $('anterior').disabled = !validDate(shiftDate(date, -1), maxYear);
        $('siguiente').disabled = !validDate(shiftDate(date, 1), maxYear);
        const query = new URLSearchParams({ liga: league, fecha: date });
        if (config[league] && data?.participating !== false) query.set('equipo', config[league]);
        $('completo').href = `${ruta(RUTAS.partidos)}?${query}`;
        $('actualizar').hidden = !config[league];
    }
    function saveURL() {
        const url = new URL(location.href);
        url.searchParams.set('liga', league);
        // Preserve automatic next-match mode when reloading or sharing the page.
        url.searchParams.set('fecha', automatic ? today() : date);
        history.replaceState(history.state, '', url);
    }
    function notice(text = '') { $('aviso').hidden = !text; $('aviso').textContent = text; }
    function render({ animar = true } = {}) {
        if (!data || signal?.aborted) return;
        movimiento.limpiar($('juegos'));
        const games = filterGames(data.games, String(config[league]));
        const empty = data.participating === false
            ? `${html(equipo.nombre)} no participa en ${league.toUpperCase()} en esta temporada. Puedes consultar los demás equipos en el calendario completo.`
            : automatic ? `Todavía no hay próximos partidos de ${html(equipo.nombre)} publicados en ${league.toUpperCase()}.`
                : `${html(equipo.nombre)} no tiene partidos programados en ${league.toUpperCase()} para esta fecha. Puedes elegir otro día.`;
        $('juegos').innerHTML = games.length ? games.map(game => gameCard(game, logos, ruta)).join('')
            : `<p class="equipo-calendar-empty">${empty}</p>`;
        if (animar) movimiento.revelar($('juegos').children, { distancia: 12 });
        if (!data.updated_at) { $('actualizacion').textContent = ''; return; }
        const updated = new Date(data.updated_at);
        const time = new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: TIMEZONE }).format(updated);
        $('actualizacion').textContent = `${data.stale ? 'Últimos datos disponibles' : 'Actualizado'} · ${today(updated) === today() ? '' : calendarLabel(today(updated)) + ', '}${time} h`;
    }
    async function load({ background = false } = {}) {
        request?.abort(); request = new AbortController();
        const current = ++version, requestedDay = automatic ? today() : date;
        const key = `${league}:${requestedDay}:${automatic}`;
        if (dataKey !== key) {
            data = null;
            movimiento.limpiar($('juegos'));
            $('juegos').innerHTML = '<p class="equipo-calendar-empty">Consultando los partidos del equipo…</p>';
            $('actualizacion').textContent = '';
        }
        loading = true; lastRequest = Date.now();
        $('juegos').setAttribute('aria-busy', 'true'); $('actualizar').disabled = true;
        notice();
        try {
            const options = { signal: AbortSignal.any([request.signal, ...(signal ? [signal] : [])]) };
            const id = config[league];
            const result = !id ? { date: requestedDay, games: [], participating: false }
                : automatic ? await obtenerProximosPartidosEquipo(league, id, requestedDay, options)
                    : await obtenerCalendarioPartidos(league, requestedDay, options);
            if (current !== version || signal?.aborted) return;
            data = result; dataKey = key;
            data.participating ??= data.teams.some(team => team.id === id);
            const dateChanged = date !== data.date;
            date = data.date; controls(); render({ animar: !background });
            if (dateChanged && !background) movimiento.acentuar($('titulo-fecha'));
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
        date = value; automatic = date === today(); controls();
        if (changed) movimiento.acentuar($('titulo-fecha'));
        saveURL();
        void load();
    }
    root.addEventListener('click', event => {
        const button = event.target.closest('button');
        if (!button || button.disabled) return;
        if (button.dataset.calendarLeague) {
            if (league === button.dataset.calendarLeague) return;
            league = button.dataset.calendarLeague;
            if (automatic) date = today();
            data = null; controls(); saveURL(); movimiento.acentuar($('titulo-fecha')); void load();
            return;
        }
        const action = button.dataset.equipoCalendar;
        if (action === 'anterior') selectDate(shiftDate(date, -1));
        else if (action === 'siguiente') selectDate(shiftDate(date, 1));
        else if (action === 'hoy') selectDate(today());
        else if (action === 'actualizar' || button.dataset.calendarAction === 'retry') void load();
    }, { signal });
    $('fecha').addEventListener('change', () => selectDate($('fecha').value), { signal });
    root.addEventListener('error', event => { if (event.target.matches?.('.partido-logo img')) event.target.remove(); }, { capture: true, signal });
    const refresh = () => {
        if (!document.hidden && !loading && config[league] && Date.now() - lastRequest >= 60000 && (automatic || date === today() || data?.games.some(game => game.status === 'live'))) void load({ background: true });
    };
    const timer = setInterval(refresh, 60000);
    document.addEventListener('visibilitychange', refresh, { signal });
    signal?.addEventListener('abort', () => { ++version; request?.abort(); clearInterval(timer); }, { once: true });
    controls();
    void obtenerLogosPartidos().then(result => { if (!signal?.aborted) { logos = result; actualizarLogosPartidos($('juegos'), logos, ruta); } });
    void load();
}
