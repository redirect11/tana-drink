// ── IL DISEGNO DI UN DRINK, COMPOSTO (REQ-MENU-018) ───────────────────
//
// L'utente, 29/10/2026: «le immagini dei drink dovrebbero rappresentare i
// drink proprio. Dei bicchieri di tipo diverso con decorazioni sempre in
// quello stile delle immagini che ti ho dato» — acquerello che sbava,
// schizzi di colore, tratto d'inchiostro sottile. Prima c'erano otto
// soggetti fissi a tema Alice (un cappello, un orologio…), che dicevano il
// tema ma non il drink.
//
// Un disegno si compone di tre scelte: il BICCHIERE, il COLORE del drink e
// la DECORAZIONE. Si genera qui, come testo SVG, e diventa un `data:` URL
// da mettere in un <img>: niente file da caricare, nessun id che si
// scontra fra due disegni nella stessa pagina, e l'acquerello si fonde con
// se stesso e non con la pagina.
//
// IL SEGNO È QUELLO DELLE INCISIONI DI JOHN TENNIEL, le illustrazioni
// originali del libro (1865, pubblico dominio): l'utente, 29/10/2026,
// «serve una roba più che sembra un disegno. Il tratto deve essere quello
// ispirato ai disegni originali del libro di Alice». Quindi le ombre si
// fanno col TRATTEGGIO — linee parallele sul lato in ombra, incrociate
// dove è più scuro, fitte e orizzontali nel liquido — il contorno è
// ripassato due volte come a penna, il riflesso del vetro è una linea
// sottile lasciata a lato, e sotto il piede c'è l'ombra tratteggiata.
// L'acquerello resta, leggero, come nelle edizioni colorate a mano.
//
// DUE VERSIONI DALLO STESSO DISEGNO: tratto bianco e colori che si sommano
// come luce sui temi scuri del menù (quelli di partenza), tratto scuro e
// colori come pigmento sui temi chiari («disegni bianchi su fondo scuro»,
// l'utente, 29/10/2026).
//
// Logica pura, senza browser: la usano l'app e i test.

export const BICCHIERI = [
  { id: 'coppa', nome: 'Coppa' },
  { id: 'martini', nome: 'Martini' },
  { id: 'basso', nome: 'Tumbler basso' },
  { id: 'alto', nome: 'Tumbler alto' },
  { id: 'flute', nome: 'Flûte' },
  { id: 'balloon', nome: 'Balloon' },
  { id: 'hurricane', nome: 'Hurricane' },
  { id: 'tazza', nome: 'Tazza' },
]

export const COLORI = [
  { id: 'rosa', nome: 'Rosa', hex: '#f2a3b6' },
  { id: 'pesca', nome: 'Pesca', hex: '#f6bf9a' },
  { id: 'ambra', nome: 'Ambra', hex: '#eeb65a' },
  { id: 'giallo', nome: 'Giallo', hex: '#f6dc78' },
  { id: 'azzurro', nome: 'Azzurro', hex: '#a9c3ea' },
  { id: 'lilla', nome: 'Lilla', hex: '#c2acea' },
  { id: 'viola', nome: 'Viola', hex: '#8f6fd0' },
  { id: 'rosso', nome: 'Rosso', hex: '#e66a78' },
  { id: 'verde', nome: 'Verde', hex: '#a9d3a0' },
  { id: 'limpido', nome: 'Limpido', hex: '#d9e6f2' },
]

export const DECORAZIONI = [
  { id: 'nessuna', nome: 'Nessuna' },
  { id: 'agrume', nome: 'Fetta di agrume' },
  { id: 'ciliegia', nome: 'Ciliegia' },
  { id: 'menta', nome: 'Menta' },
  { id: 'fiore', nome: 'Fiore' },
  { id: 'scorza', nome: 'Scorza' },
  { id: 'cannuccia', nome: 'Cannuccia' },
  { id: 'ombrellino', nome: 'Ombrellino' },
  { id: 'bevimi', nome: 'Cartellino «Bevimi»' },
  { id: 'cuori', nome: 'Carta di cuori' },
]

