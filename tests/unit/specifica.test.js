'use strict'

// LA SPECIFICA DI SISTEMA SI GENERA, E DEVE RESTARE UNA SPECIFICA.
//
// docs/requisiti.md era lo specchio del registro, e come tutti gli specchi
// scritti a mano era rimasto indietro: 94 voci raccontate su 187 esistenti,
// per mesi, senza che nessuno se ne accorgesse. Adesso è generato — ma
// «generato» da solo non basta: la forma è quello che lo rende utile, e la
// forma si può rompere in silenzio.
//
// Qui si prova con un registro finto, sette voci in tutto, perché le
// duecento vere cambiano ogni settimana e un test che le legge finisce per
// provare il registro invece del documento.

import { describe, it, expect } from 'vitest'
import { costruisciSpecifica, inParagrafi, ancora, copertura } from '../../scripts/lib-specifica.mjs'

const voce = (v) => ({
  id: 'REQ-POS-001', title: 'Un titolo', area: 'src/lib/x.js',
  description: 'Una descrizione qualsiasi.', status: 'implemented',
  test_cases: [], labels: [], severity: null, priority: null, in_produzione: null,
  ...v,
})

const REGISTRO = [
  voce({ id: 'REQ-POS-001', title: 'Il conto si compone al volo', test_cases: ['tests/unit/pos.test.js'] }),
  voce({ id: 'REQ-POS-002', title: 'Il conto non si perde', test_cases: [] }),
  voce({ id: 'REQ-MAG-001', title: 'Le scorte si scalano dallo snapshot', test_cases: ['tests/unit/mag.test.js'] }),
  voce({ id: 'REQ-MAG-002', title: 'I lotti hanno una data', status: 'todo' }),
  voce({ id: 'REQ-UI-001', title: 'La barra sta su una riga', status: 'partial', test_cases: ['tests/unit/ui.test.js'] }),
  voce({ id: 'REQ-ORD-001', title: 'Una cosa che non si fa più', status: 'deprecated' }),
  voce({ id: 'REQ-ZZZ-001', title: 'Un’area che nessuno ha battezzato', test_cases: ['tests/unit/zzz.test.js'] }),
]

const BUG = [
  voce({ id: 'BUG-001', title: 'Il totale sbaglia di un centesimo', status: 'todo', severity: 'grave', priority: 'P1', in_produzione: true }),
  voce({ id: 'BUG-002', title: 'Un guaio già sistemato', status: 'fixed' }),
]

const doc = costruisciSpecifica(REGISTRO, { bug: BUG, data: new Date(2026, 7, 19) })
const capitoli = doc.split('\n').filter((r) => r.startsWith('## ')).map((r) => r.slice(3))

describe('la specifica di sistema', () => {
  it('dice in testa che è generata, e come si rigenera', () => {
    // Senza questo avviso qualcuno la corregge a mano, e la correzione
    // sparisce alla prima rigenerazione: è il modo migliore per far
    // smettere di fidarsi del documento.
    expect(doc).toContain('non si modifica a mano')
    expect(doc).toContain('node scripts/requisiti.mjs --documento')
    expect(doc).toContain('Generato il 19 agosto 2026')
  })

  it('ha i capitoli nell’ordine che serve: prima cosa fa, poi cosa manca', () => {
    // L'ordine non è estetica. Chi apre il documento vuole sapere a cosa
    // può affidarsi: se i lavori previsti stessero in mezzo si leggerebbe
    // come esistente roba che non esiste.
    expect(capitoli).toEqual([
      'A che punto siamo',
      'Cosa fa il sistema',
      'Lavori previsti',
      'Difetti noti',
      'Non più valido',
    ])
  })

  it('conta le voci, e i conti sono quelli del registro', () => {
    expect(doc).toContain('**7 voci** in tutto')
    expect(doc).toContain('**5** descrivono il sistema')   // 3 fatti + 1 scoperto + 1 parziale
    expect(doc).toContain('**1** sono lavori')
    expect(doc).toContain('**1** difetti noti sono ancora aperti')
  })

  it('mette le aree nell’ordine della serata, e quelle sconosciute in fondo', () => {
    const capitolo = doc.slice(doc.indexOf('## Cosa fa il sistema'), doc.indexOf('## Lavori previsti'))
    const aree = capitolo.split('\n').filter((r) => r.startsWith('### ')).map((r) => r.slice(4))
    // Si comincia dal conto e si finisce con l'interfaccia: è l'ordine
    // della serata, non quello in cui i requisiti sono stati scritti.
    expect(aree).toEqual(['Cassa e POS', 'Magazzino', 'Interfaccia', 'ZZZ'])
    // Un'area che il documento non conosce non sparisce, va in coda col
    // suo codice al posto del titolo.
    expect(aree.at(-1)).toBe('ZZZ')
  })

  it('ogni comportamento cita i test che lo dimostrano, e chi non li ha lo dichiara', () => {
    // È il patto del progetto: i test sono la specifica eseguibile. Una
    // voce senza prove non è un fatto, ed è giusto che si legga.
    expect(doc).toContain('**Lo dimostrano**: `tests/unit/pos.test.js`')
    expect(doc).toContain('**Nessun test lo verifica.**')
  })

  it('i lavori previsti non promettono test, e stanno dopo quello che c’è', () => {
    const previsti = doc.indexOf('## Lavori previsti')
    const lotti = doc.indexOf('REQ-MAG-002')
    expect(lotti).toBeGreaterThan(previsti)
    // «Nessun test lo verifica» su una cosa non ancora scritta sarebbe
    // rumore: non esiste il test di una cosa che non c'è.
    const capitolo = doc.slice(previsti, doc.indexOf('## Difetti noti'))
    expect(capitolo).not.toContain('Nessun test lo verifica')
  })

  it('i difetti aperti ci sono, quelli sistemati no', () => {
    // Una specifica che tace i guai conosciuti fa sembrare garantito
    // quello che non lo è.
    expect(doc).toContain('BUG-001')
    expect(doc).not.toContain('BUG-002')
    expect(doc).toContain('| 🔴 |')   // succede in produzione
  })

  it('i deprecati restano solo come titolo, fuori dalla specifica', () => {
    const fuori = doc.slice(doc.indexOf('## Non più valido'))
    expect(fuori).toContain('`REQ-ORD-001` — Una cosa che non si fa più')
    // La descrizione no: descriveva un sistema che non esiste più.
    expect(fuori).not.toContain('Una descrizione qualsiasi')
  })

  it('senza difetti e senza deprecati quei capitoli non compaiono', () => {
    const magro = costruisciSpecifica([REGISTRO[0]], {})
    expect(magro).not.toContain('## Difetti noti')
    expect(magro).not.toContain('## Non più valido')
    expect(magro).not.toContain('## Lavori previsti')
    expect(magro).toContain('## Cosa fa il sistema')
  })
})

