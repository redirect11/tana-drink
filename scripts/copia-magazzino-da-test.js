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
import { accessToken, client, clientEmulatore, arg, flag, idDi } from './lib-firestore.js'
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

  const emulatore = clientEmulatore(dove, DESTINAZIONE)

  for (const collezione of collezioni) {
    if (flag('pulisci')) {
      // Dei vecchi servono solo gli id: si cancellano, non si leggono.
      const vecchi = await emulatore.documenti(collezione, { campi: ['__name__'] })
      if (vecchi.length) {
        await emulatore.commit(vecchi.map((d) => emulatore.cancellaDoc(collezione, idDi(d))))
        console.log(`[copia] ${collezione}: tolti ${vecchi.length} documenti di prima`)
      }
    }

    const docs = await test.documenti(collezione)
    if (!docs.length) {
      console.log(`[copia] ${collezione}: niente da copiare`)
      continue
    }
    await emulatore.commit(docs.map((d) => emulatore.scriviDoc(collezione, idDi(d), d.fields)))
    console.log(`[copia] ${collezione}: copiati ${docs.length} documenti`)
  }

  console.log('[copia] ✓ fatto. Il magazzino dell\'emulatore adesso è quello di test.')
}

main().catch((e) => {
  console.error(`[copia] ${e.message}`)
  process.exit(1)
})
