'use strict'

// I REQUISITI DEVONO RESTARE ATTACCATI ALLA REALTÀ.
//
// requirements/requirements.yaml dice cosa fa l'app; i test dicono cosa fa
// davvero. Se le due cose vivono separate, l'elenco dei requisiti diventa
// carta straccia nel giro di una settimana — si aggiunge un test e nessuno
// si ricorda di aggiornare il documento.
//
// Qui si legano: ogni file di test deve essere citato da almeno un
// requisito, e ogni test citato da un requisito deve esistere. Chi aggiunge
// un test senza dire a quale requisito appartiene se ne accorge subito, non
// fra sei mesi.

import { describe, it, expect } from 'vitest'
import { readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { caricaRequisiti, parseRequirementsYaml, etichetteClassificazione, riconciliaEtichette, corpoGenerato, IN_TEST, prossimoStato, deveNascere, famigliaDi, indicizzaPerId } from '../../scripts/lib-requisiti.mjs'

const requisiti = caricaRequisiti()
const STATI = ['implemented', 'partial', 'todo', 'deprecated']

function fileDiTest(dir = 'tests', out = []) {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome)
    if (statSync(p).isDirectory()) fileDiTest(p, out)
    else if (/\.test\.jsx?$/.test(nome)) out.push(p.replace(/\\/g, '/'))
  }
  return out
}

describe('il file dei requisiti è scritto bene', () => {
  it('ce ne sono, e ognuno ha id, titolo, area e descrizione', () => {
    expect(requisiti.length).toBeGreaterThan(20)
    for (const r of requisiti) {
      expect(r.id, 'id mancante').toMatch(/^REQ-[A-Z0-9-]+$/)
      expect(r.title.length, `titolo mancante in ${r.id}`).toBeGreaterThan(5)
      expect(r.area.length, `area mancante in ${r.id}`).toBeGreaterThan(3)
      expect(r.description.length, `descrizione troppo corta in ${r.id}`).toBeGreaterThan(40)
    }
  })

  it('gli identificativi non si ripetono', () => {
    const visti = new Set()
    const doppi = requisiti.map((r) => r.id).filter((id) => visti.size === visti.add(id).size)
    expect(doppi).toEqual([])
  })

  it('lo stato è uno di quelli previsti', () => {
    const strani = requisiti.filter((r) => !STATI.includes(r.status)).map((r) => `${r.id}: ${r.status}`)
    expect(strani).toEqual([])
  })

  // `generate_issue` vuol dire «questa voce e' SEGUITA su GitHub», non
  // «creane una adesso». Prima erano la stessa cosa e si mordevano la coda:
  // appena un requisito veniva finito gli si metteva false, e da quel momento
  // usciva dal giro — nessuno poteva piu' metterlo in prova ne' chiudergli
  // l'issue. Adesso una voce finita resta seguita, e a non nascere e' solo
  // l'issue NUOVA: aprirla vorrebbe dire chiedere un lavoro gia' fatto.
  it('un’issue nuova nasce solo per quello che c’è ancora da fare', () => {
    expect(deveNascere({ generate_issue: true, status: 'todo' }, false)).toBe(true)
    expect(deveNascere({ generate_issue: true, status: 'implemented' }, false)).toBe(false)
    expect(deveNascere({ generate_issue: true, status: 'fixed' }, false)).toBe(false)
    // Se l'issue c'e' gia' non se ne apre una seconda: si riallinea quella.
    expect(deveNascere({ generate_issue: true, status: 'todo' }, true)).toBe(false)
    // E chi non vuole essere seguito non lo e'.
    expect(deveNascere({ generate_issue: false, status: 'todo' }, false)).toBe(false)
  })

  it('una voce finita puo’ restare seguita, per potersi chiudere', () => {
    // Era proibito, ed era il motivo per cui le schede non avanzavano mai.
    const seguite = requisiti.filter((r) => r.generate_issue && r.status === 'implemented')
    expect(Array.isArray(seguite)).toBe(true)
  })
})

