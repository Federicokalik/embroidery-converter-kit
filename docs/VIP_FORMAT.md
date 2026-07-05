# VIP format — reading notes (Husqvarna Viking / Pfaff)

pyembroidery does **not** ship a VIP reader, but VIP is essentially an **HUS body
with a different header**: the command/x/y streams use the same Greg-Hus
compression (`EmbCompress`) as HUS/VP3, with **no XOR layer** (confirmed by
decompressing the raw blocks and matching the ground-truth stitch path).

All integers little-endian.

## Header

| Offset | Type   | Meaning |
|-------:|--------|---------|
| 0x00   | uint32 | magic `0x0190FC5D` |
| 0x04   | int32  | numberOfStitches (includes the trailing END record) |
| 0x08   | int32  | numberOfColors |
| 0x0C   | int16  | posX (max X) |
| 0x0E   | int16  | posY (max Y) |
| 0x10   | int16  | negX (min X) |
| 0x12   | int16  | negY (min Y) |
| 0x14   | int32  | attributeOffset — start of the (compressed) command block |
| 0x18   | int32  | xOffset — start of the (compressed) X-delta block |
| 0x1C   | int32  | yOffset — start of the (compressed) Y-delta block |
| 0x20   | 8 bytes| string / reserved (zeros in the fixtures) |
| 0x28   | uint16 | unknown (0 in the fixtures) |
| 0x2A   | int32  | colorLength = `0x2E + 8·numberOfColors` (fixture formula) |
| 0x2E   | 4·n B  | **encrypted color block** (see below) |
| ...    | (n+1)×u32 | value 1 each (fixture layout) |
| ...    | uint16 | 0 — then `attributeOffset = 0x34 + 8·n` |

## Color block (decoded 2026-07-04)

Each color is 4 bytes `(r, g, b, 0)`, XOR-chained with the keystream from
libembroidery (`vipDecodingTable`, vendored in
`reference/vendor/libembroidery-unsorted.c`, generated into
`src/charts/vip-table.ts` by `scripts/gen_vip_table.py`):

```
decoded[i] = encoded[i] ^ TABLE[i] ^ encoded[i-1]      (encoded[-1] = 0)
encoded[i] = decoded[i] ^ TABLE[i] ^ encoded[i-1]
```

Known plaintext (all three fixtures): encoded `1a 15 eb 84` → `#348D1A`.
The multicolor layout formulas (colorLength/attributeOffset in `n`) are
verified only at n = 1 and extrapolated — flagged in the writer.

## Writing (TS core, 2026-07-04)

`packages/core/src/writers/vip.ts` + `hus.ts` share `hus-vip-body.ts`. The
streams use a **stored EmbCompress block** (degenerate literal Huffman
table, ≤ 65535 records — gated). NOTE: pyembroidery's own
`EmbCompress.compress` writes the block element count little-endian while
every decoder reads it MSB-first; it only decodes by luck for some sizes.
We write it in decoder order (verified against pyembroidery's `expand` for
all sizes). Status: **software-verified** (round-trip + pyembroidery
read-back via `scripts/verify_hus_vip.py`); machine/Artist Toolkit
acceptance pending.

## Decoding the streams

```
command_block = file[attributeOffset : xOffset]
x_block       = file[xOffset        : yOffset]
y_block       = file[yOffset        : EOF]

commands = EmbCompress.expand(command_block, numberOfStitches)   # 1 byte/stitch
xs       = EmbCompress.expand(x_block,       numberOfStitches)   # signed8 delta
ys       = EmbCompress.expand(y_block,       numberOfStitches)   # signed8 delta
```

## Command bytes (same as HUS)

| byte | meaning       |
|------|---------------|
| 0x80 | STITCH        |
| 0x81 | JUMP          |
| 0x84 | COLOR CHANGE  |
| 0x88 | TRIM          |
| 0x90 | END (stop reading) |

For our 52 monogram letters, all commands are `0x80` (stitch) terminated by a
single `0x90` (end); `numberOfColors == 1` for every file.

## EmbCompress (the compression)

This is the classic "Greg's HUS compression". The proven Python source is
`pyembroidery/EmbCompress.py` (MIT). When porting to TypeScript, port both
`expand()` (decompress, needed for reading) and — only if you ever want to
*write* HUS/VP3/VIP — the compressor. For **reading VIP/HUS/VP3** you only need
`expand()`.

Reference: https://github.com/inkstitch/pyembroidery (MIT license — porting OK).
