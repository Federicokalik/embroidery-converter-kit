# ricuci

Universal **embroidery file converter** on the command line — convert designs
between machine formats **entirely on your own machine**. No upload, no server.

Part of [Ricuci](https://ricuci.app). Includes, as far as we know, the first
open implementation of a **ZHS writer** (Zeng Hsing / Artist Toolkit).

## Use it

No install needed:

```bash
npx ricuci input.vip output.zhs                 # single conversion
npx ricuci input.pes output.jef --hoop 130x180  # declare a hoop (pes, jef, zhs)
npx ricuci --batch designs/ --to zhs --out out/ # convert a whole folder
npx ricuci info design.vip --brand janome       # stitches, colors, size, hoop fit
```

`--center` recenters the design on the origin; `--pause-trims` makes ZHS
machines stop at mid-color trims instead of dropping them silently.

The `embconv` command is installed too (`npx --package=ricuci embconv …`), so
scripts written against `embconv` keep working.

## Formats

| | Formats |
|---|---|
| **Read** | `vip` `zhs` `dst` `exp` `jef` `pec` `pes` `vp3` `hus` `xxx` `sew` `shv` `pcs` |
| **Write** | `zhs` `dst` `exp` `jef` `pec` `pes` `vp3` `hus` `vip` `xxx` |

Any readable format converts to any writable one through a shared intermediate
representation.

## Also available

- **Web app** (nothing to install): <https://ricuci.app>
- **Desktop apps** (Windows / macOS / Linux):
  [latest release](https://github.com/Federicokalik/embroidery-converter-kit/releases/latest)

## License

Source-available under the PolyForm Internal Use License 1.0.0. Running the
**unmodified** CLI from your own scripts or services — including commercial
ones — is permitted internal use. See the bundled `LICENSE` and `NOTICE`.
