// Wrapper attorno all'Epson ePOS SDK per JavaScript.
// Il file epos-2.27.0.js deve essere in public/ e caricato via <script> in
// index.html (è una libreria legacy non-ESM che usa window.epson).
//
// Connettività: la stampante deve essere sulla stessa LAN del dispositivo.
// Poiché l'app è servita in HTTPS, il browser richiede WSS (WebSocket sicuro):
//   1. Apri l'interfaccia web della stampante (http://<IP>)
//   2. Abilita SSL/TLS nelle impostazioni di rete
//   3. Dal browser dell'iPad: vai su https://<IP>:8043 e accetta il certificato
//   4. Da quel momento la connessione WSS funziona senza dialoghi

import { CASH_METHOD_ORDER, cashMethodKeys, PAYMENT_METHOD_PRINT } from './orderStatus.js'
import { stampanteFintaAttiva, creaStampanteFinta } from './stampanteFinta.js'
import { aggregateItems } from './comande.js'

// Larghezza colonne stamante 80 mm (TM-m30II / TM-m30III): 48 chars std.
const COL = 48

// ── Impostazioni persistite in localStorage ───────────────────────────────────

// LE IMPOSTAZIONI DELLA STAMPANTE SONO DEL DISPOSITIVO **E** DI CHI CI
// LAVORA. Del dispositivo, perché l'indirizzo della stampante dipende da
// dove sei: il tablet del banco la raggiunge, il telefono della sala forse
// no. Di chi ci lavora, perché sullo stesso tablet si alternano persone
// diverse, e la stampa automatica delle comande la vuole accesa chi sta al
// banco, non chi passa di lì a battere due conti.
const SETTINGS_KEY = 'tana_printer_v2'
const UTENTE_KEY = 'tana_printer_utente'

// L'ultimo utente lo si ricorda: le impostazioni si leggono anche prima che
// Firebase abbia finito di riconoscere chi è collegato, e senza memoria per
// un istante si leggerebbe la scheda di un altro — «nessuna stampante
// impostata» che compare e sparisce.
let _utente = null
try {
  _utente = localStorage.getItem(UTENTE_KEY) || null
} catch {
  /* storage negato: si lavora senza memoria, come prima */
}

export function impostaUtenteStampante(uid) {
  _utente = uid || null
  try {
    if (uid) localStorage.setItem(UTENTE_KEY, uid)
    else localStorage.removeItem(UTENTE_KEY)
  } catch {
    /* niente memoria: le impostazioni restano quelle del dispositivo */
  }
}

const chiaveImpostazioni = () => (_utente ? `${SETTINGS_KEY}:${_utente}` : SETTINGS_KEY)

export const DEFAULT_PRINTER_SETTINGS = {
  ip: '',
  port: 8043,       // 8043 = HTTPS (WSS), 8008 = HTTP (WS)
  https: true,      // false → HTTP, solo se l'app è servita in HTTP
  ivaRate: 10,      // aliquota IVA applicata sullo scontrino
  autoPrintComanda: false,  // stampa automatica comanda all'arrivo dell'ordine
  autoPrintScontrino: false, // stampa automatica scontrino al "pronto"
  // CHI STAMPA LE COMANDE PRESE IN SALA: 'ip' = il telefono della sala parla
  // da sé con la stampante (ha l'IP: la configurazione arriva dal server);
  // 'rimbalzo' = la sala non stampa e la comanda esce al banco, che deve
  // avere la coda aperta e la stampa automatica accesa. Lo decide il locale,
  // una volta, dal terminale del banco.
  stampaSala: 'ip',
  businessName: 'La Tana del Coniglio',
  businessAddress: 'Corso Tommaso Vitale 87/89',
  businessCity: '80035 Nola - Italy',
  businessFooter: 'EFFEVI - SRLS',
}

// Scontrino automatico UNA SOLA VOLTA per conto: la chiusura può passare da
// più strade (schermata pagamento, coda, incasso di gruppo) e senza questa
// guardia lo stesso scontrino uscirebbe due volte.
const PRINTED_KEY = 'tana_printed_receipts'
export function claimReceiptPrint(orderId) {
  if (!orderId) return true
  try {
    const list = JSON.parse(localStorage.getItem(PRINTED_KEY) || '[]')
    if (list.includes(orderId)) return false
    localStorage.setItem(PRINTED_KEY, JSON.stringify([...list, orderId].slice(-300)))
    return true
  } catch {
    return true // storage non disponibile: meglio stampare che non stampare
  }
}

// LA PRENOTAZIONE SI RESTITUISCE SE LA CARTA NON È USCITA (BUG-047).
// `claimReceiptPrint` segna il conto PRIMA di stampare — deve, se no due
// schermate stampano la stessa cosa — ma se poi la stampa non riesce quel
// segno restava lì per sempre: quel conto non stampava più lo scontrino
// automatico nemmeno riaperto e richiuso, e chi stava al banco non aveva modo
// di capire perché. Si chiama quando la stampa fallisce e quando un conto
// torna aperto: da lì in poi la prossima chiusura ristampa.
export function releaseReceiptPrint(orderId) {
  if (!orderId) return
  try {
    const list = JSON.parse(localStorage.getItem(PRINTED_KEY) || '[]')
    localStorage.setItem(PRINTED_KEY, JSON.stringify(list.filter((id) => id !== orderId)))
  } catch {
    /* niente memoria: la guardia non c'è e si stampa comunque */
  }
}

// LO SCONTRINO DI CHIUSURA È GIÀ USCITO PER QUESTO CONTO? Il segno sta SUL
// DATO (`receipt_print_at` sull'ordine), esattamente come per le comande
// (`auto_print_at`, BUG-050). La pretesa qui sopra vive in localStorage e
// para solo i doppioni di QUESTO terminale: un browser nuovo, o una memoria
// svuotata, di pretese non ne ha nessuna — e vedeva i conti pagati della
// serata come conti da stampare. Il segno sul dato lo sanno tutti.
export function scontrinoGiaUscito(order) {
  return !!order?.receipt_print_at
}

