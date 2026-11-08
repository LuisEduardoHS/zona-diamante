import asyncio
from datetime import date

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import matches


def game(game_id=1, starts='2026-07-02T03:00:00Z', **overrides):
    raw = {'gamePk': game_id, 'gameDate': starts, 'officialDate': '2026-07-01',
           'status': {'abstractGameState': 'Final', 'detailedState': 'Final'},
           'teams': {'away': {'team': {'id': 496, 'name': 'Leones', 'abbreviation': 'YUC'}, 'score': 0},
                     'home': {'team': {'id': 520, 'name': 'Pericos'}, 'score': 5, 'isWinner': True}},
           'venue': {'name': 'Estadio'}, 'doubleHeader': 'N',
           'linescore': {'currentInning': 9, 'inningHalf': 'Bottom',
                         'teams': {'away': {'hits': 3, 'errors': 0}, 'home': {'hits': 8, 'errors': 1}}}}
    raw.update(overrides)
    return raw


def schedule(*games):
    return {'dates': [{'games': list(games)}] if games else [], 'totalGames': len(games)}


@pytest.fixture(autouse=True)
def clean_cache():
    matches._cache.clear()
    yield
    matches._cache.clear()


def provider(monkeypatch, payload=None):
    calls = []
    async def get(path, params):
        calls.append((path, params))
        if path == 'teams':
            return {'teams': [{'id': 496, 'name': 'Leones', 'league': {'id': params['leagueIds']}},
                              {'id': 999, 'name': 'Other league', 'league': {'id': 1}}]}
        return payload if payload is not None else schedule(game())
    monkeypatch.setattr(matches, '_get_json', get)
    return calls


def test_public_endpoint_uses_real_provider_shape_without_auth(monkeypatch):
    calls = provider(monkeypatch)
    response = TestClient(app).get('/api/v1/matches?league=lmb&date=2026-07-01')
    assert response.status_code == 200
    result = response.json()
    assert result['timezone'] == 'America/Mexico_City'
    assert result['games'][0]['home']['score'] == 5
    assert result['games'][0]['away']['score'] == 0
    assert result['games'][0]['away']['hits'] == 3
    assert {team['id'] for team in result['teams']} == {496, 520}
    assert response.headers['cache-control'] == 'no-store'
    assert calls[0] == ('schedule', {'sportId': 23, 'leagueId': 125, 'startDate': '2026-07-01',
                                   'endDate': '2026-07-02', 'hydrate': 'linescore,team'})


def test_cdmx_midnight_and_duplicate_ids_do_not_mix_jornadas():
    result = matches._normalize_games(schedule(game(), game(), game(2, '2026-07-02T06:00:00Z'),
                                              game(3, '2026-07-01T05:59:00Z')), date(2026, 7, 1))
    assert [item.id for item in result] == [1]


def test_tbd_start_uses_official_date_and_keeps_both_doubleheader_games():
    first = game(status={'abstractGameState': 'Preview', 'startTimeTBD': True},
                 doubleHeader='Y', gameNumber=1)
    second = game(2, '2026-07-02T12:00:00Z', status=first['status'], doubleHeader='Y', gameNumber=2)
    result = matches._normalize_games(schedule(first, second), date(2026, 7, 1))
    assert [item.game_number for item in result] == [1, 2]
    assert all(item.time_tbd and item.double_header and item.status == 'scheduled' for item in result)


@pytest.mark.parametrize('detail,status', [('Final', 'final'), ('Postponed', 'postponed'),
    ('Cancelled', 'cancelled'), ('Suspended', 'suspended'), ('Delayed Start', 'delayed')])
def test_special_states_override_abstract_state(detail, status):
    assert matches._status({'abstractGameState': 'Final', 'detailedState': detail}) == status
    assert matches._status({'abstractGameState': 'Live'}) == 'live'


