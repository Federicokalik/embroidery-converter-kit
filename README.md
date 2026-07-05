# Restitch — universal embroidery file converter

Convert embroidery designs between machine formats — **entirely on your own
machine**. No uploads, no server, no account: the converter runs in your
browser, as a desktop app, or from the command line, and your files never
leave your computer.

It also contains, as far as we know, the **first open implementation of a ZHS
writer** (Zeng Hsing / Artist Toolkit format), reverse-engineered byte by byte
and fully documented in [`docs/ZHS_FORMAT.md`](docs/ZHS_FORMAT.md).

## Try it

| Channel | Where |
|---|---|
| **Web** | <https://federicokalik.github.io/embroidery-converter-kit/> — landing with an instant demo, full studio at `/convert/` |
| **Desktop** | [Latest release](https://github.com/Federicokalik/embroidery-converter-kit/releases/latest): `Restitch-Windows.exe`, `Restitch-macOS.dmg`, `Restitch-Linux.AppImage` |
| **CLI** | Same releases page: `embconv-windows-x64.exe`, `embconv-macos-arm64`, `embconv-macos-x64`, `embconv-linux-x64` |

The desktop and CLI builds are unsigned: Windows SmartScreen and macOS
Gatekeeper will warn on first launch (macOS: right-click → Open).

## Formats

| | Formats |
|---|---|
| **Read** (13) | `vip` `zhs` `dst` `exp` `jef` `pec` `pes` `vp3` `hus` `xxx` `sew` `shv` `pcs` |
| **Write** (10) | `zhs` `dst` `exp` `jef` `pec` `pes` `vp3` `hus` `vip` `xxx` |

Every conversion goes through a shared intermediate representation
(stitches + commands + threads, 0.1 mm units), so any readable format can be
written to any writable one. The studio adds hoop presets for 109 machines,
a real-color thread preview, and per-file warnings (hoop fit, dropped trims,
color handling).

## CLI

```bash
embconv input.vip output.zhs                 # single conversion
embconv input.pes output.jef --hoop 130x180  # declare a hoop (pes, jef, zhs)
embconv --batch designs/ --to zhs --out out/ # convert a whole folder
embconv info design.vip --brand janome       # stitches, colors, size, hoop fit
```

`--center` recenters the design on the origin; `--pause-trims` makes ZHS
machines stop at mid-color trims instead of dropping them silently.

## The ZHS work

Zeng Hsing's `.zhs` format (Artist Toolkit) had no public reader or writer.
This project's spec was reverse-engineered from machine samples and verified
byte-for-byte: our writer regenerates a reference file identically except for
a single editor-metadata byte (`0x83`) the machine never reads.

- [`docs/ZHS_FORMAT.md`](docs/ZHS_FORMAT.md) — the full specification
- [`docs/VIP_FORMAT.md`](docs/VIP_FORMAT.md) — VIP reading notes (HUS body, EmbCompress)
- [`reference/zhs_vip_reference.py`](reference/zhs_vip_reference.py) — the proven Python converter the TypeScript core was ported from

Known limits (deliberately gated, not guessed): multi-color and trim-heavy
ZHS **writing** beyond the verified samples is conservative — the writer
pauses the machine rather than emitting byte sequences we could not verify
against real files. Physical stitch-out remains the final acceptance test.

## Repository layout

```
packages/core      all format logic: readers, writers, IR, EmbCompress (TS, zero deps)
packages/cli       embconv command-line tool
apps/web           Astro site: landing + /convert studio (100% client-side)
apps/desktop       Electron shell around the converter (the converter only)
docs/              format specifications (the reverse-engineering work)
reference/         Python reference implementation and analysis scripts
reports_files/     machine/hoop research behind the studio presets
```

## Development

```bash
pnpm install
pnpm build        # core + cli (tsup), web (astro)
pnpm test         # vitest
pnpm dev          # web app dev server
```

Heads-up on tests: the golden test data are **real embroidery designs that
are not redistributable**, so they are not in this repository (see
[`NOTICE`](NOTICE)). Without them the suite self-skips the design-derived
tests and runs the synthetic ones; the full 658-test suite (byte-identical
round-trips against real machine files) runs on the maintainer's machine and
before every release.

Releases are built by GitHub Actions from a version tag
(`git tag v0.x.y && git push origin v0.x.y`): desktop apps for the three
platforms plus the four CLI binaries, attached with stable file names.

## License

- **Code**: [PolyForm Internal Use License 1.0.0](LICENSE) — source-available.
  You can read everything, use the software personally or inside your own
  organization, and keep private forks; redistribution of the software or of
  builds is reserved to the licensor. The official web app, desktop apps and
  CLI are free of charge. Calling the unmodified CLI/executable from your own
  scripts or services is fine (see [`NOTICE`](NOTICE) for the licensor's
  clarifications).
- **Documentation** (`docs/`, including the format specs):
  [CC BY-NC-ND 4.0](docs/LICENSE).
- **Third-party**: EmbCompress/HUS/VIP logic ported from
  [pyembroidery](https://github.com/inkstitch/pyembroidery) (MIT);
  [libembroidery](https://github.com/Embroidermodder/libembroidery) used as
  documentation reference (zlib). Fonts are OFL 1.1, self-hosted. Details in
  [`NOTICE`](NOTICE).
