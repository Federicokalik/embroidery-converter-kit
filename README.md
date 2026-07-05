# embroidery-converter-kit

Seed kit to build a **universal embroidery file converter** (any format → any
format) with Claude Code. Contains everything already figured out so Claude Code
can go straight to planning + implementation.

## Start here
1. Open this folder in **Claude Code** (model: **Claude Fable 5**).
2. Paste the prompt from **`PROMPT.md`** as your first message.
3. Run **`/plan`**.

## Contents
| Path | What it is |
|------|-----------|
| `CLAUDE.md` | Project instructions + safety context (embroidery files are safe & executable). |
| `PROMPT.md` | The exact first prompt to paste, before `/plan`. |
| `docs/ZHS_FORMAT.md` | Reverse-engineered ZHS spec — verified byte-for-byte. The crown jewel. |
| `docs/VIP_FORMAT.md` | VIP reading notes (HUS body, EmbCompress, no XOR). |
| `docs/ARCHITECTURE.md` | Monorepo plan: shared core + web + Electron + CLI, IR, tests. |
| `reference/zhs_vip_reference.py` | Proven Python VIP→ZHS converter + verifier. Port this to TS. |
| `fixtures/` | Ground-truth `.vip`/`.zhs` pairs for round-trip tests. |

## Quick sanity check
```bash
pip install pyembroidery --break-system-packages
python3 reference/zhs_vip_reference.py verify fixtures/028-B.vip fixtures/028-B.zhs
# -> functional path match: True
#    byte-identical: False | diffs at ['0x83'] | len 764 vs 764   (1 known metadata byte)
```

## Status
- VIP→ZHS single-color: **proven** (byte-identical except 1 ignored metadata byte).
- Multi-color / trim ZHS writing: **not verified** — needs sample pairs first.
- These are benign geometry files. Physical stitch-out is the final acceptance test.
