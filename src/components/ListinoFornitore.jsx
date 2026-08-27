import { useEffect, useMemo, useState } from 'react'
import {
  fetchInventoryItems,
  fetchSupplierPrices,
  fetchVariazioniPrezzo,
  salvaRigaListino,
  eliminaRigaListino,
  creaProdottoAListino,
} from '../lib/api.js'
import { coloreFornitore } from '../lib/listini.js'
import { contenutoDelPezzo, formatQty } from '../lib/inventory.js'
import { formatPrice } from '../lib/orderStatus.js'
import { ETICHETTA_ORIGINE, origineDi, storicoDiCoppia } from '../lib/storicoPrezzi.js'
import { toastError } from '../lib/toast.js'

// ── IL LISTINO DI UN FORNITORE (REQ-MAG-035) ─────────────────────────
//
// «L'associazione prodotto → fornitori DEVE avvenire nella gestione
// Fornitori. Quando creo/modifico un fornitore mi si deve aprire una pagina
// dove posso associare i prodotti già in magazzino a quel fornitore, o
// addirittura CREARE un prodotto che poi andrà a finire in magazzino. Posso
// aggiungere anche un prezzo di listino, che poi sarà quello che vedrò
// quando compilerò/precompilerò un ordine» (l'utente, 27/08/2026).
//
// Il dato c'era già — `supplier_prices`, una riga per coppia
// prodotto-fornitore — e si popolava solo consegnando gli ordini: senza una
// schermata, un fornitore nuovo restava senza prezzi finché non gli si
// comprava qualcosa. Questa è quella schermata, ed è il punto di partenza
// del giro degli ordini.
//
// È IL DETTAGLIO DELLA RIGA DEL FORNITORE, non una sottosezione in più
// (docs/navigazione.md): la via d'uscita è una sola, sta in cima a sinistra
// e dice dove riporta.

// Il magazzino è quasi quattrocento prodotti: nessuno li scorre, si cercano.
const LIMITE_RICERCA = 8

// Quante variazioni si leggono sotto una riga. Lo storico serve per intero
// al grafico che verrà; qui basta sapere da dove viene il prezzo di adesso
// e quando è cambiato l'ultima volta.
const VARIAZIONI_MOSTRATE = 5

