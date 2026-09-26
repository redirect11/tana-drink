import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import {
  fetchInventoryItems,
  fetchInventoryCategories,
  fetchStockMovementsSince,
  registraConteggio,
  settingsIniziali,
} from '../lib/api.js'
import { formatQty } from '../lib/inventory.js'
import { magazzinoNelPeriodo, giorniDiScorta } from '../lib/magazzinoPeriodo.js'
import { businessDayKey, DEFAULT_CUTOFF_HOUR } from '../lib/businessDay.js'
import { shiftDay, dataBreve } from '../lib/ore.js'
import { formatPrice } from '../lib/orderStatus.js'
import { perScaffale } from '../lib/scaffali.js'
import CategoryRail from './CategoryRail.jsx'

// ── IL CONTROLLO DEL MAGAZZINO, PAGINA DI PROVA (REQ-MAG-050) ─────────
//
// Daniele, 26/09/2026: «fai una nuova pagina inventario come la faresti tu,
// attivabile solo per test, in modo da poter vedere la differenza di
// funzionamento di come la vuole Flavio e di come la faresti tu».
//
// LA DIFFERENZA DI FONDO. Il foglio INV (e l'inventario che lo ricalca)
// esisteva perché Flavio NON aveva i dati delle vendite: il consumo si
// ricavava contando lo scaffale, DEP + ACQ − RIM. Oggi l'app sa cosa si è
// venduto, ricetta per ricetta, e ogni cambio di giacenza è un movimento
// col suo motivo. Allora il conteggio non serve più a CALCOLARE il consumo:
// serve a MISURARE quanto l'app si sbaglia. E un conto unico che mescola
// venduto, rotto, offerto e sparito non risponde a nessuna delle domande
// che contano. Qui le domande sono tre, e la pagina ha due schede:
//
//   CONTA — un prodotto alla volta, quando si vuole, scaffale per scaffale.
//     Niente inventario da aprire e chiudere (la cerimonia di 403 righe che
//     ha prodotto BUG-110 e BUG-112): il conteggio corregge subito quella
//     giacenza e lascia un movimento `conta`. Accanto, da quanto un
//     prodotto non si conta.
//   RAPPORTO — per un periodo: Inizio + Acquisti − Venduto ± Differenza =
//     Fine, con la DIFFERENZA IN EURO in cima (quanto si perde) e l'elenco
//     ordinato da dove se ne perde di più. E per ogni prodotto quanti giorni
//     dura la scorta al ritmo del periodo (quanto ordinare).
//
// Tutto si legge dai movimenti che ci sono già, con la stessa tabella
// motivo → colonna (magazzinoPeriodo.js) delle statistiche.

const GIORNI_STORIA = 90
const PERIODI = [7, 30, 90]
const SCHEDE = [
  ['conta', 'Conta'],
  ['rapporto', 'Rapporto'],
]

