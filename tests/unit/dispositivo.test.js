// @vitest-environment happy-dom
'use strict'

// CHI HA BATTUTO L'ORDINE: NON CHI, MA DA DOVE. Al banco lo stesso account
// sta su più terminali — il tablet della cassa, il telefono in sala. Prima si
// tacevano tutti gli ordini battuti da un gestore, su qualunque dispositivo:
// chi stava in sala col telefono non sapeva mai che al banco era entrato un
// ordine.

import { describe, it, expect, beforeEach, vi } from 'vitest'

async function lib() {
  localStorage.clear()
  vi.resetModules()
  return import('../../src/lib/dispositivo.js')
}

describe('idDispositivo', () => {
  let d
  beforeEach(async () => {
    d = await lib()
  })

  it('è lo stesso a ogni chiamata, e resta dopo un riavvio', async () => {
    const primo = d.idDispositivo()
    expect(d.idDispositivo()).toBe(primo)
    // Riavvio dell'app: il modulo si ricarica ma la memoria locale resta.
    vi.resetModules()
    const dopo = await import('../../src/lib/dispositivo.js')
    expect(dopo.idDispositivo()).toBe(primo)
  })

  it('due dispositivi diversi hanno identificativi diversi', async () => {
    const primo = d.idDispositivo()
    const altro = await lib() // un altro browser: memoria vuota
    expect(altro.idDispositivo()).not.toBe(primo)
  })
})

describe('battutoDaQui', () => {
  let d
  beforeEach(async () => {
    d = await lib()
  })

  it('riconosce l’ordine mandato da questo terminale', () => {
    const io = d.idDispositivo()
    expect(d.battutoDaQui({ email: 'anna@tana.it', device: io })).toBe(true)
  })

  it('un ordine dallo stesso account ma da un altro terminale non è mio', () => {
    // È il caso che prima spariva: stesso bartender, tablet della cassa e
    // telefono in sala.
    expect(d.battutoDaQui({ email: 'anna@tana.it', device: 'altro-terminale' })).toBe(false)
  })

  // Un avviso in più si chiude, uno in meno è un drink che non parte.
  it('nel dubbio avvisa: ordini senza dispositivo, o dai clienti', () => {
    expect(d.battutoDaQui({ email: 'anna@tana.it' })).toBe(false)
    expect(d.battutoDaQui(null)).toBe(false)
  })
})
