/**
 * Machine presets for the studio toolbar (web-side data, NOT core).
 * Selecting a preset sets the primary target format and, when the format
 * persists a hoop in the file (HOOP_BRAND_BY_FORMAT in shared.ts), narrows
 * the hoop choices to `hoops`. For formats that store no hoop the preset
 * only picks the format.
 *
 * Two layers: generic per-brand presets (verified hoop data from the core
 * catalog, always available) plus model-level entries GENERATED from the
 * owner's research reports — see scripts/gen_machines.mjs and
 * reports_files/RECONCILED.md. Never hand-edit machines-data.ts.
 */
import { HOOP_CATALOG } from '@embroidery/core';
import type { Hoop } from '@embroidery/core';
import { MACHINE_MODELS } from './machines-data';

export interface MachinePreset {
  id: string;
  /** Groups the select's optgroups; also the generic preset's family. */
  brand: string;
  /** Brand/model names: not translated. */
  label: string;
  /** Primary target format id (must be writable by the core). */
  format: string;
  /** Hoop lineup (0.1 mm units, like HOOP_CATALOG); absent = format has none. */
  hoops?: Hoop[];
}

/** Generic per-brand presets: the safe baseline, core-verified hoops. */
export const BRAND_PRESETS: MachinePreset[] = [
  { id: 'brother-generic', brand: 'Brother', label: 'Brother (PES)', format: 'pes', hoops: HOOP_CATALOG.brother },
  { id: 'janome-generic', brand: 'Janome', label: 'Janome (JEF)', format: 'jef', hoops: HOOP_CATALOG.janome },
  // HUS and VIP are both Husqvarna Viking; VIP is the more standard pick.
  { id: 'husqvarna-generic', brand: 'Husqvarna Viking', label: 'Husqvarna Viking (VIP)', format: 'vip', hoops: HOOP_CATALOG.husqvarna },
  { id: 'pfaff-generic', brand: 'Pfaff', label: 'Pfaff (VP3)', format: 'vp3', hoops: HOOP_CATALOG.pfaff },
  { id: 'singer-generic', brand: 'Singer', label: 'Singer (XXX)', format: 'xxx', hoops: HOOP_CATALOG.singer },
  { id: 'tajima-generic', brand: 'Tajima', label: 'Tajima (DST)', format: 'dst' },
  { id: 'melco-generic', brand: 'Melco', label: 'Melco (EXP)', format: 'exp' },
  { id: 'zenghsing-generic', brand: 'Zeng Hsing', label: 'Zeng Hsing (ZHS)', format: 'zhs', hoops: HOOP_CATALOG.zenghsing },
];

export const MACHINE_PRESETS: MachinePreset[] = [...BRAND_PRESETS, ...MACHINE_MODELS];

export function presetById(id: string): MachinePreset | undefined {
  return MACHINE_PRESETS.find((p) => p.id === id);
}

/** Optgroup structure for the select: generic entries first, then brands A→Z. */
export function presetGroups(): Array<{ label: string; presets: MachinePreset[] }> {
  const byBrand = new Map<string, MachinePreset[]>();
  for (const p of MACHINE_MODELS) {
    if (!byBrand.has(p.brand)) byBrand.set(p.brand, []);
    byBrand.get(p.brand)!.push(p);
  }
  return [
    { label: '', presets: BRAND_PRESETS },
    ...[...byBrand.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, presets]) => ({ label, presets })),
  ];
}
