// @vitest-environment happy-dom
'use strict'

// ── IL DIARIO DELLA STAMPANTE: COSA SCRIVE, E COSA NON SCRIVE ────────
// (REQ-STAMPA-019)
//
// Daniele, 14/09/2026: «salvare i log diagnostici della stampante quando
// ha problemi e quando risulta offline nel database, con una log rotation
// per serata in modo da non intasare il db». Il modulo è puro: chi scrive
// davvero si registra, e qui lo scrittore è finto. Le tre cose da provare
// sono la ROTAZIONE (un documento per serata e terminale), il FRENO (lo
// stesso guaio ripetuto non si riscrive, e oltre il tetto si tace) e la
// PULIZIA (i documenti vecchi li cancella chi li ha scritti).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  segnala,
  impostaScrittoreDiagnostica,
  impostaContestoDiagnostica,
  impostaSessioneDiagnostica,
  azzeraDiagnostica,
  idDocumento,
  TETTO_EVENTI,
  FINESTRA_RIPETIZIONI,
  GIORNI_DA_TENERE,
  TIPO,
} from '../../src/lib/diagnosticaStampante.js'
import { idDispositivo } from '../../src/lib/dispositivo.js'

let scritture
let cancellazioni

beforeEach(() => {
  localStorage.clear()
  azzeraDiagnostica()
  scritture = []
  cancellazioni = []
  impostaScrittoreDiagnostica(
    (id, cosa) => scritture.push({ id, ...cosa }),
    (id) => cancellazioni.push(id)
  )
  impostaContestoDiagnostica(() => ({ stampante: { ip: '192.168.1.4', port: 8043, https: true }, chi: 'Flavio' }))
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-12T20:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('un guaio diventa una riga', () => {
  it('con ora, tipo, motivo e l’indirizzo con cui si stava parlando', () => {
    const e = segnala(TIPO.guasto, 'la carta è finita')
    expect(e).toMatchObject({ at: '2026-09-12T20:00:00.000Z', tipo: 'guasto', motivo: 'la carta è finita', ip: '192.168.1.4' })
    expect(scritture).toHaveLength(1)
    expect(scritture[0].evento).toEqual(e)
  })

  // La prima riga della serata porta l'intestazione: chi, dove, con quale
  // app. Le altre no: è già scritta.
  it('la prima riga apre il documento con l’intestazione, le altre no', () => {
    segnala(TIPO.guasto, 'la carta è finita')
    segnala(TIPO.collegamento_fallito, 'Connessione fallita (SSL_CONNECT_FAILED)')
    expect(scritture[0].intestazione).toMatchObject({
      dispositivo: idDispositivo(),
      chi: 'Flavio',
      stampante: { ip: '192.168.1.4', port: 8043, https: true },
      giornata: '2026-09-12',
      aperto_at: '2026-09-12T20:00:00.000Z',
    })
    expect(scritture[1].intestazione).toBeNull()
    expect(scritture[1].id).toBe(scritture[0].id)
  })

  it('i dettagli viaggiano con la riga, e il motivo si accorcia', () => {
    const e = segnala(TIPO.stampa_fallita, 'x'.repeat(500), { che: 'Comanda #12' })
    expect(e.motivo).toHaveLength(200)
    expect(e.dettagli).toEqual({ che: 'Comanda #12' })
  })

  it('senza uno scrittore registrato non succede niente, e non si rompe', () => {
    impostaScrittoreDiagnostica(null)
    expect(segnala(TIPO.guasto, 'boh')).toBeNull()
  })
})

describe('un documento per serata e per terminale', () => {
  it('a cassa chiusa si intitola alla giornata commerciale', () => {
    expect(idDocumento(null)).toBe(`giorno-2026-09-12--${idDispositivo()}`)
    // Le tre di notte sono ancora la serata del 12.
    vi.setSystemTime(new Date('2026-09-13T01:30:00Z'))
    expect(idDocumento(null)).toBe(`giorno-2026-09-12--${idDispositivo()}`)
  })

  it('a cassa aperta si intitola alla sessione', () => {
    impostaSessioneDiagnostica('cs-1')
    expect(idDocumento()).toBe(`cassa-cs-1--${idDispositivo()}`)
  })

  // È la rotazione chiesta: «ogni apertura cassa si logga tutto».
  it('cambiando sessione si apre un documento nuovo, con la sua intestazione', () => {
    segnala(TIPO.guasto, 'prima')
    segnala(TIPO.apertura_cassa, '', null, { sessione: 'cs-2' })
    segnala(TIPO.guasto, 'dopo')
    expect(scritture.map((s) => s.id)).toEqual([
      `giorno-2026-09-12--${idDispositivo()}`,
      `cassa-cs-2--${idDispositivo()}`,
      `cassa-cs-2--${idDispositivo()}`,
    ])
    expect(scritture[1].intestazione).toMatchObject({ sessione_id: 'cs-2' })
    expect(scritture[2].intestazione).toBeNull()
  })
})

describe('il freno: non intasa il database', () => {
  it('lo stesso guaio entro un minuto non si riscrive, ma si conta', () => {
    segnala(TIPO.guasto, 'la stampante non risponde')
    expect(segnala(TIPO.guasto, 'la stampante non risponde')).toBeNull()
    expect(segnala(TIPO.guasto, 'la stampante non risponde')).toBeNull()
    vi.advanceTimersByTime(FINESTRA_RIPETIZIONI)
    const e = segnala(TIPO.guasto, 'la stampante non risponde')
    expect(e.ripetuti_prima).toBe(2)
    expect(scritture).toHaveLength(2)
  })

  it('un guaio diverso passa subito', () => {
    segnala(TIPO.guasto, 'la carta è finita')
    expect(segnala(TIPO.guasto, 'il coperchio della stampante è aperto')).not.toBeNull()
  })

  it('oltre il tetto si scrive una riga «tetto» e poi si tace', () => {
    for (let i = 0; i < TETTO_EVENTI; i++) segnala(TIPO.guasto, `guaio ${i}`)
    expect(scritture).toHaveLength(TETTO_EVENTI)
    const tetto = segnala(TIPO.guasto, 'uno di troppo')
    expect(tetto.tipo).toBe('tetto')
    expect(segnala(TIPO.guasto, 'e un altro')).toBeNull()
    expect(scritture).toHaveLength(TETTO_EVENTI + 1)
    // La serata dopo si riparte da zero.
    segnala(TIPO.apertura_cassa, '', null, { sessione: 'cs-3' })
    expect(scritture.at(-1).evento.tipo).toBe('apertura_cassa')
  })
})

describe('la pulizia: i vecchi li cancella chi li ha scritti', () => {
  it('aprendo un documento nuovo, quelli più vecchi del limite spariscono', () => {
    segnala(TIPO.guasto, 'ieri')
    const vecchio = scritture[0].id
    vi.setSystemTime(new Date(Date.now() + (GIORNI_DA_TENERE + 1) * 86_400_000))
    segnala(TIPO.apertura_cassa, '', null, { sessione: 'cs-9' })
    expect(cancellazioni).toEqual([vecchio])
    // E il nuovo resta in memoria per la prossima pulizia.
    expect(JSON.parse(localStorage.getItem('tana:diagnostica-stampante-documenti')).map((d) => d.id)).toEqual([
      `cassa-cs-9--${idDispositivo()}`,
    ])
  })

  it('un documento recente non si tocca', () => {
    segnala(TIPO.guasto, 'ieri')
    vi.setSystemTime(new Date(Date.now() + 2 * 86_400_000))
    segnala(TIPO.apertura_cassa, '', null, { sessione: 'cs-9' })
    expect(cancellazioni).toEqual([])
  })
})
