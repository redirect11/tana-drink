'use strict'

// LA STRUTTURA DEL MENÙ DEI CLIENTI (REQ-MENU-025). Flavio, 04/11/2026,
// col video del menù sul test: gin e vodka insieme, «Distillati» tutti
// uniti, shot, food e tisane al tavolo, la tonica fra gli ingredienti del
// gin tonic — il gestionale è fatto per il banco, e al tavolo si legge
// un'altra cosa. L'utente, lo stesso giorno: non una carta a parte, ma lo
// stesso menù con la struttura personalizzabile; e il 05/11/2026: si parte
// da una copia delle voci della cassa, poi tutto è libero, ma ogni voce è
// collegata a un prodotto della cassa. I testi per il cliente sulla scheda
// prodotto, col ritocco nelle sezioni.

import { describe, it, expect } from 'vitest'
import {
  sezioniDelMenu,
  prepopolazione,
  fuoriDalMenu,
  nomeSezione,
  voceInSezione,
  perIlCliente,
  strutturaPersonalizzata,
  ordina,
  nomeVoce,
  vistaSezione,
  sezioneDaScrivere,
  gruppiScritti,
  pagineDelMenu,
} from '../../src/lib/strutturaMenu.js'
import { ingredientiInCarta } from '../../src/lib/ingredientiCarta.js'
import { rigaDelCarrello, chiaveRiga } from '../../src/lib/cart.js'

const CATS = [
  { id: 'distillati', name: 'Distillati', sort_order: 1 },
  { id: 'prezzi', name: 'Voci prezzo', sort_order: 2 },
  { id: 'bibite', name: 'Bibite', sort_order: 3 },
  { id: 'shot', name: 'Shot', sort_order: 4 },
]

// Il gestionale come quello della Tana: prodotti col nome del banco, una
// voce-prezzo, una ricetta con la tonica.
const DRINKS = [
  {
    id: 'mare',
    name: 'MARE',
    nome_cliente: 'Gin Mare tonic',
    category_id: 'distillati',
    price: 8,
    available: true,
    recipe_items: [
      { name: 'Gin Mare', qty: 50, unit: 'ml' },
      { name: 'Tonica', qty: 150, unit: 'ml' },
    ],
  },
  { id: 'sour7', name: 'SOUR 7', category_id: 'prezzi', price: 7, available: true },
  { id: 'acqua', name: 'ACQUA NAT', category_id: 'bibite', price: 1, available: true, description: 'Naturale' },
  { id: 'b52', name: 'B52', category_id: 'shot', price: 4, available: true },
  // Una categoria che non c'è più: il prodotto si porta dietro il nome.
  { id: 'vecchio', name: 'Vecchio', category_id: 'sparita', category: 'Amari', price: 5, available: true },
].map(perIlCliente)

const STRUTTURA = {
  sezioni: [
    { id: 'cocktail', nome: 'Cocktail IBA', ordine: 0, vista: 'dettagliata' },
    { id: 's-gin', nome: 'Gin selection', ordine: 1, vista: 'dettagliata' },
    { id: 's-bibite', nome: 'Bibite', ordine: 2, vista: 'snella' },
    { id: 's-prezzi', nome: 'Voci prezzo', ordine: 3, vista: 'dettagliata', nascosta: true },
    { id: 'vuota', nome: 'Vuota', ordine: 4, vista: 'dettagliata' },
    // Messa in cima dopo: un ordine negativo.
    { id: 'signature', nome: 'Signature', ordine: -1, vista: 'dettagliata' },
  ],
  voci: [
    { id: 'v-collins', sezione_id: 'cocktail', drink_id: 'sour7', nome: 'Tom Collins', ordine: 1 },
    { id: 'v-fizz', sezione_id: 'cocktail', drink_id: 'sour7', nome: 'Gin Fizz', descrizione: 'Gin, limone, soda.', ordine: 0 },
    { id: 'v-mare', sezione_id: 's-gin', drink_id: 'mare', ordine: 0 },
    { id: 'v-mare-sig', sezione_id: 'signature', drink_id: 'mare', nome: 'Il Mare di Flavio', ordine: 0 },
    { id: 'v-acqua', sezione_id: 's-bibite', drink_id: 'acqua', ordine: 0 },
    { id: 'v-sour', sezione_id: 's-prezzi', drink_id: 'sour7', ordine: 0 },
    // Su un prodotto che il menù non ha (spento o tolto): non c'è.
    { id: 'v-spenta', sezione_id: 'vuota', drink_id: 'non-ce', nome: 'Spenta', ordine: 0 },
  ],
}

