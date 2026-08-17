import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'
import { initCookieConsent } from './lib/cookieConsent.js'
import { avviaProgressivi } from './lib/progressivi.js'

// I NUMERI DEGLI ORDINI SI PRECARICANO. Battere un conto non deve aspettare
// la rete: quale cassa è aperta e a che punto sono i progressivi si tengono
// aggiornati da qui in avanti, così alla creazione non si chiede niente a
// nessuno (vedi lib/progressivi.js).
avviaProgressivi()

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

// Banner informativo cookie (solo cookie tecnici, nessun consenso richiesto).
initCookieConsent().catch((e) => console.error('[CookieConsent]', e))

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename={basename}>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
