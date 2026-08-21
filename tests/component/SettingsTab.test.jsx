// @vitest-environment happy-dom
'use strict'

// IMPOSTAZIONI A SCHEDE. Erano venti riquadri uno sotto l'altro: per
// cambiare l'orario di chiusura si scorreva oltre pagamenti, gruppi,
// sconti e coperto. Ora ogni riquadro è una voce a sinistra — e si apre
// UNA sola alla volta, altrimenti non si è risolto niente.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

// LE IMPOSTAZIONI FINTE, in un oggetto che le prove possono ritoccare:
// alcune sezioni cambiano forma a seconda di come è messo il locale (col
// servizio spento spariscono le voci che parlano di «servire»). È
// `vi.hoisted` perché `vi.mock` viene issato in cima al file e non vedrebbe
// una costante normale definita qui fuori.
const impostazioni = vi.hoisted(() => ({
  menu_only: false,
  workflow_enabled: true,
  groups_enabled: false,
  customer_accounts_enabled: true,
  queue_view: 'tabs',
  service_mode: 'banco',
  cancel_phrase_default: 'bancone',
}))
const IMPOSTAZIONI_BASE = { ...impostazioni }

vi.mock('../../src/lib/api.js', () => {
  return {
    subscribeSettings: (cb) => {
      cb(impostazioni)
      return () => {}
    },
    updateSettings: vi.fn(() => Promise.resolve()),
    resetOpenOrdersToReceived: vi.fn(() => Promise.resolve(0)),
    replaceCatalog: vi.fn(() => Promise.resolve()),
    DEFAULT_SETTINGS: impostazioni,
    settingsIniziali: () => (impostazioni),
  }
})
vi.mock('../../src/lib/firebaseClient.js', () => ({ auth: { currentUser: null }, db: {} }))
vi.mock('../../src/lib/paymentsApi.js', () => ({
  pairSumUpReader: vi.fn(),
  unpairSumUpReader: vi.fn(),
}))
vi.mock('../../src/components/PrinterSetup.jsx', () => ({
  default: () => <div>PANNELLO STAMPANTE</div>,
}))
vi.mock('../../src/components/BackupPanel.jsx', () => ({
  default: () => <div>PANNELLO BACKUP</div>,
}))
vi.mock('../../src/components/InfoTab.jsx', () => ({
  default: () => <div>PANNELLO INFORMAZIONI</div>,
}))
vi.mock('../../src/components/ThemeSettings.jsx', () => ({
  default: () => <div>PANNELLO ASPETTO</div>,
  TemaMenuClienti: () => <div>COLORI MENÙ CLIENTI</div>,
}))

import { MemoryRouter } from 'react-router-dom'
import SettingsTab from '../../src/components/SettingsTab.jsx'
import { subscribeSottosezioni } from '../../src/lib/sottosezioni.js'
import { useEffect, useState } from 'react'

// LE SEZIONI STANNO NEL MENU A SCOMPARSA, sotto la pagina aperta: qui si
// rifà quel pezzetto di menu, così le prove restano quelle di prima —
// «scelgo una sezione, si apre il suo riquadro» — invece di frugare nella
// tubatura.
function BarraSezioni() {
  const [sotto, setSotto] = useState({ voci: [], attiva: null, scegli: null })
  useEffect(() => subscribeSottosezioni(setSotto), [])
  return (
    <div>
      {(sotto.voci || []).map((v) => (
        <button key={v.id} onClick={() => sotto.scegli?.(v.id)}>
          {v.icona} {v.label}
        </button>
      ))}
    </div>
  )
}

// Col MemoryRouter: coi riquadri impilati per gruppo, in pagina finiscono
// anche card che contengono dei Link (es. lo storico notifiche nel
// profilo), e un Link senza router fa esplodere il render.
const mostra = (props = { role: 'admin' }) =>
  render(
    <MemoryRouter>
      <SettingsTab {...props} />
      <BarraSezioni />
    </MemoryRouter>
  )

beforeEach(() => {
  localStorage.clear()
  Object.assign(impostazioni, IMPOSTAZIONI_BASE)
})

