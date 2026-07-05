#!/usr/bin/env python3
"""Generate golden files for the multi-format TS port (milestone 2).

For each test pattern (3 real VIP fixtures + 3 synthetic designs) and each
target format (dst, exp, jef, pes, pec, vp3) this produces:

  <name>.ir.json                the source pattern in IR terms (input for TS)
  <name>.<ext>                  bytes written by pyembroidery (writer golden)
  <name>.<ext>.normalized.json  the encoder-normalized stitch list (validates
                                the TS transcoder in isolation, incl. floats)
  <name>.<ext>.read.json        pyembroidery's read-back of its own output
                                (reader golden for the TS readers)

Deterministic: JEF date pinned, DST has no date, patterns carry explicit
threads (so pyembroidery's random filler thread is never used).

Run from repo root:  python packages/core/scripts/gen_format_golden.py
"""
import json
import sys
from pathlib import Path

import pyembroidery
from pyembroidery import EmbPattern
from pyembroidery.EmbConstant import (
    STITCH, JUMP, TRIM, COLOR_CHANGE, STOP, END, COMMAND_MASK,
)
from pyembroidery import DstWriter, ExpWriter, JefWriter, PesWriter, PecWriter, Vp3Writer, XxxWriter

REPO = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO / "reference"))
from zhs_vip_reference import read_vip  # noqa: E402

OUT = REPO / "packages" / "core" / "test" / "golden" / "formats"

JEF_DATE = "20260704120000"

COMMAND_NAMES = {
    STITCH: "STITCH", JUMP: "JUMP", TRIM: "TRIM",
    COLOR_CHANGE: "COLOR_CHANGE", STOP: "STOP", END: "END",
}

FORMATS = {
    "dst": (DstWriter, pyembroidery.write_dst, pyembroidery.read_dst, {}),
    "exp": (ExpWriter, pyembroidery.write_exp, pyembroidery.read_exp, {}),
    "jef": (JefWriter, pyembroidery.write_jef, pyembroidery.read_jef, {"date": JEF_DATE}),
    "pes": (PesWriter, pyembroidery.write_pes, pyembroidery.read_pes, {}),
    "pec": (PecWriter, pyembroidery.write_pec, pyembroidery.read_pec, {}),
    "vp3": (Vp3Writer, pyembroidery.write_vp3, pyembroidery.read_vp3, {}),
    "xxx": (XxxWriter, pyembroidery.write_xxx, pyembroidery.read_xxx, {}),
}


def merged_settings(writer_module, extra):
    """Replicates EmbPattern.write_embroidery's settings merge."""
    s = dict(extra)
    for key, attr in (
        ("max_jump", "MAX_JUMP_DISTANCE"),
        ("max_stitch", "MAX_STITCH_DISTANCE"),
        ("full_jump", "FULL_JUMP"),
        ("round", "ROUND"),
        ("sequin_contingency", "SEQUIN_CONTINGENCY"),
        ("writes_speeds", "WRITES_SPEEDS"),
        ("thread_change_command", "THREAD_CHANGE_COMMAND"),
        ("explicit_trim", "EXPLICIT_TRIM"),
    ):
        if key not in s and hasattr(writer_module, attr):
            s[key] = getattr(writer_module, attr)
    return s


def pattern_from_vip(path):
    v = read_vip(str(path))
    p = EmbPattern()
    p.add_thread(0x348D1A)
    vx = vy = 0
    for c, dx, dy in v["recs"]:
        assert c == 0x80
        vx += dx
        vy += dy
        p.add_stitch_absolute(STITCH, vx, -vy)  # IR orientation: y = -(VIP y)
    return p


