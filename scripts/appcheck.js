// =====================================================================
//  APP CHECK: com'è messo, e accenderlo SENZA chiudere fuori il locale.
//
//    node scripts/appcheck.js --project tana-drink            # stato + gettoni
//    node scripts/appcheck.js --project tana-drink --giorni 7
//    node scripts/appcheck.js --project tana-drink --accendi firestore
//    node scripts/appcheck.js --project tana-drink --spegni firestore
//
//  App Check pretende che ogni richiesta porti un gettone firmato da
//  reCAPTCHA: se il browser non riesce a ottenerlo, Firestore risponde
//  "Missing or insufficient permissions" A TUTTO — anche al menù, che è
//  pubblico. Acceso di traverso, chiude fuori il locale in mezzo al
//  servizio, ed è successo davvero: in produzione era attivo da giugno.
//
//  Perciò l'ordine giusto è: prima si guarda quanti gettoni VALIDI stanno
//  arrivando (questo comando), e solo quando i non validi sono zero si
//  accende. I numeri vengono da Cloud Monitoring, cioè dal traffico vero.
// =====================================================================
import { accessToken, arg, flag } from './lib-firestore.js'

const PROGETTO = arg('project', 'tana-drink-test')
const GIORNI = Number(arg('giorni', 3)) || 3
const ACCENDI = arg('accendi')
const SPEGNI = arg('spegni')

const SERVIZI = {
  firestore: 'firestore.googleapis.com',
  storage: 'firebasestorage.googleapis.com',
  auth: 'identitytoolkit.googleapis.com',
  functions: 'cloudfunctions.googleapis.com',
}

const token = await accessToken()
const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

// Numero interno del progetto: le API di App Check e Monitoring lo vogliono.
const info = await (
  await fetch(`https://firebase.googleapis.com/v1beta1/projects/${PROGETTO}`, { headers: auth })
).json()
if (info.error) {
  console.error(`[appcheck] ${info.error.message}`)
  process.exit(1)
}
const numero = info.projectNumber

async function stato() {
  const r = await (
    await fetch(`https://firebaseappcheck.googleapis.com/v1/projects/${numero}/services`, {
      headers: auth,
    })
  ).json()
  console.log(`[appcheck] ${PROGETTO}`)
  for (const s of r.services || []) {
    const nome = s.name.split('/').pop()
    const acceso = s.enforcementMode === 'ENFORCED'
    console.log(`  ${acceso ? '🔒' : '🔓'} ${nome.padEnd(34)} ${s.enforcementMode}`)
  }
  if (!(r.services || []).length) console.log('  nessun servizio configurato (tutto libero)')
}

// Quanti gettoni stanno arrivando, e quanti sono validi. Se qui i validi
// sono zero mentre il locale lavora, accendere vuol dire spegnere il bar.
async function gettoni() {
  const fine = new Date()
  const inizio = new Date(fine.getTime() - GIORNI * 86400000)
  // Il verdetto per servizio: quante richieste sono arrivate con un
  // gettone valido e quante no (etichette: result, security).
  const filtro = `metric.type="firebaseappcheck.googleapis.com/services/verdict_count"`
  const url =
    `https://monitoring.googleapis.com/v3/projects/${PROGETTO}/timeSeries?` +
    new URLSearchParams({
      filter: filtro,
      'interval.startTime': inizio.toISOString(),
      'interval.endTime': fine.toISOString(),
      // Un punto al giorno: serve vedere QUANDO qualcosa è andato storto,
      // non solo quanto.
      'aggregation.alignmentPeriod': '86400s',
      'aggregation.perSeriesAligner': 'ALIGN_SUM',
    })
  const r = await (await fetch(url, { headers: auth })).json()
  if (r.error) {
    console.log(`\n  gettoni: non leggibili (${r.error.message})`)
    return
  }
  const serie = r.timeSeries || []
  if (!serie.length) {
    console.log(`\n  gettoni negli ultimi ${GIORNI} giorni: NESSUNA richiesta registrata.`)
    console.log('  (nessun dato = non si sa: non accendere.)')
    return
  }
  console.log(`\n  richieste negli ultimi ${GIORNI} giorni:`)
  const perEsito = {}
  const perGiorno = {}
  for (const s of serie) {
    const et = s.metric?.labels || {}
    const chiave = `${et.result ?? '—'}${et.security ? ` (${et.security})` : ''}`
    for (const p of s.points || []) {
      const n = Number(p.value?.int64Value ?? p.value?.doubleValue ?? 0)
      if (!n) continue
      perEsito[chiave] = (perEsito[chiave] || 0) + n
      const giorno = String(p.interval?.endTime || '').slice(0, 10)
      perGiorno[giorno] = perGiorno[giorno] || {}
      perGiorno[giorno][chiave] = (perGiorno[giorno][chiave] || 0) + n
    }
  }
  for (const [k, v] of Object.entries(perEsito).sort((a, b) => b[1] - a[1])) {
    console.log(`     ${k.padEnd(40)} ${v}`)
  }
  // QUANDO è andato storto, non solo quanto: un rifiuto di stasera e uno di
  // tre settimane fa non vogliono dire la stessa cosa.
  console.log('\n  giorno per giorno:')
  for (const [g, v] of Object.entries(perGiorno).sort()) {
    const dettaglio = Object.entries(v)
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => `${k} ${n}`)
      .join(' · ')
    console.log(`     ${g}  ${dettaglio}`)
  }
  const valide = Object.entries(perEsito)
    .filter(([k]) => /VALID/.test(k) && !/INVALID/.test(k))
    .reduce((n, [, v]) => n + v, 0)
  const altre = Object.values(perEsito).reduce((n, v) => n + v, 0) - valide
  console.log(
    altre === 0 && valide > 0
      ? '\n  ✔ Tutte le richieste portano un gettone valido: si può accendere.'
      : `\n  ✖ ${altre} richieste senza gettone valido: accendendo, quelle verrebbero rifiutate.`
  )
}

async function cambia(quale, modo) {
  const servizio = SERVIZI[quale] || quale
  const nome = `projects/${numero}/services/${servizio}`
  const r = await (
    await fetch(`https://firebaseappcheck.googleapis.com/v1/${nome}?updateMask=enforcementMode`, {
      method: 'PATCH',
      headers: auth,
      body: JSON.stringify({ name: nome, enforcementMode: modo }),
    })
  ).json()
  if (r.error) {
    console.error(`[appcheck] ${r.error.message}`)
    process.exit(1)
  }
  console.log(`[appcheck] ${servizio} → ${r.enforcementMode}`)
}

await stato()
if (ACCENDI) {
  console.log('')
  await cambia(ACCENDI, 'ENFORCED')
  console.log('  Controlla SUBITO che il locale lavori: se qualcosa si blocca,')
  console.log(`  spegni con --spegni ${ACCENDI} (ha effetto immediato).`)
} else if (SPEGNI) {
  console.log('')
  await cambia(SPEGNI, 'UNENFORCED')
} else {
  await gettoni()
}
