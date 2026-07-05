/**
 * Detail panel of the studio queue: shows the SELECTED queue item — static
 * preview in real thread colors, design facts and stats, thread swatches,
 * per-item hoop/trims/centering options (persisted on the item) and the
 * explicit Convert button. Only /convert renders this markup; the landing
 * has no panel at all.
 */
import { checkFit } from '@embroidery/core';
import type { Hoop, HoopFit } from '@embroidery/core';
import { t, currentLang } from '../i18n/i18n';
import { visibleThreadColor } from '../stitch/runs';
import { FORMAT_BRANDS, formatSewTime, hexOf, mm, resolveHoop } from './shared';
import type { QueueItem } from './shared';
import { StaticPreview } from './preview';

/** Swatches shown before collapsing into a "+N" tail. */
const MAX_THREADS = 16;

export interface PanelDeps {
  getTarget(): string;
  /** Effective output formats for this item (primary + extras − source). */
  formatsFor(item: QueueItem): string[];
  /** Preset-aware hoop catalog; undefined = format persists no hoop. */
  hoopCatalogFor(format: string): Hoop[] | undefined;
  convertItem(item: QueueItem): Promise<void>;
  removeItem(item: QueueItem): void;
  /** An option changed: the converter invalidates this item's outcomes. */
  onOptionsChange(item: QueueItem): void;
  onLayoutChange?: (() => void) | undefined;
}

export interface PanelHandle {
  show(item: QueueItem): void;
  clear(): void;
  /** Target/extras/preset/status/language changed: repaint everything. */
  rerender(): void;
  current(): QueueItem | null;
}

