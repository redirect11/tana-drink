// @vitest-environment happy-dom
'use strict'

// IL CONTORNO DELLE DUE LAVAGNE A CORSIE È LO STESSO.
//
// La coda ha due viste a colonne: quella dei CONTI e quella del BANCO, che
// dentro ha le COMANDE. Non sono la stessa vista — una risponde a «come sta
// andando la serata», l'altra a «cosa devo fare adesso» — ma il contorno era
// scritto due volte, riga per riga: guscio della colonna, testata con
// conteggio e totale, card dei conti «in arrivo» (ventidue righe identiche),
// bollo dell'acconto e piede. Una novantina di righe: cambiare la testata
// voleva dire cambiarla in due posti, e dimenticarne uno voleva dire due
// colonne che si somigliano ma non si comportano uguale.
//
// Qui si prova che il contorno sia davvero lo stesso, DA FUORI: si disegnano
// le due lavagne con gli stessi conti e si guarda che dicano le stesse cose.
// Se un domani qualcuno rimette a mano una delle due, questo test lo trova.

import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

import CorsieStato from '../../src/components/CorsieStato.jsx'
import CorsieComande from '../../src/components/CorsieComande.jsx'

const ORA = new Date().toISOString()

const conto = (patch = {}) => ({
  id: 'o41',
  daily_number: 41,
  workflow_status: 'ricevuto',
  payment_status: 'non_richiesto',
  table_label: '4',
  created_at: ORA,
  order_items: [{ id: 'r1', name: 'Negroni', qty: 1, unit_price: 9 }],
  ...patch,
})

const inArrivo = [
  { tempId: 't1', state: 'sending', order: { daily_number: 99, table_label: '7' } },
  { tempId: 't2', state: 'error', error: 'niente rete', order: { daily_number: 100 } },
]

// La lavagna dei CONTI: una colonna «In corso» con dentro un conto.
const corsieConti = (o = conto()) => [
  { id: 'attivi', titolo: 'In corso', stato: 'aperto', ordini: [o], totale: 9 },
  { id: 'chiusi', titolo: '💶 Chiusi', stato: 'pagato', ordini: [], totale: 0 },
]

// La lavagna del BANCO: la stessa colonna, ma dentro c'è la comanda.
const corsieComande = (o = conto()) => [
  {
    id: 'da-fare',
    titolo: 'Da fare',
    totale: 9,
    schede: [
      {
        id: 'o41-c1',
        numero: 41,
        seq: 1,
        ordine: o,
        comanda: { id: 'c1', seq: 1, status: 'ricevuto', created_at: ORA },
        items: o.order_items,
      },
    ],
  },
  { id: 'al-banco', titolo: 'In preparazione', totale: 0, schede: [] },
]

// La testata della colonna: `corsia-<id>` sta proprio lì. Si guarda quella
// e non tutta la colonna, che il totale della corsia e il prezzo di una riga
// possono essere lo stesso numero.
const colonna = (id) => document.querySelector(`.corsia-${id}`)

describe('il guscio della colonna è lo stesso per le due lavagne', () => {
  it('testata: titolo, quanti ce n’è dentro e quanto fanno', () => {
    const { unmount } = render(<CorsieStato corsie={corsieConti()} />)
    const testaConti = colonna('attivi')
    expect(within(testaConti).getByText('In corso')).toBeInTheDocument()
    expect(within(testaConti).getByText('1')).toBeInTheDocument()
    expect(within(testaConti).getByText('9,00 €')).toBeInTheDocument()
    unmount()

    render(<CorsieComande corsie={corsieComande()} />)
    const testaBanco = colonna('da-fare')
    expect(within(testaBanco).getByText('Da fare')).toBeInTheDocument()
    // Il conteggio è quello della PROPRIA vista: i conti di là, le comande
    // di qua. È l'unica differenza, e si passa da fuori.
    expect(within(testaBanco).getByText('1')).toBeInTheDocument()
    expect(within(testaBanco).getByText('9,00 €')).toBeInTheDocument()
  })

  it('una colonna vuota resta a schermo, con lo zero', () => {
    // Sparire vorrebbe dire che le colonne ballano mentre si lavora, e chi
    // punta il dito dove stava «In preparazione» tocca un'altra cosa.
    render(<CorsieComande corsie={corsieComande()} />)
    const vuota = colonna('al-banco')
    expect(within(vuota).getByText('In preparazione')).toBeInTheDocument()
    expect(within(vuota).getByText('0')).toBeInTheDocument()
  })

  it('le colonne sono tante quante le corsie, e lo dice il CSS', () => {
    render(<CorsieStato corsie={corsieConti()} />)
    // Erano quattro fisse: con tre corsie restavano schiacciate a sinistra.
    expect(document.querySelector('.corsie').style.getPropertyValue('--corsie-n')).toBe('2')
  })
})

