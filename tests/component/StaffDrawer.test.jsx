// @vitest-environment happy-dom
'use strict'

// Il MENU laterale del gestionale: quello che si tocca cinquanta volte a
// sera. I gruppi occupavano mezzo menu e spingevano fuori le ultime voci,
// e non c'era modo di vedere a nome di chi si stava battendo.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route } from 'react-router-dom'
import { MemoryRouter } from '../helpers/router.jsx'
import '@testing-library/jest-dom/vitest'
import { CON_LICENZA } from '../helpers/licenza.js'

// La licenza delle prove: quella della Tana, o una che dice dov'è la regia.
const filo = vi.hoisted(() => ({ licenza: null, getIdToken: null }))

vi.mock('../../src/lib/firebaseClient.js', () => ({
  auth: {
    currentUser: {
      uid: 'a1',
      email: 'capo@bar.it',
      displayName: 'Capo Bar',
      getIdToken: (...a) => filo.getIdToken(...a),
    },
  },
}))
vi.mock('../../src/lib/logout.js', () => ({ logoutStaff: vi.fn() }))
vi.mock('../../src/dev/devActions.js', () => ({ devToolsEnabled: false }))
vi.mock('../../src/lib/toast.js', async (orig) => ({ ...(await orig()), toastError: vi.fn() }))
vi.mock('../../src/lib/api.js', () => ({
  DEFAULT_SETTINGS: { groups_enabled: false, groups_in_drawer: false },
  settingsIniziali: () => ({ groups_enabled: false, groups_in_drawer: false }),
  subscribeSettings: vi.fn((cb) => {
    cb({ ...CON_LICENZA, ...(filo.licenza ? { licenza: filo.licenza } : {}), groups_enabled: true, groups_in_drawer: true })
    return () => {}
  }),
  subscribeOpenGroups: vi.fn((cb) => {
    cb([{ id: 'g1', name: 'SumUp Test', kind: 'manual' }])
    return () => {}
  }),
  createManualGroup: vi.fn(),
  chiamaIlBancone: (...a) => chiamaIlBancone(...a),
  subscribeMieChiamateAlBancone: (uid, cb) => {
    emettiMie = cb
    cb([])
    return () => {}
  },
}))
const chiamaIlBancone = vi.fn(() => 'chiamata-1')
let emettiMie = null

import StaffDrawer from '../../src/components/StaffDrawer.jsx'
import { Sottosezioni } from '../../src/lib/sottosezioni.js'

function apri(role = 'admin') {
  const r = render(
    <MemoryRouter initialEntries={['/bar']}>
      <Routes>
        <Route path="/bar" element={<StaffDrawer role={role} />} />
        <Route path="/profilo-staff" element={<div>PAGINA PROFILO</div>} />
        <Route path="/pos" element={<div>PAGINA POS</div>} />
        <Route path="/menu" element={<div>PAGINA MENU</div>} />
      </Routes>
    </MemoryRouter>
  )
  return r
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  filo.licenza = null
  filo.getIdToken = vi.fn(async (rinnova) => (rinnova ? 'token-rinnovato' : 'token-vecchio'))
})