describe('il menù di sempre, finché nessuno tocca la struttura', () => {
  it('senza sezioni scritte la struttura non è personalizzata', () => {
    expect(strutturaPersonalizzata({ sezioni: [], voci: [] })).toBe(false)
    expect(strutturaPersonalizzata(null)).toBe(false)
    expect(strutturaPersonalizzata(STRUTTURA)).toBe(true)
  })
})

// LA COPIA DI PARTENZA del tasto «Prepopola con le voci della cassa»: il
// menù di sempre, scritto come struttura, da sistemare poi a piacere.
describe('la copia di partenza', () => {
  const copia = prepopolazione(DRINKS, CATS)

  it('una sezione per categoria, nel loro ordine e col loro nome; i prodotti senza categoria in fondo', () => {
    expect(copia.sezioni.map((s) => [s.nome, s.ordine, s.vista, s.nascosta])).toEqual([
      ['Distillati', 0, 'dettagliata', false],
      ['Voci prezzo', 1, 'dettagliata', false],
      ['Bibite', 2, 'dettagliata', false],
      ['Shot', 3, 'dettagliata', false],
      ['Amari', 4, 'dettagliata', false],
    ])
  })

  it('ogni prodotto diventa una voce della sua sezione, collegata e senza testi propri', () => {
    const sezioneDi = new Map(copia.sezioni.map((s) => [s.chiave, s.nome]))
    expect(copia.voci.map((v) => [sezioneDi.get(v.sezione), v.drink_id])).toEqual([
      ['Distillati', 'mare'],
      ['Voci prezzo', 'sour7'],
      ['Bibite', 'acqua'],
      ['Shot', 'b52'],
      ['Amari', 'vecchio'],
    ])
    expect(copia.voci.every((v) => Object.keys(v).sort().join() === 'drink_id,ordine,sezione')).toBe(true)
  })

  it('anche i prodotti spenti: al tavolo non si vedono, e tornano quando si riaccendono', () => {
    const spento = { id: 'spento', name: 'Spento', category_id: 'shot', available: false }
    expect(prepopolazione([...DRINKS, spento], CATS).voci.some((v) => v.drink_id === 'spento')).toBe(true)
  })

  it('una categoria senza prodotti non fa una sezione vuota', () => {
    const senzaShot = prepopolazione(DRINKS.filter((d) => d.category_id !== 'shot'), CATS)
    expect(senzaShot.sezioni.map((s) => s.nome)).not.toContain('Shot')
  })
})

describe('la struttura personalizzata', () => {
  const sezioni = sezioniDelMenu(STRUTTURA, DRINKS)

  it('le sezioni nel loro ordine; le nascoste e quelle senza voci visibili non si vedono', () => {
    expect(sezioni.map(([n]) => n)).toEqual(['Signature', 'Cocktail IBA', 'Gin selection', 'Bibite'])
  })

  // Libera: un prodotto che non è in nessuna voce al tavolo non c'è, anche
  // se la sua categoria esiste (lo shot, e l'amaro senza categoria).
  it('al tavolo c’è solo quello che è in una voce', () => {
    const tutti = sezioni.flatMap(([, l]) => l).map((d) => d.drink_id)
    expect(tutti).not.toContain('b52')
    expect(tutti).not.toContain('vecchio')
  })

  it('le voci nel loro ordine; lo stesso prodotto in più voci e più sezioni', () => {
    const [, cocktail, info] = sezioni[1]
    expect(cocktail.map((v) => [v.id, v.name, v.drink_id, v.price])).toEqual([
      ['v-fizz', 'Gin Fizz', 'sour7', 7],
      ['v-collins', 'Tom Collins', 'sour7', 7],
    ])
    expect(info).toEqual({ id: 'cocktail', vista: 'dettagliata', gruppo: null })
    expect(sezioni[0][1][0]).toMatchObject({ name: 'Il Mare di Flavio', drink_id: 'mare' })
    expect(sezioni[2][1][0]).toMatchObject({ name: 'Gin Mare tonic', drink_id: 'mare' })
  })

  // Il prodotto di una sezione nascosta si ordina lo stesso dalle altre.
  it('una sezione nascosta non spegne i suoi prodotti nelle altre', () => {
    expect(sezioni.flatMap(([, l]) => l).filter((d) => d.drink_id === 'sour7')).toHaveLength(2)
  })

  it('una sezione snella non racconta niente', () => {
    const [, bibite, info] = sezioni[3]
    expect(info.vista).toBe('snella')
    expect(bibite[0]).toMatchObject({ name: 'ACQUA NAT', description: null, ingredienti: '' })
    expect(ingredientiInCarta(bibite[0])).toBeNull()
  })

  it('una sezione senza nome si legge «Senza nome»', () => {
    expect(nomeSezione({ nome: ' ' })).toBe('Senza nome')
    expect(nomeSezione({ nome: 'Gin' })).toBe('Gin')
  })
})

