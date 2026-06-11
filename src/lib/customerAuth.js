// Account clienti: registrazione con verifica email, login (email o
// Google) e profilo su Firestore (customers/{uid}). Gli account cliente
// NON hanno claim di ruolo: nessun privilegio gestionale.
import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
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
import { getMyOrderIds } from './cart.js'
import { fetchOrdersByCustomer } from './api.js'

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

// Hook: true se il cliente ha almeno un ordine — su questo dispositivo
// (localStorage) o sul proprio account. Serve a mostrare «I miei ordini»
// solo quando c'è davvero qualcosa da rivedere.
export function useHasOrders() {
  const { user, loading } = useCustomer()
  const { pathname } = useLocation()
  // Riletto a ogni navigazione: dopo un ordine si passa a /ordine/:id.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const hasLocal = useMemo(() => getMyOrderIds().length > 0, [pathname])
  const [accountHas, setAccountHas] = useState(false)

  useEffect(() => {
    if (loading || !user) {
      setAccountHas(false)
      return
    }
    let active = true
    fetchOrdersByCustomer(user.uid, 1)
      .then((list) => {
        if (active) setAccountHas(list.length > 0)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [loading, user])

  return hasLocal || accountHas
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
