/**
 * Bilingual dictionary (it/en).
 *
 * Two registers live here on purpose:
 * - Scene copy is manifesto voice: short declarative lines that carry the
 *   scrolltelling. One sentence per idea, no filler.
 * - Converter/result strings keep the warm workshop voice and their keys
 *   MUST stay stable: converter.ts and stitchout resolve err.*, warn.*,
 *   note.*, stitch.*, conv.* at runtime.
 */

export type Entry = { it: string; en: string };

export const STRINGS: Record<string, Entry> = {
  // Document metadata
  'meta.title': {
    it: 'Restitch, il convertitore di ricami nel browser',
    en: 'Restitch, the in-browser embroidery converter',
  },
  'meta.description': {
    it:
      'Converti i tuoi file da ricamo (VIP, ZHS, PES, DST, JEF e altri) ' +
      'direttamente nel browser. I file non lasciano mai il tuo computer.',
    en:
      'Convert your embroidery files (VIP, ZHS, PES, DST, JEF and more) right ' +
      'in your browser. Your files never leave your computer.',
  },

  // Navigation
  'nav.cta': { it: 'Converti ora', en: 'Convert now' },
  'nav.langLabel': { it: 'Cambia lingua', en: 'Switch language' },
  'nav.audioOn': { it: 'Attiva i suoni della macchina', en: 'Turn machine sounds on' },
  'nav.audioOff': { it: 'Disattiva i suoni della macchina', en: 'Turn machine sounds off' },

  // S1 Hero
  'hero.headline': {
    it: 'Il tuo ricamo parla ogni lingua.',
    en: 'Your embroidery speaks every language.',
  },
  'hero.tech': {
    it: 'VIP, PES, DST e altri. Convertiti dentro il tuo browser.',
    en: 'VIP, PES, DST and more. Converted inside your browser.',
  },
  'hero.cta': { it: 'Converti ora', en: 'Convert now' },

  // S2 Babel
  'babel.headline': {
    it: 'Ogni macchina parla la sua lingua.',
    en: 'Every machine speaks its own language.',
  },

  // S3 Translation
  'translation.headline': {
    it: 'Restitch le traduce tutte. Punto per punto.',
    en: 'Restitch translates them all. Stitch by stitch.',
  },

  // S4 From A to Z
  'atoz.headline': { it: 'Dalla A alla Z.', en: 'From A to Z.' },
  'atoz.sub': {
    it: '{nRead} lingue in lettura, {nWrite} in scrittura.',
    en: '{nRead} languages read, {nWrite} written.',
  },

  // S5 Precision
  'precision.headline': {
    it: 'Ogni punto resta al suo posto.',
    en: 'Every stitch stays in place.',
  },
  'precision.before': { it: 'prima', en: 'before' },
  'precision.after': { it: 'dopo', en: 'after' },

  // Privacy strip (transition, not a scene)
  'privacy.line': {
    it: 'Tutto accade nel tuo browser. Niente server, niente caricamenti.',
    en: 'It all happens in your browser. No servers, no uploads.',
  },

  // S6 Finale / converter
  'finale.headline': { it: 'Tocca a te.', en: 'Your turn.' },
  'conv.targetLabel': { it: 'Cuci in formato', en: 'Sew it as' },
  'conv.dropTitle': {
    it: 'Trascina qui i tuoi file di ricamo',
    en: 'Drop your embroidery files here',
  },
  'conv.dropSub': { it: 'oppure clicca per sceglierli', en: 'or click to choose them' },
  'conv.dropAria': {
    it: 'Trascina qui i file di ricamo oppure premi Invio per sceglierli',
    en: 'Drop embroidery files here or press Enter to choose them',
  },
  'conv.acceptHint': {
    it:
      'Leggo i file di Husqvarna, Brother, Janome, Tajima e altri: {list}. ' +
      'Più file insieme? Scarichi uno ZIP.',
    en:
      'I read files from Husqvarna, Brother, Janome, Tajima and more: {list}. ' +
      'Several at once? You get a ZIP.',
  },

  // Stitch-out panel (conversion animation)
  'stitch.working': { it: 'Sto ricucendo {name}', en: 'Re-stitching {name}' },
  'stitch.batch': {
    it: 'In anteprima {name}. Gli altri {n} file arrivano nello ZIP.',
    en: 'Previewing {name}. The other {n} files land in the ZIP.',
  },
  'stitch.batchOne': {
    it: "In anteprima {name}. L'altro file arriva nello ZIP.",
    en: 'Previewing {name}. The other file lands in the ZIP.',
  },
  'stitch.skip': { it: 'Salta e scarica', en: 'Skip and download' },
  'stitch.doneSingle': { it: 'Cucito. Il download è partito.', en: 'Stitched. Download started.' },
  'stitch.doneMulti': {
    it: 'Cuciti tutti. Lo ZIP è partito.',
    en: 'All stitched. ZIP download started.',
  },
  'stitch.close': { it: 'Chiudi', en: 'Close' },

  // Results list: design size + declared-hoop fit (params pre-localized in mm)
  'result.size': { it: 'Ricamo {w}×{h} mm.', en: 'Design {w}×{h} mm.' },
  'result.hoopFits': {
    it: 'Telaio dichiarato {w}×{h} mm: ci sta.',
    en: 'Declared hoop {w}×{h} mm: it fits.',
  },
  'result.hoopRecenter': {
    it: 'Telaio dichiarato {w}×{h} mm: ci sta, ma conviene ricentrarlo.',
    en: 'Declared hoop {w}×{h} mm: it fits, but you may want to re-center it.',
  },
  'result.hoopOverflow': {
    it: 'Telaio dichiarato {w}×{h} mm: sborda di {ow}×{oh} mm.',
    en: 'Declared hoop {w}×{h} mm: overflows by {ow}×{oh} mm.',
  },

  // Footer
  'footer.tagline': {
    it: 'Ricuci i tuoi ricami in un altro formato.',
    en: 'Re-stitch your embroidery into another format.',
  },
  'footer.credit': { it: 'Design e codice: Federico', en: 'Design and code: Federico' },

  // Gated designs (UnsupportedDesignError.reason)
  'err.MULTI_COLOR': {
    it:
      'Questo ricamo usa più colori distinti di quanti il formato scelto ' +
      'ne possa elencare.',
    en:
      'This design uses more distinct colors than the chosen format can list.',
  },
  'err.TRIM': {
    it: 'Questo ricamo contiene tagli del filo che il formato scelto non sa scrivere.',
    en: "This design has thread trims the chosen format can't write.",
  },
  'err.JUMP': {
    it: 'Questo ricamo contiene salti del filo che il formato scelto non sa scrivere.',
    en: "This design has thread jumps the chosen format can't write.",
  },
  'err.STOP': {
    it: 'Questo ricamo contiene delle pause che il formato scelto non sa scrivere.',
    en: "This design has stop points the chosen format can't write.",
  },
  'err.EMPTY': {
    it: "In questo file non c'è nemmeno un punto da cucire.",
    en: "There isn't a single stitch to sew in this file.",
  },
  'err.DELTA_RANGE': {
    it: 'Un punto di questo ricamo fa un salto più lungo di quanto ZHS permetta (12,8 mm).',
    en: 'One stitch in this design jumps farther than ZHS allows (12.8 mm).',
  },
  'err.TOO_MANY_RECORDS': {
    it: 'Questo ricamo ha troppi punti per il formato ZHS.',
    en: 'This design has too many stitches for the ZHS format.',
  },
  'err.TOO_LARGE': {
    it: 'Questo ricamo è troppo grande per il formato scelto.',
    en: 'This design is too large for the chosen format.',
  },
  'err.unsupportedFallback': {
    it: 'Non riesco a ricucire questo file: {msg}',
    en: "I can't re-stitch this file: {msg}",
  },
  'err.unreadableExt': {
    it: 'Non so leggere i file ".{ext}". Leggo: {list}.',
    en: 'I can\'t read ".{ext}" files. I read: {list}.',
  },
  'err.unrecognized': {
    it: 'Non riconosco questo file. Leggo: {list}.',
    en: "I don't recognize this file. I read: {list}.",
  },
  'err.alreadyTarget': {
    it: "Questo file è già in {fmt}: non c'è nulla da ricucire.",
    en: 'This file is already {fmt}: nothing to re-stitch.',
  },
  'err.corrupt': {
    it: 'Non riesco a leggere questo file (forse è rovinato): {msg}',
    en: "I can't read this file (it may be damaged): {msg}",
  },
  'err.unexpected': { it: 'Errore inatteso: {msg}', en: 'Unexpected error: {msg}' },

  // Structured conversion warnings
  'warn.FILLER_THREAD': {
    it:
      'Il file di partenza non dice di che colore sono i fili: quelli ' +
      'mancanti sono segnati in nero. Sulla stoffa deciderai tu.',
    en:
      "The source file doesn't say what color the threads are: the missing " +
      'ones are marked in black. On fabric, you decide.',
  },
  'warn.DELTA_63_SHIFTED': {
    it:
      "Un punto era un filo troppo lungo per questo formato: l'ho accorciato " +
      'di un niente (0,1 mm). Il resto del ricamo non cambia.',
    en:
      'One stitch was a touch too long for this format: I shortened it by a ' +
      'hair (0.1 mm). The rest of the design is unchanged.',
  },
  'warn.COLOR_QUANTIZED': {
    it: 'Questo formato conosce solo i colori delle sue matassine: ho scelto i più vicini ai tuoi.',
    en: 'This format only knows its own thread shades: I picked the closest to yours.',
  },
  'warn.HOOP_FIT_EXCEEDED': {
    it:
      'Il ricamo è più grande del telaio di destinazione: controlla le ' +
      'misure prima di metterlo in macchina.',
    en:
      'The design is larger than the target hoop: double-check the size ' +
      'before loading it on the machine.',
  },
  'warn.HOOP_UNSUPPORTED': {
    it:
      'Questo formato non conosce il telaio richiesto: ho lasciato quello ' +
      'di serie. Il ricamo non cambia.',
    en:
      "This format doesn't know the requested hoop: I kept the stock one. " +
      'The design is unchanged.',
  },
  'warn.TRIM_DROPPED': {
    it:
      'Questo formato non sa tagliare il filo: ho tolto i comandi di taglio. ' +
      "I fili tra un colore e l'altro li spunterai a mano.",
    en:
      "This format can't trim the thread: I removed the trim commands. " +
      "You'll snip the floats between colors by hand.",
  },

  // Per-format caveats
  'note.zhs': {
    it:
      'ZHS: scrittura verificata sui campioni di fabbrica, multicolore ' +
      'compreso. La prova finale resta la cucitura in macchina.',
    en:
      'ZHS: writing verified against factory samples, multicolor included. ' +
      'The final proof is still sewing it out.',
  },
  'note.hus': {
    it:
      'HUS: scrittura nuova, verificata via software; non ancora provata ' +
      'su una macchina reale.',
    en: 'HUS: new writer, software-verified; not yet tried on a real machine.',
  },
  'note.vip': {
    it:
      'VIP: scrittura nuova, verificata via software; non ancora provata ' +
      'su una macchina reale.',
    en: 'VIP: new writer, software-verified; not yet tried on a real machine.',
  },
  'note.xxx': {
    it: 'XXX: scrittura verificata byte per byte contro pyembroidery.',
    en: 'XXX: writing verified byte-for-byte against pyembroidery.',
  },
  'note.pes': {
    it: 'PES: i colori vengono avvicinati alle matassine Brother.',
    en: 'PES: colors are matched to the closest Brother threads.',
  },
  'note.pec': {
    it: 'PEC: i colori vengono avvicinati alle matassine della macchina.',
    en: "PEC: colors are matched to the machine's own thread shades.",
  },
  'note.jef': {
    it: 'JEF: i colori vengono avvicinati alle matassine Janome.',
    en: 'JEF: colors are matched to the closest Janome threads.',
  },
  'note.exp': {
    it: 'EXP non salva i colori: sulla macchina li scegli tu.',
    en: "EXP doesn't store colors: you pick them at the machine.",
  },
};
