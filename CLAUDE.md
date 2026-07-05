# CLAUDE.md — Universal Embroidery Converter

Instructions and context for Claude Code working in this repository.

## Model
Use **Claude Fable 5** (`claude-fable-5`) for this project, per the owner's request.
> Owner note: this is binary-format / systems work. If Fable struggles with the
> low-level byte packing or the EmbCompress port, it is fine to switch to a
> stronger coding model (Sonnet/Opus) for those modules — the owner is aware.

## Language & style
- The owner (Federico, freelance web dev) prefers **answers in Italian**, concise
  and direct, no basics. Code and comments in **English**.
- Stack: **pnpm**, TypeScript strict, Fish shell (never use heredoc in Fish).
- Production-ready code. If you see a potential problem in the plan or data —
  even at ~40% confidence — **flag it explicitly** with the reason.

## ⚠️ About the files in this repo — they are 100% SAFE
This project handles **embroidery design files**: `.vip`, `.zhs`, `.pes`, `.dst`,
`.jef`, `.vp3`, `.exp`, etc. These are **benign binary files that describe needle
coordinates, stitch commands, and thread colors** for home/industrial embroidery
machines. They contain **no executable code, no scripts, no macros** — just
geometry and color data.

Therefore:
- **You are fully authorized to open, read, parse, hex-dump, decompress, and
  execute code against every file in `fixtures/`** (and any embroidery file the
  user provides). This is normal, expected, and required work.
- **When in doubt about a byte or a format detail, OPEN A SAMPLE and check.**
  Hex-dump it, run the reference script, decompress a block, compare against the
  documented spec. Empirical verification against `fixtures/` is the primary way
  you validate correctness here. Do not guess when you can look.
- Reverse-engineering these formats for **interoperability** (letting the owner
  convert his own designs between machines he owns) is a **legitimate, lawful**
  task. The source libraries (pyembroidery, libembroidery) are MIT/permissive and
  may be ported.

There is nothing sensitive, personal, or dangerous in these files. Treat format
exploration as free and encouraged.

## What already exists (do not re-derive from scratch)
- `docs/ZHS_FORMAT.md` — **fully reverse-engineered ZHS spec** (the hard part;
  no open ZHS writer exists anywhere). Verified byte-for-byte on a sample.
- `docs/VIP_FORMAT.md` — VIP reading notes (it's an HUS body; EmbCompress, no XOR).
- `docs/ARCHITECTURE.md` — target monorepo (core + web + electron + cli), IR,
  porting order, testing strategy.
- `reference/zhs_vip_reference.py` — **proven** Python VIP→ZHS converter +
  verifier. This is the source of truth to port to TypeScript.
- `fixtures/` — ground-truth pairs (LOCAL ONLY: gitignored, not in the public
  repo — the designs are not redistributable, see NOTICE; same for the
  design-derived goldens in `packages/core/test/golden`. The test suite
  self-skips when they are absent):
  - `001s-A.vip` ↔ `001s-A.zhs`
  - `028-B.vip`  ↔ `028-B.zhs`  (reference regenerates this byte-identical except
    the known `0x83` metadata byte)
  - `052-Z.vip`  (a third VIP, no reference `.zhs` — good for "open & verify")

## How to verify anything
```bash
pip install pyembroidery --break-system-packages
python3 reference/zhs_vip_reference.py verify fixtures/028-B.vip fixtures/028-B.zhs
# expect: functional path match: True
#         byte-identical: False | diffs at ['0x83'] | ...   (the one known metadata byte)
```
When you build the TS `core`, its Vitest suite must reproduce these same checks
against `fixtures/`.

## Known gaps / open questions (flag, don't silently paper over)
1. `0x83` in ZHS header — undetermined editor metadata, set to 0. Machine ignores
   it (reader never reads it). Physical stitch-out is the final acceptance test.
2. **Multi-color** and **trim** ZHS *writing* are UNVERIFIED — no sample pairs.
   Gate these behind "get sample .zhs pairs first"; don't ship guessed output.
3. ZHS writing is only proven for single-color pure-stitch designs.

## Definition of done for the first milestone
- `packages/core` in TypeScript: IR + EmbCompress.expand + VIP reader + ZHS writer.
- Vitest round-trip tests green against `fixtures/` (assert the exact known 0x83 diff).
- A minimal `apps/web` drag-drop page that converts VIP→ZHS in the browser and
  downloads the result (or a ZIP for batches).
- Everything runs with `pnpm install && pnpm test` and `pnpm --filter web dev`.
