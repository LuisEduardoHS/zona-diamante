import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const code = await readFile(new URL('../public/js/features/partidos/model.js', import.meta.url), 'utf8');
const { today, validDate, shiftDate, week, gameTime, filterGames, inningLabel, gameCard } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
const game = { id: 1, starts_at: '2026-07-02T03:00:00Z', status: 'live', time_tbd: false, inning: 5, inning_half: 'Bottom', venue: 'Estadio',
    away: { team: { id: 496, name: 'Leones', abbreviation: 'YUC' }, score: 0, hits: 3, errors: 0 },
    home: { team: { id: 520, name: 'Pericos', abbreviation: 'PUE' }, score: 5, hits: 8, errors: 1, winner: true } };

test('CDMX determina día y hora sin depender de la zona del visitante', () => {
    assert.equal(today(new Date('2026-07-02T03:00:00Z')), '2026-07-01');
    assert.equal(gameTime(game), '21:00 h');
    assert.equal(gameTime({ ...game, time_tbd: true }), 'Hora por confirmar');
});
test('calendario valida fechas reales y cruza meses, años y bisiestos', () => {
    assert.equal(validDate('2026-02-30'), false);
    assert.equal(validDate('2024-02-29'), true);
    assert.equal(validDate('1999-12-31'), false);
    assert.equal(validDate('bad'), false);
    assert.equal(shiftDate('2026-12-31', 1), '2027-01-01');
    assert.deepEqual(week('2027-01-01'), ['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03']);
});
test('filtros combinan equipo visitante o local con estado', () => {
    const games = [game, { ...game, id: 2, status: 'final' }, { ...game, id: 3, status: 'postponed' }];
    assert.equal(filterGames(games, '496', 'live').length, 1);
    assert.equal(filterGames(games, '520', 'final').length, 1);
    assert.equal(filterGames(games, '999').length, 0);
    assert.equal(filterGames(games).length, 3);
});
test('tarjeta conserva cero carreras, distingue resultado y escapa datos externos', () => {
    const result = gameCard({ ...game, venue: '<img onerror="bad()">' }, new Map([[496, 'assets/img/partidos/496.svg']]), path => '/' + path);
    assert.match(result, /0 carreras/);
    assert.match(result, /assets\/img\/partidos\/496.svg/);
    assert.match(result, /&lt;img onerror=&quot;bad\(\)&quot;&gt;/);
    assert.doesNotMatch(result, /<img onerror/);
    const scheduled = gameCard({ ...game, status: 'scheduled' }, new Map(), path => path);
    assert.doesNotMatch(scheduled, /5 carreras/);
    assert.match(scheduled, /21:00 h/);
});
test('entrada en español, extras y doble cartelera', () => {
    assert.equal(inningLabel(game), 'Baja 5');
    assert.equal(inningLabel({ ...game, inning_half: 'Top' }), 'Alta 5');
    assert.equal(inningLabel({ ...game, status: 'final', inning: 11 }), '11 entradas');
    assert.match(gameCard({ ...game, double_header: true, game_number: 2 }, new Map(), path => path), /Juego 2/);
});
test('los 30 logos del manifiesto son locales y existen', async () => {
    const manifest = JSON.parse(await readFile(new URL('../public/data/match-logos.json', import.meta.url), 'utf8'));
    assert.equal(manifest.logos.length, 30);
    for (const logo of manifest.logos) {
        assert.match(logo.path, /^assets\/img\/partidos\/\d+\.svg$/);
        assert.match(await readFile(new URL('../public/' + logo.path, import.meta.url), 'utf8'), /<svg/);
    }
});
