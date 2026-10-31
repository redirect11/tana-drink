/* global __DEMO__ */
// ── LA PORTA DEI DATI, ADATTATORE FIREBASE (REQ-FLOTTA-021) ───────────
//
// Fa quello che si è sempre fatto: Firestore, con la cache offline del
// client. Il contratto lo scrive la porta (src/porte/dati.js); qui c'è solo
// come lo si mantiene con Firebase.
//
// LE FUNZIONI DI FIRESTORE SI PRENDONO AL MOMENTO DELLA CHIAMATA, non al
// caricamento: chi nei test finge Firestore con un pezzo solo (un ascolto,
// una lettura) non deve fingere anche quello che non usa.
//
// Nessun `db` qui: lo dà la porta. Così i test di contratto passano a
// queste funzioni il database dell'emulatore, senza aprire l'app.
//
// LA DEMO (REQ-FLOTTA-019) lavora con la rete del database spenta per
// sempre, e due cose di Firestore lì non vanno:
//   - LE SCRITTURE non si confermano mai, perché la conferma la dà il
//     server. Si considerano fatte appena sono nella cache del browser
//     (confermaLocale.js);
//   - `getDoc` su un documento che NON ESISTE non risponde «non c'è»: va in
//     errore («the client is offline»), anche quando la cache lo sa. Provato
//     col vero SDK il 30/10/2026: un ascolto invece risponde subito, dalla
//     cache. Lì la lettura apre un ascolto, prende la prima risposta e lo
//     chiude.
// `__DEMO__` è una costante della build: nei locali veri vale `false`, e i
// due rami spariscono con confermaLocale.
import * as sdk from 'firebase/firestore'
import { confermaLocale } from './confermaLocale.js'

// ── Riferimenti e ricerche ────────────────────────────────────────────
export const collection = (...a) => sdk.collection(...a)
export const doc = (...a) => sdk.doc(...a)
export const query = (...a) => sdk.query(...a)
export const where = (...a) => sdk.where(...a)
export const orderBy = (...a) => sdk.orderBy(...a)
export const limit = (...a) => sdk.limit(...a)
export const startAfter = (...a) => sdk.startAfter(...a)

// ── Letture ───────────────────────────────────────────────────────────
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
export const getDocs = (...a) => sdk.getDocs(...a)
export const getDocFromCache = (...a) => sdk.getDocFromCache(...a)
export const getDocsFromCache = (...a) => sdk.getDocsFromCache(...a)
export const onSnapshot = (...a) => sdk.onSnapshot(...a)

// ── Scritture ─────────────────────────────────────────────────────────
let locali = null
const demo = () =>
  (locali ||= confermaLocale({
    setDoc: (...a) => sdk.setDoc(...a),
    updateDoc: (...a) => sdk.updateDoc(...a),
    deleteDoc: (...a) => sdk.deleteDoc(...a),
    writeBatch: (...a) => sdk.writeBatch(...a),
    doc: (...a) => sdk.doc(...a),
  }))

export const setDoc = (...a) => (__DEMO__ ? demo().setDoc(...a) : sdk.setDoc(...a))
export const updateDoc = (...a) => (__DEMO__ ? demo().updateDoc(...a) : sdk.updateDoc(...a))
export const addDoc = (...a) => (__DEMO__ ? demo().addDoc(...a) : sdk.addDoc(...a))
export const deleteDoc = (...a) => (__DEMO__ ? demo().deleteDoc(...a) : sdk.deleteDoc(...a))
export const writeBatch = (...a) => (__DEMO__ ? demo().writeBatch(...a) : sdk.writeBatch(...a))

// ── Valori speciali ───────────────────────────────────────────────────
export const serverTimestamp = () => sdk.serverTimestamp()
export const increment = (n) => sdk.increment(n)
export const arrayUnion = (...v) => sdk.arrayUnion(...v)
export const deleteField = () => sdk.deleteField()

// Le date per le ricerche. Un oggetto e non la classe di Firestore: l'app
// riconosce una data letta dal metodo `toDate`, non dalla classe (vedi
// toIso in api.js), e il client diretto ha comunque una classe sua.
export const Timestamp = Object.freeze({
  fromDate: (d) => sdk.Timestamp.fromDate(d),
  fromMillis: (ms) => sdk.Timestamp.fromMillis(ms),
  now: () => sdk.Timestamp.now(),
})
