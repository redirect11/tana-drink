import { useAiutiCampi } from '../lib/aiutiCampi.js'

// LA RIGA D'AIUTO DI UN CAMPO (REQ-UI-032): si vede solo se il locale li
// tiene accesi (Impostazioni → Aspetto). Solo per gli aiuti: un avviso che
// dipende da quello che si è scritto — un errore, un dato mancante — non
// passa di qui, perché quello va letto sempre.
export default function AiutoCampo({ children, style }) {
  if (!useAiutiCampi()) return null
  return (
    <p className="muted small aiuto-campo" style={{ margin: '2px 0 0', ...style }}>
      {children}
    </p>
  )
}
