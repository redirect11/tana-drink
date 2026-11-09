// ── I TEMI DELLE ICONE DEL GESTIONALE (REQ-UI-031) ───────────────────────
//
// Flavio, 07/11/2026: «tutte le icone andrebbero cambiate, andrebbero
// snellite e andrebbero messe le silhouette»; le emoji colorate «sono le
// emoticon di WhatsApp» e danno al programma un senso di giocattolo; nei
// programmi con cui ha lavorato le icone erano monocrome, «in un solo
// colore», o non c'erano. Il colore resta dove dice qualcosa: il verde, il
// giallo e il rosso degli stati, e le categorie colorate dal locale.
// Decisioni dell'utente dello stesso giorno: le icone hanno dei TEMI;
// «Silhouette» (disegni di Lucide, a tratto, monocromi) è quello di
// partenza, «Emoji» rimette quelle di prima; vale per il gestionale, non
// per le pagine del cliente, che hanno lo stile del loro menù.
//
// UN'ICONA È UN NOME, NON UN DISEGNO. Le schermate chiedono «cassa» o
// «elimina»; il tema decide come si disegna. Qui c'è il vocabolario: per
// ogni nome l'emoji del tema «Emoji» e il disegno di Lucide del tema
// «Silhouette» (il componente vero lo dà components/Icona.jsx, che importa
// solo i disegni elencati qui). `colore`: le icone che SONO un colore — i
// pallini degli stati — restano colorate in ogni tema, con gli inchiostri
// di stato di DESIGN.md.
//
// LE EMOJI DI PRIMA SI RICONOSCONO. Le schermate passano al vocabolario
// una alla volta: finché una manda ancora l'emoji, `nomeIcona` la riporta
// al suo nome, e si vede già nel tema scelto. Dove la stessa emoji voleva
// dire due cose (💶 la cassa e i contanti) vince il significato più
// comune; chi intende l'altro chiede il nome.
//
// Logica pura: niente React, così la leggono anche lib/sezioni.js e le
// prove.

