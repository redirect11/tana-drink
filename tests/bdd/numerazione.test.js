'use strict'

// BDD — due terminali, lo stesso numero (functions/lib/numerazione.js)
//
// Feature: il numero del conto lo assegna il dispositivo, per poter battere
// un conto all'istante e anche offline. Il prezzo è che il telefono della
// sala e il tablet del banco, battendo nello stesso momento, possono
// prendersi lo stesso #15. La disputa la chiude il server: tiene il numero
// chi è arrivato prima, chi arriva dopo prende il primo libero — automatico,
// perché al banco non si ferma una serata per un numero.

import { describe, it, expect } from 'vitest'
import { numeroDaRiassegnare, primoArrivato } from '../../functions/lib/numerazione.js'

const banco = { id: 'ord-banco', created_at: 1000, daily_number: 15 }
const sala = { id: 'ord-sala', created_at: 1200, daily_number: 15 }

describe('due conti con lo stesso numero', () => {
  it('chi è arrivato prima tiene il suo', () => {
    expect(numeroDaRiassegnare(banco, [banco, sala])).toBe(null)
  })

  it('chi arriva dopo prende il primo libero', () => {
    // #15 è occupato e #14 è il più alto degli altri: il nuovo è il 16.
    expect(numeroDaRiassegnare(sala, [banco, sala])).toBe(16)
  })

  it('il numero libero è DOPO il più alto, non un buco in mezzo', () => {
    // Prendere un buco vorrebbe dire rubarlo a un conto ancora per strada,
    // e la disputa ricomincerebbe da capo.
    const altri = [
      banco,
      sala,
      { id: 'a', created_at: 500, daily_number: 12 },
      { id: 'b', created_at: 600, daily_number: 20 },
    ]
    expect(numeroDaRiassegnare(sala, altri)).toBe(21)
  })

  it('nessuno contende il numero: non si tocca niente', () => {
    const solo = { id: 'x', created_at: 900, daily_number: 7 }
    expect(numeroDaRiassegnare(solo, [banco, sala, solo])).toBe(null)
  })

  it('stesso millisecondo: decide l’id, ma decide UGUALE per tutti', () => {
    // L'importante non è chi vince, è che i due terminali arrivino alla
    // stessa conclusione: altrimenti si rinumerano tutti e due.
    const a = { id: 'aaa', created_at: 1000, daily_number: 15 }
    const b = { id: 'bbb', created_at: 1000, daily_number: 15 }
    expect(primoArrivato([a, b]).id).toBe('aaa')
    expect(primoArrivato([b, a]).id).toBe('aaa')
    expect(numeroDaRiassegnare(a, [a, b])).toBe(null)
    expect(numeroDaRiassegnare(b, [a, b])).toBe(16)
  })

  it('gli orari arrivano in tre forme, e vanno confrontati lo stesso', () => {
    // Timestamp di Firestore, ISO dal client, o niente.
    const conTimestamp = { id: 'ts', created_at: { toMillis: () => 900 }, daily_number: 15 }
    const conIso = { id: 'iso', created_at: '2026-08-17T10:00:00.000Z', daily_number: 15 }
    expect(numeroDaRiassegnare(conTimestamp, [conTimestamp, conIso])).toBe(null)
    expect(numeroDaRiassegnare(conIso, [conTimestamp, conIso])).toBe(16)
  })

  it('un conto senza orario passa buono per ultimo', () => {
    const senzaOra = { id: 'boh', created_at: null, daily_number: 15 }
    expect(numeroDaRiassegnare(senzaOra, [banco, senzaOra])).toBe(16)
    expect(numeroDaRiassegnare(banco, [banco, senzaOra])).toBe(null)
  })

  it('senza numero non c’è niente da risolvere', () => {
    expect(numeroDaRiassegnare({ id: 'x', created_at: 1 }, [banco])).toBe(null)
  })
})
