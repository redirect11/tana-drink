'use strict'

// IL TITOLO DELLA PAGINA STA NELLA BARRA, non dentro la pagina: una riga di
// titolo in cima al contenuto è una riga in meno di contenuto, e su un tablet
// al banco quella riga si vede.

import { describe, it, expect } from 'vitest'
import { titoloPagina, NAV_GESTIONALE } from '../../src/lib/sezioni.js'

describe('titoloPagina', () => {
  it('nel gestionale porta il nome della sezione, con la sua icona', () => {
    expect(titoloPagina('/bar', '?tab=impostazioni')).toEqual({
      icona: '⚙️',
      titolo: 'Impostazioni',
    })
    // Il tab si chiama ancora `inventario` (cambiarlo vorrebbe dire
    // migrare indirizzi salvati), ma a schermo si legge Magazzino.
    expect(titoloPagina('/bar', '?tab=inventario').titolo).toBe('Magazzino')
  })

  // La coda è la schermata di partenza e si presenta da sé: un titolo lì
  // sarebbe solo rumore.
  it('nella coda non c’è titolo', () => {
    expect(titoloPagina('/bar', '')).toBe(null)
    expect(titoloPagina('/bar', '?tab=coda')).toBe(null)
  })

  it('vale anche per le pagine fuori dal gestionale', () => {
    expect(titoloPagina('/profilo-staff', '').titolo).toBe('Il mio profilo')
    expect(titoloPagina('/ordini', '').titolo).toBe('I miei ordini')
  })

  it('dove non serve non si inventa niente', () => {
    expect(titoloPagina('/menu', '')).toBe(null)
    expect(titoloPagina('/pos', '')).toBe(null)
    expect(titoloPagina('/', '')).toBe(null)
  })

  // Le voci del menu laterale e i titoli sono lo stesso elenco: tenendone
  // due, prima o poi uno dice «Lista ordini» e l'altro «Storico».
  it('ogni voce del menu ha icona e nome', () => {
    for (const [id, icona, nome] of NAV_GESTIONALE) {
      expect(id, 'id mancante').toBeTruthy()
      expect(icona, `icona mancante per ${id}`).toBeTruthy()
      expect(nome, `nome mancante per ${id}`).toBeTruthy()
    }
  })
})
