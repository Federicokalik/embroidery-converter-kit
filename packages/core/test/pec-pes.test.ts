import { describe, expect, it } from 'vitest';
import { readPec } from '../src/readers/pec';
import { readPes } from '../src/readers/pes';
import { writePec } from '../src/writers/pec';
import { writePes } from '../src/writers/pes';
import { expectPatternMatchesDump } from './format-helpers';
import {
  GOLDEN_PATTERNS,
  loadGoldenBytes,
  loadGoldenJson,
  patternFromDump,
} from './helpers';

describe('PEC', () => {
  for (const name of GOLDEN_PATTERNS) {
    it(`writes ${name} byte-identical to pyembroidery`, () => {
      const pattern = patternFromDump(loadGoldenJson(name, 'ir'));
      const { bytes } = writePec(pattern);
      expect(bytes).toEqual(loadGoldenBytes(name, 'pec'));
    });

    it(`reads ${name}.pec exactly like pyembroidery`, () => {
      const pattern = readPec(loadGoldenBytes(name, 'pec'));
      expectPatternMatchesDump(pattern, loadGoldenJson(name, 'pec.read'));
    });
  }
});

describe('PES', () => {
  for (const name of GOLDEN_PATTERNS) {
    it(`writes ${name} byte-identical to pyembroidery`, () => {
      const pattern = patternFromDump(loadGoldenJson(name, 'ir'));
      const { bytes } = writePes(pattern);
      expect(bytes).toEqual(loadGoldenBytes(name, 'pes'));
    });

    it(`reads ${name}.pes exactly like pyembroidery`, () => {
      const pattern = readPes(loadGoldenBytes(name, 'pes'));
      expectPatternMatchesDump(pattern, loadGoldenJson(name, 'pes.read'));
    });
  }
});
