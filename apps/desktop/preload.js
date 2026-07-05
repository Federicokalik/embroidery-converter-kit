/**
 * Minimal, sandbox-safe preload. Exposes the app version and a friendly OS
 * name to the renderer as `window.ricuci`, so the static About page (and the
 * rail footer) can show them without any Electron API in the page. The values
 * arrive via additionalArguments from main.js — the version's single source
 * of truth stays app.getVersion().
 */
const { contextBridge } = require('electron');

/** Read a `--key=value` argument injected by main.js (additionalArguments). */
function argValue(prefix) {
  const arg = process.argv.find((a) => a.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : undefined;
}

const PLATFORM_NAME = { win32: 'Windows', darwin: 'macOS', linux: 'Linux' };
const rawPlatform = argValue('--ricuci-platform=');

contextBridge.exposeInMainWorld('ricuci', {
  version: argValue('--ricuci-version='),
  platform: rawPlatform ? (PLATFORM_NAME[rawPlatform] ?? rawPlatform) : undefined,
});
