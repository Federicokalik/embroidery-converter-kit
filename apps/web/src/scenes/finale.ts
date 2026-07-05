/**
 * S6 Finale: the destination. The camera pulls out to clean paper, the
 * dropzone border stitches itself on and the converter takes the stage.
 * Also owns the footer knot. All entrances are once-only.
 */
import { gsap, reduceMotion } from '../core/gsap';
import type { SceneContext, SceneHandle } from './context';
import { riseOnEnter } from './headline';
import type { HeadlineHandle } from './headline';

export function finale(ctx: SceneContext): SceneHandle {
  const { stage } = ctx;
  const section = document.getElementById('converter')!;
  const h2 = section.querySelector<HTMLElement>('h2')!;
  const border = section.querySelector<HTMLElement>('.stitch-border')!;
  const side = section.querySelector<HTMLElement>('.conv-side')!;
  const knot = document.querySelector<SVGPathElement>('.footer-knot path');

  let headline: HeadlineHandle | null = null;
  const gctx = gsap.context(() => {
    if (reduceMotion) return;

    // Camera: leave the macro dive for clean paper past the octopus,
    // so the converter UI sits on a quiet background.
    const oct = stage.placementOf('octopus');
    const s = stage.state;
    gsap
      .timeline({
        // Ends well before the converter is in view: the UI must land
        // on clean paper, not on the tail of the macro dive.
        scrollTrigger: { trigger: section, start: 'top bottom', end: 'top 60%', scrub: 1 },
      })
      .to(s, {
        camX: oct.x + oct.width * 1.4,
        camY: oct.y - oct.height * 0.6,
        offsetX: 0,
        offsetY: 0,
        zoom: 0.5,
        theta: 0,
        phi: 0,
        ease: 'none',
      });

    // The border "stitches on": a left-to-right wipe of the dashed rect.
    gsap.set(border, { clipPath: 'inset(0 100% 0 0)' });
    gsap
      .timeline({
        scrollTrigger: { trigger: section, start: 'top 65%', once: true },
      })
      .to(border, { clipPath: 'inset(0 0% 0 0)', duration: 1.1, ease: 'power1.inOut' }, 0.1)
      .from(
        side.children,
        { autoAlpha: 0, y: 18, stagger: 0.1, duration: 0.6 },
        0.2,
      );

    if (knot !== null) {
      gsap.set(knot, { drawSVG: '0%' });
      gsap.to(knot, {
        drawSVG: '100%',
        duration: 1.2,
        ease: 'power1.inOut',
        scrollTrigger: { trigger: '.footer', start: 'top 85%', once: true },
      });
    }
  }, section.parentElement ?? section);

  headline = riseOnEnter(h2, { trigger: section, start: 'top 70%' });

  return {
    destroy() {
      headline?.revert();
      gctx.revert();
    },
  };
}