export const VOCABOLARIO = Object.freeze({
  // ── Le pagine e le sezioni del gestionale ──
  coda: { emoji: '🧾', disegno: 'ReceiptText' },
  cassa: { emoji: '💶', disegno: 'Wallet' },
  fatture: { emoji: '📄', disegno: 'FileText' },
  statistiche: { emoji: '📊', disegno: 'ChartColumn' },
  bilancio: { emoji: '⚖️', disegno: 'Scale' },
  menu: { emoji: '🍸', disegno: 'Martini' },
  magazzino: { emoji: '📦', disegno: 'Package' },
  fornitori: { emoji: '🏭', disegno: 'Factory' },
  staff: { emoji: '👥', disegno: 'Users' },
  utenti: { emoji: '🧑‍🤝‍🧑', disegno: 'UserCog' },
  'vista-cliente': { emoji: '👀', disegno: 'Eye' },
  marketplace: { emoji: '🛍️', disegno: 'ShoppingBag' },
  impostazioni: { emoji: '⚙️', disegno: 'Settings' },
  servizio: { emoji: '🫱', disegno: 'HandPlatter' },
  stampante: { emoji: '🖨️', disegno: 'Printer' },
  profilo: { emoji: '👤', disegno: 'User' },
  'miei-ordini': { emoji: '🧾', disegno: 'ReceiptText' },
  esci: { emoji: '🚪', disegno: 'LogOut' },
  'schermo-intero': { emoji: '⛶', disegno: 'Maximize' },
  'esci-schermo-intero': { emoji: '🡼', disegno: 'Minimize' },
  'area-clienti': { emoji: '🏛️', disegno: 'Landmark' },
  'ordina-dal-menu': { emoji: '📖', disegno: 'BookOpen' },
  'nuovo-ordine': { emoji: '✍️', disegno: 'SquarePen' },
  sviluppo: { emoji: '🛠', disegno: 'Wrench' },
  'chiama-bancone': { emoji: '📟', disegno: 'BellRing' },

  // ── Le sottosezioni ──
  calendario: { emoji: '📅', disegno: 'Calendar' },
  giorno: { emoji: '🗓', disegno: 'CalendarDays' },
  acquisti: { emoji: '📥', disegno: 'Inbox' },
  raggruppa: { emoji: '🗂️', disegno: 'Layers' },
  elenco: { emoji: '📋', disegno: 'ClipboardList' },
  registro: { emoji: '📒', disegno: 'NotebookText' },
  carrello: { emoji: '🛒', disegno: 'ShoppingCart' },
  archivio: { emoji: '🗄️', disegno: 'Archive' },
  categorie: { emoji: '🏷️', disegno: 'Tag' },
  movimenti: { emoji: '📜', disegno: 'ScrollText' },
  prova: { emoji: '🧪', disegno: 'FlaskConical' },
  lista: { emoji: '☰', disegno: 'List' },
  preferito: { emoji: '⭐', disegno: 'Star' },
  temi: { emoji: '🎨', disegno: 'Palette' },
  stili: { emoji: '🖋️', disegno: 'PenTool' },
  moduli: { emoji: '🧩', disegno: 'Puzzle' },
  andamento: { emoji: '📈', disegno: 'TrendingUp' },
  special: { emoji: '✨', disegno: 'Sparkles' },
  clienti: { emoji: '🙋', disegno: 'Hand' },
  posizione: { emoji: '📍', disegno: 'MapPin' },
  notifiche: { emoji: '🔔', disegno: 'Bell' },
  'notifiche-spente': { emoji: '🔕', disegno: 'BellOff' },
  note: { emoji: '📝', disegno: 'StickyNote' },
  immagine: { emoji: '🖼', disegno: 'Image' },
  salva: { emoji: '💾', disegno: 'Save' },
  informazioni: { emoji: 'ℹ️', disegno: 'Info' },
  licenza: { emoji: '🔒', disegno: 'Lock' },
  tempo: { emoji: '⏱', disegno: 'Timer' },
  dividi: { emoji: '✂️', disegno: 'Scissors' },
  tavolo: { emoji: '🍽', disegno: 'UtensilsCrossed' },
  'ritiro-e-servizio': { emoji: '🙌', disegno: 'HandHeart' },
  'gestione-menu': { emoji: '🍹', disegno: 'GlassWater' },
  campanello: { emoji: '🛎', disegno: 'ConciergeBell' },
  buono: { emoji: '🎟', disegno: 'Ticket' },
  paghe: { emoji: '💵', disegno: 'Banknote' },
  telefono: { emoji: '📱', disegno: 'Smartphone' },
  cuoco: { emoji: '🧑‍🍳', disegno: 'ChefHat' },
  griglia: { emoji: '🔲', disegno: 'LayoutGrid' },
  corsie: { emoji: '🚦', disegno: 'Columns3' },
  fumetto: { emoji: '💬', disegno: 'MessageSquare' },
  evidenzia: { emoji: '💡', disegno: 'Lightbulb' },

  // ── I modi di pagare ──
  contanti: { emoji: '💶', disegno: 'Banknote' },
  carta: { emoji: '💳', disegno: 'CreditCard' },
  lettore: { emoji: '📟', disegno: 'Nfc' },

  // ── Le azioni ──
  modifica: { emoji: '✏️', disegno: 'Pencil' },
  elimina: { emoji: '🗑', disegno: 'Trash2' },
  aggiungi: { emoji: '➕', disegno: 'Plus' },
  cerca: { emoji: '🔍', disegno: 'Search' },
  stampa: { emoji: '🖨', disegno: 'Printer' },
  chiudi: { emoji: '✖️', disegno: 'X' },
  unisci: { emoji: '🔗', disegno: 'Link' },
  separa: { emoji: '⑃', disegno: 'Split' },
  sconto: { emoji: '🎁', disegno: 'Gift' },
  email: { emoji: '📧', disegno: 'Mail' },
  riapri: { emoji: '♻️', disegno: 'RotateCcw' },
  importa: { emoji: '⬆️', disegno: 'Upload' },
  esporta: { emoji: '⬇️', disegno: 'Download' },
  filtra: { emoji: '⚗️', disegno: 'Funnel' },
  pulisci: { emoji: '🧹', disegno: 'Eraser' },
  aggiorna: { emoji: '🔄', disegno: 'RefreshCw' },
  accedi: { emoji: '🔑', disegno: 'KeyRound' },
  allegato: { emoji: '📎', disegno: 'Paperclip' },
  mostra: { emoji: '👁', disegno: 'Eye' },
  nascondi: { emoji: '🙈', disegno: 'EyeOff' },
  cartella: { emoji: '📁', disegno: 'Folder' },
  avvia: { emoji: '▶️', disegno: 'Play' },
  pausa: { emoji: '⏸', disegno: 'Pause' },
  dividi_in_parti: { emoji: '➗', disegno: 'Divide' },
  spunta: { emoji: '☑', disegno: 'SquareCheck' },
  calcola: { emoji: '🧮', disegno: 'Calculator' },
  menu_laterale: { emoji: '☰', disegno: 'Menu' },
  regola: { emoji: '🎛', disegno: 'SlidersHorizontal' },
  ruolo: { emoji: '🎚', disegno: 'SlidersVertical' },
  scrivi: { emoji: '✎', disegno: 'Pencil' },
  // Le frecce della direzione (in cima / in fondo, carico / reso): le
  // frecce semplici e non ⬆️ ⬇️, che sono già importa ed esporta.
  su: { emoji: '↑', disegno: 'ArrowUp' },
  giu: { emoji: '↓', disegno: 'ArrowDown' },

  // ── I segnali ──
  avviso: { emoji: '⚠️', disegno: 'TriangleAlert' },
  fatto: { emoji: '✅', disegno: 'CircleCheck' },
  errore: { emoji: '❌', disegno: 'CircleX' },
  attesa: { emoji: '⏳', disegno: 'Hourglass' },
  vietato: { emoji: '🚫', disegno: 'Ban' },
  fermo: { emoji: '⛔', disegno: 'OctagonX' },
  orario: { emoji: '🕗', disegno: 'Clock' },
  domanda: { emoji: '❓', disegno: 'CircleHelp' },
  novita: { emoji: '🆕', disegno: 'BadgePlus' },
  festa: { emoji: '🎉', disegno: 'PartyPopper' },
  'in-linea': { emoji: '🍾', disegno: 'Wine' },
  premium: { emoji: '👑', disegno: 'Crown' },
  mondo: { emoji: '🌐', disegno: 'Globe' },
  'a-piedi': { emoji: '🚶', disegno: 'PersonStanding' },
  incasso: { emoji: '💰', disegno: 'Coins' },
  'rete-assente': { emoji: '📴', disegno: 'WifiOff' },
  rete: { emoji: '📶', disegno: 'Wifi' },
  'in-coppia': { emoji: '🤝', disegno: 'Handshake' },
  classifica: { emoji: '🏆', disegno: 'Trophy' },
  richiesti: { emoji: '🔥', disegno: 'Flame' },
  'invio-telefono': { emoji: '📲', disegno: 'SmartphoneNfc' },
  'in-preparazione': { emoji: '🍹', disegno: 'GlassWater' },
  pronto: { emoji: '🔔', disegno: 'Bell' },
  annullato: { emoji: '✖️', disegno: 'X' },

  // ── I pallini: sono un colore, e restano colorati in ogni tema ──
  verde: { emoji: '🟢', disegno: 'Circle', colore: 'verde' },
  rosso: { emoji: '🔴', disegno: 'Circle', colore: 'rosso' },
  giallo: { emoji: '🟡', disegno: 'Circle', colore: 'ambra' },
  spento: { emoji: '⚪', disegno: 'Circle', colore: 'spento' },
})

