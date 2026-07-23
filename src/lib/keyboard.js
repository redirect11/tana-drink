// Chiusura della tastiera virtuale (touch) da codice.
//
// Su Android e iOS/iPadOS basta togliere il focus (blur). Su WINDOWS la
// tastiera touch spesso NON si chiude col solo blur: si chiude però se il
// campo diventa un istante non-editabile. Perciò rendiamo l'input `readonly`,
// facciamo blur, e ripristiniamo subito lo stato — così funziona ovunque.
export function dismissKeyboard(el) {
  if (!el || typeof el.blur !== 'function') return
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
