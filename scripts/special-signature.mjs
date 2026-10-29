// =====================================================================
//  I SIGNATURE DIVENTANO SPECIAL, CON DESCRIZIONE E DISEGNO (REQ-MENU-018).
//
//    node scripts/special-signature.mjs                  # ANTEPRIMA, sul test
//    node scripts/special-signature.mjs --apply          # scrive
//    node scripts/special-signature.mjs --sovrascrivi    # rifà anche descrizioni e disegni già scritti
//    node scripts/special-signature.mjs --project tana-drink --apply   # produzione, dopo il backup
//
//  L'utente, 29/10/2026: «Le descrizioni per ora inventale tu per tutti i
//  drink della categoria signature e dovrebbero essere tutti drink
//  speciali». Le voci della categoria SIGNATURE diventano `speciale`, e a
//  chi non ce l'ha si scrivono una descrizione e un disegno composto
//  (bicchiere, colore, decorazione: lib/illustrazioneDrink.js).
//
//  LE DESCRIZIONI SONO UNA PRIMA STESURA, da far rivedere a Flavio. Le
//  ricette in carta non ci sono ancora, quindi non nominano ingredienti
//  che non si conoscono (un ingrediente sbagliato in carta è anche un
//  allergene sbagliato): dicono il tema e il carattere del drink, e il
//  sapore solo dove è nel nome (basilico, caffè, tè).
//
//  Senza `--sovrascrivi` una descrizione o un disegno già scritti restano
//  com'erano: rilanciato, lo script tocca solo il segno `speciale`.
//  Default: progetto tana-drink-test. La produzione si nomina a mano, dopo
//  `node scripts/backup-db.js --project tana-drink --solo drinks`.
// =====================================================================
import { accessToken, arg, flag } from './lib-firestore.js'

const PROGETTO = arg('project', 'tana-drink-test')
const APPLY = flag('apply')
const SOVRASCRIVI = flag('sovrascrivi')

// Nome in carta (maiuscolo, senza spazi in più) → testo e disegno.
const SPECIAL = {
  'REGIN DI CUORI': {
    descrizione:
      'Rosso come le rose dipinte del giardino della Regina: un drink deciso e vellutato, servito in coppa, per chi non teme di perdere la testa.',
    disegno: { bicchiere: 'coppa', colore: 'rosso', decorazione: 'cuori' },
  },
  BASILICONIGLIO: {
    descrizione:
      'Il basilico fresco rincorre il Bianconiglio: un drink verde, aromatico e dissetante, da bere prima che sia troppo tardi.',
    disegno: { bicchiere: 'basso', colore: 'verde', decorazione: 'menta' },
  },
  STRAGATTO: {
    descrizione:
      'Viola come le strisce dello Stregatto: morbido e misterioso, sparisce dal bicchiere e lascia soltanto il sorriso.',
    disegno: { bicchiere: 'martini', colore: 'viola', decorazione: 'scorza' },
  },
  CAFFELLAIO: {
    descrizione:
      'Il caffè del Cappellaio Matto, servito sul ghiaccio: intenso e avvolgente, perfetto per festeggiare un non-compleanno.',
    disegno: { bicchiere: 'basso', colore: 'ambra', decorazione: 'nessuna' },
  },
  'ALICE BREAKFAST': {
    descrizione:
      'La colazione di Alice prima di cadere nella tana: fresco e luminoso, un buongiorno che arriva a qualsiasi ora.',
    disegno: { bicchiere: 'coppa', colore: 'pesca', decorazione: 'bevimi' },
  },
  'PINK-O-PANKO': {
    descrizione:
      'Rosa, leggero e pieno di sorprese: un drink giocoso e profumato, come il giardino in cui i fiori parlano.',
    disegno: { bicchiere: 'balloon', colore: 'rosa', decorazione: 'fiore' },
  },
  'ORA DEL TE': {
    descrizione:
      'Sono sempre le sei al tavolo del Cappellaio: un drink al tè, delicato e aromatico, servito in tazza come vuole la tradizione.',
    disegno: { bicchiere: 'tazza', colore: 'ambra', decorazione: 'agrume' },
  },
  BLUKALIF: {
    descrizione:
      'Blu come il fumo del narghilè del Bruco: esotico, fresco e sorprendente, da sorseggiare con calma seduti su un fungo.',
    disegno: { bicchiere: 'hurricane', colore: 'azzurro', decorazione: 'ombrellino' },
  },
}

const token = await accessToken()
const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
const BASE = `https://firestore.googleapis.com/v1/projects/${PROGETTO}/databases/(default)/documents`
async function tutti(col) {
  let out = []
  let pt = ''
  do {
    const r = await (await fetch(`${BASE}/${col}?pageSize=300${pt ? `&pageToken=${pt}` : ''}`, { headers: H })).json()
    if (r.error) throw new Error(r.error.message)
    out = out.concat(r.documents || [])
    pt = r.nextPageToken || ''
  } while (pt)
  return out
}
const v = (f) => f?.stringValue ?? f?.booleanValue ?? null
const normale = (n) => String(n || '').trim().replace(/\s+/g, ' ').toUpperCase()

const categorie = await tutti('categories')
const signature = categorie.filter((c) => /^signature$/i.test(String(v(c.fields?.name)).trim())).map((c) => c.name.split('/').pop())
if (signature.length === 0) {
  console.error('[special] nessuna categoria SIGNATURE.')
  process.exit(1)
}
const voci = (await tutti('drinks')).filter(
  (d) => signature.includes(v(d.fields?.category_id)) || /^signature$/i.test(String(v(d.fields?.category) || '').trim())
)
console.log(`[special] ${PROGETTO}: ${voci.length} voci in SIGNATURE${APPLY ? '' : ' (anteprima)'}`)

const scritture = []
for (const d of voci) {
  const f = d.fields || {}
  const nome = normale(v(f.name))
  const scheda = SPECIAL[nome]
  const campi = { speciale: { booleanValue: true } }
  const cambi = []
  if (v(f.speciale) !== true) cambi.push('speciale')
  if (scheda && (SOVRASCRIVI || !v(f.description))) {
    campi.description = { stringValue: scheda.descrizione }
    cambi.push('descrizione')
  }
  const haDisegno = f.illustrazione?.mapValue
  if (scheda && (SOVRASCRIVI || !haDisegno)) {
    campi.illustrazione = {
      mapValue: {
        fields: Object.fromEntries(Object.entries(scheda.disegno).map(([k, x]) => [k, { stringValue: x }])),
      },
    }
    cambi.push('disegno')
  }
  console.log(`  ${cambi.length ? '~' : '='} ${v(f.name)}${cambi.length ? `: ${cambi.join(', ')}` : ''}${scheda ? '' : '  (nessuna descrizione pronta: solo il segno)'}`)
  if (cambi.length) scritture.push({ nome: d.name, campi })
}

if (!APPLY) {
  console.log(`[special] ANTEPRIMA: ${scritture.length} voci da scrivere. Aggiungi --apply per salvare.`)
  process.exit(0)
}
const writes = scritture.map((w) => ({
  update: { name: w.nome, fields: w.campi },
  updateMask: { fieldPaths: Object.keys(w.campi) },
}))
if (writes.length) {
  const r = await fetch(`${BASE}:commit`, { method: 'POST', headers: H, body: JSON.stringify({ writes }) })
  const j = await r.json()
  if (j.error) throw new Error(j.error.message)
}
console.log(`[special] ✓ ${writes.length} voci scritte su "${PROGETTO}".`)
