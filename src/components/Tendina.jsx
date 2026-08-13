import { useEffect, useRef, useState } from 'react'

// ── MENU A TENDINA ───────────────────────────────────────────────────
// Un tasto che apre un pannello. Serve dove le scelte sono tante e stanno
// ferme quasi sempre: i filtri del magazzino erano sette pastiglie sempre
// aperte, una riga di schermo occupata tutto il giorno per una scelta che si
// cambia due volte a sera.
//
// Si chiude toccando fuori o con Esc, e il tasto dice COSA è scelto adesso:
// una tendina che non lo dice costringe ad aprirla per ricordarselo.
export default function Tendina({ etichetta, riassunto, attivo = false, largo = 260, children }) {
  const [aperta, setAperta] = useState(false)
  const rif = useRef(null)

  useEffect(() => {
    if (!aperta) return undefined
    const fuori = (e) => {
      if (!rif.current?.contains(e.target)) setAperta(false)
    }
    const esc = (e) => {
      if (e.key === 'Escape') setAperta(false)
    }
    document.addEventListener('pointerdown', fuori)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', fuori)
      document.removeEventListener('keydown', esc)
    }
  }, [aperta])

  return (
    <div className="tendina" ref={rif}>
      <button
        type="button"
        className={`chip tendina-tasto${attivo ? ' active' : ''}`}
        aria-expanded={aperta}
        onClick={() => setAperta((v) => !v)}
        title={etichetta}
      >
        {riassunto || etichetta} <span aria-hidden className="tendina-freccia">▾</span>
      </button>
      {aperta && (
        <div className="tendina-pannello" style={{ width: largo }} role="dialog" aria-label={etichetta}>
          {typeof children === 'function' ? children(() => setAperta(false)) : children}
        </div>
      )}
    </div>
  )
}
