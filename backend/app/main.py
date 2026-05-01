from typing import Any

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pymysql.connections import Connection

from .config import get_settings
from .database import get_connection, get_db
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
    db = get_connection()
    try:
        with db.cursor() as cursor:
            cursor.execute("SELECT 1")
    finally:
        db.close()


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


def _build_player_game_stats(row: dict[str, Any], player_name: str, game: str) -> PlayerGameStats:
    return PlayerGameStats(
        player_name=player_name,
        game=game,
        high_score=int(row["high_score"] or 0),
        average_score=round(float(row["average_score"] or 0), 2),
        attempts=int(row["attempts"] or 0),
    )


@app.post("/api/scores", response_model=PlayerGameStats)
def submit_score(payload: ScoreCreate, db: Connection = Depends(get_db)) -> PlayerGameStats:
    player_name = payload.player_name

    with db.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO score_attempts (player_name, game, score)
            VALUES (%s, %s, %s)
            """,
            (player_name, payload.game, payload.score),
        )
        db.commit()

        cursor.execute(
            """
            SELECT
                MAX(score) AS high_score,
                AVG(score) AS average_score,
                COUNT(id) AS attempts
            FROM score_attempts
            WHERE player_name = %s AND game = %s
            """,
            (player_name, payload.game),
        )
        stats_row = cursor.fetchone()

    if not stats_row:
        raise HTTPException(status_code=500, detail="Failed to compute player stats")

    return _build_player_game_stats(stats_row, player_name=player_name, game=payload.game)


@app.get("/api/scores/{game}/{player_name}", response_model=PlayerGameStats)
def get_player_game_stats(game: str, player_name: str, db: Connection = Depends(get_db)) -> PlayerGameStats:
    normalized_game = game.strip()
    normalized_player = player_name.strip()

    if normalized_game not in ALLOWED_GAMES:
        raise HTTPException(status_code=400, detail=f"Invalid game: {game}")

    with db.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                MAX(score) AS high_score,
                AVG(score) AS average_score,
                COUNT(id) AS attempts
            FROM score_attempts
            WHERE player_name = %s AND game = %s
            """,
            (normalized_player, normalized_game),
        )
        stats_row = cursor.fetchone()

    attempts = int((stats_row or {}).get("attempts") or 0)
    if attempts == 0:
        raise HTTPException(status_code=404, detail="No scores yet for this player and game")

    return _build_player_game_stats(stats_row, player_name=normalized_player, game=normalized_game)


@app.get("/api/leaderboard/{game}", response_model=list[LeaderboardRow])
def get_leaderboard(
    game: str,
    limit: int = Query(default=10, ge=1, le=100),
    db: Connection = Depends(get_db),
) -> list[LeaderboardRow]:
    normalized_game = game.strip()
    if normalized_game not in ALLOWED_GAMES:
        raise HTTPException(status_code=400, detail=f"Invalid game: {game}")

    with db.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                player_name,
                MAX(score) AS high_score,
                AVG(score) AS average_score,
                COUNT(id) AS attempts
            FROM score_attempts
            WHERE game = %s
            GROUP BY player_name
            ORDER BY MAX(score) DESC, AVG(score) DESC
            LIMIT %s
            """,
            (normalized_game, limit),
        )
        rows = cursor.fetchall()

    return [
        LeaderboardRow(
            player_name=str(row["player_name"]),
            high_score=int(row["high_score"] or 0),
            average_score=round(float(row["average_score"] or 0), 2),
            attempts=int(row["attempts"] or 0),
        )
        for row in rows
    ]


@app.get("/api/scores/recent", response_model=list[ScoreRead])
def get_recent_scores(limit: int = Query(default=20, ge=1, le=100), db: Connection = Depends(get_db)) -> list[ScoreRead]:
    with db.cursor() as cursor:
        cursor.execute(
            """
            SELECT id, player_name, game, score, created_at
            FROM score_attempts
            ORDER BY created_at DESC
            LIMIT %s
            """,
            (limit,),
        )
        rows = cursor.fetchall()

    return [ScoreRead(**row) for row in rows]


@app.get("/api/dashboard/{player_name}", response_model=PlayerDashboardStats)
def get_player_dashboard(player_name: str, db: Connection = Depends(get_db)) -> PlayerDashboardStats:
    normalized_player = player_name.strip()

    with db.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                game,
                MAX(score) AS high_score,
                AVG(score) AS average_score,
                COUNT(id) AS attempts
            FROM score_attempts
            WHERE player_name = %s
            GROUP BY game
            """,
            (normalized_player,),
        )
        rows = cursor.fetchall()

    by_game = {
        str(row["game"]): GameDashboardStats(
            game=str(row["game"]),
            high_score=int(row["high_score"] or 0),
            average_score=round(float(row["average_score"] or 0), 2),
            attempts=int(row["attempts"] or 0),
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
