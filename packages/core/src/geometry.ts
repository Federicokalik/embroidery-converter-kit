/**
 * Pure geometric transforms on Patterns. Kept separate from
 * pattern-transforms.ts, which is reserved for pyembroidery-parity
 * post-read heuristics.
 */
import { computeExtents } from './ir';
import type { Pattern } from './ir';

/** Return a copy of the pattern shifted by (dx, dy) 0.1 mm units. */
export function translate(pattern: Pattern, dx: number, dy: number): Pattern {
  const stitches = pattern.stitches.map((s) => ({ ...s, x: s.x + dx, y: s.y + dy }));
  return { ...pattern, stitches, extents: computeExtents(stitches) };
}

/**
 * Return a copy of the pattern with its bounding box centered on the origin
 * (what JEF/ZHS headers and centered-hoop placement assume). Shifts are
 * rounded to whole 0.1 mm units so coordinates stay integral.
 */
export function center(pattern: Pattern): Pattern {
  const e = computeExtents(pattern.stitches);
  const dx = -Math.round((e.minX + e.maxX) / 2);
  const dy = -Math.round((e.minY + e.maxY) / 2);
  if (dx === 0 && dy === 0) return pattern;
  return translate(pattern, dx, dy);
}
