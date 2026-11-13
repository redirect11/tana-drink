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
  stampaConsentita,
  comandeConsentite,
  servizioAttivo,
  aiConsentita,
  limitiInChiaro,
  inizioStorico,
  dentroStorico,
  visibiliNelloStorico,
  fotoConsentite,
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
import { LICENZA_TANA } from '../helpers/licenza.js'
import { LIMITI_FREE as LIMITI_FREE_APP } from '../../src/lib/licenzaInVigore.js'

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
      // La lista dello storico torna la STESSA, non una copia filtrata:
      // chi la memorizza non vede cambiare niente.
      const storico = [{ quando: '2020-01-01T00:00:00.000Z' }]
      expect(visibiliNelloStorico(stato, storico, { data: (x) => x.quando })).toBe(storico)
      expect(fotoConsentite(stato)).toBe(true)
      expect(staffConsentito(stato)).toBe(true)
      expect(rigaMarchio(stato)).toBeNull()
      expect(profiloLeggero(stato)).toBe(false)
    })
  }

  it('la Tana tiene i moduli della sua licenza e il lettore SumUp in cassa, come prima', () => {
    const tana = { licenza: LICENZA_TANA }
    for (const m of moduliPremium()) expect(moduloIncluso(tana, m.id)).toBe(LICENZA_TANA.moduli[m.id] === true)
    expect(sumupDisponibile(tana)).toBe(true)
  })

  // I limiti del Free che l'app usa quando una licenza scade verso il Free
  // e la regia non l'ha ancora riscritta (REQ-LIC-009) sono quelli che la
  // regia scrive: gli stessi di queste prove.
  // `comande` e `stampa` qui sono a parte: le prove di questo file usano
  // un Free di prima, senza le due voci, per dimostrare che senza voce non
  // cambia niente. Che il Free di oggi non stampi lo si dice qui.
  it('la copia dei limiti del Free nell’app è quella della regia', () => {
    expect({ ...LIMITI_FREE_APP, comande: undefined, stampa: undefined, ai: undefined }).toEqual({ ...LIMITI_FREE, comande: undefined })
    expect(LIMITI_FREE_APP.stampa).toBe(false)
    expect(LIMITI_FREE_APP.ai).toBe(false)
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

  it('una lista dello storico perde le voci vecchie, ma non quelle ancora aperte', () => {
    const adesso = new Date(2026, 9, 30, 1, 30)
    const recente = { id: 'r', quando: new Date(2026, 9, 29, 22, 0).toISOString() }
    const vecchia = { id: 'v', quando: new Date(2026, 9, 1, 22, 0).toISOString() }
    const vecchiaAperta = { id: 'a', quando: new Date(2026, 9, 1, 22, 0).toISOString(), aperta: true }
    const visibili = visibiliNelloStorico(FREE, [recente, vecchia, vecchiaAperta], {
      data: (x) => x.quando,
      aperta: (x) => x.aperta === true,
      adesso,
    })
    expect(visibili.map((x) => x.id)).toEqual(['r', 'a'])
  })

  it('un utente solo: niente account dello staff', () => {
    expect(staffConsentito(FREE)).toBe(false)
    // Un piano con più utenti e le Functions li ha.
    expect(staffConsentito({ licenza: { piano: 'base', limiti: { utenti_max: 3 } } })).toBe(true)
  })

  it('la firma del prodotto in fondo, col nome scritto in un posto solo', () => {
    expect(NOME_PRODOTTO).toBe('Lime - SmartOrders')
    expect(rigaMarchio(FREE)).toBe('Creato con Lime - SmartOrders')
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
    expect(fotoConsentite(FREE)).toBe(false)
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

// IL RITORNO AL FREE DI UN LOCALE CHE PAGAVA (REQ-FLOTTA-020, punto 6 di
// docs/aggiornamenti-dalla-regia.md). La regia scrive `piano: 'free'` coi
// limiti su un locale che ha già più prodotti, conti e utenti di quanti il
// Free ne permetta, e che le Functions le ha pubblicate. NON SI CANCELLA
// NIENTE: i limiti fermano solo quello che nasce adesso, e quello che c'è
// resta e si vede.
describe('il ritorno al Free di un locale che pagava', () => {
  it('quello che è già oltre il limite resta: si ferma solo il nuovo', () => {
    // Quaranta prodotti in carta, otto conti aperti.
    expect(puoCreareProdotto(FREE, 40)).toBe(false)
    expect(puoAprireConto(FREE, 8)).toBe(false)
    // I conti aperti si vedono tutti, anche quelli di un mese fa.
    const adesso = new Date('2026-11-20T22:00:00')
    const vecchioAperto = { aperto: true, il: new Date('2026-10-20T22:00:00') }
    const vecchioChiuso = { aperto: false, il: new Date('2026-10-20T22:00:00') }
    const visti = visibiliNelloStorico(FREE, [vecchioAperto, vecchioChiuso], {
      data: (v) => v.il,
      aperta: (v) => v.aperto,
      adesso,
    })
    expect(visti).toEqual([vecchioAperto])
  })

  it('col profilo leggero l’app smette di CHIAMARE le Functions, non le spegne', () => {
    // Le Functions pubblicate restano sul server (le notifiche, gli
    // automatismi lato server girano come prima); l'app non chiama più
    // quelle che si chiamano dal browser: gestione dello staff, lettore
    // SumUp, caricamento delle foto. Le foto che ci sono restano.
    expect(profiloLeggero(FREE)).toBe(true)
    expect(staffConsentito(FREE)).toBe(false)
    expect(sumupDisponibile(FREE)).toBe(false)
    expect(fotoConsentite(FREE)).toBe(false)
  })
})

// REQ-LIC-016 (Daniele, 12/11/2026): il Free è senza stampa. Come per gli
// sconti, la spegne solo un `false` scritto: la Tana, i piani a pagamento e
// un Free di prima, che la voce non l'ha, stampano come sempre.
describe('la stampa nel piano', () => {
  it('solo `stampa: false` la spegne', () => {
    expect(stampaConsentita({ licenza: { ...FREE.licenza, limiti: { ...LIMITI_FREE, stampa: false } } })).toBe(false)
    expect(stampaConsentita({ licenza: { ...FREE.licenza, limiti: { ...LIMITI_FREE, stampa: true } } })).toBe(true)
  })

  it('senza la voce non cambia niente: la Tana, un piano a pagamento, un Free di prima', () => {
    expect(stampaConsentita({})).toBe(true)
    expect(stampaConsentita({ licenza: LICENZA_TANA })).toBe(true)
    expect(stampaConsentita({ licenza: { piano: 'base', limiti: null } })).toBe(true)
    expect(stampaConsentita(FREE)).toBe(true)
  })

  it('nel riepilogo della licenza si legge, e c’è la frase del piano', () => {
    const senza = { licenza: { ...FREE.licenza, limiti: { ...LIMITI_FREE, stampa: false } } }
    expect(limitiInChiaro(senza)).toContain('Stampa di comande e scontrini non compresa')
    expect(limitiInChiaro(FREE)).not.toContain('Stampa di comande e scontrini non compresa')
    expect(MESSAGGI_PIANO.stampa).toBe('La stampa di comande e scontrini è dei piani a pagamento.')
  })
})

// REQ-LIC-005 (l'utente, 31/10/2026): il Free è una cassa semplice, senza
// comande. Il servizio è una domanda sola: l'interruttore del locale, a
// meno che il piano non escluda le comande. Senza la voce, come sempre.
describe('le comande e il servizio nel piano', () => {
  const senzaComande = { licenza: { ...FREE.licenza, limiti: { ...LIMITI_FREE, comande: false } } }

  it('solo `comande: false` le toglie', () => {
    expect(comandeConsentite(senzaComande)).toBe(false)
    expect(comandeConsentite(FREE)).toBe(true)
    expect(comandeConsentite({ licenza: LICENZA_TANA })).toBe(true)
    expect(comandeConsentite({})).toBe(true)
  })

  it('il servizio è spento dal piano anche con l’interruttore acceso', () => {
    expect(servizioAttivo({ ...senzaComande, workflow_enabled: true })).toBe(false)
    expect(servizioAttivo({ ...senzaComande })).toBe(false)
  })

  it('senza la voce decide l’interruttore, come prima', () => {
    expect(servizioAttivo({ licenza: LICENZA_TANA, workflow_enabled: true })).toBe(true)
    expect(servizioAttivo({ licenza: LICENZA_TANA })).toBe(true)
    expect(servizioAttivo({ licenza: LICENZA_TANA, workflow_enabled: false })).toBe(false)
    expect(servizioAttivo(undefined)).toBe(true)
  })

  it('nel riepilogo della licenza si legge, e c’è la frase del piano', () => {
    expect(limitiInChiaro(senzaComande)).toContain('Comande e stati del servizio non compresi: cassa semplice')
    expect(limitiInChiaro(FREE)).not.toContain('Comande e stati del servizio non compresi: cassa semplice')
    expect(MESSAGGI_PIANO.comande).toMatch(/^Nel piano Free la cassa è semplice/)
  })
})

// REQ-LIC-017 (Daniele, 13/11/2026): il Free non ha l'AI. Solo un `false`
// scritto la toglie.
describe('l’AI nel piano', () => {
  it('solo `ai: false` la toglie, e si legge nel riepilogo', () => {
    const senzaAI = { licenza: { ...FREE.licenza, limiti: { ...LIMITI_FREE, ai: false } } }
    expect(aiConsentita(senzaAI)).toBe(false)
    expect(aiConsentita(FREE)).toBe(true)
    expect(aiConsentita({ licenza: LICENZA_TANA })).toBe(true)
    expect(limitiInChiaro(senzaAI)).toContain('Funzioni AI non comprese')
    expect(MESSAGGI_PIANO.ai).toBe('Le funzioni AI sono dei piani a pagamento.')
  })
})
