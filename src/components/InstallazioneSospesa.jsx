import { STATI_LICENZA } from '../lib/licenza.js'

// L'INSTALLAZIONE SOSPESA O CHIUSA (REQ-FLOTTA-008). L'utente, 22/10/2026:
// «serve un modo per eliminare/fermare l'app deployata (ad esempio se non
// arriva il pagamento mensile)». Quando la licenza dice `sospesa` o
// `chiusa`, l'app mostra questa schermata al posto di tutto il resto: a
// chi lavora dice che non è un guasto, a chi gestisce dice cosa fare. I
// dati restano dove sono: riattivata, si riparte da dove si era.
// E NON ATTIVATA (BUG-125): nessuna licenza, né della regia né della build.
// Si vede solo quando il server ha confermato che il documento non c'è.
const TESTI = {
  [STATI_LICENZA.CHIUSA]: {
    titolo: 'Installazione chiusa',
    stato: 'chiusa',
    seguito: 'I dati restano disponibili per 30 giorni dalla chiusura.',
  },
  [STATI_LICENZA.NON_ATTIVATA]: {
    titolo: 'Installazione non attivata',
    stato: 'non ancora attivata',
    seguito: 'L’attivazione si completa dalla pagina del prodotto; appena è attiva, l’app si apre da sola.',
  },
  [STATI_LICENZA.SOSPESA]: {
    titolo: 'Installazione sospesa',
    stato: 'sospesa',
    seguito: 'Il titolare può riattivarla dalla sua pagina del prodotto, mettendo in regola l’abbonamento.',
  },
}

export default function InstallazioneSospesa({ licenza, venue }) {
  const testo = TESTI[licenza?.stato] || TESTI[STATI_LICENZA.SOSPESA]
  return (
    <main className="installazione-sospesa" role="alert">
      <div className="card">
        <h2>{testo.titolo}</h2>
        <p>
          L’app di <strong>{venue?.venue_name || 'questo locale'}</strong> è {testo.stato}
          {licenza?.dal && ` dal ${new Date(licenza.dal).toLocaleDateString('it-IT')}`}.
          {licenza?.motivo && ` Motivo: ${licenza.motivo}.`}
        </p>
        <p className="muted">
          Non è un guasto e i dati non sono andati persi. {testo.seguito}
        </p>
        {licenza?.regia_url && (
          <a className="btn" href={licenza.regia_url}>
            Vai alla pagina del prodotto
          </a>
        )}
      </div>
    </main>
  )
}
