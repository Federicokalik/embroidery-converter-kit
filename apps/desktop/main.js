/**
 * Ricuci desktop — Electron shell around the web converter.
 *
 * Loads the Astro build (synced into renderer/ by scripts/sync-renderer.mjs)
 * through a custom app:// protocol so the site's absolute asset URLs work
 * unchanged. The app is the converter only: the root route is mapped onto
 * /convert/, the marketing landing is never reachable.
 *
 * Conversion stays 100% local, exactly like in the browser: no design data
 * ever leaves the machine (fonts are bundled, OFL). The ONLY network call
 * is an optional once-per-launch update check against the GitHub releases
 * metadata — no payload, disable with RICUCI_NO_UPDATE_CHECK=1.
 */
const { app, BrowserWindow, dialog, net, protocol, shell } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const RENDERER_DIR = path.join(__dirname, 'renderer');
const SMOKE_TEST = process.argv.includes('--smoke-test');
const UPDATE_CHECK_TEST = process.argv.includes('--update-check-test');

const RELEASES_API =
  'https://api.github.com/repos/Federicokalik/embroidery-converter-kit/releases/latest';
const RELEASES_PAGE =
  'https://github.com/Federicokalik/embroidery-converter-kit/releases/latest';

/** 'v0.2.1' → [0, 2, 1]; anything unparsable → null. */
function parseVersion(tag) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(String(tag).trim());
  return m === null ? null : [Number(m[1]), Number(m[2]), Number(m[3])];
}

function isNewer(latest, current) {
  for (let i = 0; i < 3; i++) {
    if (latest[i] !== current[i]) return latest[i] > current[i];
  }
  return false;
}

/** One GET to the releases metadata; resolves to null when up to date,
 *  offline, rate-limited or anything else — never throws, never blocks. */
async function checkForUpdate() {
  const current = parseVersion(app.getVersion());
  if (current === null) return null;
  try {
    const res = await net.fetch(RELEASES_API, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) return null;
    const release = await res.json();
    const latest = parseVersion(release.tag_name);
    if (latest === null || !isNewer(latest, current)) return null;
    return { tag: release.tag_name, url: release.html_url ?? RELEASES_PAGE };
  } catch {
    return null;
  }
}

async function notifyUpdate(win) {
  const update = await checkForUpdate();
  if (update === null || win.isDestroyed()) return;
  const { response } = await dialog.showMessageBox(win, {
    type: 'info',
    title: 'Ricuci',
    message: `È disponibile Ricuci ${update.tag}`,
    detail: 'Scarica la nuova versione dalla pagina delle release.',
    buttons: ['Scarica', 'Più tardi'],
    defaultId: 0,
    cancelId: 1,
  });
  if (response === 0) void shell.openExternal(update.url);
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: { standard: true, secure: true, supportFetchAPI: true },
  },
]);

/** app://-/<path> → file inside renderer/ (directory routes get index.html). */
function resolveRendererFile(requestUrl) {
  let pathname = decodeURIComponent(new URL(requestUrl).pathname);
  // The desktop app is the converter only: serve it at the root.
  if (pathname === '/' || pathname === '') pathname = '/convert/';
  if (pathname.endsWith('/')) pathname += 'index.html';
  if (path.extname(pathname) === '') pathname += '/index.html';
  const resolved = path.normalize(path.join(RENDERER_DIR, pathname));
  // Never serve outside the bundled renderer directory.
  if (!resolved.startsWith(RENDERER_DIR)) return null;
  return resolved;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    show: !SMOKE_TEST,
    backgroundColor: '#f4f4f2',
    // Windows/macOS take the icon from the packaged executable; this covers
    // Linux and unpackaged `electron .` runs.
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Download links (GitHub Releases) and any other external URL open in the
  // system browser, never inside the app shell.
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('app://')) {
      event.preventDefault();
      void shell.openExternal(url);
    }
  });

  win.removeMenu();
  void win.loadURL('app://-/');

  if (SMOKE_TEST) {
    win.webContents.on('did-finish-load', () => {
      console.log('SMOKE_OK title=%s url=%s', win.webContents.getTitle(), win.webContents.getURL());
      app.quit();
    });
    win.webContents.on('did-fail-load', (_e, code, desc) => {
      console.error('SMOKE_FAIL %d %s', code, desc);
      app.exit(1);
    });
  }
  return win;
}

app.whenReady().then(() => {
  protocol.handle('app', (request) => {
    const file = resolveRendererFile(request.url);
    if (file === null) return new Response('forbidden', { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });

  if (UPDATE_CHECK_TEST) {
    // CI probe: run the check headlessly and report, no window, no dialog.
    void checkForUpdate().then((update) => {
      console.log('UPDATE_CHECK current=%s result=%j', app.getVersion(), update);
      app.quit();
    });
    return;
  }

  const win = createWindow();

  // Once per launch, after the converter is up; silent when up to date.
  if (!SMOKE_TEST && process.env['RICUCI_NO_UPDATE_CHECK'] !== '1') {
    win.webContents.once('did-finish-load', () => void notifyUpdate(win));
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' || SMOKE_TEST) app.quit();
});
