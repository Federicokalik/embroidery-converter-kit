/**
 * ZHS writer (Zeng Hsing "HSING12") — the only ZHS writer in the open.
 * Spec in docs/ZHS_FORMAT.md; single-color mapping ported from
 * reference/zhs_vip_reference.py and verified byte-for-byte on 028-B.
 *
 * MULTICOLOR + mid-design jumps: reverse-engineered from a real factory
 * multicolor sample (fixtures/zhs-samples/SHE2215A_003.zhs, 6 colors /
 * 10 blocks, cross-checked against its PES twin):
 *   - the header is a per-block table of 20-byte rows starting at 0x5E
 *     (one row per color block + a terminator row); the old single-color
 *     "constants" are the 1-block special case of this table;
 *   - a COLOR_CHANGE record (ctrl 0x04) carries the PALETTE INDEX of the
 *     next block as its payload, not a spatial delta;
 *   - the palette stores unique RGBs; the metadata string has one
 *     "&$chart&#description&#catalog&%" entry per BLOCK;
 *   - every block opens with a MOVE run followed by a (0,0) tie-in stitch;
 *   - long jumps are runs of MOVE records (deltas up to ±128).
 *
 * TRIM: no sample shows a trim record (0x88 is an unconfirmed guess even
 * upstream, and the factory multicolor sample uses NO trims at all — 148
 * raw MOVE runs, machine has no trimmer). TRIMs are therefore DROPPED with
 * a warning, exactly like the JEF writer's trims=False default; revisit if
 * the trim1 recipe sample ever reveals a real record. A handful of header
 * metadata words (block row +2, the old 0x83 editor word) are not derivable
 * and are written as 0/constants; machine readers ignore them, physical
 * stitch-out is the acceptance test.
 */
import { HOOP_CATALOG, selectSmallestHoop } from '../hoops';
import { computeExtents, UnsupportedDesignError } from '../ir';
import type {
  ConversionWarning,
  Pattern,
  Stitch,
  Thread,
  UnsupportedReason,
} from '../ir';
import { interpolateStopAsDuplicateColor } from '../pattern-transforms';
import { encodeDelta } from '../zhs-codec';
import type { WriterOptions } from './options';

export interface ZhsWriteResult {
  bytes: Uint8Array;
  warnings: ConversionWarning[];
}

/** A checksum record is emitted after every 84 data records. */
const BLOCK = 84;
/** Per-block header rows: 20 bytes each, starting at 0x5E. */
const ROWS_START = 0x5e;
const ROW_SIZE = 20;
const INT16_MIN = -32768;
const INT16_MAX = 32767;
/** Palette indices ride in the delta payload; ±63 is unencodable. */
const MAX_PALETTE = 62;

const FILLER: Thread = { rgb: 0 };

/**
 * Why (if anything) this pattern cannot be written to ZHS.
 * Exported so the conversion matrix and front-ends share the writer's gate.
 */
export function zhsUnsupportedReason(pattern: Pattern): UnsupportedReason | null {
  const stitches = pattern.stitches.filter((s) => s.command !== 'END');
  if (stitches.length === 0) return 'EMPTY';
  return null;
}

/** The on-disk byte value of a stored delta (inverse ±63-hole extension). */
function adjustStored(v: number): number {
  if (v >= 64) return v - 1;
  if (v <= -64) return v + 1;
  return v;
}

function checkInt16(value: number, what: string): number {
  if (value < INT16_MIN || value > INT16_MAX) {
    throw new UnsupportedDesignError(
      `${what} (${value}) exceeds the int16 range of the ZHS header; the design is too large.`,
      'TOO_LARGE',
    );
  }
  return value;
}

interface BlockInfo {
  paletteIndex: number;
  /** 0x02 records in this block, tie-in included. */
  stitchCount: number;
  /** Sums of the on-disk (adjusted) deltas of the block's opening MOVE run. */
  landingStoredX: number;
  landingStoredY: number;
  /** Index of the block's tie-in stitch in the data-record list. */
  tieDataIndex: number;
}

