// =====================================================================
//  CHIUSURE DI CASSA FINTE, per vedere le statistiche piene (emulatore).
//
//    node scripts/mock-casse.js          → una chiusura per ogni giornata
//                                          passata che ha ordini
//    node scripts/mock-casse.js 5        → solo le ultime 5 giornate
//
//  Le statistiche e il rendiconto di serata si RICALCOLANO dagli ordini:
//  la sessione di cassa serve a dire da quando a quando guardare. Perciò
//  qui non si inventano incassi — si prendono le giornate che hanno già
//  ordini (`npm run mock:history`) e si mette attorno a ognuna la sua
//  cassa: aperta prima del primo conto, chiusa dopo l'ultimo.
//
//  Il fondo cassa e il contante contato sono verosimili: il contato ogni
//  tanto NON torna, perché è quello che succede davvero e le schermate
//  devono saperlo mostrare (differenza in rosso).
//
//  E CHIUDE I CONTI DELLE SERATE PASSATE. Gli ordini finti nascono serviti
//  ma non incassati (niente `payments`), e un rendiconto senza incassi è
//  una schermata di zeri: qui, per le giornate che si chiudono, i conti
//  vengono saldati con un metodo verosimile — contante il grosso, poi
//  carta e lettore — e con l'ora del servizio. È quello che succede
//  davvero: una serata finisce con la cassa in pari.
//
//  Gira SOLO sull'emulatore: se FIRESTORE_EMULATOR_HOST non è impostato,
//  si ferma. Le casse in produzione sono soldi veri.
// =====================================================================
import admin from 'firebase-admin'

process.env.FIRESTORE_EMULATOR_HOST =
  process.env.FIRESTORE_EMULATOR_HOST ||
  `${process.env.VITE_FIRESTORE_EMULATOR_HOST || 'localhost'}:${
    process.env.VITE_FIRESTORE_EMULATOR_PORT || '8080'
  }`

const progetto = process.env.VITE_FIREBASE_PROJECT_ID || 'demo-tana-drink'
if (!progetto.startsWith('demo-')) {
  console.error(
    `[casse] Progetto "${progetto}": questo script scrive solo su un progetto demo (emulatore).`
  )
  process.exit(1)
}

admin.initializeApp({ projectId: progetto })
const db = admin.firestore()

const quante = Number(process.argv[2]) || 0
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100
const caso = (min, max) => Math.round(min + Math.random() * (max - min))

