import { useMemo, useState } from 'react'
import CategoryRail from './CategoryRail.jsx'
import { formatPrice, cashMethodKeys } from '../lib/orderStatus.js'
import Icona from './Icona.jsx'
import MetodoPagamento, { MetodiPagamento } from './MetodoPagamento.jsx'
import {
  rendicontoOrdini,
  rendicontoProdotti,
  categorieDi,
  sommaRighe,
} from '../lib/rendiconto.js'
import { tr, formatoAttivo } from '../lib/lingua.js'

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
    return new Date(iso).toLocaleTimeString(formatoAttivo(), { hour: '2-digit', minute: '2-digit' })
  } catch {
    return '—'
  }
}
const fmtData = (iso) => {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString(formatoAttivo(), {
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

// Come è stato incassato un conto — e se non lo è stato, perché.
const comePagato = (c) => {
  if (c.metodi.length) return <MetodiPagamento metodi={c.metodi} />
  if (c.omaggio) return <><Icona nome="sconto" gruppo="tasti" /> {tr('offerto')}</>
  if (c.daIncassare) return <><Icona nome="giallo" gruppo="tasti" /> {tr('da incassare')}</>
  return '—'
}

export default function RendicontoSerata({ session, orders, drinksById, itemsById, recap, onClose }) {
  const [vista, setVista] = useState('conti')
  // I conti si leggono in due modi: a tabella per confrontare le colonne, a
  // card per scorrerli come nella schermata ordini. La scelta si ricorda.
  const [forma, setForma] = useState(() => {
    try {
      return localStorage.getItem('drink:rendiconto:forma') === 'card' ? 'card' : 'tabella'
    } catch {
      return 'tabella'
    }
  })
  const cambiaForma = (f) => {
    setForma(f)
    try {
      localStorage.setItem('drink:rendiconto:forma', f)
    } catch {
      /* ok */
    }
  }
  const [apertoId, setApertoId] = useState(null)
  const [cat, setCat] = useState('__tutte__')

  const ctx = useMemo(() => ({ drinksById, itemsById }), [drinksById, itemsById])
  const conti = useMemo(() => rendicontoOrdini(orders, ctx), [orders, ctx])
  const prodotti = useMemo(() => rendicontoProdotti(orders, ctx), [orders, ctx])
  // «Tutte» la scrive lib/rendiconto.js in italiano: si traduce qui, dove
  // si mostra. Le altre voci sono nomi di categoria, cioè dati.
  const categorie = useMemo(
    () => categorieDi(prodotti).map((c) => (c.key === '__tutte__' ? { ...c, label: tr('categorie|Tutte') } : c)),
    [prodotti]
  )
  const prodottiVisti = useMemo(
    () => (cat === '__tutte__' ? prodotti : prodotti.filter((p) => p.categoria === cat)),
    [prodotti, cat]
  )
  const totConti = useMemo(() => sommaRighe(conti), [conti])
  // I conti ancora aperti sono venduto ma NON incasso: tenerli dentro
  // l'incassato farebbe quadrare la schermata con se stessa e non con la cassa.
  const aperti = useMemo(() => conti.filter((c) => c.daIncassare), [conti])
  const totAperti = useMemo(() => sommaRighe(aperti), [aperti])
  const totIncassato = useMemo(
    () => sommaRighe(conti.filter((c) => !c.daIncassare)),
    [conti]
  )
  const omaggi = useMemo(() => conti.filter((c) => c.omaggio), [conti])
  const totProdotti = useMemo(() => sommaRighe(prodottiVisti), [prodottiVisti])

  const byMethod = recap?.byMethod || {}

  return (
    <div className="rendiconto">
      <div className="row between" style={{ alignItems: 'flex-start', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0 }}>{tr('Rendiconto chiusura cassa')}</h2>
          <div className="muted small">
            {fmtData(session?.opened_at)} · {fmtOra(session?.opened_at)} →{' '}
            {session?.closed_at ? fmtOra(session.closed_at) : tr('in corso')}
          </div>
        </div>
        <button className="btn ghost small" onClick={onClose}>
          ← {tr('Chiudi')}
        </button>
      </div>

      {/* Testata: i numeri che si guardano per primi. */}
      <div className="rend-kpi">
        <div className="rend-kpi-box">
          <span className="muted small">{tr('Incassato')}</span>
          <strong>{formatPrice(totIncassato.netto)}</strong>
          <span className="muted small">
            {totIncassato.conti === 1 ? tr('1 conto chiuso') : tr('{n} conti chiusi', { n: totIncassato.conti })}
            {omaggi.length > 0 &&
              (omaggi.length === 1 ? tr(', 1 offerto') : tr(', {n} offerti', { n: omaggi.length }))}
          </span>
        </div>
        {aperti.length > 0 && (
          <div className="rend-kpi-box">
            <span className="muted small">{tr('Da incassare')}</span>
            <strong>{formatPrice(totAperti.netto)}</strong>
            <span className="muted small">
              {aperti.length === 1 ? tr('1 conto ancora aperto') : tr('{n} conti ancora aperti', { n: aperti.length })}
            </span>
          </div>
        )}
        <div className="rend-kpi-box">
          <span className="muted small">{tr('Sconti concessi')}</span>
          <strong>{totConti.sconto > 0 ? `−${formatPrice(totConti.sconto)}` : formatPrice(0)}</strong>
          <span className="muted small">{tr('su {importo} di listino', { importo: formatPrice(totConti.lordo) })}</span>
        </div>
        <div className="rend-kpi-box">
          <span className="muted small">{tr('Costo merce')}</span>
          <strong>{formatPrice(totConti.costo)}</strong>
          <span className="muted small">{totConti.parziale ? tr('stima parziale') : tr('da ricette')}</span>
        </div>
        <div className="rend-kpi-box rend-kpi-forte">
          <span className="muted small">{tr('Guadagno lordo')}</span>
          <strong>{formatPrice(totConti.guadagno)}</strong>
          <span className="muted small">{tr('margine {percentuale}', { percentuale: pct(totConti.margine) })}</span>
        </div>
      </div>

      {cashMethodKeys(byMethod).some((k) => byMethod[k] > 0) && (
        <div className="chips-row" style={{ marginBottom: 4 }}>
          {cashMethodKeys(byMethod)
            .filter((k) => byMethod[k] > 0)
            .map((k) => (
              <span className="chip" key={k}>
                <MetodoPagamento metodo={k} /> {formatPrice(byMethod[k])}
              </span>
            ))}
        </div>
      )}

      {totConti.parziale && (
        <div className="banner">
          {tr(
            'Il costo di qualche ingrediente non è in magazzino: le righe segnate con ~ hanno un guadagno ottimistico, non un dato certo.'
          )}
        </div>
      )}

      <div className="tabs">
        <button
          type="button"
          className={`tab${vista === 'conti' ? ' active' : ''}`}
          onClick={() => setVista('conti')}
        >
          <Icona nome="elenco" gruppo="tasti" /> {tr('Conti')}
        </button>
        <button
          type="button"
          className={`tab${vista === 'prodotti' ? ' active' : ''}`}
          onClick={() => setVista('prodotti')}
        >
          <Icona nome="statistiche" gruppo="tasti" /> {tr('Cumulativo vendite')}
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
              ▤ {tr('forma|Lista')}
            </button>
            <button
              type="button"
              className={`tab${forma === 'tabella' ? ' active' : ''}`}
              onClick={() => cambiaForma('tabella')}
            >
              ▦ {tr('forma|Tabella')}
            </button>
          </div>
          <div className="muted small" style={{ margin: '0 0 8px' }}>
            {totConti.conti === 1
              ? tr('1 conto · tocca per vedere cosa è stato venduto')
              : tr('{n} conti · tocca per vedere cosa è stato venduto', { n: totConti.conti })}
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
          {conti.length === 0 && <p className="muted small">{tr('Nessun conto in questa serata.')}</p>}
        </div>
      ) : vista === 'conti' ? (
        <div className="table-scroll">
          <table className="rend-tab">
            <thead>
              <tr>
                <th className="rowhead">{tr('Conto')}</th>
                <th>{tr('Ora')}</th>
                <th>{tr('Pezzi')}</th>
                <th>{tr('Pagamento')}</th>
                <th>{tr('importo|Listino')}</th>
                <th>{tr('Sconto')}</th>
                <th>{tr('Incassato')}</th>
                <th>{tr('Costo')}</th>
                <th>{tr('Guadagno')}</th>
                <th>{tr('Marg.')}</th>
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
                    <span className="muted">{tr('Nessun conto in questa serata.')}</span>
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <th className="rowhead">{tr('Totale')}</th>
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
        >
          <div className="table-scroll">
            <table className="rend-tab">
              <thead>
                <tr>
                  <th className="rowhead">{tr('Prodotto')}</th>
                  <th>{tr('Categoria')}</th>
                  <th>{tr('Pezzi')}</th>
                  <th>{tr('Prezzo medio')}</th>
                  <th>{tr('importo|Listino')}</th>
                  <th>{tr('Sconto')}</th>
                  <th>{tr('Venduto')}</th>
                  <th>{tr('Costo')}</th>
                  <th>{tr('Guadagno')}</th>
                  <th>{tr('Marg.')}</th>
                </tr>
              </thead>
              <tbody>
                {prodottiVisti.map((p) => (
                  <tr key={p.name}>
                    <td className="rowhead">
                      {p.name}
                      {!p.costoNoto && <span className="muted" title={tr('costo non completo')}> ~</span>}
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
                      <span className="muted">{tr('Nessun prodotto in questa categoria.')}</span>
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr>
                  <th className="rowhead">
                    {tr('Totale')}
                    {cat !== '__tutte__' ? ` · ${cat}` : ''}
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
        {tr(
          'Gli importi sono il venduto reale, non il listino: lo sconto del conto è ripartito in proporzione al prezzo di ogni riga (su 10 € con 1 € di sconto, una birra da 4 € conta 3,60 e un cocktail da 6 € conta 5,40). Il costo viene dalle ricette valorizzate sull’inventario, IVA compresa come i ricavi.'
        )}
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
          {conto.nome || <span className="muted">{tr('senza nome')}</span>}
          <span className="muted small">
            {' '}
            · {fmtOra(conto.quando)} · {tr('{n} pz', { n: conto.pezzi })}
          </span>
          <br />
          <span className="muted small">{comePagato(conto)}</span>
        </span>
        <span className="rend-card-cifre">
          <strong className="price">{formatPrice(conto.netto)}</strong>
          {conto.sconto > 0 && (
            <span className="sconto-badge"> <Icona nome="sconto" gruppo="tasti" /> −{formatPrice(conto.sconto)}</span>
          )}
          <span className={`muted small${conto.guadagno < 0 ? ' neg' : ''}`}>
            {tr('conto|guadagno {importo}', { importo: formatPrice(conto.guadagno) })}
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
                <span className="muted small"> · {tr('{prezzo} cad.', { prezzo: formatPrice(r.prezzo) })}</span>
              </span>
              {r.sconto > 0 && <span className="muted small">−{formatPrice(r.sconto)}</span>}
              <strong>{formatPrice(r.netto)}</strong>
              <span className="muted small" style={{ minWidth: 92, textAlign: 'right' }}>
                {r.costoNoto ? tr('costo {importo}', { importo: formatPrice(r.costo) }) : tr('costo n/d')}
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
          {conto.parziale && <span className="muted" title={tr('costo non completo')}> ~</span>}
        </td>
        <td>{fmtOra(conto.quando)}</td>
        <td>{conto.pezzi}</td>
        <td className="muted">{comePagato(conto)}</td>
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
            <td className="muted">{tr('{prezzo} cad.', { prezzo: formatPrice(r.prezzo) })}</td>
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
