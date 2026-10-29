// =====================================================================
//  LE ILLUSTRAZIONI DEGLI SPECIAL «ALICE» (REQ-MENU-018), in SVG.
//
//    node scripts/illustrazioni-alice.mjs
//
//  Scrive public/illustrazioni/alice/<id>.svg. Lo stile è quello che
//  l'utente ha mandato come esempio il 29/10/2026: macchie d'acquerello
//  morbide che sbordano, qualche schizzo di colore, e sopra un tratto
//  d'inchiostro sottile e un po' tremolante. I due disegni d'esempio sono
//  solo il riferimento dello stile: qui non se ne copia niente.
//  I soggetti vengono dal libro di Lewis Carroll (pubblico dominio), non
//  dai film: la bottiglia «Bevimi», la tazza del tè dei matti, il cappello
//  col cartellino 10/6, l'orologio del Bianconiglio, il fungo del Bruco,
//  la rosa dipinta di rosso, il sorriso dello Stregatto, il cuore della
//  Regina.
//
//  L'acquerello è un filtro SVG (turbolenza che sposta i bordi, poi una
//  sfocatura leggera), gli schizzi sono puntini a caso ma ripetibili (un
//  seme per illustrazione): rilanciato, lo script riscrive gli stessi file.
// =====================================================================
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const CARTELLA = path.join(process.cwd(), 'public', 'illustrazioni', 'alice')

// I colori dell'acquerello, quelli degli esempi: rosa, pesca, giallo,
// azzurro, lilla, viola, e un rosso per la Regina.
const C = {
  rosa: '#f2a3b6',
  pesca: '#f6bf9a',
  giallo: '#f6d27a',
  azzurro: '#a9c3ea',
  lilla: '#c2acea',
  viola: '#8f6fd0',
  rosso: '#e66a78',
  verde: '#a9d3a0',
}

