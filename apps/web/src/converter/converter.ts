/**
 * Converter UI: spool chips (target format), dropzone, results list,
 * and the stitch-out handoff. Conversion itself is @embroidery/core; the
 * pattern is parsed once and reused for both writing and the sewn preview.
 */
import {
  checkFit,
  computeExtents,
  detectFormat,
  getReader,
  getWriter,
  supportedFormats,
  UnsupportedDesignError,
  FormatError,
} from '@embroidery/core';
import type { ConversionWarning, Pattern } from '@embroidery/core';
import { zipSync } from 'fflate';
import { t, currentLang, onLangChange } from '../i18n/i18n';
import { toStitchData } from '../stitch/runs';
import { playStitchOut } from './stitchout';

export const FORMAT_BRANDS: Record<string, string> = {
  vip: 'Husqvarna Viking / Pfaff',
  zhs: 'Zeng Hsing',
  dst: 'Tajima',
  exp: 'Melco',
  jef: 'Janome',
  pec: 'Brother',
  pes: 'Brother',
  vp3: 'Husqvarna Viking / Pfaff',
  hus: 'Husqvarna Viking',
  xxx: 'Singer',
  sew: 'Janome / Elna',
  shv: 'Husqvarna Viking',
  pcs: 'Pfaff',
};

/** Formats that carry an i18n caveat note ("note.<fmt>"). */
const NOTED_FORMATS = new Set(['zhs', 'pes', 'pec', 'jef', 'exp', 'hus', 'vip', 'xxx']);

interface FileOutcome {
  inputName: string;
  outputName: string;
  bytes: Uint8Array | null;
  warnings: ConversionWarning[];
  error: string | null;
  pattern: Pattern | null;
}

const { read: readableFormats, write: writableFormats } = supportedFormats();

let target = 'zhs';
let busy = false;
let lastOutcomes: FileOutcome[] = [];

function extensionOf(name: string): string | null {
  const dot = name.lastIndexOf('.');
  return dot >= 0 && dot < name.length - 1 ? name.slice(dot + 1).toLowerCase() : null;
}

function outputNameFor(inputName: string): string {
  return `${inputName.replace(/\.[^.]*$/, '')}.${target}`;
}

/** i18n message for input that never reaches the converter. */
function rejectInput(
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
  if (from === target) {
    return { error: t('err.alreadyTarget', { fmt: target.toUpperCase() }) };
  }
  return { from };
}

async function convertFile(file: File): Promise<FileOutcome> {
  const outcome: FileOutcome = {
    inputName: file.name,
    outputName: outputNameFor(file.name),
    bytes: null,
    warnings: [],
    error: null,
    pattern: null,
  };
  try {
    const data = new Uint8Array(await file.arrayBuffer());
    const verdict = rejectInput(file.name, detectFormat(data));
    if ('error' in verdict) {
      outcome.error = verdict.error;
      return outcome;
    }
    const pattern = getReader(verdict.from)(data);
    outcome.pattern = pattern;
    const { bytes, warnings } = getWriter(target)(pattern);
    outcome.bytes = bytes;
    outcome.warnings = warnings;
  } catch (e) {
    if (e instanceof UnsupportedDesignError) {
      const key = `err.${e.reason}`;
      const translated = t(key);
      outcome.error =
        translated === key ? t('err.unsupportedFallback', { msg: e.message }) : translated;
    } else if (e instanceof FormatError) {
      outcome.error = t('err.corrupt', { msg: e.message });
    } else {
      outcome.error = t('err.unexpected', { msg: String(e) });
    }
  }
  return outcome;
}

/** 0.1mm units → localized mm string ("77" / "77,5"). */
function mm(tenths: number): string {
  const locale = currentLang() === 'it' ? 'it-IT' : 'en-US';
  return (tenths / 10).toLocaleString(locale, { maximumFractionDigits: 1 });
}

/**
 * Design size plus, when the source declared a hoop, whether it still fits.
 * Built at render time so it re-localizes on language switch.
 */
function describePattern(pattern: Pattern): { text: string; overflow: boolean } {
  const ext = computeExtents(pattern.stitches);
  let text = t('result.size', { w: mm(ext.maxX - ext.minX), h: mm(ext.maxY - ext.minY) });
  const hoop = pattern.hoop;
  if (hoop === undefined) return { text, overflow: false };
  const fit = checkFit(pattern, hoop);
  const dims = { w: mm(hoop.width), h: mm(hoop.height) };
  if (!fit.fits) {
    text += ` ${t('result.hoopOverflow', { ...dims, ow: mm(fit.overflowX), oh: mm(fit.overflowY) })}`;
  } else if (fit.requiresCentering) {
    text += ` ${t('result.hoopRecenter', dims)}`;
  } else {
    text += ` ${t('result.hoopFits', dims)}`;
  }
  return { text, overflow: !fit.fits };
}

function triggerDownload(bytes: Uint8Array, name: string): void {
  const blob = new Blob([bytes.slice().buffer], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function initConverter(): void {
  const dropzone = document.getElementById('dropzone')!;
  const fileInput = document.getElementById('file-input') as HTMLInputElement;
  const resultsList = document.getElementById('results') as HTMLUListElement;
  const chipsList = document.getElementById('format-chips') as HTMLUListElement;
  const acceptHint = document.getElementById('accept-hint')!;

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
        // design-specific warnings here.
        for (const w of o.warnings.filter((w) => w.code !== 'METADATA_0X83_ZEROED')) {
          const p = document.createElement('p');
          p.className = 'warning';
          p.textContent = t(`warn.${w.code}`);
          li.append(p);
        }
        return li;
      }),
    );
  }

  async function handleFiles(files: File[]): Promise<void> {
    if (files.length === 0 || busy) return;
    busy = true;
    dropzone.classList.add('busy');
    try {
      const outcomes = await Promise.all(files.map((f) => convertFile(f)));
      lastOutcomes = outcomes;

      const converted = outcomes.filter(
        (o): o is FileOutcome & { bytes: Uint8Array } => o.bytes !== null,
      );
      const star = converted.find((o) => o.pattern !== null);
      if (star?.pattern != null) {
        try {
          await playStitchOut({
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