const giorno = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export default function ListinoFornitore({ fornitore, onIndietro }) {
  const [items, setItems] = useState([])
  const [righe, setRighe] = useState([])
  const [variazioni, setVariazioni] = useState([])
  const [query, setQuery] = useState('')
  const [aperta, setAperta] = useState(null)
  // Quello che si sta scrivendo su una riga, prima di salvarlo: `item_id`
  // → i campi toccati. Sta fuori dalle righe perché il tasto «Salva» deve
  // comparire solo dove qualcosa è davvero cambiato.
  const [bozze, setBozze] = useState({})
  const [caricando, setCaricando] = useState(true)

  const colore = coloreFornitore(fornitore)

  useEffect(() => {
    let vivo = true
    async function carica() {
      setCaricando(true)
      try {
        const [its, list, vars] = await Promise.all([
          fetchInventoryItems(),
          fetchSupplierPrices().catch(() => []),
          // Lo storico è un di più: se non si legge, il listino si compila
          // lo stesso. Quello che NON si può perdere è la scrittura.
          fetchVariazioniPrezzo({ supplier_id: fornitore.id }).catch(() => []),
        ])
        if (!vivo) return
        setItems(its)
        setRighe(list.filter((r) => r.supplier_id === fornitore.id))
        setVariazioni(vars)
      } catch (e) {
        if (vivo) toastError(`Il listino non si è caricato: ${e.message}`)
      } finally {
        if (vivo) setCaricando(false)
      }
    }
    carica()
    return () => {
      vivo = false
    }
  }, [fornitore.id])

  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
  const aListino = useMemo(() => new Set(righe.map((r) => r.item_id)), [righe])

  // Il catalogo di questo fornitore, in ordine di nome. Un prodotto tolto
  // dal magazzino lascia la sua riga qui: si vede che c'è e si può togliere,
  // invece di restare un buco che nessuno spiega.
  const catalogo = useMemo(
    () =>
      righe
        .map((r) => ({ riga: r, item: itemsById.get(r.item_id) || null }))
        .sort((a, b) => (a.item?.name || '￿').localeCompare(b.item?.name || '￿')),
    [righe, itemsById]
  )

  const trovati = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return items.filter((i) => !aListino.has(i.id) && (i.name || '').toLowerCase().includes(q))
  }, [items, aListino, query])

  // Il nome cercato esiste già in magazzino? Se sì non si crea niente: si
  // associa quello che c'è. Due Campari in magazzino sono due giacenze che
  // si contraddicono.
  const esisteGia = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return items.some((i) => (i.name || '').trim().toLowerCase() === q)
  }, [items, query])

  // Il risultato di una scrittura si compone in memoria (`riga` e
  // `variazione` tornano da `api.js`): la scrittura parte in sottofondo, e
  // rileggere adesso vorrebbe dire farsi rispondere dalla cache col prezzo
  // di prima.
  function applica({ riga, variazione }) {
    setRighe((prev) => {
      const senza = prev.filter((r) => r.item_id !== riga.item_id)
      return [...senza, riga]
    })
    if (variazione) setVariazioni((prev) => [...prev, variazione])
  }

  function associa(item) {
    // IL PREZZO DI PARTENZA È IL COSTO DEL PRODOTTO, cioè l'ultimo pagato a
    // chiunque: è l'unica cosa che si sa di un prodotto che non è mai stato
    // comprato da questo fornitore, ed è quello che la schermata degli
    // ordini mostrerebbe comunque in mancanza di una riga.
    applica(
      salvaRigaListino({
        supplier_id: fornitore.id,
        item_id: item.id,
        price: item.cost ?? null,
      })
    )
    setQuery('')
  }

  function creaEAssocia() {
    const nome = query.trim()
    if (!nome) return
    try {
      const { item, riga, variazione } = creaProdottoAListino({
        supplier_id: fornitore.id,
        name: nome,
      })
      setItems((prev) => [...prev, item])
      applica({ riga, variazione })
      setQuery('')
      // Si apre subito la sua riga: di un prodotto appena creato si sa solo
      // il nome, e la cosa da fare adesso è scriverci il prezzo.
      setAperta(item.id)
    } catch (e) {
      toastError(e.message)
    }
  }

  function salva(riga) {
    const bozza = bozze[riga.item_id] || {}
    try {
      applica(
        salvaRigaListino({
          supplier_id: fornitore.id,
          item_id: riga.item_id,
          price: 'price' in bozza ? bozza.price : riga.price,
          package_label: 'package_label' in bozza ? bozza.package_label : riga.package_label,
          code: 'code' in bozza ? bozza.code : riga.code,
          precedente: riga,
        })
      )
      setBozze((prev) => {
        const { [riga.item_id]: _tolto, ...resto } = prev
        return resto
      })
    } catch (e) {
      toastError(e.message)
    }
  }

  function togli(riga, nome) {
    if (!confirm(`Togliere ${nome} dal listino di ${fornitore.name}?`)) return
    eliminaRigaListino(fornitore.id, riga.item_id)
    setRighe((prev) => prev.filter((r) => r.item_id !== riga.item_id))
    setAperta(null)
  }

  const cambia = (itemId, campo, valore) =>
    setBozze((prev) => ({ ...prev, [itemId]: { ...prev[itemId], [campo]: valore } }))

  return (
    <div>
      <div className="row" style={{ gap: 8, alignItems: 'center', marginTop: 8 }}>
        <button className="btn ghost small" onClick={onIndietro}>
          ← Fornitori
        </button>
      </div>

      <div className="card" style={{ marginTop: 8, borderLeft: `4px solid ${colore}` }}>
        <h3 style={{ marginTop: 0 }}>Listino di {fornitore.name}</h3>
        <p className="muted">
          Che cosa vende questo fornitore e a quanto. Il prezzo è quello di un pezzo,
          al netto, ed è quello che comparirà quando si compila un ordine.
        </p>

        <label htmlFor="lf-cerca">Cerca un prodotto in magazzino</label>
        <input
          id="lf-cerca"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Es. Campari"
        />

        <div className="inv-list">
          {trovati.slice(0, LIMITE_RICERCA).map((it) => (
            <div className="inv-row" key={it.id}>
              <div className="inv-row-main">
                <span className="grow" style={{ minWidth: 0 }}>
                  <span className="inv-row-name">{it.name}</span>
                  <span className="muted small" style={{ display: 'block' }}>
                    In casa: {formatQty(it.stock, it.unit)}
                    {contenutoDelPezzo(it) ? ` · 1 pz = ${contenutoDelPezzo(it)}` : ''}
                    {it.cost > 0 ? ` · in archivio ${formatPrice(it.cost)}/pz` : ''}
                  </span>
                </span>
                <button
                  className="btn small"
                  aria-label={`Associa ${it.name} a ${fornitore.name}`}
                  onClick={() => associa(it)}
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

        {/* IL PRODOTTO CHE NON C'È SI CREA DA QUI. Nasce in magazzino come
            quelli che arrivano con una consegna: nome e prezzo, e la scheda
            da completare addosso (categoria, contenuto, soglia). */}
        {query.trim() !== '' && !esisteGia && (
          <>
            <button className="btn secondary small block" style={{ marginTop: 8 }} onClick={creaEAssocia}>
              ＋ Crea «{query.trim()}» in magazzino
            </button>
            <p className="muted small" style={{ marginTop: 6 }}>
              Il prodotto entra in magazzino con la scheda da completare: categoria,
              contenuto di un pezzo e soglia di riordino si mettono dal magazzino.
            </p>
          </>
        )}
      </div>

      <div className="card" style={{ marginTop: 8 }}>
        <div className="row between">
          <strong>Prodotti a listino</strong>
          <span className="muted small">{catalogo.length}</span>
        </div>

        {caricando && catalogo.length === 0 && (
          <p className="muted small" style={{ marginTop: 8 }}>Caricamento…</p>
        )}
        {!caricando && catalogo.length === 0 && (
          <p className="muted small" style={{ marginTop: 8 }}>
            Nessun prodotto sul listino di {fornitore.name}. Cercane uno qui sopra e
            associalo, oppure creane uno nuovo.
          </p>
        )}

        <div className="inv-list">
          {catalogo.map(({ riga, item }) => {
            const nome = item?.name || 'Prodotto non più in magazzino'
            const bozza = bozze[riga.item_id] || {}
            const prezzo = 'price' in bozza ? bozza.price : (riga.price ?? '')
            const daSalvare = Object.keys(bozza).length > 0
            const ultima = storicoDiCoppia(variazioni, fornitore.id, riga.item_id)[0] || null
            const aperto = aperta === riga.item_id
            return (
              <div
                className={`inv-row${aperto ? ' open' : ''}`}
                key={riga.item_id}
                style={{ borderLeftColor: colore || undefined }}
              >
                <div className="inv-row-main">
                  <span className="grow" style={{ minWidth: 0 }}>
                    <span className="inv-row-name">{nome}</span>
                    <span className="muted small" style={{ display: 'block' }}>
                      {item
                        ? `In casa: ${formatQty(item.stock, item.unit)}`
                        : 'La scheda del prodotto non c’è più: la riga si può togliere.'}
                      {riga.code ? ` · cod. ${riga.code}` : ''}
                      {riga.package_label ? ` · ${riga.package_label}` : ''}
                      {ultima
                        ? ` · ${giorno(ultima.at)}, ${ETICHETTA_ORIGINE[origineDi(ultima)]}`
                        : ''}
                    </span>
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    aria-label={`Prezzo di ${nome}`}
                    value={prezzo}
                    placeholder="€/pz"
                    onChange={(e) => cambia(riga.item_id, 'price', e.target.value)}
                    style={{ width: 92, textAlign: 'right' }}
                  />
                  {daSalvare && (
                    <button className="btn small" onClick={() => salva(riga)}>
                      Salva
                    </button>
                  )}
                  <button
                    className="btn ghost small"
                    aria-label={`Dettagli di ${nome}`}
                    aria-expanded={aperto}
                    onClick={() => setAperta(aperto ? null : riga.item_id)}
                  >
                    {aperto ? '▴' : '▾'}
                  </button>
                </div>

                {aperto && (
                  <div className="inv-row-dettaglio">
                    <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ minWidth: 140, flex: 1 }}>
                        <label htmlFor={`lf-cod-${riga.item_id}`}>Codice del fornitore</label>
                        <input
                          id={`lf-cod-${riga.item_id}`}
                          value={'code' in bozza ? bozza.code : (riga.code ?? '')}
                          placeholder="Es. CMP01"
                          onChange={(e) => cambia(riga.item_id, 'code', e.target.value)}
                        />
                      </span>
                      <span style={{ minWidth: 140, flex: 1 }}>
                        <label htmlFor={`lf-conf-${riga.item_id}`}>Confezione</label>
                        <input
                          id={`lf-conf-${riga.item_id}`}
                          value={
                            'package_label' in bozza
                              ? bozza.package_label
                              : (riga.package_label ?? '')
                          }
                          placeholder="Es. cartone da 6"
                          onChange={(e) => cambia(riga.item_id, 'package_label', e.target.value)}
                        />
                      </span>
                    </div>
                    <p className="muted small" style={{ marginTop: 6 }}>
                      Codice e confezione sono quelli di questo fornitore, e servono a chi
                      riceve l’ordine dall’altra parte.
                    </p>

                    <StoricoDellaRiga
                      variazioni={storicoDiCoppia(variazioni, fornitore.id, riga.item_id)}
                    />

                    <button
                      className="btn ghost small block"
                      style={{ marginTop: 8 }}
                      onClick={() => togli(riga, nome)}
                    >
                      🗑 Togli dal listino
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// LE VARIAZIONI DI PREZZO DI UNA COPPIA. Il grafico dell'andamento è una
// voce a parte e non c'è ancora; qui si legge l'elenco, che è lo stesso
// dato — e serve a rispondere subito a «quando è aumentato, e chi lo dice».
function StoricoDellaRiga({ variazioni }) {
  if (variazioni.length === 0) {
    return (
      <p className="muted small" style={{ marginTop: 8 }}>
        Nessuna variazione registrata: il prezzo si segue da qui in poi.
      </p>
    )
  }
  return (
    <>
      <p className="muted small" style={{ marginTop: 8, marginBottom: 4 }}>
        Variazioni di prezzo
      </p>
      {variazioni.slice(0, VARIAZIONI_MOSTRATE).map((v) => (
        <div className="row between small" key={v.id}>
          <span className="muted">
            {giorno(v.at)} · {ETICHETTA_ORIGINE[origineDi(v)]}
          </span>
          <span>
            {v.previous_price != null ? `${formatPrice(v.previous_price)} → ` : ''}
            {formatPrice(v.price)}
          </span>
        </div>
      ))}
      {variazioni.length > VARIAZIONI_MOSTRATE && (
        <p className="muted small" style={{ marginTop: 4 }}>
          Le ultime {VARIAZIONI_MOSTRATE} di {variazioni.length}.
        </p>
      )}
    </>
  )
}
