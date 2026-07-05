#!/usr/bin/env python3
"""One-off analysis of the SHE2215A_003 multicolor ZHS + PES pair.

Answers the open multicolor questions from docs/ZHS_SAMPLE_RECIPE.md:
- shape/payload of COLOR_CHANGE (0x04) records
- per-block stats vs the unknown 9x20-byte table at 0x86
- block -> palette-RGB mapping, cross-checked against the PES twin
- whether the ZHS pen path matches the PES pen path
"""
import struct
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from zhs_inspect import parse_zhs  # noqa: E402

ZHS = "fixtures/zhs-samples/SHE2215A_003.zhs"
PES = "fixtures/zhs-samples/SHE2215A_003.pes"

z = parse_zhs(ZHS)
recs = z["records"]
data = z["data"]

# --- COLOR_CHANGE payloads and block boundaries -----------------------------
print("== COLOR_CHANGE records ==")
cc = [r for r in recs if r["ctrl"] == 0x04]
for r in cc:
    print(
        f"  rec {r['idx']:>5} off 0x{r['off']:05X} raw {r['ctrl']:02X} {r['b1']:02X} {r['b2']:02X}"
        f"  delta ({r['dx']},{r['dy']})  abs ({r['absX']},{r['absY']})"
    )

# --- per-block stats ---------------------------------------------------------
print("\n== Per-block stats (blocks delimited by 0x04) ==")
blocks = []
current = []
for r in recs:
    if r["ctrl"] == 0x10:
        continue
    if r["ctrl"] == 0x04:
        blocks.append(current)
        current = []
        continue
    if r["ctrl"] == 0x80:
        break
    current.append(r)
blocks.append(current)
print(f"  {len(blocks)} blocks")
for i, b in enumerate(blocks):
    st = [r for r in b if r["ctrl"] == 0x02]
    mv = [r for r in b if r["ctrl"] == 0x01]
    xs = [r["absX"] for r in st]
    ys = [r["absY"] for r in st]
    print(
        f"  block {i}: stitches {len(st):>5}, moves {len(mv):>2}, "
        f"first data rec idx {b[0]['idx'] if b else '-':>5}, "
        f"X {min(xs)}..{max(xs)}, Y {min(ys)}..{max(ys)}"
        if st
        else f"  block {i}: EMPTY"
    )

# stitch-only global extents vs header
all_st = [r for r in recs if r["ctrl"] == 0x02]
print(
    "\n  stitch-only extents: "
    f"X {min(r['absX'] for r in all_st)}..{max(r['absX'] for r in all_st)}, "
    f"Y {min(r['absY'] for r in all_st)}..{max(r['absY'] for r in all_st)}"
)
print("  header extents:      X {}..{}, Y {}..{}".format(
    z["fields"]["negX (min X)"][1], z["fields"]["posX (max X)"][1],
    z["fields"]["negY (min Y)"][1], z["fields"]["posY (max Y)"][1],
))

# --- the unknown table at 0x86 ----------------------------------------------
print("\n== Unknown region 0x86..headerStart as 9 x 20-byte rows ==")
region = data[0x86 : z["header_start"]]
for i in range(0, len(region), 20):
    row = region[i : i + 20]
    u16s = [struct.unpack_from("<H", row, j)[0] for j in range(0, 20, 2)]
    print(f"  0x{0x86 + i:03X}: {row.hex(' ')}   u16 {u16s}")

# --- PES twin ----------------------------------------------------------------
print("\n== PES twin ==")
try:
    import pyembroidery
    p = pyembroidery.read(PES)
    from pyembroidery.EmbConstant import COMMAND_MASK, STITCH, JUMP, TRIM, COLOR_CHANGE, STOP, END
    names = {STITCH: "STITCH", JUMP: "JUMP", TRIM: "TRIM", COLOR_CHANGE: "CC", STOP: "STOP", END: "END"}
    hist = {}
    for _, _, c in p.stitches:
        k = names.get(c & COMMAND_MASK, hex(c & COMMAND_MASK))
        hist[k] = hist.get(k, 0) + 1
    print(f"  command histogram: {hist}")
    print(f"  threads ({len(p.threadlist)}):")
    for i, t in enumerate(p.threadlist):
        print(f"    {i}: #{t.color & 0xFFFFFF:06X} {t.description!r} cat={t.catalog_number!r}")
    # pen path comparison (PES y is IR-normalized by pyembroidery: y grows down?)
    pes_path = [(x, y) for x, y, c in p.stitches if (c & COMMAND_MASK) == STITCH]
    zhs_path = [(r["absX"], r["absY"]) for r in all_st]

    def strip(seq):
        out = []
        for e in seq:
            if not out or out[-1] != e:
                out.append(e)
        return out

    for label, transform in (
        ("as-is", lambda p_: p_),
        ("y-negated", lambda p_: [(x, -y) for x, y in p_]),
    ):
        pp = strip(transform(pes_path))
        zp = strip(zhs_path)
        if len(pp) != len(zp):
            print(f"  path {label}: length differs PES {len(pp)} vs ZHS {len(zp)}")
            continue
        # allow a constant offset between the two
        dx = zp[0][0] - pp[0][0]
        dy = zp[0][1] - pp[0][1]
        mismatch = sum(1 for a, b in zip(pp, zp) if (a[0] + dx, a[1] + dy) != b)
        print(f"  path {label}: {len(pp)} points, offset ({dx},{dy}), mismatching points: {mismatch}")
except ImportError:
    print("  pyembroidery not available")
