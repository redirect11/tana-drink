import { useEffect, useMemo, useState } from 'react'
import {
  fetchInventoryItems,
  fetchSuppliers,
  fetchSupplierPrices,
  createPurchaseOrder,
  fetchPurchaseOrders,
  consegnaRigheOrdine,
  segnaRighePagate,
  deletePurchaseOrder,
  fetchSupplierInvoices,
  collegaFatturaAFetta,
} from '../lib/api.js'
import { magazzinoBloccato } from '../lib/inventory.js'
import { purchaseOrderText } from '../lib/warehouse.js'
import { fetteFornitore, livelloDi, ETICHETTA_LIVELLO } from '../lib/listini.js'
import {
  fatturaDellaFetta,
  fattureCollegabili,
  fetteSenzaFattura,
} from '../lib/fatture.js'
import { formatPrice } from '../lib/orderStatus.js'
import { printOrdineFornitore } from '../lib/printer.js'
import { toastSuccess, toastError } from '../lib/toast.js'
import ConfirmDialog from './ConfirmDialog.jsx'
import NuovoOrdinePanel from './NuovoOrdinePanel.jsx'

// ── ORDINI FORNITORE ──────────────────────────────────────────────────
//
// Questo pannello tiene insieme due cose che si guardano una dopo l'altra:
// la COMPOSIZIONE di un ordine nuovo — che è una schermata sua,
// `NuovoOrdinePanel` (REQ-MAG-036) — e lo STORICO di quelli già fatti, che
// resta qui finché non diventa «Lista Ordini» (REQ-MAG-038).
//
// I dati si leggono una volta sola e si passano giù: magazzino, fornitori e
// listini servono a tutte e due, e leggerli due volte vorrebbe dire due
// versioni della stessa serata a schermo nello stesso momento.
export default function PurchaseOrdersPanel() {
  const [suppliers, setSuppliers] = useState([])
  const [items, setItems] = useState([])
  const [listini, setListini] = useState([])
  const [orders, setOrders] = useState([])
  // I documenti servono a dire, fetta per fetta, se la fattura c'è
  // (REQ-MAG-031). Una fetta consegnata e senza documento è uno dei due
  // buchi che a fine mese fanno tornare o non tornare i conti.
  const [invoices, setInvoices] = useState([])
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const [consegnaFor, setConsegnaFor] = useState(null) // { ordine, fetta }
  const [confermaPagato, setConfermaPagato] = useState(null) // { ordine, fetta }
  const [fatturaPer, setFatturaPer] = useState(null) // la fetta da collegare

  async function load() {
    try {
      const [sups, its, list, ords, fatt] = await Promise.all([
        fetchSuppliers(),
        fetchInventoryItems(),
        // La schermata deve reggere anche con ZERO listini: sono da
        // compilare a mano e nessuno ha ancora cominciato.
        fetchSupplierPrices().catch(() => []),
        fetchPurchaseOrders({ limit: 25 }),
        // E deve reggere anche se lo scadenzario non risponde: gli ordini
        // sono la cosa che serve sempre, il documento è un di più.
        fetchSupplierInvoices({ limit: 200 }).catch(() => []),
      ])
      setSuppliers(sups)
      setItems(its)
      setListini(list)
      setOrders(ords)
      setInvoices(fatt)
    } catch (e) {
      setError(e.message)
    }
  }

  useEffect(() => {
    load()
  }, [])

  // IL MAGAZZINO IN SOLA LETTURA VALE ANCHE QUI. Finché il travaso non è
  // fatto, il carico scriverebbe pezzi su giacenze ancora in centilitri: il
  // buco di BUG-029, che questa schermata aveva perché il blocco viveva
  // dentro la schermata del magazzino. La regola sta in inventory.js, e la si
  // chiede — non la si riscrive.
  const bloccato = useMemo(() => magazzinoBloccato(items), [items])

  async function save(lines, totals) {
    if (!lines || lines.length === 0) return
    setBusy(true)
    setError(null)
    try {
      await createPurchaseOrder({ lines, total_net: totals.net, total_gross: totals.gross })
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  // LA CONSEGNA CARICA IL MAGAZZINO, e lo fa per FETTA di fornitore: i
  // fornitori consegnano in giorni diversi, e caricare tutto l'ordine al
  // primo che arriva metterebbe in giacenza merce ancora per strada.
  //
  // Niente `await` prima di mostrare l'esito: `consegnaRigheOrdine` compone
  // l'ordine aggiornato in memoria e le scritture partono in sottofondo.
  function consegna(prezzi, indici) {
    const { ordine } = consegnaFor
    setConsegnaFor(null)
    setError(null)
    consegnaRigheOrdine(ordine.id, { indici, prezzi }).then(
      (o) => setOrders((prev) => prev.map((x) => (x.id === o.id ? o : x))),
      (e) => setError(e.message)
    )
  }

  function paga() {
    const { ordine, fetta } = confermaPagato
    setConfermaPagato(null)
    setError(null)
    segnaRighePagate(ordine.id, { indici: fetta.indici }).then(
      (o) => setOrders((prev) => prev.map((x) => (x.id === o.id ? o : x))),
      (e) => setError(e.message)
    )
  }

  // ATTACCARE E STACCARE SONO LO STESSO GESTO AL CONTRARIO, e passano dalla
  // stessa strada: `order_id` a null stacca. Niente `await` prima di
  // mostrare l'esito — la scrittura parte in sottofondo e il documento
  // aggiornato si compone in memoria.
  function collega(order_id, invoiceId) {
    setFatturaPer(null)
    setError(null)
    collegaFatturaAFetta(invoiceId, { order_id }).then(
      (agg) => setInvoices((prev) => prev.map((f) => (f.id === agg.id ? agg : f))),
      (e) => setError(e.message)
    )
  }

  // Invia la FETTA di quel fornitore: mandare a Nova anche le righe di
  // Enofel è un errore verso il fornitore, non un dettaglio grafico. La
  // fetta ha la stessa forma di un ordine, quindi testo e stampa non
  // cambiano di una riga.
  function inviaEmail(fetta) {
    const body = purchaseOrderText(fetta)
    window.location.href = `mailto:${encodeURIComponent(fetta.email || '')}?subject=${encodeURIComponent(
      `Ordine ${fetta.supplier_name || ''} — ${String(fetta.created_at || '').slice(0, 10)}`
    )}&body=${encodeURIComponent(body)}`
  }

  async function copia(fetta) {
    try {
      await navigator.clipboard.writeText(purchaseOrderText(fetta))
      toastSuccess('Ordine copiato negli appunti')
    } catch (e) {
      toastError(`Copia non riuscita: ${e.message}`)
    }
  }

  async function remove(order) {
    if (!confirm(`Eliminare l'ordine del ${order.created_at?.slice(0, 10)}?`)) return
    try {
      await deletePurchaseOrder(order.id)
      setOrders((prev) => prev.filter((o) => o.id !== order.id))
    } catch (e) {
      setError(e.message)
    }
  }

  const scoperte = useMemo(
    () => fetteSenzaFattura(orders, invoices, { suppliers }),
    [orders, invoices, suppliers]
  )

  return (
    <div>
      {error && <div className="banner">Errore: {error}</div>}

      {/* Gli ordini si scrivono lo stesso — sono carta, non giacenze — ma la
          merce non si può ancora caricare. Dirlo qui, e non solo sul tasto:
          un tasto spento su un tablet non ha nessun posto dove far leggere
          il perché. */}
      {bloccato && (
        <div className="banner">
          <strong>Il magazzino va aggiornato.</strong> Gli ordini si possono
          preparare e mandare; per <strong>caricare la merce</strong> serve
          prima l’aggiornamento, dal <strong>Magazzino</strong> (il banner in
          alto). Se no si sommerebbero pezzi a giacenze scritte alla vecchia
          maniera, e i numeri non tornerebbero più.
        </div>
      )}

      <NuovoOrdinePanel
        items={items}
        suppliers={suppliers}
        listini={listini}
        busy={busy}
        onSalva={save}
      />

      {orders.length > 0 && (
        <div className="card" style={{ marginTop: 12 }}>
          <strong>Storico ordini</strong>
          {/* IL PRIMO DEI DUE BUCHI (REQ-MAG-031): la merce è arrivata, il
              documento no. Il numero sta in testa perché è la domanda che
              uno si fa a fine mese, e scorrere venticinque ordini per
              contarle è il modo in cui non lo si fa. */}
          {scoperte.length > 0 && (
            <div className="muted small" style={{ marginTop: 2 }}>
              {scoperte.length === 1
                ? '1 consegna senza fattura'
                : `${scoperte.length} consegne senza fattura`}
            </div>
          )}
          {orders.map((o) => (
            <div key={o.id} style={{ marginTop: 10 }}>
              <div className="row between" style={{ alignItems: 'center' }}>
                <span className="muted small">
                  {o.created_at?.slice(0, 10)} · {o.lines.length} art. · {formatPrice(o.total_gross)}
                </span>
                <button className="btn ghost small" title="Elimina l’ordine" onClick={() => remove(o)}>🗑</button>
              </div>
              {/* L'ORDINE È UNO, coi fornitori dentro; il per-fornitore è una
                  VISTA (REQ-MAG-025 del 20/08). Ma email, stampa e consegna
                  vanno per fetta, perché è per fetta che il fornitore
                  consegna e fattura. */}
              <div className="inv-list">
              {fetteFornitore(o, { suppliers }).map((fetta) => {
                const fattura = fatturaDellaFetta(invoices, fetta)
                return (
                <div
                  className="inv-row"
                  key={fetta.supplier_id || 'senza'}
                  style={{ borderLeftColor: fetta.colore || undefined }}
                >
                  <div className="inv-row-main" style={{ flexWrap: 'wrap' }}>
                    <span className="grow" style={{ minWidth: 0 }}>
                      <span className="inv-row-name">{fetta.supplier_name || 'Senza fornitore'}</span>{' '}
                      <span className="muted small">{ETICHETTA_LIVELLO[fetta.stato]}</span>
                      <span className="muted small" style={{ display: 'block' }}>
                        {fetta.lines.map((l) => `${l.qty_packages}× ${l.name}`).join(', ')}
                      </span>
                      <span className="muted small" style={{ display: 'block' }}>
                        netto {formatPrice(fetta.total_net)}
                      </span>
                      {/* IL DOCUMENTO DI QUESTA FETTA (REQ-MAG-031): è il
                          fornitore che rilascia la fattura, quindi sta qui e
                          non sull'ordine intero. L'ambra dice «manca», non
                          «sbagliato»: il rosso in questa app vuol dire
                          annullato (DESIGN.md). */}
                      {fattura ? (
                        <span className="muted small" style={{ display: 'block' }}>
                          Fattura {fattura.number ? `#${fattura.number} ` : ''}
                          {fattura.date || ''} · {formatPrice(fattura.amount)}
                        </span>
                      ) : fetta.stato !== 'richiesto' ? (
                        <span className="badge-low" style={{ marginTop: 2 }}>manca la fattura</span>
                      ) : null}
                    </span>
                    <span className="row" style={{ gap: 4 }}>
                      {fetta.stato === 'richiesto' && (
                        <button
                          className="btn small"
                          onClick={() => setConsegnaFor({ ordine: o, fetta })}
                          // Spento col perché, non sparito: un tasto che non
                          // c'è fa dubitare di averlo immaginato, e chi
                          // aspetta la merce lo cerca.
                          disabled={busy || bloccato}
                          title={
                            bloccato
                              ? 'Prima va aggiornato il magazzino alla nuova gestione (Magazzino → il banner in alto).'
                              : undefined
                          }
                        >
                          📦 Consegnato
                        </button>
                      )}
                      {fetta.stato === 'consegnato' && (
                        <button className="btn small" onClick={() => setConfermaPagato({ ordine: o, fetta })}>
                          💶 Pagato
                        </button>
                      )}
                      {/* Il nome del fornitore sta nell'etichetta e non solo
                          nel `title`: con tre fette a schermo, tre tasti
                          «📧» uguali non dicono a chi si sta scrivendo — e
                          questi tasti mandano roba fuori dal locale. */}
                      <button
                        className="btn ghost small"
                        aria-label={`Invia a ${fetta.supplier_name || 'fornitore'}`}
                        title={`Invia a ${fetta.supplier_name || 'fornitore'}`}
                        onClick={() => inviaEmail(fetta)}
                      >
                        📧
                      </button>
                      <button
                        className="btn ghost small"
                        aria-label={`Copia l’ordine di ${fetta.supplier_name || 'fornitore'}`}
                        title="Copia il testo"
                        onClick={() => copia(fetta)}
                      >
                        📋
                      </button>
                      <button
                        className="btn ghost small"
                        aria-label={`Stampa l’ordine di ${fetta.supplier_name || 'fornitore'}`}
                        title="Stampa"
                        onClick={() => printOrdineFornitore(fetta).catch((e) => toastError(`Stampa: ${e.message}`))}
                      >
                        🖨
                      </button>
                      {/* Il gancio col documento, nei due sensi: da qui si
                          attacca e da qui si stacca. Una fetta senza
                          fornitore non può averne uno — la fattura la
                          rilascia qualcuno. */}
                      {fetta.supplier_id && (
                        <button
                          className="btn ghost small"
                          aria-label={
                            fattura
                              ? `Scollega la fattura di ${fetta.supplier_name}`
                              : `Collega una fattura a ${fetta.supplier_name}`
                          }
                          title={fattura ? 'Scollega la fattura' : 'Collega una fattura'}
                          onClick={() =>
                            fattura ? collega(null, fattura.id) : setFatturaPer(fetta)
                          }
                        >
                          {fattura ? '🔗✕' : '🧾'}
                        </button>
                      )}
                    </span>
                  </div>
                </div>
                )
              })}
              </div>
            </div>
          ))}
        </div>
      )}

      {consegnaFor && (
        <DialogoConsegna
          fetta={consegnaFor.fetta}
          onCancel={() => setConsegnaFor(null)}
          onConfirm={consegna}
        />
      )}

      {fatturaPer && (
        <DialogoFattura
          fetta={fatturaPer}
          fatture={invoices}
          onCancel={() => setFatturaPer(null)}
          onConfirm={(invoiceId) => collega(fatturaPer.order_id, invoiceId)}
        />
      )}

      {confermaPagato && (
        <ConfirmDialog
          title="💶 Fattura pagata?"
          message={`Le righe di ${confermaPagato.fetta.supplier_name || 'questo fornitore'} passano a «pagato» (netto ${formatPrice(confermaPagato.fetta.total_net)}).`}
          confirmLabel="Segna pagato"
          onCancel={() => setConfermaPagato(null)}
          onConfirm={paga}
        />
      )}
    </div>
  )
}

// ── LA FATTURA DI QUESTA FETTA ───────────────────────────────────────
//
// I documenti proposti sono solo quelli DELLO STESSO FORNITORE e ancora
// liberi: agganciare la fattura di Nova alla fetta di Enofel non è un errore
// di battitura, è merce pagata a chi non l'ha venduta. Il modo di impedirlo
// è non farla comparire, non spiegarlo dopo.
function DialogoFattura({ fetta, fatture, onCancel, onConfirm }) {
  const [scelta, setScelta] = useState('')
  const candidate = useMemo(() => fattureCollegabili(fatture, fetta), [fatture, fetta])
  return (
    <div className="overlay confirm-overlay" onClick={onCancel}>
      <div className="confirm-box" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>🧾 La fattura di {fetta.supplier_name}</h3>
        <p className="muted">
          Si collega un documento di {fetta.supplier_name} a questa parte
          dell’ordine: quello che ha mandato lui, per la merce che ha portato
          lui.
        </p>
        {candidate.length === 0 ? (
          <p className="muted small">
            Nessun documento di {fetta.supplier_name} da collegare. Si scrive
            nello <strong>Scadenzario</strong>, e da lì si collega anche a
            questo ordine.
          </p>
        ) : (
          <>
            <label htmlFor="pf-fattura">Documento</label>
            <select id="pf-fattura" value={scelta} onChange={(e) => setScelta(e.target.value)}>
              <option value="">— Scegli un documento —</option>
              {candidate.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.number ? `#${f.number} · ` : ''}
                  {f.date || '—'} · {formatPrice(f.amount)}
                </option>
              ))}
            </select>
          </>
        )}
        <div className="row" style={{ gap: 10, marginTop: 16 }}>
          <button className="btn ghost grow" onClick={onCancel}>Annulla</button>
          <button className="btn grow" disabled={!scelta} onClick={() => onConfirm(scelta)}>
            Collega
          </button>
        </div>
      </div>
    </div>
  )
}

