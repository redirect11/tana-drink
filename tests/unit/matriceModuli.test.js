'use strict'

// ── LA MATRICE DEI MODULI (REQ-DEV-017) ──────────────────────────────────
//
// L'utente, 07/11/2026: «testare che i moduli premium presi singolarmente e
// in combinazione con altri funzionino e facciano quello per cui sono stati
// pensati». Fino a qui ogni modulo era provato da solo, nella schermata
// dove compare, con la licenza della Tana che li ha tutti: nessuno guardava
// cosa succede a un locale che ne ha tre. Il primo giro di questa prova ha
// trovato sei difetti (BUG-131…BUG-136) e tre moduli che da soli non
// servivano a niente (REQ-LIC-015).
//
// COME È FATTA. Qui sotto c'è la tabella delle PROMESSE di ogni modulo,
// scritta a mano e apposta separata da MODULI_PREMIUM: è la specifica, e
// il codice deve darle ragione. Per ogni licenza da provare (nessun
// modulo, tutti, ognuno da solo, e le righe a coppie: tests/helpers/
// combinazioni.js) si calcola quali moduli DEVONO lavorare e si controlla
// tutto quello che l'app ne fa discendere: le voci del gestionale, gli
// indirizzi battuti a mano, le sottosezioni, le pagine del cliente, i
// pagamenti, le scritture. Le stesse licenze passano sulle regole vere in
// tests/regole/matriceModuli.test.js.
//
// UN MODULO NUOVO entra nella tabella, o questa prova diventa rossa.

import { describe, it, expect } from 'vitest'
import {
  MODULI_PREMIUM,
  moduloAttivo,
  voceVisibile,
  menuDigitaleAttivo,
  ordinazioneClientiAttiva,
  accountClientiAttivi,
  sumupAttivo,
  scritturaConsentita,
  COLLEZIONI_DEI_MODULI,
} from '../../src/lib/licenza.js'
import { NAV_GESTIONALE, vociPerRuolo, sezioneConsentita } from '../../src/lib/sezioni.js'
import { paymentOptions } from '../../src/lib/payments.js'
import { licenzeDaProvare, righeACoppie, coppieDaCoprire, coppieDiRiga } from '../helpers/combinazioni.js'

// LE PROMESSE. Per ogni modulo:
//   richiede     — i moduli senza i quali non lavora (REQ-LIC-015);
//   gestionale   — le voci del menu del gestionale che accende (con una
//                  qualunque delle voci che hanno più padroni);
//   sottosezioni — le sottosezioni che accende dentro altre sezioni;
//   collezioni   — dove le regole lo vogliono per scrivere;
//   cliente      — la domanda che fanno le pagine del cliente.
const PROMESSE = {
  menu_tavoli: { gestionale: ['vista-cliente'], cliente: menuDigitaleAttivo },
  ordini_cliente: { richiede: ['menu_tavoli'], cliente: ordinazioneClientiAttiva },
  clienti: { collezioni: ['customers'], cliente: accountClientiAttivi },
  magazzino: {
    gestionale: ['inventario', 'fornitori'],
    sottosezioni: ['nuovo-ordine', 'lista-ordini', 'spese', 'listino'],
    collezioni: [
      'inventory_items',
      'inventory_categories',
      'suppliers',
      'supplier_prices',
      'supplier_price_history',
      'stock_movements',
      'purchase_orders',
      'purchase_order_templates',
      'altre_spese',
      'supplier_invoices',
    ],
  },
  statistiche: { gestionale: ['stats', 'bilancio'], collezioni: ['minimi_extra'] },
  staff: { gestionale: ['staff'], collezioni: ['staff_hours', 'staff_rates'] },
  sumup: { cliente: sumupAttivo },
  conta: { richiede: ['magazzino'], sottosezioni: ['conta', 'storico'], collezioni: ['stock_counts'] },
  fatture: { gestionale: ['fatture'], collezioni: ['invoices'] },
  scadenzario: { gestionale: ['fornitori'], sottosezioni: ['scadenzario'], collezioni: ['supplier_invoices', 'suppliers'] },
}

