import { profiloLeggero, limitiInChiaro, urlRegia } from './limiti.js'
import { licenzaDi, SCADUTA } from './licenzaInVigore.js'
import { STILI_MENU, temiInLicenza } from './stileMenu.js'

// ── LE FUNZIONI PREMIUM: un posto solo che dice se sono accese ────────
// Decisione dell'utente del 26/08/2026: la conta di magazzino e le fatture
// ai fornitori si attivano all'occorrenza. Sono le prime due di una
// famiglia — il piano di sbrandizzazione (Fase 3,
// docs/piano-sbrandizzazione.md) prevede pacchetti interi — quindi la
// risposta sta QUI e non in un `if` dentro ogni schermata: due interruttori
// sparsi diventano tre, poi cinque, e a quel punto per sapere cosa vede un
// locale bisogna leggersi mezza app. Aggiungere il prossimo modulo è una
// voce in questa tabella; il resto del codice non cambia.
//
// ── DUE DOMANDE, NON UNA ─────────────────────────────────────────────
// È la distinzione che una licenza fa per mestiere, e vale la pena averla
// nel modello fin da subito (l'utente, 26/08/2026: «dobbiamo riattivare lo
// scadenziario, ma lasciamolo sempre funzione premium: va abilitato lo
// switch e abilitata la funzione»).
//
//   INCLUSO  — la licenza dice cosa il locale HA comprato.
//   ACCESO   — l'impostazione dice se in questo momento lo USA.
//
// Un modulo è ATTIVO quando è incluso E acceso. Le due domande non si
// possono impastare in un flag solo: senza «incluso» non si distingue un
// locale che la funzione non ce l'ha da uno che ce l'ha e l'ha spenta —
// e sono due schermate diverse, una con l'interruttore bloccato e una con
// l'interruttore normale.
//
// COSA È INCLUSO lo dice la LICENZA, il documento `licenza/attuale` che
// scrive la regia (BUG-125); dal REQ-LIC-009 ce l'ha ogni installazione, la
// Tana compresa, e senza l'installazione non è attivata.
// Fino alla 1.10.x qui c'era anche una colonna `incluso`, la riserva di
// chi la licenza non ce l'aveva: era una licenza nascosta nel codice, che
// a un locale senza documento dava quasi tutto. Tolta con BUG-125 («nn va
// bene che senza licenza sia tutto acceso», l'utente, 31/10/2026).
//
// L'interruttore d'uso resta dov'è, perché quello è del locale e non della
// licenza: un locale che ha comprato lo scadenzario può comunque volerlo
// spento a gennaio.
//
// ⚠️ IL FLAG NASCONDE, NON PROTEGGE DA SOLO. La licenza non la riscrive più
// nessuno dall'app (le regole chiudono `licenza/`), ma chi apre la console
// del browser può sempre far mostrare all'app una sezione: il controllo
// vero sui dati sta nelle regole di Firestore, che leggono la licenza e
// rifiutano le scritture dei moduli non inclusi (REQ-LIC-008,
// COLLEZIONI_DEI_MODULI qui sotto).

