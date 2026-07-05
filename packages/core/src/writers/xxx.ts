/**
 * XXX writer (Singer) — port of pyembroidery/XxxWriter.py (header variant B,
 * the one write() uses). The u32 at 0xFC is back-patched with the offset of
 * the 7F 7F 02 14 end marker; the color table trails it: 2 zero bytes,
 * 0x00 R G B per thread, zero-padding up to 21 palette slots, an 0xFFFFFF00
 * terminator and a 0x00 0x01 tail. Long STITCH deltas (|d| >= 124) become
 * 0x7D records with 16-bit deltas — which pyembroidery's own reader decodes
 * back as JUMPs (kept as-is for parity).
 */
import { ByteWriter } from '../binary';
import { normalize } from '../encoder';
import type { ConversionWarning, Pattern } from '../ir';
import { pyround } from '../pyround';
import { XXX_SETTINGS } from '../writer-settings';
import type { WriterOptions } from './options';

export function writeXxx(
  pattern: Pattern,
  _options?: WriterOptions,
): { bytes: Uint8Array; warnings: ConversionWarning[] } {
  const { stitches, threads, warnings } = normalize(pattern, XXX_SETTINGS);

  // write_xxx_header_b — bounds/last-position over the NORMALIZED records
  // (including the END row), truncated toward zero like Python's int().
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
  const last = stitches[stitches.length - 1]!;

  const w = new ByteWriter();
  w.fill(0x00, 0x17);
  w.u32le(stitches.length - 1); // END record "not called a command"
  w.fill(0x00, 0x0c);
  w.u32le(threads.length);
  w.u16le(0x0000);
  w.u16le(Math.trunc(maxX - minX)); // width
  w.u16le(Math.trunc(maxY - minY)); // height
  w.u16le(Math.trunc(last.x));
  w.u16le(Math.trunc(-last.y));
  w.u16le(Math.trunc(-minX));
  w.u16le(Math.trunc(maxY));
  w.fill(0x00, 0x42);
  w.u16le(0x00); // unknown
  w.u16le(0x00); // unknown
  w.fill(0x00, 0x73);
  w.u16le(0x20);
  w.fill(0x00, 0x08);

  const endOfStitchesPlaceholder = w.length; // 0xFC
  w.u32le(0x00000000);

  // write_xxx_stitches
  let xx = 0;
  let yy = 0;
  for (const s of stitches) {
    const dx = pyround(s.x - xx);
    const dy = pyround(s.y - yy);
    xx += dx;
    yy += dy;
    if (s.command === 'COLOR_CHANGE' || s.command === 'STOP') {
      w.u8(0x7f);
      w.u8(0x08);
      w.u8(dx);
      w.u8(-dy);
      continue;
    }
    if (s.command === 'END') break;
    if (s.command === 'STITCH') {
      if (dx > -124 && dx < 124 && dy > -124 && dy < 124) {
        w.u8(dx);
        w.u8(-dy);
      } else {
        w.u8(0x7d);
        w.u16le(dx);
        w.u16le(-dy);
      }
      continue;
    }
    if (s.command === 'TRIM') {
      w.u8(0x7f);
      w.u8(0x03);
      w.u8(dx);
      w.u8(-dy);
      continue;
    }
    if (s.command === 'JUMP') {
      w.u8(0x7f);
      w.u8(0x01);
      w.u8(dx);
      w.u8(-dy);
    }
  }

  w.patchU32le(endOfStitchesPlaceholder, w.length);
  w.bytes([0x7f, 0x7f, 0x02, 0x14]);

  // write_xxx_colors
  w.u8(0x00);
  w.u8(0x00);
  for (const t of threads) {
    w.u8(0x00);
    w.u8((t.rgb >> 16) & 0xff);
    w.u8((t.rgb >> 8) & 0xff);
    w.u8(t.rgb & 0xff);
  }
  for (let i = 0; i < 21 - threads.length; i++) w.u32le(0x00000000);
  w.u32le(0xffffff00);
  w.u8(0x00);
  w.u8(0x01);

  return { bytes: w.toBytes(), warnings };
}
