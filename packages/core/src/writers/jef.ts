/**
 * JEF writer (Janome) — port of pyembroidery/JefWriter.py (trims=False
 * default). Threads are nearest-matched onto the fixed JEF chart, with the
 * pigeonhole patch: when two *different* consecutive threads collapse onto
 * the same chart index, the second takes its second-closest color.
 */
import { ByteWriter } from '../binary';
import { JEF_THREADS } from '../charts/jef-threads';
import { findNearestColorIndex } from '../color';
import { normalize } from '../encoder';
import { JEF_HOOPS, jefHoopCode, selectSmallestHoop } from '../hoops';
import type { ConversionWarning, Hoop, Pattern, Thread } from '../ir';
import { pyround } from '../pyround';
import { JEF_SETTINGS } from '../writer-settings';
import type { WriterOptions } from './options';

const HOOP_110X110 = 0;
const HOOP_50X50 = 1;
const HOOP_140X200 = 2;
const HOOP_126X110 = 3;
const HOOP_200X200 = 4;

function jefHoopSize(width: number, height: number): number {
  if (width < 500 && height < 500) return HOOP_50X50;
  if (width < 1260 && height < 1100) return HOOP_126X110;
  if (width < 1400 && height < 2000) return HOOP_140X200;
  if (width < 2000 && height < 2000) return HOOP_200X200;
  return HOOP_110X110;
}

/**
 * Header hoop code: default = pyembroidery's design-size heuristic
 * (byte-identical). With an explicit hoop: its exact JEF code, else the code
 * of the smallest JEF hoop containing it (JEF can only declare the 5 stock
 * Janome hoops); nothing contains it → HOOP_UNSUPPORTED + default heuristic.
 */
function resolveHoopCode(
  hoop: Hoop | undefined,
  designWidth: number,
  designHeight: number,
  warnings: ConversionWarning[],
): number {
  const defaultCode = jefHoopSize(designWidth, designHeight);
  if (hoop === undefined) return defaultCode;

  if (designWidth > hoop.width || designHeight > hoop.height) {
    warnings.push({
      code: 'HOOP_FIT_EXCEEDED',
      message:
        `Design ${designWidth / 10}x${designHeight / 10} mm exceeds the ` +
        `${hoop.width / 10}x${hoop.height / 10} mm hoop.`,
    });
  }

  const exact = jefHoopCode(hoop);
  if (exact !== undefined) return exact;
  const containing = selectSmallestHoop(
    { minX: 0, minY: 0, maxX: hoop.width, maxY: hoop.height },
    JEF_HOOPS,
  );
  const code = containing === undefined ? undefined : jefHoopCode(containing);
  if (code === undefined) {
    warnings.push({
      code: 'HOOP_UNSUPPORTED',
      message:
        `JEF cannot declare a ${hoop.width / 10}x${hoop.height / 10} mm hoop ` +
        `(stock Janome hoops only); keeping the size-based default.`,
    });
    return defaultCode;
  }
  return code;
}

function writeHoopEdgeDistance(w: ByteWriter, xEdge: number, yEdge: number): void {
  if (Math.min(xEdge, yEdge) >= 0) {
    w.u32le(xEdge);
    w.u32le(yEdge);
    w.u32le(xEdge);
    w.u32le(yEdge);
  } else {
    w.u32le(-1);
    w.u32le(-1);
    w.u32le(-1);
    w.u32le(-1);
  }
}

const FILLER: Thread = { rgb: 0 };

