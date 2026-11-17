'use strict'

// ── GLI STATI DELL'ORDINE FORNITORE (REQ-MAG-038) ────────────────────
//
// «Richiesto, consegnato, pagato RIMANGONO per ordine per fornitore, non
// vanno via completamente, mi raccomando» (utente, 27/08/2026). Qui si
// sorveglia la macchina degli stati, che è la parte che se sbaglia sbaglia
// in silenzio sui numeri che a fine mese vanno dal commercialista.
//
// LA COSA PIÙ IMPORTANTE DI TUTTO IL FILE: «pagato» NON è un dato
// dell'ordine. È una domanda alla sua fattura, perché chi paga paga un
// DOCUMENTO — il bonifico porta sopra il numero della fattura, non quello
// dell'ordine. Due copie dello stesso stato divergono sempre.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { impostaLingua } from '../../src/lib/lingua.js'
import { cambiFattura, etichettaTipoDocumento } from '../../src/lib/fatture.js'
import {
  ETICHETTA_STATO,
  FILTRI_ORDINE,
  contaFiltri,
  conMovimento,
  descriviMovimento,
  eBozza,
  movimento,
  ordineChiuso,
  ordineNelFiltro,
  ordinePagato,
  statoOrdineDi,
  storiaDi,
} from '../../src/lib/statiOrdine.js'

const ordine = (patch = {}) => ({ id: 'po-1', lines: [{ stato: 'richiesto' }], ...patch })

describe('lo stato della merce si legge come sta scritto in archivio', () => {
  it('le due parole vecchie diventano quelle di Flavio', () => {
    expect(statoOrdineDi({ status: 'inviato' })).toBe('richiesto')
    expect(statoOrdineDi({ status: 'ricevuto' })).toBe('consegnato')
    expect(statoOrdineDi({ status: 'bozza' })).toBe('bozza')
  })

  // Un ordine scritto prima di questa voce può non avere `status`: si ricava
  // dalle righe. Un ordine di ieri non è una bozza per il fatto di non avere
  // il campo — e chiamarlo bozza vorrebbe dire farlo sparire dai soldi che
  // escono.
  it('un ordine senza il campo si legge dalle sue righe, e non è una bozza', () => {
    expect(statoOrdineDi({ lines: [{ stato: 'richiesto' }] })).toBe('richiesto')
    expect(statoOrdineDi({ lines: [{ stato: 'consegnato' }] })).toBe('consegnato')
    // Anche una riga già pagata alla vecchia maniera: la merce è arrivata.
    expect(statoOrdineDi({ lines: [{ stato: 'pagato' }] })).toBe('consegnato')
    expect(eBozza({ lines: [] })).toBe(false)
  })

  // «Consegnato» e «ordine ricevuto» sono la stessa cosa: «è solo estetica,
  // parole». A schermo se ne usa UNA sola, sempre la stessa.
  it('la parola a schermo è una sola per ogni stato', () => {
    expect(ETICHETTA_STATO.consegnato).toBe('Consegnato')
    expect(Object.values(ETICHETTA_STATO)).not.toContain('Ricevuto')
    expect(Object.values(ETICHETTA_STATO)).not.toContain('Ordine ricevuto')
  })
})

describe('«pagato» si chiede alla fattura, non all’ordine', () => {
  it('senza fattura collegata la risposta è no, perché non si sa', () => {
    expect(ordinePagato(ordine(), null)).toBe(false)
  })

  it('con la fattura pagata l’ordine è pagato, e il dato sta in un posto solo', () => {
    expect(ordinePagato(ordine(), { paid: true })).toBe(true)
    expect(ordinePagato(ordine(), { paid: false })).toBe(false)
  })

  // Nessun campo dell'ordine può far cambiare la risposta: se ce ne fosse
  // uno, il giorno che i due divergono il totale «Da pagare» smetterebbe di
  // valere qualcosa proprio a fine mese.
  it('nessun campo dell’ordine sposta la risposta', () => {
    expect(ordinePagato(ordine({ paid: true, pagato: true, status: 'ricevuto' }), null)).toBe(false)
  })
})

