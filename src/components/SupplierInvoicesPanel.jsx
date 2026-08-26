import { useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchSuppliers,
  fetchSupplierInvoices,
  createSupplierInvoice,
  updateSupplierInvoice,
  deleteSupplierInvoice,
  fetchInventoryItems,
  fetchSupplierPrices,
  fetchPurchaseOrders,
  aggiungiProdottiAFattura,
} from '../lib/api.js'
import { invoiceTotals } from '../lib/warehouse.js'
import { formatPrice } from '../lib/orderStatus.js'
import { contenutoDelPezzo, formatQty, magazzinoBloccato } from '../lib/inventory.js'
import {
  righeFattura,
  totaliRigheFattura,
  prezzoInArchivio,
  prezzoDiverso,
  rigaDaProdotto,
  ordiniRiprendibili,
  righeDaOrdine,
} from '../lib/fatture.js'

// Il magazzino è quasi quattrocento prodotti: nessuno li scorre, si cercano.
// Poche righe per volta e non sessanta come nella schermata degli ordini,
// perché qui si sta dentro una finestrella: i prodotti già scelti stanno
// sotto l'elenco, e un elenco lungo li spinge fuori dallo schermo. Il limite
// si dice, così chi non trova qualcosa sa che deve restringere.
const LIMITE_RICERCA = 8

