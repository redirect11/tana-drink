import { describe, it, expect } from 'vitest'
import { paghePerGiorno, tabellaDelMese } from '../../src/lib/bilancioMesi.js'

// BILANCIO → MESI (REQ-CASSA-011): i fogli mensili di ANALISI DATI nell'app.
// Per ogni giorno minimo, incassato e differenza; sotto, i conti del mese.

const tariffe = () => [{ from: '2026-01-01', rate: 6.25 }]

describe('il minimo dalle paghe (REQ-STAFF-015)', () => {
  // La regola del 19/08: la somma delle paghe di chi lavora quel giorno. Per
  // un giorno passato contano le ore fatte, per uno futuro i turni.
  it('ore effettive per i giorni passati, turni programmati per quelli a venire', () => {
    const voci = [
      { date: '2026-10-09', staff_name: 'Anna', hours: 8, kind: 'effettivo' },
      { date: '2026-10-09', staff_name: 'Anna', hours: 6, kind: 'programmato' },
      { date: '2026-10-12', staff_name: 'Anna', hours: 4, kind: 'programmato' },
    ]
    const p = paghePerGiorno(voci, tariffe, '2026-10-10')
    expect(p.get('2026-10-09')).toBe(50)
    expect(p.get('2026-10-12')).toBe(25)
  })

  it('un giorno senza ore non ha minimo', () => {
    expect(paghePerGiorno([], tariffe, '2026-10-10').size).toBe(0)
  })

  // Con una tariffa che manca il costo sarebbe solo una parte: un obiettivo
  // più basso del vero, che si legge come vero.
  it('un giorno dove manca una tariffa non ha minimo', () => {
    const voci = [
      { date: '2026-10-09', staff_name: 'Anna', hours: 8, kind: 'effettivo' },
      { date: '2026-10-09', staff_name: 'Nuovo', hours: 8, kind: 'effettivo' },
    ]
    const perVoce = (e) => (e.staff_name === 'Anna' ? [{ from: '2026-01-01', rate: 6.25 }] : [])
    expect(paghePerGiorno(voci, perVoce, '2026-10-10').has('2026-10-09')).toBe(false)
  })
})

describe('la tabella del mese', () => {
  const incassi = new Map([
    ['2026-06-01', 507],
    ['2026-06-02', 100],
  ])

  // Le settimane del foglio: 1–7, 8–14, 15–21, 22–28 e i giorni che restano.
  it('il mese per settimane, come il foglio', () => {
    const t = tabellaDelMese({ mese: '2026-06', incassi, oggi: '2026-10-10' })
    expect(t.settimane.map((s) => s.label)).toEqual(['I SETT', 'II SETT', 'III SETT', 'IV SETT', 'EXTRA'])
    expect(t.settimane[0].giorni.map((g) => g.nome)[0]).toBe('lun 1')
  })

  // Nei mesi del foglio il minimo è il suo; l'incassato sono i conti.
  it('nei mesi del foglio, minimo e note dal foglio e incassato dai conti', () => {
    const foglio = {
      giorni: { '2026-06-01': { minimo: 300, nota: 'KARAOKE 2' }, '2026-06-02': { minimo: 150 } },
      stipendi: 3500,
      spese: 12726,
    }
    const t = tabellaDelMese({ mese: '2026-06', incassi, foglio, oggi: '2026-10-10' })
    const [lun, mar] = t.settimane[0].giorni
    expect(lun).toMatchObject({ minimo: 300, incassato: 507, differenza: 207, nota: 'KARAOKE 2' })
    expect(mar.differenza).toBe(-50)
    expect(t.totali).toMatchObject({ incassi: 607, stipendi: 3500, spese: 12726, netto: 607 - 3500 - 12726 })
    expect(t.totali.dalFoglio).toEqual({ stipendi: true, spese: true })
  })

  // Nei mesi dell'app: minimo dalle paghe, stipendi dalle ore, spese dal
  // Riepilogo di Fornitori. E i giorni a venire non hanno incassato.
  it('nei mesi dell’app, i numeri dell’app; i giorni a venire senza incassato', () => {
    const t = tabellaDelMese({
      mese: '2026-10',
      incassi: new Map([['2026-10-09', 400]]),
      paghe: new Map([
        ['2026-10-09', 50],
        ['2026-10-12', 25],
      ]),
      stipendi: 75,
      spese: 300,
      incassoNetto: 1000,
      costoVenduto: 250,
      oggi: '2026-10-10',
    })
    const giorni = t.settimane.flatMap((s) => s.giorni)
    expect(giorni.find((g) => g.giorno === '2026-10-09')).toMatchObject({ minimo: 50, incassato: 400, differenza: 350 })
    expect(giorni.find((g) => g.giorno === '2026-10-12')).toMatchObject({ minimo: 25, incassato: null, differenza: null })
    expect(t.totali).toMatchObject({ stipendi: 75, spese: 300, netto: 25, costoLavoroPct: 7.5, primeCostPct: 32.5 })
  })

  it('senza stipendi o spese il netto non si inventa', () => {
    const t = tabellaDelMese({ mese: '2026-10', incassi, oggi: '2026-10-10' })
    expect(t.totali.netto).toBeNull()
    expect(t.totali.costoLavoroPct).toBeNull()
  })
})
