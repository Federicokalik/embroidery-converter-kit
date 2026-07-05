import { defineConfig } from 'astro/config';

// Static single-page site (no islands, no integrations): Astro is the HTML
// shell + CSS-in-head pipeline; all behavior stays in the plain TS modules.
export default defineConfig({
  vite: {
    // Real embroidery fixtures are imported cross-workspace with `?url`
    // (single source of truth in /fixtures, copied into dist at build).
    assetsInclude: ['**/*.vip', '**/*.jef', '**/*.pes', '**/*.dst'],
    build: {
      target: 'es2022',
      // three is a single lazy chunk by design (desktop-only, preloaded
      // behind the preloader); the 500 kB warning does not apply.
      chunkSizeWarningLimit: 600,
    },
  },
});
