#!/usr/bin/env python3
"""
ZHS inspector — dissect .zhs files for reverse-engineering (multicolor/trim).

Companion to reference/zhs_vip_reference.py and docs/ZHS_FORMAT.md. Built to
analyze the fixtures/zhs-samples/ set (see docs/ZHS_SAMPLE_RECIPE.md): it dumps
every header field including the unknowns, the palette block, and the full
record stream with running positions and checksum verification, and it can
byte-diff two .zhs files or cross-check a .zhs against its paired .vip.

Usage:
    python zhs_inspect.py dump  file.zhs [--vip file.vip] [--max-records N]
    python zhs_inspect.py diff  a.zhs b.zhs

Only `dump --vip` needs pyembroidery (via zhs_vip_reference.read_vip);
plain dump/diff are dependency-free. Windows-safe (no /tmp, no shell tricks).
"""

import argparse
import os
import struct
import sys

KNOWN_CTRL = {
    0x01: "MOVE",
    0x02: "STITCH",
    0x04: "COLOR_CHG",
    0x10: "CHECKSUM",
    0x80: "END",
}
# Not knowledge, hypotheses — flagged loudly when seen (docs/ZHS_FORMAT.md §3).
HYPOTHESIS_CTRL = {0x88: "TRIM??", 0x41: "UNMAPPED-0x41??"}

# ---------------------------------------------------------------------------
# Low-level decode (inverse of zhs_vip_reference.enc_delta)
# ---------------------------------------------------------------------------


def signed8(b):
    return b - 256 if b > 127 else b


def dec_delta(b1, b2):
    """Decode the interleaved (b1,b2) pair into a signed (dx,dy) delta."""
    x = (
        (b1 & 0x01) | (b2 & 0x02) | (b1 & 0x04) | (b2 & 0x08)
        | (b1 & 0x10) | (b2 & 0x20) | (b1 & 0x40) | (b2 & 0x80)
    )
    y = (
        (b2 & 0x01) | (b1 & 0x02) | (b2 & 0x04) | (b1 & 0x08)
        | (b2 & 0x10) | (b1 & 0x20) | (b2 & 0x40) | (b1 & 0x80)
    )
    x, y = signed8(x), signed8(y)
    if x >= 63:
        x += 1
    elif x <= -63:
        x -= 1
    if y >= 63:
        y += 1
    elif y <= -63:
        y -= 1
    return x, y


# ---------------------------------------------------------------------------
# Header model
# ---------------------------------------------------------------------------

# (offset, struct fmt, name, expected-constant-or-None)
HEADER_FIELDS = [
    (0x00, "7s", "magic", b"HSING12"),
    (0x07, "<I", "elementCount (nData+1)", None),
    (0x0B, "<I", "nStitches", None),
    (0x0F, "<I", "stitchStartOffset", None),
    (0x13, "<I", "headerStartOffset (palette)", None),
    (0x17, "<I", "const 150 (unknown)", 150),
    (0x1C, "<h", "posX (max X)", None),
    (0x1E, "<h", "negX (min X)", None),
    (0x20, "<h", "pad @0x20", 0),
    (0x22, "<h", "posY (max Y)", None),
    (0x24, "<h", "negY (min Y)", None),
    (0x28, "4s", 'ascii "0000"', b"0000"),
    (0x2C, "<H", "const 1000 @0x2C (hoop W? 0.1mm)", 1000),
    (0x2E, "<H", "const 1000 @0x2E (hoop H? 0.1mm)", 1000),
    (0x65, "B", "const 0x01 @0x65", 1),
    (0x68, "<I", "nStitches (dup @0x68)", None),
    (0x6C, "<h", "firstX (first record dx)", None),
    (0x6E, "<h", "firstY (first record dy)", None),
    (0x70, "<I", "const 2 @0x70", 2),
    (0x74, "<I", "const 140 @0x74", 140),
    (0x7B, "<h", "lastX (final abs X)", None),
    (0x7D, "<h", "lastY (final abs Y)", None),
    (0x7F, "<H", "totalRecords-2 @0x7F", None),
    (0x83, "<H", "UNKNOWN editor meta @0x83", None),
]


