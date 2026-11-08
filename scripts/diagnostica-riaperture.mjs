// =====================================================================
//  I CONTI RIAPERTI DI UNA SERATA, E COSA NE DICE LA CASSA. SOLA LETTURA.
//
//    node scripts/diagnostica-riaperture.mjs --dal 2026-11-06
//    node scripts/diagnostica-riaperture.mjs --dal 2026-11-06 --al 2026-11-07
//    node scripts/diagnostica-riaperture.mjs --project tana-drink --dal 2026-11-06
//
//  Flavio, 07/11/2026: «ho chiuso un tavolo di 10 euro con contante, poi mi
//  sono ricordato che aveva pagato con carta, l'ho riaperto, l'ho chiuso
//  con carta: ieri sera mi mancavano 10 euro». Il codice, provato senza
//  rete e con la rete, la riapertura la fa giusta: gli incassi si tolgono
//  (`payments_annullati`) e la cassa conta solo quelli rimasti. Questo
//  script guarda i conti VERI: per ogni cassa del periodo, i conti che
//  hanno una riapertura, coi loro incassi, quelli tolti e il metodo, e il
//  riepilogo della cassa calcolato con la stessa funzione dell'app
//  (lib/cassa.js). Segnala anche i conti che la cassa conta in contanti
//  PER RIPIEGO: pagati, senza nessun incasso scritto e senza metodo.
//
//  Non scrive niente. Default: tana-drink-test; la produzione va nominata.
// =====================================================================
import { accessToken, client, daCampi, idDi, arg } from './lib-firestore.js'
import { cashRecap } from '../src/lib/cassa.js'
import { scontoTotale } from '../src/lib/pagamento.js'

const PROGETTO = arg('project', 'tana-drink-test')
const DAL = arg('dal')
const AL = arg('al', DAL)
if (!DAL) {
  console.error('Serve --dal AAAA-MM-GG (e, se è più di un giorno, --al).')
  process.exit(1)
}

const db = client(PROGETTO, await accessToken())
const leggi = async (col) => (await db.documenti(col)).map((d) => ({ id: idDi(d), ...daCampi(d.fields) }))
const euro = (n) => `${(Math.round((Number(n) || 0) * 100) / 100).toFixed(2)} €`
const incassi = (lista) =>
  (lista || []).map((p) => `${p.method || '?'} ${euro(p.amount)} alle ${String(p.at || '').slice(11, 19)}`).join(', ') || '—'

// Le casse APERTE nel periodo: una serata scavalca la mezzanotte, quindi si
// guarda il giorno di apertura.
const casse = (await leggi('cash_sessions'))
  .filter((s) => String(s.opened_at || '').slice(0, 10) >= DAL && String(s.opened_at || '').slice(0, 10) <= AL)
  .sort((a, b) => String(a.opened_at).localeCompare(String(b.opened_at)))
const ordini = await leggi('orders')

console.log(`Progetto ${PROGETTO}, casse aperte dal ${DAL} al ${AL}: ${casse.length}\n`)
for (const s of casse) {
  const fine = s.closed_at || new Date().toISOString()
  const dentro = (ts) => !!ts && ts >= s.opened_at && ts <= fine
  const della = ordini.filter(
    (o) =>
      o.closed_in_session === s.id ||
      dentro(o.paid_at) ||
      (o.payments || []).some((p) => dentro(p.at)) ||
      (o.payments_annullati || []).some((p) => dentro(p.at))
  )
  const r = cashRecap(della, s, fine)
  console.log(`── Cassa ${s.id}: ${s.opened_at} → ${s.closed_at || 'aperta'}`)
  console.log(`   conti ${della.length}, incassato ${euro(r.incassato)}, per metodo ${JSON.stringify(r.byMethod)}`)
  console.log(`   fondo ${euro(s.fondo_cassa)}, contante atteso ricalcolato oggi ${euro(r.contanteAtteso)}`)
  // Quello che la chiusura ha VISTO quella sera (closeCashSession): se è
  // diverso da quello di oggi, la cassa è stata chiusa su conti che poi
  // sono cambiati, o su una cache che non era aggiornata.
  if (s.snapshot) {
    console.log(`   alla chiusura: atteso ${euro(s.snapshot.contanteAtteso)}, per metodo ${JSON.stringify(s.snapshot.byMethod)}` +
      (s.counted_cash != null ? `, contato ${euro(s.counted_cash)}, differenza ${euro(s.difference)}` : ''))
  }

  for (const o of della.filter((x) => (x.riaperture || []).length > 0)) {
    console.log(`\n   CONTO #${o.daily_number ?? '?'} (${o.id}) — totale ${euro(o.total)}, stato ${o.status}, pagamento ${o.payment_status}, metodo ${o.payment_method ?? '—'}`)
    console.log(`     incassi:        ${incassi(o.payments)}`)
    console.log(`     incassi tolti:  ${incassi(o.payments_annullati)}`)
    for (const ri of o.riaperture) {
      console.log(`     riaperto alle ${String(ri.at || '').slice(11, 19)} (chiudeva ${ri.chiudeva}, tolti ${euro(ri.incassi_tolti)})${ri.motivo ? `: «${ri.motivo}»` : ''}`)
    }
  }

  // IL RIPIEGO DELLA CASSA: un conto pagato senza incassi scritti si conta
  // per intero (scontato) col suo metodo, e senza metodo in contanti. Gli
  // omaggi e le consumazioni dello staff, scontati al 100%, valgono zero e
  // non si segnalano.
  const dovuto = (o) => Math.round(((Number(o.total) || 0) - scontoTotale(o)) * 100) / 100
  const perRipiego = della.filter(
    (o) => o.payment_status === 'pagato' && !(o.payments || []).length && !o.payment_method && dentro(o.paid_at) && dovuto(o) > 0
  )
  for (const o of perRipiego) {
    console.log(`\n   ⚠ CONTO #${o.daily_number ?? '?'} (${o.id}) pagato senza incassi e senza metodo: la cassa lo conta in contanti (${euro(dovuto(o))})`)
  }
  console.log('')
}