export default function ControlloMagazzino() {
  const [scheda, setScheda] = useState('conta')
  const [items, setItems] = useState(null)
  const [categorie, setCategorie] = useState([])
  const [movimenti, setMovimenti] = useState([])
  const [errore, setErrore] = useState(null)
  // L'ora di taglio del locale, dalla cache delle impostazioni.
  const cutoff = settingsIniziali()?.business_day_cutoff_hour ?? DEFAULT_CUTOFF_HOUR
  const oggi = businessDayKey(new Date(), cutoff)

  useEffect(() => {
    let vivo = true
    // Novanta giorni di movimenti bastano a tutti e due: al rapporto più
    // lungo e a «da quanto non lo conti».
    const da = `${shiftDay(oggi, -GIORNI_STORIA)}T00:00:00.000Z`
    Promise.all([fetchInventoryItems(), fetchInventoryCategories().catch(() => []), fetchStockMovementsSince(da)])
      .then(([it, cats, mov]) => {
        if (!vivo) return
        setItems(it)
        setCategorie(cats)
        setMovimenti(mov)
      })
      .catch((e) => vivo && setErrore(e.message))
    return () => {
      vivo = false
    }
  }, [oggi])

  // Un conteggio si vede nell'istante del tocco: la giacenza si compone in
  // memoria, e il movimento si aggiunge alla storia che si ha in mano.
  const conta = useCallback((item, valore) => {
    setErrore(null)
    try {
      const { item: dopo, movimento } = registraConteggio(item, valore)
      setItems((lista) => lista.map((i) => (i.id === dopo.id ? dopo : i)))
      setMovimenti((m) => [...m, movimento])
    } catch (e) {
      setErrore(e.message)
    }
  }, [])

  if (errore && !items) return <div className="banner">Errore: {errore}</div>
  if (!items) return <div className="empty">Carico il magazzino…</div>

  return (
    <div>
      <div className="card">
        <strong>🧪 Controllo del magazzino — prova</strong>
        <p className="muted small" style={{ margin: '6px 0 0' }}>
          Una vista diversa dall’Inventario, da confrontare. Si conta un prodotto alla volta, quando
          si vuole: il conteggio corregge subito la giacenza e resta nei movimenti. Il rapporto dice,
          per il periodo scelto, cosa è entrato, cosa è stato venduto, quanto il contato si è
          discostato da quello che risultava, e quanti giorni dura la scorta.
        </p>
      </div>
      <div className="chips-row" style={{ margin: '8px 0' }}>
        {SCHEDE.map(([id, nome]) => (
          <button key={id} className={`chip${scheda === id ? ' active' : ''}`} onClick={() => setScheda(id)}>
            {nome}
          </button>
        ))}
      </div>
      {errore && <div className="banner">Errore: {errore}</div>}
      {scheda === 'conta' ? (
        <Conta items={items} categorie={categorie} movimenti={movimenti} cutoff={cutoff} onConta={conta} />
      ) : (
        <Rapporto items={items} movimenti={movimenti} oggi={oggi} cutoff={cutoff} />
      )}
    </div>
  )
}

// ── CONTA ─────────────────────────────────────────────────────────────
function Conta({ items, categorie, movimenti, cutoff, onConta }) {
  const [categoria, setCategoria] = useState('all')
  const perId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
  // L'ultimo conteggio di ogni prodotto: il movimento `conta` più recente.
  const ultimo = useMemo(() => {
    const m = new Map()
    for (const x of movimenti) {
      if (x.reason !== 'conta' || !x.created_at) continue
      if (!m.has(x.item_id) || x.created_at > m.get(x.item_id)) m.set(x.item_id, x.created_at)
    }
    return m
  }, [movimenti])
  const { voci, gruppi } = useMemo(
    () => perScaffale(items.map((i) => ({ item_id: i.id, name: i.name })), items, categorie),
    [items, categorie]
  )
  const visibili = categoria === 'all' ? gruppi : gruppi.filter((g) => g.key === categoria)

  return (
    <CategoryRail items={voci} selected={categoria} onSelect={setCategoria} chiave="controllo-magazzino">
      <div className="inv-list">
        {visibili.map((g) => (
          <div key={g.key}>
            {categoria === 'all' && (
              <div className="muted small" style={{ padding: '10px 4px 4px', fontWeight: 600 }}>
                {g.nome}
              </div>
            )}
            {g.ids.map((id) => {
              const quando = ultimo.get(id)
              return (
                <RigaConta
                  key={id}
                  item={perId.get(id)}
                  contatoIl={quando ? dataBreve(businessDayKey(quando, cutoff)) : null}
                  onConta={onConta}
                />
              )
            })}
          </div>
        ))}
      </div>
    </CategoryRail>
  )
}

