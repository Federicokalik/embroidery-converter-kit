/**
 * 2D canvas stitch renderer: the universal fallback (mobile, WebGL
 * failure, context loss) and the base renderer until the WebGL stage
 * lazy-loads. Draws the same runs the 3D stage draws, as polylines with
 * round caps in the real thread colors; progress = segments stroked.
 *
 * Rendering is on-demand: a gsap.ticker callback lerps the rendered
 * state toward `state` (this replaces ScrollSmoother inertia for the
 * thread layer) and skips the frame when nothing moved.
 */
import { gsap } from '../core/gsap';
import { pointAtSegment, visibleThreadColor } from '../stitch/runs';
import type { StitchData } from '../stitch/runs';
import { layoutCast, layoutOverlay } from './layout';
import type { PlacedEntityData } from './layout';
import { defaultState } from './types';
import type {
  CastData,
  EntityId,
  LetterPlacement,
  StitchListener,
  StitchStage,
  ThreadState,
} from './types';

/** Thread width in world units (1 unit = 0.1 mm). */
const THREAD_WIDTH = 2.5;

/** Lerp stiffness: fraction of remaining distance covered per 60fps frame. */
const LERP = 0.14;

const EPS = 1e-3;

interface ColoredEntity {
  data: PlacedEntityData;
  /** Per-run CSS colors (real threads, luminance-capped for paper). */
  colors: string[];
}

function colorize(data: PlacedEntityData, ink: string): ColoredEntity {
  return {
    data,
    colors: data.runs.map((r) => {
      const rgb = data.threads[r.threadIndex];
      if (rgb === undefined) return ink;
      return `#${visibleThreadColor(rgb).toString(16).padStart(6, '0')}`;
    }),
  };
}

export class Canvas2DStage implements StitchStage {
  readonly kind = '2d' as const;
  readonly state: ThreadState = defaultState();

  private rendered: ThreadState = defaultState();
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private entities = new Map<EntityId, ColoredEntity>();
  private overlay: ColoredEntity | null = null;
  private listeners: StitchListener[] = [];
  private lastSegments = new Map<EntityId, number>();
  private dirty = true;
  private running = false;
  private dpr = Math.min(window.devicePixelRatio || 1, 2);
  private ink: string;
  private paper: string;
  private tick = (): void => this.onTick();
  private onResize = (): void => {
    this.fit();
    this.dirty = true;
  };

  constructor(private container: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.container.replaceChildren(this.canvas);
    const ctx = this.canvas.getContext('2d');
    if (ctx === null) throw new Error('2d context unavailable');
    this.ctx = ctx;
    const css = getComputedStyle(document.body);
    this.ink = css.getPropertyValue('--ink').trim() || '#141414';
    this.paper = css.getPropertyValue('--paper').trim() || '#f4f4f2';
    this.fit();
    window.addEventListener('resize', this.onResize);
  }

  setCast(cast: CastData): void {
    for (const data of layoutCast(cast)) {
      this.entities.set(data.id, colorize(data, this.ink));
    }
    this.dirty = true;
  }

  setOverlayPattern(data: StitchData | null): void {
    this.overlay = data === null ? null : colorize(layoutOverlay(data), this.ink);
    this.dirty = true;
  }

  overlayPointAt(progress: number): { x: number; y: number } {
    if (this.overlay === null) return { x: 0, y: 0 };
    const { data } = this.overlay;
    const seg = Math.round(gsap.utils.clamp(0, 1, progress) * data.segments) - 1;
    const [x, y] = pointAtSegment(data.runs, Math.max(0, seg));
    return { x: x + data.dx, y: y + data.dy };
  }

  placementOf(id: EntityId): LetterPlacement {
    if (id === 'overlay') {
      if (this.overlay === null) throw new Error('overlay not set');
      return this.overlay.data.placement;
    }
    const found = this.entities.get(id);
    if (found === undefined) throw new Error(`entity ${id} not loaded`);
    return found.data.placement;
  }

  viewport(): { w: number; h: number } {
    return { w: this.container.clientWidth, h: this.container.clientHeight };
  }

