// Account clienti: registrazione con verifica email, login (email o
// Google) e profilo su Firestore (customers/{uid}). Gli account cliente
// NON hanno claim di ruolo: nessun privilegio gestionale.
import { useEffect, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  signOut,
} from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db } from './firebaseClient.js'

const customerDoc = (uid) => doc(db, 'customers', uid)

export async function registerCustomer({ nome, cognome, birthDate, email, password }) {
  const cred = await createUserWithEmailAndPassword(auth, email, password)
  await updateProfile(cred.user, { displayName: `${nome} ${cognome}`.trim() })
  await setDoc(customerDoc(cred.user.uid), {
    nome,
    cognome,
    birth_date: birthDate,
    email,
    created_at: new Date().toISOString(),
  })
  await sendEmailVerification(cred.user).catch(() => {})
  return cred.user
}

export function loginCustomer(email, password) {
  return signInWithEmailAndPassword(auth, email, password)
}

// Login Google: al primo accesso crea il profilo dal displayName
// (data di nascita da completare poi dal profilo).
export async function loginWithGoogle() {
  const cred = await signInWithPopup(auth, new GoogleAuthProvider())
  const ref = customerDoc(cred.user.uid)
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    const [nome = '', ...rest] = (cred.user.displayName || '').split(' ')
    await setDoc(ref, {
      nome,
      cognome: rest.join(' '),
      birth_date: null,
      email: cred.user.email,
      created_at: new Date().toISOString(),
    })
  }
  return cred.user
}

export function resetPassword(email) {
  return sendPasswordResetEmail(auth, email)
}

export function resendVerification() {
  if (!auth.currentUser) return Promise.resolve()
  return sendEmailVerification(auth.currentUser)
}

export function logoutCustomer() {
  return signOut(auth)
}

export async function fetchCustomerProfile(uid) {
  const snap = await getDoc(customerDoc(uid))
  return snap.exists() ? snap.data() : null
}

export async function updateCustomerProfile(uid, data) {
  await setDoc(customerDoc(uid), data, { merge: true })
}

// Hook: utente CLIENTE corrente (null per anonimi e per lo staff).
// { user, profile, loading }
export function useCustomer() {
  const [state, setState] = useState({ user: null, profile: null, loading: true })

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (!u) return setState({ user: null, profile: null, loading: false })
      try {
        const token = await u.getIdTokenResult()
        if (token.claims.role === 'bartender' || token.claims.role === 'staff') {
          // Lo staff non è un cliente.
          return setState({ user: null, profile: null, loading: false })
        }
        const profile = await fetchCustomerProfile(u.uid).catch(() => null)
        setState({ user: u, profile, loading: false })
      } catch {
        setState({ user: u, profile: null, loading: false })
      }
    })
  }, [])

  return state
}

// Messaggi di errore Firebase Auth in italiano.
export function authError(code) {
  const map = {
    'auth/email-already-in-use': 'Esiste già un account con questa email.',
    'auth/invalid-email': 'Email non valida.',
    'auth/weak-password': 'Password troppo debole (minimo 6 caratteri).',
    'auth/invalid-credential': 'Email o password non corretti.',
    'auth/wrong-password': 'Email o password non corretti.',
    'auth/user-not-found': 'Nessun account con questa email.',
    'auth/too-many-requests': 'Troppi tentativi: riprova tra qualche minuto.',
    'auth/network-request-failed': 'Errore di rete: controlla la connessione.',
    'auth/popup-closed-by-user': 'Accesso annullato.',
  }
  return map[code] || 'Errore di autenticazione. Riprova.'
}
