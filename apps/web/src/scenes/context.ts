/**
 * Shared scene plumbing: the context every scene factory receives and
 * camera-pose helpers. Scenes write ThreadState through GSAP; the stage
 * lerps and renders.
 */
import type { CastData, LetterPlacement, StitchStage } from '../stage/types';

export interface SceneContext {
  stage: StitchStage;
  cast: CastData;
  /** Pins and long scrubs are desktop-only. */
  desktop: boolean;
  /** Resolves when the preloader has left the screen (hero entrance gate). */
  revealed: Promise<void>;
}

export interface SceneHandle {
  destroy(): void;
}

export type SceneFactory = (ctx: SceneContext) => SceneHandle;

/** Zoom that fits a placement into the given viewport fractions. */
export function fitZoom(
  stage: StitchStage,
  p: LetterPlacement,
  fractionW: number,
  fractionH: number,
): number {
  const vp = stage.viewport();
  return Math.min((vp.w * fractionW) / p.width, (vp.h * fractionH) / p.height);
}
