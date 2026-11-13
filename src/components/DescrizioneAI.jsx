import { useEffect, useRef, useState } from 'react'
import { chiediAI, messaggioAI, aiRaggiungibile } from '../lib/aiApi.js'
import TastoAI from './TastoAI.jsx'
import { useStatoAI, STATI_AI } from '../lib/statoAI.js'

// Il costo di una descrizione è di qualche millesimo: coi centesimi si
// leggerebbe «0,00 €», che non è vero. Fino a quattro decimali.
const costoInEuro = (v) =>
  `${Number(v).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} €`

// LA DESCRIZIONE PROPOSTA DALL'AI, NELLA SCHEDA DEL PRODOTTO (REQ-AI-003, il
// primo uso del cassetto AI della regia). Si chiede, si legge la proposta
// accanto a quello che c'è, e la si usa o la si scarta: niente si salva da
// solo. Quello che il modello non ha potuto sapere (un ingrediente, un'
// annata) torna in `da_verificare`, e si mostra: in carta un dato sbagliato
// è un allergene sbagliato.
export default function DescrizioneAI({ nome, categoria, attuale, onUsa, subito = false }) {
  const [stato, setStato] = useState({ fase: 'ferma' })
  const statoAI = useStatoAI(true)
  // SUBITO: la scheda nata da una bottiglia del magazzino (REQ-AI-002) la
  // vuole pronta (Daniele, 13/11/2026: «parte da sola»), una volta, e solo
  // con l'AI attiva: senza credito il tasto è grigio, e non parte niente.
  const partita = useRef(false)
  useEffect(() => {
    if (!subito || partita.current || statoAI.stato !== STATI_AI.ATTIVA || !nome || nome.trim().length < 2) return
    partita.current = true
    chiedi()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subito, statoAI.stato])
  if (!aiRaggiungibile()) return null

  async function chiedi() {
    setStato({ fase: 'attesa' })
    const r = await chiediAI({ tipo: 'descrizione', nome: nome.trim(), ...(categoria ? { categoria } : {}) })
    const descrizione = typeof r.risultato?.descrizione === 'string' ? r.risultato.descrizione.trim() : ''
    // Una proposta vuota non è una proposta: «Usa questa» svuoterebbe il campo.
    if (r.ok && descrizione) {
      const daVerificare = Array.isArray(r.risultato.da_verificare) ? r.risultato.da_verificare.filter((x) => typeof x === 'string') : []
      setStato({ fase: 'proposta', descrizione, daVerificare, costo: r.costo_eur, credito: r.credito_eur })
    } else {
      const codice = r.ok ? 'non-usabile' : r.codice
      // Anche quando il risultato non serve il costo resta: si dice.
      const costo = r.costo_eur != null ? ` Costo ${costoInEuro(r.costo_eur)}.` : ''
      setStato({ fase: 'errore', messaggio: messaggioAI(codice) + costo })
    }
  }

  // Almeno due caratteri, come chiede la regia.
  const senzaNome = !nome || nome.trim().length < 2
  return (
    <div className="descrizione-ai">
      {stato.fase !== 'proposta' && (
        <TastoAI onClick={chiedi} disabled={senzaNome || stato.fase === 'attesa'}>
          {stato.fase === 'attesa' ? 'Scrivo la proposta…' : 'Proponi una descrizione con l’AI'}
        </TastoAI>
      )}
      {stato.fase === 'errore' && (
        <p className="muted small" role="status" style={{ margin: '6px 0 0' }}>
          {stato.messaggio}
        </p>
      )}
      {stato.fase === 'proposta' && (
        <div className="descrizione-ai-proposta" role="group" aria-label="Descrizione proposta dall’AI">
          <p className="small muted" style={{ margin: 0 }}>Proposta dell’AI</p>
          <p style={{ margin: '4px 0 6px' }}>{stato.descrizione}</p>
          {stato.daVerificare.length > 0 && (
            <p className="small" style={{ margin: '0 0 6px' }}>Da verificare: {stato.daVerificare.join(', ')}</p>
          )}
          {attuale && (
            <p className="small muted" style={{ margin: '0 0 6px' }}>
              Quella di adesso: {attuale}
            </p>
          )}
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn small"
              onClick={() => {
                onUsa(stato.descrizione)
                setStato({ fase: 'ferma' })
              }}
            >
              Usa questa
            </button>
            <button type="button" className="btn ghost small" onClick={() => setStato({ fase: 'ferma' })}>
              Scarta
            </button>
            <button type="button" className="btn ghost small" onClick={chiedi}>
              Un’altra proposta
            </button>
          </div>
          {stato.costo != null && (
            <p className="small muted" style={{ margin: '6px 0 0' }}>
              Costo {costoInEuro(stato.costo)}
              {stato.credito != null ? ` · credito rimasto ${costoInEuro(stato.credito)}` : ''}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
