import { useState } from 'react'
import { storiaOrdine, quando } from '../lib/storiaOrdine.js'
import Icona, { ConIcona } from './Icona.jsx'
import { tr, trSegnato } from '../lib/lingua.js'

// ── LA STORIA DEL CONTO, e il suo RIPRISTINO ─────────────────────────
// Due pannelli che vanno insieme: uno racconta cos'è successo al conto,
// l'altro lo riapre. Stanno qui, in un componente solo, perché li usano in
// due — la coda e il dettaglio dell'ordine — e devono dire le stesse cose
// nello stesso modo.

const SEGNO = {
  aperto: 'verde',
  chiuso: 'contanti',
  annullato: 'annullato',
  riaperto: 'riapri',
}

export function StoriaOrdineDialog({ order, onClose }) {
  const eventi = storiaOrdine(order)
  return (
    <div className="overlay confirm-overlay" onClick={onClose}>
      <div
        className="confirm-box"
        role="dialog"
        aria-label={tr('Storia del conto')}
        style={{ width: 'min(420px, 94vw)', maxHeight: '80vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row between" style={{ alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}><Icona nome="orario" gruppo="tasti" /> {tr('Storia del conto')}</h3>
          <button className="btn ghost small" onClick={onClose} aria-label={tr('Chiudi')}>✕</button>
        </div>
        {eventi.length === 0 ? (
          <p className="muted small" style={{ margin: '10px 0 0' }}>
            {tr('Di questo conto non è rimasto niente da raccontare.')}
          </p>
        ) : (
          <ul className="storia-lista">
            {eventi.map((e, i) => (
              <li key={i} className={`storia-riga storia-${e.tipo}`}>
                <span className="storia-segno" aria-hidden>{SEGNO[e.tipo] ? <Icona nome={SEGNO[e.tipo]} gruppo="tasti" /> : '•'}</span>
                <div className="grow">
                  <div className="row between" style={{ gap: 8, alignItems: 'baseline' }}>
                    <strong>{trSegnato(e.titolo)}</strong>
                    <span className="muted small" style={{ whiteSpace: 'nowrap' }}>{quando(e.at)}</span>
                  </div>
                  {e.chi && <div className="muted small">{tr('di {nome}', { nome: e.chi })}</div>}
                  {e.dettaglio && <div className="storia-motivo">« <ConIcona testo={trSegnato(e.dettaglio)} /> »</div>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// RIPRISTINO. La motivazione è FACOLTATIVA apposta: se fosse obbligatoria si
// scriverebbe "x" per passare oltre, e in cambio si perderebbero i secondi
// che al banco non ci sono. Ma la si chiede, perché è quello che fra un'ora
// spiegherà un conto riaperto a chi non c'era.
export function RipristinaOrdineDialog({ order, onConferma, onClose }) {
  const [motivo, setMotivo] = useState('')
  const [inCorso, setInCorso] = useState(false)
  const eraAnnullato = order?.status === 'annullato'
  return (
    <div className="overlay confirm-overlay" onClick={onClose}>
      <div
        className="confirm-box"
        role="dialog"
        aria-label={tr('Ripristina il conto')}
        style={{ width: 'min(420px, 94vw)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row between" style={{ alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}><Icona nome="riapri" gruppo="tasti" /> {tr('Rimettere in corso il conto?')}</h3>
          <button className="btn ghost small" onClick={onClose} aria-label={tr('Chiudi')}>✕</button>
        </div>
        <p className="muted small" style={{ margin: '10px 0 0' }}>
          {order?.customer_name
            ? tr('Il conto #{n} ({nome}) torna fra quelli aperti e si potrà battere di nuovo.', {
                n: order?.daily_number ?? '—',
                nome: order.customer_name,
              })
            : tr('Il conto #{n} torna fra quelli aperti e si potrà battere di nuovo.', {
                n: order?.daily_number ?? '—',
              })}{' '}
          {eraAnnullato
            ? tr('Le comande annullate tornano da fare, e il magazzino si scala quando le si prepara.')
            : tr('Gli incassi già registrati restano dove sono: quello che è stato preso resta preso, e il dovuto si ricalcola da sé.')}
        </p>
        <label htmlFor="motivo-ripristino" style={{ marginTop: 12, display: 'block' }}>
          {tr('Perché lo riapri?')} <span className="muted small">({tr('facoltativo')})</span>
        </label>
        <textarea
          id="motivo-ripristino"
          rows={2}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder={tr('Es. chiuso sul tavolo sbagliato')}
          style={{ width: '100%' }}
        />
        {/* DUE PAROLE, NON UNA FRASE. «Lascia com'è» e «Rimetti in corso»
            costringevano a leggerle tutte e due per capire quale fosse
            quale, e sul tasto andavano a capo: si sceglie di corsa, col
            cliente davanti. «Annulla» esce, «Riapri» fa la cosa. */}
        <div className="grid-2" style={{ marginTop: 12 }}>
          <button className="btn ghost" onClick={onClose} disabled={inCorso}>
            {tr('Annulla')}
          </button>
          <button
            className="btn"
            disabled={inCorso}
            onClick={() => {
              setInCorso(true)
              onConferma(motivo.trim() || null)
            }}
          >
            <Icona nome="riapri" gruppo="tasti" /> {tr('Riapri')}
          </button>
        </div>
      </div>
    </div>
  )
}
