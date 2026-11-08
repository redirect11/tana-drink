// Cache del menù a livello modulo: una sola sottoscrizione realtime viva
// per tutta la sessione, così navigando avanti/indietro il menù NON viene
// riscaricato a ogni mount (niente flash di caricamento). Un refresh
// forzato della pagina ricrea il modulo e riparte la sottoscrizione.
import { useEffect, useState } from 'react'
import { subscribeDrinks, subscribeCategories, subscribeCarta } from './api.js'

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

// IL CATALOGO SI PRECARICA DALLA CODA (BUG-137). La sottoscrizione partiva
// solo aprendo il primo conto: su un dispositivo appena entrato, se la rete
// cadeva prima, il conto si apriva con la griglia vuota e non si batteva
// niente. L'ha trovato il primo test di sistema
// (tests/sistema/serataSenzaRete.spec.js). Parte dalla coda e non
// dall'avvio dell'app perché il catalogo serve a chi batte i conti: a un
// cliente che segue il suo ordine costerebbe letture inutili.
export function precaricaMenu() {
  start()
}

// LA STRUTTURA DEL MENÙ DEI CLIENTI (REQ-MENU-025), in una cache sua che
// parte solo dove serve: il menù del tavolo. Non nella cache del menù,
// perché quella la usa anche il conto al banco (OrderPosDetail), che della
// struttura non sa che farsene: ascolterebbe sezioni e voci, le
// aspetterebbe al primo caricamento e si ridisegnerebbe a ogni ritocco
// fatto nell'editor. Il menù del cliente invece la aspetta: senza, in un
// locale che l'ha personalizzata, il cliente vedrebbe per un istante le
// categorie del gestionale, con shot e voci-prezzo.
let carta = { sezioni: [], voci: [] }
let cartaPronta = false
let cartaAvviata = false
const ascoltaCarta = new Set()

function avviaCarta() {
  if (cartaAvviata) return
  cartaAvviata = true
  // Se la struttura non si può leggere, il menù si mostra lo stesso, per
  // categorie: meglio quello che la schermata «Carico il menù…» per sempre.
  const arrivata = () => {
    cartaPronta = true
    for (const l of ascoltaCarta) l()
  }
  subscribeCarta((c) => {
    carta = c
    arrivata()
  }, arrivata)
}

export function useStrutturaMenu() {
  const [, force] = useState(0)
  useEffect(() => {
    avviaCarta()
    const l = () => force((n) => n + 1)
    ascoltaCarta.add(l)
    return () => ascoltaCarta.delete(l)
  }, [])
  return { carta, pronta: cartaPronta }
}
