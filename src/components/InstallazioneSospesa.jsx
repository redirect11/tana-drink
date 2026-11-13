import { STATI_LICENZA } from '../lib/licenza.js'
import { isAdmin } from '../lib/ruoli.js'
import BackupPanel from './BackupPanel.jsx'

// L'INSTALLAZIONE SOSPESA O CHIUSA (REQ-FLOTTA-008). L'utente, 22/10/2026:
// «serve un modo per eliminare/fermare l'app deployata (ad esempio se non
// arriva il pagamento mensile)». Quando la licenza dice `sospesa` o
// `chiusa`, l'app mostra questa schermata al posto di tutto il resto. I
// dati restano dove sono: riattivata, si riparte da dove si era.
// E NON ATTIVATA (BUG-125): nessuna licenza. Si vede solo quando il server
// ha confermato che il documento non c'è. E SCADUTA (REQ-LIC-009): passata
// `valida_fino` senza `alla_scadenza: 'free'`, anche senza rete.
// Quanto restano i dati di un locale fermo lo dice l'avviso della
// cancellazione (AvvisoCancellazione), con la data vera: qui non si
// promettono giorni.
//
// SECONDO CHI APRE (REQ-LIC-018, Daniele 13/11/2026: «chi entra nel locale
// non deve leggere che il titolare non ha pagato»). Prima la stessa
// schermata, col motivo, la vedevano tutti, anche chi apriva il menù col
// QR. Ora:
//   · il PUBBLICO (nessun ruolo: menù, pagina del locale, clienti) legge
//     solo che il menù non è disponibile;
//   · il PERSONALE legge che il locale è fermo e a chi chiedere;
//   · il TITOLARE legge il motivo, va al rinnovo («Riattiva il locale»,
//     verso `rinnovo_url` della regia o, se manca, `regia_url`; non sul
//     locale chiuso, che non si riapre da solo) e scarica i suoi dati.
//     «Esporta tutto» fa solo letture, e le regole le lasciano passare
//     anche sul locale fermo; il ripristino, che scrive, qui non c'è.

// Quello che legge il TITOLARE, stato per stato: il motivo e le parole
// sull'abbonamento sono fatti suoi.
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

export default function InstallazioneSospesa({ licenza, venue, ruolo = null }) {
  const nome = venue?.venue_name || 'questo locale'

  if (!ruolo) {
    return (
      <main className="installazione-sospesa" role="alert">
        <div className="card">
          <h2>Menù non disponibile</h2>
          <p>
            Il menù di <strong>{nome}</strong> non è disponibile in questo momento.
          </p>
        </div>
      </main>
    )
  }

  if (!isAdmin(ruolo)) {
    return (
      <main className="installazione-sospesa" role="alert">
        <div className="card">
          <h2>Locale fermo</h2>
          <p>Il locale è momentaneamente fermo: per informazioni rivolgersi al titolare.</p>
        </div>
      </main>
    )
  }

  const testo = TESTI[licenza?.stato] || TESTI[STATI_LICENZA.SOSPESA]
  const chiusa = licenza?.stato === STATI_LICENZA.CHIUSA
  const nonAttivata = licenza?.stato === STATI_LICENZA.NON_ATTIVATA
  // L'attivazione non è un rinnovo: per quella si va alla pagina del
  // prodotto, come prima.
  const rinnovo = nonAttivata ? licenza?.regia_url : licenza?.rinnovo_url || licenza?.regia_url
  return (
    <main className="installazione-sospesa" role="alert">
      <div className="card">
        <h2>{testo.titolo}</h2>
        <p>
          L’app di <strong>{nome}</strong> è {testo.stato}
          {licenza?.stato === STATI_LICENZA.SCADUTA && licenza.scaduta_il
            ? ` dal ${new Date(licenza.scaduta_il).toLocaleDateString('it-IT')}`
            : licenza?.dal && ` dal ${new Date(licenza.dal).toLocaleDateString('it-IT')}`}
          .
          {licenza?.motivo && ` Motivo: ${licenza.motivo}.`}
        </p>
        <p className="muted">
          Non è un guasto e i dati non sono andati persi. {testo.seguito}
        </p>
        {!chiusa && rinnovo && (
          <a className="btn" href={rinnovo}>
            {nonAttivata ? 'Vai alla pagina del prodotto' : 'Riattiva il locale'}
          </a>
        )}
      </div>
      <BackupPanel role={ruolo} soloEsporta />
    </main>
  )
}
