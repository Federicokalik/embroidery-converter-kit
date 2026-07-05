// Floating sponsor tab behavior, shared by every page. Reveals the tab
// unless dismissed, plays a one-time tease (pop open, then tuck back), and
// wires the close button (persisted in localStorage). Hover/focus expansion
// is pure CSS. Under prefers-reduced-motion the SVG foil is paused.

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

  root.hidden = false;

  // One-time tease: pop the panel open a moment after load, then tuck it
  // back to the mark (CSS :hover keeps it open if the visitor engages).
  const openTimer = window.setTimeout(() => root.classList.add('is-teasing'), 3800);
  const closeTimer = window.setTimeout(() => root.classList.remove('is-teasing'), 7400);

  const close = document.getElementById('sponsor-close');
  close?.addEventListener('click', (e) => {
    e.preventDefault();
    window.clearTimeout(openTimer);
    window.clearTimeout(closeTimer);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // storage unavailable: dismiss for this view only
    }
    root.classList.remove('is-teasing');
    root.classList.add('is-out');
    window.setTimeout(() => {
      root.hidden = true;
      root.classList.remove('is-out');
    }, 280);
  });

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    root.querySelector<SVGSVGElement>('.sponsor-reveal svg.cd-logo')?.pauseAnimations?.();
  }
}
