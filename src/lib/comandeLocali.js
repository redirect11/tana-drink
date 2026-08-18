import { useCallback, useEffect, useState } from 'react'
import { firmaLavoro } from './comande.js'

// ── QUELLO CHE HO APPENA FATTO IO ────────────────────────────────────
//
// L'app è local-first: si tocca, si vede, e la scrittura parte in
// sottofondo. Fra il gesto e lo snapshot del server passa un istante — di
// più con la linea del locale, per sempre se si è offline — e in quell'
// istante lo schermo deve già raccontare quello che è appena successo. Al
// banco un gesto che non si vede subito è un gesto che si ripete: si preme
// due volte «Ritirato», si ribatte un conto, si divide una comanda già
// divisa.
//
// QUESTO POSTO È UNO SOLO, e prima erano tre: la coda teneva una copia
// delle comande, il conto tre pezzi separati (stati, comande appena nate,
// comande divise), il dettaglio della comanda altri due. Tre copie della
// stessa idea, e infatti si comportavano già in modo diverso — quella del
// conto sapeva mostrare una comanda nata da un minuto, quella della coda
// no, e chi batteva un conto e lo incassava non vedeva più il suo ticket.
//
// LA REGOLA È UNA: si tiene l'array `comande` come lo vede chi sta qui, per
// conto, e se ne va da sé quando il server racconta la stessa cosa. «La
// stessa cosa» si misura con la FIRMA DEL LAVORO (comande.js): i passi e le
// quantità, senza gli id — una comanda appena nata qui non ha ancora il
// nome che le darà il server. Si toglie solo allora, mai subito dopo la
// scrittura: quella risponde PRIMA dello snapshot, e toglierla lì farebbe
// riapparire per un battito lo stato di prima (il tasto «rimbalza»).

// Quante volte è stata creata una comanda provvisoria in questa sessione:
// serve solo a dare una chiave stabile a React finché non arriva quella
// vera. Non è un id: gli id li fa il server.
let contatoreProvvisorie = 0

export function comandaProvvisoria(campi) {
  contatoreProvvisorie += 1
  return { id: `__volo-${contatoreProvvisorie}`, provvisoria: true, ...campi }
}

export const provvisoria = (c) => c?.provvisoria === true || String(c?.id).startsWith('__volo-')

// `ordini` è la lista che arriva dal server: una sola voce va benissimo
// (il conto, la comanda), ed è da lì che si capisce quando lasciar
// perdere la copia locale.
export function useComandeLocali(ordini) {
  const [locali, setLocali] = useState({})

  // LA PULIZIA. Appena il server dice la stessa cosa, la copia locale non
  // serve più — e va tolta, o resterebbe a coprire per sempre quello che
  // succede altrove (un altro terminale che avanza la stessa comanda).
  const firme = (ordini || [])
    .filter(Boolean)
    .map((o) => `${o.id}=${firmaLavoro(o.comande)}`)
    .join(';')
  useEffect(() => {
    setLocali((m) => {
      if (Object.keys(m).length === 0) return m
      let next = m
      for (const o of ordini || []) {
        if (!o || !next[o.id]) continue
        if (firmaLavoro(o.comande) !== firmaLavoro(next[o.id])) continue
        if (next === m) next = { ...m }
        delete next[o.id]
      }
      return next
    })
    // Si guarda la FIRMA e non l'array: gli oggetti dal server sono nuovi a
    // ogni snapshot, e con quelli in dipendenza questo effetto girerebbe di
    // continuo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firme])

  // Le comande come le vede chi sta qui adesso.
  const comandeDi = useCallback(
    (order) => (order && locali[order.id]) || order?.comande || [],
    [locali]
  )

  // Lo stesso conto, con dentro le comande di adesso: comodo per chi passa
  // l'ordine intero a chi disegna (le corsie, il dettaglio).
  const conComande = useCallback(
    (order) => (order && locali[order.id] ? { ...order, comande: locali[order.id] } : order),
    [locali]
  )

  // Registra un gesto: `cambia` riceve le comande di adesso e torna quelle
  // dopo. Tornando null non si tocca niente.
  const applica = useCallback((order, cambia) => {
    if (!order?.id) return
    setLocali((m) => {
      const nuove = cambia(m[order.id] || order.comande || [])
      return nuove ? { ...m, [order.id]: nuove } : m
    })
  }, [])

  // La scrittura non è passata: si torna a quello che dice il server, che è
  // l'unica cosa vera. Lasciare la copia locale vorrebbe dire far preparare
  // al banco una divisione che sul conto non esiste.
  const scarta = useCallback((orderId) => {
    setLocali((m) => {
      if (!m[orderId]) return m
      const next = { ...m }
      delete next[orderId]
      return next
    })
  }, [])

  return { comandeDi, conComande, applica, scarta }
}