// I MODULI, uno per riga. La chiave `id` è la stessa della sezione che il
// modulo accende (`conta`, `scadenzario` nel magazzino): così filtrare un
// elenco di sezioni è una riga sola e non una tabella di corrispondenze.
// Un modulo che accende ANCHE altre sezioni le elenca in `sezioni` (lo
// storico inventari sta con l'inventario, REQ-MAG-052): la corrispondenza
// vive qui, non nelle schermate.
// `chiave` è il nome del flag D'USO su settings/bar — scritto per esteso e
// non calcolato, perché è un nome che finisce su documenti veri e chi lo
// cerca nel codice lo deve trovare.
export const MODULI_PREMIUM = {
  // ── I MODULI DEL PRODOTTO (REQ-LIC-002, decisione dell'utente del
  // 22/10/2026): di base un locale crea le voci di menù e gestisce gli
  // ordini (coda, cassa, scontrino). Tutto il resto è un modulo, con lo
  // stesso id del listino della regia (piani.json).
  menu_tavoli: {
    chiave: 'modulo_menu_tavoli_enabled',
    sezioni: ['vista-cliente'],
    label: 'Menù digitale e tavoli',
    descrizione: 'Il menù sul telefono del cliente, con il QR al tavolo e la vista cliente nel gestionale.',
  },
  ordini_cliente: {
    chiave: 'modulo_ordini_cliente_enabled',
    label: 'Ordini dal telefono del cliente',
    descrizione: 'Il cliente ordina dal menù digitale e segue lo stato dell’ordine; senza, il menù si legge e basta.',
  },
  clienti: {
    chiave: 'modulo_clienti_enabled',
    label: 'Gestione clienti',
    descrizione: 'Account dei clienti, i loro ordini, i gruppi di conti.',
  },
  magazzino: {
    chiave: 'modulo_magazzino_enabled',
    sezioni: ['inventario', 'fornitori'],
    label: 'Magazzino e fornitori',
    descrizione: 'Giacenze, scarico automatico dalle ricette, ordini e fatture dei fornitori. Inventario e scadenzario sono i suoi moduli.',
  },
  statistiche: {
    chiave: 'modulo_statistiche_enabled',
    sezioni: ['stats', 'bilancio'],
    label: 'Statistiche e bilancio',
    descrizione: 'Incassi per serata e periodo, venduto per fascia oraria, bilancio per macro-categorie.',
  },
  staff: {
    chiave: 'modulo_staff_enabled',
    // `ore` è il vecchio indirizzo della stessa schermata (/bar?tab=ore):
    // senza questa riga la apriva anche chi il modulo non ce l'ha.
    sezioni: ['ore'],
    label: 'Personale e ore',
    descrizione: 'Ore e paghe del personale, chiamate allo staff.',
  },
  // `sumup` e non `pagamenti`: la cassa del gestionale ha già quella sezione.
  sumup: {
    chiave: 'modulo_sumup_enabled',
    label: 'Pagamenti con lettore SumUp',
    descrizione: 'Il conto va al lettore di carte e torna pagato da solo.',
  },
  conta: {
    chiave: 'modulo_conta_enabled',
    sezioni: ['storico'],
    label: 'Inventario di magazzino',
    descrizione:
      'Inventario periodico: si contano le rimanenze, l’app calcola il consumo del periodo e allinea le giacenze.',
  },
  fatture: {
    // Le fatture di cortesia al CLIENTE (collezione `invoices`), da non
    // confondere con lo scadenzario qui sotto, che è dei FORNITORI: sono
    // due mestieri opposti — soldi che entrano e soldi che escono — e
    // l'unica cosa che hanno in comune è la parola. Le etichette lo dicono
    // a schermo, perché stanno una sotto l'altra nelle impostazioni.
    chiave: 'modulo_fatture_enabled',
    label: 'Fatture ai clienti',
    descrizione:
      'Fattura di cortesia per il cliente che la chiede: dati di fatturazione, numero progressivo, stampa e invio per email.',
  },
  scadenzario: {
    // Riacceso il 26/08/2026 su richiesta dell'utente: la Tana lo usa
    // davvero. Resta una funzione premium, inclusa nella sua licenza.
    chiave: 'modulo_scadenzario_enabled',
    label: 'Fatture ai fornitori',
    descrizione:
      'Registro delle fatture di acquisto con importi, scadenze e stato dei pagamenti.',
  },
}

