'use strict'

// I LIMITI DEL PIANO FREE (REQ-LIC-003) E IL PROFILO LEGGERO (REQ-LIC-004),
// nella loro logica pura. La regia scrive `settings/bar.licenza.limiti` per
// il piano Free e `null` per quelli a pagamento.
//
// LA PROVA CHE CONTA È LA PRIMA: SENZA `limiti`, NESSUN LIMITE. La Tana e
// la Tana di test non hanno una licenza; un locale a pagamento ha
// `limiti: null`. In tutti e due i casi ogni domanda deve rispondere come
// prima che i limiti esistessero.

import { describe, it, expect } from 'vitest'
import {
  limitiDi,
  pianoFree,
  profiloLeggero,
  puoCreareProdotto,
  puoAprireConto,
  scontiConsentiti,
  inizioStorico,
  dentroStorico,
  staffConsentito,
  rigaMarchio,
  urlRegia,
  maxProdotti,
  maxContiAperti,
  giorniDiStorico,
  MESSAGGI_PIANO,
} from '../../src/lib/limiti.js'
import { moduloIncluso, moduloAttivo, sumupDisponibile, scadenzaProva, moduliPremium } from '../../src/lib/licenza.js'
import { NOME_PRODOTTO } from '../../src/lib/prodotto.js'

const LIMITI_FREE = {
  prodotti_max: 10,
  conti_aperti_max: 5,
  sconti: false,
  storico_giorni: 7,
  utenti_max: 1,
  marchio: true,
}

const FREE = {
  licenza: {
    piano: 'free',
    moduli: Object.fromEntries(moduliPremium().map((m) => [m.id, false])),
    limiti: LIMITI_FREE,
    regia_url: 'https://regia.example/dashboard',
  },
}

// Le forme in cui «nessun limite» arriva davvero.
const SENZA_LIMITI = {
  'la Tana, senza licenza': {},
  'impostazioni non ancora arrivate': null,
  'un piano a pagamento, limiti null': { licenza: { piano: 'pro', moduli: {}, limiti: null } },
  'una licenza senza la voce': { licenza: { piano: 'base', moduli: {} } },
  'una voce di forma sbagliata': { licenza: { piano: 'base', limiti: 'tanti' } },
  'un elenco al posto dei limiti': { licenza: { piano: 'base', limiti: [1, 2] } },
}

describe('senza limiti nella licenza non cambia niente', () => {
  for (const [caso, stato] of Object.entries(SENZA_LIMITI)) {
    it(caso, () => {
      expect(limitiDi(stato)).toBeNull()
      expect(puoCreareProdotto(stato, 500)).toBe(true)
      expect(puoAprireConto(stato, 200)).toBe(true)
      expect(scontiConsentiti(stato)).toBe(true)
      expect(inizioStorico(stato)).toBeNull()
      expect(dentroStorico(stato, '2020-01-01T00:00:00.000Z')).toBe(true)
      expect(staffConsentito(stato)).toBe(true)
      expect(rigaMarchio(stato)).toBeNull()
      expect(profiloLeggero(stato)).toBe(false)
    })
  }

  it('la Tana tiene tutti i moduli e il lettore SumUp in cassa, come prima', () => {
    for (const m of moduliPremium()) expect(moduloIncluso({}, m.id)).toBe(m.incluso === true)
    expect(sumupDisponibile({})).toBe(true)
    expect(sumupDisponibile(null)).toBe(true)
  })
})

