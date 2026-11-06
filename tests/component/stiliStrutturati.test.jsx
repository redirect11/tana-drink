// @vitest-environment happy-dom
'use strict'

// IL CONTRATTO DEGLI STILI STRUTTURATI (REQ-MENU-028). Uno stile che
// disegna il menù a modo suo («Giornale», e quello a carte di
// Flavio) riceve dal menù lo stesso pacchetto e promette le stesse cose: le
// voci tutte, col prezzo dei dati, coi tasti per ordinare del menù, e
// niente database. Questa prova gira su OGNI stile dell'elenco: uno stile
// nuovo che si aggancia la eredita senza scriverne un'altra.

import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { MemoryRouter } from '../helpers/router.jsx'
import '@testing-library/jest-dom/vitest'
import { STILI_STRUTTURATI } from '../../src/components/stiliStrutturati.js'
import { sezioniPerLoStile } from '../../src/lib/contrattoStile.js'
import { formatPrice } from '../../src/lib/orderStatus.js'

const voce = (id, name, price, extra = {}) => ({ id, name, price, description: `Descrizione di ${name}`, ingredients: [], ...extra })
const SEZIONI = [
  { id: 's1', nome: 'Grandi classici', vista: 'piena', voci: [voce('negroni', 'Negroni', 8), voce('daiquiri', 'Daiquiri', 7.5)] },
  { id: 's2', nome: 'Analcolici', vista: 'snella', voci: [voce('acqua', 'Acqua', 1.5)] },
]
const SPECIALI = [voce('velluto', 'Velluto Bianco', 9, { speciale: true }), voce('brezza', 'Brezza', 10, { speciale: true })]

function pacchetto(extra = {}) {
  return {
    venue: { venue_name: 'Bar di prova', venue_tagline: 'Dal 1990' },
    sezioni: SEZIONI,
    speciali: SPECIALI,
    soloSpeciali: false,
    special: { titolo: 'Special', sottotitolo: 'Della sera' },
    linkMenu: '/menu?tavolo=3',
    immagine: () => null,
    apri: vi.fn(),
    tastiOrdine: vi.fn((d) => <button type="button">Aggiungi {d.name}</button>),
    quantita: false,
    testo: (_k, diSempre) => diSempre,
    ...extra,
  }
}

const mostra = (s, p) =>
  render(
    <MemoryRouter>
      <s.Testata {...p} />
      <s.Corpo {...p} />
    </MemoryRouter>
  )

describe.each(Object.entries(STILI_STRUTTURATI))('lo stile strutturato «%s»', (id, s) => {
  it('ha testata, corpo, vetrina e segno dei disegni', () => {
    expect(typeof s.Testata).toBe('function')
    expect(typeof s.Corpo).toBe('function')
    expect(typeof s.Vetrina).toBe('function')
    expect(typeof s.segno).toBe('string')
  })

  it('mostra ogni voce col suo nome e col prezzo dei dati', () => {
    mostra(s, pacchetto())
    for (const d of [...SEZIONI.flatMap((x) => x.voci), ...SPECIALI]) {
      expect(screen.getAllByText(d.name).length, d.name).toBeGreaterThan(0)
      // Lo spazio prima dell'euro non va a capo; la ricerca per testo lo
      // legge come uno spazio qualunque.
      expect(screen.getAllByText(formatPrice(d.price).replace(/\s/g, ' ')).length, d.name).toBeGreaterThan(0)
    }
    expect(screen.getByText('Bar di prova')).toBeInTheDocument()
  })

  it('ogni voce ha i tasti per ordinare del menù', () => {
    const p = pacchetto()
    mostra(s, p)
    const ordinabili = new Set(p.tastiOrdine.mock.calls.map(([d]) => d.id))
    for (const d of [...SEZIONI.flatMap((x) => x.voci), ...SPECIALI]) expect(ordinabili.has(d.id), d.name).toBe(true)
  })

  it('il nome della voce è un tasto che apre il dettaglio', async () => {
    const p = pacchetto()
    mostra(s, p)
    await userEvent.setup().click(screen.getAllByRole('button', { name: 'Negroni' })[0])
    expect(p.apri).toHaveBeenCalledWith(expect.objectContaining({ id: 'negroni' }))
  })

  it('sulla pagina degli Special mostra solo quelli, e la strada per il menù completo', () => {
    mostra(s, pacchetto({ soloSpeciali: true }))
    expect(screen.queryByText('Negroni')).toBeNull()
    expect(screen.getAllByText('Velluto Bianco').length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: '← Tutto il menù' })).toHaveAttribute('href', '/menu?tavolo=3')
  })

  it('il titolo degli Special arriva dal pacchetto', () => {
    const { container } = mostra(s, pacchetto({ soloSpeciali: true, special: { titolo: 'Notte delle carte', sottotitolo: 'Il tema' } }))
    expect(within(container).getByText('Notte delle carte')).toBeInTheDocument()
    expect(within(container).getByText('Il tema')).toBeInTheDocument()
  })
})

// Uno stile non legge e non scrive niente: ha già tutto, e un'attesa sul
// database in mezzo al menù è il menù fermo senza rete (local-first). Con
// le animazioni, «riduci movimento» va rispettato.
describe('quello che uno stile strutturato non fa', () => {
  const elenco = readFileSync(join(__dirname, '../../src/components/stiliStrutturati.js'), 'utf8')
  const file = [...elenco.matchAll(/from '\.\/([A-Za-z]+\.jsx)'/g)].map((m) => m[1])

  it('l’elenco nomina i file degli stili', () => {
    expect(file.length).toBeGreaterThan(0)
  })

  it.each(file)('%s non tocca il database, e con le animazioni rispetta «riduci movimento»', (f) => {
    const src = readFileSync(join(__dirname, '../../src/components', f), 'utf8')
    expect(src).not.toMatch(/from '[^']*lib\/api\.js'/)
    expect(src).not.toMatch(/from 'firebase/)
    expect(src).not.toMatch(/from '[^']*porte\/dati\.js'/)
    if (/gsap|requestAnimationFrame|\.animate\(/.test(src)) expect(src).toMatch(/prefers-reduced-motion/)
  })
})

describe('le sezioni nella forma del contratto', () => {
  it('nome, voci, vista e un id stabile', () => {
    const voci = [voce('a', 'A', 1)]
    expect(sezioniPerLoStile([['Classici', voci, { id: 'sez-1', vista: 'snella' }], ['Altro', voci]])).toEqual([
      { id: 'sez-1', nome: 'Classici', vista: 'snella', gruppo: null, voci },
      { id: 'Altro', nome: 'Altro', vista: 'piena', gruppo: null, voci },
    ])
  })

  // Il gruppo della struttura è la macro categoria: lo stile a carte ne fa
  // il seme (REQ-MENU-029).
  it('col gruppo della sezione, se la struttura ne ha uno', () => {
    const voci = [voce('a', 'A', 1)]
    expect(sezioniPerLoStile([['Gin', voci, { id: 'sez-2', gruppo: 'Distillati' }]])[0].gruppo).toBe('Distillati')
  })
})
