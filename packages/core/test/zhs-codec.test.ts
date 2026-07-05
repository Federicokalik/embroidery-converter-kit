import { describe, expect, it } from 'vitest';
import { decodeDelta, encodeDelta, isEncodableDelta } from '../src/zhs-codec';

describe('ZHS delta codec', () => {
  it('round-trips every encodable (dx, dy) pair exactly', () => {
    const encodable: number[] = [];
    for (let v = -129; v <= 128; v++) {
      if (isEncodableDelta(v)) encodable.push(v);
    }
    expect(encodable.length).toBe(256); // 258 values minus the ±63 holes
    for (const dx of encodable) {
      for (const dy of encodable) {
        const [b1, b2] = encodeDelta(dx, dy);
        expect(decodeDelta(b1, b2)).toEqual([dx, dy]);
      }
    }
  });

  it('documents the ±63 hole: they decode as ±64', () => {
    expect(isEncodableDelta(63)).toBe(false);
    expect(isEncodableDelta(-63)).toBe(false);
    // Storing an unadjusted 63 (what a naive encoder would emit) reads back as 64.
    const [b1, b2] = encodeDelta(63, -63);
    expect(decodeDelta(b1, b2)).toEqual([64, -64]);
  });
});