def test_winter_january_uses_starting_year(monkeypatch):
    calls = provider(monkeypatch, schedule())
    result = asyncio.run(matches.get_schedule('lmp', date(2027, 1, 10)))
    assert result.games == []
    assert calls[0][1]['sportId'] == 17 and calls[0][1]['leagueId'] == 132
    assert calls[1][1]['season'] == 2026


def test_concurrent_guests_share_cached_requests(monkeypatch):
    calls = provider(monkeypatch)
    async def run():
        results = await asyncio.gather(*(matches.get_schedule('lmb', date(2026, 7, 1)) for _ in range(8)))
        assert all(result == results[0] for result in results)
    asyncio.run(run())
    assert len(calls) == 2


def test_stale_results_are_explicit_and_expire(monkeypatch):
    provider(monkeypatch)
    original = asyncio.run(matches.get_schedule('lmb', date(2026, 7, 1)))
    key = ('schedule', 'lmb', '2026-07-01')
    matches._cache[key] = (matches.monotonic() - 100, 60, original)
    async def fail(*args, **kwargs):
        raise matches.MatchProviderError()
    monkeypatch.setattr(matches, '_get_json', fail)
    stale = asyncio.run(matches.get_schedule('lmb', date(2026, 7, 1)))
    assert stale.stale and stale.updated_at == original.updated_at
    assert not original.stale
    matches._cache[key] = (matches.monotonic() - 86401, 60, original)
    with pytest.raises(matches.MatchProviderError):
        asyncio.run(matches.get_schedule('lmb', date(2026, 7, 1)))


@pytest.mark.parametrize('payload', [{}, {'dates': None, 'totalGames': 0}, schedule({'gamePk': 1}),
                                  {'dates': [], 'totalGames': 2}, schedule(game(status=None))])
def test_malformed_data_does_not_look_like_empty_schedule(payload):
    with pytest.raises(matches.MatchProviderError):
        matches._normalize_games(payload, date(2026, 7, 1))


def test_bad_provider_returns_safe_error(monkeypatch):
    async def fail(*args, **kwargs):
        raise matches.MatchProviderError('private upstream information')
    monkeypatch.setattr(matches, '_get_json', fail)
    response = TestClient(app).get('/api/v1/matches?date=2026-07-01')
    assert response.status_code == 502
    assert 'private' not in response.text


@pytest.mark.parametrize('query', ['league=other&date=2026-07-01', 'date=2026-02-30',
                                 'date=1999-01-01', 'date=2099-01-01', 'league=lmb'])
def test_invalid_requests_never_call_provider(monkeypatch, query):
    calls = provider(monkeypatch)
    assert TestClient(app).get('/api/v1/matches?' + query).status_code == 422
    assert not calls


def test_cache_is_bounded():
    for i in range(200):
        matches._remember(('test', i), i, 60)
    assert len(matches._cache) == matches.MAX_ENTRIES
    assert ('test', 0) not in matches._cache


def test_next_pending_day_skips_finished_cancelled_and_other_teams(monkeypatch):
    pending = {'abstractGameState': 'Preview', 'detailedState': 'Scheduled'}
    other = game(99, '2026-07-01T20:00:00Z', status=pending)
    other['teams']['away']['team']['id'] = 999
    calls = provider(monkeypatch, schedule(
        game(), game(2, '2026-07-02T20:00:00Z', status={'detailedState': 'Cancelled'}), other,
        game(3, '2026-07-04T01:00:00Z', status=pending),
        game(4, '2026-07-04T04:00:00Z', status=pending, doubleHeader='Y', gameNumber=2),
        game(5, '2026-07-06T01:00:00Z', status=pending)))
    result = TestClient(app).get('/api/v1/matches/next?league=lmb&team_id=496&date=2026-07-01')
    assert result.status_code == 200
    body = result.json()
    assert body['date'] == '2026-07-03' and body['from_date'] == '2026-07-01'
    assert [game['id'] for game in body['games']] == [3, 4]
    assert body['participating'] and body['team_id'] == 496
    assert result.headers['cache-control'] == 'no-store'
    assert calls[1][1]['teamId'] == 496
    assert calls[1][1]['endDate'] == '2027-07-03'


