// =====================================================================
//  I CASI D'USO: la specifica del prodotto, come la vive chi lo usa.
//
//  requirements/casi-uso.yaml dice COSA FA CHI USA L'APP, dall'inizio alla
//  fine di un obiettivo: «incassare un conto in contanti», «caricare una
//  bolla», «ordinare dal telefono e sapere quando il drink è pronto». Ogni
//  caso d'uso si prova con un test END-TO-END nel browser, fatto come lo
//  farebbe il cliente, su un ambiente generato per il giro di prova e poi
//  eliminato; il cliente valida dopo, sul test (REQ-DEV-019).
//
//  Perché: l'utente, 09/11/2026, «non abbiamo una specifica vera del
//  prodotto». Il registro dei requisiti dice cosa fa l'app un
//  comportamento alla volta — 326 voci — e i test di sistema provano un
//  requisito alla volta: nessuno dei due dice quali sono le cose che il
//  banco, la sala, il cliente e il gestore fanno davvero, e quindi
//  nessuno le prova intere.
//
//  Qui: la lettura del registro, i controlli sui legami (usati dal test e
//  dallo script) e il documento che ne nasce, docs/specifica-prodotto.md.
// =====================================================================
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const RADICE = join(dirname(fileURLToPath(import.meta.url)), '..')
export const FILE_CASI_USO = join(RADICE, 'requirements', 'casi-uso.yaml')

export const ATTORI = ['Bartender', 'Sala', 'Cliente', 'Gestore', 'Admin']

// COME SI PROVA. Non tutto passa da un browser: la carta che esce dalla
// stampante e il lettore SumUp in mano li verifica una persona. Dirlo nel
// caso d'uso evita due errori opposti: un test e2e che finge di provare
// la stampa guardando un mock, e un caso d'uso che resta senza prova
// perché «tanto la stampante in locale non c'è».
export const MODI_DI_PROVA = {
  browser: "nel browser, con l'app e il backend (anche emulato, Functions comprese)",
  'browser-con-finti': 'nel browser, con stampante o lettore SumUp sostituiti da un finto',
  'a-mano': 'da una persona: carta stampata, lettore fisico',
}

const CAMPI_LISTA = ['passi', 'varianti', 'bisogni', 'requisiti', 'previsti', 'test_cases']

// ── Il parser ─────────────────────────────────────────────────────────
// Come per gli altri registri, niente dipendenze: si legge il sottoinsieme
// di YAML che il file usa. Rispetto a requirements.yaml c'è una cosa in
// più, le varianti, che sono un elenco di coppie quando/allora: per
// scrivere il test servono separate, la condizione da preparare e l'esito
// da controllare.
const togliVirgolette = (s) => {
  const t = s.trim()
  if (t.startsWith('"') && t.endsWith('"') && t.length >= 2) return t.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\')
  if (t.startsWith("'") && t.endsWith("'") && t.length >= 2) return t.slice(1, -1).replace(/''/g, "'")
  return t
}

// Un valore tra virgolette può andare a capo: YAML piega le righe in uno
// spazio. Si legge fino alla virgoletta che chiude.
function leggiValore(righe, i, primo, rientro) {
  const v = primo.trim()
  if (v === '>' || v === '|') {
    const parti = []
    let j = i + 1
    while (j < righe.length && (righe[j].trim() === '' || rientroDi(righe[j]) > rientro)) {
      parti.push(righe[j].trim())
      j++
    }
    while (parti.length && parti[parti.length - 1] === '') parti.pop()
    return { valore: parti.join(v === '|' ? '\n' : ' ').replace(/ {2,}/g, ' ').trim(), fine: j }
  }
  if (v.startsWith('"') && !chiusa(v)) {
    let testo = v
    let j = i + 1
    while (j < righe.length && !chiusa(testo)) {
      testo += ' ' + righe[j].trim()
      j++
    }
    return { valore: togliVirgolette(testo), fine: j }
  }
  return { valore: togliVirgolette(v), fine: i + 1 }
}

const chiusa = (s) => /^"(?:[^"\\]|\\.)*"$/.test(s.trim())
const rientroDi = (riga) => riga.length - riga.trimStart().length

