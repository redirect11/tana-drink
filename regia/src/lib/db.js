// ── TUTTO QUELLO CHE TOCCA FIREBASE NELLA REGIA ───────────────────────
// Un file solo, come api.js nell'app: le pagine non importano firebase.

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  onIdTokenChanged,
} from 'firebase/auth'
import { doc, setDoc, getDoc, onSnapshot, collection, getDocs, orderBy, query, updateDoc } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { auth, db, configurata, app } from './firebase.js'
import { nuovoCliente } from './clienti.js'
import { nuovaRichiesta, STATI } from './istanze.js'

const serve = () => {
  if (!configurata) throw new Error('La regia non è collegata a Firebase: mancano le variabili VITE_FIREBASE_*.')
}

// ── accesso ──
export function osservaUtente(cb) {
  if (!configurata) {
    cb(null)
    return () => {}
  }
  // Col token si legge il claim admin (REQ-FLOTTA-005).
  return onIdTokenChanged(auth, async (u) => {
    if (!u) return cb(null)
    const t = await u.getIdTokenResult()
    cb({ uid: u.uid, email: u.email, admin: t.claims.admin === true })
  })
}

export const osservaAccesso = (cb) => (configurata ? onAuthStateChanged(auth, cb) : (cb(null), () => {}))

export async function registra({ email, password, nomeLocale, contatto }) {
  serve()
  const cred = await createUserWithEmailAndPassword(auth, email, password)
  const cliente = nuovoCliente({ uid: cred.user.uid, email, nomeLocale, contatto })
  await setDoc(doc(db, 'clienti', cred.user.uid), cliente)
  return cliente
}

export async function accedi({ email, password }) {
  serve()
  await signInWithEmailAndPassword(auth, email, password)
}

export const esci = () => (configurata ? signOut(auth) : Promise.resolve())

// ── il cliente e la sua istanza ──
export function osservaCliente(uid, cb) {
  serve()
  return onSnapshot(doc(db, 'clienti', uid), (s) => cb(s.exists() ? s.data() : null))
}

export function osservaIstanza(slug, cb) {
  serve()
  return onSnapshot(doc(db, 'istanze', slug), (s) => cb(s.exists() ? s.data() : null))
}

export function osservaRichiesta(slug, cb) {
  serve()
  return onSnapshot(doc(db, 'richieste', slug), (s) => cb(s.exists() ? s.data() : null))
}

export async function chiediAttivazione(cliente) {
  serve()
  await setDoc(doc(db, 'richieste', cliente.slug), nuovaRichiesta(cliente))
}

// ── abbonamento (REQ-FLOTTA-007) ──
// La Function crea la sessione di Checkout di Stripe e risponde con l'url:
// il browser ci va, e al ritorno il webhook ha già aggiornato il cliente.
export async function avviaPagamento(scelta) {
  serve()
  const fn = httpsCallable(getFunctions(app, 'europe-west1'), 'creaCheckout')
  const { data } = await fn({ ...scelta, ritorno: window.location.origin })
  if (!data?.url) throw new Error('Il pagamento non è disponibile al momento: scrivici all’email del prodotto.')
  return data
}

// ── backoffice ──
export async function elencoClienti() {
  serve()
  const snap = await getDocs(query(collection(db, 'clienti'), orderBy('creato_il', 'desc')))
  return snap.docs.map((d) => d.data())
}

export async function elencoIstanze() {
  serve()
  const snap = await getDocs(collection(db, 'istanze'))
  return Object.fromEntries(snap.docs.map((d) => [d.id, d.data()]))
}

export async function elencoRichieste() {
  serve()
  const snap = await getDocs(collection(db, 'richieste'))
  return Object.fromEntries(snap.docs.map((d) => [d.id, d.data()]))
}

// L'admin segna un piano pagato a mano (finché Stripe non c'è, REQ-FLOTTA-007).
export async function segnaPiano(uid, { piano, moduli = [], terminali = 1 }) {
  serve()
  await updateDoc(doc(db, 'clienti', uid), {
    piano,
    moduli,
    terminali,
    abbonamento: { stato: 'attivo', origine: 'manuale', dal: new Date().toISOString() },
  })
}

// L'admin rilancia un'attivazione fallita: la richiesta torna in coda.
export async function rilanciaAttivazione(slug) {
  serve()
  const r = await getDoc(doc(db, 'richieste', slug))
  if (!r.exists()) throw new Error('Richiesta non trovata')
  await updateDoc(doc(db, 'richieste', slug), { stato: STATI.IN_CODA, rilanciata_il: new Date().toISOString() })
}
