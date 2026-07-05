/**
 * S5 Precision (pinned, scrub): the macro moment. The camera dives from
 * the full octopus into its crosshatch until single thread crossings
 * fill the screen, tilting in so the over-under reads in depth. Pure
 * camera choreography; the stitches are already laid. The before/after
 * pairs are real coordinates from the design, identical by definition.
 */
import { gsap, reduceMotion } from '../core/gsap';
import { fitZoom } from './context';
import type { SceneContext, SceneHandle } from './context';
import { riseOnEnter } from './headline';
import type { HeadlineHandle } from './headline';

export function precision(ctx: SceneContext): SceneHandle {
  const { stage, cast, desktop } = ctx;
  const section = document.getElementById('precision')!;
  const h2 = section.querySelector<HTMLElement>('h2')!;
  const compare = section.querySelector<HTMLElement>('.precision-compare')!;

  // Three real coordinate pairs from the octopus, before = after.
  const points = cast.octopus.runs.flatMap((r) => r.points);
  const cells = compare.querySelectorAll('span:not(.label)');
  for (let i = 0; i < 3; i++) {
    const p = points[Math.floor((points.length / 4) * (i + 1))];
    if (p === undefined) break;
    const text = `${p[0]},${p[1]}`;
    cells[i * 2]!.textContent = text;
    cells[i * 2 + 1]!.textContent = text;
  }

  let headline: HeadlineHandle | null = null;
  const gctx = gsap.context(() => {
    if (reduceMotion) return;

    const oct = stage.placementOf('octopus');
    const s = stage.state;
    const fullZoom = fitZoom(stage, oct, 0.6, 0.62);
    // Deep enough that one stitch (~0.7 mm) spans a hand's width.
    const macroZoom = (stage.viewport().w * (desktop ? 6 : 4)) / oct.width;

    // Approach: from the typographic wall down to the finished octopus.
    gsap
      .timeline({
        scrollTrigger: { trigger: section, start: 'top bottom', end: 'top top', scrub: 1 },
      })
      .to(s, {
        camX: oct.x,
        camY: oct.y,
        offsetX: 0,
        offsetY: desktop ? 0.08 : 0.2,
        zoom: fullZoom,
        progOct: 1,
        theta: 0,
        phi: 0,
        ease: 'none',
      });

    const dive = gsap.timeline({
      scrollTrigger: desktop
        ? { trigger: section, start: 'top top', end: '+=200%', pin: true, scrub: 1 }
        : { trigger: section, start: 'top 60%', end: 'bottom 90%', scrub: 1 },
    });
    dive
      .to(s, { zoom: macroZoom, ease: 'power1.in', duration: 0.8 }, 0)
      // Drift toward a busy crosshatch patch off the exact center,
      // tilting in so the over-under of the crossings reads in depth.
      .to(s, { camX: oct.x + oct.width * 0.12, camY: oct.y - oct.height * 0.08, ease: 'none', duration: 0.8 }, 0)
      .to(s, { theta: 0.28, phi: -0.22, ease: 'power1.inOut', duration: 0.6 }, 0.2)
      .from(compare, { autoAlpha: 0, y: 18, duration: 0.15 }, 0.55);
  }, section);

  // Accent marker behind the headline: the octopus renders in ink, and
  // ink-on-ink would swallow the text once the macro dive fills the frame.
  if (reduceMotion) h2.classList.add('headline-highlight');
  headline = riseOnEnter(h2, {
    trigger: section,
    start: desktop ? 'top 55%' : 'top 78%',
    chars: true,
    highlight: true,
  });

  return {
    destroy() {
      headline?.revert();
      gctx.revert();
    },
  };
}
