'use strict'

// ── LE DIPENDENZE DELLE FUNCTIONS (REQ-DEV-024) ─────────────────────────
//
// 13/11/2026: Dependabot propone `firebase-admin` 14 per chiudere un avviso
// di sicurezza su `uuid`, con una pull request dritta su `main`. Daniele:
// lo si fa nella release, si prova, si rilascia. Due cose qui lo tengono
// fermo:
//   · il Node delle Functions deve bastare a `firebase-admin`: la 14 vuole
//     Node 22, e con un runtime più vecchio il deploy delle Functions cade
//     (la 14 si porta dietro `jose`, che c'è solo come modulo ES);
//   · `uuid`, quello dell'avviso, non deve tornare fra le dipendenze delle
//     Functions.
// Si legge il file dei pacchetti, non node_modules: in CI i test girano
// senza le dipendenze delle Functions installate.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const pacchetto = JSON.parse(readFileSync('functions/package.json', 'utf8'))
const blocco = JSON.parse(readFileSync('functions/package-lock.json', 'utf8'))
const majorMinimo = (intervallo) => Number(String(intervallo).match(/\d+/)?.[0] ?? 0)

describe('le dipendenze delle Functions', () => {
  it('il Node delle Functions basta a firebase-admin', () => {
    const admin = blocco.packages['node_modules/firebase-admin']
    expect(admin, 'firebase-admin nel file dei pacchetti').toBeTruthy()
    expect(Number(pacchetto.engines.node)).toBeGreaterThanOrEqual(majorMinimo(admin.engines?.node))
  })

  it('uuid, quello dell’avviso di sicurezza, non c’è', () => {
    expect(Object.keys(blocco.packages).filter((k) => k.endsWith('/uuid'))).toEqual([])
  })
})
