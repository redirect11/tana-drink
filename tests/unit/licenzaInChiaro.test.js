'use strict'

// ── LA LICENZA IN CHIARO (REQ-LIC-007) ────────────────────────────────
//
// Il riepilogo che la sottosezione Licenza mostra al titolare. Vale per
// ogni licenza, anche per quella della Tana, scritta a mano nel suo
// `licenza/attuale` (REQ-LIC-009): per lei si vede quello che porta, i
// moduli, senza piano, scadenza né regia.

import { describe, it, expect } from 'vitest'
import { riepilogoLicenza } from '../../src/lib/licenza.js'
import { limitiInChiaro } from '../../src/lib/limiti.js'
import { LICENZA_TANA } from '../helpers/licenza.js'

const OGGI = new Date('2026-11-02T12:00:00Z')
const TANA = { licenza: LICENZA_TANA }

describe('la licenza della Tana', () => {
  it('si riepiloga: senza piano, senza scadenza, senza regia', () => {
    const r = riepilogoLicenza(TANA, OGGI)
    expect(r.piano).toBeNull()
    expect(r.stato).toBe('attiva')
    expect(r.validita).toEqual({ tipo: 'senza' })
    expect(r.gestione).toBeNull()
    expect(r.limiti).toEqual([])
  })

  it('i moduli sono quelli della sua licenza, inclusi ed esclusi', () => {
    const r = riepilogoLicenza(TANA, OGGI)
    const attesi = Object.entries(LICENZA_TANA.moduli).filter(([, v]) => v).map(([id]) => id)
    expect(r.inclusi.map((m) => m.id).sort()).toEqual(attesi.sort())
    expect(r.esclusi).toEqual([])
  })

  it('senza una licenza nota non c’è niente da riepilogare', () => {
    expect(riepilogoLicenza({}, OGGI)).toBeNull()
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
