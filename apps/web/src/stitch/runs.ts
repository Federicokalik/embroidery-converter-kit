/**
 * Stitch data spine shared by every renderer (2D canvas stage, WebGL
 * stage): a core Pattern becomes polyline "runs".
 *
 * IR coordinates are 0.1 mm units with y growing DOWNWARD (pyembroidery
 * convention, verified empirically by rasterizing fixtures), matching
 * screen space: no flip anywhere in 2D. The WebGL stage negates y once
 * for three.js's y-up world. Runs split at COLOR_CHANGE and break at
 * JUMP/TRIM/STOP so the thread does not connect across gaps.
 */
import type { Pattern } from '@embroidery/core';

export interface StitchRun {
  points: Array<[number, number]>;
  threadIndex: number;
}

export interface StitchData {
  runs: StitchRun[];
  stitchCount: number;
  /** Screen-space extents (y already negated), 0.1 mm units. */
  extents: { minX: number; minY: number; maxX: number; maxY: number };
  /** Thread colors as 0xRRGGBB ints, indexed by StitchRun.threadIndex. */
  threads: number[];
}

/** Split stitches into polyline runs (new color at COLOR_CHANGE, gap at JUMP/TRIM/STOP). */
export function collectRuns(pattern: Pattern): StitchRun[] {
  const runs: StitchRun[] = [];
  let current: StitchRun | null = null;
  let threadIndex = 0;

  for (const s of pattern.stitches) {
    switch (s.command) {
      case 'STITCH':
        if (current === null) {
          current = { points: [], threadIndex };
          runs.push(current);
        }
        current.points.push([s.x, s.y]);
        break;
      case 'COLOR_CHANGE':
        threadIndex += 1;
        current = null;
        break;
      case 'JUMP':
      case 'TRIM':
      case 'STOP':
        current = null;
        break;
      case 'END':
        break;
    }
  }
  return runs.filter((r) => r.points.length >= 2);
}

/** Keep at most `budget` points across all runs, preserving run endpoints. */
export function decimate(runs: StitchRun[], budget: number): StitchRun[] {
  const total = runs.reduce((n, r) => n + r.points.length, 0);
  if (total <= budget) return runs;
  const step = Math.ceil(total / budget);
  return runs.map((r) => {
    const kept: Array<[number, number]> = [];
    for (let i = 0; i < r.points.length; i += step) kept.push(r.points[i]!);
    const last = r.points[r.points.length - 1]!;
    const lastKept = kept[kept.length - 1]!;
    if (lastKept[0] !== last[0] || lastKept[1] !== last[1]) kept.push(last);
    return { points: kept, threadIndex: r.threadIndex };
  });
}

/** Full stage-ready data for a pattern. */
export function toStitchData(pattern: Pattern): StitchData {
  const runs = collectRuns(pattern);
  const stitchCount = pattern.stitches.filter((s) => s.command === 'STITCH').length;
  const { minX, minY, maxX, maxY } = pattern.extents;
  return {
    runs,
    stitchCount,
    extents: { minX, minY, maxX, maxY },
    threads: pattern.threads.map((t) => t.rgb & 0xffffff),
  };
}

/** Total segment count across runs (a run of n points has n-1 segments). */
export function segmentCount(runs: StitchRun[]): number {
  return runs.reduce((n, r) => n + r.points.length - 1, 0);
}

/**
 * Thread colors render on paper (#f4f4f2): pure white would vanish.
 * Cap the luminance so light threads read like white thread on fabric.
 */
export function visibleThreadColor(rgb: number): number {
  const r = (rgb >> 16) & 0xff;
  const g = (rgb >> 8) & 0xff;
  const b = rgb & 0xff;
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  if (lum <= 0.88) return rgb;
  const k = 0.88 / lum;
  return (
    (Math.round(r * k) << 16) | (Math.round(g * k) << 8) | Math.round(b * k)
  );
}

/** End point of the Nth segment (needle position at that stitch). */
export function pointAtSegment(runs: StitchRun[], segIndex: number): [number, number] {
  let remaining = Math.max(0, segIndex);
  for (const run of runs) {
    const segs = run.points.length - 1;
    if (remaining < segs) return run.points[remaining + 1]!;
    remaining -= segs;
  }
  const last = runs[runs.length - 1];
  return last !== undefined ? last.points[last.points.length - 1]! : [0, 0];
}

