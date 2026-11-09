'use strict'

// L'AMBIENTE E2E SI SVUOTA, E SOLO LUI (REQ-DEV-019).
//
// A ogni giro dei test end-to-end il progetto di prova si svuota per
// intero: database e utenze (scripts/lib-ambiente-e2e.mjs). Un nome
// sbagliato in una variabile non deve poter svuotare il test del cliente
// o la produzione: qui si prova la guardia, e che il workflow la rifaccia
// prima di toccare qualunque cosa e smonti sempre, anche coi test rossi.

import { describe, it, expect } from 'vitest'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { progettoE2e } from '../../scripts/lib-ambiente-e2e.mjs'

const chiave = (progetto) => {
  const f = join(mkdtempSync(join(tmpdir(), 'e2e-')), 'sa.json')
  writeFileSync(f, JSON.stringify({ project_id: progetto }))
  return f
}

describe('la guardia del progetto di prova', () => {
  it('accetta un progetto di prova con la sua chiave', () => {
    expect(progettoE2e('drinkpos-prova-e2e', { credenziali: chiave('drinkpos-prova-e2e') })).toBe('drinkpos-prova-e2e')
  })

  it('rifiuta il test del cliente, la produzione, le regie e qualunque altro nome', () => {
    for (const p of ['tana-drink', 'tana-drink-test', 'drink-regia', 'drink-regia-test', 'drinkpos-tana', 'drinkpos-prova', 'demo-tana-drink', '', undefined]) {
      expect(() => progettoE2e(p, { credenziali: null }), String(p)).toThrow(/\[e2e\]/)
    }
  })

  it('rifiuta la chiave di un altro progetto, anche col nome giusto', () => {
    expect(() => progettoE2e('drinkpos-prova-e2e', { credenziali: chiave('tana-drink-test') }))
      .toThrow('la chiave è del progetto tana-drink-test')
  })
})

describe('il workflow dell\'ambiente generato', () => {
  const wf = readFileSync('.github/workflows/e2e.yml', 'utf8')

  it('un giro alla volta', () => {
    expect(wf).toMatch(/concurrency:\s*\n\s*group: e2e\s*\n\s*cancel-in-progress: false/)
  })

  it('controlla progetto e chiave prima di qualunque deploy', () => {
    const guardia = wf.indexOf('drinkpos-prova-*)')
    expect(guardia).toBeGreaterThan(0)
    expect(guardia).toBeLessThan(wf.indexOf('deploy --only'))
    expect(wf).toContain('la chiave è del progetto')
  })

  it('smonta sempre, anche coi test rossi, e butta la chiave', () => {
    const smonta = wf.slice(wf.indexOf("- name: Smonta l'ambiente"))
    expect(smonta).toMatch(/if: always\(\)/)
    expect(smonta).toContain('scripts/ambiente-e2e.mjs --smonta')
    expect(smonta).toContain('hosting:channel:delete')
    expect(smonta).toContain('functions:delete')
    expect(wf.slice(wf.indexOf('- name: Via la chiave'))).toMatch(/if: always\(\)[\s\S]*rm -f "\$RUNNER_TEMP\/sa.json"/)
  })

  it('ogni comando va sul progetto di prova, mai su tana-drink-test, che resta al cliente', () => {
    const progetti = [...wf.matchAll(/--project\s+(\S+)/g)].map((m) => m[1])
    expect(progetti.length).toBeGreaterThan(4)
    expect(new Set(progetti)).toEqual(new Set(['"$E2E_PROGETTO"']))
  })
})
