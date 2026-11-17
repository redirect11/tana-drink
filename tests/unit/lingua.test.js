// @vitest-environment happy-dom
// I TESTI IN DUE LINGUE (REQ-UI-038).
//
// Daniele, 17/11/2026: «da oggi tutte le funzioni dovranno avere testi in
// italiano ed inglese». La regola vale solo se qualcosa la fa rispettare:
// questa prova legge i sorgenti e boccia ogni testo passato da `tr` (o
// segnato con `daTradurre`) che non ha la sua riga nel dizionario inglese — e, al
// contrario, le righe che nessuno usa più, che a forza di accumularsi
// farebbero del dizionario un archivio di testi morti.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import en, { AREE } from '../../src/lib/testi/en/index.js'

// ── LA PROVA SUI SORGENTI ─────────────────────────────────────────────

function sorgenti(cartella) {
  const fuori = []
  for (const voce of fs.readdirSync(cartella, { withFileTypes: true })) {
    const pieno = path.join(cartella, voce.name)
    if (voce.isDirectory()) {
      if (voce.name !== 'testi') fuori.push(...sorgenti(pieno))
    } else if (/\.(js|jsx)$/.test(voce.name)) fuori.push(pieno)
  }
  return fuori
}

// Senza commenti: lì si spiega il meccanismo, e `tr('testo')` scritto in
// un commento non è un testo a schermo. Un commento comincia a inizio riga,
// dopo una graffa o dopo uno spazio (vedi testiImpostazioni.test.js).
const senzaCommenti = (s) =>
  s.replace(/(^|[{\s])\/\*[\s\S]*?\*\/\s*\}?/gm, '$1').replace(/(^|\s)\/\/.*$/gm, '$1')

