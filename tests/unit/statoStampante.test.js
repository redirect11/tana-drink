// @vitest-environment happy-dom
'use strict'

// SI STAMPERÀ O NO. Al banco lo si scopriva stampando: se non usciva niente
// la comanda era già persa. In sala è peggio — il telefono ha l'IP (la
// configurazione arriva dal server) ma il certificato della stampante si
// accetta a mano e quell'eccezione cade da sola: il telefono sembra a posto
// e non stampa. Qui si controlla prima, e si dice cosa non va.

import { describe, it, expect, vi, beforeEach } from 'vitest'

let impostazioni = { ip: '192.168.1.50', port: 8043, stampaSala: 'ip' }
const prepara = vi.fn(() => Promise.resolve({ ok: true }))

vi.mock('../../src/lib/printer.js', () => ({
  loadPrinterSettings: () => impostazioni,
  preparaStampante: () => prepara(),
}))

const { controllaStampante, statoStampante } = await import('../../src/lib/statoStampante.js')

beforeEach(() => {
  impostazioni = { ip: '192.168.1.50', port: 8043, stampaSala: 'ip' }
  prepara.mockClear()
  prepara.mockResolvedValue({ ok: true })
})

describe('lo stato della stampante', () => {
  it('se risponde, la comanda uscirà', async () => {
    const s = await controllaStampante()
    expect(s.stato).toBe('ok')
    expect(statoStampante().stato).toBe('ok')
  })

  it('se non risponde dice anche perché: il motivo è quello che si va a sistemare', async () => {
    prepara.mockResolvedValue({ ok: false, motivo: 'Connessione fallita (SSL_CONNECT_FAILED).' })
    const s = await controllaStampante()
    expect(s.stato).toBe('ko')
    expect(s.motivo).toMatch(/SSL_CONNECT_FAILED/)
  })

  it('senza IP non è un guasto: qui la stampante non c’è proprio', async () => {
    impostazioni = { ip: '', port: 8043 }
    const s = await controllaStampante()
    expect(s.stato).toBe('spenta')
    // Non si va nemmeno a bussare: non c'è un indirizzo a cui bussare.
    expect(prepara).not.toHaveBeenCalled()
  })

  it('dieci schermate che chiedono insieme fanno UNA stretta di mano sola', async () => {
    // La stampante ne regge poche: la coda, il conto e il pallino che
    // chiedono tutti all'apertura non devono diventare tre connessioni.
    let sciogli
    prepara.mockReturnValue(new Promise((r) => { sciogli = r }))
    const tutte = Promise.all([controllaStampante(), controllaStampante(), controllaStampante()])
    sciogli({ ok: true })
    await tutte
    expect(prepara).toHaveBeenCalledTimes(1)
  })
})

describe('chi stampa le comande della sala', () => {
  it('di partenza le stampa il telefono che prende l’ordine', async () => {
    vi.resetModules()
    const vero = await vi.importActual('../../src/lib/printer.js')
    expect(vero.DEFAULT_PRINTER_SETTINGS.stampaSala).toBe('ip')
    expect(vero.salaStampaDaSe({ stampaSala: 'ip' })).toBe(true)
  })

  it('col rimbalzo la sala non stampa: la comanda esce al banco', async () => {
    const vero = await vi.importActual('../../src/lib/printer.js')
    expect(vero.salaStampaDaSe({ stampaSala: 'rimbalzo' })).toBe(false)
  })

  it('una configurazione vecchia, senza la scelta, stampa dal telefono', async () => {
    // I dispositivi già in giro hanno in localStorage una configurazione
    // salvata prima che la scelta esistesse: devono comportarsi come il
    // default, non restare muti.
    const vero = await vi.importActual('../../src/lib/printer.js')
    expect(vero.salaStampaDaSe({ ip: '192.168.1.50' })).toBe(true)
  })
})
