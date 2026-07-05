/**
 * PEC reader (Brother) — port of pyembroidery/PecReader.py.
 * Also used by the PES reader for the embedded PEC block.
 */
import { ByteReader } from '../binary';
import { PEC_THREADS } from '../charts/pec-threads';
import { computeExtents, FormatError } from '../ir';
import type { Pattern, Stitch, Thread } from '../ir';
import { interpolateDuplicateColorAsStop } from '../pattern-transforms';

const JUMP_CODE = 0x10;
const TRIM_CODE = 0x20;
const FLAG_LONG = 0x80;

const FILLER: Thread = { rgb: 0 };

function signed12(b: number): number {
  const v = b & 0xfff;
  return v > 0x7ff ? v - 0x1000 : v;
}

function signed7(b: number): number {
  return b > 63 ? b - 128 : b;
}

function chartThread(index: number): Thread {
  return PEC_THREADS[index % PEC_THREADS.length] ?? FILLER;
}

function processPecTable(colorBytes: Uint8Array, chart: Thread[]): Thread[] {
  // How PEC actually allocates pre-defined threads to blocks.
  const queue = [...chart];
  const threadMap = new Map<number, Thread>();
  const threads: Thread[] = [];
  for (const byte of colorBytes) {
    const colorIndex = byte % PEC_THREADS.length;
    let thread = threadMap.get(colorIndex);
    if (thread === undefined) {
      thread = queue.length > 0 ? queue.shift()! : chartThread(colorIndex);
      threadMap.set(colorIndex, thread);
    }
    threads.push(thread);
  }
  return threads;
}

function mapPecColors(colorBytes: Uint8Array, chart: Thread[]): Thread[] {
  if (chart.length === 0) {
    return [...colorBytes].map((b) => chartThread(b));
  }
  if (chart.length >= colorBytes.length) {
    return [...chart]; // 1:1 mode adds every chart thread
  }
  return processPecTable(colorBytes, chart);
}

function readPecStitches(r: ByteReader): Stitch[] {
  const stitches: Stitch[] = [];
  let x = 0;
  let y = 0;
  while (true) {
    const val1 = r.u8();
    let val2 = r.u8();
    if ((val1 === 0xff && val2 === 0x00) || val2 < 0) break;
    if (val1 === 0xfe && val2 === 0xb0) {
      r.skip(1);
      stitches.push({ x, y, command: 'COLOR_CHANGE' });
      continue;
    }
    let jump = false;
    let trim = false;
    let dx: number;
    if ((val1 & FLAG_LONG) !== 0) {
      if ((val1 & TRIM_CODE) !== 0) trim = true;
      if ((val1 & JUMP_CODE) !== 0) jump = true;
      dx = signed12((val1 << 8) | val2);
      val2 = r.u8();
      if (val2 < 0) break;
    } else {
      dx = signed7(val1);
    }
    let dy: number;
    if ((val2 & FLAG_LONG) !== 0) {
      if ((val2 & TRIM_CODE) !== 0) trim = true;
      if ((val2 & JUMP_CODE) !== 0) jump = true;
      const val3 = r.u8();
      if (val3 < 0) break;
      dy = signed12((val2 << 8) | val3);
    } else {
      dy = signed7(val2);
    }
    if (jump) {
      x += dx;
      y += dy;
      stitches.push({ x, y, command: 'JUMP' });
    } else if (trim) {
      stitches.push({ x, y, command: 'TRIM' });
      x += dx;
      y += dy;
      stitches.push({ x, y, command: 'JUMP' });
    } else {
      x += dx;
      y += dy;
      stitches.push({ x, y, command: 'STITCH' });
    }
  }
  return stitches;
}

/**
 * Reads a PEC body starting at the reader's current position (just past the
 * "#PEC0001" signature). `chart` carries threads loaded from a PES header.
 * Thumbnail graphics are not decoded (the IR has no metadata channel).
 */
export function readPecBlock(
  r: ByteReader,
  chart: Thread[],
): { stitches: Stitch[]; threads: Thread[] } {
  r.skip(3); // "LA:"
  r.skip(16); // label
  r.skip(0x0f);
  r.skip(2); // icon byte stride + icon height
  r.skip(0x0c);
  const colorChanges = r.u8();
  if (colorChanges < 0) {
    throw new FormatError('Corrupt PEC block (truncated header).');
  }
  const countColors = colorChanges + 1; // 0xFF means 0
  const colorBytes = r.slice(countColors);
  const threads = mapPecColors(colorBytes, chart);
  r.skip(0x1d0 - colorChanges);
  r.skip(3); // 24-bit stitch block length (graphics are skipped)
  r.skip(0x0b);
  const stitches = readPecStitches(r);
  return { stitches, threads };
}

export function isPec(data: Uint8Array): boolean {
  const magic = '#PEC0001';
  if (data.length < magic.length) return false;
  for (let i = 0; i < magic.length; i++) {
    if (data[i] !== magic.charCodeAt(i)) return false;
  }
  return true;
}

export function readPec(data: Uint8Array): Pattern {
  if (!isPec(data)) {
    throw new FormatError('Not a PEC file (bad magic).');
  }
  const r = new ByteReader(data);
  r.seek(8);
  const { stitches, threads } = readPecBlock(r, []);
  interpolateDuplicateColorAsStop(stitches, threads);
  return { stitches, threads, extents: computeExtents(stitches) };
}