def test_pending_today_wins_over_later_games_and_tbd_uses_official_day(monkeypatch):
    calls = provider(monkeypatch, schedule(
        game(1, status={'abstractGameState': 'Live'}),
        game(2, '2026-07-02T12:00:00Z', status={'startTimeTBD': True}),
        game(3, '2026-07-03T01:00:00Z', status={'abstractGameState': 'Preview'})))
    result = asyncio.run(matches.get_next_team_schedule('lmp', 496, date(2026, 7, 1)))
    assert result.date == '2026-07-01'
    assert [game.id for game in result.games] == [1, 2]
    assert result.games[1].time_tbd
    assert calls[1][1]['sportId'] == 17 and calls[1][1]['leagueId'] == 132


def test_nonparticipating_team_never_queries_another_club(monkeypatch):
    calls = provider(monkeypatch)
    result = asyncio.run(matches.get_next_team_schedule('lmp', 5483, date(2027, 1, 10)))
    assert not result.participating and result.games == []
    assert calls == [('teams', {'sportId': 17, 'leagueIds': 132, 'season': 2026})]


def test_next_schedule_can_be_empty_and_shared_by_concurrent_guests(monkeypatch):
    calls = provider(monkeypatch, schedule())
    async def run():
        results = await asyncio.gather(*(matches.get_next_team_schedule('lmb', 496, date(2026, 11, 8)) for _ in range(6)))
        assert all(result == results[0] for result in results)
        assert results[0].participating and not results[0].games
    asyncio.run(run())
    assert len(calls) == 2


def test_offseason_search_reaches_next_year_without_daily_requests(monkeypatch):
    calls = provider(monkeypatch, schedule(
        game(8, '2027-04-16T01:00:00Z', status={'abstractGameState': 'Preview'}),
        game(9, '2027-11-10T01:00:00Z', status={'abstractGameState': 'Preview'})))
    result = asyncio.run(matches.get_next_team_schedule('lmb', 496, date(2026, 11, 8)))
    assert result.date == '2027-04-15'
    assert [game.id for game in result.games] == [8]
    assert len(calls) == 2
    assert calls[1][1]['startDate'] == '2026-11-08'


def test_next_schedule_stale_cache_and_safe_errors(monkeypatch):
    provider(monkeypatch)
    day = date(2026, 7, 1)
    original = asyncio.run(matches.get_next_team_schedule('lmb', 496, day))
    key = ('next-team', 'lmb', 496, day.isoformat())
    matches._cache[key] = (matches.monotonic() - 400, 300, original)
    async def fail(*args, **kwargs):
        raise matches.MatchProviderError('private upstream information')
    monkeypatch.setattr(matches, '_get_json', fail)
    # Expire the team roster as well.
    matches._cache.pop(('teams', 'lmb', 2026))
    stale = asyncio.run(matches.get_next_team_schedule('lmb', 496, day))
    assert stale.stale and stale.updated_at == original.updated_at
    matches._cache[key] = (matches.monotonic() - 86401, 300, original)
    response = TestClient(app).get('/api/v1/matches/next?league=lmb&team_id=496&date=2026-07-01')
    assert response.status_code == 502 and 'private' not in response.text


@pytest.mark.parametrize('query', ['team_id=0&date=2026-11-08', 'team_id=x&date=2026-11-08',
                                 'team_id=496&date=2099-01-01', 'team_id=496&league=other&date=2026-11-08',
                                 'team_id=496', 'date=2026-11-08'])
def test_invalid_next_request_never_calls_provider(monkeypatch, query):
    calls = provider(monkeypatch)
    assert TestClient(app).get('/api/v1/matches/next?' + query).status_code == 422
    assert not calls