// L'INCASSO È UNA CHIUSURA NUOVA, sempre: chi sta incassando adesso deve
// avere lo scontrino di adesso, anche se per questo conto ne era già
// uscito uno prima di una riapertura. «Se riapro il conto e cambio
// qualcosa e riscuoto di nuovo, deve ristampare il nuovo conto. Non ha
// senso che stampi solo una volta» (l'utente, 19/08). Si restituisce la
// pretesa vecchia e si prende quella nuova in un colpo: la coda, che
// vedrà il conto pagato fra un istante, troverà la pretesa già presa e
// non farà la seconda copia.
export function reclaimReceiptPrint(orderId) {
  releaseReceiptPrint(orderId)
  return claimReceiptPrint(orderId)
}

// ── L'AUTO-STAMPA DELLE COMANDE ──────────────────────────────────────
//
// LA STAMPA NON È UN AVVISO. Per anni ha vissuto dentro il blocco della
// notifica «nuovo ordine», e ne ereditava i filtri: «non avvisare chi l'ha
// battuto» è sacrosanto per un beep — lo sai già, l'hai appena fatto tu —
// ma la stampante non è una persona: la comanda serve al banco comunque,
// anche per l'ordine battuto da questo stesso terminale. E dentro quel
// blocco stampava solo l'ordine NUOVO: la seconda comanda aggiunta a un
// conto esistente non usciva mai.
//
// Qui la stampa ha la sua regola, per COMANDA e non per ordine, con la
// stessa pretesa in localStorage degli scontrini: ogni comanda esce UNA
// volta da questo terminale, chiunque l'abbia battuta, da qualunque vista.
const COMANDE_KEY = 'tana_printed_comande'
export function claimComandaPrint(orderId, comandaId) {
  if (!orderId || !comandaId) return false
  const chiave = `${orderId}:${comandaId}`
  try {
    const list = JSON.parse(localStorage.getItem(COMANDE_KEY) || '[]')
    if (list.includes(chiave)) return false
    localStorage.setItem(COMANDE_KEY, JSON.stringify([...list, chiave].slice(-500)))
    return true
  } catch {
    return true // niente memoria: meglio una copia doppia che nessuna
  }
}

// La stampa non è riuscita: la pretesa locale torna libera, così il
// prossimo snapshot ci riprova — carta finita, stampante spenta, si
// sistema e la comanda esce da sola.
export function releaseComandaPrint(orderId, comandaId) {
  if (!orderId || !comandaId) return
  const chiave = `${orderId}:${comandaId}`
  try {
    const list = JSON.parse(localStorage.getItem(COMANDE_KEY) || '[]')
    localStorage.setItem(COMANDE_KEY, JSON.stringify(list.filter((k) => k !== chiave)))
  } catch {
    /* niente memoria: la pretesa non c'era comunque */
  }
}

// QUALI COMANDE DI UN CONTO VANNO STAMPATE ADESSO. Pura, così si prova
// senza rete e senza schermata.
//
// IL SEGNO «STAMPATA» STA SUL DATO (`auto_print_at` sulla comanda), non
// solo nella memoria del terminale: così un browser nuovo non ristampa la
// serata (vede i segni), e due tablet con l'interruttore acceso non fanno
// due copie — il secondo vede il segno del primo. C'era una finestra di
// dieci minuti al posto del segno, ed era un ripiego: «semplicemente non
// puoi segnare le comande stampate già?» (l'utente, 20/08). Sì.
// La pretesa locale (claimComandaPrint) resta come primo filtro: para i
// propri snapshot che arrivano prima che la scrittura del segno torni.
export function comandeDaStampare(order) {
  if (!order || order.status === 'annullato') return []
  return (order.comande || []).filter((c) => {
    if (!c || c.status === 'annullato') return false
    // Da stampare è la comanda ancora al banco: già pronta o uscita vuol
    // dire che qualcuno l'ha lavorata senza carta, e stamparla ora è tardi.
    if (c.status !== 'ricevuto' && c.status !== 'in_preparazione') return false
    return !c.auto_print_at
  })
}

// La sala stampa da sé? Una domanda sola, in un posto solo: la fanno la
// schermata che prende l'ordine e il pallino che dice se si stamperà.
export function salaStampaDaSe(s = loadPrinterSettings()) {
  return s.stampaSala !== 'rimbalzo'
}

export function loadPrinterSettings() {
  try {
    const mie = JSON.parse(localStorage.getItem(chiaveImpostazioni()) || 'null')
    if (mie) return { ...DEFAULT_PRINTER_SETTINGS, ...mie }
    // PRIMA VOLTA DI QUESTA PERSONA SU QUESTO DISPOSITIVO: eredita quelle
    // del dispositivo. Senza, il giorno del passaggio a impostazioni per
    // utente ogni tablet del locale avrebbe perso l'indirizzo della
    // stampante — e la comanda non esce.
    const delDispositivo = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null')
    return { ...DEFAULT_PRINTER_SETTINGS, ...(delDispositivo || {}) }
  } catch {
    return { ...DEFAULT_PRINTER_SETTINGS }
  }
}

export function savePrinterSettings(patch) {
  const current = loadPrinterSettings()
  const next = { ...current, ...patch }
  try {
    localStorage.setItem(chiaveImpostazioni(), JSON.stringify(next))
  } catch {
    /* storage pieno o negato: si continua con quelle in memoria */
  }
  return next
}

// ── Connessione ───────────────────────────────────────────────────────────────

let _device = null   // ePOSDevice instance
let _printer = null  // printer object restituito da createDevice
let _connectPromise = null

function sdkAvailable() {
  return typeof window !== 'undefined' && typeof window.epson?.ePOSDevice === 'function'
}

// Termina la connessione corrente (se attiva).
export function disconnectPrinter() {
  fermaBattito()
  try { _device?.disconnect() } catch { /* ignora */ }
  _device = null
  _printer = null
  _connectPromise = null
}

