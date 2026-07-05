/**
 * DST reader (Tajima) — port of pyembroidery/DstReader.py.
 * 512-byte text header, then 3-byte ternary bit-field records.
 */
import { computeExtents, FormatError } from '../ir';
import type { Pattern, Stitch, Thread } from '../ir';
import { interpolateTrims } from '../pattern-transforms';

const HEADER_SIZE = 512;

function getbit(b: number, pos: number): number {
  return (b >> pos) & 1;
}

function decodeDx(b0: number, b1: number, b2: number): number {
  let x = 0;
  x += getbit(b2, 2) * 81;
  x += getbit(b2, 3) * -81;
  x += getbit(b1, 2) * 27;
  x += getbit(b1, 3) * -27;
  x += getbit(b0, 2) * 9;
  x += getbit(b0, 3) * -9;
  x += getbit(b1, 0) * 3;
  x += getbit(b1, 1) * -3;
  x += getbit(b0, 0) * 1;
  x += getbit(b0, 1) * -1;
  return x;
}

function decodeDy(b0: number, b1: number, b2: number): number {
  let y = 0;
  y += getbit(b2, 5) * 81;
  y += getbit(b2, 4) * -81;
  y += getbit(b1, 5) * 27;
  y += getbit(b1, 4) * -27;
  y += getbit(b0, 5) * 9;
  y += getbit(b0, 4) * -9;
  y += getbit(b1, 7) * 3;
  y += getbit(b1, 6) * -3;
  y += getbit(b0, 7) * 1;
  y += getbit(b0, 6) * -1;
  return -y;
}

function parseHexColor(hex: string): number {
  const clean = hex.trim().replace(/^#/, '');
  const v = Number.parseInt(clean, 16);
  return Number.isNaN(v) ? 0 : v & 0xffffff;
}

function readHeaderThreads(data: Uint8Array): Thread[] {
  const threads: Thread[] = [];
  const header = data.slice(0, HEADER_SIZE);
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let start = 0;
  for (let i = 0; i < header.length; i++) {
    const element = header[i]!;
    if (element === 13 || element === 10) {
      const chunk = header.slice(start, i);
      start = i;
      let line: string;
      try {
        line = decoder.decode(chunk).trim();
      } catch {
        continue; // non-utf8 header data (pyembroidery parity)
      }
      if (line.length > 3 && line.slice(0, 2) === 'TC') {
        const values = line
          .slice(3)
          .split(',')
          .map((v) => v.trim());
        threads.push({
          rgb: parseHexColor(values[0] ?? ''),
          description: values[1] ?? '',
          catalog: values[2] ?? '',
        });
      }
      // LA/AU/CP metadata lines carry no stitch information; the IR has no
      // metadata channel yet, so they are skipped.
    }
  }
  return threads;
}

export function readDst(data: Uint8Array): Pattern {
  if (data.length < HEADER_SIZE) {
    throw new FormatError('Not a DST file (shorter than the 512-byte header).');
  }
  const threads = readHeaderThreads(data);

  const stitches: Stitch[] = [];
  let x = 0;
  let y = 0;
  let sequinMode = false;
  for (let o = HEADER_SIZE; o + 3 <= data.length; o += 3) {
    const b0 = data[o]!;
    const b1 = data[o + 1]!;
    const b2 = data[o + 2]!;
    const dx = decodeDx(b0, b1, b2);
    const dy = decodeDy(b0, b1, b2);
    if ((b2 & 0b11110011) === 0b11110011) {
      break; // END
    } else if ((b2 & 0b11000011) === 0b11000011) {
      x += dx;
      y += dy;
      stitches.push({ x, y, command: 'COLOR_CHANGE' });
    } else if ((b2 & 0b01000011) === 0b01000011) {
      sequinMode = !sequinMode;
      throw new FormatError(
        'This DST file uses sequins, which the converter does not support yet.',
      );
    } else if ((b2 & 0b10000011) === 0b10000011) {
      x += dx;
      y += dy;
      if (sequinMode) {
        throw new FormatError(
          'This DST file uses sequins, which the converter does not support yet.',
        );
      }
      stitches.push({ x, y, command: 'JUMP' });
    } else {
      x += dx;
      y += dy;
      stitches.push({ x, y, command: 'STITCH' });
    }
  }

  // pyembroidery default read settings: trim at 3 consecutive jumps, clipping on.
  interpolateTrims(stitches, 3, undefined, true);

  return { stitches, threads, extents: computeExtents(stitches) };
}
