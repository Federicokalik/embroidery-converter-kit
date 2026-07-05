import { describe, expect, it } from 'vitest';
import { readXxx } from '../src/readers/xxx';
import { writeXxx } from '../src/writers/xxx';
import { expectPatternMatchesDump } from './format-helpers';
import {
  GOLDEN_PATTERNS,
  loadGoldenBytes,
  loadGoldenJson,
  patternFromDump,
} from './helpers';

describe('XXX', () => {
  for (const name of GOLDEN_PATTERNS) {
    it(`writes ${name} byte-identical to pyembroidery`, () => {
      const pattern = patternFromDump(loadGoldenJson(name, 'ir'));
      const { bytes } = writeXxx(pattern);
      expect(bytes).toEqual(loadGoldenBytes(name, 'xxx'));
    });

    it(`reads ${name}.xxx exactly like pyembroidery`, () => {
      const pattern = readXxx(loadGoldenBytes(name, 'xxx'));
      expectPatternMatchesDump(pattern, loadGoldenJson(name, 'xxx.read'));
    });
  }
});