// ── CONNESSIONE TENUTA VIVA ───────────────────────────────────────────────
//
// Il certificato della stampante è auto-firmato: il browser lo accetta solo
// dopo che qualcuno è andato a mano su https://IP:8043 e ha detto sì, e
// quell'eccezione NON è per sempre — iPadOS la lascia cadere al riavvio, e
// l'app installata sulla home ha un suo spazio separato da Safari. Ogni volta
// che l'eccezione cade, la PRIMA stampa fallisce: cioè in servizio, con il
// cliente davanti.
//
// L'eccezione serve però solo alla STRETTA DI MANO. Finché il collegamento
// resta aperto non si ricontratta niente. Quindi lo si tiene vivo: un
// controllo ogni mezzo minuto e una riconnessione appena l'app torna in primo
// piano. Così la stretta di mano avviene una volta a inizio serata invece che
// a ogni scontrino — e se il certificato è caduto lo si scopre allora, non
// davanti al cliente.
//
// La soluzione DEFINITIVA non è codice: è installare il certificato della
// stampante come attendibile sul dispositivo (vedi la guida in Impostazioni →
// Stampante). Questo qui riduce i danni, non li elimina.
let _battito = null

function fermaBattito() {
  clearInterval(_battito)
  _battito = null
}

function avviaBattito() {
  fermaBattito()
  _battito = setInterval(() => {
    try {
      if (_device && !_device.isConnected()) {
        // Caduta: si libera tutto, la prossima stampa riconnette.
        _printer = null
        _device = null
        _connectPromise = null
      }
    } catch {
      /* SDK in uno stato strano: si lascia stare */
    }
  }, 30000)
}

// SCALDA LA CONNESSIONE: da chiamare quando si apre il gestionale o la cassa.
// Se il certificato non è più accettato, l'errore esce ADESSO — quando c'è
// tempo per sistemarlo — invece che al primo scontrino della serata.
export async function preparaStampante() {
  // Con la stampante finta non c'è niente da scaldare: risponde sempre.
  if (stampanteFintaAttiva()) return { ok: true }
  const s = loadPrinterSettings()
  if (!s.ip) return { ok: false, motivo: 'non configurata' }
  try {
    await getPrinter()
    return { ok: true }
  } catch (e) {
    return { ok: false, motivo: e.message }
  }
}

// Ritorno in primo piano (l'iPad si blocca fra un giro di tavoli e l'altro):
// si ricontrolla subito, così una caduta si scopre appena si riprende in mano
// il tablet e non alla prima comanda.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return
    if (!loadPrinterSettings().ip) return
    try {
      if (_device && !_device.isConnected()) {
        _printer = null
        _device = null
        _connectPromise = null
      }
    } catch {
      /* niente da fare */
    }
  })
}

// Restituisce il printer object, connettendosi se necessario.
// Riusa la connessione esistente tra stampe consecutive.
async function getPrinter() {
  // IN LOCALE LA STAMPANTE È DI CARTA FINTA. Da un computer di sviluppo
  // l'apparecchio del bar non si raggiunge, e ogni modifica a comande e
  // scontrini si provava a occhio. Sull'ambiente di TEST no: lì ci si
  // collega a quella vera, ed è il posto dove provarla davvero.
  if (stampanteFintaAttiva()) {
    if (!_printer) _printer = creaStampanteFinta('La Tana del Coniglio')
    return _printer
  }
  if (_printer) return _printer
  if (_connectPromise) return _connectPromise

  if (!sdkAvailable()) {
    throw new Error(
      'ePOS SDK non caricato. Scarica epos-2.27.0.js da Epson e mettilo in public/.'
    )
  }

  const s = loadPrinterSettings()
  if (!s.ip) throw new Error("Imposta l'IP della stampante nelle impostazioni.")

  // L'SDK sceglie il protocollo SOLO dalla porta: 8008 → ws (non sicuro),
  // qualunque altra → wss. Una pagina servita in HTTPS non può aprire un
  // WebSocket in chiaro: il browser lo blocca e l'SDK va in timeout dopo
  // ~10 s senza dire perché. Meglio fermarsi subito, spiegando cosa fare.
  const paginaSicura = typeof location !== 'undefined' && location.protocol === 'https:'
  if (paginaSicura && Number(s.port) === 8008) {
    throw new Error(
      "L'app è in HTTPS: la porta 8008 (non sicura) viene bloccata dal browser. " +
        'Usa la porta 8043 con SSL/TLS abilitato sulla stampante.'
    )
  }

  _connectPromise = new Promise((resolve, reject) => {
    const dev = new window.epson.ePOSDevice()
    _device = dev

    dev.connect(s.ip, s.port, (status) => {
      if (status !== 'OK' && status !== 'SSL_CONNECT_OK') {
        _device = null
        _connectPromise = null
        reject(new Error(`Connessione fallita (${status}). Controlla IP e che la stampante sia accesa.`))
        return
      }

      dev.createDevice(
        'local_printer',
        dev.DEVICE_TYPE_PRINTER,
        { crypto: s.https, buffer: false },
        (devobj, retcode) => {
          _connectPromise = null
          if (retcode !== 'OK') {
            _device = null
            reject(new Error(`Errore inizializzazione stampante: ${retcode}`))
            return
          }
          _printer = devobj
          avviaBattito()

          // Pulisce la connessione alla disconnessione così al prossimo
          // invio si riconnette in automatico.
          _printer.ondisconnect = () => {
            _printer = null
            _device = null
            fermaBattito()
          }

          _printer.onreceive = (res) => {
            if (!res.success) {
              console.warn('[printer] risposta di errore:', res)
            }
          }

          resolve(_printer)
        }
      )
    })
  })

  return _connectPromise
}

// ── Utility di formattazione ──────────────────────────────────────────────────

// Riga testo-sinistra + testo-destra allineato col padding spazi.
function row(left, right, width = COL) {
  const avail = width - right.length
  const l = left.substring(0, avail - 1).padEnd(avail)
  return l + right + '\n'
}

function line(char = '-', width = COL) {
  return char.repeat(width) + '\n'
}

function italianDateTime(iso) {
  const d = new Date(iso || Date.now())
  const date = d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' })
  const time = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  return { date, time }
}

