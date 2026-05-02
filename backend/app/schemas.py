from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator

ALLOWED_GAMES = {"number_memory", "sequence_memory", "verbal_memory"}


class ScoreCreate(BaseModel):
    player_name: str = Field(..., min_length=2, max_length=64)
    game: str
    score: int = Field(..., ge=0)

    @field_validator("player_name")
    @classmethod
    def validate_player_name(cls, value: str) -> str:
        normalized = value.strip()
        if len(normalized) < 2:
            raise ValueError("Player name must be at least 2 non-space characters")
        return normalized

    @field_validator("game")
    @classmethod
    def validate_game(cls, value: str) -> str:
        normalized = value.strip()
        if normalized not in ALLOWED_GAMES:
            raise ValueError(f"Game must be one of: {', '.join(sorted(ALLOWED_GAMES))}")
        return normalized


class ScoreRead(BaseModel):
    id: int
    player_name: str
    game: str
    score: int
    created_at: datetime

    model_config = {"from_attributes": True}


class PlayerGameStats(BaseModel):
    player_name: str
    game: str
    high_score: int
    average_score: float
    attempts: int


class LeaderboardRow(BaseModel):
    player_name: str
    high_score: int
    average_score: float
    attempts: int


class GameDashboardStats(BaseModel):
    game: str
    high_score: int
    average_score: float
    attempts: int


class PlayerDashboardStats(BaseModel):
    player_name: str
    total_attempts: int
    games_played: int
    games: list[GameDashboardStats]


class RunStartCreate(BaseModel):
    player_name: str | None = Field(default=None, max_length=64)
    game: str
    event_schema_version: int = Field(default=1, ge=1)

    @field_validator("player_name")
    @classmethod
    def validate_optional_player_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        if not normalized:
            return None
        if len(normalized) < 2:
            raise ValueError("Player name must be at least 2 non-space characters")
        return normalized

    @field_validator("game")
    @classmethod
    def validate_game(cls, value: str) -> str:
        normalized = value.strip()
        if normalized not in ALLOWED_GAMES:
            raise ValueError(f"Game must be one of: {', '.join(sorted(ALLOWED_GAMES))}")
        return normalized


class RunStartRead(BaseModel):
    run_id: int
    player_name: str | None
    game: str
    run_status: str
    event_schema_version: int
    started_at: datetime


class TrialEventCreate(BaseModel):
    trial_index: int = Field(..., ge=1)
    occurred_at: datetime | None = None
    event_name: str = Field(default="trial_resolved", min_length=1, max_length=64)
    difficulty_level: int = Field(default=0, ge=0)
    reaction_ms: int | None = Field(default=None, ge=0)
    correct: bool
    score_before: int = Field(..., ge=0)
    score_after: int = Field(..., ge=0)
    lives_before: int | None = Field(default=None, ge=0)
    lives_after: int | None = Field(default=None, ge=0)
    event_payload: dict[str, Any] = Field(default_factory=dict)
    event_schema_version: int = Field(default=1, ge=1)


class TrialEventsBatchCreate(BaseModel):
    events: list[TrialEventCreate] = Field(..., min_length=1, max_length=200)


class TrialEventsBatchRead(BaseModel):
    run_id: int
    accepted_count: int
    total_run_events: int


class RunEndCreate(BaseModel):
    final_score: int = Field(..., ge=0)
    end_reason: str = Field(default="completed", min_length=1, max_length=32)
    final_lives: int | None = Field(default=None, ge=0)
    total_trials: int | None = Field(default=None, ge=0)


class RunEndRead(BaseModel):
    run_id: int
    run_status: str
    final_score: int
    final_lives: int | None
    total_trials: int | None
    event_count: int
    ended_at: datetime
