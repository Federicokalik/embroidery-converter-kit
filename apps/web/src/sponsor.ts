// Floating sponsor badge behavior, shared by every page (landing, /convert,
// docs). Reveals the badge unless the visitor dismissed it, wires the close
// button (persisted in localStorage), and adds a pointer-driven tilt +
// specular sheen. Under prefers-reduced-motion it stays flat and pauses the
// SVG foil animation.

const DISMISS_KEY = 'ricuci-sponsor-dismissed';

function isDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

export function initSponsor(): void {
  const root = document.getElementById('sponsor');
  if (root === null) return;
  if (isDismissed()) return; // stays [hidden]

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  root.hidden = false;
  requestAnimationFrame(() => root.classList.add('is-in'));

  const card = document.getElementById('sponsor-card');
  const close = document.getElementById('sponsor-close');

  close?.addEventListener('click', (e) => {
    e.preventDefault();
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // storage unavailable: dismiss for this view only
    }
    root.classList.remove('is-in');
    root.classList.add('is-out');
    window.setTimeout(() => {
      root.hidden = true;
      root.classList.remove('is-out');
    }, 280);
  });

  if (reduced) {
    // Freeze the SVG foil shimmer.
    root.querySelector<SVGSVGElement>('svg.cd-logo')?.pauseAnimations?.();
    return;
  }

  // Pointer tilt + sheen: map the cursor over the card to a small 3D tilt
  // and move the highlight with it.
  if (card !== null) {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width; // 0..1
      const py = (e.clientY - r.top) / r.height; // 0..1
      root.style.setProperty('--tilt-y', `${(px - 0.5) * 10}deg`);
      root.style.setProperty('--tilt-x', `${(0.5 - py) * 10}deg`);
      root.style.setProperty('--sheen-x', `${px * 100}%`);
    });
    card.addEventListener('pointerleave', () => {
      root.style.setProperty('--tilt-x', '0deg');
      root.style.setProperty('--tilt-y', '0deg');
      root.style.setProperty('--sheen-x', '50%');
    });
  }
}
