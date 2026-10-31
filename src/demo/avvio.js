// ── L'AVVIO DELLA DEMO (REQ-FLOTTA-019) ─────────────────────────────────
//
// Arriva qui solo la build della demo, con un `import()` dentro il ramo
// `if (__DEMO__)` di main.jsx: nelle build dei locali veri questo file, i
// dati di prova e il bundle non ci sono.
//
// Quando si arriva qui la rete del database è GIÀ spenta: lo fa
// firebaseClient.js appena crea Firestore, prima di qualunque lettura.
// Qui si caricano i dati di prova nella cache, come bundle, prima che
// l'app disegni la prima schermata.
//
// I dati sono generati relativi a un istante, che resta lo stesso per
// tutta la sessione: ricaricando la pagina il bundle è identico, Firestore
// lo riconosce e non lo ricarica, e il lavoro di chi prova (che sta sopra,
// come scritture in coda) resta com'è.

import { loadBundle } from 'firebase/firestore'
import { db } from '../lib/firebaseClient.js'
import { creaBundle } from './bundle.js'
import { datiDemo } from './dati.js'
import { butta } from './sessione.js'

const CHIAVE = 'drink:demo-dati'

function istanteDellaSessione(sessione, adesso) {
  try {
    const s = JSON.parse(localStorage.getItem(CHIAVE) || 'null')
    if (s && s.sessione === sessione && s.istante) return new Date(s.istante)
    localStorage.setItem(CHIAVE, JSON.stringify({ sessione, istante: adesso.toISOString() }))
  } catch {
    /* senza memoria: i dati si generano su adesso */
  }
  return adesso
}

export async function avviaDemo(adesso = new Date()) {
  const sessione = db.app.name
  const istante = istanteDellaSessione(sessione, adesso)
  const bundle = creaBundle({
    progetto: db.app.options.projectId,
    id: `dati-${sessione}`,
    creato: istante,
    documenti: datiDemo({ adesso: istante }),
  })
  await loadBundle(db, bundle)
  // Le cache delle sessioni passate (giornate vecchie, «Ricomincia da capo»)
  // si buttano dopo, senza farsi aspettare.
  butta(sessione)
}
