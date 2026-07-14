// @vitest-environment happy-dom
'use strict'

// Unit test del rilevamento nuova versione (src/lib/appVersion.js).

import { describe, it, expect, vi } from 'vitest'
import { checkForUpdate } from '../../src/lib/appVersion.js'

const fetchWith = (build, ok = true) =>
  vi.fn(() =>
    Promise.resolve({ ok, json: () => Promise.resolve({ build }) })
  )

describe('checkForUpdate', () => {
  it('true quando la build online è diversa da quella in esecuzione', async () => {
    expect(await checkForUpdate(fetchWith('B2'), 'B1')).toBe(true)
  })

  it('false quando la build è la stessa', async () => {
    expect(await checkForUpdate(fetchWith('B1'), 'B1')).toBe(false)
  })

  it('false senza build corrente (dev/test) o con risposta non ok', async () => {
    expect(await checkForUpdate(fetchWith('B2'), null)).toBe(false)
    expect(await checkForUpdate(fetchWith('B2', false), 'B1')).toBe(false)
  })

  it('false se la rete fallisce (offline): nessun falso allarme', async () => {
    const failing = vi.fn(() => Promise.reject(new Error('offline')))
    expect(await checkForUpdate(failing, 'B1')).toBe(false)
  })

  it('chiede version.json senza cache', async () => {
    const f = fetchWith('B1')
    await checkForUpdate(f, 'B1')
    expect(f.mock.calls[0][0]).toContain('version.json')
    expect(f.mock.calls[0][1]).toMatchObject({ cache: 'no-store' })
  })
})
