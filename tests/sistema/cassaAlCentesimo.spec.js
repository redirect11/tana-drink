// LA CASSA DELLA SERATA TORNA AL CENTESIMO — sull'app intera.
//
// UR-005: a fine serata il contante contato deve corrispondere a quello che
// dice l'app, la carta non deve mai finire nei contanti (REQ-CASSA-003), e
// un conto chiuso impagato resta da riscuotere senza sparire
// (REQ-CASSA-016). I conti si chiudono in tre modi diversi, come in una
// serata vera, e la chiusura si controlla due volte: a schermo, dove la
// guarda chi chiude, e nel database, dove la ritrova il bilancio.
import { test, expect, entra, apriCassa, contoChiuso } from './banco.mjs'
import { database } from './semina.mjs'

test('contanti, carta e un impagato: la chiusura separa i metodi e il contante atteso è fondo più contanti', async ({ page }) => {
  await entra(page, 'bartender@tana.local')
  await apriCassa(page, 50)

  await contoChiuso(page, ['Negroni', 'Mojito'], 'Contante', '16,00 €')
  await contoChiuso(page, ['Gin Tonic'], 'Carta di Credito', '8,00 €')
  await contoChiuso(page, ['Spritz Aperol'], 'Impagato', '6,00 €')

  // ── La chiusura, come la vede chi chiude ───────────────────────────
  await page.getByRole('button', { name: /Chiudi cassa/ }).first().click()
  const chiusura = page.locator('.confirm-box')
  await expect(chiusura.getByText('Incassato serata').locator('..')).toContainText('24,00 €')
  // La carta non entra nei contanti: 16 di contanti su 24 incassati.
  await expect(chiusura.getByText('di cui contanti').locator('..')).toContainText('16,00 €')
  await expect(chiusura.getByText(/Contante atteso/).locator('..')).toContainText('66,00 €')
  // L'impagato non blocca la chiusura, ma i soldi mancano e lo si dice.
  await expect(chiusura).toContainText('1 conto chiuso impagato')
  await expect(chiusura).toContainText('6,00 € da riscuotere')

  await chiusura.locator('#contato-cassa').fill('66')
  await expect(chiusura).toContainText('Il conto torna.')
  await chiusura.locator('#contato-cassa').fill('65')
  await expect(chiusura).toContainText('Mancano 1,00 € rispetto all\'atteso.')
  await chiusura.locator('#contato-cassa').fill('66')
  await chiusura.getByRole('button', { name: 'Chiudi cassa' }).click()
  await expect(page.getByText('Cassa chiusa').first()).toBeVisible()

  // ── E nel database, dove la ritrova il bilancio ────────────────────
  const db = database()
  await expect.poll(async () => {
    const casse = (await db.collection('cash_sessions').get()).docs.map((d) => d.data())
    return casse.map((c) => ({
      stato: c.status,
      fondo: c.snapshot?.fondo,
      incassato: c.snapshot?.incassato,
      contanti: c.snapshot?.byMethod?.banco,
      atteso: c.snapshot?.contanteAtteso,
      contato: c.counted_cash,
      differenza: c.difference,
      impagato: c.snapshot?.impagatoDaRiscuotere,
    }))
  }, { timeout: 15_000, message: 'la chiusura arriva al server con i suoi numeri' }).toEqual([
    { stato: 'closed', fondo: 50, incassato: 24, contanti: 16, atteso: 66, contato: 66, differenza: 0, impagato: 6 },
  ])
})
