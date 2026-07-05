/**
 * Converter UI in two shapes, one engine:
 * - 'instant' (landing): one file at a time, no options — drop → stitch-out
 *   spectacle → download with safe defaults. A multi-file drop converts
 *   nothing and points to the studio.
 * - 'studio' (/convert): a queue of parsed files with per-item options
 *   (hoop, ZHS trims, centering), machine presets, multi-format export and
 *   convert-all. Results live on the queue rows.
 */
import {
  center,
  detectFormat,
  getReader,
  getWriter,
  supportedFormats,
  UnsupportedDesignError,
  FormatError,
  HOOP_CATALOG,
} from '@embroidery/core';
import type { Hoop, WriterOptions } from '@embroidery/core';
import { zipSync } from 'fflate';
import { t, onLangChange } from '../i18n/i18n';
import { toStitchData } from '../stitch/runs';
import {
  computeItemDefaults,
  describePattern,
  extensionOf,
  FORMAT_BRANDS,
  HOOP_BRAND_BY_FORMAT,
  NOTED_FORMATS,
  outputNameFor,
  resolveHoop,
  triggerDownload,
  uniqueEntryName,
} from './shared';
import type {
  FileOutcome,
  FormatOutcome,
  ParsedFile,
  QueueItem,
  StitchOutJob,
} from './shared';
import { initPanel } from './panel';
import { initQueue } from './queue';
import { presetById, presetGroups } from './machines';

export interface ConverterHooks {
  mode: 'instant' | 'studio';
  /** Landing only: the stitch-out spectacle, awaited before download. */
  playStitchOut?: (job: StitchOutJob) => Promise<void>;
  /** Landing only: page height changed → ScrollTrigger must re-measure. */
  onLayoutChange?: () => void;
}

const { read: readableFormats, write: writableFormats } = supportedFormats();

let target = 'zhs';
let busy = false;

/** Resolve the source format, or an i18n reason the file can't be read. */
function resolveSource(
  fileName: string,
  detected: string | undefined,
): { error: string } | { from: string } {
  const ext = extensionOf(fileName);
  // Trust magic bytes; fall back to the extension for headerless formats.
  const from = detected ?? (ext !== null && readableFormats.includes(ext) ? ext : null);
  const list = readableFormats.join(', ');
  if (from === null) {
    if (ext !== null && !readableFormats.includes(ext)) {
      return { error: t('err.unreadableExt', { ext, list }) };
    }
    return { error: t('err.unrecognized', { list }) };
  }
  return { from };
}

function errorMessage(e: unknown): string {
  if (e instanceof UnsupportedDesignError) {
    const key = `err.${e.reason}`;
    const translated = t(key);
    return translated === key ? t('err.unsupportedFallback', { msg: e.message }) : translated;
  }
  if (e instanceof FormatError) return t('err.corrupt', { msg: e.message });
  return t('err.unexpected', { msg: String(e) });
}

