# TRIM editing — add/remove thread trims without converting

Nuova funzione (v0.3.x): modificare i **tagli del filo** (comandi `TRIM`)
direttamente sul file caricato, **senza cambiare formato**:
upload `.pes` → scegli "Aggiungi i tagli" / "Rimuovi i tagli" → download
`.pes` modificato. Disponibile nello studio web, nel desktop e in CLI.

## Come funziona

Le trasformazioni vivono a livello **IR** (`packages/core/src/trim-edits.ts`),
applicate tra la lettura e la scrittura. I writer restano byte-parity con
pyembroidery: nessun writer è cambiato per questo feature (l'unica aggiunta è
il warning `TRIM_DROPPED` nel writer JEF, che prima perdeva i trim in silenzio).

- `removeTrims(stitches)` — filtra i record `TRIM`. Sicuro: in IR un TRIM non
  muove l'ago (ogni reader lo emette alla posizione corrente; il movimento
  viaggia nel record `JUMP` separato che lo segue, pec.ts:96).
- `addTrims(stitches, opts)` — inserisce TRIM no-move nei due punti canonici:
  1. **prima di ogni `COLOR_CHANGE`** (taglio a fine blocco colore);
  2. **prima di un run di jump** che raggiunge 3 salti consecutivi **oppure**
     un displacimento X/Y > 30 unità (3 mm) — le stesse euristiche di
     `interpolateTrims` (pyembroidery), ma in inserzione pura, mai clipping.
- Stato "già tagliato": dopo TRIM/STOP/COLOR_CHANGE/END e all'inizio del design
  non si inserisce nulla (parity con `stateTrimmed` dell'encoder).

## Matrice formati (verificata con round-trip write→read in `test/trim-edits.test.ts`)

| Formato | Encode TRIM | Remove | Add | Note |
|---|---|---|---|---|
| pes / pec | flag 0x20 sul jump di transito | parziale | ✅ | PEC porta il flag trim su *ogni* jump post-init: anche rimuovendo i TRIM IR, il file riscritto taglia ai salti. Il trim a cambio colore è implicito nel 0xFE B0. |
| dst | 3 jump oscillanti a somma zero | ✅ | ✅ | il reader ricostruisce il TRIM dai jump oscillanti. |
| exp | `0x80 0x80 0x07` | ✅ | ✅ | |
| hus / vip | record 0x88 | ✅ | ✅ | |
| vp3 | flag 0x80 0x03 | parziale | ✅ | VP3 chiude *sempre* il design con un trim esplicito: a fine file resta 1 TRIM anche dopo remove. I JUMP non esistono nel formato (writer li assorbe). |
| xxx | controllo 0x7F 03 | ✅ | ✅ | |
| jef | **nessun record trim** | no-op | no-op | il writer scarta i TRIM (macchina taglia solo al cambio colore) con warning `TRIM_DROPPED`; al read le euristiche li ri-derivano. |
| zhs | nessun record (0x88 = guess, GAP aperto) | via writer `trims:'drop'` | n/a | opzioni writer esistenti `drop`/`pause`; nessuna modifica IR. |

Read-only (niente writer → niente export stesso formato): sew, shv, pcs.

## UI (web)

Studio `/convert`, opzione per item "Tagli del filo":

- **keep** (default): file intoccato. Nessuna modifica → l'export nel formato
  sorgente resta bloccato (`err.alreadyTarget`), com'è sempre stato.
- **remove** / **add**: trasformazione IR sopra. Con un'edit attiva l'export
  nel **formato sorgente** si sblocca (leggi .pes → modifica → riscrivi .pes).
- **pause**: solo ZHS, modalità writer esistente (trim → stop macchina).

Il round-trip stesso-formato **non è byte-identico**: il pattern viene
riscritto con il writer del formato (per PES: header `#PES0001`, icona PEC
rigenerata, palette quantizzata — come ogni conversione verso PES). La
geometria dei punti resta invariata.

## CLI

```
embconv design.pes design-modificato.pes --trims add
embconv --batch dir/ --to dst --trims remove
```

`--trims keep|remove|add` (default keep). `--pause-trims` resta l'opzione ZHS.
