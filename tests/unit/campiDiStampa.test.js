// @vitest-environment happy-dom
'use strict'

// ── LA CARTA CHE ESCE COI CAMPI SCELTI (REQ-STAMPA-014) ──────────────
//
// Qui non si guardano le impostazioni: si guarda LA CARTA. In locale la
// stampante è finta e ogni lavoro apre la sua finestra col facsimile —
// leggerlo è l'unico modo di dire che uno scontrino è ancora uno
// scontrino dopo che qualcuno ha spento tre campi.
//
// LA PROVA CHE CONTA È LA PRIMA: con le impostazioni vuote — cioè in
// ogni locale che questo pannello non l'ha mai aperto — la carta deve
// uscire IDENTICA a prima. Non c'è migrazione da far girare e non c'è
// una sera in cui gli scontrini cambiano da soli.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

let finestre

beforeEach(() => {
  // Il printer è un singleton di modulo (connessione, coda, cache del
  // logo): ogni prova riparte da capo.
  vi.resetModules()
  localStorage.clear()
  finestre = []
  window.open = vi.fn(() => {
    const scritto = []
    finestre.push(scritto)
    return { document: { write: (h) => scritto.push(h), close: () => {} }, focus: () => {} }
  })
  // Nessun logo: `logo.png` non c'è (in prova non c'è un server che lo
  // serva), e l'errore arriva subito. Dove il logo serve, la prova se lo
  // accende da sé.
  window.Image = class {
    constructor() {
      this.width = 400
      this.height = 200
    }
    set src(_v) {
      queueMicrotask(() => this.onerror?.(new Error('404')))
    }
  }
  // L'ora della comanda è «adesso»: senza un adesso fermo, il facsimile
  // cambia a ogni giro.
  vi.useFakeTimers({ now: Date.parse('2026-08-20T21:30:00.000Z') })
})

afterEach(() => {
  vi.useRealTimers()
})

// Il testo del facsimile, senza il vestito HTML della finestra.
const carta = (n = 0) => {
  const html = (finestre[n] || []).join('')
  return html.match(/<pre>([\s\S]*?)<\/pre>/)?.[1] ?? ''
}

// Le impostazioni del locale, come le lascia `subscribeSettings` per chi
// stampa: nella memoria del terminale, mai da chiedere alla rete.
const impostazioni = (dati) => localStorage.setItem('tana:impostazioni', JSON.stringify(dati))

const CONTO = {
  id: 'ordine-di-prova',
  daily_number: 12,
  status: 'pagato',
  table_label: '4',
  customer_name: 'Anna',
  created_at: '2026-08-20T21:00:00.000Z',
  total: 23,
  discount_amount: 3,
  coperto_persons: 2,
  coperto_amount: 4,
  lottery_code: 'ABCD1234',
  payment_method: 'contanti',
  note: 'Vicino alla finestra',
  order_items: [
    { qty: 2, name: 'Negroni', unit_price: 8, note: 'poco ghiaccio' },
    { qty: 1, name: 'Spritz', unit_price: 7 },
  ],
  comande: [
    {
      id: 'c1',
      status: 'ricevuto',
      items: [
        { qty: 2, name: 'Negroni', unit_price: 8, note: 'poco ghiaccio' },
        { qty: 1, name: 'Spritz', unit_price: 7 },
      ],
    },
  ],
}

const stampa = async (quale, order = CONTO) => {
  const printer = await import('../../src/lib/printer.js')
  if (quale === 'comanda') await printer.printComanda(order)
  else await printer.printScontrino(order)
  return carta()
}

// ── PRIMA E DOPO, CON LE IMPOSTAZIONI VUOTE ──────────────────────────
//
// Il facsimile qui sotto è quello che usciva PRIMA che i campi si
// potessero scegliere, riga per riga. Se un giorno cambia, o è cambiato
// il formato di proposito — e allora si aggiorna spiegando perché — o
// qualcosa si è spento da solo in un locale che non ha scelto niente.
const SCONTRINO_DI_SEMPRE = `    L a   T a n a   d e l   C o n i g l i o
           Corso Tommaso Vitale 87/89
               80035 Nola - Italy
SCONTRINO - 12                20/08/26, 23:00:00
Utente A
2 clientei
Vendita - Tavolo 4
------------------------------------------------
QTA  Prodotto                    PU       Prezzo
------------------------------------------------
2x  Negroni                        8.00€  16.00€
1x  Spritz                         7.00€   7.00€
2x  Coperto                        4.00€   4.00€
Subtotale                                 23.00€
Sconto                                    -3.00€
------------------------------------------------
IVA 10.0% (A)                              1.82€
Subtotale                                 18.18€
                 Totale con IVA
                  2 0 . 0 0 €
------------------------------------------------
Pagamenti
Contante (A)                              20.00€
------------------------------------------------
Codice Lotteria                         ABCD1234
------------------------------------------------
                ordine-di-prova
                 EFFEVI - SRLS
────────────────────────────────────────────────`

