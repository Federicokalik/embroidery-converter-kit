/**
 * EXP reader (Melco Expanded) — port of pyembroidery/ExpReader.py.
 * EXP has no header and no color data; format detection by magic is
 * impossible, so the registry relies on the file extension for EXP.
 */
import { signed8 } from '../embcompress';
import { computeExtents } from '../ir';
import type { Pattern, Stitch } from '../ir';

export function readExp(data: Uint8Array): Pattern {
  const stitches: Stitch[] = [];
  let x = 0;
  let y = 0;
  let pos = 0;
  while (pos + 2 <= data.length) {
    const b0 = data[pos]!;
    const b1 = data[pos + 1]!;
    pos += 2;
    if (b0 !== 0x80) {
      x += signed8(b0);
      y += -signed8(b1);
      stitches.push({ x, y, command: 'STITCH' });
      continue;
    }
    const control = b1;
    if (pos + 2 > data.length) break;
    const px = signed8(data[pos]!);
    const py = -signed8(data[pos + 1]!);
    pos += 2;
    if (control === 0x80) {
      stitches.push({ x, y, command: 'TRIM' });
    } else if (control === 0x02) {
      // "This shouldn't exist" per pyembroidery — kept for parity.
      x += px;
      y += py;
      stitches.push({ x, y, command: 'STITCH' });
    } else if (control === 0x04) {
      x += px;
      y += py;
      stitches.push({ x, y, command: 'JUMP' });
    } else if (control === 0x01) {
      stitches.push({ x, y, command: 'COLOR_CHANGE' });
      if (px !== 0 || py !== 0) {
        x += px;
        y += py;
        stitches.push({ x, y, command: 'JUMP' });
      }
    } else {
      break; // uncaught control
    }
  }
  return { stitches, threads: [], extents: computeExtents(stitches) };
}
