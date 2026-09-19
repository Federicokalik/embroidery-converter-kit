/**
 * Trim editing at IR level — add or remove thread-trim commands on a parsed
 * pattern without converting it to another format (same-format round trip:
 * read .pes → edit → write .pes).
 *
 * TRIM records in this IR never move the needle (every reader emits them at
 * the current position), so both operations are geometrically safe:
 * - removeTrims strips them; travel records that follow stay untouched.
 * - addTrims inserts no-move TRIM records that writers encode natively:
 *   DST as oscillating zero-sum jumps, EXP as 0x80 0x80 0x07, HUS/VIP as 0x88,
 *   VP3/XXX as their trim controls — and for PEC/PES via the trim flag the
 *   next travel jump carries (pyembroidery parity: PEC writers pass TRIM
 *   records, the encoder's post-trim travel jump gets the TRIM flag).
 *
 * Formats that cannot encode TRIMs: JEF (writer ignores them, machine trims
 * only at color changes) and ZHS (no trim record — use the writer's own
 * 'drop'/'pause' option). Front-ends surface this with TRIM_DROPPED.
 */
import type { Stitch } from './ir';

export interface AddTrimOptions {
  /** Insert a TRIM before every COLOR_CHANGE (end-of-color-block cut). Default true. */
  beforeColorChange?: boolean;
  /** Insert a TRIM before a jump run that reaches this many consecutive jumps. Default 3. */
  jumpsToRequireTrim?: number;
  /** Insert a TRIM before a jump run whose X or Y travel exceeds this many
   * 0.1 mm units (30 = 3 mm, pyembroidery's JEF read default). Default 30. */
  distanceToRequireTrim?: number;
}

/** Strip every TRIM record. Pure: returns a new array. */
export function removeTrims(stitches: Stitch[]): Stitch[] {
  return stitches.filter((s) => s.command !== 'TRIM');
}

/**
 * Insert TRIM records at the two canonical machine-trim points:
 * before each color change, and before jump runs that meet the
 * count/travel criteria (the interpolateTrims heuristics, but inserting
 * into a copy instead of splicing, and never deleting anything).
 *
 * Insertion is suppressed where the state is already trimmed: right after
 * a TRIM, STOP, COLOR_CHANGE or END, and at the design start (encoder
 * parity: the first block never opens with a cut).
 */
export function addTrims(stitches: Stitch[], options?: AddTrimOptions): Stitch[] {
  const beforeColorChange = options?.beforeColorChange ?? true;
  const jumpsToRequireTrim = options?.jumpsToRequireTrim ?? 3;
  const distanceToRequireTrim = options?.distanceToRequireTrim ?? 30;

  const out: Stitch[] = [];
  let x = 0;
  let y = 0;
  let trimmed = true; // stateTrimmed starts true in the pyembroidery encoder
  let jumping = false;
  let jumpCount = 0;
  let jumpDx = 0;
  let jumpDy = 0;
  let jumpStartOut = -1; // index in `out` where the current jump run began

  for (const stitch of stitches) {
    const dx = stitch.x - x;
    const dy = stitch.y - y;
    x = stitch.x;
    y = stitch.y;
    const command = stitch.command;

    if (command === 'STITCH') {
      trimmed = false;
      jumping = false;
      out.push(stitch);
    } else if (command === 'JUMP') {
      if (!jumping) {
        jumpDx = 0;
        jumpDy = 0;
        jumpCount = 0;
        jumpStartOut = out.length;
        jumping = true;
      }
      jumpCount += 1;
      jumpDx += dx;
      jumpDy += dy;
      out.push(stitch);
      if (
        !trimmed &&
        (jumpCount === jumpsToRequireTrim ||
          Math.abs(jumpDx) > distanceToRequireTrim ||
          Math.abs(jumpDy) > distanceToRequireTrim)
      ) {
        // pyembroidery-style relative trim: at the position of the record
        // preceding the jump run (origin fallback for a leading run).
        const at = jumpStartOut > 0 ? out[jumpStartOut - 1]! : { x: 0, y: 0 };
        out.splice(jumpStartOut, 0, { x: at.x, y: at.y, command: 'TRIM' });
        trimmed = true;
      }
    } else if (command === 'COLOR_CHANGE') {
      if (beforeColorChange && !trimmed) {
        out.push({ x: stitch.x, y: stitch.y, command: 'TRIM' });
      }
      out.push(stitch);
      trimmed = true;
      jumping = false;
    } else if (command === 'TRIM') {
      trimmed = true;
      jumping = false;
      out.push(stitch);
    } else if (command === 'STOP') {
      trimmed = true;
      jumping = false;
      out.push(stitch);
    } else {
      // END (and anything else): pass through, end-of-design state.
      out.push(stitch);
      trimmed = true;
      jumping = false;
    }
  }
  return out;
}
