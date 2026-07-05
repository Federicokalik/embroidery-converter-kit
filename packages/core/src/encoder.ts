/**
 * Pattern normalizer — faithful port of pyembroidery's EmbEncoder.Transcoder,
 * restricted to the command set our IR produces (STITCH, JUMP, TRIM,
 * COLOR_CHANGE, STOP, END). Sequins, matrix ops, middle-level commands and
 * tie on/off contingencies (all default-off in pyembroidery) are not ported.
 *
 * Writers run their input through normalize() with their per-format settings
 * (max stitch/jump length, full-jump, rounding) exactly like pyembroidery's
 * write_embroidery merges writer module constants. Gap interpolation keeps
 * FLOAT coordinates (only top-level stitches are rounded when `round` is set),
 * matching pyembroidery bit-for-bit — writers deal with the floats themselves.
 */
import type { ConversionWarning, Pattern, Stitch, Thread } from './ir';
import { pyround } from './pyround';

export interface EncoderSettings {
  maxStitch?: number; // default Infinity
  maxJump?: number; // default Infinity
  fullJump?: boolean; // default false
  round?: boolean; // default false
  explicitTrim?: boolean; // default false
}

export interface NormalizedPattern {
  /** May contain fractional coordinates from gap interpolation. */
  stitches: Stitch[];
  threads: Thread[];
  warnings: ConversionWarning[];
}

/** Deterministic stand-in when a design has more color blocks than threads
 * (pyembroidery inserts a *random* thread here; we must stay reproducible). */
const FILLER_THREAD: Thread = { rgb: 0x000000, description: 'Filler' };

/**
 * pyembroidery build_thread_change_sequence, reduced: our IR color changes
 * never carry explicit thread/needle/order payloads, so block i simply maps
 * to pattern.threads[i] (or the filler).
 */
function threadForBlock(pattern: Pattern, index: number): Thread | undefined {
  return pattern.threads[index];
}

export function normalize(pattern: Pattern, settings: EncoderSettings): NormalizedPattern {
  const maxStitch = settings.maxStitch ?? Infinity;
  const maxJump = settings.maxJump ?? Infinity;
  const fullJump = settings.fullJump ?? false;
  const doRound = settings.round ?? false;
  const explicitTrim = settings.explicitTrim ?? false;

  const out: Stitch[] = [];
  const threads: Thread[] = [];
  const warnings: ConversionWarning[] = [];

  let needleX = 0;
  let needleY = 0;
  let stateTrimmed = true;
  let orderIndex = -1;

  const add = (command: Stitch['command'], x = needleX, y = needleY): void => {
    out.push({ x, y, command });
  };

  const updateNeedle = (x: number, y: number): void => {
    needleX = x;
    needleY = y;
  };

  /** Emits the intermediate gap stitches only, never the end point. */
  const interpolateGap = (
    x1: number,
    y1: number,
    maxLength: number,
    command: 'JUMP' | 'STITCH',
  ): void => {
    const distanceX = x1 - needleX;
    const distanceY = y1 - needleY;
    if (Math.abs(distanceX) > maxLength || Math.abs(distanceY) > maxLength) {
      const stepsX = Math.ceil(Math.abs(distanceX / maxLength));
      const stepsY = Math.ceil(Math.abs(distanceY / maxLength));
      const steps = Math.max(stepsX, stepsY);
      const stepSizeX = distanceX / steps;
      const stepSizeY = distanceY / steps;
      let qx = needleX;
      let qy = needleY;
      for (let q = 1; q < steps; q++) {
        qx += stepSizeX;
        qy += stepSizeY;
        add(command, qx, qy);
        updateNeedle(qx, qy);
      }
    }
  };

  const stitchAt = (x: number, y: number): void => {
    add('STITCH', x, y);
    updateNeedle(x, y);
  };

  const jumpAt = (x: number, y: number): void => {
    add('JUMP', x, y);
    updateNeedle(x, y);
  };

  const jumpTo = (x: number, y: number): void => {
    interpolateGap(x, y, maxJump, 'JUMP');
    jumpAt(x, y);
  };

  const jumpToWithinStitchRange = (x: number, y: number): void => {
    interpolateGap(x, y, maxJump, 'JUMP');
    if (fullJump && (needleX !== x || needleY !== y)) {
      jumpAt(x, y);
    }
  };

  /** Long-stitch contingency: JUMP_NEEDLE (pyembroidery default). */
  const needleTo = (x: number, y: number): void => {
    interpolateGap(x, y, maxStitch, 'JUMP');
    stitchAt(x, y);
  };

  const trimHere = (): void => {
    add('TRIM');
    stateTrimmed = true;
  };

  const nextChangeSequence = (): void => {
    orderIndex += 1;
    const thread = threadForBlock(pattern, orderIndex);
    if (thread === undefined) {
      threads.push(FILLER_THREAD);
      if (warnings.every((w) => w.code !== 'FILLER_THREAD')) {
        warnings.push({
          code: 'FILLER_THREAD',
          message:
            'The design has more color blocks than threads; missing colors ' +
            'were written as black.',
        });
      }
    } else {
      threads.push(thread);
    }
    if (orderIndex !== 0) add('COLOR_CHANGE');
    stateTrimmed = true;
  };

  const declareNotTrimmed = (): void => {
    if (orderIndex === -1) nextChangeSequence();
    stateTrimmed = false;
  };

  let sawEnd = false;
  for (const stitch of pattern.stitches) {
    let x = stitch.x;
    let y = stitch.y;
    if (doRound) {
      x = pyround(x);
      y = pyround(y);
    }
    const command = stitch.command;
    if (command === 'STITCH') {
      if (stateTrimmed) {
        declareNotTrimmed();
        jumpToWithinStitchRange(x, y);
        stitchAt(x, y);
        // tie_on contingency: NONE (pyembroidery default)
      } else {
        needleTo(x, y);
      }
    } else if (command === 'JUMP') {
      jumpTo(x, y);
    } else if (command === 'TRIM') {
      if (!stateTrimmed) {
        // tie_off contingency: NONE
        trimHere();
      }
    } else if (command === 'COLOR_CHANGE') {
      if (!stateTrimmed && explicitTrim) trimHere();
      nextChangeSequence();
      stateTrimmed = true;
    } else if (command === 'STOP') {
      add('STOP');
      stateTrimmed = true;
    } else {
      // END
      add('END');
      stateTrimmed = true;
      sawEnd = true;
      break;
    }
  }
  if (!sawEnd) {
    add('END');
  }

  return { stitches: out, threads, warnings };
}
