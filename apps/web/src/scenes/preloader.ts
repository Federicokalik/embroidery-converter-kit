/**
 * Preloader UI: the % counter chases real load progress (monotonic),
 * the pink line draws with it and the wordmark is revealed by the same
 * value. Exit: snap to 100, then the whole overlay wipes upward.
 */
import { gsap, reduceMotion } from '../core/gsap';

const MIN_DISPLAY_MS = 1400;

export interface Preloader {
  setProgress(p: number): void;
  /** Wait out the minimum display time, play the exit, hide the overlay. */
  finish(): Promise<void>;
}

export function createPreloader(): Preloader {
  const root = document.getElementById('preloader')!;
  const word = root.querySelector<HTMLElement>('.preloader-word')!;
  const path = document.getElementById('preloader-path')!;
  const pct = document.getElementById('preloader-pct')!;
  const t0 = performance.now();

  const proxy = { v: 0 };
  let shown = 0;

  const apply = (): void => {
    const v = gsap.utils.clamp(0, 1, proxy.v);
    pct.textContent = String(Math.round(v * 100)).padStart(3, '0');
    gsap.set(path, { drawSVG: `${v * 100}%` });
    word.style.clipPath = `inset(0 ${(1 - v) * 100}% 0 0)`;
  };

  gsap.set(path, { drawSVG: '0%' });
  apply();
  const chase = gsap.quickTo(proxy, 'v', {
    duration: 0.4,
    ease: 'power1.out',
    onUpdate: apply,
  });

  return {
    setProgress(p: number): void {
      shown = Math.max(shown, p); // never runs backwards
      if (reduceMotion) {
        proxy.v = shown;
        apply();
      } else {
        chase(shown);
      }
    },

    async finish(): Promise<void> {
      if (reduceMotion) {
        proxy.v = 1;
        apply();
        root.hidden = true;
        return;
      }
      const wait = Math.max(0, MIN_DISPLAY_MS - (performance.now() - t0));
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      await new Promise<void>((resolve) => {
        gsap
          .timeline({
            onComplete: () => {
              root.hidden = true;
              resolve();
            },
          })
          .to(proxy, { v: 1, duration: 0.3, ease: 'power1.in', onUpdate: apply })
          .to(pct, { autoAlpha: 0, duration: 0.25 }, '+=0.1')
          .to(root, { clipPath: 'inset(0 0 100% 0)', duration: 0.7, ease: 'power3.inOut' }, '<');
      });
    },
  };
}
