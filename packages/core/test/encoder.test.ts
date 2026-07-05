import { describe, expect, it } from 'vitest';
import { normalize } from '../src/encoder';
import type { EncoderSettings } from '../src/encoder';
import { pyround } from '../src/pyround';
import {
  DST_SETTINGS,
  EXP_SETTINGS,
  JEF_SETTINGS,
  PEC_SETTINGS,
  PES_SETTINGS,
  VP3_SETTINGS,
} from '../src/writer-settings';
import { GOLDEN_PATTERNS, loadGoldenJson, patternFromDump } from './helpers';

const SETTINGS: Array<[string, EncoderSettings]> = [
  ['dst', DST_SETTINGS],
  ['exp', EXP_SETTINGS],
  ['jef', JEF_SETTINGS],
  ['pes', PES_SETTINGS],
  ['pec', PEC_SETTINGS],
  ['vp3', VP3_SETTINGS],
];

describe('pyround', () => {
  it('matches Python round() half-to-even semantics', () => {
    expect(pyround(0.5)).toBe(0);
    expect(pyround(1.5)).toBe(2);
    expect(pyround(2.5)).toBe(2);
    expect(pyround(-0.5)).toBe(0);
    expect(pyround(-1.5)).toBe(-2);
    expect(pyround(-2.5)).toBe(-2);
    expect(pyround(1.4999999)).toBe(1);
    expect(pyround(-1.4999999)).toBe(-1);
  });
});

// The .normalized.json goldens are pyembroidery's own Transcoder output with
// each writer's merged settings — floats included. Our normalize() must match
// element-for-element, bit-for-bit.
describe('encoder normalize()', () => {
  for (const name of GOLDEN_PATTERNS) {
    for (const [ext, settings] of SETTINGS) {
      it(`${name} × ${ext}: matches pyembroidery's normalized pattern`, () => {
        const pattern = patternFromDump(loadGoldenJson(name, 'ir'));
        const golden = loadGoldenJson(name, `${ext}.normalized`);

        const result = normalize(pattern, settings);

        expect(result.stitches.map((s) => [s.x, s.y, s.command])).toEqual(golden.stitches);
        expect(result.threads.map((t) => t.rgb)).toEqual(golden.threads.map((t) => t.rgb));
        expect(result.warnings).toEqual([]);
      });
    }
  }
});
