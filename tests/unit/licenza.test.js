'use strict'

// LE FUNZIONI PREMIUM (REQ-LIC-001). Una domanda sola per tutta l'app —
// «questo modulo è acceso?» — e la risposta di partenza è NO. Le prove qui
// sotto sono i casi storti in cui una svista regalerebbe una funzione a
// pagamento: impostazioni non ancora arrivate, documento di un locale
// salvato prima che il flag esistesse, id sbagliato.

import { describe, it, expect } from 'vitest'
import {
  MODULI_PREMIUM,
  MOTIVO_PREMIUM,
  chiaveModulo,
  ePremium,
  moduliPremium,
  moduloAttivo,
  voceVisibile,
} from '../../src/lib/licenza.js'

describe('un modulo premium è acceso?', () => {
  it('acceso solo col flag a true sulle impostazioni del bar', () => {
    expect(moduloAttivo({ modulo_conta_enabled: true }, 'conta')).toBe(true)
    expect(moduloAttivo({ modulo_scadenzario_enabled: true }, 'scadenzario')).toBe(true)
  })

  it('spento col flag a false', () => {
    expect(moduloAttivo({ modulo_conta_enabled: false }, 'conta')).toBe(false)
  })

  it('spento se il flag non c’è: è la FORMA VECCHIA delle impostazioni', () => {
    // Il documento settings/bar dei locali è stato scritto anni prima di
    // questi flag: quello che non c'è non vale «acceso».
    expect(moduloAttivo({ workflow_enabled: true, price_markup: 3 }, 'conta')).toBe(false)
    expect(moduloAttivo({}, 'scadenzario')).toBe(false)
  })

  it('spento se le impostazioni non ci sono ancora', () => {
    // Il primo disegno arriva prima del server: una sezione che compare per
    // mezzo secondo e poi sparisce è peggio di una che non c'è.
    expect(moduloAttivo(null, 'conta')).toBe(false)
    expect(moduloAttivo(undefined, 'conta')).toBe(false)
  })

  it('spento se il flag non è proprio `true`', () => {
    // Un `1`, una stringa «true» o un oggetto arrivano da import e migrazioni
    // scritti a mano: solo il booleano vale.
    expect(moduloAttivo({ modulo_conta_enabled: 1 }, 'conta')).toBe(false)
    expect(moduloAttivo({ modulo_conta_enabled: 'true' }, 'conta')).toBe(false)
  })

  it('spento se l’id non è un modulo premium', () => {
    expect(moduloAttivo({ modulo_conta_enabled: true }, 'prodotti')).toBe(false)
    expect(moduloAttivo({ modulo_conta_enabled: true }, undefined)).toBe(false)
  })
})

describe('il punto di innesto della licenza vera (Fase 3 del piano)', () => {
  // Quando arriverà `settings/licenza`, chi lo collega tocca SOLO questa
  // funzione: se lo stato porta una licenza, comanda lei.
  it('la licenza vince sui flag di settings/bar', () => {
    const stato = { modulo_conta_enabled: true, licenza: { moduli: { conta: false } } }
    expect(moduloAttivo(stato, 'conta')).toBe(false)
  })

  it('la licenza accende anche dove il flag manca', () => {
    expect(moduloAttivo({ licenza: { moduli: { scadenzario: true } } }, 'scadenzario')).toBe(true)
  })

  it('una licenza che non nomina il modulo lo tiene spento, senza ricadere sul flag', () => {
    // Se la licenza c'è, è LEI la verità: ricadere sul flag di settings/bar
    // vorrebbe dire che chi scrive a mano il documento del bar si riapre da
    // solo un modulo che la licenza non gli dà.
    const stato = { modulo_conta_enabled: true, licenza: { moduli: { scadenzario: true } } }
    expect(moduloAttivo(stato, 'conta')).toBe(false)
  })

  it('una licenza senza moduli non conta: si torna ai flag', () => {
    expect(moduloAttivo({ modulo_conta_enabled: true, licenza: { piano: 'base' } }, 'conta')).toBe(
      true
    )
  })
})

describe('la tabella dei moduli', () => {
  it('la chiave di ogni modulo è quella scritta sui documenti dei locali', () => {
    expect(chiaveModulo('conta')).toBe('modulo_conta_enabled')
    expect(chiaveModulo('scadenzario')).toBe('modulo_scadenzario_enabled')
    expect(chiaveModulo('prodotti')).toBeNull()
  })

  it('ogni modulo ha nome e descrizione da mostrare, e una chiave sua', () => {
    const chiavi = new Set()
    for (const m of moduliPremium()) {
      expect(m.label).toBeTruthy()
      expect(m.descrizione).toBeTruthy()
      expect(m.chiave).toMatch(/^modulo_.*_enabled$/)
      expect(chiavi.has(m.chiave)).toBe(false)
      chiavi.add(m.chiave)
    }
    expect(moduliPremium().map((m) => m.id)).toEqual(Object.keys(MODULI_PREMIUM))
  })

  it('il motivo dell’interruttore spento dice cosa è e non promette niente', () => {
    expect(MOTIVO_PREMIUM).toMatch(/premium/i)
    // Niente toni da venditore a schermo (DESIGN.md, guardrail 3).
    expect(MOTIVO_PREMIUM).not.toMatch(/sblocca|acquista|ora!|scopri/i)
  })
})

describe('filtrare un elenco di voci', () => {
  it('una voce che non è premium passa sempre', () => {
    expect(voceVisibile({}, 'prodotti')).toBe(true)
    expect(voceVisibile(null, 'movimenti')).toBe(true)
    expect(ePremium('prodotti')).toBe(false)
  })

  it('una voce premium passa solo col modulo acceso', () => {
    expect(ePremium('conta')).toBe(true)
    expect(voceVisibile({}, 'conta')).toBe(false)
    expect(voceVisibile({ modulo_conta_enabled: true }, 'conta')).toBe(true)
  })
})
