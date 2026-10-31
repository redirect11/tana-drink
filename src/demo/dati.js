// ── I DATI DI PROVA DELLA DEMO (REQ-FLOTTA-019) ─────────────────────────
//
// Un locale INVENTATO, completo: menù con ricette e disegni dei drink,
// magazzino coi costi, fornitori e listini, quattro settimane di serate
// chiuse e incassate con la loro cassa, e la serata di oggi in corso — cassa
// aperta, conti in coda in tutti gli stati, qualcuno già pagato.
//
// NESSUN DATO DELLA TANA, nemmeno dal database di prova: la demo è una
// pagina pubblica. Il catalogo riusa quello del seme di sviluppo
// (src/dev/seedData.js), che è inventato, ma senza i quattro nomi che
// ricordavano il locale («Il Coniglio», «Tana Sour», «White Rabbit», «Tana
// Detox») e senza le foto: i drink hanno i disegni composti
// (lib/illustrazioneDrink.js). Un test cerca nei dati ogni traccia della
// Tana.
//
// SEMPRE GLI STESSI NUMERI: tutto viene da un generatore con un seme fisso,
// e le date sono relative al giorno in cui si apre la demo — lo storico
// sembra sempre recente, e due aperture dello stesso giorno vedono le
// stesse schermate.
//
// Restituisce i documenti come li vuole il bundle (src/demo/bundle.js):
// [{ percorso, dati }], con `dati: null` per quelli che non esistono.

import { INV_CATS, INV_ITEMS, DRINK_CATS, DRINKS, SEED_SETTINGS } from '../dev/seedData.js'
import { businessDayKey, istanteDaOraDiRoma } from '../lib/businessDay.js'
import { MODULI_PREMIUM } from '../lib/licenza.js'

export const SEME = 20261030
const MIN = 60 * 1000

// Generatore pseudo-casuale con seme (mulberry32): stessi numeri a ogni giro.
export function generatore(seme) {
  let a = seme >>> 0
  const caso = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const tra = (min, max) => min + caso() * (max - min)
  const intero = (min, max) => Math.floor(tra(min, max + 1))
  const uno = (lista) => lista[intero(0, lista.length - 1)]
  return { caso, tra, intero, uno }
}

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100
const slug = (s) =>
  String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

// I nomi del seme che ricordavano il locale vero: i tre drink della casa e
// l'analcolico «… Detox». Si riconoscono senza scriverli (la regola del
// marchio non li vuole nel codice): i drink della casa per posizione, nella
// loro categoria; il Detox per come finisce il nome.
const NOMI_DELLA_CASA = [
  { name: 'Casa Spritz', description: 'Lo spritz della casa: gin, Aperol, lime e prosecco' },
  { name: 'Sour della Casa' },
  { name: 'Velluto Bianco' },
]
const rinominaDi = (d, posizioneNellaCasa) => {
  if (d.cat === 'signature') return NOMI_DELLA_CASA[posizioneNellaCasa] || {}
  if (/\sDetox$/.test(d.name)) return { name: 'Detox' }
  return {}
}

