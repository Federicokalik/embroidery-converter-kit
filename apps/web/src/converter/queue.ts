/**
 * Studio queue: the list of dropped files with status, selection and
 * per-item notes (parse errors, per-format outcomes, warnings, caveats).
 * Owns the #queue-bar / #queue DOM; converter.ts owns all conversion
 * logic and pushes state changes through render().
 */
import { t, currentLang } from '../i18n/i18n';
import { mm, NOTED_FORMATS } from './shared';
import type { QueueItem } from './shared';

export interface QueueDeps {
  onSelect(item: QueueItem | null): void;
  onRemove(item: QueueItem): void;
  onConvertAll(): void;
  /** Items ready to convert with a non-empty format list. */
  pendingCount(): number;
  onLayoutChange?: (() => void) | undefined;
}

export interface QueueHandle {
  add(items: QueueItem[]): void;
  items(): QueueItem[];
  selected(): QueueItem | null;
  remove(item: QueueItem): void;
  /** Full re-render of rows + bar (also the language-change hook). */
  render(): void;
  /** Conversion in flight: freeze remove/convert-all. */
  setBusy(busy: boolean): void;
}

export function initQueue(deps: QueueDeps): QueueHandle {
  const bar = document.getElementById('queue-bar') as HTMLElement | null;
  const list = document.getElementById('queue') as HTMLUListElement | null;
  const count = document.getElementById('queue-count') as HTMLElement | null;
  const convertAllBtn = document.getElementById('convert-all-btn') as HTMLButtonElement | null;
  if (bar === null || list === null || count === null || convertAllBtn === null) {
    return {
      add: () => {},
      items: () => [],
      selected: () => null,
      remove: () => {},
      render: () => {},
      setBusy: () => {},
    };
  }

  let queue: QueueItem[] = [];
  let selectedId: number | null = null;
  let busy = false;

  const selectedItem = (): QueueItem | null =>
    queue.find((i) => i.id === selectedId) ?? null;

  function select(item: QueueItem | null): void {
    selectedId = item?.id ?? null;
    render();
    deps.onSelect(item);
  }

  function remove(item: QueueItem): void {
    const index = queue.indexOf(item);
    queue = queue.filter((i) => i !== item);
    if (selectedId === item.id) {
      const next =
        queue.slice(index).find((i) => i.parsed !== null) ??
        [...queue.slice(0, index)].reverse().find((i) => i.parsed !== null) ??
        null;
      selectedId = next?.id ?? null;
      deps.onSelect(next);
    }
    render();
    deps.onRemove(item);
  }

  function statusWord(item: QueueItem): string {
    if (item.status === 'done') return t('queue.statusDone');
    if (item.status === 'failed') return t('queue.statusFailed');
    return t('queue.statusReady');
  }

  function renderNotes(item: QueueItem): HTMLElement {
    const notes = document.createElement('div');
    notes.className = 'queue-notes';
    const line = (text: string, cls?: string): void => {
      const p = document.createElement('p');
      if (cls !== undefined) p.className = cls;
      p.textContent = text;
      notes.append(p);
    };
    if (item.parseError !== null) line(item.parseError, 'error');
    for (const fmt of item.skipped) {
      line(t('queue.skipped', { fmt: fmt.toUpperCase() }));
    }
    const locale = currentLang() === 'it' ? 'it-IT' : 'en-US';
    for (const o of item.outcomes) {
      if (o.error !== null) {
        line(`${o.format.toUpperCase()}: ${o.error}`, 'error');
        continue;
      }
      const kb = o.size !== null ? (o.size / 1024).toLocaleString(locale, {
        maximumFractionDigits: 1,
      }) : '?';
      line(`${o.format.toUpperCase()} → ${o.outputName} (${kb} kB)`);
      const hidden = new Set(['METADATA_0X83_ZEROED']);
      if (o.trimsChosen) hidden.add('TRIM_DROPPED');
      for (const w of o.warnings.filter((w) => !hidden.has(w.code))) {
        line(t(`warn.${w.code}`), 'warning');
      }
      if (NOTED_FORMATS.has(o.format)) line(t(`note.${o.format}`));
    }
    notes.hidden = notes.childElementCount === 0;
    return notes;
  }

  function renderRow(item: QueueItem): HTMLLIElement {
    const li = document.createElement('li');
    li.className = `queue-row ${item.status}`;
    if (item.id === selectedId) li.classList.add('selected');
    li.dataset['id'] = String(item.id);

    const main = document.createElement('button');
    main.type = 'button';
    main.className = 'queue-main';
    const dot = document.createElement('span');
    dot.className = 'queue-dot';
    const name = document.createElement('span');
    name.className = 'queue-name mono';
    name.textContent = item.fileName;
    const meta = document.createElement('span');
    meta.className = 'queue-meta';
    if (item.parsed !== null && item.extents !== null) {
      meta.textContent = t('queue.meta', {
        fmt: `.${item.parsed.sourceFormat}`,
        stitches: item.parsed.stitchData.stitchCount.toLocaleString(
          currentLang() === 'it' ? 'it-IT' : 'en-US',
        ),
        w: mm(item.extents.maxX - item.extents.minX),
        h: mm(item.extents.maxY - item.extents.minY),
      });
    }
    const status = document.createElement('span');
    status.className = 'queue-status mono';
    status.textContent = statusWord(item);
    main.append(dot, name, meta, status);
    if (item.parsed !== null) {
      main.addEventListener('click', () => select(item));
    } else {
      main.disabled = true;
    }

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'queue-remove';
    removeBtn.textContent = '×';
    removeBtn.setAttribute('aria-label', t('queue.remove', { name: item.fileName }));
    removeBtn.disabled = busy;
    removeBtn.addEventListener('click', () => remove(item));

    li.append(main, removeBtn);
    li.append(renderNotes(item));
    return li;
  }

  function render(): void {
    const empty = queue.length === 0;
    bar!.hidden = empty;
    list!.hidden = empty;
    if (empty) {
      list!.replaceChildren();
      deps.onLayoutChange?.();
      return;
    }
    count!.textContent =
      queue.length === 1 ? t('queue.countOne') : t('queue.count', { n: queue.length });
    const pending = deps.pendingCount();
    convertAllBtn!.textContent = busy
      ? t('tool.converting')
      : t('tool.convertAll', { n: pending });
    convertAllBtn!.disabled = busy || pending === 0;
    list!.replaceChildren(...queue.map((item) => renderRow(item)));
    deps.onLayoutChange?.();
  }

  convertAllBtn.addEventListener('click', () => {
    if (!busy) deps.onConvertAll();
  });

  return {
    add(items: QueueItem[]): void {
      queue.push(...items);
      if (selectedItem() === null) {
        const first = items.find((i) => i.parsed !== null) ?? null;
        if (first !== null) {
          selectedId = first.id;
          deps.onSelect(first);
        }
      }
      render();
    },
    items: () => queue,
    selected: selectedItem,
    remove,
    render,
    setBusy(next: boolean): void {
      busy = next;
      render();
    },
  };
}
