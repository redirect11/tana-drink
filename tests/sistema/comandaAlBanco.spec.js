// LA COMANDA ARRIVA A CHI DEVE PREPARARE — da un terminale all'altro.
//
// UR-004, REQ-ORD-009: un conto battuto in sala si vede al banco, su un
// altro dispositivo, senza che nessuno ricarichi niente. Qui i due
// terminali sono due browser separati (due contesti, due sessioni, due
// cache), e fra loro c'è solo il database emulato: è il percorso vero,
// non una memoria condivisa.
import { test, expect, entra, apriCassa, nuovoOrdine, batti, tornaAllaCoda, cardDeiConti } from './banco.mjs'

test('il conto battuto in sala compare al banco, con chi l’ha aperto e il totale', async ({ page: banco, browser }) => {
  await entra(banco, 'bartender@tana.local')
  await apriCassa(banco, 0)
  await expect(cardDeiConti(banco)).toHaveCount(0)

  const sala = await (await browser.newContext()).newPage()
  await entra(sala, 'sala@tana.local')
  await nuovoOrdine(sala)
  await batti(sala, 'Negroni')
  await batti(sala, 'Hugo')
  await sala.getByRole('button', { name: /Invia comanda/ }).click()
  await tornaAllaCoda(sala)
  await expect(cardDeiConti(sala)).toHaveCount(1)

  // Al banco, senza toccare niente.
  await expect(cardDeiConti(banco)).toHaveCount(1)
  await expect(cardDeiConti(banco).first()).toContainText('15,00 €')
  await expect(cardDeiConti(banco).first()).toContainText('2 prodotti')
  await expect(cardDeiConti(banco).first().locator('[title="Aperto da Ciro — Sala"]')).toBeVisible()
})
