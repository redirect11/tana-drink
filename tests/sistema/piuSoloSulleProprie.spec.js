// IL «+» E IL «−» SOLO SULLE PROPRIE RIGHE — da un terminale all'altro.
//
// UR-012, REQ-ORD-024. Flavio, 09/11/2026: «se Alex da fuori vuole
// aggiungere una Tennent's non può fare +1, deve caricarla lui», altrimenti
// accanto all'iniziale di Flavio ci sarebbero due Tennent's e una non l'ha
// battuta lui. Due persone vere, su due browser separati: la riga del banco
// arriva alla sala con l'iniziale, e lì i suoi tasti sono spenti; la riga
// che la sala batte da sé è sua, e i tasti ci sono.
import { test, expect, entra, apriCassa, nuovoOrdine, batti, tornaAllaCoda, cardDeiConti } from './banco.mjs'

const riga = (page, drink) => page.locator('.draft-line').filter({ hasText: drink })
const tasto = (page, azione, drink) => riga(page, drink).getByRole('button', { name: `${azione} ${drink}` })

test('sulla riga del banco la sala non tocca la quantità; sulla sua sì', async ({ page: banco, browser }) => {
  await entra(banco, 'bartender@tana.local')
  await apriCassa(banco, 0)
  await nuovoOrdine(banco)
  await batti(banco, 'Negroni')
  await banco.getByRole('button', { name: /Invia comanda/ }).click()
  await expect(riga(banco, 'Negroni').locator('.riga-autore')).toBeVisible()
  // Chi l'ha battuta la può ancora cambiare.
  await expect(tasto(banco, 'Aumenta', 'Negroni')).toBeEnabled()
  await tornaAllaCoda(banco)

  const contesto = await browser.newContext()
  try {
    const sala = await contesto.newPage()
    await entra(sala, 'sala@tana.local')
    await expect(cardDeiConti(sala)).toHaveCount(1)
    await cardDeiConti(sala).first().locator('.grid-card-main').click()
    await expect(riga(sala, 'Negroni').locator('.riga-autore [title="Aggiunto da Marzia — Bartender"]')).toBeVisible()
    await expect(tasto(sala, 'Aumenta', 'Negroni')).toBeDisabled()
    await expect(tasto(sala, 'Riduci', 'Negroni')).toBeDisabled()

    // Un altro Negroni la sala lo batte dal prodotto: una riga sua, coi tasti.
    await batti(sala, 'Negroni')
    const sua = sala.locator('.draft-line').filter({ hasText: 'Negroni' }).filter({ hasNot: sala.locator('[title="Aggiunto da Marzia — Bartender"]') })
    await expect(sua).toHaveCount(1)
    await expect(sua.getByRole('button', { name: 'Aumenta Negroni' })).toBeEnabled()
  } finally {
    await contesto.close()
  }
})
