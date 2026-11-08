"""Public MLB schedules. Cache is bounded, shared by guests, and contains no identity."""
import asyncio
from collections import OrderedDict
from datetime import date, datetime, timedelta, timezone
from time import monotonic
from weakref import WeakKeyDictionary
from zoneinfo import ZoneInfo

import httpx

from app.core.http_client import supabase_http_client
from app.schemas.match import MatchRead, MatchSchedule, MatchSide, MatchTeam

BASE_URL = 'https://statsapi.mlb.com/api/v1'
TIMEZONE = 'America/Mexico_City'
LEAGUES = {'lmb': (23, 125), 'lmp': (17, 132)}
_cache: OrderedDict[tuple, tuple[float, float, object]] = OrderedDict()
_locks: WeakKeyDictionary = WeakKeyDictionary()
MAX_ENTRIES = 128
MAX_STALE_SECONDS = 86400


class MatchProviderError(Exception):
    pass


def _remember(key, payload, ttl):
    _cache[key] = (monotonic(), ttl, payload)
    _cache.move_to_end(key)
    while len(_cache) > MAX_ENTRIES:
        _cache.popitem(last=False)


async def _get_json(path, params):
    try:
        # Reuse the existing public HTTP pool; no Supabase credentials are attached.
        async with supabase_http_client(10.0) as client:
            response = await client.get(f'{BASE_URL}/{path}', params=params)
            response.raise_for_status()
            payload = response.json()
        if not isinstance(payload, dict):
            raise ValueError('Invalid provider response')
        return payload
    except (httpx.HTTPError, ValueError) as error:
        raise MatchProviderError() from error


def _team(raw):
    return MatchTeam(id=raw['id'], name=raw['name'],
                     abbreviation=raw.get('abbreviation') or raw.get('teamCode', '').upper()
                     or ''.join(word[0] for word in raw['name'].split())[:3])


def _status(raw):
    detail = raw.get('detailedState', '').lower()
    for word, status in [('postpon', 'postponed'), ('cancel', 'cancelled'),
                         ('suspend', 'suspended'), ('delay', 'delayed')]:
        if word in detail:
            return status
    return {'Final': 'final', 'Live': 'live'}.get(raw.get('abstractGameState'), 'scheduled')


def _side(raw, line):
    return MatchSide(team=_team(raw['team']), score=raw.get('score'),
                     hits=line.get('hits'), errors=line.get('errors'), winner=raw.get('isWinner', False))


def _normalize_games(payload, day):
    if (not isinstance(payload.get('dates'), list) or not isinstance(payload.get('totalGames'), int)
            or (payload['totalGames'] > 0 and not payload['dates'])):
        raise MatchProviderError()
    games = {}
    try:
        for block in payload['dates']:
            for raw in block['games']:
                starts = datetime.fromisoformat(raw['gameDate'].replace('Z', '+00:00'))
                time_tbd = raw['status'].get('startTimeTBD', False)
                # Undecided start times use the league's official calendar day.
                local_day = date.fromisoformat(raw['officialDate']) if time_tbd else starts.astimezone(ZoneInfo(TIMEZONE)).date()
                if local_day != day:
                    continue
                line = raw.get('linescore') or {}
                sides = line.get('teams') or {}
                games[raw['gamePk']] = MatchRead(
                    id=raw['gamePk'], starts_at=raw['gameDate'], time_tbd=time_tbd,
                    status=_status(raw['status']), inning=line.get('currentInning'),
                    inning_half=line.get('inningHalf'), venue=raw.get('venue', {}).get('name') or 'Estadio por confirmar',
                    game_number=raw.get('gameNumber', 1), double_header=raw.get('doubleHeader', 'N') != 'N',
                    away=_side(raw['teams']['away'], sides.get('away') or {}),
                    home=_side(raw['teams']['home'], sides.get('home') or {}))
        return sorted(games.values(), key=lambda game: (game.starts_at, game.id))
    except (AttributeError, KeyError, TypeError, ValueError) as error:
        raise MatchProviderError() from error


async def _teams(league, season):
    key = ('teams', league, season)
    entry = _cache.get(key)
    if entry and monotonic() - entry[0] < entry[1]:
        return entry[2]
    sport_id, league_id = LEAGUES[league]
    try:
        payload = await _get_json('teams', {'sportId': sport_id, 'leagueIds': league_id, 'season': season})
        if not isinstance(payload.get('teams'), list):
            raise MatchProviderError()
        teams = sorted((_team(team) for team in payload['teams']
                        if team.get('league', {}).get('id') == league_id), key=lambda team: team.name)
    except (AttributeError, KeyError, TypeError, ValueError) as error:
        raise MatchProviderError() from error
    _remember(key, teams, 86400)
    return teams


async def get_schedule(league: str, day: date) -> MatchSchedule:
    key = ('schedule', league, day.isoformat())
    loop = asyncio.get_running_loop()
    lock = _locks.setdefault(loop, asyncio.Lock())
    # Coalesce concurrent visitors requesting the same uncached schedule.
    async with lock:
        entry = _cache.get(key)
        if entry and monotonic() - entry[0] < entry[1]:
            _cache.move_to_end(key)
            return entry[2]
        sport_id, league_id = LEAGUES[league]
        try:
            payload = await _get_json('schedule', {
                'sportId': sport_id, 'leagueId': league_id, 'startDate': day.isoformat(),
                'endDate': (day + timedelta(days=1)).isoformat(), 'hydrate': 'linescore,team',
            })
            games = _normalize_games(payload, day)
            # A winter season belongs to its starting year (October–January).
            season = day.year - 1 if league == 'lmp' and day.month < 7 else day.year
            teams = {team.id: team for team in await _teams(league, season)}
            for game in games:
                for side in (game.away, game.home):
                    teams[side.team.id] = side.team
            result = MatchSchedule(league=league, date=day.isoformat(), timezone=TIMEZONE,
                                   updated_at=datetime.now(timezone.utc).isoformat(),
                                   teams=sorted(teams.values(), key=lambda team: team.name), games=games)
        except MatchProviderError:
            if entry and monotonic() - entry[0] < MAX_STALE_SECONDS:
                return entry[2].model_copy(update={'stale': True})
            raise
        today = datetime.now(ZoneInfo(TIMEZONE)).date()
        ttl = 60 if day == today or any(game.status == 'live' for game in games) else 300 if day > today else 21600
        _remember(key, result, ttl)
        return result
