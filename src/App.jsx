import { Routes, Route, Link, Navigate, useLocation } from 'react-router-dom'
import LandingPage from './pages/LandingPage.jsx'
import MenuPage from './pages/MenuPage.jsx'
import OrderStatusPage from './pages/OrderStatusPage.jsx'
import MyOrdersPage from './pages/MyOrdersPage.jsx'
import BartenderPage from './pages/BartenderPage.jsx'
import { AccediPage, RegistratiPage, ProfiloPage } from './pages/AccountPages.jsx'
import StaffProfilePage from './pages/StaffProfilePage.jsx'
import PosPage from './pages/PosPage.jsx'
import { useCustomer, useHasOrders } from './lib/customerAuth.js'
import { isFirebaseConfigured, auth } from './lib/firebaseClient.js'
import { isPersonale, isSala } from './lib/ruoli.js'
import { onAuthStateChanged } from 'firebase/auth'
import { subscribeSettings, DEFAULT_SETTINGS, clockIn, subscribePrinterConfig } from './lib/api.js'
import { savePrinterSettings } from './lib/printer.js'
import { dismissKeyboard } from './lib/keyboard.js'
import StatusBell from './components/StatusBell.jsx'
import { logoutStaff } from './lib/logout.js'
import { resolveThemeVars, applyTheme } from './lib/themes.js'
import { envLabel } from './dev/devActions.js'
import { openCookiePreferences } from './lib/cookieConsent.js'
import { subscribeUpdateAvailable } from './lib/appVersion.js'
import { useOnline } from './lib/useOnline.js'
import { toastSuccess } from './lib/toast.js'
import Toasts from './components/Toasts.jsx'
import ZoomControl from './components/ZoomControl.jsx'
import { useEffect, useRef, useState } from 'react'

