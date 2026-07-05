import { describe, expect, it } from 'vitest';
import { UnsupportedDesignError } from '../src/ir';
import type { Pattern, Stitch } from '../src/ir';
import { computeExtents } from '../src/ir';
import { readVip } from '../src/readers/vip';
import { readZhs } from '../src/readers/zhs';
import { writeZhs } from '../src/writers/zhs';
import { FIXTURE_STEMS, HAS_PRIVATE_FIXTURES, loadFixture } from './helpers';

function byteDiffOffsets(a: Uint8Array, b: Uint8Array): number[] {
  const diffs: number[] = [];
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) diffs.push(i);
  }
  return diffs;
}

/** Collapse consecutive duplicate positions (tie-in stitches are no-ops). */
function strippedPath(stitches: Stitch[]): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const s of stitches) {
    if (s.command !== 'STITCH' && s.command !== 'JUMP') continue;
    const last = out[out.length - 1];
    if (last === undefined || last[0] !== s.x || last[1] !== s.y) {
      out.push([s.x, s.y]);
    }
  }
  return out;
}

function patternOf(points: Array<[number, number]>): Pattern {
  const stitches: Stitch[] = points.map(([x, y]) => ({ x, y, command: 'STITCH' }));
  return { stitches, threads: [], extents: computeExtents(stitches) };
}

describe('writeZhs — ground truth', () => {
  it.skipIf(!HAS_PRIVATE_FIXTURES)('regenerates 028-B.zhs byte-identically except exactly offset 0x83', () => {
    const generated = writeZhs(readVip(loadFixture('028-B.vip'))).bytes;
    const reference = loadFixture('028-B.zhs');
    expect(generated.length).toBe(reference.length);
    // The one non-derivable byte: 0x83 editor metadata (we write 0, Artist
    // Toolkit wrote 2). Assert the diff is EXACTLY this — nothing more.
    expect(byteDiffOffsets(generated, reference)).toEqual([0x83]);
  });

  it.skipIf(!HAS_PRIVATE_FIXTURES)('does NOT chase byte-identity for 001s-A (documented Artist Toolkit quirk)', () => {
    // Artist Toolkit appended an extra (0,0) tie stitch in this sample; the
    // clean record mapping is 2 records (6 bytes) shorter. Functional
    // equivalence is asserted in the round-trip suite below.
    const generated = writeZhs(readVip(loadFixture('001s-A.vip'))).bytes;
    const reference = loadFixture('001s-A.zhs');
    expect(reference.length - generated.length).toBe(6);
  });

  for (const stem of FIXTURE_STEMS) {
    it(`functional round-trip: ${stem}.vip → ZHS → same absolute stitch path`, () => {
      const source = readVip(loadFixture(`${stem}.vip`));
      const { bytes, warnings } = writeZhs(source);
      const roundTripped = readZhs(bytes);
      expect(strippedPath(roundTripped.stitches)).toEqual(strippedPath(source.stitches));
      // No fixture contains a ±63 delta, so the only warning is the 0x83 note.
      expect(warnings.map((w) => w.code)).toEqual(['METADATA_0X83_ZEROED']);
    });
  }
});

