'use strict'

// IL CSS DEVE CHIUDERE QUELLO CHE APRE.
//
// Una graffa mancante non fa fallire né il lint né la build: il browser
// legge tutto quello che viene dopo come se stesse DENTRO l'ultima regola
// aperta, e semplicemente lo ignora. È successo sciogliendo un conflitto —
// `.bar-nav-sottovoce` è rimasta senza `}` e da lì in poi trecento righe,
// compreso il menu agganciato alla pagina, non hanno più avuto effetto: il
// menu smetteva di aprirsi e nessuno strumento diceva niente.

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const CARTELLA = join(process.cwd(), 'src')
const fogli = readdirSync(CARTELLA).filter((f) => f.endsWith('.css'))

// Le graffe dentro commenti o stringhe falserebbero il conto: via prima.
function nudo(testo) {
  return testo
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
}

describe('i fogli di stile sono ben formati', () => {
  it('ce n’è almeno uno da controllare', () => {
    expect(fogli.length).toBeGreaterThan(0)
  })

  for (const foglio of fogli) {
    const testo = () => nudo(readFileSync(join(CARTELLA, foglio), 'utf8'))

    it(foglio + ': ogni blocco aperto viene chiuso', () => {
      const t = testo()
      const aperte = (t.match(/\{/g) || []).length
      const chiuse = (t.match(/\}/g) || []).length
      expect(aperte - chiuse).toBe(0)
    })

    it(foglio + ': nessuna regola resta appesa dentro un’altra', () => {
      // Un selettore che parte a colonna zero mentre siamo ancora dentro un
      // blocco: quasi sempre è la graffa mancante della regola precedente.
      // Dentro una media query le regole sono rientrate, quindi non scatta.
      const righe = testo().split('\n')
      let livello = 0
      const appese = []
      for (let i = 0; i < righe.length; i++) {
        const riga = righe[i]
        const prima = livello
        livello += (riga.match(/\{/g) || []).length - (riga.match(/\}/g) || []).length
        if (prima > 0 && /^[.#a-zA-Z@]/.test(riga)) {
          appese.push(i + 1 + ': ' + riga.slice(0, 50))
        }
      }
      expect(appese).toEqual([])
    })
  }
})

// ── IL TEMA DEVE ARRIVARE DAPPERTUTTO ────────────────────────────────
//
// L'oro di casa era scritto a mano in una dozzina di posti — il tab
// acceso, il «+», i tasti dei pannelli — e cambiando tema quelli
// restavano dorati: si sceglieva Pico e metà schermata non se ne
// accorgeva. Il colore dell'azione è UNO, e sta nei token.
describe('i colori dell’azione vengono dal tema, non dal foglio', () => {
  const CABLATI = ['#f7c45e', '#e8a32e', '#1c1305']

  for (const foglio of fogli) {
    it(foglio + ': l’oro compare solo dove si dichiarano i token', () => {
      const righe = readFileSync(join(CARTELLA, foglio), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .split(String.fromCharCode(10))
      const colpevoli = righe.filter(
        (r) => CABLATI.some((c) => r.toLowerCase().includes(c)) && !/^\s*--/.test(r)
      )
      expect(colpevoli).toEqual([])
    })
  }
})
