/**
 * Stitch-out on the shared stage: the machine sews the user's real
 * design, in its real thread colors, on whichever renderer the page is
 * running (3D thread on desktop, 2D canvas elsewhere).
 *
 * Like a real machine, the needle stays put and the fabric moves: the
 * camera tracks the current stitch so it always sits under the fixed
 * needle head. For the duration, the page's stage canvas is reparented
 * into the panel window; the narrative pauses (overlay mode renders
 * only the user's pattern) and everything is restored afterwards.
 */
import { gsap, ScrollTrigger, reduceMotion } from '../core/gsap';
import { t } from '../i18n/i18n';
import { decimate } from '../stitch/runs';
import type { StitchData } from '../stitch/runs';
import type { StitchStage, ThreadState } from '../stage/types';
import type { StitchOutJob } from './shared';

/** Needle tip position within the panel window (see stitchout-head CSS). */
const ANCHOR_Y = 0.353;

/** Rendering budget for the user's design. */
const MAX_POINTS = 12_000;

/** Total sewing time: comfortable minimum, a touch more for many colors. */
function sewDuration(runCount: number): number {
  return Math.min(2.6 + (runCount - 1) * 0.35, 4.2);
}

let currentStage: StitchStage | null = null;

/** The orchestrator hands over the live stage (again after a downgrade). */
export function registerStitchOutStage(stage: StitchStage | null): void {
  currentStage = stage;
}

export type { StitchOutJob } from './shared';

export function playStitchOut(job: StitchOutJob): Promise<void> {
  const stage = currentStage;
  if (stage === null || reduceMotion) return Promise.resolve();
  const overlay = document.getElementById('stitchout');
  const windowEl = document.getElementById('stitchout-canvas');
  const status = document.getElementById('stitchout-status');
  const skip = document.getElementById('stitchout-skip') as HTMLButtonElement | null;
  const needle = document.getElementById('so-needle');
  const stageEl = document.getElementById('stage');
  if (
    overlay === null ||
    windowEl === null ||
    status === null ||
    skip === null ||
    needle === null ||
    stageEl === null
  ) {
    return Promise.resolve();
  }
  const data: StitchData = { ...job.data, runs: decimate(job.data.runs, MAX_POINTS) };
  if (data.runs.length === 0) return Promise.resolve();

  return new Promise((resolve) => {
    const s = stage.state;
    const saved: ThreadState = { ...s };
    const stageParent = stageEl.parentElement!;
    const stageNext = stageEl.nextSibling;

    // Borrow the page canvas: it becomes the panel's window.
    document.body.classList.add('stitchout-open');
    windowEl.replaceChildren();
    windowEl.append(stageEl);
    overlay.hidden = false;
    gsap.set(overlay, { autoAlpha: 0 });
    stage.refit();
    stage.setOverlayPattern(data);

    const p = stage.placementOf('overlay');
    const box = windowEl.getBoundingClientRect();
    const fitZoom = Math.min((box.width * 0.86) / p.width, (box.height * 0.86) / p.height);
    const side = Math.max(p.width, p.height);
    const sewZoom = fitZoom * gsap.utils.clamp(1.4, 3, side / 900 + 1.4);
    const first = stage.overlayPointAt(0);

    gsap.set(s, {
      progO: 0,
      theta: 0,
      phi: 0,
      offsetX: 0,
      offsetY: ANCHOR_Y - 0.5,
      zoom: sewZoom,
      camX: first.x,
      camY: first.y,
    });
    stage.requestRender();

    status.textContent =
      job.extraCount > 1
        ? t('stitch.batch', { name: job.fileName, n: job.extraCount })
        : job.extraCount === 1
          ? t('stitch.batchOne', { name: job.fileName })
          : t('stitch.working', { name: job.fileName });
    skip.hidden = false;

    gsap.to(overlay, { autoAlpha: 1, duration: 0.25 });
    skip.focus();

    const needleLoop = gsap.to(needle, {
      y: 10,
      duration: 0.09,
      repeat: -1,
      yoyo: true,
      ease: 'power1.inOut',
    });

    const progress = { v: 0 };
    const tl = gsap.timeline();
    tl.to(progress, {
      v: 1,
      duration: sewDuration(data.runs.length),
      ease: 'none',
      onUpdate() {
        s.progO = progress.v;
        const pt = stage.overlayPointAt(progress.v);
        s.camX = pt.x;
        s.camY = pt.y;
      },
    });
    // Finished: lift the zoom and show the whole design centered.
    tl.to(s, {
      camX: p.x,
      camY: p.y,
      zoom: fitZoom,
      offsetY: 0,
      progO: 1,
      duration: 0.7,
      ease: 'power2.inOut',
    });

    let settled = false;
    const cleanup = (): void => {
      gsap.to(overlay, {
        autoAlpha: 0,
        duration: 0.3,
        onComplete: () => {
          overlay.hidden = true;
          tl.kill();
          stage.setOverlayPattern(null);
          // Give the canvas back to the page and restore the camera.
          stageParent.insertBefore(stageEl, stageNext);
          document.body.classList.remove('stitchout-open');
          stage.refit();
          Object.assign(s, saved, { progO: 0 });
          stage.requestRender();
          ScrollTrigger.refresh();
        },
      });
    };
    const finish = (): void => {
      if (settled) return;
      settled = true;
      needleLoop.kill();
      skip.hidden = true;
      status.textContent = job.extraCount > 0 ? t('stitch.doneMulti') : t('stitch.doneSingle');
      document.removeEventListener('keydown', onKey);
      resolve(); // download fires now, while the finished design lingers
      gsap.delayedCall(1.5, cleanup);
    };
    tl.eventCallback('onComplete', finish);

    const onSkip = (): void => {
      tl.progress(1); // triggers onComplete -> finish()
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onSkip();
    };
    skip.addEventListener('click', onSkip, { once: true });
    document.addEventListener('keydown', onKey);
  });
}