/** Read bytes, sniff the format, run the reader. Never writes. */
async function parseFile(
  file: File,
): Promise<{ parsed: ParsedFile } | { error: string }> {
  try {
    const data = new Uint8Array(await file.arrayBuffer());
    const verdict = resolveSource(file.name, detectFormat(data));
    if ('error' in verdict) return verdict;
    const pattern = getReader(verdict.from)(data);
    return {
      parsed: {
        fileName: file.name,
        sourceFormat: verdict.from,
        pattern,
        stitchData: toStitchData(pattern),
        hasTrims: pattern.stitches.some((s) => s.command === 'TRIM'),
      },
    };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

/** Write one format with explicit options; bytes are returned, not stored. */
function writePattern(
  parsed: ParsedFile,
  format: string,
  options: WriterOptions | undefined,
  centerFirst: boolean,
): { bytes: Uint8Array | null; outcome: FormatOutcome } {
  const outcome: FormatOutcome = {
    format,
    outputName: outputNameFor(parsed.fileName, format),
    size: null,
    warnings: [],
    error: null,
    trimsChosen: options?.trims !== undefined,
  };
  try {
    const pattern = centerFirst ? center(parsed.pattern) : parsed.pattern;
    const { bytes, warnings } = getWriter(format)(pattern, options);
    outcome.size = bytes.byteLength;
    outcome.warnings = warnings;
    return { bytes, outcome };
  } catch (e) {
    outcome.error = errorMessage(e);
    return { bytes: null, outcome };
  }
}

export function initConverter(hooks: ConverterHooks): void {
  const dropzone = document.getElementById('dropzone')!;
  const fileInput = document.getElementById('file-input') as HTMLInputElement;
  const chipsList = document.getElementById('format-chips') as HTMLUListElement;
  const acceptHint = document.getElementById('accept-hint')!;
  const studio = hooks.mode === 'studio';

  function renderChips(): void {
    chipsList.replaceChildren(
      ...writableFormats.map((format) => {
        const li = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'chip';
        button.dataset['format'] = format;
        button.setAttribute('aria-pressed', String(format === target));
        if (format === target) button.classList.add('active');
        // Spool icon: a small rounded rect with winding lines, tinted by CSS.
        button.innerHTML =
          '<svg class="chip-spool" viewBox="0 0 24 24" aria-hidden="true">' +
          '<path d="M6 4h12M6 20h12M8 4v16M16 4v16" />' +
          '<path class="chip-thread" d="M8 8h8M8 11h8M8 14h8" />' +
          '</svg>';
        const label = document.createElement('span');
        label.textContent = format.toUpperCase();
        button.append(label);
        button.addEventListener('click', () => {
          if (busy || format === target) return;
          target = format;
          renderChips();
          refreshHint();
          onTargetChanged();
        });
        li.append(button);
        return li;
      }),
    );
  }

  function refreshHint(): void {
    const sources = readableFormats
      .filter((f) => f !== target)
      .map((f) => `.${f}`)
      .join(' ');
    const key = studio ? 'conv.acceptHintStudio' : 'conv.acceptHintInstant';
    acceptHint.textContent = t(key, { list: sources });
    fileInput.accept = readableFormats.map((f) => `.${f}`).join(',');
  }

  // ---------------------------------------------------------------- instant

  type ResultsState =
    | { kind: 'outcomes'; outcomes: FileOutcome[] }
    | { kind: 'nudge' }
    | null;
  let resultsState: ResultsState = null;
  const resultsList = document.getElementById('results') as HTMLUListElement | null;

  function renderResults(): void {
    if (resultsList === null) return;
    if (resultsState === null) {
      resultsList.hidden = true;
      resultsList.replaceChildren();
      hooks.onLayoutChange?.();
      return;
    }
    resultsList.hidden = false;
    if (resultsState.kind === 'nudge') {
      const li = document.createElement('li');
      li.className = 'notice';
      const p = document.createElement('p');
      p.textContent = t('conv.batchNudge');
      const a = document.createElement('a');
      a.href = '/convert';
      a.textContent = t('conv.batchNudgeLink');
      p.append(' ', a);
      li.append(p);
      resultsList.replaceChildren(li);
      hooks.onLayoutChange?.();
      return;
    }
    resultsList.replaceChildren(
      ...resultsState.outcomes.map((o) => {
        const li = document.createElement('li');
        li.className = o.error === null ? 'ok' : 'failed';
        const title = document.createElement('strong');
        title.textContent =
          o.error === null ? `${o.inputName} → ${o.outputName}` : o.inputName;
        li.append(title);
        if (o.error !== null) {
          const p = document.createElement('p');
          p.textContent = o.error;
          li.append(p);
        } else {
          if (o.pattern !== null) {
            const info = describePattern(o.pattern);
            const p = document.createElement('p');
            if (info.overflow) p.className = 'warning';
            p.textContent = info.text;
            li.append(p);
          }
          if (NOTED_FORMATS.has(target)) {
            const p = document.createElement('p');
            p.textContent = t(`note.${target}`);
            li.append(p);
          }
        }
        // The fixed ZHS 0x83 note lives in the footer.
        for (const w of o.warnings.filter((w) => w.code !== 'METADATA_0X83_ZEROED')) {
          const p = document.createElement('p');
          p.className = 'warning';
          p.textContent = t(`warn.${w.code}`);
          li.append(p);
        }
        return li;
      }),
    );
    hooks.onLayoutChange?.();
  }

  /** The landing demo: one file, safe defaults, spectacle, download. */
  async function instantConvert(file: File): Promise<void> {
    busy = true;
    dropzone.classList.add('busy');
    try {
      const result = await parseFile(file);
      let outcome: FileOutcome;
      let bytes: Uint8Array | null = null;
      if ('error' in result) {
        outcome = {
          inputName: file.name,
          outputName: outputNameFor(file.name, target),
          bytes: null,
          warnings: [],
          error: result.error,
          pattern: null,
        };
      } else if (result.parsed.sourceFormat === target) {
        outcome = {
          inputName: file.name,
          outputName: outputNameFor(file.name, target),
          bytes: null,
          warnings: [],
          error: t('err.alreadyTarget', { fmt: target.toUpperCase() }),
          pattern: result.parsed.pattern,
        };
      } else {
        const { parsed } = result;
        const declared = parsed.pattern.hoop;
        const written = writePattern(
          parsed,
          target,
          declared !== undefined ? { hoop: declared } : undefined,
          false,
        );
        bytes = written.bytes;
        outcome = {
          inputName: parsed.fileName,
          outputName: written.outcome.outputName,
          bytes,
          warnings: written.outcome.warnings,
          error: written.outcome.error,
          pattern: parsed.pattern,
        };
        if (bytes !== null && hooks.playStitchOut !== undefined) {
          try {
            await hooks.playStitchOut({ data: parsed.stitchData, fileName: parsed.fileName });
          } catch (e) {
            console.error('stitch-out animation failed, downloading anyway', e);
          }
        }
      }
      resultsState = { kind: 'outcomes', outcomes: [outcome] };
      renderResults();
      if (bytes !== null) triggerDownload(bytes, outcome.outputName);
    } finally {
      busy = false;
      dropzone.classList.remove('busy');
    }
  }

  // ---------------------------------------------------------------- studio

  const extras = new Set<string>();
  let activePresetId: string | null = null;
  let itemId = 0;
  const presetSelect = document.getElementById('preset-select') as HTMLSelectElement | null;
  const extraList = document.getElementById('extra-formats') as HTMLUListElement | null;

  function hoopCatalogFor(format: string): Hoop[] | undefined {
    const brand = HOOP_BRAND_BY_FORMAT[format];
    if (brand === undefined) return undefined;
    const preset = activePresetId !== null ? presetById(activePresetId) : undefined;
    if (preset !== undefined && preset.format === format && preset.hoops !== undefined) {
      return preset.hoops;
    }
    return HOOP_CATALOG[brand];
  }

  function formatsFor(item: QueueItem): string[] {
    if (item.parsed === null) return [];
    return [target, ...extras].filter((f) => f !== item.parsed!.sourceFormat);
  }

  function writerOptionsFor(item: QueueItem, format: string): WriterOptions {
    const options: WriterOptions = {};
    const hoop =
      resolveHoop(item, format, target, hoopCatalogFor(format)) ?? item.parsed?.pattern.hoop;
    if (hoop !== undefined) options.hoop = hoop;
    if (format === 'zhs' && item.parsed!.hasTrims) options.trims = item.options.trims;
    return options;
  }

  function invalidateDone(only?: QueueItem): void {
    const targets = only !== undefined ? [only] : queue.items();
    for (const item of targets) {
      if (item.status !== 'done') continue;
      item.status = 'ready';
      item.outcomes = [];
      item.skipped = [];
    }
  }

  /** Convert one item to all its effective formats; returns the files. */
  function runItem(item: QueueItem): Array<{ name: string; bytes: Uint8Array }> {
    const parsed = item.parsed!;
    const all = [target, ...extras];
    item.skipped = all.filter((f) => f === parsed.sourceFormat);
    const centerFirst = item.options.centerInHoop && hoopCatalogFor(target) !== undefined;
    const files: Array<{ name: string; bytes: Uint8Array }> = [];
    item.outcomes = formatsFor(item).map((format) => {
      const { bytes, outcome } = writePattern(
        parsed,
        format,
        writerOptionsFor(item, format),
        centerFirst,
      );
      if (bytes !== null) files.push({ name: outcome.outputName, bytes });
      return outcome;
    });
    item.status = files.length > 0 ? 'done' : 'failed';
    return files;
  }

  function downloadZip(
    files: Array<{ name: string; bytes: Uint8Array }>,
    zipName: string,
  ): void {
    const taken = new Set<string>();
    const entries: Record<string, Uint8Array> = {};
    for (const f of files) entries[uniqueEntryName(taken, f.name)] = f.bytes;
    triggerDownload(zipSync(entries), zipName);
  }

  async function convertItem(item: QueueItem): Promise<void> {
    if (busy) return;
    busy = true;
    queue.setBusy(true);
    try {
      const files = runItem(item);
      if (files.length === 1) {
        triggerDownload(files[0]!.bytes, files[0]!.name);
      } else if (files.length > 1) {
        const base = item.fileName.replace(/\.[^.]*$/, '');
        downloadZip(files, `restitch-${base}.zip`);
      }
    } finally {
      busy = false;
      queue.setBusy(false);
      panel.rerender();
    }
  }

  function pendingItems(): QueueItem[] {
    return queue.items().filter((i) => i.status === 'ready' && formatsFor(i).length > 0);
  }

  async function convertAll(): Promise<void> {
    if (busy) return;
    busy = true;
    queue.setBusy(true);
    try {
      const all: Array<{ name: string; bytes: Uint8Array }> = [];
      for (const item of pendingItems()) {
        all.push(...runItem(item));
        queue.render();
        // Writers are synchronous CPU work: yield so status dots repaint.
        await new Promise((r) => setTimeout(r));
      }
      if (all.length === 1) {
        triggerDownload(all[0]!.bytes, all[0]!.name);
      } else if (all.length > 1) {
        const exts = new Set(all.map((f) => extensionOf(f.name)));
        const zipName =
          exts.size === 1 ? `restitch-${[...exts][0]}.zip` : 'restitch-batch.zip';
        downloadZip(all, zipName);
      }
    } finally {
      busy = false;
      queue.setBusy(false);
      panel.rerender();
    }
  }

  const queue = initQueue({
    onSelect: (item) => (item !== null ? panel.show(item) : panel.clear()),
    onRemove: () => hooks.onLayoutChange?.(),
    onConvertAll: () => void convertAll(),
    pendingCount: () => pendingItems().length,
    onLayoutChange: hooks.onLayoutChange,
  });

  const panel = initPanel({
    getTarget: () => target,
    formatsFor,
    hoopCatalogFor,
    convertItem,
    removeItem: (item) => queue.remove(item),
    onOptionsChange: (item) => {
      invalidateDone(item);
      queue.render();
    },
    onLayoutChange: hooks.onLayoutChange,
  });

  function renderPresetSelect(): void {
    if (presetSelect === null) return;
    const none = document.createElement('option');
    none.value = '';
    none.textContent = t('tool.presetNone');
    const groups = presetGroups().map(({ label, presets }) => {
      const options = presets.map((p) => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.label;
        return opt;
      });
      if (label === '') return options;
      const group = document.createElement('optgroup');
      group.label = label;
      group.append(...options);
      return [group];
    });
    presetSelect.replaceChildren(none, ...groups.flat());
    presetSelect.value = activePresetId ?? '';
  }

  function resetCatalogPicks(): void {
    for (const item of queue.items()) {
      if (typeof item.options.hoopChoice === 'number') {
        item.options.hoopChoice = item.parsed?.pattern.hoop !== undefined ? 'declared' : 'auto';
      }
    }
  }

  function renderExtraFormats(): void {
    if (extraList === null) return;
    extraList.replaceChildren(
      ...writableFormats
        .filter((f) => f !== target)
        .map((format) => {
          const li = document.createElement('li');
          const label = document.createElement('label');
          label.className = 'extra-option';
          const input = document.createElement('input');
          input.type = 'checkbox';
          input.value = format;
          input.checked = extras.has(format);
          input.addEventListener('change', () => {
            if (input.checked) extras.add(format);
            else extras.delete(format);
            invalidateDone();
            queue.render();
            panel.rerender();
          });
          const text = document.createElement('span');
          text.textContent = format.toUpperCase();
          label.append(input, text);
          li.append(label);
          return li;
        }),
    );
  }

  function onTargetChanged(): void {
    if (!studio) {
      renderResults();
      return;
    }
    extras.delete(target);
    const preset = activePresetId !== null ? presetById(activePresetId) : undefined;
    if (preset !== undefined && preset.format !== target) {
      activePresetId = null;
      renderPresetSelect();
    }
    resetCatalogPicks();
    invalidateDone();
    renderExtraFormats();
    queue.render();
    panel.rerender();
  }

  if (presetSelect !== null) {
    presetSelect.addEventListener('change', () => {
      activePresetId = presetSelect.value === '' ? null : presetSelect.value;
      const preset = activePresetId !== null ? presetById(activePresetId) : undefined;
      if (preset !== undefined && preset.format !== target) {
        target = preset.format;
        renderChips();
        refreshHint();
        extras.delete(target);
      }
      resetCatalogPicks();
      invalidateDone();
      renderExtraFormats();
      queue.render();
      panel.rerender();
    });
  }

  async function enqueueFiles(files: File[]): Promise<void> {
    const items: QueueItem[] = [];
    for (const file of files) {
      const result = await parseFile(file);
      if ('error' in result) {
        items.push({
          id: ++itemId,
          fileName: file.name,
          parsed: null,
          parseError: result.error,
          extents: null,
          stops: { drop: 0, pause: 0 },
          stats: { jumps: 0, trims: 0, stops: 0 },
          options: { hoopChoice: 'auto', trims: 'drop', centerInHoop: false },
          status: 'failed',
          skipped: [],
          outcomes: [],
        });
      } else {
        items.push({
          id: ++itemId,
          fileName: file.name,
          ...computeItemDefaults(result.parsed),
        });
      }
    }
    queue.add(items);
  }

  // ---------------------------------------------------------------- wiring

  async function handleFiles(files: File[]): Promise<void> {
    if (files.length === 0 || busy) return;
    if (studio) return enqueueFiles(files);
    if (files.length > 1) {
      resultsState = { kind: 'nudge' };
      renderResults();
      return;
    }
    return instantConvert(files[0]!);
  }

  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') fileInput.click();
  });
  fileInput.addEventListener('change', () => {
    void handleFiles(Array.from(fileInput.files ?? []));
    fileInput.value = '';
  });
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragging');
  });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragging'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragging');
    void handleFiles(Array.from(e.dataTransfer?.files ?? []));
  });

  renderChips();
  refreshHint();
  if (studio) {
    renderPresetSelect();
    renderExtraFormats();
  }
  onLangChange(() => {
    refreshHint();
    if (studio) {
      renderPresetSelect();
      queue.render();
      panel.rerender();
    } else {
      renderResults();
    }
  });
}

/**
 * S4 typographic wall: one item per readable format, styles by capability.
 * Everything derives from supportedFormats() so new core formats appear
 * here (and in the counts) with zero UI changes.
 */
export function renderFormatWall(wall: HTMLElement, sub: HTMLElement): void {
  function build(): void {
    wall.replaceChildren(
      ...readableFormats.map((format) => {
        const li = document.createElement('li');
        li.textContent = `.${format}`;
        if (format === 'zhs') li.className = 'wall-zhs';
        else if (writableFormats.includes(format)) li.className = 'wall-write';
        else li.className = 'wall-read';
        const brand = FORMAT_BRANDS[format];
        if (brand !== undefined) li.title = brand;
        return li;
      }),
    );
    sub.textContent = t('atoz.sub', {
      nRead: readableFormats.length,
      nWrite: writableFormats.length,
    });
  }
  build();
  onLangChange(build);
}
