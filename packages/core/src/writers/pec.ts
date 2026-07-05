/**
 * PEC writer (Brother) — port of pyembroidery/PecWriter.py.
 * Variable 7/12-bit delta encoding, fixed 64-color chart quantization,
 * 48×38 1-bit thumbnails. Also embedded by the PES writer.
 */
import { ByteWriter } from '../binary';
import { PEC_THREADS } from '../charts/pec-threads';
import { findNearestColorIndex } from '../color';
import { normalize } from '../encoder';
import type { ConversionWarning, Pattern, Stitch, Thread } from '../ir';
import { interpolateStopAsDuplicateColor } from '../pattern-transforms';
import { pyround } from '../pyround';
import { PEC_SETTINGS } from '../writer-settings';
import type { WriterOptions } from './options';
import { drawScaled, getBlank } from './pec-graphics';

const MASK_07_BIT = 0b01111111;
const JUMP_CODE = 0b00010000;
const TRIM_CODE = 0b00100000;
const PEC_ICON_WIDTH = 48;
const PEC_ICON_HEIGHT = 38;

interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function boundsOf(stitches: Stitch[]): Bounds {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const s of stitches) {
    if (s.x > right) right = s.x;
    if (s.x < left) left = s.x;
    if (s.y > bottom) bottom = s.y;
    if (s.y < top) top = s.y;
  }
  return { left, top, right, bottom };
}

/**
 * Port of EmbThread.build_unique_palette. pyembroidery iterates a Python
 * set of threads (hashed by color); we dedupe by color in first-appearance
 * order — equivalent unless two design colors contend for the same chart
 * slot, which only shifts near-identical colors between adjacent slots.
 */
function buildUniquePalette(
  threadPalette: Array<Thread | null>,
  threadlist: Thread[],
): number[] {
  const chart: Array<Thread | null> = new Array<Thread | null>(
    threadPalette.length,
  ).fill(null);
  const seen = new Set<number>();
  for (const thread of threadlist) {
    const key = thread.rgb & 0xffffff;
    if (seen.has(key)) continue;
    seen.add(key);
    const index = findNearestColorIndex(thread.rgb, threadPalette);
    if (index === -1) break; // no more palette slots remain
    threadPalette[index] = null; // entries may not be reused
    chart[index] = thread;
  }
  return threadlist.map((t) => findNearestColorIndex(t.rgb, chart));
}

function writeValue(w: ByteWriter, valueIn: number, long: boolean, flag = 0): void {
  let value = valueIn;
  if (!long && value > -64 && value < 63) {
    w.u8(value & MASK_07_BIT);
  } else {
    value &= 0b0000111111111111;
    value |= 0b1000000000000000;
    value |= flag << 8;
    w.u8((value >> 8) & 0xff);
    w.u8(value & 0xff);
  }
}

function pecEncode(w: ByteWriter, stitches: Stitch[]): void {
  let colorTwo = true;
  let jumping = true;
  let init = true;
  let xx = 0;
  let yy = 0;
  for (const stitch of stitches) {
    const dx = pyround(stitch.x - xx);
    const dy = pyround(stitch.y - yy);
    xx += dx;
    yy += dy;
    const data = stitch.command;
    if (data === 'STITCH') {
      if (jumping) {
        if (dx !== 0 && dy !== 0) {
          writeValue(w, 0, false);
          writeValue(w, 0, false);
        }
        jumping = false;
      }
      writeValue(w, dx, false);
      writeValue(w, dy, false);
    } else if (data === 'JUMP') {
      jumping = true;
      const flag = init ? JUMP_CODE : TRIM_CODE;
      writeValue(w, dx, true, flag);
      writeValue(w, dy, true, flag);
    } else if (data === 'COLOR_CHANGE') {
      if (jumping) {
        writeValue(w, 0, false);
        writeValue(w, 0, false);
        jumping = false;
      }
      w.bytes([0xfe, 0xb0]);
      w.u8(colorTwo ? 0x02 : 0x01);
      colorTwo = !colorTwo;
    } else if (data === 'END') {
      w.u8(0xff);
      break;
    }
    // STOP/TRIM: already handled (stops became duplicate colors; trims noop)
    init = false;
  }
}

