// OGNUNO FA QUELLO CHE IL SUO RUOLO CONSENTE — sull'app intera.
//
// UR-007. Le regole stanno in src/lib/ruoli.js e in firestore.rules, e le
// provano tests/unit/ruoli.test.js e tests/regole/; qui si prova quello che
// vede davvero chi entra con un'utenza vera, sull'app compilata: il ruolo
// arriva dal token dell'emulatore di Auth, non da un mock.
import { test, expect, entra } from './banco.mjs'

const menuLaterale = (page) => page.locator('nav.bar-sidebar')

// Le sezioni amministrative: il bartender le ha, la sala no (REQ-STAFF-001).
const AMMINISTRAZIONE = ['Cassa', 'Statistiche', 'Magazzino', 'Utenti e ruoli', 'Impostazioni']

test('il cliente non entra nel gestionale', async ({ page }) => {
  await entra(page, 'cliente@tana.local')
  await expect(page.getByText('Quest’area è riservata allo staff.')).toBeVisible()
  // Il menu laterale c'è anche per lui (il profilo, i suoi ordini), ma
  // senza niente del gestionale.
  for (const voce of ['Coda ordini', 'Nuovo ordine', ...AMMINISTRAZIONE]) {
    await expect(menuLaterale(page).getByText(voce, { exact: true }), `il cliente non vede «${voce}»`).toHaveCount(0)
  }
})

test('la sala lavora sulla coda, senza le sezioni amministrative', async ({ page }) => {
  await entra(page, 'sala@tana.local')
  const menu = menuLaterale(page)
  await expect(menu.getByText('Coda ordini', { exact: true })).toBeAttached()
  await expect(menu.getByText('Da servire', { exact: true })).toBeAttached()
  for (const voce of AMMINISTRAZIONE) {
    await expect(menu.getByText(voce, { exact: true }), `la sala non vede «${voce}»`).toHaveCount(0)
  }
})

test('il bartender ha il gestionale completo', async ({ page }) => {
  await entra(page, 'bartender@tana.local')
  const menu = menuLaterale(page)
  await expect(menu.getByText('Coda ordini', { exact: true })).toBeAttached()
  for (const voce of AMMINISTRAZIONE) {
    await expect(menu.getByText(voce, { exact: true }), `il bartender vede «${voce}»`).toBeAttached()
  }
})
