import { WORDLE_EXTRA_VALID_GUESSES, WORDLE_SOLUTION_WORDS } from "./wordleWords";

export const WORDLE_WORD_LENGTH = 5;
export const WORDLE_MAX_GUESSES = 6;
export const WORDLE_KEYBOARD_ROWS = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "BACKSPACE"],
] as const;

export type WordleTileState = "correct" | "present" | "absent";
export type WordleKeyboardState = "correct" | "present" | "absent";

export type WordleTileResult = {
  letter: string;
  state: WordleTileState;
};

export type WordleGuessResult = {
  guess: string;
  tiles: WordleTileResult[];
  isWin: boolean;
};

const WORDLE_VALID_WORDS = new Set([...WORDLE_SOLUTION_WORDS, ...WORDLE_EXTRA_VALID_GUESSES]);
const KEYBOARD_STATE_PRIORITY: Record<WordleKeyboardState, number> = {
  absent: 1,
  present: 2,
  correct: 3,
};

export function pickRandomWordleSolution(randomValue: number = Math.random()): string {
  return WORDLE_SOLUTION_WORDS[Math.floor(randomValue * WORDLE_SOLUTION_WORDS.length)];
}

export function normalizeWordleGuess(value: string): string {
  return value.trim().toLowerCase();
}

export function isWordleLetterKey(value: string): boolean {
  return /^[a-z]$/i.test(value);
}

export function isValidWordleGuess(guess: string): boolean {
  const normalized = normalizeWordleGuess(guess);
  return normalized.length === WORDLE_WORD_LENGTH && WORDLE_VALID_WORDS.has(normalized);
}

export function evaluateWordleGuess(answer: string, guess: string): WordleGuessResult {
  const normalizedAnswer = normalizeWordleGuess(answer);
  const normalizedGuess = normalizeWordleGuess(guess);
  const tiles: WordleTileResult[] = Array.from(normalizedGuess).map((letter) => ({
    letter,
    state: "absent",
  }));
  const remainingLetters = new Map<string, number>();

  for (let index = 0; index < normalizedAnswer.length; index += 1) {
    const answerLetter = normalizedAnswer[index];
    const guessLetter = normalizedGuess[index];
    if (answerLetter === guessLetter) {
      tiles[index] = { letter: guessLetter, state: "correct" };
      continue;
    }
    remainingLetters.set(answerLetter, (remainingLetters.get(answerLetter) ?? 0) + 1);
  }

  for (let index = 0; index < normalizedGuess.length; index += 1) {
    if (tiles[index].state === "correct") {
      continue;
    }

    const guessLetter = normalizedGuess[index];
    const remainingCount = remainingLetters.get(guessLetter) ?? 0;
    if (remainingCount > 0) {
      tiles[index] = { letter: guessLetter, state: "present" };
      remainingLetters.set(guessLetter, remainingCount - 1);
    }
  }

  return {
    guess: normalizedGuess,
    tiles,
    isWin: tiles.every((tile) => tile.state === "correct"),
  };
}

export function mergeWordleKeyboardState(
  current: Partial<Record<string, WordleKeyboardState>>,
  guessResult: WordleGuessResult,
): Partial<Record<string, WordleKeyboardState>> {
  const nextState = { ...current };

  for (const tile of guessResult.tiles) {
    const key = tile.letter.toUpperCase();
    const previous = nextState[key];
    if (!previous || KEYBOARD_STATE_PRIORITY[tile.state] > KEYBOARD_STATE_PRIORITY[previous]) {
      nextState[key] = tile.state;
    }
  }

  return nextState;
}

export function buildWordleKeyboardState(
  guessResults: WordleGuessResult[],
): Partial<Record<string, WordleKeyboardState>> {
  return guessResults.reduce<Partial<Record<string, WordleKeyboardState>>>(
    (state, result) => mergeWordleKeyboardState(state, result),
    {},
  );
}
