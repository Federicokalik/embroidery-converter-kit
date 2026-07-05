/**
 * SEW reader (Janome/Elna) — port of pyembroidery/SewReader.py.
 * Threads come from the fixed 79-color SEW chart addressed by u16 palette
 * indices; the stitch stream starts at fixed offset 0x1D78. pyembroidery
 * quirk kept: any ODD control byte (control & 1) is a color change — checked
 * before the 0x02/0x04 move and 0x10 stitch codes — with its 2 payload bytes
 * consumed but ignored.
 */
import { ByteReader } from '../binary';
import { SEW_THREADS } from '../charts/sew-threads';
import { signed8 } from '../embcompress';
import { computeExtents, FormatError } from '../ir';
import type { Pattern, Stitch, Thread } from '../ir';

export function readSew(data: Uint8Array): Pattern {
  if (data.length < 2) {
    throw new FormatError('Not a SEW file (header truncated).');
  }
  const r = new ByteReader(data);
  const colors = r.u16le();
  const threads: Thread[] = [];
  for (let c = 0; c < colors; c++) {
    const index = r.u16le();
    if (index < 0) break;
    const t = SEW_THREADS[index % SEW_THREADS.length];
    threads.push(t ?? { rgb: 0 });
  }

  r.seek(0x1d78);
  const stitches: Stitch[] = [];
  let x = 0;
  let y = 0;
  while (true) {
    const b0 = r.u8();
    const b1 = r.u8();
    if (b0 < 0 || b1 < 0) break;
    if (b0 !== 0x80) {
      x += signed8(b0);
      y += -signed8(b1);
      stitches.push({ x, y, command: 'STITCH' });
      continue;
    }
    const control = b1;
    const c0 = r.u8();
    const c1 = r.u8();
    if (c0 < 0 || c1 < 0) break;
    if ((control & 1) !== 0) {
      stitches.push({ x, y, command: 'COLOR_CHANGE' });
      continue;
    }
    if (control === 0x04 || control === 0x02) {
      x += signed8(c0);
      y += -signed8(c1);
      stitches.push({ x, y, command: 'JUMP' });
      continue;
    }
    if (control === 0x10) {
      x += signed8(c0);
      y += -signed8(c1);
      stitches.push({ x, y, command: 'STITCH' });
      continue;
    }
    break; // uncaught control
  }

  return { stitches, threads, extents: computeExtents(stitches) };
}