// QUANTO FA MALE, E QUANDO SI FA. Due giudizi separati, e separati devono
// restare: la severity e' una proprieta' del guaio (la misura chi lo vede al
// banco), la priority e' una decisione nostra. Il registro e' la fonte; le
// etichette dell'issue e i campi della bacheca ne sono la copia, e una copia
// che si scrive a mano prima o poi mente.
describe('severity e priority', () => {
  const SEVERITY = ['bloccante', 'grave', 'media', 'lieve']
  const PRIORITY = ['P0', 'P1', 'P2', 'P3']

  it('quando ci sono, usano le parole previste', () => {
    const strani = requisiti
      .filter((r) => (r.severity && !SEVERITY.includes(r.severity)) || (r.priority && !PRIORITY.includes(r.priority)))
      .map((r) => `${r.id}: ${r.severity} / ${r.priority}`)
    expect(strani, 'severity: ' + SEVERITY.join('|') + ' — priority: ' + PRIORITY.join('|')).toEqual([])
  })

  it('il parser li legge, e chi non li ha resta senza giudizio', () => {
    const voci = parseRequirementsYaml(`bugs:
  - id: BUG-999
    title: "Prova"
    severity: grave
    priority: P1
    labels: [bug, magazzino]
  - id: BUG-998
    title: "Senza giudizio"
    labels: [bug]
`)
    expect(voci[0].severity).toBe('grave')
    expect(voci[0].priority).toBe('P1')
    expect(voci[1].severity).toBeNull()
    expect(voci[1].priority).toBeNull()
  })

  it('dai campi si ricavano le etichette dell’issue, senza riscriverle a mano', () => {
    expect(etichetteClassificazione({ severity: 'grave', priority: 'P1' })).toEqual(['P1', 'severity-grave'])
    // Una funzione non ha severity: una cosa che non c'e' non fa male. Resta
    // la sola priority, e il campo vuoto e' un'informazione onesta.
    expect(etichetteClassificazione({ priority: 'P2' })).toEqual(['P2'])
    expect(etichetteClassificazione({})).toEqual([])
  })
})

// RIALLINEARE UN’ISSUE CHE ESISTE GIA’. Prima si saltava e basta: un requisito
// che cambiava restava scritto solo nel registro, e su GitHub — dove la gente
// guarda — non arrivava mai.
describe('le issue che esistono gia’ si riallineano', () => {
  it('mette quelle che mancano e toglie quelle vecchie, ma solo le sue', () => {
    const r = riconciliaEtichette(
      ['bug', 'magazzino', 'P2', 'severity-lieve', 'hotfix'],
      { labels: ['bug', 'magazzino'], priority: 'P1', severity: 'grave' },
    )
    expect(r.daAggiungere).toEqual(['P1', 'severity-grave'])
    expect(r.daTogliere).toEqual(['P2', 'severity-lieve'])
    // «hotfix» l’ha messa una persona guardando le issue: non e’ roba nostra
    // e non si tocca, altrimenti a ogni push si cancella il suo lavoro.
    expect(r.finali).toContain('hotfix')
    expect(r.finali).toContain('magazzino')
  })

  it('se e’ gia’ a posto non chiede di cambiare niente', () => {
    const r = riconciliaEtichette(['bug', 'P1'], { labels: ['bug'], priority: 'P1' })
    expect(r.daAggiungere).toEqual([])
    expect(r.daTogliere).toEqual([])
  })

  it('una voce senza giudizio non porta via le etichette di area', () => {
    const r = riconciliaEtichette(['pos', 'ux'], { labels: ['pos', 'ux'] })
    expect(r.daTogliere).toEqual([])
    expect(r.finali).toEqual(['pos', 'ux'])
  })

  it('su develop una voce finita si segna in prova, su main perde il segno', () => {
    // develop: e' finita, ma al banco non l'ha vista ancora nessuno.
    const messa = riconciliaEtichette(['bug', 'P1'], { labels: ['bug'], priority: 'P1' }, { inTest: true })
    expect(messa.daAggiungere).toEqual([IN_TEST])
    // La stessa voce riaperta (o guardata da una linea che non e' develop)
    // il segno lo perde: se restasse, filtrando per in-test si troverebbe
    // roba gia' in produzione o roba ancora da fare.
    const tolta = riconciliaEtichette(['bug', 'P1', IN_TEST], { labels: ['bug'], priority: 'P1' })
    expect(tolta.daTogliere).toEqual([IN_TEST])
    expect(tolta.finali).toEqual(['bug', 'P1'])
  })

  // IL DOPPIONE VERO, capitato il 18 agosto: la #55 per BUG-005, che esisteva
  // gia' come #14 col titolo identico. Nasceva perche' si cercava una issue
  // alla volta con la API di ricerca e una ricerca FALLITA veniva letta come
  // «non esiste». Adesso l'elenco si chiede una volta e si indicizza qui.
  it('l’elenco si indicizza per identificativo, e col doppione tiene quella aperta', () => {
    const avvisi = []
    const indice = indicizzaPerId([
      { number: 14, title: '[BUG-005] Le note degli item non si vedono', state: 'open' },
      { number: 55, title: '[BUG-005] Le note degli item non si vedono', state: 'open' },
      { number: 27, title: '[REQ-MAG-016] Titolo vecchio', state: 'closed' },
      { number: 44, title: '[REQ-MAG-016] Titolo nuovo', state: 'open' },
      { number: 99, title: 'Una issue scritta a mano, senza identificativo', state: 'open' },
    ], (m) => avvisi.push(m))

    // Fra due aperte vince la piu' vecchia: e' quella con la storia dentro.
    expect(indice.get('BUG-005').number).toBe(14)
    // Ma una chiusa non vince su una aperta, anche se e' piu' vecchia: quella
    // aperta e' dove si sta lavorando.
    expect(indice.get('REQ-MAG-016').number).toBe(44)
    // Chi non ha identificativo non entra: non e' roba del registro.
    expect(indice.has('99')).toBe(false)
    expect(indice.size).toBe(2)
    // E il doppione si segnala, perche' va chiuso da una persona: chiuderlo
    // da uno script vorrebbe dire cancellare commenti che non ha scritto lui.
    expect(avvisi).toHaveLength(2)
  })

  it('la famiglia si ricava dal registro, non si scrive a mano', () => {
    // Un requisito e un bug si guardano in modo diverso — «cosa manca» contro
    // «cosa non va» — e nell'elenco delle issue si distinguono solo
    // dall'etichetta. Scrivendola a mano prima o poi se ne dimentica una.
    expect(famigliaDi({ source_file: 'requirements/requirements.yaml' })).toBe('requirements')
    expect(famigliaDi({ source_file: 'requirements/bugs.yaml' })).toBe('bug')
    expect(famigliaDi({})).toBeNull()
    expect(etichetteClassificazione({ source_file: 'requirements/requirements.yaml', priority: 'P2' }))
      .toEqual(['requirements', 'P2'])
    // E le due famiglie restano esclusive: su un'issue di requisito che aveva
    // «bug» per sbaglio, quella se ne va.
    const r = riconciliaEtichette(['bug', 'pos'], {
      source_file: 'requirements/requirements.yaml', labels: ['pos'], priority: 'P2',
    })
    expect(r.daTogliere).toEqual(['bug'])
    expect(r.finali).toEqual(['pos', 'requirements', 'P2'])
  })

  it('la scheda segue la linea, e non si tira mai indietro', () => {
    // Ogni linea ha la sua tappa: un ramo di lavoro la scrive, develop la
    // manda a provare, main la chiude.
    expect(prossimoStato('To triage', 'Implemented')).toBe('Implemented')
    expect(prossimoStato('Implemented', 'In test')).toBe('In test')
    expect(prossimoStato('In test', 'Done')).toBe('Done')
    // Gia' arrivata dove la manderemmo: non si tocca. Cosi' il giro si puo'
    // ripetere senza riscrivere venticinque volte la stessa cosa.
    expect(prossimoStato('Implemented', 'Implemented')).toBeNull()
    // E non si torna MAI indietro: se qualcuno l'ha portata piu' in la',
    // l'ha fatto guardandola in faccia.
    expect(prossimoStato('In test', 'Implemented')).toBeNull()
    expect(prossimoStato('In review', 'In test')).toBeNull()
    expect(prossimoStato('Done', 'Done')).toBeNull()
    // Da «In review» a «Done» invece si va: e' avanti.
    expect(prossimoStato('In review', 'Done')).toBe('Done')
    // Una scheda senza stato parte da zero.
    expect(prossimoStato(null, 'Implemented')).toBe('Implemented')
  })

  it('il testo si riscrive solo se e’ ancora il nostro', () => {
    expect(corpoGenerato(`*Issue generata automaticamente da scripts/generate-issues.mjs*`)).toBe(true)
    // Se qualcuno ci ha scritto dentro un’analisi, quella vale piu’ del testo
    // generato: si lascia stare.
    expect(corpoGenerato('Ho guardato: succede solo sull’iPad del banco.')).toBe(false)
    expect(corpoGenerato(null)).toBe(false)
  })
})