describe('chiuso non è pagato, ed è una cosa a parte', () => {
  it('si legge dalla data di chiusura, e un ordine chiuso resta consegnato', () => {
    const o = ordine({ status: 'ricevuto', closed_at: '2026-08-27T10:00:00.000Z' })
    expect(ordineChiuso(o)).toBe(true)
    expect(statoOrdineDi(o)).toBe('consegnato')
  })

  it('un ordine pagato non è chiuso per il fatto di essere pagato', () => {
    expect(ordineChiuso(ordine({ status: 'ricevuto' }))).toBe(false)
  })
})

describe('il filtro della Lista ordini', () => {
  const bozza = ordine({ id: 'b', status: 'bozza' })
  const richiesto = ordine({ id: 'r', status: 'inviato' })
  const consegnato = ordine({ id: 'c', status: 'ricevuto' })
  const chiuso = ordine({ id: 'z', status: 'ricevuto', closed_at: 'ieri' })
  const fatture = { c: { paid: true } }
  const fatturaDi = (o) => fatture[o.id] ?? null

  it('ogni voce fa la sua domanda all’asse che la riguarda', () => {
    expect(ordineNelFiltro(bozza, null, 'bozza')).toBe(true)
    expect(ordineNelFiltro(richiesto, null, 'richiesto')).toBe(true)
    expect(ordineNelFiltro(consegnato, fatture.c, 'consegnato')).toBe(true)
    expect(ordineNelFiltro(consegnato, fatture.c, 'pagato')).toBe(true)
    expect(ordineNelFiltro(chiuso, null, 'chiuso')).toBe(true)
    expect(ordineNelFiltro(bozza, null, 'tutti')).toBe(true)
  })

  // UN ORDINE PAGATO IN ANTICIPO RESTA «RICHIESTO»: si paga per non far
  // aspettare il fornitore, e la merce che non è mai arrivata deve
  // continuare a cercarla qualcuno.
  it('il pagamento non fa avanzare la merce', () => {
    expect(ordineNelFiltro(richiesto, { paid: true }, 'richiesto')).toBe(true)
    expect(ordineNelFiltro(richiesto, { paid: true }, 'pagato')).toBe(true)
    expect(ordineNelFiltro(richiesto, { paid: true }, 'consegnato')).toBe(false)
  })

  // Una bozza non è stata mandata a nessuno: nessuno la fatturerà, e
  // comparire fra i debiti la farebbe sembrare un conto in sospeso.
  it('«da pagare» non tiene dentro le bozze', () => {
    expect(ordineNelFiltro(bozza, null, 'da_pagare')).toBe(false)
    expect(ordineNelFiltro(richiesto, null, 'da_pagare')).toBe(true)
    expect(ordineNelFiltro(consegnato, fatture.c, 'da_pagare')).toBe(false)
  })

  it('il numero sul chip conta gli ordini di quella voce', () => {
    const conta = contaFiltri([bozza, richiesto, consegnato, chiuso], fatturaDi)
    expect(conta.tutti).toBe(4)
    expect(conta.bozza).toBe(1)
    expect(conta.pagato).toBe(1)
    expect(conta.chiuso).toBe(1)
    // Il consegnato ne conta due: quello chiuso è pur sempre consegnato.
    expect(conta.consegnato).toBe(2)
    // Ogni voce del filtro ha il suo numero, anche quando è zero: un chip
    // che sparisce fa dubitare di averlo visto.
    for (const f of FILTRI_ORDINE) expect(conta[f.id]).toBeGreaterThanOrEqual(0)
  })
})

