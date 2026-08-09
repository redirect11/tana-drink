import { useMemo, useState } from 'react'
import CategoryRail from './CategoryRail.jsx'
import { formatPrice, paymentMethodLabel, cashMethodKeys } from '../lib/orderStatus.js'
import {
  rendicontoOrdini,
  rendicontoProdotti,
  categorieDi,
  sommaRighe,
} from '../lib/rendiconto.js'

// RENDICONTO DELLA SERATA: la lettura completa di una cassa chiusa, in due
// viste sugli stessi ordini.
//
//   📋 Conti      → una riga per ordine: lordo, sconto, netto, costo, guadagno.
//                   Si apre e mostra i prodotti di QUEL conto.
//   📊 Cumulativo → il venduto per prodotto, con le categorie a sinistra come
//                   nelle altre schermate.
//
// Tutte le cifre sono il venduto reale: lo sconto è già ripartito sulle righe
// in proporzione al prezzo (vedi rendiconto.js). Dove il costo di un
// ingrediente non è noto la riga è marcata: il guadagno lì è ottimistico e
// dirlo vale più che mostrare un numero pulito e sbagliato.

const fmtOra = (iso) => {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return '—'
  }
}
const fmtData = (iso) => {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('it-IT', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return ''
  }
}
const pct = (v) => (v == null ? '—' : `${v.toFixed(1).replace('.', ',')}%`)

