/**
 * EXP writer (Melco Expanded) — port of pyembroidery/ExpWriter.py.
 * No header, no palette; 2-byte stitch records, 0x80-prefixed controls.
 */
import { ByteWriter } from '../binary';
import { normalize } from '../encoder';
import type { ConversionWarning, Pattern } from '../ir';
import { pyround } from '../pyround';
import { EXP_SETTINGS } from '../writer-settings';

export function writeExp(pattern: Pattern): {
  bytes: Uint8Array;
  warnings: ConversionWarning[];
} {
  const { stitches, warnings } = normalize(pattern, EXP_SETTINGS);
  const w = new ByteWriter();
  let xx = 0;
  let yy = 0;
  for (const s of stitches) {
    // Deltas accumulate for EVERY record — commands that emit no coordinate
    // payload still swallow their delta (pyembroidery parity).
    const dx = pyround(s.x - xx);
    const dy = pyround(s.y - yy);
    xx += dx;
    yy += dy;
    if (s.command === 'STITCH') {
      w.u8(dx);
      w.u8(-dy);
    } else if (s.command === 'JUMP') {
      w.bytes([0x80, 0x04]);
      w.u8(dx);
      w.u8(-dy);
    } else if (s.command === 'TRIM') {
      w.bytes([0x80, 0x80, 0x07, 0x00]);
    } else if (s.command === 'COLOR_CHANGE' || s.command === 'STOP') {
      w.bytes([0x80, 0x01, 0x00, 0x00]);
    }
    // END: nothing is written
  }
  return { bytes: w.toBytes(), warnings };
}
