'use strict'

// ── LA STAMPA AUTOMATICA SA DA DOVE VIENE IL GESTO (REQ-STAMPA-021) ─────
//
// Richiesta dell'08/11/2026: «differenziare se le operazioni provengono da
// cassa o da sala (esempio: stampa solo riscossione da banco e stampa in
// automatico la comanda se presa da sala)». Al banco la comanda di quello
// che si prepara da sé non serve, quella presa al tavolo sì; lo scontrino
// lo vuole chi incassa alla cassa.
//
// L'origine è il ruolo di chi ha fatto il gesto: banco = admin e bartender,
// sala = la sala e i clienti. Per una comanda conta chi ne ha battuto le
// righe (la firma, REQ-ORD-023); per le comande di prima, chi ha aperto il
// conto.

import { describe, it, expect } from 'vitest'
import {
  comandeDaStampare,
  origineDelRuolo,
  ruoloDellaComanda,
  scontrinoAutomatico,
  stampaDa,
  DEFAULT_PRINTER_SETTINGS,
} from '../../src/lib/printer.js'

const firma = (role) => ({ name: role, email: `${role}@tana.it`, role })
const comanda = (id, role) => ({
  id,
  status: 'ricevuto',
  items: [{ drink_id: 'negroni', name: 'Negroni', qty: 1, unit_price: 7, ...(role ? { added_by: firma(role) } : {}) }],
})
// Un conto aperto al banco, con una comanda del banco e una presa in sala.
// Nessun `device` su placed_by: lo stampa qualunque terminale, e qui si
// prova solo la regola dell'origine.
const conto = () => ({
  id: 'o1',
  status: 'aperto',
  placed_by: firma('bartender'),
  comande: [comanda('c1', 'bartender'), comanda('c2', 'staff')],
})
const stampate = (da) =>
  comandeDaStampare(conto(), { impostazioni: { ...DEFAULT_PRINTER_SETTINGS, autoPrintComandaDa: da } }).map((c) => c.id)

describe('da dove viene il gesto', () => {
  it('admin e bartender sono il banco; la sala e il cliente sono la sala', () => {
    expect(origineDelRuolo('admin')).toBe('banco')
    expect(origineDelRuolo('bartender')).toBe('banco')
    expect(origineDelRuolo('staff')).toBe('sala')
    expect(origineDelRuolo('cliente')).toBe('sala')
    expect(origineDelRuolo(null)).toBe('sala')
  })

  it('una comanda è di chi ne ha battuto le righe; senza firma, di chi ha aperto il conto', () => {
    const o = conto()
    expect(ruoloDellaComanda(o, o.comande[1])).toBe('staff')
    expect(ruoloDellaComanda(o, comanda('c3'))).toBe('bartender')
    expect(ruoloDellaComanda({}, comanda('c3'))).toBeNull()
  })

  it('di partenza vale tutto, come prima: chi non sceglie non perde niente', () => {
    expect(DEFAULT_PRINTER_SETTINGS.autoPrintComandaDa).toBe('tutti')
    expect(DEFAULT_PRINTER_SETTINGS.autoPrintScontrinoDa).toBe('tutti')
    expect(stampaDa(undefined, 'staff')).toBe(true)
  })
})

describe('la comanda automatica', () => {
  it('«Banco e sala»: escono tutte e due', () => {
    expect(stampate('tutti')).toEqual(['c1', 'c2'])
  })

  it('«Solo dalla sala»: esce quella presa al tavolo, non quella del banco', () => {
    expect(stampate('sala')).toEqual(['c2'])
  })

  it('«Solo dal banco»: esce quella del banco', () => {
    expect(stampate('banco')).toEqual(['c1'])
  })
})

describe('lo scontrino alla riscossione', () => {
  const imp = (da, acceso = true) => ({ ...DEFAULT_PRINTER_SETTINGS, autoPrintScontrino: acceso, autoPrintScontrinoDa: da })

  it('«Solo dal banco»: esce se incassa il banco, non se chiude la sala', () => {
    expect(scontrinoAutomatico('bartender', imp('banco'))).toBe(true)
    expect(scontrinoAutomatico('admin', imp('banco'))).toBe(true)
    expect(scontrinoAutomatico('staff', imp('banco'))).toBe(false)
  })

  it('«Solo dalla sala»: il contrario', () => {
    expect(scontrinoAutomatico('staff', imp('sala'))).toBe(true)
    expect(scontrinoAutomatico('bartender', imp('sala'))).toBe(false)
  })

  it('con la stampa automatica spenta non esce da nessuna parte', () => {
    expect(scontrinoAutomatico('bartender', imp('tutti', false))).toBe(false)
  })
})
