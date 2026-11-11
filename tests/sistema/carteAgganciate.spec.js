// IL MENÙ A CARTE SUL TELEFONO: IL MAZZO RESTA IN ALTO.
//
// REQ-MENU-029. Richiesta di Flavio dell'08/11/2026: «mantenere le carte
// bloccate in alto e rimuovere il tasto che riporta alle carte nel MENU
// CLIENTE». L'aggancio è una regola CSS (position: sticky): in jsdom non
// c'è layout, e il test di componente vede solo il tasto che manca e la
// classe dell'aggancio. Qui un browser vero alla misura di un telefono
// scorre la pagina e misura dove sta il mazzo.
import { test, expect } from './banco.mjs'
import { database } from './semina.mjs'

test.use({ viewport: { width: 390, height: 844 } })

// Lo stile «Carte» è della Tana: la licenza seminata lo nomina fra i temi
// (clienti/tana/licenza-iniziale.json), basta sceglierlo.
async function apriMenuACarte(page) {
  await database().collection('settings').doc('bar').set({ stile_menu: 'carte' }, { merge: true })
  await page.goto('/menu')
  // Il cliente che apre il menù la prima volta legge come si ordina.
  await page.getByRole('button', { name: 'Inizia' }).click()
  const mazzo = page.getByRole('navigation', { name: 'Le carte del menù' })
  await expect(mazzo).toBeVisible()
  return mazzo
}

// La carta aperta più lunga, perché la pagina abbia da scorrere.
async function apriLaPiuLunga(page, mazzo) {
  const carte = mazzo.getByRole('button')
  const n = await carte.count()
  let migliore = 0
  let voci = -1
  for (let i = 0; i < n; i++) {
    await carte.nth(i).click()
    const quante = await page.locator('section.k-aperta:not([hidden]) .k-voce').count()
    if (quante > voci) [migliore, voci] = [i, quante]
  }
  await carte.nth(migliore).click()
  return migliore
}

test('scorrendo, il mazzo resta sotto la barra; il tasto per tornarci non c’è', async ({ page }) => {
  const mazzo = await apriMenuACarte(page)
  await expect(page.getByRole('button', { name: /Le carte/ })).toHaveCount(0)
  await apriLaPiuLunga(page, mazzo)

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  // La pagina è scesa ben oltre il mazzo: fermo, sarebbe uscito di sopra.
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(600)
  await expect(mazzo).toHaveClass(/incollata/)
  // Sotto la barra in alto, non dietro e non scivolato via con la pagina.
  const barra = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.k-mazzo')).top))
  expect(Math.abs((await mazzo.boundingBox()).y - barra)).toBeLessThan(2)
  // Le carte del mazzo si toccano anche da qui.
  await expect(mazzo.getByRole('button').first()).toBeInViewport()
})

test('dal mazzo agganciato, la carta scelta si legge dal suo inizio', async ({ page }) => {
  const mazzo = await apriMenuACarte(page)
  const lunga = await apriLaPiuLunga(page, mazzo)
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await expect(mazzo).toHaveClass(/incollata/)

  // Un'altra carta, scelta a metà della lettura.
  const altra = mazzo.getByRole('button').nth(lunga === 0 ? 1 : 0)
  await altra.click()
  await expect(altra).toHaveAttribute('aria-pressed', 'true')

  // La testa della carta nuova sta subito sotto il mazzo, non sopra lo
  // schermo: la si legge dall'inizio. Il mazzo si misura dal ventaglio, che
  // sul telefono è rimpicciolito: il posto che occupava da grande resta,
  // vuoto, e la carta nuova non deve cominciare lì sotto.
  const testa = page.locator('section.k-aperta:not([hidden]) .k-aperta-testa')
  await expect(async () => {
    const m = await page.locator('.k-ventaglio').boundingBox()
    const t = await testa.boundingBox()
    expect(t.y).toBeGreaterThanOrEqual(m.y + m.height - 2)
    expect(t.y).toBeLessThan(m.y + m.height + 60)
  }).toPass()
})

// «Sui dispositivi con schermo piccolo le carte dovrebbero… rimpicciolirsi
// quando scorriamo una pagina del menù, che altrimenti prende metà dello
// schermo» (l'utente, 11/11/2026). Fermo nella pagina il mazzo è a carte
// intere; agganciato si rimpicciolisce, e la pagina non si sposta di lato.
test('sul telefono il mazzo agganciato si rimpicciolisce, e fermo torna grande', async ({ page }) => {
  const mazzo = await apriMenuACarte(page)
  await apriLaPiuLunga(page, mazzo)
  const carta = mazzo.getByRole('button').first()
  const altaDi = async () => (await carta.boundingBox()).height

  await page.evaluate(() => window.scrollTo(0, 0))
  await expect(mazzo).not.toHaveClass(/incollata/)
  await expect.poll(altaDi).toBeGreaterThan(175)

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await expect(mazzo).toHaveClass(/incollata/)
  await expect.poll(altaDi).toBeLessThan(125)
  // Rimpicciolito non allarga la pagina: niente scorrimento di lato.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

  await page.evaluate(() => window.scrollTo(0, 0))
  await expect(mazzo).not.toHaveClass(/incollata/)
  await expect.poll(altaDi).toBeGreaterThan(175)
})
