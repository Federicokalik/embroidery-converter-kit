#!/usr/bin/env python3
"""Generate synthetic goldens for the read-only formats (SEW, SHV, PCS).

pyembroidery cannot WRITE these formats, so (like gen_hus_golden.py) we
build minimal files from raw bytes that exercise each reader's record types,
then dump pyembroidery's read-back as the reader golden. The TS readers must
reproduce those dumps exactly (parity, quirks included).

Run from repo root:  python packages/core/scripts/gen_readonly_golden.py
"""
import json
import struct
from pathlib import Path

import pyembroidery
from pyembroidery.EmbConstant import COMMAND_MASK, STITCH, JUMP, TRIM, COLOR_CHANGE, STOP, END

REPO = Path(__file__).resolve().parents[3]
OUT = REPO / "packages" / "core" / "test" / "golden" / "formats"

COMMAND_NAMES = {
    STITCH: "STITCH", JUMP: "JUMP", TRIM: "TRIM",
    COLOR_CHANGE: "COLOR_CHANGE", STOP: "STOP", END: "END",
}


def build_sew() -> bytes:
    """2 chart colors; plain stitches, a jump, an odd-control color change."""
    h = bytearray()
    h += struct.pack("<H", 2)          # color count
    h += struct.pack("<HH", 3, 11)     # chart indices
    h += bytes(0x1D78 - len(h))        # pad to the fixed stitch offset
    s = bytearray()
    s += bytes([5 & 0xFF, (-5) & 0xFF])       # stitch (dy stored negated)
    s += bytes([10 & 0xFF, 3 & 0xFF])          # stitch
    s += bytes([0x80, 0x02, 20 & 0xFF, 0])     # jump
    s += bytes([0x80, 0x01, 0, 0])             # color change (odd control)
    s += bytes([(-7) & 0xFF, (-12) & 0xFF])    # stitch
    s += bytes([0x80, 0x10, 6 & 0xFF, 6 & 0xFF])  # "move" stitch control
    return bytes(h + s)


def build_shv() -> bytes:
    """2 colors with stitch budgets (color change is budget-driven), a
    16-bit big-endian move, jump mode on/off controls."""
    h = bytearray()
    h += bytes(0x56)                   # header text block
    h += bytes([0])                    # design name length
    h += bytes([0, 0])                 # design width, height (no bitmap)
    h += bytes(4)                      # skipped u32
    h += bytes([2])                    # color count
    h += bytes(18)                     # skipped block
    # color entries: u32be stitch budget, u8 color code, 9 pad bytes.
    # The reader seeks -2 after the table, so the LAST 2 pad bytes of the
    # final entry are the first 2 bytes of the stitch stream.
    h += struct.pack(">I", 3) + bytes([4]) + bytes(9)
    h += struct.pack(">I", 100) + bytes([9]) + bytes(7)
    s = bytearray()
    s += bytes([5 & 0xFF, 5 & 0xFF])           # stitch (SHV y is unnegated)
    s += bytes([10 & 0xFF, (-3) & 0xFF])       # stitch
    s += bytes([(-7) & 0xFF, 12 & 0xFF])       # stitch — budget (3) exhausted
    s += bytes([0x80, 0x01]) + struct.pack(">hh", 40, 50)  # big move -> jump mode
    s += bytes([3 & 0xFF, 4 & 0xFF])           # delta while in jump mode
    s += bytes([0x80, 0x02])                   # end of jump mode
    s += bytes([1 & 0xFF, 1 & 0xFF])           # stitch
    return bytes(h + s)


def build_pcs() -> bytes:
    """Hoop code 2 (80x80), 2 colors, absolute 24-bit records: stitches,
    a jump, a color change."""
    h = bytearray()
    h += bytes([2, 2])                 # version, hoop code
    h += struct.pack("<H", 2)          # color count
    for rgb in (0xFF0000, 0x0000FF):
        h += bytes([(rgb >> 16) & 0xFF, (rgb >> 8) & 0xFF, rgb & 0xFF, 0])
    h += struct.pack("<H", 5)          # declared stitch count (informational)

    def rec(x, y, ctrl):
        out = bytearray([0])
        out += struct.pack("<i", x & 0xFFFFFF)[:3]
        out += bytes([0])
        out += struct.pack("<i", y & 0xFFFFFF)[:3]
        out += bytes([ctrl])
        return out

    s = bytearray()
    s += rec(30, 30, 0x00)     # stitch
    s += rec(60, -12, 0x00)    # stitch (negative 24-bit y)
    s += rec(90, 90, 0x04)     # jump
    s += rec(0, 0, 0x01)       # color change (coords ignored)
    s += rec(120, 6, 0x00)     # stitch
    return bytes(h + s)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for ext, build in (("sew", build_sew), ("shv", build_shv), ("pcs", build_pcs)):
        data = build()
        path = OUT / f"synthetic.{ext}"
        path.write_bytes(data)
        back = pyembroidery.read(str(path))
        dump = {
            "stitches": [
                [x, y, COMMAND_NAMES[cmd & COMMAND_MASK]] for x, y, cmd in back.stitches
            ],
            "threads": [
                {"rgb": t.color & 0xFFFFFF, "description": t.description,
                 "catalog": t.catalog_number}
                for t in back.threadlist
            ],
        }
        (OUT / f"synthetic.{ext}.read.json").write_text(json.dumps(dump), encoding="utf-8")
        print(f"synthetic.{ext}: {len(data)} bytes, {len(dump['stitches'])} records, "
              f"{len(dump['threads'])} threads")


if __name__ == "__main__":
    main()
