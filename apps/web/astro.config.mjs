import { defineConfig } from 'astro/config';

// Static single-page site (no islands, no integrations): Astro is the HTML
// shell + CSS-in-head pipeline; all behavior stays in the plain TS modules.
export default defineConfig({
  // GitHub Pages serves the project site under /<repo>/; dev, previews and
  // the desktop bundle stay at the root. The Pages workflow sets ASTRO_BASE.
  base: process.env.ASTRO_BASE ?? '/',
  vite: {
    // The stage designs in src/assets/designs are imported with `?url`
    // and copied into dist at build.
    assetsInclude: ['**/*.vip', '**/*.jef', '**/*.pes', '**/*.dst'],
    build: {
      target: 'es2022',
      // three is a single lazy chunk by design (desktop-only, preloaded
      // behind the preloader); the 500 kB warning does not apply.
      chunkSizeWarningLimit: 600,
    },
  },
});
