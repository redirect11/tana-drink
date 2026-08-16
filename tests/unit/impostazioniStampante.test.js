// @vitest-environment happy-dom
'use strict'

// LE IMPOSTAZIONI DELLA STAMPANTE SONO DEL DISPOSITIVO E DI CHI CI LAVORA.
// Del dispositivo perché l'indirizzo dipende da dove sei; della persona
// perché sullo stesso tablet si alternano in tanti, e la stampa automatica
// la vuole accesa chi sta al banco, non chi passa a battere due conti.

import { describe, it, expect, beforeEach } from 'vitest'
import {
  loadPrinterSettings,
  savePrinterSettings,
  impostaUtenteStampante,
} from '../../src/lib/printer.js'

beforeEach(() => {
  localStorage.clear()
  impostaUtenteStampante(null)
})

describe('le impostazioni della stampante', () => {
  it('ognuno ha le sue sullo stesso dispositivo', () => {
    impostaUtenteStampante('banco')
    savePrinterSettings({ ip: '192.168.1.50', autoPrintComanda: true })
    impostaUtenteStampante('sala')
    savePrinterSettings({ ip: '192.168.1.51', autoPrintComanda: false })

    impostaUtenteStampante('banco')
    expect(loadPrinterSettings().ip).toBe('192.168.1.50')
    expect(loadPrinterSettings().autoPrintComanda).toBe(true)
    impostaUtenteStampante('sala')
    expect(loadPrinterSettings().ip).toBe('192.168.1.51')
    expect(loadPrinterSettings().autoPrintComanda).toBe(false)
  })

  it('la prima volta eredita quelle del dispositivo', () => {
    // Il giorno del passaggio a impostazioni per utente, ogni tablet del
    // locale aveva già il suo indirizzo: perderlo vuol dire comande che non
    // escono, la sera stessa.
    localStorage.setItem('tana_printer_v2', JSON.stringify({ ip: '192.168.1.99' }))
    impostaUtenteStampante('nuovo')
    expect(loadPrinterSettings().ip).toBe('192.168.1.99')
  })

  it('ma appena salva, la scheda è sua e non tocca quella vecchia', () => {
    localStorage.setItem('tana_printer_v2', JSON.stringify({ ip: '192.168.1.99' }))
    impostaUtenteStampante('nuovo')
    savePrinterSettings({ ip: '192.168.1.10' })
    expect(loadPrinterSettings().ip).toBe('192.168.1.10')
    expect(JSON.parse(localStorage.getItem('tana_printer_v2')).ip).toBe('192.168.1.99')
  })

  it('senza nessuno collegato restano quelle del dispositivo', () => {
    savePrinterSettings({ ip: '10.0.0.1' })
    expect(loadPrinterSettings().ip).toBe('10.0.0.1')
    expect(JSON.parse(localStorage.getItem('tana_printer_v2')).ip).toBe('10.0.0.1')
  })

  it('si ricorda l’ultima persona anche dopo un ricaricamento', () => {
    impostaUtenteStampante('banco')
    savePrinterSettings({ ip: '192.168.1.50' })
    // Ricaricando, Firebase impiega un attimo a dire chi è collegato: senza
    // memoria si leggerebbe la scheda di un altro, e il pallino direbbe
    // «nessuna stampante impostata» per poi cambiare idea.
    expect(localStorage.getItem('tana_printer_utente')).toBe('banco')
  })
})
