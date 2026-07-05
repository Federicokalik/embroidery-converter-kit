/**
 * embconv — command-line front-end for @embroidery/core.
 *
 *   embconv <input> <output> [--hoop <WxH>] [--center]
 *   embconv --batch <dir> --to <fmt> [--out <dir>] [--hoop <WxH>] [--center]
 *   embconv info <file> [--hoop <WxH>] [--brand <brand>]
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import {
  center,
  checkFit,
  convert,
  detectFormat,
  FormatError,
  getReader,
  getWriter,
  HOOP_CATALOG,
  selectSmallestHoop,
  supportedFormats,
  UnsupportedDesignError,
} from '@embroidery/core';
import type { Command, Hoop, HoopBrand, Pattern, WriterOptions } from '@embroidery/core';

function usage(): never {
  const { read, write } = supportedFormats();
  console.error(
    [
      'Usage:',
      '  embconv <input> <output> [--hoop <WxH>] [--center] [--pause-trims]',
      '  embconv --batch <dir> --to <format> [--out <dir>] [--hoop <WxH>] [--center] [--pause-trims]',
      '  embconv info <file> [--hoop <WxH>] [--brand <brand>]',
      '',
      '  --hoop <WxH>   target hoop in mm (e.g. 130x180) for formats that',
      '                 declare one (pes, jef, zhs); in `info`, fit-check against it',
      '  --center       center the design on the origin before writing',
      '  --pause-trims  zhs: stop the machine at each mid-color trim (cut the',
      '                 thread there) instead of dropping trims silently',
      `  --brand        one of: ${Object.keys(HOOP_CATALOG).join(', ')}`,
      '',
      `Readable formats: ${read.join(', ')}`,
      `Writable formats: ${write.join(', ')}`,
    ].join('\n'),
  );
  process.exit(2);
}

/** "130x180" (mm) → Hoop in 0.1 mm units. */
function parseHoop(spec: string): Hoop {
  const m = /^(\d+(?:\.\d+)?)[xX](\d+(?:\.\d+)?)$/.exec(spec);
  if (m === null) {
    console.error(`Bad --hoop "${spec}": expected <width>x<height> in mm, e.g. 130x180.`);
    process.exit(2);
  }
  return {
    width: Math.round(Number(m[1]) * 10),
    height: Math.round(Number(m[2]) * 10),
    name: `${m[1]}x${m[2]}`,
  };
}

/** Pull `--flag value` out of args (mutating); undefined when absent. */
function takeOption(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  if (i < 0) return undefined;
  const value = args[i + 1];
  if (value === undefined) usage();
  args.splice(i, 2);
  return value;
}

/** Pull a boolean `--flag` out of args (mutating). */
function takeFlag(args: string[], flag: string): boolean {
  const i = args.indexOf(flag);
  if (i < 0) return false;
  args.splice(i, 1);
  return true;
}

const mm = (units: number): string => (units / 10).toFixed(1);

function convertFile(
  inputPath: string,
  outputPath: string,
  options: WriterOptions,
  doCenter: boolean,
): boolean {
  try {
    const data = new Uint8Array(readFileSync(inputPath));
    let result: { bytes: Uint8Array; warnings: import('@embroidery/core').ConversionWarning[] };
    if (doCenter) {
      const pattern = center(getReader(inputPath)(data));
      result = getWriter(outputPath)(pattern, options);
    } else {
      result = convert(data, inputPath, outputPath, options);
    }
    writeFileSync(outputPath, result.bytes);
    console.log(`${inputPath} -> ${outputPath} (${result.bytes.length} bytes)`);
    for (const w of result.warnings) {
      if (w.code === 'METADATA_0X83_ZEROED') continue; // constant ZHS note
      console.warn(`  warning: ${w.message}`);
    }
    return true;
  } catch (e) {
    if (e instanceof UnsupportedDesignError || e instanceof FormatError) {
      console.error(`${inputPath}: ${e.message}`);
    } else {
      console.error(`${inputPath}: unexpected error: ${String(e)}`);
    }
    return false;
  }
}

