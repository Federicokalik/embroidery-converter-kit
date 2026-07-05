/**
 * S4 From A to Z (the horizontal-scroll moment). Vertical scroll pans a
 * viewport-height typographic wall of every supported format while a
 * pink thread line runs its baseline. Desktop only; mobile keeps the
 * wrapped wall with a simple reveal.
 */
import { gsap, reduceMotion } from '../core/gsap';
import type { SceneContext, SceneHandle } from './context';
import { riseOnEnter } from './headline';
import type { HeadlineHandle } from './headline';

export function atoz(ctx: SceneContext): SceneHandle {
  const { stage, desktop } = ctx;
  const section = document.getElementById('atoz')!;
  const h2 = section.querySelector<HTMLElement>('h2')!;
  const wall = document.getElementById('format-wall')!;
  const wrap = section.querySelector<HTMLElement>('.format-wall-wrap')!;

  let headline: HeadlineHandle | null = null;
  const gctx = gsap.context(() => {
    if (reduceMotion) return;

    // Camera: retreat to clean paper below the cast row; the wall owns
    // this scene, pure typography on an empty field.
    const sp = stage.placementOf('showpiece');
    const s = stage.state;
    gsap
      .timeline({
        scrollTrigger: { trigger: section, start: 'top bottom', end: 'top top', scrub: 1 },
      })
      .to(s, {
        camX: sp.x,
        camY: sp.y + sp.height * 1.4,
        offsetX: 0,
        offsetY: 0,
        zoom: 0.5,
        theta: 0,
        phi: 0,
        ease: 'none',
      });

    if (desktop) {
      section.classList.add('is-hijack');
      const thread = document.createElement('div');
      thread.className = 'wall-thread';
      wrap.append(thread);

      const distance = (): number => wall.scrollWidth - stage.viewport().w;
      gsap.set(thread, { scaleX: 0 });
      gsap
        .timeline({
          scrollTrigger: {
            trigger: section,
            start: 'top top',
            end: () => `+=${Math.max(distance(), 600)}`,
            pin: true,
            scrub: 1,
            invalidateOnRefresh: true,
          },
        })
        .to(wall, { x: () => -distance(), ease: 'none' }, 0)
        .to(thread, { scaleX: 1, ease: 'none' }, 0);
    } else {
      gsap.from(wall.children, {
        autoAlpha: 0,
        y: 26,
        stagger: 0.05,
        scrollTrigger: { trigger: wrap, start: 'top 80%', once: true },
      });
    }
  }, section);

  headline = riseOnEnter(h2, { trigger: section, start: desktop ? 'top 55%' : 'top 78%' });

  return {
    destroy() {
      headline?.revert();
      gctx.revert();
      section.classList.remove('is-hijack');
      section.querySelector('.wall-thread')?.remove();
    },
  };
}
