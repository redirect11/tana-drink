// @vitest-environment happy-dom
'use strict'

// LE IMPOSTAZIONI IN INGLESE (REQ-UI-039). La lingua del gestionale la
// sceglie chiunque, sul suo profilo, e le impostazioni sono la parte del
// gestionale con più testo: descrizioni di ogni interruttore, avvisi,
// dialoghi. Qui si aprono in inglese i gruppi che si usano di più — il
// banco (coda), la cassa (pagamenti, stampa automatica, giornata), l'aspetto,
// il locale, il sistema (backup) — più il pannello della stampante, e si
// chiede cosa è rimasto in italiano.
//
// Le prove in italiano (SettingsTab, StampaAutomatica, PrinterSetupSala…)
// restano quelle di sempre: l'italiano è la lingua di partenza e i suoi
// testi non sono cambiati. Questa guarda solo l'altra lingua.
//
// Cosa resta fuori, apposta: la carta (prova di stampa, righe stampate) e le
// frasi che arrivano al CLIENTE — la frase d'annullo, che la pagina del
// cliente mostra in italiano — segnate lang="it". E i dati: i dati finti
// del locale qui non hanno parole italiane («Bar Mario», numeri), perché il
// controllo cerca proprio quelle.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect, useState } from 'react'
import { MemoryRouter } from '../helpers/router.jsx'
import '@testing-library/jest-dom/vitest'
import { italianoRimasto } from '../helpers/nienteItaliano.js'
import { LICENZA_TANA } from '../helpers/licenza.js'

const impostazioni = vi.hoisted(() => ({ corrente: {} }))

vi.mock('../../src/lib/api.js', () => ({
  subscribeSettings: (cb) => {
    cb(impostazioni.corrente)
    return () => {}
  },
  updateSettings: vi.fn(() => Promise.resolve()),
  resetOpenOrdersToReceived: vi.fn(() => Promise.resolve(0)),
  replaceCatalog: vi.fn(() => Promise.resolve()),
  savePrinterConfig: vi.fn(() => Promise.resolve()),
  DEFAULT_SETTINGS: {},
  settingsIniziali: () => impostazioni.corrente,
}))
vi.mock('../../src/lib/firebaseClient.js', () => ({ auth: { currentUser: { uid: 'u1' } }, db: {} }))
vi.mock('../../src/lib/paymentsApi.js', () => ({ pairSumUpReader: vi.fn(), unpairSumUpReader: vi.fn() }))
// Il changelog arriva dalla rete: qui non arriva mai, e le Informazioni
// restano sul «carico».
vi.mock('../../src/lib/novita.js', async (orig) => ({ ...(await orig()), caricaChangelog: () => new Promise(() => {}) }))
// I segnaposti del riquadro «Il locale» sono i dati della build (nome,
// indirizzo, «chi siamo» della Tana): dati, non testi dell'interfaccia.
vi.mock('../../src/lib/venue.js', async (orig) => ({
  ...(await orig()),
  venuePredefinito: () => ({ venue_name: 'Bar Mario', venue_city: 'Rome', venue_socials: [] }),
}))

import SettingsTab from '../../src/components/SettingsTab.jsx'
import PrinterSetup from '../../src/components/PrinterSetup.jsx'
import { subscribeSottosezioni } from '../../src/lib/sottosezioni.js'
import { impostaLingua } from '../../src/lib/lingua.js'

// Le voci del sottomenu, come le disegna la barra in alto (vedi
// SettingsTab.test.jsx): anche loro vanno lette in inglese.
function BarraSezioni() {
  const [sotto, setSotto] = useState({ voci: [], scegli: null })
  useEffect(() => subscribeSottosezioni(setSotto), [])
  return (
    <nav>
      {sotto.voci.map((v) => (
        <button key={v.id} onClick={() => sotto.scegli?.(v.id)}>
          {v.label}
        </button>
      ))}
    </nav>
  )
}

const mostra = () =>
  render(
    <MemoryRouter>
      <BarraSezioni />
      <SettingsTab role="admin" />
    </MemoryRouter>
  )

// Il riquadro col titolo dato: la prova guarda quello, e non i vicini.
const riquadro = (titolo) => screen.getByRole('heading', { name: titolo }).closest('.settings-section')

beforeEach(() => {
  localStorage.clear()
  impostaLingua('en')
  // Un locale che paga, con SumUp e il lettore accesi: così la sezione dei
  // pagamenti mostra tutti i suoi interruttori, e non la riga del piano.
  impostazioni.corrente = {
    licenza: LICENZA_TANA,
    workflow_enabled: true,
    queue_view: 'corsie',
    service_mode: 'entrambi',
    payments_online_enabled: true,
    payments_reader_enabled: true,
    business_day_cutoff_hour: 5,
    orario_apertura: '18:30',
    orario_chiusura: '03:30',
  }
})

afterEach(() => {
  impostaLingua('it')
})

