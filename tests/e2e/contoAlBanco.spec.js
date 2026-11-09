// UC-BANCO-001 — Si batte un conto al banco e si manda la comanda.
//
// Il caso d'uso per intero (requirements/casi-uso.yaml): due Negroni, uno
// Spritz cercato per nome, una nota sulla riga, la comanda al banco e il
// conto in coda col suo nome. La stampa non si guarda qui: la carta in un
// browser non esce (si_prova: browser-con-finti, quando la stampante finta
// entra nell'ambiente e2e).
import { test, expect, entra, apriCassa, nuovoOrdine, batti, cardDeiConti } from '../sistema/banco.mjs'
import { database } from '../sistema/semina.mjs'

test('UC-BANCO-001: il conto nasce al primo tocco, porta la nota e arriva in coda col suo nome', async ({ page }) => {
  await entra(page, 'bartender@tana.local')
  await apriCassa(page, 0)

  // 1-2. Due Negroni: il conto nasce al primo tocco, e dalla griglia ogni
  // tocco è una riga a sé (si personalizzano e si annotano una per una).
  await nuovoOrdine(page)
  await batti(page, 'Negroni')
  await batti(page, 'Negroni')
  await expect(page.locator('.draft-line').filter({ hasText: 'Negroni' })).toHaveCount(2)
  await expect(page.getByRole('button', { name: /Pagamento · 16,00 €/ })).toBeVisible()

  // 3. Lo Spritz si cerca per nome, e la ricerca si svuota da sola.
  const cerca = page.getByLabel('Cerca prodotto')
  await cerca.fill('spri')
  await page.getByText('Spritz Aperol', { exact: true }).first().click()
  await expect(cerca).toHaveValue('')
  await expect(page.getByRole('button', { name: /Pagamento · 22,00 €/ })).toBeVisible()

  // 4. Una nota sulla riga dello Spritz.
  await page.locator('.draft-line').filter({ hasText: 'Spritz Aperol' }).click()
  await page.getByLabel('Nota per questa riga').fill('senza ghiaccio')
  // «Salva 6,00 €», non «Salva nuova», che farebbe un prodotto nuovo.
  await page.getByRole('button', { name: /^Salva(?! nuova)/ }).click()
  await expect(page.locator('.draft-line').filter({ hasText: 'Spritz Aperol' })).toContainText('senza ghiaccio')

  // 5-6. La comanda parte, e ogni riga dice chi l'ha battuta.
  await page.getByRole('button', { name: /Invia comanda/ }).click()
  await expect(page.getByText('Comanda inviata al banco')).toBeVisible()
  await expect(page.locator('.draft-line .riga-autore [title="Aggiunto da Marzia — Bartender"]').first()).toBeVisible()

  // 7. Si torna in coda dando un nome al conto.
  await page.getByRole('button', { name: 'Torna agli ordini' }).click()
  await page.getByLabel('Nome', { exact: true }).fill('Giulia')
  await page.getByRole('button', { name: 'Salva', exact: true }).click()

  // L'esito: la card c'è subito, col nome, il totale e i prodotti.
  await expect(cardDeiConti(page)).toHaveCount(1)
  const card = cardDeiConti(page).first()
  await expect(card).toContainText('Giulia')
  await expect(card).toContainText('22,00 €')
  await expect(card).toContainText('3 prodotti')

  // Nel documento del conto ci sono due Negroni e uno Spritz con la sua
  // nota. Si contano le quantità per prodotto, non le righe: se le righe
  // uguali siano già sommate dipende da quando il conto è nato rispetto
  // all'ultimo tocco. Sugli emulatori nasce subito e il resto arriva come
  // aggiunta (2×Negroni); sul progetto vero la numerazione passa dalla rete
  // e il conto nasce con tutte e tre le righe (1×Negroni, 1×Negroni). Per il
  // cliente è lo stesso conto (docs/casi-uso-domande.md, punto 6).
  const db = database()
  await expect.poll(async () => {
    const conti = (await db.collection('orders').get()).docs.map((d) => d.data())
    return conti.map((o) => ({
      nome: o.customer_name,
      numero: typeof o.daily_number,
      righe: Object.entries((o.items || []).reduce((tot, r) => {
        const chi = `${r.name}${r.note ? ` (${r.note})` : ''}`
        return { ...tot, [chi]: (tot[chi] || 0) + r.qty }
      }, {})).map(([chi, qty]) => `${qty}×${chi}`).sort(),
    }))
  }, { timeout: 20_000 }).toEqual([{ nome: 'Giulia', numero: 'number', righe: ['1×Spritz Aperol (senza ghiaccio)', '2×Negroni'] }])
})
