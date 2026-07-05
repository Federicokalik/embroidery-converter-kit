/**
 * Single-file panel: after one file is dropped, the design is parsed and
 * shown here — static preview in real thread colors, design facts, hoop
 * selector (formats that persist one), ZHS trims choice — and conversion
 * only happens on the explicit Convert button. Bulk drops never open it.
 */
import { checkFit, computeExtents, selectSmallestHoop, HOOP_CATALOG } from '@embroidery/core';
import type { Extents, Hoop, HoopFit, WriterOptions } from '@embroidery/core';
import { t, currentLang } from '../i18n/i18n';
import {
  describePattern,
  FORMAT_BRANDS,
  HOOP_BRAND_BY_FORMAT,
  machineStops,
  mm,
} from './shared';
import type { ParsedFile } from './shared';
import { StaticPreview } from './preview';

export interface PanelDeps {
  getTarget(): string;
  convert(parsed: ParsedFile, options: WriterOptions, centerFirst: boolean): Promise<void>;
  onLayoutChange?: (() => void) | undefined;
  /**
   * 'full' (/convert): every control, hoop field always visible (with a
   * "this format stores no hoop" note where it applies). 'lite' (landing):
   * preview + facts + Convert only, plus a link to the full tool.
   */
  variant: 'full' | 'lite';
}

export interface PanelHandle {
  open(parsed: ParsedFile): void;
  close(): void;
  /** Target chip changed while a file is loaded. */
  onTargetChange(): void;
  /** Language changed: re-render every dynamic string. */
  refresh(): void;
}

type HoopChoice = 'auto' | 'declared' | number;

interface Session {
  parsed: ParsedFile;
  extents: Extents;
  stops: { drop: number; pause: number };
  hoopChoice: HoopChoice;
  trims: 'drop' | 'pause';
  centerInHoop: boolean;
  converting: boolean;
}

