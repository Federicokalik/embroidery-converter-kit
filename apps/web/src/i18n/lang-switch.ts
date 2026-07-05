/**
 * IT/EN switch buttons in the nav. Shared by both pages; the landing
 * passes an onChange hook (ScrollTrigger refresh), /convert passes none —
 * this module must never import gsap.
 */
import { currentLang, onLangChange, setLang } from './i18n';
import type { Lang } from './i18n';

export function initLangSwitch(onChange?: () => void): void {
  const buttons = document.querySelectorAll<HTMLButtonElement>('.lang-switch button');
  const sync = (lang: Lang): void => {
    for (const b of buttons) b.setAttribute('aria-pressed', String(b.dataset['lang'] === lang));
  };
  sync(currentLang());
  for (const b of buttons) {
    b.addEventListener('click', () => setLang(b.dataset['lang'] as Lang));
  }
  onLangChange((lang) => {
    sync(lang);
    onChange?.();
  });
}
