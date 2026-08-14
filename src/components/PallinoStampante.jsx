import { useState } from 'react'
import { useStatoStampante } from '../lib/statoStampante.js'
import { salaStampaDaSe, loadPrinterSettings } from '../lib/printer.js'

// ── SI STAMPERÀ? ─────────────────────────────────────────────────────
// Un pallino nella coda ordini, per tutti: chi sta al banco e chi sta in
// sala. Verde = la stampante risponde, la comanda uscirà. Rosso = adesso
// non uscirebbe, e toccandolo si legge perché e cosa fare.
//
// Sta qui e non nelle impostazioni perché la domanda viene in mente
// mentre si prende un ordine, e in sala le impostazioni non ci sono.

const FACCIA = {
  ok: { punto: '🟢', testo: 'Stampante' },
  ko: { punto: '🔴', testo: 'Stampante' },
  spenta: { punto: '⚪', testo: 'Stampante' },
  ignota: { punto: '⚪', testo: 'Stampante' },
}

export default function PallinoStampante({ gestore = false }) {
  const { stato, motivo, ricontrolla } = useStatoStampante()
  const [aperto, setAperto] = useState(false)
  const rimbalzo = !salaStampaDaSe(loadPrinterSettings())
  const faccia = FACCIA[stato] ?? FACCIA.ignota

  // In sala con la stampa "di rimbalzo" il pallino di QUESTO telefono non
  // vuol dire niente: a stampare è il banco. Dirlo, invece di mostrare un
  // rosso che non si può sistemare.
  if (rimbalzo && !gestore) {
    return (
      <span className="pallino-stampante rimbalzo" title="Le comande le stampa il banco">
        🖨️ <span className="pallino-testo">Stampa il banco</span>
      </span>
    )
  }

  return (
    <span className="pallino-guscio">
      <button
        type="button"
        className={`pallino-stampante ${stato}`}
        onClick={() => {
          setAperto((v) => !v)
          ricontrolla()
        }}
        aria-label={`Stampante: ${stato === 'ok' ? 'risponde' : motivo || 'in verifica'}`}
        title={stato === 'ok' ? 'La stampante risponde' : motivo || 'Controllo in corso…'}
      >
        {faccia.punto} <span className="pallino-testo">{faccia.testo}</span>
      </button>

      {aperto && (
        <div className="pallino-bolla" role="status">
          {stato === 'ok' && <p>La stampante risponde: le comande escono.</p>}
          {stato === 'spenta' && (
            <p>
              Qui non c'è nessuna stampante impostata.{' '}
              {gestore
                ? 'Mettila in Impostazioni → Stampante.'
                : 'Dillo a chi sta al banco.'}
            </p>
          )}
          {stato === 'ko' && (
            <>
              <p>Adesso la comanda non uscirebbe: {motivo}</p>
              {/* Il guasto più frequente non è la stampante spenta: è il
                  certificato che il telefono non accetta più. Si sistema
                  aprendo l'indirizzo della stampante e dicendo di sì. */}
              <p className="muted">
                Se la stampante è accesa, apri{' '}
                <a
                  href={`https://${loadPrinterSettings().ip}:${loadPrinterSettings().port}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  https://{loadPrinterSettings().ip}:{loadPrinterSettings().port}
                </a>{' '}
                e accetta l'avviso di sicurezza: è l'eccezione che scade.
              </p>
            </>
          )}
          {stato === 'ignota' && <p>Sto chiedendo alla stampante…</p>}
        </div>
      )}
    </span>
  )
}
