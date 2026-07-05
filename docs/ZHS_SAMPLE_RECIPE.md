# ZHS sample recipe — unlocking multicolor + trim writing

> **STATUS UPDATE (2026-07-04):** il campione factory
> `fixtures/zhs-samples/SHE2215A_003.zhs` (+ gemello `.pes`) ha già sbloccato
> il **multicolore** (palette, record 0x04, tabella per-blocco, telaio a
> 0x2C/0x2E — vedi docs/ZHS_FORMAT.md §5): il writer multicolore è attivo e
> testato. Restano da produrre SOPRATTUTTO: **`trim1`** (il byte trim è
> ancora ignoto), `mctrim`, `resave` (word 0x83) e `hoopA`/`hoopB`
> (conferma finale telaio). `mc2`/`mc3` ora servono solo come conferma di
> come Artist Toolkit riempie i campi metadata delle righe per-blocco.

> **TL;DR (italiano):** crea i disegni qui sotto (piccoli, pochi punti,
> colori "puri"), salva ognuno **sia come `.zhs` sia come `.vip`** (stesso
> disegno, stesso salvataggio), mettili in `fixtures/zhs-samples/` con i nomi
> indicati e compila `NOTES.md`. Poi analizziamo tutto con
> `reference/zhs_inspect.py`.

## Why

The ZHS writer (`packages/core/src/writers/zhs.ts`) is verified only for
single-color pure-stitch designs. Three things are unknown and **cannot be
guessed safely** (see `docs/ZHS_FORMAT.md` §2–3):

1. the exact shape of the COLOR CHANGE record (`ctrl 0x04`) — payload? tie-in
   re-emitted after it? does it count toward `nStitches` / `elementCount`?
2. the TRIM record — `0x88` is a hypothesis, `0x41` is unmapped even in
   pyembroidery's reader;
3. the multi-color palette block — how `headerStartOffset`/`stitchStartOffset`
   and the `&$…&#…` thread-metadata string scale with N colors.

Each sample below isolates exactly one unknown, so hex diffs stay readable.

## Ground rules (all samples)

- **Location:** `fixtures/zhs-samples/<name>.zhs` + `<name>.vip`.
- **Save every design twice from Artist Toolkit: `.zhs` AND `.vip`.** The VIP
  is our decodable ground truth for commands (0x84 color change, 0x88 trim).
  If VIP export is not available, export `.pes` or `.dst` instead — but VIP is
  strongly preferred (same vendor family, lossless command mapping).
- **Keep designs tiny**: straight manual stitches, ≤ ~20 stitches per color,
  no fills, no satin, no auto-underlay, no lettering. Small = hand-readable
  hex dumps.
- **Use "pure" thread colors** so they are unmissable in the palette bytes:
  color A = red `#FF0000`, color B = blue `#0000FF`, color C = green `#00FF00`.
  If the Toolkit forces you to pick from a thread chart, pick the closest and
  write the actual RGB in `NOTES.md`.
- **Do not edit/rescale after placing stitches.** Place, save, done.
- After producing the files, run a sanity dump on each:
  `python reference/zhs_inspect.py dump fixtures/zhs-samples/<name>.zhs`

## The samples

| Name | What to create | What it isolates |
|------|----------------|------------------|
| `base` | Color A only: a small square of 4 straight stitches (~5 mm sides). | Control sample. Baseline for diffing everything else. |
| `mc2` | **Exactly the same square as `base`** in color A, then a color change, then a 3-stitch straight line in color B. No trim. | `diff base.zhs mc2.zhs` isolates the 0x04 record + the 2-color palette block. |
| `mc3` | Three colors: 2–3 stitches each (A, B, C), color changes between them. No trim. | How palette size scales `headerStartOffset`/`stitchStartOffset`/padding. |
| `trim1` | Color A only: one 4-stitch run, an **explicit trim/cut command**, then a second 4-stitch run a few mm away. | The trim record byte (0x88? 0x41? something else). |
| `mctrim` | Color A: 4-stitch run, **trim, then color change**, color B: 3-stitch run. | Record ordering when trim and color change are adjacent. |
| `hoopA` / `hoopB` | The **same** `base` design saved twice with two **different hoop selections** (if Artist Toolkit lets you choose a hoop). | Tests the hypothesis that header bytes `0x2C`/`0x2E` (= 1000, 1000) encode a 100×100 mm hoop in 0.1 mm units. |
| `resave` | Open the saved `base` design and immediately save-as `resave.zhs` **without any edit**. | Whether the unknown `0x83` word changes per save (editor counter?). |

Minimum viable set if time is short: `base`, `mc2`, `trim1`.

## NOTES.md template

Create `fixtures/zhs-samples/NOTES.md` alongside the files:

```markdown
# Sample production notes
- Artist Toolkit version: …
- Machine/profile selected: …
- Hoop selected (default): …

## base
- Steps: …
- Colors used (chart name + RGB): …

## mc2
- Steps: …
- Where the color change was inserted: …

## trim1
- Steps: …
- How the trim was inserted (menu/command name): …

## hoopA / hoopB
- hoopA hoop name/size: …
- hoopB hoop name/size: …
```

## What happens next (for the record)

1. `python reference/zhs_inspect.py dump <file>` on every sample → header,
   palette and record-stream dissection with automatic consistency checks.
2. `python reference/zhs_inspect.py diff base.zhs mc2.zhs` etc. → isolate the
   bytes each feature changes.
3. `dump <file> --vip <pair>` → confirm command correspondence (VIP 0x84/0x88
   records vs the new ZHS ctrl bytes) via absolute pen-path alignment.
4. Update `docs/ZHS_FORMAT.md`, implement palette-N + 0x04 + trim in
   `writers/zhs.ts` (`buildPaletteBlock` / record emitter), lift the gates,
   add byte-golden tests against these samples (modulo the known `0x83` byte).
5. Final acceptance stays physical: stitch one converted multicolor design out
   on the machine.
