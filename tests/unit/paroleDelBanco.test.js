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
// ── E LA COLONNA HA CAMBIATO IDEA, IL 20/08/2026 ────────────────────
// «Anche la label sopra la lane, non deve essere Pronto ma Da
// servire/Ritirare» (l'utente). La regola di REQ-UI-021 non cade: resta
// una parola sola per passo NEI POSTI CHE PARLANO DELLO STATO — la
// pastiglia, il tasto, la tabella del conto dicono tutti «Pronto». La
// COLONNA no: quella non dice a che punto è il drink, dice CHE LAVORO C'È
// LÌ DENTRO, e il lavoro è portarlo o consegnarlo. Il nome segue il mondo
// della consegna (nomiDelServizio): «Da servire/Ritirare» dove si ritira
// anche al banco, «Da servire» dove si serve e basta.
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
import { corsieComande, azioneComanda, nomiDelServizio } from '../../src/lib/coda.js'

describe('al banco il passo «pronto» si chiama Pronto, e basta', () => {
  it('l’etichetta di stato', () => {
    expect(statoAlBanco(ORDER_STATUSES.PRONTO)).toBe('Pronto')
  })

  it('la testata della colonna dice il LAVORO, non lo stato', () => {
    // L'unica deroga, e voluta: la colonna nomina il gesto da fare, e
    // quel nome sta in un posto solo per tutti e tre i suoi usi
    // (colonna, chip del filtro, porzione del tasto dei chiusi).
    const colonna = (ritiro) =>
      corsieComande([], { ritiroEsiste: ritiro }).find(
        (c) => c.stato === ORDER_STATUSES.PRONTO
      ).titolo
    expect(colonna(true)).toBe(nomiDelServizio(true).daServire)
    expect(colonna(true)).toBe('Da servire/Ritirare')
    expect(colonna(false)).toBe('Da servire')
  })

  it('il tasto che ci porta', () => {
    // La parola sul tasto è quella dello STATO in cui il drink finisce:
    // dice cosa succede premendo. Che la colonna dove atterra si chiami
    // col nome del lavoro è l'altra faccia della stessa cosa — il tasto
    // parla del drink, la colonna di chi ci deve mettere le mani.
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