const IDS = Object.keys(PROMESSE)

// Quali moduli DEVONO lavorare con questi inclusi: inclusi, e con tutto
// quello che richiedono che lavora. Un punto fisso, calcolato qui e non con
// le funzioni dell'app, che sono quelle sotto esame.
function attesi(inclusi) {
  const lavora = Object.fromEntries(IDS.map((id) => [id, Boolean(inclusi[id])]))
  let cambiato = true
  while (cambiato) {
    cambiato = false
    for (const id of IDS) {
      if (lavora[id] && (PROMESSE[id].richiede || []).some((r) => !lavora[r])) {
        lavora[id] = false
        cambiato = true
      }
    }
  }
  return lavora
}

// I padroni di una voce secondo le promesse: chi la elenca.
const padroni = (campo, voce) => IDS.filter((id) => PROMESSE[id][campo]?.includes(voce))

const statoDi = (moduli) => ({ licenza: { stato: 'attiva', moduli } })

const LICENZE = licenzeDaProvare(IDS)

describe('la tabella delle promesse', () => {
  it('ha tutti i moduli dell’app, e solo quelli', () => {
    expect(IDS.sort()).toEqual(Object.keys(MODULI_PREMIUM).sort())
  })

  it('dice le stesse dipendenze di MODULI_PREMIUM', () => {
    for (const id of IDS) expect(MODULI_PREMIUM[id].richiede ?? [], id).toEqual(PROMESSE[id].richiede ?? [])
  })

  it('dice le stesse collezioni della tabella delle regole', () => {
    const dalleRegole = {}
    for (const [coll, moduli] of Object.entries(COLLEZIONI_DEI_MODULI)) dalleRegole[coll] = [...moduli].sort()
    const dallePromesse = {}
    for (const id of IDS) for (const coll of PROMESSE[id].collezioni || []) (dallePromesse[coll] ||= []).push(id)
    for (const coll of Object.keys(dallePromesse)) dallePromesse[coll].sort()
    expect(dallePromesse).toEqual(dalleRegole)
  })
})

describe('le licenze da provare', () => {
  it('ogni coppia di moduli compare in tutti e quattro i modi', () => {
    const daCoprire = coppieDaCoprire(IDS.length)
    for (const { moduli } of LICENZE) for (const c of coppieDiRiga(IDS.map((id) => moduli[id]))) daCoprire.delete(c)
    expect([...daCoprire]).toEqual([])
  })

  it('sono poche: nessuno, tutti, ognuno da solo e le righe a coppie', () => {
    expect(LICENZE.length).toBeLessThanOrEqual(2 + IDS.length + righeACoppie(IDS.length).length)
    expect(LICENZE.map((l) => l.nome)).toContain('nessun modulo')
    expect(LICENZE.map((l) => l.nome)).toContain('tutti i moduli')
  })
})