// Il disegno di ogni drink: bicchiere, colore, decorazione.
const DISEGNI = {
  'Spritz Aperol': ['balloon', 'pesca', 'agrume'],
  'Spritz Campari': ['balloon', 'rosso', 'agrume'],
  'Negroni Sbagliato': ['basso', 'rosso', 'agrume'],
  Hugo: ['balloon', 'limpido', 'menta'],
  Negroni: ['basso', 'rosso', 'scorza'],
  'Old Fashioned': ['basso', 'ambra', 'scorza'],
  Manhattan: ['martini', 'rosso', 'ciliegia'],
  Mojito: ['alto', 'verde', 'menta'],
  Daiquiri: ['coppa', 'limpido', 'agrume'],
  Margarita: ['coppa', 'giallo', 'agrume'],
  Cosmopolitan: ['martini', 'rosa', 'scorza'],
  'Gin Tonic': ['balloon', 'limpido', 'agrume'],
  'Moscow Mule': ['basso', 'limpido', 'menta'],
  Americano: ['basso', 'rosso', 'agrume'],
  'Casa Spritz': ['coppa', 'pesca', 'fiore'],
  'Sour della Casa': ['coppa', 'ambra', 'ciliegia'],
  'Velluto Bianco': ['hurricane', 'limpido', 'ombrellino'],
  'Cuba Libre': ['alto', 'ambra', 'agrume'],
  'Tequila Sunrise': ['hurricane', 'pesca', 'ciliegia'],
  'Virgin Mojito': ['alto', 'verde', 'menta'],
  Detox: ['alto', 'giallo', 'cannuccia'],
  'Sunrise Analcolico': ['hurricane', 'rosa', 'cannuccia'],
}
const DISEGNO_DI_CATEGORIA = {
  aperitivi: ['balloon', 'pesca', 'agrume'],
  classici: ['coppa', 'ambra', 'scorza'],
  signature: ['coppa', 'lilla', 'fiore'],
  long: ['alto', 'limpido', 'agrume'],
  analcolici: ['alto', 'verde', 'cannuccia'],
  birre: ['alto', 'giallo', 'nessuna'],
  bollicine: ['flute', 'giallo', 'nessuna'],
  shots: ['basso', 'ambra', 'nessuna'],
}
const disegnoDi = (nome, cat) => {
  const [bicchiere, colore, decorazione] = DISEGNI[nome] || DISEGNO_DI_CATEGORIA[cat] || ['coppa', 'ambra', 'nessuna']
  return { bicchiere, colore, decorazione }
}

// ── IL CATALOGO ───────────────────────────────────────────────────────
export function catalogo() {
  const categorieMagazzino = INV_CATS.map((c) => ({ id: `mag-${c.key}`, name: c.name, sort_order: c.sort_order }))
  const articoli = INV_ITEMS.map((it) => ({
    id: `art-${slug(it.name)}`,
    name: it.name,
    unit: it.unit,
    package_size: it.package_size ?? null,
    cost: it.cost ?? null,
    vat: it.vat ?? 22,
    stock: it.stock,
    bottles_total: it.package_size ? Math.ceil(it.stock / it.package_size) : 0,
    low_threshold: it.low_threshold,
    category_id: `mag-${it.cat}`,
  }))
  const perNome = Object.fromEntries(articoli.map((a) => [a.name, a]))
  const categorie = DRINK_CATS.map((c) => ({ id: `cat-${c.key}`, key: c.key, name: c.name, sort_order: c.sort_order }))
  let casa = 0
  const drink = DRINKS.map((d) => {
    const rinomina = rinominaDi(d, d.cat === 'signature' ? casa++ : -1)
    const nome = rinomina.name || d.name
    const cat = categorie.find((c) => c.key === d.cat)
    return {
      id: `drink-${slug(nome)}`,
      name: nome,
      description: rinomina.description || d.description || null,
      category: cat?.name ?? null,
      category_id: cat?.id ?? null,
      recipe: d.recipe ?? null,
      recipe_items: (d.recipe_items || [])
        .filter((r) => perNome[r.item])
        .map((r) => ({ inventory_item_id: perNome[r.item].id, name: r.item, unit: perNome[r.item].unit, qty: r.qty })),
      price: d.price,
      available: true,
      image_url: null,
      illustrazione: disegnoDi(nome, d.cat),
      // I drink della casa sono gli Special: carosello e menù Special.
      speciale: d.cat === 'signature',
    }
  })
  return { categorieMagazzino, articoli, categorie, drink }
}

