import { useEffect } from 'react'
import { formatPrice } from '../lib/orderStatus.js'
import { immagineVoce } from '../lib/speciali.js'
import { ingredientiInCarta } from '../lib/ingredientiCarta.js'

// ── IL DETTAGLIO DI UN DRINK, PER IL CLIENTE (REQ-MENU-020) ───────────
//
// L'utente, 30/10/2026: «su qualsiasi item di menu premo non si apre un
// dettaglio o almeno una modal con il dettaglio del drink con immagine,
// descrizione lunga e ingredienti». Nel menù la card tiene la descrizione
// corta (tre righe) perché l'elenco si scorra; qui c'è tutta, con
// l'immagine grande e gli ingredienti uno per riga.
//
// Non è SchedaDrink: quella è per chi sta al banco, con le dosi della
// ricetta di magazzino e la preparazione. Qui ci sono gli ingredienti in
// carta (lib/ingredientiCarta.js), le stesse parole che il cliente legge
// sotto il drink.
//
// `azioni` sono i tasti per ordinare, gli stessi della card: se il locale
// non prende ordini dal tavolo non ci sono, e il dettaglio si guarda e
// basta.
export default function DettaglioDrink({ drink, onClose, chiaro = false, quantita = false, azioni = null }) {
  useEffect(() => {
    if (!drink) return undefined
    const tasto = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', tasto)
    return () => window.removeEventListener('keydown', tasto)
  }, [drink, onClose])

  if (!drink) return null
  const img = immagineVoce(drink, import.meta.env.BASE_URL, { chiaro })
  const ingredienti = ingredientiInCarta(drink, { quantita })
  return (
    <div className="overlay confirm-overlay" onClick={onClose}>
      <div
        className="confirm-box dettaglio-drink"
        role="dialog"
        aria-modal="true"
        aria-label={drink.name}
        onClick={(e) => e.stopPropagation()}
      >
        {img && <img className="dettaglio-drink-img" src={img} alt="" />}
        <div className="row between dettaglio-drink-testa">
          <h2>{drink.name}</h2>
          <strong className="price">{formatPrice(drink.price)}</strong>
        </div>
        {drink.description && <p className="dettaglio-drink-descrizione">{drink.description}</p>}
        {ingredienti && (
          <>
            <h3 className="dettaglio-drink-sezione">Ingredienti</h3>
            <ul className="dettaglio-drink-ingredienti">
              {ingredienti.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </>
        )}
        <div className="dettaglio-drink-azioni">
          {azioni}
          <button type="button" className="btn ghost" onClick={onClose}>
            Chiudi
          </button>
        </div>
      </div>
    </div>
  )
}
