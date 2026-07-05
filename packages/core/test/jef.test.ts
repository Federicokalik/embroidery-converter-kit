import { describe, expect, it } from 'vitest';
import { readJef } from '../src/readers/jef';
import { writeJef } from '../src/writers/jef';
import { expectPatternMatchesDump } from './format-helpers';
import {
  GOLDEN_PATTERNS,
  loadGoldenBytes,
  loadGoldenJson,
  patternFromDump,
} from './helpers';

const JEF_DATE = '20260704120000'; // pinned in gen_format_golden.py

describe('JEF', () => {
  for (const name of GOLDEN_PATTERNS) {
    it(`writes ${name} byte-identical to pyembroidery`, () => {
      const pattern = patternFromDump(loadGoldenJson(name, 'ir'));
      const { bytes } = writeJef(pattern, { date: JEF_DATE });
      expect(bytes).toEqual(loadGoldenBytes(name, 'jef'));
    });

    it(`reads ${name}.jef exactly like pyembroidery`, () => {
      const pattern = readJef(loadGoldenBytes(name, 'jef'));
      expectPatternMatchesDump(pattern, loadGoldenJson(name, 'jef.read'));
    });
  }
});