// ── ALLA CONSEGNA SI CORREGGE IL PREZZO, MAI IL FORNITORE ────────────
//
// Flavio: «prendo dieci cose, mi esce 300 euro di ordine; una volta che il
// fornitore mi scarica l'ordine vedo se veramente sono 300 o di più o di
// meno, e modifico il prezzo quando necessario. NON POSSO MODIFICARE IL
// FORNITORE PERCHÉ DA LUI L'HO COMPRATO».
//
// RIGA PER RIGA, PIÙ UN TASTO CHE LE PRENDE TUTTE (REQ-MAG-025 punto 4,
// REQ-MAG-032). Il fornitore consegna quello che ha, non quello che è stato
// ordinato: le due casse su tre arrivate si caricano, la terza resta
// «richiesta» e si carica quando arriva. Si parte con TUTTO spuntato, che è
// il caso normale — chi non tocca niente carica quello che ha ordinato — e
// il tasto dice sempre quante righe sta per caricare e se sono tutte: un
// carico fatto alla cieca lo si scopre contando le bottiglie.
//
// Le righe già consegnate non compaiono: di lì si carica, non si ricarica.
function DialogoConsegna({ fetta, onCancel, onConfirm }) {
  const [prezzi, setPrezzi] = useState({})
  const righe = useMemo(
    () =>
      fetta.lines
        .map((l, k) => ({ l, i: fetta.indici[k] }))
        .filter(({ l }) => livelloDi(l) === 'richiesto' && (Number(l.qty_packages) || 0) > 0),
    [fetta]
  )
  const [scelti, setScelti] = useState(() => new Set(righe.map((r) => r.i)))
  const tutte = scelti.size === righe.length && righe.length > 0
  const valore = (i, l) => prezzi[i] ?? String(Number(l.unit_cost) || 0)
  const totale = righe.reduce(
    (t, { l, i }) => t + (scelti.has(i) ? (Number(l.qty_packages) || 0) * (Number(valore(i, l)) || 0) : 0),
    0
  )
  const spunta = (i, dentro) =>
    setScelti((prev) => {
      const next = new Set(prev)
      if (dentro) next.add(i)
      else next.delete(i)
      return next
    })
  return (
    <div className="overlay confirm-overlay" onClick={onCancel}>
      <div className="confirm-box" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>
          📦 Merce arrivata da {fetta.supplier_name || 'questo fornitore'}?
        </h3>
        <p className="muted">
          Togli la spunta a quello che non è arrivato: resta in attesa e si
          carica quando arriva. Controlla i prezzi come sono sul documento —
          quello che scrivi qui diventa il prezzo di questo fornitore e il
          costo del prodotto.
        </p>
        {righe.length > 1 && (
          <button
            type="button"
            className="btn ghost small"
            onClick={() => setScelti(tutte ? new Set() : new Set(righe.map((r) => r.i)))}
          >
            {tutte ? 'Togli tutte le spunte' : 'Spunta tutte'}
          </button>
        )}
        {righe.map(({ l, i }) => (
          <div className="row between" key={i} style={{ alignItems: 'center', marginTop: 6, gap: 8 }}>
            <label className="row grow" style={{ minWidth: 0, gap: 6, alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={scelti.has(i)}
                aria-label={`Carica ${l.name}`}
                onChange={(e) => spunta(i, e.target.checked)}
              />
              <span style={{ minWidth: 0 }}>
                {l.qty_packages}× {l.name}
              </span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              aria-label={`Prezzo di ${l.name}`}
              value={valore(i, l)}
              onChange={(e) => setPrezzi((p) => ({ ...p, [i]: e.target.value }))}
              style={{ width: 96, textAlign: 'right' }}
            />
          </div>
        ))}
        <div className="row between" style={{ marginTop: 10 }}>
          <span className="muted">Totale netto</span>
          <strong>{formatPrice(totale)}</strong>
        </div>
        <div className="row" style={{ gap: 10, marginTop: 16 }}>
          <button className="btn ghost grow" onClick={onCancel}>Annulla</button>
          <button
            className="btn grow"
            disabled={scelti.size === 0}
            onClick={() => onConfirm(prezzi, [...scelti])}
          >
            {tutte ? `Carica tutti (${scelti.size})` : `Carica i selezionati (${scelti.size})`}
          </button>
        </div>
      </div>
    </div>
  )
}
