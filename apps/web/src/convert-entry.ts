// Lean entry for /convert: i18n + converter only. No gsap plugins, no
// three, no scenes, no preloader. Styles ship from convert.astro's head.
import { applyI18n } from './i18n/i18n';
import { initLangSwitch } from './i18n/lang-switch';
import { initConverter } from './converter/converter';

applyI18n();
initLangSwitch();
initConverter();
