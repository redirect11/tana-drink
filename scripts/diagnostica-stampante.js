// =====================================================================
//  IL DIARIO DELLA STAMPANTE, LETTO DA REMOTO (REQ-STAMPA-019).
//
//    node scripts/diagnostica-stampante.js --project tana-drink
//    node scripts/diagnostica-stampante.js --project tana-drink --giorni 3
//    node scripts/diagnostica-stampante.js --project tana-drink --tutto   # anche le serate senza guai
//
//  Sola lettura. Un documento per serata e per terminale, con dentro gli
//  eventi che il tablet ha scritto: collegamento fallito, stampante
//  caduta, stampa non riuscita, pallino rosso/verde, apertura di cassa.
//  Serve a rispondere da casa a «ieri sera non stampava»: a che ora, con
//  che indirizzo, con che versione dell'app, e cosa ha detto la stampante.
// =====================================================================
import { accessToken, client, idDi, arg, flag } from './lib-firestore.js'

const PROJECT = arg('project', 'tana-drink-test')
const GIORNI = Number(arg('giorni', '7'))
const TUTTO = flag('tutto')

const db = client(PROJECT, await accessToken())

// Dal formato nativo di Firestore a valori normali.
const val = (f) => {
  if (f == null) return undefined
  if (f.stringValue != null) return f.stringValue
  if (f.doubleValue != null) return Number(f.doubleValue)
  if (f.integerValue != null) return Number(f.integerValue)
  if (f.booleanValue != null) return f.booleanValue
  if (f.timestampValue != null) return f.timestampValue
  if (f.nullValue === null) return null
  if (f.mapValue) return Object.fromEntries(Object.entries(f.mapValue.fields || {}).map(([k, v]) => [k, val(v)]))
  if (f.arrayValue) return (f.arrayValue.values || []).map(val)
  return undefined
}
const piano = (d) => ({ id: idDi(d), ...Object.fromEntries(Object.entries(d.fields || {}).map(([k, v]) => [k, val(v)])) })

const soglia = Date.now() - GIORNI * 86_400_000
const docs = (await db.documenti('diagnostica_stampante'))
  .map(piano)
  .filter((d) => new Date(d.aggiornato_at || d.aperto_at || 0).getTime() >= soglia)
  .sort((a, b) => String(b.aperto_at || '').localeCompare(String(a.aperto_at || '')))

console.log(`[diario] ${PROJECT}: ${docs.length} serate negli ultimi ${GIORNI} giorni`)
const ora = (iso) => (iso ? String(iso).slice(11, 19) : '--:--:--')
for (const d of docs) {
  const eventi = (d.eventi || []).filter((e) => e && e.tipo)
  const guai = eventi.filter((e) => !['apertura_cassa', 'pallino_ok', 'stampante_tornata'].includes(e.tipo))
  if (!TUTTO && guai.length === 0) continue
  const s = d.stampante || {}
  console.log(
    `\n═══ ${d.giornata || '?'} · ${d.sessione_id ? 'cassa ' + d.sessione_id : 'cassa chiusa'} · terminale ${String(d.dispositivo || '?').slice(0, 8)}`
  )
  console.log(
    `    chi: ${d.chi || '?'} · stampante ${s.ip || '?'}:${s.port || '?'}${s.https ? ' (SSL)' : ''} · app ${d.app?.versione || '?'} ${d.app?.commit || ''} · eventi ${d.n_eventi ?? eventi.length}`
  )
  if (d.browser) console.log(`    ${d.browser}`)
  for (const e of eventi) {
    const extra = []
    if (e.ip && e.ip !== s.ip) extra.push(`ip ${e.ip}`)
    if (e.ripetuti_prima) extra.push(`+${e.ripetuti_prima} uguali nel minuto prima`)
    if (e.dettagli) extra.push(JSON.stringify(e.dettagli))
    console.log(`    ${ora(e.at)}  ${e.tipo.padEnd(22)} ${e.motivo || ''}${extra.length ? '  [' + extra.join(' · ') + ']' : ''}`)
  }
}
