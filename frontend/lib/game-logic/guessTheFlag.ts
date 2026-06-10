import { FLAG_COUNTRIES, FLAG_COUNTRY_COUNT, type FlagCountry } from "./flagCountries";

export { FLAG_COUNTRY_COUNT, type FlagCountry };

export type FlagAliasMap = Record<string, true>;

export type FlagRoundEntry = {
  country: FlagCountry;
  recallIndex: number;
};

export type FlagAnswerResult = {
  countryId: string;
  alpha2Code: string;
  displayName: string;
  typedAnswer: string;
  normalizedAnswer: string;
  recallIndex: number;
  isCorrect: boolean;
  acceptedViaAlias: boolean;
};

export type FlagGameSummary = {
  totalCountries: number;
  totalCorrect: number;
  results: FlagAnswerResult[];
};

export type FlagScoreSummary = {
  elapsedSeconds: number;
  speedScore: number;
};

export function normalizeFlagAnswer(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function buildFlagAliasMap(country: FlagCountry): FlagAliasMap {
  return Object.fromEntries(
    country.acceptedAliases
      .map((alias) => normalizeFlagAnswer(alias))
      .filter((alias) => alias.length > 0)
      .map((alias) => [alias, true]),
  ) as FlagAliasMap;
}

export function createFlagRound(randomValue: () => number = Math.random): FlagRoundEntry[] {
  const shuffled = [...FLAG_COUNTRIES];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const nextIndex = Math.floor(randomValue() * (index + 1));
    [shuffled[index], shuffled[nextIndex]] = [shuffled[nextIndex], shuffled[index]];
  }

  return shuffled.map((country, index) => ({
    country,
    recallIndex: index + 1,
  }));
}

export function evaluateFlagAnswer(entry: FlagRoundEntry, typedAnswer: string): FlagAnswerResult {
  const normalizedAnswer = normalizeFlagAnswer(typedAnswer);
  const normalizedDisplayName = normalizeFlagAnswer(entry.country.displayName);
  const aliasMap = buildFlagAliasMap(entry.country);
  const isCorrect = normalizedAnswer.length > 0 && Boolean(aliasMap[normalizedAnswer]);
  const acceptedViaAlias = isCorrect && normalizedAnswer !== normalizedDisplayName;

  return {
    countryId: entry.country.id,
    alpha2Code: entry.country.alpha2Code,
    displayName: entry.country.displayName,
    typedAnswer,
    normalizedAnswer,
    recallIndex: entry.recallIndex,
    isCorrect,
    acceptedViaAlias,
  } satisfies FlagAnswerResult;
}

export function evaluateFlagRound(
  round: FlagRoundEntry[],
  answers: Record<string, string>,
): FlagGameSummary {
  const results = round.map((entry) => evaluateFlagAnswer(entry, answers[entry.country.id] ?? ""));

  return {
    totalCountries: round.length,
    totalCorrect: results.filter((result) => result.isCorrect).length,
    results,
  };
}

export function computeFlagSpeedScore(totalCorrect: number, elapsedMs: number): FlagScoreSummary {
  const elapsedSeconds = Math.max(1, Math.round(elapsedMs / 1000));
  return {
    elapsedSeconds,
    speedScore: Math.round((totalCorrect / elapsedSeconds) * 1000),
  };
}
