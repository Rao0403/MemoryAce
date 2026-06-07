export const WORD_BANK = [
  "apple", "ocean", "river", "planet", "forest", "garden", "bridge", "window", "thunder", "pencil",
  "mountain", "camera", "castle", "summer", "winter", "spring", "autumn", "rocket", "signal", "pillow",
  "puzzle", "galaxy", "saturn", "violet", "copper", "marble", "glacier", "temple", "silver", "golden",
  "stream", "harbor", "circle", "square", "needle", "button", "blanket", "anchor", "sailor", "ticket",
  "museum", "desert", "island", "laptop", "keyboard", "orange", "banana", "straw", "planetary", "travel",
  "guitar", "violin", "piano", "drum", "melody", "rhythm", "thunderbolt", "library", "fiction", "poetry",
  "canvas", "painter", "studio", "engine", "engineer", "doctor", "artist", "breeze", "shadow", "sunrise",
  "sunset", "morning", "evening", "midnight", "coffee", "tea", "cocoa", "cookie", "biscuit", "pepper",
  "salt", "sugar", "honey", "butter", "cheese", "crystal", "diamond", "emerald", "amber", "sapphire",
  "falcon", "eagle", "sparrow", "robin", "parrot", "rabbit", "tiger", "lion", "zebra", "dolphin",
  "whale", "octopus", "planetarium", "compass", "lantern", "backpack", "journal", "novel", "chapter", "station",
];

export type VerbalGuessResult = {
  actualSeen: boolean;
  isCorrect: boolean;
  nextSeenWords: string[];
  nextScore: number;
  nextLives: number;
  errorType: "none" | "miss" | "false_alarm";
  uniqueWordsSeen: number;
};

export function randomFrom<T>(items: T[], randomValue: number = Math.random()): T {
  return items[Math.floor(randomValue * items.length)];
}

export function pickNextWord(seenWords: string[], randomValue: number = Math.random()): string {
  const seenSet = new Set(seenWords);
  const unseenWords = WORD_BANK.filter((word) => !seenSet.has(word));
  const canUseSeen = seenWords.length > 0;
  const shouldUseSeen = canUseSeen && (unseenWords.length === 0 || randomValue < 0.5);

  if (shouldUseSeen) {
    return randomFrom(seenWords, randomValue);
  }
  if (unseenWords.length > 0) {
    return randomFrom(unseenWords, randomValue);
  }
  return randomFrom(WORD_BANK, randomValue);
}

export function resolveVerbalGuess(params: {
  currentWord: string;
  seenWords: string[];
  guessSeen: boolean;
  score: number;
  lives: number;
}): VerbalGuessResult {
  const actualSeen = params.seenWords.includes(params.currentWord);
  const isCorrect = params.guessSeen === actualSeen;
  const nextSeenWords = actualSeen ? params.seenWords : [...params.seenWords, params.currentWord];
  const nextScore = isCorrect ? params.score + 1 : params.score;
  const nextLives = isCorrect ? params.lives : params.lives - 1;

  return {
    actualSeen,
    isCorrect,
    nextSeenWords,
    nextScore,
    nextLives,
    errorType: isCorrect ? "none" : actualSeen ? "miss" : "false_alarm",
    uniqueWordsSeen: new Set(nextSeenWords).size,
  };
}
