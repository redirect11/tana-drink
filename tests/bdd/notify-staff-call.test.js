'use strict'

// BDD — push cerca-persone (functions/lib/push-core.js → decideStaffCallPush)
// Feature: notificare il membro dello staff chiamato dal bancone.

import { describe, it, expect } from 'vitest'
import {
  decideStaffCallPush,
  decideStaffServePush,
  destinatariPush,
  STAFF_CALL_VIBRATION,
  terminaliDi,
} from '../../functions/lib/push-core.js'

const base = {
  to_uid: 'staff-1',
  to_email: 'giulia@bar.it',
  from_email: 'bartender@bar.it',
  from_name: null,
  message: null,
  status: 'pending',
}

describe('decideStaffCallPush', () => {
  it('non notifica senza chiamata o senza destinatario', () => {
    expect(decideStaffCallPush(null)).toBeNull()
    expect(decideStaffCallPush({ ...base, to_uid: null })).toBeNull()
  })

  it('non notifica chiamate già risposte', () => {
    expect(decideStaffCallPush({ ...base, status: 'acked' })).toBeNull()
  })

  it('notifica la chiamata con il nome del chiamante', () => {
    const msg = decideStaffCallPush({ ...base, from_name: 'Marzia' })
    expect(msg.title).toContain('Chiamata dal bancone')
    expect(msg.body).toContain('Marzia')
  })

  it('non espone mai l’email del chiamante', () => {
    expect(decideStaffCallPush(base).body).not.toContain('@')
    expect(
      decideStaffCallPush({ ...base, message: 'Vieni al bancone' }).body
    ).not.toContain('@')
  })

  it('include il messaggio del bartender quando presente', () => {
    const msg = decideStaffCallPush({ ...base, message: 'Vieni al bancone' })
    expect(msg.body).toContain('«Vieni al bancone»')
    const conNome = decideStaffCallPush({ ...base, from_name: 'Marzia', message: 'Vieni' })
    expect(conNome.body).toContain('Marzia: «Vieni»')
  })

  it('il pattern di vibrazione è forte e riconoscibile', () => {
    expect(STAFF_CALL_VIBRATION.length).toBeGreaterThanOrEqual(5)
    expect(Math.max(...STAFF_CALL_VIBRATION)).toBeGreaterThanOrEqual(500)
  })
})

const ordine = {
  daily_number: 12,
  status: 'in_preparazione',
  service_mode: 'tavolo',
  table_label: '5',
  customer_name: 'Mario',
}

describe('decideStaffServePush', () => {
  it('notifica lo staff quando un ordine al tavolo è pronto', () => {
    const msg = decideStaffServePush(ordine, { ...ordine, status: 'pronto' })
    expect(msg.title).toContain('da servire')
    expect(msg.body).toContain('#12')
    expect(msg.body).toContain('Tavolo 5')
    expect(msg.body).toContain('Mario')
  })

  // IL RITIRO SI ANNUNCIA COME IL SERVIZIO (BUG-036). Questa prova diceva
  // il contrario — «il ritiro lo gestisce il cliente» — e sulla carta
  // reggeva: al cliente la push arriva. Solo che gli arriva se ha ordinato
  // dal menù, perché è lì che nasce il `push_token` sull'ordine; un conto
  // battuto al POS non ce l'ha. Su quei conti non partiva niente per
  // nessuno: drink pronto sul banco e nessuno avvisato.
  it('anche il drink da ritirare al banco avvisa lo staff', () => {
    const msg = decideStaffServePush(
      { ...ordine, service_mode: 'banco' },
      { ...ordine, service_mode: 'banco', status: 'pronto' }
    )
    expect(msg.title).toContain('da consegnare')
    expect(msg.body).toContain('#12')
  })

  it('non notifica se lo stato non cambia o non è pronto', () => {
    expect(decideStaffServePush(ordine, ordine)).toBeNull()
    expect(decideStaffServePush(ordine, { ...ordine, status: 'ritirato' })).toBeNull()
    expect(
      decideStaffServePush({ ...ordine, status: 'pronto' }, { ...ordine, status: 'pronto' })
    ).toBeNull()
  })

  it('funziona anche senza tavolo e nome', () => {
    const spoglio = { daily_number: 3, status: 'in_preparazione', service_mode: 'tavolo' }
    const msg = decideStaffServePush(spoglio, { ...spoglio, status: 'pronto' })
    expect(msg.body).toBe('Ordine #3')
  })
})

