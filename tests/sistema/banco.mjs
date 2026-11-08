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
