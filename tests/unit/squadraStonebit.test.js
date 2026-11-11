// LA SQUADRA DI STONEBIT (REQ-DEV-020). Richiesta del CEO-agente di Stonebit
// per conto di Daniele, 11/11/2026: una sessione aperta qui lavora come PM di
// Lime (app del locale), con un Tech Lead e una squadra di sub-agenti. Le
// istruzioni di un agente sono testo, e il testo si perde senza rumore: una
// sezione spostata in fondo a CLAUDE.md, un agente col nome sbagliato che
// nessuno riesce più a chiamare, un agente vecchio ritoccato per sbaglio.
// Qui si controlla che i pezzi ci siano e siano al loro posto.

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const radice = join(__dirname, '..', '..')
const leggi = (...p) => readFileSync(join(radice, ...p), 'utf8').replace(/\r\n/g, '\n')
const claude = leggi('CLAUDE.md')

const DEVELOPER = ['frontend-developer', 'backend-developer', 'stampa-developer']
const NUOVI = ['pm', 'tech-lead', ...DEVELOPER, 'revisore']
const DI_PRIMA = ['requisiti-dal-banco', 'rilascio-hotfix', 'allinea-registro', 'classifica-registro']

// Il blocco fra i due `---` in testa a un agente: `chiave: valore` per riga.
function testata(testo) {
  const m = testo.match(/^---\n([\s\S]*?)\n---\n/)
  if (!m) return null
  return Object.fromEntries(m[1].split('\n').map((r) => [r.slice(0, r.indexOf(':')).trim(), r.slice(r.indexOf(':') + 1).trim()]))
}

describe('CLAUDE.md', () => {
  it('la sezione di Stonebit è la prima dopo il titolo', () => {
    const titoli = claude.split('\n').filter((r) => /^#{1,2} /.test(r))
    expect(titoli[0]).toMatch(/^# Tana Drink/)
    expect(titoli[1]).toBe('## Stonebit — chi sei e come lavori qui')
  })

  it('dice chi decide e cosa la squadra non fa', () => {
    expect(claude).toContain('### Regola zero: decide Daniele')
    expect(claude).toContain('Merge, tag e deploy li fa Daniele')
    expect(claude).toContain('### Ruolo di default')
    expect(claude).toContain('mai licenze open source')
  })

  // «Non togliere niente di quello che c'è già»: le regole del repo restano
  // vincolanti. Le sezioni di prima ci sono tutte, nell'ordine di prima.
  it('le regole che c’erano restano, nell’ordine di prima', () => {
    const DI_SEMPRE = [
      '## La lingua',
      '## Come si lavora: GitFlow',
      '## Prima di una PR — e il cancello del merge in `develop`',
      '## I test sono la specifica',
      '## Come si scrive qui',
      '## Regole del mestiere (imparate sbagliando)',
      '## Ambiente locale',
      '## I requisiti e i test sono la bibbia',
      '## Cose da sapere sull\'infrastruttura',
      '## Dove sta cosa',
      '## La biblioteca: cosa leggere prima di toccare cosa',
    ]
    const posti = DI_SEMPRE.map((t) => claude.indexOf('\n' + t + '\n'))
    for (const [i, p] of posti.entries()) expect(p, DI_SEMPRE[i]).toBeGreaterThan(0)
    expect([...posti].sort((a, b) => a - b)).toEqual(posti)
    expect(claude).toContain('### Il local-first è la prima regola, e non si negozia')
  })
})

describe('AGENTS.md', () => {
  it('rimanda a CLAUDE.md e alla squadra', () => {
    const agents = leggi('AGENTS.md')
    expect(agents).toContain('`CLAUDE.md`')
    expect(agents).toContain('`.claude/agents/`')
  })
})

describe('la squadra in .claude/agents', () => {
  it.each(NUOVI)('%s: il nome è quello del file, e dice quando usarlo', (nome) => {
    const t = testata(leggi('.claude', 'agents', `${nome}.md`))
    expect(t).not.toBeNull()
    expect(t.name).toBe(nome)
    expect(t.description.length).toBeGreaterThan(30)
  })

  it('nessuno della squadra fa merge, tag o deploy; PM e revisore non scrivono codice', () => {
    for (const nome of DEVELOPER) expect(leggi('.claude', 'agents', `${nome}.md`), nome).toContain('Non fai merge, tag, deploy')
    expect(leggi('.claude', 'agents', 'tech-lead.md')).toContain('Mai merge, tag o deploy')
    expect(leggi('.claude', 'agents', 'pm.md')).toContain('non scrivi codice')
    expect(leggi('.claude', 'agents', 'revisore.md')).toContain('Non scrivi codice')
  })

  // «L'issue è la specifica del lavoro»: chi implementa la legge prima di
  // cominciare e ci riporta l'esito.
  it('ogni developer parte dalla issue e ci torna col rapporto', () => {
    for (const nome of DEVELOPER) {
      const t = leggi('.claude', 'agents', `${nome}.md`)
      expect(t, nome).toContain('gh issue view')
      expect(t, nome).toContain("commento sull'issue")
    }
  })

  it('gli agenti di prima ci sono ancora, e non ce ne sono altri oltre a questi dieci', () => {
    for (const nome of DI_PRIMA) expect(existsSync(join(radice, '.claude', 'agents', `${nome}.md`)), nome).toBe(true)
    const file = readdirSync(join(radice, '.claude', 'agents')).filter((f) => f.endsWith('.md')).map((f) => f.replace('.md', ''))
    expect(file.sort()).toEqual([...NUOVI, ...DI_PRIMA].sort())
  })
})
