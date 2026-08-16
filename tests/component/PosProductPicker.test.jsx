// @vitest-environment happy-dom
'use strict'

// LA RICERCA NELLA GRIGLIA PRODOTTI, in creazione e modifica ordine.
// Filtrando, la griglia si svuota di tutto quello che non risponde: chi
// batte gli ordini conosce a memoria dove sta ogni card e se la ritrova
// diversa a ogni lettera. Da qui il secondo modo: la griglia non si tocca,
// si accende la prima card trovata e ce la si porta sotto gli occhi.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

vi.mock('../../src/lib/api.js', () => ({
  subscribePosPrefs: () => () => {},
  savePosOrder: vi.fn(() => Promise.resolve()),
  savePosFavorites: vi.fn(() => Promise.resolve()),
  savePosColors: vi.fn(() => Promise.resolve()),
  updateDrink: vi.fn(() => Promise.resolve()),
  createCategory: vi.fn(() => Promise.resolve({ id: 'c' })),
  fetchInventoryItems: vi.fn(() => Promise.resolve([])),
}))
vi.mock('../../src/components/DrinkForm.jsx', () => ({ default: () => <div>SCHEDA PRODOTTO</div> }))

import PosProductPicker from '../../src/components/PosProductPicker.jsx'

const drinks = [
  { id: '1', name: 'Gin Tonic', price: 7, available: true },
  { id: '2', name: 'Negroni', price: 8, available: true },
  { id: '3', name: 'Negroni Sbagliato', price: 8, available: true },
  { id: '4', name: 'Mojito', price: 7, available: true },
]
const cats = [{ id: 'c1', name: 'Cocktail' }]

function mostra(props = {}) {
  const onAdd = vi.fn()
  const utils = render(
    <PosProductPicker
      drinks={drinks}
      cats={cats}
      loading={false}
      qtyByDrink={{}}
      onAdd={onAdd}
      onSetQty={vi.fn()}
      {...props}
    />
  )
  // Le card sono i riquadri con l'identificativo del prodotto.
  const cards = () => [...utils.container.querySelectorAll('[data-drink-id]')]
  return { ...utils, onAdd, cards }
}

beforeEach(() => localStorage.clear())

describe('ricerca prodotti: filtra (come è sempre stato)', () => {
  it('restano solo le card che rispondono', async () => {
    const user = userEvent.setup()
    const { cards } = mostra()
    await user.type(screen.getByLabelText('Cerca prodotto'), 'negro')
    expect(cards().map((c) => c.dataset.drinkId)).toEqual(['2', '3'])
  })

  it('nessuna card accesa: qui a trovarle ci pensa il vuoto intorno', async () => {
    const user = userEvent.setup()
    const { container } = mostra()
    await user.type(screen.getByLabelText('Cerca prodotto'), 'negro')
    expect(container.querySelector('.prodotto-acceso')).toBeNull()
  })
})

describe('ricerca prodotti: accendi e porta lì', () => {
  it('la griglia non perde nemmeno una card e si accende la PRIMA che risponde', async () => {
    const user = userEvent.setup()
    const { cards, container } = mostra({ ricercaEvidenzia: true })
    await user.type(screen.getByLabelText('Cerca prodotto'), 'negro')
    expect(cards()).toHaveLength(4)
    // "Negroni" prima di "Negroni Sbagliato": conta l'ordine della griglia.
    expect(container.querySelectorAll('.prodotto-acceso')).toHaveLength(1)
    expect(container.querySelector('.prodotto-acceso').dataset.drinkId).toBe('2')
  })

  it('toccando una card la ricerca si azzera', async () => {
    const user = userEvent.setup()
    const { onAdd, container } = mostra({ ricercaEvidenzia: true })
    const ricerca = screen.getByLabelText('Cerca prodotto')
    await user.type(ricerca, 'negro')
    await user.click(screen.getByText('Mojito'))
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ id: '4' }))
    expect(ricerca).toHaveValue('')
    expect(container.querySelector('.prodotto-acceso')).toBeNull()
  })

  it('se non c è niente da accendere lo dice: la griglia da sola non lo direbbe', async () => {
    const user = userEvent.setup()
    const { cards } = mostra({ ricercaEvidenzia: true })
    await user.type(screen.getByLabelText('Cerca prodotto'), 'zzz')
    expect(cards()).toHaveLength(4) // niente è sparito…
    expect(screen.getByText(/Nessun prodotto per/)).toBeInTheDocument() // …quindi si scrive
  })
})