export const TEMI_ICONE = Object.freeze(['silhouette', 'emoji'])
export const TEMA_ICONE_DI_PARTENZA = 'silhouette'

// TRE GRUPPI, OGNUNO COL SUO TEMA (decisione dell'utente, 07/11/2026: «il
// selettore del tema deve essere separato» per ogni fase). Si sceglie a
// parte per:
//   navigazione — menu laterale, sezioni e sottosezioni, barra, foglio del
//                 telefono, moduli del Marketplace;
//   tasti       — tasti, titoli di sezione, metodi di pagamento, stati dei
//                 conti;
//   segnali     — gli avvisi nei testi, i messaggi, i campi di ricerca.
// Ogni gruppo ha la sua chiave su settings/bar.
export const GRUPPI_ICONE = Object.freeze({
  navigazione: { chiave: 'tema_icone_navigazione', label: 'Navigazione' },
  tasti: { chiave: 'tema_icone_tasti', label: 'Tasti e stati' },
  segnali: { chiave: 'tema_icone_segnali', label: 'Segnali e messaggi' },
})
export const GRUPPO_DI_PARTENZA = 'navigazione'

// Il tema di un gruppo: quello scritto, se è uno dei due, se no quello di
// partenza.
export function temaIconeDi(settings, gruppo = GRUPPO_DI_PARTENZA) {
  const scritto = settings?.[GRUPPI_ICONE[gruppo]?.chiave]
  return TEMI_ICONE.includes(scritto) ? scritto : TEMA_ICONE_DI_PARTENZA
}

