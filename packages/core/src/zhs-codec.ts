/**
 * ZHS 3-byte record delta codec (see docs/ZHS_FORMAT.md §3).
 *
 * dx/dy are 8-bit signed deltas bit-interleaved across (b1, b2), with a
 * range-extension tweak: stored values >= 63 decode one unit higher and
 * stored values <= -63 one unit lower. Consequence: the deltas +63 and -63
 * are NOT representable (the codec skips them); the decodable range is
 * -129..128 minus ±63. The ZHS writer compensates for this (see writers/zhs.ts).
 */
import { signed8 } from './embcompress';

/** Deltas exactly ±63 cannot be stored; everything else in -129..128 can. */
export function isEncodableDelta(v: number): boolean {
  return v >= -129 && v <= 128 && v !== 63 && v !== -63;
}

export function decodeDelta(b1: number, b2: number): [dx: number, dy: number] {
  let x =
    (b1 & 0b00000001) |
    (b2 & 0b00000010) |
    (b1 & 0b00000100) |
    (b2 & 0b00001000) |
    (b1 & 0b00010000) |
    (b2 & 0b00100000) |
    (b1 & 0b01000000) |
    (b2 & 0b10000000);
  x = signed8(x);
  if (x >= 63) x += 1;
  if (x <= -63) x -= 1;

  let y =
    (b2 & 0b00000001) |
    (b1 & 0b00000010) |
    (b2 & 0b00000100) |
    (b1 & 0b00001000) |
    (b2 & 0b00010000) |
    (b1 & 0b00100000) |
    (b2 & 0b01000000) |
    (b1 & 0b10000000);
  y = signed8(y);
  if (y >= 63) y += 1;
  if (y <= -63) y -= 1;

  return [x, y];
}

/** Inverse of decodeDelta. Caller must pass encodable deltas (see isEncodableDelta). */
export function encodeDelta(dx: number, dy: number): [b1: number, b2: number] {
  const adj = (v: number): number => {
    if (v >= 64) return v - 1;
    if (v <= -64) return v + 1;
    return v;
  };
  const x = adj(dx) & 0xff;
  const y = adj(dy) & 0xff;
  let b1 = 0;
  let b2 = 0;
  // x bits: 0->b1.0  1->b2.1  2->b1.2  3->b2.3  4->b1.4  5->b2.5  6->b1.6  7->b2.7
  b1 |= x & 0b01010101;
  b2 |= x & 0b10101010;
  // y bits: 0->b2.0  1->b1.1  2->b2.2  3->b1.3  4->b2.4  5->b1.5  6->b2.6  7->b1.7
  b2 |= y & 0b01010101;
  b1 |= y & 0b10101010;
  return [b1, b2];
}
