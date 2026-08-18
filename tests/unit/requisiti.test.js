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
import { caricaRequisiti, parseRequirementsYaml, etichetteClassificazione } from '../../scripts/lib-requisiti.mjs'

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

  it('si apre un’issue solo per quello che c’è ancora da fare', () => {
    const sbagliati = requisiti
      .filter((r) => r.generate_issue && r.status === 'implemented')
      .map((r) => r.id)
    expect(sbagliati, 'un requisito già fatto non deve generare issue').toEqual([])
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
