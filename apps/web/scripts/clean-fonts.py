"""
Remove overlapping contours from the bundled Bricolage Grotesque woff2 files.

Bricolage Grotesque (like many modern display fonts) builds some glyphs from
overlapping contours that the fill rule merges invisibly. But the format wall
on the landing renders read-only formats with `-webkit-text-stroke` (hollow
outline), which strokes EVERY contour — including the internal overlap ones —
producing a stray mark inside letters like "e". Removing overlaps merges each
glyph into its true union: filled rendering is byte-for-byte identical, and the
outlined rendering is clean.

The Bricolage Grotesque OFL has no Reserved Font Name, so modifying the files
and keeping the family name is permitted.

One-off tool (fonttools + skia-pathops are not project dependencies):
    python -m pip install --user fonttools skia-pathops brotli
    python apps/web/scripts/clean-fonts.py
"""
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.ttLib.removeOverlaps import removeOverlaps

FONTS = Path(__file__).resolve().parent.parent / "src" / "assets" / "fonts"

for name in ("BricolageGrotesque-Medium.woff2", "BricolageGrotesque-SemiBold.woff2"):
    path = FONTS / name
    font = TTFont(path)  # woff2 read/write needs brotli
    removeOverlaps(font)
    font.flavor = "woff2"
    font.save(path)
    print(f"cleaned {name}")
