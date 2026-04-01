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
