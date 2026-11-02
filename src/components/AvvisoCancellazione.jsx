import { cancellazioneProgrammata } from '../lib/licenza.js'
import { urlRegia } from '../lib/limiti.js'
import { dataAvviso } from '../lib/aggiornamenti.js'

// ── L'AVVISO DELLA CANCELLAZIONE DEI DATI (REQ-LIC-009) ───────────────
// Sopra a tutto, su ogni schermata di chi lavora, anche sul locale fermo:
// è l'ultima cosa che il titolare deve poter non sapere. Non si chiude: si
// toglie quando la regia toglie la cancellazione dalla licenza.
// Al cliente non si mostra: non è affar suo, e non può farci niente.
// I testi seguono quello della dashboard della regia, al registro
// impersonale dell'app (CLAUDE.md: professionale, senza «tu»).

const COSA_FARE = {
  conservazione: 'Per evitarlo basta riattivare l’abbonamento.',
  titolare: 'La cancellazione è stata chiesta dal titolare e si annulla dall’area clienti.',
  admin: 'La cancellazione è stata disposta dal fornitore del servizio, a cui rivolgersi per informazioni.',
}

export default function AvvisoCancellazione({ settings, ruolo }) {
  const c = cancellazioneProgrammata(settings)
  if (!ruolo || !c) return null
  const area = urlRegia(settings)
  return (
    <div className="banner avviso-cancellazione" role="alert">
      <strong>I dati del locale verranno cancellati il {dataAvviso(c.il)}.</strong>{' '}
      Quel giorno l’installazione e i suoi dati verranno cancellati definitivamente, dopo un backup
      scaricabile dall’area clienti per 180 giorni. {COSA_FARE[c.richiedente]}
      {area && (
        <>
          {' '}
          <a href={area}>Vai all’area clienti</a>
        </>
      )}
    </div>
  )
}
