import { describe, expect, it } from 'vitest';
import { center, translate } from '../src/geometry';
import {
  checkFit,
  fitsHoop,
  HOOP_CATALOG,
  JEF_HOOPS,
  jefHoopCode,
  selectSmallestHoop,
} from '../src/hoops';
import type { Pattern } from '../src/ir';
import { computeExtents } from '../src/ir';
import { readJef } from '../src/readers/jef';
import { readPes } from '../src/readers/pes';
import { writeJef } from '../src/writers/jef';
import { writePes } from '../src/writers/pes';
import {
  GOLDEN_PATTERNS,
  HAS_PRIVATE_FIXTURES,
  loadGoldenBytes,
  loadGoldenJson,
  patternFromDump,
} from './helpers';

const JEF_DATE = '20260704120000'; // pinned in gen_format_golden.py

function pattern028(): Pattern {
  return patternFromDump(loadGoldenJson('028-B', 'ir'));
}

describe('hoop catalog and fit', () => {
  it('fitsHoop compares design size to hoop size', () => {
    const extents = { minX: -100, minY: -50, maxX: 100, maxY: 50 };
    expect(fitsHoop(extents, { width: 200, height: 100 })).toBe(true);
    expect(fitsHoop(extents, { width: 199, height: 100 })).toBe(false);
    expect(fitsHoop(extents, { width: 200, height: 99 })).toBe(false);
  });

  it('checkFit reports overflow and off-center placement', () => {
    const centered = { minX: -100, minY: -50, maxX: 100, maxY: 50 };
    expect(checkFit(centered, { width: 200, height: 100 })).toEqual({
      fits: true,
      overflowX: 0,
      overflowY: 0,
      requiresCentering: false,
    });
    const shifted = { minX: 0, minY: 0, maxX: 200, maxY: 100 };
    expect(checkFit(shifted, { width: 200, height: 100 })).toEqual({
      fits: true,
      overflowX: 0,
      overflowY: 0,
      requiresCentering: true,
    });
    const tooBig = { minX: -150, minY: -80, maxX: 150, maxY: 80 };
    expect(checkFit(tooBig, { width: 200, height: 100 })).toEqual({
      fits: false,
      overflowX: 100,
      overflowY: 60,
      requiresCentering: false,
    });
  });

  it('selectSmallestHoop picks the smallest containing hoop', () => {
    const extents = { minX: 0, minY: 0, maxX: 900, maxY: 900 };
    const hoop = selectSmallestHoop(extents, HOOP_CATALOG.brother);
    expect(hoop).toEqual({ width: 1000, height: 1000, name: '100x100' });
    const huge = { minX: 0, minY: 0, maxX: 9000, maxY: 9000 };
    expect(selectSmallestHoop(huge, HOOP_CATALOG.brother)).toBeUndefined();
  });

  it('jefHoopCode maps exact stock hoops to their on-disk code', () => {
    expect(jefHoopCode({ width: 1100, height: 1100 })).toBe(0);
    expect(jefHoopCode({ width: 500, height: 500 })).toBe(1);
    expect(jefHoopCode({ width: 2000, height: 2000 })).toBe(4);
    expect(jefHoopCode({ width: 1000, height: 1000 })).toBeUndefined();
  });
});

describe.skipIf(!HAS_PRIVATE_FIXTURES)('geometry transforms', () => {
  it('translate shifts stitches and extents', () => {
    const p = pattern028();
    const moved = translate(p, 100, -40);
    expect(moved.extents.minX).toBe(p.extents.minX + 100);
    expect(moved.extents.maxY).toBe(p.extents.maxY - 40);
    expect(moved.stitches[0]!.x).toBe(p.stitches[0]!.x + 100);
    // original untouched (pure function)
    expect(p.extents).toEqual(computeExtents(p.stitches));
  });

  it('center puts the bounding box symmetric around the origin', () => {
    const p = translate(pattern028(), 500, 700);
    const c = center(p);
    expect(Math.abs(c.extents.minX + c.extents.maxX)).toBeLessThanOrEqual(1);
    expect(Math.abs(c.extents.minY + c.extents.maxY)).toBeLessThanOrEqual(1);
  });
});