def synthetic_multicolor():
    p = EmbPattern()
    for rgb in (0xFF0000, 0x00AA55, 0x0000FF):
        p.add_thread(rgb)
    for x, y in ((0, 0), (20, 0), (20, 20), (0, 20)):
        p.add_stitch_absolute(STITCH, x, y)
    p.add_stitch_absolute(COLOR_CHANGE, 0, 20)
    for x, y in ((40, 20), (60, 20), (60, 40)):
        p.add_stitch_absolute(STITCH, x, y)
    p.add_stitch_absolute(COLOR_CHANGE, 60, 40)
    for x, y in ((60, 60), (80, 60), (80, 80)):
        p.add_stitch_absolute(STITCH, x, y)
    return p


def synthetic_longjump():
    p = EmbPattern()
    p.add_thread(0x123456)
    for x, y in ((0, 0), (50, 0), (50, 50)):
        p.add_stitch_absolute(STITCH, x, y)
    p.add_stitch_absolute(JUMP, 600, 600)   # > every max_jump -> split
    p.add_stitch_absolute(STITCH, 620, 620)
    p.add_stitch_absolute(STITCH, 900, 620)  # dx=280 -> long stitch handling
    p.add_stitch_absolute(STITCH, 900, 650)
    return p


def synthetic_trims():
    p = EmbPattern()
    p.add_thread(0xAA00AA)
    p.add_thread(0x00AAAA)
    for x, y in ((0, 0), (30, 0), (30, 30)):
        p.add_stitch_absolute(STITCH, x, y)
    p.add_stitch_absolute(TRIM, 30, 30)
    p.add_stitch_absolute(JUMP, 100, 30)
    for x, y in ((100, 60), (130, 60)):
        p.add_stitch_absolute(STITCH, x, y)
    p.add_stitch_absolute(STOP, 130, 60)
    for x, y in ((160, 60), (190, 60)):
        p.add_stitch_absolute(STITCH, x, y)
    p.add_stitch_absolute(COLOR_CHANGE, 190, 60)
    for x, y in ((190, 90), (220, 90)):
        p.add_stitch_absolute(STITCH, x, y)
    return p


def dump_stitches(pattern):
    out = []
    for x, y, cmd in pattern.stitches:
        name = COMMAND_NAMES.get(cmd & COMMAND_MASK)
        assert name is not None, f"unexpected command 0x{cmd:x}"
        out.append([x, y, name])
    return out


def dump_threads(pattern):
    threads = []
    for t in pattern.threadlist:
        threads.append({
            "rgb": t.color & 0xFFFFFF,
            "description": t.description,
            "catalog": t.catalog_number,
        })
    return threads


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    patterns = {
        "001s-A": pattern_from_vip(REPO / "fixtures" / "001s-A.vip"),
        "028-B": pattern_from_vip(REPO / "fixtures" / "028-B.vip"),
        "052-Z": pattern_from_vip(REPO / "fixtures" / "052-Z.vip"),
        "multicolor": synthetic_multicolor(),
        "longjump": synthetic_longjump(),
        "trims": synthetic_trims(),
    }
    for name, pattern in patterns.items():
        ir = {"stitches": dump_stitches(pattern), "threads": dump_threads(pattern)}
        (OUT / f"{name}.ir.json").write_text(json.dumps(ir), encoding="utf-8")
        for ext, (writer_mod, write_fn, read_fn, extra) in FORMATS.items():
            golden_path = OUT / f"{name}.{ext}"
            write_fn(pattern, str(golden_path), dict(extra))

            settings = merged_settings(writer_mod, extra)
            normalized = pattern.get_normalized_pattern(settings)
            (OUT / f"{name}.{ext}.normalized.json").write_text(
                json.dumps({
                    "stitches": dump_stitches(normalized),
                    "threads": dump_threads(normalized),
                }), encoding="utf-8")

            back = read_fn(str(golden_path))
            (OUT / f"{name}.{ext}.read.json").write_text(
                json.dumps({
                    "stitches": dump_stitches(back),
                    "threads": dump_threads(back),
                }), encoding="utf-8")
            print(f"{name}.{ext}: {golden_path.stat().st_size} bytes")


if __name__ == "__main__":
    main()
