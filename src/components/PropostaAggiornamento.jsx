/* global __APP_VERSION__ */
import { useEffect, useRef, useState } from 'react'
import Changelog from './Changelog.jsx'
import { inviaSceltaAggiornamento } from '../lib/api.js'
import { recordNotif } from '../lib/notifyStore.js'
import { urlRegia } from '../lib/limiti.js'
import {
  MESSAGGI_AGGIORNAMENTI,
  SCELTE,
  avvisoDaMostrare,
  avvisoVisto,
  dataAvviso,
  numeroVersione,
  propostaDaMostrare,
  sceltaUrl,
  segnaAvvisoVisto,
} from '../lib/aggiornamenti.js'

const VERSIONE = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : ''
const INFORMAZIONI = '/bar?tab=impostazioni&sezione=informazioni'

// LA SCELTA, MANDATA ALLA REGIA (REQ-FLOTTA-020), per il box e per le
// Informazioni. `invio` è null, poi { tag, scelta } con `inCorso`, `ok` o
// `errore` (il testo da mostrare). `fatta` è la scelta che la regia ha
// accettato: nasconde la proposta finché la regia non la riscrive nella
// licenza. Senza `url` la scelta non si manda: si fa dall'area clienti.
export function useSceltaAggiornamento(settings) {
  const [invio, setInvio] = useState(null)
  // Un ref e non lo stato: due tocchi prima che React ridisegni vedrebbero
  // tutti e due «nessun invio in corso», e la regia riceverebbe due scelte.
  const inCorso = useRef(false)
  const url = sceltaUrl(settings)
  const scegli = (tag, scelta) => {
    if (!url || inCorso.current) return
    inCorso.current = true
    setInvio({ tag, scelta, inCorso: true })
    inviaSceltaAggiornamento(url, tag, scelta).then((esito) => {
      inCorso.current = false
      setInvio(esito.ok ? { tag, scelta, ok: true } : { tag, scelta, errore: esito.messaggio })
    })
  }
  const fatta = invio?.ok ? { tag: invio.tag, scelta: invio.scelta } : null
  return { url, invio, fatta, scegli }
}

// Il rimando all'area clienti, quando la licenza non dice dove mandare la
// scelta (una licenza scritta prima della chiamata).
export function SceltaDallAreaClienti({ settings, piccolo = false }) {
  const area = urlRegia(settings)
  return (
    <>
      <p className="muted small" style={{ margin: '8px 0 0' }}>{MESSAGGI_AGGIORNAMENTI.dall_area_clienti}</p>
      {area && (
        <a
          className={`btn${piccolo ? ' small' : ' block'}`}
          style={{ marginTop: 8 }}
          href={area}
          target="_blank"
          rel="noopener noreferrer"
        >
          Apri l’area clienti
        </a>
      )}
    </>
  )
}

// I BOX DELLA REGIA, montati da App: prima l'avviso delle condizioni, poi
// la proposta di aggiornamento. Uno alla volta, e mai sopra il box delle
// novità (`inPausa`), che è quello di un aggiornamento appena arrivato.
export default function PropostaAggiornamento({ settings, ruolo, inPausa = false }) {
  const { url, invio, fatta, scegli } = useSceltaAggiornamento(settings)
  const [visto, setVisto] = useState(avvisoVisto)
  // «Più tardi»: il box torna alla prossima apertura dell'app, non prima.
  const [rimandata, setRimandata] = useState(null)
  // Dopo «Aggiorna» accettato il box resta aperto per dire cosa succede
  // adesso, finché il titolare non lo chiude.
  const [partitoChiuso, setPartitoChiuso] = useState(null)

  const avviso = avvisoDaMostrare(settings, { ruolo, visto })
  const proposta = propostaDaMostrare(settings, { ruolo, versione: VERSIONE, scelta: fatta, rimandata })

  // L'avviso lascia una traccia in campanella, che resta dopo aver chiuso
  // il box. Si segna visto appena si mostra, come le novità: annunciato
  // una volta, non due.
  const idAvviso = avviso && !inPausa ? avviso.id : null
  useEffect(() => {
    if (!idAvviso) return
    recordNotif('📄 Condizioni del servizio aggiornate', 'Tocca per rileggere l’avviso', {
      href: INFORMAZIONI,
      letta: true,
    })
    segnaAvvisoVisto(idAvviso)
  }, [idAvviso])

  if (inPausa) return null

  if (avviso) {
    const dal = dataAvviso(avviso.dal)
    return (
      <Box titolo="📄 Condizioni del servizio" etichetta="Avviso sulle condizioni del servizio">
        <p style={{ whiteSpace: 'pre-line', margin: '10px 0 0' }}>{avviso.testo}</p>
        {dal && <p className="muted small" style={{ margin: '8px 0 0' }}>In vigore dal {dal}.</p>}
        <button className="btn block" style={{ marginTop: 12 }} onClick={() => setVisto(String(avviso.id))}>
          Ho letto
        </button>
      </Box>
    )
  }

  if (fatta?.scelta === SCELTE.AGGIORNA && partitoChiuso !== fatta.tag) {
    return (
      <Box titolo={`Versione ${numeroVersione(fatta.tag)}`} etichetta="Aggiornamento partito">
        <p style={{ margin: '10px 0 0' }}>{MESSAGGI_AGGIORNAMENTI.partito}</p>
        <button className="btn block" style={{ marginTop: 12 }} onClick={() => setPartitoChiuso(fatta.tag)}>
          Chiudi
        </button>
      </Box>
    )
  }

  if (!proposta) return null

  const inCorso = Boolean(invio?.inCorso)
  const errore = invio?.tag === proposta.tag ? invio.errore : null
  return (
    <Box titolo={`Versione ${numeroVersione(proposta.tag)} disponibile`} etichetta="Aggiornamento disponibile">
      <p className="muted small" style={{ margin: '6px 0 0' }}>
        Prima di aggiornare, ecco cosa cambia:
      </p>
      {proposta.note ? (
        <Changelog testo={String(proposta.note)} />
      ) : (
        <p className="muted small" style={{ marginTop: 10 }}>Le note di questa versione non sono arrivate.</p>
      )}
      {!url && <SceltaDallAreaClienti settings={settings} />}
      {errore && (
        <p role="alert" style={{ margin: '10px 0 0' }}>
          {errore}
        </p>
      )}
      {inCorso && <p className="muted small" style={{ margin: '10px 0 0' }}>{MESSAGGI_AGGIORNAMENTI.in_corso}</p>}
      <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
        {url && (
          <>
            <button className="btn block" disabled={inCorso} onClick={() => scegli(proposta.tag, SCELTE.AGGIORNA)}>
              Aggiorna
            </button>
            <button className="btn ghost block" disabled={inCorso} onClick={() => scegli(proposta.tag, SCELTE.SALTA)}>
              Salta questa versione
            </button>
          </>
        )}
        <button className="btn ghost block" onClick={() => setRimandata(proposta.tag)}>
          Più tardi
        </button>
      </div>
    </Box>
  )
}

// La stessa cornice del box delle novità (NovitaDialog). Senza chiusura
// toccando fuori: chiudere vuol dire «Più tardi», e va detto col tasto.
function Box({ titolo, etichetta, children }) {
  return (
    <div className="overlay confirm-overlay">
      <div
        className="confirm-box"
        role="dialog"
        aria-label={etichetta}
        style={{ width: 'min(520px, 94vw)', maxHeight: '82vh', overflowY: 'auto' }}
      >
        <h3 style={{ margin: 0 }}>{titolo}</h3>
        {children}
      </div>
    </div>
  )
}
