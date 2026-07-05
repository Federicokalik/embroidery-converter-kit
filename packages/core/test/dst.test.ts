import { describe, expect, it } from 'vitest';
import { readDst } from '../src/readers/dst';
import { writeDst } from '../src/writers/dst';
import { expectPatternMatchesDump } from './format-helpers';
import {
  GOLDEN_PATTERNS,
  loadGoldenBytes,
  loadGoldenJson,
  patternFromDump,
} from './helpers';

describe('DST', () => {
  for (const name of GOLDEN_PATTERNS) {
    it(`writes ${name} byte-identical to pyembroidery`, () => {
      const pattern = patternFromDump(loadGoldenJson(name, 'ir'));
      const { bytes } = writeDst(pattern);
      expect(bytes).toEqual(loadGoldenBytes(name, 'dst'));
    });

    it(`reads ${name}.dst exactly like pyembroidery`, () => {
      const pattern = readDst(loadGoldenBytes(name, 'dst'));
      expectPatternMatchesDump(pattern, loadGoldenJson(name, 'dst.read'));
    });
  }
});
