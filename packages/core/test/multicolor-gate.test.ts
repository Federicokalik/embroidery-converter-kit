import { describe, expect, it } from 'vitest';
import { convert, readVip, readZhs } from '../src/index';
import { buildSyntheticVip } from './helpers';

// Multi-color ZHS writing was unlocked by the SHE2215A_003 factory sample
// (see docs/ZHS_FORMAT.md). TRIMs are dropped with a warning: no ZHS sample
// contains a trim record and the machine has no trimmer.
describe('multi-color ZHS (end to end)', () => {
  const multicolorVip = buildSyntheticVip(
    [
      [0x80, 5, 5],
      [0x80, 5, -5],
      [0x84, 0, 0], // color change
      [0x80, 5, 5],
      [0x80, 5, -5],
    ],
    2,
  );

  it('the synthetic VIP parses and carries the COLOR_CHANGE command', () => {
    const pattern = readVip(multicolorVip);
    expect(pattern.stitches.map((s) => s.command)).toEqual([
      'STITCH',
      'STITCH',
      'COLOR_CHANGE',
      'STITCH',
      'STITCH',
    ]);
  });

  it('convert() to ZHS preserves the pen path and the color change', () => {
    const source = readVip(multicolorVip);
    const { bytes } = convert(multicolorVip, 'vip', 'zhs');
    const back = readZhs(bytes);
    expect(back.stitches.filter((s) => s.command === 'COLOR_CHANGE')).toHaveLength(1);
    const pen = (stitches: typeof back.stitches): Array<[number, number]> => {
      const out: Array<[number, number]> = [];
      for (const s of stitches) {
        if (s.command !== 'STITCH') continue;
        const last = out[out.length - 1];
        if (last === undefined || last[0] !== s.x || last[1] !== s.y) out.push([s.x, s.y]);
      }
      return out;
    };
    expect(pen(back.stitches)).toEqual(pen(source.stitches));
    expect(back.threads).toHaveLength(2);
  });

  it('a TRIM design converts with the trim dropped and a warning', () => {
    const trimVip = buildSyntheticVip(
      [
        [0x80, 5, 5],
        [0x88, 0, 0], // trim
        [0x80, 5, 5],
      ],
      1,
    );
    const { bytes, warnings } = convert(trimVip, 'vip', 'zhs');
    expect(warnings.some((w) => w.code === 'TRIM_DROPPED')).toBe(true);
    const back = readZhs(bytes);
    expect(back.stitches.some((s) => s.command === 'TRIM')).toBe(false);
    expect(back.stitches.filter((s) => s.command === 'STITCH').length).toBeGreaterThan(0);
  });
});