export default function RendicontoSerata({ session, orders, drinksById, itemsById, recap, onClose }) {
  const [vista, setVista] = useState('conti')
  // I conti si leggono in due modi: a tabella per confrontare le colonne, a
  // card per scorrerli come nella schermata ordini. La scelta si ricorda.
  const [forma, setForma] = useState(() => {
    try {
      return localStorage.getItem('tana:rendiconto:forma') === 'card' ? 'card' : 'tabella'
    } catch {
      return 'tabella'
    }
  })
  const cambiaForma = (f) => {
    setForma(f)
    try {
      localStorage.setItem('tana:rendiconto:forma', f)
    } catch {
      /* ok */
    }
  }
  const [apertoId, setApertoId] = useState(null)
  const [cat, setCat] = useState('__tutte__')

  const ctx = useMemo(() => ({ drinksById, itemsById }), [drinksById, itemsById])
  const conti = useMemo(() => rendicontoOrdini(orders, ctx), [orders, ctx])
  const prodotti = useMemo(() => rendicontoProdotti(orders, ctx), [orders, ctx])
  const categorie = useMemo(() => categorieDi(prodotti), [prodotti])
  const prodottiVisti = useMemo(
    () => (cat === '__tutte__' ? prodotti : prodotti.filter((p) => p.categoria === cat)),
    [prodotti, cat]
  )
  const totConti = useMemo(() => sommaRighe(conti), [conti])
  const totProdotti = useMemo(() => sommaRighe(prodottiVisti), [prodottiVisti])

  const byMethod = recap?.byMethod || {}

  return (
    <div className="rendiconto">
      <div className="row between" style={{ alignItems: 'flex-start', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0 }}>Rendiconto serata</h2>
          <div className="muted small">
            {fmtData(session?.opened_at)} · {fmtOra(session?.opened_at)} →{' '}
            {session?.closed_at ? fmtOra(session.closed_at) : 'in corso'}
          </div>
        </div>
        <button className="btn ghost small" onClick={onClose}>
          ← Chiudi
        </button>
      </div>

      {/* Testata: i numeri che si guardano per primi. */}
      <div className="rend-kpi">
        <div className="rend-kpi-box">
          <span className="muted small">Incassato</span>
          <strong>{formatPrice(totConti.netto)}</strong>
          <span className="muted small">{totConti.conti} conti</span>
        </div>
        <div className="rend-kpi-box">
          <span className="muted small">Sconti concessi</span>
          <strong>{totConti.sconto > 0 ? `−${formatPrice(totConti.sconto)}` : formatPrice(0)}</strong>
          <span className="muted small">su {formatPrice(totConti.lordo)} di listino</span>
        </div>
        <div className="rend-kpi-box">
          <span className="muted small">Costo merce</span>
          <strong>{formatPrice(totConti.costo)}</strong>
          <span className="muted small">{totConti.parziale ? 'stima parziale' : 'da ricette'}</span>
        </div>
        <div className="rend-kpi-box rend-kpi-forte">
          <span className="muted small">Guadagno lordo</span>
          <strong>{formatPrice(totConti.guadagno)}</strong>
          <span className="muted small">margine {pct(totConti.margine)}</span>
        </div>
      </div>

      {cashMethodKeys(byMethod).some((k) => byMethod[k] > 0) && (
        <div className="chips-row" style={{ marginBottom: 4 }}>
          {cashMethodKeys(byMethod)
            .filter((k) => byMethod[k] > 0)
            .map((k) => (
              <span className="chip" key={k}>
                {paymentMethodLabel(k)} {formatPrice(byMethod[k])}
              </span>
            ))}
        </div>
      )}

      {totConti.parziale && (
        <div className="banner">
          Il costo di qualche ingrediente non è in inventario: le righe segnate con ~ hanno un
          guadagno <strong>ottimistico</strong>, non un dato certo.
        </div>
      )}

      <div className="tabs">
        <button
          type="button"
          className={`tab${vista === 'conti' ? ' active' : ''}`}
          onClick={() => setVista('conti')}
        >
          📋 Conti
        </button>
        <button
          type="button"
          className={`tab${vista === 'prodotti' ? ' active' : ''}`}
          onClick={() => setVista('prodotti')}
        >
          📊 Cumulativo vendite
        </button>
      </div>

      {/* Dentro i conti, un secondo tab sceglie COME leggerli: a lista (card,
          come nella schermata ordini) o a tabella (colonne confrontabili). */}
      {vista === 'conti' && (
        <>
          <div className="tabs rend-subtabs">
            <button
              type="button"
              className={`tab${forma === 'card' ? ' active' : ''}`}
              onClick={() => cambiaForma('card')}
            >
              ▤ Lista
            </button>
            <button
              type="button"
              className={`tab${forma === 'tabella' ? ' active' : ''}`}
              onClick={() => cambiaForma('tabella')}
            >
              ▦ Tabella
            </button>
          </div>
          <div className="muted small" style={{ margin: '0 0 8px' }}>
            {totConti.conti} conti · tocca per vedere cosa è stato venduto
          </div>
        </>
      )}

      {vista === 'conti' && forma === 'card' ? (
        <div className="rend-cards">
          {conti.map((c) => (
            <CardConto
              key={c.id}
              conto={c}
              aperto={apertoId === c.id}
              onToggle={() => setApertoId(apertoId === c.id ? null : c.id)}
            />
          ))}
          {conti.length === 0 && <p className="muted small">Nessun conto in questa serata.</p>}
        </div>
      ) : vista === 'conti' ? (
        <div className="table-scroll">
          <table className="rend-tab">
            <thead>
              <tr>
                <th className="rowhead">Conto</th>
                <th>Ora</th>
                <th>Pezzi</th>
                <th>Pagamento</th>
                <th>Listino</th>
                <th>Sconto</th>
                <th>Incassato</th>
                <th>Costo</th>
                <th>Guadagno</th>
                <th>Marg.</th>
              </tr>
            </thead>
            <tbody>
              {conti.map((c) => (
                <RigaConto
                  key={c.id}
                  conto={c}
                  aperto={apertoId === c.id}
                  onToggle={() => setApertoId(apertoId === c.id ? null : c.id)}
                />
              ))}
              {conti.length === 0 && (
                <tr>
                  <td className="rowhead" colSpan={10}>
                    <span className="muted">Nessun conto in questa serata.</span>
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <th className="rowhead">Totale</th>
                <th />
                <th>{totConti.pezzi}</th>
                <th />
                <th>{formatPrice(totConti.lordo)}</th>
                <th>{totConti.sconto > 0 ? `−${formatPrice(totConti.sconto)}` : '—'}</th>
                <th>{formatPrice(totConti.netto)}</th>
                <th>{formatPrice(totConti.costo)}</th>
                <th>{formatPrice(totConti.guadagno)}</th>
                <th>{pct(totConti.margine)}</th>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <CategoryRail
          items={categorie}
          selected={cat}
          onSelect={setCat}
          storageKey="rendiconto"
        >
          <div className="table-scroll">
            <table className="rend-tab">
              <thead>
                <tr>
                  <th className="rowhead">Prodotto</th>
                  <th>Categoria</th>
                  <th>Pezzi</th>
                  <th>Prezzo medio</th>
                  <th>Listino</th>
                  <th>Sconto</th>
                  <th>Venduto</th>
                  <th>Costo</th>
                  <th>Guadagno</th>
                  <th>Marg.</th>
                </tr>
              </thead>
              <tbody>
                {prodottiVisti.map((p) => (
                  <tr key={p.name}>
                    <td className="rowhead">
                      {p.name}
                      {!p.costoNoto && <span className="muted" title="costo non completo"> ~</span>}
                    </td>
                    <td className="muted">{p.categoria}</td>
                    <td>{p.qty}</td>
                    <td>{formatPrice(p.prezzoMedio)}</td>
                    <td className="muted">{formatPrice(p.lordo)}</td>
                    <td>{p.sconto > 0 ? `−${formatPrice(p.sconto)}` : '—'}</td>
                    <td>
                      <strong>{formatPrice(p.netto)}</strong>
                    </td>
                    <td className="muted">{formatPrice(p.costo)}</td>
                    <td className={p.guadagno < 0 ? 'neg' : ''}>{formatPrice(p.guadagno)}</td>
                    <td className="muted">{pct(p.margine)}</td>
                  </tr>
                ))}
                {prodottiVisti.length === 0 && (
                  <tr>
                    <td className="rowhead" colSpan={10}>
                      <span className="muted">Nessun prodotto in questa categoria.</span>
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr>
                  <th className="rowhead">
                    Totale{cat !== '__tutte__' ? ` · ${cat}` : ''}
                  </th>
                  <th />
                  <th>{totProdotti.qty}</th>
                  <th />
                  <th>{formatPrice(totProdotti.lordo)}</th>
                  <th>{totProdotti.sconto > 0 ? `−${formatPrice(totProdotti.sconto)}` : '—'}</th>
                  <th>{formatPrice(totProdotti.netto)}</th>
                  <th>{formatPrice(totProdotti.costo)}</th>
                  <th>{formatPrice(totProdotti.guadagno)}</th>
                  <th>{pct(totProdotti.margine)}</th>
                </tr>
              </tfoot>
            </table>
          </div>
        </CategoryRail>
      )}

      <p className="muted small" style={{ marginTop: 10 }}>
        Gli importi sono il <strong>venduto reale</strong>, non il listino: lo sconto del conto è
        ripartito <strong>in proporzione al prezzo</strong> di ogni riga (su 10&nbsp;€ con 1&nbsp;€
        di sconto, una birra da 4&nbsp;€ conta 3,60 e un cocktail da 6&nbsp;€ conta 5,40). Il costo
        viene dalle ricette valorizzate sull&apos;inventario, IVA compresa come i ricavi.
      </p>
    </div>
  )
}

// Card di un conto, nello stile della schermata ordini: si tocca e si apre
// mostrando cosa è stato venduto su quel conto.
function CardConto({ conto, aperto, onToggle }) {
  return (
    <div className={`rend-card${aperto ? ' aperta' : ''}`}>
      <button type="button" className="rend-card-head" onClick={onToggle}>
        <span className="rend-card-num">#{conto.numero ?? '—'}</span>
        <span className="grow rend-card-nome">
          {conto.nome || <span className="muted">senza nome</span>}
          <span className="muted small">
            {' '}
            · {fmtOra(conto.quando)} · {conto.pezzi} pz
          </span>
          <br />
          <span className="muted small">
            {conto.metodi.length ? conto.metodi.map(paymentMethodLabel).join(' + ') : 'non incassato'}
          </span>
        </span>
        <span className="rend-card-cifre">
          <strong className="price">{formatPrice(conto.netto)}</strong>
          {conto.sconto > 0 && (
            <span className="sconto-badge"> 🎁 −{formatPrice(conto.sconto)}</span>
          )}
          <span className={`muted small${conto.guadagno < 0 ? ' neg' : ''}`}>
            guadagno {formatPrice(conto.guadagno)}
            {conto.parziale ? ' ~' : ''}
          </span>
        </span>
      </button>

      {aperto && (
        <div className="rend-card-righe">
          {conto.righe.map((r, i) => (
            <div className="row between rend-card-riga" key={`${conto.id}-${r.name}-${i}`}>
              <span className="grow">
                {r.qty}× {r.name}
                <span className="muted small"> · {formatPrice(r.prezzo)} cad.</span>
              </span>
              {r.sconto > 0 && <span className="muted small">−{formatPrice(r.sconto)}</span>}
              <strong>{formatPrice(r.netto)}</strong>
              <span className="muted small" style={{ minWidth: 92, textAlign: 'right' }}>
                {r.costoNoto ? `costo ${formatPrice(r.costo)}` : 'costo n/d'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Riga di un conto: si apre e mostra i prodotti di quel conto, con la quota di
// sconto che è ricaduta su ciascuno.
function RigaConto({ conto, aperto, onToggle }) {
  return (
    <>
      <tr className={`rend-riga${aperto ? ' aperta' : ''}`} onClick={onToggle}>
        <td className="rowhead">
          <span className="rend-caret">{aperto ? '▾' : '▸'}</span> #{conto.numero ?? '—'}
          {conto.nome ? ` · ${conto.nome}` : ''}
          {conto.parziale && <span className="muted" title="costo non completo"> ~</span>}
        </td>
        <td>{fmtOra(conto.quando)}</td>
        <td>{conto.pezzi}</td>
        <td className="muted">
          {conto.metodi.length ? conto.metodi.map(paymentMethodLabel).join(' + ') : '—'}
        </td>
        <td className="muted">{formatPrice(conto.lordo)}</td>
        <td>{conto.sconto > 0 ? `−${formatPrice(conto.sconto)}` : '—'}</td>
        <td>
          <strong>{formatPrice(conto.netto)}</strong>
        </td>
        <td className="muted">{formatPrice(conto.costo)}</td>
        <td className={conto.guadagno < 0 ? 'neg' : ''}>{formatPrice(conto.guadagno)}</td>
        <td className="muted">{pct(conto.margine)}</td>
      </tr>
      {aperto &&
        conto.righe.map((r, i) => (
          <tr className="rend-dettaglio" key={`${conto.id}-${r.name}-${i}`}>
            <td className="rowhead">
              &nbsp;&nbsp;&nbsp;&nbsp;{r.qty}× {r.name}
            </td>
            <td colSpan={2} className="muted">
              {r.categoria}
            </td>
            <td className="muted">{formatPrice(r.prezzo)} cad.</td>
            <td className="muted">{formatPrice(r.lordo)}</td>
            <td>{r.sconto > 0 ? `−${formatPrice(r.sconto)}` : '—'}</td>
            <td>{formatPrice(r.netto)}</td>
            <td className="muted">{r.costoNoto ? formatPrice(r.costo) : '—'}</td>
            <td className={r.guadagno < 0 ? 'neg' : ''}>{formatPrice(r.guadagno)}</td>
            <td />
          </tr>
        ))}
    </>
  )
}
