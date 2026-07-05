import { describe, expect, it } from 'vitest';
import type { Stitch } from '../src/ir';
import { readPes } from '../src/readers/pes';
import { readZhs } from '../src/readers/zhs';
import { writeZhs } from '../src/writers/zhs';
import { loadFixture } from './helpers';

/**
 * Ground truth: SHE2215A_003, a real factory multicolor design shipped both
 * as .zhs and .pes (same design, independently compiled — stitch coordinates
 * differ slightly, but block structure and thread list must agree).
 */
const EXPECTED_RGBS = [
  0xa8deeb, 0xf0f0f0, 0xed171f, 0xf64a8a, 0xf73866, 0xed171f, 0xf0f0f0,
  0xf64a8a, 0x000000, 0xf0f0f0,
];
const EXPECTED_NAMES = [
  'Light Blue', 'White', 'Red', 'Deep Rose', 'Carmine', 'Red', 'White',
  'Deep Rose', 'Black', 'White',
];

function penPath(stitches: Stitch[]): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const s of stitches) {
    if (s.command !== 'STITCH') continue;
    const last = out[out.length - 1];
    if (last === undefined || last[0] !== s.x || last[1] !== s.y) out.push([s.x, s.y]);
  }
  return out;
}

describe('ZHS multicolor (SHE2215A_003 factory sample)', () => {
  const factory = readZhs(loadFixture('zhs-samples/SHE2215A_003.zhs'));

  it('reads one thread per color block via the COLOR_CHANGE payload', () => {
    expect(factory.threads.map((t) => t.rgb)).toEqual(EXPECTED_RGBS);
    expect(factory.threads.map((t) => t.description)).toEqual(EXPECTED_NAMES);
  });

  it('reads the expected stream structure', () => {
    expect(factory.stitches.filter((s) => s.command === 'STITCH')).toHaveLength(9302);
    expect(factory.stitches.filter((s) => s.command === 'COLOR_CHANGE')).toHaveLength(9);
  });

  it('agrees with the PES twin on threads and block structure', () => {
    const pes = readPes(loadFixture('zhs-samples/SHE2215A_003.pes'));
    expect(pes.threads.map((t) => t.rgb)).toEqual(EXPECTED_RGBS);
    expect(pes.stitches.filter((s) => s.command === 'STITCH')).toHaveLength(9302);
    expect(pes.stitches.filter((s) => s.command === 'COLOR_CHANGE')).toHaveLength(9);
  });

  it('rewrites the factory design preserving path, blocks and palette', () => {
    const { bytes, warnings } = writeZhs(factory);
    const back = readZhs(bytes);
    expect(back.threads).toEqual(factory.threads);
    expect(back.stitches.filter((s) => s.command === 'COLOR_CHANGE')).toHaveLength(9);
    expect(penPath(back.stitches)).toEqual(penPath(factory.stitches));
    expect(warnings.some((w) => w.code === 'FILLER_THREAD')).toBe(false);

    // The regenerated header must agree with the factory file on the
    // derivable global fields: palette block and hoop-independent geometry.
    const factoryBytes = loadFixture('zhs-samples/SHE2215A_003.zhs');
    const fv = new DataView(factoryBytes.buffer, factoryBytes.byteOffset);
    const gv = new DataView(bytes.buffer, bytes.byteOffset);
    expect(gv.getUint32(0x0b, true)).toBe(fv.getUint32(0x0b, true)); // stitch count
    expect(gv.getUint32(0x13, true)).toBe(fv.getUint32(0x13, true)); // headerStart
    expect(bytes[0x65]).toBe(10); // block count
  });
});
