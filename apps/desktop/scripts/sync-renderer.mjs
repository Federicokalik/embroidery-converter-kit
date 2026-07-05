/**
 * Copy the desktop Astro build (apps/web/dist-desktop) into
 * apps/desktop/renderer so electron-builder can package it. Run
 * `pnpm --filter web build:desktop` first: it builds the app-shell renderer
 * (RICUCI_TARGET=desktop, '/' base, no landing/sponsor/SEO) into dist-desktop.
 */
import { cpSync, existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const webDist = join(here, '..', '..', 'web', 'dist-desktop');
const renderer = join(here, '..', 'renderer');

if (!existsSync(join(webDist, 'convert', 'index.html'))) {
  console.error('apps/web/dist-desktop is missing or incomplete — run `pnpm --filter web build:desktop` first.');
  process.exit(1);
}

rmSync(renderer, { recursive: true, force: true });
cpSync(webDist, renderer, { recursive: true });
console.log(`renderer synced from ${webDist}`);
