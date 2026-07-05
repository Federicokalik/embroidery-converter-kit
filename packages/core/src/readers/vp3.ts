/**
 * VP3 reader (Husqvarna Viking / Pfaff) — port of pyembroidery/Vp3Reader.py.
 * Big-endian; block positions are absolute (relative to the design center,
 * /100 scale) and stitch deltas are signed bytes with an 0x80-escaped
 * 16-bit long form.
 */
import { ByteReader } from '../binary';
import { signed8 } from '../embcompress';
import { computeExtents, FormatError } from '../ir';
import type { Pattern, Stitch, Thread } from '../ir';

function skipString(r: ByteReader): void {
  r.skip(r.u16be());
}

function readString8(r: ByteReader): string {
  return r.utf8(r.u16be());
}

function signed16(b0: number, b1: number): number {
  const b = ((b0 & 0xff) << 8) | (b1 & 0xff);
  return b > 0x7fff ? b - 0x10000 : b;
}

export function isVp3(data: Uint8Array): boolean {
  const magic = '%vsm%';
  if (data.length < 6) return false;
  for (let i = 0; i < magic.length; i++) {
    if (data[i] !== magic.charCodeAt(i)) return false;
  }
  return true;
}

function readThread(r: ByteReader): Thread {
  const colors = r.u8();
  r.u8(); // transition
  let rgb = 0;
  for (let m = 0; m < colors; m++) {
    rgb = r.u24be();
    r.u8(); // parts
    r.u16be(); // color length
  }
  r.u8(); // thread type
  r.u8(); // weight
  const catalog = readString8(r);
  const description = readString8(r);
  readString8(r); // brand — not carried by the IR
  const thread: Thread = { rgb };
  if (catalog.length > 0) thread.catalog = catalog;
  if (description.length > 0) thread.description = description;
  return thread;
}

function readColorBlock(
  r: ByteReader,
  stitches: Stitch[],
  threads: Thread[],
  centerX: number,
  centerY: number,
  pos: { x: number; y: number },
): void {
  r.skip(3); // \x00\x05\x00
  const distanceToNext = r.u32be();
  const blockEndPosition = distanceToNext + r.pos;

  const startPositionX = r.i32be() / 100;
  const startPositionY = -(r.i32be() / 100);
  const absX = startPositionX + centerX;
  const absY = startPositionY + centerY;
  if (absX !== 0 && absY !== 0) {
    pos.x = absX;
    pos.y = absY;
    stitches.push({ x: pos.x, y: pos.y, command: 'JUMP' });
  }
  threads.push(readThread(r));
  r.skip(15);
  r.skip(3); // \x0A\xF6\x00
  const stitchByteLength = blockEndPosition - r.pos;
  const raw = r.slice(stitchByteLength);
  let i = 0;
  while (i < raw.length - 1) {
    let x: number = signed8(raw[i]!);
    let y: number = signed8(raw[i + 1]!);
    i += 2;
    if ((x & 0xff) !== 0x80) {
      pos.x += x;
      pos.y += y;
      stitches.push({ x: pos.x, y: pos.y, command: 'STITCH' });
      continue;
    }
    if (y === 0x01) {
      x = signed16(raw[i]!, raw[i + 1]!);
      i += 2;
      y = signed16(raw[i]!, raw[i + 1]!);
      i += 2;
      pos.x += x;
      pos.y += y;
      stitches.push({ x: pos.x, y: pos.y, command: 'STITCH' });
      i += 2; // trailing 0x80 0x02, skipped regardless of value
    } else if (y === 0x02) {
      // only seen after 80 01; no known effect
    } else if (y === 0x03) {
      stitches.push({ x: pos.x, y: pos.y, command: 'TRIM' });
    }
  }
}

export function readVp3(data: Uint8Array): Pattern {
  if (!isVp3(data)) {
    throw new FormatError('Not a VP3 file (bad magic).');
  }
  const r = new ByteReader(data);
  r.seek(6); // "%vsm%\0"
  skipString(r); // "Produced by     Software Ltd"
  r.skip(7);
  skipString(r); // comments/notes
  r.skip(32);
  const centerX = r.i32be() / 100;
  const centerY = -(r.i32be() / 100);
  r.skip(27);
  skipString(r);
  r.skip(24);
  skipString(r); // "Produced by     Software Ltd"
  const countColors = r.u16be();
  if (countColors < 0 || countColors > 0xff) {
    throw new FormatError('Corrupt VP3 file (implausible color block count).');
  }

  const stitches: Stitch[] = [];
  const threads: Thread[] = [];
  const pos = { x: 0, y: 0 };
  for (let i = 0; i < countColors; i++) {
    readColorBlock(r, stitches, threads, centerX, centerY, pos);
    if (i + 1 < countColors) {
      stitches.push({ x: pos.x, y: pos.y, command: 'COLOR_CHANGE' });
    }
  }
  return { stitches, threads, extents: computeExtents(stitches) };
}
