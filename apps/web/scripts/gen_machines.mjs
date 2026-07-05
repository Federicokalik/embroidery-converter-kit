/**
 * Machine-preset generator: reads every reports_files/*.csv (one file per
 * research AI, schema: brand,model,aliases,year,format_primary,formats_other,
 * max_field_w_mm,max_field_h_mm,hoop_name,hoop_w_mm,hoop_h_mm,hoop_code,
 * trimmer,source_url,confidence,notes — one row per machine×hoop), reconciles
 * across sources and emits src/converter/machines-data.ts plus a human
 * review log at reports_files/RECONCILED.md.
 *
 * Reconciliation: a (brand, model, hoop) row is kept when confirmed by ≥2
 * source files, or when a single source rates it high-confidence. Dimension
 * conflicts keep the smaller (more conservative) stitching area. Machines
 * whose primary format we cannot write fall back to the first writable
 * format in formats_other, else the machine is skipped. Everything dropped
 * is logged for review.
 *
 * Usage: node apps/web/scripts/gen_machines.mjs   (from the repo root or anywhere)
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../..');
const REPORTS = join(ROOT, 'reports_files');
const OUT_TS = join(HERE, '../src/converter/machines-data.ts');
const OUT_MD = join(REPORTS, 'RECONCILED.md');

/** Formats the core can WRITE (keep in sync with packages/core registry). */
const WRITABLE = new Set(['zhs', 'dst', 'exp', 'jef', 'pec', 'pes', 'vp3', 'hus', 'vip', 'xxx']);

/** Plausible stitching-field bounds in mm (Brother SA439 is a real 20x60). */
const MIN_MM = 20;
const MAX_MM = 500;

/** Mirror of core JEF_HOOPS (index = on-disk code) for the code cross-check. */
const JEF_HOOPS = [
  [110, 110],
  [50, 50],
  [140, 200],
  [126, 110],
  [200, 200],
];

// ---------- tiny CSV parser (quoted fields, commas, CRLF) ----------

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((f) => f.trim() !== '')) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    if (row.some((f) => f.trim() !== '')) rows.push(row);
  }
  return rows;
}

function toObjects(rows) {
  const header = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((r) => {
    const o = {};
    header.forEach((h, i) => {
      o[h] = (r[i] ?? '').trim();
    });
    return o;
  });
}

// ---------- load every report ----------

const sources = readdirSync(REPORTS)
  .filter((f) => f.toLowerCase().endsWith('.csv'))
  .sort();
if (sources.length === 0) {
  console.error(`No CSV reports found in ${REPORTS}`);
  process.exit(1);
}

const raw = [];
for (const file of sources) {
  const objects = toObjects(parseCsv(readFileSync(join(REPORTS, file), 'utf8')));
  for (const o of objects) raw.push({ ...o, __source: file });
}

// ---------- normalize + sanity-filter rows ----------

const dropped = []; // {reason, row}
const norm = [];
for (const r of raw) {
  const brand = r.brand?.trim();
  const model = r.model?.trim();
  const w = Number.parseFloat(r.hoop_w_mm);
  const h = Number.parseFloat(r.hoop_h_mm);
  if (!brand || !model) {
    dropped.push({ reason: 'missing brand/model', row: r });
    continue;
  }
  if (!Number.isFinite(w) || !Number.isFinite(h)) {
    dropped.push({ reason: 'missing hoop dimensions', row: r });
    continue;
  }
  if (w < MIN_MM || w > MAX_MM || h < MIN_MM || h > MAX_MM) {
    dropped.push({ reason: `hoop ${w}x${h}mm outside ${MIN_MM}-${MAX_MM}`, row: r });
    continue;
  }
  const code = Number(r.hoop_code);
  norm.push({
    source: r.__source,
    brand,
    model,
    formatPrimary: (r.format_primary ?? '').toLowerCase(),
    formatsOther: (r.formats_other ?? '')
      .split(/[,;\s]+/)
      .map((f) => f.trim().toLowerCase())
      .filter(Boolean),
    hoopName: r.hoop_name?.trim() || undefined,
    w,
    h,
    hoopCode: r.hoop_code !== '' && Number.isFinite(code) ? code : undefined,
    trimmer: /^y/i.test(r.trimmer ?? ''),
    confidence: (r.confidence ?? '').toLowerCase(),
  });
}

