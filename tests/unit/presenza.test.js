'use strict'

// CHI C'È STASERA, nella legenda della coda.
//
// La legenda diceva solo chi aveva già battuto un conto: chi si collegava e
// non aveva ancora aperto niente non compariva — nemmeno per sé stesso, e
// quindi non sapeva con che lettera si sarebbe riconosciuto sulle card.
//
// Le due cose che qui costano care:
//   · la RISERVATEZZA — chi è collegato lo vedono solo admin e bartender;
//     la sala vede la legenda di sempre e il cliente non vede niente;
//   · la PRESENZA SCADE — non esiste un logout affidabile (si chiude
//     l'app, si blocca il tablet, finisce la batteria), quindi chi tace
//     esce da solo. Se restasse, la legenda direbbe che c'è gente che è
//     andata a casa.

import { describe, it, expect } from 'vitest'
import {
  eCollegato,
  inizialeDi,
  legendaConPresenze,
  FINESTRA_PRESENZA_MS,
} from '../../src/lib/presenza.js'

const ORA = Date.parse('2026-08-19T22:00:00.000Z')
const vistoDa = (ms) => new Date(ORA - ms).toISOString()

const daiConti = [
  ['D', 'Daniele'],
  ['L', 'Lucia'],
]
const marcoCollegato = { uid: 'u-marco', name: 'Marco', role: 'staff', last_seen: vistoDa(60_000) }

describe('la presenza scade da sola', () => {
  it('chi ha dato un colpo di vita poco fa è collegato', () => {
    expect(eCollegato({ last_seen: vistoDa(60_000) }, ORA)).toBe(true)
  })

  it('chi tace da più della finestra è sparito', () => {
    expect(eCollegato({ last_seen: vistoDa(FINESTRA_PRESENZA_MS + 1000) }, ORA)).toBe(false)
  })

  it('e chi non ha mai dato segno non c’è mai stato', () => {
    expect(eCollegato({}, ORA)).toBe(false)
    expect(eCollegato({ last_seen: 'ieri sera' }, ORA)).toBe(false)
    expect(eCollegato(null, ORA)).toBe(false)
  })
})

describe('chi vede chi è collegato', () => {
  const conRuolo = (ruolo) =>
    legendaConPresenze(daiConti, [marcoCollegato], { ruolo, adesso: ORA })

  it('l’admin e il bartender lo vedono', () => {
    for (const ruolo of ['admin', 'bartender']) {
      const lettere = conRuolo(ruolo).map((v) => v.lettera)
      expect(lettere, ruolo).toContain('M')
    }
  })

  it('la sala vede solo chi ha battuto: non chi è online', () => {
    const voci = conRuolo('staff')
    expect(voci.map((v) => v.lettera)).toEqual(['D', 'L'])
  })

  it('il cliente non vede nemmeno quella', () => {
    // Non è personale: gli resta quello che la coda gli passa, senza che
    // questa funzione ci aggiunga niente.
    const voci = conRuolo('cliente')
    expect(voci.map((v) => v.lettera)).toEqual(['D', 'L'])
    expect(voci.every((v) => !v.soloOnline)).toBe(true)
  })
})

describe('la legenda messa insieme', () => {
  it('chi è collegato e non ha battuto si aggiunge, marcato', () => {
    const voci = legendaConPresenze(daiConti, [marcoCollegato], { ruolo: 'admin', adesso: ORA })
    const marco = voci.find((v) => v.lettera === 'M')
    expect(marco).toMatchObject({ nome: 'Marco', soloOnline: true })
  })

  it('chi ha già battuto non si duplica, e la sua voce non cambia', () => {
    const daniele = { uid: 'u-dan', name: 'Daniele', role: 'bartender', last_seen: vistoDa(1000) }
    const voci = legendaConPresenze(daiConti, [daniele], { ruolo: 'admin', adesso: ORA })
    expect(voci.filter((v) => v.lettera === 'D')).toHaveLength(1)
    expect(voci.find((v) => v.lettera === 'D').soloOnline).toBe(false)
  })

  it('chi guarda si riconosce, che abbia battuto o no', () => {
    const daniele = { uid: 'u-dan', name: 'Daniele', role: 'bartender', last_seen: vistoDa(1000) }
    const conBattuti = legendaConPresenze(daiConti, [daniele], {
      ruolo: 'admin', uidMio: 'u-dan', adesso: ORA,
    })
    expect(conBattuti.find((v) => v.lettera === 'D').mio).toBe(true)

    const senza = legendaConPresenze(daiConti, [marcoCollegato], {
      ruolo: 'admin', uidMio: 'u-marco', adesso: ORA,
    })
    expect(senza.find((v) => v.lettera === 'M')).toMatchObject({ mio: true, soloOnline: true })
  })

  it('chi è andato a casa non compare, anche se la riga è rimasta', () => {
    const andato = { uid: 'u-x', name: 'Sara', role: 'staff', last_seen: vistoDa(FINESTRA_PRESENZA_MS * 2) }
    const voci = legendaConPresenze(daiConti, [andato], { ruolo: 'admin', adesso: ORA })
    expect(voci.map((v) => v.lettera)).not.toContain('S')
  })

  it('un cliente collegato non è mai una voce della legenda', () => {
    // La legenda dice chi LAVORA. I clienti hanno la loro riga, «👤 Cliente»,
    // e nasce dagli ordini — non da chi ha l'app aperta.
    const cliente = { uid: 'u-c', name: 'Carla', role: 'cliente', last_seen: vistoDa(1000) }
    const voci = legendaConPresenze(daiConti, [cliente], { ruolo: 'admin', adesso: ORA })
    expect(voci.map((v) => v.lettera)).not.toContain('C')
  })

  it('in ordine alfabetico, che è come si cerca una lettera', () => {
    const tanti = [
      { uid: '1', name: 'Alba', role: 'staff', last_seen: vistoDa(1000) },
      { uid: '2', name: 'Zoe', role: 'bartender', last_seen: vistoDa(1000) },
    ]
    const voci = legendaConPresenze(daiConti, tanti, { ruolo: 'admin', adesso: ORA })
    expect(voci.map((v) => v.lettera)).toEqual(['A', 'D', 'L', 'Z'])
  })
})

describe('l’iniziale', () => {
  it('è la prima lettera, maiuscola', () => {
    expect(inizialeDi('marco')).toBe('M')
    expect(inizialeDi('  lucia ')).toBe('L')
  })

  it('e senza nome non c’è iniziale da inventare', () => {
    expect(inizialeDi('')).toBe(null)
    expect(inizialeDi(null)).toBe(null)
  })
})
