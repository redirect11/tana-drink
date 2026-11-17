import { STATI_LICENZA } from '../lib/licenza.js'
import { isAdmin } from '../lib/ruoli.js'
import BackupPanel from './BackupPanel.jsx'
import { tr, daTradurre, trSegnato, formatoAttivo, useLingua } from '../lib/lingua.js'

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
// sull'abbonamento sono fatti suoi. Lo stato è una frase intera e non un
// pezzo da incastrare («è {stato}»): in inglese il verbo e l'ordine delle
// parole cambiano da uno stato all'altro. E la frase con la data è un'altra
// frase intera, non quella senza data con «dal {data}» attaccato: in inglese
// «is suspended since…» è sbagliato, e la scadenza vuole «expired on…».
const TESTI = {
  [STATI_LICENZA.CHIUSA]: {
    titolo: daTradurre('Installazione chiusa'),
    frase: daTradurre('L’app di {nome} è chiusa.'),
    fraseDal: daTradurre('L’app di {nome} è chiusa dal {data}.'),
    seguito: daTradurre('I dati restano consultabili fino alla loro cancellazione.'),
  },
  [STATI_LICENZA.NON_ATTIVATA]: {
    titolo: daTradurre('Installazione non attivata'),
    frase: daTradurre('L’app di {nome} è non ancora attivata.'),
    fraseDal: daTradurre('L’app di {nome} è non ancora attivata dal {data}.'),
    seguito: daTradurre('L’attivazione si completa dalla pagina del prodotto; appena è attiva, l’app si apre da sola.'),
  },
  [STATI_LICENZA.SCADUTA]: {
    titolo: daTradurre('Licenza scaduta'),
    frase: daTradurre('L’app di {nome} è ferma per la scadenza della licenza.'),
    fraseDal: daTradurre('L’app di {nome} è ferma per la scadenza della licenza dal {data}.'),
    seguito: daTradurre('Il titolare può rinnovarla dalla sua pagina del prodotto; appena è rinnovata, l’app si apre da sola.'),
  },
  [STATI_LICENZA.SOSPESA]: {
    titolo: daTradurre('Installazione sospesa'),
    frase: daTradurre('L’app di {nome} è sospesa.'),
    fraseDal: daTradurre('L’app di {nome} è sospesa dal {data}.'),
    seguito: daTradurre('Il titolare può riattivarla dalla sua pagina del prodotto, mettendo in regola l’abbonamento.'),
  },
}

export default function InstallazioneSospesa({ licenza, venue, ruolo = null }) {
  useLingua()

  // IL PUBBLICO resta in italiano: è una pagina dei clienti (il menù col
  // QR), e i testi che arrivano al cliente non seguono la lingua di chi
  // lavora (REQ-CLI-010).
  if (!ruolo) {
    const nome = venue?.venue_name || 'questo locale'
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
          <h2>{tr('Locale fermo')}</h2>
          <p>{tr('Il locale è momentaneamente fermo: per informazioni rivolgersi al titolare.')}</p>
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
  const nome = venue?.venue_name || tr('questo locale')
  const dal =
    licenza?.stato === STATI_LICENZA.SCADUTA && licenza.scaduta_il
      ? licenza.scaduta_il
      : licenza?.dal || null
  return (
    <main className="installazione-sospesa" role="alert">
      <div className="card">
        <h2>{trSegnato(testo.titolo)}</h2>
        <p>
          {dal
            ? trSegnato(testo.fraseDal, { nome, data: new Date(dal).toLocaleDateString(formatoAttivo()) })
            : trSegnato(testo.frase, { nome })}
          {licenza?.motivo && ` ${tr('Motivo: {motivo}.', { motivo: licenza.motivo })}`}
        </p>
        <p className="muted">
          {tr('Non è un guasto e i dati non sono andati persi.')} {trSegnato(testo.seguito)}
        </p>
        {!chiusa && rinnovo && (
          <a className="btn" href={rinnovo}>
            {nonAttivata ? tr('Vai alla pagina del prodotto') : tr('Riattiva il locale')}
          </a>
        )}
      </div>
      <BackupPanel role={ruolo} soloEsporta />
    </main>
  )
}