// ── UN LAVORO PER VOLTA, E MAI I RESTI DI QUELLO PRIMA (BUG-052) ─────
//
// LA STAMPANTE HA UN BUILDER SOLO. `getPrinter()` restituisce sempre lo
// stesso oggetto — la connessione si tiene viva fra una stampa e l'altra,
// ed è giusto così — ma quell'oggetto ACCUMULA i comandi e li spedisce
// tutti insieme a `send()`. Chi ci scrive dentro sta scrivendo in un posto
// condiviso, e finché non chiama `send()` quel posto è suo.
//
// DUE MODI DI ROVINARE LA CARTA, tutti e due visti:
//
// 1. UNA STAMPA CHE SI FERMA A METÀ. Se fra il primo comando e `send()`
//    salta un'eccezione — una riga senza nome, un dato storto — i pezzi già
//    scritti RESTANO nel builder. Il lavoro dopo ci scrive sopra e se li
//    porta via: è uscita una comanda con dentro DUE ordini diversi, due
//    intestazioni e due numeri, e al banco è un ticket da buttare. Peggio
//    ancora perché l'auto-stampa RIPROVA (releaseComandaPrint), quindi il
//    residuo si accumula a ogni giro.
// 2. DUE STAMPE CHE SI ACCAVALLANO. Ogni print* comincia con un `await`
//    (getPrinter), e `printScontrino` ne ha un altro DENTRO, sul logo:
//    se due lavori partono nello stesso giro — e partono, la coda ordini
//    stampa comande e scontrini di più conti nello stesso snapshot — il
//    secondo scrive nel builder mentre il primo è sospeso.
//
// LA CURA STA QUI E NON NEI CHIAMANTI. Sistemare il `for` dell'auto-stampa
// avrebbe lasciato la porta aperta a tutti gli altri (il tasto della coda,
// quello del conto, la sala, il fornitore): ogni lavoro passa da questa
// coda, aspetta chi lo precede, parte da un builder PULITO e lo lascia
// pulito anche quando fallisce. Nessun chiamante può più intrecciarsi,
// nemmeno uno scritto domani.
let _codaStampa = Promise.resolve()

function lavoroDiStampa(componi) {
  const mio = _codaStampa.then(async () => {
    const prn = await getPrinter()
    // Si parte puliti: se chi c'era prima si è fermato a metà, i suoi pezzi
    // non finiscono sulla nostra carta.
    prn.clearCommandBuffer?.()
    try {
      await componi(prn)
      prn.send()
    } catch (e) {
      // E non si lasciano resti a chi viene dopo.
      prn.clearCommandBuffer?.()
      throw e
    }
  })
  // La catena non si spezza su un errore: la stampa dopo deve partire
  // comunque — carta finita adesso non vuol dire stampante morta.
  _codaStampa = mio.catch(() => {})
  return mio
}

// ── COMANDA ───────────────────────────────────────────────────────────────────
// Ticket per il barista: numero ordine grande, articoli senza prezzi.
// Formato ispirato al template fotografato (sfondo nero, orario, sezione BAR).

// ── UN TICKET È UNA COMANDA SOLA (BUG-051) ──────────────────────────
//
// Chi chiama la stampa dice QUALE comanda: se non lo dice, qui c'era il
// ripiego `order.order_items`, cioè l'AGGREGATO del conto — le righe di
// tutte le comande fuse in una, con le quantità sommate. Su un conto con
// due comande usciva un ticket solo che sembrava una comanda e ne
// conteneva due, e dal facsimile non si vedeva nemmeno: la comanda non
// porta scritto il suo numero. Il chiamante che ci arrivava davvero è il
// tasto «Comanda» della coda, che cerca la comanda ATTIVA: appena non ce
// n'è più una aperta (tutto servito, o il conto pagato) la ricerca non
// trova niente e si stampava l'intero conto.
//
// La scelta sta qui e non nei cinque chiamanti: senza comanda si stampa
// l'ULTIMA del conto — quella che si vuole ristampare quando si chiede
// «la comanda» senza dire quale. L'aggregato resta solo per un ordine che
// di comande non ne ha (i doc vecchi, e un conto appena nato in locale).
export function comandaDelTicket(order, comanda = null) {
  if (comanda) return comanda
  const aperte = (order?.comande || []).filter((c) => c && c.status !== 'annullato')
  return aperte.at(-1) || null
}

// `comanda` opzionale: stampa i soli item di quella comanda (aggiunte a un
// conto aperto). Senza, la sceglie comandaDelTicket — e mai due insieme.
export function printComanda(order, comanda = null) {
  return lavoroDiStampa(async (prn) => {
    const now = new Date()
    const hhmm = now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
    const ticketItems = comandaDelTicket(order, comanda)?.items ?? order.order_items ?? []
    const totalQty = ticketItems.reduce((s, i) => s + (i.qty || 1), 0)

    prn.addTextLang('it')
    prn.addTextSmooth(true)

    // ── Header nero: "DIRETTO  22:09" ──
    prn.addTextAlign(prn.ALIGN_CENTER)
    prn.addTextStyle(true, false, true, prn.COLOR_1)  // reverse = bianco su nero
    prn.addTextSize(2, 2)
    prn.addText(`  DIRETTO  ${hhmm}  \n`)
    prn.addTextSize(1, 1)
    prn.addTextStyle(false, false, false, prn.COLOR_1)
    prn.addText('\n')

    // ── Contatore / sezione ──
    prn.addTextAlign(prn.ALIGN_LEFT)
    prn.addText(row('CONTATORIE', `CL: ${totalQty}`))
    prn.addText(row('BAR', 'Vendeur'))
    prn.addText('\n')

    // ── Tavolo / numero ordine (grande, centrato) ──
    prn.addTextAlign(prn.ALIGN_CENTER)
    prn.addTextSize(2, 2)
    prn.addTextStyle(false, false, true, prn.COLOR_1)
    const label = order.customer_name
      || (order.table_label ? `Tavolo ${order.table_label}` : null)
      || `#${order.daily_number}`
    prn.addText(`${label}\n`)
    prn.addTextSize(1, 1)
    prn.addTextStyle(false, false, false, prn.COLOR_1)
    prn.addText('Il tuo menu\n\n')

    // ── Articoli (doppia altezza per leggibilità dal barista) ──
    prn.addTextAlign(prn.ALIGN_LEFT)
    prn.addText(line())
    prn.addTextSize(1, 2)
    for (const item of ticketItems) {
      prn.addText(`${item.qty}  ${item.name.toUpperCase()}\n`)
      // Nota della singola riga (es. "poco ghiaccio", o per chi è): il banco
      // deve vederla sotto al prodotto, in corpo normale.
      if (item.note) {
        prn.addTextSize(1, 1)
        prn.addText(`     > ${item.note}\n`)
        prn.addTextSize(1, 2)
      }
    }
    prn.addTextSize(1, 1)
    prn.addText(line())

    if (order.note) {
      prn.addTextStyle(false, false, true, prn.COLOR_1)
      prn.addText(`Nota: ${order.note}\n`)
      prn.addTextStyle(false, false, false, prn.COLOR_1)
      prn.addText(line())
    }

    prn.addFeedLine(3)
    prn.addCut(prn.CUT_FEED)
  })
}

