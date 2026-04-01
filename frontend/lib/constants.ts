export const GAME_LABELS: Record<string, string> = {
  number_memory: "Number Memory",
  sequence_memory: "Sequence Memory",
};

export const GAME_KEYS = ["number_memory", "sequence_memory"] as const;
export type GameKey = (typeof GAME_KEYS)[number];

export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
}
