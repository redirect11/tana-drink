// I DOCUMENTI DICONO DELLA CI QUELLO CHE LA CI FA (BUG-145). Fino al
// 12/11/2026 CLAUDE.md prometteva che un push «fa girare lint, test e build»
// e che i test di sistema girano «su ogni pull request». Non era vero: la CI
// salta i push sui rami di rilascio, dove si lavora tutti i giorni, e i test
// di sistema e delle regole partono solo sulle pull request verso `develop`
// e `main`. Chi si fidava dei documenti credeva coperto un lavoro che non lo
// era: l'11/11 un test di sistema rotto è arrivato fino a una pull request
// verso la release, e l'ha fermato solo un giro fatto a mano.
//
// Daniele ha deciso che la CI resta com'è e si correggono i documenti. Qui
// si legge il workflow vero e si controlla che i documenti lo raccontino: se
// un giorno la CI cambia, questo test dice di riscriverli.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import yaml from 'js-yaml'

const radice = join(__dirname, '..', '..')
const leggi = (...p) => readFileSync(join(radice, ...p), 'utf8').replace(/\r\n/g, '\n')
// Su una riga sola: una frase non deve sfuggire perché è andata a capo.
const piatto = (t) => t.replace(/\s+/g, ' ')

const ci = yaml.load(leggi('.github', 'workflows', 'test.yml'))
// `on:` in YAML 1.1 si legge come `true`.
const quando = ci.on ?? ci[true]
const DOCUMENTI = ['CLAUDE.md', 'docs/gitflow.md', 'docs/modello-a-v.md']

describe('la CI com’è oggi (test.yml)', () => {
  it('i push fanno girare i test su ogni ramo tranne quelli di rilascio', () => {
    expect(quando.push.branches).toEqual(['**', '!release/**'])
  })

  it('le pull request che fanno girare tutto sono quelle verso develop e main', () => {
    expect(quando.pull_request.branches).toEqual(['develop', 'main'])
  })

  it('test di sistema e regole partono solo su pull request o a mano, non sui push', () => {
    for (const lavoro of ['sistema', 'regole']) {
      expect(ci.jobs[lavoro].if, lavoro).toContain("github.event_name == 'pull_request'")
      expect(ci.jobs[lavoro].if, lavoro).not.toContain("== 'push'")
    }
  })
})

describe('i documenti la raccontano com’è', () => {
  it.each(DOCUMENTI)('%s non promette test di sistema su ogni pull request', (doc) => {
    const t = piatto(leggi(...doc.split('/')))
    expect(t).not.toMatch(/su ogni pull request/i)
    expect(t).not.toMatch(/su ogni PR\b/)
  })

  it.each(DOCUMENTI)('%s non promette test a ogni push su qualunque ramo', (doc) => {
    const t = piatto(leggi(...doc.split('/')))
    expect(t).not.toContain('Su qualunque ramo, `main` compreso')
    expect(t).not.toContain('ogni push lo pubblica su test')
    expect(t).not.toMatch(/Un push fa girare lint, test e build e finisce lì/)
  })

  it('CLAUDE.md dice dove i test di sistema girano da soli e dove vanno lanciati a mano', () => {
    const t = piatto(leggi('CLAUDE.md'))
    expect(t).toContain('solo sulle pull request verso `develop` e `main`')
    expect(t).toContain('tranne sui rami `release/**`')
  })

  it('docs/gitflow.md dice la stessa cosa, e descrive i tag -beta su develop', () => {
    const t = piatto(leggi('docs', 'gitflow.md'))
    expect(t).toContain('tranne sui rami `release/**`')
    expect(t).toContain('solo sulle pull request verso `develop` e `main`')
    expect(t).toContain('`vX.Y.Z-beta` su `develop`')
  })

  // Le descrizioni dei requisiti finiscono nella specifica generata.
  it('nemmeno il registro dei requisiti lo promette', () => {
    expect(piatto(leggi('requirements', 'requirements.yaml'))).not.toMatch(/girano su ogni pull request|e su ogni pull request con/)
  })
})
