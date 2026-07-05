/**
 * Converter UI: spool chips (target format), dropzone, results list.
 * One file dropped → the single-file panel (preview + hoop + trims,
 * explicit Convert). Several files → automatic bulk conversion with the
 * declared hoop passed through source→destination, downloaded as a ZIP.
 *
 * Landing-only behavior (stitch-out spectacle, ScrollTrigger refresh) is
 * injected via ConverterHooks so the /convert page ships none of it.
 */
import {
  center,
  detectFormat,
  getReader,
  getWriter,
  supportedFormats,
  UnsupportedDesignError,
  FormatError,
} from '@embroidery/core';
import type { WriterOptions } from '@embroidery/core';
import { zipSync } from 'fflate';
import { t, onLangChange } from '../i18n/i18n';
import { toStitchData } from '../stitch/runs';
import {
  describePattern,
  extensionOf,
  FORMAT_BRANDS,
  NOTED_FORMATS,
  triggerDownload,
} from './shared';
import type { FileOutcome, ParsedFile, StitchOutJob } from './shared';
import { initPanel } from './panel';

export interface ConverterHooks {
  /** Landing only: the stitch-out spectacle, awaited before download. */
  playStitchOut?: (job: StitchOutJob) => Promise<void>;
  /** Landing only: page height changed → ScrollTrigger must re-measure. */
  onLayoutChange?: () => void;
}

const { read: readableFormats, write: writableFormats } = supportedFormats();

let target = 'zhs';
let busy = false;
let lastOutcomes: FileOutcome[] = [];

function outputNameFor(inputName: string): string {
  return `${inputName.replace(/\.[^.]*$/, '')}.${target}`;
}

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

function failedOutcome(fileName: string, error: string): FileOutcome {
  return {
    inputName: fileName,
    outputName: outputNameFor(fileName),
    bytes: null,
    warnings: [],
    error,
    pattern: null,
  };
}

/**
 * Read bytes, sniff the format, run the reader. Never writes. With
 * allowTarget the from===target rejection is skipped: the panel disables
 * Convert instead, and the chip may change without re-parsing.
 */
async function parseFile(
  file: File,
  allowTarget: boolean,
): Promise<{ parsed: ParsedFile } | { outcome: FileOutcome }> {
  try {
    const data = new Uint8Array(await file.arrayBuffer());
    const verdict = resolveSource(file.name, detectFormat(data));
    if ('error' in verdict) return { outcome: failedOutcome(file.name, verdict.error) };
    if (!allowTarget && verdict.from === target) {
      return {
        outcome: failedOutcome(file.name, t('err.alreadyTarget', { fmt: target.toUpperCase() })),
      };
    }
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
    return { outcome: failedOutcome(file.name, errorMessage(e)) };
  }
}

/** Write with explicit options; optionally recenter the design first. */
function writePattern(
  parsed: ParsedFile,
  options: WriterOptions | undefined,
  centerFirst: boolean,
): FileOutcome {
  const outcome: FileOutcome = {
    inputName: parsed.fileName,
    outputName: outputNameFor(parsed.fileName),
    bytes: null,
    warnings: [],
    error: null,
    pattern: parsed.pattern,
  };
  try {
    const pattern = centerFirst ? center(parsed.pattern) : parsed.pattern;
    const { bytes, warnings } = getWriter(target)(pattern, options);
    outcome.bytes = bytes;
    outcome.warnings = warnings;
  } catch (e) {
    outcome.error = errorMessage(e);
  }
  return outcome;
}

