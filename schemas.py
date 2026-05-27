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