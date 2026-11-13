import { useStatoAI, STATI_AI, messaggioSenzaCredito } from '../lib/statoAI.js'
import { showToast } from '../lib/toast.js'
import Icona from './Icona.jsx'

// ── UN TASTO DELL'AI, CON LA REGOLA DEI TRE STATI (REQ-AI-007) ─────────
//
// La stessa regola del tasto dell'assistente, per ogni funzione AI
// (Daniele, 13/11/2026: «come dici tu», una regola sola): con l'AI assente
// il tasto non c'è; senza credito è grigio con l'avviso, e toccandolo
// ricorda di ricaricare; attiva fa quello che deve.
export default function TastoAI({ className = 'btn ghost small', onClick, disabled = false, children }) {
  const { stato, motivo } = useStatoAI(true)
  if (stato === STATI_AI.ASSENTE) return null
  const senzaCredito = stato === STATI_AI.SENZA_CREDITO
  return (
    <button
      type="button"
      className={`${className} tasto-ai${senzaCredito ? ' senza-credito' : ''}`}
      onClick={senzaCredito ? () => showToast(messaggioSenzaCredito(motivo), { kind: 'error' }) : onClick}
      disabled={!senzaCredito && disabled}
      title={senzaCredito ? messaggioSenzaCredito(motivo) : undefined}
    >
      {senzaCredito && <Icona nome="avviso" gruppo="segnali" />} {children}
    </button>
  )
}
