/* global __APP_VERSION__ */
import { useEffect, useState } from 'react'
import Changelog from './Changelog.jsx'
import { scegliAggiornamento, subscribeSceltaAggiornamento } from '../lib/api.js'
import { recordNotif } from '../lib/notifyStore.js'
import { isAdmin } from '../lib/ruoli.js'
import {
  MESSAGGI_AGGIORNAMENTI,
  MODALITA,
  SCELTE,
  avvisoDaMostrare,
  avvisoVisto,
  dataAvviso,
  modalitaAggiornamenti,
  numeroVersione,
  propostaDaMostrare,
  segnaAvvisoVisto,
} from '../lib/aggiornamenti.js'

const VERSIONE = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : ''
const INFORMAZIONI = '/bar?tab=impostazioni&sezione=informazioni'

// LA SCELTA GIÀ FATTA (REQ-FLOTTA-020), per chi è titolare e solo in
// modalità «a scelta»: agli altri il documento è chiuso dalle regole, e
// ascoltarlo vorrebbe dire un errore di permessi a ogni apertura. Arriva
// dalla cache: la scelta appena scritta da qui si vede subito.
export function useSceltaAggiornamento(settings, ruolo) {
  const [scelta, setScelta] = useState(null)
  const ascolta = isAdmin(ruolo) && modalitaAggiornamenti(settings) === MODALITA.A_SCELTA
  useEffect(() => {
    if (!ascolta) {
      setScelta(null)
      return undefined
    }
    return subscribeSceltaAggiornamento(setScelta)
  }, [ascolta])
  return scelta
}

// I BOX DELLA REGIA, montati da App: prima l'avviso delle condizioni, poi
// la proposta di aggiornamento. Uno alla volta, e mai sopra il box delle
// novità (`inPausa`), che è quello di un aggiornamento appena arrivato.
export default function PropostaAggiornamento({ settings, ruolo, inPausa = false }) {
  const scelta = useSceltaAggiornamento(settings, ruolo)
  const [visto, setVisto] = useState(avvisoVisto)
  // «Più tardi»: il box torna alla prossima apertura dell'app, non prima.
  const [rimandata, setRimandata] = useState(null)
  // Il titolare ha toccato «Aggiorna»: il box resta aperto un momento per
  // dire cosa succede adesso.
  const [chiesta, setChiesta] = useState(null)

  const avviso = avvisoDaMostrare(settings, { ruolo, visto })
  const proposta = propostaDaMostrare(settings, { ruolo, versione: VERSIONE, scelta, rimandata })

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

  if (chiesta) {
    return (
      <Box titolo={`Versione ${numeroVersione(chiesta)}`} etichetta="Aggiornamento chiesto">
        <p style={{ margin: '10px 0 0' }}>{MESSAGGI_AGGIORNAMENTI.chiesto}</p>
        <button className="btn block" style={{ marginTop: 12 }} onClick={() => setChiesta(null)}>
          Chiudi
        </button>
      </Box>
    )
  }

  if (!proposta) return null

  const scegli = (cosa) => {
    scegliAggiornamento(proposta.tag, cosa)
    if (cosa === SCELTE.AGGIORNA) setChiesta(proposta.tag)
  }
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
      <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
        <button className="btn block" onClick={() => scegli(SCELTE.AGGIORNA)}>
          Aggiorna
        </button>
        <button className="btn ghost block" onClick={() => scegli(SCELTE.SALTA)}>
          Salta questa versione
        </button>
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
