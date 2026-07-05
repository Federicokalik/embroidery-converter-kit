#!/usr/bin/env python3
"""Generate a synthetic HUS golden (pyembroidery has no HUS writer).

Builds a HUS file from raw parts — header + color indices + three
stored-block compressed streams (the same trivial EmbCompress.compress
blocks pyembroidery emits) — then dumps pyembroidery's read-back of it as
the reader golden.

Run from repo root:  python packages/core/scripts/gen_hus_golden.py
"""
import json
import struct
from pathlib import Path

import pyembroidery
from pyembroidery.EmbCompress import compress
from pyembroidery.EmbConstant import COMMAND_MASK, STITCH, JUMP, TRIM, COLOR_CHANGE, STOP, END

REPO = Path(__file__).resolve().parents[3]
OUT = REPO / "packages" / "core" / "test" / "golden" / "formats"

COMMAND_NAMES = {
    STITCH: "STITCH", JUMP: "JUMP", TRIM: "TRIM",
    COLOR_CHANGE: "COLOR_CHANGE", STOP: "STOP", END: "END",
}

HUS_MAGIC = 0x00C8AF5B

# (cmd, dx, dy) in HUS conventions: 0x80 stitch, 0x81 jump, 0x84 color
# change, 0x88 trim, 0x90 end. dy is stored (IR y is its negation).
RECORDS = [
    (0x80, 5, 5),
    (0x80, 10, -3),
    (0x81, 20, 0),        # jump
    (0x88, 0, 0),         # trim, no displacement
    (0x80, -7, 12),
    (0x84, 0, 0),         # color change
    (0x80, 6, 6),
    (0x88, 3, 1),         # trim with displacement -> move + trim
    (0x80, -2, -9),
    (0x90, 0, 0),         # end
]
COLOR_INDICES = [3, 11]


def build() -> bytes:
    commands = bytes(c for c, _, _ in RECORDS)
    xs = bytes((dx & 0xFF) for _, dx, _ in RECORDS)
    ys = bytes((dy & 0xFF) for _, _, dy in RECORDS)
    c_block = bytes(compress(bytearray(commands)))
    x_block = bytes(compress(bytearray(xs)))
    y_block = bytes(compress(bytearray(ys)))

    header_size = 0x2A + 2 * len(COLOR_INDICES)
    command_offset = header_size
    x_offset = command_offset + len(c_block)
    y_offset = x_offset + len(x_block)

    h = bytearray(header_size)
    struct.pack_into("<I", h, 0x00, HUS_MAGIC)
    struct.pack_into("<i", h, 0x04, len(RECORDS))
    struct.pack_into("<i", h, 0x08, len(COLOR_INDICES))
    struct.pack_into("<hhhh", h, 0x0C, 30, 20, -10, -10)
    struct.pack_into("<i", h, 0x14, command_offset)
    struct.pack_into("<i", h, 0x18, x_offset)
    struct.pack_into("<i", h, 0x1C, y_offset)
    # 0x20: 8-byte string and 0x28: unknown u16 stay zero.
    for i, idx in enumerate(COLOR_INDICES):
        struct.pack_into("<H", h, 0x2A + 2 * i, idx)
    return bytes(h) + c_block + x_block + y_block


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    data = build()
    hus_path = OUT / "synthetic.hus"
    hus_path.write_bytes(data)

    from pyembroidery import HusReader
    back = pyembroidery.EmbPattern()
    with open(hus_path, "rb") as f:
        HusReader.read(f, back)
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
    (OUT / "synthetic.hus.read.json").write_text(json.dumps(dump), encoding="utf-8")
    print(f"wrote synthetic.hus ({len(data)} bytes) + read dump "
          f"({len(dump['stitches'])} records, {len(dump['threads'])} threads)")


if __name__ == "__main__":
    main()
