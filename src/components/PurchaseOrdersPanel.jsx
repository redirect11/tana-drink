import { useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchInventoryItems,
  fetchSuppliers,
  fetchSupplierPrices,
  createPurchaseOrder,
  fetchPurchaseOrders,
  consegnaRigheOrdine,
  segnaRighePagate,
  deletePurchaseOrder,
} from '../lib/api.js'
import {
  formatQty,
  contenutoDelPezzo,
  magazzinoBloccato,
  stockStatus,
} from '../lib/inventory.js'
import { purchaseOrderTotals, suggestedPackages, purchaseOrderText } from '../lib/warehouse.js'
import {
  catalogoOrdinabile,
  filtraCatalogo,
  righeDiProdotto,
  fornitoreProposto,
  piuEconomica,
  fornitoriGiaUsati,
  fetteFornitore,
  ETICHETTA_LIVELLO,
} from '../lib/listini.js'
import { formatPrice } from '../lib/orderStatus.js'
import { printOrdineFornitore } from '../lib/printer.js'
import { toastSuccess, toastError } from '../lib/toast.js'
import ConfirmDialog from './ConfirmDialog.jsx'

// Il catalogo intero sono quasi quattrocento prodotti moltiplicati per
// quanti fornitori li vendono: disegnarli tutti appesantisce la schermata, e
// nessuno scorre quattrocento righe — si cerca. Il limite si dice, così chi
// non trova qualcosa sa che deve restringere, non che manca.
const LIMITE_CATALOGO = 60

