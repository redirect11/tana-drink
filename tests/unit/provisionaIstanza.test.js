'use strict'

// IL WORKFLOW DI ATTIVAZIONE (REQ-FLOTTA-006) vive in questo repository
// perché compila e pubblica l'app; lo lancia la regia (repo drink-regia).
// Un workflow non ha altri test: questo legge il file e tiene fermi i
// punti che la regia e Terraform danno per scontati — gli input, l'ordine
// dei passi, l'esito mandato SEMPRE, le credenziali che non restano in
// giro.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const w = () => readFileSync(join(process.cwd(), '.github/workflows/provisiona-istanza.yml'), 'utf8')

describe('provisiona-istanza.yml', () => {
  it('prende gli input che la regia manda (dispatchPayload): slug, nome_locale, piano, moduli, uid', () => {
    const inputs = w().slice(w().indexOf('inputs:'), w().indexOf('permissions:'))
    for (const nome of ['slug:', 'nome_locale:', 'piano:', 'moduli:', 'uid:']) expect(inputs).toContain(nome)
  })

  it('i passi vanno nell’ordine giusto: terraform, cartella del cliente, build, deploy, licenza, esito', () => {
    const t = w()
    const posizioni = [
      'terraform apply',
      'genera-cliente.mjs',
      'npm run build',
      'firebase-tools deploy',
      'licenza-istanza.mjs',
      'Esito alla regia',
    ].map((s) => t.indexOf(s))
    expect(posizioni.every((p) => p > 0)).toBe(true)
    expect([...posizioni].sort((a, b) => a - b)).toEqual(posizioni)
  })

  it('l’esito parte sempre, anche se qualcosa è andato storto, e le credenziali si cancellano', () => {
    const t = w()
    const esito = t.slice(t.indexOf('- name: Esito alla regia'), t.indexOf('- name: Pulizia credenziali'))
    expect(esito).toMatch(/if: always\(\)/)
    expect(esito).toMatch(/STATO=errore/)
    const pulizia = t.slice(t.indexOf('- name: Pulizia credenziali'))
    expect(pulizia).toMatch(/if: always\(\)/)
    expect(pulizia).toMatch(/rm -f .*sa\.json/)
  })

  it('il progetto si chiama drinkpos-<slug> e la build è per quel cliente', () => {
    const t = w()
    expect(t).toMatch(/PROGETTO: drinkpos-\$\{\{ inputs\.slug \}\}/)
    expect(t).toMatch(/CLIENTE: \$\{\{ inputs\.slug \}\}/)
    expect(t).not.toMatch(/tana-drink/)
  })
})
