/**
 * S3 Translation (pinned, scrub). The finished lobster is read back
 * punto per punto: a mono column streams its REAL coordinates, rows
 * lighting up in stitch order while the camera slowly pushes in.
 * Renderer and data are the same truth; that is the whole point.
 * (The design is NOT re-stitched: everything sews exactly once.)
 */
import { gsap, reduceMotion } from '../core/gsap';
import { fitZoom } from './context';
import type { SceneContext, SceneHandle } from './context';
import { riseOnEnter } from './headline';
import type { HeadlineHandle } from './headline';

/** Rows shown in the stream. */
const ROWS = 48;

export function translation(ctx: SceneContext): SceneHandle {
  const { stage, cast, desktop } = ctx;
  const section = document.getElementById('translation')!;
  const h2 = section.querySelector<HTMLElement>('h2')!;
  const stream = document.getElementById('coord-stream')!;

  // Real coordinates from the lobster, evenly sampled.
  const points = cast.lobster.runs.flatMap((r) => r.points);
  const step = Math.max(1, Math.floor(points.length / ROWS));
  const rows: HTMLElement[] = [];
  stream.replaceChildren(
    ...Array.from({ length: Math.min(ROWS, points.length) }, (_, i) => {
      const [x, y] = points[i * step]!;
      const div = document.createElement('div');
      div.className = 'row';
      div.innerHTML = `<span>${String(i * step).padStart(4, '0')}</span><span>${x},${y}</span>`;
      rows.push(div);
      return div;
    }),
  );

  let headline: HeadlineHandle | null = null;
  const gctx = gsap.context(() => {
    if (reduceMotion) {
      for (const r of rows) r.classList.add('sewn');
      return;
    }

    const lob = stage.placementOf('lobster');
    const s = stage.state;
    // Large enough to be the clear subject; the neighbors fall out of
    // frame at this zoom.
    const zoom = desktop ? fitZoom(stage, lob, 0.36, 0.72) : fitZoom(stage, lob, 0.5, 0.3);

    // Approach: settle on the finished lobster, parked between the
    // headline (left) and the coordinate stream (right).
    gsap
      .timeline({
        scrollTrigger: { trigger: section, start: 'top bottom', end: 'top top', scrub: 1 },
      })
      .to(s, {
        camX: lob.x,
        camY: lob.y,
        offsetX: desktop ? 0.06 : 0,
        offsetY: desktop ? 0.04 : 0.3,
        zoom,
        theta: -0.12,
        phi: 0.05,
        ease: 'none',
      });

    const sync = { row: 0 };
    const apply = (): void => {
      const n = Math.round(sync.row);
      rows.forEach((r, i) => r.classList.toggle('sewn', i <= n));
      gsap.set(stream, { yPercent: -(n / rows.length) * 55 });
    };

    const tl = gsap.timeline({
      scrollTrigger: desktop
        ? { trigger: section, start: 'top top', end: '+=200%', pin: true, scrub: 1 }
        : { trigger: section, start: 'top 55%', end: 'bottom 85%', scrub: 1 },
    });
    // Reading, not re-sewing: rows light in stitch order, the camera
    // pushes in gently. Zoom stops writing at 0.8 so the next scene's
    // overlapping approach takes the camera over cleanly.
    tl.to(sync, { row: rows.length - 1, duration: 1, ease: 'none', onUpdate: apply }, 0).to(
      s,
      { zoom: zoom * 1.22, duration: 0.8, ease: 'none' },
      0,
    );
  }, section);

  headline = riseOnEnter(h2, { trigger: section, start: desktop ? 'top 55%' : 'top 78%' });

  return {
    destroy() {
      headline?.revert();
      gctx.revert();
      stream.replaceChildren();
    },
  };
}