export function parseCasiUso(testo) {
  const righe = testo.replace(/\r\n/g, '\n').split('\n')
  const casi = []
  let caso = null
  let i = 0
  while (i < righe.length) {
    const riga = righe[i]
    const pulita = riga.trimEnd()
    if (pulita.trim() === '' || pulita.trimStart().startsWith('#')) { i++; continue }

    const nuovo = pulita.match(/^  - id:\s*(.+)$/)
    if (nuovo) {
      caso = { id: togliVirgolette(nuovo[1]), ...Object.fromEntries(CAMPI_LISTA.map((c) => [c, []])) }
      casi.push(caso)
      i++
      continue
    }
    if (!caso) { i++; continue }

    const campo = pulita.match(/^    ([a-z_]+):\s?(.*)$/)
    if (!campo) { i++; continue }
    const [, chiave, resto] = campo

    if (CAMPI_LISTA.includes(chiave)) {
      const inLinea = resto.trim().match(/^\[(.*)\]$/)
      if (inLinea) {
        caso[chiave] = inLinea[1].split(',').map((t) => togliVirgolette(t)).filter(Boolean)
        i++
        continue
      }
      // L'elenco su più righe: voci col trattino a sei spazi. Una voce è
      // un testo o, per le varianti, una coppia di chiavi.
      i++
      const voci = []
      while (i < righe.length && (righe[i].trim() === '' || rientroDi(righe[i]) >= 6)) {
        const r = righe[i]
        if (r.trim() === '') { i++; continue }
        const voce = r.match(/^      - (.*)$/)
        if (!voce) { i++; continue }
        const coppia = voce[1].match(/^([a-z_]+):\s?(.*)$/)
        if (coppia && !voce[1].startsWith('"')) {
          const oggetto = {}
          let { valore, fine } = leggiValore(righe, i, coppia[2], 6)
          oggetto[coppia[1]] = valore
          i = fine
          let altra
          while (i < righe.length && (altra = righe[i].match(/^        ([a-z_]+):\s?(.*)$/))) {
            ;({ valore, fine } = leggiValore(righe, i, altra[2], 8))
            oggetto[altra[1]] = valore
            i = fine
          }
          voci.push(oggetto)
        } else {
          const { valore, fine } = leggiValore(righe, i, voce[1], 6)
          voci.push(valore)
          i = fine
        }
      }
      caso[chiave] = voci
      continue
    }

    const { valore, fine } = leggiValore(righe, i, resto, 4)
    caso[chiave] = valore
    i = fine
  }
  return casi
}

export const caricaCasiUso = (file = FILE_CASI_USO) =>
  existsSync(file) ? parseCasiUso(readFileSync(file, 'utf8')) : []

// ── I controlli ───────────────────────────────────────────────────────
// Un caso d'uso vale quanto i suoi legami: un requisito citato che non
// esiste, o uno ancora da fare messo tra quelli che il caso d'uso usa,
// e la specifica promette una cosa che l'app non fa. Restituisce l'elenco
// dei problemi, vuoto se è tutto a posto.
export function controllaCasiUso(casi, { requisiti, bisogni, esiste = () => true }) {
  const problemi = []
  const req = new Map(requisiti.map((r) => [r.id, r]))
  const ur = new Set(bisogni.map((b) => b.id))
  const visti = new Set()
  for (const c of casi) {
    const dove = c.id || '(senza id)'
    if (!/^UC-[A-Z]+-\d{3}$/.test(c.id || '')) problemi.push(`${dove}: l'id va scritto UC-<ZONA>-NNN`)
    if (visti.has(c.id)) problemi.push(`${dove}: id ripetuto`)
    visti.add(c.id)
    for (const campo of ['title', 'gruppo', 'attore', 'obiettivo', 'parte_da', 'esito']) {
      if (!String(c[campo] || '').trim()) problemi.push(`${dove}: manca ${campo}`)
    }
    if (c.passi.length === 0) problemi.push(`${dove}: nessun passo`)
    for (const a of String(c.attore || '').split(',').map((s) => s.trim()).filter(Boolean)) {
      if (!ATTORI.includes(a)) problemi.push(`${dove}: attore sconosciuto «${a}»`)
    }
    if (!MODI_DI_PROVA[c.si_prova]) problemi.push(`${dove}: si_prova va scelto fra ${Object.keys(MODI_DI_PROVA).join(', ')}`)
    for (const v of c.varianti) {
      if (typeof v !== 'object' || !v.quando || !v.allora) problemi.push(`${dove}: una variante va scritta con quando e allora`)
    }
    for (const id of c.bisogni) if (!ur.has(id)) problemi.push(`${dove}: il bisogno ${id} non esiste`)
    for (const id of c.requisiti) {
      const r = req.get(id)
      if (!r) problemi.push(`${dove}: il requisito ${id} non esiste`)
      else if (r.status !== 'implemented') problemi.push(`${dove}: ${id} è ${r.status}, va tra i previsti`)
    }
    for (const id of c.previsti) {
      const r = req.get(id)
      if (!r) problemi.push(`${dove}: il requisito previsto ${id} non esiste`)
      else if (!['todo', 'partial'].includes(r.status)) problemi.push(`${dove}: ${id} è ${r.status}, non è un previsto`)
    }
    for (const t of c.test_cases) if (!esiste(t)) problemi.push(`${dove}: il test ${t} non esiste`)
  }
  return problemi
}

