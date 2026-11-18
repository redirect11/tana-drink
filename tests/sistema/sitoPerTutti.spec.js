// IL SITO UGUALE PER TUTTI, COL LOCALE SCRITTO NELLA PAGINA (REQ-FLOTTA-034).
//
// La regia compila il sito una volta per versione e al deploy ci scrive la
// configurazione del locale, anche come blocco dentro index.html
// (scripts/personalizza.mjs). Qui l'app COMPILATA riceve la pagina con quel
// blocco, come la servirebbe l'hosting di un locale personalizzato: il
// blocco lo aggiunge il browser di prova a ogni pagina che scarica, anche a
// quella che il service worker mette da parte.
//
// Il backend del blocco è quello degli emulatori, così il locale lavora
// davvero; ma è anche quello della build di prova (gli emulatori sono uno),
// quindi QUI il backend non distingue il blocco dalla build: lo distingue
// il locale. «Bar Mario» non sta né nella build (che è della Tana) né nel
// database. Che il progetto venga dal blocco anche quando la build non ne
// ha lo prova tests/unit/configurazione.test.js («il client di Firebase»).
//
// Il caso che conta è il secondo: un tablet riaperto SENZA RETE deve
// ripartire col suo locale (R3 nell'analisi del 18/11/2026: senza il
// blocco, la configurazione arrivava solo col file, e senza rete non
// arrivava mai).
import { test, expect, entra, apriCassa } from './banco.mjs'

const LOCALE = {
  backend: 'firebase',
  locale: 'bar-mario',
  firebase: { apiKey: 'demo-api-key', authDomain: 'demo-tana-drink.firebaseapp.com', projectId: 'demo-tana-drink' },
  venue: { venue_name: 'Bar Mario', venue_tagline: 'Aperitivi a Napoli', venue_theme_color: '#2a6f97' },
}
const BLOCCO = `<script id="configurazione" type="application/json">${JSON.stringify(LOCALE)}</script>`

// Ogni pagina HTML che il browser scarica (anche dal service worker) arriva
// col blocco, come se l'avesse scritta personalizza.mjs.
async function servitoComeUnLocale(context) {
  await context.route('**/*', async (route) => {
    if (route.request().resourceType() !== 'document' && !/\/(index\.html)?$/.test(new URL(route.request().url()).pathname)) return route.continue()
    const risposta = await route.fetch()
    const tipo = risposta.headers()['content-type'] || ''
    if (!tipo.includes('text/html')) return route.fulfill({ response: risposta })
    const html = (await risposta.text()).replace('</head>', `${BLOCCO}</head>`)
    return route.fulfill({ response: risposta, body: html })
  })
}

test('il sito mostra il locale scritto nella pagina e lavora col suo database', async ({ page, context }) => {
  await servitoComeUnLocale(context)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Bar Mario' })).toBeVisible()
  await expect(page.getByText('La Tana del Coniglio')).toHaveCount(0)

  // Col locale del blocco il banco lavora: si entra e si apre la cassa.
  await entra(page, 'bartender@tana.local')
  await apriCassa(page, 50)
})

test('riaperto senza rete, il tablet riparte col suo locale', async ({ page, context }) => {
  await servitoComeUnLocale(context)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Bar Mario' })).toBeVisible()
  // Il service worker prende in mano la pagina e mette da parte quella col
  // blocco: è quello che ha un tablet dopo la prima apertura.
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Bar Mario' })).toBeVisible()

  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Bar Mario' })).toBeVisible()
})
