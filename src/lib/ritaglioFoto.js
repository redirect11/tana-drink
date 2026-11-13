// ── IL RITAGLIO DELLA FOTO DI UN PRODOTTO (REQ-MENU-039) ──────────────────
//
// Flavio, 12/11/2026: tre foto prese da siti diversi uscivano nel menù di
// misure e inquadrature diverse, «serve un qualche cosa che mi permette di
// ritagliarle… tagliare, ingrandire, rimpicciolire», «all'interno della
// scheda del prodotto». Prima la foto si riduceva soltanto (storage.js) e
// ogni posto del menù la sistemava a modo suo: ritagliata a quadrato nella
// lista, intera con le bande nelle carte.
//
// Qui solo i conti, senza browser: come sta la foto nella cornice e cosa
// finisce nell'immagine salvata. La cornice è QUADRATA: va bene in tutti i
// posti del menù, ed è il solo numero da cambiare (LATO_SALVATO) se un
// giorno serve un'altra forma.
//
// Le misure: la foto ha `larghezza` e `altezza` vere; la cornice è un
// quadrato di `lato` px a schermo. `zoom` 1 vuol dire «la foto intera dentro
// la cornice»; `dx` e `dy` sono di quanto il centro della foto è spostato
// dal centro della cornice, in px a schermo.

// Il lato dell'immagine che si salva: abbastanza per lo schermo di un
// telefono, poco per lo spazio (storage.js la riduce solo sopra i 1200).
export const LATO_SALVATO = 1000
export const zoomMinimo = 1
export const ZOOM_MASSIMO = 8

// La foto riempie la cornice: il lato corto la tocca, quello lungo sborda.
// È il taglio più probabile, e si parte da lì.
export function zoomIniziale({ larghezza, altezza }) {
  if (!larghezza || !altezza) return zoomMinimo
  return Math.max(larghezza, altezza) / Math.min(larghezza, altezza)
}

// Dove sta la foto dentro la cornice (in px a schermo), o null se la foto
// non c'è ancora.
export function disposizione({ larghezza, altezza }, { zoom, dx, dy }, lato) {
  if (!larghezza || !altezza || !lato) return null
  const base = lato / Math.max(larghezza, altezza)
  const w = larghezza * base * zoom
  const h = altezza * base * zoom
  return { x: lato / 2 + dx - w / 2, y: lato / 2 + dy - h / 2, w, h }
}

// Lo zoom fra il minimo e il tetto, e lo spostamento che non fa scappare la
// foto: se sborda dalla cornice, i suoi bordi non ci entrano dentro (niente
// strisce bianche da un lato solo); se è più piccola, non ne esce.
export function trattieni(foto, { zoom, dx, dy }, lato) {
  const z = Math.min(ZOOM_MASSIMO, Math.max(zoomMinimo, zoom || zoomMinimo))
  const d = disposizione(foto, { zoom: z, dx: 0, dy: 0 }, lato)
  if (!d) return { zoom: z, dx: 0, dy: 0 }
  const limite = (misura) => Math.abs(misura - lato) / 2
  const entro = (v, m) => Math.max(-m, Math.min(m, v || 0))
  return { zoom: z, dx: entro(dx, limite(d.w)), dy: entro(dy, limite(d.h)) }
}

// Come disegnare la foto nell'immagine salvata: la stessa disposizione, alla
// scala dell'immagine finale.
export function versoLaFoto(foto, posa, lato, latoSalvato = LATO_SALVATO) {
  const d = disposizione(foto, posa, lato)
  if (!d) return null
  const k = latoSalvato / lato
  return { x: d.x * k, y: d.y * k, w: d.w * k, h: d.h * k }
}

// L'immagine ritagliata, pronta da caricare: un JPEG quadrato col fondo
// bianco dove la foto non arriva (rimpicciolita, o non quadrata). Torna null
// se il browser non sa farla: chi chiama tiene la foto intera, perché il
// ritaglio non deve mai impedire di salvare il prodotto.
export async function fotoRitagliata(img, posa, lato, latoSalvato = LATO_SALVATO) {
  try {
    const foto = { larghezza: img.naturalWidth, altezza: img.naturalHeight }
    const d = versoLaFoto(foto, posa, lato, latoSalvato)
    if (!d) return null
    const canvas = document.createElement('canvas')
    canvas.width = latoSalvato
    canvas.height = latoSalvato
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, latoSalvato, latoSalvato)
    ctx.drawImage(img, d.x, d.y, d.w, d.h)
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.88))
    return blob ? new File([blob], 'foto.jpg', { type: 'image/jpeg' }) : null
  } catch {
    return null
  }
}
