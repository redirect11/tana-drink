// IL CONTO SVUOTATO SPARISCE DALLA CODA E NON TORNA (BUG-169, REQ-ORD-025).
//
// Daniele, 17/11/2026: con «Conto vuoto» acceso, tolta l'ultima riga il
// conto esce e si torna alla coda; lì la card «prima scompare, poi
// riappare, esce la notifica ripristinato e poi scompare di nuovo». Due
// cause, tutte e due fra la coda e l'annullo che parte all'uscita:
//   · il conto nascosto all'uscita tornava visibile perché la sua comanda,
//     ormai senza righe, contava come «lavoro da fare»;
//   · la lettura dalla cache con cui la coda si dipinge per prima
//     ricopriva la risposta vuota degli ascolti, arrivata dopo l'annullo,
//     col conto ancora aperto.
// Il difetto dura un decimo di secondo, e una prova che guarda ogni tanto
// non lo vede: qui un osservatore nella pagina segna OGNI card che compare
// e ogni avviso, dal tocco fino a tre secondi dopo.
import { test, expect, entra, apriCassa, nuovoOrdine, batti, tornaAllaCoda, cardDeiConti } from './banco.mjs'

const riga = (page, drink) => page.locator('.draft-line').filter({ hasText: drink })

test('svuotato il conto, in coda la sua card non ricompare', async ({ page }) => {
  // Gli avvisi come «toast», esplicito: con lo stile a fumetto non ci
  // sarebbe nessun `.toast` e il controllo sull'avviso passerebbe a vuoto.
  await page.addInitScript(() => localStorage.setItem('drink:avvisi-stile', 'toast'))
  await entra(page, 'bartender@tana.local')
  await apriCassa(page, 0)
  await nuovoOrdine(page)
  await batti(page, 'Negroni')
  await page.getByRole('button', { name: /Invia comanda/ }).click()
  await expect(riga(page, 'Negroni').locator('.riga-autore')).toBeVisible()
  await tornaAllaCoda(page)
  await expect(cardDeiConti(page)).toHaveCount(1)

  await cardDeiConti(page).first().locator('.grid-card-main').click()
  await page.evaluate(() => {
    window.__visti = { card: 0, avvisi: [] }
    new MutationObserver(() => {
      if (location.pathname !== '/bar') return
      window.__visti.card = Math.max(window.__visti.card, document.querySelectorAll('.order-card').length)
      for (const t of document.querySelectorAll('.toast')) window.__visti.avvisi.push(t.textContent)
    }).observe(document.body, { childList: true, subtree: true, characterData: true })
  })
  await riga(page, 'Negroni').getByRole('button', { name: 'Riduci Negroni' }).click()

  // L'uscita la fa l'app da sé, appena il conto è vuoto: è anche la prova
  // che «Conto vuoto» è acceso (lo è di partenza, REQ-ORD-025).
  await page.waitForURL('**/bar')
  await page.waitForTimeout(3000)
  const visti = await page.evaluate(() => window.__visti)
  expect(visti.card).toBe(0)
  expect(visti.avvisi.filter((a) => /ripristinat/i.test(a))).toEqual([])
  await expect(cardDeiConti(page)).toHaveCount(0)

  // E NON È SOLO NASCOSTO. L'elenco dei conti nascosti vive in memoria:
  // ricaricando si azzera, e un conto rimasto aperto (l'annullo non
  // partito) tornerebbe fra quelli in corso.
  await page.reload()
  await expect(page.getByRole('link', { name: 'Nuovo ordine', exact: true })).toBeVisible()
  await page.waitForTimeout(1500)
  await expect(cardDeiConti(page)).toHaveCount(0)
})
