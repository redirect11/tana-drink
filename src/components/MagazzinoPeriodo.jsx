import { useEffect, useState } from 'react'
import { fetchInventoryItems, fetchStockMovementsSince } from '../lib/api.js'
import { magazzinoNelPeriodo } from '../lib/magazzinoPeriodo.js'
import { formatQty } from '../lib/inventory.js'
import { formatPrice } from '../lib/orderStatus.js'
import { shiftDay } from '../lib/ore.js'

// ── IL MAGAZZINO NEL PERIODO SCELTO (REQ-STAT-002) ───────────────────
//
// Flavio, 17/09/2026: «quanto avevo di deposito, quanto ho acquistato,
// quanto ho consumato in un determinato periodo … a lista, un po' la
// visualizzazione come sono i prodotti del magazzino». Da qui la forma:
// `inv-list`/`inv-row`, la stessa lista di Magazzino, coi numeri che si
// leggono da soli senza un'intestazione da tenere a mente.
//
// SI APRE A RICHIESTA, e non è pigrizia. Gli altri riquadri di questa
// schermata lavorano sugli ordini già in mano; questo va a leggere
// quattrocento articoli e tutti i movimenti del periodo, che su due mesi
// sono migliaia di documenti. Farlo a ogni apertura delle statistiche
// vorrebbe dire far pagare a chi guarda l'incasso una lettura che non ha
// chiesto.
export default function MagazzinoPeriodo({ dal, al, da = null, a = null, cutoffHour }) {
  const [aperto, setAperto] = useState(false)
  const [dati, setDati] = useState(null)
  const [caricando, setCaricando] = useState(false)
  const [errore, setErrore] = useState(null)

  useEffect(() => {
    if (!aperto) return undefined
    let vivo = true
    setCaricando(true)
    setErrore(null)
    // UN GIORNO DI MARGINE: la giornata commerciale comincia alle cinque del
    // mattino, quindi il suo primo istante sta DOPO la mezzanotte di quella
    // data — ma la notte precedente appartiene già alla giornata prima. Si
    // legge largo e si taglia preciso: il conto filtra per giornata.
    // Col periodo all'ora (REQ-STAT-003) il primo istante si sa già.
    const dove = da || `${shiftDay(dal, -1)}T00:00:00.000Z`
    Promise.all([fetchStockMovementsSince(dove), fetchInventoryItems()])
      .then(([movimenti, items]) => {
        if (vivo) setDati(magazzinoNelPeriodo(movimenti, items, { dal, al, da, a, cutoffHour }))
      })
      .catch((e) => vivo && setErrore(e.message))
      .finally(() => vivo && setCaricando(false))
    return () => {
      vivo = false
    }
  }, [aperto, dal, al, da, a, cutoffHour])

  return (
    <div className="card">
      <div className="row between" style={{ alignItems: 'center' }}>
        <h3 className="cat-header" style={{ margin: 0 }}>
          📦 Magazzino nel periodo
        </h3>
        <button
          type="button"
          className="btn ghost small"
          aria-expanded={aperto}
          onClick={() => setAperto((v) => !v)}
        >
          {aperto ? 'Nascondi' : 'Calcola'}
        </button>
      </div>

      {!aperto && (
        <p className="muted small" style={{ margin: '8px 0 0' }}>
          Quanto c’era in deposito all’inizio, quanto è entrato, quanto è
          uscito e cosa resta, prodotto per prodotto. Si calcola a richiesta
          perché legge tutti i movimenti del periodo.
        </p>
      )}

      {aperto && caricando && <div className="empty">Conto i movimenti…</div>}
      {aperto && errore && <div className="banner">Errore: {errore}</div>}

      {aperto && !caricando && !errore && dati && (
        <>
          {/* COSA DICE QUESTO ELENCO, E COSA NO. Il consumo qui è quello che
              l'app ha scalato dalle ricette battute, non quello contato sullo
              scaffale: fra i due c'è il calo, l'offerto e la dose scritta
              larga, ed è l'INVENTARIO a misurarlo. Senza questa riga i due numeri
              si leggono come se dovessero coincidere, e non coincidono. */}
          <p className="muted small" style={{ margin: '8px 0 0' }}>
            Il consumo è quello scalato dalle ricette battute. Quello contato
            davvero sullo scaffale lo dà l’<strong>Inventario</strong> in
            Magazzino, e la differenza fra i due è il calo.
          </p>

          {dati.righe.length === 0 ? (
            <div className="empty">Nessun movimento di magazzino in questo periodo.</div>
          ) : (
            <>
              <div className="inv-list">
                {dati.righe.map((r) => (
                  <div className="inv-row" key={r.item_id}>
                    <div className="inv-row-main statica">
                      <span className="inv-row-name">{r.name}</span>
                      <span className="muted small inv-row-cat">
                        deposito {formatQty(r.dep, r.unit)}
                        {r.rett !== 0 ? ` · rettifiche ${formatQty(r.rett, r.unit)}` : ''}
                      </span>
                      <span className="muted small inv-row-price">
                        comprato {formatQty(r.acq, r.unit)}
                      </span>
                      <span className="muted small inv-row-price">
                        usato {formatQty(r.cons, r.unit)}
                      </span>
                      <span className="muted small inv-row-price">
                        resta {formatQty(r.fine, r.unit)}
                      </span>
                      <span className="inv-row-price inv-row-stock">
                        {formatPrice(r.cons_valore)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="summary-rows" style={{ marginBottom: 0 }}>
                <div className="row between">
                  <span className="muted">Comprato nel periodo</span>
                  <strong>{formatPrice(dati.totali.acq_valore)}</strong>
                </div>
                <div className="row between">
                  <span className="muted">Consumato nel periodo</span>
                  <strong>{formatPrice(dati.totali.cons_valore)}</strong>
                </div>
                <div className="row between">
                  <span className="muted">Valore di quel che resta</span>
                  <strong>{formatPrice(dati.totali.fine_valore)}</strong>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
