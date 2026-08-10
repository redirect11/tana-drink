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

// `axis`: 'x' (larghezza, default) o 'y' (per una maniglia orizzontale che
// controlla un valore verticale/una scala). `speed`: quanti "punti" per pixel
// trascinato (per una scala serve <1 per non essere ipersensibili). `side`
// determina il verso: 'right'/'down' aumentano trascinando in avanti,
// 'left'/'up' l'opposto.
export function useResizable(key, { def, min = 80, max = 640, side = 'right', axis = 'x', speed = 1 } = {}) {
  const [width, setWidth] = useState(() => load(key, def))
  const drag = useRef(null)

  const clamp = useCallback((w) => Math.max(min, Math.min(max, w)), [min, max])

  const onPointerDown = useCallback(
    (e) => {
      e.preventDefault()
      try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* ok */ }
      drag.current = { start: axis === 'y' ? e.clientY : e.clientX, startW: width }
    },
    [width, axis]
  )

  const onPointerMove = useCallback(
    (e) => {
      if (!drag.current) return
      const d = (axis === 'y' ? e.clientY : e.clientX) - drag.current.start
      // 'right'/'down' → in avanti allarga; 'left'/'up' → l'opposto.
      const dir = side === 'left' || side === 'up' ? -1 : 1
      const next = clamp(drag.current.startW + dir * d * speed)
      setWidth(next)
    },
    [clamp, side, axis, speed]
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
    'aria-orientation': axis === 'y' ? 'horizontal' : 'vertical',
  }

  return { width, handleProps, setWidth }
}
