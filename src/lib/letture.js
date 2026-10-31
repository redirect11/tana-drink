/* global __DEMO__ */
// ── LA LETTURA DI UN DOCUMENTO PASSA DA QUI ───────────────────────────
//
// Nei locali veri è `getDoc` di Firestore: chiede al server, e senza rete
// ripiega sulla cache.
//
// Nella DEMO la rete del database è spenta per sempre (REQ-FLOTTA-019), e
// `getDoc` a rete spenta su un documento che NON ESISTE non risponde «non
// c'è»: va in errore («the client is offline»), anche quando la cache sa
// benissimo che non c'è. Provato col vero SDK il 30/10/2026: a rete spenta
// un ascolto (`onSnapshot`) invece risponde subito, dalla cache, «c'è» o
// «non c'è». Qui la lettura apre un ascolto, prende la prima risposta e lo
// chiude: stesso risultato di `getDoc`, senza errori finti.
//
// Nella build di un locale vero `__DEMO__` vale `false` e resta `getDoc`.
// Come in scritture.js, le funzioni di Firestore si prendono al momento
// della chiamata: un test che finge Firestore a pezzi non si rompe.
import * as sdk from 'firebase/firestore'

export function letturaDallaCache(ref) {
  return new Promise((risolvi, rifiuta) => {
    const smetti = sdk.onSnapshot(
      ref,
      (snap) => {
        smetti()
        risolvi(snap)
      },
      rifiuta
    )
  })
}

export const getDoc = (...a) => (__DEMO__ ? letturaDallaCache(...a) : sdk.getDoc(...a))