const FORNITORI = [
  { id: 'forn-bevande', name: 'Bevande Rossi Distribuzione', color: '#2a6f97', famiglie: ['distillati', 'liquori', 'bollicine', 'birre'] },
  { id: 'forn-mixer', name: 'Mixer & Soft Srl', color: '#7a5195', famiglie: ['mixer', 'base'] },
  { id: 'forn-orto', name: 'Ortofrutta Verdi', color: '#3f8f4f', famiglie: ['freschi'] },
]

// ── LE IMPOSTAZIONI DEL LOCALE DI PROVA ───────────────────────────────
// Il nome, la città e il resto li porta la build (clienti/demo/venue.json):
// qui solo il comportamento. Tutti i moduli accesi, decisi qui e non da un
// server: nella demo la licenza non arriva da nessuna parte. Niente account
// clienti — la registrazione vuole Firebase Auth, che la demo non ha.
export function impostazioniDemo() {
  return {
    ...SEED_SETTINGS,
    customer_accounts_enabled: false,
    geofence_enabled: false,
    menu_only: false,
    eta_enabled: true,
    show_serving_board: true,
    special_titolo: 'Special',
    special_sottotitolo: 'I drink della casa',
    licenza: {
      piano: 'demo',
      stato: 'attiva',
      limiti: null,
      moduli: Object.fromEntries(Object.keys(MODULI_PREMIUM).map((id) => [id, true])),
    },
  }
}

// ── LE DATE ───────────────────────────────────────────────────────────
// Le giornate sono commerciali (taglio alle 5, ora di Roma): la serata di
// sabato dura fino alle 2 di domenica e resta di sabato.
const giornoPrima = (chiave, n) => {
  const [y, m, d] = chiave.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d - n)).toISOString().slice(0, 10)
}
const diSettimana = (chiave) => {
  const [y, m, d] = chiave.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0 dom … 6 sab
}
const alleOre = (chiave, ore, minuti = 0) =>
  new Date(istanteDaOraDiRoma(`${chiave}T${String(ore).padStart(2, '0')}:${String(minuti).padStart(2, '0')}`))

// Una riga di conto.
const riga = (d, qty) => ({ drink_id: d.id, name: d.name, unit_price: d.price, qty, sumup_product_id: null })
const totaleRighe = (righe) => r2(righe.reduce((s, x) => s + x.qty * x.unit_price, 0))

function scegliRighe(g, pesati, quante) {
  const righe = []
  for (let k = 0; k < quante; k++) {
    let r = g.tra(0, pesati.totale)
    let d = pesati.voci[0].d
    for (const x of pesati.voci) {
      r -= x.w
      if (r <= 0) {
        d = x.d
        break
      }
    }
    if (righe.some((x) => x.drink_id === d.id)) continue
    righe.push(riga(d, g.intero(1, 2)))
  }
  return righe
}

const metodo = (g) => {
  const r = g.caso()
  return r < 0.55 ? 'banco' : r < 0.9 ? 'carta' : 'lettore'
}

