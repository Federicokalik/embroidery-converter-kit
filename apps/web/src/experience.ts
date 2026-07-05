/**
 * Experience orchestrator: preloader -> stage (3D or 2D) -> scenes.
 *
 * The converter never waits on any of this; if fixtures or the stage
 * fail, the page stays a clean static site and conversion still works.
 * WebGL context loss mid-session downgrades to the 2D stage and
 * rebuilds the scenes in place.
 */
import { isDesktop, reduceMotion, refreshScroll } from './core/gsap';
import { loadFonts, runLoader } from './core/loader';
import { atoz } from './scenes/atoz';
import { babel } from './scenes/babel';
import type { SceneContext } from './scenes/context';
import { finale } from './scenes/finale';
import { hero, heroPose } from './scenes/hero';
import { SceneManager } from './scenes/manager';
import { createPreloader } from './scenes/preloader';
import { precision } from './scenes/precision';
import { translation } from './scenes/translation';
import { registerStitchOutStage } from './converter/stitchout';
import { Canvas2DStage } from './stage/canvas2d-stage';
import { createStage } from './stage/stage';
import { loadCast } from './stitch/fixtures';
import type { CastData, StitchStage } from './stage/types';

export async function initExperience(): Promise<void> {
  const stageEl = document.getElementById('stage')!;
  const pre = createPreloader();
  const desktop = isDesktop();

  const castPromise: Promise<CastData> = loadCast();

  let manager: SceneManager | null = null;
  let ctx: SceneContext | null = null;
  let cast: CastData | null = null;

  const downgrade = (): void => {
    if (ctx === null || cast === null) return;
    console.warn('WebGL context lost: downgrading to the 2D stage');
    ctx.stage.dispose();
    const s2 = new Canvas2DStage(stageEl);
    Object.assign(s2.state, ctx.stage.state);
    s2.setCast(cast);
    ctx.stage = s2;
    registerStitchOutStage(s2);
    manager?.rebuild();
    s2.start();
    s2.requestRender();
  };

  const stagePromise: Promise<StitchStage> = castPromise.then(async (data) => {
    const stage = await createStage(stageEl, { desktop, onContextLost: downgrade });
    stage.setCast(data);
    stage.warmFrame();
    return stage;
  });

  await runLoader(
    [
      { weight: 2, exec: loadFonts },
      { weight: 1, exec: () => castPromise },
      // On desktop this also covers the lazy three chunk + shader warm-up.
      { weight: desktop ? 3 : 1, exec: () => stagePromise },
    ],
    (p) => pre.setProgress(p),
  );

  let stage: StitchStage;
  try {
    stage = await stagePromise;
    cast = await castPromise;
  } catch {
    await pre.finish(); // fixtures/stage failed: static page, converter still works
    return;
  }

  registerStitchOutStage(stage);
  const revealed = pre.finish();
  ctx = { stage, cast, desktop, revealed };

  manager = new SceneManager([hero, babel, translation, atoz, precision, finale], ctx);
  manager.init();
  manager.bindEnvironment();

  if (reduceMotion) staticPose(ctx);

  refreshScroll();
  stage.start();
  await revealed;
}

/** Reduced motion: everything laid, camera parked on the hero pose. */
function staticPose(ctx: SceneContext): void {
  const s = ctx.stage.state;
  s.progS = 1;
  s.progLob = 1;
  s.progOct = 1;
  heroPose(ctx);
  ctx.stage.warmFrame();
}
