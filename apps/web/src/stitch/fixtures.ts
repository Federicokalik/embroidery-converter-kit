/**
 * The narrative cast: real embroidery files, owned by the project owner and
 * cleared for publication (they ship with the site build — they are the only
 * design files allowed in the public repo; test fixtures stay private):
 * - unicorn-6x10.jef: the hero showpiece (~39k stitches, 6 colors);
 * - lobster.pes: Babel station + the translation re-stitch (~9k, 10 colors);
 * - octopus.dst: Babel station + the precision macro subject (~31k).
 *   Converted from the original PES by OUR OWN converter (embconv), so
 *   the ".dst Tajima" dialect on stage is a genuine product artifact.
 *   DST stores no colors: it renders in ink, by design.
 */
import { readDst, readJef, readPes } from '@embroidery/core';
import type { Pattern } from '@embroidery/core';
import { decimate, toStitchData } from './runs';
import type { StitchData } from './runs';
import type { CastData } from '../stage/types';
import showpieceUrl from '../assets/designs/unicorn-6x10.jef?url';
import lobsterUrl from '../assets/designs/lobster.pes?url';
import octopusUrl from '../assets/designs/octopus.dst?url';

/** Point budget per design on the narrative stage. */
const BUDGET = 12_000;

async function loadOne(url: string, read: (b: Uint8Array) => Pattern): Promise<StitchData> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fixture fetch failed: ${url} (${res.status})`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const data = toStitchData(read(bytes));
  return { ...data, runs: decimate(data.runs, BUDGET) };
}

export async function loadCast(): Promise<CastData> {
  const [showpiece, lobster, octopus] = await Promise.all([
    loadOne(showpieceUrl, readJef),
    loadOne(lobsterUrl, readPes),
    loadOne(octopusUrl, readDst),
  ]);
  return { showpiece, lobster, octopus };
}
