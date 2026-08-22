import { kpiSummary } from './stats.js'

// ── L'ELENCO DELLE SERATE (chiusure di cassa) ────────────────────────
//
// «Nelle statistiche dovremmo rendere più sofisticata la selezione della
// serata. È la cosa principale che si vuole vedere, il resto dei filtri sono
// secondari» (l'utente, 22/08/2026). Prima la serata era una pastiglia più
// una tendina: per confrontare due sabati bisognava aprire la tendina,
// sceglierne uno, leggere i numeri, riaprirla e rifare tutto. Qui le serate
// stanno in fila, coi numeri incolonnati, e si confrontano guardandole.
//
// Questa è la parte che si può provare senza disegnare niente: prende le
// sessioni di cassa e gli ordini CHE CI SONO GIÀ (la schermata li ha
// caricati per le sue statistiche) e ne fa le righe. Nessuna lettura nuova:
// la lista non deve mai far aspettare chi la apre.

const fmt = (iso, opt) => {
  try {
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('it-IT', opt)
  } catch {
    return '—'
  }
}

export const giornoSerata = (iso) =>
  fmt(iso, { weekday: 'short', day: '2-digit', month: '2-digit' })

const ora = (iso) => fmt(iso, { hour: '2-digit', minute: '2-digit' })

// Quanto è durata: "7h 30m", o "45m" sotto l'ora. Dice a colpo d'occhio se
// una serata ha incassato tanto perché è andata forte o perché è stata lunga.
export function durataSerata(da, a) {
  const t1 = Date.parse(da)
  const t2 = Date.parse(a)
  if (!Number.isFinite(t1) || !Number.isFinite(t2) || t2 < t1) return ''
  const min = Math.floor((t2 - t1) / 60000)
  const h = Math.floor(min / 60)
  return h > 0 ? `${h}h ${min % 60}m` : `${min}m`
}

// Didascalia di una serata: data e orari. Sta sopra il dettaglio, così chi
// ci è entrato sa quale serata sta guardando anche dopo aver scorso.
export function etichettaSerata(s) {
  if (!s?.opened_at) return '—'
  return `${giornoSerata(s.opened_at)} · ${ora(s.opened_at)}→${
    s.closed_at ? ora(s.closed_at) : 'in corso'
  }`
}

// Gli ordini che cadono nella finestra di una serata. È lo STESSO taglio del
// dettaglio (created_at fra apertura e chiusura): la riga deve promettere i
// numeri che poi si vedono aprendola, altrimenti è una riga che mente.
export function ordiniDellaSerata(orders, s, adesso) {
  if (!s?.opened_at) return []
  const da = s.opened_at
  const a = s.closed_at || adesso
  return orders.filter((o) => o.created_at >= da && o.created_at <= a)
}

// Una serata è ancora aperta finché la cassa non si chiude. Le sessioni
// vecchie non avevano `status`, quindi comanda la data di chiusura.
const inCorso = (s) => !s.closed_at

// Le righe dell'elenco, la più recente in cima.
//
// I NUMERI SONO TRE, e non è un caso: incasso, conti, scontrino medio. Il
// primo è la domanda («quanto ho fatto»), gli altri due sono la risposta al
// perché — incasso = conti × scontrino medio, quindi una serata migliore
// dell'altra lo è perché è entrata più gente o perché ognuno ha speso di
// più, e i due casi si gestiscono in modo diverso. Tutto il resto (ora di
// punta, attese, top prodotti) sta un tocco più in là, nel dettaglio: in
// riga sarebbero numeri da leggere uno per uno, e questa lista si guarda in
// una scorsa.
//
// LE SERATE VECCHIE. Gli ordini in mano coprono una finestra (le ultime N
// giornate scaricate): più indietro di così non c'è niente da ricalcolare, e
// andarli a chiedere vorrebbe dire far aspettare chi apre la lista. Quando
// una serata risulta senza un ordine ma alla chiusura aveva incassato, la
// verità è quella della chiusura: si usano i numeri CONGELATI nello
// `snapshot`, che stanno già sulla sessione — nessuna lettura in più. Una
// riga a zero si leggerebbe come «quella sera non ha incassato», che è
// un'altra cosa.
export function elencoSerate(sessions = [], orders = [], { adesso } = {}) {
  const adessoIso = adesso || new Date().toISOString()
  return (sessions || [])
    .filter((s) => s?.opened_at)
    .slice()
    .sort((a, b) => String(b.opened_at).localeCompare(String(a.opened_at)))
    .map((s) => {
      const fine = s.closed_at || adessoIso
      const snap = s.snapshot || {}
      const k = kpiSummary(ordiniDellaSerata(orders, s, adessoIso))
      const daSnapshot = k.ordini === 0 && Number(snap.incassato) > 0
      const incasso = daSnapshot ? Number(snap.incassato) : k.incasso
      const conti = daSnapshot ? Number(snap.nPagati) || 0 : k.ordini
      return {
        id: s.id,
        session: s,
        inCorso: inCorso(s),
        giorno: giornoSerata(s.opened_at),
        orario: `${ora(s.opened_at)} → ${s.closed_at ? ora(s.closed_at) : 'in corso'}`,
        durata: durataSerata(s.opened_at, fine),
        incasso,
        conti,
        scontrinoMedio: conti ? incasso / conti : 0,
        // Numeri della chiusura invece che ricalcolati: la riga lo dice, così
        // chi apre il dettaglio e lo trova vuoto sa perché.
        daSnapshot,
      }
    })
}
