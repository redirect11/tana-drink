// =====================================================================
//  LA SPECIFICA DI SISTEMA, COSTRUITA DAI DUE REGISTRI.
//
//  QUESTO NON È PIÙ L'ELENCO DEI REQUISITI. L'elenco sta in
//  requirements/requirements.yaml e su GitHub, che è dove si lavora;
//  ricopiarlo tale e quale in un markdown non serviva a nessuno, e
//  infatti docs/requisiti.md era rimasto indietro di quasi cento voci
//  senza che se ne accorgesse nessuno.
//
//  Quello che mancava è una SPECIFICA: un posto dove si legge cosa fa il
//  sistema, per aree, in italiano, senza aprire il codice. Da qui la
//  forma:
//
//    · si racconta prima quello che l'app FA — «implemented», più la
//      parte fatta delle «partial» — perché è a quello che uno si affida;
//    · quello che è ancora DA FARE sta in un capitolo suo, «Lavori
//      previsti»: è un impegno, non una descrizione, e mescolarlo al
//      resto farebbe leggere come esistente della roba che non esiste;
//    · ogni comportamento cita I TEST CHE LO DIMOSTRANO. È il patto del
//      progetto: i test sono la specifica eseguibile, il documento ne è
//      la faccia leggibile, e quando le due si scollano è il documento ad
//      avere torto;
//    · i difetti noti aperti (requirements/bugs.yaml) stanno in fondo:
//      sono i punti in cui il sistema NON fa quello che c'è scritto
//      sopra, e tacerli renderebbe bugiarda tutta la parte precedente.
//
//  Resta GENERATO, e sta in un modulo suo per due motivi: scriverlo a
//  mano lo farebbe tornare vecchio in una settimana (è già successo), e
//  la resa così si può provare con un registro finto invece che con i
//  187 requisiti veri — vedi tests/unit/specifica.test.js.
// =====================================================================

// Stato di copertura di una voce del registro.
export function copertura(r) {
  if (r.status === 'deprecated') return 'deprecato'
  if (r.status === 'todo') return 'da-fare'
  if (r.status === 'partial') return 'parziale'
  return r.test_cases.length > 0 ? 'coperto' : 'scoperto'
}

export const SEGNO = {
  coperto: '✅',
  scoperto: '⚠️ ',
  parziale: '🟡',
  'da-fare': '⬜',
  deprecato: '🗑',
}
export const NOME = {
  coperto: 'fatto e coperto dai test',
  scoperto: 'fatto ma nessun test lo verifica',
  parziale: 'fatto a metà',
  'da-fare': 'da fare',
  deprecato: 'non più valido',
}

// Area di appartenenza dal prefisso dell'id (REQ-POS-001 → POS).
export const gruppo = (r) => (r.id.split('-')[1] || 'ALTRO').toUpperCase()

export const TITOLI = {
  ORD: 'Ordini e comande',
  POS: 'Cassa e POS',
  PAG: 'Pagamenti',
  CODA: 'La coda del banco',
  CASSA: 'Cassa di serata e statistiche',
  MAG: 'Magazzino',
  MENU: 'Menù e catalogo',
  GRP: 'Gruppi di conti',
  TAVOLI: 'Tavoli',
  STAFF: 'Persone: ruoli, utenze, ore',
  CLI: 'Vista cliente',
  STAMPA: 'Stampa',
  NOTIF: 'Notifiche',
  AVVISI: 'Avvisi a schermo',
  OFFLINE: 'Si lavora anche senza rete',
  DATI: 'Dati e ambienti',
  SIC: 'Sicurezza',
  UI: 'Interfaccia',
  AI: 'Intelligenza artificiale',
  DEV: 'Come si lavora al progetto',
  SUMUP: 'Integrazione SumUp',
}

