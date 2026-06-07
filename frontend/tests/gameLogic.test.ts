import assert from "node:assert/strict";
import test from "node:test";

import { generateNumber, getNumberMemoryScore, getRevealMs } from "../lib/game-logic/numberMemory";
import { extendSequence, getSequenceScore, randomCell, SEQUENCE_GRID_SIZE } from "../lib/game-logic/sequenceMemory";
import { pickNextWord, resolveVerbalGuess } from "../lib/game-logic/verbalMemory";

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