// Un generatore di numeri ripetibile (mulberry32): stessi schizzi a ogni giro.
function casuale(seme) {
  let a = seme >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Una macchia: la forma con il filtro dell'acquerello, più un cuore più
// carico dello stesso colore, come quando il pigmento si raccoglie.
const macchia = (forma, colore, opacita = 0.55) =>
  `<g filter="url(#acquerello)" style="mix-blend-mode:multiply">` +
  `<${forma} fill="${colore}" fill-opacity="${opacita}"/>` +
  `</g>`

function schizzi(r, colore, cx, cy, raggio, quanti) {
  let s = ''
  for (let i = 0; i < quanti; i++) {
    const ang = r() * Math.PI * 2
    const dist = raggio * (0.7 + r() * 0.7)
    const x = (cx + Math.cos(ang) * dist).toFixed(1)
    const y = (cy + Math.sin(ang) * dist).toFixed(1)
    const rr = (0.8 + r() * 3.2).toFixed(1)
    s += `<circle cx="${x}" cy="${y}" r="${rr}" fill="${colore}" fill-opacity="${(0.45 + r() * 0.4).toFixed(2)}"/>`
  }
  return s
}

function svg({ seme, macchie, schizzi: gocce, inchiostro, testo = '' }) {
  const r = casuale(seme)
  const puntini = gocce.map(([colore, cx, cy, raggio, quanti]) => schizzi(r, colore, cx, cy, raggio, quanti)).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
<defs>
  <filter id="acquerello" x="-40%" y="-40%" width="180%" height="180%">
    <feTurbulence type="fractalNoise" baseFrequency="0.017" numOctaves="3" seed="${seme}" result="rumore"/>
    <feDisplacementMap in="SourceGraphic" in2="rumore" scale="42" xChannelSelector="R" yChannelSelector="G"/>
    <feGaussianBlur stdDeviation="2.4"/>
  </filter>
  <filter id="mano" x="-5%" y="-5%" width="110%" height="110%">
    <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="${seme + 7}" result="tremito"/>
    <feDisplacementMap in="SourceGraphic" in2="tremito" scale="2.2" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
</defs>
${macchie.join('\n')}
<g>${puntini}</g>
<g filter="url(#mano)" fill="none" stroke="#1f1b24" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
${inchiostro}
</g>
${testo}
</svg>
`
}

const ILLUSTRAZIONI = {
  // La bottiglia col cartellino «BEVIMI».
  bevimi: svg({
    seme: 11,
    macchie: [
      macchia('ellipse cx="200" cy="225" rx="82" ry="100"', C.lilla),
      macchia('circle cx="262" cy="118" r="46"', C.rosa, 0.5),
      macchia('ellipse cx="146" cy="300" rx="62" ry="38"', C.azzurro, 0.5),
    ],
    schizzi: [
      [C.viola, 200, 225, 110, 22],
      [C.rosa, 262, 118, 60, 10],
    ],
    inchiostro: `
<path d="M186 80 Q200 70 214 80 L212 99 L188 99 Z"/>
<path d="M191 99 L191 132 Q160 152 158 192 L158 300 Q158 318 177 318 L223 318 Q242 318 242 300 L242 192 Q240 152 209 132 L209 99"/>
<path d="M158 213 L242 219 L238 256 L154 250 Z"/>
<path d="M200 133 Q186 168 172 214"/>
<path d="M172 275 Q200 286 228 275"/>`,
    testo: `<text x="198" y="241" text-anchor="middle" transform="rotate(4 198 237)" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="15" letter-spacing="1.5" fill="#1f1b24">BEVIMI</text>`,
  }),

  // La tazza del tè dei matti, col vapore.
  'tazza-te': svg({
    seme: 23,
    macchie: [
      macchia('circle cx="190" cy="252" r="102"', C.pesca),
      macchia('circle cx="262" cy="160" r="58"', C.giallo, 0.5),
      macchia('ellipse cx="120" cy="170" rx="38" ry="30"', C.rosa, 0.45),
    ],
    schizzi: [
      [C.pesca, 190, 252, 120, 18],
      [C.rosa, 120, 170, 50, 9],
    ],
    inchiostro: `
<ellipse cx="200" cy="304" rx="122" ry="22"/>
<ellipse cx="200" cy="300" rx="60" ry="9"/>
<path d="M120 212 Q124 300 200 300 Q276 300 280 212"/>
<ellipse cx="200" cy="212" rx="80" ry="16"/>
<path d="M280 228 Q326 226 318 257 Q310 286 266 272"/>
<path d="M178 184 C162 162 196 146 179 120"/>
<path d="M214 188 C198 166 232 150 215 124"/>
<path d="M150 250 Q170 262 190 250 Q210 238 230 250"/>`,
  }),

  // Il cappello del Cappellaio, col cartellino 10/6.
  cappello: svg({
    seme: 37,
    macchie: [
      macchia('ellipse cx="200" cy="222" rx="96" ry="112"', C.viola, 0.45),
      macchia('ellipse cx="210" cy="300" rx="130" ry="34"', C.rosa, 0.5),
      macchia('circle cx="292" cy="140" r="34"', C.azzurro, 0.5),
    ],
    schizzi: [
      [C.viola, 200, 222, 120, 20],
      [C.azzurro, 292, 140, 45, 8],
    ],
    inchiostro: `
<ellipse cx="200" cy="300" rx="122" ry="26"/>
<path d="M140 296 L151 150 M250 150 L262 296"/>
<ellipse cx="200" cy="150" rx="50" ry="12"/>
<path d="M146 255 Q200 270 258 255"/>
<path d="M145 271 Q200 286 260 271"/>
<path d="M216 206 L262 200 L267 236 L221 242 Z"/>`,
    testo: `<text x="242" y="226" text-anchor="middle" transform="rotate(-7 242 222)" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="15" fill="#1f1b24">10/6</text>`,
  }),

  // L'orologio da taschino del Bianconiglio.
  orologio: svg({
    seme: 41,
    macchie: [
      macchia('circle cx="200" cy="228" r="96"', C.giallo),
      macchia('circle cx="300" cy="300" r="40"', C.pesca, 0.5),
      macchia('circle cx="118" cy="140" r="30"', C.azzurro, 0.45),
    ],
    schizzi: [
      [C.giallo, 200, 228, 115, 18],
      [C.azzurro, 118, 140, 40, 8],
    ],
    inchiostro: `
<circle cx="200" cy="228" r="86"/>
<circle cx="200" cy="228" r="74"/>
<circle cx="200" cy="129" r="13"/>
<path d="M194 142 L194 132 M206 142 L206 132"/>
<path d="M200 162 L200 172 M200 284 L200 294 M134 228 L144 228 M256 228 L266 228"/>
<path d="M247 181 L241 187 M153 275 L159 269 M247 275 L241 269 M153 181 L159 187"/>
<path d="M200 228 L200 180 M200 228 L238 246"/>
<circle cx="200" cy="228" r="3"/>
<path d="M213 129 Q290 118 324 182 Q348 230 320 266 Q300 290 286 300"/>`,
  }),

  // Il fungo del Bruco, con l'erba a ricciolo degli esempi.
  fungo: svg({
    seme: 53,
    macchie: [
      macchia('ellipse cx="200" cy="176" rx="108" ry="62"', C.rosa),
      macchia('ellipse cx="200" cy="292" rx="44" ry="58"', C.azzurro, 0.5),
      macchia('ellipse cx="205" cy="348" rx="70" ry="12"', C.viola, 0.6),
    ],
    schizzi: [
      [C.rosa, 200, 176, 120, 18],
      [C.viola, 205, 348, 70, 8],
    ],
    inchiostro: `
<path d="M98 222 Q108 120 200 110 Q292 120 302 222 Q200 244 98 222 Z"/>
<path d="M140 226 Q150 236 160 230 M200 236 Q210 244 220 236 M250 230 Q262 238 270 226"/>
<path d="M172 230 Q160 300 176 332 L226 332 Q240 300 230 230"/>
<circle cx="160" cy="160" r="12"/>
<circle cx="225" cy="140" r="9"/>
<circle cx="262" cy="185" r="11"/>
<circle cx="195" cy="190" r="7"/>
<path d="M150 346 q15 -12 30 0 t30 0 t30 0 t30 0"/>`,
  }),

  // Una rosa bianca dipinta di rosso, con le gocce di vernice.
  rosa: svg({
    seme: 67,
    macchie: [
      macchia('circle cx="204" cy="182" r="72"', C.rosso, 0.55),
      macchia('ellipse cx="238" cy="284" rx="34" ry="22"', C.verde, 0.55),
      macchia('ellipse cx="150" cy="120" rx="34" ry="26"', C.rosa, 0.5),
    ],
    schizzi: [
      [C.rosso, 204, 182, 95, 22],
      [C.rosso, 204, 268, 20, 6],
    ],
    inchiostro: `
<path d="M203 172 C216 168 220 186 206 190 C188 194 183 172 196 162 C220 146 240 176 226 200 C206 226 164 212 166 182 C170 146 216 128 246 150 C270 168 262 214 232 228"/>
<path d="M166 182 C148 196 160 226 190 232"/>
<path d="M204 232 Q196 284 206 342"/>
<path d="M205 282 Q240 262 258 276 Q238 298 205 290"/>
<path d="M201 312 L190 306"/>`,
  }),

  // Il sorriso dello Stregatto, con gli occhi.
  stregatto: svg({
    seme: 79,
    macchie: [
      macchia('ellipse cx="200" cy="214" rx="122" ry="84"', C.lilla, 0.55),
      macchia('circle cx="150" cy="150" r="44"', C.rosa, 0.5),
      macchia('circle cx="270" cy="282" r="36"', C.azzurro, 0.5),
    ],
    schizzi: [
      [C.viola, 200, 214, 130, 22],
      [C.rosa, 150, 150, 55, 8],
    ],
    inchiostro: `
<path d="M108 218 Q200 302 292 218 Q200 262 108 218 Z"/>
<path d="M136 236 L140 250 M160 246 L163 262 M184 252 L185 268 M208 253 L208 269 M232 249 L230 265 M256 241 L252 256"/>
<path d="M136 160 Q162 138 188 160 Q162 176 136 160 Z"/>
<path d="M212 160 Q238 138 264 160 Q238 176 212 160 Z"/>
<path d="M162 148 L162 172 M238 148 L238 172"/>
<path d="M120 120 Q140 112 156 122 M244 122 Q262 112 280 120"/>`,
  }),

  // Il cuore della Regina, su una carta da gioco.
  cuori: svg({
    seme: 97,
    macchie: [
      macchia('circle cx="200" cy="212" r="60"', C.rosso, 0.55),
      macchia('ellipse cx="200" cy="212" rx="96" ry="118"', C.rosa, 0.35),
      macchia('circle cx="290" cy="128" r="32"', C.giallo, 0.5),
    ],
    schizzi: [
      [C.rosso, 200, 212, 120, 20],
      [C.giallo, 290, 128, 40, 7],
    ],
    inchiostro: `
<g transform="rotate(-8 200 210)">
<path d="M136 110 L264 110 Q274 110 274 120 L274 300 Q274 310 264 310 L136 310 Q126 310 126 300 L126 120 Q126 110 136 110 Z"/>
<path d="M200 246 C150 212 160 166 200 186 C240 166 250 212 200 246 Z"/>
<path d="M146 142 C138 134 141 124 148 128 C155 124 158 134 150 142 Z"/>
<path d="M254 278 C246 270 249 260 256 264 C263 260 266 270 258 278 Z"/>
</g>`,
  }),
}

mkdirSync(CARTELLA, { recursive: true })
for (const [id, contenuto] of Object.entries(ILLUSTRAZIONI)) {
  writeFileSync(path.join(CARTELLA, `${id}.svg`), contenuto)
}
console.log(`[illustrazioni] ✓ ${Object.keys(ILLUSTRAZIONI).length} file in ${path.relative(process.cwd(), CARTELLA)}`)
