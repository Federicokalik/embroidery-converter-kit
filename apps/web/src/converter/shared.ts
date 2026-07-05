/**
 * Converter building blocks shared by the dropzone flow, the single-file
 * panel and the stitch-out handoff. Pure helpers and types only — no DOM
 * ids, no gsap — so the /convert page ships none of the landing machinery.
 */
import { checkFit, computeExtents } from '@embroidery/core';
import type { ConversionWarning, HoopBrand, Pattern, Stitch } from '@embroidery/core';
import { t, currentLang } from '../i18n/i18n';
import type { StitchData } from '../stitch/runs';

export const FORMAT_BRANDS: Record<string, string> = {
  vip: 'Husqvarna Viking / Pfaff',
  zhs: 'Zeng Hsing',
  dst: 'Tajima',
  exp: 'Melco',
  jef: 'Janome',
  pec: 'Brother',
  pes: 'Brother',
  vp3: 'Husqvarna Viking / Pfaff',
  hus: 'Husqvarna Viking',
  xxx: 'Singer',
  sew: 'Janome / Elna',
  shv: 'Husqvarna Viking',
  pcs: 'Pfaff',
};

/** Formats that carry an i18n caveat note ("note.<fmt>"). */
export const NOTED_FORMATS = new Set(['zhs', 'pes', 'pec', 'jef', 'exp', 'hus', 'vip', 'xxx']);

/** Target formats that persist a hoop, and the catalog brand they draw from. */
export const HOOP_BRAND_BY_FORMAT: Partial<Record<string, HoopBrand>> = {
  pes: 'brother',
  jef: 'janome',
  zhs: 'zenghsing',
};

export interface FileOutcome {
  inputName: string;
  outputName: string;
  bytes: Uint8Array | null;
  warnings: ConversionWarning[];
  error: string | null;
  pattern: Pattern | null;
  /** The user explicitly picked a trims mode: the TRIM_DROPPED warning is noise. */
  trimsChosen?: boolean;
}

/** A file parsed but not yet written: the single-file panel's subject. */
export interface ParsedFile {
  fileName: string;
  sourceFormat: string;
  pattern: Pattern;
  stitchData: StitchData;
  hasTrims: boolean;
}

/** Type lives here (not in stitchout.ts) so converter.ts can type the DI
    callback without pulling the gsap-backed module into /convert. */
export interface StitchOutJob {
  data: StitchData;
  fileName: string;
  extraCount: number;
}

export function extensionOf(name: string): string | null {
  const dot = name.lastIndexOf('.');
  return dot >= 0 && dot < name.length - 1 ? name.slice(dot + 1).toLowerCase() : null;
}

/** 0.1mm units → localized mm string ("77" / "77,5"). */
export function mm(tenths: number): string {
  const locale = currentLang() === 'it' ? 'it-IT' : 'en-US';
  return (tenths / 10).toLocaleString(locale, { maximumFractionDigits: 1 });
}

/**
 * Design size plus, when the source declared a hoop, whether it still fits.
 * Built at render time so it re-localizes on language switch.
 */
export function describePattern(pattern: Pattern): { text: string; overflow: boolean } {
  const ext = computeExtents(pattern.stitches);
  let text = t('result.size', { w: mm(ext.maxX - ext.minX), h: mm(ext.maxY - ext.minY) });
  const hoop = pattern.hoop;
  if (hoop === undefined) return { text, overflow: false };
  const fit = checkFit(pattern, hoop);
  const dims = { w: mm(hoop.width), h: mm(hoop.height) };
  if (!fit.fits) {
    text += ` ${t('result.hoopOverflow', { ...dims, ow: mm(fit.overflowX), oh: mm(fit.overflowY) })}`;
  } else if (fit.requiresCentering) {
    text += ` ${t('result.hoopRecenter', dims)}`;
  } else {
    text += ` ${t('result.hoopFits', dims)}`;
  }
  return { text, overflow: !fit.fits };
}

export function triggerDownload(bytes: Uint8Array, name: string): void {
  const blob = new Blob([bytes.slice().buffer], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Machine stops a ZHS write produces, per trims mode. MUST mirror
 * writers/zhs.ts exactly: 'drop' pauses at color changes and stops only;
 * 'pause' additionally turns each TRIM into a stop unless a pause already
 * follows it (skipping jumps/trims; end of design counts as one).
 * Keep in sync with pauseFollows() in the core writer.
 */
export function machineStops(stitches: Stitch[]): { drop: number; pause: number } {
  const raw = stitches.filter((s) => s.command !== 'END');
  const pauseFollows = (from: number): boolean => {
    for (let j = from + 1; j < raw.length; j++) {
      const c = raw[j]!.command;
      if (c === 'JUMP' || c === 'TRIM') continue;
      return c === 'COLOR_CHANGE' || c === 'STOP';
    }
    return true;
  };
  let base = 0;
  let extra = 0;
  raw.forEach((s, i) => {
    if (s.command === 'COLOR_CHANGE' || s.command === 'STOP') base += 1;
    else if (s.command === 'TRIM' && !pauseFollows(i)) extra += 1;
  });
  return { drop: base, pause: base + extra };
}
