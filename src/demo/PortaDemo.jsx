import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { auth } from '../lib/firebaseClient.js'
import { RUOLI_DEMO } from './accesso.js'
import { prossimaSessione } from './sessione.js'
import './demo.css'

// ── LA PORTA DELLA DEMO (REQ-FLOTTA-019) ────────────────────────────────
//
// Avvolge le pagine dell'app, solo nella build della demo (App.jsx la
// carica con `import()` dentro `if (__DEMO__)`). Fa due cose:
//
// 1. Finché chi prova non ha scelto con che ruolo entrare, mostra la
//    scelta: titolare, bartender, sala, cliente. Niente password — la demo
//    non ha Firebase Auth, e il ruolo resta in questo browser.
// 2. Una fascia sempre visibile dice che è una demo coi dati di prova, che
//    quello che si fa resta in questo browser, e dà «Cambia ruolo» e
//    «Ricomincia da capo». Ricominciare butta il lavoro fatto: si chiede
//    conferma nella fascia stessa (il browser della demo non mostra i
//    `confirm()`), e poi si riparte da una cache nuova coi dati di prova.

const DESTINAZIONE = { admin: '/bar', bartender: '/bar', staff: '/bar', cliente: '/menu' }

function IngressoDemo({ onScegli }) {
  return (
    <section className="demo-ingresso" aria-labelledby="demo-ingresso-titolo">
      <h1 id="demo-ingresso-titolo">Prova l’app</h1>
      <p className="muted">
        Un locale di prova, con menù, magazzino, conti e incassi già pronti. Scegli con che ruolo entrare: ogni ruolo
        vede l’app come la vede chi lavora in quel posto. Si può cambiare in qualsiasi momento.
      </p>
      <div className="demo-ruoli">
        {RUOLI_DEMO.map((r) => (
          <button key={r.id} type="button" className="demo-ruolo" onClick={() => onScegli(r.id)}>
            <strong>{r.nome}</strong>
            <span className="muted">{r.desc}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

function FasciaDemo({ ruolo, onCambiaRuolo }) {
  const [chiede, setChiede] = useState(false)
  const nomeRuolo = RUOLI_DEMO.find((r) => r.id === ruolo)?.nome
  const ricomincia = () => {
    prossimaSessione()
    window.location.assign(window.location.origin + import.meta.env.BASE_URL)
  }
  return (
    <div className="demo-fascia" role="region" aria-label="Demo">
      {chiede ? (
        <>
          <span className="demo-fascia-testo">Tornano i dati di prova e si perde quello che hai fatto.</span>
          <span className="demo-fascia-tasti">
            <button type="button" className="demo-tasto forte" onClick={ricomincia}>
              Ricomincia
            </button>
            <button type="button" className="demo-tasto" onClick={() => setChiede(false)}>
              Annulla
            </button>
          </span>
        </>
      ) : (
        <>
          <span className="demo-fascia-testo">
            <strong>Demo con dati di prova</strong>
            <span className="demo-fascia-lungo">: quello che fai resta in questo browser</span>
            {nomeRuolo && <span className="demo-fascia-ruolo"> · {nomeRuolo}</span>}
          </span>
          <span className="demo-fascia-tasti">
            {ruolo && (
              <button type="button" className="demo-tasto" onClick={onCambiaRuolo}>
                <span className="demo-lungo">Cambia ruolo</span>
                <span className="demo-corto">Ruolo</span>
              </button>
            )}
            <button type="button" className="demo-tasto" onClick={() => setChiede(true)}>
              <span className="demo-lungo">Ricomincia da capo</span>
              <span className="demo-corto">Ricomincia</span>
            </button>
          </span>
        </>
      )}
    </div>
  )
}

export default function PortaDemo({ children }) {
  const navigate = useNavigate()
  const [ruolo, setRuolo] = useState(() => auth.ruoloScelto?.() || null)
  useEffect(() => auth.onAuthStateChanged(() => setRuolo(auth.ruoloScelto?.() || null)), [])
  // La fascia sposta in giù tutto quello che sta in cima: lo dice al foglio
  // di stile, che allarga la fascia di sistema (--safe-top) della sua altezza.
  useEffect(() => {
    document.body.classList.add('con-fascia-demo')
    return () => document.body.classList.remove('con-fascia-demo')
  }, [])
  const scegli = (r) => {
    auth.scegliRuolo(r)
    navigate(DESTINAZIONE[r] || '/')
  }
  const cambia = () => {
    auth.signOut()
    navigate('/')
  }
  return (
    <>
      <FasciaDemo ruolo={ruolo} onCambiaRuolo={cambia} />
      {ruolo ? children : <IngressoDemo onScegli={scegli} />}
    </>
  )
}
