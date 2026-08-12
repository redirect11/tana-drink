import { useCallback, useEffect, useState } from 'react'

// SCHERMO INTERO: uno stato solo per i due tasti che lo comandano — quello
// nella barra (schermo largo) e la voce nei ⋮ (telefono). Prima ognuno se
// lo calcolava per conto suo, e da schermo intero non si usciva più:
//
//   · la voce dei ⋮ sapeva solo ENTRARE: richiamarla non faceva niente;
//   · il tasto nella barra SPARIVA appena si entrava. Si nasconde quando
//     l'app è installata (lì le barre non ci sono già), e per capirlo
//     guardava anche `display-mode: fullscreen` — che però risponde di sì
//     anche quando a schermo intero ci siamo andati noi con l'API. Il
//     tasto per uscire se ne andava proprio nel momento in cui serviva.
//
// Restava il tasto del browser (F11, o Esc), che a un tablet montato al
// banco non si spiega.

const dentro = () => typeof document !== 'undefined' && !!document.fullscreenElement

const rispondeA = (query) => window.matchMedia?.(query)?.matches === true

export function useSchermoIntero() {
  const [attivo, setAttivo] = useState(dentro)

  useEffect(() => {
    const aggiorna = () => setAttivo(dentro())
    aggiorna()
    document.addEventListener('fullscreenchange', aggiorna)
    return () => document.removeEventListener('fullscreenchange', aggiorna)
  }, [])

  const alterna = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen?.()
    else document.documentElement.requestFullscreen?.().catch(() => {})
  }, [])

  const supportato =
    typeof document !== 'undefined' && !!document.documentElement?.requestFullscreen

  // Il tasto non serve a chi ha installato l'app: gira già senza barre.
  // `display-mode: fullscreen` conta solo se NON è il nostro fullscreen —
  // il manifest permette anche quel modo di partire (display_override).
  const installata =
    typeof window !== 'undefined' &&
    (window.navigator?.standalone === true ||
      rispondeA('(display-mode: standalone)') ||
      rispondeA('(display-mode: minimal-ui)') ||
      (!attivo && rispondeA('(display-mode: fullscreen)')))

  return { attivo, disponibile: supportato && !installata, alterna }
}

export default useSchermoIntero
