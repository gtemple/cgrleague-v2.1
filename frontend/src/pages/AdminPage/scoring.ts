/**
 * Mirror of results/scoring.py. Kept here so the entry grid can show what each
 * position is worth as you order it, without a round trip per drag.
 * If the tables change server-side, change them here too.
 */
const GP_POINTS: Record<number, number> = {
  1: 25, 2: 18, 3: 15, 4: 12, 5: 10, 6: 8, 7: 6, 8: 4, 9: 2, 10: 1,
};
const SPRINT_POINTS: Record<number, number> = {
  1: 8, 2: 7, 3: 6, 4: 5, 5: 4, 6: 3, 7: 2, 8: 1,
};

export function pointsForPosition(pos: number | null, isSprint: boolean): number {
  if (pos == null) return 0;
  return (isSprint ? SPRINT_POINTS : GP_POINTS)[pos] ?? 0;
}

export function pointsForRow(
  pos: number | null,
  isSprint: boolean,
  fastestLap: boolean,
): number {
  const base = pointsForPosition(pos, isSprint);
  const bonus = fastestLap && pos != null && pos <= 10 ? 1 : 0;
  return base + bonus;
}
