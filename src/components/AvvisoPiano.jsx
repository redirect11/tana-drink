import { urlRegia } from '../lib/limiti.js'

// UN LIMITE DEL PIANO, DETTO DOVE SI INCONTRA (REQ-LIC-003). Una frase
// piana — cosa non si può fare in questo piano — e, se la regia ha scritto
// dove, il collegamento alla pagina del prodotto, dove il titolare sceglie
// un piano a pagamento. Non è un errore: è il piano, e va detto così.
// `compatto` per stare dentro un elenco (una riga sotto un tasto), invece
// che come scheda a sé.
export default function AvvisoPiano({ messaggio, impostazioni, compatto = false }) {
  if (!messaggio) return null
  const url = urlRegia(impostazioni)
  return (
    <div className={`avviso-piano${compatto ? ' compatto' : ' card'}`} role="note">
      <p className="muted">{messaggio}</p>
      {url && (
        <a className="btn ghost small" href={url} target="_blank" rel="noopener noreferrer">
          Vedi i piani
        </a>
      )}
    </div>
  )
}