// ── LE COLLEZIONI DI OGNI MODULO (REQ-LIC-008) ─────────────────────────
// Dove le regole del database (firestore.rules) rifiutano le SCRITTURE di
// chi la licenza non ce l'ha: una collezione passa se la licenza include
// almeno uno dei moduli elencati. Un test (tests/unit/regoleLicenza.test.js)
// controlla che le regole dicano la stessa cosa di questa tabella.
// Ci sono solo le collezioni che l'app scrive SOLTANTO dalle schermate del
// modulo. Restano fuori, apposta:
//   - le timbrature (staff_shifts) e il cerca-persone (staff_calls): si
//     scrivono a ogni accesso del personale e dalla coda, anche senza il
//     modulo del personale;
//   - i gruppi (groups): li governa l'impostazione dei gruppi, non i clienti;
//   - gli ordini: lì contano gli sconti e gli ordini dal telefono, e le
//     regole lo dicono a parte.
// Le fatture dei fornitori hanno due moduli: lo scadenzario, e il magazzino,
// perché la lista degli ordini ai fornitori le genera e le segna pagate.
// Dei clienti si controlla solo la nascita del profilo: modificarlo e
// cancellarlo restano del cliente, che ha diritto di andarsene.
export const COLLEZIONI_DEI_MODULI = Object.freeze({
  inventory_items: ['magazzino'],
  inventory_categories: ['magazzino'],
  suppliers: ['magazzino'],
  supplier_prices: ['magazzino'],
  supplier_price_history: ['magazzino'],
  stock_movements: ['magazzino'],
  purchase_orders: ['magazzino'],
  purchase_order_templates: ['magazzino'],
  altre_spese: ['magazzino'],
  stock_counts: ['conta'],
  supplier_invoices: ['scadenzario', 'magazzino'],
  invoices: ['fatture'],
  staff_hours: ['staff'],
  staff_rates: ['staff'],
  minimi_extra: ['statistiche'],
  customers: ['clienti'],
})

// Questa collezione si può scrivere, con questa licenza? Le collezioni che
// non sono di un modulo sempre; senza nessuna licenza nota anche (decidono
// le regole, che senza documento non limitano).
export function scritturaConsentita(stato, collezione) {
  const moduli = COLLEZIONI_DEI_MODULI[collezione]
  return !moduli || !licenzaDi(stato) || moduli.some((id) => moduloIncluso(stato, id))
}

// Quello che si legge al tocco dell'interruttore di un modulo NON INCLUSO.
// Dice il perché senza promettere niente: l'inclusione è una faccenda della
// licenza dell'installazione, non di questa schermata.
export const MOTIVO_PREMIUM =
  'Funzione premium: fa parte della licenza dell’installazione e non si attiva da questa schermata.'

// L'elenco dei moduli come lo mostra un pannello: id davanti, il resto
// dietro, nell'ordine in cui sono scritti qui sopra.
export const moduliPremium = () =>
  Object.entries(MODULI_PREMIUM).map(([id, m]) => ({ id, ...m }))

// Il flag su settings/bar che accende un modulo, per chi va a guardare (o a
// scrivere) il documento del locale. Null se l'id non è di un modulo.
export const chiaveModulo = (id) => MODULI_PREMIUM[id]?.chiave ?? null

// Questo id è una funzione premium? Serve dove si filtra un elenco misto:
// una voce che non è premium non ha una licenza da controllare.
// Il modulo che accende una sezione: se stesso, o quello che la elenca
// fra le sue `sezioni`.
export function moduloDiSezione(id) {
  if (Object.hasOwn(MODULI_PREMIUM, id)) return id
  const trovato = Object.entries(MODULI_PREMIUM).find(([, m]) => m.sezioni?.includes(id))
  return trovato ? trovato[0] : id
}

export const ePremium = (id) => Object.hasOwn(MODULI_PREMIUM, moduloDiSezione(id))

// PRIMA DOMANDA: il locale ce l'ha? Lo dice la licenza, anche per quello
// che non nomina: un modulo che `licenza.moduli` non elenca non è incluso.
// Un id sconosciuto non è incluso: una funzione a pagamento non si regala
// per una svista di chi chiama. (Fino a BUG-125 il silenzio ricadeva sulla
// colonna `incluso`, che regalava i moduli: non c'è più.)
export function moduloIncluso(stato, id) {
  if (!Object.hasOwn(MODULI_PREMIUM, id)) return false
  // Il piano Free (REQ-LIC-003) non ha bisogno di un ramo suo: la regia
  // scrive i suoi moduli tutti spenti, e uno in prova lo accende qui.
  return licenzaDi(stato)?.moduli?.[id] === true
}

