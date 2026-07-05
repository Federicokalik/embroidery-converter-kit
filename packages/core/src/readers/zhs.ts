/**
 * ZHS reader (Zeng Hsing "HSING12"). Port of pyembroidery/ZhsReader.py,
 * matched against docs/ZHS_FORMAT.md.
 *
 * Fidelity note: like pyembroidery, the accumulated (xx, yy) delta is NOT
 * reset by checksum records (0x10, skipped before decoding) and keeps
 * accumulating across unmapped 0x41 records until the next emitting record.
 */
import { computeExtents, FormatError } from '../ir';
import type { Pattern, Stitch, Thread } from '../ir';
import { decodeDelta } from '../zhs-codec';

export function isZhs(data: Uint8Array): boolean {
  const magic = 'HSING12';
  if (data.length < 0x9b) return false;
  for (let i = 0; i < magic.length; i++) {
    if (data[i] !== magic.charCodeAt(i)) return false;
  }
  return true;
}

interface ZhsPalette {
  /** Unique palette colors (colorCount × 24-bit BE RGB). */
  colors: number[];
  /** Per-BLOCK metadata entries ("&$chart&#description&#catalog&%"). */
  entries: Array<{ chart?: string; description?: string; catalog?: string }>;
}

function readPalette(data: Uint8Array, headerStart: number): ZhsPalette {
  let p = headerStart;
  const colorCount = data[p]!;
  p += 1;
  const colors: number[] = [];
  for (let i = 0; i < colorCount; i++) {
    colors.push((data[p]! << 16) | (data[p + 1]! << 8) | data[p + 2]!); // 24-bit BE
    p += 3;
  }
  const strLength = data[p]! | (data[p + 1]! << 8); // uint16 LE
  p += 2;
  const threadData = new TextDecoder().decode(data.slice(p, p + strLength));
  const parts = threadData.split('&$');
  const entries: ZhsPalette['entries'] = [];
  for (let i = 1; i < parts.length; i++) {
    const fields = parts[i]!.split('&#');
    const entry: ZhsPalette['entries'][number] = {};
    if (fields[0] !== undefined && fields[0].length > 0) entry.chart = fields[0];
    if (fields[1] !== undefined && fields[1].length > 0) entry.description = fields[1];
    if (fields[2] !== undefined && fields[2].length > 3) {
      entry.catalog = fields[2].slice(0, -2);
    }
    entries.push(entry);
  }
  return { colors, entries };
}

export function readZhs(data: Uint8Array): Pattern {
  if (!isZhs(data)) {
    throw new FormatError('Not a ZHS file (bad magic).');
  }
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const stitchStart = view.getUint32(0x0f, true);
  const headerStart = view.getUint32(0x13, true);
  if (headerStart >= data.length || stitchStart >= data.length) {
    throw new FormatError('Corrupt ZHS header (offsets past end of file).');
  }

  const palette = readPalette(data, headerStart);

  // Palette index of the first block: byte +9 of the first 20-byte header
  // row at 0x5E. Later blocks announce theirs in the COLOR_CHANGE payload.
  const blockIndices: number[] = [data[0x5e + 9] ?? 0];

  const stitches: Stitch[] = [];
  let xx = 0; // accumulated delta since the last emitting record (stored orientation)
  let yy = 0;
  let x = 0; // absolute IR position
  let y = 0;
  for (let o = stitchStart; o + 3 <= data.length; o += 3) {
    const ctrl = data[o]!;
    if (ctrl === 0x10) continue; // checksum record: no coordinate payload
    const [dx, dy] = decodeDelta(data[o + 1]!, data[o + 2]!);
    xx += dx;
    yy += dy;
    if (ctrl === 0x02) {
      x += xx;
      y -= yy; // IR y = -(stored y)
      stitches.push({ x, y, command: 'STITCH' });
      xx = 0;
      yy = 0;
    } else if (ctrl === 0x01) {
      x += xx;
      y -= yy;
      stitches.push({ x, y, command: 'JUMP' });
      xx = 0;
      yy = 0;
    } else if (ctrl === 0x04) {
      // The record's own payload is the next block's palette index, not a
      // spatial delta (the position stays put and the accumulator resets).
      blockIndices.push(dx);
      stitches.push({ x, y, command: 'COLOR_CHANGE' });
      xx = 0;
      yy = 0;
    } else if (ctrl === 0x80) {
      break; // END
    }
    // 0x41 and any other unmapped ctrl: keep accumulating, emit nothing
    // (pyembroidery parity).
  }

  // One thread per color block: unique palette RGB + that block's metadata.
  const threads: Thread[] = blockIndices.map((paletteIndex, b) => {
    const rgb = palette.colors[paletteIndex] ?? 0;
    const entry = palette.entries[b];
    const thread: Thread = { rgb };
    if (entry?.chart !== undefined) thread.chart = entry.chart;
    if (entry?.description !== undefined) thread.description = entry.description;
    if (entry?.catalog !== undefined) thread.catalog = entry.catalog;
    return thread;
  });

  const pattern: Pattern = { stitches, threads, extents: computeExtents(stitches) };
  // Header 0x2C/0x2E: declared hoop in 0.1 mm units (100x100 in the Artist
  // Toolkit fixtures, 260x160 in the factory multicolor sample).
  const hoopW = view.getUint16(0x2c, true);
  const hoopH = view.getUint16(0x2e, true);
  if (hoopW > 0 && hoopH > 0) {
    pattern.hoop = { width: hoopW, height: hoopH, name: `${hoopW / 10}x${hoopH / 10}` };
  }
  return pattern;
}
