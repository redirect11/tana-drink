// GLI AIUTI SOTTO I CAMPI, DA ACCENDERE O NO — sull'app intera.
//
// UR-013, REQ-UI-032. Richiesta dell'08/11/2026: «rimuovere gli aiuti
// sopra tutti i campi compilabili o almeno permettere di
// abilitarli/disabilitarli». Di partenza sono nascosti; si accendono da
// Impostazioni → Aspetto e la scelta vale per il locale: va nel database,
// quindi la ritrova anche un altro terminale.
import { test, expect, entra, vaiA } from './banco.mjs'

const apriSchedaNuovoProdotto = async (page) => {
  await vaiA(page, 'Menù')
  await page.getByRole('button', { name: /Aggiungi prodotto/ }).click()
  await expect(page.getByLabel(/IVA vendita/)).toBeVisible()
}

test('nascosti di partenza, accesi da Aspetto, ritrovati da un altro terminale', async ({ page, altroTerminale }) => {
  await entra(page, 'banco@tana.local')
  await apriSchedaNuovoProdotto(page)
  await expect(page.locator('.aiuto-campo')).toHaveCount(0)

  await vaiA(page, 'Impostazioni', 'Aspetto')
  const scelta = page.getByRole('group', { name: 'Aiuti sotto i campi' })
  await scelta.getByRole('button', { name: 'Visibili' }).click()
  await expect(scelta.getByRole('button', { name: 'Visibili' })).toHaveAttribute('aria-pressed', 'true')

  const altro = await altroTerminale()
  await entra(altro, 'bartender@tana.local')
  await apriSchedaNuovoProdotto(altro)
  await expect(altro.locator('.aiuto-campo').first()).toBeVisible()
  await expect(altro.getByText(/Se vuota si applica l.IVA del locale/)).toBeVisible()
})
