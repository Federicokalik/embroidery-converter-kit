// One-time "what's new" notice (landing + /convert pages). Opens the
// #whats-new <dialog> shortly after load unless already dismissed
// (localStorage). The desktop app never sees this modal twice over: its
// shell maps the root route onto /convert (the landing is unreachable)
// and the Electron user agent is skipped here as a belt-and-braces guard —
// it already has its own update dialog.

const KEY = 'ricuci-whatsnew-2026-09-trim-edit';

function isSeen(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

function markSeen(): void {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    // storage unavailable: this view only
  }
}

export function initWhatsNew(delayMs = 2600): void {
  if (/Electron/i.test(navigator.userAgent)) return;
  const dialog = document.getElementById('whats-new') as HTMLDialogElement | null;
  if (dialog === null || isSeen()) return;

  const openTimer = window.setTimeout(() => {
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }, delayMs);

  // Any dismissal path — CTA, "later", Escape — marks it seen once.
  dialog.addEventListener('close', () => {
    window.clearTimeout(openTimer);
    markSeen();
  });
  for (const el of dialog.querySelectorAll('[data-whatsnew-close]')) {
    el.addEventListener('click', () => dialog.close());
  }
}