const COMANDA_DI_SEMPRE = `          D I R E T T O     2 3 : 3 0
CONTATORIE                                 CL: 3
BAR                                      Vendeur
                    A n n a
                  Il tuo menu
------------------------------------------------
2  NEGRONI
     > poco ghiaccio
1  SPRITZ
------------------------------------------------
Nota: Vicino alla finestra
------------------------------------------------
────────────────────────────────────────────────`

// La finestra del facsimile non ripete le righe vuote e lascia cadere gli
// spazi in coda: si confronta quello che si legge.
const nudo = (t) =>
  t
    .split('\n')
    .map((r) => r.replace(/\s+$/, ''))
    .filter((r) => r !== '')
    .join('\n')

// Il testo GRANDE la finestra lo scrive spaziando le lettere, com'è sulla
// carta: per cercarci dentro una parola si toglie la spaziatura.
const compatto = (t) => t.replace(/\s+/g, '')

describe('senza aver scelto niente, la carta è quella di sempre', () => {
  it('lo scontrino, riga per riga', async () => {
    expect(nudo(await stampa('scontrino'))).toBe(SCONTRINO_DI_SEMPRE)
  })

  it('la comanda, riga per riga', async () => {
    expect(nudo(await stampa('comanda'))).toBe(COMANDA_DI_SEMPRE)
  })

  // La stessa cosa detta dall'altra parte: scrivere nelle impostazioni
  // ESATTAMENTE i valori di partenza non deve cambiare un carattere.
  it('scegliere quello che c’è già non sposta niente', async () => {
    const vuoto = await stampa('scontrino')
    vi.resetModules()
    finestre = []
    impostazioni({
      stampa_scontrino: {
        campi: {
          nome_locale: true,
          indirizzo: true,
          citta: true,
          numero: true,
          operatore: true,
          persone: true,
          riga_vendita: true,
          intestazione_colonne: true,
          coperto: true,
          sconto: true,
          iva: true,
          pagamenti: true,
          lotteria: true,
          codice_conto: true,
          ragione_sociale: true,
          riga_cortesia: false,
        },
      },
    })
    expect(await stampa('scontrino')).toBe(vuoto)
  })
})

describe('spegnere i campi dello scontrino', () => {
  it('le righe scelte spariscono, i prodotti e il totale restano', async () => {
    impostazioni({
      stampa_scontrino: {
        campi: { operatore: false, persone: false, codice_conto: false, lotteria: false },
      },
    })
    const uscito = await stampa('scontrino')
    expect(uscito).not.toContain('Utente A')
    expect(uscito).not.toContain('2 clienti')
    expect(uscito).not.toContain('ordine-di-prova')
    expect(uscito).not.toContain('ABCD1234')
    // LA LISTA DEI PRODOTTI È FISSA, e con lei il totale.
    expect(uscito).toContain('Negroni')
    expect(uscito).toContain('Spritz')
    expect(compatto(uscito)).toContain('20.00€') // il totale, in corpo grande
  })

  it('spegnendo l’intestazione lo scontrino non comincia con una riga vuota', async () => {
    impostazioni({
      stampa_scontrino: { campi: { nome_locale: false, indirizzo: false, citta: false } },
    })
    const uscito = await stampa('scontrino')
    expect(uscito).not.toContain('La Tana del Coniglio')
    expect(uscito).not.toContain('80035 Nola')
    // La prima riga scritta è già il numero del conto.
    expect(nudo(uscito).split('\n')[0]).toContain('SCONTRINO - 12')
  })

  it('senza IVA e senza sconto restano i prodotti e quello che si paga', async () => {
    impostazioni({ stampa_scontrino: { campi: { iva: false, sconto: false, pagamenti: false } } })
    const uscito = await stampa('scontrino')
    expect(uscito).not.toContain('IVA 10.0%')
    expect(uscito).not.toContain('Sconto')
    expect(uscito).not.toContain('Pagamenti')
    expect(uscito).toContain('Totale con IVA')
  })

  it('la riga di saluto si accende e si scrive', async () => {
    impostazioni({
      stampa_scontrino: {
        campi: { riga_cortesia: true },
        testi: { riga_cortesia: 'Grazie e a presto!' },
      },
    })
    expect(await stampa('scontrino')).toContain('Grazie e a presto!')
  })

  // Accesa ma senza parole non stampa una riga vuota: sarebbe carta. La
  // carta torna identica a quella di sempre, carattere per carattere.
  it('accesa e vuota non stampa niente', async () => {
    impostazioni({ stampa_scontrino: { campi: { riga_cortesia: true }, testi: { riga_cortesia: '  ' } } })
    expect(nudo(await stampa('scontrino'))).toBe(SCONTRINO_DI_SEMPRE)
  })
})