const C = {
  rosa: '#f2a3b6',
  pesca: '#f6bf9a',
  giallo: '#f6d27a',
  azzurro: '#a9c3ea',
  lilla: '#c2acea',
  viola: '#8f6fd0',
  rosso: '#e66a78',
  verde: '#8fcf86',
}

// La scelta pulita: tre valori conosciuti, o null. Un valore sconosciuto
// (scritto a mano, o tolto in una versione dopo) ricade sul primo della
// sua lista, così un disegno vecchio non diventa un'immagine rotta.
export function sceltaIllustrazione(x) {
  if (!x || typeof x !== 'object') return null
  const tra = (lista, v) => (lista.some((e) => e.id === v) ? v : lista[0].id)
  return {
    bicchiere: tra(BICCHIERI, x.bicchiere),
    colore: tra(COLORI, x.colore),
    decorazione: tra(DECORAZIONI, x.decorazione),
  }
}

// ── I BICCHIERI ────────────────────────────────────────────────────────
// `vetro`: il tratto. `liquido`: la forma del drink, che prende
// l'acquerello. `bordo`: il punto sul bordo destro dove si appoggia una
// decorazione. `cima`: il centro dell'imboccatura. `dentro`: un punto nel
// liquido, da dove parte una cannuccia o un ombrellino. `ghiaccio`: i
// cubetti, dove ci vanno.
const cubo = (x, y, s, ang) =>
  `<rect x="${x - s / 2}" y="${y - s / 2}" width="${s}" height="${s}" rx="5" transform="rotate(${ang} ${x} ${y})"/>`
const bolle = (punti) => punti.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')

