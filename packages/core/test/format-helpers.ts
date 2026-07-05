import { expect } from 'vitest';
import type { Pattern } from '../src/ir';
import type { DumpedPattern } from './helpers';

/**
 * Compare a TS-read Pattern against a pyembroidery read-back dump.
 * Our readers drop the trailing END record (IR convention since M1), so END
 * rows are stripped from the golden before comparing.
 */
export function expectPatternMatchesDump(pattern: Pattern, dump: DumpedPattern): void {
  const goldenRows = dump.stitches.filter(([, , command]) => command !== 'END');
  expect(pattern.stitches.map((s) => [s.x, s.y, s.command])).toEqual(goldenRows);
  expect(pattern.threads.map((t) => t.rgb)).toEqual(dump.threads.map((t) => t.rgb));
}
