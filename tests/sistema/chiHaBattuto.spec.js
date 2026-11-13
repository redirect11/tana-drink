// SU UN CONTO SI VEDE CHI HA BATTUTO COSA — da un terminale all'altro.
//
// UR-012, REQ-ORD-023. Richiesta dell'08/11/2026: «vicino ogni item su un
// ordine se caricato da FLAVIO appare la F nel quadrato rosa e se caricato
// da ALEX appare A nel quadrato azzurro». Qui due persone vere, su due
// browser separati, battono sullo stesso conto: la firma di ogni riga deve
// viaggiare col documento e arrivare all'altro terminale, non restare nella
// memoria di chi l'ha scritta.
import { test, expect, entra, apriCassa, nuovoOrdine, batti, tornaAllaCoda, cardDeiConti } from './banco.mjs'

const riga = (page, drink) => page.locator('.draft-line').filter({ hasText: drink })
const firma = (page, drink, chi) => riga(page, drink).locator(`.riga-autore [title="Aggiunto da ${chi}"]`)

test('ogni riga porta la firma di chi l’ha battuta, anche sull’altro terminale', async ({ page: banco, altroTerminale }) => {
  await entra(banco, 'bartender@tana.local')
  await apriCassa(banco, 0)
  await nuovoOrdine(banco)
  await batti(banco, 'Negroni')
  await banco.getByRole('button', { name: /Invia comanda/ }).click()
  await expect(firma(banco, 'Negroni', 'Marzia — Bartender')).toBeVisible()
  await tornaAllaCoda(banco)

  // La sala apre lo stesso conto dal suo terminale e ci aggiunge un drink.
  const sala = await altroTerminale()
  await entra(sala, 'sala@tana.local')
  await expect(cardDeiConti(sala)).toHaveCount(1)
  await cardDeiConti(sala).first().locator('.grid-card-main').click()
  await expect(firma(sala, 'Negroni', 'Marzia — Bartender')).toBeVisible()
  await batti(sala, 'Hugo')
  await sala.getByRole('button', { name: /Invia comanda/ }).click()
  await expect(firma(sala, 'Hugo', 'Ciro — Sala')).toBeVisible()
  await tornaAllaCoda(sala)

  // Il banco riapre il conto: ognuno ha la sua riga, col suo colore.
  await expect(cardDeiConti(banco).first()).toContainText('2 prodotti')
  await cardDeiConti(banco).first().locator('.grid-card-main').click()
  await expect(firma(banco, 'Negroni', 'Marzia — Bartender')).toBeVisible()
  await expect(firma(banco, 'Hugo', 'Ciro — Sala')).toBeVisible()
  const colore = (drink) => riga(banco, drink).locator('.riga-autore .order-by').evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(await colore('Negroni')).not.toBe(await colore('Hugo'))
})
