import { describe, expect, it } from 'vitest';
import { expand } from '../src/embcompress';
import { FIXTURE_STEMS, loadFixture, loadGolden } from './helpers';

// Golden vectors were produced by pyembroidery's proven expand() via
// scripts/gen_golden.py. The TS port must match them element-for-element.
describe('EmbCompress.expand', () => {
  for (const stem of FIXTURE_STEMS) {
    it(`expands the three streams of ${stem}.vip identically to pyembroidery`, () => {
      const golden = loadGolden(stem);
      const vip = loadFixture(`${stem}.vip`);
      const { attribute, x, y, eof } = golden.offsets;

      const commands = expand(vip.slice(attribute, x), golden.nst);
      const xs = expand(vip.slice(x, y), golden.nst);
      const ys = expand(vip.slice(y, eof), golden.nst);

      expect(commands).toEqual(golden.commands);
      expect(xs).toEqual(golden.xs);
      expect(ys).toEqual(golden.ys);
    });
  }
});
