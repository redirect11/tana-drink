import { useState } from 'react'
import { useStatoStampante } from '../lib/statoStampante.js'
import { salaStampaDaSe, loadPrinterSettings } from '../lib/printer.js'
import Icona from './Icona.jsx'
import { tr, trSegnato } from '../lib/lingua.js'

// ── SI STAMPERÀ? ─────────────────────────────────────────────────────
// Un pallino nella coda ordini, per tutti: chi sta al banco e chi sta in
// sala. Verde = la stampante risponde, la comanda uscirà. Rosso = adesso
// non uscirebbe, e toccandolo si legge perché e cosa fare.
//
// Sta qui e non nelle impostazioni perché la domanda viene in mente
// mentre si prende un ordine, e in sala le impostazioni non ci sono.

// L'ICONA, non la parola: «Stampante» accanto a un pallino era una
// didascalia di quello che si vede già, e in una riga dove lo spazio serve
// alla ricerca. L'oggetto lo dice il disegno.
const PUNTO = { ok: 'verde', ko: 'rosso', spenta: 'spento', ignota: 'spento' }

export default function PallinoStampante({ gestore = false }) {
  const { stato, motivo, ricontrolla } = useStatoStampante()
  const [aperto, setAperto] = useState(false)
  const rimbalzo = !salaStampaDaSe(loadPrinterSettings())
  const punto = PUNTO[stato] ?? PUNTO.ignota
  // Il motivo arriva da lib/statoStampante.js così com'è scritto lì: per la
  // stampante spenta è sempre lo stesso, e qui si dice nella lingua di chi
  // guarda; per un guasto è quello che ha risposto la stampante.
  const perche = stato === 'spenta' ? tr('Stampante non configurata') : trSegnato(motivo)

  // In sala con la stampa "di rimbalzo" il pallino di QUESTO telefono non
  // vuol dire niente: a stampare è il banco. Dirlo, invece di mostrare un
  // rosso che non si può sistemare.
  if (rimbalzo && !gestore) {
    return (
      <span className="btn ghost small pallino-stampante rimbalzo" title={tr('Le comande le stampa il banco')}>
        <Icona nome="stampante" gruppo="tasti" /> <span className="pallino-testo">{tr('Stampa il banco')}</span>
      </span>
    )
  }

  return (
    <span className="pallino-guscio">
      <button
        type="button"
        className={`btn ghost small pallino-stampante ${stato}`}
        onClick={() => {
          setAperto((v) => !v)
          ricontrolla()
        }}
        aria-label={tr('Stampante: {stato}', {
          stato: stato === 'ok' ? tr('risponde') : perche || tr('in verifica'),
        })}
        title={stato === 'ok' ? tr('La stampante risponde') : perche || tr('Controllo in corso…')}
      >
        <Icona nome="stampante" gruppo="tasti" />{' '}
        <span className="pallino-punto">
          <Icona nome={punto} gruppo="segnali" />
        </span>
      </button>

      {aperto && (
        <div className="pallino-bolla" role="status">
          {stato === 'ok' && <p>{tr('La stampante risponde: le comande escono.')}</p>}
          {stato === 'spenta' && (
            <p>
              {tr("Qui non c'è nessuna stampante impostata.")}{' '}
              {gestore ? tr('Mettila in Impostazioni → Stampante.') : tr('Impostala dal menu, in Stampante.')}
            </p>
          )}
          {stato === 'ko' && (
            <>
              <p>{tr('Adesso la comanda non uscirebbe: {motivo}', { motivo: perche })}</p>
              {/* Il guasto più frequente non è la stampante spenta: è il
                  certificato che il telefono non accetta più. Si sistema
                  aprendo l'indirizzo della stampante e dicendo di sì. */}
              <p className="muted">
                {tr('Se la stampante è accesa, apri')}{' '}
                <a
                  href={`https://${loadPrinterSettings().ip}:${loadPrinterSettings().port}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  https://{loadPrinterSettings().ip}:{loadPrinterSettings().port}
                </a>{' '}
                {tr("e accetta l'avviso di sicurezza: è l'eccezione che scade.")}
              </p>
            </>
          )}
          {stato === 'ignota' && <p>{tr('Sto chiedendo alla stampante…')}</p>}
        </div>
      )}
    </span>
  )
}
