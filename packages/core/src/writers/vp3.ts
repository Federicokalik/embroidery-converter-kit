/**
 * VP3 writer (Husqvarna Viking / Pfaff) — port of pyembroidery/Vp3Writer.py.
 * Big-endian nested blocks with back-patched lengths; jumps are omitted by
 * design (the machine moves to the next coordinate without jump records).
 *
 * Fidelity notes: the original truncates floats inconsistently — the file
 * block writes int(value * 100) while the design/color blocks write
 * int(value) * 100 — both are reproduced exactly.
 */
import { ByteWriter } from '../binary';
import { normalize } from '../encoder';
import type { ConversionWarning, Pattern, Stitch, Thread } from '../ir';
import { VP3_SETTINGS } from '../writer-settings';

const PRODUCED_BY = 'Produced by     Software Ltd';
const FILLER: Thread = { rgb: 0 };

function writeString16(w: ByteWriter, s: string): void {
  w.u16be(s.length * 2);
  for (let i = 0; i < s.length; i++) w.u16be(s.charCodeAt(i)); // UTF-16BE
}

function writeString8(w: ByteWriter, s: string): void {
  w.u16be(s.length);
  w.utf8(s);
}

/** position = current - offset - 4, written big-endian at `offset`. */
function patchByteOffset(w: ByteWriter, offset: number): void {
  w.patchU32be(offset, w.length - offset - 4);
}

function hexColor(rgb: number): string {
  const c = (v: number): string => v.toString(16).padStart(2, '0');
  return `#${c((rgb >> 16) & 0xff)}${c((rgb >> 8) & 0xff)}${c(rgb & 0xff)}`;
}

/** Blocks split at COLOR_CHANGE — exclusive, the CC leads the NEXT block. */
function colorBlocks(
  stitches: Stitch[],
  threads: Thread[],
): Array<{ stitches: Stitch[]; thread: Thread }> {
  const blocks: Array<{ stitches: Stitch[]; thread: Thread }> = [];
  let threadIndex = 0;
  let lastPos = 0;
  for (let pos = 0; pos < stitches.length; pos++) {
    if (stitches[pos]!.command !== 'COLOR_CHANGE') continue;
    blocks.push({
      stitches: stitches.slice(lastPos, pos),
      thread: threads[threadIndex] ?? FILLER,
    });
    threadIndex += 1;
    lastPos = pos;
  }
  blocks.push({
    stitches: stitches.slice(lastPos),
    thread: threads[threadIndex] ?? FILLER,
  });
  return blocks;
}

function writeThread(w: ByteWriter, thread: Thread): void {
  w.bytes([0x01, 0x00]); // single color, no transition
  w.u24be(thread.rgb);
  w.bytes([0x00, 0x00, 0x00, 0x05, 0x28]); // no parts/length, Rayon 40-weight
  writeString8(w, thread.catalog ?? '');
  writeString8(w, thread.description ?? hexColor(thread.rgb));
  writeString8(w, ''); // brand (not carried by the IR)
}

function writeStitchesBlock(
  w: ByteWriter,
  stitches: Stitch[],
  firstPosX: number,
  firstPosY: number,
): void {
  w.bytes([0x00, 0x01, 0x00]);
  const placeholder = w.length;
  w.u32be(0);
  w.bytes([0x0a, 0xf6, 0x00]);
  let lastX = firstPosX;
  let lastY = firstPosY;
  for (const stitch of stitches) {
    const flags = stitch.command;
    if (flags === 'END') {
      // Explicit trim: the machine does not autotrim.
      w.bytes([0x80, 0x03]);
      break;
    } else if (flags === 'COLOR_CHANGE' || flags === 'STOP' || flags === 'JUMP') {
      continue; // VP3 has no jump records; color changes delimit blocks
    } else if (flags === 'TRIM') {
      w.bytes([0x80, 0x03]);
      continue;
    }
    const dx = Math.trunc(stitch.x - lastX);
    const dy = Math.trunc(stitch.y - lastY);
    lastX += dx;
    lastY += dy;
    if (dx >= -127 && dx <= 127 && dy >= -127 && dy <= 127) {
      w.u8(dx);
      w.u8(dy);
    } else {
      w.bytes([0x80, 0x01]);
      w.u16be(dx);
      w.u16be(dy);
      w.bytes([0x80, 0x02]);
    }
  }
  patchByteOffset(w, placeholder);
}

