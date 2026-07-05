/**
 * S1 Hero. The showpiece sews itself in (time-based, ~3.2s) while the
 * headline rises. Camera parks the design in the free column. Plays
 * once per page load; on rebuilds (language switch) it snaps to the
 * finished pose instead of replaying.
 */
import { gsap, ScrollTrigger, reduceMotion } from '../core/gsap';
import { fitZoom } from './context';
import type { SceneContext, SceneHandle } from './context';
import { rise } from './headline';
import type { HeadlineHandle } from './headline';

let played = false;

export function heroPose(ctx: SceneContext): void {
  const { stage, desktop } = ctx;
  const sp = stage.placementOf('showpiece');
  const s = stage.state;
  s.camX = sp.x;
  s.camY = sp.y;
  s.offsetX = desktop ? 0.27 : 0;
  s.offsetY = desktop ? 0 : 0.3;
  s.zoom = desktop ? fitZoom(stage, sp, 0.24, 0.72) : fitZoom(stage, sp, 0.55, 0.42);
  stage.requestRender();
}

export function hero(ctx: SceneContext): SceneHandle {
  const section = document.getElementById('hero')!;
  const h1 = section.querySelector<HTMLElement>('h1')!;
  const tech = section.querySelector<HTMLElement>('.hero-tech')!;
  const ctas = section.querySelector<HTMLElement>('.hero-ctas')!;

  let headline: HeadlineHandle | null = null;
  let entrance: gsap.core.Timeline | null = null;
  let idle: gsap.core.Tween | null = null;
  let idleGate: ScrollTrigger | null = null;
  let cancelled = false;

  // Only pose the camera from here when the user is still at the top;
  // deeper down, the scroll-scrubbed approaches own the camera.
  const atTop = window.scrollY < window.innerHeight * 0.5;
  if (atTop) heroPose(ctx);

  if (played || reduceMotion) {
    ctx.stage.state.progS = 1;
    ctx.stage.requestRender();
  } else {
    // Hide the entrance cast NOW, while the preloader still covers the
    // page: creating these states only after the wipe flashes raw text.
    gsap.set(h1, { autoAlpha: 0 });
    gsap.set([tech, ctas], { autoAlpha: 0, y: 24 });
    void ctx.revealed.then(() => {
      if (cancelled) return;
      played = true;
      headline = rise(h1, { delay: 0.1 });
      gsap.set(h1, { autoAlpha: 1 }); // SplitText owns the words from here
      entrance = gsap
        .timeline()
        .to(ctx.stage.state, { progS: 1, duration: 3.2, ease: 'power1.inOut' }, 0)
        .to(tech, { autoAlpha: 1, y: 0, duration: 0.7 }, 0.7)
        .to(ctas, { autoAlpha: 1, y: 0, duration: 0.7 }, 0.85);

      // 3D flavor: a slow idle orbit while the user reads the hero.
      // Paused as soon as the story leaves; the scrubs own theta after.
      if (ctx.stage.kind === '3d') {
        gsap.set(ctx.stage.state, { theta: -0.09 });
        idle = gsap.to(ctx.stage.state, {
          theta: 0.09,
          duration: 7,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1,
        });
        idleGate = ScrollTrigger.create({
          trigger: '#babel',
          start: 'top bottom',
          onEnter: () => idle?.pause(),
          onLeaveBack: () => idle?.resume(),
        });
      }
    });
  }

  return {
    destroy() {
      cancelled = true;
      headline?.revert();
      idle?.kill();
      idleGate?.kill();
      if (entrance !== null) {
        // Never leave the hero half-sewn on rebuild.
        entrance.progress(1).kill();
      } else if (!played && !reduceMotion) {
        // Destroyed before the reveal: undo the pre-hidden states.
        gsap.set([h1, tech, ctas], { clearProps: 'opacity,visibility,transform' });
      }
    },
  };
}
