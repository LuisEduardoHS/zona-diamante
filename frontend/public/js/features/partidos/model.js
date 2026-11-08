export const TIMEZONE = 'America/Mexico_City';
export const LEAGUES = { lmb: 'Liga Mexicana de Beisbol', lmp: 'Liga Mexicana del Pacífico' };
export const STATUS = { scheduled: 'Por comenzar', live: 'En juego', final: 'Finalizado', delayed: 'Demorado', postponed: 'Pospuesto', cancelled: 'Cancelado', suspended: 'Suspendido' };
export const html = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

export function today(now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
    const get = type => parts.find(part => part.type === type).value;
    return `${get('year')}-${get('month')}-${get('day')}`;
}
export function validDate(value, maxYear = Number(today().slice(0, 4)) + 1) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
    const date = new Date(`${value}T12:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value && Number(value.slice(0, 4)) >= 2000 && Number(value.slice(0, 4)) <= maxYear;
}
export function shiftDate(value, amount) {
    const date = new Date(`${value}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + amount);
    return date.toISOString().slice(0, 10);
}
export function week(value) {
    const weekday = new Date(`${value}T12:00:00Z`).getUTCDay();
    const monday = shiftDate(value, -((weekday + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => shiftDate(monday, i));
}
export const calendarLabel = value => new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`));
export const gameTime = game => game.time_tbd ? 'Hora por confirmar' : new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: TIMEZONE }).format(new Date(game.starts_at)) + ' h';
export function filterGames(games, team = '', status = 'all') {
    return games.filter(game => (!team || String(game.away.team.id) === team || String(game.home.team.id) === team)
        && (status === 'all' || (status === 'live' ? ['live', 'delayed', 'suspended'].includes(game.status) : game.status === status)));
}
export function inningLabel(game) {
    if (game.status === 'scheduled') return gameTime(game);
    if (!game.inning) return '';
    if (game.status === 'final') return game.inning > 9 ? `${game.inning} entradas` : '';
    if (!['live', 'delayed', 'suspended'].includes(game.status)) return '';
    return `${({ Top: 'Alta', Bottom: 'Baja', Middle: 'Mitad', End: 'Fin' })[game.inning_half] || 'Entrada'} ${game.inning}`;
}

export function gameCard(game, logos, assetURL) {
    const side = (data, label) => {
        const logo = logos.get(data.team.id);
        const showScore = game.status !== 'scheduled' && !['postponed', 'cancelled'].includes(game.status);
        const value = number => showScore && number != null ? html(number) : '—';
        return `<div class="partido-team" data-winner="${game.status === 'final' && data.winner}">
            <div class="partido-team-name"><div class="partido-logo"><span aria-hidden="true">${html(data.team.abbreviation)}</span>${logo ? `<img src="${html(assetURL(logo))}" alt="" width="48" height="48" loading="lazy" decoding="async">` : ''}</div><div class="partido-name"><strong>${html(data.team.name)}</strong><small>${label}</small></div></div>
            <span class="partido-number partido-runs" aria-label="${showScore && data.score != null ? `${html(data.score)} carreras` : 'Marcador pendiente'}">${value(data.score)}</span><span class="partido-number">${value(data.hits)}</span><span class="partido-number">${value(data.errors)}</span>
        </div>`;
    };
    const second = inningLabel(game) || (game.double_header ? `Juego ${game.game_number}` : '');
    return `<article class="partido-card" data-status="${html(game.status)}" aria-labelledby="partido-${html(game.id)}">
        <h3 id="partido-${html(game.id)}" class="sr-only">${html(game.away.team.name)} contra ${html(game.home.team.name)}${game.double_header ? `, juego ${html(game.game_number)}` : ''}</h3>
        <div class="partido-card-top"><span class="partido-status">${game.status === 'live' ? '<span class="partidos-live-dot" aria-hidden="true"></span>' : ''}${html(STATUS[game.status] || 'Por confirmar')}</span><span class="partido-inning">${html(second)}</span></div>
        <div class="partido-scoreboard"><div class="partido-columns" aria-hidden="true"><span>${game.double_header ? `Juego ${html(game.game_number)}` : 'Equipos'}</span><span title="Carreras">C</span><span title="Hits">H</span><span title="Errores">E</span></div>${side(game.away, 'Visitante')}${side(game.home, 'Local')}</div>
        <p class="partido-venue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>${html(game.venue)}</p>
    </article>`;
}
