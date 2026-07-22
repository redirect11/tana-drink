import { useCallback, useEffect, useRef, useState } from 'react'

// Larghezza di una colonna RIDIMENSIONABILE dall'utente, ricordata in
// localStorage (per dispositivo: ogni schermo ha lo spazio suo). Usata per
// le colonne categorie e ordine del POS.
//
//   key:  chiave di persistenza
//   opts: { def, min, max, side } — `side` è il lato su cui sta la maniglia
//         ('right' per la colonna a sinistra, 'left' per quella a destra):
//         determina il verso del trascinamento.
const load = (key, def) => {
  try {
    const v = Number(localStorage.getItem(`tana:w:${key}`))
    return Number.isFinite(v) && v > 0 ? v : def
  } catch {
    return def
  }
}

export function useResizable(key, { def, min = 80, max = 640, side = 'right' } = {}) {
  const [width, setWidth] = useState(() => load(key, def))
  const drag = useRef(null)

  const clamp = useCallback((w) => Math.max(min, Math.min(max, w)), [min, max])

  const onPointerDown = useCallback(
    (e) => {
      e.preventDefault()
      try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* ok */ }
      drag.current = { startX: e.clientX, startW: width }
    },
    [width]
  )

  const onPointerMove = useCallback(
    (e) => {
      if (!drag.current) return
      const dx = e.clientX - drag.current.startX
      // Maniglia a destra: trascinando verso destra si allarga. A sinistra
      // (colonna sul lato destro dello schermo) è l'opposto.
      const next = clamp(drag.current.startW + (side === 'left' ? -dx : dx))
      setWidth(next)
    },
    [clamp, side]
  )

  const onPointerUp = useCallback(() => {
    if (!drag.current) return
    drag.current = null
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(`tana:w:${key}`, String(Math.round(width)))
    } catch {
      /* ok */
    }
  }, [key, width])

  // Props da mettere sulla maniglia (un div sottile fra le colonne).
  const handleProps = {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
    role: 'separator',
    'aria-orientation': 'vertical',
  }

  return { width, handleProps, setWidth }
}
