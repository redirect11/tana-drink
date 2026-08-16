'use strict'

// BDD — notifiche push ordini (functions/lib/push-core.js → decideOrderPush)
// Feature: decidere se e cosa notificare quando un ordine cambia stato.

import { describe, it, expect } from 'vitest'
import {
  decideOrderPush,
  decideNewOrderStaffPush,
  destinatariPush,
  comandeDaFare,
  CANCEL_PHRASES,
} from '../../functions/lib/push-core.js'

const base = {
  daily_number: 7,
  push_token: 'tok-1',
  status: 'ricevuto',
}

describe('decideOrderPush', () => {
  it('non notifica senza token push', () => {
    expect(
      decideOrderPush({ ...base, push_token: null }, { ...base, push_token: null, status: 'pronto' })
    ).toBeNull()
  })

  it('non notifica se lo stato non è cambiato', () => {
    expect(decideOrderPush({ ...base, status: 'pronto' }, { ...base, status: 'pronto' })).toBeNull()
  })

  it('notifica quando il drink è pronto (ritiro al banco)', () => {
    const msg = decideOrderPush(base, { ...base, status: 'pronto', service_mode: 'banco' })
    expect(msg.title).toContain('pronto')
    expect(msg.body).toContain('#7')
    expect(msg.body).toContain('ritiro')
  })

  it('al TAVOLO non si notifica: al drink ci pensa il servizio', () => {
    // Avvisare chi è seduto che il drink è pronto non gli fa fare nulla:
    // glielo portano. La notifica serve solo se deve venire a ritirarlo.
    expect(decideOrderPush(base, { ...base, status: 'pronto', service_mode: 'tavolo' })).toBeNull()
  })

  it('senza modalità di consegna definita non si notifica il pronto', () => {
    expect(decideOrderPush(base, { ...base, status: 'pronto', service_mode: null })).toBeNull()
  })

  it('non notifica il passaggio a in_preparazione o ritirato', () => {
    expect(decideOrderPush(base, { ...base, status: 'in_preparazione' })).toBeNull()
    expect(
      decideOrderPush({ ...base, status: 'pronto' }, { ...base, status: 'ritirato' })
    ).toBeNull()
  })

  it('notifica annullamento bartender con notify, con frase e motivazione', () => {
    const after = {
      ...base,
      status: 'annullato',
      cancelled_by: 'bartender',
      cancel_notify: true,
      cancel_phrase: 'staff',
      cancel_message: 'Finito il gin',
    }
    const msg = decideOrderPush(base, after)
    expect(msg.title).toContain('Problema')
    expect(msg.body).toContain(CANCEL_PHRASES.staff)
    expect(msg.body).toContain('Finito il gin')
  })

  it('frase di fallback se cancel_phrase sconosciuta', () => {
    const after = {
      ...base,
      status: 'annullato',
      cancelled_by: 'bartender',
      cancel_notify: true,
      cancel_phrase: 'boh',
    }
    expect(decideOrderPush(base, after).body).toContain(CANCEL_PHRASES.bancone)
  })

  it('non notifica annullamento del cliente o senza spunta notifica', () => {
    expect(
      decideOrderPush(base, { ...base, status: 'annullato', cancelled_by: 'cliente', cancel_notify: true })
    ).toBeNull()
    expect(
      decideOrderPush(base, { ...base, status: 'annullato', cancelled_by: 'bartender', cancel_notify: false })
    ).toBeNull()
  })
})

