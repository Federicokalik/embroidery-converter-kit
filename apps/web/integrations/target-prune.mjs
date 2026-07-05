/**
 * Build-time output pruning, so the same `src/` yields two clean products.
 *
 * - target 'web'     → drop the desktop-only /app/ pages (Credits/License/
 *   About) from the public site.
 * - target 'desktop' → drop the marketing landing pages, then sweep away any
 *   _astro asset they alone pulled in (the Three.js scrollytelling, scene
 *   chunks, stage designs, preloader). The sweep is reference-based: it keeps
 *   every asset still reachable from a surviving page, so convert/ and docs/
 *   are never touched.
 */
import { readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** All files under `root`, as paths relative to `root` with '/' separators. */
function walk(root) {
  const out = [];
  const rec = (abs) => {
    for (const name of readdirSync(abs)) {
      const p = join(abs, name);
      if (statSync(p).isDirectory()) rec(p);
      else out.push(relative(root, p).split(sep).join('/'));
    }
  };
  rec(root);
  return out;
}

/** Landing pages to remove for the desktop build (root serves /convert/). */
const LANDING = ['index.html', 'en/index.html', 'fr/index.html', 'de/index.html', 'es/index.html', 'pt/index.html'];

export function targetPrune(target) {
  return {
    name: 'ricuci:target-prune',
    hooks: {
      'astro:build:done': ({ dir, logger }) => {
        const root = fileURLToPath(dir);

        if (target === 'web') {
          for (const d of ['app', 'en/app']) {
            rmSync(join(root, d), { recursive: true, force: true });
          }
          logger.info('pruned desktop-only /app pages from the web build');
          return;
        }

        // --- desktop: remove landing pages ---
        for (const page of LANDING) rmSync(join(root, page), { force: true });

        // --- desktop: sweep _astro assets no surviving page can reach ---
        const files = walk(root);
        const assets = files.filter((f) => f.startsWith('_astro/'));
        const assetNames = assets.map((f) => f.slice('_astro/'.length));
        const html = files.filter((f) => f.endsWith('.html'));

        // Roots: every asset name that appears in a surviving HTML file.
        const reachable = new Set();
        const rootText = html.map((f) => readFileSync(join(root, f), 'utf8')).join('\n');
        for (const name of assetNames) {
          if (rootText.includes(name)) reachable.add(name);
        }

        // Closure: assets referenced (statically preloaded or dynamically
        // imported by hashed filename) from an already-reachable JS/CSS asset.
        const textCache = new Map();
        const textOf = (name) => {
          if (!textCache.has(name)) {
            textCache.set(name, readFileSync(join(root, '_astro', name), 'utf8'));
          }
          return textCache.get(name);
        };
        const isText = (name) => name.endsWith('.js') || name.endsWith('.css');
        let grew = true;
        while (grew) {
          grew = false;
          for (const from of [...reachable]) {
            if (!isText(from)) continue;
            const body = textOf(from);
            for (const name of assetNames) {
              if (!reachable.has(name) && body.includes(name)) {
                reachable.add(name);
                grew = true;
              }
            }
          }
        }

        let removed = 0;
        let bytes = 0;
        for (const name of assetNames) {
          if (reachable.has(name)) continue;
          const abs = join(root, '_astro', name);
          bytes += statSync(abs).size;
          rmSync(abs, { force: true });
          removed += 1;
        }
        logger.info(
          `desktop build: pruned ${LANDING.length} landing pages + ${removed} orphan assets (${Math.round(bytes / 1024)} kB)`,
        );
      },
    },
  };
}
