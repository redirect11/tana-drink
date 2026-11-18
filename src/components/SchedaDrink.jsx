import { formatPrice } from '../lib/orderStatus.js'
import { formatQty } from '../lib/inventory.js'
import { tr } from '../lib/lingua.js'

// ── LA SCHEDA DEL DRINK, DIETRO LA ⓘ ─────────────────────────────────
//
// «Come si fa il Tana Detox?» è la domanda che al banco si fa a voce, e a
// voce si perde: chi entra a dare una mano il sabato non ha in testa le
// dosi, e l'unico che le sa è impegnato a fare drink. La ricetta c'è già —
// serve al magazzino per scalare le scorte — ma non la vedeva nessuno.
//
// Qui si legge quello che serve per farlo: gli ingredienti con le
// quantità, e come si prepara, che è la parte che la ricetta strutturata
// non può dire (shakerato o mescolato, il ghiaccio, il bicchiere).
//
// Non è la scheda di modifica: qui non si tocca niente. Si guarda mentre si
// versa, e si chiude.
export default function SchedaDrink({ drink, onClose }) {
  if (!drink) return null
  const ingredienti = Array.isArray(drink.recipe_items) ? drink.recipe_items : []
  return (
    <div className="overlay confirm-overlay" onClick={onClose}>
      <div
        className="confirm-box scheda-drink"
        role="dialog"
        aria-label={tr('Scheda di {nome}', { nome: drink.name })}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row between" style={{ alignItems: 'baseline', gap: 8 }}>
          <h3 style={{ margin: 0 }}>{drink.name}</h3>
          <strong className="price">{formatPrice(drink.price)}</strong>
        </div>
        {drink.description && (
          <p className="muted small" style={{ margin: '6px 0 0' }}>
            {drink.description}
          </p>
        )}

        <h4 style={{ margin: '14px 0 4px' }}>{tr('Ingredienti')}</h4>
        {ingredienti.length === 0 ? (
          <p className="muted small" style={{ margin: 0 }}>
            {tr('Nessun ingrediente collegato al magazzino.')}
          </p>
        ) : (
          <ul className="scheda-drink-righe">
            {ingredienti.map((r, i) => (
              <li key={i} className="row between">
                <span>{r.name || tr('ingrediente')}</span>
                <strong>{formatQty(r.qty, r.unit)}</strong>
              </li>
            ))}
          </ul>
        )}

        {drink.recipe && (
          <>
            <h4 style={{ margin: '14px 0 4px' }}>{tr('Come si prepara')}</h4>
            {/* A capo dove li ha messi chi l'ha scritta: una preparazione è
                una sequenza di gesti, non un paragrafo. */}
            <p className="scheda-drink-preparazione">{drink.recipe}</p>
          </>
        )}

        <button type="button" className="btn block" style={{ marginTop: 16 }} onClick={onClose}>
          {tr('Chiudi')}
        </button>
      </div>
    </div>
  )
}
