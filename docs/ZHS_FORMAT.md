# ZHS format — reverse-engineered spec (Zeng Hsing / "HSING12")

Fully reverse-engineered from real **Artist Toolkit** output during a Cowork
session. The single-color mapping is **verified**: regenerating `028-B.vip`
with this spec produces a file **byte-identical** to `fixtures/028-B.zhs`
except a single metadata word at `0x83`.

**Multicolor update (2026-07-04):** a real factory multicolor sample
(`fixtures/zhs-samples/SHE2215A_003.zhs`, 6 unique colors / 10 color blocks,
9302 stitches, with a `.pes` twin of the same design) decoded the general
layout — see §5. The "single-color header" of §1 turned out to be the
1-block special case of a per-block table. TRIM is **still unknown** (the
sample contains none).

> There is **no open-source ZHS writer** anywhere (pyembroidery/Ink-Stitch/
> libembroidery can *read* ZHS but not *write* it). This spec is the whole point
> of the project — guard it with round-trip tests.

All multi-byte integers are **little-endian** unless noted.

## 1. Fixed header (offsets 0x00–0x85)

| Offset | Type   | Meaning                                             | How to compute |
|-------:|--------|-----------------------------------------------------|----------------|
| 0x00   | 7 bytes| ASCII magic `"HSING12"`                             | constant |
| 0x07   | uint32 | element count = `nData + 1`                         | data records (moves+stitches) + 1 |
| 0x0B   | uint32 | stitch count `nStitches`                            | pen-down (0x02) records |
| 0x0F   | uint32 | **stitchStartOffset** (155 / 0x9B, single-color)    | where the stitch stream begins |
| 0x13   | uint32 | **headerStartOffset** (134 / 0x86, single-color)    | where the palette block begins |
| 0x17   | uint32 | 150 (0x96) — constant (purpose unknown)             | constant |
| 0x1C   | int16  | posX  (max X, from VIP extents)                     | copy from VIP header |
| 0x1E   | int16  | negX  (min X)                                       | copy from VIP header |
| 0x20   | int16  | 0 (pad)                                             | constant |
| 0x22   | int16  | posY  (max Y)                                       | copy from VIP header |
| 0x24   | int16  | negY  (min Y)                                       | copy from VIP header |
| 0x28   | 4 bytes| ASCII `"0000"`                                      | constant |
| 0x2C   | int16  | 1000 (0x03E8)                                       | constant |
| 0x2E   | int16  | 1000 (0x03E8)                                       | constant |
| 0x30–0x64 | zeros | except **0x65 = 0x01**                            | constant |
| 0x68   | uint32 | stitch count `nStitches` (again)                    | same as 0x0B |
| 0x6C   | int16  | firstX = dx of the first record (stored coords)     | first move delta X |
| 0x6E   | int16  | firstY = dy of the first record (stored = VIP-Y)    | first move delta Y (VIP orientation) |
| 0x70   | uint32 | 2 — constant                                        | constant |
| 0x74   | uint32 | 140 (0x8C) — constant                               | constant |
| 0x78–0x7A | zeros |                                                   | constant |
| 0x7B   | int16  | lastX = final absolute X (stored coords)            | sum of all record dx |
| 0x7D   | int16  | lastY = final absolute Y (stored = VIP-Y)           | sum of all record dy |
| 0x7F   | uint16 | `totalRecords - 2` (all 3-byte records incl. checksums+END) | derive from stream |
| 0x81–0x82 | zeros |                                                   | constant |
| 0x83   | uint16 | **UNKNOWN editor metadata** (samples: 486 vs 2)     | not derivable — see note |
| 0x85   | 0      |                                                     | constant |

### Note on 0x83
Across the two ground-truth samples this field is `486` (001s-A) and `2` (028-B).
It correlates with **no** design metric (stitch count, extents, byte sums, path,
file size — all tested). The ZHS *reader* never reads it. Conclusion: it's an
Artist Toolkit internal/editor value, safe to set to `0`. **Flag it in the UI**
("output differs from Artist Toolkit only by 1 ignored metadata byte") and treat
a physical stitch-out test as the final acceptance gate.

## 2. Palette block (starts at headerStartOffset, 0x86 for single-color)

```
uint8   colorCount
colorCount × 3 bytes   RGB, 24-bit BIG-ENDIAN
uint16  stringLength (LE)
bytes   thread-metadata string (UTF-8), length = stringLength
... zero padding up to stitchStartOffset (0x9B)
```

