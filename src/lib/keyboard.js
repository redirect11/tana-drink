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
  // Windows touch: readonly momentaneo per forzare la chiusura, poi ripristina.
  try {
    const wasReadonly = !!el.readOnly
    el.readOnly = true
    el.blur()
    setTimeout(() => {
      try {
        el.readOnly = wasReadonly
      } catch {
        /* ok */
      }
    }, 120)
  } catch {
    try {
      el.blur()
    } catch {
      /* ok */
    }
  }
}