export default function App() {
  const location = useLocation()
  const onBackoffice = location.pathname.startsWith('/bar')
  const { user, profile } = useCustomer()
  const hasOrders = useHasOrders()
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  useEffect(() => {
    if (!isFirebaseConfigured) return
    return subscribeSettings(setSettings)
  }, [])
  const accountsOn = settings.customer_accounts_enabled

  // Nuova versione online (la PWA resta aperta per giorni): banner
  // "tocca per aggiornare" invece di aspettare un reload manuale.
  const [updateReady, setUpdateReady] = useState(false)
  useEffect(() => subscribeUpdateAvailable(() => setUpdateReady(true)), [])

  // Tastiera virtuale: premendo Invio su un campo a riga singola FUORI da un
  // form (es. nome tavolo/note, che si salvano con un bottone) la si chiude,
  // togliendo il focus. Dentro un form si lascia il comportamento nativo
  // (submit di login, ricerca…), per non romperlo.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Enter' || e.shiftKey) return
      const el = document.activeElement
      if (!el || el.tagName !== 'INPUT') return
      const type = (el.getAttribute('type') || 'text').toLowerCase()
      const singleLine = ['text', 'search', 'tel', 'url', 'email', 'number', 'password'].includes(type)
      if (!singleLine || el.closest('form')) return
      dismissKeyboard(el) // chiude la tastiera virtuale (anche su Windows)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // Topbar apribile/chiudibile ovunque. Sulle schermate a tutto schermo
  // (coda, creazione/modifica ordine, pagamento) quando è aperta compare come
  // OVERLAY (fissa), senza spingere il contenuto: quelle schermate restano
  // interamente nel viewport.
  const [topbarOpen, setTopbarOpen] = useState(false)
  useEffect(() => {
    document.body.classList.toggle('topbar-open', topbarOpen)
    return () => document.body.classList.remove('topbar-open')
  }, [topbarOpen])

  // Config stampante: reidrata il localStorage dal server, così l'IP e le
  // preferenze non si perdono quando iPad/Safari svuota la cache (ITP).
  useEffect(() => {
    if (!isFirebaseConfigured) return
    return subscribePrinterConfig((cfg) => {
      if (!cfg) return
      const { updated_at, ...rest } = cfg // eslint-disable-line no-unused-vars
      savePrinterSettings(rest) // scrive solo in locale: nessun loop col server
    }, () => {})
  }, [])

  // Stato connessione: offline mostra un nastro; al ritorno un toast.
  const online = useOnline()
  const wasOffline = useRef(false)
  useEffect(() => {
    if (!online) wasOffline.current = true
    else if (wasOffline.current) {
      wasOffline.current = false
      toastSuccess('✅ Di nuovo online — sincronizzo le modifiche')
    }
  }, [online])

  // Staff loggato (bartender o collaboratore): nel topbar lato cliente
  // mostra il ruolo ed «Esci» al posto di «Accedi».
  const [staffRole, setStaffRole] = useState(null)
  const [staffName, setStaffName] = useState('')
  useEffect(() => {
    if (!isFirebaseConfigured) return
    return onAuthStateChanged(auth, async (u) => {
      if (!u) return setStaffRole(null)
      try {
        const token = await u.getIdTokenResult()
        const role = token.claims.role
        const isStaff = isPersonale(role)
        setStaffRole(isStaff ? role : null)
        const nome = u.displayName || String(u.email || '').split('@')[0]
        setStaffName(nome)
        // Badge virtuale: timbra l'entrata (idempotente, non duplica al
        // refresh). Best-effort: se fallisce non blocca l'accesso.
        if (isStaff) clockIn({ uid: u.uid, name: nome }).catch(() => {})
      } catch {
        setStaffRole(null)
      }
    })
  }, [])

  // Tema: le schermate del gestionale (/bar, POS cassa, dettaglio ordine e
  // menù usato dallo staff) seguono il tema staff; il resto quello cliente.
  // Il menù è una pagina cliente, ma lo staff ci passa per inserire ordini
  // manuali (la "vista cliente"): anche lì sta lavorando al bancone, quindi
  // deve vedere il tema del gestionale. Gli ordini per gruppo passano
  // invece dal POS (/pos?group=…), che è la schermata di lavoro.
  const staffSurface =
    onBackoffice ||
    location.pathname.startsWith('/pos') ||
    (!!staffRole && location.pathname.startsWith('/ordine')) ||
    (!!staffRole && location.pathname.startsWith('/menu'))
  useEffect(() => {
    const scope = staffSurface ? settings.theme_staff : settings.theme_client
    applyTheme(resolveThemeVars(scope))
  }, [settings, staffSurface])


  // Il ☰ apre lo StaffDrawer, che è montato solo nel gestionale e nel menù:
  // altrove (dettaglio ordine, POS) il tasto non avrebbe nessuno che risponde.
  const drawerHere =
    location.pathname.startsWith('/bar') || location.pathname.startsWith('/menu')

  return (
    <div className="app">
      {/* Mostra/nascondi la topbar ovunque (utile sulle schermate a tutto
          schermo, dove è nascosta). Da aperta è un overlay, non spinge nulla.
          La campanella (notifiche + sync) sta nella topbar: si richiama da qui. */}
      <button
        className={`topbar-toggle${topbarOpen ? ' open' : ''}`}
        onClick={() => setTopbarOpen((v) => !v)}
        aria-label={topbarOpen ? 'Nascondi barra' : 'Mostra barra'}
        title={topbarOpen ? 'Nascondi barra' : 'Mostra barra'}
      >
        {topbarOpen ? '▴' : '▾'}
      </button>
      {/* Ambiente non-produzione: solo una scritta piccola e discreta in un
          angolo (niente più nastro in alto), che non dà fastidio. In
          produzione non compare. */}
      {envLabel && (
        <div className="env-badge" aria-hidden>
          {envLabel === 'TEST' ? 'test version' : envLabel.toLowerCase()}
        </div>
      )}
      {!online && (
        <div className="offline-ribbon">
          📴 Offline — puoi continuare a lavorare, tutto si sincronizza al ritorno della connessione
        </div>
      )}
      {updateReady && (
        <button className="update-banner" onClick={() => window.location.reload()}>
          🔄 Nuova versione disponibile — tocca per aggiornare
        </button>
      )}
      {/* Notifiche IN APP (sync, ordini da staff/clienti, errori) */}
      <Toasts />
      {/* Zoom della pagina: nella PWA a tutto schermo il browser non lo offre */}
      <ZoomControl />
      <header className={`topbar${onBackoffice || staffRole ? ' backoffice' : ''}`}>
        {/* Menu laterale A SCOMPARSA ovunque: si apre da qui (il tasto
            flottante resta solo nelle schermate a tutto schermo, dove la
            topbar è nascosta). */}
        {staffRole && drawerHere && (
          <button
            className="topbar-burger"
            aria-label="Menu"
            title="Menu"
            onClick={() => window.dispatchEvent(new Event('tana:toggle-drawer'))}
          >
            ☰
          </button>
        )}
        {/* Nel gestionale il logo non porta al menu: resta sugli ordini. */}
        <Link
          to={onBackoffice ? '/bar' : '/'}
          className="brand"
          style={{ textDecoration: 'none', color: 'inherit' }}
        >
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" />
          <span>La Tana del Coniglio</span>
        </Link>
        <nav className="row">
          <StatusBell />
          {/* A tutto schermo ci va chi LAVORA sull'app per ore (banco, sala):
              al cliente che apre il menù dal telefono non serve, e in mezzo
              ai tasti era solo un'icona in più da capire. */}
          {staffRole && <FullscreenButton />}
          {onBackoffice ? (
            <>
              {staffRole && (
                <Link className="topbar-hello" to="/profilo-staff" style={{ textDecoration: 'none' }}>
                  {/* Sul telefono resta il solo ingranaggio: il saluto per
                      esteso mandava "Esci" fuori dallo schermo, e chi è
                      collegato lo dice già il menu laterale. */}
                  <span className="topbar-hello-testo">Ciao, {staffName} </span>⚙️
                </Link>
              )}
              <Link className="btn ghost small" to="/pos">🍸 POS</Link>
              {/* Per lo staff «Nuovo ordine» porta già al menu: niente doppione. */}
              {!isSala(staffRole) && (
                <Link className="btn ghost small solo-schermo-largo" to="/menu">
                  Vista cliente
                </Link>
              )}
            </>
          ) : isSala(staffRole) ? (
            // Staff nel menu (ordine manuale): solo il ritorno al servizio.
            // Saluto ed Esci stanno nel gestionale e nel drawer.
            <Link className="btn small" to="/bar">
              🫱 Torna al servizio
            </Link>
          ) : (
            <>
              {/* "I miei ordini" ha senso solo per il CLIENTE. Per lo staff/
                  bartender gli ordini aperti sono nella coda (/bar), non sono
                  ordini "suoi": niente schermata cliente. */}
              {hasOrders && !staffRole && (
                <Link className="btn ghost small" to="/ordini">I miei ordini</Link>
              )}
              {staffRole ? (
                <>
                  <Link className="btn ghost small" to="/bar">
                    🍸 Ciao, {staffName}
                  </Link>
                  <button className="btn ghost small" onClick={() => logoutStaff()}>
                    Esci
                  </button>
                </>
              ) : user ? (
                <Link className="btn ghost small" to="/profilo">
                  👤 Ciao, {profile?.nome || user.displayName?.split(' ')[0] || 'Profilo'}
                </Link>
              ) : accountsOn ? (
                <Link className="btn ghost small" to="/accedi">Accedi</Link>
              ) : null}
            </>
          )}
        </nav>
      </header>

      {(onBackoffice || !!staffRole) && <AddToHomeHint />}

      {!isFirebaseConfigured && (
        <div className="banner">
          ⚠️ Firebase non è configurato. Imposta <code>VITE_FIREBASE_API_KEY</code> e{' '}
          <code>VITE_FIREBASE_PROJECT_ID</code> (vedi <code>.env.example</code> e{' '}
          <code>firestore.rules</code>).
        </div>
      )}

      <main>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/menu" element={<MenuPage />} />
          <Route path="/ordini" element={<MyOrdersPage />} />
          <Route path="/ordine/:id" element={<OrderStatusPage />} />
          <Route path="/accedi" element={<AccediPage />} />
          <Route path="/registrati" element={<RegistratiPage />} />
          <Route path="/profilo" element={<ProfiloPage />} />
          <Route path="/profilo-staff" element={<StaffProfilePage />} />
          <Route path="/bar" element={<BartenderPage />} />
          <Route path="/pos" element={<PosPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <footer className="app-footer">
        {/* Social solo lato CLIENTE: nel gestionale sono spazio buttato — chi
            sta al bancone non apre Instagram dal footer del POS. */}
        {!staffSurface && (
          <div className="footer-social">
            {SOCIALS.map((s) => (
              <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label}>
                <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                  <path d={s.path} />
                </svg>
              </a>
            ))}
          </div>
        )}
        <a href={`${import.meta.env.BASE_URL}privacy-policy.html`}>Privacy</a>
        <a href={`${import.meta.env.BASE_URL}cookie-policy.html`} style={{ marginLeft: 14 }}>Cookie Policy</a>
        <button type="button" className="footer-link-btn" onClick={openCookiePreferences}>
          Preferenze cookie
        </button>
      </footer>
    </div>
  )
}

