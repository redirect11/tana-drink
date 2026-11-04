// Cache del menù a livello modulo: una sola sottoscrizione realtime viva
// per tutta la sessione, così navigando avanti/indietro il menù NON viene
// riscaricato a ogni mount (niente flash di caricamento). Un refresh
// forzato della pagina ricrea il modulo e riparte la sottoscrizione.
import { useEffect, useState } from 'react'
import { subscribeDrinks, subscribeCategories, subscribeCarta } from './api.js'

let drinks = []
let cats = []
// La struttura del menù dei clienti (REQ-MENU-025): nella stessa cache, e
// il menù è pronto solo quando c'è anche lei. Senza aspettarla, il cliente
// di un locale che l'ha personalizzata vedrebbe per un istante le categorie
// del gestionale, con shot e voci-prezzo.
let carta = { sezioni: [], voci: [] }
let voci = false
let struttura = false
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
      voci = true
      loaded = struttura
      emit()
    },
    () => {} // i listener Firestore ritentano da soli
  )
  subscribeCategories((c) => {
    cats = c
    emit()
  })
  // Se la struttura non si può leggere, il menù si mostra lo stesso, per
  // categorie: meglio quello che la schermata «Carico il menù…» per sempre.
  const strutturaArrivata = () => {
    struttura = true
    loaded = voci
    emit()
  }
  subscribeCarta(
    (c) => {
      carta = c
      strutturaArrivata()
    },
    strutturaArrivata
  )
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
  return { drinks, cats, carta, loading: !loaded }
}
