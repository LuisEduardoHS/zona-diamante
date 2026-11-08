import { solicitarBackend } from '../../api/backend-client.js';
import { ruta } from '../../app/rutas.js';
import { TIMEZONE, LEAGUES, html, today, validDate, shiftDate, week, calendarLabel, filterGames, gameCard } from './model.js';

let logoManifest;
async function loadLogos() {
    logoManifest ||= fetch(ruta('data/match-logos.json')).then(response => {
        if (!response.ok) throw new Error('Logos unavailable');
        return response.json();
    }).then(data => new Map(data.logos.filter(logo => /^assets\/img\/partidos\/\d+\.svg$/.test(logo.path)).map(logo => [logo.id, logo.path])))
        .catch(() => { logoManifest = null; return new Map(); });
    return logoManifest;
}
const calendarIcon = '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="7" y="11" width="34" height="31" rx="7"/><path d="M15 6v11M33 6v11M7 22h34m-26 8h5m8 0h5m-18 6h5"/></svg>';
const skeleton = () => Array.from({ length: 4 }, () => '<div class="partidos-skeleton" aria-hidden="true"><span></span><div></div><div></div></div>').join('');

export function iniciarPartidos(signal) {
    const root = document.getElementById('partidos-app');
    if (!root || signal.aborted) return;
    const $ = id => root.querySelector(`#partidos-${id}`);
    const params = new URL(location.href).searchParams;
    const currentDay = today();
    const month = Number(currentDay.slice(5, 7));
    let league = Object.hasOwn(LEAGUES, params.get('liga')) ? params.get('liga') : month >= 10 || month <= 1 ? 'lmp' : 'lmb';
    let date = validDate(params.get('fecha')) ? params.get('fecha') : currentDay;
    let team = /^\d+$/.test(params.get('equipo') || '') ? params.get('equipo') : '';
    let status = ['all', 'live', 'scheduled', 'final'].includes(params.get('estado')) ? params.get('estado') : 'all';
    let data = null, logos = new Map(), request, version = 0, loading = false, lastRequest = 0;
    const maxYear = Number(currentDay.slice(0, 4)) + 1;
    $('fecha').max = `${maxYear}-12-31`;

    function updateURL() {
        const url = new URL(location.href);
        url.searchParams.set('liga', league);
        url.searchParams.set('fecha', date);
        for (const [key, value] of [['equipo', team], ['estado', status === 'all' ? '' : status]]) {
            if (value) url.searchParams.set(key, value); else url.searchParams.delete(key);
        }
        history.replaceState(history.state, '', url);
    }
    function controls() {
        root.querySelectorAll('[data-league]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.league === league)));
        root.querySelectorAll('button[data-status]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.status === status)));
        $('liga-nombre').textContent = LEAGUES[league];
        $('fecha').value = date;
        $('fecha-titulo').textContent = calendarLabel(date);
        $('anterior').disabled = !validDate(shiftDate(date, -1), maxYear);
        $('siguiente').disabled = !validDate(shiftDate(date, 1), maxYear);
        $('semana').innerHTML = week(date).map(day => {
            const label = new Intl.DateTimeFormat('es-MX', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`)).replace('.', '');
            return `<button class="partidos-dia" type="button" data-date="${day}" data-today="${day === today()}" aria-label="${html(calendarLabel(day))}${day === today() ? ', hoy' : ''}" aria-pressed="${date === day}" ${validDate(day, maxYear) ? '' : 'disabled'}><span>${label}</span><strong>${Number(day.slice(-2))}</strong></button>`;
        }).join('');
        updateURL();
    }
    function notice(message = '') {
        $('aviso').hidden = !message;
        $('aviso').textContent = message;
    }
    function empty(title, message, action = '') {
        $('lista').innerHTML = `<div class="partidos-empty">${calendarIcon}<h3>${html(title)}</h3><p>${html(message)}</p>${action}</div>`;
    }
    function render() {
        if (!data || signal.aborted) return;
        const filtered = filterGames(data.games, team, status);
        $('total').textContent = filterGames(data.games, team).length;
        if (filtered.length) $('lista').innerHTML = filtered.map(game => gameCard(game, logos, ruta)).join('');
        else if (team || status !== 'all') empty('Sin partidos con estos filtros', 'Prueba con otro equipo o consulta toda la jornada.', '<button type="button" data-action="clear">Ver toda la jornada</button>');
        else empty('El diamante toma una pausa', `No hay partidos programados para esta fecha en la ${LEAGUES[league]}. Puedes consultar otro día en el calendario.`);
        $('estado').textContent = `${filtered.length} ${filtered.length === 1 ? 'partido' : 'partidos'} · ${LEAGUES[league]} · ${calendarLabel(date)}`;
        const updated = new Date(data.updated_at);
        const time = new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: TIMEZONE }).format(updated);
        $('actualizacion').textContent = `${data.stale ? 'Últimos datos disponibles' : 'Actualizado'} · ${today(updated) === today() ? '' : calendarLabel(today(updated)) + ', '}${time} h`;
    }
    async function load({ background = false } = {}) {
        request?.abort();
        request = new AbortController();
        const current = ++version;
        const sameDay = data?.date === date && data?.league === league;
        if (!sameDay) {
            data = null;
            $('total').textContent = '0';
            $('equipo').innerHTML = '<option value="">Todos los equipos</option>';
            $('lista').innerHTML = skeleton();
        }
        loading = true;
        lastRequest = Date.now();
        $('lista').setAttribute('aria-busy', 'true');
        $('actualizar').disabled = true;
        if (!sameDay) $('actualizacion').textContent = 'Consultando la jornada…';
        if (!background) $('estado').textContent = 'Consultando los partidos…';
        notice();
        try {
            const result = await solicitarBackend(`/api/v1/matches?${new URLSearchParams({ league, date })}`, {
                authenticated: false,
                signal: AbortSignal.any([signal, request.signal, AbortSignal.timeout(25000)]),
            });
            if (current !== version || signal.aborted) return;
            if (!Array.isArray(result?.games) || !Array.isArray(result?.teams) || result.date !== date || result.league !== league) throw new Error('Invalid schedule');
            data = result;
            $('equipo').innerHTML = '<option value="">Todos los equipos</option>' + data.teams.map(item => `<option value="${html(item.id)}">${html(item.name)}</option>`).join('');
            if (team && !data.teams.some(item => String(item.id) === team)) team = '';
            $('equipo').value = team;
            updateURL();
            render();
            if (data.stale) notice('Mostramos la última jornada guardada. El proveedor no está disponible en este momento; los marcadores pueden haber cambiado.');
        } catch (error) {
            if (current !== version || signal.aborted || request.signal.aborted) return;
            if (data) notice('No pudimos actualizar la jornada. Conservamos los últimos datos consultados; puedes volver a intentarlo.');
            else {
                empty('No pudimos cargar los partidos', 'Comprueba tu conexión e inténtalo de nuevo en unos minutos.', '<button type="button" data-action="retry">Volver a intentar</button>');
                $('actualizacion').textContent = 'Sin conexión con los resultados';
            }
            $('estado').textContent = 'No pudimos actualizar los partidos.';
        } finally {
            if (current === version && !signal.aborted) {
                loading = false;
                $('lista').setAttribute('aria-busy', 'false');
                $('actualizar').disabled = false;
            }
        }
    }
    function selectDate(value) {
        if (!validDate(value, maxYear)) { $('fecha').value = date; return; }
        date = value;
        controls();
        void load();
    }
    root.addEventListener('click', event => {
        const button = event.target.closest('button');
        if (!button || button.disabled) return;
        if (button.dataset.league) {
            if (league === button.dataset.league) return;
            league = button.dataset.league; team = '';
            controls(); void load();
        } else if (button.dataset.date) selectDate(button.dataset.date);
        else if (button.id === 'partidos-anterior') selectDate(shiftDate(date, -1));
        else if (button.id === 'partidos-siguiente') selectDate(shiftDate(date, 1));
        else if (button.id === 'partidos-hoy') selectDate(today());
        else if (button.dataset.status) { status = button.dataset.status; controls(); render(); }
        else if (button.dataset.action === 'clear') { team = ''; status = 'all'; $('equipo').value = ''; controls(); render(); }
        else if (button.id === 'partidos-actualizar' || button.dataset.action === 'retry') void load();
    }, { signal });
    $('fecha').addEventListener('change', () => selectDate($('fecha').value), { signal });
    $('equipo').addEventListener('change', () => { team = $('equipo').value; updateURL(); render(); }, { signal });
    root.addEventListener('error', event => {
        if (event.target.matches?.('.partido-logo img')) event.target.remove();
    }, { capture: true, signal });
    const refresh = () => {
        if (!document.hidden && !loading && Date.now() - lastRequest >= 60000 && (date === today() || data?.games.some(game => game.status === 'live'))) void load({ background: true });
    };
    const timer = setInterval(refresh, 60000);
    document.addEventListener('visibilitychange', refresh, { signal });
    signal.addEventListener('abort', () => { ++version; clearInterval(timer); request?.abort(); }, { once: true });
    controls();
    void loadLogos().then(result => { if (!signal.aborted) { logos = result; render(); } });
    void load();
}
