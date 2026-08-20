'use strict'

// Push e pagamenti nel modello conto/comande (functions/lib).

import { describe, it, expect } from 'vitest'
import pushCore from '../../functions/lib/push-core.js'
import payCore from '../../functions/lib/payment-core.js'

const { decideOrderPush, decideStaffServePush, decideNewOrderStaffPush } = pushCore
const { decidePaymentPatch, decideAutoAdvance, isServed } = payCore

const ord = (comande, extra = {}) => ({
  daily_number: 7,
  push_token: 'tok',
  status: 'aperto',
  comande,
  ...extra,
})
const c = (id, status) => ({ id, seq: Number(id.slice(1)), status })

describe('decideOrderPush per comande', () => {
  it('push quando UNA comanda passa a pronto (anche la seconda), col ritiro', () => {
    // Il cliente si avvisa solo se deve venire a ritirare (banco).
    const before = ord([c('c1', 'ritirato'), c('c2', 'in_preparazione')], { service_mode: 'banco' })
    const after = ord([c('c1', 'ritirato'), c('c2', 'pronto')], { service_mode: 'banco' })
    expect(decideOrderPush(before, after)?.title).toContain('pronto')
  })
  it('nessun push se le pronte non aumentano', () => {
    const before = ord([c('c1', 'pronto')])
    const after = ord([c('c1', 'ritirato')])
    expect(decideOrderPush(before, after)).toBeNull()
  })
  it('legacy: status ordine → una comanda equivalente', () => {
    const before = { daily_number: 3, push_token: 't', status: 'in_preparazione', service_mode: 'banco' }
    const after = { daily_number: 3, push_token: 't', status: 'pronto', service_mode: 'banco' }
    expect(decideOrderPush(before, after)).not.toBeNull()
  })

  // ── IL CLIENTE SA CHE IL SUO DRINK È PRONTO (REQ-CLI-006) ───
  //
  // Su un conto da RITIRO, quando la comanda passa a «pronto» da lì in poi
  // la palla è del cliente: deve alzarsi e venire al banco. Le cose che qui
  // fanno la differenza, e che prima non erano provate:

  it('dice QUALI comande ha annunciato, per non annunciarle due volte', () => {
    const before = ord([c('c1', 'in_preparazione')], { service_mode: 'banco' })
    const after = ord([c('c1', 'pronto')], { service_mode: 'banco' })
    expect(decideOrderPush(before, after).comande).toEqual(['c1'])
  })

  it('UNA VOLTA SOLA: riportata indietro e rimessa pronta, niente secondo squillo', () => {
    // Al banco succede: si segna «pronto» la comanda sbagliata, la si
    // riporta indietro, la si rimette pronta un minuto dopo. Il cliente ha
    // già il drink in mano, e al secondo squillo smette di credere al primo.
    const avvisate = { service_mode: 'banco', pronto_avvisate: ['c1'] }
    const indietro = ord([c('c1', 'in_preparazione')], avvisate)
    const diNuovoPronta = ord([c('c1', 'pronto')], avvisate)
    expect(decideOrderPush(indietro, diNuovoPronta)).toBeNull()
    // Ma una comanda NUOVA sullo stesso conto si annuncia eccome: è un
    // altro drink, e sta fermo sul banco come il primo.
    const conAggiunta = ord([c('c1', 'pronto'), c('c2', 'pronto')], avvisate)
    expect(decideOrderPush(diNuovoPronta, conAggiunta).comande).toEqual(['c2'])
  })

  it('niente squilli per un conto che non è cambiato', () => {
    // Il documento si riscrive per mille motivi — una nota, il pagamento —
    // e una comanda già pronta da prima non deve suonare a ogni ritocco.
    const fermo = ord([c('c1', 'pronto')], { service_mode: 'banco' })
    expect(decideOrderPush(fermo, { ...fermo, note: 'poco ghiaccio' })).toBeNull()
  })

  it('col servizio al tavolo non parte niente: ci pensa chi porta il vassoio', () => {
    const before = ord([c('c1', 'in_preparazione')], { service_mode: 'tavolo' })
    const after = ord([c('c1', 'pronto')], { service_mode: 'tavolo' })
    expect(decideOrderPush(before, after)).toBeNull()
  })

  it('con gli stati del servizio spenti non c’è nessun «pronto» da annunciare', () => {
    // Senza quei passi la comanda va da «ricevuto» dritta a servita: non
    // è un caso scoperto, è che non c'è niente da dire — chi batte
    // l'ordine lo prepara e lo consegna sul momento. La pagina del QR
    // resta comunque aggiornata, ed è quella che il cliente guarda.
    const before = ord([c('c1', 'ricevuto')], { service_mode: 'banco' })
    const after = ord([c('c1', 'ritirato')], { service_mode: 'banco' })
    expect(decideOrderPush(before, after)).toBeNull()
  })

  it('senza permesso alle notifiche non c’è token, e non si manda niente', () => {
    // La pagina col QR resta la strada che funziona sempre.
    const before = ord([c('c1', 'in_preparazione')], { service_mode: 'banco', push_token: null })
    const after = ord([c('c1', 'pronto')], { service_mode: 'banco', push_token: null })
    expect(decideOrderPush(before, after)).toBeNull()
  })
})

