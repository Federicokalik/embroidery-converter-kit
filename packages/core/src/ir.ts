/**
 * Intermediate Representation shared by every reader and writer.
 * Coordinates are absolute, in 0.1 mm units, standard orientation
 * (y grows upward; VIP stores the negated y, readers normalize it).
 */

export type Command = 'STITCH' | 'JUMP' | 'TRIM' | 'COLOR_CHANGE' | 'STOP' | 'END';

export interface Stitch {
  x: number;
  y: number;
  command: Command;
}

export interface Thread {
  /** 24-bit 0xRRGGBB */
  rgb: number;
  description?: string;
  catalog?: string;
  chart?: string;
}

export interface Extents {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Embroidery hoop (frame), dimensions in 0.1 mm units like everything else.
 * Only some formats carry it (PES, JEF, PCS); VIP/ZHS store extents only.
 */
export interface Hoop {
  width: number;
  height: number;
  /** e.g. "130x180" or a PES v9/v10 hoop-name string */
  name?: string;
}

export interface Pattern {
  stitches: Stitch[];
  threads: Thread[];
  extents: Extents;
  /** Declared hoop, when the source format carries one. */
  hoop?: Hoop;
}

export interface ConversionWarning {
  code:
    | 'DELTA_63_SHIFTED'
    | 'METADATA_0X83_ZEROED'
    | 'FILLER_THREAD'
    | 'COLOR_QUANTIZED'
    | 'HOOP_FIT_EXCEEDED'
    | 'HOOP_UNSUPPORTED'
    | 'TRIM_DROPPED';
  message: string;
}

export type UnsupportedReason =
  | 'EMPTY'
  | 'MULTI_COLOR'
  | 'TRIM'
  | 'JUMP'
  | 'STOP'
  | 'DELTA_RANGE'
  | 'TOO_MANY_RECORDS'
  | 'TOO_LARGE';

/** Thrown when a writer is asked to emit output it cannot yet produce safely. */
export class UnsupportedDesignError extends Error {
  override name = 'UnsupportedDesignError';

  constructor(
    message: string,
    readonly reason: UnsupportedReason,
  ) {
    super(message);
  }
}

/** Thrown when input bytes do not parse as the expected format. */
export class FormatError extends Error {
  override name = 'FormatError';
}

export function computeExtents(stitches: Stitch[]): Extents {
  let minX = 0;
  let minY = 0;
  let maxX = 0;
  let maxY = 0;
  let first = true;
  for (const s of stitches) {
    if (s.command === 'END') continue;
    if (first) {
      minX = maxX = s.x;
      minY = maxY = s.y;
      first = false;
    } else {
      if (s.x < minX) minX = s.x;
      if (s.x > maxX) maxX = s.x;
      if (s.y < minY) minY = s.y;
      if (s.y > maxY) maxY = s.y;
    }
  }
  return { minX, minY, maxX, maxY };
}
