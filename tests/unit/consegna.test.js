'use strict'

// SERVIZIO O RITIRO.
//
// Un conto è servito al tavolo o ritirato al banco. Chi decide, in ordine:
// il LOCALE dice come NASCONO i conti (non quali modi esistono), il CLIENTE
// sceglie il suo se glielo si lascia scegliere, lo STAFF può sempre
// cambiare quello che ha in mano. Prima l'impostazione del locale era un
// VINCOLO: `service_mode` finiva sull'ordine alla creazione e non c'era
// nessun posto in cui cambiarlo.

import { describe, it, expect } from 'vitest'
import {
  MODI_CONSEGNA,
  cambioModoPermesso,
  clienteSceglie,
  clienteScegliePossibile,
  modoAllaNascita,
  mondoConsegna,
  supplementiPerModo,
} from '../../src/lib/consegna.js'

describe('i due mondi', () => {
  it('o solo servizio, o ritiro e servizio insieme', () => {
    expect(mondoConsegna({ service_mode: 'tavolo' })).toBe('tavolo')
    expect(mondoConsegna({ service_mode: 'entrambi' })).toBe('entrambi')
  })

  it('NON ESISTE UN MONDO «SOLO RITIRO»', () => {
    // C'era — il valore 'banco' — ma non descriveva un locale: descriveva
    // un default. Un posto che fa solo asporto non ha bisogno che l'app gli
    // vieti il servizio, ha bisogno che i conti nascano «ritiro».
    expect(mondoConsegna({ service_mode: 'banco' })).toBe('entrambi')
    expect(modoAllaNascita({ service_mode: 'banco' })).toBe('banco')
  })

  it('i due modi sono sempre quei due, e si chiamano così', () => {
    expect(MODI_CONSEGNA.map(([k]) => k)).toEqual(['tavolo', 'banco'])
  })
})

describe('con che modo nasce un conto', () => {
  it('col solo servizio nasce servizio, e non c’è altro da dire', () => {
    expect(modoAllaNascita({ service_mode: 'tavolo' })).toBe('tavolo')
    // anche se qualcuno avesse lasciato scritto un default diverso
    expect(modoAllaNascita({ service_mode: 'tavolo', consegna_default: 'banco' })).toBe('tavolo')
  })

  it('coi due modi lo dice il valore di partenza del locale', () => {
    expect(modoAllaNascita({ service_mode: 'entrambi', consegna_default: 'banco' })).toBe('banco')
    expect(modoAllaNascita({ service_mode: 'entrambi', consegna_default: 'tavolo' })).toBe('tavolo')
    expect(modoAllaNascita({ service_mode: 'entrambi' })).toBe('tavolo')
  })
})

describe('lo sceglie il cliente', () => {
  const conOrdinazioni = { service_mode: 'entrambi', menu_only: false }

  it('solo dove i due modi convivono: col solo servizio non c’è niente da scegliere', () => {
    expect(clienteScegliePossibile({ service_mode: 'tavolo', menu_only: false })).toBe(false)
    expect(clienteScegliePossibile(conOrdinazioni)).toBe(true)
  })

  it('e solo se i clienti ordinano davvero', () => {
    // La voce parla di CHI sceglie: senza ordinazioni non c'è nessuno a cui
    // chiederlo, e resterebbe lì a mentire.
    expect(clienteScegliePossibile({ service_mode: 'entrambi', menu_only: true })).toBe(false)
    expect(
      clienteSceglie({ ...conOrdinazioni, menu_only: true, cliente_sceglie_consegna: true })
    ).toBe(false)
  })

  it('acceso e spento dal locale', () => {
    expect(clienteSceglie({ ...conOrdinazioni, cliente_sceglie_consegna: true })).toBe(true)
    expect(clienteSceglie({ ...conOrdinazioni, cliente_sceglie_consegna: false })).toBe(false)
  })

  it('il vecchio «entrambi» voleva dire esattamente questo, e si legge ancora', () => {
    expect(clienteSceglie({ service_mode: 'entrambi', menu_only: false })).toBe(true)
    expect(clienteSceglie({ service_mode: 'banco', menu_only: false })).toBe(false)
  })
})

// ── I SOLDI CHE CAMBIANO COL MODO ────────────────────────────────────
//
// Il ritiro al banco azzera coperto e costo di servizio: cambiare modo su
// un conto già battuto cambia il TOTALE, ed è la cosa da non sbagliare.
describe('coperto e servizio seguono il modo', () => {
  const settings = {
    coperto_enabled: true,
    coperto_amount: 2,
    service_charge_enabled: true,
    service_charge_percent: 10,
  }

  it('al tavolo si contano; al banco si azzerano', () => {
    const alTavolo = supplementiPerModo({ modo: 'tavolo', persone: 3, subtotale: 40, settings })
    expect(alTavolo).toEqual({
      coperto_persons: 3,
      coperto_amount: 6,
      // il servizio è una percentuale su drink + coperto
      service_charge_amount: 4.6,
    })
    expect(supplementiPerModo({ modo: 'banco', persone: 3, subtotale: 40, settings })).toEqual({
      coperto_persons: 0,
      coperto_amount: 0,
      service_charge_amount: 0,
    })
  })

  it('se il locale non li usa non compaiono, nemmeno al tavolo', () => {
    expect(supplementiPerModo({ modo: 'tavolo', persone: 3, subtotale: 40, settings: {} })).toEqual({
      coperto_persons: 0,
      coperto_amount: 0,
      service_charge_amount: 0,
    })
  })
})

describe('si può cambiare il modo di questo conto?', () => {
  it('conto aperto e nessun incasso: sì, e i supplementi si rifanno', () => {
    expect(cambioModoPermesso({ status: 'aperto', payments: [] })).toBe('si')
    expect(cambioModoPermesso({ status: 'aperto' })).toBe('si')
  })

  it('CON UN ACCONTO si cambia il modo ma non i soldi', () => {
    // «Ho pagato metà e poi me lo porto via» succede. Ma i supplementi
    // erano stati calcolati sul totale su cui si è già incassato, e
    // muovere quel totale sotto un acconto è come cambiare il prezzo dopo
    // aver preso i soldi: per quello c'è «Riapri conto», che lascia traccia.
    expect(cambioModoPermesso({ status: 'aperto', payments: [{ amount: 10 }] })).toBe('senza-soldi')
  })

  it('conto chiuso o annullato: non si tocca niente', () => {
    expect(cambioModoPermesso({ status: 'pagato' })).toBe('no')
    expect(cambioModoPermesso({ status: 'annullato' })).toBe('no')
    expect(cambioModoPermesso({ status: 'aperto', payment_status: 'pagato' })).toBe('no')
    expect(cambioModoPermesso(null)).toBe('no')
  })
})
