import { useEffect, useRef } from 'react'

// ── LE SOTTOSEZIONI DI UNA PAGINA, NELLA BARRA IN ALTO ───────────────
// Inventario e Impostazioni hanno le loro sezioni. Messe in pagina — file di
// tasti o barra a lato — costano una riga o una colonna, tutto il giorno,
// per una scelta che si fa ogni tanto. Messe nella barra costano zero: il
// TITOLO della pagina diventa il comando, con una freccia che dice «qui si
// cambia».
//
// La pagina le dichiara qui; la barra (App.jsx) le mostra. Sul telefono la
// barra non ha spazio per un elenco, quindi lì si apre il foglio dal basso —
// lo stesso di «⋯ Azioni», che al banco si conosce già.

const stato = { voci: [], attiva: null, scegli: null }
const subs = new Set()
const avvisa = () => subs.forEach((f) => f({ ...stato }))

export function subscribeSottosezioni(fn) {
  subs.add(fn)
  fn({ ...stato })
  return () => subs.delete(fn)
}

// Da usare nella pagina: dichiara le sue sezioni finché è montata.
// `voci`: [{ id, icona, label }]
//
// La funzione per cambiare sezione si tiene in un ref e non fra le
// dipendenze: le pagine la ricreano a ogni disegno, e siccome dichiararle
// fa ridisegnare la barra — che ridisegna la pagina — si girerebbe in tondo
// all'infinito. Si guardano gli id delle voci e la sezione attiva, che sono
// le uniche due cose che cambiano davvero.
export function useSottosezioni(voci, attiva, scegli) {
  const rif = useRef(scegli)
  rif.current = scegli
  const chiavi = (voci || []).map((v) => v.id).join('|')
  useEffect(() => {
    stato.voci = voci || []
    stato.attiva = attiva
    stato.scegli = (id) => rif.current?.(id)
    avvisa()
    return () => {
      stato.voci = []
      stato.attiva = null
      stato.scegli = null
      avvisa()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chiavi, attiva])
}

// Lo stesso, come componente: serve alle pagine che costruiscono le sezioni
// DOPO un'uscita anticipata (le impostazioni aspettano i dati dal server), e
// che quindi non possono chiamare un hook a quel punto.
export function Sottosezioni({ voci, attiva, scegli }) {
  useSottosezioni(voci, attiva, scegli)
  return null
}
