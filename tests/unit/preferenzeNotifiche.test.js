// @vitest-environment happy-dom
'use strict'

// QUALI AVVISI VOGLIO, SU QUESTO SCHERMO. Al banco «nuovo ordine» è la cosa
// più importante della serata, in sala serve solo «pronto», e chi tiene il
// portatile nel retro non vuole niente. Un interruttore unico per tutto il
// locale si spegnerebbe dove dà fastidio, lasciando senza chi ne aveva
// bisogno: la scelta è per dispositivo E per persona.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  AVVISI,
  avvisiPerRuolo,
  avvisoAttivo,
  leggiAvvisi,
  scriviAvviso,
  subscribeAvvisi,
  idAvvisoStato,
  idAvvisoScorta,
} from '../../src/lib/preferenzeNotifiche.js'

beforeEach(() => {
  localStorage.clear()
})

describe('di partenza sono tutti accesi', () => {
  // Nessuno deve scoprire di essersi perso un ordine perché "era spento
  // di default".
  it('senza niente in memoria, ogni avviso è attivo', () => {
    const p = leggiAvvisi('u1')
    for (const a of AVVISI) expect(avvisoAttivo(p, a.id)).toBe(true)
  })

  it('un avviso mai sentito prima è acceso: nel dubbio si avvisa', () => {
    expect(avvisoAttivo({}, 'qualcosa_di_nuovo')).toBe(true)
    expect(avvisoAttivo(null, 'nuovo_ordine')).toBe(true)
  })
})

describe('la scelta è di chi guarda questo schermo', () => {
  it('spegnere un avviso non tocca gli altri', () => {
    scriviAvviso('u1', 'nuovo_ordine', false)
    const p = leggiAvvisi('u1')
    expect(avvisoAttivo(p, 'nuovo_ordine')).toBe(false)
    expect(avvisoAttivo(p, idAvvisoStato('pronto'))).toBe(true)
  })

  // Due persone che si passano lo stesso tablet nei cambi turno.
  it('due utenti sullo stesso dispositivo non si sovrascrivono', () => {
    scriviAvviso('anna', 'nuovo_ordine', false)
    expect(avvisoAttivo(leggiAvvisi('anna'), 'nuovo_ordine')).toBe(false)
    expect(avvisoAttivo(leggiAvvisi('marco'), 'nuovo_ordine')).toBe(true)
  })

  it('si può riaccendere', () => {
    scriviAvviso('u1', 'nuova_versione', false)
    scriviAvviso('u1', 'nuova_versione', true)
    expect(avvisoAttivo(leggiAvvisi('u1'), 'nuova_versione')).toBe(true)
  })

  it('chi ascolta viene avvisato del cambiamento', () => {
    const visto = vi.fn()
    const stop = subscribeAvvisi('u1', visto)
    scriviAvviso('u1', 'nuovo_ordine', false)
    expect(visto).toHaveBeenCalledTimes(2) // subito, e al cambio
    expect(avvisoAttivo(visto.mock.calls.at(-1)[0], 'nuovo_ordine')).toBe(false)
    stop()
  })
})

describe('avvisi per ruolo', () => {
  // Il magazzino è roba di chi lo tiene: in sala non si sa cosa farsene.
  it('le scorte le vede solo chi tiene il gestionale', () => {
    const perGestore = avvisiPerRuolo(true).map((a) => a.id)
    const perSala = avvisiPerRuolo(false).map((a) => a.id)
    expect(perGestore).toContain(idAvvisoScorta('low'))
    expect(perGestore).toContain(idAvvisoScorta('empty'))
    expect(perSala).not.toContain(idAvvisoScorta('low'))
    // Gli ordini invece interessano tutti.
    expect(perSala).toContain('nuovo_ordine')
    expect(perSala).toContain(idAvvisoStato('pronto'))
  })
})

describe('gli stati della preparazione si accendono uno per uno', () => {
  it('ogni stato ha il suo interruttore', () => {
    const ids = AVVISI.map((a) => a.id)
    expect(ids).toContain(idAvvisoStato('in_preparazione'))
    expect(ids).toContain(idAvvisoStato('pronto'))
    expect(ids).toContain(idAvvisoStato('ritirato'))
  })

  it('spegnere «pronto» lascia acceso «in preparazione»', () => {
    scriviAvviso('u1', idAvvisoStato('pronto'), false)
    const p = leggiAvvisi('u1')
    expect(avvisoAttivo(p, idAvvisoStato('pronto'))).toBe(false)
    expect(avvisoAttivo(p, idAvvisoStato('in_preparazione'))).toBe(true)
  })
})