def parse_header(data):
    fields = {}
    covered = set()
    for off, fmt, name, expected in HEADER_FIELDS:
        size = struct.calcsize(fmt)
        value = struct.unpack_from(fmt, data, off)[0]
        fields[name] = (off, value, expected)
        covered.update(range(off, off + size))
    return fields, covered


def parse_palette(data, header_start, stitch_start):
    """Return dict describing the palette block between the two offsets."""
    p = {"colorCount": data[header_start]}
    pos = header_start + 1
    colors = []
    for _ in range(p["colorCount"]):
        colors.append((data[pos] << 16) | (data[pos + 1] << 8) | data[pos + 2])
        pos += 3
    p["colors"] = colors
    p["stringLength"] = struct.unpack_from("<H", data, pos)[0]
    pos += 2
    raw = bytes(data[pos : pos + p["stringLength"]])
    p["string"] = raw
    pos += p["stringLength"]
    p["paddingStart"] = pos
    p["padding"] = bytes(data[pos:stitch_start])
    return p


# ---------------------------------------------------------------------------
# Record stream model
# ---------------------------------------------------------------------------


def parse_records(data, stitch_start):
    """Parse 3-byte records from stitch_start to EOF.

    Returns (records, leftover) where each record is a dict:
      idx, off, ctrl, b1, b2, dx, dy, absX, absY  (data records)
      idx, off, ctrl, stored_sum, computed_sum, block_records (checksums)
    Running position accumulates deltas of EVERY non-checksum record —
    including unknown ctrl bytes, on the assumption they carry a delta payload
    (that assumption is itself something the dump lets you falsify).
    """
    records = []
    ax = ay = 0
    block = bytearray()
    block_records = 0
    idx = 0
    pos = stitch_start
    n = len(data)
    while pos + 3 <= n:
        ctrl, b1, b2 = data[pos], data[pos + 1], data[pos + 2]
        rec = {"idx": idx, "off": pos, "ctrl": ctrl, "b1": b1, "b2": b2}
        if ctrl == 0x10:
            stored = b1 | (b2 << 8)
            rec["stored_sum"] = stored
            rec["computed_sum"] = sum(block) & 0xFFFF
            rec["block_records"] = block_records
            block = bytearray()
            block_records = 0
        else:
            dx, dy = dec_delta(b1, b2)
            ax += dx
            ay += dy
            rec.update(dx=dx, dy=dy, absX=ax, absY=ay)
            block += bytes([ctrl, b1, b2])
            block_records += 1
        records.append(rec)
        idx += 1
        pos += 3
    return records, bytes(data[pos:])


def parse_zhs(path):
    data = open(path, "rb").read()
    if data[:7] != b"HSING12":
        raise ValueError(f"Not a ZHS file (bad magic): {path}")
    fields, covered = parse_header(data)
    header_start = fields["headerStartOffset (palette)"][1]
    stitch_start = fields["stitchStartOffset"][1]
    palette = parse_palette(data, header_start, stitch_start)
    records, leftover = parse_records(data, stitch_start)
    return {
        "path": path,
        "data": data,
        "fields": fields,
        "covered": covered,
        "header_start": header_start,
        "stitch_start": stitch_start,
        "palette": palette,
        "records": records,
        "leftover": leftover,
    }


# ---------------------------------------------------------------------------
# dump
# ---------------------------------------------------------------------------


def fmt_val(v):
    if isinstance(v, bytes):
        return repr(v)
    return f"{v} (0x{v & 0xFFFFFFFF:X})"


