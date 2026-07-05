/**
 * Format registry: maps file extensions to readers/writers.
 *
 * Detection: VIP/ZHS/PEC/PES/VP3 carry magic bytes and are sniffed from
 * content; DST/EXP/JEF/HUS/XXX/SEW/SHV/PCS have no reliable magic (EXP none
 * at all), so they resolve by extension only.
 */
import { FormatError } from './ir';
import type { ConversionWarning, Pattern } from './ir';
import { readDst } from './readers/dst';
import { readExp } from './readers/exp';
import { readHus } from './readers/hus';
import { readJef } from './readers/jef';
import { readPcs } from './readers/pcs';
import { isPec, readPec } from './readers/pec';
import { isPes, readPes } from './readers/pes';
import { readSew } from './readers/sew';
import { readShv } from './readers/shv';
import { isVip, readVip } from './readers/vip';
import { isVp3, readVp3 } from './readers/vp3';
import { readXxx } from './readers/xxx';
import { isZhs, readZhs } from './readers/zhs';
import { writeDst } from './writers/dst';
import { writeExp } from './writers/exp';
import { writeHus } from './writers/hus';
import { writeJef } from './writers/jef';
import type { WriterOptions } from './writers/options';
import { writePec } from './writers/pec';
import { writePes } from './writers/pes';
import { writeVip } from './writers/vip';
import { writeVp3 } from './writers/vp3';
import { writeXxx } from './writers/xxx';
import { writeZhs } from './writers/zhs';

export type Reader = (data: Uint8Array) => Pattern;
export type Writer = (
  pattern: Pattern,
  options?: WriterOptions,
) => {
  bytes: Uint8Array;
  warnings: ConversionWarning[];
};

const READERS: Record<string, Reader> = {
  vip: readVip,
  zhs: readZhs,
  dst: readDst,
  exp: readExp,
  jef: readJef,
  pec: readPec,
  pes: readPes,
  vp3: readVp3,
  hus: readHus,
  xxx: readXxx,
  sew: readSew,
  shv: readShv,
  pcs: readPcs,
};

const WRITERS: Record<string, Writer> = {
  zhs: writeZhs,
  dst: writeDst,
  exp: writeExp,
  jef: writeJef,
  pec: writePec,
  pes: writePes,
  vp3: writeVp3,
  hus: writeHus,
  vip: writeVip,
  xxx: writeXxx,
};

/** "vip", ".VIP", "design.vip" → "vip" */
export function normalizeFormat(format: string): string {
  const dot = format.lastIndexOf('.');
  return (dot >= 0 ? format.slice(dot + 1) : format).toLowerCase();
}

export function getReader(format: string): Reader {
  const reader = READERS[normalizeFormat(format)];
  if (reader === undefined) {
    throw new FormatError(
      `No reader for format "${format}". Readable formats: ${Object.keys(READERS).join(', ')}.`,
    );
  }
  return reader;
}

export function getWriter(format: string): Writer {
  const writer = WRITERS[normalizeFormat(format)];
  if (writer === undefined) {
    throw new FormatError(
      `No writer for format "${format}". Writable formats: ${Object.keys(WRITERS).join(', ')}.`,
    );
  }
  return writer;
}

export function supportedFormats(): { read: string[]; write: string[] } {
  return { read: Object.keys(READERS), write: Object.keys(WRITERS) };
}

/** Sniff the format from magic bytes; undefined if unrecognized. */
export function detectFormat(data: Uint8Array): string | undefined {
  if (isVip(data)) return 'vip';
  if (isZhs(data)) return 'zhs';
  if (isPec(data)) return 'pec';
  if (isPes(data)) return 'pes';
  if (isVp3(data)) return 'vp3';
  return undefined;
}
