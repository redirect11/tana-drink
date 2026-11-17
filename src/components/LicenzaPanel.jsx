import { riepilogoLicenza, STATI_LICENZA } from '../lib/licenza.js'
import { dataAvviso } from '../lib/aggiornamenti.js'
import { tr, daTradurre, trSegnato } from '../lib/lingua.js'

// ── LA LICENZA, IN SOLA LETTURA (REQ-LIC-007) ─────────────────────────
// «Dovrebbe esserci una parte dove si vede la licenza attuale e la sua
// validità, ma la gestione rimanda sempre a regia» (l'utente, 31/10/2026);
// e il 02/11, guardando la produzione della Tana: «serve un posto per
// mostrare le info di licenza». Da qui non si cambia niente: la licenza
// non la scrive l'app (BUG-125). Il tasto verso la regia c'è solo se la
// licenza dice dov'è (quella della Tana, scritta a mano, non lo dice).
// I moduli qui si CONTANO soltanto: l'elenco, con le prove e le loro
// scadenze, è il riquadro Funzioni premium subito sotto, nello stesso
// gruppo. Ripeterlo metteva gli stessi nomi due volte nella stessa
// schermata.

const STATI = {
  [STATI_LICENZA.ATTIVA]: daTradurre('licenza|Attiva'),
  [STATI_LICENZA.SOSPESA]: daTradurre('licenza|Sospesa'),
  [STATI_LICENZA.CHIUSA]: daTradurre('licenza|Chiusa'),
  [STATI_LICENZA.NON_ATTIVATA]: daTradurre('licenza|Non attivata'),
  [STATI_LICENZA.SCADUTA]: daTradurre('licenza|Scaduta'),
}

// L'id del listino della regia («free», «pro») con l'iniziale maiuscola:
// i nomi commerciali li tiene la regia, e qui non se ne inventano.
const nomePiano = (id) => id.charAt(0).toUpperCase() + id.slice(1)

function testoValidita(validita) {
  if (!validita) return null
  if (validita.tipo === 'senza') return tr('Senza scadenza')
  const data = dataAvviso(validita.data)
  return validita.tipo === 'scaduta' ? tr('Scaduta il {data}', { data }) : tr('Valida fino al {data}', { data })
}

export default function LicenzaPanel({ settings }) {
  const r = riepilogoLicenza(settings)
  if (!r) return null
  const dati = [
    [tr('Piano'), r.piano ? nomePiano(r.piano) : null],
    [tr('licenza|Stato'), trSegnato(STATI[r.stato]) ?? r.stato],
    [tr('Validità'), testoValidita(r.validita)],
    [
      tr('Moduli premium inclusi'),
      tr('{n} su {totale}', { n: r.inclusi.length, totale: r.inclusi.length + r.esclusi.length }),
    ],
    [tr('Stili del menù'), r.temi.length ? r.temi.join(', ') : null],
  ].filter(([, v]) => v)

  return (
    <div className="card settings-section">
      <h3>{tr('Licenza')}</h3>
      <p className="muted" style={{ margin: '0 0 10px', fontSize: '0.85rem' }}>
        {r.gestione
          ? tr(
              'Cosa comprende la licenza di questa installazione. Qui si consulta soltanto: piano, moduli e limiti si modificano dalla regia.'
            )
          : tr(
              'Cosa comprende la licenza di questa installazione. Qui si consulta soltanto: piano, moduli e limiti si modificano presso chi gestisce l’installazione.'
            )}
      </p>
      <div className="info-dati">
        {dati.map(([k, v]) => (
          <div className="row between" key={k}>
            <span className="muted">{k}</span>
            <strong className="info-valore">{v}</strong>
          </div>
        ))}
      </div>

      <p className="muted small" style={{ margin: '8px 0 0' }}>
        {tr('Il dettaglio dei moduli, con quelli in prova, è in Funzioni premium, qui sotto.')}
      </p>

      {r.limiti.length > 0 && (
        <>
          <h4 style={{ margin: '14px 0 4px' }}>{tr('Limiti del piano')}</h4>
          <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
            {r.limiti.map((riga) => (
              <li key={riga}>{riga}</li>
            ))}
          </ul>
        </>
      )}

      {r.gestione && (
        <a className="btn small" style={{ marginTop: 12, display: 'inline-block' }} href={r.gestione}>
          {tr('Gestisci la licenza')}
        </a>
      )}
    </div>
  )
}
