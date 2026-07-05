// Lean entry for /convert: i18n + converter only. No gsap plugins, no
// three, no scenes, no preloader. Styles ship from convert.astro's head.
import { applyI18n, t } from './i18n/i18n';
import { initLangSwitch } from './i18n/lang-switch';
import { initConverter } from './converter/converter';
import { initSponsor } from './sponsor';

/** Flag the visitor's desktop OS and wire the CLI "copy" button. */
function initDownloads(): void {
  const ua = navigator.userAgent;
  const os = /Windows/i.test(ua)
    ? 'windows'
    : /Mac/i.test(ua)
      ? 'macos'
      : /Linux/i.test(ua) && !/Android/i.test(ua)
        ? 'linux'
        : null;
  if (os !== null) {
    const card = document.querySelector<HTMLElement>(`.dl-card[data-os="${os}"]`);
    card?.classList.add('is-recommended');
    card?.querySelector('.dl-you')?.removeAttribute('hidden');
  }

  const btn = document.querySelector<HTMLButtonElement>('.dl-copy');
  if (btn !== null && navigator.clipboard) {
    let reset: ReturnType<typeof setTimeout> | undefined;
    btn.addEventListener('click', () => {
      void navigator.clipboard.writeText(btn.dataset['copy'] ?? '').then(() => {
        btn.textContent = t('dl.copied');
        btn.classList.add('is-copied');
        clearTimeout(reset);
        reset = setTimeout(() => {
          btn.textContent = t('dl.copy');
          btn.classList.remove('is-copied');
        }, 1600);
      });
    });
  }
}

applyI18n();
initLangSwitch();
initDownloads();
initSponsor();
initConverter({ mode: 'studio' });
