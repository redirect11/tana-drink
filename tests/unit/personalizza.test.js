'use strict'

// IL SITO UGUALE PER TUTTI DIVENTA IL SITO DI UN LOCALE (REQ-FLOTTA-034,
// REQ-SIC-017). La regia lancia scripts/personalizza.mjs su una copia del
// dist/ compilato una volta per versione, con la configurazione del locale.
//
// Le prove girano su un dist/ di prova coi file veri dove contano: i
// modelli dell'informativa e il manifest sono quelli del repository, così un
// segnaposto nuovo nei modelli che lo script non sa riempire si vede qui.

import { describe, it, expect, beforeEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { personalizza, preparaPersonalizzazione, leggiArgomenti, ErrorePersonalizzazione, bloccoUguale } from '../../scripts/personalizza.mjs'
import { conConfigurazione, FILE_DEL_SET } from '../../clienti/personalizzazione.mjs'
import { configurazioneDellaPagina } from '../../src/porte/configurazione.js'

const CONFIG = {
  backend: 'firebase',
  locale: 'bar-mario',
  firebase: { apiKey: 'chiave-mario', authDomain: 'mario-drink.firebaseapp.com', projectId: 'mario-drink', appId: '1:2:web:3' },
  venue: {
    venue_name: 'Bar Mario',
    venue_legal_name: 'Mario S.r.l.',
    venue_address: 'Via Roma 1',
    venue_postal_city: '80100 Napoli',
    venue_vat_number: '01234567890',
    venue_email: 'privacy@barmario.it',
    venue_theme_color: '#2a6f97',
  },
  profilo: 'completo',
  regia: 'drink-regia-test',
}

// Il dist/ come lo lascia `PACCHETTO=1 npm run build`: index.html coi
// segnaposto, il manifest come modello, l'informativa coi segnaposto, il
// set neutro.
function distDiProva() {
  const radice = mkdtempSync(join(tmpdir(), 'personalizza-'))
  const dist = join(radice, 'dist')
  mkdirSync(dist)
  writeFileSync(join(dist, 'index.html'), readFileSync('index.html', 'utf8'))
  writeFileSync(join(dist, 'manifest.webmanifest'), readFileSync('clienti/manifest.template.json', 'utf8'))
  for (const f of ['privacy-policy.html', 'cookie-policy.html']) writeFileSync(join(dist, f), readFileSync(join('clienti', 'pagine', f), 'utf8'))
  for (const f of FILE_DEL_SET) writeFileSync(join(dist, f), `neutro ${f}`)
  const configurazione = join(radice, 'locale.json')
  writeFileSync(configurazione, JSON.stringify(CONFIG))
  return { radice, dist, configurazione }
}

const leggi = (dist, f) => readFileSync(join(dist, f), 'utf8')
const fotografia = (dist) => Object.fromEntries(readdirSync(dist).map((f) => [f, leggi(dist, f)]))

let p
beforeEach(() => {
  p = distDiProva()
})

describe('un locale nel sito uguale per tutti', () => {
  it('riempie index.html, il manifest e l’informativa, e non lascia segnaposti', () => {
    personalizza({ dist: p.dist, configurazione: p.configurazione })
    const html = leggi(p.dist, 'index.html')
    expect(html).toContain('<title>Bar Mario</title>')
    expect(html).toContain('<meta name="theme-color" content="#2a6f97" />')
    const manifest = JSON.parse(leggi(p.dist, 'manifest.webmanifest'))
    expect(manifest).toMatchObject({ name: 'Bar Mario', short_name: 'Bar Mario', theme_color: '#2a6f97' })
    for (const f of ['index.html', 'manifest.webmanifest', 'privacy-policy.html', 'cookie-policy.html']) expect(leggi(p.dist, f), f).not.toMatch(/%VENUE_/)
  })

  it('l’informativa è del locale: il suo titolare, la sua email, niente della Tana', () => {
    personalizza({ dist: p.dist, configurazione: p.configurazione })
    const privacy = leggi(p.dist, 'privacy-policy.html')
    expect(privacy).toContain('<strong>Mario S.r.l.</strong> («Bar Mario»), con sede legale in Via Roma 1, 80100 Napoli (P.IVA 01234567890)')
    expect(privacy).toContain('<a href="mailto:privacy@barmario.it">privacy@barmario.it</a>')
    for (const f of ['privacy-policy.html', 'cookie-policy.html']) expect(leggi(p.dist, f), f).not.toMatch(/EFFEVI|latanadelconiglio|Tana del Coniglio|Nola/)
  })

  it('la configurazione sta nel file e, uguale, nel blocco della pagina che l’app legge', () => {
    personalizza({ dist: p.dist, configurazione: p.configurazione })
    expect(JSON.parse(leggi(p.dist, 'configurazione.json'))).toEqual(CONFIG)
    const doc = new DOMParserFinto(leggi(p.dist, 'index.html'))
    const letta = configurazioneDellaPagina(doc)
    expect(letta).toMatchObject({ origine: 'pagina', locale: 'bar-mario', firebase: { projectId: 'mario-drink' } })
    expect(letta.venue.venue_name).toBe('Bar Mario')
  })

  it('i file del locale vanno sopra quelli neutri, e solo quelli', () => {
    const suoi = join(p.radice, 'suoi')
    mkdirSync(suoi)
    writeFileSync(join(suoi, 'logo.png'), 'logo di Mario')
    const esito = personalizza({ dist: p.dist, configurazione: p.configurazione, pubblica: suoi })
    expect(esito.copiati).toEqual(['logo.png'])
    expect(leggi(p.dist, 'logo.png')).toBe('logo di Mario')
    expect(leggi(p.dist, 'favicon.svg')).toBe('neutro favicon.svg')
  })
})

describe('quello che rifiuta, senza scrivere niente', () => {
  const rifiuta = (opzioni, atteso) => {
    const prima = fotografia(p.dist)
    let errore = null
    try {
      personalizza(opzioni)
    } catch (e) {
      errore = e
    }
    expect(errore).toBeInstanceOf(ErrorePersonalizzazione)
    expect(errore.problemi.join('\n')).toMatch(atteso)
    expect(fotografia(p.dist)).toEqual(prima)
  }

  it('un dist/ già personalizzato: il secondo locale uscirebbe col nome del primo', () => {
    personalizza({ dist: p.dist, configurazione: p.configurazione })
    rifiuta({ dist: p.dist, configurazione: p.configurazione }, /già personalizzato/)
  })

  it('una configurazione che l’app non seguirebbe', () => {
    writeFileSync(p.configurazione, JSON.stringify({ ...CONFIG, regia: 'regia-qualunque', firebase: { apiKey: 'k' } }))
    rifiuta({ dist: p.dist, configurazione: p.configurazione }, /firebase\.projectId manca[\s\S]*regia "regia-qualunque" non prevista/)
  })

  it('una configurazione illeggibile', () => {
    writeFileSync(p.configurazione, '{rotto')
    rifiuta({ dist: p.dist, configurazione: p.configurazione }, /configurazione illeggibile/)
  })

  it('un file del locale che il pacchetto non conosce: il controllo della regia lo boccerebbe', () => {
    const suoi = join(p.radice, 'suoi')
    mkdirSync(suoi)
    writeFileSync(join(suoi, 'script.js'), 'alert(1)')
    rifiuta({ dist: p.dist, configurazione: p.configurazione, pubblica: suoi }, /script\.js non è un file del locale/)
  })

  it('una cartella che non è il dist/ del sito', () => {
    expect(() => personalizza({ dist: p.radice, configurazione: p.configurazione })).toThrow(/non ha index\.html/)
  })

  it('un segnaposto che nessuno sa riempire', () => {
    writeFileSync(join(p.dist, 'cookie-policy.html'), '<p>%VENUE_NUOVO_CAMPO%</p>')
    rifiuta({ dist: p.dist, configurazione: p.configurazione }, /cookie-policy\.html: resta %VENUE_NUOVO_CAMPO%/)
    expect(existsSync(join(p.dist, 'configurazione.json'))).toBe(false)
  })
})

describe('il blocco nella pagina', () => {
  it('un nome con </script> non chiude il blocco', () => {
    const html = conConfigurazione('<head></head>', { venue: { venue_name: 'Bar </script><script>alert(1)</script>' } })
    expect(html.match(/<\/script>/g)).toHaveLength(1)
    const dentro = html.match(/<script id="configurazione" type="application\/json">(.*)<\/script>/)[1]
    expect(JSON.parse(dentro).venue.venue_name).toBe('Bar </script><script>alert(1)</script>')
  })

  // Un sostituto scritto come testo, in `replace`, legge `$'` come «il resto
  // della pagina»: un locale con «$'» nella descrizione rompeva il blocco
  // (JSON non valido, tablet senza locale) senza che nessuno se ne
  // accorgesse.
  it('i «$» scritti dal locale restano «$»: niente pezzi di pagina copiati dentro', () => {
    const venue = { ...CONFIG.venue, venue_name: "Bar $' $& $$", venue_about: "Spritz a 5$' e $` tutto", venue_legal_name: "Mario $'" }
    writeFileSync(p.configurazione, JSON.stringify({ ...CONFIG, venue }))
    personalizza({ dist: p.dist, configurazione: p.configurazione })
    const html = leggi(p.dist, 'index.html')
    expect(html).toContain("<title>Bar $' $&amp; $$</title>")
    const letta = configurazioneDellaPagina(new DOMParserFinto(html))
    expect(letta.venue.venue_about).toBe("Spritz a 5$' e $` tutto")
    expect(leggi(p.dist, 'privacy-policy.html')).toContain("<strong>Mario $'</strong>")
  })

  it('un blocco che non si rilegge uguale ferma la personalizzazione', () => {
    expect(bloccoUguale(conConfigurazione('<head></head>', CONFIG), CONFIG)).toBe(true)
    expect(bloccoUguale('<head><script id="configurazione" type="application/json">{"rotto"</script></head>', CONFIG)).toBe(false)
    expect(bloccoUguale('<head></head>', CONFIG)).toBe(false)
  })

  it('una pagina che ha già il blocco non ne prende un secondo', () => {
    const una = conConfigurazione('<head></head>', {})
    expect(() => conConfigurazione(una, {})).toThrow(/già il blocco/)
  })
})

describe('gli argomenti', () => {
  it('nelle due forme, con e senza «=»', () => {
    expect(leggiArgomenti(['--dist', 'd', '--configurazione=c.json', '--pubblica', 'p'])).toEqual({ dist: 'd', configurazione: 'c.json', pubblica: 'p' })
  })

  it('senza dist o configurazione, o con un argomento sconosciuto, si ferma', () => {
    expect(() => leggiArgomenti(['--dist', 'd'])).toThrow(/servono --dist/)
    expect(() => leggiArgomenti(['--dist', 'd', '--configurazione', 'c', '--forza'])).toThrow(/sconosciuto/)
    expect(() => leggiArgomenti(['--dist', '--configurazione', 'c'])).toThrow(/vuole una cartella/)
  })

  it('prepara senza scrivere', () => {
    const prima = fotografia(p.dist)
    const { scritti } = preparaPersonalizzazione({ dist: p.dist, configurazione: p.configurazione })
    expect([...scritti.keys()]).toContain('configurazione.json')
    expect(fotografia(p.dist)).toEqual(prima)
  })
})

// Il minimo di documento che configurazioneDellaPagina usa: getElementById
// sul blocco. Nell'ambiente node dei test non c'è un DOM, e il blocco si
// riconosce dal suo id.
function DOMParserFinto(html) {
  const m = html.match(/<script id="([^"]+)" type="application\/json">([\s\S]*?)<\/script>/)
  this.getElementById = (id) => (m && m[1] === id ? { textContent: m[2] } : null)
}
