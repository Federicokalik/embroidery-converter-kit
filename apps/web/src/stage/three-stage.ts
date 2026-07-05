/**
 * WebGL stitch renderer (lazy chunk, capable desktops only).
 *
 * Every stitch segment is one instance of a small 6-sided cylinder laid
 * along the real needle path: straight thread between penetrations, no
 * curve smoothing, so satin zigzag reads as actual stitching. Instances
 * carry their real thread color (luminance-capped for paper). Progress
 * is O(1): InstancedMesh.count. Later stitches sit a hair higher in z,
 * so crossings read over-under at macro zoom, like thread on fabric.
 *
 * Camera semantics match the 2D stage exactly (zoom = CSS px per world
 * unit, offset = viewport fractions) so scenes are renderer-agnostic;
 * theta/phi add the orbit only this stage can do. World y (down) is
 * negated once here for three.js's y-up space.
 */
import {
  Color,
  CylinderGeometry,
  DirectionalLight,
  Fog,
  HemisphereLight,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
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

/** Thread radius in world units (1 unit = 0.1 mm). */
const THREAD_RADIUS = 1.25;

const FOV = 40;
const LERP = 0.14;
const EPS = 1e-3;

/** Frames above budget before the pixel ratio is throttled. */
const SLOW_FRAMES = 30;
const FRAME_BUDGET_MS = 20;

interface Entity3D {
  data: PlacedEntityData;
  mesh: InstancedMesh;
}

export class ThreeStitchStage implements StitchStage {
  readonly kind = '3d' as const;
  readonly state: ThreadState = defaultState();

  private rendered: ThreadState = defaultState();
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera: PerspectiveCamera;
  private material: MeshStandardMaterial;
  private geometry: CylinderGeometry;
  private fog: Fog;
  private ink: number;
  private entities = new Map<EntityId, Entity3D>();
  private overlay: Entity3D | null = null;
  private listeners: StitchListener[] = [];
  private lastSegments = new Map<EntityId, number>();
  private dirty = true;
  private running = false;
  private slowFrames = 0;
  private throttled = false;
  private tick = (): void => this.onTick();
  private onResize = (): void => {
    this.fit();
    this.dirty = true;
  };

  constructor(
    private container: HTMLElement,
    onContextLost?: () => void,
  ) {
    const css = getComputedStyle(document.body);
    const paper = css.getPropertyValue('--paper').trim() || '#f4f4f2';
    this.ink = parseInt((css.getPropertyValue('--ink').trim() || '#141414').slice(1), 16);

    this.renderer = new WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setClearColor(paper);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.container.replaceChildren(this.renderer.domElement);

    this.camera = new PerspectiveCamera(FOV, 1, 10, 1e6);
    this.fog = new Fog(paper, 1e5, 1e6);
    this.scene.fog = this.fog;

    const hemi = new HemisphereLight(0xffffff, 0xdedbd3, 1.15);
    const dir = new DirectionalLight(0xffffff, 1.35);
    dir.position.set(0.35, 0.8, 1).normalize();
    this.scene.add(hemi, dir);

    this.geometry = new CylinderGeometry(THREAD_RADIUS, THREAD_RADIUS, 1, 6, 1);
    // Per-instance colors; white base = no tint.
    this.material = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.38, metalness: 0 });

    this.renderer.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      onContextLost?.();
    });

    this.fit();
    window.addEventListener('resize', this.onResize);
  }

  setCast(cast: CastData): void {
    for (const data of layoutCast(cast)) {
      const old = this.entities.get(data.id);
      if (old !== undefined) {
        this.scene.remove(old.mesh);
        old.mesh.dispose();
      }
      const mesh = this.buildMesh(data);
      this.scene.add(mesh);
      this.entities.set(data.id, { data, mesh });
    }
    this.dirty = true;
  }

  setOverlayPattern(data: StitchData | null): void {
    if (this.overlay !== null) {
      this.scene.remove(this.overlay.mesh);
      this.overlay.mesh.dispose();
      this.overlay = null;
    }
    if (data !== null) {
      const placed = layoutOverlay(data);
      const mesh = this.buildMesh(placed);
      this.scene.add(mesh);
      this.overlay = { data: placed, mesh };
    }
    for (const e of this.entities.values()) e.mesh.visible = data === null;
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
    for (const e of this.entities.values()) e.mesh.dispose();
    this.overlay?.mesh.dispose();
    this.geometry.dispose();
    this.material.dispose();
    this.renderer.dispose();
    this.container.replaceChildren();
  }

  /** One instance per segment, laid along the real needle path. */
  private buildMesh(data: PlacedEntityData): InstancedMesh {
    const mesh = new InstancedMesh(this.geometry, this.material, data.segments);
    mesh.frustumCulled = false;

    const dummy = new Object3D();
    const up = new Vector3(0, 1, 0);
    const dirV = new Vector3();
    const color = new Color();
    let i = 0;
    for (const run of data.runs) {
      const rgb = data.threads[run.threadIndex];
      color.set(visibleThreadColor(rgb === undefined ? this.ink : rgb));
      for (let p = 1; p < run.points.length; p++) {
        const [x1, y1] = run.points[p - 1]!;
        const [x2, y2] = run.points[p]!;
        // World y grows down; three y grows up.
        const ax = x1 + data.dx;
        const ay = -(y1 + data.dy);
        const bx = x2 + data.dx;
        const by = -(y2 + data.dy);
        dirV.set(bx - ax, by - ay, 0);
        const len = Math.max(dirV.length(), 0.5);
        dirV.normalize();
        dummy.position.set((ax + bx) / 2, (ay + by) / 2, (i / data.segments) * 2 + (i % 3) * 0.4);
        dummy.quaternion.setFromUnitVectors(up, dirV);
        const jitter = 0.92 + (((i * 2654435761) % 100) / 100) * 0.16;
        dummy.scale.set(jitter, len, jitter);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        mesh.setColorAt(i, color);
        i++;
      }
    }
    mesh.count = 0;
    return mesh;
  }

  private fit(): void {
    const { w, h } = this.viewport();
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(h, 1);
    this.camera.updateProjectionMatrix();
  }

  private onTick(): void {
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
    if (!moved && !this.dirty) return;

    const t0 = performance.now();
    this.render();
    this.dirty = false;

    // Sustained slow frames: drop the pixel ratio once, permanently.
    if (!this.throttled) {
      if (performance.now() - t0 > FRAME_BUDGET_MS) {
        if (++this.slowFrames >= SLOW_FRAMES) {
          this.throttled = true;
          this.renderer.setPixelRatio(1.25);
          this.fit();
        }
      } else if (this.slowFrames > 0) {
        this.slowFrames--;
      }
    }
  }

  private progressOf(id: EntityId): number {
    if (id === 'lobster') return this.rendered.progLob;
    if (id === 'octopus') return this.rendered.progOct;
    if (id === 'overlay') return this.rendered.progO;
    return this.rendered.progS;
  }

  private render(): void {
    const s = this.rendered;
    const { w, h } = this.viewport();
    const visH = h / s.zoom;
    const visW = w / s.zoom;
    const dist = visH / 2 / Math.tan((FOV * Math.PI) / 360);

    // Focus target such that (camX, camY) lands at center + offset.
    const tx = s.camX - s.offsetX * visW;
    const ty = -(s.camY - s.offsetY * visH);
    const sinT = Math.sin(s.theta);
    const cosT = Math.cos(s.theta);
    const sinP = Math.sin(s.phi);
    const cosP = Math.cos(s.phi);
    this.camera.position.set(
      tx + dist * sinT * cosP,
      ty + dist * sinP,
      dist * cosT * cosP,
    );
    this.camera.lookAt(tx, ty, 0);
    this.camera.near = Math.max(dist / 50, 1);
    this.camera.far = dist * 20;
    this.camera.updateProjectionMatrix();
    this.fog.near = dist * 2.5;
    this.fog.far = dist * 9;

    if (this.overlay !== null) {
      const count = Math.round(this.progressOf('overlay') * this.overlay.data.segments);
      if (count !== this.overlay.mesh.count) this.overlay.mesh.count = count;
      this.notify('overlay', count);
    } else {
      for (const { data, mesh } of this.entities.values()) {
        const count = Math.round(this.progressOf(data.id) * data.segments);
        if (count !== mesh.count) mesh.count = count;
        this.notify(data.id, count);
      }
    }
    this.renderer.render(this.scene, this.camera);
  }

  private notify(id: EntityId, segments: number): void {
    if (this.lastSegments.get(id) === segments) return;
    this.lastSegments.set(id, segments);
    for (const cb of this.listeners) cb(id, segments);
  }
}
