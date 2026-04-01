from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func
from sqlalchemy.orm import Session

from .config import get_settings
from .database import Base, engine, get_db
from .models import ScoreAttempt
from .schemas import (
    ALLOWED_GAMES,
    GameDashboardStats,
    LeaderboardRow,
    PlayerDashboardStats,
    PlayerGameStats,
    ScoreCreate,
    ScoreRead,
)

settings = get_settings()
app = FastAPI(title="Brain Games API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/scores", response_model=PlayerGameStats)
def submit_score(payload: ScoreCreate, db: Session = Depends(get_db)) -> PlayerGameStats:
    player_name = payload.player_name

    attempt = ScoreAttempt(
        player_name=player_name,
        game=payload.game,
        score=payload.score,
    )
    db.add(attempt)
    db.commit()

    stats_row = (
        db.query(
            func.max(ScoreAttempt.score).label("high_score"),
            func.avg(ScoreAttempt.score).label("average_score"),
            func.count(ScoreAttempt.id).label("attempts"),
        )
        .filter(
            ScoreAttempt.player_name == player_name,
            ScoreAttempt.game == payload.game,
        )
        .one()
    )

    return PlayerGameStats(
        player_name=player_name,
        game=payload.game,
        high_score=int(stats_row.high_score or 0),
        average_score=round(float(stats_row.average_score or 0), 2),
        attempts=int(stats_row.attempts or 0),
    )


@app.get("/api/scores/{game}/{player_name}", response_model=PlayerGameStats)
def get_player_game_stats(game: str, player_name: str, db: Session = Depends(get_db)) -> PlayerGameStats:
    normalized_game = game.strip()
    normalized_player = player_name.strip()

    if normalized_game not in ALLOWED_GAMES:
        raise HTTPException(status_code=400, detail=f"Invalid game: {game}")

    stats_row = (
        db.query(
            func.max(ScoreAttempt.score).label("high_score"),
            func.avg(ScoreAttempt.score).label("average_score"),
            func.count(ScoreAttempt.id).label("attempts"),
        )
        .filter(ScoreAttempt.player_name == normalized_player, ScoreAttempt.game == normalized_game)
        .one()
    )

    attempts = int(stats_row.attempts or 0)
    if attempts == 0:
        raise HTTPException(status_code=404, detail="No scores yet for this player and game")

    return PlayerGameStats(
        player_name=normalized_player,
        game=normalized_game,
        high_score=int(stats_row.high_score or 0),
        average_score=round(float(stats_row.average_score or 0), 2),
        attempts=attempts,
    )


@app.get("/api/leaderboard/{game}", response_model=list[LeaderboardRow])
def get_leaderboard(
    game: str,
    limit: int = Query(default=10, ge=1, le=100),
    db: Session = Depends(get_db),
) -> list[LeaderboardRow]:
    normalized_game = game.strip()
    if normalized_game not in ALLOWED_GAMES:
        raise HTTPException(status_code=400, detail=f"Invalid game: {game}")

    rows = (
        db.query(
            ScoreAttempt.player_name.label("player_name"),
            func.max(ScoreAttempt.score).label("high_score"),
            func.avg(ScoreAttempt.score).label("average_score"),
            func.count(ScoreAttempt.id).label("attempts"),
        )
        .filter(ScoreAttempt.game == normalized_game)
        .group_by(ScoreAttempt.player_name)
        .order_by(func.max(ScoreAttempt.score).desc(), func.avg(ScoreAttempt.score).desc())
        .limit(limit)
        .all()
    )

    return [
        LeaderboardRow(
            player_name=str(row.player_name),
            high_score=int(row.high_score or 0),
            average_score=round(float(row.average_score or 0), 2),
            attempts=int(row.attempts or 0),
        )
        for row in rows
    ]


@app.get("/api/scores/recent", response_model=list[ScoreRead])
def get_recent_scores(limit: int = Query(default=20, ge=1, le=100), db: Session = Depends(get_db)) -> list[ScoreRead]:
    rows = db.query(ScoreAttempt).order_by(ScoreAttempt.created_at.desc()).limit(limit).all()
    return rows


@app.get("/api/dashboard/{player_name}", response_model=PlayerDashboardStats)
def get_player_dashboard(player_name: str, db: Session = Depends(get_db)) -> PlayerDashboardStats:
    normalized_player = player_name.strip()

    rows = (
        db.query(
            ScoreAttempt.game.label("game"),
            func.max(ScoreAttempt.score).label("high_score"),
            func.avg(ScoreAttempt.score).label("average_score"),
            func.count(ScoreAttempt.id).label("attempts"),
        )
        .filter(ScoreAttempt.player_name == normalized_player)
        .group_by(ScoreAttempt.game)
        .all()
    )

    by_game = {
        str(row.game): GameDashboardStats(
            game=str(row.game),
            high_score=int(row.high_score or 0),
            average_score=round(float(row.average_score or 0), 2),
            attempts=int(row.attempts or 0),
        )
        for row in rows
    }

    games = [
        by_game.get(
            game,
            GameDashboardStats(
                game=game,
                high_score=0,
                average_score=0.0,
                attempts=0,
            ),
        )
        for game in sorted(ALLOWED_GAMES)
    ]

    total_attempts = sum(game.attempts for game in games)
    games_played = sum(1 for game in games if game.attempts > 0)

    return PlayerDashboardStats(
        player_name=normalized_player,
        total_attempts=total_attempts,
        games_played=games_played,
        games=games,
    )