describe('menu laterale', () => {
  it('i gruppi partono chiusi e si aprono a richiesta', async () => {
    apri()
    expect(screen.getByRole('button', { name: /Gruppi/ })).toBeInTheDocument()
    expect(screen.queryByTitle('SumUp Test')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: /Gruppi/ }))
    expect(screen.getByTitle('SumUp Test')).toBeInTheDocument()
  })

  it('riaperto il menu, i gruppi restano come li avevi lasciati', async () => {
    const primo = apri()
    await userEvent.click(screen.getByRole('button', { name: /Gruppi/ }))
    primo.unmount()
    apri()
    expect(screen.getByTitle('SumUp Test')).toBeInTheDocument()
  })

  it('in fondo c’è chi è collegato, col suo ruolo, e apre il profilo', async () => {
    apri('admin')
    expect(screen.getByText('Capo Bar')).toBeInTheDocument()
    expect(screen.getByText('Admin')).toBeInTheDocument()
    await userEvent.click(screen.getByText('Capo Bar'))
    expect(screen.getByText('PAGINA PROFILO')).toBeInTheDocument()
  })

  it('la stampante non è più una voce di menu, gli utenti sì', () => {
    apri()
    expect(screen.queryByText('Stampante')).toBeNull()
    expect(screen.getByText('Utenti e ruoli')).toBeInTheDocument()
    // "Vista cliente" era un tasto in barra: la navigazione sta nel menu.
    expect(screen.getByText('Vista cliente')).toBeInTheDocument()
    expect(screen.getByText('Staff')).toBeInTheDocument()
  })

  it('lo staff di sala non vede il gestionale, ma lavora sulla stessa coda', () => {
    apri('staff')
    expect(screen.queryByText('Utenti e ruoli')).toBeNull()
    // La home della sala è la coda del banco; «I miei ordini» non è più
    // una pagina (è il filtro «Miei» della coda), «Da servire» resta.
    expect(screen.getByText('Coda ordini')).toBeInTheDocument()
    expect(screen.getByText('Da servire')).toBeInTheDocument()
    expect(screen.queryByText('I miei ordini')).toBeNull()
    expect(screen.getByText('Staff')).toBeInTheDocument() // il suo ruolo, in fondo
  })

  // REQ-STAMPA-020: la sala si collega da sé alla stampante.
  it('la sala ha la sua voce «Stampante»; il gestore la trova nelle impostazioni', () => {
    apri('staff')
    expect(screen.getByText('Stampante')).toBeInTheDocument()
  })

  // REQ-STAFF-019. Flavio, 30/10/2026: lo staff «può solo ricevere una
  // chiamata dal bancone ma non può effettuarla».
  it('la sala chiama il bancone, e finché non risponde è in attesa', async () => {
    apri('staff')
    await userEvent.click(screen.getByText('Chiama il bancone'))
    expect(chiamaIlBancone).toHaveBeenCalledTimes(1)
    expect(chiamaIlBancone).toHaveBeenCalledWith(
      expect.objectContaining({ from_uid: 'a1', from_name: 'Capo Bar', from_email: 'capo@bar.it' })
    )
    expect(screen.getByText('In attesa del bancone…')).toBeInTheDocument()
    // Un secondo tocco non manda un'altra chiamata.
    await userEvent.click(screen.getByText('In attesa del bancone…'))
    expect(chiamaIlBancone).toHaveBeenCalledTimes(1)
    // Il bancone risponde: la voce torna a chiamare.
    act(() => emettiMie([]))
    expect(screen.getByText('Chiama il bancone')).toBeInTheDocument()
  })

  it('al banco la voce non c’è: il bancone è lui', () => {
    apri('admin')
    expect(screen.queryByText('Chiama il bancone')).toBeNull()
    apri('bartender')
    expect(screen.queryByText('Chiama il bancone')).toBeNull()
  })

  it('la sala ordina dal menù, e la cassa non la vede', async () => {
    // Il POS è lo strumento del banco: la sala ordina dal menù che sta
    // mostrando al tavolo, con la ricerca.
    apri('staff')
    expect(screen.queryByText('Nuovo ordine')).toBeNull()
    await userEvent.click(screen.getByText('Ordina dal menù'))
    expect(screen.getByText('PAGINA MENU')).toBeInTheDocument()
  })

  // ── IL BILANCIO È DELL'ADMIN ───────────────────────────────────────
  // I conti del locale li guarda chi il locale lo paga. Prima il menu si
  // filtrava tutto con `isGestore`, che tiene dentro anche il bartender:
  // questa è la prima voce che vuole un filtro più stretto.
  it('«Bilancio» lo vede l’admin', () => {
    apri('admin')
    expect(screen.getByText('Bilancio')).toBeInTheDocument()
  })

  it('al bartender la voce «Bilancio» non compare', () => {
    apri('bartender')
    expect(screen.queryByText('Bilancio')).toBeNull()
    // Il resto del gestionale resta suo.
    expect(screen.getByText('Cassa')).toBeInTheDocument()
    expect(screen.getByText('Magazzino')).toBeInTheDocument()
  })

  it('per il gestore «Nuovo ordine» apre il POS', async () => {
    apri('admin')
    await userEvent.click(screen.getByText('Nuovo ordine'))
    expect(screen.getByText('PAGINA POS')).toBeInTheDocument()
  })

  it('anche il banco ordina dal menù, se vuole (BUG-127)', async () => {
    // L'utente, 02/11/2026: «Ordina dal menù» c'è per staff, bartender e
    // admin. Prima il banco ci arrivava solo da un tasto della coda a
    // elenco, chiamato per sbaglio «Vista cliente».
    apri('bartender')
    await userEvent.click(screen.getByText('Ordina dal menù'))
    expect(screen.getByText('PAGINA MENU')).toBeInTheDocument()
  })
})

