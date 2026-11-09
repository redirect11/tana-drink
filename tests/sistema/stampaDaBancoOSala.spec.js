// LA STAMPA AUTOMATICA SCEGLIE DA DOVE — sull'app intera.
//
// UR-004, REQ-STAMPA-021. Richiesta dell'08/11/2026: «differenziare se le
// operazioni provengono da cassa o da sala (esempio: stampa solo
// riscossione da banco e stampa in automatico la comanda se presa da
// sala)». Quale comanda e quale scontrino escono lo decidono le regole
// provate in tests/unit/stampaDaBancoOSala.test.js; la carta in locale non
// si vede (la stampante non c'è). Qui si prova quello che vede chi
// imposta: la scelta, il suo restare sul terminale dopo un ricaricamento,
// e l'avviso quando la combinazione lascia le comande della sala a nessuno.
import { test, expect, entra, vaiA } from './banco.mjs'

test('comanda solo dalla sala e scontrino solo dal banco, e l’avviso del buco', async ({ page }) => {
  await entra(page, 'banco@tana.local')
  await vaiA(page, 'Impostazioni', 'Cassa e giornata')
  await expect(page.getByRole('heading', { name: 'Stampa automatica' })).toBeVisible()

  await page.getByRole('checkbox', { name: 'Stampa la comanda all’arrivo dell’ordine' }).check()
  await page.getByRole('checkbox', { name: 'Stampa lo scontrino alla riscossione del conto' }).check()
  const comande = page.getByRole('group', { name: 'Comande prese' })
  const riscossioni = page.getByRole('group', { name: 'Riscossioni fatte' })
  await comande.getByRole('button', { name: 'Solo dalla sala' }).click()
  await riscossioni.getByRole('button', { name: 'Solo dal banco' }).click()

  // È un'impostazione del terminale: ricaricando la pagina resta.
  await page.reload()
  await vaiA(page, 'Impostazioni', 'Cassa e giornata')
  await expect(comande.getByRole('button', { name: 'Solo dalla sala' })).toHaveAttribute('aria-pressed', 'true')
  await expect(riscossioni.getByRole('button', { name: 'Solo dal banco' })).toHaveAttribute('aria-pressed', 'true')

  // «La stampa il banco» con le comande solo dal banco: quelle della sala
  // non le stamperebbe nessuno, e l'impostazione lo dice.
  const buco = page.getByText(/le comande della sala non le stampa nessuno/)
  await page.getByRole('button', { name: /La stampa il banco/ }).click()
  await expect(buco).toHaveCount(0)
  await comande.getByRole('button', { name: 'Solo dal banco' }).click()
  await expect(buco).toBeVisible()
  await comande.getByRole('button', { name: 'Banco e sala' }).click()
  await expect(buco).toHaveCount(0)
})
