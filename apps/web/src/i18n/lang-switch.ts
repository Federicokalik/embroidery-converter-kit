/**
 * Language selector shared by every page. Every locale is a prerendered
 * URL (it at the root, /<lang>/ otherwise), so changing the selection
 * NAVIGATES to the sibling page instead of swapping text in place — the
 * preference is stored for future default-language hints.
 *
 * The <select> options are server-rendered per page (docs pages only list
 * the languages their content exists in).
 */
import { currentLang, isLang, localeUrl, pageLogicalPath } from './i18n';

const STORAGE_KEY = 'ricuci-lang';

export function initLangSwitch(_onChange?: () => void): void {
  if (typeof document === 'undefined') return;
  const sel = document.querySelector<HTMLSelectElement>('#lang-select');
  if (sel === null) return;

  sel.value = currentLang();

  sel.addEventListener('change', () => {
    const target = sel.value;
    if (!isLang(target) || target === currentLang()) return;
    try {
      localStorage.setItem(STORAGE_KEY, target);
    } catch {
      // storage may be unavailable (private mode): navigation still works
    }
    window.location.assign(localeUrl(target, pageLogicalPath(window.location.pathname)));
  });
}
