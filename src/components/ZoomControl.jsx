import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

// ZOOM DELLA PAGINA — due tasti, + e −, in basso a sinistra.
//
// Serve perché l'app gira su schermi molto diversi (iPad al banco, telefono
// in sala, monitor in ufficio) e chi ci lavora ha bisogno di stringere per
// vedere più roba o allargare per leggerla. Nella PWA a tutto schermo il
// browser il suo zoom non lo offre: senza questo non c'è modo di cambiarlo.
//
// COME: si scala `#root` con la proprietà `zoom`, non con transform, perché
// zoom rifà il layout invece di deformare un'immagine — testo e tasti
// restano nitidi e le aree cliccabili seguono. Il livello finisce anche in
// `--zoom` sul documento, così le schermate a tutta altezza (POS, dettaglio
// ordine) possono dividere i loro 100dvh e non sbordare da ingrandite.
//
// I tasti stanno FUORI da #root (portale sul body): altrimenti si
// rimpicciolirebbero insieme alla pagina, proprio mentre servono a chi non
// ci vede bene.

const CHIAVE = 'tana:zoom'
const MIN = 0.7
const MAX = 1.6
const PASSO = 0.1

const arrotonda = (z) => Math.round(z * 100) / 100
const leggi = () => {
  try {
    const v = Number(localStorage.getItem(CHIAVE))
    return Number.isFinite(v) && v >= MIN && v <= MAX ? v : 1
  } catch {
    return 1
  }
}

// `inline`: gli stessi tasti, ma DENTRO la pagina invece che flottanti
// nell'angolo. Sul telefono l'angolo in basso a sinistra è già occupato —
// ci finiscono sopra i tasti del conto — quindi lo zoom va messo dove c'è
// posto: in testata, di fianco allo stato del conto.
export default function ZoomControl({ inline = false }) {
  const [zoom, setZoom] = useState(leggi)

  useEffect(() => {
    const root = document.getElementById('root')
    if (root) root.style.zoom = zoom === 1 ? '' : String(zoom)
    document.documentElement.style.setProperty('--zoom', String(zoom))
    try {
      if (zoom === 1) localStorage.removeItem(CHIAVE)
      else localStorage.setItem(CHIAVE, String(zoom))
    } catch {
      /* niente memoria: lo zoom vale per questa sessione */
    }
  }, [zoom])

  const cambia = (d) => setZoom((z) => arrotonda(Math.min(MAX, Math.max(MIN, z + d))))

  const controllo = (
    <div
      className={`zoom-control${inline ? ' zoom-inline' : ''}`}
      role="group"
      aria-label="Zoom della pagina"
    >
      <button
        type="button"
        onClick={() => cambia(-PASSO)}
        disabled={zoom <= MIN}
        aria-label="Rimpicciolisci"
        title="Rimpicciolisci"
      >
        −
      </button>
      {/* Il livello è anche il tasto per tornare al 100%: senza, per rimettere
          le cose a posto bisognerebbe contare i tocchi. */}
      <button
        type="button"
        className="zoom-livello"
        onClick={() => setZoom(1)}
        disabled={zoom === 1}
        title="Torna al 100%"
      >
        {Math.round(zoom * 100)}%
      </button>
      <button
        type="button"
        onClick={() => cambia(PASSO)}
        disabled={zoom >= MAX}
        aria-label="Ingrandisci"
        title="Ingrandisci"
      >
        +
      </button>
    </div>
  )

  // Flottante: fuori da #root (portale sul body), altrimenti si
  // rimpicciolirebbe insieme alla pagina che sta scalando. In linea invece
  // sta dov'è scritto, e va bene così: è già dentro una testata che non
  // scala col contenuto.
  return inline ? controllo : createPortal(controllo, document.body)
}
