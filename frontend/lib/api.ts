import { getApiBaseUrl } from "@/lib/constants";

export type PlayerGameStats = {
  player_name: string;
  game: string;
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

export async function submitScore(params: {
  playerName: string;
  game: "number_memory" | "sequence_memory";
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
  game: "number_memory" | "sequence_memory";
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

export async function fetchLeaderboard(game: "number_memory" | "sequence_memory"): Promise<LeaderboardRow[]> {
  const response = await fetch(`${getApiBaseUrl()}/api/leaderboard/${game}?limit=8`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Unable to fetch leaderboard");
  }

  return response.json();
}