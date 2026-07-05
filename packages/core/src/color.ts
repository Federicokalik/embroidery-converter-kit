/**
 * Color matching — port of pyembroidery/EmbThread.py helpers used by the
 * JEF and PEC writers to map arbitrary RGB onto fixed thread charts.
 * https://www.compuphase.com/cmetric.htm ("red-mean" distance).
 */
import type { Thread } from './ir';
import { pyround } from './pyround';

export function colorDistanceRedMean(
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number,
): number {
  const redMean = pyround((r1 + r2) / 2);
  const r = r1 - r2;
  const g = g1 - g2;
  const b = b1 - b2;
  return (((512 + redMean) * r * r) >> 8) + 4 * g * g + (((767 - redMean) * b * b) >> 8);
}

/** Later chart index wins ties (pyembroidery uses `<=`). Null slots skipped. */
export function findNearestColorIndex(
  rgb: number,
  chart: ReadonlyArray<Thread | null>,
): number {
  const red = (rgb >> 16) & 0xff;
  const green = (rgb >> 8) & 0xff;
  const blue = rgb & 0xff;
  let closestIndex = -1;
  let currentClosest = Infinity;
  for (let i = 0; i < chart.length; i++) {
    const t = chart[i];
    if (t === null || t === undefined) continue;
    const dist = colorDistanceRedMean(
      red,
      green,
      blue,
      (t.rgb >> 16) & 0xff,
      (t.rgb >> 8) & 0xff,
      t.rgb & 0xff,
    );
    if (dist <= currentClosest) {
      currentClosest = dist;
      closestIndex = i;
    }
  }
  return closestIndex;
}
