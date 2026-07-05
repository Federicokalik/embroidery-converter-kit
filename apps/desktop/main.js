/**
 * Restitch desktop — Electron shell around the web converter.
 *
 * Loads the Astro build (synced into renderer/ by scripts/sync-renderer.mjs)
 * through a custom app:// protocol so the site's absolute asset URLs work
 * unchanged. The app is the converter only: the root route is mapped onto
 * /convert/, the marketing landing is never reachable.
 *
 * Conversion stays 100% local, exactly like in the browser: no network
 * access is required and none is performed (fonts are bundled, OFL).
 */
const { app, BrowserWindow, net, protocol, shell } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const RENDERER_DIR = path.join(__dirname, 'renderer');
const SMOKE_TEST = process.argv.includes('--smoke-test');

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

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' || SMOKE_TEST) app.quit();
});
