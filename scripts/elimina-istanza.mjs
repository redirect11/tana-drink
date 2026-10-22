// =====================================================================
//  CHIUDE DAVVERO UN'ISTANZA: cancella il suo progetto Google Cloud.
//
//    node scripts/elimina-istanza.mjs --slug bar-mario          # anteprima
//    node scripts/elimina-istanza.mjs --slug bar-mario --apply  # cancella
//
//  REQ-FLOTTA-008. Prima di arrivare qui l'istanza va messa «chiusa» dal
//  backoffice (l'app si ferma e lo dice, i dati restano): questo è il
//  passo finale, dopo i 30 giorni promessi al cliente. Google tiene un
//  progetto cancellato per altri 30 giorni, recuperabile dalla console
//  (IAM e amministrazione → Gestisci risorse → Risorse in attesa di
//  eliminazione): quindi anche questo gesto si può annullare, ma non da
//  qui. Niente si cancella senza --apply.
// =====================================================================
import { accessToken, arg, flag } from './lib-firestore.js'

const SLUG = arg('slug')
if (!SLUG || !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(SLUG)) {
  console.error('Uso: node scripts/elimina-istanza.mjs --slug <slug> [--apply]')
  process.exit(1)
}
const PROGETTO = `drinkpos-${SLUG}`
if (['drinkpos-demo'].includes(PROGETTO) && !flag('anche-demo')) {
  console.error(`${PROGETTO} è la demo: per cancellarla davvero aggiungi --anche-demo.`)
  process.exit(1)
}
const token = await accessToken()
const h = { Authorization: `Bearer ${token}` }
const info = await (await fetch(`https://cloudresourcemanager.googleapis.com/v1/projects/${PROGETTO}`, { headers: h })).json()
if (info.error) {
  console.error(`✖ ${PROGETTO}: ${info.error.message}`)
  process.exit(1)
}
console.log(`[elimina] ${PROGETTO} · stato ${info.lifecycleState} · creato ${info.createTime}`)
if (!flag('apply')) {
  console.log('  ANTEPRIMA: niente cancellato. Aggiungi --apply per cancellare il progetto (recuperabile per 30 giorni).')
  process.exit(0)
}
const res = await fetch(`https://cloudresourcemanager.googleapis.com/v1/projects/${PROGETTO}`, { method: 'DELETE', headers: h })
const j = await res.json().catch(() => ({}))
if (j.error) {
  console.error(`✖ ${j.error.message}`)
  process.exit(1)
}
console.log(`[elimina] ✓ ${PROGETTO} in attesa di eliminazione: recuperabile dalla console per 30 giorni.`)