// GLI ORARI ARRIVANO IN TRE FORME. Sugli ordini veri `created_at` è un
// Timestamp di Firestore, `paid_at` una stringa ISO scritta dal client, e
// negli script capita di trovarsi una Date. Qui si normalizza una volta:
// senza, il primo Timestamp faceva esplodere lo script con «Invalid time
// value», e non era chiaro perché.
function quando(v) {
  if (!v) return null
  if (typeof v.toDate === 'function') return v.toDate()
  const d = v instanceof Date ? v : new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

// La giornata commerciale di un ordine: quella scritta sull'ordine, o il
// giorno solare del suo orario. (Il taglio dopo mezzanotte lo fa l'app;
// qui basta raggruppare, e gli ordini finti nascono già con la loro data.)
const giornataDi = (o) => {
  if (o.order_date) return o.order_date
  const d = quando(o.paid_at) || quando(o.created_at)
  return d ? d.toISOString().slice(0, 10) : null
}

const ISO = (d) => new Date(d).toISOString()

async function main() {
  console.log(`[casse] Emulatore: ${process.env.FIRESTORE_EMULATOR_HOST} · progetto ${progetto}`)

  const [ordiniSnap, casseSnap] = await Promise.all([
    db.collection('orders').get(),
    db.collection('cash_sessions').get(),
  ])
  const ordini = ordiniSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
  if (ordini.length === 0) {
    console.error('[casse] Nessun ordine: esegui prima `node scripts/mock-history.js`.')
    process.exit(1)
  }

  // Giornate già coperte da una cassa: non se ne fanno due sullo stesso
  // giorno, o le statistiche conterebbero la serata due volte.
  const gia = new Set(casseSnap.docs.map((d) => d.data().business_day).filter(Boolean))

  const perGiorno = new Map()
  for (const o of ordini) {
    const g = giornataDi(o)
    if (!g) continue
    if (!perGiorno.has(g)) perGiorno.set(g, [])
    perGiorno.get(g).push(o)
  }

  const oggi = new Date().toISOString().slice(0, 10)
  let giorni = [...perGiorno.keys()]
    .filter((g) => g < oggi) // la serata di oggi è ancora in corso: non si chiude
    .filter((g) => !gia.has(g))
    .sort()
  if (quante > 0) giorni = giorni.slice(-quante)

  if (giorni.length === 0) {
    console.log('[casse] Niente da fare: le giornate passate hanno già la loro cassa.')
    return
  }

  const batch = db.batch()
  let totaleIncassato = 0
  let saldati = 0

  // Come si paga al banco, all'ingrosso: quasi sempre contante, poi carta,
  // ogni tanto il lettore. Serve a far vedere i metodi divisi nel
  // rendiconto invece di una colonna sola.
  const metodo = () => {
    const r = Math.random()
    if (r < 0.62) return 'banco'
    if (r < 0.9) return 'carta'
    return 'lettore'
  }

  for (const giorno of giorni) {
    const delGiorno = perGiorno.get(giorno)
    const orari = delGiorno
      .map((o) => quando(o.paid_at) || quando(o.created_at))
      .filter(Boolean)
      .map((d) => d.getTime())
      .sort((a, b) => a - b)
    // Apertura mezz'ora prima del primo conto, chiusura un'ora dopo
    // l'ultimo: è come va una serata, e serve perché i conti cadano
    // DENTRO la finestra (il rendiconto guarda quella).
    if (orari.length === 0) continue
    const apertura = ISO(orari[0] - 30 * 60 * 1000)
    const chiusura = ISO(orari[orari.length - 1] + 60 * 60 * 1000)

    // L'incassato per metodo, dagli ordini: gli stessi numeri che le
    // schermate ricalcolano, così lo snapshot salvato non le smentisce.
    const byMethod = {}
    let incassato = 0
    for (const o of delGiorno) {
      if (o.status === 'annullato') continue
      // Conto di una serata passata rimasto senza incasso: lo si salda,
      // con l'ora del servizio. Un rendiconto senza incassi è una
      // schermata di zeri, e non si prova niente.
      if (!(o.payments || []).length && o.payment_status !== 'pagato') {
        const importo = r2(o.total)
        if (importo > 0) {
          const quandoPagato = quando(o.paid_at) || quando(o.created_at)
          const at = quandoPagato ? quandoPagato.toISOString() : chiusura
          const m = metodo()
          o.payments = [{ id: `pay-${o.id}`, amount: importo, method: m, at }]
          o.payment_status = 'pagato'
          o.payment_method = m
          o.paid_at = at
          // E IL CONTO SI CHIUDE DAVVERO. Segnarlo solo «pagato» lasciava
          // lo stato a `ritirato`, che per la coda vuol dire conto ancora
          // in vita: le serate finte tornavano a galla fra i «Chiusi» di
          // oggi, mesi dopo. Un conto incassato è `pagato`, punto.
          o.status = 'pagato'
          batch.update(db.collection('orders').doc(o.id), {
            payments: o.payments,
            payment_status: 'pagato',
            payment_method: m,
            paid_at: at,
            status: 'pagato',
            'status_times.pagato': at,
          })
          saldati += 1
        }
      }
      const righe = o.payments || []
      if (righe.length) {
        for (const p of righe) {
          const a = r2(p.amount)
          if (!(a > 0)) continue
          incassato = r2(incassato + a)
          byMethod[p.method || 'banco'] = r2((byMethod[p.method || 'banco'] || 0) + a)
        }
      } else if (o.payment_status === 'pagato') {
        const a = r2(o.total)
        if (!(a > 0)) continue
        incassato = r2(incassato + a)
        const m = o.payment_method || 'banco'
        byMethod[m] = r2((byMethod[m] || 0) + a)
      }
    }

    const fondo = caso(80, 150)
    const contanti = r2(byMethod.banco || 0)
    const atteso = r2(fondo + contanti)
    // Tre serate su quattro il contante torna; una no, di qualche euro —
    // succede, e le schermate devono saperlo dire.
    const scarto = Math.random() < 0.25 ? caso(-12, 12) : 0
    const contato = r2(atteso + scarto)

    const ref = db.collection('cash_sessions').doc()
    batch.set(ref, {
      status: 'closed',
      business_day: giorno,
      opened_at: apertura,
      closed_at: chiusura,
      opened_by: { email: 'banco@tana.local', name: 'Capo Bar' },
      closed_by: { email: 'banco@tana.local', name: 'Capo Bar' },
      fondo_cassa: fondo,
      counted_cash: contato,
      difference: r2(contato - atteso),
      note: scarto === 0 ? null : 'Contato a fine serata, differenza da controllare.',
      snapshot: {
        incassato,
        byMethod,
        nPagati: delGiorno.filter((o) => o.payment_status === 'pagato').length,
        apertoDaIncassare: 0,
        nAperti: 0,
        sconti: 0,
        perOra: [],
        fondo,
        contanteAtteso: atteso,
      },
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    })
    totaleIncassato = r2(totaleIncassato + incassato)
    console.log(
      `[casse] ${giorno}: ${delGiorno.length} conti · incassato ${incassato.toFixed(2)} € · ` +
        `contante ${contanti.toFixed(2)} € · differenza ${scarto === 0 ? '0' : scarto.toFixed(2)} €`
    )
  }

  await batch.commit()
  console.log(
    `\n[casse] ✓ ${giorni.length} chiusure create · ${saldati} conti saldati · ` +
      `incassato totale ${totaleIncassato.toFixed(2)} €`
  )
}

main().catch((e) => {
  console.error('[casse] Errore:', e)
  process.exit(1)
})
