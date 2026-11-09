// I GESTI DEL BANCO, per i test di sistema.
//
// Un test di sistema racconta un giro come lo fa chi lavora; i passi che
// si ripetono in ogni giro (entrare, aprire la cassa, battere un drink)
// stanno qui, così quando cambia un'etichetta si cambia in un posto solo e
// i test restano leggibili come una sequenza di gesti.
import { test as base, expect } from '@playwright/test'
import semina from './semina.mjs'
import { SEED_UTENTI } from '../../src/dev/seedData.js'

// OGNI TEST PARTE DA UN DATABASE PULITO. I test condividono lo stesso
// emulatore: un giro che apre la cassa la lascerebbe aperta al prossimo, che
// la troverebbe aperta e proverebbe un'altra serata. Si risemina prima di
// ciascuno (pochi secondi), e i test si importano da qui invece che da
// @playwright/test.
export const test = base.extend({
  databasePulito: [async ({}, usa) => { await semina(); await usa() }, { auto: true }],
})
export { expect }

// Le utenze le crea scripts/seed.js da SEED_UTENTI: la password si prende da
// lì, così cambiando il seme i test non restano chiusi fuori.
export async function entra(page, email) {
  const utenza = SEED_UTENTI.find((u) => u.email === email)
  if (!utenza) throw new Error(`[sistema] ${email} non è fra le utenze del seme (src/dev/seedData.js)`)
  await page.goto('/bar')
  await page.getByLabel('Email').fill(email)
  await page.locator('#password').fill(utenza.password)
  await page.getByRole('button', { name: 'Entra', exact: true }).click()
}

export async function apriCassa(page, fondo) {
  await page.getByText('Cassa chiusa').waitFor()
  await page.getByRole('button', { name: 'Apri cassa' }).first().click()
  await page.locator('#fondo-cassa').fill(String(fondo))
  await page.locator('.confirm-box').getByRole('button', { name: 'Apri cassa' }).click()
  await expect(page.getByRole('button', { name: /Chiudi cassa/ })).toBeVisible()
}

export const nuovoOrdine = (page) => page.getByRole('link', { name: 'Nuovo ordine', exact: true }).click()

// Un drink dalla griglia del conto. `first()` perché lo stesso nome
// compare anche fra le righe del conto, una volta battuto.
export const batti = (page, drink) => page.getByText(drink, { exact: true }).first().click()

export async function tornaAllaCoda(page) {
  await page.getByRole('button', { name: 'Torna agli ordini' }).click()
  // Un conto con delle righe chiede il nome uscendo; uno vuoto no.
  const senzaNome = page.getByRole('button', { name: 'Salva senza nome' })
  if (await senzaNome.isVisible().catch(() => false)) await senzaNome.click()
}

export const cardDeiConti = (page) => page.locator('.order-card')

// Un conto battuto e chiuso in un colpo, dal conto stesso: i drink, poi
// Pagamento e il metodo. `Impagato` chiude senza incasso (REQ-CASSA-016).
export async function contoChiuso(page, drink, metodo, totale) {
  await nuovoOrdine(page)
  for (const d of drink) await batti(page, d)
  await page.getByRole('button', { name: new RegExp(`Pagamento · ${totale}`) }).click()
  if (metodo === 'Impagato') {
    await page.getByRole('button', { name: /Impagato/ }).click()
    await page.getByRole('dialog', { name: 'Chiudi impagato' }).getByRole('button', { name: 'Chiudi impagato' }).click()
  } else {
    await page.getByRole('button', { name: metodo }).click()
    await page.getByRole('button', { name: `Riscuotere · ${totale}` }).click()
  }
  await expect(page.getByText(/0 aperti/)).toBeVisible()
}

// UNA SEZIONE DEL GESTIONALE dal menu laterale. Sul tablet il menu sta
// fuori dallo schermo finché non si tocca «Menu»: c'è nella pagina, ma un
// dito non lo raggiunge, e nemmeno Playwright. Appena entrati il tasto c'è
// già ma l'app sta ancora montando la coda, e un tocco in quell'istante va
// perso: si ritocca finché il menu non è aperto davvero.
// Quello dentro lo schermo: sulla coda la barra in alto è ritirata, e il
// suo tasto resta nella pagina ma sopra il bordo.
async function tastoMenu(page) {
  const tasti = page.getByRole('button', { name: 'Menu', exact: true })
  for (const t of await tasti.all()) {
    const box = await t.boundingBox().catch(() => null)
    if (box && box.y >= 0 && box.width > 0) return t
  }
  return tasti.first()
}

async function apriMenu(page) {
  // Aperto, o agganciato alla pagina (le pagine con sezioni proprie, su
  // uno schermo largo). I tasti «Menu» sono più d'uno — in barra, sulla
  // coda, flottante — e se ne vede uno per schermata.
  const aperto = page.locator('nav.bar-sidebar.open, nav.bar-sidebar.agganciata')
  await expect(async () => {
    if (!(await aperto.isVisible())) await tastoMenu(page).then((t) => t.click({ timeout: 2000 }))
    await expect(aperto).toBeVisible({ timeout: 1000 })
  }).toPass({ timeout: 20_000 })
}

export async function vaiA(page, voce, sottosezione) {
  const nelMenu = (testo) => page.locator('nav.bar-sidebar').getByText(testo, { exact: true })
  await apriMenu(page)
  await nelMenu(voce).click()
  if (!sottosezione) return
  // Le sottosezioni compaiono nel menu quando la pagina è aperta.
  await apriMenu(page)
  await nelMenu(sottosezione).click()
}
