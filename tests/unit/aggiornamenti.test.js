// @vitest-environment happy-dom
'use strict'

// ── GLI AGGIORNAMENTI DECISI DALLA REGIA (REQ-FLOTTA-020) ─────────────
//
// L'utente, 31/10/2026: «il secondo dovrebbe invece mostrare prima il
// changelog con i cambiamenti e chiedere se si vuole aggiornare. Il
// titolare potrebbe volere anche saltare l'aggiornamento». E: «nei vari
// piani siano garantiti aggiornamenti fino a che si paga».
//
// LA PROVA CHE CONTA È LA PRIMA: SENZA `licenza.aggiornamenti` NON ESCE
// NIENTE. La Tana non ce l'ha, e deve aggiornarsi come sempre.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  aggiornamentiDi,
  modalitaAggiornamenti,
  piuNuova,
  propostaAperta,
  propostaDaMostrare,
  statoProposta,
  nonInclusi,
  MESSAGGI_AGGIORNAMENTI,
  avvisoDaMostrare,
  avvisoVisto,
  segnaAvvisoVisto,
  dataAvviso,
  numeroVersione,
  sceltaUrl,
  esitoScelta,
} from '../../src/lib/aggiornamenti.js'
import { accendiDemo, spegniDemo } from '../helpers/demo.js'

const proposta = (extra = {}) => ({ tag: 'v1.11.0', note: '## 1.11.0 — novembre\n- Una cosa nuova', ...extra })
const conAggiornamenti = (a) => ({ licenza: { piano: 'pro', aggiornamenti: a } })
const aScelta = (extra = {}) => conAggiornamenti({ modalita: 'a_scelta', inclusi: true, proposta: proposta(), ...extra })
const titolare = { ruolo: 'admin', versione: '1.10.2' }

describe('senza la voce nella licenza non cambia niente', () => {
  it.each([
    ['la Tana: niente licenza', {}],
    ['una licenza senza aggiornamenti', { licenza: { piano: 'pro' } }],
    ['una voce di forma sbagliata', conAggiornamenti('a_scelta')],
    ['modalità obbligatori, anche con una proposta', conAggiornamenti({ modalita: 'obbligatori', inclusi: true, proposta: proposta() })],
  ])('%s', (_, stato) => {
    expect(modalitaAggiornamenti(stato)).toBe('obbligatori')
    expect(propostaDaMostrare(stato, titolare)).toBeNull()
    expect(statoProposta(stato, titolare)).toBeNull()
    expect(nonInclusi(stato)).toBeNull()
    expect(avvisoDaMostrare(stato, titolare)).toBeNull()
  })
})

describe('il box della proposta', () => {
  it('esce al titolare, con la proposta della regia', () => {
    expect(propostaDaMostrare(aScelta(), titolare)).toMatchObject({ tag: 'v1.11.0' })
  })

  it('a chi non è titolare no: la scelta è sua', () => {
    for (const ruolo of ['bartender', 'staff', null]) {
      expect(propostaDaMostrare(aScelta(), { ...titolare, ruolo })).toBeNull()
    }
  })

  it('non esce se la versione è saltata, già scelta o rimandata a più tardi', () => {
    expect(propostaDaMostrare(aScelta({ proposta: proposta({ saltata_il: '2026-11-02T10:00:00Z' }) }), titolare)).toBeNull()
    expect(propostaDaMostrare(aScelta(), { ...titolare, scelta: { tag: 'v1.11.0', scelta: 'aggiorna' } })).toBeNull()
    expect(propostaDaMostrare(aScelta(), { ...titolare, scelta: { tag: 'v1.11.0', scelta: 'salta' } })).toBeNull()
    expect(propostaDaMostrare(aScelta(), { ...titolare, rimandata: 'v1.11.0' })).toBeNull()
  })

  it('una scelta su una versione vecchia non conta: la proposta nuova esce', () => {
    expect(propostaDaMostrare(aScelta(), { ...titolare, scelta: { tag: 'v1.10.0', scelta: 'salta' } })).not.toBeNull()
    expect(propostaDaMostrare(aScelta(), { ...titolare, rimandata: 'v1.10.0' })).not.toBeNull()
  })

  it('non esce se gli aggiornamenti non sono compresi nel piano', () => {
    expect(propostaDaMostrare(aScelta({ inclusi: false, motivo: 'free' }), titolare)).toBeNull()
  })

  it('non esce per la versione già installata, né per una più vecchia', () => {
    expect(propostaDaMostrare(aScelta(), { ...titolare, versione: '1.11.0' })).toBeNull()
    expect(propostaDaMostrare(aScelta(), { ...titolare, versione: '1.12.0' })).toBeNull()
  })

  it('non esce per un tag che non è un rilascio', () => {
    for (const tag of ['1.11.0', 'v1.11.0-beta', 'ultima', '']) {
      expect(propostaDaMostrare(aScelta({ proposta: proposta({ tag }) }), titolare)).toBeNull()
    }
    expect(propostaDaMostrare(aScelta({ proposta: null }), titolare)).toBeNull()
  })
})