function info(path: string, hoop: Hoop | undefined, brand: string | undefined): number {
  let data: Uint8Array;
  try {
    data = new Uint8Array(readFileSync(path));
  } catch (e) {
    console.error(`${path}: ${String(e)}`);
    return 1;
  }
  const format = detectFormat(data) ?? extname(path).slice(1).toLowerCase();
  let pattern: Pattern;
  try {
    pattern = getReader(format)(data);
  } catch (e) {
    if (e instanceof FormatError) {
      console.error(`${path}: ${e.message}`);
      return 1;
    }
    throw e;
  }

  const counts = new Map<Command, number>();
  for (const s of pattern.stitches) counts.set(s.command, (counts.get(s.command) ?? 0) + 1);
  const histogram = [...counts.entries()].map(([c, n]) => `${c} ${n}`).join(', ');
  const e = pattern.extents;

  console.log(`file:     ${path}`);
  console.log(`format:   ${format}`);
  console.log(`stitches: ${pattern.stitches.length} (${histogram})`);
  console.log(
    `colors:   ${pattern.threads.length}` +
      (pattern.threads.length > 0
        ? ` (${pattern.threads
            .map((t) => `#${t.rgb.toString(16).padStart(6, '0').toUpperCase()}`)
            .join(', ')})`
        : ''),
  );
  console.log(
    `size:     ${mm(e.maxX - e.minX)} x ${mm(e.maxY - e.minY)} mm  ` +
      `(X ${mm(e.minX)}..${mm(e.maxX)}, Y ${mm(e.minY)}..${mm(e.maxY)} mm)`,
  );

  if (pattern.hoop !== undefined) {
    const declared = pattern.hoop;
    const fit = checkFit(pattern, declared);
    const state = !fit.fits
      ? `design EXCEEDS it by ${mm(fit.overflowX)} x ${mm(fit.overflowY)} mm`
      : fit.requiresCentering
        ? 'design fits but needs centering (--center)'
        : 'design fits';
    console.log(
      `hoop:     ${declared.name ?? ''} ${mm(declared.width)} x ${mm(declared.height)} mm — ${state}`,
    );
  } else {
    console.log('hoop:     none declared by this format');
  }

  if (hoop !== undefined) {
    const fit = checkFit(pattern, hoop);
    const state = !fit.fits
      ? `EXCEEDS it by ${mm(fit.overflowX)} x ${mm(fit.overflowY)} mm`
      : fit.requiresCentering
        ? 'fits, but needs centering (--center)'
        : 'fits';
    console.log(`requested hoop ${hoop.name}: ${state}`);
    return fit.fits ? 0 : 1;
  }

  const brands = (
    brand !== undefined ? [brand as HoopBrand] : (Object.keys(HOOP_CATALOG) as HoopBrand[])
  ).filter((b) => HOOP_CATALOG[b] !== undefined);
  if (brand !== undefined && HOOP_CATALOG[brand as HoopBrand] === undefined) {
    console.error(`Unknown brand "${brand}". Brands: ${Object.keys(HOOP_CATALOG).join(', ')}`);
    return 2;
  }
  const perBrand = brands.map((b) => {
    const smallest = selectSmallestHoop(pattern.extents, HOOP_CATALOG[b]);
    return `${b} ${smallest?.name ?? 'NONE FITS'}`;
  });
  console.log(`smallest fitting hoop per brand: ${perBrand.join(', ')}`);
  return 0;
}

const args = process.argv.slice(2);

if (args[0] === 'info') {
  args.shift();
  const hoopSpec = takeOption(args, '--hoop');
  const brand = takeOption(args, '--brand');
  const file = args[0];
  if (file === undefined || args.length !== 1) usage();
  process.exit(info(file, hoopSpec === undefined ? undefined : parseHoop(hoopSpec), brand));
} else if (args[0] === '--batch') {
  args.shift();
  const hoopSpec = takeOption(args, '--hoop');
  const doCenter = takeFlag(args, '--center');
  const pauseTrims = takeFlag(args, '--pause-trims');
  const target = takeOption(args, '--to');
  const outDirOpt = takeOption(args, '--out');
  const dir = args[0];
  if (dir === undefined || target === undefined || args.length !== 1) usage();
  const outDir = outDirOpt ?? dir;
  if (!supportedFormats().write.includes(target.toLowerCase())) {
    console.error(`Unknown target format "${target}".`);
    usage();
  }
  const options: WriterOptions = {};
  if (hoopSpec !== undefined) options.hoop = parseHoop(hoopSpec);
  if (pauseTrims) options.trims = 'pause';
  mkdirSync(outDir, { recursive: true });
  const readable = new Set(supportedFormats().read);
  let ok = 0;
  let failed = 0;
  for (const entry of readdirSync(dir)) {
    const ext = extname(entry).slice(1).toLowerCase();
    if (!readable.has(ext) || ext === target.toLowerCase()) continue;
    const stem = basename(entry, extname(entry));
    const out = join(outDir, `${stem}.${target.toLowerCase()}`);
    if (convertFile(join(dir, entry), out, options, doCenter)) {
      ok += 1;
    } else {
      failed += 1;
    }
  }
  console.log(`done: ${ok} converted, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
} else {
  const hoopSpec = takeOption(args, '--hoop');
  const doCenter = takeFlag(args, '--center');
  const pauseTrims = takeFlag(args, '--pause-trims');
  const options: WriterOptions = {};
  if (hoopSpec !== undefined) options.hoop = parseHoop(hoopSpec);
  if (pauseTrims) options.trims = 'pause';
  if (args.length === 2 && args[0] !== undefined && args[1] !== undefined) {
    process.exit(convertFile(args[0], args[1], options, doCenter) ? 0 : 1);
  } else {
    usage();
  }
}