// ── PIÙ COMANDE DELLO STESSO CONTO, IN UN COLPO ──────────────────────
//
// «Se ho più di una comanda (dello stesso ordine!) devo poterle stampare
// insieme» (l'utente, 20/08). Un conto battuto in tre riprese ha tre
// ticket, e ristamparli uno per uno col conto in mano è tempo perso al
// banco.
//
// IN SEQUENZA, NON FUSE. Ogni comanda resta il SUO ticket, identico a
// quello che esce da solo — stesso formato, stesso taglio in fondo: al
// banco un ticket è un giro di lavoro, e due giri su una striscia sola
// sarebbero il difetto di BUG-051 rifatto apposta. Si aspetta ogni stampa
// prima della successiva: il builder della stampante è UNO SOLO
// (getPrinter tiene la connessione viva fra una stampa e l'altra), e due
// stampe che si accavallano si scriverebbero addosso.
//
// Le annullate restano fuori: è lavoro buttato, e ristamparlo rimetterebbe
// al banco un ticket che non si deve preparare.
export function comandeStampabili(order) {
  return (order?.comande || []).filter((c) => c && c.status !== 'annullato')
}

export async function printComande(order, comande) {
  const lista = comande?.length ? comande : comandeStampabili(order)
  // Uno per volta: ci pensa già la coda delle stampe (lavoroDiStampa), ma
  // aspettare qui tiene anche l'ORDINE — i ticket escono nella sequenza in
  // cui il conto è stato battuto, che è come il banco li legge.
  for (const c of lista) {
    await printComanda(order, c)
  }
  return lista.length
}

// ── TUTTO SU UNA RICEVUTA SOLA, MA DI UN ORDINE SOLO ─────────────────
//
// «Avere la possibilità di stampare comande separate se ci sono più
// comande è giusto, e anche di stampare UNA SOLA comanda con tutti i
// prodotti di più comande ma sempre dello stesso ordine. Va bene stampare
// tutte le comande insieme su più ricevute ma serve anche stampare tutto
// su una sola ricevuta» (l'utente, 20/08).
//
// Il ticket è quello di sempre — stesso formato, non c'è un secondo
// disegno da mantenere: cambia solo cosa ci finisce dentro, cioè le righe
// di tutte le comande del conto messe insieme (aggregateItems somma le
// quantità dello stesso drink, gli item personalizzati restano righe loro).
//
// È LA STESSA FORMA che in BUG-051 era il ripiego accidentale di
// `printComanda` senza comanda. La differenza è tutta qui: prima capitava,
// adesso la sceglie chi stampa. E il confine non si sposta — UN ORDINE:
// questa funzione prende un ordine, non una lista, e non c'è modo di
// passarle roba di conti diversi.
export function printComandaUnita(order) {
  return printComanda(order, { id: 'unita', items: aggregateItems(comandeStampabili(order)) })
}

// ── SCONTRINO NON FISCALE ─────────────────────────────────────────────────────
// Per il cliente: intestazione locale, articoli con prezzi, IVA, totale.
// Formato ispirato al template fotografato di SumUp POS Pro.

// ── IL LOGO IN CIMA ALLO SCONTRINO ───────────────────────────────────
//
// Il preconto è il pezzo di carta che resta in mano al cliente: senza segno
// del locale è un tabulato, e non si distingue da quello del bar accanto.
//
// La testina stampa immagini in bianco e nero, riga per riga: l'immagine va
// portata su un canvas e passata come contesto 2D (è l'unica forma che
// l'SDK Epson accetta). Si tiene STRETTA — 220 punti, meno di metà della
// carta da 80 mm — perché una testina termica disegna a puntini e un logo
// grande esce sporco e mangia carta a ogni conto.
//
// Se non si carica non se ne fa niente: uno scontrino senza logo è ancora
// uno scontrino, uno scontrino che non esce è un cliente che aspetta.
const LARGHEZZA_LOGO = 220

// TRE STATI, NON DUE. Qui c'era `null` a dire due cose diverse — «mai
// provato» e «provato, non c'è» — e la seconda non veniva mai ricordata:
// se `logo.png` manca, o non è nella cache del service worker, OGNI
// scontrino rifaceva il caricamento e aspettava l'errore prima di stampare.
// La carta usciva dopo, ogni volta. `undefined` vuol dire «mai provato»,
// `null` vuol dire «provato e non c'è»: si tenta una volta sola.
let _logoCanvas // undefined = mai provato

