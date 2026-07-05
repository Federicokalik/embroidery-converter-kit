/**
 * SHV reader (Husqvarna Viking) — port of pyembroidery/ShvReader.py.
 * Color changes are not encoded in the stitch stream: each palette entry
 * declares a stitch-record budget and the reader inserts a COLOR_CHANGE when
 * the running count exhausts it. pyembroidery-parity quirks kept:
 *   - the stitch stream starts 2 bytes BEFORE the end of the color table
 *     (the reference does f.seek(-2, 1) after reading it);
 *   - deltas are NOT y-negated (SHV stores y in IR orientation), and 0x80/01
 *     moves use big-endian 16-bit deltas, also unnegated;
 *   - an unknown 0x80 control falls through and decodes 0x80 itself as
 *     dx = -128, counting 2 records against the color budget;
 *   - the design-name metadata string is skipped (the IR carries none).
 */
import { ByteReader } from '../binary';
import { SHV_THREADS } from '../charts/shv-threads';
import { signed8 } from '../embcompress';
import { computeExtents, FormatError } from '../ir';
import type { Pattern, Stitch, Thread } from '../ir';

export function readShv(data: Uint8Array): Pattern {
  if (data.length < 0x59) {
    throw new FormatError('Not an SHV file (header truncated).');
  }
  const r = new ByteReader(data);
  r.skip(0x56); // header text
  const nameLength = r.u8();
  r.skip(nameLength); // design name (metadata only)
  const designWidth = r.u8();
  const designHeight = r.u8();
  const bitmapSkip = Math.ceil(designHeight / 2) * designWidth;
  r.skip(4 + bitmapSkip);
  const colorCount = r.u8();
  // 0 colors (or a truncated header) makes pyembroidery fail with an
  // uncaught KeyError on the first budget lookup; surface it as FormatError.
  if (colorCount <= 0) {
    throw new FormatError('Corrupt SHV header (no color table).');
  }
  r.skip(18);

  const threads: Thread[] = [];
  const stitchesPerColor: number[] = [];
  for (let i = 0; i < colorCount; i++) {
    const stitchCount = r.u32be();
    const colorCode = r.u8();
    const t = SHV_THREADS[colorCode % SHV_THREADS.length];
    threads.push(t ?? { rgb: 0 });
    stitchesPerColor.push(stitchCount);
    r.skip(9);
  }
  r.skip(-2); // stream starts inside the last color entry's padding

  const stitches: Stitch[] = [];
  let x = 0;
  let y = 0;
  let inJump = false;
  let stitchesSinceStop = 0;
  let currentColorIndex = 0;
  let maxStitches = stitchesPerColor[currentColorIndex]!;
  while (true) {
    const command: 'STITCH' | 'JUMP' = inJump ? 'JUMP' : 'STITCH';
    const b0 = r.u8();
    const b1 = r.u8();
    if (b1 < 0) break;
    if (stitchesSinceStop >= maxStitches) {
      stitches.push({ x, y, command: 'COLOR_CHANGE' });
      stitchesSinceStop = 0;
      currentColorIndex += 1;
      maxStitches = stitchesPerColor[currentColorIndex] ?? 0xffffffff;
    }
    if (b0 === 0x80) {
      stitchesSinceStop += 1;
      if (b1 === 3) continue;
      if (b1 === 2) {
        inJump = false;
        continue;
      }
      if (b1 === 1) {
        stitchesSinceStop += 2;
        const sx = r.i16be();
        const sy = r.i16be();
        inJump = true;
        x += sx;
        y += sy;
        stitches.push({ x, y, command: 'JUMP' });
        continue;
      }
      // Unknown control: fall through, decoding 0x80 as dx = -128 (parity).
    }
    const dx = signed8(b0);
    const dy = signed8(b1);
    stitchesSinceStop += 1;
    x += dx;
    y += dy;
    stitches.push({ x, y, command });
  }

  return { stitches, threads, extents: computeExtents(stitches) };
}
