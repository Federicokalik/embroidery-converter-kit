/**
 * VIP writer (Husqvarna Viking / Pfaff) — header layout pinned on the
 * fixtures (docs/VIP_FORMAT.md), color block XOR keystream ported from
 * libembroidery; body from hus-vip-body.ts. Colors are lossless 24-bit.
 *
 * The color-block size formulas (colorLength = 0x2E + 8·n, attributeOffset
 * = 0x34 + 8·n, an (n+1)×u32(1) run and a u16 0 trailer) are verified on
 * the single-color fixtures and extrapolated for n > 1 — flagged in tests.
 */
import { ByteWriter } from '../binary';
import { VIP_COLOR_TABLE } from '../charts/vip-table';
import { UnsupportedDesignError } from '../ir';
import type { ConversionWarning, Pattern } from '../ir';
import { VIP_MAGIC } from '../readers/vip';
import { buildHusVipBody } from './hus-vip-body';

export function writeVip(
  pattern: Pattern,
): { bytes: Uint8Array; warnings: ConversionWarning[] } {
  const body = buildHusVipBody(pattern);
  // A design with zero color blocks still declares one thread slot so the
  // machine has a color to show (matches the fixtures' ncolors = 1).
  const threads = body.threads.length > 0 ? body.threads : [{ rgb: 0x348d1a }];
  const ncolors = threads.length;
  if (ncolors * 4 > VIP_COLOR_TABLE.length) {
    throw new UnsupportedDesignError(
      `Design has ${ncolors} color blocks; the VIP color keystream covers ` +
        `${VIP_COLOR_TABLE.length / 4}.`,
      'MULTI_COLOR',
    );
  }

  const attributeOffset = 0x34 + 8 * ncolors;
  const xOffset = attributeOffset + body.commandBlock.length;
  const yOffset = xOffset + body.xBlock.length;

  const w = new ByteWriter();
  w.u32le(VIP_MAGIC);
  w.u32le(body.recordCount);
  w.u32le(ncolors);
  const [posX, posY, negX, negY] = body.extents;
  w.u16le(posX);
  w.u16le(posY);
  w.u16le(negX);
  w.u16le(negY);
  w.u32le(attributeOffset);
  w.u32le(xOffset);
  w.u32le(yOffset);
  w.fill(0, 8); // string
  w.u16le(0); // unknown
  w.u32le(0x2e + 8 * ncolors); // colorLength (fixture formula)
  // XOR-chained color block: 4 bytes per color (r, g, b, 0).
  let prev = 0;
  for (let i = 0; i < ncolors * 4; i++) {
    const rgb = threads[Math.floor(i / 4)]!.rgb;
    const decoded = [(rgb >> 16) & 0xff, (rgb >> 8) & 0xff, rgb & 0xff, 0][i % 4]!;
    prev = (decoded ^ VIP_COLOR_TABLE[i]!) ^ prev;
    w.u8(prev);
  }
  for (let i = 0; i <= ncolors; i++) w.u32le(1);
  w.u16le(0);
  w.bytes([...body.commandBlock]);
  w.bytes([...body.xBlock]);
  w.bytes([...body.yBlock]);
  return { bytes: w.toBytes(), warnings: body.warnings };
}