export function initPanel(deps: PanelDeps): PanelHandle {
  const root = document.getElementById('preview-panel') as HTMLElement | null;
  // Markup exists only on the studio page; be inert elsewhere.
  if (root === null) {
    return { show: () => {}, clear: () => {}, rerender: () => {}, current: () => null };
  }
  const canvasBox = root.querySelector('#preview-canvas') as HTMLElement;
  const nameEl = root.querySelector('#preview-name') as HTMLElement;
  const infoEl = root.querySelector('#preview-info') as HTMLElement;
  const threadField = root.querySelector('#thread-field') as HTMLElement;
  const threadList = root.querySelector('#thread-list') as HTMLElement;
  const hoopField = root.querySelector('#hoop-field') as HTMLElement;
  const hoopSelect = root.querySelector('#hoop-select') as HTMLSelectElement;
  const hoopFit = root.querySelector('#hoop-fit') as HTMLElement;
  const trimsField = root.querySelector('#trims-field') as HTMLElement;
  const trimsRadios = Array.from(
    root.querySelectorAll<HTMLInputElement>('input[name="trims"]'),
  );
  const dropStops = root.querySelector('#trims-drop-stops') as HTMLElement;
  const pauseStops = root.querySelector('#trims-pause-stops') as HTMLElement;
  const centerField = root.querySelector('#center-field') as HTMLElement;
  const centerCheck = root.querySelector('#center-check') as HTMLInputElement;
  const noteEl = root.querySelector('#panel-note') as HTMLElement;
  const convertBtn = root.querySelector('#convert-btn') as HTMLButtonElement;
  const removeBtn = root.querySelector('#discard-btn') as HTMLButtonElement;

  const preview = new StaticPreview();
  let item: QueueItem | null = null;
  let converting = false;

  function defaultHoopChoice(it: QueueItem): 'auto' | 'declared' {
    return it.parsed?.pattern.hoop !== undefined ? 'declared' : 'auto';
  }

  /**
   * Fit of the design in the given hoop. With "center in hoop" on, the
   * write recenters first, so only the size matters — never the placement.
   */
  function fitFor(it: QueueItem, hoop: Hoop): HoopFit | null {
    if (it.extents === null) return null;
    if (!it.options.centerInHoop) return checkFit(it.extents, hoop);
    const w = it.extents.maxX - it.extents.minX;
    const h = it.extents.maxY - it.extents.minY;
    return {
      fits: w <= hoop.width && h <= hoop.height,
      overflowX: Math.max(0, w - hoop.width),
      overflowY: Math.max(0, h - hoop.height),
      requiresCentering: false,
    };
  }

  function renderInfo(it: QueueItem): void {
    const parsed = it.parsed!;
    nameEl.textContent = parsed.fileName;
    canvasBox.setAttribute('aria-label', t('panel.previewAria', { name: parsed.fileName }));
    const locale = currentLang() === 'it' ? 'it-IT' : 'en-US';
    const brand = FORMAT_BRANDS[parsed.sourceFormat];
    const source =
      brand === undefined ? `.${parsed.sourceFormat}` : `.${parsed.sourceFormat} — ${brand}`;
    const colors = new Set(parsed.stitchData.runs.map((r) => r.threadIndex)).size;
    const ext = it.extents!;
    const rows: Array<[string, string]> = [
      [t('panel.source'), source],
      [t('panel.stitches'), parsed.stitchData.stitchCount.toLocaleString(locale)],
      [t('panel.colors'), String(Math.max(colors, 1))],
      [
        t('panel.size'),
        t('panel.sizeValue', { w: mm(ext.maxX - ext.minX), h: mm(ext.maxY - ext.minY) }),
      ],
    ];
    if (parsed.pattern.hoop !== undefined) {
      rows.push([
        t('panel.sourceHoop'),
        t('panel.sizeValue', {
          w: mm(parsed.pattern.hoop.width),
          h: mm(parsed.pattern.hoop.height),
        }),
      ]);
    }
    // Command stats + honest sew-time estimate.
    rows.push(
      [t('panel.statJumps'), it.stats.jumps.toLocaleString(locale)],
      [t('panel.statTrims'), it.stats.trims.toLocaleString(locale)],
      [t('panel.statStops'), it.stats.stops.toLocaleString(locale)],
      [t('panel.sewTime'), formatSewTime(parsed.stitchData.stitchCount)],
    );
    infoEl.replaceChildren(
      ...rows.flatMap(([label, value]) => {
        const dt = document.createElement('dt');
        dt.textContent = label;
        const dd = document.createElement('dd');
        dd.textContent = value;
        return [dt, dd];
      }),
    );
  }

  function renderThreads(it: QueueItem): void {
    const threads = it.parsed!.pattern.threads;
    threadField.hidden = threads.length === 0;
    if (threads.length === 0) return;
    const shown = threads.slice(0, MAX_THREADS);
    threadList.replaceChildren(
      ...shown.map((thread) => {
        const li = document.createElement('li');
        li.className = 'thread-item';
        const swatch = document.createElement('span');
        swatch.className = 'thread-swatch';
        swatch.style.background = hexOf(visibleThreadColor(thread.rgb));
        const hex = document.createElement('span');
        hex.className = 'thread-hex mono';
        hex.textContent = hexOf(thread.rgb);
        li.append(swatch, hex);
        const desc = thread.description ?? thread.catalog;
        if (desc !== undefined) {
          const label = document.createElement('span');
          label.className = 'thread-desc';
          label.textContent = desc;
          li.append(label);
        }
        return li;
      }),
    );
    if (threads.length > MAX_THREADS) {
      const more = document.createElement('li');
      more.className = 'thread-more mono';
      more.textContent = t('panel.threadsMore', { n: threads.length - MAX_THREADS });
      threadList.append(more);
    }
  }

  function renderHoop(it: QueueItem): void {
    const target = deps.getTarget();
    const catalog = deps.hoopCatalogFor(target);
    hoopField.hidden = false;
    centerField.hidden = catalog === undefined;
    hoopSelect.disabled = catalog === undefined;
    if (catalog === undefined) {
      const opt = document.createElement('option');
      opt.value = 'auto';
      opt.textContent = '—';
      hoopSelect.replaceChildren(opt);
      hoopFit.textContent = t('panel.hoopNoStore', { fmt: target.toUpperCase() });
      hoopFit.className = 'panel-fit';
      return;
    }

    const options: Array<{ value: string; label: string }> = [
      { value: 'auto', label: t('panel.hoopAuto') },
    ];
    const declared = it.parsed!.pattern.hoop;
    if (declared !== undefined) {
      options.push({
        value: 'declared',
        label: t('panel.hoopDeclaredOpt', { w: mm(declared.width), h: mm(declared.height) }),
      });
    }
    catalog.forEach((hoop, i) => {
      const name = hoop.name !== undefined ? ` ${hoop.name}` : '';
      options.push({ value: String(i), label: `${mm(hoop.width)}×${mm(hoop.height)} mm${name}` });
    });
    hoopSelect.replaceChildren(
      ...options.map(({ value, label }) => {
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = label;
        return opt;
      }),
    );
    const current =
      typeof it.options.hoopChoice === 'number'
        ? String(it.options.hoopChoice)
        : it.options.hoopChoice;
    hoopSelect.value = current;
    if (hoopSelect.value !== current) {
      // Choice no longer valid for this target (e.g. preset narrowed it).
      it.options.hoopChoice = defaultHoopChoice(it);
      hoopSelect.value = it.options.hoopChoice;
    }

    const resolved = resolveHoop(it, target, target, catalog);
    if (resolved === undefined) {
      hoopFit.textContent = t('panel.hoopNone');
      hoopFit.className = 'panel-fit warning';
      return;
    }
    const fit = fitFor(it, resolved);
    if (fit === null) return;
    const dims = { w: mm(resolved.width), h: mm(resolved.height) };
    if (!fit.fits) {
      hoopFit.textContent = t('panel.hoopOverflow', {
        ...dims,
        ow: mm(fit.overflowX),
        oh: mm(fit.overflowY),
      });
      hoopFit.className = 'panel-fit warning';
    } else if (fit.requiresCentering) {
      hoopFit.textContent = t('panel.hoopRecenter', dims);
      hoopFit.className = 'panel-fit';
    } else {
      hoopFit.textContent = t('panel.hoopFits', dims);
      hoopFit.className = 'panel-fit';
    }
  }

  function renderTrims(it: QueueItem): void {
    const show = deps.getTarget() === 'zhs' && it.parsed!.hasTrims;
    trimsField.hidden = !show;
    if (!show) return;
    for (const radio of trimsRadios) radio.checked = radio.value === it.options.trims;
    dropStops.textContent = t('panel.trimsStops', { n: it.stops.drop });
    pauseStops.textContent = t('panel.trimsStops', { n: it.stops.pause });
  }

  function renderActions(it: QueueItem): void {
    const target = deps.getTarget();
    const formats = deps.formatsFor(it);
    const sameAsPrimary = target === it.parsed!.sourceFormat;
    convertBtn.textContent =
      formats.length > 1
        ? t('panel.convertMulti', { n: formats.length })
        : t('panel.convert', { fmt: (formats[0] ?? target).toUpperCase() });
    convertBtn.disabled = formats.length === 0 || converting;
    noteEl.hidden = !sameAsPrimary;
    if (sameAsPrimary) {
      noteEl.textContent =
        formats.length > 0
          ? t('panel.sameFormatExtras', { fmt: target.toUpperCase() })
          : t('panel.sameFormat', { fmt: target.toUpperCase() });
    }
  }

  function renderAll(): void {
    if (item === null) return;
    renderInfo(item);
    renderThreads(item);
    renderHoop(item);
    renderTrims(item);
    renderActions(item);
  }

  hoopSelect.addEventListener('change', () => {
    if (item === null) return;
    const v = hoopSelect.value;
    item.options.hoopChoice = v === 'auto' || v === 'declared' ? v : Number(v);
    deps.onOptionsChange(item);
    renderHoop(item);
  });
  for (const radio of trimsRadios) {
    radio.addEventListener('change', () => {
      if (item === null || !radio.checked) return;
      item.options.trims = radio.value === 'pause' ? 'pause' : 'drop';
      deps.onOptionsChange(item);
    });
  }
  centerCheck.addEventListener('change', () => {
    if (item === null) return;
    item.options.centerInHoop = centerCheck.checked;
    deps.onOptionsChange(item);
    renderHoop(item);
  });
  convertBtn.addEventListener('click', () => {
    const it = item;
    if (it === null || converting) return;
    converting = true;
    renderActions(it);
    void deps.convertItem(it).finally(() => {
      converting = false;
      if (item !== null) renderActions(item);
    });
  });
  removeBtn.addEventListener('click', () => {
    if (item !== null) deps.removeItem(item);
  });

  const handle: PanelHandle = {
    show(next: QueueItem): void {
      if (next.parsed === null) return;
      item = next;
      centerCheck.checked = next.options.centerInHoop;
      root!.hidden = false;
      renderAll();
      // Mount only after the panel is visible so the container has a size.
      preview.mount(canvasBox, next.parsed.stitchData);
      deps.onLayoutChange?.();
    },
    clear(): void {
      if (item === null) return;
      item = null;
      preview.dispose();
      root!.hidden = true;
      deps.onLayoutChange?.();
    },
    rerender(): void {
      renderAll();
    },
    current(): QueueItem | null {
      return item;
    },
  };
  return handle;
}
