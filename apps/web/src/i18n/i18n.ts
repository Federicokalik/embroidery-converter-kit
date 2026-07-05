/**
 * Multilingual engine, static-first.
 *
 * Languages: it, en, fr, de, es, pt. `it`/`en` are the source pair; the
 * others fall back to `en` when a key is missing for that locale.
 *
 * Every page is PRERENDERED in its own language (it at the root, the other
 * locales under /<lang>/): .astro frontmatter calls translate(lang, key) at
 * build time, so crawlers see fully translated HTML. At runtime the page
 * language comes from <html lang> and never changes in place — the selector
 * NAVIGATES to the sibling URL. t() serves the dynamic converter strings.
 */
import { siteBase } from '../core/base';
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

/** The docs content exists in these languages only (see pages/en/docs). */
export const DOCS_LANGS: ReadonlyArray<Lang> = ['it', 'en'];

export function isLang(value: string): value is Lang {
  return LANGS.some((l) => l.code === value);
}

/**
 * URL of a logical page path in a given language. Logical paths are
 * base-less and lang-less: '', 'convert/', 'docs/formats/zhs/'.
 * Italian lives at the root; every other locale under /<lang>/.
 */
export function localeUrl(target: Lang, logical: string): string {
  const path = logical.replace(/^\//, '');
  return `${siteBase}${target === 'it' ? '' : `${target}/`}${path}`;
}

/** location.pathname → logical path (strips the site base and lang prefix). */
export function pageLogicalPath(pathname: string): string {
  let path = pathname.startsWith(siteBase) ? pathname.slice(siteBase.length) : pathname.replace(/^\//, '');
  const first = path.split('/', 1)[0] ?? '';
  if (isLang(first)) path = path.slice(first.length + 1);
  return path;
}

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

/** The page language is server-rendered truth; detection is the fallback
 *  for anything unexpected (the selector navigates, it never mutates). */
function pageLang(): Lang {
  const attr = document.documentElement.lang;
  return isLang(attr) ? attr : detectLang();
}

let lang: Lang = typeof document !== 'undefined' ? pageLang() : FALLBACK;
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

/** Pure lookup for build-time rendering in .astro frontmatter. */
export function translate(
  target: Lang,
  key: string,
  params?: Record<string, string | number>,
): string {
  let text = resolveEntry(key, target) ?? key;
  if (params !== undefined) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}

export function t(key: string, params?: Record<string, string | number>): string {
  return translate(lang, key, params);
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
  // Reflect the active language on the lang-switch selector.
  const sel = document.querySelector<HTMLSelectElement>('#lang-select');
  if (sel && sel.value !== lang) sel.value = lang;
  // Title/description are prerendered per language; only pages that opt in
  // via <body data-i18n-title> get them re-applied (never a silent default:
  // that used to clobber per-page docs titles with the generic one).
  const titleKey = document.body?.dataset['i18nTitle'];
  if (titleKey !== undefined) document.title = t(titleKey);
  const descriptionKey = document.body?.dataset['i18nDescription'];
  if (descriptionKey !== undefined) {
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', t(descriptionKey));
  }
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