function writeColorBlock(
  w: ByteWriter,
  first: boolean,
  centerX: number,
  centerY: number,
  stitches: Stitch[],
  thread: Thread,
): void {
  w.bytes([0x00, 0x05, 0x00]);
  const placeholder = w.length;
  w.u32be(0);

  let firstPosX = 0;
  let firstPosY = 0;
  let lastPosX = 0;
  let lastPosY = 0;
  if (stitches.length > 0) {
    firstPosX = stitches[0]!.x;
    firstPosY = stitches[0]!.y;
    if (first) {
      firstPosX = 0;
      firstPosY = 0;
    }
    lastPosX = stitches[stitches.length - 1]!.x;
    lastPosY = stitches[stitches.length - 1]!.y;
  }
  w.u32be(Math.trunc(firstPosX - centerX) * 100);
  w.u32be(Math.trunc(-(firstPosY - centerY)) * 100);

  writeThread(w, thread);

  w.u32be(Math.trunc(lastPosX - firstPosX) * 100);
  w.u32be(Math.trunc(-(lastPosY - firstPosY)) * 100);

  writeStitchesBlock(w, stitches, firstPosX, firstPosY);

  w.u8(0);
  patchByteOffset(w, placeholder);
}

function writeDesignBlock(
  w: ByteWriter,
  extents: [number, number, number, number],
  blocks: Array<{ stitches: Stitch[]; thread: Thread }>,
): void {
  w.bytes([0x00, 0x03, 0x00]);
  const placeholder = w.length;
  w.u32be(0);

  const [minX, minY, maxX, maxY] = extents;
  const width = maxX - minX;
  const height = maxY - minY;
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const centerX = maxX - halfWidth;
  const centerY = maxY - halfHeight;

  w.u32be(Math.trunc(centerX) * 100);
  w.u32be(Math.trunc(centerY) * -100);
  w.u8(0);
  w.u8(0);
  w.u8(0);
  w.u32be(Math.trunc(halfWidth) * -100);
  w.u32be(Math.trunc(halfWidth) * 100);
  w.u32be(Math.trunc(halfHeight) * -100);
  w.u32be(Math.trunc(halfHeight) * 100);
  w.u32be(Math.trunc(width) * 100);
  w.u32be(Math.trunc(height) * 100);
  writeString16(w, ''); // notes and settings
  w.bytes([0x64, 0x64]);
  w.u32be(4096);
  w.u32be(0);
  w.u32be(0);
  w.u32be(4096);
  w.ascii('xxPP');
  w.bytes([0x01, 0x00]);
  writeString16(w, PRODUCED_BY);
  w.u16be(blocks.length);

  let first = true;
  for (const block of blocks) {
    writeColorBlock(w, first, centerX, centerY, block.stitches, block.thread);
    first = false;
  }
  patchByteOffset(w, placeholder);
}

export function writeVp3(pattern: Pattern): {
  bytes: Uint8Array;
  warnings: ConversionWarning[];
} {
  const { stitches, threads, warnings } = normalize(pattern, VP3_SETTINGS);
  const w = new ByteWriter();
  w.utf8('%vsm%');
  w.u8(0);
  writeString16(w, PRODUCED_BY);

  w.bytes([0x00, 0x02, 0x00]);
  const placeholderEndOfFile = w.length;
  w.u32be(0);
  writeString16(w, ''); // global notes and settings

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let ends = 0;
  for (const s of stitches) {
    if (s.x > maxX) maxX = s.x;
    if (s.x < minX) minX = s.x;
    if (s.y > maxY) maxY = s.y;
    if (s.y < minY) minY = s.y;
    if (s.command === 'END') ends += 1;
  }
  // File block: int(value * 100) — truncation AFTER scaling here.
  w.u32be(Math.trunc(maxX * 100)); // right
  w.u32be(Math.trunc(minY * -100)); // -top
  w.u32be(Math.trunc(minX * 100)); // left
  w.u32be(Math.trunc(maxY * -100)); // -bottom

  w.u32be(stitches.length - ends);
  const blocks = colorBlocks(stitches, threads);
  w.u8(0);
  w.u8(blocks.length);
  w.u8(12);
  w.u8(0);
  w.u8(1); // number of designs
  writeDesignBlock(w, [minX, minY, maxX, maxY], blocks);
  patchByteOffset(w, placeholderEndOfFile);
  return { bytes: w.toBytes(), warnings };
}
