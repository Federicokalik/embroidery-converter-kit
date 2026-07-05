/**
 * Shared HUS/VIP body builder: both formats store the same three
 * EmbCompress streams (command bytes, x deltas, y deltas) with commands
 * 0x80 STITCH / 0x81 JUMP / 0x84 COLOR_CHANGE / 0x88 TRIM / 0x90 END.
 *
 * No open-source writer exists for either format (pyembroidery is
 * read-only for HUS and has no VIP at all); the streams use pyembroidery's
 * trivial "stored block" compression, which its own expand() — and ours —
 * round-trips. Machine acceptance ("software-verified" only) is pending an
 * Artist Toolkit / physical test by the owner.
 */
import { compress } from '../embcompress';
import { normalize } from '../encoder';
import { computeExtents, UnsupportedDesignError } from '../ir';
import type { ConversionWarning, Pattern, Stitch, Thread } from '../ir';
import { interpolateStopAsDuplicateColor } from '../pattern-transforms';
import { pyround } from '../pyround';
import { HUS_SETTINGS } from '../writer-settings';

export interface HusVipBody {
  stitches: Stitch[];
  threads: Thread[];
  warnings: ConversionWarning[];
  /** Number of records including the trailing END. */
  recordCount: number;
  /** Header extents: posX, posY, negX, negY (stored-y convention). */
  extents: [number, number, number, number];
  commandBlock: Uint8Array;
  xBlock: Uint8Array;
  yBlock: Uint8Array;
}

export function buildHusVipBody(pattern: Pattern): HusVipBody {
  const normalized = normalize(pattern, HUS_SETTINGS);
  const warnings = normalized.warnings;
  // Neither format has a STOP primitive: like PEC/PES/ZHS, a STOP becomes a
  // color change onto a duplicated thread.
  const stitches = normalized.stitches.map((s) => ({ ...s }));
  const threads = normalized.threads.map((t) => ({ ...t }));
  interpolateStopAsDuplicateColor(stitches, threads);

  const commands: number[] = [];
  const xs: number[] = [];
  const ys: number[] = [];
  let px = 0;
  let py = 0;
  const push = (cmd: number, s: Stitch): void => {
    const dx = pyround(s.x - px);
    const dy = pyround(s.y - py);
    px += dx;
    py += dy;
    commands.push(cmd);
    xs.push(dx & 0xff);
    ys.push(-dy & 0xff); // stored y = -(IR y)
  };
  for (const s of stitches) {
    if (s.command === 'STITCH') push(0x80, s);
    else if (s.command === 'JUMP') push(0x81, s);
    else if (s.command === 'COLOR_CHANGE') push(0x84, s);
    else if (s.command === 'TRIM') push(0x88, s);
    else if (s.command === 'END') break;
    // STOP was interpolated away above.
  }
  commands.push(0x90); // END record
  xs.push(0);
  ys.push(0);

  if (commands.length > 0xffff) {
    throw new UnsupportedDesignError(
      `Design produces ${commands.length} records; EmbCompress stored blocks ` +
        '(the only writable HUS/VIP body) hold at most 65535.',
      'TOO_MANY_RECORDS',
    );
  }

  const { minX, minY, maxX, maxY } = computeExtents(stitches);
  return {
    stitches,
    threads,
    warnings,
    recordCount: commands.length,
    extents: [pyround(maxX), pyround(-minY), pyround(minX), pyround(-maxY)],
    commandBlock: compress(new Uint8Array(commands)),
    xBlock: compress(new Uint8Array(xs)),
    yBlock: compress(new Uint8Array(ys)),
  };
}
