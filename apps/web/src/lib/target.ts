/**
 * Build target flag. The same `src/` builds two products:
 *  - `web`     → the public site (default), landing + docs + convert, SEO.
 *  - `desktop` → the Electron renderer: app-shell chrome, no landing/sponsor.
 *
 * Set by astro.config.desktop.mjs (`process.env.RICUCI_TARGET = 'desktop'`)
 * and read ONLY in .astro frontmatter, which runs in Node at build time.
 * Never import this from a browser module — it is a build-time switch.
 */
export const target: 'web' | 'desktop' =
  process.env['RICUCI_TARGET'] === 'desktop' ? 'desktop' : 'web';

export const isDesktop: boolean = target === 'desktop';
