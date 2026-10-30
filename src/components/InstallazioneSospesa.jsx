import { STATI_LICENZA } from '../lib/licenza.js'

// L'INSTALLAZIONE SOSPESA O CHIUSA (REQ-FLOTTA-008). L'utente, 22/10/2026:
// «serve un modo per eliminare/fermare l'app deployata (ad esempio se non
// arriva il pagamento mensile)». Quando la licenza dice `sospesa` o
// `chiusa`, l'app mostra questa schermata al posto di tutto il resto: a
// chi lavora dice che non è un guasto, a chi gestisce dice cosa fare. I
// dati restano dove sono: riattivata, si riparte da dove si era.
export default function InstallazioneSospesa({ licenza, venue }) {
  const chiusa = licenza?.stato === STATI_LICENZA.CHIUSA
  return (
    <main className="installazione-sospesa" role="alert">
      <div className="card">
        <h2>{chiusa ? 'Installazione chiusa' : 'Installazione sospesa'}</h2>
        <p>
          L’app di <strong>{venue?.venue_name || 'questo locale'}</strong> è{' '}
          {chiusa ? 'chiusa' : 'sospesa'}
          {licenza?.dal && ` dal ${new Date(licenza.dal).toLocaleDateString('it-IT')}`}.
          {licenza?.motivo && ` Motivo: ${licenza.motivo}.`}
        </p>
        <p className="muted">
          Non è un guasto e i dati non sono andati persi.{' '}
          {chiusa
            ? 'I dati restano disponibili per 30 giorni dalla chiusura.'
            : 'Il titolare può riattivarla dalla sua pagina del prodotto, mettendo in regola l’abbonamento.'}
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
