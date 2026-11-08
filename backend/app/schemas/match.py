from typing import Literal

from pydantic import BaseModel


class MatchTeam(BaseModel):
    id: int
    name: str
    abbreviation: str


class MatchSide(BaseModel):
    team: MatchTeam
    score: int | None = None
    hits: int | None = None
    errors: int | None = None
    winner: bool = False


class MatchRead(BaseModel):
    id: int
    starts_at: str
    time_tbd: bool
    status: Literal['scheduled', 'live', 'final', 'delayed', 'postponed', 'cancelled', 'suspended']
    inning: int | None = None
    inning_half: str | None = None
    venue: str
    game_number: int
    double_header: bool
    away: MatchSide
    home: MatchSide


class MatchSchedule(BaseModel):
    league: Literal['lmb', 'lmp']
    date: str
    timezone: str
    updated_at: str
    stale: bool = False
    teams: list[MatchTeam]
    games: list[MatchRead]
