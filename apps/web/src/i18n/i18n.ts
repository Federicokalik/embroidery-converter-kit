/**
 * Tiny bilingual (it/en) engine with DOM binding.
 *
 * Static markup opts in via `data-i18n="key"` (textContent) and
 * `data-i18n-aria="key"` (aria-label). Dynamic code calls t() at render
 * time and re-renders on onLangChange(). Strings live in strings.ts.
 */
import { STRINGS } from './strings';

export type Lang = 'it' | 'en';

const STORAGE_KEY = 'restitch-lang';

function detectLang(): Lang {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'it' || stored === 'en') return stored;
  return navigator.language.toLowerCase().startsWith('it') ? 'it' : 'en';
}

let lang: Lang = detectLang();
const listeners: Array<(l: Lang) => void> = [];
const willChangeListeners: Array<(l: Lang) => void> = [];

export function currentLang(): Lang {
  return lang;
}

export function t(key: string, params?: Record<string, string | number>): string {
  const entry = STRINGS[key];
  let text = entry !== undefined ? entry[lang] : key;
  if (params !== undefined) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}

/** Fill every [data-i18n] / [data-i18n-aria] element under `root`. */
export function applyI18n(root: ParentNode = document): void {
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n]')) {
    el.textContent = t(el.dataset['i18n']!);
  }
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n-aria]')) {
    el.setAttribute('aria-label', t(el.dataset['i18nAria']!));
  }
  document.documentElement.lang = lang;
  document.title = t('meta.title');
  document
    .querySelector('meta[name="description"]')
    ?.setAttribute('content', t('meta.description'));
}

export function onLangChange(cb: (l: Lang) => void): void {
  listeners.push(cb);
}

/** Fires BEFORE the DOM text is replaced: revert SplitText et al. here. */
export function onLangWillChange(cb: (l: Lang) => void): void {
  willChangeListeners.push(cb);
}

export function setLang(next: Lang): void {
  if (next === lang) return;
  for (const cb of willChangeListeners) cb(next);
  lang = next;
  localStorage.setItem(STORAGE_KEY, next);
  applyI18n();
  for (const cb of listeners) cb(next);
}
