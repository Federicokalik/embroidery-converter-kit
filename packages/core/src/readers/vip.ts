/**
 * VIP reader (Husqvarna Viking / Pfaff). See docs/VIP_FORMAT.md.
 * VIP is an HUS body: three EmbCompress streams (commands, x deltas, y deltas),
 * no XOR layer; the header color block is XOR-encrypted with the keystream
 * ported from libembroidery. Port of reference/zhs_vip_reference.py::read_vip.
 */
import { VIP_COLOR_TABLE } from '../charts/vip-table';
import { expand, signed8 } from '../embcompress';
import { computeExtents, FormatError } from '../ir';
import type { Command, Pattern, Stitch, Thread } from '../ir';

export const VIP_MAGIC = 0x0190fc5d;

const VIP_COMMANDS: Record<number, Command> = {
  0x80: 'STITCH',
  0x81: 'JUMP',
  0x84: 'COLOR_CHANGE',
  0x88: 'TRIM',
};

export function isVip(data: Uint8Array): boolean {
  if (data.length < 0x20) return false;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return view.getUint32(0, true) === VIP_MAGIC;
}

/**
 * Decode the XOR-chained color block at 0x2E: each color is 4 bytes
 * (r, g, b, pad). Layout verified on the fixtures; algorithm from
 * libembroidery readVip.
 */
function decodeThreads(data: Uint8Array, numberOfColors: number): Thread[] {
  const start = 0x2e;
  const byteCount = numberOfColors * 4;
  if (byteCount > VIP_COLOR_TABLE.length || start + byteCount > data.length) {
    return []; // color block malformed/oversized: threads stay unknown
  }
  const decoded = new Uint8Array(byteCount);
  let prev = 0;
  for (let i = 0; i < byteCount; i++) {
    const input = data[start + i]!;
    decoded[i] = input ^ VIP_COLOR_TABLE[i]! ^ prev;
    prev = input;
  }
  const threads: Thread[] = [];
  for (let i = 0; i < numberOfColors; i++) {
    threads.push({
      rgb: (decoded[i * 4]! << 16) | (decoded[i * 4 + 1]! << 8) | decoded[i * 4 + 2]!,
    });
  }
  return threads;
}

/**
 * Parse a VIP file into the IR. Coordinates are absolute; the IR y axis is
 * the negation of the VIP-stored y (same normalization pyembroidery applies).
 * The trailing END record (0x90) stops parsing and is not emitted as a stitch.
 */
export function readVip(data: Uint8Array): Pattern {
  if (!isVip(data)) {
    throw new FormatError('Not a VIP file (bad magic).');
  }
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const nst = view.getInt32(0x04, true);
  const numberOfColors = view.getInt32(0x08, true);
  const attributeOffset = view.getInt32(0x14, true);
  const xOffset = view.getInt32(0x18, true);
  const yOffset = view.getInt32(0x1c, true);
  if (
    nst < 0 ||
    attributeOffset < 0x20 ||
    xOffset < attributeOffset ||
    yOffset < xOffset ||
    yOffset > data.length
  ) {
    throw new FormatError('Corrupt VIP header (inconsistent block offsets).');
  }

  const commands = expand(data.slice(attributeOffset, xOffset), nst);
  const xs = expand(data.slice(xOffset, yOffset), nst);
  const ys = expand(data.slice(yOffset), nst);

  const stitches: Stitch[] = [];
  let x = 0;
  let y = 0;
  for (let i = 0; i < nst; i++) {
    const c = commands[i];
    if (c === undefined) break; // stream ended before the declared count
    if (c === 0x90) break; // END
    const command = VIP_COMMANDS[c];
    if (command === undefined) {
      throw new FormatError(
        `Unknown VIP command byte 0x${c.toString(16)} at record ${i}.`,
      );
    }
    x += signed8(xs[i] ?? 0);
    y -= signed8(ys[i] ?? 0); // IR y = -(VIP y)
    stitches.push({ x, y, command });
  }

  return {
    stitches,
    threads: numberOfColors > 0 ? decodeThreads(data, numberOfColors) : [],
    extents: computeExtents(stitches),
  };
}
