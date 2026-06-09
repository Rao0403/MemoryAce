export const GAME_KEYS = ["number_memory", "sequence_memory", "verbal_memory", "wordle", "face_name_memory", "guess_the_flag"] as const;
export type GameKey = (typeof GAME_KEYS)[number];

export type GameDefinition = {
  key: GameKey;
  label: string;
  route: string;
  heroTitle: string;
  subtitle: string;
  description: string;
};

export const GAME_DEFINITIONS: Record<GameKey, GameDefinition> = {
  number_memory: {
    key: "number_memory",
    label: "Number Memory",
    route: "/games/number-memory",
    heroTitle: "Number Memory",
    subtitle: "Each round adds one digit. Beat your limit.",
    description: "Start from 1 digit and push your recall ceiling with one extra digit each round.",
  },
  sequence_memory: {
    key: "sequence_memory",
    label: "Sequence Memory",
    route: "/games/sequence-memory",
    heroTitle: "Sequence Memory",
    subtitle: "3x3 pattern chains. Repeat perfectly.",
    description: "Watch a growing glow-chain on a 3x3 board, then replay the exact sequence without mistakes.",
  },
  verbal_memory: {
    key: "verbal_memory",
    label: "Verbal Memory",
    route: "/games/verbal-memory",
    heroTitle: "Verbal Memory",
    subtitle: "Choose whether each word is Seen or New.",
    description: "Judge each word as Seen or New. One mistake costs a life, and the stream gets trickier over time.",
  },
  wordle: {
    key: "wordle",
    label: "Wordle",
    route: "/games/wordle",
    heroTitle: "Wordle",
    subtitle: "Six guesses. One five-letter answer. No wasted inputs.",
    description: "Solve a hidden five-letter word in six tries using keyboard clues for correct, present, and absent letters.",
  },
  face_name_memory: {
    key: "face_name_memory",
    label: "Face + Name Memory",
    route: "/games/face-name-memory",
    heroTitle: "Face + Name Memory",
    subtitle: "Study a grid of faces, then type every name from memory.",
    description: "Choose how many faces to memorize, study the grid, then recall each first name in a full answer form.",
  },
  guess_the_flag: {
    key: "guess_the_flag",
    label: "Guess the Flag",
    route: "/games/guess-the-flag",
    heroTitle: "Guess the Flag",
    subtitle: "A full world grid. One pass. Name every country you can.",
    description: "Work through a randomized full-world flag grid, type each country name, and score by total correct answers.",
  },
};

export const GAME_LABELS: Record<GameKey, string> = Object.fromEntries(
  GAME_KEYS.map((key) => [key, GAME_DEFINITIONS[key].label]),
) as Record<GameKey, string>;

export const GAME_ROUTES: Record<GameKey, string> = Object.fromEntries(
  GAME_KEYS.map((key) => [key, GAME_DEFINITIONS[key].route]),
) as Record<GameKey, string>;

export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
}
