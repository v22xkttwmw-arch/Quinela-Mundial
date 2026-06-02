from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Float, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    is_paid = Column(Boolean, default=False)
    is_admin = Column(Boolean, default=False)
    has_paid_classic = Column(Boolean, default=False)
    has_paid_survival = Column(Boolean, default=False)
    has_extra_life = Column(Boolean, default=False)
    total_points = Column(Integer, default=0)
    is_alive = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    predictions = relationship("Prediction", back_populates="user")
    leaderboard = relationship("Leaderboard", back_populates="user", uselist=False)
    owned_groups = relationship("Group", back_populates="owner")
    group_memberships = relationship("GroupMember", back_populates="user")
    survivor_picks = relationship("SurvivorPick", back_populates="user")
    classic_prediction = relationship("ClassicPrediction", back_populates="user", uselist=False)

class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    stripe_session_id = Column(String, unique=True, nullable=False)
    amount = Column(Float, nullable=False)
    status = Column(String, default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)

class Match(Base):
    __tablename__ = "matches"

    id = Column(Integer, primary_key=True, index=True)
    api_match_id = Column(Integer, unique=True, index=True)
    home_team = Column(String, nullable=False)
    away_team = Column(String, nullable=False)
    status = Column(String, default="NS")
    elapsed = Column(Integer, nullable=True)
    home_score = Column(Integer, nullable=True)
    away_score = Column(Integer, nullable=True)
    kickoff_time = Column(DateTime, nullable=False)

    predictions = relationship("Prediction", back_populates="match")
    survivor_picks = relationship("SurvivorPick", back_populates="match")

class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    match_id = Column(Integer, ForeignKey("matches.id"), nullable=False)
    predicted_home = Column(Integer, nullable=False)
    predicted_away = Column(Integer, nullable=False)
    points_earned = Column(Integer, default=0)
    exact_points = Column(Integer, default=0)
    tendency_points = Column(Integer, default=0)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="predictions")
    match = relationship("Match", back_populates="predictions")

class Leaderboard(Base):
    __tablename__ = "leaderboard"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    total_points = Column(Integer, default=0)
    exact_matches_count = Column(Integer, default=0)
    rank_position = Column(Integer, nullable=True)

    user = relationship("User", back_populates="leaderboard")

class Group(Base):
    __tablename__ = "groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    is_premium = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", back_populates="owned_groups")
    members = relationship("GroupMember", back_populates="group")
    survivor_picks = relationship("SurvivorPick", back_populates="group")

class GroupMember(Base):
    __tablename__ = "group_members"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    is_alive = Column(Boolean, default=True)
    joined_at = Column(DateTime, default=datetime.utcnow)

    group = relationship("Group", back_populates="members")
    user = relationship("User", back_populates="group_memberships")

class ClassicPrediction(Base):
    __tablename__ = "classic_predictions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    group_fixtures = Column(Text, nullable=False)
    knockout_scores = Column(Text, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="classic_prediction")


class SurvivorPick(Base):
    __tablename__ = "survivor_picks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=True)
    match_id = Column(Integer, ForeignKey("matches.id"), nullable=False)
    team_id = Column(String, nullable=False)
    is_correct = Column(Boolean, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="survivor_picks")
    group = relationship("Group", back_populates="survivor_picks")
    match = relationship("Match", back_populates="survivor_picks")