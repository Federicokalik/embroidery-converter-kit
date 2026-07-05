#!/usr/bin/env python3
"""Cross-implementation check for the TS HUS writer.

Converts every golden pattern DST -> HUS with the TS CLI, then reads the
result back with pyembroidery's HusReader and compares the pen-down path
against pyembroidery's own read of the DST source. This replaces the
byte-golden strategy (pyembroidery cannot write HUS, and its trivial
EmbCompress.compress is broken for most sizes — we write the block element
count in decoder order instead).

VIP has NO pyembroidery reader: the VIP writer is covered by the Vitest
round-trip suite (our reader + fixture known-plaintext color checks) and by
opening a generated .vip in Artist Toolkit (owner acceptance test).

Run from repo root (CLI must be built: pnpm --filter @embroidery/cli build):
    python packages/core/scripts/verify_hus_vip.py
"""
import subprocess
import sys
import tempfile
from pathlib import Path

import pyembroidery
from pyembroidery.EmbConstant import COMMAND_MASK, STITCH

REPO = Path(__file__).resolve().parents[3]
GOLDEN = REPO / "packages" / "core" / "test" / "golden" / "formats"
CLI = REPO / "packages" / "cli" / "dist" / "index.js"
STEMS = ["001s-A", "028-B", "052-Z", "multicolor", "longjump", "trims"]


def pen_path(pattern):
    out = []
    for x, y, c in pattern.stitches:
        if (c & COMMAND_MASK) != STITCH:
            continue
        p = (x, y)
        if not out or out[-1] != p:
            out.append(p)
    return out


def main() -> int:
    if not CLI.exists():
        print("CLI not built: run `pnpm --filter @embroidery/cli build` first")
        return 2
    failures = 0
    with tempfile.TemporaryDirectory() as tmp:
        for stem in STEMS:
            src = GOLDEN / f"{stem}.dst"
            dst = Path(tmp) / f"{stem}.hus"
            run = subprocess.run(
                ["node", str(CLI), str(src), str(dst)],
                capture_output=True, text=True,
            )
            if run.returncode != 0:
                print(f"{stem}: CLI conversion FAILED\n{run.stderr}")
                failures += 1
                continue
            source = pyembroidery.read(str(src))
            back = pyembroidery.read(str(dst))
            ok = pen_path(source) == pen_path(back)
            colors_ok = len(back.threadlist) >= len(source.threadlist)
            print(f"{stem}: pen path match: {ok}, threads {len(back.threadlist)}"
                  f" (source {len(source.threadlist)})")
            if not (ok and colors_ok):
                failures += 1
    print("PASS" if failures == 0 else f"FAIL ({failures})")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