// ── IL MENU AGGANCIATO ALLA PAGINA ───────────────────────────────────
// Dove la pagina ha sezioni sue (Impostazioni, Inventario) il menu resta
// aperto dentro la pagina: si salta da una sezione all'altra venti volte di
// seguito, e un menu che copre vuol dire aprirlo, cercare, scegliere — e
// intanto non vedere piu' dove si era. Chi vuole tutta la larghezza lo
// chiude, e resta chiuso anche domani.
describe('il menu agganciato alla pagina', () => {
  const SEZIONI = [
    { id: 'aspetto', icona: '🎨', label: 'Aspetto' },
    { id: 'stampante', icona: '🖨️', label: 'Stampante' },
  ]

  function conSezioni(voci = SEZIONI) {
    return render(
      <MemoryRouter initialEntries={['/bar']}>
        <StaffDrawer role="admin" active="impostazioni" />
        <Sottosezioni voci={voci} attiva="aspetto" scegli={() => {}} />
      </MemoryRouter>
    )
  }

  it('con le sezioni della pagina il menu e’ gia’ aperto, senza toccare niente', () => {
    conSezioni()
    expect(document.body.classList.contains('drawer-agganciato')).toBe(true)
    expect(document.querySelector('.bar-sidebar.agganciata')).toBeTruthy()
  })

  // LA MANIGLIA. Le voci sono parole corte, le sottosezioni no —
  // «Marginalità listino» a 178px si taglia — e su un monitor grande quella
  // colonna stretta è spazio sprecato. Cresce tutto insieme, testo
  // compreso: una colonna larga con la scritta piccola sembra rotta.
  it('il menu agganciato si allarga tirando il bordo, e se lo ricorda', () => {
    conSezioni()
    const menu = document.querySelector('.bar-sidebar.agganciata')
    const maniglia = document.querySelector('.bar-sidebar-maniglia')
    expect(maniglia).toBeTruthy()
    expect(menu.style.width).toBe('178px')

    fireEvent.pointerDown(maniglia, { clientX: 200 })
    fireEvent.pointerMove(maniglia, { clientX: 300 })
    fireEvent.pointerUp(maniglia, { clientX: 300 })

    expect(document.querySelector('.bar-sidebar.agganciata').style.width).toBe('278px')
    // Il testo cresce con la colonna.
    expect(parseFloat(document.querySelector('.bar-sidebar.agganciata').style.fontSize)).toBeGreaterThan(0.85)
    expect(localStorage.getItem('drink:menu-largo')).toBe('278')
  })

  it('non si può tirare oltre misura: mezza pagina di menu non serve a nessuno', () => {
    conSezioni()
    const maniglia = document.querySelector('.bar-sidebar-maniglia')
    fireEvent.pointerDown(maniglia, { clientX: 200 })
    fireEvent.pointerMove(maniglia, { clientX: 2000 })
    fireEvent.pointerUp(maniglia, { clientX: 2000 })
    expect(document.querySelector('.bar-sidebar.agganciata').style.width).toBe('360px')
  })

  it('doppio clic sulla maniglia: si torna alla misura di partenza', () => {
    localStorage.setItem('drink:menu-largo', '300')
    conSezioni()
    expect(document.querySelector('.bar-sidebar.agganciata').style.width).toBe('300px')
    fireEvent.doubleClick(document.querySelector('.bar-sidebar-maniglia'))
    expect(document.querySelector('.bar-sidebar.agganciata').style.width).toBe('178px')
  })

  it('sulle pagine senza sezioni resta a scomparsa: la coda non perde una colonna', () => {
    render(
      <MemoryRouter initialEntries={['/bar']}>
        <StaffDrawer role="admin" active="coda" />
      </MemoryRouter>
    )
    expect(document.body.classList.contains('drawer-agganciato')).toBe(false)
  })

  // SI APRE E SI CHIUDE COL ☰, come ovunque: non c'è un secondo tasto per
  // «agganciarlo». A chi lavora interessa che il menu ci sia o non ci sia;
  // che resti dentro la pagina invece di coprirla è come si presenta.
  const tocca = () => act(() => { window.dispatchEvent(new Event('drink:toggle-drawer')) })

  it('il ☰ lo chiude e lo riapre, sempre dentro la pagina', () => {
    conSezioni()
    tocca()
    expect(document.body.classList.contains('drawer-agganciato')).toBe(false)
    // Chiuso vuol dire chiuso: non ricompare come pannello che copre.
    expect(document.querySelector('.bar-sidebar.open')).toBeNull()
    tocca()
    expect(document.body.classList.contains('drawer-agganciato')).toBe(true)
  })

  it('chiuso una volta, resta chiuso anche la volta dopo', () => {
    const primo = conSezioni()
    tocca()
    primo.unmount()
    conSezioni()
    expect(document.body.classList.contains('drawer-agganciato')).toBe(false)
  })

  it('dove non si aggancia, il ☰ apre il pannello come sempre', () => {
    render(
      <MemoryRouter initialEntries={['/bar']}>
        <StaffDrawer role="admin" active="coda" />
      </MemoryRouter>
    )
    tocca()
    expect(document.querySelector('.bar-sidebar.open')).toBeTruthy()
    expect(document.body.classList.contains('drawer-agganciato')).toBe(false)
  })
})

