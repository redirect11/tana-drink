// LE PAGINE DEI CLIENTI TRADOTTE DAL BROWSER (REQ-CLI-010).
//
// Daniele, 17/11/2026: le pagine dei clienti le traduce il browser. Il
// traduttore di Chrome sostituisce ogni testo con un <font> che porta la
// traduzione, e il nodo originale esce dalla pagina: React, che se lo
// ricorda, può far cadere l'app toccandolo, o aggiornare un nodo che non si
// vede più. La ricognizione del 17/11 ha trovato il secondo caso: il banco
// portava l'ordine a «pronto», l'icona cambiava e la scritta restava
// «Ordine ricevuto». Qui un browser vero imita il traduttore (ogni testo
// con delle parole diventa «EN …», anche quelli che compaiono dopo; i soli
// numeri restano com'erano, come fa Chrome) e il cliente ordina e aspetta.
import { test, expect, entra, apriCassa, nuovoOrdine, batti, tornaAllaCoda, cardDeiConti } from './banco.mjs'
import { database } from './semina.mjs'

function accendiIlTraduttore() {
  const salta = (n) => n.parentElement?.closest('script,style,[translate="no"],.notranslate,font[data-tradotto]')
  const traduci = (radice) => {
    if (!radice) return
    const giro = document.createTreeWalker(radice, NodeFilter.SHOW_TEXT)
    const nodi = []
    while (giro.nextNode()) nodi.push(giro.currentNode)
    for (const n of nodi) {
      if (!/[A-Za-zÀ-ÿ]/.test(n.nodeValue) || salta(n) || !n.parentNode) continue
      const fuori = document.createElement('font')
      fuori.setAttribute('data-tradotto', '')
      const dentro = document.createElement('font')
      dentro.textContent = `EN ${n.nodeValue}`
      fuori.appendChild(dentro)
      n.parentNode.replaceChild(fuori, n)
    }
  }
  traduci(document.body)
  new MutationObserver((cambi) => {
    for (const c of cambi) for (const n of c.addedNodes) traduci(n.nodeType === 3 ? n.parentNode : n)
  }).observe(document.body, { childList: true, subtree: true })
}

// L'avviso dell'emulatore di Firebase sta in basso e copre la barra del
// carrello: c'è solo con gli emulatori.
const senzaAvvisoEmulatore = (page) =>
  page.addStyleTag({ content: '.firebase-emulator-warning { display: none !important; }' })

test('il carrello del menù tradotto conta giusto', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const errori = []
  page.on('pageerror', (e) => errori.push(e.message))
  await page.goto('/menu')
  await page.getByRole('button', { name: 'Inizia' }).click()
  await senzaAvvisoEmulatore(page)
  await expect(page.getByRole('button', { name: 'Aggiungi' }).first()).toBeVisible()
  await page.evaluate(accendiIlTraduttore)

  // Il primo della lista è l'Hugo, 7 €.
  await page.getByRole('button', { name: /Aggiungi/ }).first().click()
  await page.getByRole('button', { name: /Aumenta/ }).first().click()
  await page.getByRole('button', { name: /Aumenta/ }).first().click()
  const barra = page.locator('.card, div').filter({ has: page.getByRole('button', { name: /Rivedi ordine/ }) }).last()
  await expect(barra).toContainText('21,00 €')
  await page.getByRole('button', { name: /Riduci/ }).first().click()
  await expect(barra).toContainText('14,00 €')
  await page.getByRole('button', { name: /Rivedi ordine/ }).click()
  await page.getByLabel(/Nome/).first().fill('Mario')
  // Il tasto cambia scritta col nome scritto: un testo solo nel suo
  // elemento, React lo riscrive per intero e il traduttore lo ritraduce.
  await expect(page.getByRole('button', { name: /Conferma ordine/ })).toBeVisible()
  expect(errori).toEqual([])
})

test('lo stato dell’ordine tradotto segue il banco', async ({ page: banco, browser }) => {
  await entra(banco, 'bartender@tana.local')
  await apriCassa(banco, 0)
  await nuovoOrdine(banco)
  await batti(banco, 'Negroni')
  await banco.getByRole('button', { name: /Invia comanda/ }).click()
  await tornaAllaCoda(banco)
  await cardDeiConti(banco).first().locator('.grid-card-main').click()
  await banco.waitForURL(/\/ordine\//)
  const id = banco.url().split('/ordine/')[1].split(/[/?#]/)[0]
  const ref = database().collection('orders').doc(id)
  await expect.poll(async () => (await ref.get()).data()?.comande?.length || 0, { timeout: 15000 }).toBeGreaterThan(0)

  // Il cliente: un altro browser, senza accesso, sulla pagina del suo ordine.
  const contesto = await browser.newContext({ viewport: { width: 390, height: 844 } })
  try {
    const cliente = await contesto.newPage()
    const errori = []
    cliente.on('pageerror', (e) => errori.push(e.message))
    await cliente.goto(`/ordine/${id}`)
    const stato = cliente.locator('.pill').first()
    await expect(stato).toContainText('Ordine ricevuto')
    await cliente.evaluate(accendiIlTraduttore)
    await expect(stato).toContainText('EN Ordine ricevuto')

    // Il banco porta avanti il lavoro; il conto è servito al tavolo.
    for (const [passo, scritta] of [
      ['in_preparazione', 'In preparazione'],
      ['pronto', 'Pronto al servizio'],
      ['ritirato', 'Servito'],
    ]) {
      const d = (await ref.get()).data()
      await ref.update({ comande: d.comande.map((c) => ({ ...c, status: passo })) })
      await expect(stato).toContainText(`EN ${scritta}`)
      await expect(stato).not.toContainText('Ordine ricevuto')
    }
    expect(errori).toEqual([])
  } finally {
    await contesto.close()
  }
})