def dump_header(z):
    print(f"== {z['path']} ({len(z['data'])} bytes) ==")
    print("\n-- Header fields --")
    for off, fmt, name, expected in HEADER_FIELDS:
        _, value, _ = z["fields"][name]
        mark = ""
        if expected is not None:
            mark = "  OK" if value == expected else f"  *** DIFFERS (expected {fmt_val(expected)}) ***"
        print(f"  0x{off:02X}  {name:<36} = {fmt_val(value)}{mark}")

    # Everything in the header not covered by a known field must be zero.
    surprises = [
        (i, z["data"][i])
        for i in range(z["header_start"])
        if i not in z["covered"] and z["data"][i] != 0
    ]
    if surprises:
        print("\n-- UNEXPECTED NONZERO header bytes (possible new fields!) --")
        for off, val in surprises:
            print(f"  0x{off:02X} = 0x{val:02X} ({val})")
    else:
        print("\n  (all uncovered header bytes are zero, as in the single-color template)")


def dump_palette(z):
    p = z["palette"]
    print("\n-- Palette block --")
    print(f"  headerStart=0x{z['header_start']:X}  stitchStart=0x{z['stitch_start']:X}")
    print(f"  colorCount   = {p['colorCount']}")
    for i, rgb in enumerate(p["colors"]):
        print(f"  color[{i}]     = #{rgb:06X}")
    print(f"  stringLength = {p['stringLength']}")
    print(f"  string       = {p['string']!r}")
    nonzero_pad = [(p["paddingStart"] + i, b) for i, b in enumerate(p["padding"]) if b != 0]
    print(f"  padding      = {len(p['padding'])} bytes to stitchStart", end="")
    if nonzero_pad:
        print("  *** NONZERO PADDING ***")
        for off, val in nonzero_pad:
            print(f"    0x{off:X} = 0x{val:02X}")
    else:
        print(" (all zero)")


