# Architecture — universal embroidery converter

Goal: **any embroidery format → any embroidery format**, delivered as three
front-ends that all share one engine:

```
one core  ─┬─►  Web app   (browser, 100% client-side)
           ├─►  Desktop   (Electron wrapping the web build + native folder batch)
           └─►  CLI        (Node, for automation/pipelines)
```

The web app is the base; the desktop app is the same web build wrapped in
Electron; the CLI reuses the same core. Write the engine once.

## Monorepo (pnpm workspaces)

```
embroidery-converter/
├── package.json                (pnpm workspace root)
├── packages/
│   ├── core/                   ← ALL logic. TypeScript, ZERO Node/DOM deps.
│   │   ├── src/
│   │   │   ├── ir.ts           Intermediate Representation (see below)
│   │   │   ├── embcompress.ts  Greg-Hus expand() (+ compress later) — port from pyembroidery
│   │   │   ├── readers/
│   │   │   │   ├── vip.ts       (from docs/VIP_FORMAT.md + reference .py)
│   │   │   │   ├── zhs.ts
│   │   │   │   ├── pes.ts  dst.ts  jef.ts  vp3.ts  exp.ts ...
│   │   │   ├── writers/
│   │   │   │   ├── zhs.ts       (from docs/ZHS_FORMAT.md + reference .py) ← the crown jewel
│   │   │   │   ├── dst.ts  pes.ts ...
│   │   │   ├── registry.ts      map extension -> reader/writer
│   │   │   └── index.ts         convert(bytes, fromFmt, toFmt) -> bytes
│   │   └── test/                Vitest round-trip tests against ../../fixtures
│   └── cli/                     ← Node CLI, depends on core
│       └── src/index.ts         `embconv in.vip out.zhs` / batch a folder
├── apps/
│   ├── web/                     ← Vite + TS. Drag-drop, Web Worker, JSZip download.
│   │   └── src/                 100% client-side: files never leave the machine.
│   └── desktop/                 ← Electron. Loads apps/web build; adds native
│                                  folder pick + fs batch write.
└── fixtures/  → symlink or copy of ../fixtures (the VIP/ZHS ground-truth pairs)
```

## Intermediate Representation (IR)

Model it on pyembroidery's `EmbPattern`:

```ts
type Command = 'STITCH' | 'JUMP' | 'TRIM' | 'COLOR_CHANGE' | 'STOP' | 'END';
interface Stitch { x: number; y: number; command: Command; }  // absolute coords, 0.1mm
interface Thread { rgb: number; description?: string; catalog?: string; chart?: string; }
interface Pattern {
  stitches: Stitch[];
  threads: Thread[];
  extents: { minX: number; minY: number; maxX: number; maxY: number };
}
```

Every reader returns a `Pattern`; every writer consumes one. `convert()` = read → Pattern → write.

## Tech choices (aligned to Federico's stack)

- **pnpm** workspaces, **TypeScript** strict everywhere.
- **Vite** for `apps/web`; **Electron** + electron-builder for `apps/desktop`.
- **tsup** to build `packages/core` and `packages/cli`.
- **Vitest** for tests. **Biome** or ESLint+Prettier for lint/format.
- No backend. The web app runs entirely in the browser (privacy: embroidery files
  stay local) — deployable as a static site on Netlify, or opened as a single
  bundled HTML offline.

## Porting order (do NOT boil the ocean)

Start with what Federico actually uses, grow later:

1. `embcompress.ts` (expand) + `readers/vip.ts` + `writers/zhs.ts` + IR.
   → gets VIP→ZHS working in TS, covered by round-trip tests vs fixtures.
2. `readers/zhs.ts`, `readers/pes.ts`, `readers/dst.ts`, `readers/vp3.ts`.
3. `writers/dst.ts`, `writers/pes.ts` (well-documented, easy wins).
4. Web app drag-drop + ZIP. Then Electron. Then CLI.
5. Multi-color / trim ZHS writing — **only after** obtaining sample `.zhs` pairs
   to validate (see docs/ZHS_FORMAT.md §2 and §3).

## Testing = the core deliverable

These files drive physical machines. Every reader/writer needs:

- **Round-trip byte test**: `write(read(sample)) === sample` where the format
  is fully known (ZHS passes for 028-B except the 0x83 byte — assert that exact
  known diff, don't ignore it).
- **Functional path test**: absolute stitch path is preserved across a conversion
  (VIP→ZHS→read-back path == VIP path, ignoring zero-length duplicates).
- Fixtures live in `/fixtures`. Add every new sample pair you obtain.

## Licensing

pyembroidery and libembroidery are **MIT / permissive** — porting their format
logic into a commercial product is allowed. Keep a NOTICE file crediting them.
