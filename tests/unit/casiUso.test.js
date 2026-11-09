'use strict'

// I CASI D'USO TENGONO (REQ-DEV-019).
//
// L'utente, 09/11/2026: «non abbiamo una specifica vera del prodotto». La
// specifica del prodotto è requirements/casi-uso.yaml: cosa fa chi usa
// l'app, un obiettivo intero alla volta, e per ognuno un test end-to-end
// nel browser. Vale quanto i suoi legami: un requisito citato che non
// esiste, o uno ancora da fare dato per fatto, e la specifica promette una
// cosa che l'app non fa. Qui si controllano i legami e il lettore del
// registro, che è scritto a mano come quello dei requisiti.

import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { caricaRequisiti } from '../../scripts/lib-requisiti.mjs'
import { caricaBisogni } from '../../scripts/lib-modello-v.mjs'
import {
  caricaCasiUso, parseCasiUso, controllaCasiUso, requisitiFuoriDaiCasi, costruisciSpecificaProdotto,
} from '../../scripts/lib-casi-uso.mjs'

const casi = caricaCasiUso()
const requisiti = caricaRequisiti()
const bisogni = caricaBisogni()

describe('il registro dei casi d\'uso', () => {
  it('c\'è, e ogni caso d\'uso ha i suoi legami in ordine', () => {
    expect(casi.length).toBeGreaterThan(0)
    expect(controllaCasiUso(casi, { requisiti, bisogni, esiste: existsSync })).toEqual([])
  })

  // Il test e2e di un caso d'uso lo cita il caso d'uso: è il verso unico
  // del legame, come per i bisogni coi requisiti.
  it('i test end-to-end citati esistono e stanno in tests/e2e', () => {
    for (const t of casi.flatMap((c) => c.test_cases)) {
      expect(t, t).toMatch(/^tests\/e2e\/.+\.spec\.js$/)
      expect(existsSync(t), t).toBe(true)
    }
  })
})

describe('il lettore del registro', () => {
  const TESTO = [
    'casi_uso:',
    '',
    '  - id: UC-BANCO-001',
    '    title: "Si incassa un conto in contanti"',
    '    gruppo: "La serata al banco"',
    '    attore: "Bartender"',
    '    obiettivo: >',
    '      Chiudere il conto e dare il resto',
    '      senza aspettare la rete.',
    '    parte_da: >',
    '      Cassa aperta, un conto in coda.',
    '    passi:',
    '      - "Apre il conto dalla coda."',
    '      - "Tocca «Pagamento», sceglie Contanti e scrive \\"20\\":',
    '        vede il resto."',
    '    esito: >',
    '      Il conto risulta pagato.',
    '    varianti:',
    '      - quando: "La rete è staccata"',
    '        allora: "Tutto come sopra,',
    '          nell\'istante del gesto."',
    '      - quando: "La cassa è chiusa"',
    '        allora: >',
    '          Riscuotere è spento.',
    '    si_prova: browser',
    '    bisogni: [UR-001, UR-005]',
    '    requisiti:',
    '      - REQ-PAG-001',
    '    previsti: []',
    '    test_cases: []',
  ].join('\r\n')

  it('legge testi, blocchi piegati, elenchi e varianti, anche con le righe di Windows', () => {
    const [c] = parseCasiUso(TESTO)
    expect(c.id).toBe('UC-BANCO-001')
    expect(c.title).toBe('Si incassa un conto in contanti')
    expect(c.obiettivo).toBe('Chiudere il conto e dare il resto senza aspettare la rete.')
    expect(c.passi).toEqual([
      'Apre il conto dalla coda.',
      'Tocca «Pagamento», sceglie Contanti e scrive "20": vede il resto.',
    ])
    expect(c.varianti).toEqual([
      { quando: 'La rete è staccata', allora: 'Tutto come sopra, nell\'istante del gesto.' },
      { quando: 'La cassa è chiusa', allora: 'Riscuotere è spento.' },
    ])
    expect(c.si_prova).toBe('browser')
    expect(c.bisogni).toEqual(['UR-001', 'UR-005'])
    expect(c.requisiti).toEqual(['REQ-PAG-001'])
    expect(c.previsti).toEqual([])
  })

  it('i controlli trovano i legami sbagliati', () => {
    const [c] = parseCasiUso(TESTO)
    const reqFinti = [{ id: 'REQ-PAG-001', status: 'todo' }, { id: 'REQ-POS-001', status: 'implemented' }]
    const urFinti = [{ id: 'UR-001' }]
    const problemi = controllaCasiUso(
      [{ ...c, previsti: ['REQ-POS-001'], test_cases: ['tests/e2e/nonCe.spec.js'] }, { ...c, attore: 'Cuoco', varianti: ['senza coppia'] }],
      { requisiti: reqFinti, bisogni: urFinti, esiste: () => false },
    )
    expect(problemi).toEqual(expect.arrayContaining([
      'UC-BANCO-001: il bisogno UR-005 non esiste',
      'UC-BANCO-001: REQ-PAG-001 è todo, va tra i previsti',
      'UC-BANCO-001: REQ-POS-001 è implemented, non è un previsto',
      'UC-BANCO-001: il test tests/e2e/nonCe.spec.js non esiste',
      'UC-BANCO-001: id ripetuto',
      'UC-BANCO-001: attore sconosciuto «Cuoco»',
      'UC-BANCO-001: una variante va scritta con quando e allora',
    ]))
  })
})

describe('la specifica del prodotto', () => {
  it('racconta ogni caso d\'uso, e in fondo i requisiti che nessuno racconta', () => {
    const doc = costruisciSpecificaProdotto(casi, { requisiti, bisogni })
    for (const c of casi) expect(doc).toContain(`### ${c.id} — ${c.title}`)
    for (const r of requisitiFuoriDaiCasi(casi, requisiti)) expect(doc).toContain(`- ${r.id} — `)
  })
})
