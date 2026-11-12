import { useState } from 'react'
import { chiediAI, messaggioAI, aiRaggiungibile } from '../lib/aiApi.js'
import { formatPrice } from '../lib/orderStatus.js'

// LA DESCRIZIONE PROPOSTA DALL'AI, NELLA SCHEDA DEL PRODOTTO (REQ-AI-003, il
// primo uso del cassetto AI della regia). Si chiede, si legge la proposta
// accanto a quello che c'è, e la si usa o la si scarta: niente si salva da
// solo. Quello che il modello non ha potuto sapere (un ingrediente, un'
// annata) torna in `da_verificare`, e si mostra: in carta un dato sbagliato
// è un allergene sbagliato.
export default function DescrizioneAI({ nome, categoria, attuale, onUsa }) {
  const [stato, setStato] = useState({ fase: 'ferma' })
  if (!aiRaggiungibile()) return null

  async function chiedi() {
    setStato({ fase: 'attesa' })
    const r = await chiediAI({ tipo: 'descrizione', nome: nome.trim(), ...(categoria ? { categoria } : {}) })
    if (r.ok) setStato({ fase: 'proposta', descrizione: r.risultato?.descrizione || '', daVerificare: r.risultato?.da_verificare || [], costo: r.costo_eur, credito: r.credito_eur })
    else setStato({ fase: 'errore', messaggio: messaggioAI(r.codice) })
  }

  const senzaNome = !nome || !nome.trim()
  return (
    <div className="descrizione-ai">
      {stato.fase !== 'proposta' && (
        <button type="button" className="btn ghost small" onClick={chiedi} disabled={senzaNome || stato.fase === 'attesa'}>
          {stato.fase === 'attesa' ? 'Scrivo la proposta…' : 'Proponi una descrizione con l’AI'}
        </button>
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
              Costo {formatPrice(stato.costo)}
              {stato.credito != null ? ` · credito rimasto ${formatPrice(stato.credito)}` : ''}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
