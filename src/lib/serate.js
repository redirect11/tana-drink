import { kpiSummary } from './stats.js'
import { businessDayKey, DEFAULT_CUTOFF_HOUR } from './businessDay.js'

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
  // Senza data non si inventa un giorno: `new Date(null)` è l'epoch, non una
  // data invalida, e uscirebbe «gio 01/01» al posto del trattino.
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('it-IT', opt)
  } catch {
    return '—'
  }
}

export const giornoSerata = (iso) =>
  fmt(iso, { weekday: 'short', day: '2-digit', month: '2-digit' })

export const oraSerata = (iso) => fmt(iso, { hour: '2-digit', minute: '2-digit' })

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
  return `${giornoSerata(s.opened_at)} · ${oraSerata(s.opened_at)}→${
    s.closed_at ? oraSerata(s.closed_at) : 'in corso'
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
        orario: `${oraSerata(s.opened_at)} → ${s.closed_at ? oraSerata(s.closed_at) : 'in corso'}`,
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

// ── CERCARE UNA SERATA PER DATA ──────────────────────────────────────
//
// «Togli il box, lascia solo la lista, e aggiungi un selettore di data per
// cercare una chiusura cassa» (l'utente, 22/08/2026). Con due mesi di
// righe in fila, a «com'è andata il 15 agosto?» si rispondeva scorrendo.
//
// IL GIORNO DI UNA SERATA È LA SUA GIORNATA COMMERCIALE, non la data
// solare dell'apertura e nemmeno quella della chiusura: una serata aperta
// il 15 alle 19:00 e chiusa all'01:08 è la serata del 15, e chi cerca il
// 16 non deve trovarla. Il taglio è quello di `businessDay.js` — lo stesso
// con cui sono raggruppati gli ordini — perché due posti che tagliano la
// nottata in modo diverso sono due verità diverse sullo stesso incasso.
export function giornoDellaSerata(s, cutoffHour = DEFAULT_CUTOFF_HOUR) {
  return s?.opened_at ? businessDayKey(s.opened_at, cutoffHour) : null
}

// La serata di una data (`YYYY-MM-DD`), oppure null se quel giorno la cassa
// non ha aperto — il lunedì di riposo, o una serata saltata. Se per un
// guaio di dati la stessa giornata avesse due sessioni si prende la prima
// aperta: è quella che ha iniziato la serata.
export function serataDelGiorno(sessions = [], giorno, cutoffHour = DEFAULT_CUTOFF_HOUR) {
  if (!giorno) return null
  const stessoGiorno = (sessions || []).filter(
    (s) => giornoDellaSerata(s, cutoffHour) === giorno
  )
  if (stessoGiorno.length === 0) return null
  return stessoGiorno.reduce((primo, s) =>
    String(s.opened_at) < String(primo.opened_at) ? s : primo
  )
}

// I bordi entro cui ha senso cercare: la prima e l'ultima serata che la
// lista ha già in mano. Vanno nel `min`/`max` del campo data, che così non
// lascia nemmeno provare una data futura o precedente alla prima chiusura
// registrata — un limite che si vede è meglio di un messaggio dopo. Nessuna
// lettura in più: sono le stesse sessioni che la lista sta disegnando.
export function limitiRicercaSerate(sessions = [], cutoffHour = DEFAULT_CUTOFF_HOUR) {
  const giorni = (sessions || [])
    .map((s) => giornoDellaSerata(s, cutoffHour))
    .filter(Boolean)
    .sort()
  return { dal: giorni[0] || null, al: giorni[giorni.length - 1] || null }
}

// ── RAGGRUPPARE LE SERATE: PER SETTIMANA E PER MESE ──────────────────
//
// «Aggiungi dei filtri alla lista delle chiusure cassa per mostrare quelle
// settimanali o mensili oltre che per data» (l'utente, 22/08/2026). Con la
// lista per serata a «com'è andato agosto?» si risponde sommando a mente
// trenta righe, e a «questa settimana è andata meglio della scorsa?» pure.
//
// Le righe aggregate escono dalle STESSE sessioni che la lista sta già
// disegnando: nessuna lettura in più, nessuna attesa. E i numeri sono
// quelli CONGELATI nello snapshot della chiusura — che stanno sulla
// sessione — quindi una settimana di due mesi fa somma quanto ha davvero
// incassato, non zero perché i suoi ordini sono fuori dalla finestra
// scaricata (stessa ragione di `elencoSerate`).

export const RAGGRUPPAMENTI = ['serata', 'settimana', 'mese']

// Come si chiamano nei tre gettoni sopra la lista. Stanno qui e non nella
// schermata perché sono il nome di quello che la lista diventa: chi aggiunge
// un raggruppamento aggiunge la voce accanto alla chiave, e non se ne
// dimentica una in un altro file.
export const ETICHETTA_RAGGRUPPAMENTO = {
  serata: 'Serata',
  settimana: 'Settimana',
  mese: 'Mese',
}

// LA SETTIMANA COMINCIA DI LUNEDÌ. È l'uso italiano (e lo standard ISO), ma
// qui conta soprattutto un fatto del mestiere: per un locale la domenica è
// la coda del fine settimana, non l'inizio di quello dopo. Col lunedì in
// testa venerdì, sabato e domenica — le tre sere che fanno l'incasso —
// cadono nella stessa riga, e due settimane si confrontano davvero. Con la
// domenica in testa il sabato e la domenica dello stesso weekend finirebbero
// in due righe diverse.
//
// LA CHIAVE È LA DATA DEL LUNEDÌ (`YYYY-MM-DD`), non il numero di settimana:
// si ordina come una stringa, si formatta senza tabelle, e non porta dietro
// i casi limite della settimana 53 a cavallo dell'anno.
export function chiaveSettimana(giorno) {
  if (!giorno) return null
  const d = new Date(`${giorno}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return null
  // getUTCDay(): 0 è domenica. Quanti giorni indietro sta il lunedì.
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  return d.toISOString().slice(0, 10)
}

