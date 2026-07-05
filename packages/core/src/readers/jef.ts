/**
 * JEF reader (Janome) — port of pyembroidery/JefReader.py.
 * Threads come from the fixed JEF chart; palette index 0 is a None
 * placeholder that turns the next thread-change control into a STOP.
 */
import { ByteReader } from '../binary';
import { JEF_THREADS } from '../charts/jef-threads';
import { signed8 } from '../embcompress';
import { JEF_HOOPS } from '../hoops';
import { computeExtents, FormatError } from '../ir';
import type { Hoop, Pattern, Stitch, Thread } from '../ir';
import { interpolateTrims } from '../pattern-transforms';

export function readJef(data: Uint8Array): Pattern {
  if (data.length < 116) {
    throw new FormatError('Not a JEF file (header truncated).');
  }
  const r = new ByteReader(data);
  const stitchOffset = r.u32le();
  r.skip(20);
  const countColors = r.u32le();
  r.skip(4); // point count
  const hoopCode = r.u32le(); // header 0x20: hoop-size code 0..4
  r.skip(80);
  if (stitchOffset < 0 || stitchOffset > data.length || countColors < 0) {
    throw new FormatError('Corrupt JEF header.');
  }
  const hoop: Hoop | undefined = JEF_HOOPS[hoopCode];

  const threadlist: Array<Thread | null> = [];
  for (let i = 0; i < countColors; i++) {
    const index = Math.abs(r.i32le());
    if (index === 0) {
      threadlist.push(null); // palette slot 0: STOP marker
    } else {
      const t = JEF_THREADS[index % JEF_THREADS.length];
      threadlist.push(t ?? null);
    }
  }

  r.seek(stitchOffset);
  const stitches: Stitch[] = [];
  let x = 0;
  let y = 0;
  let colorIndex = 1;
  while (true) {
    const b0 = r.u8();
    const b1 = r.u8();
    if (b0 < 0 || b1 < 0) break;
    if (b0 !== 0x80) {
      x += signed8(b0);
      y += -signed8(b1);
      stitches.push({ x, y, command: 'STITCH' });
      continue;
    }
    const ctrl = b1;
    const c0 = r.u8();
    const c1 = r.u8();
    if (c0 < 0 || c1 < 0) break;
    if (ctrl === 0x02) {
      x += signed8(c0);
      y += -signed8(c1);
      stitches.push({ x, y, command: 'JUMP' });
      continue;
    }
    if (ctrl === 0x01) {
      if (threadlist[colorIndex] === null) {
        stitches.push({ x, y, command: 'STOP' });
        threadlist.splice(colorIndex, 1);
      } else {
        stitches.push({ x, y, command: 'COLOR_CHANGE' });
        colorIndex += 1;
      }
      continue;
    }
    break; // 0x10 = END, anything else = uncaught control
  }

  // pyembroidery default read settings: no jump-count trigger, but a jump
  // run displaced more than 3 mm (30 units) becomes an inserted TRIM.
  interpolateTrims(stitches, undefined, 30, true);

  const threads = threadlist.filter((t): t is Thread => t !== null);
  const pattern: Pattern = { stitches, threads, extents: computeExtents(stitches) };
  if (hoop !== undefined) pattern.hoop = { ...hoop };
  return pattern;
}
