from pydantic import BaseModel, field_validator
from datetime import datetime
from typing import Optional
import json as _json

class UserCreate(BaseModel):
    email: str
    password: str
    name: str

class UserResponse(BaseModel):
    id: int
    email: str
    name: str
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
    group_name: Optional[str] = None

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
    tieResolution: Optional[str] = None   # "extraTime" | "penalties"
    extraTimeHome: Optional[int] = None
    extraTimeAway: Optional[int] = None
    penaltyWinner: Optional[str] = None   # "home" | "away"

class ClassicPredictionCreate(BaseModel):
    knockout_scores: dict[str, KnockoutScoreEntry]
    group_fixtures: Optional[list[GroupFixturePayload]] = None   # legacy, ignorado
    selected_thirds: Optional[list[str]] = None
    third_assignments: Optional[dict[str, str]] = None
    is_bracket_generated: Optional[bool] = False
    captain_matches: Optional[list[str]] = None
    bracket_snapshot: Optional[dict[str, dict[str, str]]] = None  # legacy, ignorado
    top_scorer: Optional[str] = None
    top_assist: Optional[str] = None
    best_young_player: Optional[str] = None

class ClassicPredictionResponse(BaseModel):
    id: int
    updated_at: datetime

    class Config:
        from_attributes = True

class ClassicPredictionFull(BaseModel):
    group_fixtures:        list[GroupFixturePayload] = []
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
    top_scorer:            Optional[str] = None
    top_assist:            Optional[str] = None
    best_young_player:     Optional[str] = None
    awards_locked:         bool = True


class MatchScoreInput(BaseModel):
    id:        Optional[str] = None
    homeTeam:  str
    awayTeam:  str
    homeScore: int
    awayScore: int


class ClassicScoreRequest(BaseModel):
    real_group_results:    list[MatchScoreInput]
    real_knockout_results: dict[str, KnockoutScoreEntry]
    real_champion:         Optional[str] = None
    # Nuevos resultados oficiales de la API/Admin para calcular los bonus
    real_top_scorer:       Optional[str] = None
    real_top_assist:       Optional[str] = None
    real_best_young_player: Optional[str] = None


class MatchScoreDetail(BaseModel):
    match_id:   str
    outcome:    str
    base:       int
    multiplier: int
    captain:    bool
    points:     int


class ClassicScoreResponse(BaseModel):
    total_points:     int
    exact_count:      int
    difference_count: int
    tendency_count:   int
    miss_count:       int
    champion_bonus:   int
    # Desglose de puntos de los nuevos bonos en la respuesta de puntos
    top_scorer_bonus: int = 0
    top_assist_bonus: int = 0
    best_young_player_bonus: int = 0
    effectiveness:    float
    match_details:    list[MatchScoreDetail]

class CheckoutSessionResponse(BaseModel):
    checkout_url: str

class LeaderboardUserInfo(BaseModel):
    id: int
    email: str
    name: str = ""
    last_active: Optional[datetime] = None
    is_online: Optional[bool] = None

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
    diff_matches_count: int
    tendency_matches_count: int
    rank_change: int = 0
    live_points_earned: int = 0

class GlobalSurvivorEntry(BaseModel):
    user: LeaderboardUserInfo
    is_alive: bool
    last_team_picked: Optional[str]


# ─── Feed Global de Picks ──────────────────────────────────────────────────────

class DailyFeedPick(BaseModel):
    user_name: str
    pred_home: Optional[int] = None
    pred_away: Optional[int] = None
    tendency: Optional[str] = None  # "H" | "D" | "A"

class DailyFeedMatch(BaseModel):
    id: int
    home_team: str
    away_team: str
    status: str
    home_score: Optional[int] = None
    away_score: Optional[int] = None
    kickoff_time: datetime
    picks: list[DailyFeedPick] = []

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
    jornada_id: int          # 1–8 (grupo 1, group 2, group 3, R32, R16, QF, SF, Final)
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


# ─── Auditoría de Admin ───────────────────────────────────────────────────────

class UserAuditOut(BaseModel):
    id: int
    name: str
    email: str
    has_paid_classic: bool
    has_paid_survival: bool
    classic_picks_filled: int
    classic_picks_total: int
    survival_status: Optional[str]            # "alive" | "eliminated" | None
    survival_jornada1_pick: Optional[str]      # equipo elegido en Jornada 1
    classic_picks: list[GroupFixturePayload] = []  # marcadores pronosticados (modo clásico)
    login_count: int = 0
    last_active: Optional[datetime] = None