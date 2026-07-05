/**
 * S2 Babel (pinned, scrub). The camera dollies across three real
 * designs, each living in a different machine dialect: the lobster
 * (.pes Brother) stitches in, the unicorn (.jef Janome) is framed
 * already sewn from the hero, the octopus (.dst Tajima, converted by
 * our own CLI) stitches in last. Exit: the lobster unravels, feeding
 * the translation scene.
 */
import { gsap, reduceMotion } from '../core/gsap';
import { fitZoom } from './context';
import type { SceneContext, SceneHandle } from './context';
import { riseOnEnter } from './headline';
import type { HeadlineHandle } from './headline';

export function babel(ctx: SceneContext): SceneHandle {
  const { stage, desktop } = ctx;
  const section = document.getElementById('babel')!;
  const h2 = section.querySelector<HTMLElement>('h2')!;
  const captions = Array.from(section.querySelectorAll<HTMLElement>('.babel-stations li'));

  let headline: HeadlineHandle | null = null;
  const gctx = gsap.context(() => {
    if (reduceMotion) return;

    const lob = stage.placementOf('lobster');
    const sp = stage.placementOf('showpiece');
    const oct = stage.placementOf('octopus');
    const s = stage.state;
    // Each station framed to a comparable size, whatever the design.
    const zoomLob = fitZoom(stage, lob, 0.46, 0.52);
    const zoomSp = fitZoom(stage, sp, 0.46, 0.52);
    const zoomOct = fitZoom(stage, oct, 0.46, 0.52);
    const offY = desktop ? 0.22 : 0.3;

    // Approach: travel from the hero frame to the first station.
    gsap
      .timeline({
        scrollTrigger: {
          trigger: section,
          start: 'top bottom',
          end: 'top top',
          scrub: 1,
        },
      })
      .to(s, {
        camX: lob.x,
        camY: lob.y,
        offsetX: 0,
        offsetY: offY,
        zoom: zoomLob,
        theta: 0.16,
        phi: 0.06,
        ease: 'none',
      });

    if (desktop) {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: '+=250%',
          pin: true,
          scrub: 1,
        },
      });
      tl.set(captions, { opacity: 0.25 })
        // Station 1: the lobster stitches in.
        .to(s, { progLob: 1, duration: 0.24, ease: 'none' }, 0)
        .to(captions[0]!, { opacity: 1, duration: 0.06 }, 0)
        // Station 2: the unicorn, already sewn, gets its frame.
        .to(s, { camX: sp.x, zoom: zoomSp, duration: 0.14, ease: 'power1.inOut' }, 0.26)
        .to(s, { theta: -0.12, duration: 0.2, ease: 'none' }, 0.32)
        .to(captions[0]!, { opacity: 0.25, duration: 0.06 }, 0.36)
        .to(captions[1]!, { opacity: 1, duration: 0.06 }, 0.36)
        // Station 3: the octopus stitches in.
        .to(s, { camX: oct.x, zoom: zoomOct, duration: 0.14, ease: 'power1.inOut' }, 0.52)
        .to(s, { progOct: 1, duration: 0.26, ease: 'none' }, 0.6)
        .to(captions[1]!, { opacity: 0.25, duration: 0.06 }, 0.62)
        .to(captions[2]!, { opacity: 1, duration: 0.06 }, 0.62)
        // Pull wide. Everything stays sewn: designs stitch exactly once.
        // The timeline goes silent after 0.84 so the next scene's
        // approach (which overlaps the pin tail) is the only writer.
        .to(s, { camX: sp.x, zoom: zoomSp * 0.42, duration: 0.12, ease: 'power1.inOut' }, 0.72)
        .to(captions, { opacity: 0.7, duration: 0.06 }, 0.72)
        .to({}, { duration: 0.16 }, 0.84);
    } else {
      // Mobile: no pin; the designs stitch in as the section scrolls by.
      gsap
        .timeline({
          scrollTrigger: {
            trigger: section,
            start: 'top 60%',
            end: 'bottom 80%',
            scrub: 1,
          },
        })
        .to(s, { zoom: zoomSp * 0.4, camX: sp.x, ease: 'none' }, 0)
        .to(s, { progLob: 1, duration: 0.45, ease: 'none' }, 0)
        .to(s, { progOct: 1, duration: 0.45, ease: 'none' }, 0.45);
      gsap.from(captions, {
        autoAlpha: 0,
        y: 18,
        stagger: 0.12,
        scrollTrigger: { trigger: section, start: 'top 65%', once: true },
      });
    }
  }, section);

  headline = riseOnEnter(h2, { trigger: section, start: desktop ? 'top 55%' : 'top 78%' });

  return {
    destroy() {
      headline?.revert();
      gctx.revert();
    },
  };
}