// ── TUTTI I DOCUMENTI ─────────────────────────────────────────────────
export function datiDemo({ adesso = new Date(), seme = SEME, giorniDiStorico = 28 } = {}) {
  const g = generatore(seme)
  const { categorieMagazzino, articoli, categorie, drink } = catalogo()
  const documenti = []
  const metti = (percorso, dati) => documenti.push({ percorso, dati })

  metti('settings/bar', impostazioniDemo())
  for (const c of categorieMagazzino) metti(`inventory_categories/${c.id}`, { name: c.name, sort_order: c.sort_order })
  for (const { id, ...a } of articoli) metti(`inventory_items/${id}`, a)
  for (const c of categorie) metti(`categories/${c.id}`, { name: c.name, sort_order: c.sort_order })
  for (const { id, ...d } of drink) metti(`drinks/${id}`, d)

  // Fornitori e listini: un fornitore per famiglia di articoli.
  for (const f of FORNITORI) metti(`suppliers/${f.id}`, { name: f.name, color: f.color, sort_order: FORNITORI.indexOf(f) })
  for (const a of articoli) {
    const f = FORNITORI.find((x) => x.famiglie.includes(a.category_id.replace('mag-', '')))
    if (!f || a.cost == null) continue
    metti(`supplier_prices/${f.id}__${a.id}`, {
      supplier_id: f.id,
      item_id: a.id,
      price: a.cost,
      updated_at: new Date(adesso.getTime() - 20 * 24 * 60 * MIN).toISOString(),
    })
  }

  // Popolarità stabile: pochi drink vendono molto, gli altri meno.
  const vendibili = drink.filter((d) => d.available)
  const voci = vendibili.map((d) => ({ d, w: Math.pow(g.caso(), 3) + 0.03 }))
  const pesati = { voci, totale: voci.reduce((s, x) => s + x.w, 0) }

  const oggi = businessDayKey(adesso)
  let seriale = 0
  const prep = { count: 0, attesa_ms: 0, prep_ms: 0, total_ms: 0 }
  const eta = { count: 0, attesa_ms: 0, prep_ms: 0, ritiro_ms: 0, total_ms: 0 }

  // ── Le serate passate: aperte dal mercoledì alla domenica.
  for (let n = giorniDiStorico; n >= 1; n--) {
    const giorno = giornoPrima(oggi, n)
    const dow = diSettimana(giorno)
    if (dow === 1 || dow === 2) continue
    const weekend = dow === 5 || dow === 6
    const quanti = weekend ? g.intero(34, 52) : g.intero(14, 24)
    const sessione = `cassa-${giorno}`
    const apertura = alleOre(giorno, 19, g.intero(0, 20))
    const byMethod = {}
    let incassato = 0
    let ultimo = apertura.getTime()
    let pagati = 0
    for (let i = 0; i < quanti; i++) {
      seriale += 1
      // Picco fra le 22 e mezzanotte: media di tre uniformi.
      const picco = (g.caso() + g.caso() + g.caso()) / 3
      const creato = new Date(apertura.getTime() + (30 + picco * 330) * MIN)
      const righe = scegliRighe(g, pesati, g.intero(1, 4))
      const totale = totaleRighe(righe)
      const tavolo = g.caso() < 0.7
      const t0 = creato.getTime()
      const attesa = g.tra(1, 5) * MIN
      const lavoro = g.tra(2, 8) * MIN
      const ritiro = g.tra(1, 6) * MIN
      const base = {
        daily_number: i + 1,
        serial: seriale,
        order_date: giorno,
        cash_session_id: sessione,
        table_label: tavolo ? String(g.intero(1, 14)) : null,
        note: null,
        total: totale,
        coperto_persons: 0,
        coperto_amount: 0,
        service_charge_amount: 0,
        tip_amount: 0,
        service_mode: tavolo ? 'tavolo' : 'banco',
        created_at: creato,
        items: righe,
        inventory_applied: false,
        inventory_consumption: [],
      }
      const esito = g.caso()
      if (esito > 0.96) {
        metti(`orders/storico-${giorno}-${i + 1}`, {
          ...base,
          status: 'annullato',
          status_times: { annullato: new Date(t0 + g.tra(1, 5) * MIN).toISOString() },
          cancelled_by: 'bartender',
          cancel_kind: 'ordine',
          cancel_phrase: 'bancone',
          cancel_message: null,
          cancel_notify: false,
        })
        continue
      }
      prep.count += 1
      prep.attesa_ms += attesa
      prep.prep_ms += lavoro
      prep.total_ms += attesa + lavoro
      if (tavolo) {
        eta.count += 1
        eta.attesa_ms += attesa
        eta.prep_ms += lavoro
        eta.ritiro_ms += ritiro
        eta.total_ms += attesa + lavoro + ritiro
      }
      const servito = t0 + attesa + lavoro + ritiro
      const pagato = new Date(servito + g.tra(5, 40) * MIN).toISOString()
      const m = metodo(g)
      metti(`orders/storico-${giorno}-${i + 1}`, {
        ...base,
        status: 'pagato',
        status_times: {
          in_preparazione: new Date(t0 + attesa).toISOString(),
          pronto: new Date(t0 + attesa + lavoro).toISOString(),
          ritirato: new Date(servito).toISOString(),
          pagato,
        },
        payments: [{ id: `pag-${giorno}-${i + 1}`, amount: totale, method: m, at: pagato }],
        payment_status: 'pagato',
        payment_method: m,
        paid_at: pagato,
      })
      incassato = r2(incassato + totale)
      byMethod[m] = r2((byMethod[m] || 0) + totale)
      ultimo = Math.max(ultimo, new Date(pagato).getTime())
      pagati += 1
    }
    metti(`counters/${giorno}`, { last: quanti })
    metti(`counters/cash-${sessione}`, { last: quanti })
    // La cassa della serata: il contante torna quasi sempre, non sempre.
    const fondo = g.intero(100, 150)
    const atteso = r2(fondo + (byMethod.banco || 0))
    const scarto = g.caso() < 0.25 ? g.intero(-8, 8) : 0
    const contato = r2(atteso + scarto)
    metti(`cash_sessions/${sessione}`, {
      status: 'closed',
      business_day: giorno,
      opened_at: apertura.toISOString(),
      closed_at: new Date(ultimo + 45 * MIN).toISOString(),
      opened_by: { email: 'admin@demo.invalid', name: 'Titolare (demo)' },
      closed_by: { email: 'admin@demo.invalid', name: 'Titolare (demo)' },
      fondo_cassa: fondo,
      counted_cash: contato,
      difference: r2(contato - atteso),
      note: scarto ? 'Contato a fine serata, differenza da controllare.' : null,
      snapshot: {
        incassato,
        byMethod,
        nPagati: pagati,
        apertoDaIncassare: 0,
        nAperti: 0,
        sconti: 0,
        perOra: [],
        fondo,
        contanteAtteso: atteso,
      },
    })
  }

  // ── La serata di oggi, in corso: cassa aperta da un'ora e mezza.
  const sessioneOggi = `cassa-${oggi}`
  const aperta = new Date(adesso.getTime() - 95 * MIN)
  metti(`cash_sessions/${sessioneOggi}`, {
    status: 'open',
    business_day: oggi,
    opened_at: aperta.toISOString(),
    opened_by: { email: 'admin@demo.invalid', name: 'Titolare (demo)' },
    fondo_cassa: 120,
  })
  metti('counters/_active_cash', { session_id: sessioneOggi })

  let numero = 0
  // Già pagati e chiusi.
  for (let i = 0; i < 9; i++) {
    numero += 1
    seriale += 1
    const creato = new Date(aperta.getTime() + (8 + i * 7) * MIN)
    const righe = scegliRighe(g, pesati, g.intero(1, 3))
    const totale = totaleRighe(righe)
    const pagato = new Date(creato.getTime() + g.tra(15, 30) * MIN).toISOString()
    const m = metodo(g)
    metti(`orders/oggi-${numero}`, {
      daily_number: numero,
      serial: seriale,
      order_date: oggi,
      cash_session_id: sessioneOggi,
      table_label: String(g.intero(1, 14)),
      note: null,
      total: totale,
      coperto_persons: 0,
      coperto_amount: 0,
      service_charge_amount: 0,
      tip_amount: 0,
      service_mode: 'tavolo',
      created_at: creato,
      items: righe,
      status: 'pagato',
      status_times: {
        in_preparazione: new Date(creato.getTime() + 2 * MIN).toISOString(),
        pronto: new Date(creato.getTime() + 7 * MIN).toISOString(),
        ritirato: new Date(creato.getTime() + 10 * MIN).toISOString(),
        pagato,
      },
      payments: [{ id: `pag-oggi-${numero}`, amount: totale, method: m, at: pagato }],
      payment_status: 'pagato',
      payment_method: m,
      paid_at: pagato,
      inventory_applied: false,
      inventory_consumption: [],
    })
  }
  // In coda adesso: un conto per ogni punto del lavoro.
  const APERTI = [
    { minuti: 2, stati: ['ricevuto'] },
    { minuti: 4, stati: ['ricevuto'] },
    { minuti: 7, stati: ['in_preparazione'] },
    { minuti: 9, stati: ['in_preparazione'] },
    { minuti: 13, stati: ['pronto'] },
    { minuti: 21, stati: ['ritirato', 'ricevuto'] },
    { minuti: 34, stati: ['ritirato'] },
  ]
  for (const a of APERTI) {
    numero += 1
    seriale += 1
    const creato = new Date(adesso.getTime() - a.minuti * MIN)
    const comande = a.stati.map((stato, k) => {
      const nata = new Date(creato.getTime() + k * 12 * MIN)
      const righe = scegliRighe(g, pesati, g.intero(1, 3))
      const tempi = { ricevuto: nata.toISOString() }
      if (['in_preparazione', 'pronto', 'ritirato'].includes(stato)) tempi.in_preparazione = new Date(nata.getTime() + 2 * MIN).toISOString()
      if (['pronto', 'ritirato'].includes(stato)) tempi.pronto = new Date(nata.getTime() + 6 * MIN).toISOString()
      if (stato === 'ritirato') tempi.ritirato = new Date(nata.getTime() + 9 * MIN).toISOString()
      return {
        id: `c${k + 1}`,
        seq: k + 1,
        items: righe,
        status: stato,
        status_times: tempi,
        inventory_applied: false,
        inventory_consumption: null,
        created_at: nata.toISOString(),
      }
    })
    // L'aggregato di tutte le comande, come lo scrive l'app (`items`): lo
    // usano la card in coda, il totale e lo scontrino. Lo stesso drink in
    // due giri è una riga sola, con le quantità sommate.
    const righe = []
    for (const r of comande.flatMap((c) => c.items)) {
      const gia = righe.find((x) => x.drink_id === r.drink_id)
      if (gia) gia.qty += r.qty
      else righe.push({ ...r })
    }
    metti(`orders/aperto-${numero}`, {
      daily_number: numero,
      serial: seriale,
      order_date: oggi,
      status_times: { aperto: creato.toISOString() },
      cash_session_id: sessioneOggi,
      table_label: String(g.intero(1, 14)),
      note: null,
      colore: null,
      status: 'aperto',
      comande,
      comande_statuses: comande.map((c) => c.status),
      total: totaleRighe(righe),
      coperto_persons: 0,
      coperto_amount: 0,
      service_charge_amount: 0,
      tip_amount: 0,
      service_mode: 'tavolo',
      push_token: null,
      placed_by: { email: 'staff@demo.invalid', role: 'staff', name: 'Sala (demo)', device: 'demo' },
      customer_name: null,
      customer_uid: null,
      payment_method: null,
      payment_status: 'non_richiesto',
      payment_required: false,
      group_id: null,
      group_name_snapshot: null,
      payment_id: null,
      client_temp_id: null,
      in_creazione: false,
      created_at: creato,
      items: righe,
    })
  }
  metti(`counters/cash-${sessioneOggi}`, { last: numero })
  metti(`counters/${oggi}`, { last: numero })
  metti('counters/serial', { last: seriale })
  metti('service_stats/global', { prep_stats: prep, eta_stats: eta })

  // Documenti che l'app legge uno per uno e che qui non ci sono: scritti
  // come inesistenti, così a rete spenta rispondono «non c'è».
  for (const p of ['vendite_storiche/_indice', 'settings/printer', 'pos_prefs/global']) metti(p, null)

  return documenti
}
