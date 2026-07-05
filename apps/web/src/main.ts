// Styles are imported by src/pages/index.astro so they ship from <head>
// (styled first paint, no FOUC); this entry only wires behavior.
import { applyI18n, setLang, currentLang, onLangChange } from './i18n/i18n';
import type { Lang } from './i18n/i18n';
import { initConverter, renderFormatWall } from './converter/converter';
import { scrollToSection, refreshScroll } from './core/gsap';
import { initExperience } from './experience';

function initLangSwitch(): void {
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
    refreshScroll(); // text lengths changed, triggers must recompute
  });
}

function initAnchors(): void {
  for (const a of document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')) {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      scrollToSection(a.getAttribute('href')!);
    });
  }
}

applyI18n();
initLangSwitch();
initConverter();
renderFormatWall(
  document.getElementById('format-wall')!,
  document.getElementById('atoz-sub')!,
);
initAnchors();
void initExperience();
