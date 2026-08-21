'use strict'

// ── LE PAROLE DI UN AVVISO STANNO IN UN POSTO SOLO (BUG-073) ─────────
//
// «Vedi che tra l'altro le notifiche sono diverse» (l'utente, 21/08/2026).
// Lo stesso ordine #5 gli è arrivato come «🆕 Nuovo ordine — Ordine #5
// ricevuto.» e come «Ordine ricevuto — Ordine #5»: due nomi per un fatto
// solo. Che ne partissero due era un difetto suo (BUG-072); che dicessero
// due cose diverse è questo, e resta anche togliendone uno.
//
// L'annuncio di un ordine nuovo lo scrivono TRE posti, e nessuno dei tre
// può importare gli altri: la coda nel browser, la push del server
// (functions/, un altro pacchetto) e il service worker che la disegna
// (public/sw.js, che non passa dal bundle). Le tre copie si allineano a
// mano, e questo test è la prova che non hanno preso strade diverse.
//
// PERCHÉ IL TITOLO DEVE ESSERE IDENTICO, e non «simile»: la notifica
// dell'app e quella del server portano lo stesso `tag`, e il sistema le
// fonde in una. Due titoli diversi sotto lo stesso tag sono una notifica
// che cambia parole sotto gli occhi di chi la legge.
//
// I CORPI no: la push del server sa il tavolo e il nome del cliente e li
// dice, l'app annuncia un conto che ha già a schermo. Sono due contesti,
// non due vocabolari.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  AVVISO_NUOVO_ORDINE,
  AVVISO_RIPRISTINO,
  STATUS_LABELS,
  statoAlBanco,
  ORDER_STATUSES,
} from '../../src/lib/orderStatus.js'
import { decideNewOrderStaffPush } from '../../functions/lib/push-core.js'

const radice = (p) => fileURLToPath(new URL(`../../${p}`, import.meta.url))

describe('«nuovo ordine» si dice allo stesso modo dovunque parta', () => {
  it('la push del server usa lo stesso titolo della coda', () => {
    const msg = decideNewOrderStaffPush(null, {
      daily_number: 5,
      payment_required: false,
      comande: [{ id: 'c1', status: ORDER_STATUSES.RICEVUTO, items: [{ qty: 1 }] }],
    })
    expect(msg.title).toBe(AVVISO_NUOVO_ORDINE.titolo)
  })

  it('e il service worker, che è l’unico a disegnarla ad app chiusa', () => {
    // Il titolo vero arriva nel payload; questo è il ripiego di quando
    // manca, ed è il ripiego che si legge sul tablet quando qualcosa nel
    // messaggio si perde per strada.
    const sw = readFileSync(radice('public/sw.js'), 'utf8')
    expect(sw).toContain(`payload.data.title || '${AVVISO_NUOVO_ORDINE.titolo}'`)
  })

  it('il corpo nomina il numero del conto, che è quello che si cerca', () => {
    expect(AVVISO_NUOVO_ORDINE.corpo(5)).toBe('Ordine #5 ricevuto.')
    // Un conto senza numero non deve produrre «Ordine #undefined».
    expect(AVVISO_NUOVO_ORDINE.corpo(null)).toBe('Ordine #— ricevuto.')
  })
})

describe('un conto ripristinato ha parole sue', () => {
  it('non sono quelle di un ordine nuovo', () => {
    // È il difetto che il banco ha letto: un conto che il locale aveva già
    // visto, annunciato come appena arrivato.
    expect(AVVISO_RIPRISTINO.titolo).not.toBe(AVVISO_NUOVO_ORDINE.titolo)
  })

  it('e nemmeno quelle di un passo del servizio', () => {
    // «Da fare» è il nome della colonna dove il conto atterra: dice dov'è
    // finito, non cosa è successo. E «Ordine ricevuto» è la parola che si
    // dice al CLIENTE, non al banco — arrivava lì da `STATUS_LABELS`.
    expect(AVVISO_RIPRISTINO.titolo).not.toContain(
      statoAlBanco(ORDER_STATUSES.RICEVUTO)
    )
    expect(AVVISO_RIPRISTINO.titolo).not.toContain(
      STATUS_LABELS[ORDER_STATUSES.RICEVUTO]
    )
    expect(AVVISO_RIPRISTINO.titolo).toContain('ripristinato')
  })
})
