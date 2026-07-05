import { describe, expect, it } from 'vitest';
import { HUS_THREADS } from '../src/charts/hus-threads';
import { findNearestColorIndex } from '../src/color';
import { compress, expand } from '../src/embcompress';
import type { Pattern, Stitch } from '../src/ir';
import { computeExtents } from '../src/ir';
import { interpolateStopAsDuplicateColor } from '../src/pattern-transforms';
import { readHus } from '../src/readers/hus';
import { readVip } from '../src/readers/vip';
import { writeHus } from '../src/writers/hus';
import { writeVip } from '../src/writers/vip';
import {
  FIXTURE_STEMS,
  GOLDEN_PATTERNS,
  loadFixture,
  loadGoldenJson,
  patternFromDump,
} from './helpers';

describe('EmbCompress.compress (stored blocks)', () => {
  it('emits the stored-block preamble with a decoder-order element count', () => {
    const data = [1, 2, 3, 250, 0, 128];
    // pyembroidery's own compress writes the count little-endian, which its
    // decoder misreads (works only when lo<<8|hi >= size); ours is MSB-first.
    expect([...compress(new Uint8Array(data))]).toEqual([
      0x00, 0x06, 0x02, 0xa0, 0x01, 0xfe, ...data,
    ]);
  });

  it('round-trips through expand up to the 0xFFFF stored-block limit', () => {
    for (const size of [0, 1, 255, 0x1000, 0xffff]) {
      const data = new Uint8Array(size);
      for (let i = 0; i < size; i++) data[i] = (i * 31 + 7) & 0xff;
      const back = expand(compress(data), size);
      expect(back.length).toBeGreaterThanOrEqual(size);
      expect(new Uint8Array(back.slice(0, size))).toEqual(data);
    }
  });

  it('rejects inputs beyond one stored block (pyembroidery itself crashes there)', () => {
    expect(() => compress(new Uint8Array(0x10000))).toThrow(RangeError);
  });
});

function penPath(stitches: Stitch[]): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const s of stitches) {
    if (s.command !== 'STITCH') continue;
    const last = out[out.length - 1];
    if (last === undefined || last[0] !== s.x || last[1] !== s.y) out.push([s.x, s.y]);
  }
  return out;
}

const count = (stitches: Stitch[], command: Stitch['command']): number =>
  stitches.filter((s) => s.command === command).length;

describe('HUS writer', () => {
  for (const name of GOLDEN_PATTERNS) {
    it(`round-trips ${name} through our reader`, () => {
      const pattern = patternFromDump(loadGoldenJson(name, 'ir'));
      const { bytes } = writeHus(pattern);
      const back = readHus(bytes);
      expect(penPath(back.stitches)).toEqual(penPath(pattern.stitches));
      expect(count(back.stitches, 'COLOR_CHANGE')).toBe(
        count(pattern.stitches, 'COLOR_CHANGE') + count(pattern.stitches, 'STOP'),
      );
      // threads quantize onto the fixed 29-color HUS chart
      for (const t of back.threads) {
        expect(HUS_THREADS.some((h) => h !== null && h.rgb === t.rgb)).toBe(true);
      }
    });
  }

  it('preserves trims', () => {
    const stitches: Stitch[] = [
      { x: 0, y: 0, command: 'STITCH' },
      { x: 10, y: 0, command: 'STITCH' },
      { x: 10, y: 0, command: 'TRIM' },
      { x: 30, y: 5, command: 'JUMP' },
      { x: 30, y: 5, command: 'STITCH' },
    ];
    const pattern: Pattern = {
      stitches,
      threads: [{ rgb: 0xff0000 }],
      extents: computeExtents(stitches),
    };
    const back = readHus(writeHus(pattern).bytes);
    expect(count(back.stitches, 'TRIM')).toBe(1);
    expect(penPath(back.stitches)).toEqual(penPath(stitches));
    expect(back.threads[0]!.rgb).toBe(
      HUS_THREADS[findNearestColorIndex(0xff0000, HUS_THREADS)]!.rgb,
    );
  });
});

describe('VIP writer', () => {
  for (const name of GOLDEN_PATTERNS) {
    it(`round-trips ${name} through our reader (lossless colors)`, () => {
      const pattern = patternFromDump(loadGoldenJson(name, 'ir'));
      const { bytes } = writeVip(pattern);
      const back = readVip(bytes);
      expect(penPath(back.stitches)).toEqual(penPath(pattern.stitches));
      // VIP colors are lossless 24-bit. The writer turns STOPs into color
      // changes onto duplicated threads (like PEC/PES); mirror that here.
      const stitches = pattern.stitches.map((s) => ({ ...s }));
      const threads = pattern.threads.map((t) => ({ ...t }));
      interpolateStopAsDuplicateColor(stitches, threads);
      const sourceRgbs = threads.map((t) => t.rgb & 0xffffff);
      expect(back.threads.slice(0, sourceRgbs.length).map((t) => t.rgb)).toEqual(
        sourceRgbs,
      );
    });
  }

  for (const stem of FIXTURE_STEMS) {
    it(`re-encodes fixture ${stem}.vip with identical path and color`, () => {
      const source = readVip(loadFixture(`${stem}.vip`));
      const back = readVip(writeVip(source).bytes);
      expect(penPath(back.stitches)).toEqual(penPath(source.stitches));
      expect(back.threads.map((t) => t.rgb)).toEqual(source.threads.map((t) => t.rgb));
    });
  }

  it('fixture threads decode to the known #348D1A', () => {
    const pattern = readVip(loadFixture('028-B.vip'));
    expect(pattern.threads.map((t) => t.rgb)).toEqual([0x348d1a]);
  });
});
