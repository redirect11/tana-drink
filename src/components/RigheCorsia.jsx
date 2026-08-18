import { formatPrice } from '../lib/orderStatus.js'

// Quante righe si vedono senza chiedere. Sei: è quello che ci sta in una
// card senza far scomparire le corsie accanto, ed è anche più di quanto ha
// un conto normale — chi ne ha venti è l'eccezione, e la apre.
//
// Da dieci in su il conto si legge meglio su DUE colonne: dieci righe in
// fila fanno una card lunga il doppio delle altre, e la colonna dello stato
// si svuota di sotto. Sotto le dieci no — due colonnine da tre righe sono
// peggio di una lista. Lo spazio ce l'ha solo uno schermo largo: il CSS
// tiene la seconda colonna solo dove ci sta (vedi .corsia-righe-due).
const RIGHE_A_VISTA = 6

// LE RIGHE DI UNA CARD, dove che sia. Le usano tutte e due le viste a
// corsie — quella dei conti e quella delle comande — e sono la parte che
// si sbaglia volentieri due volte: il prezzo della riga, la nota che dice
// come si prepara, e il fatto che una lista lunga non deve mangiarsi la
// colonna. Scritte una volta sola.
export default function RigheCorsia({ items, aperto = false, onApri }) {
  const righe = items || []
  const troppe = righe.length > RIGHE_A_VISTA
  return (
    <div className="corsia-righe-box">
      <div
        className={`small corsia-righe${troppe && !aperto ? ' corsia-righe-sfuma' : ''}${
          righe.length >= 10 ? ' corsia-righe-due' : ''
        }`}
      >
        {(aperto ? righe : righe.slice(0, RIGHE_A_VISTA)).map((i, idx) => (
          <div key={i.id ?? `${i.drink_id}-${i.name}-${idx}`} className="corsia-riga">
            <span className="corsia-riga-nome">
              {i.qty}× {i.name}
            </span>
            {/* IL PREZZO DELLA RIGA: chi guarda la card sta spesso
                rispondendo a «quanto viene?», e doveva aprire il conto
                per saperlo. */}
            <span className="corsia-riga-prezzo">
              {formatPrice((Number(i.qty) || 0) * (Number(i.unit_price) || 0))}
            </span>
            {/* La nota della RIGA — «senza ghiaccio» — è quella che cambia
                come si prepara: sta attaccata alla riga, non in fondo al
                conto. */}
            {i.note && <span className="corsia-riga-nota">{i.note}</span>}
          </div>
        ))}
      </div>
      {/* IL TASTO NON SFUMA. Stava dentro il blocco velato e si sbiadiva
          insieme al testo: proprio la cosa da leggere. E aperto spariva —
          non c'era modo di richiudere la card. Adesso è fratello
          dell'elenco: sopra la sfumatura quando è chiuso, in fondo alle
          righe quando è aperto. */}
      {troppe && (
        <button
          className={`corsia-piu${aperto ? ' aperto' : ''}`}
          onClick={(e) => {
            e.stopPropagation()
            onApri?.()
          }}
          aria-expanded={aperto}
        >
          {aperto ? '▴ mostra meno' : `▾ altre ${righe.length - RIGHE_A_VISTA}`}
        </button>
      )}
    </div>
  )
}
