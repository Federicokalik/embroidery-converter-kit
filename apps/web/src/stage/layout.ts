/**
 * World layout shared by both renderers: the cast sits on one row (the
 * showpiece at the origin of its island, lobster left, octopus right),
 * in design units (0.1 mm, y down). The row keeps camera travel between
 * scenes on a single axis, reading as one cinematic pull of the thread.
 */
import { segmentCount } from '../stitch/runs';
import type { StitchData, StitchRun } from '../stitch/runs';
import type { CastData, EntityId, LetterPlacement } from './types';

const ROW_Y = 1800;

export interface PlacedEntityData {
  id: EntityId;
  runs: StitchRun[];
  threads: number[];
  segments: number;
  placement: LetterPlacement;
  /** World offset that maps the entity's own center onto placement.x/y. */
  dx: number;
  dy: number;
}

function place(id: EntityId, d: StitchData, x: number, y: number): PlacedEntityData {
  const cx = (d.extents.minX + d.extents.maxX) / 2;
  const cy = (d.extents.minY + d.extents.maxY) / 2;
  const placement: LetterPlacement = {
    x,
    y,
    width: d.extents.maxX - d.extents.minX,
    height: d.extents.maxY - d.extents.minY,
  };
  return {
    id,
    runs: d.runs,
    threads: d.threads,
    segments: segmentCount(d.runs),
    placement,
    dx: x - cx,
    dy: y - cy,
  };
}

export function layoutCast(cast: CastData): PlacedEntityData[] {
  const spW = cast.showpiece.extents.maxX - cast.showpiece.extents.minX;
  const lobW = cast.lobster.extents.maxX - cast.lobster.extents.minX;
  const octW = cast.octopus.extents.maxX - cast.octopus.extents.minX;
  const gap = spW * 0.85;
  return [
    place('lobster', cast.lobster, -(spW / 2 + gap + lobW / 2), ROW_Y),
    place('showpiece', cast.showpiece, 0, ROW_Y),
    place('octopus', cast.octopus, spW / 2 + gap + octW / 2, ROW_Y),
  ];
}

/** Stitch-out pattern: parked far from everything narrative. */
export function layoutOverlay(data: StitchData): PlacedEntityData {
  return place('overlay', data, 0, -20_000);
}
