/**
 * DST writer (Tajima) — port of pyembroidery/DstWriter.py (default header,
 * no extended metadata). 512-byte text header, 3-byte ternary records,
 * TRIM encoded as oscillating zero-sum jumps.
 */
import { ByteWriter } from '../binary';
import { normalize } from '../encoder';
import type { ConversionWarning, Pattern } from '../ir';
import { pyround } from '../pyround';
import { DST_SETTINGS } from '../writer-settings';
import type { WriterOptions } from './options';

const HEADER_SIZE = 512;
const TRIM_AT = 3;

function bit(b: number): number {
  return 1 << b;
}

type DstCommand = 'STITCH' | 'JUMP' | 'COLOR_CHANGE' | 'STOP' | 'END';

function encodeRecord(xIn: number, yIn: number, flags: DstCommand): [number, number, number] {
  let x = xIn;
  let y = -yIn; // flips the coordinate y space
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  if (flags === 'JUMP') {
    b2 += bit(7); // jumpstitch 10xxxx11
  }
  if (flags === 'STITCH' || flags === 'JUMP') {
    b2 += bit(0);
    b2 += bit(1);
    if (x > 40) {
      b2 += bit(2);
      x -= 81;
    }
    if (x < -40) {
      b2 += bit(3);
      x += 81;
    }
    if (x > 13) {
      b1 += bit(2);
      x -= 27;
    }
    if (x < -13) {
      b1 += bit(3);
      x += 27;
    }
    if (x > 4) {
      b0 += bit(2);
      x -= 9;
    }
    if (x < -4) {
      b0 += bit(3);
      x += 9;
    }
    if (x > 1) {
      b1 += bit(0);
      x -= 3;
    }
    if (x < -1) {
      b1 += bit(1);
      x += 3;
    }
    if (x > 0) {
      b0 += bit(0);
      x -= 1;
    }
    if (x < 0) {
      b0 += bit(1);
      x += 1;
    }
    if (x !== 0) {
      throw new Error('The dx value given to the DST writer exceeds maximum allowed.');
    }
    if (y > 40) {
      b2 += bit(5);
      y -= 81;
    }
    if (y < -40) {
      b2 += bit(4);
      y += 81;
    }
    if (y > 13) {
      b1 += bit(5);
      y -= 27;
    }
    if (y < -13) {
      b1 += bit(4);
      y += 27;
    }
    if (y > 4) {
      b0 += bit(5);
      y -= 9;
    }
    if (y < -4) {
      b0 += bit(4);
      y += 9;
    }
    if (y > 1) {
      b1 += bit(7);
      y -= 3;
    }
    if (y < -1) {
      b1 += bit(6);
      y += 3;
    }
    if (y > 0) {
      b0 += bit(7);
      y -= 1;
    }
    if (y < 0) {
      b0 += bit(6);
      y += 1;
    }
    if (y !== 0) {
      throw new Error('The dy value given to the DST writer exceeds maximum allowed.');
    }
  } else if (flags === 'COLOR_CHANGE' || flags === 'STOP') {
    b2 = 0b11000011;
  } else {
    b2 = 0b11110011; // END
  }
  return [b0, b1, b2];
}

/** Python "%Nd": truncate toward zero, then right-justify. */
function fmtInt(v: number, width: number): string {
  return String(Math.trunc(v)).padStart(width, ' ');
}

export function writeDst(
  pattern: Pattern,
  options?: WriterOptions,
): { bytes: Uint8Array; warnings: ConversionWarning[] } {
  const { stitches, warnings } = normalize(pattern, DST_SETTINGS);

  // bounds/counters over the NORMALIZED record list (pyembroidery parity)
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let colorChanges = 0;
  for (const s of stitches) {
    if (s.x > maxX) maxX = s.x;
    if (s.x < minX) minX = s.x;
    if (s.y > maxY) maxY = s.y;
    if (s.y < minY) minY = s.y;
    if (s.command === 'COLOR_CHANGE') colorChanges += 1;
  }

  const name = options?.label ?? 'Untitled';
  const w = new ByteWriter();
  w.utf8(`LA:${name.padEnd(16, ' ')}\r`);
  w.utf8(`ST:${fmtInt(stitches.length, 7)}\r`);
  w.utf8(`CO:${fmtInt(colorChanges, 3)}\r`);
  w.utf8(`+X:${fmtInt(Math.abs(maxX), 5)}\r`);
  w.utf8(`-X:${fmtInt(Math.abs(minX), 5)}\r`);
  w.utf8(`+Y:${fmtInt(Math.abs(maxY), 5)}\r`);
  w.utf8(`-Y:${fmtInt(Math.abs(minY), 5)}\r`);
  let ax = 0;
  let ay = 0;
  if (stitches.length > 0) {
    const last = stitches[stitches.length - 1]!;
    ax = Math.trunc(last.x);
    ay = -Math.trunc(last.y);
  }
  w.utf8(ax >= 0 ? `AX:+${fmtInt(ax, 5)}\r` : `AX:-${fmtInt(Math.abs(ax), 5)}\r`);
  w.utf8(ay >= 0 ? `AY:+${fmtInt(ay, 5)}\r` : `AY:-${fmtInt(Math.abs(ay), 5)}\r`);
  w.utf8(`MX:+${fmtInt(0, 5)}\r`);
  w.utf8(`MY:+${fmtInt(0, 5)}\r`);
  w.utf8('PD:******\r');
  w.u8(0x1a);
  w.fill(0x20, HEADER_SIZE - w.length);

  let xx = 0;
  let yy = 0;
  for (const s of stitches) {
    const dx = pyround(s.x - xx);
    const dy = pyround(s.y - yy);
    xx += dx;
    yy += dy;
    if (s.command === 'TRIM') {
      // Oscillating zero-sum jumps (trim_at = 3): (2,2), (-4,-4), (2,2)
      let delta = -4;
      w.bytes(encodeRecord(-delta / 2, -delta / 2, 'JUMP'));
      for (let p = 1; p < TRIM_AT - 1; p++) {
        w.bytes(encodeRecord(delta, delta, 'JUMP'));
        delta = -delta;
      }
      w.bytes(encodeRecord(delta / 2, delta / 2, 'JUMP'));
    } else {
      w.bytes(encodeRecord(dx, dy, s.command as DstCommand));
    }
  }
  return { bytes: w.toBytes(), warnings };
}
