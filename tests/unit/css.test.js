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
    //
    // ED È UN CONTO, NON UN NUMERO BATTUTO A MANO. Era un `-5px` — il
    // risultato della sottrazione copiato nel foglio — e ritoccando
    // `--tastino-alto` i tasti tornavano ad alzare la riga senza che da
    // quel numero si capisse perché. Adesso l'altezza del tastino è
    // l'unico numero e la compensazione lo segue.
    const r = regola('.board-sotto .coda-tastini')
    expect(r).toMatch(/margin-block:\s*calc\(\(1lh - var\(--tastino-alto\)\) \/ 2\)/)
    // `1lh` si legge dall'altezza di riga di QUESTA regola: lasciata a
    // `normal` dipenderebbe dal font di ogni browser.
    expect(r).toMatch(/line-height:\s*[\d.]+/)
    // E SOLO LÌ: la stessa classe sta anche in riga col campo di ricerca
    // (lista e schede), che è alto quanto i tastini — lì non c'è niente da
    // compensare.
    expect(regola('.coda-tastini')).not.toMatch(/margin-block/)
  })

  it('la fila dei chip va a capo invece di scorrere, o taglierebbe la tendina', () => {
    // Dentro un contenitore che scorre in orizzontale un pannello in
    // `position: absolute` viene TAGLIATO: la tendina dello staff si
    // aprirebbe dentro una riga alta 40px.
    //
    // E LA FILA DICHIARA IL SUO. Indossava `.chips-row` — che scorre e non
    // va a capo — per poi disdirne metà: `overflow: visible` e
    // `flex-wrap: wrap` erano lì solo per annullare quello che la classe
    // di sopra aveva appena messo. Nel JSX adesso c'è `chips-filtri` da
    // sola, e quello che le serve si legge tutto in una regola.
    const r = regola('.chips-filtri')
    expect(r).toMatch(/display:\s*flex/)
    expect(r).toMatch(/flex-wrap:\s*wrap/)
    expect(r).toMatch(/gap:\s*6px/)
    expect(r).not.toMatch(/overflow/)
    expect(css).not.toMatch(/chips-row chips-filtri/)
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

  // ── IL PRONTO E IL SUO TASTINO SI TOCCANO ────────────────────
  //
  // «Dividi il pronto dobbiamo integrarlo meglio con gli altri due
  // bottoni, in qualche modo non si capisce a che serve» (l'utente,
  // 20/08/2026). In quella fila ogni chip è uguale all'altro e fa la
  // stessa cosa: il taglio del pronto, vestito uguale e messo in fondo,
  // era indistinguibile. Attaccati e col bordo condiviso si legge «questi
  // sono una cosa sola» — e a dirlo dev'essere il DISEGNO, non una frase.
  it('i chip di un gruppo si toccano, con gli angoli tondi solo agli estremi', () => {
    const r = regola('.chip-gruppo')
    expect(r).toMatch(/display:\s*inline-flex/)
    // Niente gap: fra i due c'è la cucitura, non uno spazio.
    expect(r).not.toMatch(/gap:/)
    // Il -1px è la cucitura: senza, i bordi si sommano e la giuntura è
    // spessa il doppio del resto.
    expect(regola('.chip-gruppo > .chip + .chip')).toMatch(/margin-left:\s*-1px/)
    expect(regola('.chip-gruppo > .chip')).toMatch(/border-radius:\s*0/)
    expect(regola('.chip-gruppo > .chip:first-child')).toMatch(/var\(--raggio-pill\)/)
    expect(regola('.chip-gruppo > .chip:last-child')).toMatch(/var\(--raggio-pill\)/)
  })

  it('il tastino del gruppo sta stretto: è un segno solo, non una parola', () => {
    // Attorno a un carattere una pastiglia larga come le altre è tutta
    // aria, e in una fila di sei o sette chip quell'aria è una riga in più.
    const laterale = (r) => Number(/padding:\s*[\d.]+px\s+([\d.]+)px/.exec(r)[1])
    expect(laterale(regola('.chips-filtri .chip-taglio'))).toBeLessThan(
      laterale(regola('.chips-filtri .chip'))
    )
    // E UNA REGOLA SOLA: c'era anche un `.chip-taglio` nudo che non ha mai
    // colorato un pixel — il tastino esiste solo dentro la fila, e lì
    // questa lo sovrascriveva per intero. Due regole di cui una morta
    // fanno ritoccare il valore sbagliato.
    expect(css).not.toMatch(/\n\.chip-taglio \{/)
  })
})


// ── I TASTI DI UNA CARD STRETTA SI IMPILANO (BUG-063) ────────────────
//
// «Quando sono attive tutte le lane il layout delle card si sballa. Nel
// caso siano troppo strette per i tasti, li impiliamo verticalmente» — e,
// col secondo screenshot: «anche con 4 corsie succede. Ovviamente dobbiamo
// farlo in modo che sia dinamico» (l'utente, 20/08/2026).
//
// I tasti sono TRE: «🧾 Conto», «⋯ Azioni» e quello che porta avanti il
// lavoro. In fila vogliono quasi 280px; in una colonna su sette ce ne sono
// 120, e si schiacciavano fino a tagliare le parole.
//
// jsdom non fa layout: la regola si sorveglia sul foglio, che è l'unico
// posto dove esiste.
describe('i tasti di una card di corsia si impilano quando manca la larghezza', () => {
  const css = readFileSync(join(CARTELLA, 'index.css'), 'utf8')
  const regola = (nome) => {
    const i = css.indexOf(`
${nome} {`)
    expect(i, `${nome} non c'è più`).toBeGreaterThan(-1)
    return css.slice(i, css.indexOf('}', i))
  }

  it('a misurare è la CARD, non la finestra e non il numero di colonne', () => {
    // La stessa card è stretta con sette corsie e larga con tre, sullo
    // stesso schermo: contare le colonne sarebbe l'errore di BUG-021, e
    // una media query sulla finestra mente di 250px col menu agganciato.
    expect(regola('.corsia-card')).toMatch(/container:\s*card-corsia \/ inline-size/)
    const impila = css.slice(css.indexOf('@container card-corsia (max-width: 300px)'))
    expect(impila.length).toBeGreaterThan(0)
    // e non c'è nessuna @media sulla finestra a decidere il piede
    expect(css).not.toMatch(/@media[^{]*\{[\s\S]{0,200}\.corsia-piede/)
  })

  it('il piede può andare a capo: è la premessa di tutto il resto', () => {
    expect(regola('.corsia-piede')).toMatch(/flex-wrap:\s*wrap/)
  })

  it('primo passo: il tasto grande scende sotto, a tutta larghezza', () => {
    // È il gesto più frequente della serata — si preme di corsa e al buio
    // — e quando lo spazio manca CRESCE invece di stringersi.
    const blocco = css.slice(
      css.indexOf('@container card-corsia (max-width: 300px)'),
      css.indexOf('@container card-corsia (max-width: 200px)')
    )
    expect(blocco).toMatch(/\.corsia-azione\s*\{[^}]*flex:\s*1 0 100%/)
    // e i due piccoli si spartiscono la riga di sopra invece di restare
    // affiancati e mezzi vuoti
    expect(blocco).toMatch(/\.corsia-azioni\s*\{[^}]*flex:\s*1 1 0/)
  })

  it('secondo passo: sotto i 200px vanno in colonna tutti e tre', () => {
    const i = css.indexOf('@container card-corsia (max-width: 200px)')
    const blocco = css.slice(i, i + 400)
    expect(blocco).toMatch(/\.corsia-piede\s*\{[^}]*flex-direction:\s*column/)
    expect(blocco).toMatch(/width:\s*100%/)
  })

  it('e il tempo non va a capo una lettera per riga', () => {
    // «5 min» si spezzava in verticale accanto al numero del conto: è
    // testo corto e va tenuto intero, a cedere è il nome del tavolo.
    expect(regola('.corsia-quando')).toMatch(/white-space:\s*nowrap/)
    expect(regola('.corsia-card > .row.between')).toMatch(/flex-wrap:\s*wrap/)
  })
})

// ── L'ORDINE DELLE REGOLE È LA REGOLA (BUG-064, REQ-UI-020) ──────────
//
// Sulla striscia da 4px a sinistra della card scrivono cinque famiglie di
// regole, tutte con lo stesso peso (`.order-card.qualcosa`): a parità di
// specificità decide chi sta più in basso nel foglio. Non è un dettaglio
// di stile, è la gerarchia dei significati — e scritta così è invisibile a
// chi riordina il foglio in buona fede.
//
// È già successo: `pagato-da-servire` era stata messa PRIMA delle `pay-*`,
// e nella griglia — l'unica vista dove la card porta tutte e due le classi
// — l'ambra non è mai comparsa. Un conto pagato e ancora da consegnare si
// vedeva verde come uno concluso, e chi passava a ritirare non aveva
// niente che glielo dicesse. Nelle corsie funzionava, perché lì le `pay-*`
// non ci sono: il difetto è vissuto mesi in produzione.
// L'a capo si scrive così e non con la sequenza di escape: il file passa
// per strumenti che quella sequenza la rimangiano, e una regola cercata
// senza a capo davanti troverebbe il primo selettore che le somiglia.
const A_CAPO = String.fromCharCode(10)

describe('la striscia della card: chi vince, e perché sta dove sta', () => {
  const css = readFileSync(join(CARTELLA, 'index.css'), 'utf8')
  const dove = (selettore) => {
    const i = css.indexOf(A_CAPO + selettore + ' {')
    expect(i, selettore + ' non c’è più').toBeGreaterThan(-1)
    return i
  }

  it('l’ambra del pagato-da-servire viene DOPO le regole del pagamento', () => {
    const ambra = dove('.order-card.pagato-da-servire')
    for (const pay of ['pay-aperto', 'pay-parziale', 'pay-pagato', 'pay-annullato']) {
      expect(ambra, `.order-card.${pay} vincerebbe sull’ambra`).toBeGreaterThan(
        dove('.order-card.' + pay)
      )
    }
  })

  it('e le regole del pagamento vengono dopo quelle della preparazione', () => {
    // L'ordine di prima non si è rotto sistemando quello dell'ambra.
    expect(dove('.order-card.pay-aperto')).toBeGreaterThan(dove('.order-card.pronto'))
  })

  it('il colore del conto sulla striscia è l’ULTIMA parola', () => {
    // Quando la classe c'è, è una scelta esplicita di chi manda avanti il
    // locale (impostazione «bordo_colore_conto») e deve vincere ovunque —
    // comprese le regole delle corsie, che stanno molto più in basso nel
    // foglio e a parità di peso vincerebbero.
    const bordo = dove('.order-card.bordo-conto')
    for (const prima of [
      '.order-card.pay-pagato',
      '.order-card.pagato-da-servire',
      '.corsia-card.pagato-da-servire',
      '.corsia-card.acconto',
    ]) {
      expect(bordo, prima + ' vincerebbe sul colore del conto').toBeGreaterThan(dove(prima))
    }
    expect(css.slice(bordo, bordo + 200)).toMatch(/border-left-color:\s*var\(--conto-colore\)/)
  })
})

// ── IL FONDO COLORATO SI DEVE VEDERE, E IL TESTO SI DEVE LEGGERE ─────
//
// «Il colore che viene assegnato al momento è sfumato ma è molto chiaro.
// Deve essere più visibile» (l'utente, 20/08/2026). Il fondo è passato da
// 16%/5% a 32%/12%, e i due numeri non hanno lo stesso peso.
// All'angolo c'è il NUMERO del conto, in --text: al 32% il caso peggiore
// delle dodici tinte per gli otto temi di themes.js è 4,4:1, e il 32% è il
// tetto — a 38% scende a 3,9. A metà cade il testo minore, in --muted, e
// lì si paga: il peggiore passa da 4,1 a 3,5 (Pico scuro e Catppuccin
// chiaro, i due temi che partivano stretti già sul fondo nudo). Il 12% è
// la soglia; chi la alza rifà quei conti prima, tema per tema.
// QUI SI SORVEGLIANO I NUMERI, non il contrasto: il calcolo sta scritto
// nel commento della regola in index.css, e un test che rifacesse la
// misura misurerebbe la propria formula.
describe('il colore del conto sul fondo della card', () => {
  const css = readFileSync(join(CARTELLA, 'index.css'), 'utf8')
  const regola = () => {
    const i = css.indexOf(A_CAPO + '.order-card.conto-colorato {')
    expect(i, '.order-card.conto-colorato non c’è più').toBeGreaterThan(-1)
    return css.slice(i, css.indexOf(A_CAPO + '}', i))
  }

  it('si vede: la tinta all’angolo è ben oltre il velo di prima', () => {
    const percentuali = [...regola().matchAll(/var\(--conto-colore\) (\d+)%/g)].map((m) =>
      Number(m[1])
    )
    expect(percentuali.length, 'la sfumatura ha due fermate colorate').toBe(2)
    expect(percentuali[0], 'all’angolo il colore si deve riconoscere da lontano').toBeGreaterThanOrEqual(28)
    expect(percentuali[1], 'a metà card ci passa sopra il testo minore').toBeLessThanOrEqual(12)
  })

  it('il testo sta su un fondo OPACO: si mescola con --card, non con la trasparenza', () => {
    // Mescolando con `transparent` ogni fermata è mezza trasparente, e
    // quello che c'è sotto — un altro tema, una card evidenziata — se ne
    // porta via un pezzo. Mescolata con --card, la tinta è un colore pieno
    // e il contrasto misurato è quello che si vede davvero.
    const r = regola()
    expect(r).toMatch(/color-mix\(in srgb, var\(--conto-colore\) \d+%, var\(--card\)\)/)
    expect(r).not.toMatch(/var\(--conto-colore\) \d+%, transparent/)
  })

  it('e l’alone dello stato resta sopra, da sinistra', () => {
    // Due sfumature, due domande: il passo del lavoro entra da sinistra, il
    // colore del conto scende dall'angolo. Riscrivendo il `background` è la
    // prima cosa che si perde.
    expect(regola()).toMatch(/linear-gradient\(90deg, var\(--tinta-stato/)
    expect(regola()).toMatch(/linear-gradient\(\s*135deg/)
  })
})

// ── I RIQUADRI DELLE SEZIONI NON DANNO PER SCONTATO IL TEMA SCURO ─────
//
// BUG-065. Segnalato al banco: «in alcune voci del menù e impostazioni vengono
// usati ancora dei box bianchi». Erano le superfici scritte con bianchi
// trasparenti — nati per il fondo scuro, dove un velo bianco è rilievo —
// che sul tema chiaro, con --card a #ffffff, diventavano un rettangolo
// bianco su fondo chiaro col bordo invisibile. I colori strutturali
// stanno nei gettoni (--line, --tile-bg, --velo-superficie), che hanno
// già la loro variante chiara.
describe('le superfici delle sezioni seguono il tema', () => {
  const css = () => readFileSync(join(CARTELLA, 'index.css'), 'utf8')

  // Il corpo di una regola, commenti tolti: quello che il browser applica.
  function regola(nome) {
    const testo = css().replace(/\/\*[\s\S]*?\*\//g, '')
    const i = testo.indexOf(A_CAPO + nome + ' {')
    expect(i, nome + ' non esiste più nel foglio').toBeGreaterThan(-1)
    return testo.slice(i, testo.indexOf('}', i))
  }

  const SUPERFICI = ['.card', '.toggle-row', '.cat-chip', '.group-tile', '.mode-option', '.chip']

  for (const nome of SUPERFICI) {
    it(nome + ': fondo e bordo vengono dai gettoni, non da un bianco fisso', () => {
      const corpo = regola(nome)
      const bianchi = corpo
        .split('\n')
        .filter((r) => /^\s*(background|border)/.test(r) && /rgba\(\s*255,\s*255,\s*255/.test(r))
      expect(bianchi).toEqual([])
    })
  }

  it('il velo di rilievo è un gettone, e sul tema chiaro si toglie', () => {
    const testo = css()
    expect(testo).toMatch(/--velo-superficie:\s*linear-gradient/)
    // La variante chiara: senza, il velo bianco resterebbe sul bianco.
    expect(testo).toMatch(/\[data-luma='light'\][\s\S]{0,300}--velo-superficie:\s*none/)
  })
})

// ── IL NOME DELLA SEZIONE SI DEVE LEGGERE ────────────────────────────
//
// Era `0.75rem` in maiuscoletto grigio: dodici pixel, e dentro un
// riquadro pieno di interruttori chi cercava «Stampante» andava a
// tentativi. È il titolo che dice cosa c'è nel riquadro, non
// un'etichetta di servizio.
describe('i titoli di sezione sono titoli', () => {
  const css = () => readFileSync(join(CARTELLA, 'index.css'), 'utf8')

  function regola(nome) {
    const testo = css().replace(/\/\*[\s\S]*?\*\//g, '')
    const i = testo.indexOf(A_CAPO + nome + ' {')
    expect(i, nome + ' non esiste più nel foglio').toBeGreaterThan(-1)
    return testo.slice(i, testo.indexOf('}', i))
  }

  it('il titolo di sezione non scende sotto 1rem', () => {
    const corpo = regola('.settings-section h3')
    const m = /font-size:\s*([\d.]+)rem/.exec(corpo)
    expect(m, 'il titolo di sezione deve dichiarare una misura').not.toBe(null)
    expect(Number(m[1])).toBeGreaterThanOrEqual(1)
  })

  it('il titolo di sezione non è maiuscoletto slavato', () => {
    const corpo = regola('.settings-section h3')
    expect(corpo).not.toMatch(/text-transform:\s*uppercase/)
    expect(corpo).not.toMatch(/color:\s*var\(--muted\)/)
    expect(corpo).toMatch(/color:\s*var\(--text\)/)
  })

  it('il sottotitolo sta un gradino sotto, e non è più uno style inline', () => {
    const sotto = regola('.settings-section h4')
    const m = /font-size:\s*([\d.]+)rem/.exec(sotto)
    expect(m).not.toBe(null)
    const titolo = /font-size:\s*([\d.]+)rem/.exec(regola('.settings-section h3'))
    expect(Number(m[1])).toBeLessThan(Number(titolo[1]))
  })
})


// ── I TASTI DI UNA CARD DELLA CODA STANNO A UNA MISURA SOLA ──────────
//
// «I tasti della card avvicinali in verticale 1/2 pixel (comunque di
// pochissimo)» (l'utente, 20/08/2026). Erano due numeri battuti a mano —
// 8px nel menu che si apre, 6px nel piede — e gli stessi tasti, a un dito
// di distanza, avevano due arie diverse.
//
// SI STRINGE LO SPAZIO, NON I TASTI: i bersagli restano quelli di
// docs/navigazione.md. E lo stacco dal contenuto sopra
// (`margin-top`/`padding-top` di `.corsia-azioni-aperte`) NON si tocca: sta
// lì perché il primo tasto del menu non sembri la seconda riga di quello
// del piede, e sotto ce n'è uno che rimanda indietro una comanda.
//
// Dal foglio e non dal DOM: happy-dom non applica il CSS, e una misura
// scritta due volte si scolla al primo ritocco senza che nessun test se ne
// accorga.
describe('i tasti di una card della coda hanno un solo respiro', () => {
  const css = () => readFileSync(join(CARTELLA, 'index.css'), 'utf8')

  const regola = (nome) => {
    const testo = css().replace(/\/\*[\s\S]*?\*\//g, '')
    const i = testo.indexOf(A_CAPO + nome + ' {')
    expect(i, nome + ' non esiste più nel foglio').toBeGreaterThan(-1)
    return testo.slice(i, testo.indexOf('}', i))
  }

  it('il gettone c’è, ed è di pochissimo più stretto degli 8px di prima', () => {
    const m = /--gap-tasti-card:\s*(\d+)px/.exec(css())
    expect(m, 'il respiro dei tasti della card è un gettone, non un numero sparso').not.toBe(null)
    const px = Number(m[1])
    expect(px).toBeLessThan(8)
    // «Di pochissimo»: uno o due pixel. A 4 i tasti si toccherebbero, e in
    // un menu dove uno rimanda indietro una comanda è un errore vero.
    expect(px).toBeGreaterThanOrEqual(6)
  })

  it('e lo usano tutti e due i posti dove quei tasti stanno', () => {
    expect(regola('.corsia-piede')).toMatch(/gap:\s*var\(--gap-tasti-card\)/)
    expect(regola('.corsia-azioni-aperte')).toMatch(/gap:\s*var\(--gap-tasti-card\)/)
  })

  it('lo stacco dal contenuto sopra resta dov’era', () => {
    // Il menu non deve attaccarsi alla card: la riga di sopra è
    // informazione, questi sono tasti, e presi di corsa si confondono.
    const r = regola('.corsia-azioni-aperte')
    expect(r).toMatch(/margin-top:\s*14px/)
    expect(r).toMatch(/padding-top:\s*12px/)
    expect(r).toMatch(/border-top:/)
  })
})

// ── I GETTONI DELLA TAVOLOZZA SI PRENDONO COL POLLICE ────────────────
//
// La tavolozza del conto stava dentro il ⋯ della card, e lì i gettoni
// erano 26px (34 sul touch) perché dovevano stare in una fila stretta:
// sotto la soglia di docs/navigazione.md, e per un colore preso male due
// tavoli si confondono. Adesso la tavolozza ha la sua modale e lo spazio
// c'è: 48px per tutti, senza più la deroga del puntatore grosso.
describe('la tavolozza del conto ha bersagli pieni', () => {
  const css = () => readFileSync(join(CARTELLA, 'index.css'), 'utf8')

  const regola = (nome) => {
    const testo = css().replace(/\/\*[\s\S]*?\*\//g, '')
    const i = testo.indexOf(A_CAPO + nome + ' {')
    expect(i, nome + ' non esiste più nel foglio').toBeGreaterThan(-1)
    return testo.slice(i, testo.indexOf('}', i))
  }

  it('un gettone non scende sotto i 44px', () => {
    const r = regola('.colore-conto')
    const w = /width:\s*(\d+)px/.exec(r)
    const h = /height:\s*(\d+)px/.exec(r)
    expect(w, 'il gettone deve dichiarare la sua misura').not.toBe(null)
    expect(Number(w[1])).toBeGreaterThanOrEqual(44)
    expect(Number(h[1])).toBeGreaterThanOrEqual(44)
  })

  it('e non c’è più una misura a parte per il touch', () => {
    // Era la deroga di quando i gettoni stavano nel menu: due misure per
    // la stessa cosa, e quella piccola era il caso normale.
    expect(css()).not.toMatch(/pointer: coarse\)[\s\S]{0,120}\.colore-conto/)
  })
})

// ── IL ☰ DELLA LAVAGNA, E LE TRE FASCE DELLA TESTATA SUL TELEFONO ────
//
// Due segnalazioni dello stesso giorno, e una cura sola.
//
// «Il tasto menu va a finire sulla label» (l'utente, 21/08/2026): il ☰ era
// un tasto FISSO nell'angolo, fuori dal flusso, e la testata gli teneva il
// posto a mano — 54px di rientro sul titolo, 62 sull'avviso della cassa, un
// `top` calcolato per centrarlo sulla riga 1. A pagina in cima tornava; ma
// la coda SCORRE, e scorrendo la testata gli passava sotto: il conteggio
// dei conti e il nome del terminale mangiati per i primi 36px. Un tasto
// fisso sopra una pagina che scorre finisce, prima o poi, su quello che
// c'è scritto sotto. Nel flusso il posto non si tiene: si occupa.
//
// «Il layout sopra le card non è il massimo su mobile» (l'utente, stesso
// giorno): quattro fasce prima della prima card, e la terza erano i due
// tastini soli, spinti a destra. Adesso sono tre.
//
// Queste sono le misure che tengono in piedi le due cose: un riordino
// futuro le può cambiare, ma non in silenzio.
describe('la testata della lavagna: il ☰ nel flusso, tre fasce sul telefono', () => {
  const css = readFileSync(join(CARTELLA, 'index.css'), 'utf8')
  const regola = (nome) => {
    const i = css.indexOf(`
${nome} {`)
    expect(i, `${nome} non c'è più`).toBeGreaterThan(-1)
    return css.slice(i, css.indexOf('}', i))
  }
  // Il blocco di una media query, dall'apertura alla sua chiusura. SENZA
  // COMMENTI: qui dentro si controlla anche che certe regole NON ci siano
  // più, e i commenti le nominano apposta per dire perché sono sparite —
  // cercarle nel testo le ritroverebbe tutte.
  // E LA SOGLIA NON BASTA A IDENTIFICARE IL BLOCCO: di `@media (max-width:
  // 700px)` il foglio ne ha più d'uno, e parlano di cose diverse. Si dice
  // anche di quale si sta parlando, con una classe che sta solo lì.
  const pulito = nudo(css)
  const dentro = (query, marcatore) => {
    let da = 0
    for (;;) {
      const i = pulito.indexOf(query, da)
      expect(i, `${query} con ${marcatore} non c'è più`).toBeGreaterThan(-1)
      let livello = 0
      for (let k = pulito.indexOf('{', i); k < pulito.length; k++) {
        if (pulito[k] === '{') livello++
        else if (pulito[k] === '}') {
          livello--
          if (livello === 0) {
            const blocco = pulito.slice(i, k)
            if (blocco.includes(marcatore)) return blocco
            da = k
            break
          }
        }
      }
    }
  }
  const TELEFONO = '@media (max-width: 700px)'
  const TABLET = '@media (min-width: 701px)'
  const STRETTO = '@media (max-width: 640px)'

  it('il ☰ della coda non è fisso: sta nel flusso della testata', () => {
    const r = regola('.board-burger')
    expect(r).not.toMatch(/position:\s*fixed/)
    expect(r).not.toMatch(/position:\s*absolute/)
    // Quadrato, e il lato lo legge dalla fascia: una misura sola.
    expect(r).toMatch(/width:\s*var\(--coda-riga\)/)
    expect(r).toMatch(/height:\s*var\(--coda-riga\)/)
  })

  it('la fascia dichiara la sua altezza, e sul telefono è un bersaglio pieno', () => {
    // 44px è il minimo di docs/navigazione.md: sul telefono il ☰ si preme
    // col pollice, di corsa. Da tablet in su la riga era già stata
    // allineata a 42, e quella misura non si tocca.
    expect(regola('.board-head')).toMatch(/--coda-riga:\s*44px/)
    expect(dentro(TABLET, '--coda-riga')).toMatch(/--coda-riga:\s*42px/)
  })

  it('e nessuno tiene più il posto a un tasto che nel flusso non c’era', () => {
    // Il rientro del titolo (54px sul telefono, un calc da tablet in su) e
    // quello dell'avviso «Cassa chiusa» (62px) esistevano solo per non
    // finire sotto al ☰ flottante.
    expect(css).not.toMatch(/\.queue-board > \.banner \{[^}]*padding-left/)
    expect(dentro(TELEFONO, '.board-title')).not.toMatch(/\.board-title \{[^}]*padding-left/)
    expect(dentro(TABLET, '.board-title')).not.toMatch(/padding-left:\s*calc\(12px \+ 42px/)
  })

  it('il guscio della ricerca sparisce da tablet in su', () => {
    // `display: contents` e il campo torna figlio della testata, in riga 1
    // dov'è sempre stato: il guscio serve solo al telefono, per tenere
    // insieme ricerca e tastini su una fascia sola.
    expect(regola('.board-cerca')).toMatch(/display:\s*contents/)
  })

  it('sul telefono le fasce sono tre, e in quest’ordine', () => {
    const tel = dentro(TELEFONO, '.board-cerca')
    // 1. titolo e azioni  2. ricerca e tastini  3. conteggi e legenda
    expect(tel).toMatch(/\.board-title \{[^}]*order:\s*1/)
    expect(tel).toMatch(/\.board-actions \{[^}]*order:\s*2/)
    expect(tel).toMatch(/\.board-cerca \{[^}]*order:\s*3/)
    expect(tel).toMatch(/\.board-sotto \{[^}]*order:\s*4/)
    // le due fasce larghe vanno a capo da sé
    expect(tel).toMatch(/\.board-cerca \{[^}]*flex-basis:\s*100%/)
    // e i chip dei filtri escono SOTTO il tastino che li apre: stanno
    // dentro `.board-sotto`, che è la fascia dopo.
  })

  it('e il titolo si accorcia coi puntini invece di andare a capo', () => {
    // «In servizio» spezzato in due alzava la fascia di una riga intera per
    // due parole, e sotto ci sono le card.
    const tel = dentro(TELEFONO, '.board-title')
    const titolo = tel.slice(tel.indexOf('.board-title {'))
    expect(titolo.slice(0, titolo.indexOf('}'))).toMatch(/white-space:\s*nowrap/)
    expect(titolo.slice(0, titolo.indexOf('}'))).toMatch(/text-overflow:\s*ellipsis/)
  })

  it('la testata del telefono è dichiarata in un posto solo', () => {
    // Era in due blocchi (700px e 640px) con ordini diversi: valevano
    // tutt'e due e vinceva l'ultima scritta, cioè si leggeva il foglio e
    // non si capiva cosa succedesse su un telefono da 380px.
    expect(dentro(STRETTO, '.board-search')).not.toMatch(/order:/)
  })

  it('e il ➕ resta grande anche sul telefono', () => {
    // C'era un `.board-add` da 46px nel blocco dei 640px che non ha mai
    // colorato un pixel: la regola di base che lo fa da 60 sta più in basso
    // nel foglio, stesso peso, e a parità vince l'ultima scritta. È il
    // tasto che si prende di corsa e con le mani occupate.
    expect(regola('.board-add')).toMatch(/width:\s*60px/)
    expect(dentro(STRETTO, '.grid-card-main')).not.toMatch(/\.board-add/)
  })
})