// SECONDA DOMANDA: il locale lo sta usando? È l'interruttore delle
// impostazioni, e vale solo per quello che è incluso.
//
// Acceso di suo, con l'idioma di `workflow_enabled`: quello che il locale
// ha comprato funziona senza che nessuno debba accenderlo, e si spegne solo
// se qualcuno lo spegne davvero. La sicurezza («di partenza spento») sta
// tutta nella prima domanda, che è quella che non si può sbagliare.
export function moduloAcceso(stato, id) {
  const modulo = MODULI_PREMIUM[id]
  if (!modulo) return false
  return stato?.[modulo.chiave] !== false
}

// LA DOMANDA CHE FANNO LE SCHERMATE: questa funzione lavora, qui e adesso?
// `stato` sono le impostazioni del bar già in mano a chi chiama
// (settings/bar, dalla cache: nessuna lettura nuova, vedi CLAUDE.md sul
// local-first).
export const moduloAttivo = (stato, id) => moduloIncluso(stato, id) && moduloAcceso(stato, id)

// ── QUALE LICENZA VALE (BUG-125) ──────────────────────────────────────
// Fino alla 1.10.x la licenza stava in `settings/bar.licenza`, che ogni
// bartender può riscrivere: con un account del banco e la console del
// browser un locale Free si toglieva i limiti. Ora sta nel documento
// `licenza/attuale`, che le regole fanno leggere a tutti e scrivere a
// nessuno (la regia lo scrive con le credenziali di servizio), e
// `settings/bar.licenza` non si guarda più: un ripiego lì riaprirebbe il
// buco.
//
// UNA REGOLA SOLA, uguale per ogni installazione: c'è il documento → vale
// quello; non c'è → l'installazione non è attivata. Fino al 02/11/2026 in
// mezzo c'era la licenza scritta nella BUILD, per la Tana; con REQ-LIC-009
// anche la Tana ha il suo documento, e senza le regole non fanno scrivere
// niente: un'app che lavorasse lo stesso perderebbe ogni scrittura.
//
// «NON C'È» LO DICE SOLO IL SERVER. Alla prima apertura senza rete la cache
// non sa ancora niente, e scambiare «non lo so» per «non c'è» fermerebbe un
// locale in regola. Per questo `letto` porta `certo`: falso finché la
// risposta viene dalla cache. Finché non si sa si torna null, e l'app non
// si ferma (chi chiama tiene l'ultima licenza nota, impostazioniLocali.js).
//
// `letto` è { documento, certo }: il documento della regia (o null) e se
// l'assenza è confermata dal server. Logica pura: la lettura è in api.js.
export function licenzaEffettiva(letto) {
  const documento = letto?.documento
  if (documento && typeof documento === 'object') return documento
  return letto?.certo ? { stato: STATI_LICENZA.NON_ATTIVATA } : null
}

// ── LO STATO DELL'INSTALLAZIONE (REQ-FLOTTA-008) ──────────────────────
// `licenza.stato`: lo scrive la regia (il backoffice, o la Function che
// sospende chi non paga). Senza niente scritto è attiva. Sospesa, chiusa o
// non attivata, l'app mostra InstallazioneSospesa al posto di tutto; i dati
// restano. `non_attivata` non lo scrive la regia: è quello che dice
// licenzaEffettiva quando una licenza non c'è. E `scaduta` nemmeno: è
// quello che dice licenzaInVigore passata `valida_fino`, quando la licenza
// non scade verso il Free (REQ-LIC-009).
export const STATI_LICENZA = Object.freeze({
  ATTIVA: 'attiva',
  SOSPESA: 'sospesa',
  CHIUSA: 'chiusa',
  NON_ATTIVATA: 'non_attivata',
  SCADUTA,
})

