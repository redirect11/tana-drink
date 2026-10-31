/* global __DEMO__ */
// PRIMA DI TUTTO, e come primo import: le chiavi locali col prefisso
// vecchio si copiano su quello nuovo prima che un altro modulo le legga
// (lib/migrazioneAvvio.js spiega perché non basta chiamarla qui sotto).
import './lib/migrazioneAvvio.js'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
// I CARATTERI DELL'APP, DENTRO L'APP (REQ-SIC-004). Prima arrivavano da
// fonts.googleapis.com: ogni telefono che apriva il menù mandava a Google il
// proprio indirizzo IP, che per il GDPR è un dato personale, senza consenso
// (Landgericht München I, 20/01/2022, 3 O 17493/20). Da qui Vite li mette
// nel pacchetto e li serve dallo stesso indirizzo della pagina. Solo
// l'alfabeto latino, che copre l'italiano: gli altri non si scaricano.
import '@fontsource/playfair-display/latin-600.css'
import '@fontsource/playfair-display/latin-700.css'
import '@fontsource/playfair-display/latin-800.css'
import '@fontsource/playfair-display/latin-600-italic.css'
// Lo stile «Notte» del menù clienti (REQ-MENU-021).
import '@fontsource/italiana/latin-400.css'
import '@fontsource/jost/latin-300.css'
import '@fontsource/jost/latin-400.css'
import '@fontsource/jost/latin-500.css'
import '@fontsource/jost/latin-300-italic.css'
import './index.css'
import { initCookieConsent } from './lib/cookieConsent.js'
import { avviaProgressivi } from './lib/progressivi.js'


// basename per il router: ricavato dalla base di Vite (BASE_URL).
// Su Firebase Hosting il sito è servito dalla radice ("/"); su GitHub Pages
// sarebbe "/<repo>/". Normalizziamo togliendo l'eventuale slash finale.
const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/'

// Registra il service worker per la PWA (installabilità + notifiche).
// Solo in produzione: in sviluppo la cache del SW interferisce con Vite
// e con gli emulatori. In dev rimuove anche eventuali SW registrati prima.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    if (import.meta.env.PROD) {
      const swUrl = `${import.meta.env.BASE_URL}sw.js`
      navigator.serviceWorker.register(swUrl).catch(() => {
        /* registrazione service worker non disponibile: non bloccante */
      })
    } else {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => r.unregister())
      })
    }
  })
}

function parti() {
  // I NUMERI DEGLI ORDINI SI PRECARICANO. Battere un conto non deve
  // aspettare la rete: quale cassa è aperta e a che punto sono i
  // progressivi si tengono aggiornati da qui in avanti, così alla creazione
  // non si chiede niente a nessuno (vedi lib/progressivi.js).
  avviaProgressivi()

  // Banner informativo cookie (solo cookie tecnici, nessun consenso
  // richiesto). Non nella demo: non ha Analytics né altri servizi di terzi,
  // e quello che salva sta nel browser di chi prova.
  if (!__DEMO__) initCookieConsent().catch((e) => console.error('[CookieConsent]', e))

  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <BrowserRouter basename={basename}>
        <App />
      </BrowserRouter>
    </React.StrictMode>
  )
}

// LA DEMO (REQ-FLOTTA-019) carica i dati di prova nella cache PRIMA della
// prima schermata: così nessuna lista parte vuota. La rete del database è
// già spenta (firebaseClient.js). Il codice dei dati entra con `import()`
// solo nella build della demo.
if (__DEMO__) {
  import('./demo/avvio.js')
    .then((m) => m.avviaDemo())
    .catch((e) => console.error('[demo] dati di prova non caricati:', e))
    .finally(parti)
} else {
  parti()
}
