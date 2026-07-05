import { defineConfig } from 'astro/config';
import { targetPrune } from './integrations/target-prune.mjs';

// Desktop renderer build. Same src/ as the site, but: RICUCI_TARGET switches
// the page chrome to the app-shell (DesktopLayout/AppRail), the output goes to
// dist-desktop/ (synced into apps/desktop/renderer), no sitemap and no site =>
// SiteHead emits no canonical/hreflang/OG (the app needs no SEO). targetPrune
// drops the marketing landing and its orphan assets from the bundle.
//
// RICUCI_TARGET is set here (not on the CLI) so the build is identical on every
// shell/OS; src/lib/target.ts reads it in .astro frontmatter at build time.
process.env.RICUCI_TARGET = 'desktop';

export default defineConfig({
  base: '/',
  outDir: './dist-desktop',
  integrations: [targetPrune('desktop')],
  vite: {
    assetsInclude: ['**/*.vip', '**/*.jef', '**/*.pes', '**/*.dst'],
    build: {
      target: 'es2022',
      chunkSizeWarningLimit: 600,
    },
  },
});
