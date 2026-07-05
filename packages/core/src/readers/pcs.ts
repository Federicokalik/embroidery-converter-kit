/**
 * PCS reader (Pfaff home) — port of pyembroidery/PcsReader.py.
 * Records carry ABSOLUTE 24-bit coordinates scaled by 5/3 (PC units →
 * 0.1 mm), so positions may be fractional; pyembroidery keeps the floats and
 * so do we. The header hoop byte is wired into pattern.hoop for the one code
 * pyembroidery documents a size for (2 = PCS small hoop, 80x80 mm); the
 * others (0 = PCD, 1 = PCQ/MAXI, 3 = PCS large hoop) carry no documented
 * dimensions and are skipped.
 */
import { ByteReader } from '../binary';
import { computeExtents, FormatError } from '../ir';
import type { Hoop, Pattern, Stitch, Thread } from '../ir';

const PC_SIZE_CONVERSION_RATIO = 5.0 / 3.0;

/** ReadHelper.signed24 */
function signed24(v: number): number {
  const w = v & 0xffffff;
  return w > 0x7fffff ? w - 0x1000000 : w;
}

/** PCS hoop codes with dimensions documented in pyembroidery/PcsReader.py. */
function pcsHoop(code: number): Hoop | undefined {
  if (code === 2) return { width: 800, height: 800, name: '80x80' };
  return undefined;
}

export function readPcs(data: Uint8Array): Pattern {
  if (data.length < 6) {
    throw new FormatError('Not a PCS file (header truncated).');
  }
  const r = new ByteReader(data);
  r.u8(); // version
  const hoopSize = r.u8();
  const colorCount = r.u16le();
  const threads: Thread[] = [];
  for (let i = 0; i < colorCount; i++) {
    const color = r.u24be();
    if (color < 0) break;
    threads.push({ rgb: color & 0xffffff });
    r.skip(1);
  }
  r.u16le(); // stitch count (records are parsed up to the end marker instead)

  const stitches: Stitch[] = [];
  let x = 0;
  let y = 0;
  while (true) {
    r.u8(); // c0 padding
    const xRaw = r.u24le();
    r.u8(); // c1 padding
    const yRaw = r.u24le();
    const ctrl = r.u8();
    if (ctrl < 0) break;
    const px = signed24(xRaw) * PC_SIZE_CONVERSION_RATIO;
    const py = -signed24(yRaw) * PC_SIZE_CONVERSION_RATIO;
    if (ctrl === 0x00) {
      x = px;
      y = py;
      stitches.push({ x, y, command: 'STITCH' });
      continue;
    }
    if ((ctrl & 0x01) !== 0) {
      stitches.push({ x, y, command: 'COLOR_CHANGE' });
      continue;
    }
    if ((ctrl & 0x04) !== 0) {
      x = px;
      y = py;
      stitches.push({ x, y, command: 'JUMP' });
      continue;
    }
    break; // uncaught control
  }

  const pattern: Pattern = { stitches, threads, extents: computeExtents(stitches) };
  const hoop = pcsHoop(hoopSize);
  if (hoop !== undefined) pattern.hoop = hoop;
  return pattern;
}
