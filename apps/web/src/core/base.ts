/**
 * Base-aware internal links. BASE_URL is '/' in dev and '/<repo>/' on
 * GitHub Pages (set via ASTRO_BASE); every internal href must go through
 * here so the site works in both.
 */

/** The site base, always with a trailing slash. */
export const siteBase: string = import.meta.env.BASE_URL.endsWith('/')
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`;

/** withBase('convert/') and withBase('/convert/') both → '<base>convert/'. */
export function withBase(path: string): string {
  return `${siteBase}${path.replace(/^\//, '')}`;
}
