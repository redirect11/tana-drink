import { useState } from 'react'
import { formatPrice } from '../lib/orderStatus.js'
import { chiaveEtichetta as chiave } from '../lib/etichetteIngredienti.js'

// IL CLIENTE SCEGLIE L'INGREDIENTE (REQ-MENU-042): si apre toccando
// «Aggiungi» su una voce che fa scegliere. Una domanda per etichetta, già
// risposta con la ricetta: chi non tocca niente aggiunge il drink com'è.
// Le alternative sono solo quelle disponibili (sceltaCliente.js,
// scelteDellaVoce); quello che manca non si nomina.
export default function SceltaIngredienti({ voce, scelte, onAggiungi, onClose }) {
  // etichetta → id scelto ('' = come da ricetta)
  const [scelto, setScelto] = useState({})
  const fatte = scelte
    .map(({ etichetta, opzioni }) => ({ etichetta, scelto: opzioni.find((o) => o.id === scelto[chiave(etichetta)]) }))
    .filter((s) => s.scelto)
  const totale = Number(voce.price || 0) + fatte.reduce((s, x) => s + Number(x.scelto.supplemento || 0), 0)

  return (
    <div className="overlay confirm-overlay" onClick={onClose}>
      <div className="confirm-box scelta-ingredienti" role="dialog" aria-label={voce.name} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>{voce.name}</h3>
        {scelte.map(({ etichetta, opzioni }) => {
          const k = chiave(etichetta)
          const nome = `scelta-${k}`
          return (
            <fieldset key={k} className="scelta-ingredienti-gruppo">
              <legend>{etichetta.nome}</legend>
              <label className="scelta-ingredienti-opzione">
                <input type="radio" name={nome} checked={!scelto[k]} onChange={() => setScelto((s) => ({ ...s, [k]: '' }))} />
                <span>{etichetta.tipo === 'prodotto' ? `${etichetta.nome}, come da ricetta` : 'Come da ricetta'}</span>
              </label>
              {opzioni.map((o) => (
                <label key={o.id} className="scelta-ingredienti-opzione">
                  <input
                    type="radio"
                    name={nome}
                    checked={scelto[k] === o.id}
                    onChange={() => setScelto((s) => ({ ...s, [k]: o.id }))}
                  />
                  <span className="grow">{o.nome}</span>
                  {o.supplemento > 0 && <span className="muted">+ {formatPrice(o.supplemento)}</span>}
                </label>
              ))}
            </fieldset>
          )
        })}
        <div className="row" style={{ gap: 10, marginTop: 16 }}>
          <button className="btn ghost grow" onClick={onClose}>
            Annulla
          </button>
          <button className="btn grow" onClick={() => onAggiungi(fatte)}>
            Aggiungi · {formatPrice(totale)}
          </button>
        </div>
      </div>
    </div>
  )
}

