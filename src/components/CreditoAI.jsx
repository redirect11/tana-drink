import { useEffect, useState } from 'react'
import { leggiCreditoAI, messaggioAI } from '../lib/aiApi.js'

const euro = (v) =>
  v == null ? '—' : `${Number(v).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} €`

// Perché le funzioni AI sono ferme, quando la regia dice `attivo: false`.
const FERMO = {
  credito: 'Credito esaurito: le funzioni AI restano ferme fino alla ricarica, dal sito, nell’area del locale.',
  tetto: 'Tetto di spesa del mese raggiunto: le funzioni AI riprendono il mese prossimo.',
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
      <h3>Credito AI</h3>
      <p className="muted" style={{ margin: '0 0 10px', fontSize: '0.85rem' }}>
        Il credito con cui lavorano le funzioni AI del gestionale. Non scade; si ricarica dal sito, nell’area del
        locale.
      </p>
      {stato.fase === 'attesa' && <p className="muted small">Lettura del credito…</p>}
      {stato.fase === 'errore' && (
        <p className="small" role="status">
          {stato.messaggio}
        </p>
      )}
      {stato.fase === 'letto' && (
        <>
          <p style={{ margin: '0 0 4px' }}>
            Disponibile <strong>{euro(stato.credito_eur)}</strong>
          </p>
          <p className="muted small" style={{ margin: 0 }}>
            Speso nel mese {euro(stato.speso_mese_eur)} su un tetto di {euro(stato.tetto_mensile_eur)}
          </p>
          {!stato.attivo && (
            <p className="small" role="status" style={{ margin: '8px 0 0' }}>
              {FERMO[stato.motivo] || 'Le funzioni AI sono ferme in questo momento.'}
            </p>
          )}
        </>
      )}
    </div>
  )
}
