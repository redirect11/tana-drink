import { useTastoAI } from '../lib/statoAI.js'
import Icona from './Icona.jsx'

// ── IL TASTO DELL'ASSISTENTE AI NELLA BARRA (REQ-AI-006, REQ-AI-007) ───
//
// Tre facce, una per stato: con l'AI assente non c'è; senza credito è
// grigio con l'avviso, e toccandolo ricorda di ricaricare (Daniele,
// 13/11/2026); attiva apre e chiude il pannello. Chi lo monta lo monta solo
// per lo staff di gestione.
export default function TastoAssistente({ aperto, onAlterna }) {
  const { assente, senzaCredito, avviso, avvisa } = useTastoAI()
  if (assente) return null
  return (
    <button
      type="button"
      className={`btn ghost small topbar-chat${senzaCredito ? ' senza-credito' : ''}`}
      onClick={() => (senzaCredito ? avvisa() : onAlterna())}
      aria-label={senzaCredito ? 'Assistente AI: credito da ricaricare' : 'Assistente AI'}
      aria-pressed={senzaCredito ? undefined : aperto}
      title={avviso ?? 'Assistente AI'}
    >
      <Icona nome="fumetto" gruppo="tasti" />
      {senzaCredito && (
        <span className="topbar-chat-avviso">
          <Icona nome="avviso" gruppo="segnali" />
        </span>
      )}
    </button>
  )
}
