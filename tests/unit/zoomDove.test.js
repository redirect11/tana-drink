'use strict'

// I TASTI DELLO ZOOM NON VANNO DAPPERTUTTO. Servono dove si legge tanta
// roba fitta stando fermi a guardarla — la coda, il conto, il flusso cassa
// — e altrove sono due tasti flottanti che coprono il contenuto per una
// cosa che lì nessuno usa.

import { describe, it, expect } from 'vitest'
import { zoomDove } from '../../src/lib/zoomDove.js'

describe('dove servono i tasti dello zoom', () => {
  it('nella coda ordini, che è la schermata dove si sta a guardare', () => {
    expect(zoomDove('/bar', '', true)).toBe(true)
    expect(zoomDove('/bar', '?tab=coda', true)).toBe(true)
  })

  it('nel conto: mentre lo si batte e riaprendone uno', () => {
    expect(zoomDove('/pos', '', true)).toBe(true)
    expect(zoomDove('/ordine/abc123', '', true)).toBe(true)
  })

  it('nel flusso cassa, che è una tabella di numeri', () => {
    expect(zoomDove('/bar', '?tab=pagamenti', true)).toBe(true)
  })

  it('nelle altre sezioni no: lì si scorre, non si guarda un quadro d’insieme', () => {
    expect(zoomDove('/bar', '?tab=inventario', true)).toBe(false)
    expect(zoomDove('/bar', '?tab=impostazioni', true)).toBe(false)
    expect(zoomDove('/bar', '?tab=menu', true)).toBe(false)
    expect(zoomDove('/profilo-staff', '', true)).toBe(false)
  })

  it('al cliente non servono: il suo browser lo zoom ce l’ha già', () => {
    expect(zoomDove('/bar', '', false)).toBe(false)
    expect(zoomDove('/menu', '', false)).toBe(false)
  })
})
