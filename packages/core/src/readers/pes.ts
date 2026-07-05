/**
 * PES reader (Brother) — port of pyembroidery/PesReader.py.
 * PES is a container: version-specific headers (threads appear in v5+),
 * then a pointer to the embedded PEC block that holds the stitches.
 */
import { ByteReader } from '../binary';
import { computeExtents, FormatError } from '../ir';
import type { Hoop, Pattern, Thread } from '../ir';
import { interpolateDuplicateColorAsStop } from '../pattern-transforms';
import { readPecBlock } from './pec';

function signature(data: Uint8Array): string {
  let s = '';
  for (let i = 0; i < 8 && i < data.length; i++) s += String.fromCharCode(data[i]!);
  return s;
}

export function isPes(data: Uint8Array): boolean {
  const sig = signature(data);
  return sig.startsWith('#PES') || sig === '#PEC0001';
}

function readPesString(r: ByteReader): string | null {
  const length = r.u8();
  if (length <= 0) return null;
  return r.utf8(length);
}

function readPesThread(r: ByteReader, threads: Thread[]): void {
  const catalog = readPesString(r);
  const rgb = r.u24be();
  r.skip(5);
  const description = readPesString(r);
  const brand = readPesString(r);
  const chart = readPesString(r);
  const thread: Thread = { rgb: rgb & 0xffffff };
  if (catalog !== null) thread.catalog = catalog;
  if (description !== null) thread.description = description;
  if (chart !== null) thread.chart = chart;
  void brand; // IR has no brand field
  threads.push(thread);
}

function skipMetadataStrings(r: ByteReader, count: number): void {
  for (let i = 0; i < count; i++) readPesString(r);
}

/**
 * "130x180", "130mm x 180mm", "SQ 140x140" → a Hoop in 0.1 mm units;
 * null when the name carries no recognizable dimensions.
 */
function hoopFromName(name: string): Hoop | null {
  const m = /(\d{2,3})\s*(?:mm)?\s*[xX×]\s*(\d{2,3})/.exec(name);
  if (m === null) return null;
  return { width: Number(m[1]) * 10, height: Number(m[2]) * 10, name };
}

/** Shared shape of the v5..v10 headers: seeks + strings + thread list. */
function readThreadHeader(
  r: ByteReader,
  threads: Thread[],
  preImageSkip: number,
  postImageSkip: number,
  hoopNameSkip?: number,
): string | null {
  let hoopName: string | null = null;
  r.skip(4);
  skipMetadataStrings(r, 5); // name, category, author, keywords, comments
  if (hoopNameSkip !== undefined) {
    r.skip(hoopNameSkip);
    hoopName = readPesString(r); // hoop name
  }
  r.skip(preImageSkip);
  readPesString(r); // image file
  r.skip(postImageSkip);
  if (r.u16le() !== 0) return hoopName; // programmable fills
  if (r.u16le() !== 0) return hoopName; // motifs
  if (r.u16le() !== 0) return hoopName; // feather patterns
  const countThreads = r.u16le();
  for (let i = 0; i < countThreads; i++) readPesThread(r, threads);
  return hoopName;
}

export function readPes(data: Uint8Array): Pattern {
  if (!isPes(data)) {
    throw new FormatError('Not a PES file (bad signature).');
  }
  const sig = signature(data);
  const r = new ByteReader(data);
  r.seek(8);
  const loadedThreads: Thread[] = [];
  let hoop: Hoop | null = null;

  if (sig !== '#PEC0001') {
    const pecBlockPosition = r.u32le();
    if (pecBlockPosition < 0 || pecBlockPosition >= data.length) {
      throw new FormatError('Corrupt PES file (bad PEC block pointer).');
    }
    let hoopName: string | null = null;
    switch (sig) {
      case '#PES0001': {
        // v1 header: u16 scale-to-fit, then the hoop flag PesWriter emits
        // (0 = 100x100 hoop, 1 = 130x180 hoop).
        r.skip(2);
        const hoopFlag = r.u16le();
        if (hoopFlag === 0) hoop = { width: 1000, height: 1000, name: '100x100' };
        else if (hoopFlag === 1) hoop = { width: 1300, height: 1800, name: '130x180' };
        break;
      }
      case '#PES0100':
        hoopName = readThreadHeader(r, loadedThreads, 38, 34, 14);
        break;
      case '#PES0090':
        hoopName = readThreadHeader(r, loadedThreads, 30, 34, 14);
        break;
      case '#PES0080':
        readThreadHeader(r, loadedThreads, 38, 26);
        break;
      case '#PES0070':
        readThreadHeader(r, loadedThreads, 36, 24);
        break;
      case '#PES0060':
        readThreadHeader(r, loadedThreads, 36, 24);
        break;
      case '#PES0050':
      case '#PES0055':
      case '#PES0056':
        readThreadHeader(r, loadedThreads, 24, 24);
        break;
      default:
        break; // v2..v4 and unrecognized: no threads in header
    }
    if (hoop === null && hoopName !== null) hoop = hoopFromName(hoopName);
    r.seek(pecBlockPosition);
  }

  const { stitches, threads } = readPecBlock(r, loadedThreads);
  interpolateDuplicateColorAsStop(stitches, threads);
  const pattern: Pattern = { stitches, threads, extents: computeExtents(stitches) };
  if (hoop !== null) pattern.hoop = hoop;
  return pattern;
}
