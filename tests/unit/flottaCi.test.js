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
