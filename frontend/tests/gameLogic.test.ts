import assert from "node:assert/strict";
import test from "node:test";

import { generateNumber, getNumberMemoryScore, getRevealMs } from "../lib/game-logic/numberMemory";
import { extendSequence, getSequenceScore, randomCell, SEQUENCE_GRID_SIZE } from "../lib/game-logic/sequenceMemory";
import { pickNextWord, resolveVerbalGuess } from "../lib/game-logic/verbalMemory";
import {
  createFaceNameRound,
  evaluateFaceNameRound,
  FEMALE_FIRST_NAMES,
  MALE_FIRST_NAMES,
  normalizeFaceNameAnswer,
} from "../lib/game-logic/faceNameMemory";
import {
  buildWordleKeyboardState,
  evaluateWordleGuess,
  isValidWordleGuess,
  mergeWordleKeyboardState,
  pickRandomWordleSolution,
} from "../lib/game-logic/wordle";

test("number memory helpers produce valid ranges", () => {
  const generated = generateNumber(6);
  assert.equal(generated.length, 6);
  assert.notEqual(generated[0], "0");
  assert.equal(getRevealMs(1), 1260);
  assert.equal(getRevealMs(20), 4500);
  assert.equal(getNumberMemoryScore(1), 0);
  assert.equal(getNumberMemoryScore(8), 7);
});

test("sequence memory helpers keep sequence rules intact", () => {
  assert.equal(randomCell(SEQUENCE_GRID_SIZE, 0.5), 4);
  assert.deepEqual(extendSequence([1, 2], SEQUENCE_GRID_SIZE, 0.99), [1, 2, 8]);
  assert.equal(getSequenceScore(1), 0);
  assert.equal(getSequenceScore(5), 4);
});

test("verbal memory helpers choose words and score guesses correctly", () => {
  assert.equal(pickNextWord(["apple", "ocean"], 0.1), "apple");
  assert.notEqual(pickNextWord([], 0.8), "");

  const correct = resolveVerbalGuess({
    currentWord: "apple",
    seenWords: [],
    guessSeen: false,
    score: 3,
    lives: 2,
  });
  assert.equal(correct.isCorrect, true);
  assert.equal(correct.nextScore, 4);
  assert.equal(correct.nextLives, 2);
  assert.equal(correct.uniqueWordsSeen, 1);

  const wrong = resolveVerbalGuess({
    currentWord: "ocean",
    seenWords: ["ocean"],
    guessSeen: false,
    score: 6,
    lives: 3,
  });
  assert.equal(wrong.isCorrect, false);
  assert.equal(wrong.errorType, "miss");
  assert.equal(wrong.nextScore, 6);
  assert.equal(wrong.nextLives, 2);
});

test("wordle helpers validate guesses and choose local solutions", () => {
  assert.equal(pickRandomWordleSolution(0), "apple");
  assert.equal(isValidWordleGuess("crane"), true);
  assert.equal(isValidWordleGuess("zzzzz"), false);
});

test("wordle evaluation handles repeated letters correctly", () => {
  const result = evaluateWordleGuess("apple", "allee");
  assert.deepEqual(
    result.tiles.map((tile) => tile.state),
    ["correct", "present", "absent", "absent", "correct"],
  );
  assert.equal(result.isWin, false);
});

test("wordle evaluation detects wins from first through sixth guess shape", () => {
  const firstGuessWin = evaluateWordleGuess("cigar", "cigar");
  assert.equal(firstGuessWin.isWin, true);

  const sixthGuessWin = [
    evaluateWordleGuess("table", "crane"),
    evaluateWordleGuess("table", "globe"),
    evaluateWordleGuess("table", "quiet"),
    evaluateWordleGuess("table", "novel"),
    evaluateWordleGuess("table", "cabin"),
    evaluateWordleGuess("table", "table"),
  ];
  assert.equal(sixthGuessWin[5].isWin, true);
  assert.equal(sixthGuessWin.slice(0, 5).every((guess) => !guess.isWin), true);
});

test("wordle keyboard state keeps the strongest discovered clue", () => {
  const first = evaluateWordleGuess("apple", "allee");
  const second = evaluateWordleGuess("apple", "apple");
  const merged = mergeWordleKeyboardState(buildWordleKeyboardState([first]), second);

  assert.equal(merged.A, "correct");
  assert.equal(merged.L, "correct");
  assert.equal(merged.E, "correct");
  assert.equal(merged.P, "correct");
});

test("face-name round generation keeps unique faces, unique names, and gender-compatible assignment", () => {
  const values = [0.02, 0.38, 0.74, 0.15, 0.91, 0.44, 0.61, 0.27, 0.82, 0.09, 0.53, 0.69];
  let index = 0;
  const round = createFaceNameRound(8, () => {
    const value = values[index % values.length];
    index += 1;
    return value;
  });

  assert.equal(round.prompts.length, 8);
  assert.equal(new Set(round.prompts.map((prompt) => prompt.face.id)).size, 8);
  assert.equal(new Set(round.prompts.map((prompt) => prompt.assignedName)).size, 8);
  assert.equal(round.prompts.every((prompt) => prompt.recallIndex >= 1), true);

  for (const prompt of round.prompts) {
    if (prompt.face.gender === "female") {
      assert.equal(FEMALE_FIRST_NAMES.includes(prompt.assignedName), true);
    } else {
      assert.equal(MALE_FIRST_NAMES.includes(prompt.assignedName), true);
    }
  }
});

test("face-name answer normalization is trimmed and case-insensitive exact match", () => {
  assert.equal(normalizeFaceNameAnswer("  Ava "), "ava");
  assert.equal(normalizeFaceNameAnswer("NoAH"), "noah");
});

test("face-name scoring counts correct answers and preserves recall order", () => {
  const round = {
    faceCount: 3,
    prompts: [
      {
        face: { id: "female-01", imagePath: "/faces/female-01.svg", gender: "female" as const },
        assignedName: "Ava",
        recallIndex: 1,
      },
      {
        face: { id: "male-01", imagePath: "/faces/male-01.svg", gender: "male" as const },
        assignedName: "Liam",
        recallIndex: 2,
      },
      {
        face: { id: "female-02", imagePath: "/faces/female-02.svg", gender: "female" as const },
        assignedName: "Mia",
        recallIndex: 3,
      },
    ],
  };

  const evaluation = evaluateFaceNameRound(round, {
    "female-01": " ava ",
    "male-01": "Noah",
    "female-02": "MIA",
  });

  assert.equal(evaluation.totalCorrect, 2);
  assert.deepEqual(
    evaluation.results.map((result) => ({
      faceId: result.faceId,
      recallIndex: result.recallIndex,
      isCorrect: result.isCorrect,
    })),
    [
      { faceId: "female-01", recallIndex: 1, isCorrect: true },
      { faceId: "male-01", recallIndex: 2, isCorrect: false },
      { faceId: "female-02", recallIndex: 3, isCorrect: true },
    ],
  );
});
