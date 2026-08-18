import { useEffect, useMemo, useRef, useState } from 'react'
import {
  registerPayment,
  markOrderPaid,
  setOrderDiscount,
  setOrderLotteryCode,
  createInvoice,
  markInvoiceSent,
  subscribeVouchers,
  applyVoucherDiscount,
} from '../lib/api.js'
import { readerCheckout } from '../lib/paymentsApi.js'
import { formatPrice, PAYMENT_METHOD_LABELS } from '../lib/orderStatus.js'
import { useOnline } from '../lib/useOnline.js'
import { allServed } from '../lib/comande.js'
import { activeVouchers } from '../lib/vouchers.js'
import { printScontrino, printFattura, loadPrinterSettings, claimReceiptPrint, reclaimReceiptPrint, releaseReceiptPrint } from '../lib/printer.js'
import { toastError } from '../lib/toast.js'
import {
  remainingItems,
  paidAmount,
  orderDue,
  scontoEccessivo,
  selectionAmount,
  discountAmount,
  paymentCloses,
  round2,
  dettaglioIncassi,
  unitaDaConteggio,
  conteggioDaUnita,
  toccaUnita,
} from '../lib/pagamento.js'

// ── Schermata Pagamento in stile POS SumUp (vedi foto di riferimento) ──
// SINISTRA: gli articoli del conto (selezionabili per lo split) e il
// riepilogo Pagato / Ammontare dovuto / Totale. CENTRO: il display
// dell'importo da incassare con il TASTIERINO calcolatrice (C, /2, /3,
// operazioni) e il tasto "Riscuotere"; sotto, il Preconto. DESTRA: i
// metodi di pagamento (Contante / lettore SumUp) e lo Sconto in basso.

// Selezione "tutto il conto": la schermata si apre con ogni articolo già
// in pagamento; si deseleziona solo per lo split del tavolo.
// La selezione è per RIGA (`key`), non per prodotto: lo stesso prodotto può
// stare su più righe, e muoverne una non deve muovere l'altra.
const fullSelection = (order) =>
  Object.fromEntries(remainingItems(order).map((r) => [r.key, r.qty]))

// Il display del tastierino lavora in CENTESIMI digitati ("350" → 3,50 €).
const toDigits = (euro) => String(Math.max(0, Math.round(euro * 100)))
const digitsToEuro = (s) => (parseInt(s || '0', 10) || 0) / 100

