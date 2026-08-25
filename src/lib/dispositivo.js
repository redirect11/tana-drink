// ── CHI HA BATTUTO L'ORDINE: NON CHI, MA DA DOVE ─────────────────────
// Al banco lo stesso account sta su più terminali: il tablet della cassa, il
// telefono in sala, il portatile nel retro. Per decidere se avvisare di un
// ordine nuovo non basta sapere CHI l'ha battuto — serve sapere da QUALE
// dispositivo: chi l'ha appena mandato non ha bisogno di un avviso che gli
// dice quello che ha appena fatto, tutti gli altri sì.
//
// L'identificativo nasce alla prima volta e resta in memoria locale. Non
// identifica una persona: è un numero a caso che vale per questo browser.

const CHIAVE = 'tana:dispositivo'

let memoria = null // se localStorage non è disponibile, vale per la sessione

export function idDispositivo() {
  if (memoria) return memoria
  try {
    const salvato = localStorage.getItem(CHIAVE)
    if (salvato) {
      memoria = salvato
      return memoria
    }
  } catch {
    /* niente memoria locale: se ne genera uno buono per questa sessione */
  }
  const nuovo =
    globalThis.crypto?.randomUUID?.() ||
    `d${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`
  memoria = nuovo
  try {
    localStorage.setItem(CHIAVE, nuovo)
  } catch {
    /* resta in memoria */
  }
  return memoria
}

// L'ordine l'ho mandato io, da qui? Gli ordini battuti prima che esistesse
// questo campo non lo dicono: nel dubbio si avvisa, perché un avviso in più
// si chiude, uno in meno è un drink che non parte.
export function battutoDaQui(placedBy, id = idDispositivo()) {
  return !!placedBy?.device && placedBy.device === id
}

// L'ho annullato io, da qui? Come sopra: chi l'ha appena annullato non ha
// bisogno di un avviso che gli dica quello che ha appena fatto — tutti gli
// altri terminali sì. I conti annullati prima che esistesse questo campo
// non lo dicono: nel dubbio si avvisa.
export function annullatoDaQui(order, id = idDispositivo()) {
  return !!order?.cancelled_device && order.cancelled_device === id
}

// L'ho rimesso in piedi io, da qui? Un conto ripristinato rientra in coda e
// il banco lo deve sapere — tranne il terminale da cui è partito il gesto,
// che l'ha appena fatto. Stesso metro di `annullatoDaQui`, e per la stessa
// ragione: si ripristina quasi sempre dal conto, non dalla coda, quindi
// «l'ho premuto io» di quella schermata non basta.
export function ripristinatoDaQui(order, id = idDispositivo()) {
  return !!order?.ripristinato_device && order.ripristinato_device === id
}
