import { describe, expect, it } from 'vitest';
import { addTrims, removeTrims } from '../src/trim-edits';
import type { Pattern, Stitch } from '../src/ir';
import { readDst } from '../src/readers/dst';
import { readExp } from '../src/readers/exp';
import { readHus } from '../src/readers/hus';
import { readPes } from '../src/readers/pes';
import { readVip } from '../src/readers/vip';
import { readVp3 } from '../src/readers/vp3';
import { readXxx } from '../src/readers/xxx';
import { writeDst } from '../src/writers/dst';
import { writeExp } from '../src/writers/exp';
import { writeHus } from '../src/writers/hus';
import { writePes } from '../src/writers/pes';
import { writeVip } from '../src/writers/vip';
import { writeVp3 } from '../src/writers/vp3';
import { writeXxx } from '../src/writers/xxx';

const S = (x: number, y: number): Stitch => ({ x, y, command: 'STITCH' });
const J = (x: number, y: number): Stitch => ({ x, y, command: 'JUMP' });
const T = (x: number, y: number): Stitch => ({ x, y, command: 'TRIM' });
const C = (x: number, y: number): Stitch => ({ x, y, command: 'COLOR_CHANGE' });

describe('removeTrims', () => {
  it('strips TRIM records and keeps every other record', () => {
    const input = [S(10, 10), T(10, 10), J(20, 20), S(30, 30), T(30, 30), C(30, 30)];
    expect(removeTrims(input)).toEqual([S(10, 10), J(20, 20), S(30, 30), C(30, 30)]);
  });

  it('returns a new array (does not mutate the input)', () => {
    const input = [S(10, 10), T(10, 10)];
    const out = removeTrims(input);
    expect(input).toHaveLength(2);
    expect(out).not.toBe(input);
  });
});

describe('addTrims', () => {
  it('inserts a TRIM before a color change that follows a stitch run', () => {
    const out = addTrims([S(10, 10), C(20, 20), S(30, 30), C(40, 40)]);
    expect(out.map((s) => s.command)).toEqual([
      'STITCH',
      'TRIM',
      'COLOR_CHANGE',
      'STITCH',
      'TRIM',
      'COLOR_CHANGE',
    ]);
    // No-move trims at the color change position (the needle is there).
    expect(out[1]).toEqual({ x: 20, y: 20, command: 'TRIM' });
    expect(out[4]).toEqual({ x: 40, y: 40, command: 'TRIM' });
  });

  it('inserts a TRIM before a jump run that reaches the count trigger', () => {
    const out = addTrims([S(0, 0), J(5, 0), J(10, 0), J(15, 0), S(20, 0)], {
      distanceToRequireTrim: Infinity,
      jumpsToRequireTrim: 3,
    });
    expect(out.map((s) => s.command)).toEqual(['STITCH', 'TRIM', 'JUMP', 'JUMP', 'JUMP', 'STITCH']);
    // Relative trim at the record preceding the jump run.
    expect(out[1]).toEqual({ x: 0, y: 0, command: 'TRIM' });
  });

  it('inserts a TRIM before a jump run whose travel exceeds the distance trigger', () => {
    const out = addTrims([S(0, 0), J(40, 0), S(50, 0)], {
      jumpsToRequireTrim: Infinity,
      distanceToRequireTrim: 30,
    });
    expect(out.map((s) => s.command)).toEqual(['STITCH', 'TRIM', 'JUMP', 'STITCH']);
  });

  it('does not double-trim: TRIM/STOP/COLOR_CHANGE/start suppress insertion', () => {
    expect(addTrims([T(0, 0), J(5, 0), S(10, 0)]).map((s) => s.command)).toEqual([
      'TRIM',
      'JUMP',
      'STITCH',
    ]);
    expect(addTrims([J(5, 0), S(10, 0)]).map((s) => s.command)).toEqual(['JUMP', 'STITCH']);
  });

  it('applies both triggers by default on the sample pattern', () => {
    const out = addTrims(ROUND_TRIP_SAMPLE().stitches);
    const trims = out.filter((s) => s.command === 'TRIM');
    expect(trims).toHaveLength(3);
    expect(out[2]).toEqual({ x: 110, y: 110, command: 'TRIM' });
    expect(out[7]).toEqual({ x: 190, y: 130, command: 'TRIM' });
    expect(out[10]).toEqual({ x: 190, y: 140, command: 'TRIM' });
  });

  it('leaves a pattern without jump runs or untrimmed changes unchanged', () => {
    expect(addTrims([S(0, 0), S(5, 5), { x: 0, y: 0, command: 'END' }]).map((s) => s.command)).toEqual(
      ['STITCH', 'STITCH', 'END'],
    );
  });

  it('does not mutate the input array', () => {
    const sample = ROUND_TRIP_SAMPLE().stitches;
    const copy = sample.map((s) => ({ ...s }));
    addTrims(sample);
    expect(sample).toEqual(copy);
  });
});

