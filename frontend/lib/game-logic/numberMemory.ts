export function generateNumber(level: number): string {
  let value = "";
  for (let index = 0; index < level; index += 1) {
    const min = index === 0 ? 1 : 0;
    value += Math.floor(Math.random() * (10 - min) + min).toString();
  }
  return value;
}

export function getRevealMs(level: number): number {
  return Math.min(4500, 1000 + level * 260);
}

export function getNumberMemoryScore(level: number): number {
  return Math.max(0, level - 1);
}
