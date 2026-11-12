// LA SQUADRA DI STONEBIT (REQ-DEV-020). Richiesta del CEO-agente di Stonebit
// per conto di Daniele, 11/11/2026: una sessione aperta qui lavora come PM di
// Lime (app del locale), con un Tech Lead e una squadra di sub-agenti. Le
// istruzioni di un agente sono testo, e il testo si perde senza rumore: una
// sezione spostata in fondo a CLAUDE.md, un agente col nome sbagliato che
// nessuno riesce più a chiamare, un agente vecchio ritoccato per sbaglio.
// Qui si controlla che i pezzi ci siano e siano al loro posto.
//
// E CHE NON TORNINO LE REGOLE SBAGLIATE (REQ-DEV-021). La prima stesura era
// scritta da fuori e in otto punti contraddiceva il repo; Daniele,
// 11/11/2026: «continua come hai sempre fatto». Dove le due si contraddicono
// valgono le regole del repo, e una prossima versione delle istruzioni non
// deve rimettere le frasi di prima senza che nessuno se ne accorga.

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
  const sezione = claude.slice(claude.indexOf('## Stonebit — chi sei e come lavori qui'), claude.indexOf('\n## La lingua\n'))

  // La presentazione del repo resta il primo testo del file: messa la
  // sezione subito dopo il titolo, «App di cassa e gestione…» finiva sotto
  // «Fine di ogni sessione» e si leggeva come parte di quella.
  it('prima la presentazione del repo, poi la sezione di Stonebit, poi le altre', () => {
    const titoli = claude.split('\n').filter((r) => /^#{1,2} /.test(r))
    expect(titoli[0]).toMatch(/^# Tana Drink/)
    expect(titoli[1]).toBe('## Stonebit — chi sei e come lavori qui')
    expect(titoli[2]).toBe('## La lingua')
    const presentazione = claude.indexOf('App di cassa e gestione per **La Tana del Coniglio**')
    expect(presentazione).toBeGreaterThan(0)
    expect(presentazione).toBeLessThan(claude.indexOf('## Stonebit'))
  })

  it('si apre dicendo che sulle regole del repo vince il repo', () => {
    const primaRiga = sezione.split('\n').filter((r) => r.trim())[1]
    expect(primaRiga).toContain('valgono le regole di questo repo')
    expect(sezione).toContain('vincono loro (Daniele, 11/11/2026)')
  })

  it('dice chi decide', () => {
    expect(sezione).toContain('### Regola zero: decide Daniele')
    expect(sezione).toContain('### Ruolo di default')
    expect(sezione).toContain('mai licenze open source')
  })

  // I punti dove la prima stesura contraddiceva il repo.
  it('non dice più che ogni lavoro va su un ramo feature, né che i tag li mette solo Daniele', () => {
    expect(sezione).not.toContain('Ogni lavoro su un ramo `feature/…`')
    expect(sezione).toContain('Il lavoro normale va su `release/x.y.z`')
    expect(sezione).not.toContain('Merge, tag e deploy li fa Daniele')
    expect(sezione).toMatch(/tag `-beta`[^.]*quando Daniele lo chiede/)
  })

  it('il numero di versione cambia sulla release, e nel codice i nomi restano in inglese dove lo è il codice', () => {
    expect(sezione).toContain('subito dopo l’uscita')
    expect(sezione).not.toContain('Tutto in italiano: codice')
    expect(sezione).toContain('in inglese dove lo è il codice attorno')
  })

  it('è il requisito a citare i suoi test', () => {
    expect(sezione).not.toContain('ogni test cita il\nsuo requisito')
    expect(sezione).toContain('`test_cases`')
  })

  // Il processo deciso da Daniele l'11/11/2026.
  it('il processo: storia sempre, revisore sempre, squadra solo per i lavori grossi', () => {
    expect(sezione).toContain('product owner')
    expect(sezione).toContain('**Storia sempre**')
    expect(sezione).toContain('**Revisore sempre**')
    expect(sezione).toContain('solo per i lavori grossi o divisibili')
    expect(sezione).not.toContain('Proponi a Daniele il piano della sessione prima di modificare codice')
  })

  // Il passo che si salta facilmente: lo script crea le issue solo per le
  // voci ancora da fare.
  it('la voce va spinta da fare prima dell’implementazione', () => {
    expect(sezione).toMatch(/`todo`[^.]*prima dell’implementazione/)
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

  it('gli agenti non ripetono le regole sbagliate', () => {
    for (const nome of NUOVI) {
      const t = leggi('.claude', 'agents', `${nome}.md`)
      expect(t, nome).not.toContain('dizionario dei testi')
      expect(t, nome).not.toContain('NON FISCALE')
      expect(t, nome).not.toMatch(/Lavori su un ramo `feature\/…` \(o `hotfix\/…`\)/)
      expect(t, nome).not.toContain('con il requisito citato;')
    }
  })

  it('PM e tech lead ricordano la voce da fare prima del codice', () => {
    for (const nome of ['pm', 'tech-lead']) expect(leggi('.claude', 'agents', `${nome}.md`), nome).toContain('`todo`')
  })

  // Sulle PR verso la release la CI non fa girare i test delle regole né
  // quelli di sistema: li lancia il revisore, e lo scrive.
  it('il revisore lancia a mano i test che la CI non fa girare', () => {
    const t = leggi('.claude', 'agents', 'revisore.md')
    expect(t).toContain('npm run test:regole')
    expect(t).toContain('npm run test:sistema')
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