describe('writeZhs — gates and formerly-gated features', () => {
  const base = patternOf([
    [1, 1],
    [2, 2],
  ]);

  it('rejects empty designs', () => {
    expect(() => writeZhs({ stitches: [], threads: [], extents: computeExtents([]) }))
      .toThrow(UnsupportedDesignError);
  });

  const trimPattern: Pattern = {
    ...base,
    stitches: [
      ...base.stitches,
      { x: 2, y: 2, command: 'TRIM' }, // mid-color trim: no pause follows
      { x: 30, y: 30, command: 'JUMP' },
      { x: 30, y: 30, command: 'STITCH' },
      { x: 35, y: 35, command: 'STITCH' },
    ],
    threads: [{ rgb: 0x336699 }],
  };

  it('drops TRIM with a warning (no trim record exists in any ZHS sample)', () => {
    const { bytes, warnings } = writeZhs(trimPattern);
    expect(warnings.filter((w) => w.code === 'TRIM_DROPPED')).toHaveLength(1);
    const back = readZhs(bytes);
    expect(back.stitches.some((s) => s.command === 'TRIM')).toBe(false);
    expect(back.stitches.filter((s) => s.command === 'COLOR_CHANGE')).toHaveLength(0);
    expect(strippedPath(back.stitches)).toEqual(
      strippedPath(trimPattern.stitches.filter((s) => s.command !== 'TRIM')),
    );
  });

  it('trims: "pause" turns a mid-color trim into a same-color machine stop', () => {
    const { bytes, warnings } = writeZhs(trimPattern, { trims: 'pause' });
    expect(warnings.filter((w) => w.code === 'TRIM_DROPPED')).toHaveLength(0);
    const back = readZhs(bytes);
    // the pause is a color change onto the SAME color (duplicated thread)
    expect(back.stitches.filter((s) => s.command === 'COLOR_CHANGE')).toHaveLength(1);
    expect(back.threads.map((t) => t.rgb)).toEqual([0x336699, 0x336699]);
    expect(strippedPath(back.stitches)).toEqual(
      strippedPath(trimPattern.stitches.filter((s) => s.command !== 'TRIM')),
    );
  });

  it('trims: "pause" drops a trim that already precedes a color change', () => {
    const pattern: Pattern = {
      ...base,
      stitches: [
        ...base.stitches,
        { x: 2, y: 2, command: 'TRIM' }, // redundant: the machine pauses at the CC
        { x: 2, y: 2, command: 'COLOR_CHANGE' },
        { x: 30, y: 30, command: 'STITCH' },
        { x: 35, y: 35, command: 'STITCH' },
      ],
      threads: [{ rgb: 0xff0000 }, { rgb: 0x0000ff }],
    };
    const back = readZhs(writeZhs(pattern, { trims: 'pause' }).bytes);
    expect(back.stitches.filter((s) => s.command === 'COLOR_CHANGE')).toHaveLength(1);
    expect(back.threads.map((t) => t.rgb)).toEqual([0xff0000, 0x0000ff]);
  });

  it('mid-design jumps become MOVE runs and survive the round trip', () => {
    const pattern: Pattern = {
      ...base,
      stitches: [
        ...base.stitches,
        { x: 50, y: 40, command: 'JUMP' },
        { x: 50, y: 40, command: 'STITCH' },
        { x: 55, y: 45, command: 'STITCH' },
      ],
    };
    const { bytes } = writeZhs(pattern);
    const back = readZhs(bytes);
    expect(strippedPath(back.stitches)).toEqual(strippedPath(pattern.stitches));
  });

  it('splits jumps longer than the ±128 record range', () => {
    const { bytes } = writeZhs(patternOf([[0, 0], [400, -300]]));
    const back = readZhs(bytes);
    const path = strippedPath(back.stitches);
    expect(path[path.length - 1]).toEqual([400, -300]);
  });

  it('COLOR_CHANGE writes a multicolor file that round-trips threads in block order', () => {
    const pattern: Pattern = {
      stitches: [
        { x: 0, y: 0, command: 'STITCH' },
        { x: 10, y: 0, command: 'STITCH' },
        { x: 10, y: 0, command: 'COLOR_CHANGE' },
        { x: 20, y: 5, command: 'STITCH' },
        { x: 30, y: 5, command: 'STITCH' },
        { x: 30, y: 5, command: 'COLOR_CHANGE' },
        { x: 40, y: -5, command: 'STITCH' },
        { x: 50, y: -5, command: 'STITCH' },
      ],
      threads: [
        { rgb: 0xff0000, description: 'Red' },
        { rgb: 0x0000ff, description: 'Blue' },
        { rgb: 0xff0000, description: 'Red' }, // repeated color, own block
      ],
      extents: computeExtents([]),
    };
    const { bytes, warnings } = writeZhs(pattern);
    const back = readZhs(bytes);
    expect(back.threads.map((t) => t.rgb)).toEqual([0xff0000, 0x0000ff, 0xff0000]);
    expect(back.threads.map((t) => t.description)).toEqual(['Red', 'Blue', 'Red']);
    expect(back.stitches.filter((s) => s.command === 'COLOR_CHANGE')).toHaveLength(2);
    expect(strippedPath(back.stitches)).toEqual(strippedPath(pattern.stitches));
    // palette stores unique colors only
    expect(bytes[new DataView(bytes.buffer).getUint32(0x13, true)]).toBe(2);
    expect(warnings.some((w) => w.code === 'FILLER_THREAD')).toBe(false);
  });

  it('STOP becomes a color change to a duplicated thread', () => {
    const pattern: Pattern = {
      stitches: [
        { x: 0, y: 0, command: 'STITCH' },
        { x: 10, y: 0, command: 'STITCH' },
        { x: 10, y: 0, command: 'STOP' },
        { x: 20, y: 0, command: 'STITCH' },
      ],
      threads: [{ rgb: 0x123456 }],
      extents: computeExtents([]),
    };
    const { bytes } = writeZhs(pattern);
    const back = readZhs(bytes);
    expect(back.threads.map((t) => t.rgb)).toEqual([0x123456, 0x123456]);
    expect(back.stitches.filter((s) => s.command === 'COLOR_CHANGE')).toHaveLength(1);
  });
});

describe('writeZhs — ±63 codec hole handling', () => {
  it('shifts a ±63 delta to ±64, warns, and self-corrects on the next stitch', () => {
    // (10,0) → (73,0) is dx=63 (unrepresentable) → written as 64;
    // (73,0) → (80,0) is computed against the *emitted* 74, so dx=6.
    const { bytes, warnings } = writeZhs(patternOf([[10, 0], [73, 0], [80, 0]]));
    expect(warnings.filter((w) => w.code === 'DELTA_63_SHIFTED')).toHaveLength(1);

    const path = strippedPath(readZhs(bytes).stitches);
    expect(path).toEqual([
      [10, 0],
      [74, 0], // the one stitch that deviates by 0.1 mm
      [80, 0], // subsequent stitches land exactly where intended
    ]);
  });
});
