import json
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
    RunEndCreate,
    RunEndRead,
    RunStartCreate,
    RunStartRead,
    ScoreCreate,
    ScoreRead,
    TrialEventsBatchCreate,
    TrialEventsBatchRead,
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

VALID_RUN_END_REASONS = {"completed", "abandoned", "timeout", "quit"}


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


def _load_run_or_404(db: Connection, run_id: int) -> dict[str, Any]:
    with db.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                id,
                player_name,
                game,
                run_status,
                event_schema_version,
                event_count,
                final_score,
                final_lives,
                total_trials,
                ended_at
            FROM game_runs
            WHERE id = %s
            """,
            (run_id,),
        )
        row = cursor.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Run not found")

    return row


@app.post("/api/runs/start", response_model=RunStartRead)
def start_run(payload: RunStartCreate, db: Connection = Depends(get_db)) -> RunStartRead:
    with db.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO game_runs (player_name, game, run_status, event_schema_version)
            VALUES (%s, %s, 'active', %s)
            """,
            (payload.player_name, payload.game, payload.event_schema_version),
        )
        run_id = int(cursor.lastrowid)

        cursor.execute(
            """
            SELECT id, player_name, game, run_status, event_schema_version, started_at
            FROM game_runs
            WHERE id = %s
            """,
            (run_id,),
        )
        row = cursor.fetchone()

    db.commit()

    if not row:
        raise HTTPException(status_code=500, detail="Failed to create run")

    return RunStartRead(
        run_id=int(row["id"]),
        player_name=row["player_name"],
        game=str(row["game"]),
        run_status=str(row["run_status"]),
        event_schema_version=int(row["event_schema_version"]),
        started_at=row["started_at"],
    )


@app.post("/api/runs/{run_id}/events/batch", response_model=TrialEventsBatchRead)
def add_run_events(
    run_id: int,
    payload: TrialEventsBatchCreate,
    db: Connection = Depends(get_db),
) -> TrialEventsBatchRead:
    run_row = _load_run_or_404(db, run_id)
    if run_row["run_status"] != "active":
        raise HTTPException(status_code=409, detail="Run is no longer active")

    with db.cursor() as cursor:
        rows = [
            (
                run_id,
                run_row["player_name"],
                run_row["game"],
                event.trial_index,
                event.occurred_at,
                event.event_name,
                event.difficulty_level,
                event.reaction_ms,
                int(event.correct),
                event.score_before,
                event.score_after,
                event.lives_before,
                event.lives_after,
                json.dumps(event.event_payload),
                event.event_schema_version,
            )
            for event in payload.events
        ]

        cursor.executemany(
            """
            INSERT INTO trial_events (
                run_id,
                player_name,
                game,
                trial_index,
                occurred_at,
                event_name,
                difficulty_level,
                reaction_ms,
                correct,
                score_before,
                score_after,
                lives_before,
                lives_after,
                event_payload,
                event_schema_version
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
                occurred_at = VALUES(occurred_at),
                event_name = VALUES(event_name),
                difficulty_level = VALUES(difficulty_level),
                reaction_ms = VALUES(reaction_ms),
                correct = VALUES(correct),
                score_before = VALUES(score_before),
                score_after = VALUES(score_after),
                lives_before = VALUES(lives_before),
                lives_after = VALUES(lives_after),
                event_payload = VALUES(event_payload),
                event_schema_version = VALUES(event_schema_version),
                updated_at = CURRENT_TIMESTAMP
            """,
            rows,
        )

        cursor.execute(
            """
            SELECT COUNT(id) AS total_events
            FROM trial_events
            WHERE run_id = %s
            """,
            (run_id,),
        )
        total_events_row = cursor.fetchone()
        total_events = int((total_events_row or {}).get("total_events") or 0)

        cursor.execute(
            """
            UPDATE game_runs
            SET event_count = %s
            WHERE id = %s
            """,
            (total_events, run_id),
        )

    db.commit()

    return TrialEventsBatchRead(
        run_id=run_id,
        accepted_count=len(payload.events),
        total_run_events=total_events,
    )


@app.post("/api/runs/{run_id}/end", response_model=RunEndRead)
def end_run(
    run_id: int,
    payload: RunEndCreate,
    db: Connection = Depends(get_db),
) -> RunEndRead:
    normalized_reason = payload.end_reason.strip().lower()
    if normalized_reason not in VALID_RUN_END_REASONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid end_reason: {payload.end_reason}",
        )

    run_row = _load_run_or_404(db, run_id)
    if run_row["run_status"] != "active":
        if not run_row.get("ended_at"):
            raise HTTPException(status_code=409, detail="Run is no longer active")

        return RunEndRead(
            run_id=int(run_row["id"]),
            run_status=str(run_row["run_status"]),
            final_score=int(run_row["final_score"] or 0),
            final_lives=(int(run_row["final_lives"]) if run_row["final_lives"] is not None else None),
            total_trials=(int(run_row["total_trials"]) if run_row["total_trials"] is not None else None),
            event_count=int(run_row["event_count"] or 0),
            ended_at=run_row["ended_at"],
        )

    with db.cursor() as cursor:
        cursor.execute(
            """
            SELECT COUNT(id) AS total_events
            FROM trial_events
            WHERE run_id = %s
            """,
            (run_id,),
        )
        total_events_row = cursor.fetchone()
        total_events = int((total_events_row or {}).get("total_events") or 0)

        total_trials = payload.total_trials if payload.total_trials is not None else total_events

        run_status = "completed" if normalized_reason == "completed" else "abandoned"

        cursor.execute(
            """
            UPDATE game_runs
            SET
                run_status = %s,
                end_reason = %s,
                final_score = %s,
                final_lives = %s,
                total_trials = %s,
                event_count = %s,
                ended_at = CURRENT_TIMESTAMP
            WHERE id = %s
            """,
            (
                run_status,
                normalized_reason,
                payload.final_score,
                payload.final_lives,
                total_trials,
                total_events,
                run_id,
            ),
        )

        cursor.execute(
            """
            SELECT
                id,
                run_status,
                final_score,
                final_lives,
                total_trials,
                event_count,
                ended_at
            FROM game_runs
            WHERE id = %s
            """,
            (run_id,),
        )
        updated_row = cursor.fetchone()

    db.commit()

    if not updated_row or not updated_row.get("ended_at"):
        raise HTTPException(status_code=500, detail="Failed to close run")

    return RunEndRead(
        run_id=int(updated_row["id"]),
        run_status=str(updated_row["run_status"]),
        final_score=int(updated_row["final_score"] or 0),
        final_lives=(int(updated_row["final_lives"]) if updated_row["final_lives"] is not None else None),
        total_trials=(int(updated_row["total_trials"]) if updated_row["total_trials"] is not None else None),
        event_count=int(updated_row["event_count"] or 0),
        ended_at=updated_row["ended_at"],
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