// Le sequenze di escape che si incontrano davvero in un testo fra apici.
const testoDelLetterale = (s) => s.replace(/\\(['"`\\])/g, '$1').replace(/\\n/g, '\n')

// `tr(` e `daTradurre(` come chiamate, non `function tr(` né `oggetto.tr(` né
// `str(` / `trSegnato(` (che accetta un valore calcolato, e lo dice).
const CHIAMATA = /(?<![\w$.])(?<!function\s+)(tr|daTradurre)\(\s*/g
// Il testo fra apici, e DOPO solo la virgola o la parentesi: un `+` dopo
// vorrebbe dire una chiave diversa da quella che arriva a schermo.
const LETTERALE = /^(['"`])((?:\\.|(?!\1)[^\\])*)\1(?=\s*[,)])/

function letturaDiUnaChiamata(testo, m) {
  const dopo = testo.slice(m.index + m[0].length)
  const lett = dopo.match(LETTERALE)
  if (!lett || (lett[1] === '`' && lett[2].includes('${'))) return null
  return testoDelLetterale(lett[2])
}

function chiamate() {
  const trovate = []
  const sbagliate = []
  const importSbagliati = []
  for (const file of sorgenti(path.resolve('src'))) {
    const testo = senzaCommenti(fs.readFileSync(file, 'utf8'))
    const qui = path.relative(process.cwd(), file)
    for (const m of testo.matchAll(CHIAMATA)) {
      const chiave = letturaDiUnaChiamata(testo, m)
      const dove = `${qui}: ${m[0]}${testo.slice(m.index + m[0].length, m.index + m[0].length + 60).split('\n')[0]}`
      if (chiave == null) sbagliate.push(dove)
      else trovate.push({ testo: chiave, dove })
    }
    // Un altro nome per `tr` (o tutto il modulo sotto un nome) e la prova
    // non vedrebbe più le chiamate.
    for (const imp of testo.matchAll(/import\s+([^;]*?)\s+from\s+['"][^'"]*\/lingua\.js['"]/g)) {
      if (/\*\s+as|\b(tr|daTradurre)\s+as\b/.test(imp[1])) importSbagliati.push(`${qui}: ${imp[0]}`)
    }
  }
  return { trovate, sbagliate, importSbagliati }
}

const segnaposti = (s) => [...s.matchAll(/\{([^{}\s]+)\}/g)].map((m) => m[1]).sort()

describe('ogni testo ha la sua traduzione inglese (REQ-UI-038)', () => {
  const { trovate, sbagliate, importSbagliati } = chiamate()

  it('tr e daTradurre si chiamano con un testo scritto lì, fra apici, e basta', () => {
    // Un testo calcolato la prova non lo vedrebbe: si scrive tr('…') dove
    // il testo nasce, e i valori variabili vanno nei segnaposti.
    expect(sbagliate).toEqual([])
  })

  it('tr e daTradurre si importano col loro nome', () => {
    expect(importSbagliati).toEqual([])
  })

  it('nessun testo senza traduzione', () => {
    const mancanti = trovate.filter((c) => !Object.hasOwn(en, c.testo)).map((c) => c.dove)
    expect(mancanti).toEqual([])
  })

  it('nessuna traduzione che nessuno usa più', () => {
    const usati = new Set(trovate.map((c) => c.testo))
    expect(Object.keys(en).filter((k) => !usati.has(k))).toEqual([])
  })

  it('un testo sta in un’area sola', () => {
    const viste = new Map()
    const doppie = []
    for (const [area, testi] of Object.entries(AREE)) {
      for (const k of Object.keys(testi)) {
        if (viste.has(k)) doppie.push(`${k} (${viste.get(k)}, ${area})`)
        viste.set(k, area)
      }
    }
    expect(doppie).toEqual([])
  })

  it('i segnaposti dell’inglese sono quelli dell’italiano, coi nomi senza accenti', () => {
    const storti = Object.entries(en)
      .filter(([it, eng]) => segnaposti(it).join() !== segnaposti(eng).join())
      .map(([it]) => it)
    expect(storti).toEqual([])
    const accentati = Object.keys(en).filter((k) => segnaposti(k).some((n) => !/^[A-Za-z0-9_]+$/.test(n)))
    expect(accentati).toEqual([])
  })

  it('una traduzione non è vuota', () => {
    expect(Object.entries(en).filter(([, eng]) => !String(eng).trim()).map(([it]) => it)).toEqual([])
  })

  it('la prova se ne accorge davvero', () => {
    const finto = senzaCommenti(`
      // tr('in un commento non conta')
      const a = tr('Conto chiuso')
      const b = tr(variabile)
      const c = tr(\`Ordine \${n}\`)
      const d = tr('Ordine ' + n)
      const e = daTradurre('Pronto')
      const f = tr('Ordine #{n}', { n })
      export function tr(testo) {}
      const g = str('non è tr')
      const h = trSegnato(STATI[s])
    `)
    const viste = [...finto.matchAll(CHIAMATA)].map((m) => letturaDiUnaChiamata(finto, m))
    expect(viste).toEqual(['Conto chiuso', null, null, null, 'Pronto', 'Ordine #{n}'])
  })
})

// ── IL FUNZIONAMENTO ──────────────────────────────────────────────────

describe('tr e la lingua attiva', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
    vi.doMock('../../src/lib/testi/en/index.js', () => ({
      default: {
        'Conto chiuso': 'Bill closed',
        'Ordine #{n} pronto': 'Order #{n} ready',
        'ordinamento|Ordine': 'Sort',
        Pronto: 'Ready',
      },
      AREE: {},
    }))
  })

  const carica = () => import('../../src/lib/lingua.js')

  it('di partenza è italiano, e il testo resta quello scritto', async () => {
    const { tr, linguaAttiva } = await carica()
    expect(linguaAttiva()).toBe('it')
    expect(tr('Conto chiuso')).toBe('Conto chiuso')
  })

  it('in inglese si legge la traduzione, coi valori al loro posto', async () => {
    const { tr, impostaLingua } = await carica()
    impostaLingua('en')
    expect(tr('Conto chiuso')).toBe('Bill closed')
    expect(tr('Ordine #{n} pronto', { n: 12 })).toBe('Order #12 ready')
  })

  it('il contesto non si legge in italiano, e in inglese sceglie la parola giusta', async () => {
    const { tr, impostaLingua } = await carica()
    expect(tr('ordinamento|Ordine')).toBe('Ordine')
    impostaLingua('en')
    expect(tr('ordinamento|Ordine')).toBe('Sort')
  })

  it('senza traduzione si vede l’italiano, non un buco', async () => {
    const { tr, impostaLingua } = await carica()
    impostaLingua('en')
    expect(tr('Testo nuovo')).toBe('Testo nuovo')
    // e i nomi di ogni oggetto JavaScript non sono traduzioni
    expect(tr('constructor')).toBe('constructor')
    expect(tr('toString', { n: 1 })).toBe('toString')
  })

  it('le etichette segnate si traducono dove si mostrano, nella lingua di quel momento', async () => {
    const { daTradurre, trSegnato, impostaLingua } = await carica()
    const STATI = { pronto: daTradurre('Pronto') }
    expect(trSegnato(STATI.pronto)).toBe('Pronto')
    impostaLingua('en')
    expect(trSegnato(STATI.pronto)).toBe('Ready')
    expect(trSegnato(undefined)).toBeUndefined()
  })

  // REQ-CLI-010: la lingua è di chi lavora. Su una pagina dei clienti — il
  // menù, «Mostra al cliente» sul tablet girato — si legge l'italiano, che
  // poi traduce il browser di chi guarda, anche se lo staff ha scelto
  // l'inglese. Lo decide l'app (App.jsx), non il componente.
  it('su una pagina dei clienti si legge l’italiano, qualunque sia la lingua scelta', async () => {
    const { tr, impostaLingua, impostaPaginaCliente, linguaInUso, formatoAttivo } = await carica()
    impostaLingua('en')
    impostaPaginaCliente(true)
    expect(tr('Conto chiuso')).toBe('Conto chiuso')
    expect(linguaInUso()).toBe('it')
    expect(formatoAttivo()).toBe('it-IT')
    impostaPaginaCliente(false)
    expect(tr('Conto chiuso')).toBe('Bill closed')
    expect(formatoAttivo()).toBe('en-GB')
  })

  it('la scelta si ricorda sul dispositivo', async () => {
    let lingua = await carica()
    lingua.impostaLingua('en')
    vi.resetModules()
    lingua = await carica()
    expect(lingua.linguaAttiva()).toBe('en')
  })

  it('una lingua che non c’è non cambia niente', async () => {
    const { impostaLingua, linguaAttiva } = await carica()
    impostaLingua('xx')
    expect(linguaAttiva()).toBe('it')
  })

  it('chi ascolta viene avvisato del cambio, e smette quando se ne va', async () => {
    const { impostaLingua, ascoltaLingua } = await carica()
    const avvisi = []
    const smetti = ascoltaLingua(() => avvisi.push('cambio'))
    impostaLingua('en')
    impostaLingua('en') // la stessa lingua non è un cambio
    smetti()
    impostaLingua('it')
    expect(avvisi).toEqual(['cambio'])
  })
})
