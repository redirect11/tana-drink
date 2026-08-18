import { useEffect, useRef } from 'react'

// ── IL TASTO INDIETRO CHIUDE QUELLO CHE È APERTO ─────────────────────
//
// Una scheda che si apre dentro una pagina — la scheda prodotto sopra il
// magazzino — non è un indirizzo suo: per il browser (e per il tasto
// indietro del telefono) non è mai successo niente, e «indietro» riportava
// alla pagina di prima, buttando via quello che si stava scrivendo e
// facendo perdere il posto. Chi ha aperto una scheda si aspetta di tornare
// dove stava, cioè all'elenco.
//
// Si aggiunge un passo finto nella cronologia mentre la scheda è aperta, e
// «indietro» lo consuma chiudendola. Chiudendola dal suo tasto («Annulla»),
// il passo si toglie da sé, così la cronologia resta com'era.
export function useChiudiConIndietro(aperto, chiudi) {
  const chiudiRif = useRef(chiudi)
  chiudiRif.current = chiudi
  // Il passo l'abbiamo messo noi? Solo allora va tolto: togliere un passo
  // che non è nostro vorrebbe dire far uscire dalla pagina qualcun altro.
  const nostro = useRef(false)

  useEffect(() => {
    if (!aperto) return undefined
    window.history.pushState({ tanaSchermata: true }, '')
    nostro.current = true
    const suIndietro = () => {
      nostro.current = false
      chiudiRif.current?.()
    }
    window.addEventListener('popstate', suIndietro)
    return () => {
      window.removeEventListener('popstate', suIndietro)
      // Chiusa dal suo tasto: il passo finto si toglie, se no il primo
      // «indietro» dopo non farebbe niente.
      if (nostro.current) {
        nostro.current = false
        window.history.back()
      }
    }
  }, [aperto])
}
