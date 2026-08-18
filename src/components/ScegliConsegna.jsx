import { MODI_CONSEGNA, cambioModoPermesso } from '../lib/consegna.js'

// ── COME LO PRENDE: SERVIZIO O RITIRO ────────────────────────────────
//
// L'impostazione del locale dice come NASCONO i conti; qui si cambia quello
// che si ha in mano. Un tavolo che viene a ritirare al banco succede tutte
// le sere.
//
// STA IN UN FILE SUO perché la scelta si fa da due posti: dal CONTO (→ Dati
// conto, dove ci sono nome e tavolo) e dal DETTAGLIO DELLA COMANDA, che è
// dove sta chi guarda il ticket — «questo se lo porta via» si decide con il
// bicchiere in mano, non risalendo al conto. Due schermate che cambiano il
// modo in due modi diversi sarebbero due modi diversi di sbagliare il
// conto: le quantità le conta sempre `supplementiPerModo`, e a scrivere è
// sempre `setOrderServiceMode`.
//
// DUE COSE SI LEGGONO PRIMA DI PREMERE, non dopo:
//
//   COSA SUCCEDE AI SOLDI. Il ritiro azzera coperto e servizio, quindi il
//   totale cambia. Con un acconto già preso no: quei supplementi erano
//   stati calcolati sul totale su cui si è incassato, e muoverlo sotto un
//   acconto è come cambiare il prezzo dopo aver preso i soldi.
//
//   CHE VALE PER TUTTO IL CONTO. Il modo sta sul conto, non sulla comanda:
//   toccandolo da un ticket cambia anche per le altre comande dello stesso
//   conto. Da lì non è per niente ovvio — uno crede di star marcando quello
//   che ha in mano — e va detto proprio dove si tocca.

export default function ScegliConsegna({
  order,
  modo,
  // Chi ha più di un ticket in ballo lo dice qui: la riga «vale per tutto
  // il conto» serve solo dove non è ovvio, cioè guardando UNA comanda.
  perTuttoIlConto = false,
  // In creazione il conto non esiste ancora: si mostra la scelta ma non si
  // scrive niente.
  inCreazione = false,
  senzaSupplementi = false,
  onCambia,
}) {
  const permesso = inCreazione ? 'si' : cambioModoPermesso(order)
  const spiegazione = inCreazione
    ? 'Si sceglie appena il conto esiste.'
    : permesso === 'no'
      ? 'Conto chiuso: per cambiarlo riaprilo prima.'
      : permesso === 'senza-soldi'
        ? 'C’è già un acconto: il modo si cambia, coperto e servizio restano quelli su cui hai incassato.'
        : senzaSupplementi
          ? 'Cambia solo come arriva il drink: qui non ci sono coperto né servizio.'
          : 'Col ritiro al banco coperto e servizio si azzerano.'

  return (
    <div className="scegli-consegna">
      <label style={{ display: 'block' }}>Come lo prende</label>
      <div className="chips-row" style={{ marginTop: 4 }}>
        {MODI_CONSEGNA.map(([valore, etichetta]) => (
          <button
            key={valore}
            type="button"
            className={`chip ${modo === valore ? 'active' : ''}`}
            disabled={inCreazione || permesso === 'no'}
            aria-pressed={modo === valore}
            onClick={() => {
              if (inCreazione || valore === modo || permesso === 'no') return
              onCambia?.(valore)
            }}
          >
            {etichetta}
          </button>
        ))}
      </div>
      <p className="muted small" style={{ margin: '4px 0 0' }}>
        {perTuttoIlConto && permesso !== 'no' && (
          <>
            Vale per tutto il conto, anche per le altre comande.{' '}
          </>
        )}
        {spiegazione}
      </p>
    </div>
  )
}
