// ── LA PORTA DEI DATI (REQ-FLOTTA-021) ────────────────────────────────
//
// Tutto quello che l'app legge e scrive nel database passa da qui, e da
// nessun'altra parte (tests/unit/confineFirebase.test.js). Dietro c'è un
// adattatore: oggi solo quello di Firebase (src/adattatori/firebase/),
// domani anche quello dell'installazione on premise
// (docs/porte-e-adattatori.md).
//
// I NOMI SONO QUELLI DI FIRESTORE, apposta: sono centinaia di chiamate in
// api.js, e rinominarle tutte sarebbe una riscrittura di massa che non
// porta niente. Quello che conta è il CONFINE: la porta offre SOLO quello
// che l'app usa, e un altro adattatore deve fare solo questo. Le prove
// stanno in tests/contratto/dati.js, scritte sulla porta e non su Firebase.
//
// IL CONTRATTO
//
// Riferimenti e ricerche
//   collection(db, nome) · doc(db, collezione, id) · doc(collezione) con
//   l'id scelto in locale · query(collezione, ...vincoli) con
//   where(campo, op, valore) — op: == != < <= > >= in array-contains —,
//   orderBy(campo, 'asc'|'desc'), limit(n), startAfter(valore)
//   Un riferimento ha `id`.
//
// Letture
//   getDoc(ref) → { id, ref, exists(), data() }; data() è undefined se il
//     documento non c'è
//   getDocs(ricerca) → { docs, empty, size, forEach }
//   getDocFromCache / getDocsFromCache: lo stesso, solo da quello che il
//     dispositivo ha già; se non ce l'ha, la promessa fallisce
//   onSnapshot(ref o ricerca, aggiornamento, errore) → smetti(). La prima
//     risposta arriva subito da quello che il dispositivo sa, le altre a
//     ogni cambio, anche delle scritture di questo dispositivo
//
// Scritture
//   setDoc(ref, dati, { merge }) · updateDoc(ref, patch) — il documento
//   deve esistere — · addDoc(collezione, dati) → ref · deleteDoc(ref) ·
//   writeBatch(db) → { set, update, delete, commit() }: tutte o nessuna
//
//   PRESA IN CARICO E ARRIVATA SONO DUE COSE DIVERSE, e l'app le usa tutte
//   e due. Una scrittura è PRESA IN CARICO nell'istante della chiamata:
//   ogni lettura e ogni ascolto che vengono dopo, su questo dispositivo, la
//   vedono già, anche senza rete. La promessa che la chiamata restituisce
//   dice quando è ARRIVATA al server: si risolve alla sua conferma, e
//   fallisce se il server la rifiuta (un permesso che manca); in quel caso
//   il dispositivo torna a quello che c'era. Il banco non aspetta mai la
//   promessa (bgWrite, lib/sync.js); il gestionale sì, dove un rifiuto va
//   detto.
//
// Valori speciali, dentro i dati di una scrittura
//   serverTimestamp() — l'ora del server; prima della conferma vale null
//   nelle letture ·
//   increment(n) · arrayUnion(...valori) · deleteField()
//
// Date
//   Timestamp.fromDate(d) · .fromMillis(ms) · .now(), per scrivere e
//   cercare. Una data letta ha toDate() e toMillis(): si riconosce da
//   quelli, non dalla classe.
//
// Fuori dal giro di una serata
//   cercaDalServer(collezione, { dove, ordina }) → documenti: una ricerca
//   dritta al server, senza la cache del dispositivo, per le consultazioni
//   (BUG-117). Senza rete fallisce, e chi chiama ripiega su getDocs.
//
// E il database: `db`, da passare a collection, doc e writeBatch.

export {
  collection,
  doc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDoc,
  getDocs,
  getDocFromCache,
  getDocsFromCache,
  onSnapshot,
  setDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  increment,
  arrayUnion,
  deleteField,
  Timestamp,
} from '../adattatori/firebase/dati.js'
export { cercaDalServer } from '../adattatori/firebase/diretto.js'
export { db } from '../lib/firebaseClient.js'
