// LE CARTE CONSUMATE DELLO STILE «CARTE» (REQ-MENU-029): trasforma gli SVG
// di questa cartella (dorsi incisi e facce invecchiate, con filtri di
// rumore) nelle immagini webp di public/stili/carte/, che il foglio di stile
// usa come fondi. Gli SVG non si usano dal vivo: coi filtri il browser li
// ricalcolava per ogni carta e il menù si muoveva a scatti.
//
//   node scripts/carte-consumate/rasterizza.mjs scripts/carte-consumate public/stili/carte
//
// Serve Chrome (variabile CHROME per un percorso diverso). Si rilancia solo
// quando si ritocca un SVG.

import { spawn } from 'node:child_process'
import { readFileSync, readdirSync, writeFileSync, mkdtempSync, mkdirSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const [dentro, fuori] = process.argv.slice(2)
mkdirSync(fuori, { recursive: true })
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const porta = 9300 + Math.floor(Math.random() * 500)
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${porta}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'rast-'))}`, 'about:blank'], { stdio: 'ignore' })
const pausa = (ms) => new Promise((r) => setTimeout(r, ms))
let pagina
for (let i = 0; i < 40 && !pagina; i++) {
  await pausa(250)
  try { pagina = (await (await fetch(`http://127.0.0.1:${porta}/json/list`)).json()).find((t) => t.type === 'page') } catch { /* non ancora */ }
}
const ws = new WebSocket(pagina.webSocketDebuggerUrl)
await new Promise((r) => ws.addEventListener('open', r))
let id = 0
const attese = new Map()
ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && attese.has(m.id)) { attese.get(m.id)(m); attese.delete(m.id) } })
const cmd = (method, params = {}) => new Promise((r) => { const n = ++id; attese.set(n, r); ws.send(JSON.stringify({ id: n, method, params })) })

await cmd('Page.enable')
await cmd('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } })
for (const f of readdirSync(dentro).filter((x) => x.endsWith('.svg'))) {
  const nome = f.replace('.svg', '')
  // Le carte piccole al doppio della loro misura; la mattonella grande a
  // 380x540; il dorso della carta in volo, che arriva a tutta la larghezza
  // del telefono, a 720 (con quello piccolo era sgranato).
  const MISURE = { 'carta-grande': [380, 540], 'dorso-grande': [720, 1024] }
  const [w, h] = MISURE[nome] || [256, 364]
  const svg = readFileSync(join(dentro, f), 'utf8')
  const html = `<html><body style="margin:0;background:transparent"><img style="display:block;width:${w}px;height:${h}px" src="data:image/svg+xml,${encodeURIComponent(svg)}"></body></html>`
  await cmd('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false })
  await cmd('Page.navigate', { url: 'data:text/html,' + encodeURIComponent(html) })
  await pausa(900)
  const s = await cmd('Page.captureScreenshot', { format: 'webp', quality: nome.startsWith('dorso') ? 78 : 70, clip: { x: 0, y: 0, width: w, height: h, scale: 1 } })
  const out = join(fuori, nome + '.webp')
  writeFileSync(out, Buffer.from(s.result.data, 'base64'))
  console.log(nome, `${w}x${h}`, Math.round(statSync(out).size / 1024) + ' KB')
}
ws.close()
chrome.kill()
