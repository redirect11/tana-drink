'use strict'

// ── LA LICENZA IN CHIARO (REQ-LIC-007) ────────────────────────────────
//
// Il riepilogo che la sottosezione Licenza mostra al titolare. Vale per
// ogni licenza: da BUG-125 ogni installazione ne ha una, e la Tana ha
// quella scritta nella sua build (nei test l'app è compilata per la
// Tana). Il requisito, scritto prima di BUG-125, diceva «senza licenza
// della regia la sottosezione non c'è»: era la Tana, e la Tana una
// licenza ce l'ha. Per lei si vede quello che la licenza porta — i moduli
// — e che la gestisce l'installazione, non una regia.

import { describe, it, expect } from 'vitest'
import { riepilogoLicenza } from '../../src/lib/licenza.js'
import { limitiInChiaro } from '../../src/lib/limiti.js'
import { LICENZA_DELLA_BUILD } from '../../src/lib/venue.js'

const OGGI = new Date('2026-11-02T12:00:00Z')

describe('la licenza della build (la Tana)', () => {
  it('si riepiloga: gestita dall’installazione, senza piano e senza scadenza', () => {
    const r = riepilogoLicenza({}, OGGI)
    expect(r.origine).toBe('build')
    expect(r.piano).toBeNull()
    expect(r.stato).toBe('attiva')
    expect(r.validita).toEqual({ tipo: 'senza' })
    expect(r.gestione).toBeNull()
    expect(r.limiti).toEqual([])
  })

  it('i moduli sono quelli del file della build, inclusi ed esclusi', () => {
    const r = riepilogoLicenza({}, OGGI)
    const attesi = Object.entries(LICENZA_DELLA_BUILD.moduli).filter(([, v]) => v).map(([id]) => id)
    expect(r.inclusi.map((m) => m.id).sort()).toEqual(attesi.sort())
    expect(r.esclusi.map((m) => m.id)).toContain('fatture')
  })

  it('anche arrivata dalla memoria del dispositivo, cioè come copia, è ancora della build', () => {
    const copia = JSON.parse(JSON.stringify(LICENZA_DELLA_BUILD))
    expect(riepilogoLicenza({ licenza: copia }, OGGI).origine).toBe('build')
  })
})

describe('una licenza della regia', () => {
  const regia = (extra = {}) => ({
    licenza: {
      piano: 'pro',
      moduli: { magazzino: true, statistiche: true },
      regia_url: 'https://drink-regia.web.app/area',
      ...extra,
    },
  })

  it('porta piano, gestione e il collegamento alla regia', () => {
    const r = riepilogoLicenza(regia(), OGGI)
    expect(r.origine).toBe('regia')
    expect(r.piano).toBe('pro')
    expect(r.gestione).toBe('https://drink-regia.web.app/area')
    expect(r.inclusi.map((m) => m.id).sort()).toEqual(['magazzino', 'statistiche'])
  })

  it('la validità: fino a una data, scaduta, o senza scadenza', () => {
    expect(riepilogoLicenza(regia({ valida_fino: '2026-11-30T23:00:00Z' }), OGGI).validita).toMatchObject({ tipo: 'fino' })
    expect(riepilogoLicenza(regia({ valida_fino: '2026-10-31T23:00:00Z' }), OGGI).validita).toMatchObject({ tipo: 'scaduta' })
    expect(riepilogoLicenza(regia({ valida_fino: null }), OGGI).validita).toEqual({ tipo: 'senza' })
  })

  it('una data che non si legge non diventa «senza scadenza»: non si mostra', () => {
    expect(riepilogoLicenza(regia({ valida_fino: 'fine mese' }), OGGI).validita).toBeNull()
  })

  it('un modulo in prova porta la sua scadenza', () => {
    const r = riepilogoLicenza(regia({ prove: { statistiche: '2026-11-13T10:00:00.000Z' } }), OGGI)
    expect(r.inclusi.find((m) => m.id === 'statistiche').prova).toEqual(new Date('2026-11-13T10:00:00.000Z'))
    expect(r.inclusi.find((m) => m.id === 'magazzino').prova).toBeNull()
  })

  it('lo stato sospeso si legge', () => {
    expect(riepilogoLicenza(regia({ stato: 'sospesa' }), OGGI).stato).toBe('sospesa')
  })
})

describe('i limiti del piano in chiaro', () => {
  it('una riga per limite scritto, con le parole del gestionale', () => {
    const stato = {
      licenza: {
        piano: 'free',
        moduli: {},
        limiti: { prodotti_max: 30, conti_aperti_max: 5, storico_giorni: 1, utenti_max: 1, sconti: false, marchio: true },
      },
    }
    expect(limitiInChiaro(stato)).toEqual([
      'Prodotti a listino: al massimo 30',
      'Conti aperti contemporaneamente: al massimo 5',
      'Storico consultabile: l’ultimo giorno',
      'Utenti: al massimo 1',
      'Sconti sul conto non consentiti',
      'Firma del prodotto in calce allo scontrino',
    ])
  })

  it('senza limiti, nessuna riga', () => {
    expect(limitiInChiaro({ licenza: { piano: 'pro', moduli: {} } })).toEqual([])
    expect(limitiInChiaro({ licenza: { piano: 'base', moduli: {}, limiti: { storico_giorni: 30 } } })).toEqual([
      'Storico consultabile: gli ultimi 30 giorni',
    ])
  })
})
