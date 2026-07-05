import { describe, expect, it } from 'vitest';
import { readPcs } from '../src/readers/pcs';
import { readSew } from '../src/readers/sew';
import { readShv } from '../src/readers/shv';
import { expectPatternMatchesDump } from './format-helpers';
import { loadGoldenBytes, loadGoldenJson } from './helpers';

// Read-only formats: pyembroidery cannot write them, so the goldens are
// synthetic files built by scripts/gen_readonly_golden.py and the reader
// contract is parity with pyembroidery's read-back dump.
describe('SEW (read-only)', () => {
  it('reads synthetic.sew exactly like pyembroidery', () => {
    const pattern = readSew(loadGoldenBytes('synthetic', 'sew'));
    expectPatternMatchesDump(pattern, loadGoldenJson('synthetic', 'sew.read'));
  });

  it('surfaces the chart thread metadata', () => {
    const pattern = readSew(loadGoldenBytes('synthetic', 'sew'));
    expect(pattern.threads.map((t) => t.description)).toEqual(['Sunflower', 'Brown']);
  });
});

describe('SHV (read-only)', () => {
  it('reads synthetic.shv exactly like pyembroidery', () => {
    const pattern = readShv(loadGoldenBytes('synthetic', 'shv'));
    expectPatternMatchesDump(pattern, loadGoldenJson('synthetic', 'shv.read'));
  });
});

describe('PCS (read-only)', () => {
  it('reads synthetic.pcs exactly like pyembroidery', () => {
    const pattern = readPcs(loadGoldenBytes('synthetic', 'pcs'));
    expectPatternMatchesDump(pattern, loadGoldenJson('synthetic', 'pcs.read'));
  });

  it('wires the hoop byte into pattern.hoop (code 2 = 80x80 mm)', () => {
    const pattern = readPcs(loadGoldenBytes('synthetic', 'pcs'));
    expect(pattern.hoop).toEqual({ width: 800, height: 800, name: '80x80' });
  });
});