function writePecHeader(w: ByteWriter, threads: Thread[], label: string): void {
  w.utf8(`LA:${label.slice(0, 8).padEnd(16, ' ')}\r`);
  w.fill(0x20, 12);
  w.bytes([0xff, 0x00]);
  w.u8(PEC_ICON_WIDTH / 8);
  w.u8(PEC_ICON_HEIGHT);

  const threadSet: Array<Thread | null> = [...PEC_THREADS];
  const colorIndexList = buildUniquePalette(threadSet, threads);
  const currentThreadCount = colorIndexList.length;
  if (currentThreadCount !== 0) {
    w.fill(0x20, 12);
    colorIndexList.unshift(currentThreadCount - 1);
    w.bytes(colorIndexList);
  } else {
    w.bytes([0x20, 0x20, 0x20, 0x20, 0x64, 0x20, 0x00, 0x20, 0x00, 0x20, 0x20, 0x20, 0xff]);
  }
  w.fill(0x20, 463 - currentThreadCount);
}

function writePecBlock(w: ByteWriter, stitches: Stitch[], bounds: Bounds): void {
  const width = bounds.right - bounds.left;
  const height = bounds.bottom - bounds.top;
  const blockStart = w.length;
  w.bytes([0x00, 0x00]);
  w.u24le(0); // length placeholder
  w.bytes([0x31, 0xff, 0xf0]);
  w.u16le(pyround(width));
  w.u16le(pyround(height));
  w.u16le(0x1e0);
  w.u16le(0x1b0);
  pecEncode(w, stitches);
  w.patchU24le(blockStart + 2, w.length - blockStart);
}

/** Runs of consecutive STITCH records (EmbPattern.get_as_stitchblock). */
function stitchBlocks(stitches: Stitch[]): Stitch[][] {
  const blocks: Stitch[][] = [];
  let current: Stitch[] = [];
  for (const s of stitches) {
    if (s.command === 'STITCH') {
      current.push(s);
    } else if (current.length > 0) {
      blocks.push(current);
      current = [];
    }
  }
  if (current.length > 0) blocks.push(current);
  return blocks;
}

/** Blocks split at COLOR_CHANGE, inclusive (EmbPattern.get_as_colorblocks). */
function colorBlocks(stitches: Stitch[]): Stitch[][] {
  const blocks: Stitch[][] = [];
  let start = 0;
  for (let pos = 0; pos < stitches.length; pos++) {
    if (stitches[pos]!.command === 'COLOR_CHANGE') {
      blocks.push(stitches.slice(start, pos + 1));
      start = pos + 1;
    }
  }
  blocks.push(stitches.slice(start));
  return blocks;
}

function writePecGraphics(w: ByteWriter, stitches: Stitch[], bounds: Bounds): void {
  const overall = getBlank();
  for (const block of stitchBlocks(stitches)) {
    drawScaled(bounds, block, overall, 6, 4);
  }
  w.bytes(overall);

  for (const block of colorBlocks(stitches)) {
    const graphic = getBlank();
    drawScaled(
      bounds,
      block.filter((s) => s.command === 'STITCH'),
      graphic,
      6,
    );
    w.bytes(graphic);
  }
}

/** Body shared with the PES writer: header + stitch block + thumbnails. */
export function writePecBody(
  w: ByteWriter,
  stitches: Stitch[],
  threads: Thread[],
  label: string,
): void {
  const bounds = boundsOf(stitches);
  writePecHeader(w, threads, label);
  writePecBlock(w, stitches, bounds);
  writePecGraphics(w, stitches, bounds);
}

/** Normalized pattern with STOPs converted to duplicate-color changes. */
export function preparePecPattern(pattern: Pattern): {
  stitches: Stitch[];
  threads: Thread[];
  warnings: ConversionWarning[];
} {
  const { stitches, threads, warnings } = normalize(pattern, PEC_SETTINGS);
  interpolateStopAsDuplicateColor(stitches, threads);
  return { stitches, threads, warnings };
}

export function writePec(
  pattern: Pattern,
  options?: WriterOptions,
): { bytes: Uint8Array; warnings: ConversionWarning[] } {
  const { stitches, threads, warnings } = preparePecPattern(pattern);
  const w = new ByteWriter();
  w.utf8('#PEC0001');
  writePecBody(w, stitches, threads, options?.label ?? 'Untitled');
  return { bytes: w.toBytes(), warnings };
}
