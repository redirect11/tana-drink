// IL GIRO DI UNA SERATA, SENZA RETE — sull'app intera.
//
// Il gemello di sistema di tests/unit/giroInLocale.test.js. Quello prova
// api.js con un Firestore finto che non risponde mai; questo prova l'app
// COMPILATA in un browser vero, con Auth e Firestore emulati e le regole
// vere, e la rete staccata dal browser stesso. Se qui un passo aspetta il
// server, non arriva mai: ogni cosa che si vede a rete staccata è la prova
// che il gesto ha avuto effetto in locale.
//
// È il criterio di accettazione di UR-001 («con la cassa aperta si stacca
// la rete…»), ripetuto gesto per gesto; il test di accettazione vero, in
// tests/accettazione/, arriverà con la fase 3 del modello a V.
import { test, expect, entra, apriCassa, nuovoOrdine, batti, tornaAllaCoda, cardDeiConti } from './banco.mjs'
import { database } from './semina.mjs'

test('un conto si batte, si aggiorna e si incassa a rete staccata, e arriva al server una volta sola', async ({ page, context }) => {
  // Un browser appena entrato, che non ha mai aperto un conto: il catalogo
  // deve averlo già, perché la coda lo precarica (BUG-137). Prima la
  // griglia restava vuota e senza rete non si batteva niente.
  await entra(page, 'bartender@tana.local')
  await apriCassa(page, 50)

  // ── Da qui il browser è senza rete ─────────────────────────────────
  await context.setOffline(true)
  await expect(page.getByText(/Offline/).first()).toBeVisible()

  // Tre drink: il conto nasce al primo, il totale si compone a ogni tocco.
  await nuovoOrdine(page)
  await batti(page, 'Negroni')       // 8,00
  await batti(page, 'Spritz Aperol') // 6,00
  await batti(page, 'Mojito')        // 8,00
  await expect(page.getByRole('button', { name: /Pagamento · 22,00 €/ })).toBeVisible()
  await page.getByRole('button', { name: /Invia comanda/ }).click()
  await expect(page.getByText('Comanda inviata al banco')).toBeVisible()

  // In coda la card c'è già, col totale giusto: non «quando sincronizza».
  await tornaAllaCoda(page)
  await expect(cardDeiConti(page)).toHaveCount(1)
  await expect(cardDeiConti(page).first()).toContainText('22,00 €')
  await expect(cardDeiConti(page).first()).toContainText('3 prodotti')

  // Un quarto drink sullo stesso conto: la card lo mostra appena tornati.
  await cardDeiConti(page).first().locator('.grid-card-main').click()
  await batti(page, 'Gin Tonic')     // 8,00
  await page.getByRole('button', { name: /Invia comanda/ }).click()
  await expect(page.getByRole('button', { name: /Pagamento · 30,00 €/ })).toBeVisible()
  await tornaAllaCoda(page)
  await expect(cardDeiConti(page).first()).toContainText('30,00 €')
  await expect(cardDeiConti(page).first()).toContainText('4 prodotti')

  // Incasso in contanti, ancora senza rete.
  await cardDeiConti(page).first().locator('.grid-card-main').click()
  await page.getByRole('button', { name: /Pagamento/ }).click()
  await expect(page.getByText('Ammontare dovuto').first()).toBeVisible()
  await page.getByRole('button', { name: 'Contante' }).click()
  await page.getByRole('button', { name: /Riscuotere · 30,00 €/ }).click()
  await expect(page.getByText(/0 aperti/)).toBeVisible()
  await expect(cardDeiConti(page)).toHaveCount(0)

  // ── La rete torna ──────────────────────────────────────────────────
  // Il conto arriva al server da solo, pagato, e UNO: le scritture rimaste
  // in coda partono senza che nessuno tocchi niente (REQ-ORD-016).
  await context.setOffline(false)
  const db = database()
  await expect.poll(async () => {
    const conti = (await db.collection('orders').get()).docs.map((d) => d.data())
    // Nel documento le righe stanno in `items`: `order_items` è il nome che
    // l'app dà loro dopo averle lette (api.js). Le somme si fanno qui, a
    // mano, apposta: con paidAmount di src/lib/pagamento.js il test
    // controllerebbe l'app con l'app.
    return conti.map((o) => ({
      pagato: o.payment_status,
      righe: (o.items || []).reduce((n, r) => n + (Number(r.qty) || 0), 0),
      incassato: (o.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0),
      metodi: [...new Set((o.payments || []).map((p) => p.method))],
    }))
  }, { timeout: 30_000, message: 'il conto incassato senza rete arriva al server' }).toEqual([
    { pagato: 'pagato', righe: 4, incassato: 30, metodi: ['banco'] },
  ])
})
