from datetime import date, datetime
from typing import Literal
from zoneinfo import ZoneInfo

from fastapi import APIRouter, HTTPException, Query, Response

from app.schemas.match import MatchSchedule, TeamMatchSchedule
from app.services.matches import MatchProviderError, TIMEZONE, get_schedule, get_next_team_schedule

router = APIRouter(prefix='/api/v1/matches', tags=['matches'])


@router.get('', response_model=MatchSchedule)
async def read_schedule(response: Response, league: Literal['lmb', 'lmp'] = 'lmb',
                        day: date = Query(alias='date')):
    if not 2000 <= day.year <= datetime.now(ZoneInfo(TIMEZONE)).year + 1:
        raise HTTPException(status_code=422, detail='La fecha está fuera del calendario disponible.')
    try:
        result = await get_schedule(league, day)
    except MatchProviderError as error:
        raise HTTPException(status_code=502, detail='No pudimos consultar los partidos. Inténtalo de nuevo en unos minutos.') from error
    # The service owns caching; stale responses must always reach the UI as stale.
    response.headers['Cache-Control'] = 'no-store'
    return result


@router.get('/next', response_model=TeamMatchSchedule)
async def read_next_team_schedule(response: Response, league: Literal['lmb', 'lmp'] = 'lmb',
                                  team_id: int = Query(gt=0), day: date = Query(alias='date')):
    if not 2000 <= day.year <= datetime.now(ZoneInfo(TIMEZONE)).year + 1:
        raise HTTPException(status_code=422, detail='La fecha está fuera del calendario disponible.')
    try:
        result = await get_next_team_schedule(league, team_id, day)
    except MatchProviderError as error:
        raise HTTPException(status_code=502, detail='No pudimos consultar los próximos partidos. Inténtalo de nuevo en unos minutos.') from error
    response.headers['Cache-Control'] = 'no-store'
    return result
