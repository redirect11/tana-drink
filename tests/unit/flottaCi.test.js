'use strict'

// LA CI DI tana-drink PUBBLICA SOLO LA TANA (REQ-FLOTTA-001).
// L'utente, 21/10/2026: «ci serve un modo sicuro per testare senza
// spaccare niente per la Tana». Dal 29/10/2026 la flotta — Terraform,
// attivazione e aggiornamento delle istanze — sta nella regia
// (drink-regia): qui restano solo i deploy dei due progetti della Tana,
// compilati per la Tana. Un workflow non ha altri test: questo lo legge,
// perché un ritocco di buona volontà potrebbe rimettere qui una
// destinazione della flotta, o compilare il test della Tana per un altro
// locale, senza che nessuno se ne accorga prima del deploy.
//
// Dal 18/11/2026 c'è anche il pacchetto per versione (REQ-FLOTTA-035):
// pacchetto.yml lo compila al tag e lo allega alla Release di GitHub di
// QUESTO repository, da dove la regia lo scarica. Non è un deploy e non
// ha credenziali: la regola 2 di docs/flotta.md resta, e il test qui sotto
// la tiene ferma anche per lui.

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const leggi = (f) => readFileSync(join(process.cwd(), '.github/workflows', f), 'utf8').replace(/\r\n/g, '\n')
const tratto = (testo, da, a) => testo.slice(testo.indexOf(da), a ? testo.indexOf(a) : undefined)

describe('il deploy', () => {
  it('compila per il cliente che gli si dice, e senza è la Tana', () => {
    const d = leggi('deploy.yml')
    expect(d).toMatch(/cliente:[\s\S]*default: tana/)
    expect(d).toMatch(/CLIENTE: \$\{\{ inputs\.cliente \}\}/)
  })

  it('i due progetti della Tana si compilano per la Tana, e non ci sono altre destinazioni', () => {
    const w = leggi('firebase-hosting.yml')
    const prova = tratto(w, '  prova:', '  produzione:')
    const produzione = tratto(w, '  produzione:')
    expect(prova).toMatch(/progetto: tana-drink-test/)
    expect(prova).toMatch(/cliente: tana\n/)
    expect(produzione).toMatch(/progetto: tana-drink\n/)
    expect(produzione).toMatch(/cliente: tana\n/)
    // Nessuna destinazione della flotta: le istanze le pubblica la regia.
    expect(w).not.toMatch(/PROGETTO_FLOTTA|drinkpos-|ambiente: flotta/)
    expect(w.match(/cliente: \S+/g)).toEqual(['cliente: tana', 'cliente: tana'])
  })

  it('i workflow e il Terraform della flotta non stanno qui', () => {
    for (const f of ['provisiona-istanza.yml', 'aggiorna-istanza.yml']) {
      expect(existsSync(join(process.cwd(), '.github/workflows', f)), f).toBe(false)
    }
    expect(existsSync(join(process.cwd(), 'infra'))).toBe(false)
  })
})

describe('la CI', () => {
  // «I test guardano tutti i clienti»: una modifica pensata per la Tana
  // che rompe la build degli altri locali si vede prima del rilascio.
  it('compila anche il cliente neutro demo', () => {
    const t = leggi('test.yml')
    const passo = tratto(t, '- name: Build del cliente demo', '- name: Run tests with coverage')
    expect(passo).toMatch(/run: npm run build/)
    expect(passo).toMatch(/CLIENTE: demo/)
  })
})

describe('il pacchetto per versione (REQ-FLOTTA-035)', () => {
  const w = () => leggi('pacchetto.yml')
  const job = (nome) => {
    const testo = w()
    const inizio = testo.indexOf(`\n  ${nome}:\n`)
    const dopo = testo.slice(inizio + 1).search(/\n  [a-z]+:\n/)
    return dopo < 0 ? testo.slice(inizio) : testo.slice(inizio, inizio + 1 + dopo)
  }

  it('parte solo dai tag di versione', () => {
    expect(w()).toMatch(/on:\n  push:\n    tags:\n      - 'v\*'\n\npermissions:/)
    expect(w()).not.toMatch(/workflow_dispatch|pull_request|branches:/)
  })

  it('non ha credenziali e non pubblica da nessuna parte fuori dalla sua Release', () => {
    expect(w()).not.toMatch(/secrets\.|id-token|gcloud|google-github-actions|firebase-tools|firebase deploy|drinkpos-|drink-regia|curl /)
    expect(w()).toMatch(/^permissions:\n  contents: read\n/m)
    // L'unico permesso di scrittura è sulla Release, e solo nel job che allega.
    expect(w().match(/contents: write/g)).toHaveLength(1)
    expect(job('pubblica')).toMatch(/permissions:\n      contents: write/)
  })

  it('un pacchetto non beta esce solo da un commit di main, dopo lint e test', () => {
    const controllo = job('controllo')
    expect(controllo).toMatch(/needs: test/)
    expect(controllo).toMatch(/git merge-base --is-ancestor "\$GITHUB_SHA" origin\/main/)
    expect(controllo).toMatch(/\*-beta\*\) BETA=true/)
    expect(job('test')).toMatch(/npm run lint[\s\S]*npm test/)
    expect(job('compila')).toMatch(/if: needs\.controllo\.outputs\.pubblica == 'true'/)
  })

  // Un tag che non è v + package.json non fa pacchetti; su main sarebbe un
  // rilascio senza pacchetto, e deve fermarsi in rosso (il vecchio vX.Y.Z-prod).
  it('il tag deve essere la versione di package.json, e su main è un errore', () => {
    const controllo = job('controllo')
    const confronto = controllo.indexOf('if [ "$GITHUB_REF_NAME" != "v$VERSIONE" ]; then')
    const suMain = controllo.indexOf('if [ "$SU_MAIN" = true ]; then', confronto)
    const errore = controllo.indexOf('exit 1', suMain)
    const avviso = controllo.indexOf('echo "pubblica=false"', confronto)
    expect(confronto).toBeGreaterThan(0)
    expect(suMain).toBeGreaterThan(confronto)
    expect(errore).toBeGreaterThan(suMain)
    expect(avviso).toBeGreaterThan(errore)
  })

  it('compila i due tipi col comando del repository', () => {
    expect(job('compila')).toMatch(/tipo: \[locali, demo\]/)
    expect(job('compila')).toMatch(/node scripts\/crea-pacchetto\.mjs --tipo "\$\{\{ matrix\.tipo \}\}" --tag "\$GITHUB_REF_NAME"/)
  })

  it('un file allegato non si sostituisce, e la Release esce completa', () => {
    const pubblica = job('pubblica')
    expect(w()).not.toMatch(/--clobber|gh release delete/)
    expect(pubblica).toMatch(/gh release create "\$TAG" --verify-tag --draft/)
    // Prima gli archivi, poi le impronte, poi la Release si pubblica.
    const a = pubblica.indexOf('pacchetti/*.tgz; do gh release upload')
    const b = pubblica.indexOf('pacchetti/*.tgz.sha256; do gh release upload')
    const c = pubblica.indexOf('--draft=false')
    expect(a).toBeGreaterThan(0)
    expect(b).toBeGreaterThan(a)
    expect(c).toBeGreaterThan(b)
  })
})
