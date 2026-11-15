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

// 15/11/2026: tre avvisi di Dependabot sul package-lock della radice. Due su
// `@grpc/grpc-js` < 1.13.6 (uno alto), arrivato col Firestore del browser,
// che resta fermo a ~1.9 anche nella 12 e nella 13 di `firebase`; uno su
// `uuid` < 11.1.1, sotto `firebase-admin` 13 degli script. Non si passa la
// radice a `firebase-admin` 14 come le Functions: toglie `admin.firestore()`,
// che seed.js e gli script mock-* usano ancora. Si forzano le due versioni
// con gli `overrides` di package.json, e questo controllo le tiene ferme se
// un aggiornamento le riporta indietro.
describe('le dipendenze della radice', () => {
  const radice = JSON.parse(readFileSync('package-lock.json', 'utf8'))
  const versioni = (nome) =>
    Object.entries(radice.packages)
      .filter(([k]) => k.endsWith(`node_modules/${nome}`))
      .map(([, v]) => v.version)
  const almeno = (versione, minima) => {
    const [a, b] = [versione, minima].map((v) => v.split('-')[0].split('.').map(Number))
    for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i]
    return true
  }

  it.each([
    ['@grpc/grpc-js', '1.13.6'],
    ['uuid', '11.1.1'],
  ])('%s è almeno alla %s, la prima senza l’avviso', (nome, minima) => {
    const trovate = versioni(nome)
    expect(trovate.length, `${nome} nel file dei pacchetti`).toBeGreaterThan(0)
    expect(trovate.filter((v) => !almeno(v, minima))).toEqual([])
  })
})