// Social del locale (stessi link della home del sito karaoke).
const SOCIALS = [
  {
    label: 'Instagram',
    href: 'https://www.instagram.com/latanadelconiglio_nola/',
    path: 'M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077',
  },
  {
    label: 'TikTok',
    href: 'https://www.tiktok.com/@latanadelconiglionola',
    path: 'M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z',
  },
  {
    label: 'Facebook',
    href: 'https://www.facebook.com/people/La-tana-del-coniglio/61558657110329/',
    path: 'M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z',
  },
  {
    label: 'Telegram',
    href: 'https://t.me/+TAnsOyWjRkhiMmRk',
    path: 'M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z',
  },
  {
    label: 'TripAdvisor',
    href: 'https://www.tripadvisor.it/Restaurant_Review-g580205-d27184530-Reviews-La_Tana_Del_Coniglio-Nola_Province_of_Naples_Campania.html',
    path: 'M12.006 4.295c-2.67 0-5.338.784-7.645 2.353H0l1.963 2.135a5.997 5.997 0 0 0 4.04 10.43 5.976 5.976 0 0 0 4.075-1.6L12 19.705l1.922-2.09a5.972 5.972 0 0 0 4.072 1.598 6 6 0 0 0 6-5.998 5.982 5.982 0 0 0-1.957-4.432L24 6.648h-4.35a13.573 13.573 0 0 0-7.644-2.353zM12 6.255c1.531 0 3.063.303 4.504.903C13.943 8.138 12 10.43 12 13.1c0-2.671-1.942-4.962-4.504-5.942A11.72 11.72 0 0 1 12 6.256zM6.002 9.157a4.059 4.059 0 1 1 0 8.118 4.059 4.059 0 0 1 0-8.118zm11.992.002a4.057 4.057 0 1 1 .003 8.115 4.057 4.057 0 0 1-.003-8.115zm-11.992 1.93a2.128 2.128 0 0 0 0 4.256 2.128 2.128 0 0 0 0-4.256zm11.992 0a2.128 2.128 0 0 0 0 4.256 2.128 2.128 0 0 0 0-4.256z',
  },
]

