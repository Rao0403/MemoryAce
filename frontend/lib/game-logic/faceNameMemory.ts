import { FACE_ASSETS, FACE_NAME_MAX_COUNT, type FaceAsset, type FaceAssetGender } from "./faceNameMemoryAssets";

export { FACE_NAME_MAX_COUNT };

export type FaceNamePrompt = {
  face: FaceAsset;
  assignedName: string;
  recallIndex: number;
};

export type FaceNameRound = {
  faceCount: number;
  prompts: FaceNamePrompt[];
};

export type FaceNameAnswerResult = {
  faceId: string;
  faceGender: FaceAssetGender;
  assignedName: string;
  typedName: string;
  normalizedTypedName: string;
  recallIndex: number;
  isCorrect: boolean;
};

export const DEFAULT_FACE_NAME_COUNT = 6;

export const FEMALE_FIRST_NAMES = [
  "Ava", "Mia", "Luna", "Nora", "Zoe", "Ella", "Ivy", "Ruby", "Clara", "Hazel",
  "Naomi", "Layla", "Cora", "Maya", "Sofia", "Elena", "Isla", "Jade", "Leah", "Tessa",
];

export const MALE_FIRST_NAMES = [
  "Liam", "Noah", "Ethan", "Lucas", "Mason", "Leo", "Owen", "Ezra", "Caleb", "Aiden",
  "Julian", "Miles", "Theo", "Nolan", "Roman", "Wyatt", "Isaac", "Asher", "Logan", "Jonah",
];

function sampleUniqueItems<T>(items: T[], count: number, randomValue: () => number): T[] {
  if (count > items.length) {
    throw new Error("Requested more unique items than available.");
  }

  const pool = [...items];
  const selected: T[] = [];

  for (let index = 0; index < count; index += 1) {
    const nextIndex = Math.floor(randomValue() * pool.length);
    selected.push(pool[nextIndex]);
    pool.splice(nextIndex, 1);
  }

  return selected;
}

function pickNamesForGender(gender: FaceAssetGender, count: number, randomValue: () => number): string[] {
  const source = gender === "female" ? FEMALE_FIRST_NAMES : MALE_FIRST_NAMES;
  return sampleUniqueItems(source, count, randomValue);
}

export function normalizeFaceNameAnswer(value: string): string {
  return value.trim().toLowerCase();
}

export function createFaceNameRound(faceCount: number, randomValue: () => number = Math.random): FaceNameRound {
  if (faceCount < 1 || faceCount > FACE_NAME_MAX_COUNT) {
    throw new Error(`faceCount must be between 1 and ${FACE_NAME_MAX_COUNT}.`);
  }

  const selectedFaces = sampleUniqueItems(FACE_ASSETS, faceCount, randomValue);
  const femaleCount = selectedFaces.filter((face) => face.gender === "female").length;
  const maleCount = selectedFaces.length - femaleCount;
  const femaleNames = pickNamesForGender("female", femaleCount, randomValue);
  const maleNames = pickNamesForGender("male", maleCount, randomValue);

  let femaleIndex = 0;
  let maleIndex = 0;

  return {
    faceCount,
    prompts: selectedFaces.map((face, index) => {
      const assignedName = face.gender === "female" ? femaleNames[femaleIndex++] : maleNames[maleIndex++];
      return {
        face,
        assignedName,
        recallIndex: index + 1,
      };
    }),
  };
}

export function evaluateFaceNameRound(
  round: FaceNameRound,
  answers: Record<string, string>,
): { results: FaceNameAnswerResult[]; totalCorrect: number } {
  const results = round.prompts.map((prompt) => {
    const typedName = answers[prompt.face.id] ?? "";
    const normalizedTypedName = normalizeFaceNameAnswer(typedName);
    const normalizedAssignedName = normalizeFaceNameAnswer(prompt.assignedName);
    const isCorrect = normalizedTypedName === normalizedAssignedName;

    return {
      faceId: prompt.face.id,
      faceGender: prompt.face.gender,
      assignedName: prompt.assignedName,
      typedName,
      normalizedTypedName,
      recallIndex: prompt.recallIndex,
      isCorrect,
    } satisfies FaceNameAnswerResult;
  });

  return {
    results,
    totalCorrect: results.filter((result) => result.isCorrect).length,
  };
}
