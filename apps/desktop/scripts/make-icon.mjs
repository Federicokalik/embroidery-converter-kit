/**
 * Generate the app icon (build/icon.png, 1024x1024, committed) and the
 * Windows .ico used by the CLI executable (build/icon.ico).
 * Same motif as the site favicon: pink stitch wave + needle cross.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pngToIco from 'png-to-ico';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const buildDir = join(here, '..', 'build');
mkdirSync(buildDir, { recursive: true });

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" rx="184" fill="#141414"/>
  <path d="M120 672 Q248 512 376 624 T632 592 T904 500"
        fill="none" stroke="#ff2e88" stroke-width="76" stroke-linecap="round"/>
  <path d="M672 244 l128 128 M800 244 l-128 128"
        fill="none" stroke="#f4f4f2" stroke-width="52" stroke-linecap="round"/>
</svg>`;

const png1024 = await sharp(Buffer.from(svg)).png().toBuffer();
writeFileSync(join(buildDir, 'icon.png'), png1024);

const png256 = await sharp(png1024).resize(256, 256).png().toBuffer();
writeFileSync(join(buildDir, 'icon.ico'), await pngToIco([png256]));

console.log('build/icon.png + build/icon.ico generated');