describe('i conti appena battuti stanno in cima alla prima colonna', () => {
  // Senza, chi batte un conto al POS torna in coda, non lo vede e lo
  // ribatte. Vale per tutte e due le lavagne: nella vista del banco la
  // comanda non c'è ancora (la fa il server), ma il conto sì.
  for (const [nome, disegna] of [
    ['conti', () => render(<CorsieStato corsie={corsieConti()} inArrivo={inArrivo} />)],
    ['banco', () => render(<CorsieComande corsie={corsieComande()} inArrivo={inArrivo} />)],
  ]) {
    it(`nella lavagna dei ${nome}`, () => {
      disegna()
      const prima = document.querySelectorAll('.corsia')[0]
      const volanti = prima.querySelectorAll('.corsia-card.in-arrivo')
      expect(volanti.length).toBe(2)
      expect(within(volanti[0]).getByText('#99')).toBeInTheDocument()
      expect(within(volanti[0]).getByText('in invio…')).toBeInTheDocument()
      // Quello che non è partito lo dice, e si può togliere di mezzo.
      expect(within(volanti[1]).getByText('non inviato')).toBeInTheDocument()
      expect(within(volanti[1]).getByText('niente rete')).toBeInTheDocument()
      expect(within(volanti[1]).getByRole('button', { name: 'Rimuovi' })).toBeInTheDocument()
    })
  }

  it('e non nella seconda: nascono dove nascono', () => {
    render(<CorsieStato corsie={corsieConti()} inArrivo={inArrivo} />)
    const seconda = document.querySelectorAll('.corsia')[1]
    expect(seconda.querySelectorAll('.corsia-card.in-arrivo').length).toBe(0)
  })
})

describe('il bollo dell’acconto è lo stesso di qua e di là', () => {
  // Qualcosa è già stato incassato ma il conto è aperto: senza dirlo sulla
  // card, chi porta il conto al tavolo chiede l'intero — ed è successo.
  const conAcconto = conto({ payment_status: 'parziale', paid_amount: 5 })

  it('sulla card del conto', () => {
    render(<CorsieStato corsie={corsieConti(conAcconto)} />)
    expect(screen.getByText('💳 Acconto')).toBeInTheDocument()
  })

  it('e sulla card della comanda', () => {
    render(<CorsieComande corsie={corsieComande(conAcconto)} />)
    expect(screen.getByText('💳 Acconto')).toBeInTheDocument()
  })
})

describe('il piede della card: il ⋯ e il tasto grande', () => {
  it('sui conti il tasto grande incassa, e il ⋯ apre le azioni nella card', async () => {
    const utente = userEvent.setup()
    const onIncassa = vi.fn()
    const onApriAzioni = vi.fn()
    render(
      <CorsieStato
        corsie={corsieConti()}
        azioni={() => <button>Annulla il conto</button>}
        onIncassa={onIncassa}
        onApriAzioni={onApriAzioni}
      />
    )
    await utente.click(screen.getByRole('button', { name: '⋯ Azioni' }))
    expect(onApriAzioni).toHaveBeenCalledWith('o41')
    await utente.click(screen.getByRole('button', { name: 'Incassa' }))
    expect(onIncassa).toHaveBeenCalledWith(expect.objectContaining({ id: 'o41' }))
  })

  it('sul banco il tasto grande avanza la comanda, e non apre la card', async () => {
    const utente = userEvent.setup()
    const onAvanza = vi.fn()
    const onApri = vi.fn()
    render(<CorsieComande corsie={corsieComande()} onAvanza={onAvanza} onApri={onApri} />)
    await utente.click(screen.getByRole('button', { name: 'In preparazione' }))
    expect(onAvanza).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'o41' }),
      expect.objectContaining({ id: 'c1' })
    )
    // Il tasto non è la card: toccandolo si fa quello che c'è scritto.
    expect(onApri).not.toHaveBeenCalled()
  })

  it('col pagamento ancora da fare il tasto è spento, e dice perché', async () => {
    render(<CorsieComande corsie={corsieComande()} attesaPagamento={() => true} />)
    const tasto = screen.getByRole('button', { name: 'In preparazione' })
    expect(tasto).toBeDisabled()
    expect(tasto).toHaveAttribute('title', 'In attesa del pagamento: non si prepara')
  })
})