The metadata string is a `&$`/`&#`-delimited structure (chart, description,
catalog number per thread). For the monogram letters the whole block is constant:

```
01  34 8D 1A  08 00  "&$&#&#&%"
```
i.e. 1 color, RGB `#348D1A`, an 8-byte string `&$&#&#&%`, then zeros to 0x9B.

> **Multi-color is NOT verified.** The reader shows the palette can hold N colors
> and per-thread metadata, but we have no multi-color `.zhs` sample to validate
> *writing* it. Get 1–2 multi-color pairs before enabling that path.

## 3. Stitch stream (starts at stitchStartOffset, 0x9B)

A flat list of **3-byte records**: `[ctrl, b1, b2]`.

### Control byte
| ctrl | meaning        |
|------|----------------|
| 0x01 | MOVE / jump-in |
| 0x02 | STITCH         |
| 0x04 | COLOR CHANGE   |
| 0x10 | CHECKSUM (see below) |
| 0x80 | END            |
| 0x41 | seen in reader as "unmapped" — meaning unknown |
| 0x88?| TRIM — **unknown**, no sample. GAP for general converter. |

### Coordinate packing (b1, b2)
`dx` and `dy` are 8-bit signed deltas whose bits are **interleaved** across b1/b2:

```
x.bit0 <- b1.bit0   x.bit1 <- b2.bit1   x.bit2 <- b1.bit2   x.bit3 <- b2.bit3
x.bit4 <- b1.bit4   x.bit5 <- b2.bit5   x.bit6 <- b1.bit6   x.bit7 <- b2.bit7
y.bit0 <- b2.bit0   y.bit1 <- b1.bit1   y.bit2 <- b2.bit2   y.bit3 <- b1.bit3
y.bit4 <- b2.bit4   y.bit5 <- b1.bit5   y.bit6 <- b2.bit6   y.bit7 <- b1.bit7
```
After extraction, values are `signed8` with a range-extension tweak on **decode**:
`if v>=63: v+=1` and `if v<=-63: v-=1`. On **encode** invert it:
`if v>=64: store v-1` and `if v<=-64: store v+1`.

> **±63 representational hole** (found while porting to TS): because of the
> decode tweak, a delta of exactly **+63 or −63 cannot be stored** — stored 63
> decodes as 64. Decodable range is −129..128 minus ±63. No fixture contains
> such a delta (max |delta| observed: 32). The TS writer computes each delta
> against the *decoded* position, so an unrepresentable ±63 degrades to a
> single 0.1 mm deviation on that one stitch (with a structured warning)
> instead of shifting the rest of the design.

**Y sign:** the reader emits `stitch(x, -y)`. So the *stored* y equals the VIP y
(VIP already uses the negated convention). When converting VIP→ZHS you copy the
VIP deltas straight in — no sign flip needed.

### Checksum records
After **every 84 data records**, insert one checksum record:
```
[0x10, sum & 0xFF, (sum >> 8) & 0xFF]     # 16-bit LE sum of ALL bytes in the
                                          # just-completed 84-record block
```
`sum` = arithmetic sum of every byte (ctrl+b1+b2) of the records in that block.
Verified on all sample blocks.

### End of file
After the last data record: emit the `END` record `[0x80,0,0]`, **then** a final
checksum record over that trailing block (the block that contains the END record).

## 4. VIP → ZHS record mapping (single-color, verified)

1. First VIP record → ZHS **MOVE** `[0x01]` with the same (dx,dy).
2. Immediately emit a **tie-in duplicate** stitch `[0x02] (0,0)`.
3. Every remaining VIP stitch → ZHS **STITCH** `[0x02]` with (dx,dy).
4. Drop the VIP END record; emit ZHS END + trailing checksum instead.

> Artist Toolkit sometimes appends an extra zero-length `(0,0)` tie stitch before
> END (seen in 001s-A, not in 028-B). It's a no-op for the machine. The clean
> rule above matches 028-B **byte-for-byte** and every design **functionally**
> (identical absolute stitch path). Do not try to reproduce that quirk unless
> byte-identity with Artist Toolkit becomes a hard requirement.

See `reference/zhs_vip_reference.py` for the executable, tested implementation.

## 5. General (multicolor) layout — decoded from SHE2215A_003

Everything in this section was cross-checked against the factory sample with
`reference/zhs_inspect.py` and the design's `.pes` twin.

### 5.1 Header = globals + per-block 20-byte rows

