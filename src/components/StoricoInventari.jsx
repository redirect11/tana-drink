import { useEffect, useMemo, useState } from 'react'
import { fetchStockCounts, fetchInventoryItems, fetchInventoryCategories } from '../lib/api.js'
import { formatPrice } from '../lib/orderStatus.js'
import { dataBreve } from '../lib/ore.js'
import { perScaffale } from '../lib/scaffali.js'
import { righeInventarioChiuso, riassuntoInventarioChiuso } from '../lib/inventarioChiuso.js'
import { giorniScritti } from '../lib/warehouse.js'
import ListaPerScaffale from './ListaPerScaffale.jsx'
import RigaInventario from './RigaInventario.jsx'
import TestataInventario from './TestataInventario.jsx'

// ── STORICO INVENTARI (REQ-MAG-052) ────────────────────────────────────
//
// Flavio, 15/10/2026: «un tab che si chiamerà storico inventari, dove una
// volta che lo premo mi appare la lista degli inventari con la data di
// apertura e la data di chiusura, e se voglio ci clicco sopra e lo vedo;
// la casella rimanenze risulta bloccata». Prima gli inventari chiusi
// stavano in fondo all'inventario in corso, quindici al massimo, e aperti
// dicevano solo il consumo: qui si vedono TUTTI, e uno aperto è la stessa
// schermata dell'inventario in corso — DEP · ACQ · CONS · RIM, per
// categoria — con la casella della rimanenza che non si scrive più.
//
// A PAGINE: un inventario è un documento da quattrocento righe, e «tutti»
// non vuol dire tutti insieme. Si parte da una pagina e «Mostra altri» ne
// porta un'altra; articoli e categorie, che servono solo al dettaglio,
// arrivano per conto loro senza far aspettare l'elenco.

const PAGINA = 20

const periodo = (conta) => `dal ${dataBreve(conta.started_at, '—')} al ${dataBreve(conta.closed_at, '—')}`

export default function StoricoInventari() {
  const [lista, setLista] = useState(undefined) // undefined = caricamento
  const [altri, setAltri] = useState(false) // c'è un'altra pagina?
  const [items, setItems] = useState([])
  const [categorie, setCategorie] = useState([])
  const [scelto, setScelto] = useState(null)
  const [error, setError] = useState(null)

  const carica = (prima = null) =>
    fetchStockCounts({ limit: PAGINA, prima })
      .then((conte) => {
        setAltri(conte.length === PAGINA)
        const chiusi = conte.filter((c) => c.status === 'closed')
        setLista((l) => (prima ? [...(l || []), ...chiusi] : chiusi))
      })
      .catch((e) => {
        setError(e.message)
        setLista((l) => l || [])
      })

  useEffect(() => {
    carica()
    fetchInventoryItems().then(setItems, () => {})
    fetchInventoryCategories().then(setCategorie, () => {})
  }, [])

  const righe = useMemo(() => (lista || []).map((conta) => ({ conta, ...riassuntoInventarioChiuso(conta) })), [lista])

  if (lista === undefined) return <div className="empty">Carico lo storico…</div>

  if (scelto) {
    return <InventarioChiuso conta={scelto} items={items} categorie={categorie} onIndietro={() => setScelto(null)} />
  }

  return (
    <div>
      {error && <div className="banner">Errore: {error}</div>}
      {righe.length === 0 ? (
        <div className="empty">Nessun inventario chiuso.</div>
      ) : (
        <div className="card">
          <strong>Inventari chiusi</strong>
          <p className="muted small" style={{ margin: '4px 0 6px' }}>
            Dal più recente. Si apre toccando la riga: rimanenze e consumi del periodo, in sola lettura.
          </p>
          {righe.map(({ conta, giorni, totals, righe: n }) => (
            <button type="button" className="storico-inventario-riga" key={conta.id} onClick={() => setScelto(conta)}>
              <span className="grow">
                <strong>{periodo(conta)}</strong>
                <span className="muted small" style={{ display: 'block' }}>
                  {giorni != null && `${giorniScritti(giorni)} · `}
                  contati {totals.counted}/{n}
                </span>
              </span>
              <span className="muted small" style={{ textAlign: 'right' }}>
                rimanenze <strong>{formatPrice(totals.rim_value)}</strong>
                <span style={{ display: 'block' }}>consumo {formatPrice(totals.cons_value)}</span>
              </span>
            </button>
          ))}
          {altri && (
            <button
              type="button"
              className="btn ghost small block"
              style={{ marginTop: 6 }}
              onClick={() => carica(lista[lista.length - 1]?.started_at)}
            >
              Mostra altri
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// L'INVENTARIO APERTO IN LETTURA: la testata e le righe come nell'inventario
// in corso (StockCountPanel), per categoria, con la RIM bloccata.
function InventarioChiuso({ conta, items, categorie, onIndietro }) {
  const [categoria, setCategoria] = useState('all')
  const { lines, giorni, totals } = useMemo(() => righeInventarioChiuso(conta), [conta])
  const rigaDi = useMemo(() => new Map(lines.map((l) => [l.item_id, l])), [lines])
  const { voci, gruppi } = useMemo(() => perScaffale(lines, items, categorie), [lines, items, categorie])

  return (
    <div>
      <button type="button" className="btn ghost small" onClick={onIndietro}>
        ← Tutti gli inventari
      </button>
      <div style={{ marginTop: 8 }}>
        <TestataInventario
          titolo={`Inventario ${periodo(conta)}`}
          giorni={giorni}
          contati={totals.counted}
          totale={lines.length}
          totals={totals}
        >
          Inventario chiuso: RIM è la rimanenza alla chiusura e non si modifica. CONS = DEP + ACQ − RIM
          {giorni != null && '; il consumo a settimana è diviso per i giorni del periodo'}.
        </TestataInventario>
      </div>
      <div style={{ marginTop: 8 }}>
        <ListaPerScaffale
          voci={voci}
          gruppi={gruppi}
          categoria={categoria}
          onSelect={setCategoria}
          chiave="inventario-storico"
          riga={(id) => {
            const l = rigaDi.get(id)
            // La casella mostra il contato di allora, vuota dove non si è contato.
            return <RigaInventario key={id} riga={l} valore={l.contata ? l.rim : ''} soloLettura />
          }}
        />
      </div>
    </div>
  )
}
