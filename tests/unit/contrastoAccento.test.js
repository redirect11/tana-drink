// IL TESTO SOPRA L'ACCENTO PIENO SI LEGGE (REQ-UI-036, WCAG 1.4.3).
//
// La prima misura con axe (17/11/2026) ha trovato la categoria scelta nel
// conto illeggibile col tema della Tana: sul rosa #e52e71 il bianco sta a
// 4,2:1 e il bruno a 4,35:1, sotto la soglia di 4,5. `applyTheme` scrive
// `--accent-pieno`, l'accento scurito (o schiarito) quanto basta perché
// l'inchiostro sopra si legga; i fondi d'accento con del testo usano quello.
import { describe, it, expect } from 'vitest'
import { contrasto, accentoPieno, luminanza, isLightColor, THEME_PRESETS } from '../../src/lib/themes.js'

describe('il contrasto, come lo misura WCAG', () => {
  it('nero su bianco 21:1, un colore con sé stesso 1:1', () => {
    expect(contrasto('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(contrasto('#e52e71', '#e52e71')).toBeCloseTo(1, 5)
    expect(luminanza('non è un colore')).toBeNull()
  })

  it('il rosa della Tana col bianco non arriva a 4,5', () => {
    expect(contrasto('#e52e71', '#ffffff')).toBeLessThan(4.5)
  })
})

describe('l’accento pieno', () => {
  it('sotto il bianco, il rosa della Tana si scurisce quanto basta', () => {
    const pieno = accentoPieno('#e52e71', '#ffffff')
    expect(contrasto(pieno, '#ffffff')).toBeGreaterThanOrEqual(4.5)
    // Di poco: resta il rosa della Tana, non diventa bordeaux.
    expect(contrasto(pieno, '#e52e71')).toBeLessThan(1.3)
  })

  it('un accento che regge già resta com’è: il lime col suo inchiostro', () => {
    expect(accentoPieno('#b4ec2b', '#16210a')).toBe('#b4ec2b')
  })

  it('sotto un inchiostro scuro, l’accento si schiarisce invece di scurirsi', () => {
    const pieno = accentoPieno('#6a6a20', '#1c1305')
    expect(contrasto(pieno, '#1c1305')).toBeGreaterThanOrEqual(4.5)
    expect(luminanza(pieno)).toBeGreaterThan(luminanza('#6a6a20'))
  })

  it('su ogni tavolozza dell’app il testo sopra l’accento pieno si legge', () => {
    for (const [id, p] of Object.entries(THEME_PRESETS)) {
      const accento = p.vars?.['--accent']
      if (luminanza(accento) == null) continue
      // La stessa scelta di applyTheme.
      const inchiostro = p.vars['--accent-ink'] || (isLightColor(accento) ? '#1c1305' : '#ffffff')
      expect(contrasto(accentoPieno(accento, inchiostro), inchiostro), id).toBeGreaterThanOrEqual(4.5)
    }
  })
})
