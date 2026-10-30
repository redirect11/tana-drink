'use strict'

// LA CARTELLA DI UN CLIENTE NUOVO (REQ-VENUE-006). La regia (drink-regia)
// lancia `node scripts/genera-cliente.mjs --slug <slug> --nome <nome>` su
// un checkout dell'app, e subito dopo compila con `CLIENTE=<slug>`. È un
// contratto con un altro repository: se lo script cambia argomenti o
// comportamento, l'attivazione di un locale si rompe senza che qui se ne
// accorga nessuno. Lo script gira davvero, in una cartella temporanea.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { leggiCliente } from '../../clienti/pluginCliente.js'

const SCRIPT = resolve('scripts/genera-cliente.mjs')
let radice

const lancia = (...argomenti) => spawnSync(process.execPath, [SCRIPT, ...argomenti], { cwd: radice, encoding: 'utf8' })

beforeEach(() => {
  radice = mkdtempSync(join(tmpdir(), 'genera-cliente-'))
  // I file neutri da copiare stanno nel cliente demo.
  mkdirSync(join(radice, 'clienti', 'demo', 'public'), { recursive: true })
  writeFileSync(join(radice, 'clienti', 'demo', 'public', 'logo.png'), 'logo neutro')
})

afterEach(() => rmSync(radice, { recursive: true, force: true }))

describe('genera-cliente.mjs', () => {
  it('crea venue.json col nome del locale e copia i file neutri', () => {
    const esito = lancia('--slug', 'bar-mario', '--nome', 'Bar Mario')
    expect(esito.status).toBe(0)
    const c = leggiCliente('bar-mario', radice)
    expect(c.venue.venue_name).toBe('Bar Mario')
    expect(c.venue.venue_short_name).toBe('Bar Mario')
    expect(c.venue.venue_description).toBe('Ordina da Bar Mario')
    expect(c.venue.venue_socials).toEqual([])
    expect(JSON.stringify(c.venue)).not.toMatch(/Tana|Coniglio|EFFEVI/)
    expect(readFileSync(join(c.pubblica, 'logo.png'), 'utf8')).toBe('logo neutro')
  })

  it('un nome lungo dà un nome corto di una parola, per l’icona', () => {
    expect(lancia('--slug', 'prova-x', '--nome', 'Prova Cocktail Lounge').status).toBe(0)
    expect(leggiCliente('prova-x', radice).venue.venue_short_name).toBe('Prova')
  })

  it('senza --nome il nome è lo slug', () => {
    expect(lancia('--slug', 'locale-uno').status).toBe(0)
    expect(leggiCliente('locale-uno', radice).venue.venue_name).toBe('locale-uno')
  })

  it('una cartella che c’è già non si tocca: è un cliente curato a mano', () => {
    mkdirSync(join(radice, 'clienti', 'bar-mario'), { recursive: true })
    const curato = '{"venue_name":"Bar Mario, curato"}\n'
    writeFileSync(join(radice, 'clienti', 'bar-mario', 'venue.json'), curato)
    const esito = lancia('--slug', 'bar-mario', '--nome', 'Altro nome')
    expect(esito.status).toBe(0)
    expect(readFileSync(join(radice, 'clienti', 'bar-mario', 'venue.json'), 'utf8')).toBe(curato)
  })

  it('uno slug fuori forma ferma lo script prima di scrivere', () => {
    for (const slug of ['Bar Mario', 'ab', '-bar', 'bar_mario']) {
      const esito = lancia('--slug', slug, '--nome', 'X')
      expect(esito.status, slug).toBe(1)
    }
    expect(lancia().status).toBe(1)
    expect(existsSync(join(radice, 'clienti', 'Bar Mario'))).toBe(false)
  })
})