// UNA RIGA PER DIRE DI COSA PARLA UN CAPITOLO. Serve a chi apre il
// documento senza sapere cosa sia un «conto» qui dentro: l'elenco delle
// voci da solo non lo dice, e un'area senza presentazione si legge come
// un mucchio di frasi staccate.
export const PRESENTAZIONI = {
  ORD: 'Il conto e le sue comande: come nascono, come cambiano stato, come arrivano al banco.',
  POS: 'La schermata più usata della serata: si compone un conto, si corregge, si chiude.',
  PAG: 'Come si incassa: contanti, carta, SumUp, pagamenti parziali e separati.',
  CODA: 'Quello che il banco vede mentre lavora: cosa c’è da fare adesso, e in che ordine.',
  CASSA: 'La serata vista dai numeri: incassi, chiusura, statistiche, conti del locale.',
  MAG: 'Prodotti, ricette, scorte e consumi. Le quantità sono sempre in unità base.',
  MENU: 'Il listino: drink, categorie, disponibilità, prezzi.',
  GRP: 'Più conti che vanno insieme — un tavolo, una comitiva — senza fonderli in uno.',
  TAVOLI: 'L’anagrafica dei tavoli e il modo in cui un ordine ci si aggancia.',
  STAFF: 'Chi può fare cosa, chi è al banco, quante ore ha fatto e quanto prende.',
  CLI: 'Quello che vede il cliente: vetrina, menù, stato del suo ordine.',
  STAMPA: 'La stampante termica al banco: comande, scontrini, chiusure di cassa.',
  NOTIF: 'Le notifiche push: a chi arrivano, quando, e quando invece non devono arrivare.',
  AVVISI: 'I messaggi a schermo dentro l’app — quelli che si leggono col vassoio in mano.',
  OFFLINE: 'Cosa continua a funzionare quando la rete non c’è, e come lo si vede.',
  DATI: 'Il modello dei dati, gli ambienti (test e produzione) e il modo di travasarli.',
  SIC: 'Regole di accesso, App Check, e cosa protegge cosa.',
  UI: 'Le regole dell’interfaccia: tema, navigazione, spazi, cosa si vede e cosa si toglie.',
  AI: 'Dove l’intelligenza artificiale entra nel lavoro del locale.',
  DEV: 'Non è comportamento dell’app: è il metodo con cui la si costruisce.',
  SUMUP: 'Il dialogo con il terminale SumUp, dalle Cloud Functions.',
}

// L'ORDINE DEI CAPITOLI È QUELLO DELLA SERATA, non quello in cui i
// requisiti sono stati scritti: si prende un ordine, si compone il conto,
// si incassa, e solo dopo vengono menù, magazzino e tutto il resto. Chi
// legge per capire come funziona il locale segue quel filo. Un'area che
// non compare qui finisce in fondo invece di sparire.
export const ORDINE = [
  'ORD', 'POS', 'PAG', 'CODA', 'GRP', 'TAVOLI',
  'MENU', 'MAG', 'CASSA',
  'STAMPA', 'CLI', 'NOTIF', 'AVVISI',
  'STAFF', 'SIC', 'OFFLINE', 'DATI', 'SUMUP', 'AI',
  'UI', 'DEV',
]

// A CAPO DOVE IL REGISTRO CAMBIA ARGOMENTO. Il parser incolla la
// descrizione in una riga sola (il sottoinsieme di YAML che leggiamo è
// minimo apposta), e una voce lunga diventa un muro di testo che non si
// legge. Nel registro i cambi di argomento si scrivono da sempre allo
// stesso modo — «DECISO (19/08)», «DA FARE:», «PERCHÉ SI SPOSTA» — cioè
// con una o più parole in maiuscolo in testa alla frase: si spezza lì.
//
// Le due forme si riconoscono in modo diverso apposta. Due parole
// maiuscole di fila non capitano per caso. Una sola invece sì — IVA, POS,
// SIAE sono sigle in mezzo al discorso — e per non spezzare a ogni sigla
// si chiede che sia lunga almeno cinque lettere: «FATTO», «DECISO»,
// «RIPENSATO» passano, le sigle no. Un a capo di troppo non fa danno, uno
// in meno rimette il muro di testo.
//
// Il «1)» di un elenco numerato resta attaccato alla voce che apre, non
// alla riga precedente: quando il registro elenca (i quattro vincoli del
// travaso, le cinque domande dei lotti) senza questo la numerazione
// finiva orfana in fondo al paragrafo prima.
const MAIUSCOLA = '[A-ZÀ-ÖØ-Þ]'
const PAROLA_MAIUSCOLA = `${MAIUSCOLA}${MAIUSCOLA}+[,:;]?`
const NUMERO_DI_ELENCO = '(?:\\d+\\)\\s+)?'
const ATTACCO_MAIUSCOLO = new RegExp(
  `(?<=[.:;!?»] )(?=${NUMERO_DI_ELENCO}(?:(?:${PAROLA_MAIUSCOLA}\\s+)+${MAIUSCOLA}|${MAIUSCOLA}{5,}[,:;]?(?:\\s|$)))`,
  'g'
)
export const inParagrafi = (testo) =>
  String(testo || '')
    .split(ATTACCO_MAIUSCOLO)
    .map((p) => p.trim())
    .filter(Boolean)

