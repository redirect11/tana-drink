// INGRESSO PER /design-sync — non fa parte dell'app.
//
// Tana Drink è un'applicazione, non una libreria: `package.json` non esporta
// niente e `npm run build` produce il bundle del sito. Il convertitore ha
// bisogno di un modulo che ri-esporti per nome i componenti da pubblicare su
// claude.ai/design, e questo è quel modulo.
//
// Cosa NON entra qui: tutto ciò che tira dentro `lib/firebaseClient.js`
// (BackupPanel, DrinkForm, PasswordChanger, PaymentPanel). Firebase si
// inizializza al caricamento del modulo: dentro un'anteprima senza
// configurazione l'inizializzazione salta e porta giù l'intero bundle, non
// solo la scheda di quel componente.

import { useLayoutEffect } from 'react'
import { MemoryRouter } from 'react-router-dom'

// Dialoghi e menu
export { default as ConfirmDialog } from '../src/components/ConfirmDialog.jsx'
export { default as ActionSheet } from '../src/components/ActionSheet.jsx'
export { default as CancelOrderDialog } from '../src/components/CancelOrderDialog.jsx'
export { default as NovitaDialog } from '../src/components/NovitaDialog.jsx'
export { StoriaOrdineDialog, RipristinaOrdineDialog } from '../src/components/StoriaOrdine.jsx'

// Cassa
export { DrinkTile } from '../src/components/PosBits.jsx'
export { default as CategoryRail } from '../src/components/CategoryRail.jsx'

// Navigazione
export { default as Tendina } from '../src/components/Tendina.jsx'
export { default as SectionPanels } from '../src/components/SectionPanels.jsx'

// Stato dell'app
// (VersionBadge resta fuori: legge __APP_VERSION__ e __GIT_*, che esistono
// solo nella build Vite. Fuori di lì l'etichetta è vuota e il componente
// ritorna null — nel bundle non disegnerebbe niente, mai.)
export { default as Toasts } from '../src/components/Toasts.jsx'
// Lo store dei toast viaggia col bundle: chi disegna con Toasts deve poter
// mandare un messaggio dalla stessa copia a cui la pila è iscritta. Importato
// a parte, ne nascerebbe una seconda, e i messaggi non arriverebbero.
export { showToast, toastSync, toastSuccess, toastError, dismissToast } from '../src/lib/toast.js'
export { default as StatusBell } from '../src/components/StatusBell.jsx'
export { default as ZoomControl } from '../src/components/ZoomControl.jsx'

// Impostazioni e informazioni
export { default as ThemeSettings } from '../src/components/ThemeSettings.jsx'
export { default as Changelog } from '../src/components/Changelog.jsx'

// Rendiconto
export { default as RendicontoSerata } from '../src/components/RendicontoSerata.jsx'

// Icone (SVG monocromatiche, seguono `currentColor` e la scala del testo)
export * from '../src/components/Icons.jsx'

// CONTORNO DELLE ANTEPRIME — due cose, e nessuna delle due è un componente.
//
//  · Il router. StatusBell usa <Link>: fuori da un Router lancia. MemoryRouter
//    non dà fastidio a nessun altro.
//  · Il fondo scuro sul <body>. Nei disegni veri ci pensa styles.css, che si
//    porta dentro tutto src/index.css — body compreso. Le SCHEDE di anteprima
//    no: il loro modello scrive `background:#fff` dopo il foglio di stile e
//    vince. Su fondo bianco il testo dell'app (quasi bianco) sparisce, e
//    l'overlay dei dialoghi resta imprigionato nel riquadro invece di coprire
//    la pagina, tagliandone il titolo. Rimettere il fondo al suo posto
//    sistema tutte e due le cose in un colpo solo.
//
// L'altezza minima serve ai componenti che disegnano solo in `position: fixed`
// o in un portale (toast, zoom flottante): senza, la radice resta alta zero e
// il controllo del render la scambia per una scheda vuota.
const FONDO =
  'radial-gradient(900px 500px at 85% -10%, rgba(245, 185, 74, 0.07), transparent 60%),' +
  'radial-gradient(700px 420px at -10% 25%, rgba(229, 46, 113, 0.06), transparent 60%),' +
  'linear-gradient(170deg, var(--bg), var(--bg-2))'

export function AnteprimaProvider({ children }) {
  useLayoutEffect(() => {
    const b = document.body
    b.style.background = FONDO
    b.style.backgroundAttachment = 'fixed'
    b.style.color = 'var(--text)'
    b.style.minHeight = '100vh'
  }, [])
  return (
    <MemoryRouter>
      <div style={{ minHeight: 64 }}>{children}</div>
    </MemoryRouter>
  )
}