// ── ORGANIZZA NON DEVE CAMBIARE LA GRIGLIA ───────────────────────────
// La maniglia stava a fianco della card e ogni cella cresceva di 38px:
// entrando in «organizza» le card cambiavano numero per riga e misura, e
// si finiva per sistemare una disposizione diversa da quella che poi si
// usa davvero. La maniglia sta SOPRA la card, e la cella occupa quello
// che occupa fuori da qui.
describe('modalità organizza', () => {
  const griglia = (c) => c.querySelector('[style*="grid-template-columns"]')

  it('la griglia non scorre di lato: va a capo', () => {
    // Trascinando una card oltre il bordo destro, la griglia si allargava
    // per contenerla e partiva uno scorrimento orizzontale senza fine: per
    // rivedere le card bisognava riportare indietro la barra a mano.
    const { container } = mostra()
    expect(griglia(container).style.overflowX).toBe('hidden')
  })

  it('il minimo delle colonne lo calcola il browser, non una misura in ritardo', () => {
    // Trascinando la maniglia di fianco alla griglia, la larghezza misurata
    // arriva sempre qualche fotogramma dopo: col conto fatto in JS, per un
    // po' restava quella di prima — più larga — e ci stavano due colonne
    // invece di tre, fino a quando la misura non arrivava. Il terzo di
    // larghezza deve stare NEL CSS, così si rifà insieme al
    // ridimensionamento.
    const { container } = mostra()
    const cols = griglia(container).style.gridTemplateColumns
    expect(cols).toMatch(/calc\(\(100% - \d+px\) \/ 3\)/)
  })

  it('le colonne restano quelle di prima', async () => {
    const user = userEvent.setup()
    const { container } = mostra({ canReorder: true, onReorder: vi.fn() })
    const prima = griglia(container).style.gridTemplateColumns
    await user.click(screen.getByLabelText('Organizza griglia'))
    expect(griglia(container).style.gridTemplateColumns).toBe(prima)
  })

  it('la griglia non viene rifatta: nessun lampo di card della misura sbagliata', async () => {
    // Montare il contesto di trascinamento solo in «organizza» spostava la
    // griglia in un altro posto dell'albero: React buttava il riquadro e ne
    // faceva uno nuovo, e per un attimo si vedevano le card cambiare misura
    // — il tempo di rimisurare e ridisegnare. È lo STESSO riquadro, prima e
    // dopo.
    const user = userEvent.setup()
    const { container } = mostra({ canReorder: true, onReorder: vi.fn() })
    const prima = griglia(container)
    await user.click(screen.getByLabelText('Organizza griglia'))
    expect(griglia(container)).toBe(prima)
    await user.click(screen.getByLabelText('Fine organizzazione'))
    expect(griglia(container)).toBe(prima)
  })

  it('la misura della griglia continua a essere presa dopo il cambio di modo', async () => {
    // Entrando in «organizza» la griglia finisce dentro il contesto di
    // trascinamento: per React è un altro posto nell'albero, quindi il
    // riquadro viene rifatto da capo. Il misuratore restava attaccato a
    // quello vecchio — staccato dalla pagina, quindi largo zero — e le
    // card tornavano alla misura di partenza coi testi rimpiccioliti.
    const osservati = []
    const vecchio = globalThis.ResizeObserver
    globalThis.ResizeObserver = class {
      observe(el) { osservati.push(el) }
      disconnect() {}
    }
    try {
      const user = userEvent.setup()
      const { container } = mostra({ canReorder: true, onReorder: vi.fn() })
      await user.click(screen.getByLabelText('Organizza griglia'))
      const misurato = osservati.at(-1)
      expect(misurato).toBeTruthy()
      // Quello che si sta misurando è la griglia che si vede adesso.
      expect(container.contains(misurato)).toBe(true)
      expect(misurato).toBe(griglia(container))
    } finally {
      globalThis.ResizeObserver = vecchio
    }
  })

  it('la maniglia sta dentro la card, non a fianco', async () => {
    const user = userEvent.setup()
    const { container, cards } = mostra({ canReorder: true, onReorder: vi.fn() })
    const quante = cards().length
    await user.click(screen.getByLabelText('Organizza griglia'))
    // Stesse card di prima, ognuna con il suo appiglio dentro la cella.
    expect(cards().length).toBe(quante)
    const celle = container.querySelectorAll('.reorder-cell')
    expect(celle.length).toBe(quante)
    for (const cella of celle) {
      expect(cella.querySelector('.reorder-grip')).toBeTruthy()
      expect(cella.querySelector('[data-drink-id]')).toBeTruthy()
    }
  })
})

// ── LA STRISCIA DELLE TILE DICE QUELLO CHE IL LOCALE HA SCELTO ───────
// Lo stesso segno, quattro significati: il colore del prodotto, quello
// della categoria, le scorte, o niente (REQ-POS-019).
describe('la striscia delle tile', () => {
  const bordo = (container, nome) => {
    const card = [...container.querySelectorAll('[data-drink-id]')].find((el) =>
      el.textContent.includes(nome)
    )
    return card?.style.borderLeftColor
  }

  it('«spenta»: grigia, anche se il prodotto ha il suo colore', () => {
    const { container } = mostra({ modoStriscia: 'spenta' })
    expect(bordo(container, 'Mojito')).toBe('var(--line)')
  })

  it('«scorte»: senza ricetta collegata non si inventa un allarme', () => {
    // Un drink senza ingredienti in magazzino non è «esaurito»: non lo
    // sappiamo, e col verde spento resta grigio.
    const { container } = mostra({ modoStriscia: 'scorte' })
    expect(bordo(container, 'Mojito')).toBe('var(--line)')
  })

  it('senza indicazioni resta il modo di sempre: il colore del prodotto', () => {
    const { container } = mostra()
    expect(bordo(container, 'Mojito')).not.toBe('')
  })
})