describe.each(LICENZE)('con la licenza «$nome»', ({ moduli }) => {
  const stato = statoDi(moduli)
  const lavora = attesi(moduli)

  it('lavorano i moduli inclusi che hanno la loro base', () => {
    for (const id of IDS) expect(moduloAttivo(stato, id), id).toBe(lavora[id])
  })

  it('il menu del gestionale ha le voci di base e quelle dei moduli che lavorano', () => {
    const voci = vociPerRuolo('admin', stato).map(([id]) => id)
    for (const [id] of NAV_GESTIONALE) {
      const chi = padroni('gestionale', id)
      const attesa = chi.length === 0 || chi.some((m) => lavora[m])
      expect(voci.includes(id), id).toBe(attesa)
      // E battuta a mano si apre se e solo se c'è nel menu.
      expect(sezioneConsentita(id, 'admin', stato), `?tab=${id}`).toBe(attesa)
    }
  })

  it('i vecchi indirizzi portano dove portavano', () => {
    // `?tab=storico` è la Cassa, di base (BUG-131); `?tab=ore` è lo Staff.
    expect(sezioneConsentita('storico', 'admin', stato)).toBe(true)
    expect(sezioneConsentita('ore', 'admin', stato)).toBe(lavora.staff)
  })

  it('le sottosezioni ci sono solo col loro modulo', () => {
    for (const id of IDS) {
      for (const voce of PROMESSE[id].sottosezioni || []) {
        const attesa = padroni('sottosezioni', voce).some((m) => lavora[m])
        expect(voceVisibile(stato, voce), voce).toBe(attesa)
      }
    }
  })

  it('le pagine del cliente e i pagamenti seguono il modulo', () => {
    for (const id of IDS) {
      if (PROMESSE[id].cliente) expect(PROMESSE[id].cliente(stato), id).toBe(lavora[id])
    }
    // Il pagamento online del cliente, anche col locale che l'ha acceso
    // (BUG-133).
    expect(paymentOptions({ ...stato, payments_online_enabled: true }).enabled).toBe(lavora.sumup)
  })

  // Le regole guardano l'INCLUSO, non l'interruttore d'uso: un modulo
  // incluso e spento tiene i suoi dati scrivibili (si riaccende senza
  // perdere niente).
  it('si scrive nelle collezioni dei moduli inclusi, e nelle altre sempre', () => {
    for (const coll of Object.keys(COLLEZIONI_DEI_MODULI)) {
      const attesa = IDS.some((id) => moduli[id] && PROMESSE[id].collezioni?.includes(coll))
      expect(scritturaConsentita(stato, coll), coll).toBe(attesa)
    }
    for (const coll of ['orders', 'drinks', 'categories', 'cash_sessions', 'staff_calls', 'staff_shifts']) {
      expect(scritturaConsentita(stato, coll), coll).toBe(true)
    }
  })
})

// L'ALTRA DOMANDA: incluso ma spento dalle impostazioni. Per ogni modulo,
// con tutti gli altri inclusi e accesi: lui non lavora, e con lui quelli
// che lo richiedono; le sue voci spariscono; i suoi dati restano scrivibili.
describe.each(IDS)('il modulo «%s» incluso ma spento', (id) => {
  const tutti = Object.fromEntries(IDS.map((m) => [m, true]))
  const stato = { ...statoDi(tutti), [MODULI_PREMIUM[id].chiave]: false }
  const spenti = new Set([id, ...IDS.filter((m) => attesi({ ...tutti, [id]: false })[m] === false)])

  it('non lavora, e nemmeno chi lo richiede', () => {
    for (const m of IDS) expect(moduloAttivo(stato, m), m).toBe(!spenti.has(m))
  })

  it('le sue voci spariscono, a meno che un altro modulo acceso non le tenga', () => {
    for (const campo of ['gestionale', 'sottosezioni']) {
      for (const voce of PROMESSE[id][campo] || []) {
        const attesa = padroni(campo, voce).some((m) => !spenti.has(m))
        expect(voceVisibile(stato, voce), voce).toBe(attesa)
      }
    }
  })

  it('i suoi dati restano scrivibili', () => {
    for (const coll of PROMESSE[id].collezioni || []) expect(scritturaConsentita(stato, coll), coll).toBe(true)
  })
})

// BUG-136: le descrizioni le legge chi decide se comprare. Non devono
// promettere quello che il locale ha già di base.
describe('le descrizioni dei moduli', () => {
  it('il Personale non promette le chiamate allo staff, che sono di base', () => {
    expect(MODULI_PREMIUM.staff.descrizione).not.toMatch(/chiamat/i)
  })

  it('il magazzino non si attribuisce più lo scadenzario, che è autonomo', () => {
    expect(MODULI_PREMIUM.magazzino.descrizione).not.toMatch(/scadenzario/i)
  })
})