const BLOCCANTI = [STATI_LICENZA.SOSPESA, STATI_LICENZA.CHIUSA, STATI_LICENZA.NON_ATTIVATA, STATI_LICENZA.SCADUTA]

export const statoLicenza = (stato) => {
  const s = licenzaDi(stato)?.stato
  return BLOCCANTI.includes(s) ? s : STATI_LICENZA.ATTIVA
}

export const installazioneBloccata = (stato) => statoLicenza(stato) !== STATI_LICENZA.ATTIVA

// ── LE DOMANDE CHE FANNO LE SCHERMATE LATO CLIENTE (REQ-LIC-002) ───────
// Il menù digitale c'è? Il cliente può ordinare da lì? Ha un account?
export const menuDigitaleAttivo = (stato) => moduloAttivo(stato, 'menu_tavoli')
export const ordinazioneClientiAttiva = (stato) => moduloAttivo(stato, 'ordini_cliente')
// Gli account clienti: il modulo, E l'interruttore che il locale aveva già
// (customer_accounts_enabled).
export const accountClientiAttivi = (stato) => moduloAttivo(stato, 'clienti') && stato?.customer_accounts_enabled !== false

// IL LETTORE SUMUP IN CASSA (REQ-LIC-004). Senza Functions non c'è chi
// parla coi server di SumUp: sul profilo leggero il metodo non compare e il
// conto si chiude a mano. Guarda se il modulo è INCLUSO, non l'interruttore
// d'uso.
export const sumupDisponibile = (stato) => !profiloLeggero(stato) && moduloIncluso(stato, 'sumup')

// IL MODULO IN PROVA (REQ-FLOTTA-016 della regia): `licenza.prove` dice fino
// a quando, `{ magazzino: '2026-11-13T10:00:00.000Z' }`. In prova il modulo
// è acceso in `licenza.moduli` come uno comprato; questa è solo la data da
// mostrare. Null se non è in prova o la data non si legge.
export function scadenzaProva(stato, id) {
  const quando = licenzaDi(stato)?.prove?.[id]
  if (!quando) return null
  const d = new Date(quando)
  return Number.isNaN(d.getTime()) ? null : d
}

// ── LA LICENZA IN CHIARO (REQ-LIC-007) ─────────────────────────────────
// Quello che la sottosezione Licenza mostra al titolare, in sola lettura.
// Vale per OGNI licenza: le voci che una licenza non porta (quella della
// Tana, scritta a mano, non ha piano né scadenza) restano null, e la
// schermata non le mostra.
//
// `validita` legge `valida_fino` (data ISO; assente o null = senza
// scadenza). La scadenza la fa rispettare la regia, sospendendo: qui si
// mostra soltanto, e una data passata con la licenza ancora attiva si dice
// «scaduta» senza fermare il locale. Una data illeggibile non diventa
// «senza scadenza»: non si mostra.
export function riepilogoLicenza(stato, adesso = new Date()) {
  const licenza = licenzaDi(stato, adesso)
  if (!licenza || typeof licenza !== 'object') return null
  const moduli = moduliPremium().map((m) => ({
    id: m.id,
    label: m.label,
    incluso: moduloIncluso(stato, m.id),
    prova: scadenzaProva(stato, m.id),
  }))
  return {
    piano: typeof licenza.piano === 'string' && licenza.piano.trim() ? licenza.piano.trim() : null,
    stato: statoLicenza(stato),
    validita: validitaDi(licenza.valida_fino, adesso),
    inclusi: moduli.filter((m) => m.incluso),
    esclusi: moduli.filter((m) => !m.incluso),
    limiti: limitiInChiaro(stato),
    // Gli stili del menù che la licenza dà (REQ-LIC-010), col loro nome.
    temi: temiInLicenza(stato).map((id) => STILI_MENU.find((s) => s.id === id)?.nome || id),
    gestione: urlRegia(stato),
  }
}

