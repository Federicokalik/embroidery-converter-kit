import { describe, expect, it } from 'vitest';
import { readVp3 } from '../src/readers/vp3';
import { writeVp3 } from '../src/writers/vp3';
import { expectPatternMatchesDump } from './format-helpers';
import {
  GOLDEN_PATTERNS,
  loadGoldenBytes,
  loadGoldenJson,
  patternFromDump,
} from './helpers';

describe('VP3', () => {
  for (const name of GOLDEN_PATTERNS) {
    it(`writes ${name} byte-identical to pyembroidery`, () => {
      const pattern = patternFromDump(loadGoldenJson(name, 'ir'));
      const { bytes } = writeVp3(pattern);
      expect(bytes).toEqual(loadGoldenBytes(name, 'vp3'));
    });

    it(`reads ${name}.vp3 exactly like pyembroidery`, () => {
      const pattern = readVp3(loadGoldenBytes(name, 'vp3'));
      expectPatternMatchesDump(pattern, loadGoldenJson(name, 'vp3.read'));
    });
  }
});
