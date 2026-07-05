/**
 * Language selector shared by every page. Renders as a <select> dropdown
 * so the 6 supported locales fit; the landing passes an onChange hook
 * (ScrollTrigger refresh), /convert passes none — this module must never
 * import gsap.
 */
import { currentLang, onLangChange, setLang, LANGS } from './i18n';
import type { Lang } from './i18n';

export function initLangSwitch(onChange?: () => void): void {
  if (typeof document === 'undefined') return;
  const sel = document.querySelector<HTMLSelectElement>('#lang-select');
  if (sel === null) return;

  // Populate once (a static <select> with no options is also fine: the
  // markup may already list the <option>s, in which case we skip filling).
  if (sel.options.length === 0) {
    for (const l of LANGS) {
      const opt = document.createElement('option');
      opt.value = l.code;
      opt.textContent = `${l.flag} ${l.label}`;
      sel.appendChild(opt);
    }
  }
  sel.value = currentLang();

  sel.addEventListener('change', () => {
    setLang(sel.value as Lang);
  });

  onLangChange((lang) => {
    if (sel.value !== lang) sel.value = lang;
    onChange?.();
  });
}