def dump_records(z, max_records):
    recs = z["records"]
    print(f"\n-- Record stream ({len(recs)} records) --")
    print("  idx    off     ctrl  name          raw       dx   dy    absX  absY")
    shown = recs if len(recs) <= max_records else recs[: max_records // 2] + recs[-max_records // 2 :]
    prev_idx = None
    for r in shown:
        if prev_idx is not None and r["idx"] != prev_idx + 1:
            print(f"  ... {recs[prev_idx + 1]['idx']}..{r['idx'] - 1} omitted (use --max-records) ...")
        prev_idx = r["idx"]
        name = KNOWN_CTRL.get(r["ctrl"]) or HYPOTHESIS_CTRL.get(r["ctrl"]) or "*** UNKNOWN ***"
        raw = f"{r['ctrl']:02X} {r['b1']:02X} {r['b2']:02X}"
        if r["ctrl"] == 0x10:
            ok = "OK" if r["stored_sum"] == r["computed_sum"] else f"BAD (computed 0x{r['computed_sum']:04X})"
            print(
                f"  {r['idx']:>4}  0x{r['off']:05X}  0x{r['ctrl']:02X}  {name:<12}  {raw}  "
                f"sum=0x{r['stored_sum']:04X} {ok}, block had {r['block_records']} records"
            )
        else:
            print(
                f"  {r['idx']:>4}  0x{r['off']:05X}  0x{r['ctrl']:02X}  {name:<12}  {raw}  "
                f"{r['dx']:>3}  {r['dy']:>3}   {r['absX']:>5} {r['absY']:>5}"
            )
    if z["leftover"]:
        print(f"  *** {len(z['leftover'])} LEFTOVER bytes after last full record: {z['leftover'].hex(' ')} ***")


def dump_consistency(z):
    """Re-derive every derivable header field from the stream and compare."""
    recs = [r for r in z["records"] if r["ctrl"] != 0x10]
    data_recs = [r for r in recs if r["ctrl"] != 0x80]
    f = {name: v for name, (off, v, e) in z["fields"].items()}

    stitch_count = sum(1 for r in data_recs if r["ctrl"] == 0x02)
    ctrl_counts = {}
    for r in z["records"]:
        ctrl_counts[r["ctrl"]] = ctrl_counts.get(r["ctrl"], 0) + 1

    xs = [r["absX"] for r in data_recs]
    ys = [r["absY"] for r in data_recs]
    total_records = len(z["records"])

    print("\n-- Consistency checks (header vs stream) --")

    def check(label, header_val, computed):
        mark = "OK" if header_val == computed else f"*** MISMATCH (header {header_val}, stream {computed}) ***"
        print(f"  {label:<42} {mark}")

    print(f"  ctrl histogram: " + ", ".join(f"0x{c:02X} x{n}" for c, n in sorted(ctrl_counts.items())))
    check("elementCount == dataRecords+1", f["elementCount (nData+1)"], len(data_recs) + 1)
    check("nStitches == count(0x02)", f["nStitches"], stitch_count)
    check("nStitches dup @0x68", f["nStitches (dup @0x68)"], stitch_count)
    check("0x7F == totalRecords-2", f["totalRecords-2 @0x7F"], total_records - 2)
    if data_recs:
        check("firstX == rec[0].dx", f["firstX (first record dx)"], data_recs[0]["dx"])
        check("firstY == rec[0].dy", f["firstY (first record dy)"], data_recs[0]["dy"])
    if recs:
        check("lastX == final absX", f["lastX (final abs X)"], recs[-1]["absX"])
        check("lastY == final absY", f["lastY (final abs Y)"], recs[-1]["absY"])
    if xs:
        check("posX == max(absX)", f["posX (max X)"], max(xs))
        check("negX == min(absX)", f["negX (min X)"], min(xs))
        check("posY == max(absY)", f["posY (max Y)"], max(ys))
        check("negY == min(absY)", f["negY (min Y)"], min(ys))
    bad_sums = [r for r in z["records"] if r["ctrl"] == 0x10 and r["stored_sum"] != r["computed_sum"]]
    print(f"  checksum records: {ctrl_counts.get(0x10, 0)}, bad: {len(bad_sums)}")
    unknown = sorted(c for c in ctrl_counts if c not in KNOWN_CTRL)
    if unknown:
        print(f"  *** UNKNOWN/HYPOTHESIS ctrl bytes present: {[hex(c) for c in unknown]} ***")


def dump_vip_pair(z, vip_path):
    """Cross-check against the paired VIP: command counts + pen-down path."""
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from zhs_vip_reference import read_vip  # needs pyembroidery

    v = read_vip(vip_path)
    print(f"\n-- VIP pair: {vip_path} --")
    vc = {}
    for c, _, _ in v["recs"]:
        vc[c] = vc.get(c, 0) + 1
    print("  VIP ctrl histogram: " + ", ".join(f"0x{c:02X} x{n}" for c, n in sorted(vc.items())))
    print(f"  VIP extents (posX,posY,negX,negY) = {v['ext']}")

    # VIP non-stitch commands with their record index and absolute position —
    # the map for locating the matching ZHS records.
    ax = ay = 0
    specials = []
    for i, (c, dx, dy) in enumerate(v["recs"]):
        ax += dx
        ay += dy
        if c != 0x80:
            specials.append((i, c, ax, ay))
    if specials:
        print("  VIP non-stitch records (idx, cmd, absX, absY):")
        for i, c, x, y in specials:
            name = {0x81: "JUMP", 0x84: "COLOR_CHG", 0x88: "TRIM"}.get(c, "?")
            print(f"    idx {i:>4}  0x{c:02X} {name:<9} at ({x},{y})")

    # Pen-down path comparison (stored orientation: ZHS y == VIP y).
    ax = ay = 0
    vpath = []
    for c, dx, dy in v["recs"]:
        ax += dx
        ay += dy
        if c == 0x80:
            vpath.append((ax, ay))
    zpath = [(r["absX"], r["absY"]) for r in z["records"] if r["ctrl"] == 0x02]

    def strip(seq):
        out = []
        for e in seq:
            if not out or out[-1] != e:
                out.append(e)
        return out

    vs, zs = strip(vpath), strip(zpath)
    if vs == zs:
        print(f"  pen-down path match: True ({len(vs)} unique positions)")
    else:
        print(f"  pen-down path match: FALSE (VIP {len(vs)} vs ZHS {len(zs)} unique positions)")
        for i, (a, b) in enumerate(zip(vs, zs)):
            if a != b:
                print(f"    first divergence at pen index {i}: VIP {a} vs ZHS {b}")
                break


# ---------------------------------------------------------------------------
# diff
# ---------------------------------------------------------------------------


def diff(a_path, b_path):
    a, b = parse_zhs(a_path), parse_zhs(b_path)
    print(f"== diff {a_path}  vs  {b_path} ==")
    print(f"  sizes: {len(a['data'])} vs {len(b['data'])} bytes")

    print("\n-- Header field diff --")
    same = True
    for off, fmt, name, expected in HEADER_FIELDS:
        va, vb = a["fields"][name][1], b["fields"][name][1]
        if va != vb:
            same = False
            print(f"  0x{off:02X}  {name:<36} A={fmt_val(va)}  B={fmt_val(vb)}")
    if same:
        print("  (identical)")

    pa, pb = a["palette"], b["palette"]
    print("\n-- Palette diff --")
    if (pa["colorCount"], pa["colors"], pa["stringLength"], pa["string"]) == (
        pb["colorCount"], pb["colors"], pb["stringLength"], pb["string"]
    ):
        print("  (identical)")
    else:
        print(f"  A: count={pa['colorCount']} colors={[f'#{c:06X}' for c in pa['colors']]} str={pa['string']!r}")
        print(f"  B: count={pb['colorCount']} colors={[f'#{c:06X}' for c in pb['colors']]} str={pb['string']!r}")

    print("\n-- Raw byte diff (header region 0x00..max(stitchStart)) --")
    limit = max(a["stitch_start"], b["stitch_start"])
    diffs = [
        i
        for i in range(min(len(a["data"]), len(b["data"]), limit))
        if a["data"][i] != b["data"][i]
    ]
    if diffs:
        for i in diffs:
            print(f"  0x{i:04X}: A=0x{a['data'][i]:02X}  B=0x{b['data'][i]:02X}")
    else:
        print("  (identical)")

    print("\n-- Record stream diff --")
    ra, rb = a["records"], b["records"]
    print(f"  record counts: A={len(ra)}  B={len(rb)}")
    div = None
    for i in range(min(len(ra), len(rb))):
        ka = (ra[i]["ctrl"], ra[i]["b1"], ra[i]["b2"])
        kb = (rb[i]["ctrl"], rb[i]["b1"], rb[i]["b2"])
        if ka != kb:
            div = i
            break
    if div is None and len(ra) == len(rb):
        print("  (identical)")
        return
    if div is None:
        div = min(len(ra), len(rb))
    print(f"  first divergence at record {div}:")
    for tag, recs in (("A", ra), ("B", rb)):
        lo, hi = max(0, div - 3), min(len(recs), div + 4)
        for r in recs[lo:hi]:
            name = KNOWN_CTRL.get(r["ctrl"]) or HYPOTHESIS_CTRL.get(r["ctrl"]) or "UNKNOWN"
            marker = " <--" if r["idx"] == div else ""
            print(
                f"    {tag}[{r['idx']:>4}] 0x{r['off']:05X}  "
                f"{r['ctrl']:02X} {r['b1']:02X} {r['b2']:02X}  {name}{marker}"
            )


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    d = sub.add_parser("dump", help="dissect one .zhs file")
    d.add_argument("zhs")
    d.add_argument("--vip", help="paired .vip for cross-checking (needs pyembroidery)")
    d.add_argument("--max-records", type=int, default=200, help="max record rows to print (default 200)")

    f = sub.add_parser("diff", help="compare two .zhs files")
    f.add_argument("a")
    f.add_argument("b")

    args = ap.parse_args()
    if args.cmd == "dump":
        z = parse_zhs(args.zhs)
        dump_header(z)
        dump_palette(z)
        dump_records(z, args.max_records)
        dump_consistency(z)
        if args.vip:
            dump_vip_pair(z, args.vip)
    else:
        diff(args.a, args.b)


if __name__ == "__main__":
    try:
        main()
    except (BrokenPipeError, OSError) as e:
        # Downstream pipe closed early (e.g. `| head`, `| Select-Object -First`).
        if isinstance(e, OSError) and not isinstance(e, BrokenPipeError) and e.errno != 22:
            raise
        sys.exit(0)
