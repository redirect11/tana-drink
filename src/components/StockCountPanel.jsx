import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { raggruppaMovimenti, righeInventario } from '../lib/inventarioInCorso.js'
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
//
// SI SCRIVE SUL TELEFONO, CON QUATTROCENTO RIGHE. Quello che non dipende da
// cosa si batte — lo smistamento dei movimenti, l'ordine delle righe — si
// calcola una volta sola; a ogni cifra si rifanno i numeri, e si ridisegna
// solo la riga che è cambiata.

const collator = new Intl.Collator('it')

// Le righe con quello che si è scritto a schermo (`modifiche`: item_id →
// { v, at }), che vince su quello già salvato nell'inventario.
const conRimanenze = (lines, modifiche) =>
  lines.map((l) => {
    const m = modifiche[l.item_id]
    return m ? { ...l, rim: m.v, rim_at: m.at } : l
  })

export default function StockCountPanel() {
  const [open, setOpen] = useState(undefined) // undefined=caricamento
  const [history, setHistory] = useState([])
  const [modifiche, setModifiche] = useState({})
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
  // dalla schermata. Le funzioni restano le stesse fra un disegno e l'altro
  // (l'inventario aperto lo leggono da un ref), così le righe che non
  // cambiano non si ridisegnano.
  const contaId = useRef(null)
  contaId.current = open?.id ?? null
  const inSospeso = useRef({}) // item_id -> { timer, v, at }
  const salvaSubito = useCallback((itemId) => {
    const p = inSospeso.current[itemId]
    if (!p) return
    clearTimeout(p.timer)
    delete inSospeso.current[itemId]
    if (contaId.current) salvaRimanenza(contaId.current, itemId, p.v, p.at)
  }, [])
  const scriviRimanenza = useCallback(
    (itemId, v) => {
      const at = new Date().toISOString()
      setModifiche((m) => ({ ...m, [itemId]: { v, at } }))
      clearTimeout(inSospeso.current[itemId]?.timer)
      inSospeso.current[itemId] = { v, at, timer: setTimeout(() => salvaSubito(itemId), 600) }
    },
    [salvaSubito]
  )
  useEffect(
    () => () => {
      for (const id of Object.keys(inSospeso.current)) salvaSubito(id)
    },
    [salvaSubito]
  )

  async function load() {
    try {
      const [oc, hist, articoli, cats] = await Promise.all([
        getOpenStockCount(),
        fetchStockCounts({ limit: 15 }),
        fetchInventoryItems().catch(() => []),
        fetchInventoryCategories().catch(() => []),
      ])
      if (oc) setMovimenti(await fetchStockMovementsSince(oc.started_at).catch(() => []))
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

  // Il passo pesante, fuori dalla battitura: cambia solo coi dati.
  const raggruppati = useMemo(() => raggruppaMovimenti(movimenti, items), [movimenti, items])
  const computed = useMemo(() => {
    if (!open) return null
    // La conta è APERTA: il suo periodo finisce adesso e si allunga mentre
    // la si compila.
    return righeInventario(conRimanenze(open.lines, modifiche), { raggruppati, items, dal: open.started_at })
  }, [open, modifiche, raggruppati, items])
  const rigaDi = useMemo(() => new Map((computed?.lines || []).map((l) => [l.item_id, l])), [computed])

  // ── LE CATEGORIE ────────────────────────────────────────────────────
  // In fila come gli scaffali: categoria per categoria, nell'ordine del
  // magazzino, e dentro in ordine alfabetico. Dipende solo da nomi e
  // categorie, non da quello che si scrive.
  const { voci, gruppi } = useMemo(() => {
    if (!open) return { voci: [], gruppi: [] }
    const catDi = new Map(items.map((i) => [i.id, i.category_id]))
    const perCat = new Map(categorie.map((c, i) => [c.id, { i, nome: c.name, righe: [] }]))
    const senza = { i: Infinity, nome: 'Senza categoria', righe: [] }
    for (const l of open.lines) (perCat.get(catDi.get(l.item_id)) || senza).righe.push(l)
    const tutti = [...perCat.entries(), ['none', senza]]
      .filter(([, g]) => g.righe.length > 0)
      .sort(([, a], [, b]) => a.i - b.i)
    for (const [, g] of tutti) g.righe.sort((a, b) => collator.compare(String(a.name), String(b.name)))
    return {
      voci: [
        { key: 'all', label: 'Tutte', count: open.lines.length },
        ...tutti.map(([key, g]) => ({ key, label: g.nome, count: g.righe.length })),
      ],
      gruppi: tutti.map(([key, g]) => ({ key, nome: g.nome, ids: g.righe.map((l) => l.item_id) })),
    }
  }, [open, items, categorie])
  const visibili = categoria === 'all' ? gruppi : gruppi.filter((g) => g.key === categoria)

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

  // IL NUMERO CHE SI CONFERMA È QUELLO CHE SI APPLICA. I numeri a schermo
  // sono dell'apertura della pagina; nel frattempo il locale può aver
  // venduto. Prima di chiedere conferma si rileggono giacenze e movimenti
  // (dalla cache, se la rete non c'è), così la differenza nel messaggio è
  // quella che la chiusura scriverà.
  async function chiediConferma() {
    if (!open) return
    setBusy(true)
    try {
      const [articoli, mov] = await Promise.all([
        fetchInventoryItems().catch(() => items),
        fetchStockMovementsSince(open.started_at).catch(() => movimenti),
      ])
      setItems(articoli)
      setMovimenti(mov)
      setConfirmClose(true)
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
      // Le differenze le calcola la chiusura, coi dati di quel momento
      // (vedi closeStockCount): da qui passa solo quello che si è scritto.
      const chiusa = await closeStockCount(open.id, {
        lines: conRimanenze(open.lines, modifiche),
        riapri: riapreDaSola,
      })
      // L'esito si compone, non si rilegge: la chiusura è partita in
      // sottofondo, e una rilettura adesso troverebbe l'inventario ancora
      // aperto con le giacenze di prima.
      setHistory((h) => [
        { ...open, status: 'closed', closed_at: new Date().toISOString(), lines: chiusa.lines, totals: chiusa.totals },
        ...h,
      ])
      setOpen(chiusa.prossimo)
      setMovimenti([])
      setModifiche({})
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
                {visibili.map((g) => (
                  <div key={g.key}>
                    {categoria === 'all' && (
                      <div className="muted small" style={{ padding: '10px 4px 4px', fontWeight: 600 }}>
                        {g.nome}
                      </div>
                    )}
                    {g.ids.map((id) => (
                      <RigaInventario
                        key={id}
                        riga={rigaDi.get(id)}
                        valore={modifiche[id]?.v ?? rigaDi.get(id)?.rim ?? ''}
                        onScrivi={scriviRimanenza}
                        onEsci={salvaSubito}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </CategoryRail>
          </div>

          <p className="muted small" style={{ margin: '10px 0 6px' }}>
            Le rimanenze si salvano mentre le scrivi: si può smettere e riprendere più tardi.
          </p>
          <button className="btn block" onClick={chiediConferma} disabled={busy}>
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

// «+0,4 pz», «-1,9 pz»: una differenza si legge col suo segno.
const conSegno = (n, unit) => `${n > 0 ? '+' : ''}${formatQty(n, unit)}`

// Una riga: i numeri del periodo, e il campo dove si scrive il contato. Si
// ridisegna solo se cambia qualcosa che mostra: con quattrocento righe e un
// telefono in mano, ridisegnarle tutte a ogni cifra si sente.
const RigaInventario = memo(
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
                DIFFERENZA <strong>{conSegno(l.diff, l.unit)}</strong>
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
            onChange={(e) => onScrivi(l.item_id, e.target.value)}
            onBlur={() => onEsci(l.item_id)}
            style={{ width: 100, textAlign: 'right' }}
          />
        </div>
      </div>
    )
  },
  (a, b) =>
    a.valore === b.valore &&
    a.onScrivi === b.onScrivi &&
    a.onEsci === b.onEsci &&
    ['name', 'unit', 'dep', 'acq', 'vend', 'atteso', 'diff', 'diff_value', 'cons_week'].every(
      (k) => a.riga[k] === b.riga[k]
    )
)

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
              {l.diff != null
                ? `venduto ${formatQty(l.vend || 0, l.unit)} · differenza ${conSegno(l.diff, l.unit)} (${formatPrice(l.diff_value || 0)})`
                : `−${formatQty(l.cons, l.unit)} (${formatPrice(l.cons_value || 0)})`}
              {giorni != null &&
                ` · ${formatQty(consumoSettimanale(l.cons, giorni), l.unit)} a settimana`}
            </span>
          </div>
        ))}
    </div>
  )
}