describe('requisiti e test si tengono per mano', () => {
  const citati = new Set(
    requisiti.flatMap((r) => r.test_cases).filter((t) => t.includes('/'))
  )

  it('ogni test citato da un requisito esiste davvero', () => {
    const fantasmi = [...citati].filter((f) => !existsSync(f))
    expect(fantasmi, 'requisiti che puntano a test inesistenti').toEqual([])
  })

  it('ogni file di test è citato da almeno un requisito', () => {
    const orfani = fileDiTest().filter((f) => !citati.has(f))
    expect(
      orfani,
      'Test senza requisito: aggiungili ai `test_cases` di un requisito in ' +
        'requirements/requirements.yaml (o scrivi il requisito che descrivono):\n' +
        orfani.join('\n')
    ).toEqual([])
  })

  it('i requisiti già fatti dicono quali test lo dimostrano', () => {
    // Chi è "implemented" senza nemmeno un test è una dichiarazione di
    // intenti, non un fatto. Si tollera solo dove il test non è scrivibile
    // (infrastruttura, stampante, script di manutenzione).
    const senzaProve = requisiti
      .filter((r) => r.status === 'implemented' && r.test_cases.length === 0)
      .map((r) => r.id)
    expect(senzaProve.length, `requisiti dichiarati fatti senza test: ${senzaProve.join(', ')}`)
      .toBeLessThanOrEqual(20)
  })
})