// ── ORDINI FORNITORE ──────────────────────────────────────────────────
//
// SI PARTE DAL PRODOTTO, NON DAL FORNITORE (REQ-MAG-029). La schermata di
// prima chiedeva prima il fornitore e mostrava solo i suoi prodotti:
// scegliendo NOVA se ne vedevano tre su 388, perché il legame
// prodotto-fornitore in magazzino quasi non esiste. Flavio: «sarebbe buono
// se avesse il campetto di ricerca, in modo tale che io posso mettere il
// prodotto INDIPENDENTEMENTE da quale fornitore resta associato».
//
// Quindi: in alto la ricerca, sotto il catalogo con una riga per coppia
// prodotto-fornitore (i doppioni si distinguono dal colore e dal nome del
// fornitore), e il fornitore si sceglie sulla RIGA DELL'ORDINE, che è dove
// la decisione conta davvero.
export default function PurchaseOrdersPanel() {
  const [suppliers, setSuppliers] = useState([])
  const [items, setItems] = useState([])
  const [listini, setListini] = useState([])
  const [orders, setOrders] = useState([])
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const [query, setQuery] = useState('')
  const [filtroFornitore, setFiltroFornitore] = useState('all')
  // L'ordine in composizione: una riga per prodotto-fornitore scelto. Il
  // `rid` è un numero interno che resta lo stesso anche cambiando fornitore
  // alla riga — se la chiave fosse prodotto+fornitore, cambiando tendina
  // React smonterebbe il campo e la quantità appena scritta sparirebbe.
  const [bozza, setBozza] = useState([])
  const prossimoRid = useRef(1)
  const [consegnaFor, setConsegnaFor] = useState(null) // { ordine, fetta }
  const [confermaPagato, setConfermaPagato] = useState(null) // { ordine, fetta }

  async function load() {
    try {
      const [sups, its, list, ords] = await Promise.all([
        fetchSuppliers(),
        fetchInventoryItems(),
        // La schermata deve reggere anche con ZERO listini: sono da
        // compilare a mano e nessuno ha ancora cominciato.
        fetchSupplierPrices().catch(() => []),
        fetchPurchaseOrders({ limit: 25 }),
      ])
      setSuppliers(sups)
      setItems(its)
      setListini(list)
      setOrders(ords)
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

  // Fuori assortimento vuol dire «non si ricompra» (REQ-MAG-007): resta
  // fuori dal catalogo ordinabile, come nella schermata di prima.
  const ordinabili = useMemo(() => items.filter((i) => i.status !== 'out'), [items])
  const catalogo = useMemo(
    () => catalogoOrdinabile({ items: ordinabili, listini, suppliers }),
    [ordinabili, listini, suppliers]
  )
  const visibili = useMemo(
    () => filtraCatalogo(catalogo, { query, supplierId: filtroFornitore }),
    [catalogo, query, filtroFornitore]
  )

  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
  const supsById = useMemo(() => new Map(suppliers.map((s) => [s.id, s])), [suppliers])

  // Le righe dell'ordine, nella forma in cui vengono salvate.
  const lines = useMemo(
    () =>
      bozza
        .map((r) => {
          const it = itemsById.get(r.item_id)
          if (!it) return null
          const listino = righeDiProdotto(it, listini).find((x) => x.supplier_id === r.supplier_id)
          const sup = r.supplier_id ? supsById.get(r.supplier_id) : null
          return {
            item_id: it.id,
            name: it.name,
            unit: it.unit,
            package_size: it.package_size ?? null,
            // Il prezzo è quello del listino DI QUEL FORNITORE; senza riga
            // di listino si ricade sul costo del prodotto, che è l'ultimo
            // pagato a chiunque.
            unit_cost: listino?.price != null ? Number(listino.price) : Number(it.cost) || 0,
            vat: it.vat ?? 22,
            qty_packages: Number(r.qty) || 0,
            supplier_id: r.supplier_id ?? null,
            supplier_name: sup?.name ?? null,
            code: listino?.code ?? null,
            stato: 'richiesto',
          }
        })
        .filter((l) => l && l.qty_packages > 0),
    [bozza, itemsById, listini, supsById]
  )
  const totals = useMemo(() => purchaseOrderTotals(lines), [lines])

  // Aggiunge una riga del catalogo all'ordine. Se quella coppia c'è già non
  // se ne fa una seconda: si somma alla quantità, perché due righe uguali
  // nello stesso ordine sono un doppione e non una scelta.
  function aggiungi(riga, quanti = null) {
    const suggerite = quanti ?? Math.max(1, suggestedPackages(riga.item))
    setBozza((prev) => {
      const gia = prev.find((r) => r.item_id === riga.item_id && r.supplier_id === riga.supplier_id)
      if (gia) {
        return prev.map((r) => (r === gia ? { ...r, qty: (Number(r.qty) || 0) + suggerite } : r))
      }
      // Senza un fornitore sulla riga si propone quello dell'ULTIMO
      // ACQUISTO — non il più economico, che è quasi sempre il più vecchio.
      const proposto = riga.supplier_id
        ? riga.supplier_id
        : (fornitoreProposto(righeDiProdotto(riga.item, listini))?.supplier_id ?? null)
      return [
        ...prev,
        { rid: prossimoRid.current++, item_id: riga.item_id, supplier_id: proposto, qty: suggerite },
      ]
    })
  }

  const cambiaQta = (rid, qty) =>
    setBozza((prev) => prev.map((r) => (r.rid === rid ? { ...r, qty } : r)))
  const cambiaFornitore = (rid, supplier_id) =>
    setBozza((prev) =>
      prev.map((r) => (r.rid === rid ? { ...r, supplier_id: supplier_id || null } : r))
    )
  const togli = (rid) => setBozza((prev) => prev.filter((r) => r.rid !== rid))

  async function save() {
    if (lines.length === 0) return
    setBusy(true)
    setError(null)
    try {
      await createPurchaseOrder({ lines, total_net: totals.net, total_gross: totals.gross })
      setBozza([])
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
  function consegna(prezzi) {
    const { ordine, fetta } = consegnaFor
    setConsegnaFor(null)
    setError(null)
    consegnaRigheOrdine(ordine.id, { indici: fetta.indici, prezzi }).then(
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

  const sottoScorta = visibili.filter((r) => suggestedPackages(r.item) > 0)

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

      <div className="card">
        <strong>Nuovo ordine</strong>
        <p className="muted small" style={{ marginTop: 4 }}>
          Cerca il prodotto e aggiungilo: il fornitore si sceglie sulla riga
          dell’ordine. Un ordine può contenere prodotti di più fornitori.
        </p>

        <label htmlFor="po-cerca" style={{ marginTop: 8 }}>Cerca un prodotto</label>
        <input
          id="po-cerca"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Es. Campari"
        />

        <label htmlFor="po-filtro" style={{ marginTop: 8 }}>Fornitore</label>
        <select
          id="po-filtro"
          value={filtroFornitore}
          onChange={(e) => setFiltroFornitore(e.target.value)}
        >
          <option value="all">Tutti i fornitori</option>
          <option value="none">Senza fornitore</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        {sottoScorta.length > 0 && (
          <button
            className="btn secondary small block"
            style={{ marginTop: 8 }}
            onClick={() => sottoScorta.forEach((r) => aggiungi(r, suggestedPackages(r.item)))}
          >
            ⚡ Aggiungi i sotto scorta ({sottoScorta.length})
          </button>
        )}

        {visibili.length === 0 && (
          <p className="muted small" style={{ marginTop: 8 }}>
            Nessun prodotto corrisponde alla ricerca.
          </p>
        )}

        {/* IL CATALOGO. Una riga per coppia prodotto-fornitore: senza filtro
            i doppioni si vedono tutti, distinti dalla striscia del colore e
            dal nome del fornitore — sono le stesse strisce della lista del
            magazzino (REQ-MAG-027). */}
        <div className="inv-list">
          {visibili.slice(0, LIMITE_CATALOGO).map((r) => {
            const st = stockStatus(r.item)
            const righeProdotto = righeDiProdotto(r.item, listini)
            const economica = righeProdotto.length > 1 ? piuEconomica(righeProdotto) : null
            const ultimo = righeProdotto.length > 1 ? fornitoreProposto(righeProdotto) : null
            return (
              <div className="inv-row" key={r.key} style={{ borderLeftColor: r.colore || undefined }}>
                <div className="inv-row-main">
                  <span className={`dot dot-${st}`} />
                  <span className="grow" style={{ minWidth: 0 }}>
                    <span className="inv-row-name">{r.item_name}</span>{' '}
                    <span className="muted small">
                      {r.supplier_name || 'senza fornitore'}
                      {ultimo?.supplier_id === r.supplier_id ? ' · ultimo acquisto' : ''}
                      {economica?.supplier_id === r.supplier_id ? ' · più economico' : ''}
                    </span>
                    <span className="muted small" style={{ display: 'block' }}>
                      In casa: {formatQty(r.item.stock, r.item.unit)}
                      {contenutoDelPezzo(r.item) ? ` · 1 pz = ${contenutoDelPezzo(r.item)}` : ''}
                      {r.price != null ? ` · ${formatPrice(r.price)}/pz` : ''}
                      {r.package_label ? ` · ${r.package_label}` : ''}
                      {suggestedPackages(r.item) > 0 ? ` · sugg. ${suggestedPackages(r.item)} pz` : ''}
                    </span>
                  </span>
                  <button
                    className="btn small"
                    aria-label={`Aggiungi ${r.item_name}`}
                    onClick={() => aggiungi(r)}
                  >
                    ＋
                  </button>
                </div>
              </div>
            )
          })}
        </div>
        {visibili.length > LIMITE_CATALOGO && (
          <p className="muted small" style={{ marginTop: 6 }}>
            Mostrati {LIMITE_CATALOGO} prodotti su {visibili.length}: restringi la ricerca.
          </p>
        )}
      </div>

      {bozza.length > 0 && (
        <div className="card" style={{ marginTop: 12 }}>
          <strong>Ordine in composizione</strong>
          {bozza.map((r) => {
            const it = itemsById.get(r.item_id)
            if (!it) return null
            const righeProdotto = righeDiProdotto(it, listini)
            // «Va anche bene che è disabilitato il fornitore in quanto già
            // l'ho ordinato a quel fornitore» (Flavio): un fornitore già
            // usato per QUESTO prodotto in QUESTO ordine non è più
            // scegliibile per un'altra riga dello stesso prodotto.
            const usati = fornitoriGiaUsati(
              bozza.filter((x) => x.rid !== r.rid),
              r.item_id
            )
            const economica = piuEconomica(righeProdotto, { esclusi: [r.supplier_id] })
            return (
              <div className="row between" key={r.rid} style={{ alignItems: 'center', marginTop: 8, gap: 8 }}>
                <div className="grow" style={{ minWidth: 0 }}>
                  <span>{it.name}</span>
                  <select
                    aria-label={`Fornitore per ${it.name}`}
                    value={r.supplier_id || ''}
                    onChange={(e) => cambiaFornitore(r.rid, e.target.value)}
                    style={{ marginTop: 4 }}
                  >
                    <option value="">— Nessun fornitore —</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id} disabled={usati.has(s.id)}>
                        {s.name}{usati.has(s.id) ? ' (già in questo ordine)' : ''}
                      </option>
                    ))}
                  </select>
                  {/* Il più economico si MOSTRA, non si sceglie: il prezzo
                      più basso in archivio è quasi sempre il più vecchio,
                      perché nessuno aggiorna al rialzo il listino di un
                      fornitore da cui non compra più. */}
                  {economica?.supplier_id && (
                    <span className="muted small" style={{ display: 'block' }}>
                      Più economico: {supsById.get(economica.supplier_id)?.name || '—'} a{' '}
                      {formatPrice(economica.price)}/pz
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  step="1"
                  min="0"
                  aria-label={`Quantità di ${it.name}`}
                  value={r.qty ?? ''}
                  placeholder="pz"
                  onChange={(e) => cambiaQta(r.rid, e.target.value)}
                  style={{ width: 76, textAlign: 'right' }}
                />
                <button className="btn ghost small" title="Togli dall’ordine" onClick={() => togli(r.rid)}>✕</button>
              </div>
            )
          })}

          {lines.length > 0 && (
            <>
              <hr style={{ borderColor: 'rgba(255,255,255,0.1)' }} />
              <div className="row between">
                <span className="muted">{totals.pieces} confezioni · netto {formatPrice(totals.net)}</span>
                <strong>{formatPrice(totals.gross)} <span className="muted small">+IVA</span></strong>
              </div>
              <button className="btn block" style={{ marginTop: 8 }} onClick={save} disabled={busy}>
                📤 Salva ordine
              </button>
            </>
          )}
        </div>
      )}

      {orders.length > 0 && (
        <div className="card" style={{ marginTop: 12 }}>
          <strong>Storico ordini</strong>
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
              {fetteFornitore(o, { suppliers }).map((fetta) => (
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
                    </span>
                  </div>
                </div>
              ))}
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

// ── ALLA CONSEGNA SI CORREGGE IL PREZZO, MAI IL FORNITORE ────────────
//
// Flavio: «prendo dieci cose, mi esce 300 euro di ordine; una volta che il
// fornitore mi scarica l'ordine vedo se veramente sono 300 o di più o di
// meno, e modifico il prezzo quando necessario. NON POSSO MODIFICARE IL
// FORNITORE PERCHÉ DA LUI L'HO COMPRATO».
function DialogoConsegna({ fetta, onCancel, onConfirm }) {
  const [prezzi, setPrezzi] = useState({})
  const valore = (i, l) => prezzi[i] ?? String(Number(l.unit_cost) || 0)
  const totale = fetta.lines.reduce(
    (t, l, k) => t + (Number(l.qty_packages) || 0) * (Number(valore(fetta.indici[k], l)) || 0),
    0
  )
  return (
    <div className="overlay confirm-overlay" onClick={onCancel}>
      <div className="confirm-box" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>
          📦 Merce arrivata da {fetta.supplier_name || 'questo fornitore'}?
        </h3>
        <p className="muted">
          Controlla i prezzi come sono sul documento: quello che scrivi qui
          diventa il prezzo di questo fornitore e il costo del prodotto. La
          merce viene caricata a magazzino.
        </p>
        {fetta.lines.map((l, k) => {
          const i = fetta.indici[k]
          return (
            <div className="row between" key={i} style={{ alignItems: 'center', marginTop: 6, gap: 8 }}>
              <span className="grow" style={{ minWidth: 0 }}>
                {l.qty_packages}× {l.name}
              </span>
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
          )
        })}
        <div className="row between" style={{ marginTop: 10 }}>
          <span className="muted">Totale netto</span>
          <strong>{formatPrice(totale)}</strong>
        </div>
        <div className="row" style={{ gap: 10, marginTop: 16 }}>
          <button className="btn ghost grow" onClick={onCancel}>Annulla</button>
          <button className="btn grow" onClick={() => onConfirm(prezzi)}>Carica a magazzino</button>
        </div>
      </div>
    </div>
  )
}
