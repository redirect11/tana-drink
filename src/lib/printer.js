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

// Scontrino automatico UNA SOLA VOLTA per INCASSO — non per conto. La
// chiusura può passare da più strade (schermata pagamento, coda, incasso di
// gruppo) e senza questa guardia lo stesso scontrino uscirebbe due volte.
// Ma il conto si può RIAPRIRE: si corregge una riga, si riscuote di nuovo,
// e lo scontrino nuovo deve uscire — «non ha senso che stampi solo una
// volta» (l'utente, 19/08). Per questo la pretesa si può anche RESTITUIRE
// (releaseReceiptPrint, quando il conto torna aperto) o FORZARE
// (reclaimReceiptPrint, nel gesto stesso dell'incasso: un incasso vero è
// per definizione una chiusura nuova).
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

// Il conto è tornato APERTO: la copia stampata apparteneva alla chiusura di
// prima, e la prossima chiusura merita il suo scontrino. Chiamata dalla coda
// quando vede il conto riaperto — su ogni terminale, ognuno per la sua
// memoria.
export function releaseReceiptPrint(orderId) {
  if (!orderId) return
  try {
    const list = JSON.parse(localStorage.getItem(PRINTED_KEY) || '[]')
    if (!list.includes(orderId)) return
    localStorage.setItem(PRINTED_KEY, JSON.stringify(list.filter((id) => id !== orderId)))
  } catch {
    /* storage non disponibile: pazienza, claimReceiptPrint stamperà comunque */
  }
}

// L'INCASSO È UNA CHIUSURA NUOVA, sempre: chi sta incassando adesso deve
// avere lo scontrino di adesso, anche se per questo conto ne era già uscito
// uno prima della riapertura. Si restituisce la pretesa vecchia e si prende
// quella nuova in un colpo — così la coda, che vedrà il conto pagato fra un
// istante, troverà la pretesa già presa e non farà la seconda copia.
export function reclaimReceiptPrint(orderId) {
  releaseReceiptPrint(orderId)
  return claimReceiptPrint(orderId)
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

// ── COMANDA ───────────────────────────────────────────────────────────────────
// Ticket per il barista: numero ordine grande, articoli senza prezzi.
// Formato ispirato al template fotografato (sfondo nero, orario, sezione BAR).

// `comanda` opzionale: stampa i soli item di quella comanda (aggiunte a un
// conto aperto); senza, stampa l'aggregato dell'ordine (retrocompatibile).
export async function printComanda(order, comanda = null) {
  const prn = await getPrinter()
  const now = new Date()
  const hhmm = now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
  const ticketItems = comanda?.items ?? order.order_items ?? []
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
  prn.send()
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
      i.onload = () => ok(i)
      i.onerror = ko
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

export async function printScontrino(order, opts = {}) {
  const prn = await getPrinter()
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
  prn.send()
}

// ── FATTURA DI CORTESIA ──────────────────────────────────────────────────────
// Documento non fiscale con i dati di fatturazione del cliente: numero
// progressivo per anno, articoli, scorporo IVA. (La fattura elettronica
// vera passa dal commercialista/SDI: questa è la copia di cortesia.)

export async function printFattura(invoice) {
  const prn = await getPrinter()
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
  prn.send()
}

// ── ORDINE FORNITORE ─────────────────────────────────────────────────────────
// Ticket dell'ordine d'acquisto (GENERATORE ORDINI): righe a confezioni
// e totali, da allegare/spuntare all'arrivo della merce.

export async function printOrdineFornitore(order) {
  const prn = await getPrinter()
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
  prn.send()
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

export async function printChiusuraCassa(recap, session, opts = {}) {
  const prn = await getPrinter()
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
  prn.send()
}

export async function printTest() {
  const prn = await getPrinter()
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
  prn.send()
}