describe('impostazioni a schede', () => {
  it('si apre una sezione sola, non la pagina intera', async () => {
    mostra()
    expect(screen.getByText('PANNELLO ASPETTO')).toBeInTheDocument()
    // I riquadri delle altre sezioni NON sono in pagina.
    expect(screen.queryByRole('heading', { name: 'Pagamenti' })).toBeNull()
    expect(screen.queryByText('PANNELLO STAMPANTE')).toBeNull()
  })

  it('scegliendo un gruppo si aprono i SUOI riquadri, impilati, e si chiude il precedente', async () => {
    // Le voci del sottomenu sono GRUPPI («a cosa afferisce» l'impostazione):
    // un gruppo mostra tutti i riquadri che ha assorbito, uno sotto l'altro.
    const user = userEvent.setup()
    mostra()
    await user.click(screen.getByRole('button', { name: /Cassa e giornata/ }))
    expect(screen.getByRole('heading', { name: 'Pagamenti' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Giornata/ })).toBeInTheDocument()
    expect(screen.queryByText('PANNELLO ASPETTO')).toBeNull()

    await user.click(screen.getByRole('button', { name: /Stampante/ }))
    expect(screen.getByText('PANNELLO STAMPANTE')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Pagamenti' })).toBeNull()
  })

  it('il gruppo aperto si ricorda: a impostazioni si torna per lo stesso motivo', async () => {
    const user = userEvent.setup()
    const primo = mostra()
    await user.click(screen.getByRole('button', { name: /Prezzi e supplementi/ }))
    expect(screen.getByRole('heading', { name: 'Coperto' })).toBeInTheDocument()
    primo.unmount()

    mostra()
    expect(screen.getByRole('heading', { name: 'Coperto' })).toBeInTheDocument()
  })

  it('le voci del sottomenu sono GRUPPI, non ventitré sezioni', () => {
    mostra()
    for (const voce of [
      'Aspetto',
      'Menù clienti',
      'Gestione menù',
      'Catalogo prodotti',
      'Banco: coda e ordine',
      'Servizio',
      'Cassa e giornata',
      'Prezzi e supplementi',
      'Gruppi di ordini',
      'Clienti',
      'Stampante',
      'Sistema',
    ]) {
      expect(screen.getByRole('button', { name: new RegExp(voce) })).toBeInTheDocument()
    }
  })

  it('nei gruppi non si è perso nessun riquadro per strada', async () => {
    // L'accorpamento sposta, non elimina: ogni gruppo deve contenere le
    // intestazioni dei riquadri che ha assorbito.
    const user = userEvent.setup()
    mostra()
    const attese = [
      ['Menù clienti', [/Menù clienti/]],
      ['Gestione menù', [/Gestione menù/]],
      ['Catalogo prodotti', [/Catalogo/]],
      ['Banco: coda e ordine', [/Coda ordini/, /Vista ordine/]],
      [/Servizio$/, [/Consegna/, /preparazione/, /Tempi di servizio/, /Annullamenti/]],
      ['Cassa e giornata', [/Pagamenti/, /Giornata/]],
      ['Prezzi e supplementi', [/Prezzo consigliato/, /Sconto/, /^Coperto$/, /Servizio e mancia/]],
      ['Clienti', [/Account clienti/, /Posizione/, /Notifiche/]],
    ]
    for (const [gruppo, headings] of attese) {
      await user.click(screen.getByRole('button', { name: gruppo instanceof RegExp ? gruppo : new RegExp(gruppo) }))
      for (const h of headings) {
        expect(screen.getByRole('heading', { name: h })).toBeInTheDocument()
      }
    }
    // Sistema: backup e informazioni (qui i pannelli sono finti, si vede
    // il segnaposto).
    await user.click(screen.getByRole('button', { name: /Sistema/ }))
    expect(screen.getByText('PANNELLO BACKUP')).toBeInTheDocument()
    expect(screen.getByText('PANNELLO INFORMAZIONI')).toBeInTheDocument()
  })
})

// ── Come si comporta la ricerca nella coda ────────────────────────────
// Chi lavora al banco ha due abitudini diverse: c'è chi vuole la coda
// ripulita e chi vuole vederla tutta e sapere solo DOVE sta il conto.
// Non si sceglie per lui: l'interruttore sta qui, nelle impostazioni.
describe('la ricerca della coda: filtra o accende', () => {
  it('di suo filtra, come è sempre stato', async () => {
    const user = userEvent.setup()
    mostra()
    await user.click(screen.getByRole('button', { name: /Banco: coda e ordine/ }))
    expect(screen.getByRole('button', { name: /Filtra la coda/ })).toHaveClass('active')
    expect(screen.getByRole('button', { name: /Accendi il conto e portami lì/ })).not.toHaveClass('active')
  })

  it('si può passare ad accendere il conto trovato', async () => {
    const user = userEvent.setup()
    const { updateSettings } = await import('../../src/lib/api.js')
    mostra()
    await user.click(screen.getByRole('button', { name: /Banco: coda e ordine/ }))
    await user.click(screen.getByRole('button', { name: /Accendi il conto e portami lì/ }))
    expect(updateSettings).toHaveBeenCalledWith(expect.objectContaining({ queue_search: 'evidenzia' }))
  })
})

// LA VISTA DEL BANCO STA QUI, accanto a quella della coda: è
// un'impostazione del LOCALE, non di chi guarda. Ad accenderla sono gli
// stati del servizio — senza quei passi non ci sarebbe niente da mostrare —
// e qui si sceglie soltanto come disegnarla.
describe('la vista del banco', () => {
  it('è una lista di viste possibili, e di suo è «corsie di stato»', async () => {
    // Non un interruttore: quando se ne aggiungerà un'altra il valore già
    // scritto su settings/bar resta buono, senza migrazioni.
    const user = userEvent.setup()
    mostra()
    await user.click(screen.getByRole('button', { name: /Banco: coda e ordine/ }))
    const titolo = screen.getByText('La vista del banco')
    // «corsie di stato» è anche una delle viste della CODA: qui si guarda
    // la fila di voci che sta sotto questo titolo, non quella sopra.
    const suoi = [
      ...titolo.nextElementSibling.nextElementSibling.querySelectorAll('button'),
    ]
    expect(suoi.map((b) => b.textContent)).toEqual(['🚦 Corsie di stato'])
    expect(suoi[0]).toHaveClass('active')
    expect(suoi[0]).toBeEnabled()
  })
})

// ── I DUE TASTI DEL PAGAMENTO SI ACCENDONO IN «PAGAMENTI» ───────────
//
// «Metti che anche il tasto "riscuoti e servi" è opzionale nelle
// impostazioni» (l'utente, 21/08/2026). L'impostazione c'era già: stava in
// «Gestione preparazione» e non l'ha trovata. È lo STESSO inciampo del
// 20/08 con «Riscuoti senza stampa», che stava nello stesso posto
// sbagliato per la stessa parentela di forma.
// Chi cerca un tasto della schermata di pagamento apre Pagamenti. I due
// tasti compaiono nella stessa schermata, affiancati: si accendono nello
// stesso posto.
describe('gli interruttori dei tasti di incasso stanno in Pagamenti', () => {
  const apriPagamenti = async (user) =>
    user.click(screen.getByRole('button', { name: /Cassa e giornata/ }))
  // Il riquadro che contiene una certa riga: si risale dalla scritta al
  // suo `.settings-section`, così la prova dice «in QUALE sezione sta» e
  // non solo «c'è da qualche parte in pagina».
  const sezioneDi = (testo) =>
    screen.getByText(testo).closest('.settings-section').querySelector('h3').textContent

  it('«incassare e servire insieme» sta accanto al suo gemello, in Pagamenti', async () => {
    const user = userEvent.setup()
    mostra()
    await apriPagamenti(user)
    expect(sezioneDi('Un tasto per incassare e servire insieme')).toBe('Pagamenti')
    expect(sezioneDi('Un tasto per incassare senza stampare')).toBe('Pagamenti')
  })

  it('e non è rimasto un doppione in «Gestione preparazione»', async () => {
    const user = userEvent.setup()
    mostra()
    await user.click(screen.getByRole('button', { name: /Servizio$/ }))
    expect(screen.getByRole('heading', { name: /preparazione/ })).toBeInTheDocument()
    expect(screen.queryByText('Un tasto per incassare e servire insieme')).toBeNull()
  })

  it('col servizio spento l’interruttore non c’è: «servire» non esiste', async () => {
    // La condizione se l'è portata dietro dal trasloco. Senza i passi del
    // servizio quel tasto non comparirebbe comunque in cassa, e un
    // interruttore che non fa niente è peggio di uno assente.
    // Il gemello «senza stampa» invece resta: con la stampa il servizio
    // non c'entra niente.
    impostazioni.workflow_enabled = false
    const user = userEvent.setup()
    mostra()
    await apriPagamenti(user)
    expect(screen.queryByText('Un tasto per incassare e servire insieme')).toBeNull()
    expect(screen.getByText('Un tasto per incassare senza stampare')).toBeInTheDocument()
  })
})
