/**
 * Multilingual dictionary (it / en / fr / de / es / pt).
 *
 * Two registers live here on purpose:
 * - Scene copy is manifesto voice: short declarative lines that carry the
 *   scrolltelling. One sentence per idea, no filler.
 * - Converter/result strings keep the warm workshop voice and their keys
 *   MUST stay stable: converter.ts and stitchout resolve err.*, warn.*,
 *   note.*, stitch.*, conv.* at runtime.
 *
 * `it` and `en` are the source pair and MUST be set on every entry; the
 * other four languages fall back to `en` when missing.
 */

export type Entry = {
  it: string;
  en: string;
  fr?: string;
  de?: string;
  es?: string;
  pt?: string;
};

export const STRINGS: Record<string, Entry> = {
  // Document metadata
  'meta.title': {
    it: 'Ricuci, il convertitore di ricami nel browser',
    en: 'Ricuci, the in-browser embroidery converter',
    fr: 'Ricuci, le convertisseur de broderies dans le navigateur',
    de: 'Ricuci, der Stickdatei-Konverter im Browser',
    es: 'Ricuci, el convertidor de bordados en el navegador',
    pt: 'Ricuci, o conversor de bordados no navegador',
  },
  'meta.description': {
    it:
      'Converti i tuoi file da ricamo (VIP, ZHS, PES, DST, JEF e altri) ' +
      'direttamente nel browser. I file non lasciano mai il tuo computer.',
    en:
      'Convert your embroidery files (VIP, ZHS, PES, DST, JEF and more) right ' +
      'in your browser. Your files never leave your computer.',
    fr:
      "Convertissez vos fichiers de broderie (VIP, ZHS, PES, DST, JEF et plus) " +
      'directement dans le navigateur. Vos fichiers ne quittent jamais votre ordinateur.',
    de:
      'Konvertiere deine Stickdateien (VIP, ZHS, PES, DST, JEF und mehr) direkt ' +
      'im Browser. Deine Dateien verlassen nie deinen Rechner.',
    es:
      'Convierte tus archivos de bordado (VIP, ZHS, PES, DST, JEF y más) justo ' +
      'en tu navegador. Tus archivos nunca salen de tu equipo.',
    pt:
      'Converta seus arquivos de bordado (VIP, ZHS, PES, DST, JEF e mais) direto ' +
      'no navegador. Seus arquivos nunca saem do seu computador.',
  },

  // Navigation
  'nav.cta': { it: 'Converti ora', en: 'Convert now', fr: 'Convertir', de: 'Jetzt konvertieren', es: 'Convertir', pt: 'Converter agora' },
  'nav.langLabel': { it: 'Cambia lingua', en: 'Switch language', fr: 'Changer de langue', de: 'Sprache wechseln', es: 'Cambiar idioma', pt: 'Mudar idioma' },
  'nav.docs': { it: 'Docs', en: 'Docs', fr: 'Docs', de: 'Doku', es: 'Docs', pt: 'Docs' },

  // S1 Hero
  'hero.headline': {
    it: 'Il tuo ricamo parla ogni lingua.',
    en: 'Your embroidery speaks every language.',
    fr: 'Votre broderie parle toutes les langues.',
    de: 'Deine Stickerei spricht jede Sprache.',
    es: 'Tu bordado habla cada idioma.',
    pt: 'Seu bordado fala cada idioma.',
  },
  'hero.tech': {
    it: 'VIP, PES, DST e altri. Convertiti dentro il tuo browser.',
    en: 'VIP, PES, DST and more. Converted inside your browser.',
    fr: 'VIP, PES, DST et plus. Convertis dans votre navigateur.',
    de: 'VIP, PES, DST und mehr. Konvertiert in deinem Browser.',
    es: 'VIP, PES, DST y más. Convertidos en tu navegador.',
    pt: 'VIP, PES, DST e mais. Convertidos no seu navegador.',
  },
  'hero.cta': { it: 'Converti ora', en: 'Convert now', fr: 'Convertir', de: 'Jetzt konvertieren', es: 'Convertir', pt: 'Converter agora' },
  'hero.learn': { it: 'Scopri di più', en: 'Learn more', fr: 'En savoir plus', de: 'Mehr erfahren', es: 'Saber más', pt: 'Saiba mais' },

  // S2 Babel
  'babel.headline': {
    it: 'Ogni macchina parla la sua lingua.',
    en: 'Every machine speaks its own language.',
    fr: 'Chaque machine parle sa propre langue.',
    de: 'Jede Maschine spricht ihre eigene Sprache.',
    es: 'Cada máquina habla su propio idioma.',
    pt: 'Cada máquina fala seu próprio idioma.',
  },

  // S3 Translation
  'translation.headline': {
    it: 'Ricuci le traduce tutte. Punto per punto.',
    en: 'Ricuci translates them all. Stitch by stitch.',
    fr: 'Ricuci les traduit toutes. Point par point.',
    de: 'Ricuci übersetzt sie alle. Punkt für Punkt.',
    es: 'Ricuci los traduce todos. Punto por punto.',
    pt: 'Ricuci traduz todos. Ponto por ponto.',
  },

  // S4 From A to Z
  'atoz.headline': { it: 'Dalla A alla Z.', en: 'From A to Z.', fr: 'De A à Z.', de: 'Von A bis Z.', es: 'De la A a la Z.', pt: 'De A a Z.' },
  'atoz.sub': {
    it: '{nRead} lingue in lettura, {nWrite} in scrittura.',
    en: '{nRead} languages read, {nWrite} written.',
    fr: '{nRead} langues lues, {nWrite} écrites.',
    de: '{nRead} Sprachen gelesen, {nWrite} geschrieben.',
    es: '{nRead} idiomas leídos, {nWrite} escritos.',
    pt: '{nRead} idiomas lidos, {nWrite} gravados.',
  },

  // S5 Precision
  'precision.headline': {
    it: 'Ogni punto resta al suo posto.',
    en: 'Every stitch stays in place.',
    fr: 'Chaque point reste à sa place.',
    de: 'Jeder Punkt bleibt an seinem Platz.',
    es: 'Cada punto se queda en su sitio.',
    pt: 'Cada ponto fica no seu lugar.',
  },
  'precision.before': { it: 'prima', en: 'before', fr: 'avant', de: 'vorher', es: 'antes', pt: 'antes' },
  'precision.after': { it: 'dopo', en: 'after', fr: 'après', de: 'nachher', es: 'después', pt: 'depois' },

  // Privacy strip (transition, not a scene)
  'privacy.line': {
    it: 'Tutto accade nel tuo browser. Niente server, niente caricamenti.',
    en: 'It all happens in your browser. No servers, no uploads.',
    fr: 'Tout se passe dans votre navigateur. Pas de serveur, pas de téléversement.',
    de: ' Alles passiert in deinem Browser. Keine Server, keine Uploads.',
    es: 'Todo ocurre en tu navegador. Sin servidores, sin subidas.',
    pt: 'Tudo acontece no seu navegador. Sem servidores, sem uploads.',
  },

  // S6 Finale / converter
  'finale.headline': { it: 'Tocca a te.', en: 'Your turn.', fr: 'À vous.', de: 'Du bist dran.', es: 'Te toca.', pt: 'Sua vez.' },
  'conv.targetLabel': { it: 'Cuci in formato', en: 'Sew it as', fr: 'Coudre en', de: 'Nähen als', es: 'Coser como', pt: 'Costurar como' },
  'conv.dropTitle': {
    it: 'Trascina qui i tuoi file di ricamo',
    en: 'Drop your embroidery files here',
    fr: 'Déposez vos fichiers de broderie ici',
    de: 'Ziehe deine Stickdateien hierher',
    es: 'Suelta tus archivos de bordado aquí',
    pt: 'Solte seus arquivos de bordado aqui',
  },
  'conv.dropSub': { it: 'oppure clicca per sceglierli', en: 'or click to choose them', fr: 'ou cliquez pour les choisir', de: 'oder klicke, um sie auszuwählen', es: 'o haz clic para elegirlos', pt: 'ou clique para escolhê-los' },
  'conv.dropAria': {
    it: 'Trascina qui i file di ricamo oppure premi Invio per sceglierli',
    en: 'Drop embroidery files here or press Enter to choose them',
    fr: 'Déposez les fichiers de broderie ici ou appuyez sur Entrée pour les choisir',
    de: 'Ziehe Stickdateien hierher oder drücke Enter, um sie auszuwählen',
    es: 'Suelta los archivos de bordado aquí o pulsa Intro para elegirlos',
    pt: 'Solte os arquivos de bordado aqui ou pressione Enter para escolhê-los',
  },
  'conv.acceptHintInstant': {
    it:
      'Leggo i file di Husqvarna, Brother, Janome, Tajima e altri: {list}. ' +
      'Un file alla volta: lo vedi cucire e lo scarichi.',
    en:
      'I read files from Husqvarna, Brother, Janome, Tajima and more: {list}. ' +
      'One file at a time: watch it stitch, then download.',
    fr:
      'Je lis les fichiers de Husqvarna, Brother, Janome, Tajima et plus : {list}. ' +
      'Un fichier à la fois : regardez-le coudre, puis téléchargez.',
    de:
      'Ich lese Dateien von Husqvarna, Brother, Janome, Tajima und mehr: {list}. ' +
      'Eine Datei nach der anderen: beim Sticken zuschauen, dann herunterladen.',
    es:
      'Leo archivos de Husqvarna, Brother, Janome, Tajima y más: {list}. ' +
      'Un archivo cada vez: míralo coser y luego descárgalo.',
    pt:
      'Leio arquivos da Husqvarna, Brother, Janome, Tajima e mais: {list}. ' +
      'Um arquivo por vez: veja costurar e depois baixe.',
  },
  'conv.acceptHintStudio': {
    it:
      'Leggo i file di Husqvarna, Brother, Janome, Tajima e altri: {list}. ' +
      "Trascinane anche più d'uno: li metto in coda.",
    en:
      'I read files from Husqvarna, Brother, Janome, Tajima and more: {list}. ' +
      'Drop several at once: they line up in the queue.',
    fr:
      'Je lis les fichiers de Husqvarna, Brother, Janome, Tajima et plus : {list}. ' +
      'Déposez-en plusieurs : ils se mettent en file.',
    de:
      'Ich lese Dateien von Husqvarna, Brother, Janome, Tajima und mehr: {list}. ' +
      'Zieh mehrere auf einmal: sie reihen sich in der Warteschlange ein.',
    es:
      'Leo archivos de Husqvarna, Brother, Janome, Tajima y más: {list}. ' +
      'Suelta varios a la vez: se ponen en cola.',
    pt:
      'Leio arquivos da Husqvarna, Brother, Janome, Tajima e mais: {list}. ' +
      'Solte vários de uma vez: eles entram na fila.',
  },
  'conv.fullLink': {
    it: 'Apri il Convertitore completo →',
    en: 'Open the full Converter →',
    fr: 'Ouvrir le convertisseur complet →',
    de: 'Vollständigen Konverter öffnen →',
    es: 'Abrir el convertidor completo →',
    pt: 'Abrir o conversor completo →',
  },
  'conv.batchNudge': { it: 'Qui cucio un file alla volta.', en: 'Here I stitch one file at a time.', fr: 'Ici, je couds un fichier à la fois.', de: 'Hier nähe ich eine Datei nach der anderen.', es: 'Aquí coso un archivo cada vez.', pt: 'Aqui costuro um arquivo por vez.' },
  'conv.batchNudgeLink': {
    it: "Per i lotti c'è il Convertitore →",
    en: "For batches there's the Converter →",
    fr: 'Pour les lots, il y a le convertisseur →',
    de: 'Für Stapel gibt es den Konverter →',
    es: 'Para lotes está el convertidor →',
    pt: 'Para lotes, há o conversor →',
  },

  // Studio toolbar
  'tool.presetLabel': { it: 'La tua macchina', en: 'Your machine', fr: 'Votre machine', de: 'Deine Maschine', es: 'Tu máquina', pt: 'Sua máquina' },
  'tool.presetNone': { it: 'Nessun preset', en: 'No preset', fr: 'Aucun préréglage', de: 'Keine Voreinstellung', es: 'Sin ajuste', pt: 'Sem predefinição' },
  'tool.extraLabel': { it: 'Esporta anche in', en: 'Also export as', fr: 'Exporter aussi en', de: 'Auch exportieren als', es: 'Exportar también como', pt: 'Exportar também como' },
  'tool.convertAll': { it: 'Converti tutto ({n})', en: 'Convert all ({n})', fr: 'Tout convertir ({n})', de: 'Alle konvertieren ({n})', es: 'Convertir todo ({n})', pt: 'Converter tudo ({n})' },
  'tool.converting': { it: 'Converto…', en: 'Converting…', fr: 'Conversion…', de: 'Konvertiere…', es: 'Convirtiendo…', pt: 'Convertendo…' },

  // Studio queue
  'queue.count': { it: '{n} file in coda', en: '{n} files in the queue', fr: '{n} fichiers en file', de: '{n} Dateien in der Warteschlange', es: '{n} archivos en cola', pt: '{n} arquivos na fila' },
  'queue.countOne': { it: '1 file in coda', en: '1 file in the queue', fr: '1 fichier en file', de: '1 Datei in der Warteschlange', es: '1 archivo en cola', pt: '1 arquivo na fila' },
  'queue.statusReady': { it: 'pronto', en: 'ready', fr: 'prêt', de: 'bereit', es: 'listo', pt: 'pronto' },
  'queue.statusDone': { it: 'convertito', en: 'converted', fr: 'converti', de: 'konvertiert', es: 'convertido', pt: 'convertido' },
  'queue.statusFailed': { it: 'errore', en: 'error', fr: 'erreur', de: 'Fehler', es: 'error', pt: 'erro' },
  'queue.remove': { it: 'Rimuovi {name} dalla coda', en: 'Remove {name} from the queue', fr: 'Retirer {name} de la file', de: '{name} aus der Warteschlange entfernen', es: 'Quitar {name} de la cola', pt: 'Remover {name} da fila' },
  'queue.meta': {
    it: '{fmt} — {stitches} punti — {w}×{h} mm',
    en: '{fmt} — {stitches} stitches — {w}×{h} mm',
    fr: '{fmt} — {stitches} points — {w}×{h} mm',
    de: '{fmt} — {stitches} Punkte — {w}×{h} mm',
    es: '{fmt} — {stitches} puntos — {w}×{h} mm',
    pt: '{fmt} — {stitches} pontos — {w}×{h} mm',
  },
  'queue.skipped': { it: 'Già in {fmt}: quel formato lo salto.', en: 'Already {fmt}: skipping that format.', fr: 'Déjà en {fmt} : ce format est ignoré.', de: 'Bereits {fmt}: dieses Format wird übersprungen.', es: 'Ya está en {fmt}: omito ese formato.', pt: 'Já está em {fmt}: ignoro esse formato.' },

  // /convert page
  'meta.convertTitle': {
    it: 'Ricuci — Convertitore',
    en: 'Ricuci — Converter',
    fr: 'Ricuci — Convertisseur',
    de: 'Ricuci — Konverter',
    es: 'Ricuci — Convertidor',
    pt: 'Ricuci — Conversor',
  },
  'meta.convertDescription': {
    it:
      'Converti un file di ricamo nel browser: anteprima nei colori reali, ' +
      'scelta del telaio, download immediato.',
    en:
      'Convert an embroidery file in your browser: real-color preview, hoop ' +
      'choice, instant download.',
    fr:
      "Convertir un fichier de broderie dans le navigateur : aperçu en couleurs réelles, " +
      'choix du cadre, téléchargement immédiat.',
    de:
      'Stickdatei im Browser konvertieren: Vorschau in echten Farben, ' +
      'Auswahl des Stickrahmens, sofortiger Download.',
    es:
      'Convierte un archivo de bordado en el navegador: vista previa en colores reales, ' +
      'elección del bastidor, descarga inmediata.',
    pt:
      'Converta um arquivo de bordado no navegador: prévia em cores reais, ' +
      'escolha do bastidor, download imediato.',
  },
  'convert.headline': {
    it: 'Converti i tuoi ricami.',
    en: 'Convert your designs.',
    fr: 'Convertissez vos motifs.',
    de: 'Konvertiere deine Muster.',
    es: 'Convierte tus diseños.',
    pt: 'Converta seus designs.',
  },

  // Single-file panel
  'panel.previewAria': {
    it: 'Anteprima di {name} nei colori reali dei fili',
    en: 'Preview of {name} in its real thread colors',
    fr: 'Aperçu de {name} dans ses vraies couleurs de fil',
    de: 'Vorschau von {name} in echten Fadenfarben',
    es: 'Vista previa de {name} con sus colores reales de hilo',
    pt: 'Prévia de {name} nas cores reais dos fios',
  },
  'panel.source': { it: 'Sorgente', en: 'Source', fr: 'Source', de: 'Quelle', es: 'Origen', pt: 'Origem' },
  'panel.stitches': { it: 'Punti', en: 'Stitches', fr: 'Points', de: 'Punkte', es: 'Puntos', pt: 'Pontos' },
  'panel.colors': { it: 'Colori', en: 'Colors', fr: 'Couleurs', de: 'Farben', es: 'Colores', pt: 'Cores' },
  'panel.size': { it: 'Misure', en: 'Size', fr: 'Mesures', de: 'Maße', es: 'Medidas', pt: 'Medidas' },
  'panel.sourceHoop': { it: 'Telaio nel file', en: 'Hoop in file', fr: 'Cadre dans le fichier', de: 'Rahmen in der Datei', es: 'Bastidor en el archivo', pt: 'Bastidor no arquivo' },
  'panel.sizeValue': { it: '{w}×{h} mm', en: '{w}×{h} mm', fr: '{w}×{h} mm', de: '{w}×{h} mm', es: '{w}×{h} mm', pt: '{w}×{h} mm' },
  'panel.hoopLabel': { it: 'Telaio di destinazione', en: 'Target hoop', fr: 'Cadre cible', de: 'Zielrahmen', es: 'Bastidor de destino', pt: 'Bastidor de destino' },
  'panel.hoopAuto': { it: 'Automatico (il più piccolo adatto)', en: 'Automatic (smallest that fits)', fr: 'Automatique (le plus petit qui convient)', de: 'Automatisch (kleinster passenden)', es: 'Automático (el más pequeño que encaje)', pt: 'Automático (o menor que serve)' },
  'panel.hoopDeclaredOpt': { it: 'Come nel file ({w}×{h} mm)', en: 'As declared ({w}×{h} mm)', fr: 'Comme déclaré ({w}×{h} mm)', de: 'Wie deklariert ({w}×{h} mm)', es: 'Como en el archivo ({w}×{h} mm)', pt: 'Como no arquivo ({w}×{h} mm)' },
  'panel.hoopNone': {
    it: 'Nessun telaio a catalogo contiene il ricamo: scrivo il default della macchina.',
    en: 'No catalog hoop holds this design: writing the machine default.',
    fr: "Aucun cadre du catalogue ne contient ce motif : j'écris le défaut de la machine.",
    de: 'Kein Katalog-Rahmen fasst dieses Muster: schreibe den Maschinen-Standard.',
    es: 'Ningún bastidor del catálogo contiene este diseño: escribo el predeterminado de la máquina.',
    pt: 'Nenhum bastidor do catálogo contém este design: gravo o padrão da máquina.',
  },
  'panel.hoopNoStore': {
    it: 'Il formato {fmt} non salva il telaio nel file.',
    en: "The {fmt} format doesn't store a hoop in the file.",
    fr: "Le format {fmt} n'enregistre pas le cadre dans le fichier.",
    de: 'Das Format {fmt} speichert keinen Rahmen in der Datei.',
    es: 'El formato {fmt} no guarda el bastidor en el archivo.',
    pt: 'O formato {fmt} não guarda o bastidor no arquivo.',
  },
  'panel.hoopFits': { it: 'Ci sta nel telaio scelto.', en: 'Fits the chosen hoop.', fr: 'Tient dans le cadre choisi.', de: 'Passt in den gewählten Rahmen.', es: 'Cabe en el bastidor elegido.', pt: 'Cabe no bastidor escolhido.' },
  'panel.hoopRecenter': {
    it: 'Ci sta se lo centri: spunta “Centra nel telaio”.',
    en: 'Fits once centered: tick “Center in hoop”.',
    fr: 'Tient une fois centré : cochez « Centrer dans le cadre ».',
    de: 'Passt, wenn zentriert: aktiviere „Im Rahmen zentrieren“.',
    es: 'Cabe si lo centras: marca «Centrar en el bastidor».',
    pt: 'Cabe se centralizar: marque «Centralizar no bastidor».',
  },
  'panel.hoopOverflow': {
    it: 'Sborda di {ow}×{oh} mm dal telaio scelto.',
    en: 'Overflows the chosen hoop by {ow}×{oh} mm.',
    fr: 'Déborde du cadre choisi de {ow}×{oh} mm.',
    de: 'Ragt um {ow}×{oh} mm über den gewählten Rahmen hinaus.',
    es: 'Rebasa el bastidor elegido en {ow}×{oh} mm.',
    pt: 'Excede o bastidor escolhido em {ow}×{oh} mm.',
  },
  'panel.center': { it: 'Centra nel telaio', en: 'Center in hoop', fr: 'Centrer dans le cadre', de: 'Im Rahmen zentrieren', es: 'Centrar en el bastidor', pt: 'Centralizar no bastidor' },
  'panel.trimsLabel': { it: 'Tagli del filo', en: 'Thread trims', fr: 'Coupes de fil', de: 'Fadenschnitte', es: 'Cortes de hilo', pt: 'Cortes de fio' },
  'panel.trimsDrop': { it: 'Fili volanti', en: 'Floating threads', fr: 'Fils flottants', de: 'Lose Fäden', es: 'Hilos flotantes', pt: 'Fios flutuantes' },
  'panel.trimsDropHint': {
    it: 'La macchina non si ferma: i fili tra i blocchi li spunti a fine lavoro.',
    en: 'The machine keeps going: you snip the floats when the job is done.',
    fr: "La machine continue : vous coupez les fils flottants une fois le travail terminé.",
    de: 'Die Maschine macht weiter: du schneidest die losen Fäden am Ende ab.',
    es: 'La máquina sigue: cortas los hilos flotantes al acabar.',
    pt: 'A máquina segue: você corta os fios flutuantes ao final.',
  },
  'panel.trimsPause': { it: 'Pausa a ogni taglio', en: 'Pause at every trim', fr: 'Pause à chaque coupe', de: 'Bei jedem Schnitt pausieren', es: 'Pausa en cada corte', pt: 'Pausa a cada corte' },
  'panel.trimsPauseHint': {
    it: 'La macchina si ferma a ogni taglio, così spunti il filo subito.',
    en: 'The machine stops at every trim so you can snip right away.',
    fr: "La machine s'arrête à chaque coupe pour que vous coupiez le fil tout de suite.",
    de: 'Die Maschine stoppt bei jedem Schnitt, damit du den Faden gleich kürzen kannst.',
    es: 'La máquina se detiene en cada corte para que cortes el hilo enseguida.',
    pt: 'A máquina para a cada corte para você cortar o fio na hora.',
  },
  'panel.trimsStops': { it: '{n} fermate macchina', en: '{n} machine stops', fr: '{n} arrêts machine', de: '{n} Maschinenstopps', es: '{n} paradas de máquina', pt: '{n} paradas de máquina' },
  'panel.convert': { it: 'Converti in {fmt}', en: 'Convert to {fmt}', fr: 'Convertir en {fmt}', de: 'Konvertieren zu {fmt}', es: 'Convertir a {fmt}', pt: 'Converter para {fmt}' },
  'panel.convertMulti': { it: 'Converti in {n} formati', en: 'Convert to {n} formats', fr: 'Convertir en {n} formats', de: 'In {n} Formate konvertieren', es: 'Convertir a {n} formatos', pt: 'Converter para {n} formatos' },
  'panel.remove': { it: 'Rimuovi dalla coda', en: 'Remove from queue', fr: 'Retirer de la file', de: 'Aus der Warteschlange entfernen', es: 'Quitar de la cola', pt: 'Remover da fila' },
  'panel.sameFormat': {
    it: 'Il file è già in {fmt}: scegli un altro formato.',
    en: 'This file is already {fmt}: pick another format.',
    fr: 'Ce fichier est déjà en {fmt} : choisissez un autre format.',
    de: 'Diese Datei ist schon {fmt}: wähle ein anderes Format.',
    es: 'Este archivo ya está en {fmt}: elige otro formato.',
    pt: 'Este arquivo já está em {fmt}: escolha outro formato.',
  },
  'panel.sameFormatExtras': {
    it: 'Già in {fmt}: converto solo nei formati extra.',
    en: 'Already {fmt}: converting to the extra formats only.',
    fr: 'Déjà en {fmt} : je convertis seulement les formats supplémentaires.',
    de: 'Bereits {fmt}: konvertiere nur die Zusatzformate.',
    es: 'Ya en {fmt}: convierto solo a los formatos extra.',
    pt: 'Já em {fmt}: converto apenas para os formatos extra.',
  },
  'panel.threadsLabel': { it: 'Fili', en: 'Threads', fr: 'Fils', de: 'Fäden', es: 'Hilos', pt: 'Fios' },
  'panel.threadsMore': { it: '+{n} altri', en: '+{n} more', fr: '+{n} autres', de: '+{n} weitere', es: '+{n} más', pt: '+{n} outros' },
  'panel.statJumps': { it: 'Salti', en: 'Jumps', fr: 'Sauts', de: 'Sprünge', es: 'Saltos', pt: 'Saltos' },
  'panel.statTrims': { it: 'Tagli', en: 'Trims', fr: 'Coupes', de: 'Schnitte', es: 'Cortes', pt: 'Cortes' },
  'panel.statStops': { it: 'Pause', en: 'Stops', fr: 'Arrêts', de: 'Stopps', es: 'Paradas', pt: 'Paradas' },
  'panel.sewTime': { it: 'Tempo di ricamo', en: 'Sew time', fr: 'Temps de couture', de: 'Stickzeit', es: 'Tiempo de costura', pt: 'Tempo de costura' },
  'panel.sewTimeMin': {
    it: '~{min} min (stima a 600 punti/min)',
    en: '~{min} min (assuming 600 stitches/min)',
    fr: '~{min} min (à 600 points/min)',
    de: '~{min} Min. (bei 600 Punkten/Min.)',
    es: '~{min} min (a 600 puntos/min)',
    pt: '~{min} min (a 600 pontos/min)',
  },
  'panel.sewTimeHours': {
    it: '~{h} h {min} min (stima a 600 punti/min)',
    en: '~{h} h {min} min (assuming 600 stitches/min)',
    fr: '~{h} h {min} min (à 600 points/min)',
    de: '~{h} Std. {min} Min. (bei 600 Punkten/Min.)',
    es: '~{h} h {min} min (a 600 puntos/min)',
    pt: '~{h} h {min} min (a 600 pontos/min)',
  },

  // Download section (/convert)
  'dl.title': { it: 'Anche fuori dal browser', en: 'Beyond the browser', fr: 'Au-delà du navigateur', de: 'Auch außerhalb des Browsers', es: 'También fuera del navegador', pt: 'Também fora do navegador' },
  'dl.sub': {
    it: 'Le stesse conversioni, sul tuo computer, senza aprire una pagina.',
    en: 'The same conversions, on your own machine, no page required.',
    fr: 'Les mêmes conversions, sur votre machine, sans ouvrir de page.',
    de: 'Die gleichen Konvertierungen, auf deinem Rechner, ohne eine Seite zu öffnen.',
    es: 'Las mismas conversiones, en tu equipo, sin abrir una página.',
    pt: 'As mesmas conversões, na sua máquina, sem abrir uma página.',
  },
  'dl.desktopLabel': { it: 'App desktop', en: 'Desktop apps', fr: 'Applications de bureau', de: 'Desktop-Apps', es: 'Apps de escritorio', pt: 'Apps de desktop' },
  'dl.cliLabel': { it: 'Riga di comando', en: 'Command line', fr: 'Ligne de commande', de: 'Kommandozeile', es: 'Línea de comandos', pt: 'Linha de comando' },
  'dl.windows': { it: 'Windows', en: 'Windows', fr: 'Windows', de: 'Windows', es: 'Windows', pt: 'Windows' },
  'dl.macos': { it: 'macOS', en: 'macOS', fr: 'macOS', de: 'macOS', es: 'macOS', pt: 'macOS' },
  'dl.linux': { it: 'Linux', en: 'Linux', fr: 'Linux', de: 'Linux', es: 'Linux', pt: 'Linux' },
  'dl.get': { it: 'Scarica', en: 'Download', fr: 'Télécharger', de: 'Herunterladen', es: 'Descargar', pt: 'Baixar' },
  'dl.forYou': { it: '· per il tuo sistema', en: '· for your system', fr: '· pour votre système', de: '· für dein System', es: '· para tu sistema', pt: '· para o seu sistema' },
  'dl.copy': { it: 'Copia', en: 'Copy', fr: 'Copier', de: 'Kopieren', es: 'Copiar', pt: 'Copiar' },
  'dl.copied': { it: 'Copiato', en: 'Copied', fr: 'Copié', de: 'Kopiert', es: 'Copiado', pt: 'Copiado' },
  'dl.cliReq': { it: 'Serve Node ≥18.', en: 'Needs Node ≥18.', fr: 'Nécessite Node ≥18.', de: 'Benötigt Node ≥18.', es: 'Requiere Node ≥18.', pt: 'Requer Node ≥18.' },
  'dl.cliNpm': { it: 'Pagina npm', en: 'npm page', fr: 'Page npm', de: 'npm-Seite', es: 'Página npm', pt: 'Página npm' },
  'dl.cliBin': { it: 'Binari senza Node', en: 'No-Node binaries', fr: 'Binaires sans Node', de: 'Binärdateien ohne Node', es: 'Binarios sin Node', pt: 'Binários sem Node' },

  // Stitch-out panel (conversion animation)
  'stitch.working': { it: 'Sto ricucendo {name}', en: 'Re-stitching {name}', fr: 'Re-coudre {name}', de: 'Nähe {name} neu', es: 'Recociendo {name}', pt: 'Recosturando {name}' },
  'stitch.skip': { it: 'Salta e scarica', en: 'Skip and download', fr: 'Passer et télécharger', de: 'Überspringen und herunterladen', es: 'Saltar y descargar', pt: 'Pular e baixar' },
  'stitch.doneSingle': { it: 'Cucito. Il download è partito.', en: 'Stitched. Download started.', fr: 'Cousu. Téléchargement lancé.', de: 'Genäht. Download gestartet.', es: 'Cosido. Descarga iniciada.', pt: 'Costurado. Download iniciado.' },
  'stitch.close': { it: 'Chiudi', en: 'Close', fr: 'Fermer', de: 'Schließen', es: 'Cerrar', pt: 'Fechar' },

  // Results list: design size + declared-hoop fit (params pre-localized in mm)
  'result.size': { it: 'Ricamo {w}×{h} mm.', en: 'Design {w}×{h} mm.', fr: 'Motif {w}×{h} mm.', de: 'Muster {w}×{h} mm.', es: 'Diseño {w}×{h} mm.', pt: 'Design {w}×{h} mm.' },
  'result.hoopFits': {
    it: 'Telaio dichiarato {w}×{h} mm: ci sta.',
    en: 'Declared hoop {w}×{h} mm: it fits.',
    fr: 'Cadre déclaré {w}×{h} mm : il tient.',
    de: 'Deklarierter Rahmen {w}×{h} mm: er passt.',
    es: 'Bastidor declarado {w}×{h} mm: cabe.',
    pt: 'Bastidor declarado {w}×{h} mm: cabe.',
  },
  'result.hoopRecenter': {
    it: 'Telaio dichiarato {w}×{h} mm: ci sta, ma conviene ricentrarlo.',
    en: 'Declared hoop {w}×{h} mm: it fits, but you may want to re-center it.',
    fr: 'Cadre déclaré {w}×{h} mm : il tient, mais mieux vaut le recentrer.',
    de: 'Deklarierter Rahmen {w}×{h} mm: er passt, aber besser zentrieren.',
    es: 'Bastidor declarado {w}×{h} mm: cabe, pero conviene recentrarlo.',
    pt: 'Bastidor declarado {w}×{h} mm: cabe, mas convém recentralizar.',
  },
  'result.hoopOverflow': {
    it: 'Telaio dichiarato {w}×{h} mm: sborda di {ow}×{oh} mm.',
    en: 'Declared hoop {w}×{h} mm: overflows by {ow}×{oh} mm.',
    fr: 'Cadre déclaré {w}×{h} mm : déborde de {ow}×{oh} mm.',
    de: 'Deklarierter Rahmen {w}×{h} mm: ragt um {ow}×{oh} mm hinaus.',
    es: 'Bastidor declarado {w}×{h} mm: rebasa en {ow}×{oh} mm.',
    pt: 'Bastidor declarado {w}×{h} mm: excede em {ow}×{oh} mm.',
  },

  // Footer
  'footer.tagline': {
    it: 'Ricuci i tuoi ricami in un altro formato.',
    en: 'Re-stitch your embroidery into another format.',
    fr: 'Re-cousez vos broderies dans un autre format.',
    de: 'Nähe deine Stickereien in ein anderes Format neu.',
    es: 'Re-cose tus bordados en otro formato.',
    pt: 'Re-costure seus bordados em outro formato.',
  },
  'footer.creditBy': {
    it: 'Un progetto di',
    en: 'A project by',
    fr: 'Un projet de',
    de: 'Ein Projekt von',
    es: 'Un proyecto de',
    pt: 'Um projeto de',
  },
  'footer.docsLink': {
    it: 'Come funziona Ricuci',
    en: 'How Ricuci works',
    fr: 'Comment fonctionne Ricuci',
    de: 'Wie Ricuci funktioniert',
    es: 'Cómo funciona Ricuci',
    pt: 'Como o Ricuci funciona',
  },
  'footer.formatsLink': { it: 'Formati supportati', en: 'Supported formats', fr: 'Formats pris en charge', de: 'Unterstützte Formate', es: 'Formatos soportados', pt: 'Formatos suportados' },
  'footer.privacyLink': { it: 'Privacy', en: 'Privacy', fr: 'Confidentialité', de: 'Datenschutz', es: 'Privacidad', pt: 'Privacidade' },

  // Floating sponsor tab (Calicchia Design)
  'sponsor.cta': {
    it: 'Sito o piattaforma web? Parliamone',
    en: 'A website or a platform? Let’s talk',
    fr: 'Un site ou une plateforme ? Parlons-en',
    de: 'Website oder Plattform? Sprich mich an',
    es: '¿Una web o una plataforma? Hablemos',
    pt: 'Um site ou uma plataforma? Vamos conversar',
  },
  'sponsor.close': { it: 'Chiudi', en: 'Close', fr: 'Fermer', de: 'Schließen', es: 'Cerrar', pt: 'Fechar' },

  // Docs pages
  'docs.tagline': {
    it: 'Come funziona Ricuci, dentro e fuori.',
    en: 'How Ricuci works, inside and out.',
    fr: 'Comment fonctionne Ricuci, dedans et dehors.',
    de: 'Wie Ricuci funktioniert, innen und außen.',
    es: 'Cómo funciona Ricuci, por dentro y por fuera.',
    pt: 'Como o Ricuci funciona, por dentro e por fora.',
  },
  'docs.backHome': { it: '← Torna alla home', en: '← Back to home', fr: '← Retour à l’accueil', de: '← Zurück zur Startseite', es: '← Volver al inicio', pt: '← Voltar ao início' },
  'docs.backConverter': { it: '← Torna al convertitore', en: '← Back to the converter', fr: '← Retour au convertisseur', de: '← Zurück zum Konverter', es: '← Volver al convertidor', pt: '← Voltar ao conversor' },

  // Gated designs (UnsupportedDesignError.reason)
  'err.MULTI_COLOR': {
    it:
      'Questo ricamo usa più colori distinti di quanti il formato scelto ' +
      'ne possa elencare.',
    en:
      'This design uses more distinct colors than the chosen format can list.',
    fr:
      "Ce motif utilise plus de couleurs distinctes que le format choisi n'en peut lister.",
    de:
      'Dieses Muster nutzt mehr verschiedene Farben, als das gewählte Format auflisten kann.',
    es:
      'Este diseño usa más colores distintos de los que el formato elegido puede listar.',
    pt:
      'Este design usa mais cores distintas do que o formato escolhido permite listar.',
  },
  'err.TRIM': {
    it: 'Questo ricamo contiene tagli del filo che il formato scelto non sa scrivere.',
    en: "This design has thread trims the chosen format can't write.",
    fr: "Ce motif contient des coupes de fil que le format choisi ne sait pas écrire.",
    de: 'Dieses Muster enthält Fadenschnitte, die das gewählte Format nicht schreiben kann.',
    es: 'Este diseño contiene cortes de hilo que el formato elegido no sabe escribir.',
    pt: 'Este design contém cortes de fio que o formato escolhido não sabe escrever.',
  },
  'err.JUMP': {
    it: 'Questo ricamo contiene salti del filo che il formato scelto non sa scrivere.',
    en: "This design has thread jumps the chosen format can't write.",
    fr: "Ce motif contient des sauts de fil que le format choisi ne sait pas écrire.",
    de: 'Dieses Muster enthält Fadensprünge, die das gewählte Format nicht schreiben kann.',
    es: 'Este diseño contiene saltos de hilo que el formato elegido no sabe escribir.',
    pt: 'Este design contém saltos de fio que o formato escolhido não sabe escrever.',
  },
  'err.STOP': {
    it: 'Questo ricamo contiene delle pause che il formato scelto non sa scrivere.',
    en: "This design has stop points the chosen format can't write.",
    fr: "Ce motif contient des pauses que le format choisi ne sait pas écrire.",
    de: 'Dieses Muster enthält Pausen, die das gewählte Format nicht schreiben kann.',
    es: 'Este diseño contiene paradas que el formato elegido no sabe escribir.',
    pt: 'Este design contém paradas que o formato escolhido não sabe escrever.',
  },
  'err.EMPTY': {
    it: "In questo file non c'è nemmeno un punto da cucire.",
    en: "There isn't a single stitch to sew in this file.",
    fr: "Il n'y a pas un seul point à coudre dans ce fichier.",
    de: 'In dieser Datei ist kein einziger Punkt zu nähen.',
    es: 'No hay ni un solo punto para coser en este archivo.',
    pt: 'Não há um único ponto para costurar neste arquivo.',
  },
  'err.DELTA_RANGE': {
    it: 'Un punto di questo ricamo fa un salto più lungo di quanto ZHS permetta (12,8 mm).',
    en: 'One stitch in this design jumps farther than ZHS allows (12.8 mm).',
    fr: 'Un point de ce motif fait un saut plus long que ce que ZHS autorise (12,8 mm).',
    de: 'Ein Punkt dieses Musters springt weiter, als ZHS erlaubt (12,8 mm).',
    es: 'Un punto de este diseño salta más de lo que ZHS permite (12,8 mm).',
    pt: 'Um ponto deste design salta mais do que o ZHS permite (12,8 mm).',
  },
  'err.TOO_MANY_RECORDS': {
    it: 'Questo ricamo ha troppi punti per il formato ZHS.',
    en: 'This design has too many stitches for the ZHS format.',
    fr: 'Ce motif a trop de points pour le format ZHS.',
    de: 'Dieses Muster hat zu viele Punkte für das ZHS-Format.',
    es: 'Este diseño tiene demasiados puntos para el formato ZHS.',
    pt: 'Este design tem pontos demais para o formato ZHS.',
  },
  'err.TOO_LARGE': {
    it: 'Questo ricamo è troppo grande per il formato scelto.',
    en: 'This design is too large for the chosen format.',
    fr: 'Ce motif est trop grand pour le format choisi.',
    de: 'Dieses Muster ist zu groß für das gewählte Format.',
    es: 'Este diseño es demasiado grande para el formato elegido.',
    pt: 'Este design é grande demais para o formato escolhido.',
  },
  'err.unsupportedFallback': {
    it: 'Non riesco a ricucire questo file: {msg}',
    en: "I can't re-stitch this file: {msg}",
    fr: "Je ne peux pas re-coudre ce fichier : {msg}",
    de: 'Ich kann diese Datei nicht neu nähen: {msg}',
    es: 'No puedo recoser este archivo: {msg}',
    pt: 'Não consegui recosturar este arquivo: {msg}',
  },
  'err.unreadableExt': {
    it: 'Non so leggere i file ".{ext}". Leggo: {list}.',
    en: "I can't read \".{ext}\" files. I read: {list}.",
    fr: 'Je ne sais pas lire les fichiers « .{ext} ». Je lis : {list}.',
    de: 'Ich kann „.{ext}“-Dateien nicht lesen. Ich lese: {list}.',
    es: 'No sé leer archivos «.{ext}». Leo: {list}.',
    pt: 'Não sei ler arquivos «.{ext}». Eu leio: {list}.',
  },
  'err.unrecognized': {
    it: 'Non riconosco questo file. Leggo: {list}.',
    en: "I don't recognize this file. I read: {list}.",
    fr: 'Je ne reconnais pas ce fichier. Je lis : {list}.',
    de: 'Ich erkenne diese Datei nicht. Ich lese: {list}.',
    es: 'No reconozco este archivo. Leo: {list}.',
    pt: 'Não reconheço este arquivo. Eu leio: {list}.',
  },
  'err.alreadyTarget': {
    it: "Questo file è già in {fmt}: non c'è nulla da ricucire.",
    en: 'This file is already {fmt}: nothing to re-stitch.',
    fr: 'Ce fichier est déjà en {fmt} : rien à re-coudre.',
    de: 'Diese Datei ist bereits {fmt}: nichts neu zu nähen.',
    es: 'Este archivo ya está en {fmt}: nada que recoser.',
    pt: 'Este arquivo já está em {fmt}: nada a recosturar.',
  },
  'err.corrupt': {
    it: 'Non riesco a leggere questo file (forse è rovinato): {msg}',
    en: "I can't read this file (it may be damaged): {msg}",
    fr: "Je ne peux pas lire ce fichier (peut-être endommagé) : {msg}",
    de: 'Ich kann diese Datei nicht lesen (vielleicht beschädigt): {msg}',
    es: 'No puedo leer este archivo (quizá esté dañado): {msg}',
    pt: 'Não consegui ler este arquivo (talvez danificado): {msg}',
  },
  'err.unexpected': { it: 'Errore inatteso: {msg}', en: 'Unexpected error: {msg}', fr: 'Erreur inattendue : {msg}', de: 'Unerwarteter Fehler: {msg}', es: 'Error inesperado: {msg}', pt: 'Erro inesperado: {msg}' },

  // Structured conversion warnings
  'warn.FILLER_THREAD': {
    it:
      'Il file di partenza non dice di che colore sono i fili: quelli ' +
      'mancanti sono segnati in nero. Sulla stoffa deciderai tu.',
    en:
      "The source file doesn't say what color the threads are: the missing " +
      'ones are marked in black. On fabric, you decide.',
    fr:
      "Le fichier source ne dit pas de quelle couleur sont les fils : les " +
      'manquants sont marqués en noir. Sur le tissu, c’est vous qui décidez.',
    de:
      'Die Quelldatei sagt nicht, welche Farbe die Fäden haben: die fehlenden ' +
      'werden schwarz markiert. Auf dem Stoff entscheidest du.',
    es:
      'El archivo de origen no dice de qué color son los hilos: los que faltan ' +
      'se marcan en negro. En la tela, decides tú.',
    pt:
      'O arquivo de origem não diz de que cor são os fios: os faltantes ' +
      'são marcados em preto. No tecido, você decide.',
  },
  'warn.DELTA_63_SHIFTED': {
    it:
      "Un punto era un filo troppo lungo per questo formato: l'ho accorciato " +
      'di un niente (0,1 mm). Il resto del ricamo non cambia.',
    en:
      'One stitch was a touch too long for this format: I shortened it by a ' +
      'hair (0.1 mm). The rest of the design is unchanged.',
    fr:
      "Un point était un peu trop long pour ce format : je l'ai raccourci d'un " +
      'rien du tout (0,1 mm). Le reste du motif ne change pas.',
    de:
      'Ein Punkt war einen Hauch zu lang für dieses Format: ich habe ihn um ' +
      'ein Haar (0,1 mm) gekürzt. Der Rest bleibt unverändert.',
    es:
      'Un punto era un poco demasiado largo para este formato: lo acorté un ' +
      'nada (0,1 mm). El resto del diseño no cambia.',
    pt:
      'Um ponto estava um pouco longo demais para este formato: eu o ' +
      'encolhi um nada (0,1 mm). O resto do design não muda.',
  },
  'warn.COLOR_QUANTIZED': {
    it: 'Questo formato conosce solo i colori delle sue matassine: ho scelto i più vicini ai tuoi.',
    en: 'This format only knows its own thread shades: I picked the closest to yours.',
    fr: 'Ce format ne connaît que ses propres nuances de fil : j’ai choisi les plus proches des vôtres.',
    de: 'Dieses Format kennt nur seine eigenen Fadennuancen: ich habe die nächsten zu deinen gewählt.',
    es: 'Este formato solo conoce sus propios tonos de hilo: elegí los más cercanos a los tuyos.',
    pt: 'Este formato só conhece seus próprios tons de fio: escolhi os mais próximos dos seus.',
  },
  'warn.HOOP_FIT_EXCEEDED': {
    it:
      'Il ricamo è più grande del telaio di destinazione: controlla le ' +
      'misure prima di metterlo in macchina.',
    en:
      'The design is larger than the target hoop: double-check the size ' +
      'before loading it on the machine.',
    fr:
      'Le motif est plus grand que le cadre cible : vérifiez les mesures ' +
      'avant de le mettre en machine.',
    de:
      'Das Muster ist größer als der Zielrahmen: prüfe die Maße, ' +
      'bevor du es in die Maschine legst.',
    es:
      'El diseño es más grande que el bastidor de destino: revisa las ' +
      'medidas antes de llevarlo a la máquina.',
    pt:
      'O design é maior que o bastidor de destino: confira as ' +
      'medidas antes de levá-lo à máquina.',
  },
  'warn.HOOP_UNSUPPORTED': {
    it:
      'Questo formato non conosce il telaio richiesto: ho lasciato quello ' +
      'di serie. Il ricamo non cambia.',
    en:
      "This format doesn't know the requested hoop: I kept the stock one. " +
      'The design is unchanged.',
    fr:
      "Ce format ne connaît pas le cadre demandé : j'ai gardé celui par " +
      'défaut. Le motif ne change pas.',
    de:
      'Dieses Format kennt den gewünschten Rahmen nicht: ich habe den ' +
      'Standardrahmen gelassen. Das Muster bleibt unverändert.',
    es:
      'Este formato no conoce el bastidor solicitado: dejé el de serie. ' +
      'El diseño no cambia.',
    pt:
      'Este formato não conhece o bastidor solicitado: mantive o de ' +
      'fábrica. O design não muda.',
  },
  'warn.TRIM_DROPPED': {
    it:
      'Questo formato non sa tagliare il filo: ho tolto i comandi di taglio. ' +
      "I fili tra un colore e l'altro li spunterai a mano.",
    en:
      "This format can't trim the thread: I removed the trim commands. " +
      "You'll snip the floats between colors by hand.",
    fr:
      "Ce format ne sait pas couper le fil : j'ai retiré les commandes de coupe. " +
      'Vous couperez les fils entre les couleurs à la main.',
    de:
      'Dieses Format kann den Faden nicht schneiden: ich habe die Schnittbefehle entfernt. ' +
      'Du schneidest die losen Fäden zwischen den Farben von Hand.',
    es:
      'Este formato no sabe cortar el hilo: quité los comandos de corte. ' +
      'Cortarás los hilos entre colores a mano.',
    pt:
      'Este formato não sabe cortar o fio: removi os comandos de corte. ' +
      'Você cortará os fios entre cores à mão.',
  },

  // Per-format caveats
  'note.zhs': {
    it:
      'ZHS: scrittura verificata sui campioni di fabbrica, multicolore ' +
      'compreso. La prova finale resta la cucitura in macchina.',
    en:
      'ZHS: writing verified against factory samples, multicolor included. ' +
      'The final proof is still sewing it out.',
    fr:
      'ZHS : écriture vérifiée sur des échantillons d’usine, multicolore ' +
      'compris. La preuve finale reste la couture en machine.',
    de:
      'ZHS: Schreiben gegen Werksmuster verifiziert, mehrfarbig inbegriffen. ' +
      'Der endgültige Beweis bleibt das Ausnähen an der Maschine.',
    es:
      'ZHS: escritura verificada contra muestras de fábrica, multicolor ' +
      'incluido. La prueba final sigue siendo coser en máquina.',
    pt:
      'ZHS: escrita verificada contra amostras de fábrica, multicolor ' +
      'incluído. A prova final segue sendo costurar na máquina.',
  },
  'note.hus': {
    it:
      'HUS: scrittura nuova, verificata via software; non ancora provata ' +
      'su una macchina reale.',
    en: 'HUS: new writer, software-verified; not yet tried on a real machine.',
    fr:
      'HUS : écriture nouvelle, vérifiée par logiciel ; pas encore essayée ' +
      'sur une vraie machine.',
    de:
      'HUS: neuer Schreiber, software-verifiziert; noch nicht an einer ' +
      'echten Maschine probiert.',
    es:
      'HUS: escritura nueva, verificada por software; todavía sin probar ' +
      'en una máquina real.',
    pt:
      'HUS: escrita nova, verificada por software; ainda sem testar ' +
      'em uma máquina real.',
  },
  'note.vip': {
    it:
      'VIP: scrittura nuova, verificata via software; non ancora provata ' +
      'su una macchina reale.',
    en: 'VIP: new writer, software-verified; not yet tried on a real machine.',
    fr:
      'VIP : écriture nouvelle, vérifiée par logiciel ; pas encore essayée ' +
      'sur une vraie machine.',
    de:
      'VIP: neuer Schreiber, software-verifiziert; noch nicht an einer ' +
      'echten Maschine probiert.',
    es:
      'VIP: escritura nueva, verificada por software; todavía sin probar ' +
      'en una máquina real.',
    pt:
      'VIP: escrita nova, verificada por software; ainda sem testar ' +
      'em uma máquina real.',
  },
  'note.xxx': {
    it: 'XXX: scrittura verificata byte per byte contro pyembroidery.',
    en: 'XXX: writing verified byte-for-byte against pyembroidery.',
    fr: 'XXX : écriture vérifiée octet par octet contre pyembroidery.',
    de: 'XXX: Schreiben byte-für-byte gegen pyembroidery verifiziert.',
    es: 'XXX: escritura verificada byte a byte contra pyembroidery.',
    pt: 'XXX: escrita verificada byte a byte contra o pyembroidery.',
  },
  'note.pes': {
    it: 'PES: i colori vengono avvicinati alle matassine Brother.',
    en: 'PES: colors are matched to the closest Brother threads.',
    fr: 'PES : les couleurs sont rapprochées des fils Brother.',
    de: 'PES: Farben werden an die Brother-Fäden angeglichen.',
    es: 'PES: los colores se acercan a los hilos Brother.',
    pt: 'PES: as cores são aproximadas aos fios Brother.',
  },
  'note.pec': {
    it: 'PEC: i colori vengono avvicinati alle matassine della macchina.',
    en: "PEC: colors are matched to the machine's own thread shades.",
    fr: 'PEC : les couleurs sont rapprochées des fils propres à la machine.',
    de: 'PEC: Farben werden an die maschineneigenen Fäden angeglichen.',
    es: 'PEC: los colores se acercan a los hilos propios de la máquina.',
    pt: 'PEC: as cores são aproximadas aos fios próprios da máquina.',
  },
  'note.jef': {
    it: 'JEF: i colori vengono avvicinati alle matassine Janome.',
    en: 'JEF: colors are matched to the closest Janome threads.',
    fr: 'JEF : les couleurs sont rapprochées des fils Janome.',
    de: 'JEF: Farben werden an die Janome-Fäden angeglichen.',
    es: 'JEF: los colores se acercan a los hilos Janome.',
    pt: 'JEF: as cores são aproximadas aos fios Janome.',
  },
  'note.exp': {
    it: 'EXP non salva i colori: sulla macchina li scegli tu.',
    en: "EXP doesn't store colors: you pick them at the machine.",
    fr: "EXP n'enregistre pas les couleurs : vous les choisissez à la machine.",
    de: 'EXP speichert keine Farben: du wählst sie an der Maschine.',
    es: 'EXP no guarda colores: los eliges en la máquina.',
    pt: 'EXP não guarda cores: você as escolhe na máquina.',
  },
};