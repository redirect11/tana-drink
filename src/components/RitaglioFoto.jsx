import { useEffect, useRef, useState } from 'react'
import { disposizione, fotoRitagliata, trattieni, zoomIniziale, zoomMinimo, ZOOM_MASSIMO } from '../lib/ritaglioFoto.js'

// IL RITAGLIO DELLA FOTO, NELLA SCHEDA DEL PRODOTTO (REQ-MENU-039). Flavio,
// 12/11/2026: «quando si carica la foto dovrebbe apparire il selezionatore
// della foto, in modo tale se la voglio… tagliare, ingrandire,
// rimpicciolire, e poi salvare le modifiche e poi dopo salvare proprio il
// prodotto». Una cornice quadrata con la foto dentro: si trascina col dito
// o col mouse, si ingrandisce col cursore, con la rotella o con due dita.
// «Usa questa foto» restituisce l'immagine ritagliata; caricarla è compito
// della scheda, quando si salva il prodotto, come prima.
//
// I conti stanno in lib/ritaglioFoto.js. Qui solo i gesti e il disegno.

// Il lato della cornice a schermo: sta su un telefono in verticale con i
// margini, e su uno schermo largo non diventa enorme.
const LATO_MASSIMO = 320

export default function RitaglioFoto({ file, onConferma, onAnnulla }) {
  const [url, setUrl] = useState(null)
  const [foto, setFoto] = useState({ larghezza: 0, altezza: 0 })
  const [posa, setPosa] = useState({ zoom: zoomMinimo, dx: 0, dy: 0 })
  const [lato, setLato] = useState(LATO_MASSIMO)
  const [preparo, setPreparo] = useState(false)
  const img = useRef(null)
  const cornice = useRef(null)
  // Le dita (o il mouse) appoggiate sulla cornice, per trascinare e per
  // ingrandire con due dita.
  const dita = useRef(new Map())
  const pizzico = useRef(null)

  useEffect(() => {
    const u = URL.createObjectURL(file)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [file])

  // La cornice prende la larghezza che c'è, fino al suo massimo.
  useEffect(() => {
    const el = cornice.current
    if (!el) return undefined
    const misura = () => setLato(Math.min(LATO_MASSIMO, el.parentElement?.clientWidth || LATO_MASSIMO))
    misura()
    window.addEventListener('resize', misura)
    return () => window.removeEventListener('resize', misura)
  }, [])

  const muovi = (cambio) => setPosa((p) => trattieni(foto, { ...p, ...cambio(p) }, lato))

  function caricata(e) {
    const f = { larghezza: e.currentTarget.naturalWidth, altezza: e.currentTarget.naturalHeight }
    setFoto(f)
    setPosa(trattieni(f, { zoom: zoomIniziale(f), dx: 0, dy: 0 }, lato))
  }

  function giu(e) {
    e.currentTarget.setPointerCapture?.(e.pointerId)
    dita.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (dita.current.size === 2) {
      const [a, b] = [...dita.current.values()]
      pizzico.current = { distanza: Math.hypot(a.x - b.x, a.y - b.y), zoom: posa.zoom }
    }
  }
  function sposta(e) {
    const prima = dita.current.get(e.pointerId)
    if (!prima) return
    const ora = { x: e.clientX, y: e.clientY }
    dita.current.set(e.pointerId, ora)
    if (dita.current.size === 2 && pizzico.current) {
      const [a, b] = [...dita.current.values()]
      const distanza = Math.hypot(a.x - b.x, a.y - b.y)
      const { distanza: d0, zoom: z0 } = pizzico.current
      if (d0 > 0) muovi(() => ({ zoom: (z0 * distanza) / d0 }))
      return
    }
    muovi((p) => ({ dx: p.dx + ora.x - prima.x, dy: p.dy + ora.y - prima.y }))
  }
  function su(e) {
    dita.current.delete(e.pointerId)
    if (dita.current.size < 2) pizzico.current = null
  }
  function rotella(e) {
    e.preventDefault()
    muovi((p) => ({ zoom: p.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08) }))
  }
  // La rotella si ascolta a mano, non con `onWheel`: React la registra come
  // passiva, e la pagina sotto scorrerebbe mentre si ingrandisce la foto.
  useEffect(() => {
    const el = cornice.current
    if (!el) return undefined
    el.addEventListener('wheel', rotella, { passive: false })
    return () => el.removeEventListener('wheel', rotella)
  })

  async function conferma() {
    setPreparo(true)
    // Se il browser non sa preparare la foto ritagliata, si tiene quella
    // scelta, intera: il ritaglio non deve impedire di salvare il prodotto.
    const ritagliata = img.current ? await fotoRitagliata(img.current, posa, lato) : null
    setPreparo(false)
    onConferma(ritagliata || file)
  }

  const d = disposizione(foto, posa, lato)
  return (
    <div className="overlay confirm-overlay" onClick={onAnnulla}>
      <div className="confirm-box ritaglio-foto" role="dialog" aria-label="Ritaglia la foto" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Ritaglia la foto</h3>
        <p className="muted small" style={{ margin: '0 0 10px' }}>
          Trascina la foto per inquadrarla; col cursore, la rotella o due dita si ingrandisce o si rimpicciolisce. La
          parte della cornice che resta vuota diventa bianca.
        </p>
        <div className="ritaglio-spazio">
          <div
            ref={cornice}
            className="ritaglio-cornice"
            style={{ width: lato, height: lato }}
            onPointerDown={giu}
            onPointerMove={sposta}
            onPointerUp={su}
            onPointerCancel={su}
            data-testid="cornice-ritaglio"
          >
            {url && (
              <img
                ref={img}
                src={url}
                alt=""
                draggable={false}
                onLoad={caricata}
                style={d ? { left: d.x, top: d.y, width: d.w, height: d.h } : { visibility: 'hidden' }}
              />
            )}
          </div>
        </div>
        <label htmlFor="ritaglio-zoom" className="small">
          Ingrandimento
        </label>
        <input
          id="ritaglio-zoom"
          type="range"
          min={zoomMinimo}
          max={ZOOM_MASSIMO}
          step="0.01"
          value={posa.zoom}
          onChange={(e) => muovi(() => ({ zoom: Number(e.target.value) }))}
        />
        <div className="row" style={{ gap: 10, marginTop: 12 }}>
          <button type="button" className="btn ghost grow" onClick={onAnnulla}>
            Annulla
          </button>
          <button type="button" className="btn grow" onClick={conferma} disabled={preparo || !d}>
            {preparo ? 'Preparo la foto…' : 'Usa questa foto'}
          </button>
        </div>
      </div>
    </div>
  )
}