// `resolveOrderId` (opzionale): quando la schermata si apre PRIMA che
// l'ordine esista sul server (pagamento diretto dal POS), le azioni
// aspettano qui l'id reale — la UI intanto è già piena e reattiva.
export default function PaymentScreen({ order: orderProp, settings, onClose, onPaid, onBeforePay, onError, resolveOrderId }) {
  const online = useOnline()
  // Chiusura per pagamento COMPLETATO (non semplice annulla): chiude e avvisa
  // il chiamante, che può tornare alla coda ordini.
  // `incasso` = { amount, method } appena registrato. Serve per lo SCONTRINO:
  // la registrazione va in background, quindi in questo istante l'ordine non
  // sa ancora com'è stato pagato — e lo scontrino usciva "Contante" anche per
  // una carta di credito. Qui glielo si dice.
  const closePaid = (incasso = null) => {
    const perStampa = incasso
      ? {
          ...order,
          payments: [
            ...(order.payments || []),
            { amount: incasso.amount, method: incasso.method, at: new Date().toISOString() },
          ],
          payment_method: incasso.method,
        }
      : order
    // Scontrino alla CHIUSURA del conto (se l'auto-stampa è attiva): prima
    // partiva solo quando l'ordine passava a "pronto", quindi con la gestione
    // preparazione spenta non usciva mai.
    try {
      // Solo su un ordine REALE: nel pagamento diretto dal POS la schermata si
      // apre su un ordine locale senza id né numero, e ne uscirebbe uno
      // scontrino con "#-". In quel caso stampa la coda quando l'ordine vero
      // risulta pagato (claimReceiptPrint garantisce una copia sola).
      // Con un INCASSO in mano la pretesa si FORZA (reclaim): questo è un
      // pagamento che sta succedendo adesso, e se il conto era stato chiuso
      // e riaperto la copia vecchia non conta più. Senza incasso (chiusure
      // d'ufficio) vale la pretesa normale: una copia e basta.
      if (
        order.id &&
        order.daily_number != null &&
        loadPrinterSettings().autoPrintScontrino &&
        (incasso ? reclaimReceiptPrint(order.id) : claimReceiptPrint(order.id))
      ) {
        printScontrino(perStampa).catch((e) => {
          console.warn('[printer] scontrino:', e.message)
          // La carta non è uscita: la prenotazione torna libera, così la
          // prossima chiusura (o la coda) ci riprova. Vedi BUG-047.
          releaseReceiptPrint(order.id)
          onError?.(`Scontrino non stampato: ${e.message}`)
        })
      }
    } catch {
      /* stampante non configurata: si continua */
    }
    onPaid?.()
    onClose()
  }
  const [error, setError] = useState(null)
  // Sconto OTTIMISTICO: applicato subito a schermo, server in background.
  const [optimisticDisc, setOptimisticDisc] = useState(null) // { disc, amount }
  const order = useMemo(
    () =>
      optimisticDisc == null
        ? orderProp
        : { ...orderProp, discount: optimisticDisc.disc, discount_amount: optimisticDisc.amount },
    [orderProp, optimisticDisc]
  )
  // Quando il server ha recepito lo sconto, l'override locale si ritira.
  useEffect(() => {
    if (optimisticDisc != null && (orderProp.discount_amount || 0) === optimisticDisc.amount) {
      setOptimisticDisc(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderProp.discount_amount])
  const orderId = async () => (resolveOrderId ? await resolveOrderId() : order.id)
  const [saving, setSaving] = useState(false)
  const [sel, setSel] = useState(() => fullSelection(order)) // riga -> quante unità pagare ora
  // QUALI unità, quando le righe uguali sono separate. Il conteggio dice
  // «due di questi tre»; separandole ognuna è una voce a sé e deve avere la
  // sua quantità — spegnendo la prima si spegne la prima, non le ultime
  // come farebbe un contatore che scende. Le due forme si convertono
  // (lib/pagamento.js) e restano allineate: il conteggio è quante ne sono
  // accese.
  const [selUnita, setSelUnita] = useState({})
  const unitaDi = (r) =>
    selUnita[r.key]?.length === r.qty ? selUnita[r.key] : unitaDaConteggio(r.qty, sel[r.key] ?? 0)
  const toccaLaUnita = (r, i, acceso) => {
    const nuove = toccaUnita(selUnita[r.key], r.qty, i, acceso)
    setSelUnita((st) => ({ ...st, [r.key]: nuove }))
    setSel((st) => ({ ...st, [r.key]: conteggioDaUnita(nuove) }))
  }
  // Vista SEPARATA delle righe uguali (al volo, come nel riepilogo ordine):
  // ogni unità è mostrata a sé e si sceglie fin dove pagare. Solo visuale: la
  // selezione resta per riga (sel[key] = quante unità di quella riga).
  const [separati, setSeparati] = useState(false)
  const [method, setMethod] = useState('banco')
  // Tastierino: null = importo automatico (dalla selezione); altrimenti
  // la stringa di cifre digitata. `acc`/`op` per la calcolatrice.
  const [display, setDisplay] = useState(null)
  const [acc, setAcc] = useState(null)
  const [op, setOp] = useState(null)
  // Sconto: modale con tastierino (tipo % o €, cifre digitate).
  const [showDiscount, setShowDiscount] = useState(false)
  const [discType, setDiscType] = useState(order.discount?.type || 'percent')
  const [discDigits, setDiscDigits] = useState('')
  // Lotteria degli scontrini e fattura di cortesia.
  const [showLottery, setShowLottery] = useState(false)
  const [lotteryCode, setLotteryCode] = useState(order.lottery_code || '')
  const [showInvoice, setShowInvoice] = useState(false)
  const [invoice, setInvoice] = useState(null) // fattura appena emessa
  const [billing, setBilling] = useState({
    denominazione: '',
    piva: '',
    cf: '',
    sdi: '',
    indirizzo: '',
    email: '',
  })
  const [readerStarted, setReaderStarted] = useState(false)
  // Buoni VIP: elenco e beneficiario scelto per il pagamento col buono.
  const [vouchers, setVouchers] = useState([])
  const [voucherId, setVoucherId] = useState('')
  useEffect(() => subscribeVouchers(setVouchers, () => {}), [])
  const vipList = useMemo(() => activeVouchers(vouchers), [vouchers])
  const chosenVoucher = vipList.find((v) => v.id === voucherId) || null

  // Dopo ogni incasso registrato si riparte da "tutto il residuo".
  const paymentsCount = (order.payments || []).length
  useEffect(() => {
    setSel(fullSelection(order))
    setSelUnita({})
    setDisplay(null)
    setAcc(null)
    setOp(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id, paymentsCount])

  const remaining = useMemo(() => remainingItems(order), [order])
  // LA LISTA PARTE DAL FONDO. Il conto lo si legge dall'ultima riga battuta:
  // aprendo il pagamento con quindici righe si vedevano le prime — quelle di
  // mezz'ora prima — e per controllare l'ultimo giro bisognava scorrere.
  const listaRef = useRef(null)
  // Di chi è questo conto: il tavolo se c'è, se no il nome. È la stessa
  // riga che la coda mette sulle card (destinazioneConto), e qui serve in
  // testata perché è così che si chiama un conto quando lo si incassa.
  const dove = [order.table_label ? `Tavolo ${order.table_label}` : '', order.customer_name]
    .filter(Boolean)
    .join(' · ')
  useEffect(() => {
    const el = listaRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [remaining.length])
  const paid = paidAmount(order)
  // Incassare non vuol dire aver consegnato: seguendo la preparazione il
  // conto resta aperto finché le comande non sono servite.
  const autoServeBase = settings?.workflow_enabled === false
  // Il tasto in più lo decide il locale (Impostazioni → Gestione
  // preparazione): serve dove si consegna e si incassa nello stesso gesto.
  const riscuotiEServi = settings?.riscuoti_e_servi === true
  const due = orderDue(order)
  // Sconto più grande del conto: capita solo con la strategia "avvisa"
  // (Impostazioni → Sconto e righe del conto), quando si sconta e poi si
  // tolgono righe. Chiudere così significherebbe registrare un incasso che
  // non torna con niente: prima lo si sistema.
  const scontoFuoriMisura = scontoEccessivo(order)
  const served = allServed(order)
  const closed = order.payment_status === 'pagato'

  const selection = remaining
    .filter((r) => (sel[r.key] || 0) > 0)
    .map((r) => ({ ...r, qty: Math.min(sel[r.key], r.qty) }))
  const allSelected =
    remaining.length > 0 && remaining.every((r) => (sel[r.key] || 0) >= r.qty)
  const splitting = !allSelected && selection.length > 0
  // Importo automatico: la selezione (o il residuo intero).
  const autoAmount =
    remaining.length === 0 || allSelected ? due : splitting ? selectionAmount(order, selection) : 0
  const manual = display !== null
  const amount = manual ? digitsToEuro(display) : autoAmount
  // Non si incassa mai oltre il dovuto: l'eccedenza digitata è il RESTO.
  const toPay = Math.min(round2(amount), due)
  const change = Math.max(0, round2(amount - due))

  // Metodi come nella foto del POS: Contante, Carta di Credito (POS
  // esterno, si registra e basta) e SumUp (il lettore Solo, transazione
  // via Cloud API). SumUp è SEMPRE in lista: senza pairing è spento con
  // la nota su dove attivarlo (Impostazioni → Pagamenti).
  const readerReady = settings.payments_reader_enabled && settings.sumup_reader_id
  // Contante e carta si incassano anche SENZA RETE: la registrazione entra in
  // cache e si sincronizza dopo. Il lettore SumUp no — deve parlare con i suoi
  // server per autorizzare — quindi senza rete si spegne e lo dice, invece di
  // far aspettare il cassiere davanti a una transazione che non partirà.
  const senzaRete = !online
  const methods = [
    { key: 'banco', label: 'Contante', emoji: '💵' },
    { key: 'carta', label: 'Carta di Credito', emoji: '💳' },
    {
      key: 'lettore',
      label: 'SumUp',
      emoji: '📟',
      disabled: !readerReady || senzaRete,
      // Niente sottotitolo sul tasto: il motivo si legge SOLO se lo si tocca.
      // Scritto lì sotto stava sempre in mezzo, mangiava una riga a una
      // schermata che ne ha poche, e chi incassa non lo leggeva comunque.
      motivo: senzaRete
        ? '📶 Senza rete il lettore SumUp non può autorizzare: incassa e registra come Carta di Credito.'
        : 'Il lettore SumUp non è ancora configurato: si attiva in Impostazioni → Pagamenti.',
    },
  ]
  // Buono come SCONTO (non metodo di pagamento): si applica al totale e si
  // detrae dal saldo del beneficiario, anche parzialmente. Importo proposto:
  // il residuo, mai oltre il saldo o il totale.
  const voucherBalance = chosenVoucher ? round2(chosenVoucher.balance) : 0
  const voucherDefault = round2(Math.min(due, voucherBalance))
  const voucherReq = discDigits ? digitsToEuro(discDigits) : voucherDefault
  const voucherRedeem = chosenVoucher
    ? round2(Math.min(voucherReq, voucherBalance, Number(order.total) || 0))
    : 0

  async function run(fn) {
    setSaving(true)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const bump = (r, delta) => {
    const next = Math.max(0, Math.min((sel[r.key] || 0) + delta, r.qty))
    setSel((s) => ({ ...s, [r.key]: next }))
    // Le unità seguono il conteggio: dalla vista unita si torna a «le prime
    // N accese», che è l'unica lettura sensata di un numero.
    setSelUnita((st) => ({ ...st, [r.key]: unitaDaConteggio(r.qty, next) }))
  }

  // ── Tastierino ──
  const current = () => (display !== null ? digitsToEuro(display) : autoAmount)
  const key = (d) => setDisplay((s) => ((s === null ? '' : s) + d).slice(0, 8))
  const back = () =>
    setDisplay((s) => {
      const cur = s === null ? toDigits(autoAmount) : s
      const next = cur.slice(0, -1)
      return next.length ? next : '0'
    })
  const clear = () => {
    setDisplay(null)
    setAcc(null)
    setOp(null)
  }
  const divideBy = (n) => setDisplay(toDigits(round2(current() / n)))
  const setOperator = (o) => {
    setAcc(current())
    setOp(o)
    setDisplay('0')
  }
  const equals = () => {
    if (op === null || acc === null) return
    const b = current()
    const result =
      op === '+' ? acc + b : op === '-' ? acc - b : op === 'x' ? acc * b : b !== 0 ? acc / b : acc
    setDisplay(toDigits(round2(Math.max(0, result))))
    setAcc(null)
    setOp(null)
  }

  // «Riscuoti» e «Riscuoti e servi» sono lo stesso incasso: cambia solo se
  // le comande risultano servite — e quindi se il conto si chiude adesso.
  const riscuoti = ({ servi = false } = {}) => {
    const autoServe = autoServeBase || servi
    const items = !manual && splitting ? selection : null
    // Conto già coperto (sconto totale, buono o acconti): non c'è nulla da
    // incassare ma il conto va CHIUSO lo stesso, altrimenti resta aperto per
    // sempre e blocca anche la chiusura di cassa.
    if (due <= 0) {
      // Conto vuoto (nessun articolo, nessuno sconto, nessun acconto): non c'è
      // niente da chiudere.
      if (!(Number(order.total) > 0) && paid <= 0) return
      return run(async () => {
        await onBeforePay?.()
        await markOrderPaid(await orderId(), null, { autoServe })
        closePaid()
      })
    }
    if (method === 'lettore') {
      // Lettore SIMULATO (test/dev senza hardware): stessa UX del vero —
      // transazione "avviata", poi l'esito arriva da solo dopo 2,5s.
      if (settings.sumup_reader_id === 'sim') {
        setReaderStarted(true)
        ;(async () => {
          try {
            await onBeforePay?.()
            const oid = await orderId()
            setTimeout(() => {
              registerPayment(oid, { amount: toPay, method: 'lettore', items, autoServe }).catch((e) =>
                onError?.(`Lettore simulato: ${e.message}`)
              )
            }, 2500)
          } catch (e) {
            setError(e.message)
          }
        })()
        return
      }
      // Il lettore VERO avvia una transazione: qui si aspetta l'esito.
      return run(async () => {
        await onBeforePay?.()
        const res = await readerCheckout(await orderId(), { amount: toPay, items })
        if (res?.unavailable) {
          setError('Lettore non disponibile in ambiente di sviluppo: simula dai DevTools.')
          return
        }
        setReaderStarted(true)
      })
    }
    // Contante / carta (POS esterno): OTTIMISTICO — il conto si chiude
    // subito a schermo, la registrazione va in background; in errore
    // l'avviso arriva nel dettaglio ordine.
    const willClose = paymentCloses(order, toPay)
    ;(async () => {
      try {
        await onBeforePay?.()
        // `chiude`: quello che questa schermata ha davanti adesso. Senza,
        // l'api rilegge il conto per decidere e prende la versione di prima —
        // quella senza lo sconto appena applicato (BUG-046).
        await registerPayment(await orderId(), { amount: toPay, method, items, autoServe, chiude: willClose })
      } catch (e) {
        setError(e.message)
        onError?.(`Pagamento non registrato: ${e.message}`)
      }
    })()
    if (willClose) closePaid({ amount: toPay, method })
  }

  // ── Sconto dal tastierino della modale ──
  // In % le cifre sono la percentuale intera ("10" → 10%); in € sono
  // centesimi come nel tastierino principale ("350" → 3,50 €).
  const discValue =
    discType === 'percent'
      ? Math.min(parseInt(discDigits || '0', 10) || 0, 100)
      : digitsToEuro(discDigits)
  const discPreview = discountAmount(order.total, { type: discType, value: discValue })

  // Applica SUBITO a schermo (override locale), server in background.
  const applyDiscount = () => {
    // BUONO come sconto: attinge al saldo del beneficiario (anche parziale).
    if (discType === 'buono') {
      if (!chosenVoucher || !(voucherRedeem > 0)) return
      const disc = { type: 'buono', value: voucherRedeem, voucher_id: chosenVoucher.id, voucher_name: chosenVoucher.holder_name }
      setOptimisticDisc({ disc, amount: voucherRedeem })
      setShowDiscount(false)
      setDiscDigits('')
      const vid = chosenVoucher.id
      setVoucherId('')
      ;(async () => {
        try {
          await applyVoucherDiscount(await orderId(), vid, voucherReq)
        } catch (e) {
          setOptimisticDisc(null)
          toastError(`Buono non applicato: ${e.message}`)
        }
      })()
      return
    }
    const disc = discValue > 0 ? { type: discType, value: discValue } : null
    setOptimisticDisc({ disc, amount: discountAmount(orderProp.total, disc) })
    setShowDiscount(false)
    setDiscDigits('')
    ;(async () => {
      try {
        await setOrderDiscount(await orderId(), disc)
      } catch (e) {
        setOptimisticDisc(null)
        toastError(`Sconto non applicato: ${e.message}`)
      }
    })()
  }

  const saveLottery = () => {
    setShowLottery(false)
    ;(async () => {
      try {
        await setOrderLotteryCode(await orderId(), lotteryCode)
      } catch (e) {
        toastError(`Codice lotteria non salvato: ${e.message}`)
      }
    })()
  }

  const emettiFattura = () =>
    run(async () => {
      const inv = await createInvoice({
        order: { ...order, id: await orderId() },
        customer: billing,
        ivaRate: loadPrinterSettings().ivaRate ?? 10,
      })
      setInvoice(inv)
    })

  // Invio via email: si apre il client di posta con la fattura già scritta.
  const invoiceMailto = (inv) => {
    const s = loadPrinterSettings()
    const righe = (inv.items || [])
      .map((i) => `${i.qty}x ${i.name} — ${formatPrice(i.qty * i.unit_price)}`)
      .join('\n')
    const c = inv.customer || {}
    const body = [
      `Fattura di cortesia n. ${inv.number}`,
      `${s.businessName || ''}`,
      '',
      `Intestata a: ${c.denominazione || ''}`,
      c.piva ? `P.IVA: ${c.piva}` : null,
      c.cf ? `CF: ${c.cf}` : null,
      c.indirizzo ? `Indirizzo: ${c.indirizzo}` : null,
      '',
      righe,
      inv.discount_amount > 0 ? `Sconto: −${formatPrice(inv.discount_amount)}` : null,
      `Totale: ${formatPrice(inv.total)}`,
      '',
      'Documento non fiscale — copia di cortesia.',
    ]
      .filter((r) => r !== null)
      .join('\n')
    return `mailto:${encodeURIComponent(c.email || '')}?subject=${encodeURIComponent(
      `Fattura di cortesia n. ${inv.number}`
    )}&body=${encodeURIComponent(body)}`
  }

  const sendInvoiceEmail = (inv) => {
    window.location.href = invoiceMailto(inv)
    markInvoiceSent(inv.id, inv.customer?.email || null).catch(() => {})
  }

  return (
    <div
      role="dialog"
      aria-label="Pagamento"
      style={{
        position: 'fixed',
        inset: 0,
        // Sotto la barra di sistema del tablet (ora, wifi, batteria): senza,
        // il titolo e il tasto Chiudi finiscono dietro l'orologio.
        paddingTop: 'var(--safe-top)',
        zIndex: 300,
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Barra in alto */}
      <div
        className="row between"
        style={{
          alignItems: 'center',
          padding: '8px 14px',
          borderBottom: '1px solid var(--line)',
          flexShrink: 0,
        }}
      >
        {/* CHI PAGA STA IN TESTATA, accanto al numero: quando si incassa
            si chiama il tavolo per nome («Lele», «tavolo 4»), e quel nome
            era in mezzo alle righe dei drink, dove sembrava una voce del
            conto. Qui sta dove si guarda per sapere di chi è il conto. */}
        <h3 style={{ margin: 0 }}>
          💳 Pagamento · #{order.daily_number ?? '—'}
          {dove && <span className="muted"> · {dove}</span>}
        </h3>
        <button className="btn ghost small" onClick={onClose}>✕ Chiudi</button>
      </div>

      {error && <div className="banner" style={{ margin: '8px 12px 0', flexShrink: 0 }}>{error}</div>}

      <div className="payscreen-body">
        {/* ── SINISTRA: articoli del conto (split) + riepilogo ── */}
        <div className="payscreen-items">
          <div ref={listaRef} style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
            {/* Niente istruzioni sopra le righe: chi incassa le tocca e vede
                il totale muoversi. A dire da dove viene il numero ci pensa
                l'etichetta sopra l'importo — «RIGHE SCELTE» o «IMPORTO A
                MANO» — che si legge nel momento in cui serve. */}
            {remaining.some((r) => r.qty > 1) && (
              <button
                className="btn ghost small"
                style={{ marginTop: 4 }}
                onClick={() => setSeparati((v) => !v)}
              >
                {separati ? '🔗 Unisci uguali' : '≣ Separa uguali'}
              </button>
            )}
            {remaining.map((r) => {
              const s = Math.min(sel[r.key] || 0, r.qty)
              // SEPARATA: una riga per unità, e le righe sono FATTE COME LE
              // ALTRE — nome, prezzo e il contatore −/+ con «1/1». Prima
              // erano caselline da spuntare: nella stessa colonna
              // convivevano due modi diversi di dire la stessa cosa, e chi
              // incassa doveva capire quale valesse per quale riga.
              if (separati && r.qty > 1) {
                const unita = unitaDi(r)
                return (
                  <div key={r.key}>
                    {Array.from({ length: r.qty }, (_, i) => {
                      const on = !!unita[i]
                      return (
                        <div
                          className="row between"
                          key={`${r.key}#${i}`}
                          style={{ alignItems: 'center', marginTop: 8 }}
                        >
                          <span className="grow" style={{ fontSize: '0.92rem' }}>
                            {r.custom ? '✨ ' : ''}{r.name}
                            <span className="muted small"> · 1× {formatPrice(r.unit_price)}</span>
                          </span>
                          <span className="qty">
                            {/* UNO ALLA VOLTA. Il «−» scriveva la nuova
                                quantità come «tutte quelle prima di questa»:
                                premendolo sulla PRIMA di tre si spegnevano
                                tutte e tre insieme, e chi stava dividendo il
                                conto si ritrovava da capo. Le unità sono
                                identiche — quale si toglie non cambia
                                niente — quindi si toglie e si aggiunge una
                                unità per volta. */}
                            <button
                              aria-label={`Togli ${r.name} dal pagamento`}
                              onClick={() => toccaLaUnita(r, i, false)}
                              disabled={closed || !on}
                            >
                              −
                            </button>
                            <strong>{on ? 1 : 0}/1</strong>
                            <button
                              aria-label={`Paga ${r.name}`}
                              onClick={() => toccaLaUnita(r, i, true)}
                              disabled={closed || on}
                            >
                              +
                            </button>
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )
              }
              return (
                <div className="row between" key={r.key} style={{ alignItems: 'center', marginTop: 8 }}>
                  <span className="grow" style={{ fontSize: '0.92rem' }}>
                    {r.custom ? '✨ ' : ''}{r.name}
                    <span className="muted small"> · {r.qty}× {formatPrice(r.unit_price)}</span>
                  </span>
                  <span className="qty">
                    <button aria-label={`Togli ${r.name} dal pagamento`} onClick={() => bump(r, -1)} disabled={closed || s === 0}>−</button>
                    <strong>{s}/{r.qty}</strong>
                    <button aria-label={`Paga ${r.name}`} onClick={() => bump(r, 1)} disabled={closed || s >= r.qty}>+</button>
                  </span>
                </div>
              )
            })}
            {remaining.length === 0 && !closed && (
              <p className="muted small">Nessun articolo da pagare{due > 0 ? ': resta il residuo (coperto/servizio).' : '.'}</p>
            )}
            {remaining.length > 0 && !allSelected && !closed && (
              <button
                className="btn ghost small block"
                style={{ marginTop: 10 }}
                onClick={() => {
                  setSel(fullSelection(order))
                  setSelUnita({})
                }}
              >
                Rimetti tutto in pagamento
              </button>
            )}

            {(order.payments || []).length > 0 && (
              <div style={{ marginTop: 14 }}>
                <span className="muted small" style={{ letterSpacing: 0.5 }}>GIÀ PAGATO</span>
                {dettaglioIncassi(order).incassi.map((p, idx) => (
                  <div key={idx} style={{ marginTop: 4 }}>
                    <div className="row between muted small">
                      <span>
                        {/* «Acconto» quando l'importo è stato battuto a mano:
                            quei 30 € non coprono nessuna riga in
                            particolare, sono soldi lasciati sul conto. Le
                            righe le copre solo chi le sceglie qui a
                            sinistra. */}
                        {p.cosa ? 'Pagate' : 'Acconto'}
                        {p.metodo ? ` · ${PAYMENT_METHOD_LABELS[p.metodo] || p.metodo}` : ''}
                        {p.quando ? ` · ${String(p.quando).slice(11, 16)}` : ''}
                      </span>
                      <span>{formatPrice(p.importo)}</span>
                    </div>
                    {p.cosa && (
                      <div className="muted small" style={{ paddingLeft: 10, opacity: 0.8 }}>
                        {p.cosa.join(' · ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Riepilogo come nel POS: Pagato (verde) / Dovuto (rosso) / Totale */}
          <div style={{ flexShrink: 0, borderTop: '1px solid var(--line)', paddingTop: 8 }}>
            {(order.discount_amount || 0) > 0 && (
              <div className="row between muted small">
                <span>Sconto</span>
                <span>−{formatPrice(order.discount_amount)}</span>
              </div>
            )}
            <div className="row between small">
              <span style={{ color: '#2ecc71' }}>Pagato</span>
              <span style={{ color: '#2ecc71' }}>{formatPrice(paid)}</span>
            </div>
            <div className="row between small">
              <span style={{ color: '#e74c3c' }}>Ammontare dovuto</span>
              <span style={{ color: '#e74c3c' }}>{formatPrice(due)}</span>
            </div>
            <div className="row between" style={{ marginTop: 4 }}>
              <strong>Totale</strong>
              <strong className="price">{formatPrice(order.total)}</strong>
            </div>
          </div>
        </div>

        {/* ── CENTRO: display + tastierino + Riscuotere + Preconto ── */}
        <div className="payscreen-pad">
          <div className="row between" style={{ alignItems: 'baseline', flexShrink: 0 }}>
            <span className="muted small">
              AMMONTARE DOVUTO
              <br />
              <span style={{ fontSize: '1.2rem' }}>{formatPrice(due)}</span>
            </span>
            <span style={{ textAlign: 'right' }}>
              <span className="muted small" style={{ letterSpacing: 0.5 }}>
                {/* DA DOVE VIENE QUESTO NUMERO. «Pagamento» non distingue due
                    cose diverse: le righe scelte (che coprono esattamente
                    quelle) e un importo battuto a mano (che non copre
                    niente, è un acconto). Dirlo qui evita di scoprirlo dopo,
                    a conto chiuso. */}
                {manual
                  ? 'IMPORTO A MANO'
                  : splitting
                    ? `RIGHE SCELTE (${selection.reduce((n, r) => n + (Number(r.qty) || 0), 0)})`
                    : 'PAGAMENTO'}
                {op ? ` (${acc != null ? formatPrice(acc) : ''} ${op === 'x' ? '×' : op})` : ''}
              </span>
              <br />
              <strong style={{ fontSize: '2rem', color: '#3f7ce0' }} data-testid="pay-amount">
                {formatPrice(amount)}
              </strong>
            </span>
          </div>
          {/* Un importo battuto a mano che non salda il conto è un ACCONTO:
              resta sul conto e non copre righe precise. Meglio dirlo prima di
              incassare che scoprirlo dopo, quando restano righe «da pagare»
              che qualcuno credeva pagate. */}
          {manual && amount > 0 && amount < due && (
            <p className="muted small" style={{ margin: '2px 0 0', textAlign: 'right' }}>
              Acconto: resta sul conto, non copre righe precise.
            </p>
          )}
          {change > 0 && method === 'banco' && (
            <p className="small" style={{ margin: '2px 0 0', textAlign: 'right', flexShrink: 0 }}>
              Resto: <strong>{formatPrice(change)}</strong> (si incassano {formatPrice(toPay)})
            </p>
          )}
          {/* L'avviso ha senso solo se si sta seguendo la preparazione: con la
              gestione spenta non esistono comande "da servire" — sono servite
              per definizione — e leggerlo a ogni incasso era un allarme che non
              voleva dire niente. */}
          {/* Col servizio seguito, incassare NON chiude: il conto resta
              aperto finché le comande non sono servite. Prima qui c'era
              scritto il contrario. */}
          {!autoServeBase && !served && !closed && (
            <p className="muted small" style={{ margin: '2px 0 0', flexShrink: 0 }}>
              ⚠️ Comande non ancora servite: il conto resta aperto anche dopo
              l'incasso{riscuotiEServi ? ', a meno di «Riscuoti e servi»' : ''}.
            </p>
          )}
          {readerStarted && order.payment_status === 'in_attesa' && (
            <p className="muted small" style={{ margin: '2px 0 0', flexShrink: 0 }}>
              📟 Transazione avviata sul lettore: il conto si aggiorna da solo all'esito.
            </p>
          )}
          {closed && <p style={{ margin: '2px 0 0', flexShrink: 0 }}>✅ Conto pagato e chiuso.</p>}

          <div className="paypad" role="group" aria-label="Tastierino importo">
            <button className="paypad-key danger" onClick={clear}>C</button>
            <button className="paypad-key accent" onClick={() => divideBy(2)}>/2</button>
            <button className="paypad-key accent" onClick={() => divideBy(3)}>/3</button>
            <button className="paypad-key accent" onClick={() => setOperator('/')}>÷</button>
            <button className="paypad-key" onClick={() => key('7')}>7</button>
            <button className="paypad-key" onClick={() => key('8')}>8</button>
            <button className="paypad-key" onClick={() => key('9')}>9</button>
            <button className="paypad-key accent" onClick={() => setOperator('x')}>×</button>
            <button className="paypad-key" onClick={() => key('4')}>4</button>
            <button className="paypad-key" onClick={() => key('5')}>5</button>
            <button className="paypad-key" onClick={() => key('6')}>6</button>
            <button className="paypad-key accent" onClick={() => setOperator('-')}>−</button>
            <button className="paypad-key" onClick={() => key('1')}>1</button>
            <button className="paypad-key" onClick={() => key('2')}>2</button>
            <button className="paypad-key" onClick={() => key('3')}>3</button>
            <button className="paypad-key accent" onClick={() => setOperator('+')}>+</button>
            <button className="paypad-key" onClick={() => key('00')}>00</button>
            <button className="paypad-key" onClick={() => key('0')}>0</button>
            <button className="paypad-key accent" onClick={equals}>=</button>
            <button className="paypad-key danger" aria-label="Cancella cifra" onClick={back}>←</button>
          </div>

          {scontoFuoriMisura && (
            <div className="banner" style={{ marginTop: 10 }}>
              Lo sconto ({formatPrice(order.discount_amount)}) supera il totale del conto (
              {formatPrice(order.total)}): correggilo qui sotto prima di incassare.
            </div>
          )}

          {!closed && (
            <button
              className="btn block payscreen-collect"
              disabled={saving || scontoFuoriMisura || (due > 0 && !(toPay > 0))}
              onClick={() => riscuoti()}
            >
              {due <= 0 ? 'Chiudi conto · 0,00 €' : `Riscuotere · ${formatPrice(toPay)}`}
            </button>
          )}
          {/* Consegnato e incassato nello stesso gesto: un tasto solo invece
              di incassare qui e poi servire dalla coda. Solo dove il locale
              lo ha chiesto, e solo se c'è ancora qualcosa da servire. */}
          {!closed && riscuotiEServi && !autoServeBase && !served && (
            <button
              className="btn block ghost payscreen-collect-servi"
              disabled={saving || scontoFuoriMisura || (due > 0 && !(toPay > 0))}
              onClick={() => riscuoti({ servi: true })}
            >
              Riscuoti e servi · chiude il conto
            </button>
          )}

          {/* Come nel POS: Codice Lotteria · Preconto · Invia fattura */}
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexShrink: 0 }}>
            <button className="btn ghost small grow" onClick={() => setShowLottery(true)}>
              🎟 Codice Lotteria{order.lottery_code ? ' ✓' : ''}
            </button>
            <button
              className="btn ghost small grow"
              onClick={() => printScontrino(order).catch((e) => setError(`Stampa: ${e.message}`))}
            >
              🖨 Preconto
            </button>
            <button className="btn ghost small grow" onClick={() => setShowInvoice(true)}>
              📧 Invia fattura{order.invoice_number ? ' ✓' : ''}
            </button>
          </div>
        </div>

        {/* ── DESTRA: metodi di pagamento + Sconto ── */}
        <div className="payscreen-methods">
          {methods.map((m) => {
            // Un metodo spento resta CLICCABILE apposta: `disabled` non fa
            // partire il tocco, e chi incassa resta a premere un tasto morto
            // senza sapere perché. Qui è spento a vedersi (`spento`), e al
            // tocco dice il motivo invece di non fare niente.
            const spento = m.disabled && !closed
            return (
              <button
                key={m.key}
                className={`payscreen-method${method === m.key ? ' active' : ''}${spento ? ' spento' : ''}`}
                aria-pressed={method === m.key}
                aria-disabled={spento || undefined}
                disabled={closed || (m.disabled && !m.motivo)}
                onClick={() => (spento ? toastError(m.motivo) : setMethod(m.key))}
              >
                {m.emoji} {m.label}
                {m.key === 'lettore' && readerReady && settings.sumup_reader_name ? (
                  <span className="muted small"> ({settings.sumup_reader_name})</span>
                ) : null}
              </button>
            )
          })}

          <div style={{ marginTop: 'auto' }}>
            {!closed && (
              <button className="btn ghost small block" onClick={() => setShowDiscount(true)}>
                {order.discount?.type === 'buono' ? '🎟 Buono' : '🎁 Sconto'}
                {(order.discount_amount || 0) > 0 ? ` (−${formatPrice(order.discount_amount)})` : ''}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Modale SCONTO: tastierino come quello del pagamento ── */}
      {showDiscount && (
        <div className="overlay confirm-overlay" onClick={() => setShowDiscount(false)}>
          <div
            className="confirm-box"
            role="dialog"
            aria-label="Sconto"
            style={{ width: 'min(320px, 94vw)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="row between" style={{ alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>🎁 Sconto</h3>
              <button className="btn ghost small" onClick={() => setShowDiscount(false)}>✕</button>
            </div>

            <div className="row" style={{ gap: 6, marginTop: 10 }}>
              <button
                className={`btn small grow ${discType === 'percent' ? '' : 'ghost'}`}
                onClick={() => {
                  setDiscType('percent')
                  setDiscDigits('')
                }}
              >
                %
              </button>
              <button
                className={`btn small grow ${discType === 'euro' ? '' : 'ghost'}`}
                onClick={() => {
                  setDiscType('euro')
                  setDiscDigits('')
                }}
              >
                €
              </button>
              <button
                className={`btn small grow ${discType === 'buono' ? '' : 'ghost'}`}
                disabled={vipList.length === 0}
                title={vipList.length === 0 ? 'Nessun buono con saldo' : 'Sconto col buono'}
                onClick={() => {
                  setDiscType('buono')
                  setDiscDigits('')
                }}
              >
                🎟
              </button>
            </div>

            {/* BUONO: si sceglie il beneficiario; l'importo (parziale) attinge
                al suo saldo e si applica al totale come uno sconto. */}
            {discType === 'buono' && (
              <div style={{ marginTop: 10 }}>
                <label htmlFor="disc-voucher">🎟 Buono di</label>
                <select
                  id="disc-voucher"
                  value={voucherId}
                  onChange={(e) => {
                    setVoucherId(e.target.value)
                    setDiscDigits('')
                  }}
                  style={{ width: '100%' }}
                >
                  <option value="">— Scegli il beneficiario —</option>
                  {vipList.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.holder_name} · saldo {formatPrice(v.balance)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ textAlign: 'center', margin: '10px 0 2px' }}>
              <strong style={{ fontSize: '1.8rem' }} data-testid="disc-amount">
                {discType === 'percent'
                  ? `${discValue}%`
                  : discType === 'buono'
                    ? formatPrice(voucherReq)
                    : formatPrice(discValue)}
              </strong>
              <p className="muted small" style={{ margin: '2px 0 0' }}>
                {discType === 'buono'
                  ? chosenVoucher
                    ? `Dal buono: −${formatPrice(voucherRedeem)}${voucherRedeem < voucherReq ? ' (saldo/totale insufficiente)' : ''}`
                    : 'Scegli un beneficiario'
                  : `Sconto sul conto: −${formatPrice(discPreview)}`}
              </p>
            </div>

            {/* Tre colonne, non quattro: qui non ci sono gli operatori, e con la
                griglia del pagamento le cifre andavano a capo dove capitava
                (7 8 9 4 / 5 6 1 2 / 3 C 0 ←). Sul tastierino si batte a memoria. */}
            <div className="paypad paypad-cifre" style={{ marginTop: 8, minHeight: 'auto' }}>
              {['7', '8', '9', '4', '5', '6', '1', '2', '3'].map((d) => (
                <button key={d} className="paypad-key" onClick={() => setDiscDigits((s) => (s + d).slice(0, 6))}>
                  {d}
                </button>
              ))}
              <button className="paypad-key danger" onClick={() => setDiscDigits('')}>C</button>
              <button className="paypad-key" onClick={() => setDiscDigits((s) => (s + '0').slice(0, 6))}>0</button>
              <button
                className="paypad-key danger"
                aria-label="Cancella cifra sconto"
                onClick={() => setDiscDigits((s) => s.slice(0, -1))}
              >
                ←
              </button>
            </div>

            <button
              className="btn block"
              style={{ marginTop: 10 }}
              disabled={saving || (discType === 'buono' && !(voucherRedeem > 0))}
              onClick={applyDiscount}
            >
              Applica {(discType === 'buono' ? voucherRedeem : discPreview) > 0
                ? `(−${formatPrice(discType === 'buono' ? voucherRedeem : discPreview)})`
                : ''}
            </button>
            {(order.discount_amount || 0) > 0 && (
              <button
                className="btn ghost small block"
                style={{ marginTop: 6 }}
                disabled={saving}
                onClick={() => {
                  setOptimisticDisc({ disc: null, amount: 0 })
                  setShowDiscount(false)
                  setDiscDigits('')
                  ;(async () => {
                    try {
                      await setOrderDiscount(await orderId(), null)
                    } catch (e) {
                      setOptimisticDisc(null)
                      toastError(`Sconto non rimosso: ${e.message}`)
                    }
                  })()
                }}
              >
                Rimuovi sconto
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Modale CODICE LOTTERIA (lotteria degli scontrini) ── */}
      {showLottery && (
        <div className="overlay confirm-overlay" onClick={() => setShowLottery(false)}>
          <div
            className="confirm-box"
            role="dialog"
            aria-label="Codice Lotteria"
            style={{ width: 'min(360px, 94vw)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="row between" style={{ alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>🎟 Codice Lotteria</h3>
              <button className="btn ghost small" onClick={() => setShowLottery(false)}>✕</button>
            </div>
            <p className="muted small" style={{ margin: '8px 0' }}>
              Il codice della "lotteria degli scontrini" che il cliente mostra
              al pagamento: viene salvato sul conto e stampato sullo scontrino.
            </p>
            <label htmlFor="ps-lottery">Codice</label>
            <input
              id="ps-lottery"
              value={lotteryCode}
              onChange={(e) => setLotteryCode(e.target.value.toUpperCase())}
              placeholder="Es. ABCD1234"
              style={{ width: '100%' }}
            />
            <button className="btn block" style={{ marginTop: 10 }} disabled={saving} onClick={saveLottery}>
              Salva codice
            </button>
          </div>
        </div>
      )}

      {/* ── Modale INVIA FATTURA (fattura di cortesia) ── */}
      {showInvoice && (
        <div className="overlay confirm-overlay" onClick={() => setShowInvoice(false)}>
          <div
            className="confirm-box"
            role="dialog"
            aria-label="Invia fattura"
            style={{ width: 'min(420px, 94vw)', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="row between" style={{ alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>📧 Fattura di cortesia</h3>
              <button className="btn ghost small" onClick={() => setShowInvoice(false)}>✕</button>
            </div>

            {invoice ? (
              <>
                <p style={{ margin: '10px 0 4px' }}>
                  ✅ Emessa la fattura <strong>n. {invoice.number}</strong> ·{' '}
                  {formatPrice(invoice.total)}
                </p>
                <p className="muted small" style={{ margin: '0 0 10px' }}>
                  Intestata a {invoice.customer?.denominazione}. La ritrovi nel
                  gestionale, tab Fatture.
                </p>
                <button className="btn block" onClick={() => sendInvoiceEmail(invoice)}>
                  📧 Invia via email{invoice.customer?.email ? ` a ${invoice.customer.email}` : ''}
                </button>
                <button
                  className="btn secondary block"
                  style={{ marginTop: 6 }}
                  onClick={() => printFattura(invoice).catch((e) => setError(`Stampa: ${e.message}`))}
                >
                  🖨 Stampa fattura
                </button>
              </>
            ) : (
              <>
                {order.invoice_number && (
                  <p className="muted small" style={{ margin: '8px 0 0' }}>
                    ⚠️ Per questo conto risulta già emessa la fattura n.{' '}
                    {order.invoice_number} (vedi tab Fatture).
                  </p>
                )}
                <p className="muted small" style={{ margin: '8px 0' }}>
                  Documento di cortesia con i dati del cliente (la fattura
                  elettronica vera resta al commercialista/SDI).
                </p>
                <label htmlFor="inv-den">Ragione sociale / Nome *</label>
                <input
                  id="inv-den"
                  value={billing.denominazione}
                  onChange={(e) => setBilling((b) => ({ ...b, denominazione: e.target.value }))}
                  style={{ width: '100%' }}
                />
                <div className="grid-2" style={{ marginTop: 6 }}>
                  <div>
                    <label htmlFor="inv-piva">P.IVA</label>
                    <input
                      id="inv-piva"
                      value={billing.piva}
                      onChange={(e) => setBilling((b) => ({ ...b, piva: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label htmlFor="inv-cf">Codice fiscale</label>
                    <input
                      id="inv-cf"
                      value={billing.cf}
                      onChange={(e) => setBilling((b) => ({ ...b, cf: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid-2" style={{ marginTop: 6 }}>
                  <div>
                    <label htmlFor="inv-sdi">Codice SDI / PEC</label>
                    <input
                      id="inv-sdi"
                      value={billing.sdi}
                      onChange={(e) => setBilling((b) => ({ ...b, sdi: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label htmlFor="inv-email">Email</label>
                    <input
                      id="inv-email"
                      type="email"
                      value={billing.email}
                      onChange={(e) => setBilling((b) => ({ ...b, email: e.target.value }))}
                    />
                  </div>
                </div>
                <label htmlFor="inv-addr" style={{ marginTop: 6, display: 'block' }}>Indirizzo</label>
                <input
                  id="inv-addr"
                  value={billing.indirizzo}
                  onChange={(e) => setBilling((b) => ({ ...b, indirizzo: e.target.value }))}
                  style={{ width: '100%' }}
                />
                <button
                  className="btn block"
                  style={{ marginTop: 10 }}
                  disabled={saving || !billing.denominazione.trim()}
                  onClick={emettiFattura}
                >
                  Emetti fattura · {formatPrice(order.total)}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