// Esportata per la prova: dall'esterno non la chiama nessuno, ma il
// «si tenta una volta sola» si dimostra solo contando i tentativi.
export async function logoPerStampa() {
  if (typeof document === 'undefined') return null
  if (_logoCanvas !== undefined) return _logoCanvas
  try {
    const url = `${import.meta.env.BASE_URL || '/'}logo.png`
    const img = await new Promise((ok, ko) => {
      const i = new Image()
      // TEMPO MASSIMO. Da quando la stampa è una coda (BUG-052), un logo
      // che non arriva mai non sporca più i ticket — li FERMA: nessuna
      // stampa esce finché questa promessa non si risolve. Tre secondi e
      // si stampa senza logo; il risultato finisce in _logoCanvas come
      // «provato e non c'è», quindi non si riprova a ogni scontrino.
      const tempoScaduto = setTimeout(() => ko(new Error('logo: tempo scaduto')), 3000)
      i.onload = () => {
        clearTimeout(tempoScaduto)
        ok(i)
      }
      i.onerror = (e) => {
        clearTimeout(tempoScaduto)
        ko(e)
      }
      i.src = url
    })
    const h = Math.round((img.height / img.width) * LARGHEZZA_LOGO)
    const canvas = document.createElement('canvas')
    canvas.width = LARGHEZZA_LOGO
    canvas.height = h
    const ctx = canvas.getContext('2d')
    // Fondo bianco: la carta è bianca, e un PNG trasparente diventerebbe
    // una macchia nera.
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, LARGHEZZA_LOGO, h)
    ctx.drawImage(img, 0, 0, LARGHEZZA_LOGO, h)
    _logoCanvas = { ctx, larghezza: LARGHEZZA_LOGO, altezza: h, url }
  } catch {
    _logoCanvas = null
  }
  return _logoCanvas
}

// Mette il logo in cima, se la stampante sa farlo e l'immagine c'è.
async function stampaLogo(prn) {
  const logo = await logoPerStampa()
  if (!logo) return
  try {
    prn.addTextAlign(prn.ALIGN_CENTER)
    // La stampante finta vuole solo l'indirizzo: lo mostra nel facsimile.
    if (typeof prn.addImageUrl === 'function') prn.addImageUrl(logo.url)
    else if (typeof prn.addImage === 'function') {
      prn.addImage(logo.ctx, 0, 0, logo.larghezza, logo.altezza, prn.COLOR_1)
    }
  } catch {
    /* la carta esce lo stesso: il logo è un di più */
  }
}

export function printScontrino(order, opts = {}) {
  return lavoroDiStampa(async (prn) => {
    const s = loadPrinterSettings()
    const ivaRate = Number(opts.ivaRate ?? s.ivaRate ?? 10) / 100
    const { date, time } = italianDateTime(order.created_at)
    const lordo = Number(order.total ?? 0)
    const sconto = Number(order.discount_amount ?? 0)
    // Il totale dello scontrino è quello REALMENTE pagato: prima si stampava il
    // lordo e lo sconto applicato non compariva da nessuna parte.
    const total = Math.max(0, Math.round((lordo - sconto) * 100) / 100)
    const ivaAmount = total - total / (1 + ivaRate)
    const imponibile = total / (1 + ivaRate)

    prn.addTextLang('it')
    prn.addTextSmooth(true)

    // ── Intestazione ──
    await stampaLogo(prn)
    prn.addTextAlign(prn.ALIGN_CENTER)
    prn.addTextSize(2, 2)
    prn.addTextStyle(false, false, true, prn.COLOR_1)
    prn.addText(`${s.businessName}\n`)
    prn.addTextSize(1, 1)
    prn.addTextStyle(false, false, false, prn.COLOR_1)
    prn.addText(`${s.businessAddress}\n`)
    prn.addText(`${s.businessCity}\n\n`)
    prn.addTextAlign(prn.ALIGN_LEFT)

    // ── Numero scontrino + data ──
    prn.addText(row(`SCONTRINO - ${order.daily_number ?? '-'}`, `${date}, ${time}`))
    prn.addText('Utente A\n')
    const totalPers = order.coperto_persons ? `${order.coperto_persons} cliente${order.coperto_persons > 1 ? 'i' : ''}` : '1 cliente'
    prn.addText(`${totalPers}\n`)
    const comandaLabel = order.table_label
      ? `Vendita - Tavolo ${order.table_label}`
      : `Vendita - Comanda #${order.daily_number}`
    prn.addText(`${comandaLabel}\n`)
    prn.addText(line())

    // ── Header colonne ──
    prn.addTextStyle(false, false, true, prn.COLOR_1)
    prn.addText(row('QTA  Prodotto', 'PU       Prezzo'))
    prn.addTextStyle(false, false, false, prn.COLOR_1)
    prn.addText(line())

    // ── Articoli ──
    for (const item of (order.order_items || [])) {
      const pu = `${Number(item.unit_price).toFixed(2)}€`
      const tot = `${(item.qty * item.unit_price).toFixed(2)}€`
      const left = `${item.qty}x  ${item.name}`
      prn.addText(row(left, `${pu.padStart(7)} ${tot.padStart(7)}`))
    }

    // Coperto (se presente)
    if (order.coperto_amount > 0) {
      const cop = `${Number(order.coperto_amount).toFixed(2)}€`
      prn.addText(row(`${order.coperto_persons}x  Coperto`, `${cop.padStart(7)} ${cop.padStart(7)}`))
    }

    // ── Sconto applicato ──
    if (sconto > 0) {
      prn.addText(row('Subtotale', `${lordo.toFixed(2)}€`))
      prn.addText(row('Sconto', `-${sconto.toFixed(2)}€`))
    }

    prn.addText(line())

    // ── IVA ──
    const ivaLabel = `IVA ${(ivaRate * 100).toFixed(1)}% (A)`
    prn.addText(row(ivaLabel, `${ivaAmount.toFixed(2)}€`))
    prn.addText(row('Subtotale', `${imponibile.toFixed(2)}€`))
    prn.addText('\n')

    // ── Totale grande ──
    prn.addTextAlign(prn.ALIGN_CENTER)
    prn.addTextSize(1, 2)
    prn.addTextStyle(false, false, true, prn.COLOR_1)
    prn.addText('Totale con IVA\n')
    prn.addTextSize(3, 3)
    prn.addText(`${total.toFixed(2)}€\n`)
    prn.addTextSize(1, 1)
    prn.addTextStyle(false, false, false, prn.COLOR_1)
    prn.addText('\n')
    prn.addTextAlign(prn.ALIGN_LEFT)
    prn.addText(line())

    // ── Pagamenti ──
    prn.addTextStyle(false, false, true, prn.COLOR_1)
    prn.addText('Pagamenti\n')
    prn.addTextStyle(false, false, false, prn.COLOR_1)
    // Metodo sconosciuto o assente: si scrive che non è indicato. Prima si
    // ripiegava su "Contante", e uno scontrino pagato con la carta usciva
    // con scritto contante — una dichiarazione falsa, non un default.
    const nomeMetodo = (m) => PAYMENT_METHOD_PRINT[m] || 'Non indicato'
    // Se ci sono incassi registrati si elencano uno per uno (conti divisi o
    // acconti): così su ogni scontrino si legge quanto in contanti e quanto in
    // carta. Altrimenti si usa il metodo di chiusura del conto.
    const incassi = (order.payments || []).filter((p) => Number(p.amount) > 0)
    if (incassi.length > 0) {
      for (const p of incassi) {
        prn.addText(row(`${nomeMetodo(p.method)} (A)`, `${Number(p.amount).toFixed(2)}€`))
      }
    } else {
      prn.addText(row(`${nomeMetodo(order.payment_method)} (A)`, `${total.toFixed(2)}€`))
    }
    prn.addText(line())

    // ── Codice lotteria degli scontrini (se comunicato dal cliente) ──
    if (order.lottery_code) {
      prn.addText(row('Codice Lotteria', order.lottery_code))
      prn.addText(line())
    }

    // ── Footer ──
    prn.addTextAlign(prn.ALIGN_CENTER)
    const shortId = (order.id || '').substring(0, 36)
    prn.addText(`${shortId}\n`)
    prn.addText(`${s.businessFooter}\n`)

    prn.addFeedLine(4)
    prn.addCut(prn.CUT_FEED)
  })
}

