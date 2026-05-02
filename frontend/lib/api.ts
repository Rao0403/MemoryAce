import { getApiBaseUrl } from "@/lib/constants";
import type { GameKey } from "@/lib/constants";

export type PlayerGameStats = {
  player_name: string;
  game: GameKey;
  high_score: number;
  average_score: number;
  attempts: number;
};

export type LeaderboardRow = {
  player_name: string;
  high_score: number;
  average_score: number;
  attempts: number;
};

export type GameDashboardStats = {
  game: GameKey;
  high_score: number;
  average_score: number;
  attempts: number;
};

export type PlayerDashboardStats = {
  player_name: string;
  total_attempts: number;
  games_played: number;
  games: GameDashboardStats[];
};

export type RunStartResponse = {
  run_id: number;
  player_name: string | null;
  game: GameKey;
  run_status: string;
  event_schema_version: number;
  started_at: string;
};

export type TrialEventPayload = {
  trial_index: number;
  occurred_at?: string;
  event_name?: string;
  difficulty_level: number;
  reaction_ms?: number | null;
  correct: boolean;
  score_before: number;
  score_after: number;
  lives_before?: number | null;
  lives_after?: number | null;
  event_payload?: Record<string, unknown>;
  event_schema_version?: number;
};

export type RunEndResponse = {
  run_id: number;
  run_status: string;
  final_score: number;
  final_lives: number | null;
  total_trials: number | null;
  event_count: number;
  ended_at: string;
};

export async function submitScore(params: {
  playerName: string;
  game: GameKey;
  score: number;
}): Promise<PlayerGameStats> {
  const response = await fetch(`${getApiBaseUrl()}/api/scores`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      player_name: params.playerName,
      game: params.game,
      score: params.score,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Unable to save score");
  }

  return response.json();
}

export async function fetchStats(params: {
  playerName: string;
  game: GameKey;
}): Promise<PlayerGameStats | null> {
  const response = await fetch(
    `${getApiBaseUrl()}/api/scores/${params.game}/${encodeURIComponent(params.playerName)}`,
    { cache: "no-store" },
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error("Unable to fetch stats");
  }

  return response.json();
}

export async function fetchLeaderboard(game: GameKey): Promise<LeaderboardRow[]> {
  const response = await fetch(`${getApiBaseUrl()}/api/leaderboard/${game}?limit=8`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Unable to fetch leaderboard");
  }

  return response.json();
}

export async function fetchDashboard(playerName: string): Promise<PlayerDashboardStats> {
  const response = await fetch(`${getApiBaseUrl()}/api/dashboard/${encodeURIComponent(playerName)}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Unable to fetch dashboard");
  }

  return response.json();
}

export async function startGameRun(params: {
  playerName?: string;
  game: GameKey;
  eventSchemaVersion?: number;
}): Promise<RunStartResponse> {
  const response = await fetch(`${getApiBaseUrl()}/api/runs/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      player_name: params.playerName?.trim() || null,
      game: params.game,
      event_schema_version: params.eventSchemaVersion ?? 1,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Unable to start run");
  }

  return response.json();
}

export async function sendRunEventsBatch(params: {
  runId: number;
  events: TrialEventPayload[];
}): Promise<void> {
  const response = await fetch(`${getApiBaseUrl()}/api/runs/${params.runId}/events/batch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ events: params.events }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Unable to send trial events");
  }
}

export async function endGameRun(params: {
  runId: number;
  finalScore: number;
  endReason?: "completed" | "abandoned" | "timeout" | "quit";
  finalLives?: number;
  totalTrials?: number;
}): Promise<RunEndResponse> {
  const response = await fetch(`${getApiBaseUrl()}/api/runs/${params.runId}/end`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      final_score: params.finalScore,
      end_reason: params.endReason ?? "completed",
      final_lives: params.finalLives ?? null,
      total_trials: params.totalTrials ?? null,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Unable to end run");
  }

  return response.json();
}
