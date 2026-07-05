import type { Hoop } from '../ir';

/** Optional writer metadata (pinned in tests for byte-determinism). */
export interface WriterOptions {
  /** Design name — DST "LA:" header field. Default "Untitled". */
  label?: string;
  /** Timestamp "YYYYMMDDHHmmss" — JEF header date. Default: current time. */
  date?: string;
  /**
   * Opt-in target hoop for formats that declare one (PES, JEF). Absent →
   * pyembroidery-identical defaults. Writers never auto-select a hoop; use
   * selectSmallestHoop(...) and pass the result explicitly.
   */
  hoop?: Hoop;
  /**
   * ZHS only (the format has no trim record and the machine no trimmer):
   * 'drop' (default) removes TRIMs — floating threads are cut by hand at
   * the end; 'pause' converts each mid-block TRIM into a machine stop
   * (a color change onto the same color, a pattern real factory files use)
   * so the thread can be cut at the machine. Trims already adjacent to a
   * color change are dropped either way — the machine pauses there anyway.
   */
  trims?: 'drop' | 'pause';
}