export function chiaveMese(giorno) {
  return giorno ? giorno.slice(0, 7) : null
}

// Il periodo a cui appartiene una serata. Passa da `giornoDellaSerata`, che
// il bordo della nottata lo taglia già: una serata aperta sabato alle 19:00 e
// chiusa all'01:08 è la serata di sabato, quindi la settimana di sabato — e
// non quella dopo, che comincerebbe alla mezzanotte in mezzo alla serata.
export function periodoDellaSerata(s, raggruppamento, cutoffHour = DEFAULT_CUTOFF_HOUR) {
  const giorno = giornoDellaSerata(s, cutoffHour)
  if (!giorno) return null
  if (raggruppamento === 'settimana') return chiaveSettimana(giorno)
  if (raggruppamento === 'mese') return chiaveMese(giorno)
  return giorno
}

const dataDaChiave = (giorno) => new Date(`${giorno}T00:00:00Z`)

// Come si legge un periodo in riga: «10–16 ago» per la settimana, «agosto
// 2026» per il mese. La settimana non porta l'anno — le righe stanno in
// ordine di data, come quelle delle serate, che l'anno non lo scrivono; il
// mese sì, perché «agosto» da solo è la stessa parola tutti gli anni.
export function etichettaPeriodo(chiave, raggruppamento) {
  if (!chiave) return '—'
  const opzioni = { timeZone: 'UTC' }
  if (raggruppamento === 'mese') {
    return dataDaChiave(`${chiave}-01`).toLocaleDateString('it-IT', {
      ...opzioni,
      month: 'long',
      year: 'numeric',
    })
  }
  if (raggruppamento === 'settimana') {
    const lun = dataDaChiave(chiave)
    const dom = dataDaChiave(chiave)
    dom.setUTCDate(dom.getUTCDate() + 6)
    const mese = (d) => d.toLocaleDateString('it-IT', { ...opzioni, month: 'short' })
    const giorno = (d) => d.toLocaleDateString('it-IT', { ...opzioni, day: 'numeric' })
    // Dentro lo stesso mese il mese si scrive una volta sola: «10–16 ago».
    // A cavallo di due mesi ci vanno tutti e due, o «27–2 ago» sarebbe falso.
    return mese(lun) === mese(dom)
      ? `${giorno(lun)}–${giorno(dom)} ${mese(dom)}`
      : `${giorno(lun)} ${mese(lun)} – ${giorno(dom)} ${mese(dom)}`
  }
  return chiave
}

// Le righe aggregate, il periodo più recente in cima.
//
// COSA DICE UNA RIGA, e perché proprio questi tre numeri: il PERIODO, quante
// SERATE contiene e quanto ha INCASSATO in tutto — più la MEDIA A SERATA.
// La media non è un di più: è l'unico numero con cui due settimane si
// confrontano davvero. Una settimana con cinque aperture e una con tre
// (Ferragosto, il lunedì di riposo, una serata privata) hanno totali diversi
// per un motivo che non c'entra con com'è andata la sera. È la stessa
// struttura della riga per serata — incasso = conti × scontrino medio —
// letta un piano più su: incasso = serate × media.
//
// LA MEDIA SI DIVIDE PER LE SERATE GIÀ CHIUSE, non per tutte: quella di
// stasera non ha ancora un incasso, e contarla come zero tirerebbe giù la
// media di tutta la settimana.
export function raggruppaSerate(sessions = [], { raggruppamento, cutoffHour } = {}) {
  if (!RAGGRUPPAMENTI.includes(raggruppamento) || raggruppamento === 'serata') return []
  const gruppi = new Map()
  for (const s of sessions || []) {
    const chiave = periodoDellaSerata(s, raggruppamento, cutoffHour)
    // Una sessione senza apertura non è una serata e non sta in nessun
    // periodo: fuori, come nell'elenco.
    if (!chiave) continue
    if (!gruppi.has(chiave)) {
      gruppi.set(chiave, {
        chiave,
        etichetta: etichettaPeriodo(chiave, raggruppamento),
        serate: [],
        incasso: 0,
        serateContate: 0,
        inCorso: false,
      })
    }
    const g = gruppi.get(chiave)
    g.serate.push(s)
    // UNA SERATA CHIUSA CONTA SEMPRE, e per quello che dice la sua chiusura.
    // Una ancora APERTA no: lo snapshot nasce alla chiusura, quindi il suo
    // incasso non si sa — sommarlo come zero abbasserebbe la media di tutta
    // la settimana. Il periodo lo dice con «in corso», che è anche il motivo
    // per cui il totale non è ancora quello definitivo. È la stessa scelta
    // della riga per serata, che al posto dell'incasso mette un trattino.
    if (s.closed_at) {
      const incassato = Number(s.snapshot?.incassato)
      g.incasso += Number.isFinite(incassato) ? incassato : 0
      g.serateContate += 1
    } else {
      g.inCorso = true
    }
  }
  // I periodi senza serate non esistono: la Map ha solo quelli che una
  // chiusura ce l'hanno. Una settimana di ferie non è una riga a zero, che
  // si leggerebbe come «quella settimana è andata male».
  return [...gruppi.values()]
    .sort((a, b) => b.chiave.localeCompare(a.chiave))
    .map((g) => ({
      ...g,
      serate: g.serate
        .slice()
        .sort((a, b) => String(b.opened_at).localeCompare(String(a.opened_at))),
      nSerate: g.serate.length,
      media: g.serateContate ? g.incasso / g.serateContate : 0,
    }))
}
