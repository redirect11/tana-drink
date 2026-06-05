import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

// basename per il router: ricavato dalla base di Vite (BASE_URL).
// Su Firebase Hosting il sito è servito dalla radice ("/"); su GitHub Pages
// sarebbe "/<repo>/". Normalizziamo togliendo l'eventuale slash finale.
const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/'

// Registra il service worker per la PWA (installabilità + notifiche).
// Il path è relativo alla base del sito (BASE_URL).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const swUrl = `${import.meta.env.BASE_URL}sw.js`
    navigator.serviceWorker.register(swUrl).catch(() => {
      /* registrazione service worker non disponibile: non bloccante */
    })
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename={basename}>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
