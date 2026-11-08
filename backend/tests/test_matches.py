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