export function initPanel(deps: PanelDeps): PanelHandle {
  const root = document.getElementById('preview-panel') as HTMLElement | null;
  // The markup is shared by both pages; bail gracefully if it's absent.
  if (root === null) {
    return { open: () => {}, close: () => {}, onTargetChange: () => {}, refresh: () => {} };
  }
  const canvasBox = root.querySelector('#preview-canvas') as HTMLElement;
  const nameEl = root.querySelector('#preview-name') as HTMLElement;
  const infoEl = root.querySelector('#preview-info') as HTMLElement;
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
  const discardBtn = root.querySelector('#discard-btn') as HTMLButtonElement;
  const moreEl = root.querySelector('#panel-more') as HTMLElement;

  const lite = deps.variant === 'lite';
  moreEl.hidden = !lite;

  const preview = new StaticPreview();
  let session: Session | null = null;

  function defaultHoopChoice(s: Session): 'auto' | 'declared' {
    return s.parsed.pattern.hoop !== undefined ? 'declared' : 'auto';
  }

  /** The hoop the current choice resolves to (undefined = writer default). */
  function resolveHoop(s: Session): Hoop | undefined {
    const brand = HOOP_BRAND_BY_FORMAT[deps.getTarget()];
    if (brand === undefined) return undefined;
    if (s.hoopChoice === 'declared') return s.parsed.pattern.hoop;
    if (typeof s.hoopChoice === 'number') return HOOP_CATALOG[brand][s.hoopChoice];
    return selectSmallestHoop(s.extents, HOOP_CATALOG[brand]);
  }

  /**
   * Fit of the design in the resolved hoop. With "center in hoop" on, the
   * write recenters first, so only the size matters — never the placement.
   */
  function fitFor(s: Session, hoop: Hoop): HoopFit {
    if (!s.centerInHoop) return checkFit(s.extents, hoop);
    // The write recenters first: only the size can overflow.
    const w = s.extents.maxX - s.extents.minX;
    const h = s.extents.maxY - s.extents.minY;
    return {
      fits: w <= hoop.width && h <= hoop.height,
      overflowX: Math.max(0, w - hoop.width),
      overflowY: Math.max(0, h - hoop.height),
      requiresCentering: false,
    };
  }

  function renderInfo(s: Session): void {
    const { parsed } = s;
    nameEl.textContent = parsed.fileName;
    canvasBox.setAttribute('aria-label', t('panel.previewAria', { name: parsed.fileName }));
    const locale = currentLang() === 'it' ? 'it-IT' : 'en-US';
    const brand = FORMAT_BRANDS[parsed.sourceFormat];
    const source =
      brand === undefined ? `.${parsed.sourceFormat}` : `.${parsed.sourceFormat} — ${brand}`;
    const colors = new Set(parsed.stitchData.runs.map((r) => r.threadIndex)).size;
    const rows: Array<[string, string]> = [
      [t('panel.source'), source],
      [t('panel.stitches'), parsed.stitchData.stitchCount.toLocaleString(locale)],
      [t('panel.colors'), String(Math.max(colors, 1))],
      [
        t('panel.size'),
        t('panel.sizeValue', {
          w: mm(s.extents.maxX - s.extents.minX),
          h: mm(s.extents.maxY - s.extents.minY),
        }),
      ],
    ];
    infoEl.replaceChildren(
      ...rows.flatMap(([label, value]) => {
        const dt = document.createElement('dt');
        dt.textContent = label;
        const dd = document.createElement('dd');
        dd.textContent = value;
        return [dt, dd];
      }),
    );
    // Declared hoop of the SOURCE file (if any), as in the results list.
    if (parsed.pattern.hoop !== undefined) {
      const dt = document.createElement('dt');
      dt.textContent = t('panel.sourceHoop');
      const dd = document.createElement('dd');
      dd.textContent = t('panel.sizeValue', {
        w: mm(parsed.pattern.hoop.width),
        h: mm(parsed.pattern.hoop.height),
      });
      infoEl.append(dt, dd);
    }
  }

  function renderHoop(s: Session): void {
    const target = deps.getTarget();
    const brand = HOOP_BRAND_BY_FORMAT[target];
    if (lite) {
      hoopField.hidden = true;
      centerField.hidden = true;
      return;
    }
    // Full variant: the field is always there; formats without a hoop
    // record say so instead of silently dropping the control.
    hoopField.hidden = false;
    centerField.hidden = brand === undefined;
    hoopSelect.disabled = brand === undefined;
    if (brand === undefined) {
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
    const declared = s.parsed.pattern.hoop;
    if (declared !== undefined) {
      options.push({
        value: 'declared',
        label: t('panel.hoopDeclaredOpt', { w: mm(declared.width), h: mm(declared.height) }),
      });
    }
    HOOP_CATALOG[brand].forEach((hoop, i) => {
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
      typeof s.hoopChoice === 'number' ? String(s.hoopChoice) : s.hoopChoice;
    hoopSelect.value = current;
    if (hoopSelect.value !== current) {
      // Choice no longer valid for this target (e.g. brand changed).
      s.hoopChoice = defaultHoopChoice(s);
      hoopSelect.value = s.hoopChoice;
    }

    const resolved = resolveHoop(s);
    if (resolved === undefined) {
      hoopFit.textContent = t('panel.hoopNone');
      hoopFit.className = 'panel-fit warning';
      return;
    }
    const fit = fitFor(s, resolved);
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

  function renderTrims(s: Session): void {
    const show = !lite && deps.getTarget() === 'zhs' && s.parsed.hasTrims;
    trimsField.hidden = !show;
    if (!show) return;
    for (const radio of trimsRadios) radio.checked = radio.value === s.trims;
    dropStops.textContent = t('panel.trimsStops', { n: s.stops.drop });
    pauseStops.textContent = t('panel.trimsStops', { n: s.stops.pause });
  }

  function renderActions(s: Session): void {
    const target = deps.getTarget();
    const same = target === s.parsed.sourceFormat;
    convertBtn.textContent = t('panel.convert', { fmt: target.toUpperCase() });
    convertBtn.disabled = same || s.converting;
    noteEl.hidden = !same;
    if (same) noteEl.textContent = t('panel.sameFormat', { fmt: target.toUpperCase() });
  }

  function renderControls(): void {
    if (session === null) return;
    renderHoop(session);
    renderTrims(session);
    renderActions(session);
  }

  function renderAll(): void {
    if (session === null) return;
    renderInfo(session);
    renderControls();
  }

  hoopSelect.addEventListener('change', () => {
    if (session === null) return;
    const v = hoopSelect.value;
    session.hoopChoice = v === 'auto' || v === 'declared' ? v : Number(v);
    renderHoop(session);
  });
  for (const radio of trimsRadios) {
    radio.addEventListener('change', () => {
      if (session === null || !radio.checked) return;
      session.trims = radio.value === 'pause' ? 'pause' : 'drop';
    });
  }
  centerCheck.addEventListener('change', () => {
    if (session === null) return;
    session.centerInHoop = centerCheck.checked;
    renderHoop(session);
  });
  convertBtn.addEventListener('click', () => {
    const s = session;
    if (s === null || s.converting) return;
    const options: WriterOptions = {};
    if (lite) {
      // Same defaults as the bulk flow: declared hoop passes through.
      if (s.parsed.pattern.hoop !== undefined) options.hoop = s.parsed.pattern.hoop;
    } else {
      const hoop = resolveHoop(s);
      if (hoop !== undefined) options.hoop = hoop;
      else if (s.parsed.pattern.hoop !== undefined) options.hoop = s.parsed.pattern.hoop;
      if (deps.getTarget() === 'zhs' && s.parsed.hasTrims) options.trims = s.trims;
    }
    s.converting = true;
    renderActions(s);
    void deps.convert(s.parsed, options, !centerField.hidden && s.centerInHoop).finally(() => {
      // Panel stays open: flip the chip and convert again without re-dropping.
      if (session === s) {
        s.converting = false;
        renderActions(s);
      }
    });
  });
  discardBtn.addEventListener('click', () => handle.close());

  const handle: PanelHandle = {
    open(parsed: ParsedFile): void {
      handle.close();
      const s: Session = {
        parsed,
        extents: computeExtents(parsed.pattern.stitches),
        stops: machineStops(parsed.pattern.stitches),
        hoopChoice: 'auto',
        trims: 'drop',
        centerInHoop: false,
        converting: false,
      };
      s.hoopChoice = defaultHoopChoice(s);
      session = s;
      centerCheck.checked = false;
      root.hidden = false;
      renderAll();
      // Mount only after the panel is visible so the container has a size.
      preview.mount(canvasBox, parsed.stitchData);
      deps.onLayoutChange?.();
    },
    close(): void {
      if (session === null) return;
      session = null;
      preview.dispose();
      root.hidden = true;
      deps.onLayoutChange?.();
    },
    onTargetChange(): void {
      if (session === null) return;
      // A brand switch invalidates a catalog pick; keep auto/declared.
      if (typeof session.hoopChoice === 'number') {
        session.hoopChoice = defaultHoopChoice(session);
      }
      renderControls();
    },
    refresh(): void {
      renderAll();
    },
  };
  return handle;
}
