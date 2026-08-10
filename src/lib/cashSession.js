// Stato della SESSIONE DI CASSA condiviso a livello di modulo: una sola
// sottoscrizione viva per tutta l'app (come menuCache), così ogni schermata
// sa se la cassa è aperta senza aprirne una propria.
//
// Regola del locale: senza cassa aperta NON si lavora — non si battono nuovi
// ordini. Gli ordini già aperti restano gestibili (si devono poter incassare
// e chiudere anche a cassa chiusa).
import { useEffect, useState } from 'react'
import { subscribeOpenCashSession } from './api.js'

let session = null
let loaded = false
let started = false
const listeners = new Set()

function emit() {
  for (const l of listeners) l()
}

function start() {
  if (started) return
  started = true
  subscribeOpenCashSession(
    (s) => {
      session = s
      loaded = true
      emit()
    },
    () => {} // il listener Firestore ritenta da solo
  )
}

// { session, open, loading } — `loading` finché non è arrivato il primo dato,
// così non si blocca il POS mostrando "cassa chiusa" prima di sapere.
export function useCashSession() {
  const [, force] = useState(0)
  useEffect(() => {
    const l = () => force((n) => n + 1)
    // Il listener si registra PRIMA di start(): se la sottoscrizione risponde
    // subito (cache Firestore già calda) l'emit non va perso.
    listeners.add(l)
    start()
    if (loaded) l() // dati già disponibili: allinea questo render
    return () => listeners.delete(l)
  }, [])
  return { session, open: !!session, loading: !loaded }
}
