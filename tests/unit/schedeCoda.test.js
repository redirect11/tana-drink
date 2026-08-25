'use strict'

// LE SCHEDE DELLA CODA, SMISTATE UNA VOLTA SOLA.
//
// Le tre schede — in corso, chiusi, annullati — sono una DIVISIONE della
// stessa lista: ogni conto sta in una e una sola. Chiederle una per una vuol
// dire ripassare la lista da capo ogni volta, e la coda lo faceva sei volte
// per disegno: tre per i conteggi delle linguette, due identiche a due righe
// di distanza, una per le corsie. Con 120 conti sono sei giri di tre filtri
// su una lista lunga, a ogni tasto premuto nella ricerca.
//
// `contiPerScheda` passa una volta e smista. La cosa da provare non e' che
// sia piu' veloce — quello si vede — ma che dia ESATTAMENTE quello che
// davano le sei chiamate: una divisione che sbaglia scheda a un conto e'
// un conto che sparisce dagli occhi di chi incassa.

import { describe, it, expect } from 'vitest'
import { contiPerScheda, ordiniInCoda, schedeCoda, SCHEDE_VUOTE } from '../../src/lib/coda.js'
import { contoChiuso } from '../../src/lib/comande.js'

const isChiuso = (o) => contoChiuso(o, { workflowOn: false })

const conto = (patch) => ({
  payment_status: 'non_richiesto',
  total: 10,
  comande: [{ id: 'c1', status: patch.workflow_status ?? 'ricevuto' }],
  ...patch,
})

const coda = [
  conto({ id: 'a', workflow_status: 'ricevuto', daily_number: 1 }),
  conto({ id: 'b', workflow_status: 'in_preparazione', daily_number: 2 }),
  conto({ id: 'c', workflow_status: 'pronto', daily_number: 3 }),
  conto({ id: 'd', workflow_status: 'ritirato', daily_number: 4 }),
  conto({ id: 'e', workflow_status: 'annullato', daily_number: 5 }),
  conto({ id: 'f', workflow_status: 'ritirato', payment_status: 'pagato', daily_number: 6 }),
  // chiuso ma NON servito: conta per il sottofiltro dei chiusi
  conto({
    id: 'g',
    workflow_status: 'pronto',
    payment_status: 'pagato',
    daily_number: 7,
    comande: [{ id: 'c1', status: 'pronto' }],
  }),
]

const ids = (l) => l.map((o) => o.id)

describe('le tre schede in una passata sola', () => {
  it('danno esattamente quello che davano le chiamate una per una', () => {
    const per = contiPerScheda(coda, { isChiuso })
    for (const [scheda] of schedeCoda(false)) {
      expect(ids(per[scheda])).toEqual(ids(ordiniInCoda(coda, { filtro: scheda, isChiuso })))
    }
    expect(ids(per.tutti)).toEqual(ids(ordiniInCoda(coda, { filtro: 'tutti', isChiuso })))
  })

  it('ogni conto sta in una scheda e una sola', () => {
    // Se una divisione perde un conto, quel conto sparisce dagli occhi di
    // chi incassa: non c'è vista in cui riappaia.
    const per = contiPerScheda(coda, { isChiuso })
    const smistati = [...per.attivi, ...per.chiusi, ...per.annullati].map((o) => o.id)
    expect(smistati.slice().sort()).toEqual(ids(per.tutti).slice().sort())
    expect(new Set(smistati).size).toBe(smistati.length)
  })

  it('l’ordine dentro ogni scheda è quello della lista di partenza', () => {
    // La coda si guarda a colpo d’occhio, per posizione: rimescolarla è
    // come spostare i bicchieri sul bancone mentre uno li conta.
    const per = contiPerScheda(coda, { isChiuso })
    expect(ids(per.attivi)).toEqual(ids(per.tutti.filter((o) => per.attivi.includes(o))))
  })

  it('il sottofiltro dei chiusi vale solo dentro i chiusi', () => {
    const soloServiti = contiPerScheda(coda, { isChiuso, sottoChiusi: 'serviti' })
    const daServire = contiPerScheda(coda, { isChiuso, sottoChiusi: 'non-serviti' })
    // 'g' è pagato ma il drink è ancora al banco: sta fra quelli da servire.
    expect(ids(daServire.chiusi)).toContain('g')
    expect(ids(soloServiti.chiusi)).not.toContain('g')
    // e le altre due schede non si accorgono di niente
    expect(ids(soloServiti.attivi)).toEqual(ids(daServire.attivi))
    expect(ids(soloServiti.annullati)).toEqual(ids(daServire.annullati))
  })

  it('lista vuota: le schede ci sono lo stesso, vuote', () => {
    const per = contiPerScheda([], { isChiuso })
    expect(per).toEqual(SCHEDE_VUOTE)
  })

  it('le schede vuote hanno le stesse chiavi di quelle piene', () => {
    // La vista che non è in pagina non paga la passata, ma chi la legge non
    // deve accorgersene: `SCHEDE_VUOTE` sta al posto suo.
    expect(Object.keys(SCHEDE_VUOTE).sort()).toEqual(
      Object.keys(contiPerScheda(coda, { isChiuso })).sort()
    )
  })
})
