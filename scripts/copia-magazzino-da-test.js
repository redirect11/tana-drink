// =====================================================================
//  IL MAGAZZINO DI TEST, COPIATO NELL'EMULATORE.
//
//    node scripts/copia-magazzino-da-test.js            # copia
//    node scripts/copia-magazzino-da-test.js --pulisci  # svuota prima
//    node scripts/copia-magazzino-da-test.js --da tana-drink-test
//
//  I prodotti finti sono utili per provare una schermata, non per provare
//  un TRAVASO: quello va provato sui dati veri, con le stranezze che si
//  sono accumulate in due anni — il contenuto scritto senza misura, il
//  prodotto comprato al chilo e versato in centilitri, le giacenze sotto
//  zero. Qui il magazzino di `tana-drink-test` diventa il seed
//  dell'emulatore, e da lì in poi si prova col vero.
//
//  SI LEGGE DAL TEST, SI SCRIVE SOLO SULL'EMULATORE. La sorgente si può
//  cambiare con --da, ma la destinazione no: è l'emulatore e basta, e se
//  non risponde lo script si ferma. La produzione non compare in questo
//  file.
//
//  I documenti si copiano nel formato NATIVO di Firestore, senza
//  convertirli: un timestamp resta un timestamp e un intero non diventa un
//  decimale. Per questo si scrive sull'emulatore con la sua stessa API
//  REST (con «Bearer owner», che lì vuol dire «salta le regole»), invece
//  di passare dall'SDK admin e rimappare i campi a mano.
// =====================================================================
import { accessToken, client, arg, flag, idDi } from './lib-firestore.js'
import { trovaEmulatore } from './lib-emulatore.js'

const SORGENTE = arg('da', 'tana-drink-test')
const DESTINAZIONE = 'demo-tana-drink'
// Il magazzino non è solo gli articoli: senza categorie e fornitori le
// schede si aprono monche, e senza i movimenti la storia di un carico non
// c'è. `stock_movements` è la più grossa e la meno utile per provare il
// travaso: si porta solo con --movimenti.
const COLLEZIONI = ['inventory_items', 'inventory_categories', 'suppliers']

if (SORGENTE.startsWith('demo-')) {
  console.error('[copia] La sorgente è un progetto vero (test), non un emulatore.')
  process.exit(1)
}

async function main() {
  const dove = await trovaEmulatore()
  if (!dove) {
    console.error('[copia] Nessun emulatore Firestore in ascolto: avvialo con "npm run emulators".')
    process.exit(1)
  }
  const collezioni = flag('movimenti') ? [...COLLEZIONI, 'stock_movements'] : COLLEZIONI

  console.log(`[copia] Da ${SORGENTE} (sola lettura) a ${DESTINAZIONE} su ${dove}`)

  const token = await accessToken()
  const test = client(SORGENTE, token)

  const radice = `projects/${DESTINAZIONE}/databases/(default)/documents`
  const base = `http://${dove}/v1/${radice}`
  // «owner» è la parola che l'emulatore riconosce come «sono l'admin»:
  // senza, le regole di sicurezza bloccano anche la scrittura di servizio.
  const intestazioni = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }

  async function scrivi(writes) {
    for (let i = 0; i < writes.length; i += 200) {
      const res = await fetch(`http://${dove}/v1/${radice}:commit`, {
        method: 'POST',
        headers: intestazioni,
        body: JSON.stringify({ writes: writes.slice(i, i + 200) }),
      })
      const json = await res.json().catch(() => ({}))
      if (json.error) throw new Error(`${json.error.status}: ${json.error.message}`)
    }
  }

  async function documentiEmulatore(collezione) {
    const out = []
    let pageToken = ''
    do {
      const res = await fetch(
        `${base}/${collezione}?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`,
        { headers: intestazioni }
      )
      const json = await res.json().catch(() => ({}))
      if (json.error) throw new Error(`${json.error.status}: ${json.error.message}`)
      out.push(...(json.documents || []))
      pageToken = json.nextPageToken || ''
    } while (pageToken)
    return out
  }

  for (const collezione of collezioni) {
    if (flag('pulisci')) {
      const vecchi = await documentiEmulatore(collezione)
      if (vecchi.length) {
        await scrivi(vecchi.map((d) => ({ delete: `${radice}/${collezione}/${idDi(d)}` })))
        console.log(`[copia] ${collezione}: tolti ${vecchi.length} documenti di prima`)
      }
    }

    const docs = await test.documenti(collezione)
    if (!docs.length) {
      console.log(`[copia] ${collezione}: niente da copiare`)
      continue
    }
    await scrivi(
      docs.map((d) => ({
        update: { name: `${radice}/${collezione}/${idDi(d)}`, fields: d.fields || {} },
      }))
    )
    console.log(`[copia] ${collezione}: copiati ${docs.length} documenti`)
  }

  console.log('[copia] ✓ fatto. Il magazzino dell\'emulatore adesso è quello di test.')
}

main().catch((e) => {
  console.error(`[copia] ${e.message}`)
  process.exit(1)
})
