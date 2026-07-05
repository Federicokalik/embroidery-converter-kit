/**
 * Shared contract between the scroll choreography (GSAP writes state)
 * and the renderers (2D canvas everywhere, WebGL on capable desktops).
 *
 * World space = design units (0.1 mm), y growing downward (pyembroidery
 * convention), matching screen space. The camera focuses a world point
 * at a given zoom; `offsetX/offsetY` shift where that focus lands on
 * screen (viewport fractions, 0 = center), so scenes can park a design
 * in the free half of a split layout.
 */
import type { StitchData } from '../stitch/runs';

/** The narrative cast + the stitch-out overlay. */
export type EntityId = 'showpiece' | 'lobster' | 'octopus' | 'overlay';

/** Real designs from /fixtures, each with a scene role. */
export interface CastData {
  /** Hero centerpiece (unicorn-6x10.jef). */
  showpiece: StitchData;
  /** Babel station + translation re-stitch subject (lobster.pes). */
  lobster: StitchData;
  /** Babel station + precision macro subject (octopus.dst). */
  octopus: StitchData;
}

export interface ThreadState {
  /** Stitch progress per entity, 0..1 (fraction of segments laid). */
  progS: number;
  progLob: number;
  progOct: number;
  /** Stitch-out overlay pattern (the user's own design). */
  progO: number;
  /** World focus point. */
  camX: number;
  camY: number;
  /** Scale: CSS px per world unit. */
  zoom: number;
  /** Focus screen offset, viewport fractions (0 = centered). */
  offsetX: number;
  offsetY: number;
  /** Orbit angles in radians; the 2D stage ignores them. */
  theta: number;
  phi: number;
}

export function defaultState(): ThreadState {
  return {
    progS: 0,
    progLob: 0,
    progOct: 0,
    progO: 0,
    camX: 0,
    camY: 0,
    zoom: 4,
    offsetX: 0,
    offsetY: 0,
    theta: 0,
    phi: 0,
  };
}

export interface LetterPlacement {
  /** World position of the entity's center. */
  x: number;
  y: number;
  /** World size from the fixture extents. */
  width: number;
  height: number;
}

export type StitchListener = (entity: EntityId, segmentIndex: number) => void;

export interface StitchStage {
  readonly kind: '2d' | '3d';
  /** GSAP tweens write here; the stage lerps toward it every tick. */
  readonly state: ThreadState;
  /** The narrative designs, rendered in their real thread colors. */
  setCast(cast: CastData): void;
  /**
   * Stitch-out mode: while set, ONLY the overlay pattern renders, in
   * the user's real thread colors. Pass null to restore the narrative.
   */
  setOverlayPattern(data: StitchData | null): void;
  /** Needle position (world coords) at the given overlay progress. */
  overlayPointAt(progress: number): { x: number; y: number };
  placementOf(id: EntityId): LetterPlacement;
  viewport(): { w: number; h: number };
  /** Mark the frame dirty (state writes do this implicitly on tick). */
  requestRender(): void;
  /** Re-measure the container (canvas was moved or resized). */
  refit(): void;
  /** Render once synchronously (shader/codepath warm-up during preload). */
  warmFrame(): void;
  onStitch(cb: StitchListener): void;
  start(): void;
  stop(): void;
  dispose(): void;
}
