// =====================================================================
//  LA BUILD DI UN LOCALE VERO NON CONTIENE LA DEMO (REQ-FLOTTA-019).
//
//    npm run build && node scripts/controlla-build-senza-demo.mjs   # dist/
//    node scripts/controlla-build-senza-demo.mjs percorso/della/dist
//
//  La demo la decide la build (`clienti/demo`), e il suo codice — dati di
//  prova, accesso finto, «Ricomincia da capo» — entra solo dietro la
//  costante `__DEMO__`. Nella build della Tana deve sparire tutto: se un
//  giorno qualcuno lo importasse fuori dal ramo giusto, i dati di prova e
//  l'accesso senza password finirebbero nel pacchetto di un locale vero.
//
//  Qui si cercano nel pacchetto delle frasi che stanno SOLO nel codice
//  della demo. Se ne trova una, esce con errore e la CI si ferma. La lista
//  si aggiorna se cambiano quelle frasi (un test controlla che ognuna stia
//  davvero nel codice della demo).
// =====================================================================
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

export const SEGNI_DELLA_DEMO = [
  'drink:demo-sessione',
  'drink:demo-ruolo',
  'drink:demo-dati',
  'Ricomincia da capo',
  'demo.invalid',
  'Nella demo il database non si raggiunge',
  'con-fascia-demo',
  'Casa Spritz',
]

export function cercaSegni(cartella) {
  const trovati = []
  const giro = (d) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f)
      if (statSync(p).isDirectory()) giro(p)
      else if (/\.(js|css|html|json|webmanifest)$/.test(f)) {
        const testo = readFileSync(p, 'utf8')
        for (const s of SEGNI_DELLA_DEMO) if (testo.includes(s)) trovati.push({ file: relative(cartella, p), segno: s })
      }
    }
  }
  giro(cartella)
  return trovati
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const cartella = process.argv[2] || 'dist'
  if (!existsSync(cartella)) {
    console.error(`[demo] ${cartella} non c'è: prima la build.`)
    process.exit(1)
  }
  const trovati = cercaSegni(cartella)
  if (trovati.length) {
    console.error('[demo] La build contiene codice della demo:')
    for (const t of trovati) console.error(`  ${t.file}: «${t.segno}»`)
    process.exit(1)
  }
  console.log(`[demo] ✓ ${cartella}: niente codice della demo.`)
}
