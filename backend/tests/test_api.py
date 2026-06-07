import os
import unittest
from collections.abc import Generator
from copy import deepcopy
from datetime import datetime, timedelta

from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.database import get_db
from app.main import create_app


class FakeCursor:
    def __init__(self, state: dict[str, object]) -> None:
        self.state = state
        self.lastrowid = 0
        self._one: dict[str, object] | None = None
        self._many: list[dict[str, object]] = []

    def __enter__(self) -> "FakeCursor":
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        return None

    def fetchone(self) -> dict[str, object] | None:
        if self._one is not None:
            return deepcopy(self._one)
        if self._many:
            return deepcopy(self._many[0])
        return None

    def fetchall(self) -> list[dict[str, object]]:
        return deepcopy(self._many)

    def execute(self, query: str, params: tuple[object, ...] | None = None) -> int:
        normalized = " ".join(query.split()).lower()
        params = params or ()
        self._one = None
        self._many = []

        if normalized == "select 1":
            self._one = {"1": 1}
            return 1

        if normalized.startswith("insert into score_attempts"):
            self._insert_score_attempt(params)
            return 1

        if "from score_attempts" in normalized and "where player_name = %s and game = %s" in normalized:
            player_name, game = params
            self._one = self._build_player_stats(str(player_name), str(game))
            return 1

        if "from score_attempts" in normalized and "group by player_name" in normalized:
            game, limit = params
            self._many = self._build_leaderboard(str(game), int(limit))
            return len(self._many)

        if normalized.startswith("select id, player_name, game, score, created_at from score_attempts"):
            (limit,) = params
            rows = sorted(
                self.state["score_attempts"],
                key=lambda row: row["created_at"],
                reverse=True,
            )
            self._many = [deepcopy(row) for row in rows[: int(limit)]]
            return len(self._many)

        if "from score_attempts" in normalized and "group by game" in normalized:
            (player_name,) = params
            self._many = self._build_dashboard_rows(str(player_name))
            return len(self._many)

        if normalized.startswith("insert into game_runs"):
            self._insert_game_run(params)
            return 1

        if "from game_runs" in normalized and "where id = %s" in normalized:
            (run_id,) = params
            run = deepcopy(self.state["game_runs"].get(int(run_id)))
            self._one = run
            return 1 if run else 0

        if normalized.startswith("select count(id) as total_events from trial_events"):
            (run_id,) = params
            total_events = sum(1 for row in self.state["trial_events"].values() if row["run_id"] == int(run_id))
            self._one = {"total_events": total_events}
            return 1

        if normalized.startswith("update game_runs set event_count = %s where id = %s"):
            event_count, run_id = params
            self.state["game_runs"][int(run_id)]["event_count"] = int(event_count)
            return 1

        if normalized.startswith("update game_runs set run_status = %s, end_reason = %s, final_score = %s, final_lives = %s, total_trials = %s, event_count = %s, ended_at = current_timestamp where id = %s"):
            run_status, end_reason, final_score, final_lives, total_trials, event_count, run_id = params
            run = self.state["game_runs"][int(run_id)]
            run["run_status"] = str(run_status)
            run["end_reason"] = str(end_reason)
            run["final_score"] = int(final_score)
            run["final_lives"] = None if final_lives is None else int(final_lives)
            run["total_trials"] = None if total_trials is None else int(total_trials)
            run["event_count"] = int(event_count)
            run["ended_at"] = self.state["clock"]
            self.state["clock"] += timedelta(seconds=1)
            return 1

        raise AssertionError(f"Unhandled query: {normalized}")

    def executemany(self, query: str, rows: list[tuple[object, ...]]) -> int:
        normalized = " ".join(query.split()).lower()
        if not normalized.startswith("insert into trial_events"):
            raise AssertionError(f"Unhandled executemany query: {normalized}")

        for row in rows:
            (
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
                event_schema_version,
            ) = row
            key = (int(run_id), int(trial_index))
            existing = self.state["trial_events"].get(key)
            if existing is None:
                event_id = self.state["next_trial_event_id"]
                self.state["next_trial_event_id"] += 1
            else:
                event_id = existing["id"]

            self.state["trial_events"][key] = {
                "id": event_id,
                "run_id": int(run_id),
                "player_name": player_name,
                "game": game,
                "trial_index": int(trial_index),
                "occurred_at": occurred_at,
                "event_name": event_name,
                "difficulty_level": int(difficulty_level),
                "reaction_ms": reaction_ms,
                "correct": int(correct),
                "score_before": int(score_before),
                "score_after": int(score_after),
                "lives_before": lives_before,
                "lives_after": lives_after,
                "event_payload": event_payload,
                "event_schema_version": int(event_schema_version),
            }
        return len(rows)

    def _insert_score_attempt(self, params: tuple[object, ...]) -> None:
        player_name, game, score = params
        score_id = self.state["next_score_id"]
        self.state["next_score_id"] += 1
        row = {
            "id": score_id,
            "player_name": str(player_name),
            "game": str(game),
            "score": int(score),
            "created_at": self.state["clock"],
        }
        self.state["clock"] += timedelta(seconds=1)
        self.state["score_attempts"].append(row)
        self.lastrowid = score_id

    def _insert_game_run(self, params: tuple[object, ...]) -> None:
        player_name, game, event_schema_version = params
        run_id = self.state["next_run_id"]
        self.state["next_run_id"] += 1
        row = {
            "id": run_id,
            "player_name": player_name,
            "game": str(game),
            "run_status": "active",
            "end_reason": None,
            "final_score": None,
            "final_lives": None,
            "total_trials": None,
            "event_count": 0,
            "event_schema_version": int(event_schema_version),
            "started_at": self.state["clock"],
            "ended_at": None,
        }
        self.state["clock"] += timedelta(seconds=1)
        self.state["game_runs"][run_id] = row
        self.lastrowid = run_id

    def _build_player_stats(self, player_name: str, game: str) -> dict[str, object]:
        rows = [
            row
            for row in self.state["score_attempts"]
            if row["player_name"] == player_name and row["game"] == game
        ]
        if not rows:
            return {"high_score": None, "average_score": None, "attempts": 0}
        scores = [row["score"] for row in rows]
        return {
            "high_score": max(scores),
            "average_score": sum(scores) / len(scores),
            "attempts": len(scores),
        }

    def _build_leaderboard(self, game: str, limit: int) -> list[dict[str, object]]:
        grouped: dict[str, list[int]] = {}
        for row in self.state["score_attempts"]:
            if row["game"] != game:
                continue
            grouped.setdefault(row["player_name"], []).append(row["score"])

        rows = [
            {
                "player_name": player_name,
                "high_score": max(scores),
                "average_score": sum(scores) / len(scores),
                "attempts": len(scores),
            }
            for player_name, scores in grouped.items()
        ]
        rows.sort(key=lambda row: (-row["high_score"], -row["average_score"], row["player_name"]))
        return rows[:limit]

    def _build_dashboard_rows(self, player_name: str) -> list[dict[str, object]]:
        grouped: dict[str, list[int]] = {}
        for row in self.state["score_attempts"]:
            if row["player_name"] != player_name:
                continue
            grouped.setdefault(row["game"], []).append(row["score"])

        return [
            {
                "game": game,
                "high_score": max(scores),
                "average_score": sum(scores) / len(scores),
                "attempts": len(scores),
            }
            for game, scores in grouped.items()
        ]