const FORME = {
  coppa: {
    corpo: 'M120 150 Q130 216 200 219 Q270 216 280 150 Q200 160 120 150 Z',
    ombra: 232,
    base: 323,
    riflesso: 'M134 160 Q140 196 168 208',
    vetro: `<ellipse cx="200" cy="150" rx="80" ry="10"/>
<path d="M120 150 Q130 216 200 219 Q270 216 280 150"/>
<path d="M200 219 L200 318"/><ellipse cx="200" cy="323" rx="52" ry="9"/>`,
    liquido: 'M128 160 Q138 210 200 213 Q262 210 272 160 Q200 172 128 160 Z',
    bordo: [274, 150],
    cima: [200, 148],
    dentro: [214, 188],
  },
  martini: {
    corpo: 'M115 140 L200 236 L285 140 Q200 150 115 140 Z',
    ombra: 226,
    base: 325,
    riflesso: 'M134 152 L178 206',
    vetro: `<ellipse cx="200" cy="140" rx="85" ry="9"/>
<path d="M115 140 L200 236 L285 140"/>
<path d="M200 236 L200 320"/><ellipse cx="200" cy="325" rx="50" ry="8"/>`,
    liquido: 'M130 153 L200 230 L270 153 Q200 163 130 153 Z',
    bordo: [279, 140],
    cima: [200, 138],
    dentro: [214, 190],
  },
  basso: {
    corpo: 'M134 200 L142 320 Q200 331 258 320 L266 200 Q200 210 134 200 Z',
    ombra: 228,
    base: 324,
    riflesso: 'M146 214 L152 306',
    vetro: `<ellipse cx="200" cy="200" rx="66" ry="10"/>
<path d="M134 200 L142 320 Q200 331 258 320 L266 200"/>
<path d="M143 305 Q200 315 257 305"/>`,
    liquido: 'M139 238 L144 302 Q200 312 256 302 L261 238 Q200 249 139 238 Z',
    ghiaccio: `${cubo(172, 252, 40, -12)}${cubo(224, 246, 38, 14)}`,
    bordo: [262, 200],
    cima: [200, 198],
    dentro: [212, 262],
  },
  alto: {
    corpo: 'M150 118 L156 322 Q200 331 244 322 L250 118 Q200 126 150 118 Z',
    ombra: 222,
    base: 326,
    riflesso: 'M161 132 L166 304',
    vetro: `<ellipse cx="200" cy="118" rx="50" ry="8"/>
<path d="M150 118 L156 322 Q200 331 244 322 L250 118"/>
<path d="M157 306 Q200 314 243 306"/>`,
    liquido: 'M152 150 L157 304 Q200 312 243 304 L248 150 Q200 159 152 150 Z',
    ghiaccio: `${cubo(186, 176, 34, -10)}${cubo(214, 214, 33, 12)}${cubo(186, 250, 32, -6)}`,
    bolle: bolle([[228, 270, 3], [222, 288, 2.5], [232, 180, 2.5], [176, 290, 3]]),
    bordo: [248, 118],
    cima: [200, 116],
    dentro: [206, 236],
  },
  flute: {
    corpo: 'M172 100 Q166 200 190 246 L200 253 L210 246 Q234 200 228 100 Z',
    ombra: 210,
    base: 328,
    riflesso: 'M180 112 Q177 190 192 232',
    vetro: `<ellipse cx="200" cy="100" rx="28" ry="5"/>
<path d="M172 100 Q166 200 190 246 L200 253 L210 246 Q234 200 228 100"/>
<path d="M200 253 L200 322"/><ellipse cx="200" cy="327" rx="40" ry="7"/>`,
    liquido: 'M171 132 Q167 200 192 243 L200 249 L208 243 Q233 200 229 132 Q200 138 171 132 Z',
    bolle: bolle([[196, 220, 2.5], [204, 196, 2], [194, 170, 2.5], [206, 150, 2]]),
    bordo: [227, 100],
    cima: [200, 99],
    dentro: [202, 200],
  },
  balloon: {
    corpo: 'M142 120 Q108 232 200 263 Q292 232 258 120 Z',
    ombra: 232,
    base: 328,
    riflesso: 'M146 140 Q128 210 166 244',
    vetro: `<ellipse cx="200" cy="120" rx="58" ry="9"/>
<path d="M142 120 Q108 232 200 263 Q292 232 258 120"/>
<path d="M200 263 L200 322"/><ellipse cx="200" cy="327" rx="50" ry="8"/>`,
    liquido: 'M127 190 Q133 252 200 257 Q267 252 273 190 Q200 203 127 190 Z',
    ghiaccio: `${cubo(176, 214, 36, -14)}${cubo(222, 210, 34, 10)}`,
    bordo: [256, 120],
    cima: [200, 118],
    dentro: [210, 226],
  },
  hurricane: {
    corpo: 'M160 110 Q140 170 168 215 Q181 236 172 270 Q166 300 182 312 L218 312 Q234 300 228 270 Q219 236 232 215 Q260 170 240 110 Z',
    ombra: 214,
    base: 324,
    riflesso: 'M164 124 Q150 172 174 210',
    vetro: `<ellipse cx="200" cy="110" rx="40" ry="7"/>
<path d="M160 110 Q140 170 168 215 Q181 236 172 270 Q166 300 182 312 L218 312 Q234 300 228 270 Q219 236 232 215 Q260 170 240 110"/>
<path d="M182 312 L182 318 M218 312 L218 318"/><ellipse cx="200" cy="322" rx="44" ry="8"/>`,
    liquido:
      'M151 150 Q146 186 170 216 Q183 236 174 270 Q168 298 184 307 L216 307 Q232 298 226 270 Q217 236 230 216 Q254 186 249 150 Q200 160 151 150 Z',
    ghiaccio: `${cubo(186, 176, 30, -10)}${cubo(214, 190, 28, 12)}`,
    bordo: [240, 110],
    cima: [200, 108],
    dentro: [204, 250],
  },
  tazza: {
    corpo: 'M120 212 Q124 300 200 300 Q276 300 280 212 Z',
    ombra: 236,
    base: 310,
    riflesso: 'M134 226 Q140 270 166 286',
    vetro: `<ellipse cx="200" cy="304" rx="122" ry="22"/>
<ellipse cx="200" cy="300" rx="60" ry="9"/>
<path d="M120 212 Q124 300 200 300 Q276 300 280 212"/>
<ellipse cx="200" cy="212" rx="80" ry="16"/>
<path d="M280 228 Q326 226 318 257 Q310 286 266 272"/>`,
    liquido: 'M127 222 Q131 291 200 293 Q269 291 273 222 Q200 237 127 222 Z',
    bordo: [276, 212],
    cima: [200, 206],
    dentro: [214, 248],
  },
}

