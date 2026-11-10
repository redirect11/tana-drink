'use strict'

// ── LE FUNCTIONS GUARDANO LA LICENZA (BUG-134) ───────────────────────────
//
// Le Functions girano coi permessi dell'amministratore: le regole di
// Firestore non le fermano. Fino al 07/11/2026 nessuna leggeva la licenza,
// e i pagamenti SumUp partivano anche dove il modulo non c'è, chiamandoli a
// mano dalla console del browser. Trovato dalla matrice dei moduli
// (REQ-DEV-017).
//
// Si prova la domanda (moduloInLicenza, gemella di `modulo()` delle
// regole), i cinque punti dove un pagamento parte, e che quello che serve a
// chiudere un pagamento già partito resti possibile.

import { describe, it, expect, vi } from 'vitest'
import { createRequire } from 'node:module'
import {
  createCheckout,
  verifyCheckoutStatus,
  pairReader,
  unpairReader,
  readerCheckout,
  readerTerminate,
  createGroupCheckout,
  groupReaderCheckout,
} from '../../functions/lib/payment-service.js'
import { createFakeFirestore } from '../helpers/fakeFirestore.js'

// Col require nativo, come lo carica payment-service.js nelle Functions: due
// versioni dello stesso file, una passata da Vite e una no, rendono la
// coverage instabile da un giro all'altro (lo stesso guaio di payment-core,
// visto il 10/11/2026 su una PR bocciata senza motivo).
const require = createRequire(import.meta.url)
const { moduloInLicenza, richiediModulo } = require('../../functions/lib/licenza-core.js')

const ADESSO = Date.parse('2026-11-07T21:00:00.000Z')
const IERI = new Date('2026-11-06T21:00:00.000Z')
const DOMANI = new Date('2026-11-08T21:00:00.000Z')
const bartender = { token: { role: 'bartender' } }

describe('la domanda: il modulo è nella licenza, adesso?', () => {
  const con = (altro = {}) => ({ stato: 'attiva', moduli: { sumup: true }, ...altro })

  it('sì, se la licenza lo nomina ed è in regola', () => {
    expect(moduloInLicenza(con(), 'sumup', ADESSO)).toBe(true)
    expect(moduloInLicenza(con({ valida_fino_ts: DOMANI }), 'sumup', ADESSO)).toBe(true)
  })

  it('no senza licenza, o se la licenza non lo nomina', () => {
    expect(moduloInLicenza(null, 'sumup', ADESSO)).toBe(false)
    expect(moduloInLicenza({ stato: 'attiva', moduli: {} }, 'sumup', ADESSO)).toBe(false)
    expect(moduloInLicenza({ stato: 'attiva', moduli: { sumup: false } }, 'sumup', ADESSO)).toBe(false)
  })

  // Come le regole: sospesa, chiusa o non attivata non lavora.
  it('no con la licenza sospesa, chiusa o non attivata', () => {
    for (const stato of ['sospesa', 'chiusa', 'non_attivata']) {
      expect(moduloInLicenza(con({ stato }), 'sumup', ADESSO), stato).toBe(false)
    }
  })

  // Come le regole: scaduta non lavora, e scaduta verso il Free si lavora
  // ma senza moduli.
  it('no con la licenza scaduta, anche verso il Free', () => {
    expect(moduloInLicenza(con({ valida_fino_ts: IERI }), 'sumup', ADESSO)).toBe(false)
    expect(moduloInLicenza(con({ valida_fino_ts: IERI, alla_scadenza: 'free' }), 'sumup', ADESSO)).toBe(false)
  })

  it('la scadenza si legge anche come Timestamp di Firestore o come testo', () => {
    const timestamp = { toMillis: () => IERI.getTime() }
    expect(moduloInLicenza(con({ valida_fino_ts: timestamp }), 'sumup', ADESSO)).toBe(false)
    expect(moduloInLicenza(con({ valida_fino_ts: DOMANI.toISOString() }), 'sumup', ADESSO)).toBe(true)
  })

  it('il rifiuto è un errore che HttpsError capisce, con una frase per chi è al banco', async () => {
    const { db } = createFakeFirestore({})
    await expect(richiediModulo(db, 'sumup', ADESSO)).rejects.toMatchObject({
      code: 'failed-precondition',
      message: 'Questa funzione non è inclusa nell’installazione.',
    })
  })
})

// Un locale SENZA il modulo, con tutto il resto pronto: lettore associato,
// un ordine da pagare, un conto di gruppo. Nessuna chiamata a SumUp deve
// partire.
function senzaSumup() {
  const { db, store } = createFakeFirestore({
    licenza: { attuale: { stato: 'attiva', moduli: { sumup: false, magazzino: true } } },
    settings: { bar: { sumup_reader_id: 'rdr1' } },
    orders: { o1: { status: 'ricevuto', total: 12, payment_status: 'non_pagato', sumup_checkout_id: 'ck1' } },
    payments: { p1: { status: 'in_attesa', amount: 30, order_ids: ['o1'] } },
  })
  const paymentsFetch = vi.fn(async () => ({ status: 'PENDING', data: { client_transaction_id: 'tx1' } }))
  return {
    deps: {
      db,
      paymentsFetch,
      isConfigured: () => true,
      merchantCode: () => 'MC123',
      now: () => '2026-11-07T21:00:00.000Z',
      webhookUrl: () => 'https://fn/paymentWebhook',
    },
    store,
    paymentsFetch,
  }
}

describe('senza il modulo SumUp un pagamento non parte', () => {
  const casi = [
    ['il checkout online', (d) => createCheckout(d, { orderId: 'o1' })],
    ['l’associazione del lettore', (d) => pairReader(d, bartender, { pairing_code: 'ABC' })],
    ['l’incasso sul lettore', (d) => readerCheckout(d, bartender, { orderId: 'o1' })],
    ['il checkout di un gruppo', (d) => createGroupCheckout(d, { paymentId: 'p1' })],
    ['il lettore per un gruppo', (d) => groupReaderCheckout(d, bartender, { paymentId: 'p1' })],
  ]

  it.each(casi)('%s', async (_nome, chiama) => {
    const { deps, paymentsFetch } = senzaSumup()
    await expect(chiama(deps)).rejects.toMatchObject({ code: 'failed-precondition' })
    expect(paymentsFetch).not.toHaveBeenCalled()
  })
})

// Un pagamento avviato prima che il modulo andasse via deve potersi
// chiudere: si legge l'esito, si ferma il lettore, lo si dissocia.
describe('quello che chiude un pagamento già partito resta possibile', () => {
  it('leggere l’esito di un checkout', async () => {
    const { deps } = senzaSumup()
    await expect(verifyCheckoutStatus(deps, { orderId: 'o1' })).resolves.toBeDefined()
  })

  it('fermare il lettore e dissociarlo', async () => {
    const { deps, store } = senzaSumup()
    store.orders.o1.sumup_client_transaction_id = 'tx1'
    await expect(readerTerminate(deps, bartender, { orderId: 'o1' })).resolves.toBeDefined()
    await expect(unpairReader(deps, bartender)).resolves.toBeDefined()
  })
})