class FakeConnection:
    def __init__(self) -> None:
        self.state: dict[str, object] = {
            "clock": datetime(2026, 6, 7, 12, 0, 0),
            "next_score_id": 1,
            "next_run_id": 1,
            "next_trial_event_id": 1,
            "score_attempts": [],
            "game_runs": {},
            "trial_events": {},
        }

    def cursor(self) -> FakeCursor:
        return FakeCursor(self.state)

    def commit(self) -> None:
        return None

    def close(self) -> None:
        return None


class ApiSmokeTests(unittest.TestCase):
    def setUp(self) -> None:
        get_settings.cache_clear()
        self.db = FakeConnection()
        self.app = create_app(perform_startup_check=False)

        def override_db() -> Generator[FakeConnection, None, None]:
            yield self.db

        self.app.dependency_overrides[get_db] = override_db
        self.client = TestClient(self.app)

    def tearDown(self) -> None:
        self.client.close()
        get_settings.cache_clear()

    def test_settings_ignore_extra_env_keys(self) -> None:
        original = os.environ.get("MYSQL_DRIVER")
        os.environ["MYSQL_DRIVER"] = "mysql+pymysql"
        try:
            get_settings.cache_clear()
            settings = Settings()
            self.assertEqual(settings.mysql_database, "brain_games")
        finally:
            if original is None:
                os.environ.pop("MYSQL_DRIVER", None)
            else:
                os.environ["MYSQL_DRIVER"] = original

    def test_score_and_dashboard_flow(self) -> None:
        self.assertEqual(self.client.get("/api/health").json(), {"status": "ok"})

        first = self.client.post(
            "/api/scores",
            json={"player_name": "Aryan", "game": "number_memory", "score": 5},
        )
        self.assertEqual(first.status_code, 200)
        self.assertEqual(first.json()["high_score"], 5)

        second = self.client.post(
            "/api/scores",
            json={"player_name": "Aryan", "game": "number_memory", "score": 9},
        )
        self.assertEqual(second.status_code, 200)
        self.assertEqual(second.json()["average_score"], 7.0)

        other = self.client.post(
            "/api/scores",
            json={"player_name": "Mira", "game": "number_memory", "score": 7},
        )
        self.assertEqual(other.status_code, 200)

        stats = self.client.get("/api/scores/number_memory/Aryan")
        self.assertEqual(stats.status_code, 200)
        self.assertEqual(stats.json()["attempts"], 2)

        leaderboard = self.client.get("/api/leaderboard/number_memory?limit=8")
        self.assertEqual(leaderboard.status_code, 200)
        rows = leaderboard.json()
        self.assertEqual(rows[0]["player_name"], "Aryan")
        self.assertEqual(rows[1]["player_name"], "Mira")

        recent = self.client.get("/api/scores/recent?limit=2")
        self.assertEqual(recent.status_code, 200)
        self.assertEqual(len(recent.json()), 2)

        dashboard = self.client.get("/api/dashboard/Aryan")
        self.assertEqual(dashboard.status_code, 200)
        payload = dashboard.json()
        self.assertEqual(payload["total_attempts"], 2)
        self.assertEqual(payload["games_played"], 1)

        invalid = self.client.get("/api/leaderboard/not_a_game")
        self.assertEqual(invalid.status_code, 400)
        self.assertIn("Game must be one of", invalid.json()["detail"])

    def test_run_lifecycle_is_idempotent(self) -> None:
        start = self.client.post(
            "/api/runs/start",
            json={"player_name": "Aryan", "game": "sequence_memory", "event_schema_version": 1},
        )
        self.assertEqual(start.status_code, 200)
        run_id = start.json()["run_id"]

        batch_payload = {
            "events": [
                {
                    "trial_index": 1,
                    "event_name": "trial_resolved",
                    "difficulty_level": 1,
                    "reaction_ms": 420,
                    "correct": True,
                    "score_before": 0,
                    "score_after": 1,
                    "event_payload": {"sequence_length": 1},
                },
                {
                    "trial_index": 1,
                    "event_name": "trial_resolved",
                    "difficulty_level": 1,
                    "reaction_ms": 410,
                    "correct": True,
                    "score_before": 0,
                    "score_after": 1,
                    "event_payload": {"sequence_length": 1, "replayed": True},
                },
            ]
        }
        batch = self.client.post(f"/api/runs/{run_id}/events/batch", json=batch_payload)
        self.assertEqual(batch.status_code, 200)
        self.assertEqual(batch.json()["total_run_events"], 1)

        end = self.client.post(
            f"/api/runs/{run_id}/end",
            json={"final_score": 4, "final_lives": 2, "total_trials": 1, "end_reason": "completed"},
        )
        self.assertEqual(end.status_code, 200)
        self.assertEqual(end.json()["run_status"], "completed")

        repeat_end = self.client.post(
            f"/api/runs/{run_id}/end",
            json={"final_score": 4, "final_lives": 2, "total_trials": 1, "end_reason": "completed"},
        )
        self.assertEqual(repeat_end.status_code, 200)
        self.assertEqual(repeat_end.json()["event_count"], 1)

        after_end_batch = self.client.post(f"/api/runs/{run_id}/events/batch", json=batch_payload)
        self.assertEqual(after_end_batch.status_code, 409)
        self.assertEqual(after_end_batch.json()["detail"], "Run is no longer active")


if __name__ == "__main__":
    unittest.main()