```
0x00–0x5D   globals (as §1 for 0x00–0x2F; reinterpretations below)
0x5E        row[0]      — color block 0
0x5E+20     row[1]      — color block 1
...
0x5E+20·N   terminator row
headerStart = 0x5E + 20·(N+1)      (palette block starts here)
stitchStart = headerStart + paletteBlockSize + 7 zero bytes
```

Reinterpretations of §1 "constants" (single-color = the 1-block case):
- `0x17` (u32) = **stitchStart − 5** (150 = 0x9B−5; factory 478 = 0x1E3−5)
- `0x2C`/`0x2E` (u16) = **hoop width/height in 0.1 mm** (1000/1000 = the
  100×100 hoop; factory 2600/1600 = a 260×160 hoop)
- `0x65` (u8) = **number of color blocks** (1; factory 10)

Per-block row (offsets relative to the row start):
| Off | Type | Meaning |
|----:|------|---------|
| +2  | u16  | editor metadata counter — monotonic per block in factory files (335→463), **0 in Artist Toolkit block 0**; not derivable, readers ignore it; write 0 |
| +9  | u8   | **palette index** of the block's color |
| +10 | u16  | **stitch count** of the block (0x02 records, tie-in included) |
| +14 | i16  | sum of the **on-disk byte values** (post ±63-adjust) of the dx's of the block's opening MOVE run |
| +16 | i16  | same for dy |
| +18 | u16  | **1-based stream record index** (checksums included) of the block's first 0x02 record (the tie-in) |

Terminator row:
| Off | Type | Meaning |
|----:|------|---------|
| +2  | u16  | 140 in every Artist Toolkit sample (unknown; factory 463) |
| +9  | i16  | sum of on-disk dx bytes over ALL MOVE+STITCH records (single-color "lastX") |
| +11 | i16  | same for dy ("lastY") |
| +13 | u16  | totalRecords − 2 (the old `0x7F`) |
| +17 | u16  | editor metadata (the old **`0x83`** mystery word) — write 0 |

In single-color files: row[0] = 0x5E..0x71 (hence `0x68` = stitch count,
`0x6C/0x6E` = first move delta, `0x70` = 2) and the terminator = 0x72..0x85
(hence `0x74` = 140, `0x7B/0x7D` = lastX/lastY, `0x7F`, `0x83`). All §1
values are reproduced exactly by the general formulas.

Factory files also carry small nonzero values at `0x20`/`0x26` and slightly
off extents (up to 1.8 mm vs the actual path) — original-design-space
leftovers; write 0 / computed extents.

### 5.2 Palette block (general)

```
uint8   colorCount            — number of UNIQUE colors
colorCount × 3 bytes          — RGB, 24-bit BIG-ENDIAN (unique colors)
uint16  stringLength (LE)
string                        — one "&$chart&#description&#catalog&%" entry
                                PER BLOCK (not per unique color!)
7 zero bytes of padding up to stitchStart
```

Factory sample: 6 RGBs + 10 entries ("Light Blue", "White", "Red", …).

### 5.3 COLOR_CHANGE record (ctrl 0x04)

The payload is **not a spatial delta**: `decodeDelta(b1, b2).dx` = the
**palette index of the NEXT block** (dy = 0). Verified: the sample's nine
CC payloads (1,2,3,4,2,1,3,5,1) match the PES twin's thread sequence
exactly. The decoder's position does not move; the delta accumulator resets.

### 5.4 Block opening

Every block starts with a MOVE run (0x01 records, deltas up to ±128,
long jumps chunked) followed by a **(0,0) tie-in stitch** which IS the
block's first stitch. Checksum cadence (84 data records) and the trailing
END+checksum are unchanged from §3.

### 5.5 Still unknown

- **TRIM record** — no sample contains one (`0x88` remains a guess; the
  factory multicolor file uses 148 raw MOVE runs and zero trims — the
  machine has no thread trimmer). The writer therefore **drops TRIMs with a
  `TRIM_DROPPED` warning** (JEF-writer-style); floating threads are cut by
  hand. If the `trim1` recipe sample (docs/ZHS_SAMPLE_RECIPE.md) ever
  reveals a real record, upgrade drop → encode.
- Block row +2 monotonic counter, terminator +17 (old `0x83`), factory
  `0x20`/`0x26` bytes — editor metadata, written as 0/constants.
- `0x41` ctrl byte — still unmapped (absent from every sample).
