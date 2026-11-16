'use strict'

// BDD — la spesa delle Functions ha un tetto (REQ-DEV-026)
//
// Feature: fino al 16/11/2026 nessuna delle Functions aveva `maxInstances`,
// e Google ne accende fino a 100 per Function: un indirizzo pubblico
// bombardato apposta moltiplicava la spesa, pagata da Stonebit (Daniele,
// 15/11/2026: «non voglio trovarmi a pagare migliaia di euro»).
//
// Si legge functions/index.js come testo, perché caricarlo vuol dire
// caricare firebase-admin 14, che in locale vuole un Node più recente di
// quello che serve alla suite (REQ-DEV-024). Quello che si prova è il
// cablaggio: dove sta il tetto e chi ne ha uno più basso.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const INDICE = readFileSync(new URL('../../functions/index.js', import.meta.url), 'utf8')

// Le Functions esportate, ciascuna con le opzioni con cui nasce.
const functions = [...INDICE.matchAll(/exports\.(\w+)\s*=\s*on\w+\(\s*([^\n]*)/g)].map((m) => ({
  nome: m[1],
  opzioni: m[2],
}))
const opzioniDi = (nome) => functions.find((f) => f.nome === nome)?.opzioni ?? ''

// Le chiamabili che il cliente usa senza account: l'id del conto fa da
// lasciapassare, quindi chiunque può chiamarle.
const DEL_CLIENTE_SENZA_ACCOUNT = ['createPaymentCheckout', 'getPaymentStatus', 'createGroupCheckout', 'getGroupPaymentStatus']

describe('il tetto alle istanze', () => {
  it('vale per tutte, impostato una volta: 10', () => {
    expect(INDICE).toMatch(/const TETTO_ISTANZE = 10\b/)
    expect(INDICE).toMatch(/setGlobalOptions\(\{[^}]*maxInstances: TETTO_ISTANZE[^}]*\}\)/)
    // Il tetto globale va impostato PRIMA di dichiarare le Functions.
    expect(INDICE.indexOf('setGlobalOptions(')).toBeLessThan(INDICE.indexOf('exports.'))
  })

  it('nessuna Function se lo alza da sola', () => {
    // L'unico `maxInstances` oltre al globale è quello, più basso, delle
    // chiamabili del cliente.
    const tetti = [...INDICE.matchAll(/maxInstances:\s*([\w]+)/g)].map((m) => m[1])
    expect(tetti.sort()).toEqual(['3', 'TETTO_ISTANZE'])
  })

  it('le chiamabili del cliente senza account ne hanno 3', () => {
    expect(INDICE).toMatch(/const OPTS_PUBBLICO = \{ \.\.\.OPTS, maxInstances: 3 \}/)
    for (const nome of DEL_CLIENTE_SENZA_ACCOUNT) {
      expect(opzioniDi(nome), nome).toContain('...OPTS_PUBBLICO')
    }
  })

  it('il webhook dei pagamenti resta a 10, come i trigger', () => {
    // Finché non si sa se SumUp ritenta una notifica respinta, un tetto
    // basso può far perdere un pagamento confermato (regia, 16/11/2026). E
    // per un trigger un evento che trova le istanze piene può perdersi.
    expect(opzioniDi('paymentWebhook')).not.toContain('OPTS_PUBBLICO')
    for (const nome of ['notifyNewOrder', 'notifyOrderUpdate', 'risolviNumeroDuplicato', 'autoAdvancePaid']) {
      expect(opzioniDi(nome), nome).not.toContain('OPTS_PUBBLICO')
    }
  })

  it('le ho lette tutte: se ne nasce una nuova, eredita il tetto', () => {
    // Una conta, perché la lettura come testo non perda Functions per
    // strada senza che nessuno se ne accorga.
    expect(functions.length).toBeGreaterThanOrEqual(20)
    for (const f of DEL_CLIENTE_SENZA_ACCOUNT) expect(functions.map((x) => x.nome)).toContain(f)
  })
})
