// LA MARGINALITÀ DEL LISTINO, SUL PC — impaginazione e categorie.
//
// UR-013, REQ-MENU-032 e BUG-138. Richieste dell'08/11/2026: «i dati non
// sono incolonnati alle voci in alto quando si visualizzano da pc» e
// «mettere le categorie sul lato sx in modo da poterle filtrare».
// BUG-138 è un difetto d'impaginazione: in jsdom non c'è layout, e il test
// di componente può solo vedere che la regola CSS c'è. Il modello a V vuole
// la prova al livello che l'aveva lasciato sfuggire, cioè un browser vero
// alla larghezza di un PC, che misura dove stanno le colonne.
import { test, expect, entra, vaiA } from './banco.mjs'

test.use({ viewport: { width: 1600, height: 900 } })

async function apriMarginalita(page) {
  await entra(page, 'banco@tana.local')
  await vaiA(page, 'Menù', 'Marginalità listino')
  await expect(page.locator('table.margin-tab')).toBeVisible()
}

test('sul PC ogni intestazione sta sopra i suoi numeri', async ({ page }) => {
  await apriMarginalita(page)
  const tabella = page.locator('table.margin-tab')
  const intestazioni = tabella.locator('thead th')
  const n = await intestazioni.count()
  const primaRiga = tabella.locator('tbody tr').filter({ has: page.locator('th[scope="row"]') }).first()
  for (let i = 1; i < n; i++) {
    // Il bordo destro dell'etichetta e quello del numero sotto: i numeri
    // sono allineati a destra, e l'etichetta deve finire dove finiscono.
    const etichetta = await intestazioni.nth(i).locator('.inv-th').evaluate((el) => {
      const r = document.createRange()
      r.selectNodeContents(el)
      return r.getBoundingClientRect().right
    })
    const cella = await primaRiga.locator('td').nth(i - 1).evaluate((el) => {
      const r = document.createRange()
      r.selectNodeContents(el)
      return { destra: r.getBoundingClientRect().right, vuota: !el.textContent.trim() }
    })
    if (cella.vuota) continue
    expect(Math.abs(etichetta - cella.destra), `colonna ${i}`).toBeLessThan(24)
  }
})

test('le categorie a sinistra filtrano il listino', async ({ page }) => {
  await apriMarginalita(page)
  const righe = page.locator('table.margin-tab tbody th[scope="row"]')
  const tutte = await righe.count()
  expect(tutte).toBeGreaterThan(1)

  const barra = page.locator('.cat-rail')
  await expect(barra).toBeVisible()
  // La prima voce è «tutte»; la seconda è la prima categoria vera.
  const categoria = barra.locator('button.chip:not(.cat-rail-stringi)').nth(1)
  const quante = Number(await categoria.locator('.cat-rail-count').textContent())
  await categoria.click()
  await expect(righe).toHaveCount(quante)
  expect(quante).toBeLessThan(tutte)
})