// ── FATTURA DI CORTESIA ──────────────────────────────────────────────────────
// Documento non fiscale con i dati di fatturazione del cliente: numero
// progressivo per anno, articoli, scorporo IVA. (La fattura elettronica
// vera passa dal commercialista/SDI: questa è la copia di cortesia.)

export function printFattura(invoice) {
  return lavoroDiStampa(async (prn) => {
    const s = loadPrinterSettings()
    const ivaRate = (Number(invoice.iva_rate) || 0) / 100
    const { date, time } = italianDateTime(invoice.created_at)
    const total = Number(invoice.total ?? 0)
    const ivaAmount = total - total / (1 + ivaRate)
    const imponibile = total / (1 + ivaRate)
    const c = invoice.customer || {}

    prn.addTextLang('it')
    prn.addTextSmooth(true)

    prn.addTextAlign(prn.ALIGN_CENTER)
    prn.addTextSize(2, 2)
    prn.addTextStyle(false, false, true, prn.COLOR_1)
    prn.addText(`${s.businessName}\n`)
    prn.addTextSize(1, 1)
    prn.addTextStyle(false, false, false, prn.COLOR_1)
    prn.addText(`${s.businessAddress}\n`)
    prn.addText(`${s.businessCity}\n\n`)
    prn.addTextSize(1, 2)
    prn.addTextStyle(false, false, true, prn.COLOR_1)
    prn.addText(`FATTURA DI CORTESIA n. ${invoice.number}\n`)
    prn.addTextSize(1, 1)
    prn.addTextStyle(false, false, false, prn.COLOR_1)
    prn.addTextAlign(prn.ALIGN_LEFT)
    prn.addText(`${date}, ${time}\n`)
    prn.addText(line())

    // ── Dati del cliente ──
    prn.addTextStyle(false, false, true, prn.COLOR_1)
    prn.addText('Intestata a\n')
    prn.addTextStyle(false, false, false, prn.COLOR_1)
    prn.addText(`${c.denominazione || '-'}\n`)
    if (c.piva) prn.addText(`P.IVA: ${c.piva}\n`)
    if (c.cf) prn.addText(`CF: ${c.cf}\n`)
    if (c.sdi) prn.addText(`SDI/PEC: ${c.sdi}\n`)
    if (c.indirizzo) prn.addText(`${c.indirizzo}\n`)
    prn.addText(line())

    // ── Articoli ──
    prn.addTextStyle(false, false, true, prn.COLOR_1)
    prn.addText(row('QTA  Prodotto', 'PU       Prezzo'))
    prn.addTextStyle(false, false, false, prn.COLOR_1)
    prn.addText(line())
    for (const item of invoice.items || []) {
      const pu = `${Number(item.unit_price).toFixed(2)}€`
      const tot = `${(item.qty * item.unit_price).toFixed(2)}€`
      prn.addText(row(`${item.qty}x  ${item.name}`, `${pu.padStart(7)} ${tot.padStart(7)}`))
    }
    prn.addText(line())
    if (invoice.discount_amount > 0) {
      prn.addText(row('Sconto', `-${Number(invoice.discount_amount).toFixed(2)}€`))
    }
    prn.addText(row(`IVA ${(ivaRate * 100).toFixed(1)}%`, `${ivaAmount.toFixed(2)}€`))
    prn.addText(row('Imponibile', `${imponibile.toFixed(2)}€`))
    prn.addText('\n')
    prn.addTextAlign(prn.ALIGN_CENTER)
    prn.addTextSize(2, 2)
    prn.addTextStyle(false, false, true, prn.COLOR_1)
    prn.addText(`Totale ${total.toFixed(2)}€\n`)
    prn.addTextSize(1, 1)
    prn.addTextStyle(false, false, false, prn.COLOR_1)
    prn.addText('\nDocumento non fiscale - copia di cortesia\n')
    prn.addText(`${s.businessFooter}\n`)

    prn.addFeedLine(4)
    prn.addCut(prn.CUT_FEED)
  })
}

// ── ORDINE FORNITORE ─────────────────────────────────────────────────────────
// Ticket dell'ordine d'acquisto (GENERATORE ORDINI): righe a confezioni
// e totali, da allegare/spuntare all'arrivo della merce.

