export const GAME_LABELS: Record<string, string> = {
  number_memory: "Number Memory",
  sequence_memory: "Sequence Memory",
};

export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
}