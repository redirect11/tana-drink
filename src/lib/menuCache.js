// Cache del menù a livello modulo: una sola sottoscrizione realtime viva
// per tutta la sessione, così navigando avanti/indietro il menù NON viene
// riscaricato a ogni mount (niente flash di caricamento). Un refresh
// forzato della pagina ricrea il modulo e riparte la sottoscrizione.
import { useEffect, useState } from 'react'
import { subscribeDrinks, subscribeCategories } from './api.js'

let drinks = []
let cats = []
let loaded = false
let started = false
const listeners = new Set()

function emit() {
  for (const l of listeners) l()
}

function start() {
  if (started) return
  started = true
  subscribeDrinks(
    { onlyAvailable: true },
    (d) => {
      drinks = d
      loaded = true
      emit()
    },
    () => {} // i listener Firestore ritentano da soli
  )
  subscribeCategories((c) => {
    cats = c
    emit()
  })
}

// Hook: restituisce { drinks, cats, loading } leggendo dalla cache di
// modulo. Al primo uso avvia la sottoscrizione; i mount successivi
// trovano subito i dati già in memoria.
export function useMenu() {
  const [, force] = useState(0)
  useEffect(() => {
    start()
    const l = () => force((n) => n + 1)
    listeners.add(l)
    return () => listeners.delete(l)
  }, [])
  return { drinks, cats, loading: !loaded }
}