describe('decideNewOrderStaffPush', () => {
  const ricevuto = { daily_number: 12, status: 'ricevuto' }

  // IL CASO CHE HA MORSO AL BANCO. Flavio prende ordini ai tavoli col
  // telefono, con un account da admin; Pelè sta al banco sull'iPad, altro
  // account da admin. Sull'iPad non squillava niente: qui si buttava via
  // l'avviso di OGNI ordine battuto da un admin o da un bartender, dando
  // per scontato che chi ha quel ruolo stia al banco e sappia già tutto.
  it('un ordine battuto da un gestore avvisa lo stesso: al banco deve arrivare', () => {
    const msg = decideNewOrderStaffPush(null, {
      ...ricevuto,
      placed_by: { email: 'flavio@tana.local', role: 'admin', device: 'telefono-di-flavio' },
    })
    expect(msg.title).toContain('Nuovo ordine')
  })

  // L'ALTRO PEZZO DELLO STESSO CASO. Un ordine battuto al POS nasce già
  // «in preparazione» — chi lo batte sta già facendo il drink — mentre
  // quelli dal menù nascono «ricevuto». Contando solo i «ricevuto», un
  // ordine preso al POS da un altro terminale non risultava mai nuovo in
  // coda: danieleadmin batteva dal telefono e sul tablet di capobar non
  // squillava niente.
  it('un ordine battuto al POS (nasce in preparazione) avvisa il banco', () => {
    const msg = decideNewOrderStaffPush(null, {
      daily_number: 5,
      comande: [{ id: 'c1', status: 'in_preparazione' }],
      placed_by: { role: 'admin', device: 'telefono-di-daniele' },
    })
    expect(msg.title).toContain('Nuovo ordine')
  })

  // IL GIRO DEL CLIENTE, con gli stati della preparazione accesi: l'ordine
  // arriva («ricevuto»), e più tardi qualcuno al banco lo prende in mano
  // («in preparazione»). Sono due momenti diversi: il primo è un ordine
  // nuovo da annunciare, il secondo no — quella comanda il banco la
  // conosce già, ed è il banco stesso ad averla presa in mano.
  it('avanzare una comanda non ri-avvisa: e’ la stessa di prima', () => {
    const prima = { daily_number: 5, comande: [{ id: 'c1', status: 'ricevuto' }] }
    const dopo = { daily_number: 5, comande: [{ id: 'c1', status: 'in_preparazione' }] }
    expect(decideNewOrderStaffPush(prima, dopo)).toBeNull()
  })

  it('l’ordine del cliente avvisa quando arriva, non quando lo si prende in mano', () => {
    const arrivo = decideNewOrderStaffPush(null, {
      daily_number: 9,
      comande: [{ id: 'c1', status: 'ricevuto' }],
    })
    expect(arrivo.title).toContain('Nuovo ordine')
  })

  it('due comande, una avanza e una arriva: avvisa solo quella arrivata', () => {
    const prima = { daily_number: 5, comande: [{ id: 'c1', status: 'ricevuto' }] }
    const dopo = {
      daily_number: 5,
      comande: [
        { id: 'c1', status: 'in_preparazione' },
        { id: 'c2', status: 'ricevuto' },
      ],
    }
    expect(decideNewOrderStaffPush(prima, dopo).title).toContain('Aggiunta')
  })

  it('una comanda in più sullo stesso conto avvisa come aggiunta', () => {
    const prima = { daily_number: 5, comande: [{ id: 'c1', status: 'in_preparazione' }] }
    const dopo = {
      daily_number: 5,
      comande: [
        { id: 'c1', status: 'in_preparazione' },
        { id: 'c2', status: 'ricevuto' },
      ],
    }
    expect(decideNewOrderStaffPush(prima, dopo).title).toContain('Aggiunta')
  })

  it('notifica un ordine appena creato in stato ricevuto', () => {
    const msg = decideNewOrderStaffPush(null, ricevuto)
    expect(msg.title).toContain('Nuovo ordine')
    expect(msg.body).toContain('#12')
  })

  it('include tavolo e nome cliente quando presenti', () => {
    const msg = decideNewOrderStaffPush(null, {
      ...ricevuto,
      table_label: '5',
      customer_name: 'Anna',
    })
    expect(msg.body).toContain('Tavolo 5')
    expect(msg.body).toContain('Anna')
  })

  it('NON notifica un ordine con pagamento obbligatorio non ancora saldato', () => {
    expect(
      decideNewOrderStaffPush(null, { ...ricevuto, payment_required: true, payment_status: 'in_attesa' })
    ).toBeNull()
  })

  it('notifica quando un ordine obbligatorio passa da non pagato a pagato', () => {
    const before = { ...ricevuto, payment_required: true, payment_status: 'in_attesa' }
    const after = { ...ricevuto, payment_required: true, payment_status: 'pagato' }
    expect(decideNewOrderStaffPush(before, after)).not.toBeNull()
  })

  it('non notifica due volte: era già in coda (ricevuto→pronto non ri-notifica)', () => {
    expect(decideNewOrderStaffPush(ricevuto, { ...ricevuto, status: 'pronto' })).toBeNull()
    // già ricevuto e pagato prima → nessuna nuova notifica
    expect(decideNewOrderStaffPush(ricevuto, ricevuto)).toBeNull()
  })

  // «In preparazione» ORA avvisa: è così che nascono gli ordini battuti al
  // POS, e da un altro terminale sono lavoro nuovo che arriva. Quello che
  // non avvisa è ciò che da fare non ha più niente.
  it('non avvisa quello che non è più da fare', () => {
    expect(decideNewOrderStaffPush(null, { ...ricevuto, status: 'pronto' })).toBeNull()
    expect(decideNewOrderStaffPush(null, { ...ricevuto, status: 'ritirato' })).toBeNull()
    expect(decideNewOrderStaffPush(null, { ...ricevuto, status: 'annullato' })).toBeNull()
  })
})

