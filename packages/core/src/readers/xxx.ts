/**
 * XXX reader (Singer) — port of pyembroidery/XxxReader.py.
 * The stitch stream starts at fixed offset 0x100; the color table trails the
 * 7F 7F end marker (plus 2 pad bytes) as 32-bit big-endian 0x00RRGGBB values.
 * pyembroidery-parity quirks kept: 0x7D/0x7E records decode as JUMPs with
 * 16-bit deltas (even though the writer emits 0x7D for long STITCHes), the
 * color-change payload bytes are consumed but ignored, and an unrecognized
 * 0x7F control swallows its 2 payload bytes and is skipped.
 */
import { ByteReader } from '../binary';
import { signed16, signed8 } from '../embcompress';
import { computeExtents, FormatError } from '../ir';
import type { Pattern, Stitch, Thread } from '../ir';

export function readXxx(data: Uint8Array): Pattern {
  if (data.length < 0x100) {
    throw new FormatError('Not an XXX file (header truncated).');
  }
  const r = new ByteReader(data);
  r.skip(0x27);
  const numOfColors = r.u16le();
  r.seek(0x100);

  const stitches: Stitch[] = [];
  let x = 0;
  let y = 0;
  while (true) {
    const b1 = r.u8();
    if (b1 < 0) break;
    if (b1 === 0x7d || b1 === 0x7e) {
      // Big-move record ("not seen a 7E big jump code" per pyembroidery).
      const mx = r.u16le();
      const my = r.u16le();
      if (mx < 0 || my < 0) break;
      x += signed16(mx);
      y += -signed16(my);
      stitches.push({ x, y, command: 'JUMP' });
      continue;
    }
    const b2 = r.u8();
    if (b2 < 0) break;
    if (b1 !== 0x7f) {
      x += signed8(b1);
      y += -signed8(b2);
      stitches.push({ x, y, command: 'STITCH' });
      continue;
    }
    const b3 = r.u8();
    const b4 = r.u8();
    if (b3 < 0 || b4 < 0) break;
    if (b2 === 0x01) {
      x += signed8(b3);
      y += -signed8(b4);
      stitches.push({ x, y, command: 'JUMP' });
    } else if (b2 === 0x03) {
      stitches.push({ x, y, command: 'TRIM' });
      const dx = signed8(b3);
      const dy = -signed8(b4);
      if (dx !== 0 || dy !== 0) {
        x += dx;
        y += dy;
        stitches.push({ x, y, command: 'JUMP' });
      }
    } else if (b2 === 0x08 || (b2 >= 0x0a && b2 <= 0x17)) {
      // Displacement payload dropped on read (pyembroidery parity).
      stitches.push({ x, y, command: 'COLOR_CHANGE' });
    } else if (b2 === 0x7f || b2 === 0x18) {
      break; // end marker
    }
    // Any other 0x7F control: payload consumed, record skipped.
  }

  r.skip(2);
  const threads: Thread[] = [];
  for (let i = 0; i < numOfColors; i++) {
    const color = r.u32be();
    if (color < 0) break;
    threads.push({ rgb: color & 0xffffff });
  }

  return { stitches, threads, extents: computeExtents(stitches) };
}