// ── LE DECORAZIONI ─────────────────────────────────────────────────────
// Ognuna dà il suo tratto e il suo colore d'acquerello, a partire dai
// punti del bicchiere. `testo` è per il cartellino, che scrive.
function decorazione(id, f) {
  const [bx, by] = f.bordo
  const [cx, cy] = f.cima
  const [dx, dy] = f.dentro
  switch (id) {
    case 'agrume': {
      const x = bx - 4
      const y = by - 20
      const raggi = [0, 60, 120, 180, 240, 300]
        .map((a) => {
          const r = (a * Math.PI) / 180
          return `M${x} ${y} L${(x + Math.cos(r) * 19).toFixed(1)} ${(y + Math.sin(r) * 19).toFixed(1)}`
        })
        .join(' ')
      return {
        macchia: `<circle cx="${x}" cy="${y}" r="24" fill="${C.giallo}" fill-opacity="0.6"/>`,
        tratto: `<circle cx="${x}" cy="${y}" r="24"/><circle cx="${x}" cy="${y}" r="19"/><path d="${raggi}"/>`,
      }
    }
    case 'ciliegia': {
      const x = bx - 28
      const y = by - 12
      return {
        macchia: `<circle cx="${x}" cy="${y}" r="15" fill="${C.rosso}" fill-opacity="0.7"/>`,
        tratto: `<circle cx="${x}" cy="${y}" r="12"/><path d="M${x + 3} ${y - 11} Q${x + 10} ${y - 40} ${x + 30} ${y - 52}"/><path d="M${x + 22} ${y - 46} Q${x + 34} ${y - 58} ${x + 42} ${y - 48} Q${x + 32} ${y - 42} ${x + 22} ${y - 46} Z"/>`,
      }
    }
    case 'menta': {
      const y = cy - 6
      const foglia = (x0, y0, x1, y1, piega) =>
        `<path d="M${x0} ${y0} Q${x0 + piega} ${(y0 + y1) / 2} ${x1} ${y1} Q${x0 - piega / 2} ${(y0 + y1) / 2 + 6} ${x0} ${y0} Z"/><path d="M${x0} ${y0} L${(x0 + x1) / 2} ${(y0 + y1) / 2}"/>`
      return {
        macchia: `<ellipse cx="${cx + 4}" cy="${y - 26}" rx="34" ry="24" fill="${C.verde}" fill-opacity="0.65"/>`,
        tratto:
          `<path d="M${cx + 2} ${y + 8} Q${cx} ${y - 14} ${cx + 4} ${y - 34}"/>` +
          foglia(cx + 2, y - 10, cx - 30, y - 30, 4) +
          foglia(cx + 3, y - 18, cx + 34, y - 36, -4) +
          foglia(cx + 4, y - 32, cx - 6, y - 60, 6),
      }
    }
    case 'fiore': {
      const x = bx - 8
      const y = by - 18
      const petali = [0, 72, 144, 216, 288]
        .map((a) => {
          const r = ((a - 90) * Math.PI) / 180
          return `<circle cx="${(x + Math.cos(r) * 11).toFixed(1)}" cy="${(y + Math.sin(r) * 11).toFixed(1)}" r="9"/>`
        })
        .join('')
      return {
        macchia: `<circle cx="${x}" cy="${y}" r="22" fill="${C.rosa}" fill-opacity="0.7"/>`,
        tratto: `${petali}<circle cx="${x}" cy="${y}" r="4.5"/>`,
      }
    }
    case 'scorza': {
      const x = bx + 2
      const y = by
      return {
        macchia: `<path d="M${x} ${y} q18 18 2 34 t4 34" stroke="${C.giallo}" stroke-width="14" fill="none" stroke-opacity="0.7"/>`,
        tratto: `<path d="M${x - 6} ${y - 4} Q${x + 10} ${y - 8} ${x + 6} ${y + 6} Q${x + 24} ${y + 20} ${x + 6} ${y + 36} Q${x - 10} ${y + 50} ${x + 10} ${y + 70}"/><path d="M${x + 2} ${y + 2} Q${x + 18} ${y + 20} ${x + 2} ${y + 36}"/>`,
      }
    }
    case 'cannuccia': {
      const x1 = dx
      const y1 = dy
      const x2 = bx + 6
      const y2 = cy - 70
      return {
        macchia: `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="${C.rosso}" stroke-width="10" stroke-opacity="0.55" fill="none"/>`,
        tratto: `<path d="M${x1 - 4} ${y1} L${x2 - 4} ${y2} M${x1 + 4} ${y1} L${x2 + 4} ${y2}"/><path d="M${x2 - 4} ${y2} L${x2 + 4} ${y2}"/>`,
      }
    }
    case 'ombrellino': {
      const x2 = bx - 14
      const y2 = cy - 58
      return {
        macchia: `<path d="M${x2 - 38} ${y2 + 4} Q${x2} ${y2 - 34} ${x2 + 38} ${y2 + 4} Z" fill="${C.rosa}" fill-opacity="0.7"/>`,
        tratto: `<path d="M${dx} ${dy} L${x2} ${y2 - 14}"/><path d="M${x2 - 38} ${y2 + 4} Q${x2} ${y2 - 34} ${x2 + 38} ${y2 + 4} Q${x2 + 19} ${y2 - 4} ${x2} ${y2 + 4} Q${x2 - 19} ${y2 - 4} ${x2 - 38} ${y2 + 4} Z"/><path d="M${x2} ${y2 - 14} L${x2} ${y2 + 4}"/>`,
      }
    }
    case 'bevimi': {
      const x = bx + 18
      const y = by + 34
      return {
        macchia: `<rect x="${x - 6}" y="${y - 4}" width="64" height="30" fill="${C.pesca}" fill-opacity="0.6" transform="rotate(8 ${x} ${y})"/>`,
        tratto: `<path d="M${bx - 4} ${by + 2} Q${bx + 6} ${by + 22} ${x + 4} ${y}"/><path d="M${x - 2} ${y - 2} L${x + 56} ${y + 6} L${x + 52} ${y + 32} L${x - 6} ${y + 24} Z"/>`,
        testo: `<text x="${x + 25}" y="${y + 20}" text-anchor="middle" transform="rotate(8 ${x + 25} ${y + 15})" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="12" letter-spacing="1" fill="__TRATTO__">BEVIMI</text>`,
      }
    }
    case 'cuori': {
      const x = bx - 6
      const y = cy - 62
      return {
        macchia: `<rect x="${x - 2}" y="${y - 2}" width="34" height="46" fill="${C.rosso}" fill-opacity="0.5" transform="rotate(12 ${x + 15} ${y + 21})"/>`,
        tratto: `<path d="M${dx + 6} ${dy} L${x + 14} ${y + 44}"/><g transform="rotate(12 ${x + 15} ${y + 21})"><rect x="${x}" y="${y}" width="30" height="42" rx="3"/><path d="M${x + 15} ${y + 30} C${x + 4} ${y + 22} ${x + 6} ${y + 12} ${x + 15} ${y + 17} C${x + 24} ${y + 12} ${x + 26} ${y + 22} ${x + 15} ${y + 30} Z"/></g>`,
      }
    }
    default:
      return null
  }
}