  requestRender(): void {
    this.dirty = true;
  }

  refit(): void {
    this.fit();
    this.dirty = true;
  }

  warmFrame(): void {
    Object.assign(this.rendered, this.state);
    this.render();
    this.dirty = false;
  }

  onStitch(cb: StitchListener): void {
    this.listeners.push(cb);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    gsap.ticker.add(this.tick);
  }

  stop(): void {
    this.running = false;
    gsap.ticker.remove(this.tick);
  }

  dispose(): void {
    this.stop();
    window.removeEventListener('resize', this.onResize);
    this.container.replaceChildren();
  }

  private fit(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.container.clientWidth * this.dpr);
    this.canvas.height = Math.round(this.container.clientHeight * this.dpr);
  }

  private onTick(): void {
    // Frame-rate independent lerp toward the GSAP-written target state.
    const dt = gsap.ticker.deltaRatio(60);
    const k = 1 - Math.pow(1 - LERP, dt);
    let moved = false;
    for (const key of Object.keys(this.rendered) as Array<keyof ThreadState>) {
      const target = this.state[key];
      const current = this.rendered[key];
      if (Math.abs(target - current) < EPS) {
        if (current !== target) this.rendered[key] = target;
        continue;
      }
      this.rendered[key] = current + (target - current) * k;
      moved = true;
    }
    if (moved || this.dirty) {
      this.render();
      this.dirty = false;
    }
  }

  private progressOf(id: EntityId): number {
    if (id === 'lobster') return this.rendered.progLob;
    if (id === 'octopus') return this.rendered.progOct;
    if (id === 'overlay') return this.rendered.progO;
    return this.rendered.progS;
  }

  private render(): void {
    const { ctx, dpr } = this;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = this.paper;
    ctx.fillRect(0, 0, w, h);

    const s = this.rendered;
    const focusX = w / 2 + s.offsetX * w;
    const focusY = h / 2 + s.offsetY * h;
    ctx.setTransform(
      s.zoom * dpr,
      0,
      0,
      s.zoom * dpr,
      focusX - s.camX * s.zoom * dpr,
      focusY - s.camY * s.zoom * dpr,
    );
    ctx.lineWidth = THREAD_WIDTH;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Stitch-out mode: only the user's design.
    if (this.overlay !== null) {
      this.drawEntity(this.overlay);
      return;
    }

    // Cull: skip entities whose placement is far outside the view.
    const viewW = w / (s.zoom * dpr);
    const viewH = h / (s.zoom * dpr);
    for (const entity of this.entities.values()) {
      const p = entity.data.placement;
      if (
        p.x + p.width / 2 < s.camX - viewW ||
        p.x - p.width / 2 > s.camX + viewW ||
        p.y + p.height / 2 < s.camY - viewH ||
        p.y - p.height / 2 > s.camY + viewH
      ) {
        continue;
      }
      this.drawEntity(entity);
    }
  }

  /** One stroke per run so each keeps its own thread color. */
  private drawEntity(entity: ColoredEntity): void {
    const { data, colors } = entity;
    const budget = Math.round(this.progressOf(data.id) * data.segments);
    if (budget <= 0) {
      this.notify(data.id, 0);
      return;
    }
    let drawn = 0;
    for (let r = 0; r < data.runs.length && drawn < budget; r++) {
      const run = data.runs[r]!;
      this.ctx.strokeStyle = colors[r]!;
      this.ctx.beginPath();
      this.ctx.moveTo(run.points[0]![0] + data.dx, run.points[0]![1] + data.dy);
      for (let i = 1; i < run.points.length && drawn < budget; i++) {
        const pt = run.points[i]!;
        this.ctx.lineTo(pt[0] + data.dx, pt[1] + data.dy);
        drawn++;
      }
      this.ctx.stroke();
    }
    this.notify(data.id, drawn);
  }

  private notify(id: EntityId, segments: number): void {
    if (this.lastSegments.get(id) === segments) return;
    this.lastSegments.set(id, segments);
    for (const cb of this.listeners) cb(id, segments);
  }
}
