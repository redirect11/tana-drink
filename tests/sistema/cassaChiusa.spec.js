// A CASSA CHIUSA SI BATTE, MA NON SI INCASSA — sull'app intera.
//
// UR-005, REQ-CASSA-017. Richiesta dell'08/11/2026: «permettere di creare
// ordini anche da cassa chiusa ma rendere i tasti RISCUOTERE e similari non
// selezionabili». Qui si prova con l'app compilata e il database emulato:
// il conto nasce davvero e arriva al server, ma nessun incasso parte.
import { test, expect, entra, nuovoOrdine, batti, tornaAllaCoda, cardDeiConti } from './banco.mjs'
import { database } from './semina.mjs'

test('a cassa chiusa il conto si batte e arriva in coda, ma riscuotere è spento', async ({ page }) => {
  await entra(page, 'bartender@tana.local')
  await expect(page.getByText('Cassa chiusa').first()).toBeVisible()

  await nuovoOrdine(page)
  await batti(page, 'Negroni')
  await page.getByRole('button', { name: /Pagamento ·/ }).click()
  const pagamento = page.getByRole('dialog', { name: 'Pagamento' })
  await expect(pagamento.getByText('Cassa chiusa: per incassare va aperta la cassa.')).toBeVisible()
  await expect(pagamento.getByRole('button', { name: /Riscuotere/ })).toBeDisabled()
  await expect(pagamento.getByRole('button', { name: /Impagato/ })).toBeDisabled()
  await pagamento.getByRole('button', { name: '✕ Chiudi' }).click()

  await tornaAllaCoda(page)
  await expect(cardDeiConti(page)).toHaveCount(1)

  // Nel database: il conto c'è, aperto e senza pagamenti.
  const db = database()
  await expect.poll(async () => {
    const conti = (await db.collection('orders').get()).docs.map((d) => d.data())
    return conti.map((o) => ({ stato: o.status, pagamenti: (o.payments || []).length, righe: (o.items || []).length }))
  }, { timeout: 15_000, message: 'il conto battuto a cassa chiusa arriva al server' }).toEqual([
    { stato: 'aperto', pagamenti: 0, righe: 1 },
  ])
})
