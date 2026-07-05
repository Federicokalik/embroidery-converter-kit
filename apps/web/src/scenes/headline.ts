/**
 * Kinetic manifesto headlines: masked line-splits with word (or char)
 * rise. autoSplit + onSplit make font-load and resize re-splits safe;
 * scenes revert the split before i18n swaps the text.
 */
import { gsap, SplitText, reduceMotion } from '../core/gsap';

export interface HeadlineHandle {
  revert(): void;
}

const NOOP: HeadlineHandle = { revert: () => undefined };

interface RiseOptions {
  chars?: boolean;
  delay?: number;
}

/** Time-based entrance (hero, post-preloader). */
export function rise(el: HTMLElement, opts: RiseOptions = {}): HeadlineHandle {
  if (reduceMotion) return NOOP;
  const split = SplitText.create(el, {
    type: opts.chars === true ? 'lines,chars' : 'lines,words',
    mask: 'lines',
    autoSplit: true,
    onSplit: (self) =>
      gsap.from(opts.chars === true ? self.chars : self.words, {
        yPercent: 115,
        duration: 0.9,
        stagger: opts.chars === true ? 0.02 : 0.06,
        ease: 'power3.out',
        delay: opts.delay ?? 0,
      }),
  });
  return { revert: () => split.revert() };
}

interface RiseOnEnterOptions extends RiseOptions {
  trigger?: Element;
  start?: string;
  /** Accent-color marker bars behind each line (readable over any render). */
  highlight?: boolean;
}

/** Scroll-armed entrance, plays once when the section comes in. */
export function riseOnEnter(el: HTMLElement, opts: RiseOnEnterOptions = {}): HeadlineHandle {
  if (reduceMotion) return NOOP;
  const split = SplitText.create(el, {
    type: opts.chars === true ? 'lines,chars' : 'lines,words',
    mask: 'lines',
    autoSplit: true,
    ...(opts.highlight === true ? { linesClass: 'hl-line' } : {}),
    onSplit: (self) =>
      gsap.from(opts.chars === true ? self.chars : self.words, {
        yPercent: 115,
        duration: 0.9,
        stagger: opts.chars === true ? 0.02 : 0.06,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: opts.trigger ?? el,
          start: opts.start ?? 'top 78%',
          once: true,
        },
      }),
  });
  return { revert: () => split.revert() };
}
