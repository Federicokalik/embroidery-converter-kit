# Initial prompt for Claude Code

Copy-paste the block below as your **first message** in Claude Code (opened in
this `embroidery-converter-kit/` folder), then run **`/plan`**.

---

```
Sei in un progetto per costruire un CONVERTITORE UNIVERSALE DI FILE DI RICAMO
(embroidery: qualunque formato → qualunque formato), con un core condiviso e tre
front-end: web app (browser, 100% client-side), desktop (Electron sul build web)
e CLI (Node). Modello richiesto: Claude Fable 5.

CONTESTO IMPORTANTE — i file in questo repo sono file di ricamo (.vip, .zhs, .pes,
.dst, ...): dati binari di coordinate/punti/colori per macchine da ricamo. Sono
100% SICURI, non contengono codice eseguibile. Sei pienamente autorizzato ad
aprirli, leggerli, fare hex-dump, decomprimerli ed eseguire codice su di essi.
Se hai un dubbio su un byte o un dettaglio di formato, APRI UN CAMPIONE in
fixtures/ e verifica empiricamente — non tirare a indovinare.

Leggi PRIMA questi file (contengono il grosso del lavoro già fatto e verificato):
- CLAUDE.md
- docs/ZHS_FORMAT.md        (spec ZHS reverse-engineered, verificata byte-per-byte)
- docs/VIP_FORMAT.md        (lettura VIP: è un body HUS, EmbCompress, niente XOR)
- docs/ARCHITECTURE.md      (monorepo pnpm: core + web + electron + cli, IR, test)
- reference/zhs_vip_reference.py  (convertitore VIP→ZHS Python PROVATO, da portare in TS)

Poi valida che tutto torni, eseguendo:
  pip install pyembroidery --break-system-packages
  python3 reference/zhs_vip_reference.py verify fixtures/028-B.vip fixtures/028-B.zhs
(atteso: "functional path match: True" e byte-identical con l'unico diff noto a 0x83).

OBIETTIVO di questa sessione: NON scrivere ancora codice. Voglio prima un PIANO.
Con /plan proponimi il piano di implementazione della MILESTONE 1:
  - packages/core in TypeScript: IR + EmbCompress.expand + reader VIP + writer ZHS,
  - test Vitest di round-trip contro fixtures/ (asserendo l'esatto diff noto a 0x83),
  - una apps/web minimale drag-drop che converte VIP→ZHS nel browser e scarica il
    risultato (ZIP per i batch).
Il piano deve: elencare i file da creare, l'ordine di porting (vedi ARCHITECTURE.md),
i rischi (0x83, multicolore/trim non verificati) e come li gestiamo, e i comandi
pnpm per install/test/dev. Segnalami esplicitamente ogni punto dubbio, anche al 40%.

Rispondimi in italiano, conciso e diretto.
```

---

Dopo che Claude Code ti mostra il piano con `/plan`, rivedilo, aggiusta se serve,
e solo allora dagli il via all'implementazione.