function validitaDi(validaFino, adesso) {
  if (validaFino === undefined || validaFino === null || validaFino === '') return { tipo: 'senza' }
  const data = new Date(validaFino)
  if (Number.isNaN(data.getTime())) return null
  return { tipo: data < adesso ? 'scaduta' : 'fino', data }
}

// ── LA CANCELLAZIONE DEI DATI PROGRAMMATA (REQ-LIC-009) ────────────────
// La scrive la regia nella licenza, `cancellazione: { il, richiedente }`:
//   · 'conservazione' — il locale è fermo per il pagamento: i dati restano
//     fino a `il` (90 giorni), e riattivare l'abbonamento la annulla;
//   · 'titolare' — l'ha chiesta il titolare dall'area clienti, che la può
//     annullare lì;
//   · 'admin' — l'ha decisa il fornitore.
// L'utente, 02/11/2026: «dobbiamo cancellare i suoi dati entro un tot e
// avvisarlo quando stiamo per cancellarli». Si mostra sempre, sopra a
// tutto, anche sul locale fermo. Null se non c'è, o se la data non si
// legge: un avviso con una data sbagliata farebbe più danno di nessuno.
const RICHIEDENTI = ['conservazione', 'titolare', 'admin']

export function cancellazioneProgrammata(stato) {
  const c = licenzaDi(stato)?.cancellazione
  if (!c || typeof c !== 'object') return null
  const il = new Date(c.il)
  if (!c.il || Number.isNaN(il.getTime())) return null
  return { il, richiedente: RICHIEDENTI.includes(c.richiedente) ? c.richiedente : 'admin' }
}

// Una voce di un elenco (sezioni del magazzino, domani le voci del
// gestionale) si può mostrare? È la riga che serve a chi filtra: le voci
// che non sono premium passano sempre.
export const voceVisibile = (stato, id) => !ePremium(id) || moduloAttivo(stato, moduloDiSezione(id))

// ── LA LICENZA RIMASTA IN settings/bar NON LA RISCRIVE NESSUNO (BUG-126) ──
// Finché tutti i locali non hanno l'app che legge solo `licenza/attuale`
// (BUG-125, passo 3), la regia continua a scrivere la licenza anche in
// `settings/bar.licenza`: è il posto dove la cercano le versioni vecchie,
// e quel contratto non si cambia. Le regole ora non fanno toccare quel
// campo a nessuno dall'app (firestore.rules, licenzaIntatta). Il
// ripristino da un backup però riscrive i documenti INTERI, e un backup
// porta la licenza di quando è stato fatto: rimetterla vorrebbe dire
// tornare a un piano scaduto, togliersi una sospensione, o — con le regole
// nuove — vedersi rifiutare tutto il lotto.
//
// Quindi un documento che si rimette prende la licenza che c'è ADESSO nel
// database, e quella del file si butta. Se adesso non ce n'è, non ce ne
// sarà. Vale per i dati dell'app e per i campi nel formato nativo di
// Firestore degli script (scripts/ripristina-db.js): si guarda solo la
// chiave `licenza` in cima, e il valore attuale si copia così com'è, senza
// convertirlo — deve risultare IDENTICO, se no le regole lo leggono come
// un cambio.
export const CAMPO_LICENZA = 'licenza'

export function conLicenzaAttuale(dati, attuali) {
  const { [CAMPO_LICENZA]: _dalBackup, ...resto } = dati || {}
  return attuali && Object.hasOwn(attuali, CAMPO_LICENZA)
    ? { ...resto, [CAMPO_LICENZA]: attuali[CAMPO_LICENZA] }
    : resto
}

// La collezione della licenza vera (BUG-125). Nessun ripristino la tocca:
// la scrive solo la regia, e un backup ne porta una vecchia.
export const COLLEZIONE_LICENZA = 'licenza'
