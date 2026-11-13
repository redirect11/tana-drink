// I CARATTERI DI UN'ANIMAZIONE, PRIMA DELL'ANIMAZIONE (BUG-141).
//
// Il ventaglio del mazzo (stile «Carte», MenuCarte.jsx) partiva appena le
// carte erano nella pagina, ma il carattere a macchina delle carte e del
// titolo arrivava qualche centinaio di millisecondi dopo: a metà volo la
// scritta passava dal carattere di riserva a quello vero, cambiava
// larghezza e andava a capo altrove, e il titolo saliva di un paio di pixel
// portandosi dietro il mazzo. L'utente, 11/11/2026: «le carte sfarfallano un
// po' quando si aprono a ventaglio quando si carica la pagina».
// L'animazione allora aspetta i caratteri che usa, ma non per sempre: con la
// rete lenta, o un carattere che non arriva, dopo `attesaMassima` parte
// comunque col carattere di riserva, che è meglio di un mazzo che non c'è.

// Le descrizioni da chiedere al browser («italic 400 16px "IM Fell
// English", Georgia»), una per carattere, senza doppioni. La misura non
// conta per il caricamento: conta famiglia, stile e peso.
export function caratteriDi(elementi, stileDi = (el) => getComputedStyle(el)) {
  const viste = new Set()
  for (const el of elementi || []) {
    const s = stileDi(el)
    if (!s?.fontFamily) continue
    viste.add(`${s.fontStyle || 'normal'} ${s.fontWeight || '400'} 16px ${s.fontFamily}`)
  }
  return [...viste]
}

// Risolve quando tutti i caratteri sono pronti, o dopo `attesaMassima`
// millisecondi. Non fallisce mai: un carattere che non si carica non deve
// fermare la pagina.
export function attendiCaratteri(fonts, descrizioni, attesaMassima = 1500) {
  if (!fonts?.load || !descrizioni?.length) return Promise.resolve()
  if (descrizioni.every((d) => safeCheck(fonts, d))) return Promise.resolve()
  const caricati = Promise.all(descrizioni.map((d) => fonts.load(d).catch(() => null))).then(() => undefined)
  const tetto = new Promise((r) => setTimeout(r, attesaMassima))
  return Promise.race([caricati, tetto])
}

// `check` lancia su una descrizione che non sa leggere: vale come «non pronto».
function safeCheck(fonts, descrizione) {
  try {
    return fonts.check?.(descrizione) === true
  } catch {
    return false
  }
}
