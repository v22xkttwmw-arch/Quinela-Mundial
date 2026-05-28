from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class UserCreate(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    id: int
    email: str
    is_paid: bool
    is_admin: bool
    created_at: datetime

    class Config:
        from_attributes = True

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
    home_team: str
    away_team: str
    status: str
    home_score: Optional[int]
    away_score: Optional[int]
    kickoff_time: datetime

    class Config:
        from_attributes = True

class MatchResult(BaseModel):
    home_score: int
    away_score: int

class MatchResultCreate(BaseModel):
    home_score: int
    away_score: int
    winning_team: str

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