describe.skipIf(!HAS_PRIVATE_FIXTURES)('PES hoop', () => {
  it('default output is byte-identical with and without the stock 130x180 hoop', () => {
    const p = pattern028();
    const plain = writePes(p).bytes;
    const explicit = writePes(p, { hoop: { width: 1300, height: 1800 } }).bytes;
    expect(explicit).toEqual(plain);
    expect(plain).toEqual(loadGoldenBytes('028-B', 'pes'));
  });

  it('reads the v1 hoop flag back (default = 130x180)', () => {
    const pattern = readPes(loadGoldenBytes('028-B', 'pes'));
    expect(pattern.hoop).toEqual({ width: 1300, height: 1800, name: '130x180' });
  });

  it('opt-in 100x100 flips the v1 flag and round-trips through the reader', () => {
    const p = pattern028();
    const { bytes, warnings } = writePes(p, { hoop: { width: 1000, height: 1000 } });
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    expect(view.getUint16(12, true)).toBe(1); // scale-to-fit unchanged
    expect(view.getUint16(14, true)).toBe(0); // hoop flag: 100x100
    expect(readPes(bytes).hoop).toEqual({ width: 1000, height: 1000, name: '100x100' });
    expect(warnings.filter((w) => w.code === 'HOOP_FIT_EXCEEDED')).toEqual([]);
  });

  it('warns when the design exceeds the requested hoop', () => {
    const p = pattern028(); // ~10.5 x 6.6 mm
    const { warnings } = writePes(p, { hoop: { width: 50, height: 50 } });
    expect(warnings.some((w) => w.code === 'HOOP_FIT_EXCEEDED')).toBe(true);
  });
});

describe.skipIf(!HAS_PRIVATE_FIXTURES)('JEF hoop', () => {
  it('reads the declared hoop code from every golden file', () => {
    for (const name of GOLDEN_PATTERNS) {
      const bytes = loadGoldenBytes(name, 'jef');
      const code = new DataView(bytes.buffer, bytes.byteOffset).getUint32(0x20, true);
      expect(readJef(bytes).hoop).toEqual({ ...JEF_HOOPS[code]! });
    }
  });

  it('028-B (10.5x6.6 mm) declares the 50x50 hoop by default', () => {
    expect(readJef(loadGoldenBytes('028-B', 'jef')).hoop).toEqual({
      width: 500,
      height: 500,
      name: '50x50',
    });
  });

  it('hoop override changes exactly the code word at 0x20', () => {
    const p = pattern028();
    const plain = writeJef(p, { date: JEF_DATE }).bytes;
    const { bytes, warnings } = writeJef(p, {
      date: JEF_DATE,
      hoop: { width: 2000, height: 2000 },
    });
    expect(bytes.length).toBe(plain.length);
    const diffs: number[] = [];
    for (let i = 0; i < bytes.length; i++) {
      if (bytes[i] !== plain[i]) diffs.push(i);
    }
    expect(diffs.every((i) => i >= 0x20 && i < 0x24)).toBe(true);
    expect(diffs.length).toBeGreaterThan(0);
    expect(readJef(bytes).hoop).toEqual({ width: 2000, height: 2000, name: '200x200' });
    expect(warnings.filter((w) => w.code !== 'FILLER_THREAD')).toEqual([]);
  });

  it('non-stock hoop resolves to the smallest containing Janome hoop', () => {
    const p = pattern028();
    const { bytes } = writeJef(p, { date: JEF_DATE, hoop: { width: 1000, height: 1000 } });
    expect(readJef(bytes).hoop).toEqual({ width: 1100, height: 1100, name: '110x110' });
  });

  it('unrepresentable hoop warns and keeps the size-based default', () => {
    const p = pattern028();
    const plain = writeJef(p, { date: JEF_DATE }).bytes;
    const { bytes, warnings } = writeJef(p, {
      date: JEF_DATE,
      hoop: { width: 3000, height: 3000 },
    });
    expect(bytes).toEqual(plain);
    expect(warnings.some((w) => w.code === 'HOOP_UNSUPPORTED')).toBe(true);
  });

  it('warns when the design exceeds the requested hoop', () => {
    const p = pattern028();
    const { warnings } = writeJef(p, { date: JEF_DATE, hoop: { width: 50, height: 50 } });
    expect(warnings.some((w) => w.code === 'HOOP_FIT_EXCEEDED')).toBe(true);
  });
});
