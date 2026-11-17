// LA PRIMA MISURA DI ACCESSIBILITÀ (richiesta della regia, 17/11/2026).
//
// axe-core sulle pagine principali, con le regole WCAG 2.0 e 2.1 di livello
// A e AA (i tag `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`). È una MISURA:
// non fa fallire niente, scrive le violazioni pagina per pagina in un file,
// da mandare alla regia prima di correggere qualsiasi cosa. Diventerà il
// cancello (una violazione nuova fa fallire) quando avrà il suo requisito.
//
// REQ-UI-036. Lanciata da sola:
//   A11Y_AZZERA=1 npx firebase-tools emulators:exec --only auth,firestore //     --config firebase.collaudo.json "npx playwright test accessibilita"
//
// Con gli ascolti di Firestore la pagina non arriva mai a `networkidle`: si
// aspetta `load`, un elemento della pagina e un momento, poi si inietta axe.
import { writeFileSync, readFileSync, existsSync, rmSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { createRequire } from 'node:module'
import { test, entra, nuovoOrdine, batti } from './banco.mjs'

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js')
const USCITA = process.env.A11Y_USCITA || 'test-results/a11y-misura.json'
const TAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']
// Il file si scrive a ogni misura: se una prova cade, Playwright riparte con
// un processo nuovo, e una memoria tenuta solo in variabile si perderebbe.
const aggiungi = (riga) => {
  mkdirSync(dirname(USCITA), { recursive: true })
  const prima = existsSync(USCITA) ? JSON.parse(readFileSync(USCITA, 'utf8')) : []
  writeFileSync(USCITA, JSON.stringify([...prima, riga], null, 2))
}
if (process.env.A11Y_AZZERA === '1' && existsSync(USCITA)) rmSync(USCITA)

async function misura(page, area, pagina) {
  await page.waitForLoadState('load')
  await page.waitForTimeout(2500)
  await page.addScriptTag({ path: AXE })
  const esito = await page.evaluate(
    (tag) => window.axe.run(document, { runOnly: { type: 'tag', values: tag }, resultTypes: ['violations'] }),
    TAG
  )
  aggiungi({
    area,
    pagina,
    indirizzo: new URL(page.url()).pathname + new URL(page.url()).search,
    violazioni: esito.violations.map((v) => ({
      regola: v.id,
      impatto: v.impact,
      descrizione: v.help,
      criteri: v.tags.filter((t) => /^wcag\d{3,}$/.test(t)),
      elementi: v.nodes.length,
      esempi: v.nodes.slice(0, 3).map((n) => n.target.join(' ')),
    })),
  })
}

test('cliente: home, menù, accesso', async ({ page }) => {
  await page.goto('/')
  await misura(page, 'cliente', 'Home del locale')
  await page.goto('/menu')
  await page.getByText('Mojito').first().waitFor()
  await misura(page, 'cliente', 'Menù dei clienti')
  // Il dettaglio di un drink, se il tema lo apre al tocco del nome.
  const aperto = await page.getByText('Mojito').first().click({ timeout: 5000 }).then(() => true, () => false)
  if (aperto) await misura(page, 'cliente', 'Menù: dettaglio di un drink')
  await page.goto('/accedi')
  await misura(page, 'cliente', 'Accesso del cliente')
})

test('gestionale: accesso', async ({ page }) => {
  await page.goto('/bar')
  await page.getByLabel('Email').waitFor()
  await misura(page, 'gestionale', 'Accesso dello staff')
})

test('gestionale: coda, conto, pagamento', async ({ page }) => {
  test.setTimeout(120_000)
  await entra(page, 'banco@tana.local')
  await page.getByText('Cassa chiusa').waitFor()
  await misura(page, 'gestionale', 'Coda ordini (cassa chiusa)')
  await nuovoOrdine(page)
  await batti(page, 'Mojito')
  await batti(page, 'Negroni')
  await misura(page, 'gestionale', 'Conto (POS) con due righe')
  await page.getByRole('button', { name: /Pagamento ·/ }).click()
  await misura(page, 'gestionale', 'Pagamento')
})

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

test('gestionale: le sezioni', async ({ page }) => {
  test.setTimeout(180_000)
  await entra(page, 'banco@tana.local')
  await page.getByText('Cassa chiusa').waitFor()
  for (const [tab, nome] of SEZIONI) {
    await page.goto(`/bar?tab=${tab}`)
    await misura(page, 'gestionale', nome)
  }
})