// Scadenzario fornitori (come FORNITORI REC dell'Excel): documenti/proforma
// per fornitore con importo, stato pagato e note; totale da pagare a colpo
// d'occhio, complessivo e per fornitore.
export default function SupplierInvoicesPanel() {
  const [suppliers, setSuppliers] = useState([])
  const [invoices, setInvoices] = useState([])
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [adding, setAdding] = useState(false)
  const [supplierFilter, setSupplierFilter] = useState('all')
  const [onlyUnpaid, setOnlyUnpaid] = useState(false)
  // Il magazzino serve solo a «Aggiungi prodotti», ma si carica insieme al
  // resto: aprire la finestra e trovarla vuota per mezzo secondo, con una
  // fattura in mano, è peggio di una lettura in più su una schermata che si
  // apre poche volte al giorno.
  const [items, setItems] = useState([])
  const [listini, setListini] = useState([])
  const [ordini, setOrdini] = useState([])
  const [prodottiPer, setProdottiPer] = useState(null)

  async function load() {
    try {
      const [sups, invs, its, list, ords] = await Promise.all([
        fetchSuppliers(),
        fetchSupplierInvoices({ limit: 200 }),
        // Lo scadenzario deve reggere anche se il magazzino non risponde: la
        // testata dei documenti è la cosa che serve sempre, i prodotti sono
        // un di più.
        fetchInventoryItems().catch(() => []),
        fetchSupplierPrices().catch(() => []),
        fetchPurchaseOrders({ limit: 25 }).catch(() => []),
      ])
      setSuppliers(sups)
      setInvoices(invs)
      setItems(its)
      setListini(list)
      setOrdini(ords)
    } catch (e) {
      setError(e.message)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const totals = useMemo(() => invoiceTotals(invoices), [invoices])
  const visible = useMemo(
    () =>
      invoices.filter((i) => {
        if (supplierFilter !== 'all' && i.supplier_id !== supplierFilter) return false
        if (onlyUnpaid && i.paid) return false
        return true
      }),
    [invoices, supplierFilter, onlyUnpaid]
  )

  // IL MAGAZZINO IN SOLA LETTURA VALE ANCHE QUI (BUG-029): finché il
  // travaso non è fatto, il carico sommerebbe pezzi a giacenze ancora
  // scritte alla vecchia maniera. Le righe della fattura invece si
  // aggiungono lo stesso — sono carta, non giacenze. La regola sta in
  // inventory.js e la si chiede, non la si riscrive.
  const bloccato = useMemo(() => magazzinoBloccato(items), [items])

  // NIENTE `await` PRIMA DI MOSTRARE L'ESITO: `aggiungiProdottiAFattura`
  // compone il documento aggiornato in memoria e le scritture partono in
  // sottofondo.
  function aggiungiProdotti(righe, carica) {
    const fattura = prodottiPer
    setProdottiPer(null)
    setError(null)
    aggiungiProdottiAFattura(fattura.id, { righe, carica }).then(
      (agg) => setInvoices((prev) => prev.map((i) => (i.id === agg.id ? agg : i))),
      (e) => setError(e.message)
    )
  }

  async function togglePaid(inv) {
    setError(null)
    // Aggiornamento ottimistico.
    setInvoices((prev) => prev.map((i) => (i.id === inv.id ? { ...i, paid: !i.paid } : i)))
    try {
      await updateSupplierInvoice(inv.id, { paid: !inv.paid })
    } catch (e) {
      setError(e.message)
      await load()
    }
  }

  async function remove(inv) {
    if (!confirm(`Eliminare il documento ${inv.number || ''} di ${inv.supplier_name}?`)) return
    try {
      await deleteSupplierInvoice(inv.id)
      setInvoices((prev) => prev.filter((i) => i.id !== inv.id))
    } catch (e) {
      setError(e.message)
    }
  }

  async function handleCreate(data) {
    setBusy(true)
    setError(null)
    try {
      await createSupplierInvoice(data)
      setAdding(false)
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      {error && <div className="banner">Errore: {error}</div>}

      <div className="inv-summary">
        <span className="chip" style={{ cursor: 'default' }}>
          Da pagare <strong>{formatPrice(totals.unpaid)}</strong>
        </span>
        <button className={`chip ${onlyUnpaid ? 'active' : ''}`} onClick={() => setOnlyUnpaid((v) => !v)}>
          Solo da pagare
        </button>
      </div>

      {totals.bySupplier.length > 0 && (
        <div className="muted small" style={{ margin: '0 4px 8px' }}>
          {totals.bySupplier.map((s) => `${s.supplier_name || '—'}: ${formatPrice(s.unpaid)}`).join(' · ')}
        </div>
      )}

      {suppliers.length > 0 && (
        <div className="chips-row">
          <button className={`chip ${supplierFilter === 'all' ? 'active' : ''}`} onClick={() => setSupplierFilter('all')}>
            Tutti
          </button>
          {suppliers.map((s) => (
            <button
              key={s.id}
              className={`chip ${supplierFilter === s.id ? 'active' : ''}`}
              onClick={() => setSupplierFilter(s.id)}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {!adding ? (
        <button className="btn block" onClick={() => setAdding(true)}>
          + Nuovo documento
        </button>
      ) : (
        <InvoiceForm suppliers={suppliers} busy={busy} onCancel={() => setAdding(false)} onSave={handleCreate} />
      )}

      <div className="inv-list" style={{ marginTop: 8 }}>
        {visible.map((inv) => (
          <div className="inv-item" key={inv.id}>
            <div className="inv-row" style={{ cursor: 'default' }}>
              <div className="grow">
                <div className="inv-name">
                  {inv.supplier_name || '—'} {inv.number && <span className="muted small">#{inv.number}</span>}
                </div>
                <div className="muted small">
                  {inv.date || '—'} · {inv.doc_type}
                  {inv.notes && ` · ${inv.notes}`}
                </div>
              </div>
              <div className="inv-qty">
                <div>{formatPrice(inv.amount)}</div>
                <button
                  className={inv.paid ? 'chip active' : 'chip'}
                  style={{ marginTop: 4 }}
                  onClick={() => togglePaid(inv)}
                >
                  {inv.paid ? '✅ pagato' : '⏳ da pagare'}
                </button>
              </div>
              <button className="btn ghost small" onClick={() => remove(inv)}>🗑</button>
            </div>

            {/* I PRODOTTI DEL DOCUMENTO (REQ-MAG-030). Il tasto sta SOTTO la
                fattura, ed è quello che li mette: prima di questa voce una
                fattura era solo una testata. Non si chiama «carico» apposta
                — Flavio: «dobbiamo usare un'altra dicitura sicuramente» —
                perché il carico a magazzino è una conseguenza, e per giunta
                facoltativa. */}
            <RigheDelDocumento fattura={inv} />
            <button
              className="btn secondary small block"
              style={{ marginTop: 6 }}
              onClick={() => setProdottiPer(inv)}
            >
              ➕ Aggiungi prodotti
            </button>
          </div>
        ))}
      </div>

      {visible.length === 0 && <div className="empty">Nessun documento.</div>}

      {prodottiPer && (
        <DialogoProdotti
          fattura={prodottiPer}
          items={items}
          listini={listini}
          ordini={ordini}
          bloccato={bloccato}
          onCancel={() => setProdottiPer(null)}
          onConfirm={aggiungiProdotti}
        />
      )}
    </div>
  )
}

// Quello che la fattura ha già dentro. «Caricati» dice che quella merce è
// entrata in magazzino da qui: senza quel segno, la volta dopo nessuno
// saprebbe più se le giacenze sono già state alzate.
function RigheDelDocumento({ fattura }) {
  const righe = righeFattura(fattura)
  if (righe.length === 0) return null
  const totali = totaliRigheFattura(righe)
  const caricate = righe.filter((l) => l.caricata).length
  return (
    <div className="muted small" style={{ margin: '4px 4px 0' }}>
      {righe.map((l) => `${l.qty_packages}× ${l.name}`).join(', ')}
      {' · netto '}
      {formatPrice(totali.net)}
      {caricate > 0 ? ` · ${caricate === righe.length ? 'caricati' : `${caricate} caricati`} a magazzino` : ''}
    </div>
  )
}

function InvoiceForm({ suppliers, busy, onCancel, onSave }) {
  const [form, setForm] = useState({
    supplier_id: '',
    number: '',
    doc_type: 'Proforma',
    date: new Date().toISOString().slice(0, 10),
    amount: '',
    paid: false,
    notes: '',
  })
  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  function submit(e) {
    e.preventDefault()
    if (!form.supplier_id || !form.amount) return
    const sup = suppliers.find((s) => s.id === form.supplier_id)
    onSave({
      supplier_id: form.supplier_id,
      supplier_name: sup?.name ?? '',
      number: form.number.trim() || null,
      doc_type: form.doc_type,
      date: form.date,
      amount: Number(String(form.amount).replace(',', '.')) || 0,
      paid: !!form.paid,
      notes: form.notes.trim() || null,
    })
  }

  return (
    <form className="card" onSubmit={submit}>
      <strong>Nuovo documento</strong>

      <label htmlFor="if-sup" style={{ marginTop: 8 }}>Fornitore *</label>
      <select id="if-sup" value={form.supplier_id} onChange={set('supplier_id')} required>
        <option value="">— Scegli —</option>
        {suppliers.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>

      <div className="grid-2">
        <div>
          <label htmlFor="if-num">Numero doc.</label>
          <input id="if-num" value={form.number} onChange={set('number')} placeholder="Es. 1556" />
        </div>
        <div>
          <label htmlFor="if-date">Data</label>
          <input id="if-date" type="date" value={form.date} onChange={set('date')} />
        </div>
      </div>

      <div className="grid-2">
        <div>
          <label htmlFor="if-type">Tipo</label>
          <select id="if-type" value={form.doc_type} onChange={set('doc_type')}>
            <option>Proforma</option>
            <option>Fattura</option>
            <option>Reso</option>
            <option>Altro</option>
          </select>
        </div>
        <div>
          <label htmlFor="if-amount">Importo € *</label>
          <input id="if-amount" type="number" step="any" min="0" value={form.amount} onChange={set('amount')} required />
        </div>
      </div>

      <label htmlFor="if-notes">Note</label>
      <input id="if-notes" value={form.notes} onChange={set('notes')} placeholder="Es. -36,6 reso Ceres" />

      <label className="row" style={{ marginTop: 10 }}>
        <input type="checkbox" style={{ width: 'auto' }} checked={form.paid} onChange={set('paid')} />
        <span>Già pagato</span>
      </label>

      <div className="grid-2" style={{ marginTop: 12 }}>
        <button type="button" className="btn ghost" onClick={onCancel} disabled={busy}>Annulla</button>
        <button type="submit" className="btn" disabled={busy}>Salva</button>
      </div>
    </form>
  )
}

// ── «AGGIUNGI PRODOTTI»: PRIMA I PRODOTTI, POI LA DOMANDA SUL PREZZO ──
//
// Flavio, 26/08/2026: «ci mettiamo anche i prodotti, in modo tale che li va
// già a caricare all'interno dei prodotti di magazzino. Sempre che poi dopo
// mi fa la domanda se voglio aggiornare il prezzo — nel caso lo vado a
// modificare — oppure lasciarlo invariato, così, senza carico, perché
// magari me li sono caricati già prima in altro modo».
//
// Da quella frase escono le tre regole di questa finestra:
//  1. i prodotti si aggiungono al DOCUMENTO, sempre;
//  2. il CARICO a magazzino è una scelta a parte, che si può dire di no;
//  3. il PREZZO si chiede solo dove è cambiato, e il pre-impostato è
//     «lascia com'è»: chi non risponde non muove niente.
function DialogoProdotti({ fattura, items, listini, ordini, bloccato, onCancel, onConfirm }) {
  const [query, setQuery] = useState('')
  const [righe, setRighe] = useState([])
  // Col magazzino ancora da travasare il carico non si può fare (BUG-029),
  // ma le righe sì: la casella parte spenta e resta spenta.
  const [carica, setCarica] = useState(!bloccato)
  // Il `rid` è un numero interno che non cambia mai: se la chiave della riga
  // fosse il prodotto, aggiungendo due volte lo stesso React rimonterebbe i
  // campi e la quantità appena scritta sparirebbe.
  const prossimoRid = useRef(1)

  const supplierId = fattura.supplier_id ?? null
  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
  const trovati = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return items.filter((i) => (i.name || '').toLowerCase().includes(q))
  }, [items, query])

  // «Riprendi le righe da un ordine» è una COMODITÀ DI COMPILAZIONE: la
  // merce è quella, e ribatterla a mano è lavoro doppio con due occasioni di
  // sbagliare. Sulla fattura non si scrive nessun id d'ordine — il legame
  // fattura-ordine è un'altra voce, ancora da decidere (REQ-MAG-025).
  const riprendibili = useMemo(() => ordiniRiprendibili(ordini, supplierId), [ordini, supplierId])

  function aggiungi(item) {
    setRighe((prev) => [
      ...prev,
      {
        rid: prossimoRid.current++,
        aggiorna_prezzo: false,
        ...rigaDaProdotto(item, { listini, supplierId }),
      },
    ])
  }

  function riprendi(orderId) {
    const ordine = ordini.find((o) => o.id === orderId)
    if (!ordine) return
    const copiate = righeDaOrdine(ordine, supplierId)
    setRighe(copiate.map((r) => ({ rid: prossimoRid.current++, aggiorna_prezzo: false, ...r })))
    // QUELLA MERCE È GIÀ IN MAGAZZINO: è entrata alla consegna dell'ordine.
    // Caricarla una seconda volta è l'errore da impedire, e qui si impedisce
    // spegnendo la casella invece di lasciarla accesa per abitudine.
    if (copiate.some((r) => r.gia_caricata)) setCarica(false)
  }

  const cambia = (rid, campo, valore) =>
    setRighe((prev) => prev.map((r) => (r.rid === rid ? { ...r, [campo]: valore } : r)))
  const togli = (rid) => setRighe((prev) => prev.filter((r) => r.rid !== rid))

  const totali = totaliRigheFattura(righe)
  const daOrdine = righe.some((r) => r.gia_caricata)

  return (
    <div className="overlay confirm-overlay" onClick={onCancel}>
      <div className="confirm-box" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>
          ➕ Prodotti di {fattura.supplier_name || 'questo fornitore'}
          {fattura.number ? ` #${fattura.number}` : ''}
        </h3>
        <p className="muted">
          I prodotti restano sul documento. Il carico a magazzino si sceglie qui
          sotto, ed è una cosa a parte.
        </p>

        {riprendibili.length > 0 && (
          <>
            <label htmlFor="fp-ordine">Riprendi le righe da un ordine</label>
            <select id="fp-ordine" value="" onChange={(e) => riprendi(e.target.value)}>
              <option value="">— Scegli un ordine —</option>
              {riprendibili.map((o) => (
                <option key={o.id} value={o.id}>
                  {String(o.created_at || '').slice(0, 10)} ·{' '}
                  {righeDaOrdine(o, supplierId).length} art.
                </option>
              ))}
            </select>
          </>
        )}

        <label htmlFor="fp-cerca" style={{ marginTop: 8 }}>Cerca un prodotto</label>
        <input
          id="fp-cerca"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Es. Campari"
        />

        {query.trim() !== '' && trovati.length === 0 && (
          <p className="muted small" style={{ marginTop: 6 }}>
            Nessun prodotto corrisponde alla ricerca.
          </p>
        )}

        <div className="inv-list">
          {trovati.slice(0, LIMITE_RICERCA).map((it) => (
            <div className="inv-row" key={it.id}>
              <div className="inv-row-main">
                <span className="grow" style={{ minWidth: 0 }}>
                  <span className="inv-row-name">{it.name}</span>
                  <span className="muted small" style={{ display: 'block' }}>
                    In casa: {formatQty(it.stock, it.unit)}
                    {contenutoDelPezzo(it) ? ` · 1 pz = ${contenutoDelPezzo(it)}` : ''}
                  </span>
                </span>
                <button
                  className="btn small"
                  aria-label={`Aggiungi ${it.name}`}
                  onClick={() => aggiungi(it)}
                >
                  ＋
                </button>
              </div>
            </div>
          ))}
        </div>
        {trovati.length > LIMITE_RICERCA && (
          <p className="muted small" style={{ marginTop: 6 }}>
            Mostrati {LIMITE_RICERCA} prodotti su {trovati.length}: restringi la ricerca.
          </p>
        )}

        {righe.map((r) => {
          const archivio = prezzoInArchivio(itemsById.get(r.item_id), listini, supplierId)
          const cambiato = prezzoDiverso(archivio, r.unit_cost)
          return (
            <div key={r.rid} style={{ marginTop: 8 }}>
              <div className="row between" style={{ alignItems: 'center', gap: 8 }}>
                <span className="grow" style={{ minWidth: 0 }}>{r.name}</span>
                <input
                  type="number"
                  step="1"
                  min="0"
                  aria-label={`Quantità di ${r.name}`}
                  value={r.qty_packages ?? ''}
                  placeholder="pz"
                  onChange={(e) => cambia(r.rid, 'qty_packages', e.target.value)}
                  style={{ width: 68, textAlign: 'right' }}
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  aria-label={`Prezzo di ${r.name}`}
                  value={r.unit_cost ?? ''}
                  onChange={(e) => cambia(r.rid, 'unit_cost', e.target.value)}
                  style={{ width: 88, textAlign: 'right' }}
                />
                <button
                  className="btn ghost small"
                  title="Togli dal documento"
                  onClick={() => togli(r.rid)}
                >
                  ✕
                </button>
              </div>
              {/* LA DOMANDA SUL PREZZO COMPARE SOLO DOVE IL PREZZO È
                  CAMBIATO, con vecchio e nuovo affiancati. Spenta: «oppure
                  lasciarlo invariato» (Flavio) è il pre-impostato, e il
                  prezzo di vendita del menu non lo tocca comunque nessuno. */}
              {cambiato && (
                <label className="row small" style={{ gap: 6, alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    style={{ width: 'auto' }}
                    checked={!!r.aggiorna_prezzo}
                    onChange={(e) => cambia(r.rid, 'aggiorna_prezzo', e.target.checked)}
                  />
                  <span className="muted">
                    Aggiorna il prezzo: in archivio {formatPrice(archivio)} →{' '}
                    {formatPrice(r.unit_cost)}
                  </span>
                </label>
              )}
            </div>
          )
        })}

        {righe.length > 0 && (
          <>
            <div className="row between" style={{ marginTop: 10 }}>
              <span className="muted">Totale netto dei prodotti</span>
              <strong>{formatPrice(totali.net)}</strong>
            </div>

            <label className="row" style={{ marginTop: 10, gap: 6, alignItems: 'center' }}>
              <input
                type="checkbox"
                style={{ width: 'auto' }}
                checked={carica}
                disabled={bloccato}
                onChange={(e) => setCarica(e.target.checked)}
              />
              <span>Carica la merce a magazzino</span>
            </label>
            <p className="muted small">
              {bloccato
                ? 'Il carico non è disponibile finché il magazzino non è aggiornato alla nuova gestione (Magazzino, il banner in alto). I prodotti si aggiungono lo stesso al documento.'
                : daOrdine
                  ? 'Queste righe vengono da un ordine già consegnato: la merce è entrata in magazzino alla consegna.'
                  : 'Senza carico i prodotti restano solo sul documento e le giacenze non cambiano.'}
            </p>
          </>
        )}

        <div className="row" style={{ gap: 10, marginTop: 16 }}>
          <button className="btn ghost grow" onClick={onCancel}>Annulla</button>
          <button
            className="btn grow"
            disabled={righe.length === 0}
            onClick={() => onConfirm(righe, carica)}
          >
            {carica ? 'Aggiungi e carica' : 'Aggiungi senza caricare'}
          </button>
        </div>
      </div>
    </div>
  )
}
