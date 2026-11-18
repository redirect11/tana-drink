'use strict'

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { leggiCliente, pagineInformativa, informativaPerCliente } from '../../clienti/pluginCliente.js'

// L'INFORMATIVA È DEL LOCALE (REQ-SIC-017). Le pagine stavano in public/ e
// finivano così com'erano in ogni build: sulla demo e sui locali della
// flotta il titolare del trattamento era EFFEVI, la Tana, con la sua email
// (docs/sicurezza-demo.md, punto 4).
describe('l’informativa privacy e cookie', () => {
  const TANA = /EFFEVI|latanadelconiglio/

  it('non sta più in public/, dove finiva uguale in ogni build', () => {
    for (const f of ['privacy-policy.html', 'cookie-policy.html']) expect(existsSync(join('public', f)), f).toBe(false)
  })

  it('i modelli non nominano nessun locale', () => {
    for (const f of ['privacy-policy.html', 'cookie-policy.html']) {
      const modello = readFileSync(join('clienti', 'pagine', f), 'utf8')
      expect(modello, f).not.toMatch(/EFFEVI|latanadelconiglio|Tana del Coniglio|Nola/)
      expect(modello, f).toMatch(/%VENUE_TITOLARE%/)
      expect(modello, f).toMatch(/%VENUE_EMAIL_LINK%/)
    }
  })

  it('la build della Tana ha l’informativa della Tana', () => {
    const pagine = pagineInformativa(leggiCliente('tana'))
    const privacy = pagine.get('privacy-policy.html')
    expect(privacy).toContain('<strong>EFFEVI - SRLS</strong> («La Tana del Coniglio»), con sede legale in Corso Tommaso Vitale 87/89')
    expect(privacy).toContain('<a href="mailto:info@latanadelconiglio.it">info@latanadelconiglio.it</a>')
    for (const [f, testo] of pagine) expect(testo, f).not.toMatch(/%VENUE_/)
  })

  it('la demo ha la sua: nessun dato raccolto, niente della Tana', () => {
    const pagine = pagineInformativa(leggiCliente('demo'))
    expect(pagine.get('privacy-policy.html')).toContain('Nessun dato raccolto')
    for (const [f, testo] of pagine) {
      expect(testo, f).not.toMatch(TANA)
      expect(testo, f).not.toMatch(/%VENUE_/)
      expect(testo, f).toContain('Bancone 21')
    }
  })

  it('un altro locale ha i suoi dati, e dove mancano lo si vede, senza inventarli', () => {
    const radice = mkdtempSync(join(tmpdir(), 'informativa-'))
    mkdirSync(join(radice, 'clienti', 'bar-mario'), { recursive: true })
    mkdirSync(join(radice, 'clienti', 'pagine'), { recursive: true })
    for (const f of ['privacy-policy.html', 'cookie-policy.html']) writeFileSync(join(radice, 'clienti', 'pagine', f), readFileSync(join('clienti', 'pagine', f), 'utf8'))
    writeFileSync(join(radice, 'clienti', 'bar-mario', 'venue.json'), JSON.stringify({ venue_name: 'Bar Mario' }))
    const privacy = pagineInformativa(leggiCliente('bar-mario', radice), radice).get('privacy-policy.html')
    expect(privacy).not.toMatch(TANA)
    expect(privacy).toContain('<strong>Bar Mario</strong>')
    for (const manca of ['ragione sociale', 'sede legale', 'P.IVA / C.F.', 'email del titolare']) expect(privacy, manca).toContain(`[${manca} — da inserire]`)
  })

  it('il testo del locale non rompe la pagina', () => {
    const pagina = informativaPerCliente('<p>%VENUE_TITOLARE%</p>', { venue_name: 'Bar <b>', venue_legal_name: 'A & "B"' })
    expect(pagina).toBe('<p><strong>A &amp; &quot;B&quot;</strong> («Bar &lt;b&gt;»), <span style="color:var(--muted)">[sede legale — da inserire]</span> <span style="color:var(--muted)">[P.IVA / C.F. — da inserire]</span></p>')
  })
})
