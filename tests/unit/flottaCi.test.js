'use strict'

// LA CI DEL RAMO feature/flotta NON TOCCA LA TANA (REQ-FLOTTA-001).
// L'utente, 21/10/2026: «ci serve un modo sicuro per testare senza
// spaccare niente per la Tana». La regola vive nel job «Dove va» di
// firebase-hosting.yml; questo test la legge, perché un workflow non ha
// altri test e un ritocco di buona volontà potrebbe rimandare un ramo
// feature sul test della Tana senza che nessuno se ne accorga prima del
// deploy.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const workflow = () => readFileSync(join(process.cwd(), '.github/workflows/firebase-hosting.yml'), 'utf8')
const deploy = () => readFileSync(join(process.cwd(), '.github/workflows/deploy.yml'), 'utf8')

describe('il job «Dove va»', () => {
  it('manda al test della Tana solo develop, release/ e hotfix/; tutto il resto è flotta', () => {
    const w = workflow()
    const scelta = w.slice(w.indexOf('- id: scelta'), w.indexOf('prova:'))
    expect(scelta).toMatch(/is-ancestor "\$GITHUB_SHA" origin\/main[\s\S]*ambiente=production/)
    expect(scelta).toMatch(/is-ancestor "\$GITHUB_SHA" origin\/develop[\s\S]*ambiente=test/)
    expect(scelta).toMatch(/\^\(release\|hotfix\)\/[\s\S]*ambiente=test/)
    // Il ramo che non sta da nessuna parte finisce in «flotta», non in test.
    expect(scelta).toMatch(/else\s+echo "ambiente=flotta"/)
    expect(scelta).not.toMatch(/else\s+echo "ambiente=test"/)
  })

  it('il test della Tana si pubblica solo con ambiente «test», la flotta solo su PROGETTO_FLOTTA', () => {
    const w = workflow()
    const prova = w.slice(w.indexOf('  prova:'), w.indexOf('  produzione:'))
    expect(prova).toMatch(/if: needs\.destinazione\.outputs\.ambiente == 'test'/)
    expect(prova).toMatch(/progetto: tana-drink-test/)
    const flotta = w.slice(w.indexOf('  flotta:'), w.indexOf('  flotta-senza-progetto:'))
    expect(flotta).toMatch(/if: needs\.destinazione\.outputs\.ambiente == 'flotta' && vars\.PROGETTO_FLOTTA != ''/)
    expect(flotta).toMatch(/progetto: \$\{\{ vars\.PROGETTO_FLOTTA \}\}/)
    expect(flotta).toMatch(/cliente: demo/)
    expect(flotta).not.toMatch(/tana-drink/)
  })

  it('senza PROGETTO_FLOTTA si ferma invece di ripiegare sul test della Tana', () => {
    const w = workflow()
    const manca = w.slice(w.indexOf('  flotta-senza-progetto:'))
    expect(manca).toMatch(/vars\.PROGETTO_FLOTTA == ''/)
    expect(manca).toMatch(/exit 1/)
    expect(manca).not.toMatch(/deploy\.yml/)
  })
})

describe('il deploy', () => {
  it('compila per il cliente che gli si dice, e per i progetti della Tana resta «tana»', () => {
    const d = deploy()
    expect(d).toMatch(/cliente:[\s\S]*default: tana/)
    expect(d).toMatch(/CLIENTE: \$\{\{ inputs\.cliente \}\}/)
    // I due job della Tana non passano un cliente: resta il default.
    const w = workflow()
    const prova = w.slice(w.indexOf('  prova:'), w.indexOf('  produzione:'))
    const produzione = w.slice(w.indexOf('  produzione:'), w.indexOf('  flotta:'))
    expect(prova).not.toMatch(/cliente:/)
    expect(produzione).not.toMatch(/cliente:/)
  })
})
