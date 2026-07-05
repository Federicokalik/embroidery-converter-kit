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
}
