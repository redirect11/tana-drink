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
// COL DITO SERVE UNA PRESA VOLUTA. Col mouse si prende la maniglia e si
// trascina; col dito no: si sfiora di continuo mentre si scorre, e la
// colonna si allargava per sbaglio. Quindi al tocco la maniglia si "arma"
// solo tenendo premuto — poco, giusto il tempo di dire che è voluto — e se
// nel frattempo il dito scorre, non era una presa: si lascia perdere.
const PRESSIONE_LUNGA = 400 // ms
const SCARTO = 10 // px: oltre questo, prima dello scatto, è uno scorrimento

export function useResizable(key, { def, min = 80, max = 640, side = 'right', axis = 'x', speed = 1 } = {}) {
  const [width, setWidth] = useState(() => load(key, def))
  // `attivo` serve alla maniglia per farsi vedere quando ha preso: senza
  // un segnale, tenere premuto è un gesto al buio.
  const [attivo, setAttivo] = useState(false)
  const drag = useRef(null)

  const clamp = useCallback((w) => Math.max(min, Math.min(max, w)), [min, max])

  const onPointerDown = useCallback(
    (e) => {
      const dito = e.pointerType === 'touch'
      try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* ok */ }
      const pos = axis === 'y' ? e.clientY : e.clientX
      const info = { start: pos, ultimo: pos, startW: width, armato: !dito, timer: null }
      if (dito) {
        info.timer = setTimeout(() => {
          info.armato = true
          info.start = info.ultimo // si parte da dove il dito è ADESSO
          info.startW = width
          navigator.vibrate?.(12) // "l'ho presa": il dito non vede il colore
          setAttivo(true)
        }, PRESSIONE_LUNGA)
      } else {
        e.preventDefault()
        setAttivo(true)
      }
      drag.current = info
    },
    [width, axis]
  )

  const onPointerMove = useCallback(
    (e) => {
      const d0 = drag.current
      if (!d0) return
      const pos = axis === 'y' ? e.clientY : e.clientX
      d0.ultimo = pos
      if (!d0.armato) {
        // Il dito si è spostato prima dello scatto: stava scorrendo.
        if (Math.abs(pos - d0.start) > SCARTO) {
          clearTimeout(d0.timer)
          drag.current = null
        }
        return
      }
      e.preventDefault()
      const d = pos - d0.start
      // 'right'/'down' → in avanti allarga; 'left'/'up' → l'opposto.
      const dir = side === 'left' || side === 'up' ? -1 : 1
      const next = clamp(d0.startW + dir * d * speed)
      setWidth(next)
    },
    [clamp, side, axis, speed]
  )

  const onPointerUp = useCallback(() => {
    if (drag.current?.timer) clearTimeout(drag.current.timer)
    drag.current = null
    setAttivo(false)
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

  return { width, handleProps, setWidth, attivo }
}
