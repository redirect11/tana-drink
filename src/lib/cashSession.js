// Stato della SESSIONE DI CASSA condiviso a livello di modulo: una sola
// sottoscrizione viva per tutta l'app (come menuCache), così ogni schermata
// sa se la cassa è aperta senza aprirne una propria.
//
// Regola del locale (REQ-CASSA-017, 08/11/2026): senza cassa aperta gli
// ordini si battono — la serata a volte comincia prima che qualcuno conti
// il fondo — ma NON si incassa: un incasso senza sessione non finisce in
// nessuna chiusura. Prima era il contrario (niente ordini, incassi sì), e al
// banco si restava fermi col cliente davanti per aprire la cassa.
import { useEffect, useState } from 'react'
import { subscribeOpenCashSession } from './api.js'
import { impostaSessioneDiagnostica } from './diagnosticaStampante.js'

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
      // Il diario della stampante si intitola alla serata (REQ-STAMPA-019).
      impostaSessioneDiagnostica(s?.id || null)
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
