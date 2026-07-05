/**
 * PES v1 writer (Brother) — port of pyembroidery/PesWriter.py write_version_1.
 * A CEmbOne/CSewSeg geometry section plus the embedded PEC block; colors are
 * quantized onto the PEC 64-thread chart (like every PES v1 producer).
 */
import { ByteWriter } from '../binary';
import { PEC_THREADS } from '../charts/pec-threads';
import { findNearestColorIndex } from '../color';
import type { ConversionWarning, Pattern, Stitch, Thread } from '../ir';
import type { WriterOptions } from './options';
import { preparePecPattern, writePecBody } from './pec';

const FILLER: Thread = { rgb: 0 };

function writePesString16(w: ByteWriter, s: string): void {
  w.u16le(s.length);
  w.utf8(s);
}

/** Runs of records sharing the same command (get_as_command_blocks). */
function commandBlocks(stitches: Stitch[]): Stitch[][] {
  const blocks: Stitch[][] = [];
  let start = 0;
  for (let pos = 1; pos < stitches.length; pos++) {
    if (stitches[pos]!.command !== stitches[pos - 1]!.command) {
      blocks.push(stitches.slice(start, pos));
      start = pos;
    }
  }
  if (stitches.length > 0) blocks.push(stitches.slice(start));
  return blocks;
}

function writePesSewSegHeader(
  w: ByteWriter,
  left: number,
  top: number,
  right: number,
  bottom: number,
  hoopWidth: number,
  hoopHeight: number,
): number {
  const width = right - left;
  const height = bottom - top;
  for (let i = 0; i < 8; i++) w.u16le(0); // 2× left/top/right/bottom
  let transX = 0;
  let transY = 0;
  transX += 350;
  transY += 100 + height;
  transX += hoopWidth / 2;
  transY += hoopHeight / 2;
  transX += -width / 2;
  transY += -height / 2;
  w.f32le(1);
  w.f32le(0);
  w.f32le(0);
  w.f32le(1);
  w.f32le(transX);
  w.f32le(transY);
  w.u16le(1);
  w.u16le(0);
  w.u16le(0);
  w.u16le(Math.trunc(width));
  w.u16le(Math.trunc(height));
  w.fill(0, 8);
  const placeholderSectionCount = w.length;
  w.u16le(0);
  return placeholderSectionCount;
}

function writePesEmbSewSegSegments(
  w: ByteWriter,
  stitches: Stitch[],
  threads: Thread[],
  left: number,
  bottom: number,
  cx: number,
  cy: number,
): number {
  let section = 0;
  const colorlog: Array<[number, number]> = [];
  let previousColorCode = -1;
  let flag = -1;
  const adjustX = left + cx;
  const adjustY = bottom + cy;

  let colorIndex = 0;
  let colorCode = findNearestColorIndex((threads[colorIndex] ?? FILLER).rgb, PEC_THREADS);
  colorIndex += 1;
  let stitchedX = 0;
  let stitchedY = 0;

  for (const block of commandBlocks(stitches)) {
    const command = block[0]!.command;
    const segments: Array<[number, number]> = [];
    let blockFlag: number;
    if (command === 'JUMP') {
      segments.push([stitchedX - adjustX, stitchedY - adjustY]);
      const last = block[block.length - 1]!;
      segments.push([last.x - adjustX, last.y - adjustY]);
      blockFlag = 1;
    } else if (command === 'COLOR_CHANGE') {
      colorCode = findNearestColorIndex((threads[colorIndex] ?? FILLER).rgb, PEC_THREADS);
      colorIndex += 1;
      continue;
    } else if (command === 'STITCH') {
      for (const s of block) {
        stitchedX = s.x;
        stitchedY = s.y;
        segments.push([stitchedX - adjustX, stitchedY - adjustY]);
      }
      blockFlag = 0;
    } else {
      continue; // TRIM/STOP/END produce no segments
    }
    if (flag !== -1) {
      w.u16le(0x8003); // section end
    }
    flag = blockFlag;
    if (previousColorCode !== colorCode) {
      colorlog.push([section, colorCode]);
      previousColorCode = colorCode;
    }
    w.u16le(flag);
    w.u16le(colorCode);
    w.u16le(segments.length);
    for (const [sx, sy] of segments) {
      w.u16le(Math.trunc(sx));
      w.u16le(Math.trunc(sy));
    }
    section += 1;
  }

  w.u16le(colorlog.length);
  for (const [logSection, logColor] of colorlog) {
    w.u16le(logSection);
    w.u16le(logColor);
  }
  return section;
}

