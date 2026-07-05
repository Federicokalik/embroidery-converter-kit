/**
 * @embroidery/core — universal embroidery format converter engine.
 * Zero Node/DOM dependencies: runs in the browser, Node, and Electron alike.
 */
import type { ConversionWarning } from './ir';
import { getReader, getWriter } from './registry';

export type {
  Command,
  ConversionWarning,
  Extents,
  Hoop,
  Pattern,
  Stitch,
  Thread,
  UnsupportedReason,
} from './ir';
export { computeExtents, FormatError, UnsupportedDesignError } from './ir';
export {
  checkFit,
  fitsHoop,
  HOOP_CATALOG,
  JEF_HOOPS,
  jefHoopCode,
  selectSmallestHoop,
} from './hoops';
export type { HoopBrand, HoopFit } from './hoops';
export { center, translate } from './geometry';
export { compress, expand, signed8, signed16 } from './embcompress';
export { decodeDelta, encodeDelta, isEncodableDelta } from './zhs-codec';
export { isVip, readVip, VIP_MAGIC } from './readers/vip';
export { isZhs, readZhs } from './readers/zhs';
export { readDst } from './readers/dst';
export { readExp } from './readers/exp';
export { readJef } from './readers/jef';
export { isPec, readPec } from './readers/pec';
export { isPes, readPes } from './readers/pes';
export { isVp3, readVp3 } from './readers/vp3';
export { readHus } from './readers/hus';
export { readXxx } from './readers/xxx';
export { readSew } from './readers/sew';
export { readShv } from './readers/shv';
export { readPcs } from './readers/pcs';
export { writeZhs, zhsUnsupportedReason } from './writers/zhs';
export type { ZhsWriteResult } from './writers/zhs';
export { writeHus } from './writers/hus';
export { writeVip } from './writers/vip';
export { writeDst } from './writers/dst';
export { writeExp } from './writers/exp';
export { writeJef } from './writers/jef';
export { writePec } from './writers/pec';
export { writePes } from './writers/pes';
export { writeVp3 } from './writers/vp3';
export { writeXxx } from './writers/xxx';
export type { WriterOptions } from './writers/options';
export { normalize } from './encoder';
export type { EncoderSettings, NormalizedPattern } from './encoder';
export {
  detectFormat,
  getReader,
  getWriter,
  normalizeFormat,
  supportedFormats,
} from './registry';
export type { Reader, Writer } from './registry';

export interface ConvertResult {
  bytes: Uint8Array;
  warnings: ConversionWarning[];
}

/**
 * Convert embroidery bytes between formats.
 * `from`/`to` accept an extension or filename ("vip", ".vip", "design.vip").
 *
 * @throws FormatError            unknown format or corrupt input
 * @throws UnsupportedDesignError output gated pending verification samples
 */
export function convert(
  data: Uint8Array,
  from: string,
  to: string,
  options?: import('./writers/options').WriterOptions,
): ConvertResult {
  const pattern = getReader(from)(data);
  return getWriter(to)(pattern, options);
}
