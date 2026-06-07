export const SEQUENCE_GRID_SIZE = 9;

export function randomCell(size: number = SEQUENCE_GRID_SIZE, randomValue: number = Math.random()): number {
  return Math.floor(randomValue * size);
}

export function extendSequence(
  sequence: number[],
  size: number = SEQUENCE_GRID_SIZE,
  randomValue: number = Math.random(),
): number[] {
  return [...sequence, randomCell(size, randomValue)];
}

export function getSequenceScore(sequenceLength: number): number {
  return Math.max(0, sequenceLength - 1);
}
