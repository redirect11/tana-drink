import { useMemo, useState } from 'react'
import { ricetteDelProdotto } from '../lib/switchProdotto.js'

// IN QUANTE RICETTE È PRESENTE (REQ-MAG-056). Flavio, 14/11/2026: «si può
// inserire in questa sezione del Prodotto in quante Ricette di Menù è
// presente?». Serve prima di cambiare un prodotto (lo switch, REQ-MENU-043)
// e prima di toglierlo dall'assortimento: si vede subito quali drink ne
// dipendono. Il numero sta sul tasto; toccandolo, l'elenco.
export default function RicetteDelProdotto({ drinks, itemId }) {
  const [aperto, setAperto] = useState(false)
  const ricette = useMemo(() => ricetteDelProdotto(drinks, itemId), [drinks, itemId])
  const n = ricette.length
  const titolo = n === 0 ? 'In nessuna ricetta del menù' : n === 1 ? 'In 1 ricetta del menù' : `In ${n} ricette del menù`
  return (
    <div className="ricette-del-prodotto">
      <button
        type="button"
        className="btn ghost small block"
        style={{ marginTop: 6 }}
        disabled={n === 0}
        aria-expanded={n > 0 ? aperto : undefined}
        onClick={() => setAperto((a) => !a)}
      >
        {titolo}
      </button>
      {aperto && n > 0 && (
        <ul className="small" aria-label="Ricette che usano il prodotto" style={{ margin: '6px 0 0', paddingLeft: 18 }}>
          {ricette.map((d) => (
            <li key={d.id}>{d.name}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