// Brand-level corroboration: the same hoop dimensions reported for a brand
// by ANOTHER source file (any machine — brands share hoops across lineups)
// backs up a single-source medium-confidence row.
const brandDimsBySource = new Map(); // 'brand|WxH' -> Set<source>
for (const r of norm) {
  const k = `${r.brand.toLowerCase()}|${r.w}x${r.h}`;
  if (!brandDimsBySource.has(k)) brandDimsBySource.set(k, new Set());
  brandDimsBySource.get(k).add(r.source);
}

// ---------- reconcile hoops per machine ----------

const machineKey = (r) => `${r.brand.toLowerCase()}|${r.model.toLowerCase()}`;
const hoopKey = (r) => `${r.w}x${r.h}`;

const machines = new Map(); // key -> {brand, model, rows[]}
for (const r of norm) {
  const key = machineKey(r);
  if (!machines.has(key)) machines.set(key, { brand: r.brand, model: r.model, rows: [] });
  machines.get(key).rows.push(r);
}

const jefCodeMismatches = [];
const skippedMachines = [];
const presets = [];

for (const m of machines.values()) {
  // Format: majority primary across rows, then writable fallback.
  const primaries = [...new Set(m.rows.map((r) => r.formatPrimary))];
  let format = primaries.find((f) => WRITABLE.has(f));
  if (format === undefined) {
    const others = [...new Set(m.rows.flatMap((r) => r.formatsOther))];
    format = others.find((f) => WRITABLE.has(f));
  }
  if (format === undefined) {
    skippedMachines.push({
      machine: `${m.brand} ${m.model}`,
      reason: `no writable format (primary: ${primaries.join('/') || '—'})`,
    });
    continue;
  }

  // Hoops: group by dimensions; keep multi-source or high-confidence rows.
  const byHoop = new Map();
  for (const r of m.rows) {
    const k = hoopKey(r);
    if (!byHoop.has(k)) byHoop.set(k, []);
    byHoop.get(k).push(r);
  }
  const hoops = [];
  for (const rows of byHoop.values()) {
    const sourceCount = new Set(rows.map((r) => r.source)).size;
    const high = rows.some((r) => r.confidence === 'high');
    const medium = rows.some((r) => r.confidence === 'medium');
    const brandBacked =
      brandDimsBySource.get(`${m.brand.toLowerCase()}|${rows[0].w}x${rows[0].h}`).size >= 2;
    if (sourceCount < 2 && !high && !(medium && brandBacked)) {
      dropped.push({ reason: 'single-source, not high, not brand-corroborated', row: rows[0] });
      continue;
    }
    const r = rows[0];
    hoops.push({ width: Math.round(r.w * 10), height: Math.round(r.h * 10), name: r.hoopName });
    // JEF hoop-code cross-check against the core table.
    if (format === 'jef' && r.hoopCode !== undefined) {
      const expected = JEF_HOOPS[r.hoopCode];
      if (!expected || expected[0] !== r.w || expected[1] !== r.h) {
        jefCodeMismatches.push(
          `${m.brand} ${m.model} "${r.hoopName ?? ''}" code ${r.hoopCode} ` +
            `claims ${r.w}x${r.h}mm, core table says ${expected ? expected.join('x') : 'no such code'}`,
        );
      }
    }
  }
  if (hoops.length === 0) {
    skippedMachines.push({ machine: `${m.brand} ${m.model}`, reason: 'no hoop rows survived' });
    continue;
  }
  hoops.sort((a, b) => a.width * a.height - b.width * b.height);

  const id = `${m.brand} ${m.model}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  presets.push({
    id,
    brand: m.brand,
    label: `${m.brand} ${m.model}`,
    format,
    formatFallback: !WRITABLE.has(m.rows[0].formatPrimary),
    trimmer: m.rows.every((r) => r.trimmer),
    hoops,
  });
}

presets.sort((a, b) => a.label.localeCompare(b.label));

// Duplicate-id guard (aliases/rebrands can collide after kebab-casing).
const seenIds = new Set();
for (const p of presets) {
  while (seenIds.has(p.id)) p.id += '-2';
  seenIds.add(p.id);
}

// ---------- emit machines-data.ts ----------

const lines = [];
lines.push('// GENERATED from reports_files/ — do not hand-edit.');
lines.push('// Rerun: node apps/web/scripts/gen_machines.mjs');
lines.push(`// Sources: ${sources.join(', ')} — ${presets.length} machines, see reports_files/RECONCILED.md`);
lines.push("import type { MachinePreset } from './machines';");
lines.push('');
lines.push('export const MACHINE_MODELS: MachinePreset[] = [');
for (const p of presets) {
  const hoops = p.hoops
    .map((h) => {
      const name = h.name !== undefined ? `, name: ${JSON.stringify(h.name)}` : '';
      return `{ width: ${h.width}, height: ${h.height}${name} }`;
    })
    .join(', ');
  lines.push(
    `  { id: ${JSON.stringify(p.id)}, brand: ${JSON.stringify(p.brand)}, ` +
      `label: ${JSON.stringify(p.label)}, format: ${JSON.stringify(p.format)}, ` +
      `hoops: [${hoops}] },`,
  );
}
lines.push('];');
lines.push('');
writeFileSync(OUT_TS, lines.join('\n'));

// ---------- emit RECONCILED.md ----------

const md = [];
md.push('# Machine catalog reconciliation report');
md.push('');
md.push(`Generated by \`apps/web/scripts/gen_machines.mjs\` from: ${sources.join(', ')}.`);
md.push('');
md.push(`- Input rows: ${raw.length} (${machines.size} distinct machines)`);
md.push(`- Emitted machines: ${presets.length} (${presets.reduce((n, p) => n + p.hoops.length, 0)} hoops)`);
md.push(`- Skipped machines: ${skippedMachines.length}`);
md.push(`- Dropped rows: ${dropped.length}`);
md.push('');
if (skippedMachines.length > 0) {
  md.push('## Skipped machines');
  md.push('');
  for (const s of skippedMachines) md.push(`- **${s.machine}** — ${s.reason}`);
  md.push('');
}
const fallbacks = presets.filter((p) => p.formatFallback);
if (fallbacks.length > 0) {
  md.push('## Writable-format fallbacks (primary format not writable by the core)');
  md.push('');
  for (const p of fallbacks) md.push(`- **${p.label}** → ${p.format.toUpperCase()}`);
  md.push('');
}
if (jefCodeMismatches.length > 0) {
  md.push('## JEF hoop-code mismatches vs core table (review!)');
  md.push('');
  for (const s of jefCodeMismatches) md.push(`- ${s}`);
  md.push('');
}
if (dropped.length > 0) {
  md.push('## Dropped rows');
  md.push('');
  for (const d of dropped) {
    const r = d.row;
    md.push(
      `- [${r.__source ?? r.source}] ${r.brand ?? '?'} ${r.model ?? '?'} ` +
        `"${r.hoop_name ?? r.hoopName ?? ''}" — ${d.reason}`,
    );
  }
  md.push('');
}
writeFileSync(OUT_MD, md.join('\n'));

console.log(
  `machines-data.ts: ${presets.length} machines from ${sources.length} report(s); ` +
    `${skippedMachines.length} skipped, ${dropped.length} rows dropped. See RECONCILED.md.`,
);