function writePesBlocks(
  w: ByteWriter,
  stitches: Stitch[],
  threads: Thread[],
  left: number,
  top: number,
  right: number,
  bottom: number,
  cx: number,
  cy: number,
  hoopWidth: number,
  hoopHeight: number,
): void {
  if (stitches.length === 0) return;
  writePesString16(w, 'CEmbOne');
  const placeholder = writePesSewSegHeader(w, left, top, right, bottom, hoopWidth, hoopHeight);
  w.u16le(0xffff);
  w.u16le(0x0000); // FFFF 0000 means more blocks exist
  writePesString16(w, 'CSewSeg');
  const sections = writePesEmbSewSegSegments(w, stitches, threads, left, bottom, cx, cy);
  w.patchU16le(placeholder, sections);
  w.u16le(0x0000);
  w.u16le(0x0000); // no more blocks
}

export function writePes(
  pattern: Pattern,
  options?: WriterOptions,
): { bytes: Uint8Array; warnings: ConversionWarning[] } {
  const { stitches, threads, warnings } = preparePecPattern(pattern);
  const hoop = options?.hoop;
  const hoopWidth = hoop?.width ?? 1300;
  const hoopHeight = hoop?.height ?? 1800;
  // The v1 header flag only distinguishes the two stock Brother hoops
  // (0 = 100x100, 1 = 130x180 — PesWriter semantics); any other hoop keeps
  // flag 1 and only affects the CEmbOne placement dims.
  const hoopFlag = hoop !== undefined && hoop.width === 1000 && hoop.height === 1000 ? 0x00 : 0x01;
  const w = new ByteWriter();
  w.utf8('#PES0001');

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const s of stitches) {
    if (s.x > maxX) maxX = s.x;
    if (s.x < minX) minX = s.x;
    if (s.y > maxY) maxY = s.y;
    if (s.y < minY) minY = s.y;
  }
  const cx = (maxX + minX) / 2;
  const cy = (maxY + minY) / 2;

  if (hoop !== undefined && stitches.length > 0) {
    if (maxX - minX > hoop.width || maxY - minY > hoop.height) {
      warnings.push({
        code: 'HOOP_FIT_EXCEEDED',
        message:
          `Design ${(maxX - minX) / 10}x${(maxY - minY) / 10} mm exceeds the ` +
          `${hoop.width / 10}x${hoop.height / 10} mm hoop.`,
      });
    }
  }

  const placeholderPecBlock = w.length;
  w.u32le(0);
  if (stitches.length === 0) {
    w.u16le(0x01);
    w.u16le(0x01);
    w.u16le(0);
    w.u16le(0x0000);
    w.u16le(0x0000);
  } else {
    w.u16le(0x01); // scale to fit
    w.u16le(hoopFlag); // hoop
    w.u16le(1); // distinct block objects
    w.u16le(0xffff);
    w.u16le(0x0000);
    writePesBlocks(
      w,
      stitches,
      threads,
      minX - cx,
      minY - cy,
      maxX - cx,
      maxY - cy,
      cx,
      cy,
      hoopWidth,
      hoopHeight,
    );
  }
  w.patchU32le(placeholderPecBlock, w.length);
  writePecBody(w, stitches, threads, options?.label ?? 'Untitled');
  return { bytes: w.toBytes(), warnings };
}