describe('le descrizioni si leggono', () => {
  it('va a capo dove il registro cambia argomento', () => {
    // Il parser incolla la descrizione in una riga sola, e una voce lunga
    // diventa un muro di testo. I cambi di argomento nel registro si
    // scrivono da sempre con le maiuscole in testa alla frase.
    const p = inParagrafi(
      'Il conto si compone al volo. DECISO (19/08): la bozza non si perde. ' +
      'DA FARE: il resto.'
    )
    expect(p).toHaveLength(3)
    expect(p[1]).toMatch(/^DECISO/)
    expect(p[2]).toMatch(/^DA FARE/)
  })

  it('non spezza a ogni sigla in mezzo al discorso', () => {
    // IVA, POS, SIAE non sono cambi di argomento: sono parole. Prima si
    // spezzava a ognuna, e il documento diventava un elenco della spesa.
    expect(inParagrafi('Il netto si scorpora. IVA al 10%, e basta così.')).toHaveLength(1)
  })

  it('la numerazione di un elenco resta attaccata alla sua voce', () => {
    // Senza questo il «1)» finiva orfano in fondo al paragrafo prima.
    const p = inParagrafi('Due vincoli. 1) LA PRODUZIONE non si tocca. 2) IL TRAVASO si verifica.')
    expect(p[1]).toMatch(/^1\)/)
    expect(p[2]).toMatch(/^2\)/)
  })
})

describe('i collegamenti dell’indice', () => {
  it('l’ancora è quella che costruisce GitHub, doppi trattini compresi', () => {
    // Tolta la lineetta di «BUG-038 — Il tale problema» restano DUE spazi,
    // e l'ancora giusta ha due trattini. Collassandoli il collegamento non
    // porta da nessuna parte, e non se ne accorge nessuno finché non lo
    // clicca.
    expect(ancora('BUG-038 — Le notifiche in ritardo')).toBe('bug-038--le-notifiche-in-ritardo')
    expect(ancora('Persone: ruoli, utenze, ore')).toBe('persone-ruoli-utenze-ore')
    expect(ancora('Menù e catalogo')).toBe('menù-e-catalogo')
  })

  it('ogni collegamento dell’indice trova il suo titolo', () => {
    const titoli = new Set(
      doc.split('\n').filter((r) => /^#{2,4} /.test(r)).map((r) => ancora(r.replace(/^#+ /, '')))
    )
    const rotti = [...doc.matchAll(/\]\(#([^)]+)\)/g)].map((m) => m[1]).filter((a) => !titoli.has(a))
    expect(rotti).toEqual([])
  })
})

describe('lo stato di una voce', () => {
  it('un requisito fatto senza test è «scoperto», non «coperto»', () => {
    // È la distinzione che regge tutto il documento: funziona finché
    // qualcuno non lo rompe senza accorgersene.
    expect(copertura(voce({ status: 'implemented', test_cases: ['x'] }))).toBe('coperto')
    expect(copertura(voce({ status: 'implemented', test_cases: [] }))).toBe('scoperto')
    expect(copertura(voce({ status: 'partial', test_cases: ['x'] }))).toBe('parziale')
    expect(copertura(voce({ status: 'todo' }))).toBe('da-fare')
    expect(copertura(voce({ status: 'deprecated' }))).toBe('deprecato')
  })
})