// ── A CHI SUONA LA CHIAMATA ──────────────────────────────────────────
//
// La riga del token è del DISPOSITIVO (`staff_tokens/<device>`, col campo
// `uid` di chi ci sta collegato). La chiamata invece cercava il documento
// all'indirizzo `staff_tokens/<uid>`: non trovava niente, e il telefono di
// chi veniva cercato non vibrava mai.
describe('terminaliDi: i dispositivi di chi viene cercato', () => {
  const righe = [
    { id: 'tablet-banco', uid: 'capo', token: 'T-capo-tablet' },
    { id: 'telefono-giulia', uid: 'giulia', token: 'T-giulia-tel' },
    { id: 'tablet-sala', uid: 'giulia', token: 'T-giulia-tablet' },
    { id: 'senza-token', uid: 'giulia', token: null },
  ]

  it('trova TUTTI i terminali di quella persona', () => {
    // Due terminali accesi, e non si sa quale ha in mano: suonano entrambi.
    expect(terminaliDi(righe, 'giulia').map((r) => r.token)).toEqual([
      'T-giulia-tel',
      'T-giulia-tablet',
    ])
  })

  it('non suona sui terminali degli altri', () => {
    expect(terminaliDi(righe, 'capo').map((r) => r.token)).toEqual(['T-capo-tablet'])
    expect(terminaliDi(righe, 'nessuno')).toEqual([])
    expect(terminaliDi(righe, null)).toEqual([])
  })

  it('regge le righe vecchie, intestate alla persona', () => {
    // Prima dell'«un dispositivo, una riga» il documento aveva per id l'uid:
    // qualcuna è rimasta in giro e deve continuare a squillare.
    const vecchia = [{ id: 'giulia', uid: 'giulia', token: 'T-vecchio' }]
    expect(terminaliDi(vecchia, 'giulia').map((r) => r.token)).toEqual(['T-vecchio'])
  })

  it('lo stesso token non fa vibrare due volte', () => {
    const doppia = [
      { id: 'telefono', uid: 'giulia', token: 'T-uno' },
      { id: 'giulia', uid: 'giulia', token: 'T-uno' },
    ]
    expect(terminaliDi(doppia, 'giulia')).toHaveLength(1)
  })
})

// ── LA CATENA INTERA DEL «PRONTO» (BUG-036) ──────────────────────
//
// Le due metà provate una per una passavano tutte e due, e insieme non
// mandavano niente: il messaggio nasceva, e poi l’elenco dei destinatari
// si svuotava. Il locale ha lavorato così per giorni — drink pronti sul
// banco e nessun telefono che suona. Qui si prova il pezzo intero: nasce
// il messaggio E c’è qualcuno a cui mandarlo.
describe('un drink pronto: nasce il messaggio e c’è chi lo riceve', () => {
  // Come sta davvero un locale: tre terminali, e tutti si sono registrati
  // dalla coda, quindi tutti intestati 'bartender'. Nessuno 'staff'.
  const terminali = [
    { token: 't-ipad', role: 'bartender', device: 'ipad-del-banco' },
    { token: 't-flavio', role: 'bartender', device: 'telefono-di-flavio' },
    { token: 't-sala', role: 'bartender', device: 'telefono-di-sala' },
  ]
  const conto = {
    daily_number: 21,
    status: 'in_preparazione',
    service_mode: 'tavolo',
    table_label: '3',
  }

  it('al tavolo: il messaggio parte e arriva agli altri due terminali', () => {
    const msg = decideStaffServePush(conto, { ...conto, status: 'pronto' })
    expect(msg).not.toBeNull()
    const chi = destinatariPush(terminali, { dispositivoOrigine: 'ipad-del-banco' })
    expect(chi.map((t) => t.token)).toEqual(['t-flavio', 't-sala'])
  })

  it('al banco: anche il ritiro parte, e non resta senza destinatari', () => {
    const ritiro = { ...conto, service_mode: 'banco', table_label: null }
    const msg = decideStaffServePush(ritiro, { ...ritiro, status: 'pronto' })
    expect(msg.title).toContain('da consegnare')
    expect(msg.body).toBe('Ordine #21')
    expect(destinatariPush(terminali, { dispositivoOrigine: 'ipad-del-banco' })).toHaveLength(2)
  })

  it('chi ha premuto «pronto» non se lo sente squillare in mano', () => {
    const chi = destinatariPush(terminali, { dispositivoOrigine: 'telefono-di-flavio' })
    expect(chi.some((t) => t.device === 'telefono-di-flavio')).toBe(false)
  })

  it('senza sapere chi ha premuto, si avvisano tutti', () => {
    // Un terminale vecchio che non scrive il dispositivo: meglio un avviso
    // in più sul telefono di chi ha già premuto, che un drink che resta lì.
    expect(destinatariPush(terminali, { dispositivoOrigine: null })).toHaveLength(3)
  })
})