describe('la storia dell’ordine', () => {
  it('un movimento porta sempre una data, anche senza rete', () => {
    const v = movimento('confermato')
    expect(v.tipo).toBe('confermato')
    expect(v.at).toBeTruthy()
  })

  it('un tipo che non esiste non si scrive', () => {
    expect(movimento('inventato')).toBeNull()
  })

  // Gli ordini scritti prima di questa voce non hanno storia, e non è un
  // errore: comincia da quando la si scrive.
  it('un ordine senza storia ne ha una vuota, e il primo movimento la apre', () => {
    expect(storiaDi({})).toEqual([])
    const storia = conMovimento({}, movimento('creato', { righe: 3 }))
    expect(storia).toHaveLength(1)
    expect(descriviMovimento(storia[0])).toBe('Ordine creato · 3 righe')
  })

  it('si legge in italiano, e dice cosa è cambiato', () => {
    expect(descriviMovimento(movimento('quantita', { nome: 'Campari', da: 6, a: 4 }))).toBe(
      'Campari: ricevuti 4 invece di 6'
    )
    expect(descriviMovimento(movimento('prezzo', { nome: 'Campari', da: 12, a: 13.5 }))).toBe(
      'Campari: prezzo da 12,00 € a 13,50 €'
    )
    expect(descriviMovimento(movimento('riga_tolta', { nome: 'Gin Mare' }))).toBe(
      'Tolto dall’ordine: Gin Mare'
    )
  })
})

// ── LA STORIA IN INGLESE (REQ-UI-039) ────────────────────────────────
//
// La storia si SCRIVE in italiano (è un dato, e si rilegge mesi dopo) e si
// traduce quando si mostra. Revisione del 17/11: la correzione del tipo di
// documento usciva «Type from Fattura to Nota di credito» — il campo
// tradotto, i valori no. I tipi sono parole della tabella dei tipi, non
// importi né nomi: si traducono con l'etichetta che passa chi mostra la
// storia (`etichettaTipoDocumento`). Un tipo scritto a mano resta com'è.
describe('la storia dell’ordine in inglese', () => {
  beforeEach(() => impostaLingua('en'))
  afterEach(() => impostaLingua('it'))
  const comeASchermo = (v) => descriviMovimento(v, { etichettaTipo: etichettaTipoDocumento })

  it('singolare e plurale delle righe', () => {
    expect(descriviMovimento(movimento('creato', { righe: 1 }))).toBe('Order created · 1 line')
    expect(descriviMovimento(movimento('creato', { righe: 3 }))).toBe('Order created · 3 lines')
    expect(descriviMovimento(movimento('consegnato', { righe: 1 }))).toBe('Goods received · 1 line booked in')
    expect(descriviMovimento(movimento('riga_tolta', { nome: 'Gin Mare' }))).toBe('Removed from the order: Gin Mare')
  })

  it('la correzione di un documento: il campo e il tipo tradotti, gli importi come scritti', () => {
    // Le voci come le scrive davvero `cambiFattura`, non a mano: se il nome
    // del campo «Tipo» cambiasse lì, questa prova se ne accorgerebbe.
    const cambi = cambiFattura(
      { doc_type: 'Fattura', amount: 120, supplier_id: 'nova' },
      { doc_type: 'Nota di credito', amount: 120, supplier_id: 'nova' }
    )
    const v = movimento('documento_corretto', { cambi: cambi.filter((c) => c.campo === 'Tipo') })
    expect(comeASchermo(v)).toBe('Document corrected · Type from Invoice to Credit note')
    // Senza l'etichetta (chi non la passa) i valori restano quelli scritti.
    expect(descriviMovimento(v)).toBe('Document corrected · Type from Fattura to Nota di credito')
  })

  it('un tipo che la tabella non conosce si legge com’è, e così il vuoto', () => {
    const v = movimento('documento_corretto', {
      pagato: true,
      cambi: [
        { campo: 'Tipo', da: '—', a: 'Ricevuta fiscale' },
        { campo: 'Numero', da: '12', a: '13' },
      ],
    })
    expect(comeASchermo(v)).toBe('Document corrected (already paid) · Type from — to Ricevuta fiscale · Number from 12 to 13')
  })

  it('in italiano la frase resta quella di sempre', () => {
    impostaLingua('it')
    const v = movimento('documento_corretto', { cambi: [{ campo: 'Tipo', da: 'Fattura', a: 'Nota di credito' }] })
    expect(comeASchermo(v)).toBe('Documento corretto · Tipo da Fattura a Nota di credito')
  })
})
