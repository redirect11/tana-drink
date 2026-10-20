import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchInventoryItems,
  fetchInventoryCategories,
  getOpenStockCount,
  startStockCount,
  salvaRimanenza,
  closeStockCount,
  fetchStockMovementsSince,
  subscribeSettings,
  settingsIniziali,
} from '../lib/api.js'
import { assortimentoDi } from '../lib/inventory.js'
import { riassuntoAssortimento, toggleVoce } from '../lib/assortimento.js'
import { raggruppaMovimenti, righeInventario } from '../lib/inventarioInCorso.js'
import { formatPrice } from '../lib/orderStatus.js'
import { dataBreve as dataScritta } from '../lib/ore.js'
import ConfirmDialog from './ConfirmDialog.jsx'
import ListaPerScaffale from './ListaPerScaffale.jsx'
import RigaInventario from './RigaInventario.jsx'
import TestataInventario from './TestataInventario.jsx'
import { perScaffale } from '../lib/scaffali.js'
import Tendina from './Tendina.jsx'
import FiltroAssortimento from './FiltroAssortimento.jsx'

// L'INVENTARIO periodico, come il foglio INV di Flavio: per ogni prodotto
// DEP · ACQ · CONS · RIM, con CONS = DEP + ACQ − RIM. La RIM è quanto c'è
// adesso secondo l'app; accanto c'è la casella dove si scrive il contato, o
// si conferma la RIM col ✓. Il perché di questa forma, e i giri che ha
// fatto prima di arrivarci, stanno in lib/inventarioInCorso.js (REQ-MAG-046).
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

// Le righe con quello che si è scritto a schermo (`modifiche`: item_id →
// { v, at }), che vince su quello già salvato nell'inventario.
const conRimanenze = (lines, modifiche) =>
  lines.map((l) => {
    const m = modifiche[l.item_id]
    return m ? { ...l, rim: m.v, rim_at: m.at } : l
  })

export default function StockCountPanel() {
  const [open, setOpen] = useState(undefined) // undefined=caricamento
  const [modifiche, setModifiche] = useState({})
  const [items, setItems] = useState([])
  const [categorie, setCategorie] = useState([])
  const [movimenti, setMovimenti] = useState([])
  const [categoria, setCategoria] = useState('all')
  const [assortimenti, setAssortimenti] = useState([]) // vuoto = tutti
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
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
      const [oc, articoli, cats] = await Promise.all([
        getOpenStockCount(),
        fetchInventoryItems().catch(() => []),
        fetchInventoryCategories().catch(() => []),
      ])
      if (oc) setMovimenti(await fetchStockMovementsSince(oc.started_at).catch(() => []))
      setItems(articoli)
      setCategorie(cats)
      setOpen(oc)
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
  // In fila come gli scaffali (lib/scaffali.js). Dipende solo da nomi e
  // categorie, non da quello che si scrive.
  //
  // E PER ASSORTIMENTO, come i Prodotti (REQ-MAG-051). Flavio, 05/10/2026:
  // «tutti quelli fuori assortimento io me li elimino, non me lo faccio
  // l'inventario». Le righe escluse restano nell'inventario e non si
  // vedono: chiudendo, una riga senza rimanenza tiene la giacenza
  // registrata (closeStockCount salta chi non ha conteggio).
  // I prodotti di QUESTO inventario: per filtrare le righe e per i numeri
  // accanto alle voci del filtro.
  const articoliDellInventario = useMemo(() => {
    const inConta = new Set((open?.lines || []).map((l) => l.item_id))
    return items.filter((i) => inConta.has(i.id))
  }, [open, items])
  const { voci, gruppi } = useMemo(() => {
    if (!open) return { voci: [], gruppi: [] }
    const scelti = new Set(
      articoliDellInventario.filter((i) => assortimenti.includes(assortimentoDi(i))).map((i) => i.id)
    )
    const righe = assortimenti.length ? open.lines.filter((l) => scelti.has(l.item_id)) : open.lines
    return perScaffale(righe, items, categorie)
  }, [open, items, categorie, assortimenti, articoliDellInventario])

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
      // aperto con le giacenze di prima. L'inventario appena chiuso si
      // ritrova nello Storico inventari (REQ-MAG-052).
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
          <TestataInventario
            titolo={`Inventario in corso dal ${dataBreve(open.started_at)}`}
            giorni={computed.giorni}
            contati={computed.totals.counted}
            totale={open.lines.length}
            totals={computed.totals}
          >
            RIM: giacenza registrata. Nella casella si inserisce la rimanenza rilevata, oppure si conferma la
            RIM con ✓. CONS = DEP + ACQ − RIM.
          </TestataInventario>

          <div className="inv-testa" style={{ marginTop: 8 }}>
            <Tendina
              etichetta="Filtra i prodotti"
              attivo={assortimenti.length > 0}
              riassunto={`⚗️ ${riassuntoAssortimento(assortimenti)}`}
            >
              <FiltroAssortimento
                items={articoliDellInventario}
                scelti={assortimenti}
                onToggle={(k) => setAssortimenti((a) => toggleVoce(a, k))}
              />
              {assortimenti.length > 0 && (
                <button
                  type="button"
                  className="btn ghost small block"
                  style={{ marginTop: 6 }}
                  onClick={() => setAssortimenti([])}
                >
                  ✕ Togli i filtri
                </button>
              )}
            </Tendina>
          </div>
          {assortimenti.length > 0 && (
            <p className="muted small" style={{ margin: '6px 0 0' }}>
              I prodotti esclusi dal filtro restano nell’inventario: senza rimanenza inserita, alla chiusura
              mantengono la giacenza registrata.
            </p>
          )}

          <div style={{ marginTop: 8 }}>
            <ListaPerScaffale
              voci={voci}
              gruppi={gruppi}
              categoria={categoria}
              onSelect={setCategoria}
              chiave="inventario-conta"
              riga={(id) => (
                <RigaInventario
                  key={id}
                  riga={rigaDi.get(id)}
                  valore={modifiche[id]?.v ?? rigaDi.get(id)?.rim ?? ''}
                  onScrivi={scriviRimanenza}
                  onEsci={salvaSubito}
                />
              )}
            />
          </div>

          <p className="muted small" style={{ margin: '10px 0 6px' }}>
            Le rimanenze si salvano mentre le scrivi: si può smettere e riprendere più tardi.
          </p>
          <button className="btn block" onClick={chiediConferma} disabled={busy}>
            ✅ Chiudi l’inventario
          </button>
        </>
      )}

      {confirmClose && computed && (
        <ConfirmDialog
          title="✅ Chiudere l’inventario?"
          message={`Prodotti contati: ${computed.totals.counted}/${open.lines.length}.\nLe giacenze dei prodotti contati diventano il numero contato (differenza: ${formatPrice(computed.totals.diff_value)}).\nConsumo del periodo: ${formatPrice(computed.totals.cons_value)}.${riapreDaSola ? '\nNe parte subito uno nuovo, da oggi.' : ''}`}
          confirmLabel="Chiudi l’inventario"
          onCancel={() => setConfirmClose(false)}
          onConfirm={doClose}
        />
      )}
    </div>
  )
}

// La data come la si legge; dove manca, un trattino.
const dataBreve = (iso) => dataScritta(iso, '—')
