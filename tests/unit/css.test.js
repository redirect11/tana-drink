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

// ── LE VISTE LARGHE NON SONO UNA COLONNA SOLA ────────────────────────
// Il flusso di cassa era una striscia verticale: giusta sul telefono, da
// scorrere all'infinito su un monitor mentre si conta la cassa.
describe('il flusso di cassa si dispone in griglia sugli schermi larghi', () => {
  const foglio = () => readFileSync(join(CARTELLA, 'index.css'), 'utf8')

  it('a schermo stretto resta una colonna, e la griglia scatta dopo', () => {
    const css = foglio()
    const i = css.indexOf('.cassa-flusso')
    expect(i).toBeGreaterThan(-1)
    // La griglia vive dentro una media query: senza, il telefono si
    // ritroverebbe due colonne da 160px.
    const dopo = css.slice(i)
    expect(dopo).toMatch(/@media \(min-width: 760px\)[\s\S]{0,400}grid-template-columns/)
  })

  it('l’andamento e la chiusura restano larghi tutta la riga', () => {
    expect(foglio()).toMatch(/\.cassa-larga[\s\S]{0,200}grid-column: 1 \/ -1/)
  })
})

// ── SUL TELEFONO LE CORSIE SI IMPILANO ───────────────────────────────
//
// Cinque o sei colonne su uno schermo di telefono non ci stanno: ognuna
// diventa una striscia dove non entra nemmeno il nome di un drink. E a
// dire quando c'è spazio dev'essere la LARGHEZZA VERA DELLA LAVAGNA, non
// la finestra: col menu agganciato alla pagina la lavagna ha 200-250px in
// meno di quello che dice la finestra. Contare gli elementi al posto dello
// spazio ha già spaccato il disegno una volta (BUG-021).
describe('le corsie della coda si impilano quando lo spazio manca', () => {
  const foglio = () => readFileSync(join(CARTELLA, 'index.css'), 'utf8')

  it('di suo sono una colonna sola: la pila è il caso normale, non l’eccezione', () => {
    const css = foglio()
    const i = css.indexOf('.corsie {')
    expect(i).toBeGreaterThan(-1)
    expect(css.slice(i, i + 300)).toMatch(/grid-template-columns:\s*minmax\(0, 1fr\)/)
  })

  it('la lavagna è il contenitore su cui si misura', () => {
    // TUTTE E DUE le lavagne, non solo le corsie: anche la griglia ha i
    // filtri sulla riga dei conteggi, e con la sola `.corsie-board` quella
    // @container non trovava nessun contenitore — la regola non si
    // applicava mai e sul telefono i filtri restavano schiacciati a destra.
    expect(foglio()).toMatch(/\.queue-board \{[\s\S]{0,120}container:\s*corsie \/ inline-size/)
    expect(foglio()).not.toMatch(/\.queue-board\.corsie-board \{[\s\S]{0,120}container:\s*corsie/)
  })

  it('le soglie sono @container, non @media sulla finestra', () => {
    const css = foglio()
    expect(css).toMatch(/@container corsie \(min-width: 560px\)[\s\S]{0,200}grid-template-columns/)
    expect(css).toMatch(/@container corsie \(min-width: 900px\)[\s\S]{0,200}grid-template-columns/)
    // E la media query sulla finestra non decide più quante colonne fare:
    // lì resta solo l'altezza della lavagna, che è un'altra domanda.
    const media = css.slice(css.indexOf('@media (min-width: 901px)'))
    expect(media.slice(0, 400)).not.toMatch(/grid-template-columns/)
  })
})

// ── UN CONTENITORE CHE SCORRE TAGLIA LE OMBRE ────────────────────────
//
// Le corsie della lavagna scorrono ognuna per conto suo (overflow-y: auto).
// Ma un contenitore che scorre taglia tutto quello che esce dai suoi bordi,
// e l'ombra della card esce: senza spazio attorno, le card risultavano
// mozzate a destra e in basso, e nelle colonne strette sembravano
// addirittura piatte — come se l'ombra non ci fosse mai stata.
//
// Lo spazio va DENTRO il contenitore che scorre, quindi è un `padding`
// della lista, non un margine delle card: un margine sarebbe finito fuori
// dal riquadro di scorrimento e sarebbe stato tagliato come l'ombra.
describe('le ombre delle card hanno spazio per esistere', () => {
  const css = readFileSync(join(CARTELLA, 'index.css'), 'utf8')
  const regola = (nome) => {
    const i = css.indexOf(`
${nome} {`)
    expect(i, `${nome} non c'è più`).toBeGreaterThan(-1)
    return css.slice(i, css.indexOf('}', i))
  }

  it('la lista di una corsia lascia spazio sotto e ai lati', () => {
    const r = regola('.corsia-lista')
    // Non basta che un padding ESISTA: il primo giro ne aveva messo uno
    // da 6px e l'ombra usciva tagliata lo stesso. La misura viene
    // dall'ombra (0 4px 18px): almeno la sfocatura ai lati, sfocatura più
    // scostamento in basso.
    const m = r.match(/padding:\s*\d+px (\d+)px (\d+)px/)
    expect(m, 'la lista scorre e taglierebbe l’ombra: serve un padding').toBeTruthy()
    expect(Number(m[1]), 'ai lati ci sta la sfocatura intera (18px)').toBeGreaterThanOrEqual(16)
    expect(Number(m[2]), 'sotto ci stanno sfocatura più scostamento (22px)').toBeGreaterThanOrEqual(22)
  })

  it('e non fa comparire una barra orizzontale per quei pochi pixel', () => {
    // `overflow-y: auto` rende l'asse X `auto` a sua volta: senza dirlo
    // esplicitamente, lo spazio dell'ombra diventa una barra di
    // scorrimento orizzontale in fondo a ogni colonna.
    expect(regola('.corsia-lista')).toMatch(/overflow-x:\s*clip/)
  })
})

// ── I COLORI STRUTTURALI STANNO NEI GETTONI, NON IN BIANCHI FISSI ────
//
// Un bianco trasparente scritto a mano (rgba(255,255,255,…)) nasce per il
// fondo scuro e sul tema chiaro sparisce: è successo alla striscia degli
// stati spenti, poi ai tasti delle impostazioni e ai filtri — «hai
// aggiunto il bordo solo sul tema scuro» (l'utente, 20/08). I gettoni
// --line e --tile-bg hanno già la variante chiara (data-luma): bordo e
// fondo di un controllo si scrivono con quelli.
// Qui si sorvegliano i due controlli già corretti, non tutto il foglio:
// i bianchi fissi rimasti altrove si bonificano quando si tocca la loro
// schermata, non a tappeto.
describe('i controlli delle impostazioni seguono il tema', () => {
  const css = readFileSync(join(CARTELLA, 'index.css'), 'utf8')
  const regola = (nome) => {
    const i = css.indexOf(`
${nome} {`)
    expect(i, `${nome} non c'è più`).toBeGreaterThan(-1)
    return css.slice(i, css.indexOf('}', i))
  }

  it.each(['.mode-option', '.chip'])('%s non usa bianchi fissi per bordo e fondo', (sel) => {
    const r = regola(sel)
    expect(r, `${sel}: bordo/fondo vanno sui gettoni --line/--tile-bg`).not.toMatch(
      /rgba\(255,\s*255,\s*255/
    )
    expect(r).toMatch(/var\(--line\)/)
    expect(r).toMatch(/var\(--tile-bg\)/)
  })
})

// ── LA COLONNA DEL «CHIUDI CASSA» NON STIRA IL SUO TASTO (BUG-062) ───
//
// Il tasto sta incolonnato con la riga che spiega perché non si può
// chiudere — «Chiudi 3 conti e 2 comande» — e in una colonna con
// `align-items: stretch` la larghezza la fa il figlio più largo: il
// bottone veniva lungo quanto la frase, il doppio del suo nome, in una
// testata dove lo spazio è della barra di ricerca.
//
// La prima cura era stata togliere la frase, e ha tolto anche la sola cosa
// che diceva perché il tasto è grigio: «è scomparsa la label sotto al
// tasto» (l'utente, 20/08). La frase è tornata, e a tenere stretto il
// bottone adesso c'è l'allineamento. Questo test sorveglia quello, che il
// DOM da solo non lo può dire: jsdom non fa layout.
describe('il tasto della cassa resta largo quanto il suo nome', () => {
  const css = readFileSync(join(CARTELLA, 'index.css'), 'utf8')
  const regola = (nome) => {
    const i = css.indexOf(`
${nome} {`)
    expect(i, `${nome} non c'è più`).toBeGreaterThan(-1)
    return css.slice(i, css.indexOf('}', i))
  }

  it('la colonna centra i figli invece di stirarli', () => {
    const r = regola('.board-cassa-box')
    expect(r).toMatch(/align-items:\s*center/)
    expect(r, 'con stretch il bottone torna largo quanto la frase').not.toMatch(
      /align-items:\s*stretch/
    )
  })

  it('e la frase resta una riga sola, o alzerebbe tutta la testata', () => {
    expect(regola('.board-cassa-perche')).toMatch(/white-space:\s*nowrap/)
  })
})

// ── I DUE TASTINI DELLA FILA DEI FILTRI NON SCORRONO VIA ─────────────
//
// I DUE TASTINI NON STANNO PIÙ DENTRO LA FILA DEI CHIP. Ci stavano, e la
// fila doveva quindi esistere sempre — anche a filtri chiusi, per
// contenerli. «Il tasto dei filtri deve essere sulla destra insieme a
// quello dell'ordinamento non a sinistra dei filtri. […] i filtri devono
// uscire sotto» (l'utente, 20/08/2026): adesso si appoggiano a una riga che
// c'è comunque (i conteggi, la ricerca) e la fila dei chip esiste solo da
// aperta. `.chips-tastini` e il suo `sticky` non servono più: non c'è più
// una riga che scorre da cui restare fuori.
//
// Il DOM da solo non lo può dire: jsdom non fa layout. Si sorveglia il
// foglio.
describe('i due tastini che governano la vista', () => {
  const css = readFileSync(join(CARTELLA, 'index.css'), 'utf8')
  const regola = (nome) => {
    const i = css.indexOf(`
${nome} {`)
    expect(i, `${nome} non c'è più`).toBeGreaterThan(-1)
    return css.slice(i, css.indexOf('}', i))
  }

  it('stanno in fondo a destra della riga che li ospita', () => {
    const r = regola('.coda-tastini')
    expect(r).toMatch(/margin-left:\s*auto/)
    // La riga dei conteggi allinea alla BASE del testo: un tastino
    // allineato alla base pende.
    expect(r).toMatch(/align-self:\s*center/)
    // e non si stringono per far posto al testo dei conteggi
    expect(r).toMatch(/flex-shrink:\s*0/)
  })

  // ERANO SENZA RIQUADRO PER UN GIRO, e l'utente li ha rimandati indietro a
  // metà strada: «Ok, così com'è filtri, aggiungi un bordo e rendilo un
  // bottone ma lascia la freccetta e la scritta filtri. Il tasto non farlo
  // troppo alto come gli altri, stessa cosa per la freccetta
  // dell'ordinamento. Stessa dimensione dei filtri» (20/08/2026). Senza
  // riquadro non si vedeva che erano tasti; a 44px, in una riga di testo,
  // erano uno scalino.
  it('sono bottoni col riquadro, ma bassi — non i 44px degli altri', () => {
    const r = regola('.coda-tastino')
    expect(r).toMatch(/border:\s*1px solid var\(--line\)/)
    expect(r).toMatch(/background:\s*var\(--tile-bg\)/)
    expect(r).toMatch(/border-radius:\s*var\(--raggio-pill\)/)
    // L'altezza è quella dei chip della fila: sono la stessa specie di
    // comando e in riga si devono somigliare.
    expect(r).toMatch(/min-height:\s*var\(--tastino-alto\)/)
    expect(css).toMatch(/--tastino-alto:\s*34px/)
  })

  it('e sono gemelli: il verso della coda è quadrato, alto come i filtri', () => {
    // «Stessa dimensione dei filtri»: stessa altezza, e siccome è una
    // freccia sola il riquadro si fa quadrato invece che una pastiglia
    // lunga piena d'aria.
    const r = regola('.coda-tastino.solo-icona')
    expect(r).toMatch(/min-width:\s*var\(--tastino-alto\)/)
  })

  it('non alzano la riga dei conteggi: sporgono, non la spingono', () => {
    // Sono più alti del testo dei conteggi. Su una lavagna guardata da
    // lontano ogni pixel di testata è una comanda in meno sotto: i margini
    // negativi tolgono dall'altezza di riga quello che sporge, e i tasti
    // escono dentro il `gap` della testata, che c'è comunque.
    expect(regola('.coda-tastini')).toMatch(/margin-block:\s*-\d/)
  })

  it('la fila dei chip va a capo invece di scorrere, o taglierebbe la tendina', () => {
    // `.chips-row` scorre in orizzontale, e dentro un contenitore che
    // scorre un pannello in `position: absolute` viene TAGLIATO: la
    // tendina degli autori si aprirebbe dentro una riga alta 40px.
    const r = regola('.chips-filtri')
    expect(r).toMatch(/flex-wrap:\s*wrap/)
    expect(r).toMatch(/overflow:\s*visible/)
  })

  // «E i tasti dei filtri, tutti, devono essere leggermente più piccoli»
  // (l'utente, 20/08/2026). Deroga circoscritta ai 44px di
  // docs/navigazione.md: vale SOLO dentro la fila dei filtri, che si tocca
  // quando si decide cosa guardare — non con l'ordine in mano.
  it('e i chip della fila sono leggermente più piccoli degli altri', () => {
    const filtri = regola('.chips-filtri .chip')
    expect(filtri).toMatch(/min-height:\s*var\(--tastino-alto\)/)
    // «Leggermente», non minuscoli: si resta sopra i 30px e sotto la
    // misura piena del chip, che è 40.
    const pieno = regola('.chip')
    expect(pieno).toMatch(/min-height:\s*40px/)
    const corpo = Number(/font-size:\s*([\d.]+)rem/.exec(filtri)[1])
    expect(corpo).toBeLessThan(0.95)
    expect(corpo).toBeGreaterThan(0.8)
  })

  // LA SECONDA RIGA NON ESISTE PIÙ. La scelta delle colonne aveva una fila
  // sua sotto quella dei filtri — chip che aprivano chip — e l'utente l'ha
  // bocciata: «quei filtri devono apparire sulla stessa riga degli altri
  // tasti» (20/08/2026). Adesso quei tasti si accodano ai fratelli e non
  // hanno più bisogno di una classe loro.
  it('la scelta delle colonne non ha più una riga sua', () => {
    expect(css).not.toMatch(/\n\.corsie-scelta \{/)
  })
})