// ── A CHI ARRIVA L'AVVISO ────────────────────────────────────────────
// Non si tace per ruolo, si tace per TERMINALE: l'unico che non viene
// avvisato è il dispositivo da cui l'ordine è partito, che sa già di
// averlo mandato. Lo stesso account sta su tablet, telefono e portatile
// insieme.
describe('destinatariPush', () => {
  const dispositivi = [
    { token: 't-ipad', role: 'bartender', device: 'ipad-del-banco' },
    { token: 't-telefono', role: 'bartender', device: 'telefono-di-flavio' },
    { token: 't-sala', role: 'staff', device: 'telefono-di-sala' },
  ]

  it('l’iPad al banco viene avvisato dell’ordine battuto dal telefono', () => {
    const chi = destinatariPush(dispositivi, { dispositivoOrigine: 'telefono-di-flavio' })
    expect(chi.map((t) => t.token)).toEqual(['t-ipad', 't-sala'])
  })

  it('chi l’ha mandato non se lo sente dire', () => {
    const chi = destinatariPush(dispositivi, { dispositivoOrigine: 'telefono-di-flavio' })
    expect(chi.some((t) => t.device === 'telefono-di-flavio')).toBe(false)
  })

  it('i drink da servire restano roba di sala', () => {
    const chi = destinatariPush(dispositivi, { roles: ['staff'] })
    expect(chi.map((t) => t.token)).toEqual(['t-sala'])
  })

  it('chi si è registrato prima che il dispositivo si segnasse viene avvisato lo stesso', () => {
    // Un avviso in più si chiude, uno in meno è un drink che non parte.
    const vecchi = [{ token: 't-vecchio', role: 'bartender' }]
    expect(destinatariPush(vecchi, { dispositivoOrigine: 'telefono-di-flavio' })).toHaveLength(1)
  })

  it('lo stesso telefono non riceve due volte', () => {
    // Puo' comparire due volte: la riga vecchia intestata alla persona e
    // quella nuova intestata al dispositivo. Due righe con lo stesso token
    // sono due avvisi identici sullo stesso schermo.
    const doppio = [
      { token: 't-ipad', role: 'bartender', device: 'ipad-del-banco' },
      { token: 't-ipad', role: 'bartender' },
    ]
    expect(destinatariPush(doppio, {})).toHaveLength(1)
  })

  it('due terminali con lo stesso account vengono avvisati tutti e due', () => {
    // E' il caso del banco: stesso account sul tablet e sul portatile.
    const stessoAccount = [
      { token: 't-tablet', role: 'bartender', device: 'tablet' },
      { token: 't-portatile', role: 'bartender', device: 'portatile' },
    ]
    expect(destinatariPush(stessoAccount, { dispositivoOrigine: 'telefono' })).toHaveLength(2)
  })

  it('i token spariti non contano', () => {
    expect(destinatariPush([{ role: 'bartender' }, null], {})).toEqual([])
  })
})

describe('comandeDaFare', () => {
  it('conta quelle da fare, comunque siano nate', () => {
    expect(comandeDaFare({ comande: [{ status: 'ricevuto' }, { status: 'in_preparazione' }] })).toBe(2)
  })

  it('non conta quelle finite o annullate', () => {
    expect(
      comandeDaFare({ comande: [{ status: 'pronto' }, { status: 'ritirato' }, { status: 'annullato' }] })
    ).toBe(0)
  })

  it('i conti vecchi, senza comande, valgono per il loro stato', () => {
    expect(comandeDaFare({ status: 'ricevuto' })).toBe(1)
    expect(comandeDaFare({ status: 'pagato' })).toBe(0)
  })
})