describe('le versioni', () => {
  it('più nuova vuol dire più nuova, e la beta viene prima del suo rilascio', () => {
    expect(piuNuova('v1.11.0', '1.10.2')).toBe(true)
    expect(piuNuova('v1.11.0', '1.11.0-beta')).toBe(true)
    expect(piuNuova('v2.0.0', '1.99.99')).toBe(true)
    expect(piuNuova('v1.11.0', '1.11.0')).toBe(false)
    expect(piuNuova('v1.11.0', '1.11.1-beta')).toBe(false)
    expect(piuNuova('v1.10.9', '1.11.0')).toBe(false)
  })

  it('con l’installata che non si legge resta la regola «diversa»', () => {
    expect(piuNuova('v1.11.0', '')).toBe(true)
    expect(piuNuova('v1.11.0', 'sviluppo')).toBe(true)
    expect(piuNuova('nonsense', '1.0.0')).toBe(false)
  })

  it('il numero senza la «v», per i titoli', () => {
    expect(numeroVersione('v1.11.0')).toBe('1.11.0')
  })
})

describe('le Informazioni', () => {
  it('al titolare: da scegliere, anche dopo averla saltata', () => {
    expect(statoProposta(aScelta(), titolare)).toBe('da_scegliere')
    const saltata = aScelta({ proposta: proposta({ saltata_il: '2026-11-02T10:00:00Z' }) })
    expect(statoProposta(saltata, { ...titolare, scelta: { tag: 'v1.11.0', scelta: 'salta' } })).toBe('da_scegliere')
    expect(propostaAperta(saltata, titolare)).not.toBeNull()
  })

  it('dopo «Aggiorna» accettato dalla regia: partito', () => {
    expect(statoProposta(aScelta(), { ...titolare, scelta: { tag: 'v1.11.0', scelta: 'aggiorna' } })).toBe('partito')
  })

  it('a chi non è titolare: la decide il titolare', () => {
    expect(statoProposta(aScelta(), { ...titolare, ruolo: 'bartender' })).toBe('del_titolare')
  })

  it('gli aggiornamenti non inclusi dicono perché', () => {
    expect(nonInclusi(conAggiornamenti({ inclusi: false, motivo: 'non_pagato' }))).toBe('non_pagato')
    expect(nonInclusi(conAggiornamenti({ inclusi: false, motivo: 'free' }))).toBe('free')
    expect(nonInclusi(conAggiornamenti({ inclusi: false }))).toBe('piano')
    expect(nonInclusi(conAggiornamenti({ inclusi: true }))).toBeNull()
    // Solo un `false` scritto toglie gli aggiornamenti.
    expect(nonInclusi(conAggiornamenti({ modalita: 'a_scelta' }))).toBeNull()
    expect(MESSAGGI_AGGIORNAMENTI.non_pagato).toMatch(/non risulta pagato.*piano Free/)
  })
})