describe('decideStaffServePush / decideNewOrderStaffPush', () => {
  it('staff avvisato per ogni comanda pronta al tavolo', () => {
    const before = ord([c('c1', 'ritirato'), c('c2', 'in_preparazione')], { service_mode: 'tavolo' })
    const after = ord([c('c1', 'ritirato'), c('c2', 'pronto')], { service_mode: 'tavolo' })
    expect(decideStaffServePush(before, after)).not.toBeNull()
  })
  it('nuova comanda su conto esistente → "aggiunta al conto"', () => {
    const before = ord([c('c1', 'ritirato')])
    const after = ord([c('c1', 'ritirato'), c('c2', 'ricevuto')])
    const msg = decideNewOrderStaffPush(before, after)
    expect(msg?.title).toContain('Aggiunta')
  })
  it('creazione: primo invio resta "nuovo ordine"', () => {
    const after = ord([c('c1', 'ricevuto')])
    expect(decideNewOrderStaffPush(null, after)?.title).toContain('Nuovo ordine')
  })
  // IL RUOLO NON DICE DOVE SEI. Queste due prove dicevano il contrario —
  // «battuto da un gestore, nessuna notifica» — perché si dava per scontato
  // che admin e bartender stessero al banco. Chi prende ordini ai tavoli col
  // telefono e un account da gestore non faceva squillare niente a nessuno:
  // al banco l'ordine arrivava in silenzio. Ora l'avviso parte sempre, e a
  // saltarlo è il solo terminale che l'ha mandato (destinatariPush).
  it('ordine inserito dal bartender: la notifica parte lo stesso', () => {
    const after = ord([c('c1', 'ricevuto')], { placed_by: { role: 'bartender' } })
    expect(decideNewOrderStaffPush(null, after)?.title).toContain('Nuovo ordine')
  })
  it("ordine inserito dall'admin: la notifica parte lo stesso", () => {
    const after = ord([c('c1', 'ricevuto')], { placed_by: { role: 'admin' } })
    expect(decideNewOrderStaffPush(null, after)?.title).toContain('Nuovo ordine')
  })
  it('ordine inserito dallo staff: notifica sì', () => {
    const after = ord([c('c1', 'ricevuto')], { placed_by: { role: 'staff' } })
    expect(decideNewOrderStaffPush(null, after)?.title).toContain('Nuovo ordine')
  })
})

describe('pagamenti: chiusura con tutte le comande servite', () => {
  it('isServed: tutte ritirate (annullate ignorate) / legacy ritirato', () => {
    expect(isServed(ord([c('c1', 'ritirato'), c('c2', 'annullato')]))).toBe(true)
    expect(isServed(ord([c('c1', 'ritirato'), c('c2', 'pronto')]))).toBe(false)
    expect(isServed({ status: 'ritirato' })).toBe(true)
  })
  it('decidePaymentPatch chiude solo se tutto servito', () => {
    const now = 't'
    const servito = ord([c('c1', 'ritirato')])
    const inCorso = ord([c('c1', 'pronto')])
    expect(decidePaymentPatch(servito, { status: 'pagato', now }).status).toBe('pagato')
    expect(decidePaymentPatch(inCorso, { status: 'pagato', now }).status).toBeUndefined()
  })
  it('decideAutoAdvance scatta quando ultimo servizio + pagato', () => {
    const before = ord([c('c1', 'pronto')], { payment_status: 'pagato' })
    const after = ord([c('c1', 'ritirato')], { payment_status: 'pagato' })
    expect(decideAutoAdvance(before, after)).toBe('pagato')
    expect(decideAutoAdvance(after, after)).toBeNull()
  })
})
