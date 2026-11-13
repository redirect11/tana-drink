// =====================================================================
//  L'AMBIENTE DEI TEST END-TO-END: si prepara, si prova, si svuota.
//
//  I test end-to-end dei casi d'uso (REQ-DEV-019) girano su un progetto
//  Firebase VERO, dedicato a loro e a nient'altro: `drinkpos-prova-e2e`,
//  generato una volta dal Terraform dell'istanza della regia. A ogni giro
//  (.github/workflows/e2e.yml) ci si pubblicano regole, Functions e app su
//  un canale d'anteprima, lo si semina, si fanno girare i test e poi lo si
//  svuota: dati, utenze, canale e Functions. Il progetto resta, vuoto.
//
//  Perché un progetto fisso e non uno nuovo a ogni giro (l'utente,
//  09/11/2026, «facciamo la prima»): senza un'Organizzazione Google un
//  service account non crea progetti, l'account di fatturazione ne regge
//  cinque, e un progetto eliminato resta trenta giorni in cancellazione
//  col nome bruciato. `tana-drink-test` resta al cliente, per validare.
//
//  QUI SI CANCELLA UN DATABASE INTERO. Per questo ogni funzione passa da
//  `progettoE2e`, che rifiuta tutto quello che non è un progetto di prova:
//  un nome sbagliato in una variabile non deve poter svuotare il test del
//  cliente, né tanto meno la produzione.
// =====================================================================
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { initializeApp, getApps, applicationDefault } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'
import { SEED_UTENTI } from '../src/dev/seedData.js'
import { scriviSeManca, erroreLicenzaIniziale } from './lib-licenza-iniziale.js'
import { MODULI_PREMIUM } from '../src/lib/licenza.js'

// I progetti della flotta si chiamano `drinkpos-<slug>` e quelli di prova
// hanno lo slug che comincia con `prova-` (drink-regia, infra/README.md).
const PROGETTO_DI_PROVA = /^drinkpos-prova-[a-z0-9-]+$/
// I nomi che non si toccano in nessun caso, anche se un giorno qualcuno
// rinominasse le cose in modo da farli passare dalla regola sopra.
const INTOCCABILI = ['tana-drink', 'tana-drink-test', 'drink-regia', 'drink-regia-test']

export function progettoE2e(progetto, { credenziali = process.env.GOOGLE_APPLICATION_CREDENTIALS } = {}) {
  const p = String(progetto || '').trim()
  if (!p) throw new Error('[e2e] manca il progetto (E2E_PROGETTO)')
  if (INTOCCABILI.includes(p) || !PROGETTO_DI_PROVA.test(p)) {
    throw new Error(`[e2e] ${p} non è un progetto di prova (drinkpos-prova-…): qui non si svuota niente`)
  }
  // La chiave deve essere DI QUEL progetto: una chiave di un altro
  // progetto, col nome giusto nella variabile, scriverebbe altrove.
  if (credenziali) {
    let suo
    try {
      suo = JSON.parse(readFileSync(credenziali, 'utf8')).project_id
    } catch {
      throw new Error(`[e2e] la chiave ${credenziali} non si legge`)
    }
    if (suo !== p) throw new Error(`[e2e] la chiave è del progetto ${suo}, non di ${p}`)
  }
  return p
}

function admin(progetto) {
  const nome = `e2e-${progetto}`
  const app = getApps().find((a) => a.name === nome) ||
    initializeApp({ projectId: progetto, credential: applicationDefault() }, nome)
  return { db: getFirestore(app), auth: getAuth(app) }
}

export function databaseE2e(progetto) {
  return admin(progettoE2e(progetto)).db
}

// Tutto il database, sottoraccolte comprese, e tutte le utenze.
export async function svuotaE2e(progetto) {
  const p = progettoE2e(progetto)
  const { db, auth } = admin(p)
  for (const raccolta of await db.listCollections()) await db.recursiveDelete(raccolta)
  let pagina
  do {
    const elenco = await auth.listUsers(1000, pagina)
    if (elenco.users.length) await auth.deleteUsers(elenco.users.map((u) => u.uid))
    pagina = elenco.pageToken
  } while (pagina)
}

// Lo stesso seme dello sviluppo e dei test di sistema (scripts/seed.js:
// menù, magazzino, impostazioni), più un'utenza per ruolo e la licenza.
//
// LE UTENZE NON HANNO LA PASSWORD DEL SEME. seed.js sul progetto vero non
// le crea apposta — una password scritta in un file versionato è una porta
// aperta — e il canale d'anteprima, per quanto scada, è un indirizzo
// pubblico. La password arriva da E2E_PASSWORD, un segreto dell'environment
// «e2e» su GitHub, come per i test della regia.
export async function seminaE2e(progetto, { password = process.env.E2E_PASSWORD } = {}) {
  const p = progettoE2e(progetto)
  if (!password || String(password).length < 12) {
    throw new Error('[e2e] E2E_PASSWORD manca o è più corta di 12 caratteri')
  }
  // seed.js vuole la configurazione web per capire dove scrivere: gli si
  // passa il progetto e una chiave segnaposto, perché scrive con l'Admin
  // SDK e la chiave web non la usa.
  execFileSync(process.execPath, ['scripts/seed.js', '--force'], {
    stdio: 'ignore',
    env: {
      ...process.env,
      VITE_USE_FIREBASE_EMULATOR: 'false',
      VITE_FIREBASE_PROJECT_ID: p,
      VITE_FIREBASE_API_KEY: process.env.VITE_FIREBASE_API_KEY || 'e2e',
    },
  })
  const { db, auth } = admin(p)
  for (const u of SEED_UTENTI) {
    const utente = await auth.createUser({ email: u.email, password, displayName: u.nome })
    await auth.setCustomUserClaims(utente.uid, { role: u.role })
  }
  // La licenza passa dallo stesso controllo del deploy, come nella semina
  // dei test di sistema (REQ-LIC-009: senza, le regole fermano tutto).
  const licenza = JSON.parse(readFileSync('clienti/tana/licenza-iniziale.json', 'utf8'))
  const errore = erroreLicenzaIniziale(licenza, Object.keys(MODULI_PREMIUM))
  if (errore) throw new Error(`[e2e] clienti/tana/licenza-iniziale.json: ${errore}`)
  await scriviSeManca(db.doc('licenza/attuale'), licenza)
}
