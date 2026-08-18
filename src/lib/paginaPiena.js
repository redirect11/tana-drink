import { useEffect } from 'react'

// ── LA PAGINA STA TUTTA NELLA FINESTRA ───────────────────────────────
// Chi la chiama dichiara "questa schermata non fa scorrere la pagina": la
// testata in alto, il piè di pagina in fondo, e in mezzo quello che resta,
// dove a scorrere sono i pannelli. Il come lo dice il CSS (body.pagina-piena);
// qui si accende e si spegne.
//
// Si contano, perché in una stessa schermata possono dichiararlo in due (le
// sezioni del magazzino e, dentro, la barra delle categorie): senza contarle,
// smontandone una la pagina tornerebbe a scorrere mentre l'altra è ancora lì.

let quante = 0

// Il nome comincia per `use` e non per `usa` perché è un hook: la regola di
// React (e il lint) lo pretende, ed è l'unico punto in cui il codice attorno
// vince sull'italiano.
export function usePaginaPiena(attiva = true) {
  useEffect(() => {
    if (!attiva) return undefined
    quante += 1
    document.body.classList.add('pagina-piena')
    return () => {
      quante -= 1
      if (quante <= 0) document.body.classList.remove('pagina-piena')
    }
  }, [attiva])
}
