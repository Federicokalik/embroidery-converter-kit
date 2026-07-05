/**
 * SceneManager: owns the lifecycle of every scroll scene. Scenes are
 * pure functions of the DOM + viewport, so a language switch or a real
 * resize simply destroys and rebuilds them; scrubbed timelines re-derive
 * their progress from the scroll position, landing pixel-correct.
 */
import { ScrollTrigger, refreshScroll } from '../core/gsap';
import { onLangChange, onLangWillChange } from '../i18n/i18n';
import type { SceneContext, SceneFactory, SceneHandle } from './context';

export class SceneManager {
  private handles: SceneHandle[] = [];

  constructor(
    private factories: SceneFactory[],
    private ctx: SceneContext,
  ) {}

  init(): void {
    this.handles = this.factories.map((f) => f(this.ctx));
  }

  destroy(): void {
    for (const h of this.handles) h.destroy();
    this.handles = [];
  }

  rebuild(): void {
    this.destroy();
    this.init();
    refreshScroll();
  }

  /** Wire language switches and meaningful resizes to a full rebuild. */
  bindEnvironment(): void {
    onLangWillChange(() => this.destroy());
    onLangChange(() => {
      this.init();
      refreshScroll();
    });

    let lastW = window.innerWidth;
    let timer = 0;
    window.addEventListener('resize', () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        // Ignore mobile URL-bar height jitter; rebuild on real changes.
        if (Math.abs(window.innerWidth - lastW) < 60) return;
        lastW = window.innerWidth;
        this.rebuild();
      }, 250);
    });
    // Pins change layout: sections shift, so triggers must recompute
    // whenever fonts land late.
    void document.fonts.ready.then(() => ScrollTrigger.refresh());
  }
}
