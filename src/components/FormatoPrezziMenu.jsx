import { FORMATI_PREZZO_MENU, formatoPrezziMenu } from '../lib/prezzoMenu.js'

// LA SCELTA DEL FORMATO DEI PREZZI DEL MENÙ (REQ-MENU-038), in Impostazioni →
// Menù clienti. Tre tasti, ognuno col suo esempio: chi sceglie vede subito
// come si leggerà un prezzo tondo e uno coi centesimi, senza doverlo
// immaginare da un nome.
export default function FormatoPrezziMenu({ settings, onSave }) {
  const scelto = formatoPrezziMenu(settings)
  return (
    <div className="formato-prezzi">
      <p className="formato-prezzi-titolo" id="formato-prezzi-titolo">
        Prezzi nel menù
      </p>
      <p className="muted small" style={{ margin: '0 0 8px' }}>
        Come si leggono i prezzi nel menù dei clienti. Carrello, ordine, conti e scontrini riportano sempre l’importo in
        euro.
      </p>
      <div className="mode-choice" role="group" aria-labelledby="formato-prezzi-titolo">
        {FORMATI_PREZZO_MENU.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`mode-option${scelto === f.id ? ' active' : ''}`}
            aria-pressed={scelto === f.id}
            onClick={() => scelto !== f.id && onSave({ formato_prezzi_menu: f.id })}
          >
            {f.label}
            <span className="formato-prezzi-esempio">{f.esempio}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
