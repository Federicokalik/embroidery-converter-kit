/**
 * Post-read pattern heuristics — ports of the EmbPattern helpers pyembroidery
 * readers invoke after decoding (DST/JEF: interpolate_trims; JEF/PEC/PES:
 * interpolate_duplicate_color_as_stop). Both mutate in place, like the
 * originals, and are exercised byte-for-byte by the .read.json goldens.
 */
import type { Stitch, Thread } from './ir';

/**
 * Adds TRIM records where a run of consecutive jumps meets the count/distance
 * criteria, and (with clipping) deletes zero-displacement jump runs — which is
 * exactly what removes DST's oscillating trim-jumps on read.
 */
export function interpolateTrims(
  stitches: Stitch[],
  jumpsToRequireTrim?: number,
  distanceToRequireTrim?: number,
  clipping = true,
): void {
  let i = -1;
  let ie = stitches.length - 1;
  let x = 0;
  let y = 0;
  let jumpCount = 0;
  let jumpStart = 0;
  let jumpDx = 0;
  let jumpDy = 0;
  let jumping = false;
  let trimmed = true;
  while (i < ie) {
    i += 1;
    const stitch = stitches[i]!;
    const dx = stitch.x - x;
    const dy = stitch.y - y;
    x = stitch.x;
    y = stitch.y;
    const command = stitch.command;
    if (command === 'STITCH') {
      trimmed = false;
      jumping = false;
    } else if (command === 'COLOR_CHANGE' || command === 'TRIM') {
      trimmed = true;
      jumping = false;
    }
    if (command === 'JUMP') {
      if (!jumping) {
        jumpDx = 0;
        jumpDy = 0;
        jumpCount = 0;
        jumpStart = i;
        jumping = true;
      }
      jumpCount += 1;
      jumpDx += dx;
      jumpDy += dy;
      if (!trimmed) {
        if (
          jumpCount === jumpsToRequireTrim ||
          (distanceToRequireTrim !== undefined &&
            (Math.abs(jumpDy) > distanceToRequireTrim ||
              Math.abs(jumpDx) > distanceToRequireTrim))
        ) {
          // pyembroidery inserts a relative (0,0) TRIM before the jump run,
          // i.e. at the position of the record preceding it (origin at 0).
          const prev = jumpStart === 0 ? { x: 0, y: 0 } : stitches[jumpStart - 1]!;
          stitches.splice(jumpStart, 0, { x: prev.x, y: prev.y, command: 'TRIM' });
          jumpStart += 1;
          i += 1;
          ie += 1;
          trimmed = true;
        }
      }
      if (clipping && jumpDx === 0 && jumpDy === 0) {
        stitches.splice(jumpStart, i - jumpStart + 1);
        i = jumpStart - 1;
        ie = stitches.length - 1;
      }
    }
  }
}

/**
 * Inverse of interpolateDuplicateColorAsStop: turns every STOP into a
 * COLOR_CHANGE to a duplicated thread (PEC/PES writers run this on the
 * normalized pattern — PEC has no stop primitive).
 */
export function interpolateStopAsDuplicateColor(
  stitches: Stitch[],
  threads: Thread[],
): void {
  let threadIndex = 0;
  for (let position = 0; position < stitches.length; position++) {
    const command = stitches[position]!.command;
    if (command === 'STITCH') {
      continue;
    } else if (command === 'COLOR_CHANGE') {
      threadIndex += 1;
    } else if (command === 'STOP') {
      if (threadIndex >= threads.length) return; // IndexError parity
      threads.splice(threadIndex, 0, threads[threadIndex]!);
      stitches[position] = { ...stitches[position]!, command: 'COLOR_CHANGE' };
      threadIndex += 1;
    }
  }
}

/**
 * Replaces a color change to an identical thread with a STOP (and drops the
 * duplicate thread). pyembroidery compares EmbThread by 24-bit color.
 */
export function interpolateDuplicateColorAsStop(
  stitches: Stitch[],
  threads: Thread[],
): void {
  let threadIndex = 0;
  let initColor = true;
  let lastChange: number | null = null;
  for (let position = 0; position < stitches.length; position++) {
    const command = stitches[position]!.command;
    if (command === 'STITCH') {
      if (initColor) {
        let isDuplicate = false;
        if (lastChange !== null && threadIndex !== 0) {
          if (threadIndex >= threads.length) return; // IndexError parity
          isDuplicate =
            (threads[threadIndex - 1]!.rgb & 0xffffff) ===
            (threads[threadIndex]!.rgb & 0xffffff);
        }
        if (isDuplicate) {
          threads.splice(threadIndex, 1);
          stitches[lastChange!] = { ...stitches[lastChange!]!, command: 'STOP' };
        } else {
          threadIndex += 1;
        }
        initColor = false;
      }
    } else if (command === 'COLOR_CHANGE') {
      initColor = true;
      lastChange = position;
    }
  }
}
