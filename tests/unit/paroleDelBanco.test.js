'use strict'

// UNA PAROLA SOLA PER OGNI PASSO, AL BANCO (REQ-UI-021).
//
// Lo stesso passo si chiamava in quattro modi a seconda di dove lo si
// leggeva: «Pronto» nella tabella del servizio dentro il conto, «Pronto al
// servizio» sull'etichetta di stato, «Ritiro/Servizio» in testa alla colonna
// della coda, «È pronto» sul tasto della card. Chi lavora vedeva quattro
// parole per una cosa sola — ed è lo stesso guaio, più piccolo, della
// pastiglia che diceva «Ordine ricevuto» accanto alla colonna «Da fare».
//
// LA DECISIONE: al banco vince la più corta, «Pronto». Una testata di colonna
// si legge da lontano mentre si versa; «Ritiro/Servizio» diceva DOVE VA il
// drink, che è un'altra domanda e ha già le sue due colonne quando il pronto
// si divide («Da servire» / «Da ritirare»).
//
// AL CLIENTE resta «Pronto al servizio»: a lui «Pronto» da solo non dice se
// deve alzarsi o aspettare. Le parole del banco e quelle del cliente sono due
// insiemi diversi, ed è voluto — è la regola che sta scritta in orderStatus.js.

import { describe, it, expect } from 'vitest'
import {
  ORDER_STATUSES,
  STATUS_LABELS,
  statoAlBanco,
  ritiratoLabel,
} from '../../src/lib/orderStatus.js'
import { SERVIZIO_ETICHETTA } from '../../src/lib/comande.js'
import { corsieComande, azioneComanda } from '../../src/lib/coda.js'

describe('al banco il passo «pronto» si chiama Pronto, e basta', () => {
  it('l’etichetta di stato', () => {
    expect(statoAlBanco(ORDER_STATUSES.PRONTO)).toBe('Pronto')
  })

  it('la testata della colonna', () => {
    const colonna = corsieComande([]).find((c) => c.stato === ORDER_STATUSES.PRONTO)
    expect(colonna.titolo).toBe(statoAlBanco(ORDER_STATUSES.PRONTO))
  })

  it('il tasto che ci porta', () => {
    // La parola sul tasto è quella dello stato in cui il drink finisce, ed è
    // la stessa che intitola la colonna in cui finirà: si vede dove va a
    // finire prima di premere.
    const azione = azioneComanda(
      { id: 'c1', status: ORDER_STATUSES.IN_PREPARAZIONE },
      { service_mode: 'tavolo' }
    )
    expect(azione.etichetta).toBe(statoAlBanco(ORDER_STATUSES.PRONTO))
  })

  it('e la tabella del servizio dentro il conto', () => {
    expect(SERVIZIO_ETICHETTA[ORDER_STATUSES.PRONTO]).toContain(
      statoAlBanco(ORDER_STATUSES.PRONTO)
    )
  })
})

describe('gli altri passi non si sono mossi', () => {
  it('«da fare» resta «Da fare», col cliente che legge «Ordine ricevuto»', () => {
    expect(statoAlBanco(ORDER_STATUSES.RICEVUTO)).toBe('Da fare')
    expect(SERVIZIO_ETICHETTA[ORDER_STATUSES.RICEVUTO]).toContain('Da fare')
    expect(STATUS_LABELS[ORDER_STATUSES.RICEVUTO]).toBe('Ordine ricevuto')
  })

  it('«in preparazione» si dice uguale dappertutto', () => {
    expect(statoAlBanco(ORDER_STATUSES.IN_PREPARAZIONE)).toBe('In preparazione')
    expect(STATUS_LABELS[ORDER_STATUSES.IN_PREPARAZIONE]).toBe('In preparazione')
  })

  it('l’ultimo passo dipende da come si consegna, e questo resta', () => {
    // Nessuno dice «ritirato» di un drink portato al tavolo.
    expect(statoAlBanco(ORDER_STATUSES.RITIRATO, 'banco')).toBe('Ritirato')
    expect(statoAlBanco(ORDER_STATUSES.RITIRATO, 'tavolo')).toBe('Servito')
    expect(statoAlBanco(ORDER_STATUSES.RITIRATO)).toBe(ritiratoLabel(undefined))
  })
})

describe('al cliente si parla un’altra lingua, ed è voluto', () => {
  it('«Pronto al servizio» resta suo', () => {
    // A chi ha ordinato dal telefono «Pronto» da solo non dice se deve
    // alzarsi o aspettare che glielo portino.
    expect(STATUS_LABELS[ORDER_STATUSES.PRONTO]).toBe('Pronto al servizio')
    expect(STATUS_LABELS[ORDER_STATUSES.PRONTO]).not.toBe(
      statoAlBanco(ORDER_STATUSES.PRONTO)
    )
  })
})
