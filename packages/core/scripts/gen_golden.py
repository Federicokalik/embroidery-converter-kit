#!/usr/bin/env python3
"""Generate golden test vectors for the TypeScript EmbCompress port.

For every fixtures/*.vip this dumps the three expanded streams (commands, xs,
ys) EXACTLY as pyembroidery's expand() returns them — including the possible
extra trailing element caused by its `<=` loop bound — so the TS port can be
compared for bit-perfect fidelity, not just functional equivalence.

Run from the repo root (only needed again if fixtures change):
    python packages/core/scripts/gen_golden.py
Requires: pip install pyembroidery
"""
import json
import struct
from pathlib import Path

from pyembroidery.EmbCompress import expand

REPO = Path(__file__).resolve().parents[3]
FIXTURES = REPO / "fixtures"
OUT = REPO / "packages" / "core" / "test" / "golden"

VIP_MAGIC = 0x0190FC5D


def dump(vip_path: Path) -> dict:
    d = vip_path.read_bytes()
    magic = struct.unpack_from("<I", d, 0)[0]
    assert magic == VIP_MAGIC, f"not a VIP file: {vip_path}"
    nst = struct.unpack_from("<i", d, 4)[0]
    ncolors = struct.unpack_from("<i", d, 8)[0]
    posX, posY = struct.unpack_from("<hh", d, 0x0C)
    negX, negY = struct.unpack_from("<hh", d, 0x10)
    attr = struct.unpack_from("<i", d, 0x14)[0]
    xo = struct.unpack_from("<i", d, 0x18)[0]
    yo = struct.unpack_from("<i", d, 0x1C)[0]
    return {
        "file": vip_path.name,
        "nst": nst,
        "ncolors": ncolors,
        "ext": [posX, posY, negX, negY],
        "offsets": {"attribute": attr, "x": xo, "y": yo, "eof": len(d)},
        "commands": expand(bytearray(d[attr:xo]), nst),
        "xs": expand(bytearray(d[xo:yo]), nst),
        "ys": expand(bytearray(d[yo:]), nst),
    }


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for vip in sorted(FIXTURES.glob("*.vip")):
        golden = dump(vip)
        out_file = OUT / (vip.stem + ".json")
        out_file.write_text(json.dumps(golden), encoding="utf-8")
        print(f"wrote {out_file.relative_to(REPO)}  "
              f"(nst={golden['nst']}, cmd={len(golden['commands'])}, "
              f"xs={len(golden['xs'])}, ys={len(golden['ys'])})")


if __name__ == "__main__":
    main()
