import { useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchInventoryItems,
  fetchInventoryCategories,
  getOpenStockCount,
  startStockCount,
  salvaRimanenza,
  closeStockCount,
  fetchStockCounts,
  fetchStockMovementsSince,
  subscribeSettings,
  settingsIniziali,
} from '../lib/api.js'
import { formatQty } from '../lib/inventory.js'
import { giorniDiConta, consumoSettimanale } from '../lib/warehouse.js'
import { righeInventario } from '../lib/inventarioInCorso.js'
import { formatPrice } from '../lib/orderStatus.js'
import ConfirmDialog from './ConfirmDialog.jsx'
import CategoryRail from './CategoryRail.jsx'

// L'INVENTARIO periodico. Per ogni prodotto: DEP (giacenza all'apertura,
// con le correzioni del periodo), ACQ (merce comprata), VENDUTO (scaricato
// dalle ricette dei drink), ATTESO (quanto risulta adesso), e — quando si
// scrive il contato — la DIFFERENZA, che alla chiusura corregge la
// giacenza. Il perché di questa forma sta in lib/inventarioInCorso.js
// (REQ-MAG-046): «l'inventario è solo un allineamento con il consumo reale».
//
// SI CHIAMA INVENTARIO, NON «CONTA» (Daniele, 17/09/2026: «conta è
// fuorviante»). L'id della sezione e del modulo resta `conta`, perché è
// scritto sui documenti veri e sulle impostazioni del locale; cambia la
// parola a schermo, che è quella che Flavio legge.
//
// E CHIUSO UN INVENTARIO NE PARTE SUBITO UN ALTRO. Flavio, 17/09/2026:
// «quando faccio un altro inventario, lui mi chiude l'inventario precedente
// e mi dice: hai fatto l'inventario da TOT a TOT». Il periodo che gli
// interessa è quello FRA due chiusure, quindi la chiusura riapre da sé, con
// le giacenze appena allineate come deposito di partenza.
//
// DIVISO PER CATEGORIE (REQ-MAG-047). Flavio, vocale del 21/09/2026: «mi è
// difficile fare l'inventario visto che devo passare da un ripiano a un
// altro perché sono mischiati … a me serve in ordine alfabetico, ma per
// categorie, perché le categorie ce l'ho quasi tutte vicine». Si conta
// girando per gli scaffali, e gli scaffali sono per categoria: la barra è
// la stessa dei Prodotti, e «Tutte» li mette in fila categoria per
// categoria, ognuna col suo titolo.
export default function StockCountPanel() {
  const [open, setOpen] = useState(undefined) // undefined=caricamento
  const [history, setHistory] = useState([])
  const [rims, setRims] = useState({}) // item_id -> valore input
  const [rimsAt, setRimsAt] = useState({}) // item_id -> ora del conteggio
  const [items, setItems] = useState([])
  const [categorie, setCategorie] = useState([])
  const [movimenti, setMovimenti] = useState([])
  const [categoria, setCategoria] = useState('all')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const [viewing, setViewing] = useState(null) // conta chiusa in dettaglio
  // Dalla cache, e poi aggiornate da sole: la scelta «riapre da sé o a mano»
  // è del locale (settings/bar), non di questo terminale.
  const [impostazioni, setImpostazioni] = useState(settingsIniziali)
  useEffect(() => subscribeSettings(setImpostazioni, () => {}), [])
  const riapreDaSola = impostazioni.inventario_riapre_da_solo !== false

  // OGNI RIMANENZA SI SALVA MENTRE SI SCRIVE (BUG-110), con la sua ora
  // (BUG-112). Si aspetta un attimo che il dito si fermi — «0», «0.», «0.9»
  // sarebbero tre scritture — e si salva subito all'uscita dal campo o
  // dalla schermata.
  const inSospeso = useRef({}) // item_id -> { timer, salva }
  function salvaSubito(itemId) {
    const p = inSospeso.current[itemId]
    if (!p) return
    clearTimeout(p.timer)
    delete inSospeso.current[itemId]
    p.salva()
  }
  function scriviRimanenza(itemId, valore) {
    const ora = new Date().toISOString()
    setRims((r) => ({ ...r, [itemId]: valore }))
    setRimsAt((r) => ({ ...r, [itemId]: valore === '' ? null : ora }))
    if (!open) return
    const contaId = open.id
    clearTimeout(inSospeso.current[itemId]?.timer)
    inSospeso.current[itemId] = {
      salva: () => salvaRimanenza(contaId, itemId, valore, ora),
      timer: setTimeout(() => salvaSubito(itemId), 600),
    }
  }
  useEffect(
    () => () => {
      for (const id of Object.keys(inSospeso.current)) salvaSubito(id)
    },
    []
  )

  async function load() {
    try {
      const [oc, hist, articoli, cats] = await Promise.all([
        getOpenStockCount(),
        fetchStockCounts({ limit: 15 }),
        fetchInventoryItems().catch(() => []),
        fetchInventoryCategories().catch(() => []),
      ])
      if (oc) {
        setMovimenti(await fetchStockMovementsSince(oc.started_at).catch(() => []))
        setRims(Object.fromEntries(oc.lines.map((l) => [l.item_id, l.rim ?? ''])))
        setRimsAt(Object.fromEntries(oc.lines.map((l) => [l.item_id, l.rim_at ?? null])))
      }
      setItems(articoli)
      setCategorie(cats)
      setOpen(oc)
      setHistory(hist.filter((c) => c.status === 'closed'))
    } catch (e) {
      setError(e.message)
      setOpen(null)
    }
  }

  useEffect(() => {
    load()
  }, [])

  // Le righe con quello che si è scritto a schermo, non ancora (o appena)
  // salvato: è questo che si vede, ed è questo che si chiude.
  const conRimanenze = (lines) =>
    lines.map((l) => {
      const v = rims[l.item_id]
      return { ...l, rim: v == null || v === '' ? null : Number(v), rim_at: rimsAt[l.item_id] ?? null }
    })

  const computed = useMemo(() => {
    if (!open) return null
    // La conta è APERTA: il suo periodo finisce adesso e si allunga mentre
    // la si compila.
    return righeInventario(conRimanenze(open.lines), { movimenti, items, dal: open.started_at })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, rims, rimsAt, movimenti, items])

  // ── LE CATEGORIE ────────────────────────────────────────────────────
  const catDi = useMemo(() => new Map(items.map((i) => [i.id, i.category_id || 'none'])), [items])
  const posizione = useMemo(() => new Map(categorie.map((c, i) => [c.id, i])), [categorie])
  const nomeCategoria = useMemo(() => new Map(categorie.map((c) => [c.id, c.name])), [categorie])
  const voci = useMemo(() => {
    if (!open) return []
    const per = {}
    for (const l of open.lines) {
      const k = catDi.get(l.item_id) || 'none'
      per[k] = (per[k] || 0) + 1
    }
    return [
      { key: 'all', label: 'Tutte', count: open.lines.length },
      ...categorie.filter((c) => per[c.id]).map((c) => ({ key: c.id, label: c.name, count: per[c.id] })),
      ...(per.none ? [{ key: 'none', label: 'Senza categoria', count: per.none }] : []),
    ]
  }, [open, categorie, catDi])

  // In fila come gli scaffali: categoria per categoria, e dentro in ordine
  // alfabetico.
  const visibili = useMemo(() => {
    if (!computed) return []
    const cat = (l) => catDi.get(l.item_id) || 'none'
    const ordine = (l) => (cat(l) === 'none' ? Infinity : posizione.get(cat(l)) ?? Infinity)
    return computed.lines
      .filter((l) => categoria === 'all' || cat(l) === categoria)
      .sort((a, b) => ordine(a) - ordine(b) || String(a.name).localeCompare(String(b.name), 'it'))
  }, [computed, categoria, catDi, posizione])

  async function start() {
    setBusy(true)
    setError(null)
    try {
      const articoli = await fetchInventoryItems()
      if (articoli.length === 0) {
        setError('Nessun prodotto in magazzino: aggiungili prima di aprire l’inventario.')
        return
      }
      await startStockCount(articoli)
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function doClose() {
    if (!open || !computed) return
    setConfirmClose(false)
    setBusy(true)
    setError(null)
    // Le rimanenze vanno nelle righe della chiusura: un salvataggio rimasto
    // indietro arriverebbe DOPO, su un inventario già chiuso.
    for (const p of Object.values(inSospeso.current)) clearTimeout(p.timer)
    inSospeso.current = {}
    try {
      // LE DIFFERENZE SI RIFANNO COI DATI DI ADESSO. Quelle a schermo sono
      // state calcolate all'apertura della pagina: nel frattempo il locale
      // può aver venduto, e la chiusura deve partire dalla giacenza vera.
      // Sono letture: senza rete risponde la cache, che ha anche le vendite
      // appena battute da questo dispositivo.
      const [articoli, mov] = await Promise.all([
        fetchInventoryItems(),
        fetchStockMovementsSince(open.started_at).catch(() => movimenti),
      ])
      const finale = righeInventario(conRimanenze(open.lines), {
        movimenti: mov,
        items: articoli,
        dal: open.started_at,
      })
      const prossimo = await closeStockCount(open.id, {
        lines: finale.lines,
        totals: finale.totals,
        align: true,
        // Gli articoli servono al prossimo inventario, che nasce nello stesso
        // pacchetto della chiusura (vedi closeStockCount).
        riapri: riapreDaSola && articoli.length > 0 ? articoli : null,
      })
      // L'esito si compone, non si rilegge: la chiusura è partita in
      // sottofondo, e una rilettura adesso troverebbe l'inventario ancora
      // aperto con le giacenze di prima.
      setHistory((h) => [
        { ...open, status: 'closed', closed_at: new Date().toISOString(), lines: finale.lines, totals: finale.totals },
        ...h,
      ])
      setOpen(prossimo)
      setMovimenti([])
      setRims(prossimo ? Object.fromEntries(prossimo.lines.map((l) => [l.item_id, ''])) : {})
      setRimsAt({})
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (open === undefined) return <div className="empty">Carico l’inventario…</div>

  return (
    <div>
      {error && <div className="banner">Errore: {error}</div>}

      {!open ? (
        <>
          <button className="btn block" onClick={start} disabled={busy}>
            ▶️ Apri l’inventario
          </button>
          <p className="muted small" style={{ margin: '8px 0 0' }}>
            {riapreDaSola
              ? 'Da qui in poi c’è sempre un inventario in corso: quando lo chiudi scrivendo le rimanenze, ne parte subito un altro. Il consumo si legge fra una chiusura e l’altra.'
              : 'Quando lo chiudi scrivendo le rimanenze, il prossimo lo apri tu da qui. Il consumo si legge fra l’apertura e la chiusura dello stesso inventario. (Si cambia in Impostazioni → Funzioni premium.)'}
          </p>
        </>
      ) : (
        <>
          <div className="card">
            <strong>Inventario in corso</strong>
            <div className="muted small">
              dal {dataBreve(open.started_at)}
              {computed.giorni != null && ` · ${giorniScritti(computed.giorni)}`} · contati{' '}
              {computed.totals.counted}/{open.lines.length}
            </div>
            <div className="muted small">
              Venduto: <strong>{formatPrice(computed.totals.vend_value)}</strong>
              {' · '}Differenza: <strong>{formatPrice(computed.totals.diff_value)}</strong>
              {' · '}Valore rimanenze: {formatPrice(computed.totals.rim_value)}
            </div>
            <p className="muted small" style={{ margin: '6px 0 0' }}>
              Venduto: quanto hanno scaricato i drink battuti. Atteso: quanto risulta adesso in
              magazzino. Differenza: contato meno atteso; alla chiusura corregge la giacenza.
            </p>
          </div>

          <div style={{ marginTop: 8 }}>
            <CategoryRail items={voci} selected={categoria} onSelect={setCategoria} chiave="inventario-conta">
              <div className="inv-list">
                {visibili.map((l, i) => {
                  const cat = catDi.get(l.item_id) || 'none'
                  const prima = i === 0 || (catDi.get(visibili[i - 1].item_id) || 'none') !== cat
                  return (
                    <div key={l.item_id}>
                      {categoria === 'all' && prima && (
                        <div className="muted small" style={{ padding: '10px 4px 4px', fontWeight: 600 }}>
                          {cat === 'none' ? 'Senza categoria' : nomeCategoria.get(cat) || 'Senza categoria'}
                        </div>
                      )}
                      <RigaInventario
                        riga={l}
                        valore={rims[l.item_id] ?? ''}
                        onScrivi={(v) => scriviRimanenza(l.item_id, v)}
                        onEsci={() => salvaSubito(l.item_id)}
                      />
                    </div>
                  )
                })}
              </div>
            </CategoryRail>
          </div>

          <p className="muted small" style={{ margin: '10px 0 6px' }}>
            Le rimanenze si salvano mentre le scrivi: si può smettere e riprendere più tardi.
          </p>
          <button className="btn block" onClick={() => setConfirmClose(true)} disabled={busy}>
            ✅ Chiudi l’inventario
          </button>
        </>
      )}

      {history.length > 0 && (
        <div className="card" style={{ marginTop: 12 }}>
          <strong>Inventari precedenti</strong>
          {history.map((c) => (
            <div
              className="row between"
              key={c.id}
              style={{ marginTop: 6, cursor: 'pointer' }}
              onClick={() => setViewing(viewing?.id === c.id ? null : c)}
            >
              <span className="muted small">
                dal {dataBreve(c.started_at)} al {dataBreve(c.closed_at)}
              </span>
              <span className="muted small">
                {c.totals?.vend_value != null ? (
                  <>
                    venduto <strong>{formatPrice(c.totals.vend_value)}</strong> · differenza{' '}
                    <strong>{formatPrice(c.totals.diff_value || 0)}</strong>
                  </>
                ) : (
                  <>
                    consumo <strong>{formatPrice(c.totals?.cons_value || 0)}</strong>
                  </>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {viewing && <DettaglioInventario inventario={viewing} />}

      {confirmClose && computed && (
        <ConfirmDialog
          title="✅ Chiudere l’inventario?"
          message={`Prodotti contati: ${computed.totals.counted}/${open.lines.length}.\nLe giacenze dei prodotti contati vengono corrette della differenza: ${formatPrice(computed.totals.diff_value)}.\nVenduto nel periodo: ${formatPrice(computed.totals.vend_value)}.${riapreDaSola ? '\nNe parte subito uno nuovo, da oggi.' : ''}`}
          confirmLabel="Chiudi l’inventario"
          onCancel={() => setConfirmClose(false)}
          onConfirm={doClose}
        />
      )}
    </div>
  )
}

// Una riga: i numeri del periodo, e il campo dove si scrive il contato.
function RigaInventario({ riga: l, valore, onScrivi, onEsci }) {
  const q = (n) => formatQty(n, l.unit)
  return (
    <div className="inv-item">
      <div className="inv-row" style={{ cursor: 'default' }}>
        <div className="grow">
          <div className="inv-name">{l.name}</div>
          <div className="muted small">
            DEP {q(l.dep)} · ACQ {q(l.acq)} · VENDUTO {q(l.vend)} · ATTESO {q(l.atteso)}
          </div>
          {l.diff != null && (
            <div className="small">
              DIFFERENZA <strong>{l.diff > 0 ? '+' : ''}{q(l.diff)}</strong>
              {l.diff_value !== 0 && ` (${formatPrice(l.diff_value)})`}
              {/* Il consumo a settimana (REQ-MAG-024) resta: è il numero su
                  cui si decide quanto ordinare. */}
              {l.cons_week != null && <span className="muted"> · consumo {q(l.cons_week)} a settimana</span>}
            </div>
          )}
        </div>
        <input
          type="number"
          step="any"
          min="0"
          value={valore}
          placeholder={`RIM ${l.unit}`}
          aria-label={`Rimanenza di ${l.name}`}
          onChange={(e) => onScrivi(e.target.value)}
          onBlur={onEsci}
          style={{ width: 100, textAlign: 'right' }}
        />
      </div>
    </div>
  )
}

// La data come la si legge, «17/09/2026», non com'è salvata.
const dataBreve = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '—')

// «tre settimane e mezzo» invece di «24,5 giorni»: al banco si ragiona a
// settimane, ed è la misura in cui si legge il consumo qui sotto.
function giorniScritti(giorni) {
  const g = Math.round(giorni)
  if (g < 14) return `${g} ${g === 1 ? 'giorno' : 'giorni'}`
  const settimane = Math.round((giorni / 7) * 10) / 10
  return `${String(settimane).replace('.', ',')} settimane`
}

// IL DETTAGLIO DI UN INVENTARIO CHIUSO. Il periodo qui è finito, quindi i
// giorni sono quelli veri fra apertura e chiusura — e il consumo a
// settimana si ricalcola da quelli, non da un divisore salvato: gli
// inventari vecchi non l'hanno mai avuto. Quelli chiusi dalla 1.8 hanno
// anche venduto e differenza, e li dicono; i vecchi solo il consumo.
function DettaglioInventario({ inventario }) {
  const conta = inventario
  const giorni = giorniDiConta(conta.started_at, conta.closed_at)
  return (
    <div className="card" style={{ marginTop: 8 }}>
      <strong>
        Inventario dal {dataBreve(conta.started_at)} al {dataBreve(conta.closed_at)}
      </strong>
      {giorni != null && (
        <div className="muted small">
          {giorniScritti(giorni)} di consumo: il «a settimana» qui sotto è
          diviso per i giorni veri del periodo.
        </div>
      )}
      {(conta.lines || [])
        .filter((l) => l.cons != null && l.cons !== 0)
        .map((l) => (
          <div className="row between" key={l.item_id} style={{ marginTop: 4 }}>
            <span className="muted small">{l.name}</span>
            <span className="muted small">
              {l.diff != null ? (
                <>
                  venduto {formatQty(l.vend || 0, l.unit)} · differenza {l.diff > 0 ? '+' : ''}
                  {formatQty(l.diff, l.unit)} ({formatPrice(l.diff_value || 0)})
                </>
              ) : (
                <>
                  −{formatQty(l.cons, l.unit)} ({formatPrice(l.cons_value || 0)})
                </>
              )}
              {giorni != null &&
                ` · ${formatQty(consumoSettimanale(l.cons, giorni), l.unit)} a settimana`}
            </span>
          </div>
        ))}
    </div>
  )
}