// ── IL ☰ FLOTTANTE SI PUÒ SPEGNERE ───────────────────────────────────
//
// Serve alle schermate a tutto schermo che una testata loro non ce l'hanno.
// Dove la testata c'è — la lavagna della coda — il ☰ sta lì dentro, nel
// flusso, e questo va spento: due ☰ sulla stessa schermata sono uno di
// troppo, e uno fisso sopra una pagina che scorre finisce addosso a quello
// che scorre («il tasto menu va a finire sulla label», l'utente 21/08/2026).
describe('il ☰ flottante del menu laterale', () => {
  it('di suo c’è: le schermate senza testata si aprono il menu da lì', () => {
    render(
      <MemoryRouter initialEntries={['/bar']}>
        <StaffDrawer role="admin" active="coda" />
      </MemoryRouter>
    )
    expect(document.querySelector('.bar-burger')).toBeTruthy()
  })

  it('e si spegne per chi il ☰ ce l’ha già in testata', () => {
    render(
      <MemoryRouter initialEntries={['/bar']}>
        <StaffDrawer role="admin" active="coda" flottante={false} />
      </MemoryRouter>
    )
    expect(document.querySelector('.bar-burger')).toBeNull()
    // il menu resta apribile dall'evento: è lo stesso tasto, altrove
    expect(document.querySelector('.bar-sidebar')).toBeTruthy()
  })
})

// «AREA CLIENTI» (REQ-FLOTTA-030): il titolare passa alla sua area nella
// regia già entrato. Il tasto c'è per l'admin quando la build conosce la
// regia e la licenza dice dov'è; prima che la regia scriva la licenza della
// Tana, non c'è.
describe('«Area clienti», verso la regia', () => {
  const LICENZA_DELLA_REGIA = { ...CON_LICENZA.licenza, regia_url: 'https://regia.example/area' }

  beforeEach(() => vi.stubEnv('VITE_REGIA_PROGETTO', 'drink-regia-test'))
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('senza la regia nella licenza non c’è', () => {
    apri('admin')
    expect(screen.queryByText('Area clienti')).toBeNull()
  })

  it('al bartender non c’è', () => {
    filo.licenza = LICENZA_DELLA_REGIA
    apri('bartender')
    expect(screen.queryByText('Area clienti')).toBeNull()
  })

  it('al titolare manda il token rinnovato e apre l’area', async () => {
    const user = userEvent.setup()
    filo.licenza = LICENZA_DELLA_REGIA
    const prendi = vi.fn(async () => ({ status: 200, json: async () => ({ url: 'https://regia.example/area?t=1' }) }))
    vi.stubGlobal('fetch', prendi)
    const vai = vi.spyOn(window.location, 'assign').mockImplementation(() => {})
    apri('admin')
    await user.click(screen.getByText('Area clienti'))
    await vi.waitFor(() => expect(vai).toHaveBeenCalledWith('https://regia.example/area?t=1'))
    expect(filo.getIdToken).toHaveBeenCalledWith(true)
    const [url, opzioni] = prendi.mock.calls[0]
    expect(url).toBe('https://europe-west1-drink-regia-test.cloudfunctions.net/passaggioVersoRegia')
    expect(opzioni.headers.Authorization).toBe('Bearer token-rinnovato')
    vai.mockRestore()
  })

  it('se la regia dice di no, lo dice in una riga e resta qui', async () => {
    const user = userEvent.setup()
    filo.licenza = LICENZA_DELLA_REGIA
    vi.stubGlobal('fetch', vi.fn(async () => ({ status: 403, json: async () => null })))
    const { toastError } = await import('../../src/lib/toast.js')
    apri('admin')
    await user.click(screen.getByText('Area clienti'))
    await vi.waitFor(() => expect(toastError).toHaveBeenCalledWith('L’area clienti è riservata al titolare del locale, con la sua email.'))
  })
})