// ── IL FOGLIO ──────────────────────────────────────────────────────────
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
const semeDi = (testo) => [...testo].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7)

const VERSIONI = {
  scuro: { tratto: '#f4f0e8', fusione: 'screen', forza: 1.2 },
  chiaro: { tratto: '#1f1b24', fusione: 'multiply', forza: 1 },
}

export function svgDrink(scelta, { chiaro = false } = {}) {
  const s = sceltaIllustrazione(scelta)
  if (!s) return null
  const f = FORME[s.bicchiere]
  const colore = COLORI.find((c) => c.id === s.colore).hex
  const { tratto, fusione, forza } = VERSIONI[chiaro ? 'chiaro' : 'scuro']
  const op = (o) => Math.min(0.92, o * forza).toFixed(2)
  const seme = semeDi(`${s.bicchiere}|${s.colore}|${s.decorazione}`)
  const r = casuale(seme)
  const deco = decorazione(s.decorazione, f)
  // Una macchia dietro al bicchiere, di un colore vicino a quello del drink
  // ma spostata: è il «fondo» degli esempi, che non sta nei contorni.
  const dietro = [C.lilla, C.azzurro, C.rosa, C.pesca][seme % 4]
  const [cx, cy] = f.cima
  let puntini = ''
  for (let i = 0; i < 18; i++) {
    const ang = r() * Math.PI * 2
    const dist = 90 + r() * 70
    const col = i % 3 === 0 ? dietro : colore
    puntini += `<circle cx="${(200 + Math.cos(ang) * dist).toFixed(1)}" cy="${(225 + Math.sin(ang) * dist * 0.8).toFixed(1)}" r="${(0.8 + r() * 3).toFixed(1)}" fill="${col}" fill-opacity="${op(0.45 + r() * 0.35)}"/>`
  }
  const acquerello = (dentro) => `<g filter="url(#a)" style="mix-blend-mode:${fusione}">${dentro}</g>`
  const macchiaDeco = deco?.macchia ? deco.macchia.replace(/(fill|stroke)-opacity="([\d.]+)"/g, (_, k, o) => `${k}-opacity="${op(Number(o))}"`) : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400" style="isolation:isolate">
<defs>
<filter id="a" x="-40%" y="-40%" width="180%" height="180%"><feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="3" seed="${seme % 997}" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="34" xChannelSelector="R" yChannelSelector="G"/><feGaussianBlur stdDeviation="2"/></filter>
<filter id="m" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="${(seme % 991) + 7}" result="t"/><feDisplacementMap in="SourceGraphic" in2="t" scale="2" xChannelSelector="R" yChannelSelector="G"/></filter>
<pattern id="d" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(38)"><line x1="0" y1="0" x2="0" y2="6" stroke="${tratto}" stroke-width="1"/></pattern>
<pattern id="x" width="4.5" height="4.5" patternUnits="userSpaceOnUse" patternTransform="rotate(-40)"><line x1="0" y1="0" x2="0" y2="4.5" stroke="${tratto}" stroke-width="0.8"/></pattern>
<pattern id="o" width="4" height="4" patternUnits="userSpaceOnUse"><line x1="0" y1="2" x2="4" y2="2" stroke="${tratto}" stroke-width="0.6"/></pattern>
<clipPath id="c"><path d="${f.corpo}"/></clipPath>
<clipPath id="l"><path d="${f.liquido}"/></clipPath>
</defs>
${acquerello(`<ellipse cx="${cx + 18}" cy="${cy + 70}" rx="92" ry="82" fill="${dietro}" fill-opacity="${op(0.18)}"/>`)}
${acquerello(`<path d="${f.liquido}" fill="${colore}" fill-opacity="${op(0.5)}"/>`)}
${macchiaDeco ? acquerello(macchiaDeco) : ''}
<g>${puntini}</g>
<g filter="url(#m)">
<g clip-path="url(#l)"><rect width="400" height="400" fill="url(#o)" opacity="0.6"/></g>
<g clip-path="url(#c)"><rect x="${f.ombra}" width="200" height="400" fill="url(#d)" opacity="0.8"/><rect x="${f.ombra + 26}" width="200" height="400" fill="url(#x)" opacity="0.7"/></g>
<ellipse cx="${cx + 14}" cy="${f.base + 7}" rx="62" ry="8" fill="url(#d)" opacity="0.65"/>
</g>
<g filter="url(#m)" fill="none" stroke="${tratto}" stroke-width="1" stroke-linecap="round" opacity="0.55" transform="translate(1.4 0.9)">
${f.vetro}
</g>
<g filter="url(#m)" fill="none" stroke="${tratto}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
${f.vetro}
<path d="${f.riflesso}" stroke-width="1.2" opacity="0.8"/>
${f.ghiaccio || ''}
<g stroke-width="1.6">${f.bolle || ''}</g>
${deco?.tratto || ''}
</g>
${deco?.testo ? deco.testo.replace('__TRATTO__', tratto) : ''}
</svg>`
}

// Il disegno come indirizzo da mettere in un <img>, tenuto in memoria: la
// stessa scelta si disegna una volta sola.
const cache = new Map()
export function urlDrink(scelta, { chiaro = false } = {}) {
  const s = sceltaIllustrazione(scelta)
  if (!s) return null
  const chiave = `${s.bicchiere}|${s.colore}|${s.decorazione}|${chiaro ? 1 : 0}`
  if (!cache.has(chiave)) cache.set(chiave, `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgDrink(s, { chiaro }))}`)
  return cache.get(chiave)
}
