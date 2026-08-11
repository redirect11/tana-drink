// =====================================================================
//  DOMINI AMMESSI DALLA CHIAVE reCAPTCHA (quella che firma i gettoni di
//  App Check).
//
//    node scripts/recaptcha-domini.js                       # elenco
//    node scripts/recaptcha-domini.js --aggiungi www.esempio.it,altro.it
//    node scripts/recaptcha-domini.js --togli vecchio.it
//
//  Se il dominio da cui si apre l'app non è in questo elenco, reCAPTCHA
//  non rilascia il gettone, App Check lo considera invalido e — con
//  l'enforcement acceso — Firestore risponde "Missing or insufficient
//  permissions" a tutto. È esattamente il guaio che abbiamo avuto.
//
//  Le modifiche hanno effetto subito: non serve ricompilare l'app, la
//  chiave pubblica resta la stessa.
// =====================================================================
import { accessToken, arg } from './lib-firestore.js'

const PROGETTO = arg('project', 'tana-drink')
const AGGIUNGI = (arg('aggiungi', '') || '').split(',').map((s) => s.trim()).filter(Boolean)
const TOGLI = (arg('togli', '') || '').split(',').map((s) => s.trim()).filter(Boolean)

const auth = { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' }
const BASE = `https://recaptchaenterprise.googleapis.com/v1/projects/${PROGETTO}/keys`

const elenco = await (await fetch(BASE, { headers: auth })).json()
if (elenco.error) {
  console.error(`[recaptcha] ${elenco.error.message}`)
  process.exit(1)
}
const chiavi = (elenco.keys || []).filter((k) => k.webSettings)
if (!chiavi.length) {
  console.error('[recaptcha] nessuna chiave web in questo progetto.')
  process.exit(1)
}

for (const chiave of chiavi) {
  const id = chiave.name.split('/').pop()
  const attuali = chiave.webSettings.allowedDomains || []
  console.log(`\n[recaptcha] ${chiave.displayName} · ${id}`)
  console.log(`  domini ora: ${attuali.join(', ') || '— nessuno (tutti) —'}`)

  if (!AGGIUNGI.length && !TOGLI.length) continue

  const nuovi = [...new Set([...attuali, ...AGGIUNGI])].filter((d) => !TOGLI.includes(d))
  if (JSON.stringify(nuovi) === JSON.stringify(attuali)) {
    console.log('  niente da cambiare.')
    continue
  }
  const res = await (
    await fetch(`${BASE}/${id}?updateMask=web_settings.allowed_domains`, {
      method: 'PATCH',
      headers: auth,
      body: JSON.stringify({ webSettings: { ...chiave.webSettings, allowedDomains: nuovi } }),
    })
  ).json()
  if (res.error) {
    console.error(`  ✖ ${res.error.message}`)
    process.exit(1)
  }
  console.log(`  ✓ domini ora: ${(res.webSettings?.allowedDomains || []).join(', ')}`)
}
