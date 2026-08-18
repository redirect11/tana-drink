import { useEffect, useState } from 'react'
import { ascoltaFumetto } from '../lib/avvisiInApp.js'

// ── IL FUMETTO DELLA CAMPANELLA ──────────────────────────────────────
//
// L'avviso esce da dove poi lo si ritrova: la campanella. È l'alternativa
// alla strisciolina che compare su qualunque schermata — comoda, ma che
// interrompe anche chi sta contando la cassa o caricando il magazzino.
//
// Sta solo nella CODA ORDINI, che è il posto dove gli ordini si aspettano:
// lì un avviso non interrompe niente, è la ragione per cui si sta
// guardando quella schermata.
//
// Toccandolo si aprono gli avvisi: il fumetto dice che è successo
// qualcosa, l'elenco dice cosa. Sparisce da sé dopo qualche secondo — è un
// richiamo, non una cosa da chiudere a mano — ma il conto sulla campanella
// resta finché non li si legge.
const DURATA = 8000

export default function FumettoAvvisi({ onApri }) {
  const [avviso, setAvviso] = useState(null)

  useEffect(
    () =>
      ascoltaFumetto((a) => {
        setAvviso({ ...a, id: `${Date.now()}-${Math.random()}` })
      }),
    []
  )

  useEffect(() => {
    if (!avviso) return undefined
    const t = setTimeout(() => setAvviso(null), DURATA)
    return () => clearTimeout(t)
  }, [avviso])

  if (!avviso) return null

  return (
    <button
      type="button"
      className="fumetto-avviso"
      onClick={() => {
        setAvviso(null)
        onApri?.()
      }}
      aria-live="polite"
    >
      <strong>{avviso.title}</strong>
      {avviso.body && <span className="fumetto-avviso-corpo">{avviso.body}</span>}
    </button>
  )
}
