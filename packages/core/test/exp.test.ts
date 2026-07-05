import { describe, expect, it } from 'vitest';
import { readExp } from '../src/readers/exp';
import { writeExp } from '../src/writers/exp';
import { expectPatternMatchesDump } from './format-helpers';
import {
  GOLDEN_PATTERNS,
  loadGoldenBytes,
  loadGoldenJson,
  patternFromDump,
} from './helpers';

describe('EXP', () => {
  for (const name of GOLDEN_PATTERNS) {
    it(`writes ${name} byte-identical to pyembroidery`, () => {
      const pattern = patternFromDump(loadGoldenJson(name, 'ir'));
      const { bytes } = writeExp(pattern);
      expect(bytes).toEqual(loadGoldenBytes(name, 'exp'));
    });

    it(`reads ${name}.exp exactly like pyembroidery`, () => {
      const pattern = readExp(loadGoldenBytes(name, 'exp'));
      expectPatternMatchesDump(pattern, loadGoldenJson(name, 'exp.read'));
    });
  }
});