// ---------------------------------------------------------------------------
// Round trips: edit → write → read → the edit survives (or the format's
// documented limitation shows). One color block, travels small enough that
// every writer encodes them as single jumps (no gap interpolation).
// ---------------------------------------------------------------------------

function ROUND_TRIP_SAMPLE(): Pattern {
  const stitches: Stitch[] = [
    S(100, 100),
    S(110, 110),
    J(150, 110), // run 1: two jumps, 60-unit travel (> 30 mm trigger)
    J(170, 110),
    S(180, 120),
    S(190, 130),
    C(190, 130),
    S(190, 140),
    J(190, 180), // run 2: single jump, 40-unit travel
    S(195, 185),
    { x: 0, y: 0, command: 'END' },
  ];
  return {
    stitches,
    threads: [{ rgb: 0xff0000 }],
    extents: { minX: 100, minY: 100, maxX: 195, maxY: 185 },
  };
}

const trimCount = (pattern: Pattern): number =>
  pattern.stitches.filter((s) => s.command === 'TRIM').length;

/**
 * Formats with a real trim encoding: an added TRIM decodes back to exactly
 * the inserted trims, and a stripped pattern decodes trim-free.
 * VP3 always appends its end-of-design explicit trim; PEC/PES flag every
 * travel jump and JEF re-derives trims heuristically on read — those are
 * documented format behaviors, asserted separately below.
 */
const NATIVE_TRIM_FORMATS: Array<{
  format: string;
  write: (p: Pattern) => { bytes: Uint8Array };
  read: (b: Uint8Array) => Pattern;
  added: number;
  removed: number;
}> = [
  { format: 'dst', write: writeDst, read: readDst, added: 3, removed: 0 },
  { format: 'exp', write: writeExp, read: readExp, added: 3, removed: 0 },
  { format: 'hus', write: writeHus, read: readHus, added: 3, removed: 0 },
  { format: 'vip', write: writeVip, read: readVip, added: 3, removed: 0 },
  { format: 'xxx', write: writeXxx, read: readXxx, added: 3, removed: 0 },
  { format: 'vp3', write: writeVp3, read: readVp3, added: 4, removed: 1 },
];

for (const { format, write, read, added, removed } of NATIVE_TRIM_FORMATS) {
  describe(`trim edits round trip — ${format}`, () => {
    it('addTrims survives encode/decode', () => {
      const pattern = ROUND_TRIP_SAMPLE();
      const { bytes } = write({ ...pattern, stitches: addTrims(pattern.stitches) });
      const readBack = read(bytes);
      expect(
        readBack.stitches.filter((s) => s.command === 'TRIM'),
      ).toHaveLength(added);
    });

    it('removeTrims yields the expected decode', () => {
      const pattern = ROUND_TRIP_SAMPLE();
      const { bytes } = write({ ...pattern, stitches: removeTrims(pattern.stitches) });
      const readBack = read(bytes);
      expect(
        readBack.stitches.filter((s) => s.command === 'TRIM'),
      ).toHaveLength(removed);
    });
  });
}

describe('trim edits round trip — PES (trim flag rides the travel jump)', () => {
  it('addTrims encodes machine trims on the travel jumps', () => {
    const pattern = ROUND_TRIP_SAMPLE();
    const { bytes } = writePes({ ...pattern, stitches: addTrims(pattern.stitches) });
    const readBack = readPes(bytes);
    expect(
      readBack.stitches.filter((s) => s.command === 'TRIM').length,
    ).toBeGreaterThanOrEqual(3);
  });

  it('removeTrims cannot fully remove trims: every post-init travel jump is trim-flagged', () => {
    const pattern = ROUND_TRIP_SAMPLE();
    const { bytes } = writePes({ ...pattern, stitches: removeTrims(pattern.stitches) });
    const readBack = readPes(bytes);
    expect(readBack.stitches.some((s) => s.command === 'TRIM')).toBe(true);
  });
});
