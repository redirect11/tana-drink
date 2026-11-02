import { useState } from 'react'
import { STATI_LICENZA } from '../lib/licenza.js'

// L'INSTALLAZIONE SOSPESA O CHIUSA (REQ-FLOTTA-008). L'utente, 22/10/2026:
// «serve un modo per eliminare/fermare l'app deployata (ad esempio se non
// arriva il pagamento mensile)». Quando la licenza dice `sospesa` o
// `chiusa`, l'app mostra questa schermata al posto di tutto il resto: a
// chi lavora dice che non è un guasto, a chi gestisce dice cosa fare. I
// dati restano dove sono: riattivata, si riparte da dove si era.
// E NON ATTIVATA (BUG-125): nessuna licenza. Si vede solo quando il server
// ha confermato che il documento non c'è. E SCADUTA (REQ-LIC-009): passata
// `valida_fino` senza `alla_scadenza: 'free'`, anche senza rete.
// Quanto restano i dati di un locale fermo lo dice l'avviso della
// cancellazione (AvvisoCancellazione), con la data vera: qui non si
// promettono giorni.
const TESTI = {
  [STATI_LICENZA.CHIUSA]: {
    titolo: 'Installazione chiusa',
    stato: 'chiusa',
    seguito: 'I dati restano consultabili fino alla loro cancellazione.',
  },
  [STATI_LICENZA.NON_ATTIVATA]: {
    titolo: 'Installazione non attivata',
    stato: 'non ancora attivata',
    seguito: 'L’attivazione si completa dalla pagina del prodotto; appena è attiva, l’app si apre da sola.',
  },
  [STATI_LICENZA.SCADUTA]: {
    titolo: 'Licenza scaduta',
    stato: 'ferma per la scadenza della licenza',
    seguito: 'Il titolare può rinnovarla dalla sua pagina del prodotto; appena è rinnovata, l’app si apre da sola.',
  },
  [STATI_LICENZA.SOSPESA]: {
    titolo: 'Installazione sospesa',
    stato: 'sospesa',
    seguito: 'Il titolare può riattivarla dalla sua pagina del prodotto, mettendo in regola l’abbonamento.',
  },
}

// IL «RIPROVA» DELLA LICENZA CHE MANCA (REQ-FLOTTA-026): l'app chiede di
// nuovo alla regia di scriverla. Se la scrive, arriva dal listener che c'è
// già e questa schermata se ne va da sola: qui si dice solo com'è andata.
// C'è solo con qualcuno collegato: la regia vuole il token di un utente
// del locale.
const ESITI = {
  scritta: 'La licenza è stata scritta: l’app si apre tra un istante.',
  presente: 'La licenza c’è: l’app si apre tra un istante.',
  non_attiva: 'Nella pagina del prodotto l’installazione non risulta ancora attiva.',
  non_dalla_regia: 'La licenza di questa installazione non è gestita dalla regia.',
}

function Riprova({ onRiprova }) {
  const [stato, setStato] = useState(null)
  const riprova = async () => {
    setStato({ inCorso: true })
    const esito = await onRiprova()
    setStato({ esito })
  }
  const esito = stato?.esito
  const messaggio = !esito
    ? null
    : esito.ok
      ? ESITI[esito.licenza] || ESITI.presente
      : esito.errore || 'La richiesta non è arrivata: riprovare tra poco.'
  return (
    <div style={{ marginTop: 10 }}>
      <button className="btn" disabled={stato?.inCorso} onClick={riprova}>
        {stato?.inCorso ? 'Richiesta in corso…' : 'Riprova'}
      </button>
      {messaggio && <p className="muted small">{messaggio}</p>}
    </div>
  )
}

export default function InstallazioneSospesa({ licenza, venue, onRiprova }) {
  const testo = TESTI[licenza?.stato] || TESTI[STATI_LICENZA.SOSPESA]
  return (
    <main className="installazione-sospesa" role="alert">
      <div className="card">
        <h2>{testo.titolo}</h2>
        <p>
          L’app di <strong>{venue?.venue_name || 'questo locale'}</strong> è {testo.stato}
          {licenza?.stato === STATI_LICENZA.SCADUTA && licenza.scaduta_il
            ? ` dal ${new Date(licenza.scaduta_il).toLocaleDateString('it-IT')}`
            : licenza?.dal && ` dal ${new Date(licenza.dal).toLocaleDateString('it-IT')}`}
          .
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
        {onRiprova && <Riprova onRiprova={onRiprova} />}
      </div>
    </main>
  )
}