// Una riga della Conta. Quello che si scrive sta QUI, non nella lista: con
// quattrocento righe e un telefono in mano, ridisegnarle tutte a ogni cifra
// si sente (è la stessa cura dell'inventario).
const RigaConta = memo(function RigaConta({ item: it, contatoIl, onConta }) {
  const [valore, setValore] = useState('')
  return (
    <div className="inv-item">
      <div className="inv-row" style={{ cursor: 'default' }}>
        <div className="grow">
          <div className="inv-name">{it.name}</div>
          <div className="muted small">
            Risulta {formatQty(it.stock, it.unit)} ·{' '}
            {contatoIl ? `contato il ${contatoIl}` : `non contato negli ultimi ${GIORNI_STORIA} giorni`}
          </div>
        </div>
        <input
          type="number"
          step="any"
          min="0"
          value={valore}
          placeholder={it.unit}
          aria-label={`Quanto c'è di ${it.name}`}
          onChange={(e) => setValore(e.target.value)}
          style={{ width: 90, textAlign: 'right' }}
        />
        <button
          type="button"
          className="btn small"
          disabled={valore === ''}
          aria-label={`Conta ${it.name}`}
          onClick={() => {
            onConta(it, valore)
            setValore('')
          }}
        >
          Conta
        </button>
      </div>
    </div>
  )
})

// ── RAPPORTO ──────────────────────────────────────────────────────────
function Rapporto({ items, movimenti, oggi, cutoff }) {
  const [giorni, setGiorni] = useState(30)
  const dal = shiftDay(oggi, -(giorni - 1))
  const { righe, totali } = useMemo(
    () => magazzinoNelPeriodo(movimenti, items, { dal, al: oggi, cutoffHour: cutoff }),
    [movimenti, items, dal, oggi, cutoff]
  )
  // IN CIMA DOVE SI PERDE DI PIÙ: la domanda del rapporto è dove sparisce la
  // merce, non cosa si è mosso di più.
  const ordinate = useMemo(
    () => [...righe].sort((a, b) => a.rett_valore - b.rett_valore || b.cons_valore - a.cons_valore),
    [righe]
  )

  return (
    <div>
      <div className="chips-row" style={{ marginBottom: 6 }}>
        {PERIODI.map((n) => (
          <button key={n} className={`chip${giorni === n ? ' active' : ''}`} onClick={() => setGiorni(n)}>
            {n} giorni
          </button>
        ))}
      </div>
      <div className="card">
        <div className="muted small">
          Dal {dataBreve(dal)} al {dataBreve(oggi)} · {totali.prodotti} prodotti mossi
        </div>
        <div className="summary-rows" style={{ margin: '6px 0 0' }}>
          <div className="row between">
            <span>Acquisti</span>
            <strong>{formatPrice(totali.acq_valore)}</strong>
          </div>
          <div className="row between">
            <span>Venduto (costo)</span>
            <strong>{formatPrice(totali.cons_valore)}</strong>
          </div>
          <div className="row between">
            <span>Differenza fra contato e risultante</span>
            <strong>{formatPrice(totali.rett_valore)}</strong>
          </div>
          <div className="row between">
            <span>Valore del magazzino a fine periodo</span>
            <strong>{formatPrice(totali.fine_valore)}</strong>
          </div>
        </div>
      </div>
      <div className="inv-list" style={{ marginTop: 8 }}>
        {ordinate.map((r) => (
          <RigaRapporto key={r.item_id} r={r} giorni={giorni} />
        ))}
      </div>
    </div>
  )
}

function RigaRapporto({ r, giorni }) {
  const q = (n) => formatQty(n, r.unit)
  const dura = giorniDiScorta(r, giorni)
  return (
    <div className="inv-item">
      <div className="inv-row" style={{ cursor: 'default' }}>
        <div className="grow">
          <div className="inv-name">{r.name}</div>
          <div className="muted small">
            Inizio {q(r.dep)} · + Acquisti {q(r.acq)} · − Venduto {q(r.cons)} · ± Differenza{' '}
            {q(r.rett)} · = Fine {q(r.fine)}
          </div>
          <div className="small">
            {r.rett !== 0 && (
              <>
                Differenza <strong>{formatPrice(r.rett_valore)}</strong>
                {dura != null && ' · '}
              </>
            )}
            {dura != null && `dura circa ${dura} ${dura === 1 ? 'giorno' : 'giorni'}`}
          </div>
        </div>
      </div>
    </div>
  )
}
