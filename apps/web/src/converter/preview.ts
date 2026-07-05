/**
 * Static single-frame preview of a parsed design in its real thread
 * colors. Owns a private Canvas2DStage that is never start()ed: no
 * ticker, no animation, one warmFrame() per (re)paint. The stage's own
 * resize handler reassigns the canvas bitmap (clearing it) with no ticker
 * to repaint, so every container/window resize must re-render here.
 */
import { Canvas2DStage } from '../stage/canvas2d-stage';
import type { StitchData } from '../stitch/runs';

/** Same breathing room the stitch-out finish move uses. */
const FIT_MARGIN = 0.86;

export class StaticPreview {
  private stage: Canvas2DStage | null = null;
  private container: HTMLElement | null = null;
  private ro: ResizeObserver | null = null;
  private raf = 0;
  private onWinResize = (): void => this.schedule();

  /** Container must be visible and sized (CSS aspect-ratio) before mount. */
  mount(container: HTMLElement, data: StitchData): void {
    this.dispose();
    this.container = container;
    this.stage = new Canvas2DStage(container);
    this.stage.setOverlayPattern(data);
    this.render();
    this.ro = new ResizeObserver(() => this.schedule());
    this.ro.observe(container);
    window.addEventListener('resize', this.onWinResize);
  }

  private schedule(): void {
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(() => this.render());
  }

  private render(): void {
    const stage = this.stage;
    const box = this.container;
    if (stage === null || box === null) return;
    const w = box.clientWidth;
    const h = box.clientHeight;
    if (w <= 0 || h <= 0) return;
    stage.refit();
    const p = stage.placementOf('overlay');
    if (p.width <= 0 || p.height <= 0) return;
    const zoom = Math.min((w * FIT_MARGIN) / p.width, (h * FIT_MARGIN) / p.height);
    Object.assign(stage.state, {
      progO: 1,
      zoom,
      camX: p.x,
      camY: p.y,
      offsetX: 0,
      offsetY: 0,
    });
    stage.warmFrame();
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    this.ro = null;
    window.removeEventListener('resize', this.onWinResize);
    this.stage?.dispose();
    this.stage = null;
    this.container = null;
  }
}