// Quali requisiti fatti non stanno in nessun caso d'uso: la misura di
// quanto della specifica di sistema la specifica del prodotto racconta.
// Non è un errore — molti requisiti sono meccanismi che nessuno «usa» —
// ma è l'elenco da guardare quando si cerca il caso d'uso che manca.
export function requisitiFuoriDaiCasi(casi, requisiti) {
  const usati = new Set(casi.flatMap((c) => [...c.requisiti, ...c.previsti]))
  return requisiti.filter((r) => r.status === 'implemented' && !usati.has(r.id))
}

// ── Il documento ──────────────────────────────────────────────────────
// docs/specifica-prodotto.md: si legge senza sapere niente di codice. Lo
// scrive scripts/casi-uso.mjs --documento; non si tocca a mano.
export function costruisciSpecificaProdotto(casi, { requisiti, bisogni }) {
  const titoloDi = new Map([...requisiti, ...bisogni].map((v) => [v.id, v.title]))
  const gruppi = []
  for (const c of casi) {
    let g = gruppi.find((x) => x.nome === c.gruppo)
    if (!g) gruppi.push((g = { nome: c.gruppo, casi: [] }))
    g.casi.push(c)
  }
  const provati = casi.filter((c) => c.test_cases.length > 0).length
  const fuori = requisitiFuoriDaiCasi(casi, requisiti)
  const ancora = (id) => id.toLowerCase()

  const r = []
  r.push('# Specifica del prodotto — i casi d\'uso')
  r.push('')
  r.push('> Documento **generato** da `requirements/casi-uso.yaml` con')
  r.push('> `node scripts/casi-uso.mjs --documento`. Non si modifica a mano: si')
  r.push('> modifica il registro e si rigenera.')
  r.push('')
  r.push('Cosa fa chi usa Tana Drink, un obiettivo alla volta, dall\'inizio alla')
  r.push('fine. Ogni caso d\'uso si prova con un test end-to-end nel browser, fatto')
  r.push('come lo farebbe chi sta al banco, su un ambiente di prova generato per')
  r.push('l\'occasione; il gestore lo valida poi sul sito di test.')
  r.push('')
  r.push(`**${casi.length} casi d'uso** in ${gruppi.length} gruppi, ${provati} con il test end-to-end.`)
  r.push(`${fuori.length} requisiti fatti non compaiono in nessun caso d'uso (elenco in fondo).`)
  r.push('')
  r.push('## Indice')
  r.push('')
  for (const g of gruppi) {
    r.push(`- **${g.nome}**`)
    for (const c of g.casi) r.push(`  - [${c.id} — ${c.title}](#${ancora(c.id)})${c.test_cases.length ? ' ✅' : ''}`)
  }
  r.push('')
  for (const g of gruppi) {
    r.push(`## ${g.nome}`)
    r.push('')
    for (const c of g.casi) {
      r.push(`<a id="${ancora(c.id)}"></a>`)
      r.push(`### ${c.id} — ${c.title}`)
      r.push('')
      r.push(`**Chi:** ${c.attore} · **Si prova:** ${MODI_DI_PROVA[c.si_prova] || c.si_prova}`)
      r.push('')
      r.push(`**Obiettivo.** ${c.obiettivo}`)
      r.push('')
      r.push(`**Si parte da.** ${c.parte_da}`)
      r.push('')
      c.passi.forEach((p, n) => r.push(`${n + 1}. ${p}`))
      r.push('')
      r.push(`**Esito.** ${c.esito}`)
      r.push('')
      if (c.varianti.length) {
        r.push('**Varianti**')
        r.push('')
        for (const v of c.varianti) r.push(`- *${v.quando}* — ${v.allora}`)
        r.push('')
      }
      const legami = []
      if (c.bisogni.length) legami.push(`Bisogni: ${c.bisogni.map((id) => `${id} (${titoloDi.get(id) || '?'})`).join('; ')}`)
      if (c.requisiti.length) legami.push(`Requisiti: ${c.requisiti.join(', ')}`)
      if (c.previsti.length) legami.push(`Previsti, non ancora fatti: ${c.previsti.join(', ')}`)
      legami.push(c.test_cases.length ? `Test e2e: ${c.test_cases.map((t) => `\`${t}\``).join(', ')}` : 'Test e2e: da scrivere')
      for (const l of legami) r.push(`- ${l}`)
      r.push('')
    }
  }
  r.push('## Requisiti fatti che nessun caso d\'uso racconta')
  r.push('')
  r.push('Meccanismi interni o comportamenti che aspettano il loro caso d\'uso.')
  r.push('')
  for (const q of fuori) r.push(`- ${q.id} — ${q.title}`)
  r.push('')
  return r.join('\n')
}