// Il prezzo della libertà: un prodotto nuovo in cassa non entra da solo.
// Questo elenco è quello che l'editor mostra perché nessuno lo perda.
describe('i prodotti della cassa rimasti fuori', () => {
  it('quelli che non sono in nessuna voce', () => {
    expect(fuoriDalMenu(STRUTTURA, DRINKS).map((d) => d.id)).toEqual(['b52', 'vecchio'])
    expect(fuoriDalMenu({ sezioni: [], voci: [] }, DRINKS)).toHaveLength(DRINKS.length)
  })
})

describe('i testi per il cliente', () => {
  it('il nome per il cliente della scheda vale ovunque, quello del banco resta accanto', () => {
    expect(DRINKS[0]).toMatchObject({ name: 'Gin Mare tonic', nome_gestionale: 'MARE' })
    expect(perIlCliente({ id: 'x', name: 'X', nome_cliente: '  ' })).toEqual({ id: 'x', name: 'X', nome_cliente: '  ' })
  })

  it('una voce a mano può ritoccare nome e descrizione; senza, valgono quelli della scheda', () => {
    const v = voceInSezione({ id: 'v', drink_id: 'mare', nome: '', descrizione: '' }, { ...DRINKS[0], description: 'Dalla scheda' })
    expect(v).toMatchObject({ id: 'v', drink_id: 'mare', name: 'Gin Mare tonic', nome_gestionale: 'MARE', description: 'Dalla scheda' })
    expect(nomeVoce({ nome: 'Il Mare di Flavio' }, DRINKS[0])).toBe('Il Mare di Flavio')
  })

  it('gli ingredienti di una voce a mano: il ritocco, o quelli scritti sulla scheda, mai la ricetta', () => {
    const conRitocco = voceInSezione({ id: 'v', drink_id: 'mare', ingredienti: 'Oliva, basilico' }, DRINKS[0])
    expect(ingredientiInCarta(conRitocco)).toEqual(['Oliva', 'basilico'])
    const dallaScheda = voceInSezione({ id: 'v', drink_id: 'mare' }, { ...DRINKS[0], ingredienti: 'Gin, tonica' })
    expect(ingredientiInCarta(dallaScheda)).toEqual(['Gin', 'tonica'])
    expect(ingredientiInCarta(voceInSezione({ id: 'v', drink_id: 'mare' }, DRINKS[0]))).toBeNull()
    // Fuori dalle voci a mano la ricetta vale come prima.
    expect(ingredientiInCarta(DRINKS[0])).toEqual(['Gin Mare', 'Tonica'])
  })

  it('la vista sconosciuta vale dettagliata', () => {
    expect(vistaSezione('boh')).toBe('dettagliata')
    expect(vistaSezione('snella')).toBe('snella')
  })
})

describe('l’ordine di sezioni e voci', () => {
  it('il numero scelto, poi il nome', () => {
    const l = ordina([
      { nome: 'B', ordine: 1 },
      { nome: 'C', ordine: 0 },
      { nome: 'A', ordine: 1 },
    ])
    expect(l.map((x) => x.nome)).toEqual(['C', 'A', 'B'])
  })
})

// L'ORDINE PORTA IL PRODOTTO DEL GESTIONALE: il banco conosce «SOUR 7», il
// magazzino scala la sua ricetta, le statistiche lo contano. Il nome che ha
// letto il cliente va nella nota, che al banco dice cosa preparare.
describe('nel carrello', () => {
  const [, cocktail] = sezioniDelMenu(STRUTTURA, DRINKS)[1]

  it('una voce porta il prodotto e il nome del banco, col nome letto nella nota', () => {
    const r = rigaDelCarrello(cocktail[0])
    expect(r).toEqual({ drink_id: 'sour7', name: 'SOUR 7', price: 7, qty: 1, sumup_product_id: null, nome_carta: 'Gin Fizz', note: 'Gin Fizz' })
  })

  // La chiave è quello che arriva al banco: due nomi sullo stesso prodotto
  // sono due righe, lo stesso nome da due sezioni (o dal carosello) una.
  it('la riga si riconosce dal prodotto e dal nome letto', () => {
    const [fizz, collins] = cocktail.map(rigaDelCarrello)
    expect(chiaveRiga(fizz)).not.toBe(chiaveRiga(collins))
    const mareDaSezione = rigaDelCarrello(sezioniDelMenu(STRUTTURA, DRINKS)[2][1][0])
    expect(chiaveRiga(mareDaSezione)).toBe(chiaveRiga(rigaDelCarrello(DRINKS[0])))
  })

  it('anche un prodotto col nome per il cliente porta quello del banco, con la nota', () => {
    const r = rigaDelCarrello(DRINKS[0])
    expect(r).toMatchObject({ drink_id: 'mare', name: 'MARE', nome_carta: 'Gin Mare tonic', note: 'Gin Mare tonic' })
  })

  it('senza nota quando i due nomi sono lo stesso', () => {
    const v = voceInSezione({ id: 'v', drink_id: 'sour7', nome: 'Sour 7' }, DRINKS[1])
    expect(rigaDelCarrello(v).note).toBeUndefined()
  })

  it('un prodotto senza nome per il cliente fa la riga di sempre', () => {
    const r = rigaDelCarrello(DRINKS[1])
    expect(r).toEqual({ drink_id: 'sour7', name: 'SOUR 7', price: 7, qty: 1, sumup_product_id: null })
    expect(chiaveRiga(r)).toBe('sour7')
  })
})

