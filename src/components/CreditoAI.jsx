import { useEffect, useState } from 'react'
import { leggiCreditoAI, messaggioAI, costoAI } from '../lib/aiApi.js'
import { tr, daTradurre, trSegnato } from '../lib/lingua.js'

const euro = (v) => (v == null ? '—' : costoAI(v))

// Perché le funzioni AI sono ferme, quando la regia dice `attivo: false`.
const FERMO = {
  credito: daTradurre('Credito esaurito: le funzioni AI restano ferme fino alla ricarica, dal sito, nell’area del locale.'),
  tetto: daTradurre('Tetto di spesa del mese raggiunto: le funzioni AI riprendono il mese prossimo.'),
}

// ── IL CREDITO AI DEL LOCALE (REQ-AI-003) ─────────────────────────────
//
// Si legge dalla regia all'apertura (`tipo: 'credito'`): gratis, senza
// chiamare il modello. Credito disponibile, speso nel mese e tetto. La
// ricarica sta nel sito, non qui: dall'app non si compra niente.
// Chi lo monta lo mostra solo dove l'AI arriva (aiRaggiungibile): nel
// Free (`ai: false`, REQ-LIC-017) il riquadro non c'è.
export default function CreditoAI() {
  const [stato, setStato] = useState({ fase: 'attesa' })

  useEffect(() => {
    let vivo = true
    leggiCreditoAI().then((r) => {
      if (vivo) setStato(r.ok ? { fase: 'letto', ...r } : { fase: 'errore', messaggio: messaggioAI(r.codice) })
    })
    return () => {
      vivo = false
    }
  }, [])

  return (
    <div className="card settings-section">
      <h3>{tr('Credito AI')}</h3>
      <p className="muted" style={{ margin: '0 0 10px', fontSize: '0.85rem' }}>
        {tr(
          'Il credito con cui lavorano le funzioni AI del gestionale. Non scade; si ricarica dal sito, nell’area del locale.'
        )}
      </p>
      {stato.fase === 'attesa' && <p className="muted small">{tr('Lettura del credito…')}</p>}
      {stato.fase === 'errore' && (
        <p className="small" role="status">
          {trSegnato(stato.messaggio)}
        </p>
      )}
      {stato.fase === 'letto' && (
        <>
          <p style={{ margin: '0 0 4px' }}>
            {tr('Disponibile')} <strong>{euro(stato.credito_eur)}</strong>
          </p>
          <p className="muted small" style={{ margin: 0 }}>
            {tr('Speso nel mese {speso} su un tetto di {tetto}', {
              speso: euro(stato.speso_mese_eur),
              tetto: euro(stato.tetto_mensile_eur),
            })}
          </p>
          {!stato.attivo && (
            <p className="small" role="status" style={{ margin: '8px 0 0' }}>
              {trSegnato(FERMO[stato.motivo]) || tr('Le funzioni AI sono ferme in questo momento.')}
            </p>
          )}
        </>
      )}
    </div>
  )
}
