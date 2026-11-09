// UC-CASSA-001 — Si apre la cassa a inizio serata, anche dopo aver già
// battuto i primi conti.
//
// Il caso d'uso per intero (requirements/casi-uso.yaml), coi soli gesti di
// chi sta al banco: a cassa chiusa il conto si batte ma non si incassa;
// aperta la cassa, lo stesso conto si incassa senza uscire e rientrare.
// Gira in locale sugli emulatori completi e sull'ambiente e2e generato
// (playwright.e2e.config.mjs).
import { test, expect, entra, apriCassa, nuovoOrdine, batti, tornaAllaCoda, cardDeiConti } from '../sistema/banco.mjs'
import { database } from '../sistema/semina.mjs'

test('UC-CASSA-001: il conto battuto a cassa chiusa si incassa appena la cassa è aperta', async ({ page }) => {
  await entra(page, 'bartender@tana.local')
  await expect(page.getByText('Cassa chiusa').first()).toBeVisible()

  // 1-3. Un conto a cassa chiusa: si batte, ma non si incassa.
  await nuovoOrdine(page)
  await batti(page, 'Negroni')
  await expect(page.getByRole('button', { name: /Pagamento · 8,00 €/ })).toBeVisible()
  await page.getByRole('button', { name: /Pagamento ·/ }).click()
  const pagamento = page.getByRole('dialog', { name: 'Pagamento' })
  await expect(pagamento.getByText('Cassa chiusa: per incassare va aperta la cassa.')).toBeVisible()
  await expect(pagamento.getByRole('button', { name: /Riscuotere/ })).toBeDisabled()
  await expect(pagamento.getByRole('button', { name: /Impagato/ })).toBeDisabled()
  await pagamento.getByRole('button', { name: '✕ Chiudi' }).click()
  await tornaAllaCoda(page)
  await expect(cardDeiConti(page)).toHaveCount(1)
  await expect(cardDeiConti(page).first()).toContainText('8,00 €')

  // 4-5. Si apre la cassa col fondo.
  await apriCassa(page, 50)

  // 6. Lo stesso conto ora si incassa.
  await cardDeiConti(page).first().locator('.grid-card-main').click()
  await page.getByRole('button', { name: /Pagamento ·/ }).click()
  await expect(pagamento.getByRole('button', { name: /Riscuotere · 8,00 €/ })).toBeEnabled()

  // L'esito, nel database: una cassa aperta col fondo, e il conto senza
  // incassi registrati mentre la cassa era chiusa.
  const db = database()
  await expect.poll(async () => {
    const casse = (await db.collection('cash_sessions').get()).docs.map((d) => d.data())
    const conti = (await db.collection('orders').get()).docs.map((d) => d.data())
    return {
      casse: casse.map((c) => ({ stato: c.status, fondo: c.fondo_cassa })),
      conti: conti.map((o) => ({ pagamenti: (o.payments || []).length, righe: (o.items || []).length })),
    }
  }, { timeout: 20_000 }).toEqual({ casse: [{ stato: 'open', fondo: 50 }], conti: [{ pagamenti: 0, righe: 1 }] })
})
