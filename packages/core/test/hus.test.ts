import { describe, it } from 'vitest';
import { readHus } from '../src/readers/hus';
import { expectPatternMatchesDump } from './format-helpers';
import { loadGoldenBytes, loadGoldenJson } from './helpers';

// The golden is a synthetic HUS (pyembroidery has no HUS writer) built from
// stored-block compressed streams; the expectation is pyembroidery's own
// read-back of that file. See scripts/gen_hus_golden.py.
describe('HUS', () => {
  it('reads synthetic.hus exactly like pyembroidery', () => {
    const pattern = readHus(loadGoldenBytes('synthetic', 'hus'));
    expectPatternMatchesDump(pattern, loadGoldenJson('synthetic', 'hus.read'));
  });
});
