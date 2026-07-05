import { describe, expect, it } from 'vitest';
import { signed8 } from '../src/embcompress';
import { FormatError } from '../src/ir';
import { readVip } from '../src/readers/vip';
import { FIXTURE_STEMS, loadFixture, loadGolden, type Golden } from './helpers';

/** Recompute the expected IR path straight from the golden streams. */
function goldenPath(golden: Golden): Array<[number, number]> {
  const path: Array<[number, number]> = [];
  let x = 0;
  let y = 0;
  for (let i = 0; i < golden.nst; i++) {
    const c = golden.commands[i];
    if (c === undefined || c === 0x90) break;
    x += signed8(golden.xs[i] ?? 0);
    y -= signed8(golden.ys[i] ?? 0);
    path.push([x, y]);
  }
  return path;
}

describe('readVip', () => {
  for (const stem of FIXTURE_STEMS) {
    it(`parses ${stem}.vip into the expected IR`, () => {
      const golden = loadGolden(stem);
      const pattern = readVip(loadFixture(`${stem}.vip`));
      const expected = goldenPath(golden);

      expect(pattern.stitches.length).toBe(expected.length);
      expect(pattern.stitches.map((s) => [s.x, s.y])).toEqual(expected);
      // The monogram fixtures are pure-stitch designs.
      expect(pattern.stitches.every((s) => s.command === 'STITCH')).toBe(true);

      // IR extents vs the VIP header extents (posX, posY, negX, negY),
      // remembering IR y = -(VIP y).
      const [posX, posY, negX, negY] = golden.ext;
      expect(pattern.extents).toEqual({
        minX: negX,
        maxX: posX,
        minY: -posY,
        maxY: -negY,
      });
    });
  }

  it('rejects non-VIP bytes', () => {
    expect(() => readVip(new Uint8Array(64))).toThrow(FormatError);
  });
});