export function initConverter(hooks: ConverterHooks = {}): void {
  const dropzone = document.getElementById('dropzone')!;
  const fileInput = document.getElementById('file-input') as HTMLInputElement;
  const resultsList = document.getElementById('results') as HTMLUListElement;
  const chipsList = document.getElementById('format-chips') as HTMLUListElement;
  const acceptHint = document.getElementById('accept-hint')!;

  const panel = initPanel({
    getTarget: () => target,
    convert: convertSingle,
    onLayoutChange: hooks.onLayoutChange,
  });

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
          renderResults();
          panel.onTargetChange();
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
    acceptHint.textContent = t('conv.acceptHint', { list: sources });
    fileInput.accept = readableFormats.map((f) => `.${f}`).join(',');
  }

  function renderResults(): void {
    if (lastOutcomes.length === 0) {
      resultsList.hidden = true;
      resultsList.replaceChildren();
      hooks.onLayoutChange?.();
      return;
    }
    resultsList.hidden = false;
    resultsList.replaceChildren(
      ...lastOutcomes.map((o) => {
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
        // The fixed ZHS 0x83 note lives in the footer; show only
        // design-specific warnings here. TRIM_DROPPED is noise when the
        // user explicitly chose the drop mode in the panel.
        const hidden = new Set(['METADATA_0X83_ZEROED']);
        if (o.trimsChosen === true) hidden.add('TRIM_DROPPED');
        for (const w of o.warnings.filter((w) => !hidden.has(w.code))) {
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

  /** Explicit Convert from the single-file panel. */
  async function convertSingle(
    parsed: ParsedFile,
    options: WriterOptions,
    centerFirst: boolean,
  ): Promise<void> {
    if (busy) return;
    busy = true;
    dropzone.classList.add('busy');
    try {
      const outcome = writePattern(parsed, options, centerFirst);
      if (options.trims !== undefined) outcome.trimsChosen = true;
      lastOutcomes = [outcome];
      if (outcome.bytes !== null && hooks.playStitchOut !== undefined) {
        try {
          await hooks.playStitchOut({
            data: parsed.stitchData,
            fileName: parsed.fileName,
            extraCount: 0,
          });
        } catch (e) {
          console.error('stitch-out animation failed, downloading anyway', e);
        }
      }
      renderResults();
      if (outcome.bytes !== null) triggerDownload(outcome.bytes, outcome.outputName);
    } finally {
      busy = false;
      dropzone.classList.remove('busy');
    }
  }

  async function openSingle(file: File): Promise<void> {
    const result = await parseFile(file, true);
    if ('outcome' in result) {
      lastOutcomes = [result.outcome];
      renderResults();
      return;
    }
    lastOutcomes = [];
    renderResults();
    panel.open(result.parsed);
  }

  /** 2+ files: automatic conversion, declared hoop passed through. */
  async function convertBulk(files: File[]): Promise<void> {
    busy = true;
    dropzone.classList.add('busy');
    try {
      const outcomes = await Promise.all(
        files.map(async (file) => {
          const result = await parseFile(file, false);
          if ('outcome' in result) return result.outcome;
          const hoop = result.parsed.pattern.hoop;
          return writePattern(
            result.parsed,
            hoop !== undefined ? { hoop } : undefined,
            false,
          );
        }),
      );
      lastOutcomes = outcomes;

      const converted = outcomes.filter(
        (o): o is FileOutcome & { bytes: Uint8Array } => o.bytes !== null,
      );
      const star = converted.find((o) => o.pattern !== null);
      if (star?.pattern != null && hooks.playStitchOut !== undefined) {
        try {
          await hooks.playStitchOut({
            data: toStitchData(star.pattern),
            fileName: star.inputName,
            extraCount: converted.length - 1,
          });
        } catch (e) {
          console.error('stitch-out animation failed, downloading anyway', e);
        }
      }
      renderResults();

      if (converted.length === 1) {
        triggerDownload(converted[0]!.bytes, converted[0]!.outputName);
      } else if (converted.length > 1) {
        const entries: Record<string, Uint8Array> = {};
        for (const o of converted) entries[o.outputName] = o.bytes;
        triggerDownload(zipSync(entries), `restitch-${target}.zip`);
      }
    } finally {
      busy = false;
      dropzone.classList.remove('busy');
    }
  }

  async function handleFiles(files: File[]): Promise<void> {
    if (files.length === 0 || busy) return;
    panel.close();
    if (files.length === 1) return openSingle(files[0]!);
    return convertBulk(files);
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
  onLangChange(() => {
    refreshHint();
    renderResults();
    panel.refresh();
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
