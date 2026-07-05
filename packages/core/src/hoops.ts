/**
 * Hoop catalog and design-vs-hoop fit checks.
 *
 * All dimensions are in 0.1 mm units (declared in mm below, ×10 at build).
 * The catalog is a curated, human-readable spec table — deliberately small.
 * Entries are common first-party hoops per brand; sizes are approximate
 * marketing sizes (the usable field can be a few mm smaller). Extend as
 * needed; it feeds `selectSmallestHoop` and the CLI fit report, never a
 * binary format field directly.
 *
 * VP3 carries no parseable hoop field (pyembroidery ignores it entirely),
 * so Husqvarna/Pfaff hoops here serve fit reporting only.
 */
import type { Extents, Hoop, Pattern } from './ir';

export type HoopBrand =
  | 'brother'
  | 'janome'
  | 'husqvarna'
  | 'pfaff'
  | 'singer'
  | 'zenghsing';

function mm(width: number, height: number, name?: string): Hoop {
  return { width: width * 10, height: height * 10, name: name ?? `${width}x${height}` };
}

export const HOOP_CATALOG: Record<HoopBrand, Hoop[]> = {
  // Brother home machines (PES/PEC).
  brother: [mm(100, 100), mm(130, 180), mm(160, 260), mm(180, 300)],
  // Janome (JEF) — exactly the five hoops JEF hoop codes 0–4 can declare.
  janome: [mm(50, 50), mm(110, 110), mm(126, 110), mm(140, 200), mm(200, 200)],
  // Husqvarna Viking (HUS/VIP/SHV).
  husqvarna: [mm(100, 100), mm(120, 120), mm(150, 240), mm(200, 360)],
  // Pfaff (VP3/VIP/PCS).
  pfaff: [mm(80, 80), mm(120, 115), mm(140, 225), mm(200, 260)],
  // Singer (XXX).
  singer: [mm(100, 100), mm(114, 171)],
  // Zeng Hsing OEM (ZHS). Both sizes read from real ZHS headers (0x2C/0x2E):
  // 100x100 in the Artist Toolkit monogram fixtures, 260x160 in the factory
  // multicolor sample — confirm the full lineup with the hoopA/hoopB samples.
  zenghsing: [mm(100, 100), mm(260, 160)],
};

/**
 * JEF hoop-size codes (writers/jef.ts writes them at header offset 0x20).
 * Index in this array == the code on disk.
 */
export const JEF_HOOPS: readonly Hoop[] = [
  mm(110, 110),
  mm(50, 50),
  mm(140, 200),
  mm(126, 110),
  mm(200, 200),
];

/** The JEF hoop code whose dimensions match `hoop` exactly, or undefined. */
export function jefHoopCode(hoop: Hoop): number | undefined {
  const index = JEF_HOOPS.findIndex(
    (h) => h.width === hoop.width && h.height === hoop.height,
  );
  return index >= 0 ? index : undefined;
}

/** True when the design's bounding box fits the hoop once centered. */
export function fitsHoop(extents: Extents, hoop: Hoop): boolean {
  return (
    extents.maxX - extents.minX <= hoop.width &&
    extents.maxY - extents.minY <= hoop.height
  );
}

export interface HoopFit {
  /** Size-wise: would fit once centered. */
  fits: boolean;
  /** How much the design WIDTH exceeds the hoop (0 when it fits). */
  overflowX: number;
  /** How much the design HEIGHT exceeds the hoop (0 when it fits). */
  overflowY: number;
  /** Fits by size, but its current placement sticks out of a centered hoop. */
  requiresCentering: boolean;
}

export function checkFit(pattern: Pattern | Extents, hoop: Hoop): HoopFit {
  const e: Extents = 'extents' in pattern ? pattern.extents : pattern;
  const width = e.maxX - e.minX;
  const height = e.maxY - e.minY;
  const fits = width <= hoop.width && height <= hoop.height;
  const halfW = hoop.width / 2;
  const halfH = hoop.height / 2;
  const inPlace =
    e.minX >= -halfW && e.maxX <= halfW && e.minY >= -halfH && e.maxY <= halfH;
  return {
    fits,
    overflowX: Math.max(0, width - hoop.width),
    overflowY: Math.max(0, height - hoop.height),
    requiresCentering: fits && !inPlace,
  };
}

/** Smallest hoop (by area, then width) that fits the design, or undefined. */
export function selectSmallestHoop(
  extents: Extents,
  hoops: readonly Hoop[],
): Hoop | undefined {
  return [...hoops]
    .filter((h) => fitsHoop(extents, h))
    .sort((a, b) => a.width * a.height - b.width * b.height || a.width - b.width)[0];
}
