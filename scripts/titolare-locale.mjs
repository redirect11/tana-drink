// =====================================================================
//  IL TITOLARE DI UN LOCALE ESISTENTE: LO STESSO ACCOUNT DELLA REGIA
//  (REQ-FLOTTA-029)
//
//    node scripts/titolare-locale.mjs --project tana-drink-test \
//         --uid <uid nella regia> --email flavio@example.it            # dice cosa farebbe
//    node scripts/titolare-locale.mjs ... --applica                    # lo fa
//    node scripts/titolare-locale.mjs ... --emulator --applica         # sull'emulatore
//
//  Per i locali della flotta lo fa da sola la regia a ogni deploy
//  (drink-regia, scripts/titolare-istanza.mjs). I locali esistenti, come
//  la Tana, i workflow della regia li saltano: questo script fa la stessa
//  cosa a mano, con la stessa regola (scripts/lib-titolare.js). L'uid è
//  quello di clienti/{uid} nella regia (backoffice, scheda del locale).
//
//  Senza --applica non scrive niente: dice solo cosa farebbe. Sulla Tana
//  il caso atteso è «resta quello»: Flavio ha già il suo account, usato,
//  con un uid diverso, e un account usato non si cancella mai.
//
//  Le credenziali sono la sessione del Firebase CLI (`firebase login`),
//  come scripts/set-role.js: chi lo lancia deve poter amministrare Auth nel
//  progetto (roles/firebaseauth.admin, o proprietario). Niente password:
//  se serve, Firebase manda l'email per impostarla.
// =====================================================================
import { accessToken, arg, flag } from './lib-firestore.js'
import { emailTitolare, uidTitolare, pianoTitolare, daRest } from './lib-titolare.js'

const EMULATOR = flag('emulator')
const APPLICA = flag('applica')
// Nessun progetto per difetto: la produzione si nomina a mano (CLAUDE.md).
const PROGETTO = arg('project') || (EMULATOR ? 'demo-tana-drink' : null)
const EMAIL = emailTitolare(arg('email'))
const UID = uidTitolare(arg('uid', ''))
if (!PROGETTO || !EMAIL || UID === null) {
  console.error('Uso: node scripts/titolare-locale.mjs --project <id> --email <email> [--uid <uid della regia>] [--applica] [--emulator]')
  process.exit(1)
}

const HOST = EMULATOR ? `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST || 'localhost:9099'}/identitytoolkit.googleapis.com` : 'https://identitytoolkit.googleapis.com'
const h = { Authorization: `Bearer ${EMULATOR ? 'owner' : await accessToken()}`, 'Content-Type': 'application/json' }
async function chiama(percorso, corpo) {
  const j = await (await fetch(`${HOST}/v1/projects/${PROGETTO}/${percorso}`, { method: 'POST', headers: h, body: JSON.stringify(corpo) })).json()
  if (j.error) throw new Error(`${percorso}: ${j.error.message}`)
  return j
}
const cerca = async (chiave) => daRest((await chiama('accounts:lookup', chiave)).users?.[0])

const [perUid, perEmail] = await Promise.all([UID ? cerca({ localId: [UID] }) : null, cerca({ email: [EMAIL] })])
const cosa = pianoTitolare({ uid: UID, email: EMAIL, perUid, perEmail })
for (const a of cosa.avvisi) console.log(`⚠️  ${a}`)
const descrizione = {
  crea: `creare l’account ${EMAIL}${cosa.uid ? ` con l’uid ${cosa.uid}` : ''}, admin`,
  ricrea: `cancellare il segnaposto mai usato ${cosa.daCancellare} e ricrearlo con l’uid ${cosa.uid}, admin`,
  tieni: `tenere l’account ${cosa.uid}${cosa.ruolo ? ', e farlo admin' : ' (già admin)'}`,
}[cosa.azione]
console.log(`[titolare] ${PROGETTO}: ${APPLICA ? '' : 'farebbe: '}${descrizione}${cosa.link ? '; email per impostare la password' : ''}`)
if (!APPLICA) {
  console.log('[titolare] Niente scritto: rilancia con --applica per farlo.')
  process.exit(0)
}

let uid = cosa.uid
// Prima si cancella, poi si crea: due account con la stessa email Firebase
// non li vuole. Se la creazione fallisce, al rilancio si crea da capo.
if (cosa.daCancellare) await chiama('accounts:delete', { localId: cosa.daCancellare })
if (cosa.azione !== 'tieni') uid = (await chiama('accounts', { ...(cosa.uid ? { localId: cosa.uid } : {}), email: EMAIL, emailVerified: true })).localId
if (cosa.ruolo) await chiama('accounts:update', { localId: uid, customAttributes: JSON.stringify(cosa.ruolo) })
console.log(`[titolare] ✓ ${PROGETTO}: ${uid} è admin`)

if (cosa.link) {
  // L'email «imposta la password» la manda Firebase dal progetto del
  // locale, in italiano. Se non parte, il titolare usa «password
  // dimenticata»: non è un motivo per fermarsi.
  try {
    await chiama('accounts:sendOobCode', { requestType: 'PASSWORD_RESET', email: EMAIL, locale: 'it' })
    console.log(`[titolare] ✓ mandata a ${EMAIL} l’email per impostare la password`)
  } catch (e) {
    console.log(`⚠️  L’email per impostare la password non è partita (${e.message}): il titolare usa «password dimenticata».`)
  }
}