export function writeZhs(pattern: Pattern, options?: WriterOptions): ZhsWriteResult {
  if (zhsUnsupportedReason(pattern) === 'EMPTY') {
    throw new UnsupportedDesignError('Cannot write an empty design to ZHS.', 'EMPTY');
  }

  const warnings: ConversionWarning[] = [];

  // No ZHS trim record is known (the factory multicolor sample uses none):
  // TRIMs are dropped, like the JEF writer's trims=False default.
  const trimCount = pattern.stitches.filter((s) => s.command === 'TRIM').length;
  if (trimCount > 0) {
    warnings.push({
      code: 'TRIM_DROPPED',
      message:
        `${trimCount} trim command(s) dropped: ZHS has no known trim record ` +
        '(the machine has no thread trimmer); floating threads between color ' +
        'blocks must be cut by hand.',
    });
  }

  // Work on copies: interpolateStopAsDuplicateColor mutates, and STOP becomes
  // a color change to a duplicated thread (same trick the PEC/PES writers use).
  const stitches = pattern.stitches
    .filter((s) => s.command !== 'END' && s.command !== 'TRIM')
    .map((s) => ({ ...s }));
  const threads = pattern.threads.map((t) => ({ ...t }));
  interpolateStopAsDuplicateColor(stitches, threads);

  // Split into color blocks.
  const blocks: Stitch[][] = [[]];
  for (const s of stitches) {
    if (s.command === 'COLOR_CHANGE') blocks.push([]);
    else blocks[blocks.length - 1]!.push(s);
  }
  if (blocks.length > 0xff) {
    throw new UnsupportedDesignError(
      `Design has ${blocks.length} color blocks; the ZHS block counter is one byte.`,
      'TOO_MANY_RECORDS',
    );
  }

  // One thread per block; missing ones become the deterministic filler.
  const blockThreads: Thread[] = blocks.map((_, b) => threads[b] ?? FILLER);
  if (threads.length < blocks.length) {
    warnings.push({
      code: 'FILLER_THREAD',
      message:
        'The design has more color blocks than threads; missing colors were ' +
        'written as black.',
    });
  }

  // Unique-color palette + per-block indices (order of first appearance).
  const palette: Thread[] = [];
  const paletteIndices = blockThreads.map((t) => {
    const rgb = t.rgb & 0xffffff;
    let idx = palette.findIndex((p) => (p.rgb & 0xffffff) === rgb);
    if (idx < 0) {
      palette.push(t);
      idx = palette.length - 1;
    }
    return idx;
  });
  if (palette.length > MAX_PALETTE) {
    throw new UnsupportedDesignError(
      `Design uses ${palette.length} distinct colors; ZHS color-change records ` +
        `can only address ${MAX_PALETTE}.`,
      'MULTI_COLOR',
    );
  }

  // ---------------------------------------------------------------------
  // Data-record emission. Positions are tracked in STORED orientation
  // (x = IR x, y = -IR y) as a ZHS decoder reconstructs them, so ±63-hole
  // shifts self-correct on the next record instead of drifting.
  // ---------------------------------------------------------------------
  const records: Array<[ctrl: number, dx: number, dy: number]> = [];
  let ex = 0; // decoded position
  let ey = 0;
  let storedSumX = 0; // sums of on-disk byte values (MOVE + STITCH records)
  let storedSumY = 0;

  const emit = (ctrl: 0x01 | 0x02, dx: number, dy: number): void => {
    records.push([ctrl, dx, dy]);
    ex += dx;
    ey += dy;
    storedSumX += adjustStored(dx);
    storedSumY += adjustStored(dy);
  };

  /** Largest single-record step toward v (avoids the unencodable ±63). */
  const moveChunk = (v: number): number => {
    let c = v > 128 ? 128 : v < -128 ? -128 : v;
    if (c === 63) c = 64;
    else if (c === -63) c = -64;
    return c;
  };

  /** Emit MOVE records until the decoded position reaches (tx, ty). */
  const moveTo = (tx: number, ty: number): void => {
    while (ex !== tx || ey !== ty) {
      emit(0x01, moveChunk(tx - ex), moveChunk(ty - ey));
    }
  };

  /** Emit one STITCH at (tx, ty), jump-splitting oversized deltas. */
  const stitchTo = (tx: number, ty: number): void => {
    while (tx - ex > 128 || tx - ex < -128 || ty - ey > 128 || ty - ey < -128) {
      emit(0x01, moveChunk(tx - ex), moveChunk(ty - ey));
    }
    let dx = tx - ex;
    let dy = ty - ey;
    for (const axis of ['dx', 'dy'] as const) {
      const v = axis === 'dx' ? dx : dy;
      if (v === 63 || v === -63) {
        const shifted = v === 63 ? 64 : -64;
        if (axis === 'dx') dx = shifted;
        else dy = shifted;
        warnings.push({
          code: 'DELTA_63_SHIFTED',
          message:
            `A ${axis} delta of ${v} is not representable in ZHS and was ` +
            `written as ${shifted} (one stitch deviates by 0.1 mm; the rest ` +
            'of the design is unaffected).',
        });
      }
    }
    emit(0x02, dx, dy);
  };

  const blockInfos: BlockInfo[] = [];
  blocks.forEach((blockStitches, b) => {
    const firstStitchIdx = blockStitches.findIndex((s) => s.command === 'STITCH');
    const landingStartX = storedSumX;
    const landingStartY = storedSumY;

    // Opening run: leading jumps, then land exactly on the first stitch.
    const leadEnd = firstStitchIdx >= 0 ? firstStitchIdx : blockStitches.length;
    for (let i = 0; i < leadEnd; i++) {
      const s = blockStitches[i]!;
      moveTo(s.x, -s.y);
    }
    const landing = blockStitches[firstStitchIdx >= 0 ? firstStitchIdx : leadEnd - 1];
    if (landing !== undefined) moveTo(landing.x, -landing.y);

    const landingStoredX = storedSumX - landingStartX;
    const landingStoredY = storedSumY - landingStartY;

    // Tie-in stitch: it IS the block's first stitch (verified on 028-B and
    // after every color change in the factory sample).
    const tieDataIndex = records.length;
    emit(0x02, 0, 0);
    let stitchCount = 1;

    for (let i = leadEnd + 1; i < blockStitches.length; i++) {
      const s = blockStitches[i]!;
      if (s.command === 'STITCH') {
        stitchTo(s.x, -s.y);
        stitchCount += 1;
      } else if (s.command === 'JUMP') {
        moveTo(s.x, -s.y);
      }
      // STOP was interpolated away above; TRIM/COLOR_CHANGE/END can't be here.
    }

    if (stitchCount > 0xffff) {
      throw new UnsupportedDesignError(
        `Color block ${b} has ${stitchCount} stitches, beyond the uint16 ` +
          'per-block counter in the ZHS header.',
        'TOO_MANY_RECORDS',
      );
    }

    blockInfos.push({
      paletteIndex: paletteIndices[b]!,
      stitchCount,
      landingStoredX,
      landingStoredY,
      tieDataIndex,
    });

    if (b < blocks.length - 1) {
      // COLOR_CHANGE payload = palette index of the NEXT block.
      records.push([0x04, paletteIndices[b + 1]!, 0]);
    }
  });

  // ---------------------------------------------------------------------
  // Serialize the stream: 84-record blocks, each followed by a checksum
  // record; then END and a checksum over the trailing block.
  // ---------------------------------------------------------------------
  const stream: number[] = [];
  let chkBlock: number[] = [];
  const flushChecksum = (): void => {
    let sum = 0;
    for (const byte of chkBlock) sum += byte;
    sum &= 0xffff;
    stream.push(...chkBlock, 0x10, sum & 0xff, (sum >> 8) & 0xff);
    chkBlock = [];
  };
  let count = 0;
  for (const [ctrl, dx, dy] of records) {
    const [b1, b2] = encodeDelta(dx, dy);
    chkBlock.push(ctrl, b1, b2);
    count += 1;
    if (count === BLOCK) {
      flushChecksum();
      count = 0;
    }
  }
  chkBlock.push(0x80, 0, 0); // END record lives inside the trailing block
  flushChecksum();

  const totalRecords = stream.length / 3;
  if (totalRecords - 2 > 0xffff) {
    throw new UnsupportedDesignError(
      `Design produces ${totalRecords} ZHS records, beyond the uint16 record ` +
        'counter in the ZHS header.',
      'TOO_MANY_RECORDS',
    );
  }

  /** 1-based stream index (checksums included) of data record k. */
  const streamIndex1b = (k: number): number => k + Math.floor(k / BLOCK) + 1;

  // ---------------------------------------------------------------------
  // Header: globals + per-block rows + terminator row + palette + 7-byte pad.
  // ---------------------------------------------------------------------
  const nBlocks = blocks.length;
  const headerStart = ROWS_START + ROW_SIZE * (nBlocks + 1);

  let metaString = '';
  for (const t of blockThreads) {
    metaString += `&$${t.chart ?? ''}&#${t.description ?? ''}&#${t.catalog ?? ''}&%`;
  }
  const metaBytes = new TextEncoder().encode(metaString);
  if (metaBytes.length > 0xffff) {
    throw new UnsupportedDesignError(
      'Thread metadata string exceeds the uint16 length field.',
      'TOO_LARGE',
    );
  }
  const stitchStart = headerStart + 1 + palette.length * 3 + 2 + metaBytes.length + 7;

  const nData = records.length;
  const nStitches = blockInfos.reduce((sum, info) => sum + info.stitchCount, 0);
  const { minX, minY, maxX, maxY } = computeExtents(stitches);

  // Declared hoop (0x2C/0x2E is mandatory): explicit option, else the source
  // pattern's own hoop, else the smallest Zeng Hsing hoop that fits, else the
  // largest known one (with a fit warning below).
  const catalog = HOOP_CATALOG.zenghsing;
  const hoop =
    options?.hoop ??
    pattern.hoop ??
    selectSmallestHoop({ minX, minY, maxX, maxY }, catalog) ??
    catalog[catalog.length - 1]!;
  if (maxX - minX > hoop.width || maxY - minY > hoop.height) {
    warnings.push({
      code: 'HOOP_FIT_EXCEEDED',
      message:
        `Design ${(maxX - minX) / 10}x${(maxY - minY) / 10} mm exceeds the ` +
        `${hoop.width / 10}x${hoop.height / 10} mm hoop.`,
    });
  }

  const header = new Uint8Array(stitchStart);
  const view = new DataView(header.buffer);
  header.set([0x48, 0x53, 0x49, 0x4e, 0x47, 0x31, 0x32], 0); // "HSING12"
  view.setUint32(0x07, nData + 1, true);
  view.setUint32(0x0b, nStitches, true);
  view.setUint32(0x0f, stitchStart, true);
  view.setUint32(0x13, headerStart, true);
  view.setUint32(0x17, stitchStart - 5, true);
  view.setInt16(0x1c, checkInt16(maxX, 'posX'), true);
  view.setInt16(0x1e, checkInt16(minX, 'negX'), true);
  view.setInt16(0x22, checkInt16(-minY, 'posY'), true); // stored y = -(IR y)
  view.setInt16(0x24, checkInt16(-maxY, 'negY'), true);
  header.set([0x30, 0x30, 0x30, 0x30], 0x28); // "0000"
  view.setUint16(0x2c, hoop.width, true); // hoop, 0.1 mm units
  view.setUint16(0x2e, hoop.height, true);
  header[0x65] = nBlocks;

  blockInfos.forEach((info, b) => {
    const o = ROWS_START + ROW_SIZE * b;
    // o+2 (u16): editor metadata counter — not derivable, machine readers
    // ignore it; 0 (matches Artist Toolkit block 0 in every sample).
    header[o + 9] = info.paletteIndex;
    view.setUint16(o + 10, info.stitchCount, true);
    view.setInt16(o + 14, checkInt16(info.landingStoredX, 'block landing X'), true);
    view.setInt16(o + 16, checkInt16(info.landingStoredY, 'block landing Y'), true);
    view.setUint16(o + 18, streamIndex1b(info.tieDataIndex), true);
  });

  const t = ROWS_START + ROW_SIZE * nBlocks; // terminator row
  view.setUint16(t + 2, 140, true); // constant in every Artist Toolkit sample
  view.setInt16(t + 9, checkInt16(storedSumX, 'last X'), true);
  view.setInt16(t + 11, checkInt16(storedSumY, 'last Y'), true);
  view.setUint16(t + 13, totalRecords - 2, true);
  view.setUint16(t + 17, 0, true); // editor metadata (the old "0x83") — see docs
  warnings.push({
    code: 'METADATA_0X83_ZEROED',
    message:
      'Output matches Artist Toolkit byte-for-byte except editor-metadata ' +
      'words (terminator row) that embroidery machines ignore.',
  });

  let p = headerStart;
  header[p] = palette.length;
  p += 1;
  for (const thread of palette) {
    header[p] = (thread.rgb >> 16) & 0xff;
    header[p + 1] = (thread.rgb >> 8) & 0xff;
    header[p + 2] = thread.rgb & 0xff;
    p += 3;
  }
  view.setUint16(p, metaBytes.length, true);
  header.set(metaBytes, p + 2);
  // 7 zero bytes of padding follow (buffer is zero-initialized).

  const bytes = new Uint8Array(header.length + stream.length);
  bytes.set(header, 0);
  bytes.set(stream, header.length);
  return { bytes, warnings };
}
