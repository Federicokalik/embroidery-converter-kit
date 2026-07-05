/**
 * HUS reader (Husqvarna Viking) — port of pyembroidery/HusReader.py.
 * Same EmbCompress body as VIP but with a fixed 29-color chart addressed by
 * u16 palette indices. Like pyembroidery, the magic field is not validated
 * (no ground-truth sample to pin it against), so registry detection for HUS
 * is extension-based.
 */
import { ByteReader } from '../binary';
import { HUS_THREADS } from '../charts/hus-threads';
import { expand, signed8 } from '../embcompress';
import { computeExtents, FormatError } from '../ir';
import type { Pattern, Stitch, Thread } from '../ir';

export function readHus(data: Uint8Array): Pattern {
  if (data.length < 0x2a) {
    throw new FormatError('Not a HUS file (header truncated).');
  }
  const r = new ByteReader(data);
  r.u32le(); // magic code — not validated (pyembroidery parity)
  const numberOfStitches = r.i32le();
  const numberOfColors = r.i32le();
  r.skip(8); // extents (recomputed from the decoded path)
  const commandOffset = r.i32le();
  const xOffset = r.i32le();
  const yOffset = r.i32le();
  r.skip(8); // string
  r.u16le(); // unknown

  if (
    numberOfStitches < 0 ||
    numberOfColors < 0 ||
    commandOffset < 0x2a ||
    xOffset < commandOffset ||
    yOffset < xOffset ||
    yOffset > data.length
  ) {
    throw new FormatError('Corrupt HUS header (inconsistent block offsets).');
  }

  const threads: Thread[] = [];
  for (let i = 0; i < numberOfColors; i++) {
    const index = r.u16le();
    const t = HUS_THREADS[index % HUS_THREADS.length];
    threads.push(t ?? { rgb: 0 });
  }

  const commands = expand(data.slice(commandOffset, xOffset), numberOfStitches);
  const xs = expand(data.slice(xOffset, yOffset), numberOfStitches);
  const ys = expand(data.slice(yOffset), numberOfStitches);
  const stitchCount = Math.min(commands.length, xs.length, ys.length);

  const stitches: Stitch[] = [];
  let x = 0;
  let y = 0;
  for (let i = 0; i < stitchCount; i++) {
    const cmd = commands[i]!;
    const dx = signed8(xs[i]!);
    const dy = -signed8(ys[i]!);
    if (cmd === 0x80) {
      x += dx;
      y += dy;
      stitches.push({ x, y, command: 'STITCH' });
    } else if (cmd === 0x81) {
      x += dx;
      y += dy;
      stitches.push({ x, y, command: 'JUMP' });
    } else if (cmd === 0x84) {
      x += dx;
      y += dy;
      stitches.push({ x, y, command: 'COLOR_CHANGE' });
    } else if (cmd === 0x88) {
      if (dx !== 0 || dy !== 0) {
        x += dx;
        y += dy;
        stitches.push({ x, y, command: 'JUMP' });
      }
      stitches.push({ x, y, command: 'TRIM' });
    } else {
      break; // 0x90 END, or unmapped command
    }
  }

  return { stitches, threads, extents: computeExtents(stitches) };
}
