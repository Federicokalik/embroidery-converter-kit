import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  banner: { js: '#!/usr/bin/env node' },
  clean: true,
  // The core package points at its TS sources (monorepo convention); the CLI
  // must ship a self-contained bundle.
  noExternal: ['@embroidery/core'],
});
