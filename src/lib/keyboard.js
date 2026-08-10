// Chiusura della tastiera virtuale (touch) da codice.
//
// Su Android e iOS/iPadOS basta togliere il focus (blur) e la tastiera si
// chiude: lì ci fermiamo a quello, senza effetti collaterali. Su WINDOWS il
// solo blur spesso NON chiude la tastiera touch; lì (e solo lì) si applica il
// rimedio di rendere il campo un istante `readonly`, che la fa chiudere, e poi
// si ripristina lo stato.

// Windows? (userAgentData quando c'è, altrimenti userAgent/platform).
const IS_WINDOWS =
  typeof navigator !== 'undefined' &&
  (navigator.userAgentData?.platform === 'Windows' ||
    /Windows|Win32|Win64/i.test(navigator.userAgent || navigator.platform || ''))

export function dismissKeyboard(el) {
  if (!el || typeof el.blur !== 'function') return
  // Android / iOS / iPadOS (e desktop non-Windows): solo blur.
  if (!IS_WINDOWS) {
    try {
      el.blur()
    } catch {
      /* ok */
    }
    return
  }
  // Windows touch: il blur da solo non chiude la tastiera. La si forza
  // spostando il focus su un input READONLY fuori schermo (che NON apre la
  // tastiera): l'editabile perde il focus e la tastiera si chiude. Poi si
  // rimuove il campo temporaneo.
  try {
    const tmp = document.createElement('input')
    tmp.readOnly = true
    tmp.tabIndex = -1
    tmp.setAttribute('aria-hidden', 'true')
    tmp.style.cssText =
      'position:fixed;bottom:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;border:0;padding:0;'
    document.body.appendChild(tmp)
    tmp.focus()
    el.blur()
    setTimeout(() => {
      try {
        tmp.blur()
        tmp.remove()
      } catch {
        /* ok */
      }
    }, 200)
  } catch {
    try {
      el.blur()
    } catch {
      /* ok */
    }
  }
}
