from datetime import datetime

from pydantic import BaseModel, Field, field_validator

ALLOWED_GAMES = {"number_memory", "sequence_memory"}


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