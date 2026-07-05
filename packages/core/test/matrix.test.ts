import { describe, expect, it } from 'vitest';
import { convert, getReader, UnsupportedDesignError } from '../src/index';
import type { Pattern, Stitch } from '../src/index';
import { zhsUnsupportedReason } from '../src/writers/zhs';
import { GOLDEN_FORMATS, GOLDEN_PATTERNS, loadGoldenBytes } from './helpers';

/**
 * Full any→any conversion matrix. The invariant a conversion must preserve
 * is the PEN-DOWN PATH: the sequence of absolute STITCH positions, with
 * consecutive duplicates collapsed (tie-in and post-jump zero stitches are
 * no-ops for the needle). Jump splitting, trim re-encoding and color
 * quantization legitimately differ per format and are covered by the
 * per-format byte tests instead.
 */
interface PenDown {
  x: number;
  y: number;
  /** Zero-length stitch at a jump landing: a tie/lock stitch. Formats insert
   * or omit these freely (PEC and ZHS add one, pyembroidery-identical), so
   * the comparison treats them as optional on either side. */
  tie: boolean;
}

function penDownPath(stitches: Stitch[]): PenDown[] {
  const path: PenDown[] = [];
  for (let i = 0; i < stitches.length; i++) {
    const s = stitches[i]!;
    if (s.command !== 'STITCH') continue;
    const prev = stitches[i - 1];
    const tie =
      prev !== undefined && prev.command === 'JUMP' && prev.x === s.x && prev.y === s.y;
    const last = path[path.length - 1];
    if (last === undefined || last.x !== s.x || last.y !== s.y) {
      path.push({ x: s.x, y: s.y, tie });
    }
  }
  return path;
}

/**
 * Aligns two pen-down paths, allowing tie points to be present on one side
 * only. `tolerance` absorbs VP3's ±1 unit (0.1 mm) block-start quantization:
 * pyembroidery double-truncates color-block positions against a possibly
 * fractional design center; the port reproduces the reference behavior.
 */
function expectPathsEquivalent(
  actual: PenDown[],
  expected: PenDown[],
  tolerance: number,
): void {
  const close = (a: PenDown, b: PenDown): boolean =>
    Math.abs(a.x - b.x) <= tolerance && Math.abs(a.y - b.y) <= tolerance;
  let i = 0;
  let j = 0;
  while (i < expected.length || j < actual.length) {
    const e = expected[i];
    const a = actual[j];
    if (e !== undefined && a !== undefined && close(a, e)) {
      i += 1;
      j += 1;
      continue;
    }
    if (a !== undefined && a.tie) {
      j += 1;
      continue;
    }
    if (e !== undefined && e.tie) {
      i += 1;
      continue;
    }
    // Mismatch: fall back to a strict comparison for a readable failure.
    expect({ index: j, point: a }).toEqual({ index: i, point: e });
    return;
  }
}

/** The ZHS writer's own gate (empty designs only; trims are dropped). */
function zhsWritable(pattern: Pattern): boolean {
  return zhsUnsupportedReason(pattern) === null;
}

const TARGETS = [
  'zhs', 'dst', 'exp', 'jef', 'pec', 'pes', 'vp3', 'hus', 'vip', 'xxx',
] as const;

interface Source {
  label: string;
  bytes: Uint8Array;
  format: string;
}

const sources: Source[] = [];
for (const name of GOLDEN_PATTERNS) {
  for (const format of GOLDEN_FORMATS) {
    sources.push({ label: `${name}.${format}`, bytes: loadGoldenBytes(name, format), format });
  }
}
for (const format of ['hus', 'sew', 'shv', 'pcs']) {
  sources.push({
    label: `synthetic.${format}`,
    bytes: loadGoldenBytes('synthetic', format),
    format,
  });
}

describe('conversion matrix (pen-down path preserved)', () => {
  for (const source of sources) {
    describe(source.label, () => {
      const sourcePattern = getReader(source.format)(source.bytes);
      const sourcePath = penDownPath(sourcePattern.stitches);

      for (const target of TARGETS) {
        if (target === 'zhs' && !zhsWritable(sourcePattern)) {
          it(`→ ${target}: gated (unverified ZHS output)`, () => {
            expect(() => convert(source.bytes, source.format, target)).toThrow(
              UnsupportedDesignError,
            );
          });
          continue;
        }
        it(`→ ${target}`, () => {
          const result = convert(source.bytes, source.format, target);
          const roundTripped = getReader(target)(result.bytes);
          const path = penDownPath(roundTripped.stitches);
          expectPathsEquivalent(path, sourcePath, target === 'vp3' ? 1 : 0);
        });
      }
    });
  }
});