// L'ancora che GitHub costruisce da un titolo, per poterci puntare
// dall'indice: minuscolo, via la punteggiatura, e OGNI spazio diventa un
// trattino — anche quando sono due di fila. È il caso di «BUG-038 — Il
// tal problema»: tolta la lineetta restano due spazi, e l'ancora giusta
// ha due trattini. Collassandoli il collegamento non porta da nessuna
// parte, e nessuno se ne accorge finché non lo clicca.
export const ancora = (t) =>
  t.toLowerCase().replace(/[^\p{L}\p{N} -]/gu, '').replace(/ /g, '-')

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']
export const dataItaliana = (d = new Date()) =>
  `${d.getDate()} ${MESI[d.getMonth()]} ${d.getFullYear()}`

const FATTO = ['coperto', 'scoperto', 'parziale']

/**
 * Il documento, in markdown.
 *
 * @param requisiti  le voci di requirements.yaml
 * @param bug        le voci di bugs.yaml (solo le aperte finiscono dentro)
 * @param data       quando è stato generato — passabile per poterlo provare
 */
export function costruisciSpecifica(requisiti, { bug = [], data = new Date() } = {}) {
  const righe = []
  const scrivi = (...r) => righe.push(...r, '')

  const conteggi = {}
  for (const r of requisiti) {
    const c = copertura(r)
    conteggi[c] = (conteggi[c] || 0) + 1
  }

  // Le aree presenti, nell'ordine della serata; quelle che ORDINE non
  // conosce vanno in coda invece di sparire.
  const presenti = [...new Set(requisiti.map(gruppo))]
  const aree = [
    ...ORDINE.filter((a) => presenti.includes(a)),
    ...presenti.filter((a) => !ORDINE.includes(a)),
  ]
  const titoloArea = (a) => TITOLI[a] ?? a

  const fatti = requisiti.filter((r) => FATTO.includes(copertura(r)))
  const previsti = requisiti.filter((r) => copertura(r) === 'da-fare')
  const deprecati = requisiti.filter((r) => copertura(r) === 'deprecato')
  const bugAperti = bug.filter((b) => b.status === 'todo')

  // ── Testata ────────────────────────────────────────────────────────
  scrivi('# Tana Drink — specifica di sistema')
  scrivi(
    '> **Questo file è generato: non si modifica a mano.** Si modificano',
    '> `requirements/requirements.yaml` (i comportamenti) e',
    '> `requirements/bugs.yaml` (i difetti), poi si rigenera con',
    '> `node scripts/requisiti.mjs --documento`.',
    '>',
    `> Generato il ${dataItaliana(data)}.`
  )
  scrivi(
    'Qui c\'è scritto **cosa fa Tana Drink**, area per area: la cassa di «La Tana',
    'del Coniglio», quella che si usa al banco mentre il locale è pieno. Non è un',
    'manuale d\'uso e non è documentazione del codice — è il patto su come il',
    'sistema si deve comportare.'
  )
  scrivi(
    'Ogni comportamento porta **i test che lo dimostrano**. È la regola della',
    'casa: i test sono la specifica eseguibile, questo documento ne è la faccia',
    'leggibile, e quando le due si scollano è il documento ad avere torto. Il',
    'legame lo tiene `tests/unit/requisiti.test.js`: un test senza requisito fa',
    'fallire la suite, e un requisito che cita un test inesistente pure.'
  )

  // ── A che punto siamo ──────────────────────────────────────────────
  scrivi('## A che punto siamo')
  righe.push('| | Quante | Cosa vuol dire |', '|---|---|---|')
  for (const k of ['coperto', 'scoperto', 'parziale', 'da-fare', 'deprecato']) {
    if (!conteggi[k]) continue
    righe.push(`| ${SEGNO[k]} | ${conteggi[k]} | ${NOME[k]} |`)
  }
  righe.push('')
  scrivi(
    `**${requisiti.length} voci** in tutto. **${fatti.length}** descrivono il sistema com'è oggi e`,
    `stanno in «[Cosa fa il sistema](#cosa-fa-il-sistema)»; **${previsti.length}** sono lavori`,
    'previsti e stanno in un capitolo a parte, perché un impegno preso non è una',
    `cosa che l'app fa${bugAperti.length ? `; **${bugAperti.length}** difetti noti sono ancora aperti` : ''}.`
  )
  scrivi(
    'Le voci ⚠️ sono la parte scomoda: funzionano, ma **nessun test le tiene**.',
    'Sono quelle che si rompono senza che nessuno se ne accorga, e vanno lette',
    'come «vero oggi», non come «garantito».'
  )

  // ── Indice ─────────────────────────────────────────────────────────
  scrivi('### Le aree')
  righe.push('| Area | Fatto | Previsto | Di cosa parla |', '|---|---|---|---|')
  for (const area of aree) {
    const dellArea = requisiti.filter((r) => gruppo(r) === area)
    const f = dellArea.filter((r) => FATTO.includes(copertura(r))).length
    const d = dellArea.filter((r) => copertura(r) === 'da-fare').length
    // Un'area fatta di soli deprecati non ha nessun capitolo dove
    // atterrare, e metterla qui vorrebbe dire un collegamento che non
    // porta da nessuna parte: si vedrebbe solo cliccandolo.
    if (!f && !d) continue
    const t = titoloArea(area)
    righe.push(`| [${t}](#${ancora(t)}) | ${f || '—'} | ${d || '—'} | ${PRESENTAZIONI[area] ?? ''} |`)
  }
  righe.push('')

  // Una voce, per intero. `prove` a false per i lavori previsti e per i
  // difetti: un test che dimostri una cosa non ancora scritta non
  // esiste, e ripeterlo a ogni voce sarebbe solo rumore.
  const voce = (r, { prove = true } = {}) => {
    scrivi(`#### ${r.id} — ${r.title}`)
    if (copertura(r) === 'parziale') {
      scrivi(`${SEGNO.parziale} **Fatto a metà**: la descrizione dice anche cosa manca.`)
    }
    for (const p of inParagrafi(r.description)) scrivi(p)
    const meta = [`**Dove**: \`${r.area}\``]
    if (prove) {
      meta.push(r.test_cases.length
        ? `**Lo dimostrano**: ${r.test_cases.map((t) => `\`${t}\``).join(', ')}`
        : `${SEGNO.scoperto.trim()} **Nessun test lo verifica.**`)
    }
    scrivi(meta.join(' · '))
  }

  // ── Cosa fa il sistema ─────────────────────────────────────────────
  scrivi('## Cosa fa il sistema')
  scrivi(
    'Quello che segue è vero adesso. Dove una voce è segnata 🟡 «fatto a metà» la',
    'sua descrizione dice anche cosa manca: si è preferito tenerla intera invece',
    'di spezzarla in due mezze verità.'
  )
  for (const area of aree) {
    const dellArea = fatti.filter((r) => gruppo(r) === area)
    if (!dellArea.length) continue
    scrivi(`### ${titoloArea(area)}`)
    if (PRESENTAZIONI[area]) scrivi(PRESENTAZIONI[area])
    for (const r of dellArea) voce(r)
  }

  // ── Lavori previsti ────────────────────────────────────────────────
  if (previsti.length) {
    scrivi('## Lavori previsti')
    scrivi(
      'Roba decisa e non ancora scritta. **Non è quello che il sistema fa**: sta',
      'qui sotto e non sopra apposta. Da queste voci nascono le issue su GitHub',
      '(`scripts/generate-issues.mjs`), ed è lì che si lavorano.'
    )
    for (const area of aree) {
      const dellArea = previsti.filter((r) => gruppo(r) === area)
      if (!dellArea.length) continue
      scrivi(`### ${titoloArea(area)}`)
      for (const r of dellArea) voce(r, { prove: false })
    }
  }

  // ── Difetti noti ───────────────────────────────────────────────────
  if (bugAperti.length) {
    scrivi('## Difetti noti')
    scrivi(
      'I punti in cui il sistema **non fa** quello che c\'è scritto sopra. Stanno',
      'in `requirements/bugs.yaml`, e sono qui perché una specifica che tace i',
      'guai conosciuti fa sembrare garantito quello che non lo è. Quando uno viene',
      'sistemato passa a `fixed` nel registro e sparisce da questo elenco: la prova',
      'della correzione è il test citato nel requisito della sua area.'
    )
    righe.push('| | Cosa non va | Quanto fa male | Quando |', '|---|---|---|---|')
    for (const b of bugAperti) {
      const dove = b.in_produzione === true ? '🔴' : b.in_produzione === false ? '·' : '?'
      const link = `[${b.id}](#${ancora(`${b.id} — ${b.title}`)})`
      righe.push(`| ${dove} | ${link} — ${b.title} | ${b.severity ?? '—'} | ${b.priority ?? '—'} |`)
    }
    righe.push('')
    scrivi('🔴 succede **in produzione**, cioè al banco. `·` no. `?` non si sa ancora.')
    scrivi('### I difetti, uno per uno')
    for (const b of bugAperti) voce(b, { prove: false })
  }

  // ── Fuori specifica ────────────────────────────────────────────────
  if (deprecati.length) {
    scrivi('## Non più valido')
    scrivi(
      'Voci che descrivevano il sistema e non lo descrivono più. Restano nel',
      'registro perché cancellarle vorrebbe dire riproporle fra sei mesi come idee',
      'nuove, ma **non sono specifica**: qui c\'è solo il titolo.'
    )
    for (const r of deprecati) righe.push(`- \`${r.id}\` — ${r.title}`)
    righe.push('')
  }

  return righe.join('\n')
}