// Suggerimento (solo iPad/iPhone in Safari, non ancora installata): per lo
// schermo intero va aggiunta alla Home. Là l'API Fullscreen non esiste, quindi
// è l'unica strada. Chiudibile una volta per tutte.
function AddToHomeHint() {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem('tana:a2hs') === '1'
    } catch {
      return false
    }
  })
  if (dismissed) return null
  const standalone =
    window.navigator.standalone === true ||
    !!window.matchMedia?.('(display-mode: standalone)')?.matches
  const isIOS =
    /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const hasFsApi = !!document.documentElement.requestFullscreen
  // Mostra solo dove il tasto ⛶ non funziona (iOS Safari) e non è già installata.
  if (standalone || !isIOS || hasFsApi) return null
  const close = () => {
    setDismissed(true)
    try {
      localStorage.setItem('tana:a2hs', '1')
    } catch {
      /* privata/quota: pazienza */
    }
  }
  return (
    <div className="a2hs-hint">
      <span>
        Per lo schermo intero: tocca{' '}
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'text-bottom' }}>
          <path d="M12 3v12" />
          <path d="M8 7l4-4 4 4" />
          <path d="M6 12v7a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-7" />
        </svg>{' '}
        <strong>Condividi</strong> e poi <strong>“Aggiungi a Home”</strong>.
      </span>
      <button className="a2hs-x" onClick={close} aria-label="Chiudi">✕</button>
    </div>
  )
}

// Tasto schermo intero. L'API Fullscreen non c'è su iPad/Safari (solo per i
// video): lì il "fullscreen" è aggiungere la PWA alla Home (display standalone).
// Dove supportata (desktop/Android), entra/esce a schermo intero.
function FullscreenButton() {
  const [fs, setFs] = useState(() => typeof document !== 'undefined' && !!document.fullscreenElement)
  useEffect(() => {
    const on = () => setFs(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', on)
    return () => document.removeEventListener('fullscreenchange', on)
  }, [])
  const supported =
    typeof document !== 'undefined' && !!document.documentElement.requestFullscreen
  if (!supported) return null
  const toggle = () => {
    if (document.fullscreenElement) document.exitFullscreen?.()
    else document.documentElement.requestFullscreen?.().catch(() => {})
  }
  return (
    <button
      className="btn ghost small"
      onClick={toggle}
      title={fs ? 'Esci da schermo intero' : 'Schermo intero'}
      aria-label={fs ? 'Esci da schermo intero' : 'Schermo intero'}
    >
      {fs ? '🡼' : '⛶'}
    </button>
  )
}