describe('i campi della comanda', () => {
  it('le parole della fascia si cambiano', async () => {
    impostazioni({ stampa_comanda: { testi: { fascia: 'CUCINA' } } })
    const uscito = await stampa('comanda')
    expect(compatto(uscito)).toContain('CUCINA23:30')
    expect(compatto(uscito)).not.toContain('DIRETTO')
  })

  it('l’ora si può togliere dalla fascia', async () => {
    impostazioni({ stampa_comanda: { campi: { ora: false } } })
    const uscito = await stampa('comanda')
    expect(compatto(uscito)).toContain('DIRETTO')
    expect(compatto(uscito)).not.toContain('23:30')
  })

  // Fascia spenta E ora spenta vorrebbero dire una striscia nera vuota in
  // cima al ticket: non esce proprio.
  it('spegnendo la fascia il ticket comincia dal conteggio', async () => {
    impostazioni({ stampa_comanda: { campi: { fascia: false } } })
    const uscito = await stampa('comanda')
    expect(uscito).not.toContain('DIRETTO')
    expect(uscito).not.toContain('23:30')
    expect(nudo(uscito).split('\n')[0]).toContain('CONTATORIE')
  })

  it('le righe di servizio si tolgono, e con loro il vuoto che le separava', async () => {
    impostazioni({ stampa_comanda: { campi: { conteggio: false, reparto: false } } })
    const uscito = await stampa('comanda')
    expect(uscito).not.toContain('CONTATORIE')
    expect(uscito).not.toContain('Vendeur')
    expect(uscito).toContain('NEGRONI')
  })

  it('le note dei prodotti si possono togliere, i prodotti no', async () => {
    impostazioni({ stampa_comanda: { campi: { note_riga: false, nota_conto: false } } })
    const uscito = await stampa('comanda')
    expect(uscito).not.toContain('poco ghiaccio')
    expect(uscito).not.toContain('Vicino alla finestra')
    expect(uscito).toContain('NEGRONI')
    expect(uscito).toContain('SPRITZ')
  })

  it('il nome grande e la riga sotto si spengono insieme senza lasciare buchi', async () => {
    impostazioni({ stampa_comanda: { campi: { titolo: false, sottotitolo: false } } })
    const uscito = await stampa('comanda')
    expect(compatto(uscito)).not.toContain('Anna')
    expect(uscito).not.toContain('Il tuo menu')
  })
})

// ── IL LOGO, STAMPA PER STAMPA (REQ-STAMPA-011) ──────────────────────
describe('il logo esce dove il locale ha detto', () => {
  // Un logo che si carica davvero: qui interessa se finisce sulla carta,
  // non com'è disegnato.
  const conImmagine = () => {
    window.Image = class {
      constructor() {
        this.width = 400
        this.height = 200
      }
      set src(_v) {
        queueMicrotask(() => this.onload?.())
      }
    }
    globalThis.HTMLCanvasElement.prototype.getContext = () => ({
      fillStyle: '',
      fillRect: () => {},
      drawImage: () => {},
    })
  }

  it('sullo scontrino sì, sulla comanda no: è così che è sempre stato', async () => {
    conImmagine()
    expect(await stampa('scontrino')).not.toBe('') // la carta esce
    expect(finestre[0].join('')).toContain('<img')
    vi.resetModules()
    finestre = []
    expect(await stampa('comanda')).not.toBe('')
    expect(finestre[0].join('')).not.toContain('<img')
  })

  it('acceso sulla comanda, esce anche lì', async () => {
    conImmagine()
    impostazioni({ stampa_logo: { comanda: true } })
    await stampa('comanda')
    expect(finestre[0].join('')).toContain('<img')
  })

  it('spento sullo scontrino, non esce più', async () => {
    conImmagine()
    impostazioni({ stampa_logo: { scontrino: false } })
    await stampa('scontrino')
    expect(finestre[0].join('')).not.toContain('<img')
  })

  // Un conto ancora aperto stampa il PRECONTO, e il preconto ha la sua
  // scelta: chi vuole il logo solo sul foglio che resta al cliente lo
  // spegne sullo scontrino e non su questo.
  it('il conto ancora aperto è un preconto, e segue la scelta del preconto', async () => {
    conImmagine()
    impostazioni({ stampa_logo: { preconto: false, scontrino: true } })
    await stampa('scontrino', { ...CONTO, status: 'aperto' })
    expect(finestre[0].join('')).not.toContain('<img')
  })

  it('l’immagine caricata dal locale prende il posto di quella del programma', async () => {
    conImmagine()
    const png = 'data:image/png;base64,iVBORw0KGgo='
    impostazioni({ stampa_logo: { immagine: png } })
    await stampa('scontrino')
    expect(finestre[0].join('')).toContain(png)
  })
})
