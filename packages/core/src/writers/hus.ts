/**
 * HUS writer (Husqvarna Viking) — header mirrors readers/hus.ts and
 * scripts/gen_hus_golden.py; body from hus-vip-body.ts. Threads are
 * nearest-matched onto the fixed 29-color HUS chart (u16 palette indices).
 */
import { ByteWriter } from '../binary';
import { HUS_THREADS } from '../charts/hus-threads';
import { findNearestColorIndex } from '../color';
import type { ConversionWarning, Pattern } from '../ir';
import { buildHusVipBody } from './hus-vip-body';

const HUS_MAGIC = 0x00c8af5b;

export function writeHus(
  pattern: Pattern,
): { bytes: Uint8Array; warnings: ConversionWarning[] } {
  const body = buildHusVipBody(pattern);
  const ncolors = body.threads.length;

  const headerSize = 0x2a + 2 * ncolors;
  const commandOffset = headerSize;
  const xOffset = commandOffset + body.commandBlock.length;
  const yOffset = xOffset + body.xBlock.length;

  const w = new ByteWriter();
  w.u32le(HUS_MAGIC);
  w.u32le(body.recordCount);
  w.u32le(ncolors);
  const [posX, posY, negX, negY] = body.extents;
  w.u16le(posX);
  w.u16le(posY);
  w.u16le(negX);
  w.u16le(negY);
  w.u32le(commandOffset);
  w.u32le(xOffset);
  w.u32le(yOffset);
  w.fill(0, 8); // string
  w.u16le(0); // unknown
  for (const t of body.threads) {
    w.u16le(findNearestColorIndex(t.rgb, HUS_THREADS));
  }
  w.bytes([...body.commandBlock]);
  w.bytes([...body.xBlock]);
  w.bytes([...body.yBlock]);
  return { bytes: w.toBytes(), warnings: body.warnings };
}