// I temi di tutti i gruppi, come li vuole il contesto di <Icona>.
export const temiIconeDi = (settings) =>
  Object.fromEntries(Object.keys(GRUPPI_ICONE).map((g) => [g, temaIconeDi(settings, g)]))

// Tutti i gruppi con le emoji: chi non è dello staff (le pagine del
// cliente hanno lo stile del loro menù).
export const TUTTE_EMOJI = Object.freeze(Object.fromEntries(Object.keys(GRUPPI_ICONE).map((g) => [g, 'emoji'])))

const senzaVariante = (s) => String(s || '').replace(/[︎️]/g, '')

// Dall'emoji al nome, per le schermate che mandano ancora l'emoji. Il primo
// nome che la usa vince: l'ordine del vocabolario mette prima il
// significato più comune (vedi sopra).
const DA_EMOJI = new Map()
for (const [nome, v] of Object.entries(VOCABOLARIO)) {
  const e = senzaVariante(v.emoji)
  if (!DA_EMOJI.has(e)) DA_EMOJI.set(e, nome)
}
// Le emoji che, con lo stesso significato, si scrivevano in un altro modo.
const SINONIMI = { '🖨': 'stampa', '✏': 'modifica', '✎': 'scrivi', '⭐': 'preferito', '★': 'preferito', '🕘': 'orario', '🕒': 'orario', '🕓': 'orario', '🕙': 'orario', '✉': 'email', '⬆': 'importa', '⬇': 'esporta' }
for (const [e, nome] of Object.entries(SINONIMI)) DA_EMOJI.set(senzaVariante(e), nome)
// Le correzioni del significato più comune, dove l'ordine qui sopra non
// basta: 💶 da solo è quasi sempre il contante; 🧾 è la coda; 📟 il lettore.
DA_EMOJI.set('💶', 'contanti')
DA_EMOJI.set('🧾', 'coda')
DA_EMOJI.set('📟', 'lettore')
DA_EMOJI.set('🖨', 'stampa')
DA_EMOJI.set('☰', 'menu_laterale')
DA_EMOJI.set('✖', 'chiudi')
DA_EMOJI.set('🔔', 'notifiche')
DA_EMOJI.set('🍹', 'gestione-menu')

// Il nome di un'icona: il nome stesso se è del vocabolario, quello della
// sua emoji se è un'emoji conosciuta, se no null.
export function nomeIcona(x) {
  if (!x) return null
  if (Object.hasOwn(VOCABOLARIO, x)) return x
  return DA_EMOJI.get(senzaVariante(String(x).trim())) ?? null
}

// L'emoji di un nome, per chi scrive TESTO e non disegna: le stampe, le
// notifiche del telefono, le etichette che leggono anche le pagine del
// cliente. Le emoji stanno scritte una volta sola, qui.
export const emojiDi = (nome) => VOCABOLARIO[nomeIcona(nome)]?.emoji ?? ''

// UN'ETICHETTA CON L'ICONA DAVANTI, come dato: «🧾 Da fare». Chi la mostra
// nel gestionale la passa a <ConIcona> (components/Icona.jsx), che riconosce
// l'emoji in testa e la disegna nel tema; chi la scrive come testo (una
// stampa, una pagina del cliente) la usa così. Attenzione ai nomi che
// condividono l'emoji con un altro (cassa e contanti, lista e
// menu_laterale): tornando dall'emoji vince il più comune.
export const conEmoji = (nome, testo) => `${emojiDi(nome)} ${testo}`

// Un'icona dentro un testo — un segnaposto, una voce di tendina, il titolo
// di una notifica: lì un disegno non entra. In «Emoji» l'emoji davanti,
// come prima; in «Silhouette» la sola parola: un'emoji colorata accanto a
// icone monocrome è proprio quello che Flavio chiedeva di togliere.
export function testoConIcona(tema, nome, testo) {
  const e = tema === 'emoji' ? emojiDi(nome) : ''
  return e ? `${e} ${testo}` : testo
}

// Un testo che comincia con un'emoji conosciuta: { nome, resto }; se no
// null. Per i messaggi che arrivano già scritti con l'emoji davanti (le
// notifiche a comparsa delle pagine del cliente, o di una schermata non
// ancora passata al vocabolario): l'icona va nel tema, il testo resta.
const IN_TESTA = /^([^\p{L}\p{N}\s]+)\s+/u
export function dividiIcona(testo) {
  if (typeof testo !== 'string') return null
  const m = testo.match(IN_TESTA)
  const nome = m && nomeIcona(m[1])
  return nome ? { nome, resto: testo.slice(m[0].length) } : null
}