export function writeJef(
  pattern: Pattern,
  options?: WriterOptions,
): { bytes: Uint8Array; warnings: ConversionWarning[] } {
  const { stitches, threads, warnings } = normalize(pattern, JEF_SETTINGS);
  const dateString = options?.date ?? formatNow();

  // Palette construction (the pyembroidery "PATCH" block).
  const chart: Array<Thread | null> = [...JEF_THREADS];
  let lastIndex: number | null = null;
  let lastThread: Thread | null = null;
  const palette: number[] = [];
  let colorToggled = false;
  let colorCount = 0; // color and stop count
  let indexInThreadlist = 0;
  for (const stitch of stitches) {
    const flags = stitch.command;
    if (flags === 'COLOR_CHANGE' || indexInThreadlist === 0) {
      const thread = threads[indexInThreadlist] ?? FILLER;
      indexInThreadlist += 1;
      colorCount += 1;
      let indexOfJefThread = findNearestColorIndex(thread.rgb, chart);
      if (
        lastIndex === indexOfJefThread &&
        lastThread !== null &&
        (lastThread.rgb & 0xffffff) !== (thread.rgb & 0xffffff)
      ) {
        const repeatedIndex = indexOfJefThread;
        const repeatedThread = chart[repeatedIndex]!;
        chart[repeatedIndex] = null;
        indexOfJefThread = findNearestColorIndex(thread.rgb, chart);
        chart[repeatedIndex] = repeatedThread;
      }
      palette.push(indexOfJefThread);
      lastIndex = indexOfJefThread;
      lastThread = thread;
      colorToggled = false;
    }
    if (flags === 'STOP') {
      colorCount += 1;
      colorToggled = !colorToggled;
      palette.push(colorToggled ? 0 : (lastIndex ?? 0));
    }
  }

  const w = new ByteWriter();
  w.u32le(0x74 + colorCount * 8);
  w.u32le(0x14);
  w.utf8(dateString);
  w.u8(0);
  w.u8(0);
  w.u32le(colorCount);

  let pointCount = 1; // END statement
  for (const s of stitches) {
    if (s.command === 'STITCH') pointCount += 1;
    else if (s.command === 'JUMP') pointCount += 2;
    else if (s.command === 'COLOR_CHANGE' || s.command === 'STOP') pointCount += 2;
    else if (s.command === 'END') break;
    // TRIM contributes nothing with trims=False
  }
  w.u32le(pointCount);

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
  const designWidth = pyround(maxX - minX);
  const designHeight = pyround(maxY - minY);
  w.u32le(resolveHoopCode(options?.hoop, designWidth, designHeight, warnings));
  const halfWidth = pyround(designWidth / 2);
  const halfHeight = pyround(designHeight / 2);
  w.u32le(halfWidth);
  w.u32le(halfHeight);
  w.u32le(halfWidth);
  w.u32le(halfHeight);
  writeHoopEdgeDistance(w, 550 - halfWidth, 550 - halfHeight);
  writeHoopEdgeDistance(w, 250 - halfWidth, 250 - halfHeight);
  writeHoopEdgeDistance(w, 700 - halfWidth, 1000 - halfHeight);
  writeHoopEdgeDistance(w, 700 - halfWidth, 1000 - halfHeight);

  for (const t of palette) w.u32le(t);
  for (let i = 0; i < colorCount; i++) w.u32le(0x0d);

  let xx = 0;
  let yy = 0;
  for (const s of stitches) {
    const dx = pyround(s.x - xx);
    const dy = pyround(s.y - yy);
    xx += dx;
    yy += dy;
    if (s.command === 'STITCH') {
      w.u8(dx);
      w.u8(-dy);
    } else if (s.command === 'COLOR_CHANGE' || s.command === 'STOP') {
      w.bytes([0x80, 0x01]);
      w.u8(dx);
      w.u8(-dy);
    } else if (s.command === 'JUMP') {
      w.bytes([0x80, 0x02]);
      w.u8(dx);
      w.u8(-dy);
    } else if (s.command === 'END') {
      break;
    }
    // TRIM with trims=False writes nothing (delta swallowed)
  }
  w.bytes([0x80, 0x10]);
  return { bytes: w.toBytes(), warnings };
}

function formatNow(): string {
  const d = new Date();
  const p = (v: number, n = 2): string => String(v).padStart(n, '0');
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}` +
    `${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  );
}
