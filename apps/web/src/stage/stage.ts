/**
 * Stage chooser: WebGL on capable desktops, 2D canvas everywhere else.
 * The three module is a lazy chunk; any failure (import, WebGL init)
 * silently lands on the 2D path. Context loss mid-session reports back
 * so the orchestrator can rebuild scenes on a fresh 2D stage.
 */
import { Canvas2DStage } from './canvas2d-stage';
import type { StitchStage } from './types';

export interface StageOptions {
  desktop: boolean;
  onContextLost?: () => void;
}

export function webglAvailable(): boolean {
  try {
    const probe = document.createElement('canvas');
    return probe.getContext('webgl2') !== null || probe.getContext('webgl') !== null;
  } catch {
    return false;
  }
}

export async function createStage(
  container: HTMLElement,
  opts: StageOptions,
): Promise<StitchStage> {
  if (opts.desktop && webglAvailable()) {
    try {
      const { ThreeStitchStage } = await import('./three-stage');
      return new ThreeStitchStage(container, opts.onContextLost);
    } catch (e) {
      console.warn('3D stage unavailable, falling back to 2D', e);
    }
  }
  return new Canvas2DStage(container);
}
