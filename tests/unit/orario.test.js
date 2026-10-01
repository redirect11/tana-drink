import { describe, it, expect } from 'vitest'
import { cambioDentroOrario, fasciaDelLocale, ORARIO_PREDEFINITO } from '../../src/lib/orario.js'

// L'ORARIO DEL LOCALE (REQ-CASSA-015). Flavio, 01/10/2026: «la giornata di
// lavoro non è dalle 5 fino alle 4.59 del giorno dopo. Devo mettere io un
// inizio e una fine». Apertura e chiusura dicono quando si lavora; il
// cambio di giornata resta un'altra cosa.

describe('la fascia del locale', () => {
  it('le statistiche partono dall’orario scritto nelle impostazioni', () => {
    expect(fasciaDelLocale({ orario_apertura: '19:00', orario_chiusura: '02:45' })).toEqual({ from: '19:00', to: '02:45' })
  })

  // Chi non ha mai toccato l'impostazione vede la fascia di prima.
  it('senza orario, o con un orario illeggibile, vale quello predefinito', () => {
    expect(fasciaDelLocale({})).toEqual({ from: ORARIO_PREDEFINITO.apertura, to: ORARIO_PREDEFINITO.chiusura })
    expect(fasciaDelLocale({ orario_apertura: 'sera', orario_chiusura: '02:00' })).toEqual({ from: '18:30', to: '02:00' })
  })
})

// Un cambio di giornata dentro l'orario spezza una serata su due giornate:
// numerazione che riparte a metà sera, incasso diviso in due.
describe('il cambio di giornata dentro l’orario', () => {
  const sera = { orario_apertura: '18:30', orario_chiusura: '03:30' }

  it('alle 5, dopo la chiusura delle 3:30, va bene', () => {
    expect(cambioDentroOrario(5, sera)).toBe(false)
  })

  it('alle 2 o a mezzanotte cade dentro la serata', () => {
    expect(cambioDentroOrario(2, sera)).toBe(true)
    expect(cambioDentroOrario(0, sera)).toBe(true)
    expect(cambioDentroOrario(20, sera)).toBe(true)
  })

  it('un orario che non scavalca la mezzanotte si legge uguale', () => {
    const giorno = { orario_apertura: '08:00', orario_chiusura: '16:00' }
    expect(cambioDentroOrario(5, giorno)).toBe(false)
    expect(cambioDentroOrario(12, giorno)).toBe(true)
  })

  // Sul bordo la serata è finita (o non è cominciata).
  it('sull’ora di chiusura o di apertura non avvisa', () => {
    expect(cambioDentroOrario(4, { orario_apertura: '18:00', orario_chiusura: '04:00' })).toBe(false)
    expect(cambioDentroOrario(18, { orario_apertura: '18:00', orario_chiusura: '04:00' })).toBe(false)
  })
})