describe('coi limiti del piano Free', () => {
  it('i prodotti del menù si fermano al numero, e quelli che ci sono restano', () => {
    expect(maxProdotti(FREE)).toBe(10)
    expect(puoCreareProdotto(FREE, 9)).toBe(true)
    expect(puoCreareProdotto(FREE, 10)).toBe(false)
    // Un menù già più lungo (un piano cambiato in Free) non perde niente:
    // semplicemente non cresce.
    expect(puoCreareProdotto(FREE, 14)).toBe(false)
  })

  it('i conti aperti insieme si fermano al numero', () => {
    expect(maxContiAperti(FREE)).toBe(5)
    expect(puoAprireConto(FREE, 4)).toBe(true)
    expect(puoAprireConto(FREE, 5)).toBe(false)
  })

  it('niente sconti, omaggi e maggiorazioni sul conto', () => {
    expect(scontiConsentiti(FREE)).toBe(false)
    // Solo un `false` scritto li spegne.
    expect(scontiConsentiti({ licenza: { limiti: { sconti: true } } })).toBe(true)
    expect(scontiConsentiti({ licenza: { limiti: { prodotti_max: 3 } } })).toBe(true)
  })

  it('lo storico parte dalla mezzanotte di sette giorni fa', () => {
    const adesso = new Date(2026, 9, 30, 1, 30) // 30 ottobre, l'una e mezza di notte
    expect(giorniDiStorico(FREE)).toBe(7)
    const da = inizioStorico(FREE, adesso)
    expect(da).toEqual(new Date(2026, 9, 23, 0, 0, 0, 0))
    expect(dentroStorico(FREE, new Date(2026, 9, 23, 0, 0).toISOString(), adesso)).toBe(true)
    expect(dentroStorico(FREE, new Date(2026, 9, 22, 23, 59).toISOString(), adesso)).toBe(false)
    // Una data che non si legge resta visibile: nascondere un conto per un
    // campo rotto è peggio.
    expect(dentroStorico(FREE, 'non una data', adesso)).toBe(true)
    expect(dentroStorico(FREE, null, adesso)).toBe(true)
    // Un Timestamp di Firestore si legge come una data.
    expect(dentroStorico(FREE, { toDate: () => new Date(2026, 9, 1) }, adesso)).toBe(false)
  })

  it('un utente solo: niente account dello staff', () => {
    expect(staffConsentito(FREE)).toBe(false)
    // Un piano con più utenti e le Functions li ha.
    expect(staffConsentito({ licenza: { piano: 'base', limiti: { utenti_max: 3 } } })).toBe(true)
  })

  it('la firma del prodotto in fondo, col nome scritto in un posto solo', () => {
    expect(NOME_PRODOTTO).toBe('Drink')
    expect(rigaMarchio(FREE)).toBe('Creato con Drink')
    expect(rigaMarchio({ licenza: { limiti: { marchio: false } } })).toBeNull()
  })

  it('un limite che non si legge non diventa un limite a zero', () => {
    const strano = { licenza: { limiti: { prodotti_max: 'tanti', conti_aperti_max: null, storico_giorni: true } } }
    expect(puoCreareProdotto(strano, 1000)).toBe(true)
    expect(puoAprireConto(strano, 1000)).toBe(true)
    expect(inizioStorico(strano)).toBeNull()
  })

  it('i messaggi dicono il numero, con la regia per cambiare piano', () => {
    expect(MESSAGGI_PIANO.prodotti(10)).toBe(
      'Nel piano Free il menù ha al massimo 10 prodotti. Per aggiungerne passa a un piano a pagamento.'
    )
    expect(MESSAGGI_PIANO.conti(5)).toBe('Nel piano Free puoi avere al massimo 5 conti aperti insieme.')
    expect(MESSAGGI_PIANO.storico(7)).toBe('Nel piano Free lo storico mostra gli ultimi 7 giorni.')
    expect(MESSAGGI_PIANO.staff).toBe(
      'Nel piano Free l’app la usa solo il titolare. Per aggiungere lo staff passa a un piano a pagamento.'
    )
    expect(MESSAGGI_PIANO.conti(1)).toBe('Nel piano Free puoi avere al massimo 1 conto aperto insieme.')
    expect(urlRegia(FREE)).toBe('https://regia.example/dashboard')
    expect(urlRegia({})).toBeNull()
  })
})

describe('il piano Free e i moduli', () => {
  it('i moduli sono spenti come per un Base senza moduli', () => {
    for (const m of moduliPremium()) {
      expect(moduloIncluso(FREE, m.id)).toBe(false)
      expect(moduloAttivo(FREE, m.id)).toBe(false)
    }
  })

  it('anche se la regia non scrivesse la voce dei moduli', () => {
    const freeSenzaModuli = { licenza: { piano: 'free', limiti: LIMITI_FREE } }
    for (const m of moduliPremium()) expect(moduloIncluso(freeSenzaModuli, m.id)).toBe(false)
  })

  it('un modulo in prova è acceso come uno comprato, e dice fino a quando', () => {
    const inProva = {
      licenza: {
        ...FREE.licenza,
        moduli: { ...FREE.licenza.moduli, magazzino: true },
        prove: { magazzino: '2026-11-13T10:00:00.000Z' },
      },
    }
    expect(moduloAttivo(inProva, 'magazzino')).toBe(true)
    expect(scadenzaProva(inProva, 'magazzino')).toEqual(new Date('2026-11-13T10:00:00.000Z'))
    expect(scadenzaProva(inProva, 'statistiche')).toBeNull()
    expect(scadenzaProva({ licenza: { prove: { magazzino: 'domani' } } }, 'magazzino')).toBeNull()
  })
})

describe('il profilo leggero', () => {
  it('il piano Free è leggero: niente Functions, niente Storage, niente SumUp', () => {
    expect(pianoFree(FREE)).toBe(true)
    expect(profiloLeggero(FREE)).toBe(true)
    expect(sumupDisponibile(FREE)).toBe(false)
    expect(staffConsentito(FREE)).toBe(false)
  })

  it('anche un modulo SumUp acceso non accende il lettore senza Functions', () => {
    const conSumup = { licenza: { ...FREE.licenza, moduli: { sumup: true } } }
    expect(moduloIncluso(conSumup, 'sumup')).toBe(true)
    expect(sumupDisponibile(conSumup)).toBe(false)
  })

  it('un piano a pagamento che non ha comprato SumUp non lo vede', () => {
    expect(sumupDisponibile({ licenza: { piano: 'base', moduli: { sumup: false } } })).toBe(false)
    expect(sumupDisponibile({ licenza: { piano: 'pro', moduli: { sumup: true } } })).toBe(true)
  })
})
