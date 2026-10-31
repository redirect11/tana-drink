/* global __GIT_BRANCH__, __GIT_COMMIT__, __BUILD_ID__, __APP_VERSION__ */
import { useEffect, useState } from 'react'
import { etichettaVersione } from '../lib/versione.js'
import Changelog from './Changelog.jsx'
import AvvisoPiano from './AvvisoPiano.jsx'
import { useSceltaAggiornamento } from './PropostaAggiornamento.jsx'
import { scegliAggiornamento } from '../lib/api.js'
import {
  MESSAGGI_AGGIORNAMENTI,
  SCELTE,
  avvisoCondizioni,
  dataAvviso,
  nonInclusi,
  numeroVersione,
  propostaAperta,
  statoProposta,
} from '../lib/aggiornamenti.js'
import { isAdmin } from '../lib/ruoli.js'
import { configurazione } from '../porte/configurazione.js'

// INFORMAZIONI: che versione è, cosa è cambiato, e i dati tecnici che
// servono quando qualcosa non va.
//
// Chi usa l'app deve poter sapere cosa è cambiato senza chiederlo a chi
// l'ha scritta — e chi assiste deve poter chiedere "che versione hai?"
// ottenendo una risposta esatta invece di "l'ultima, credo".

const BRANCH = typeof __GIT_BRANCH__ !== 'undefined' ? __GIT_BRANCH__ : ''
const COMMIT = typeof __GIT_COMMIT__ !== 'undefined' ? __GIT_COMMIT__ : ''
const BUILD = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : ''
const VERSIONE = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : ''

export default function InfoTab({ settings = null, role = null }) {
  const [changelog, setChangelog] = useState(null)
  const [errore, setErrore] = useState(null)

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL || '/'}changelog.md`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setChangelog)
      .catch(() => setErrore('Le note di questa versione non sono disponibili.'))
  }, [])

  const dati = [
    ['Versione', etichettaVersione({ branch: 'main', versione: VERSIONE }) || '—'],
    ['Ramo', BRANCH || '—'],
    ['Commit', COMMIT || '—'],
    ['Build', BUILD || '—'],
    ['Ambiente', import.meta.env.VITE_APP_ENV || 'produzione'],
    ['Progetto', configurazione().firebase.projectId || '—'],
  ]

  const copia = () =>
    navigator.clipboard?.writeText(dati.map(([k, v]) => `${k}: ${v}`).join('\n')).catch(() => {})

  return (
    <div>
      <div className="card settings-section">
        <h3>Questa versione</h3>
        <div className="info-dati">
          {dati.map(([k, v]) => (
            <div className="row between" key={k}>
              <span className="muted">{k}</span>
              <strong className="info-valore">{v}</strong>
            </div>
          ))}
        </div>
        <p className="muted small" style={{ margin: '8px 0 0' }}>
          Servono quando qualcosa non va: copiali e allegali alla segnalazione.
        </p>
        <button className="btn ghost small" style={{ marginTop: 8 }} onClick={copia}>
          Copia i dati tecnici
        </button>
      </div>

      <Aggiornamenti settings={settings} role={role} />

      <div className="card settings-section">
        <h3>Cosa è cambiato</h3>
        {errore && <p className="muted small">{errore}</p>}
        {!changelog && !errore && <p className="muted small">Carico le note…</p>}
        {changelog && <Changelog testo={changelog} />}
      </div>
    </div>
  )
}

// GLI AGGIORNAMENTI DECISI DALLA REGIA (REQ-FLOTTA-020). Qui resta quello
// che il box mostra una volta sola: la proposta, anche saltata, col suo
// «Aggiorna» per chi cambia idea; il perché, se il piano non comprende gli
// aggiornamenti; l'ultimo avviso sulle condizioni. Senza la voce nella
// licenza (la Tana) la scheda non c'è.
function Aggiornamenti({ settings, role }) {
  const scelta = useSceltaAggiornamento(settings, role)
  const [chiesto, setChiesto] = useState(null)
  const proposta = propostaAperta(settings, { versione: VERSIONE })
  const stato =
    proposta && chiesto === proposta.tag ? 'chiesto' : statoProposta(settings, { ruolo: role, versione: VERSIONE, scelta })
  const motivo = nonInclusi(settings)
  const avviso = isAdmin(role) ? avvisoCondizioni(settings) : null
  if (!stato && !motivo && !avviso) return null

  return (
    <div className="card settings-section">
      <h3>Aggiornamenti</h3>
      {stato === 'del_titolare' && <p className="muted small">{MESSAGGI_AGGIORNAMENTI.del_titolare}</p>}
      {(stato === 'da_scegliere' || stato === 'chiesto') && (
        <>
          <p style={{ margin: '0 0 6px' }}>
            Disponibile la versione <strong>{numeroVersione(proposta.tag)}</strong>.
          </p>
          {proposta.note && <Changelog testo={String(proposta.note)} />}
          {stato === 'chiesto' ? (
            <p className="muted small" style={{ margin: '8px 0 0' }}>{MESSAGGI_AGGIORNAMENTI.chiesto}</p>
          ) : (
            <button
              className="btn small"
              style={{ marginTop: 8 }}
              onClick={() => {
                scegliAggiornamento(proposta.tag, SCELTE.AGGIORNA)
                setChiesto(proposta.tag)
              }}
            >
              Aggiorna
            </button>
          )}
        </>
      )}
      {motivo && <AvvisoPiano compatto messaggio={MESSAGGI_AGGIORNAMENTI[motivo]} impostazioni={settings} />}
      {avviso && (
        <div style={{ marginTop: 10 }}>
          <strong className="small">Condizioni del servizio</strong>
          <p className="small" style={{ whiteSpace: 'pre-line', margin: '4px 0 0' }}>{avviso.testo}</p>
          {dataAvviso(avviso.dal) && (
            <p className="muted small" style={{ margin: '4px 0 0' }}>In vigore dal {dataAvviso(avviso.dal)}.</p>
          )}
        </div>
      )}
    </div>
  )
}
