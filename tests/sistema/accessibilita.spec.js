// L'ACCESSIBILITÀ, PROVATA CON AXE (REQ-UI-036, UR-021).
//
// axe sulle pagine principali, con le regole WCAG 2.0, 2.1 e 2.2 di livello
// A e AA (i tag `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`), la
// stessa serie della regia (@axe-core/playwright 4.14). Ogni pagina si
// misura due volte: a 1280 px e a 320 px, la vista stretta, che nella regia
// ha trovato problemi invisibili da larghi.
//
// IL CANCELLO: una violazione fa fallire la prova (`expect.soft`, così una
// pagina che cade non nasconde le altre). Con `A11Y_SOLO_MISURA=1` non fa
// fallire niente e si limita a scrivere le violazioni, pagina per pagina,
// nel file (la prima misura per la regia, 17/11/2026).
//
//   npx firebase-tools emulators:exec --only auth,firestore \
//     --config firebase.collaudo.json "npx playwright test accessibilita"
//
// Il file si azzera a mano prima del giro: Playwright ricarica questo modulo
// a ogni ripartenza, e azzerarlo da qui buttava le misure già fatte.
//
// Con gli ascolti di Firestore la pagina non arriva mai a `networkidle`: si
// aspetta `load`, un elemento della pagina e un momento, poi si misura.
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { AxeBuilder } from '@axe-core/playwright'
import { test, expect, entra, nuovoOrdine, batti } from './banco.mjs'

const USCITA = process.env.A11Y_USCITA || 'test-results/a11y-misura.json'
const SOLO_MISURA = process.env.A11Y_SOLO_MISURA === '1'
const TAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']
const VISTE = [
  { nome: 'larga', viewport: { width: 1280, height: 800 } },
  { nome: 'stretta', viewport: { width: 320, height: 640 } },
]

// Il file si scrive a ogni misura: se una prova cade, Playwright riparte con
// un processo nuovo, e una memoria tenuta solo in variabile si perderebbe.
const aggiungi = (riga) => {
  mkdirSync(dirname(USCITA), { recursive: true })
  const prima = existsSync(USCITA) ? JSON.parse(readFileSync(USCITA, 'utf8')) : []
  writeFileSync(USCITA, JSON.stringify([...prima, riga], null, 2))
}

async function misura(page, vista, area, pagina) {
  await page.waitForLoadState('load')
  await page.waitForTimeout(2500)
  const esito = await new AxeBuilder({ page }).withTags(TAG).analyze()
  const violazioni = esito.violations.map((v) => ({
    regola: v.id,
    impatto: v.impact,
    descrizione: v.help,
    criteri: v.tags.filter((t) => /^wcag\d{3,}$/.test(t)),
    elementi: v.nodes.length,
    esempi: v.nodes.slice(0, 3).map((n) => n.target.join(' ')),
  }))
  aggiungi({ vista, area, pagina, indirizzo: new URL(page.url()).pathname + new URL(page.url()).search, violazioni })
  if (!SOLO_MISURA) {
    expect.soft(violazioni, `${pagina} (${vista})`).toEqual([])
  }
}

const SEZIONI = [
  ['pagamenti', 'Cassa'],
  ['fatture', 'Fatture'],
  ['stats', 'Statistiche'],
  ['bilancio', 'Bilancio'],
  ['menu', 'Menù (gestione)'],
  ['inventario', 'Magazzino'],
  ['fornitori', 'Fornitori'],
  ['staff', 'Staff'],
  ['utenti', 'Utenti e ruoli'],
  ['impostazioni', 'Impostazioni'],
]

for (const { nome: vista, viewport } of VISTE) {
  test.describe(`vista ${vista}`, () => {
    test.use({ viewport })

    test('cliente: home, menù, accesso', async ({ page }) => {
      test.setTimeout(120_000)
      await page.goto('/')
      await misura(page, vista, 'cliente', 'Home del locale')
      await page.goto('/menu')
      await page.getByText('Mojito').first().waitFor()
      await misura(page, vista, 'cliente', 'Menù dei clienti')
      await page.goto('/accedi')
      await misura(page, vista, 'cliente', 'Accesso del cliente')
    })

    test('gestionale: accesso', async ({ page }) => {
      await page.goto('/bar')
      await page.getByLabel('Email').waitFor()
      await misura(page, vista, 'gestionale', 'Accesso dello staff')
    })

    test('gestionale: coda, conto, pagamento', async ({ page }) => {
      test.setTimeout(240_000)
      await entra(page, 'banco@tana.local')
      await page.getByText('Cassa chiusa').waitFor()
      await misura(page, vista, 'gestionale', 'Coda ordini (cassa chiusa)')
      await nuovoOrdine(page)
      await batti(page, 'Mojito')
      await batti(page, 'Negroni')
      await misura(page, vista, 'gestionale', 'Conto (POS) con due righe')
      // Sul telefono il conto sta chiuso in basso: si apre, e il tasto del
      // pagamento è lì dentro, e si chiama solo «Paga».
      if (vista === 'stretta') await page.getByRole('button', { name: /tocca per aprire/ }).click()
      // «Paga» sul telefono non sta mai fermo per Playwright (il pannello
      // si anima): qui si misura la pagina che apre, quindi si forza.
      await page.getByRole('button', { name: /^Pagamento ·|^Paga$/ }).click({ force: true })
      await misura(page, vista, 'gestionale', 'Pagamento')
    })

    test('gestionale: le sezioni', async ({ page }) => {
      test.setTimeout(180_000)
      await entra(page, 'banco@tana.local')
      await page.getByText('Cassa chiusa').waitFor()
      for (const [tab, nome] of SEZIONI) {
        await page.goto(`/bar?tab=${tab}`)
        await misura(page, vista, 'gestionale', nome)
      }
    })
  })
}