describe('la chiamata alla regia', () => {
  const URL_REGIA = 'https://europe-west1-drink-regia.cloudfunctions.net/sceltaDallApp'

  it('l’indirizzo della scelta si prende solo se è una Function della regia', () => {
    expect(sceltaUrl(aScelta({ scelta_url: URL_REGIA }))).toBe(URL_REGIA)
    expect(sceltaUrl(aScelta({ scelta_url: 'https://us-central1-drink-regia.cloudfunctions.net/scelta_2' }))).not.toBeNull()
    // Finché la licenza la può riscrivere un bartender (BUG-125), un
    // indirizzo qualunque riceverebbe il token del titolare.
    for (const altro of [
      'https://ruba-token.example/scelta',
      'http://europe-west1-drink-regia.cloudfunctions.net/sceltaDallApp',
      'https://europe-west1-drink-regia.cloudfunctions.net.example.com/sceltaDallApp',
      'https://europe-west1-drink-regia.cloudfunctions.net/sceltaDallApp?rimanda=https://altrove',
      'https://drink-regia.cloudfunctions.net/sceltaDallApp',
      42,
    ]) {
      expect(sceltaUrl(aScelta({ scelta_url: altro }))).toBeNull()
    }
  })

  it('senza indirizzo, niente: una licenza di prima della chiamata', () => {
    expect(sceltaUrl(aScelta())).toBeNull()
    expect(sceltaUrl({})).toBeNull()
  })

  it('200 è fatta; ogni altra risposta porta il testo della regia', () => {
    expect(esitoScelta(200, { ok: true, scelta: 'aggiorna' })).toEqual({ ok: true })
    for (const status of [400, 401, 403, 404, 409, 502]) {
      expect(esitoScelta(status, { errore: ' La proposta è cambiata. ' })).toEqual({ ok: false, messaggio: 'La proposta è cambiata.' })
    }
  })

  it('una risposta senza testo d’errore ha una frase sua', () => {
    for (const corpo of [null, {}, { errore: '' }, { errore: 42 }]) {
      expect(esitoScelta(500, corpo)).toEqual({ ok: false, messaggio: MESSAGGI_AGGIORNAMENTI.non_riuscita })
    }
  })
})

describe('l’avviso delle condizioni', () => {
  beforeEach(() => localStorage.clear())
  const conAvviso = (avviso) => conAggiornamenti({ modalita: 'obbligatori', avviso })
  const avviso = { id: 'condizioni-2026-11', testo: 'Dal 1° dicembre cambiano le condizioni.', dal: '2026-12-01T00:00:00Z' }

  it('esce al titolare, una volta per id', () => {
    expect(avvisoDaMostrare(conAvviso(avviso), { ruolo: 'admin' })).toMatchObject({ id: 'condizioni-2026-11' })
    expect(avvisoDaMostrare(conAvviso(avviso), { ruolo: 'admin', visto: 'condizioni-2026-11' })).toBeNull()
    expect(
      avvisoDaMostrare(conAvviso({ ...avviso, id: 'condizioni-2027-01' }), { ruolo: 'admin', visto: 'condizioni-2026-11' })
    ).not.toBeNull()
  })

  it('agli altri no, e senza testo nemmeno', () => {
    expect(avvisoDaMostrare(conAvviso(avviso), { ruolo: 'bartender' })).toBeNull()
    expect(avvisoDaMostrare(conAvviso({ ...avviso, testo: '  ' }), { ruolo: 'admin' })).toBeNull()
  })

  it('l’id visto si ricorda sul dispositivo', () => {
    expect(avvisoVisto()).toBeNull()
    segnaAvvisoVisto('condizioni-2026-11')
    expect(avvisoVisto()).toBe('condizioni-2026-11')
  })

  it('la data in chiaro, o niente se non si legge', () => {
    expect(dataAvviso('2026-12-01T12:00:00Z')).toBe('1 dicembre 2026')
    expect(dataAvviso('domani')).toBe('')
    expect(dataAvviso(null)).toBe('')
  })
})

describe('la demo', () => {
  beforeEach(() => accendiDemo())
  afterEach(() => spegniDemo())

  it('ignora tutto: non ha una regia dietro', () => {
    expect(aggiornamentiDi(aScelta())).toBeNull()
    expect(propostaDaMostrare(aScelta(), titolare)).toBeNull()
  })
})
