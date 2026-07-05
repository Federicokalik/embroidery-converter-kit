/**
 * Multilingual engine with DOM binding.
 *
 * Languages: it, en, fr, de, es, pt. `it`/`en` are the source pair; the
 * others fall back to `en` when a key is missing for that locale.
 *
 * Static markup opts in via `data-i18n="key"` (textContent) and
 * `data-i18n-aria="key"` (aria-label). Dynamic code calls t() at render
 * time and re-renders on onLangChange(). Strings live in strings.ts.
 */
import { STRINGS } from './strings';

export type Lang = 'it' | 'en' | 'fr' | 'de' | 'es' | 'pt';

export const LANGS: ReadonlyArray<{ code: Lang; label: string; flag: string }> = [
  { code: 'it', label: 'Italiano', flag: 'IT' },
  { code: 'en', label: 'English', flag: 'EN' },
  { code: 'fr', label: 'Français', flag: 'FR' },
  { code: 'de', label: 'Deutsch', flag: 'DE' },
  { code: 'es', label: 'Español', flag: 'ES' },
  { code: 'pt', label: 'Português', flag: 'PT' },
];

const FALLBACK: Lang = 'en';

const STORAGE_KEY = 'ricuci-lang';

function normalizeBrowserLang(tag: string): Lang | null {
  const low = tag.toLowerCase();
  if (low.startsWith('it')) return 'it';
  if (low.startsWith('en')) return 'en';
  if (low.startsWith('fr')) return 'fr';
  if (low.startsWith('de')) return 'de';
  if (low.startsWith('es')) return 'es';
  if (low.startsWith('pt')) return 'pt';
  return null;
}

function detectLang(): Lang {
  if (typeof localStorage === 'undefined' || typeof navigator === 'undefined') {
    return FALLBACK;
  }
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored !== null) {
    const n = normalizeBrowserLang(stored);
    if (n !== null) return n;
  }
  for (const tag of navigator.languages ?? [navigator.language]) {
    const n = normalizeBrowserLang(tag);
    if (n !== null) return n;
  }
  return FALLBACK;
}

let lang: Lang = typeof document !== 'undefined' ? detectLang() : FALLBACK;
const listeners: Array<(l: Lang) => void> = [];
const willChangeListeners: Array<(l: Lang) => void> = [];

export function currentLang(): Lang {
  return lang;
}

function resolveEntry(key: string, target: Lang): string | undefined {
  const entry = STRINGS[key];
  if (entry === undefined) return undefined;
  return entry[target] ?? entry[FALLBACK] ?? entry['it'];
}

export function t(key: string, params?: Record<string, string | number>): string {
  let text = resolveEntry(key, lang) ?? key;
  if (params !== undefined) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}

/** Fill every [data-i18n] / [data-i18n-aria] element under `root`. */
export function applyI18n(root: ParentNode = document): void {
  if (typeof document === 'undefined') return;
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n]')) {
    el.textContent = t(el.dataset['i18n']!);
  }
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n-aria]')) {
    el.setAttribute('aria-label', t(el.dataset['i18nAria']!));
  }
  // Reflect the active language on <html> and the lang-switch selector.
  document.documentElement.lang = lang;
  const sel = document.querySelector<HTMLSelectElement>('#lang-select');
  if (sel && sel.value !== lang) sel.value = lang;
  // Pages other than the landing set their own keys on <body>.
  document.title = t(document.body?.dataset['i18nTitle'] ?? 'meta.title');
  document
    .querySelector('meta[name="description"]')
    ?.setAttribute('content', t(document.body?.dataset['i18nDescription'] ?? 'meta.description'));
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
  if (!LANGS.some((l) => l.code === next)) return;
  for (const cb of willChangeListeners) cb(next);
  lang = next;
  localStorage.setItem(STORAGE_KEY, next);
  applyI18n();
  for (const cb of listeners) cb(next);
}