describe('le impostazioni in inglese (REQ-UI-039)', () => {
  it('le voci del sottomenu e il primo gruppo, l’aspetto', () => {
    const { container } = mostra()
    expect(screen.getByRole('button', { name: 'Bar: queue and order' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Theme marketplace' })).toBeInTheDocument()
    expect(italianoRimasto(container)).toEqual([])
  })

  it('il locale', async () => {
    const user = userEvent.setup()
    const { container } = mostra()
    await user.click(screen.getByRole('button', { name: 'The venue' }))
    expect(screen.getByRole('heading', { name: 'The venue' })).toBeInTheDocument()
    expect(italianoRimasto(container)).toEqual([])
  })

  it('la coda ordini, con la vista ordine e le strisce delle card', async () => {
    const user = userEvent.setup()
    const { container } = mostra()
    await user.click(screen.getByRole('button', { name: 'Bar: queue and order' }))
    const coda = riquadro('Order queue')
    expect(within(coda).getByRole('button', { name: /Filter the queue/ })).toBeInTheDocument()
    // La «Vista ordine» accanto mostra i modi della striscia delle card, che
    // vengono da lib/strisce.js (MODI_STRISCIA): tradotti dove nascono.
    expect(screen.getAllByText('Product colour').length).toBeGreaterThan(0)
    expect(italianoRimasto(container)).toEqual([])
  })

  it('cassa e giornata: pagamenti, stampa automatica, giornata di lavoro', async () => {
    const user = userEvent.setup()
    const { container } = mostra()
    await user.click(screen.getByRole('button', { name: 'Till and day' }))
    expect(screen.getByRole('heading', { name: 'Payments' })).toBeInTheDocument()
    expect(screen.getByText('SumUp Solo card reader')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Business day' })).toBeInTheDocument()
    expect(italianoRimasto(container)).toEqual([])
  })

  it('il sistema: backup e informazioni', async () => {
    const user = userEvent.setup()
    const { container } = mostra()
    await user.click(screen.getByRole('button', { name: 'System' }))
    expect(screen.getByRole('heading', { name: /Backup and restore/ })).toBeInTheDocument()
    expect(italianoRimasto(container)).toEqual([])
  })

  // Gli altri gruppi che non mostrano tabelle di src/lib. La frase d'annullo
  // (in «Servizio») va al cliente e resta italiana, segnata lang="it".
  it.each([
    ['Service', 'Order delivery'],
    ['Prices and surcharges', 'Suggested price'],
    ['Order groups', 'Order groups'],
    ['Customers', 'Venue location'],
    ['Product catalogue', 'Product catalogue'],
  ])('il gruppo «%s»', async (gruppo, titolo) => {
    impostazioni.corrente = { ...impostazioni.corrente, groups_enabled: true, geofence_enabled: true }
    const user = userEvent.setup()
    const { container } = mostra()
    await user.click(screen.getByRole('button', { name: gruppo }))
    expect(screen.getByRole('heading', { name: titolo })).toBeInTheDocument()
    expect(italianoRimasto(container)).toEqual([])
  })

  // I gruppi fatti delle tabelle di src/lib: i campi di scontrino, comanda
  // e acconto e il logo (campiStampa.js), da dove si stampa (printer.js);
  // formato dei prezzi e stili del menù (prezzoMenu.js, stileMenu.js); le
  // funzioni premium (licenza.js).
  it.each([
    ['Printer', 'Logo on prints', 'Column headings'],
    ['Customer menu', 'Prices in the menu', 'Number with cents'],
    ['Licence', 'Premium features', 'Inventory and suppliers'],
  ])('il gruppo «%s», con le sue tabelle', async (gruppo, titolo, voce) => {
    const user = userEvent.setup()
    const { container } = mostra()
    await user.click(screen.getByRole('button', { name: gruppo }))
    expect(screen.getAllByText(titolo).length).toBeGreaterThan(0)
    expect(screen.getAllByText(voce).length).toBeGreaterThan(0)
    expect(italianoRimasto(container)).toEqual([])
  })

  // Un locale Free: i limiti del piano in chiaro (limiti.js, limitiInChiaro)
  // e le frasi del piano dove una funzione manca (MESSAGGI_PIANO).
  it('la licenza di un locale Free, coi suoi limiti', async () => {
    impostazioni.corrente = {
      ...impostazioni.corrente,
      licenza: {
        piano: 'free',
        moduli: {},
        limiti: { prodotti_max: 10, conti_aperti_max: 5, sconti: false, storico_giorni: 7, utenti_max: 1, stampa: false },
      },
    }
    const user = userEvent.setup()
    const { container } = mostra()
    await user.click(screen.getByRole('button', { name: 'Licence' }))
    expect(screen.getByText('Products on the price list: at most 10')).toBeInTheDocument()
    expect(screen.getByText('History available: the last 7 days')).toBeInTheDocument()
    expect(italianoRimasto(container)).toEqual([])
  })

  it('la stampante, per chi la gestisce e per chi la usa soltanto', () => {
    const gestore = render(<PrinterSetup />)
    expect(italianoRimasto(gestore.container)).toEqual([])
    gestore.unmount()
    const sala = render(<PrinterSetup gestore={false} />)
    expect(italianoRimasto(sala.container)).toEqual([])
  })
})
