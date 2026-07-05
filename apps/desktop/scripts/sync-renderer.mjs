/**
 * Copy the Astro build (apps/web/dist) into apps/desktop/renderer so
 * electron-builder can package it. Run `pnpm --filter web build` first
 * (with the default '/' base — the desktop protocol serves from the root).
 */
import { cpSync, existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const webDist = join(here, '..', '..', 'web', 'dist');
const renderer = join(here, '..', 'renderer');

if (!existsSync(join(webDist, 'convert', 'index.html'))) {
  console.error('apps/web/dist is missing or incomplete — run `pnpm --filter web build` first.');
  process.exit(1);
}

rmSync(renderer, { recursive: true, force: true });
cpSync(webDist, renderer, { recursive: true });
console.log(`renderer synced from ${webDist}`);