export function printOrdineFornitore(order) {
  return lavoroDiStampa(async (prn) => {
    const s = loadPrinterSettings()

    prn.addTextLang('it')
    prn.addTextSmooth(true)
    prn.addTextAlign(prn.ALIGN_CENTER)
    prn.addTextSize(2, 2)
    prn.addTextStyle(false, false, true, prn.COLOR_1)
    prn.addText('ORDINE FORNITORE\n')
    prn.addTextSize(1, 1)
    prn.addTextStyle(false, false, false, prn.COLOR_1)
    prn.addText(`${s.businessName}\n\n`)
    prn.addTextAlign(prn.ALIGN_LEFT)
    prn.addText(row(order.supplier_name || '-', String(order.created_at || '').slice(0, 10)))
    prn.addText(line())
    prn.addTextSize(1, 2)
    for (const l of order.lines || []) {
      prn.addText(`${l.qty_packages}  ${String(l.name || '').toUpperCase()}\n`)
    }
    prn.addTextSize(1, 1)
    prn.addText(line())
    prn.addText(row('Totale netto', `${(Number(order.total_net) || 0).toFixed(2)}€`))
    prn.addText(row('Totale ivato', `${(Number(order.total_gross) || 0).toFixed(2)}€`))

    prn.addFeedLine(3)
    prn.addCut(prn.CUT_FEED)
  })
}

// ── TEST STAMPA ───────────────────────────────────────────────────────────────

// ── CHIUSURA CASSA ───────────────────────────────────────────────────────────
// Riepilogo di fine serata da allegare al fondo: incassato per metodo
// (contante, carta, POS, online), sconti concessi, conti chiusi e contante
// atteso in cassa. `recap` è quello di cashRecap().
// Gli stessi nomi dello scontrino: la chiusura di cassa si confronta con la
// striscia degli scontrini, e due parole diverse per la stessa cosa
// costringono a tradurre a mente mentre si contano i soldi.
const scontrinoMetodo = (k) => PAYMENT_METHOD_PRINT[k] || k

export function printChiusuraCassa(recap, session, opts = {}) {
  return lavoroDiStampa(async (prn) => {
    const s = loadPrinterSettings()
    const { date, time } = italianDateTime(new Date().toISOString())
    const eur = (n) => `${(Number(n) || 0).toFixed(2)}€`

    prn.addTextLang('it')
    prn.addTextSmooth(true)

    prn.addTextAlign(prn.ALIGN_CENTER)
    prn.addTextSize(2, 2)
    prn.addTextStyle(false, false, true, prn.COLOR_1)
    prn.addText(`${s.businessName}\n`)
    prn.addTextSize(1, 1)
    prn.addText('CHIUSURA CASSA\n')
    prn.addTextStyle(false, false, false, prn.COLOR_1)
    prn.addTextAlign(prn.ALIGN_LEFT)
    prn.addText(`${date}, ${time}\n`)
    if (session?.opened_at) {
      const a = italianDateTime(session.opened_at)
      prn.addText(`Apertura: ${a.date}, ${a.time}\n`)
    }
    if (opts.by) prn.addText(`Operatore: ${opts.by}\n`)
    prn.addText(line())

    // ── Incassi per metodo ──
    prn.addTextStyle(false, false, true, prn.COLOR_1)
    prn.addText('Incassi per metodo\n')
    prn.addTextStyle(false, false, false, prn.COLOR_1)
    // Una riga per metodo battuto: i soliti sempre (anche a zero, così la
    // striscia si legge uguale ogni sera) e in coda quelli nuovi, senza dover
    // ristampare il codice quando si aggiunge un metodo di pagamento.
    const m = recap?.byMethod || {}
    for (const k of cashMethodKeys(m)) {
      const noto = CASH_METHOD_ORDER.includes(k)
      if (!noto && !(Number(m[k]) > 0)) continue
      prn.addText(row(scontrinoMetodo(k), eur(m[k])))
    }
    prn.addText(line())

    // ── Sconti concessi (già dedotti dagli incassi) ──
    // Sempre stampati, anche a zero: è una voce che si controlla ogni sera.
    prn.addText(row('Sconti concessi', `-${eur(recap?.sconti)}`))
    prn.addText(line())

    // ── Totale ──
    prn.addTextAlign(prn.ALIGN_CENTER)
    prn.addTextSize(1, 2)
    prn.addTextStyle(false, false, true, prn.COLOR_1)
    prn.addText('Totale incassato\n')
    prn.addTextSize(3, 3)
    prn.addText(`${eur(recap?.incassato)}\n`)
    prn.addTextSize(1, 1)
    prn.addTextStyle(false, false, false, prn.COLOR_1)
    prn.addTextAlign(prn.ALIGN_LEFT)
    prn.addText(line())

    // ── Cassa ──
    prn.addText(row('Conti chiusi', String(recap?.nPagati ?? 0)))
    prn.addText(row('Fondo cassa', eur(recap?.fondo)))
    prn.addText(row('Contante atteso', eur(recap?.contanteAtteso)))
    if (opts.countedCash != null && opts.countedCash !== '') {
      const counted = Number(String(opts.countedCash).replace(',', '.')) || 0
      prn.addText(row('Contante contato', eur(counted)))
      const diff = Math.round((counted - (Number(recap?.contanteAtteso) || 0)) * 100) / 100
      prn.addText(row('Differenza', `${diff > 0 ? '+' : ''}${eur(diff)}`))
    }
    if (Number(recap?.apertoDaIncassare) > 0) {
      prn.addText(line())
      prn.addText(row(`Conti aperti (${recap.nAperti})`, eur(recap.apertoDaIncassare)))
    }
    prn.addText(line())

    prn.addTextAlign(prn.ALIGN_CENTER)
    prn.addText(`${s.businessFooter}\n`)
    prn.addFeedLine(4)
    prn.addCut(prn.CUT_FEED)
  })
}

export function printTest() {
  return lavoroDiStampa(async (prn) => {
    const s = loadPrinterSettings()

    prn.addTextLang('it')
    prn.addTextSmooth(true)
    prn.addTextAlign(prn.ALIGN_CENTER)
    prn.addTextSize(2, 2)
    prn.addTextStyle(false, false, true, prn.COLOR_1)
    prn.addText('Test stampa\n')
    prn.addTextSize(1, 1)
    prn.addTextStyle(false, false, false, prn.COLOR_1)
    prn.addText(`${s.businessName}\n`)
    prn.addText('Connessione OK\n')
    prn.addFeedLine(3)
    prn.addCut(prn.CUT_FEED)
  })
}
