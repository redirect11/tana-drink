// =====================================================================
//  DOVE STA L'EMULATORE, senza doverlo dire ogni volta.
//
//  Gli script di seed e di dati finti scrivevano su `localhost:8080`,
//  scritto a mano dentro package.json. Ma su questa macchina la 8080 è
//  occupata da un altro programma, e l'emulatore gira sulla 8081
//  (firebase.collaudo.json): gli script partivano, non trovavano niente e
//  restavano appesi — e chi riavviava l'emulatore si ritrovava il
//  database a metà senza capire perché.
//
//  Qui la porta si CERCA invece di darla per scontata: prima quella
//  chiesta a mano, poi quelle scritte nelle configurazioni di Firebase
//  che stanno nel progetto. Vince la prima che risponde.
// =====================================================================
import { readFileSync } from 'node:fs'

// Le porte scritte nelle configurazioni del progetto, in ordine: prima
// quella del collaudo (che è quella che si usa quando la 8080 è presa),
// poi quella normale.
function portePreviste() {
  const porte = []
  for (const file of ['firebase.collaudo.json', 'firebase.json']) {
    try {
      const cfg = JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'))
      const p = cfg?.emulators?.firestore?.port
      if (p && !porte.includes(p)) porte.push(p)
    } catch {
      /* configurazione assente: si prova la prossima */
    }
  }
  if (!porte.includes(8080)) porte.push(8080)
  return porte
}

// L'emulatore Firestore risponde a una GET sulla radice. Un secondo basta
// e avanza: è in locale, o c'è o non c'è.
async function risponde(host, porta) {
  try {
    const res = await fetch(`http://${host}:${porta}/`, {
      signal: AbortSignal.timeout(1000),
    })
    return res.ok
  } catch {
    return false
  }
}

// Ritorna `host:porta` dell'emulatore vivo, o null se non ne risponde
// nessuno. Chi chiama decide se fermarsi o proseguire.
export async function trovaEmulatore() {
  const host = process.env.VITE_FIRESTORE_EMULATOR_HOST || 'localhost'
  // Chiesta a mano: si usa quella e basta, senza cercare — se uno la
  // scrive è perché sa dove sta il suo emulatore.
  const chiesta = process.env.VITE_FIRESTORE_EMULATOR_PORT
  if (chiesta) return `${host}:${chiesta}`
  for (const porta of portePreviste()) {
    if (await risponde(host, porta)) return `${host}:${porta}`
  }
  return null
}

// Imposta FIRESTORE_EMULATOR_HOST per l'SDK admin e ritorna dove punta.
// Se non trova niente si ferma qui: uno script che scrive «fatto» senza
// aver scritto niente è peggio di uno che non parte.
export async function puntaAllEmulatore(etichetta = 'script') {
  if (process.env.FIRESTORE_EMULATOR_HOST) return process.env.FIRESTORE_EMULATOR_HOST
  const dove = await trovaEmulatore()
  if (!dove) {
    console.error(
      `[${etichetta}] Nessun emulatore Firestore in ascolto (provate le porte ${portePreviste().join(', ')}).\n` +
        `[${etichetta}] Avvialo con "npm run emulators" — o dimmi dov'è con VITE_FIRESTORE_EMULATOR_PORT.`
    )
    process.exit(1)
  }
  process.env.FIRESTORE_EMULATOR_HOST = dove
  return dove
}
