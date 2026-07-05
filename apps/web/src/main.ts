// Landing entry. Styles are imported by src/pages/index.astro so they ship
// from <head> (styled first paint, no FOUC); this module only wires behavior.
import { applyI18n } from './i18n/i18n';
import { initLangSwitch } from './i18n/lang-switch';
import { initConverter, renderFormatWall } from './converter/converter';
import { playStitchOut } from './converter/stitchout';
import { scrollToSection, refreshScroll } from './core/gsap';
import { initExperience } from './experience';

function initAnchors(): void {
  for (const a of document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')) {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      scrollToSection(a.getAttribute('href')!);
    });
  }
}

applyI18n();
initLangSwitch(refreshScroll); // text lengths changed, triggers must recompute
initConverter({ playStitchOut, onLayoutChange: refreshScroll });
renderFormatWall(
  document.getElementById('format-wall')!,
  document.getElementById('atoz-sub')!,
);
initAnchors();
void initExperience();