// ── I GRUPPI E LE PAGINE (REQ-MENU-030) ──────────────────────────────
// Un livello sopra le sezioni, per i menù impaginati per macro categoria
// (e per il mazzo di carte di Flavio, REQ-MENU-029): un nome scritto sulla
// sezione. Senza gruppi, niente cambia.
describe('i gruppi delle sezioni', () => {
  it('un nome sulla sezione, o niente', () => {
    expect(sezioneDaScrivere({ nome: 'Signature', gruppo: '  Cocktail ' }).gruppo).toBe('Cocktail')
    expect(sezioneDaScrivere({ nome: 'Bibite' }).gruppo).toBeNull()
    expect(sezioneDaScrivere({ nome: 'Bibite', gruppo: '   ' }).gruppo).toBeNull()
  })

  it('le proposte dell’editor: i gruppi scritti, nell’ordine della loro prima sezione', () => {
    const sezioni = [
      { id: 'a', nome: 'Birre', ordine: 2, gruppo: 'Da bere' },
      { id: 'b', nome: 'Signature', ordine: 0, gruppo: 'Cocktail' },
      { id: 'c', nome: 'IBA', ordine: 1, gruppo: 'Cocktail' },
      { id: 'd', nome: 'Food', ordine: 3 },
    ]
    expect(gruppiScritti(sezioni)).toEqual(['Cocktail', 'Da bere'])
  })

  it('la pagina del menù si porta dietro il gruppo di ogni sezione', () => {
    const conGruppo = { ...STRUTTURA, sezioni: STRUTTURA.sezioni.map((s) => ({ ...s, gruppo: s.id === 's-bibite' ? 'Da bere' : null })) }
    const gruppi = sezioniDelMenu(conGruppo, DRINKS).map(([n, , meta]) => [n, meta.gruppo])
    expect(gruppi).toContainEqual(['Bibite', 'Da bere'])
    expect(gruppi).toContainEqual(['Signature', null])
  })
})

describe('le pagine del menù', () => {
  const sez = (nome, gruppo = null) => [nome, [{ id: `v-${nome}` }], { id: `s-${nome}`, vista: 'dettagliata', gruppo }]
  const SEZIONI = [sez('Signature', 'Cocktail'), sez('IBA', 'Cocktail'), sez('Birre'), sez('Gin', 'Distillati')]
  const leggi = (pagine) => pagine.map((p) => [p.nome, p.sezioni.map(([n]) => n)])

  it('tutto in una pagina: niente pagine', () => {
    expect(pagineDelMenu(SEZIONI, 'unica')).toBeNull()
    expect(pagineDelMenu(SEZIONI, undefined)).toBeNull()
  })

  it('una pagina per sezione', () => {
    expect(leggi(pagineDelMenu(SEZIONI, 'per-categoria'))).toEqual([
      ['Signature', ['Signature']],
      ['IBA', ['IBA']],
      ['Birre', ['Birre']],
      ['Gin', ['Gin']],
    ])
  })

  it('una per gruppo, nell’ordine della prima sezione; una sezione senza gruppo fa pagina da sé', () => {
    expect(leggi(pagineDelMenu(SEZIONI, 'per-macro-categoria'))).toEqual([
      ['Cocktail', ['Signature', 'IBA']],
      ['Birre', ['Birre']],
      ['Distillati', ['Gin']],
    ])
  })

  it('senza gruppi scritti, per gruppo vale come per sezione', () => {
    const senza = SEZIONI.map(([n, l, m]) => [n, l, { ...m, gruppo: null }])
    expect(leggi(pagineDelMenu(senza, 'per-macro-categoria'))).toEqual(leggi(pagineDelMenu(senza, 'per-categoria')))
  })

  it('una pagina sola non si sfoglia', () => {
    expect(pagineDelMenu([sez('Signature', 'Cocktail'), sez('IBA', 'Cocktail')], 'per-macro-categoria')).toBeNull()
    expect(pagineDelMenu([sez('Signature')], 'per-categoria')).toBeNull()
  })
})
