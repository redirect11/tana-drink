'use strict'

// ── LA LICENZA INIZIALE, SCRITTA DAL DEPLOY (REQ-LIC-009) ─────────────
//
// L'utente, 02/11/2026: «non possiamo fare in modo che quando deployiamo
// scriviamo anche la licenza sul db? […] quando deployiamo da github». Il
// deploy crea `licenza/attuale` da `clienti/<slug>/licenza-iniziale.json`
// PRIMA delle regole, e solo se manca: un rilascio non riscrive mai una
// licenza che c'è, e non può togliere un modulo.

import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { erroreLicenzaIniziale, scriviSeManca, VOCI_DEL_CONTRATTO } from '../../scripts/lib-licenza-iniziale.js'
import { MODULI_PREMIUM } from '../../src/lib/licenza.js'

const ID = Object.keys(MODULI_PREMIUM)
const TUTTI = Object.fromEntries(ID.map((id) => [id, true]))

describe('il file della licenza iniziale', () => {
  // Tutte le voci del contratto, anche quelle che valgono null (la regia,
  // 02/11/2026): attiva, ogni modulo nominato, senza limiti né scadenza,
  // ferma se un giorno scadesse, senza cancellazioni, con lo slug.
  // La Tana ha il piano Completo, fatture comprese (decisione dell'utente,
  // 02/11/2026): ogni modulo acceso. Quando la regia le scriverà la licenza,
  // la calcolerà lei dal piano.
  it('quello della Tana ha tutte le voci del contratto, e tutti i moduli', () => {
    const tana = JSON.parse(readFileSync('clienti/tana/licenza-iniziale.json', 'utf8'))
    expect(erroreLicenzaIniziale(tana, ID)).toBeNull()
    expect(Object.keys(tana).sort()).toEqual([...VOCI_DEL_CONTRATTO].sort())
    expect(tana).toMatchObject({
      stato: 'attiva',
      limiti: null,
      valida_fino: null,
      valida_fino_ts: null,
      alla_scadenza: 'ferma',
      cancellazione: null,
      slug: 'tana',
      regia_url: null,
    })
    expect(Object.values(tana.moduli).every((v) => v === true)).toBe(true)
  })

  const BUONA = {
    stato: 'attiva',
    moduli: TUTTI,
    limiti: null,
    valida_fino: null,
    valida_fino_ts: null,
    alla_scadenza: 'ferma',
    cancellazione: null,
    slug: 'bar-mario',
    regia_url: null,
  }

  it('un file storto si dice, invece di scrivere una licenza che spegne in silenzio', () => {
    expect(erroreLicenzaIniziale(BUONA, ID)).toBeNull()
    expect(erroreLicenzaIniziale([], ID)).toMatch(/oggetto/)
    expect(erroreLicenzaIniziale({ moduli: TUTTI }, ID)).toMatch(/voci del contratto/)
    const senzaVoce = { ...BUONA }
    delete senzaVoce.cancellazione
    expect(erroreLicenzaIniziale(senzaVoce, ID)).toMatch(/cancellazione/)
    expect(erroreLicenzaIniziale({ ...BUONA, stato: 'sospesa' }, ID)).toMatch(/attiva/)
    expect(erroreLicenzaIniziale({ ...BUONA, alla_scadenza: 'boh' }, ID)).toMatch(/alla_scadenza/)
    expect(erroreLicenzaIniziale({ ...BUONA, slug: '' }, ID)).toMatch(/slug/)
    const senzaUno = { ...BUONA, moduli: { ...TUTTI } }
    delete senzaUno.moduli.sumup
    expect(erroreLicenzaIniziale(senzaUno, ID)).toMatch(/sumup/)
    expect(erroreLicenzaIniziale({ ...BUONA, moduli: { ...TUTTI, sumup: 'sì' } }, ID)).toMatch(/sumup/)
    expect(erroreLicenzaIniziale({ ...BUONA, moduli: { ...TUTTI, teletrasporto: true } }, ID)).toMatch(/teletrasporto/)
  })
})

// Un documento finto con la forma di un DocumentReference di firebase-admin.
const documento = (esiste, crea = vi.fn(() => Promise.resolve())) => ({
  get: vi.fn(() => Promise.resolve({ exists: esiste })),
  create: crea,
})

describe('scriviSeManca', () => {
  const LIC = { moduli: TUTTI }
  const ORA = new Date('2026-11-02T10:00:00Z')

  it('se manca, lo crea, e dice quando e chi l’ha scritto', async () => {
    const doc = documento(false)
    expect(await scriviSeManca(doc, LIC, ORA)).toBe('creata')
    expect(doc.create).toHaveBeenCalledWith({ moduli: TUTTI, scritta_il: '2026-11-02T10:00:00.000Z', scritta_da: 'deploy' })
  })

  it('se c’è, non lo tocca: un rilascio non riscrive una licenza', async () => {
    const doc = documento(true)
    expect(await scriviSeManca(doc, LIC, ORA)).toBe('cera')
    expect(doc.create).not.toHaveBeenCalled()
  })

  it('se nasce un istante prima, vale come «c’era»', async () => {
    const doc = documento(false, vi.fn(() => Promise.reject(Object.assign(new Error('6 ALREADY_EXISTS'), { code: 6 }))))
    expect(await scriviSeManca(doc, LIC, ORA)).toBe('cera')
  })

  it('un altro errore ferma tutto: il deploy non deve arrivare alle regole', async () => {
    const doc = documento(false, vi.fn(() => Promise.reject(Object.assign(new Error('PERMISSION_DENIED'), { code: 7 }))))
    await expect(scriviSeManca(doc, LIC, ORA)).rejects.toThrow(/PERMISSION_DENIED/)
  })
})

// L'ORDINE NEL DEPLOY: la licenza prima delle regole. Al contrario, il
// primo deploy delle regole nuove fermerebbe un locale senza documento.
describe('il deploy', () => {
  it('scrive la licenza prima di pubblicare le regole', () => {
    const yml = readFileSync('.github/workflows/deploy.yml', 'utf8')
    const licenza = yml.indexOf('node scripts/licenza-iniziale.mjs')
    const regole = yml.indexOf('deploy --only firestore')
    expect(licenza).toBeGreaterThan(-1)
    expect(regole).toBeGreaterThan(-1)
    expect(licenza).toBeLessThan(regole)
  })
})
