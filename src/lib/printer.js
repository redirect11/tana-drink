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

// Larghezza colonne stamante 80 mm (TM-m30II / TM-m30III): 48 chars std.
const COL = 48

// ── Impostazioni persistite in localStorage ───────────────────────────────────

const SETTINGS_KEY = 'tana_printer_v2'

export const DEFAULT_PRINTER_SETTINGS = {
  ip: '',
  port: 8043,       // 8043 = HTTPS (WSS), 8008 = HTTP (WS)
  https: true,      // false → HTTP, solo se l'app è servita in HTTP
  ivaRate: 10,      // aliquota IVA applicata sullo scontrino
  autoPrintComanda: false,  // stampa automatica comanda all'arrivo dell'ordine
  autoPrintScontrino: false, // stampa automatica scontrino al "pronto"
  businessName: 'La Tana del Coniglio',
  businessAddress: 'Corso Tommaso Vitale 87/89',
  businessCity: '80035 Nola - Italy',
  businessFooter: 'EFFEVI - SRLS',
}

export function loadPrinterSettings() {
  try {
    return { ...DEFAULT_PRINTER_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }
  } catch {
    return { ...DEFAULT_PRINTER_SETTINGS }
  }
}

export function savePrinterSettings(patch) {
  const current = loadPrinterSettings()
  const next = { ...current, ...patch }
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
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
  try { _device?.disconnect() } catch { /* ignora */ }
  _device = null
  _printer = null
  _connectPromise = null
}

// Restituisce il printer object, connettendosi se necessario.
// Riusa la connessione esistente tra stampe consecutive.
async function getPrinter() {
  if (_printer) return _printer
  if (_connectPromise) return _connectPromise

  if (!sdkAvailable()) {
    throw new Error(
      'ePOS SDK non caricato. Scarica epos-2.27.0.js da Epson e mettilo in public/.'
    )
  }

  const s = loadPrinterSettings()
  if (!s.ip) throw new Error("Imposta l'IP della stampante nelle impostazioni.")

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

          // Pulisce la connessione alla disconnessione così al prossimo
          // invio si riconnette in automatico.
          _printer.ondisconnect = () => {
            _printer = null
            _device = null
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

export async function printScontrino(order, opts = {}) {
  const prn = await getPrinter()
  const s = loadPrinterSettings()
  const ivaRate = Number(opts.ivaRate ?? s.ivaRate ?? 10) / 100
  const { date, time } = italianDateTime(order.created_at)
  const total = Number(order.total ?? 0)
  const ivaAmount = total - total / (1 + ivaRate)
  const imponibile = total / (1 + ivaRate)

  prn.addTextLang('it')
  prn.addTextSmooth(true)

  // ── Intestazione ──
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
  const metodo = {
    contanti: 'Contante',
    carta: 'Carta',
    online: 'Online',
    lettore: 'Carta (lettore)',
  }[order.payment_method] || 'Contante'
  prn.addText(row(`${metodo} (A)`, `${total.toFixed(2)}€`))
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
