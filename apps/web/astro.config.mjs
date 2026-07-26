import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { targetPrune } from './integrations/target-prune.mjs';

// Static multilingual site (no islands): Astro is the HTML shell + CSS
// pipeline; behavior stays in plain TS modules. Every locale is prerendered
// (it at the root, /en/ /fr/ ... via pages/[lang]); hreflang alternates are
// emitted per page by SiteHead.astro, so the sitemap stays flat.
export default defineConfig({
  // GitHub Pages serves the project site under /<repo>/; dev, previews and
  // the desktop bundle stay at the root. The Pages workflow sets ASTRO_BASE
  // and ASTRO_SITE (absolute URLs: canonical, hreflang, og:*, sitemap).
  site: process.env.ASTRO_SITE,
  base: process.env.ASTRO_BASE ?? '/',
  // targetPrune('web') drops the desktop-only /app pages; sitemap only when
  // building for a real host (ASTRO_SITE set in the Pages workflow).
  integrations: [
    targetPrune('web'),
    ...(process.env.ASTRO_SITE === undefined ? [] : [sitemap()]),
  ],
  vite: {
    // The stage designs in src/assets/designs are imported with `?url`
    // and copied into dist at build.
    assetsInclude: ['**/*.vip', '**/*.jef', '**/*.pes', '**/*.dst'],
    // Keep third-party `/*! … @license … */` banners in the output. The
    // minifier drops them by default, which would strip GSAP's copyright
    // notice (its license forbids removing proprietary notices) and the MIT
    // notices of three/fflate/Pico (MIT requires the notice to travel with
    // the code). 'eof' collects them at the end of each chunk.
    esbuild: { legalComments: 'eof' },
    build: {
      target: 'es2022',
      // three is a single lazy chunk by design (desktop-only, preloaded
      // behind the preloader); the 500 kB warning does not apply.
      chunkSizeWarningLimit: 600,
    },
  },
});
