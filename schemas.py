from pydantic import BaseModel, field_validator
from datetime import datetime
from typing import Optional
import json as _json

class UserCreate(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    id: int
    email: str
    is_paid: bool
    is_admin: bool
    has_paid_classic: bool
    has_paid_survival: bool
    has_extra_life: bool
    favorite_teams: list[str] = []
    created_at: datetime

    @field_validator("favorite_teams", mode="before")
    @classmethod
    def parse_favorite_teams(cls, v: object) -> list:
        if isinstance(v, str):
            return _json.loads(v)
        return v or []

    class Config:
        from_attributes = True


class FavoriteTeamsUpdate(BaseModel):
    teams: list[str]  # max 3 equipos

class PredictionCreate(BaseModel):
    match_id: int
    predicted_home: int
    predicted_away: int

class PredictionResponse(BaseModel):
    id: int
    match_id: int
    predicted_home: int
    predicted_away: int
    points_earned: int

    class Config:
        from_attributes = True

class MatchCreate(BaseModel):
    home_team: str
    away_team: str
    kickoff_time: datetime

class MatchResponse(BaseModel):
    id: int
    api_match_id: Optional[int] = None
    home_team: str
    away_team: str
    status: str
    elapsed: Optional[int] = None
    home_score: Optional[int]
    away_score: Optional[int]
    kickoff_time: datetime
    round: Optional[str] = None
    venue: Optional[str] = None
    home_form: Optional[str] = None
    away_form: Optional[str] = None

    class Config:
        from_attributes = True

class MatchResult(BaseModel):
    home_score: int
    away_score: int

class MatchResultCreate(BaseModel):
    home_score: int
    away_score: int
    winning_team: str

class GroupFixturePayload(BaseModel):
    id: str
    group: str
    homeTeam: str
    awayTeam: str
    homeScore: Optional[int] = None
    awayScore: Optional[int] = None

class KnockoutScoreEntry(BaseModel):
    homeScore: Optional[int] = None
    awayScore: Optional[int] = None

class ClassicPredictionCreate(BaseModel):
    group_fixtures: list[GroupFixturePayload]
    knockout_scores: dict[str, KnockoutScoreEntry]
    selected_thirds: Optional[list[str]] = None
    third_assignments: Optional[dict[str, str]] = None
    is_bracket_generated: Optional[bool] = False
    captain_matches: Optional[list[str]] = None
    bracket_snapshot: Optional[dict[str, dict[str, str]]] = None

class ClassicPredictionResponse(BaseModel):
    id: int
    updated_at: datetime

    class Config:
        from_attributes = True

class ClassicPredictionFull(BaseModel):
    group_fixtures:        list[GroupFixturePayload]
    knockout_scores:       dict[str, KnockoutScoreEntry]
    selected_thirds:       list[str] = []
    third_assignments:     dict[str, str] = {}
    is_bracket_generated:  bool = False
    captain_matches:       list[str] = []
    bracket_snapshot:      Optional[dict[str, dict[str, str]]] = None
    total_points_classic:  int = 0
    exact_count_classic:   int = 0
    effectiveness_classic: float = 0.0
    updated_at:            datetime


class MatchScoreInput(BaseModel):
    homeTeam:  str
    awayTeam:  str
    homeScore: int
    awayScore: int


class ClassicScoreRequest(BaseModel):
    real_group_results:    list[MatchScoreInput]
    real_knockout_results: dict[str, KnockoutScoreEntry]
    real_champion:         Optional[str] = None


class MatchScoreDetail(BaseModel):
    match_id:   str
    outcome:    str
    base:       int
    multiplier: int
    captain:    bool
    points:     int


class ClassicScoreResponse(BaseModel):
    total_points:   int
    exact_count:    int
    tendency_count: int
    miss_count:     int
    champion_bonus: int
    effectiveness:  float
    match_details:  list[MatchScoreDetail]

class CheckoutSessionResponse(BaseModel):
    checkout_url: str

class LeaderboardUserInfo(BaseModel):
    id: int
    email: str

    class Config:
        from_attributes = True

class LeaderboardEntry(BaseModel):
    rank_position: Optional[int]
    total_points: int
    exact_matches_count: int
    user: LeaderboardUserInfo

    class Config:
        from_attributes = True

class GroupCreate(BaseModel):
    name: str

class GroupResponse(BaseModel):
    id: int
    name: str
    owner_id: int
    is_premium: bool
    created_at: datetime

    class Config:
        from_attributes = True

class GroupMemberResponse(BaseModel):
    id: int
    group_id: int
    user_id: int
    is_alive: bool
    joined_at: datetime

    class Config:
        from_attributes = True

class SurvivorPickCreate(BaseModel):
    match_id: int
    team_id: str
    group_id: Optional[int] = None

class SurvivorPickResponse(BaseModel):
    id: int
    user_id: int
    group_id: Optional[int]
    match_id: int
    team_id: str
    is_correct: Optional[bool]
    created_at: datetime

    class Config:
        from_attributes = True

class GroupLeaderboardEntry(BaseModel):
    user: LeaderboardUserInfo
    total_points: int
    is_alive: bool

class SurvivorStatusEntry(BaseModel):
    user: LeaderboardUserInfo
    is_alive: bool
    last_team_picked: Optional[str]

class GlobalLeaderboardEntry(BaseModel):
    rank: int
    user: LeaderboardUserInfo
    total_points: int
    exact_matches_count: int

class GlobalSurvivorEntry(BaseModel):
    user: LeaderboardUserInfo
    is_alive: bool
    last_team_picked: Optional[str]

class UserStats(BaseModel):
    total_points: int
    rank: int
    total_predictions: int
    finished_predictions: int
    exact_count: int
    tendency_count: int
    effectiveness: float

class PredictionDetail(BaseModel):
    id: int
    match_id: int
    predicted_home: int
    predicted_away: int
    points_earned: int
    match: Optional[MatchResponse]

    class Config:
        from_attributes = True


# ─── Supervivencia (Last Man Standing) ───────────────────────────────────────

class SurvivalPickCreate(BaseModel):
    jornada_id: int          # 1–8 (grupo 1, grupo 2, grupo 3, R32, R16, QF, SF, Final)
    team_id:    str          # ej. "MEX", "ARG" — nombre del equipo

class SurvivalPickResponse(BaseModel):
    jornada_id: int
    team_id:    str
    saved_at:   datetime

class SurvivalStatusResponse(BaseModel):
    status:               str              # "alive" | "eliminated"
    picks:                dict[str, str]   # {jornada_id: team_id}
    used_teams:           list[str]
    pick_results:         dict[str, str] = {}   # {jornada_id: "won"|"lost"}
    extra_life_available: bool
    extra_life_used:      bool
    eliminated_in_round:  Optional[int]
    updated_at:           Optional[datetime]