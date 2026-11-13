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
// ispirato ai disegni originali del libro di Alice». Come lo si ottiene sta
// più sotto, in «IL SEGNO DI TENNIEL» (rifatto il 04/11/2026, REQ-MENU-026).
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
        ombra: [x, y, 24],
        sagoma: `<circle cx="${x}" cy="${y}" r="24"/>`,
        tratto: `<circle cx="${x}" cy="${y}" r="24"/><circle cx="${x}" cy="${y}" r="19"/><path d="${raggi}"/>`,
      }
    }
    case 'ciliegia': {
      const x = bx - 28
      const y = by - 12
      return {
        macchia: `<circle cx="${x}" cy="${y}" r="15" fill="${C.rosso}" fill-opacity="0.7"/>`,
        ombra: [x, y, 12, 2.2],
        sagoma: `<circle cx="${x}" cy="${y}" r="12"/>`,
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
        ombra: [x, y, 21],
        sagoma: petali,
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
        ombra: [x2, y2 - 6, 38],
        sagoma: `<path d="M${x2 - 38} ${y2 + 4} Q${x2} ${y2 - 34} ${x2 + 38} ${y2 + 4} Z"/>`,
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

// ── I SEGNI: LO STESSO DRINK, DISEGNATO DA MANI DIVERSE (REQ-MENU-024) ──
// L'utente, 02/11/2026: «gli stili però devono avere anche UX diverse e
// immagini diverse da quelle proposte per la tana (drink stilizzati)». Il
// segno di Tenniel con l'acquerello è l'identità della Tana; ogni stile del
// menù disegna gli stessi drink (bicchiere, colore, decorazione: nessuno
// rifà le schede) col suo segno.
const SEGNI = ['tenniel', 'incisione']

export function svgDrink(scelta, { chiaro = false, segno = 'tenniel' } = {}) {
  const s = sceltaIllustrazione(scelta)
  if (!s) return null
  if (segno === 'incisione') return svgIncisione(s, { chiaro })
  return svgTenniel(s, { chiaro })
}

// ── IL SEGNO DI TENNIEL (REQ-MENU-026) ─────────────────────────────────
// Flavio, 04/11/2026, sulle scene degli Special: «disegno in stile Lewis
// Carroll dal libro, tecnica acquerello; non è che ci siamo molto». Il
// primo segno metteva dentro la sagoma un retino di righe dritte e faceva
// tremare il contorno con un filtro: da lontano un'ombra, da vicino un
// disegno fatto a macchina. Nelle tavole di Tenniel (incise su legno dai
// fratelli Dalziel, 1865: il «Drink me», le tazze del Cappellaio) il
// tratteggio SEGUE LA FORMA — sul vetro le righe scendono lungo il
// bicchiere e girano col bordo — il contorno è più grosso dal lato in
// ombra e si assottiglia alle punte, la luce è il bianco della carta
// lasciato com'è, e sotto l'oggetto l'ombra è fatta di righe orizzontali
// che si perdono nel terreno. Le tavole sono in bianco e nero:
// l'acquerello lo aggiungiamo noi (l'utente, lo stesso giorno), steso
// piatto e un po' fuori dal segno, come il colore dato a mano.
//
// Per far girare le righe col vetro, ogni bicchiere è un SOLIDO DI
// ROTAZIONE: il profilo (il raggio a ogni altezza) e `e`, quanto lo si
// vede dall'alto (lo schiacciamento delle ellissi). Da lì vengono
// contorni, anelli (le righe che girano) e meridiani (quelle che scendono).
// La luce viene da sinistra, come nelle tavole.
const CX = 200
const n1 = (v) => Math.round(v * 10) / 10
const linea = (punti) => (punti.length > 1 ? `M${punti.map(([x, y]) => `${n1(x)} ${n1(y)}`).join('L')}` : '')

const SAGOME = {
  coppa: {
    profilo: [[150, 80], [162, 79], [176, 75], [190, 66], [202, 52], [211, 36], [217, 18], [219, 0]],
    e: 0.13,
    livello: 160,
    gambo: { da: 219, a: 316, r: 3.5 },
    piede: { y: 323, r: 52 },
  },
  martini: {
    profilo: [[140, 85], [236, 0]],
    lineare: true,
    e: 0.11,
    livello: 153,
    gambo: { da: 236, a: 320, r: 3 },
    piede: { y: 325, r: 50 },
  },
  basso: {
    profilo: [[200, 66], [320, 58]],
    lineare: true,
    e: 0.15,
    fondo: 305,
    livello: 238,
    ghiaccio: [[172, 262, 40, -12], [226, 258, 38, 14]],
  },
  alto: {
    profilo: [[118, 50], [322, 44]],
    lineare: true,
    e: 0.16,
    fondo: 306,
    livello: 150,
    ghiaccio: [[186, 176, 34, -10], [214, 214, 33, 12], [186, 252, 32, -6]],
    bolle: [[228, 272, 3], [222, 290, 2.5], [232, 182, 2.5], [174, 292, 3]],
  },
  flute: {
    profilo: [[100, 28], [130, 30], [170, 30], [205, 26], [230, 18], [246, 8], [253, 0]],
    e: 0.18,
    livello: 132,
    gambo: { da: 253, a: 322, r: 2.5 },
    piede: { y: 327, r: 40 },
    bolle: [[196, 222, 2.5], [204, 198, 2], [194, 172, 2.5], [206, 152, 2]],
  },
  balloon: {
    profilo: [[120, 58], [140, 64], [165, 71], [190, 74], [210, 72], [230, 64], [245, 52], [256, 34], [262, 14], [263, 0]],
    e: 0.15,
    livello: 190,
    gambo: { da: 263, a: 322, r: 3 },
    piede: { y: 327, r: 50 },
    ghiaccio: [[178, 222, 34, -14], [222, 218, 32, 10]],
  },
  hurricane: {
    profilo: [[110, 40], [130, 46], [150, 49], [175, 46], [200, 37], [218, 30], [238, 25], [258, 27], [280, 28], [298, 24], [312, 18]],
    e: 0.17,
    fondo: 306,
    livello: 150,
    gambo: { da: 312, a: 318, r: 14 },
    piede: { y: 322, r: 44 },
    ghiaccio: [[188, 178, 30, -10], [214, 194, 28, 12]],
  },
  tazza: {
    profilo: [[212, 80], [235, 78], [258, 71], [278, 60], [292, 48], [300, 38]],
    e: 0.2,
    opaca: true,
    livello: 222,
    piattino: { y: 304, r: 122, pozzo: 60 },
  },
}

// Il raggio a ogni altezza: una curva morbida che passa per i punti del
// profilo (o una retta, per i bicchieri a pareti dritte).
function raggioDi(punti, lineare) {
  return (y) => {
    const ult = punti.length - 1
    if (y <= punti[0][0]) return punti[0][1]
    if (y >= punti[ult][0]) return punti[ult][1]
    let i = 0
    while (punti[i + 1][0] < y) i++
    const [ya, a] = punti[i]
    const [yb, b] = punti[i + 1]
    const t = (y - ya) / (yb - ya)
    if (lineare) return a + (b - a) * t
    const p = punti[i - 1] ? punti[i - 1][1] : a
    const q = punti[i + 2] ? punti[i + 2][1] : b
    const r = 0.5 * (2 * a + (b - p) * t + (2 * p - 5 * a + 4 * b - q) * t * t + (3 * a - p - 3 * b + q) * t * t * t)
    return Math.max(0, r)
  }
}

// I valori da a a b, a passi di circa `passo`, estremi compresi.
function passi(a, b, passo) {
  const n = Math.max(1, Math.ceil(Math.abs(b - a) / passo))
  return Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n)
}

// UN TRATTO A PENNA: largo nel mezzo e sottile alle punte, come la riga
// incisa col bulino. È un poligono pieno e non una linea: una linea di SVG
// ha la stessa larghezza da un capo all'altro, ed era quello che dava al
// disegno l'aria della macchina.
function penna(punti, larghezza, punta = 0.3) {
  const n = punti.length
  if (n < 2) return ''
  const sopra = []
  const sotto = []
  for (let i = 0; i < n; i++) {
    const [xa, ya] = punti[Math.max(0, i - 1)]
    const [xb, yb] = punti[Math.min(n - 1, i + 1)]
    const l = Math.hypot(xb - xa, yb - ya) || 1
    const nx = -(yb - ya) / l
    const ny = (xb - xa) / l
    const w = (larghezza * (punta + (1 - punta) * Math.sin((Math.PI * i) / (n - 1)))) / 2
    sopra.push([punti[i][0] + nx * w, punti[i][1] + ny * w])
    sotto.push([punti[i][0] - nx * w, punti[i][1] - ny * w])
  }
  return `${linea([...sopra, ...sotto.reverse()])}Z`
}

// Il tratteggio di una piccola forma tonda (una fetta, una ciliegia):
// righe parallele inclinate sulla metà in basso a destra, quella in ombra.
function tratteggioTondo(x, y, r, passo = 3.2) {
  const dir = [0.643, -0.766]
  const nor = [0.766, 0.643]
  let d = ''
  for (let o = r * 0.1; o < r; o += passo) {
    const m = Math.sqrt(r * r - o * o)
    const c = [x + nor[0] * o, y + nor[1] * o]
    d += linea([
      [c[0] - dir[0] * m, c[1] - dir[1] * m],
      [c[0] + dir[0] * m, c[1] + dir[1] * m],
    ])
  }
  return d
}

// Quanto «pesa» un colore, in tratteggio: i chiari quasi niente, i rossi e
// i bruni molto. Vale per questo segno e per l'incisione.
const PESO = { limpido: 0.15, giallo: 0.3, pesca: 0.45, azzurro: 0.45, verde: 0.55, rosa: 0.55, lilla: 0.6, ambra: 0.7, rosso: 0.8, viola: 0.85 }

function svgTenniel(s, { chiaro }) {
  const g = SAGOME[s.bicchiere]
  const f = FORME[s.bicchiere]
  const colore = COLORI.find((c) => c.id === s.colore).hex
  const peso = PESO[s.colore] ?? 0.5
  const { tratto, fusione, forza } = VERSIONI[chiaro ? 'chiaro' : 'scuro']
  const op = (o) => Math.min(0.92, o * forza).toFixed(2)
  const seme = semeDi(`${s.bicchiere}|${s.colore}|${s.decorazione}`)
  const r = casuale(seme)
  const deco = decorazione(s.decorazione, f)
  const { e } = g
  const R = raggioDi(g.profilo, g.lineare)
  const y0 = g.profilo[0][0]
  const y1 = g.profilo[g.profilo.length - 1][0]
  const rb = R(y1)

  // Un punto sull'anello di raggio rr all'altezza y, a `sin` del giro
  // (-1 a sinistra, 1 a destra), sul davanti o sul dietro.
  const sulGiro = (y, rr, sin, davanti = true) => [CX + rr * sin, y + (davanti ? 1 : -1) * e * rr * Math.sqrt(Math.max(0, 1 - sin * sin))]
  const arco = (y, rr, sa, sb, davanti = true, ee = e) => {
    const a = Math.asin(sa)
    const b = Math.asin(sb)
    return passi(a, b, 4 / Math.max(rr, 1)).map((t) => [CX + rr * Math.sin(t), y + (davanti ? 1 : -1) * ee * rr * Math.cos(t)])
  }
  const meridiano = (sin, ya, yb, k = 1) => passi(ya, yb, 3).map((y) => sulGiro(y, R(y) * k, sin))

  const contorni = [] // pieni: il segno della penna
  const fini = [] // il tratteggio, righe sottili
  const liquidoTratti = [] // il tratteggio del liquido, ritagliato
  const add = (lista, d) => d && lista.push(d)

  // IL CONTORNO: il bordo (dietro sottile, davanti pieno), i due fianchi
  // (quello in ombra più grosso), il fondo.
  add(contorni, penna(arco(y0, R(y0), -1, 1, false), 1.3, 0.5))
  add(contorni, penna(arco(y0, R(y0), -1, 1), 2.1, 0.5))
  add(contorni, penna(passi(y0, y1, 3).map((y) => [CX - R(y), y]), 2, 0.5))
  add(contorni, penna(passi(y0, y1, 3).map((y) => [CX + R(y), y]), 3.2, 0.5))
  if (rb > 1) add(contorni, penna(arco(y1, rb, -1, 1), 2.8, 0.5))
  if (g.fondo) add(contorni, penna(arco(g.fondo, R(g.fondo) * 0.94, -0.95, 0.95), 1.3, 0.2))

  // LO STELO E IL PIEDE, e dove l'oggetto tocca il tavolo.
  let base = rb > 1 ? y1 + e * rb + 3 : y1
  let largo = Math.max(rb, 30)
  if (g.gambo) {
    const { da, a, r: rs } = g.gambo
    add(contorni, penna([[CX - rs, da], [CX - rs * 0.8, (da + a) / 2], [CX - rs, a]], 1.4, 0.6))
    add(contorni, penna([[CX + rs, da], [CX + rs * 0.8, (da + a) / 2], [CX + rs, a]], 2.6, 0.6))
  }
  if (g.piede) {
    const { y, r: rp } = g.piede
    const ep = 0.17
    add(contorni, penna(arco(y, rp, -1, 1, false, ep), 1.2, 0.4))
    add(contorni, penna(arco(y, rp, -1, 1, true, ep), 2.6, 0.4))
    add(contorni, penna(arco(y + 3, rp, -0.97, 0.97, true, ep), 1.3, 0.2))
    for (const k of [0.5, 0.66, 0.82]) add(fini, linea(arco(y, rp * k, 0.3 + r() * 0.15, 0.97, true, ep)))
    base = y + ep * rp + 5
    largo = rp
  }

  // LA TAZZA, che di vetro non è: il tratteggio la gira tutta a destra,
  // il tè si vede solo in cima, il piattino sotto.
  let liquidoForma
  if (g.opaca) {
    for (let y = y0 + 6; y < y1 - 1; y += 4) add(fini, linea(arco(y, R(y), 0.3 + r() * 0.2, 0.98)))
    for (const sin of [0.82, 0.88, 0.93, 0.97]) add(fini, linea(meridiano(sin, y0 + 4 + r() * 10, y1)))
    const L = g.livello
    const ri = R(L) * 0.96
    // L'interno in ombra, a sinistra fra il bordo e il tè.
    for (let sin = -0.95; sin < -0.3; sin += 0.09) add(fini, linea([sulGiro(y0, R(y0) * 0.97, sin, false), sulGiro(L, ri, sin, false)]))
    liquidoForma = `${linea([...arco(L, ri, -1, 1, false), ...arco(L, ri, 1, -1)])}Z`
    const passo = 5.6 - peso * 2.6
    for (let y = L - e * ri + passo; y < L + e * ri; y += passo) add(liquidoTratti, linea([[CX - ri * (0.15 + (1 - peso) * 0.55), y], [CX + ri, y]]))
    add(contorni, penna(arco(L, ri, -1, 1, false), 1, 0.3))
    // Il manico, a doppio filo.
    const q = (a, b, c) => passi(0, 1, 0.08).map((t) => [0, 1].map((k) => (1 - t) ** 2 * a[k] + 2 * (1 - t) * t * b[k] + t * t * c[k]))
    add(contorni, penna([...q([280, 228], [326, 226], [318, 257]), ...q([318, 257], [310, 286], [266, 272]).slice(1)], 3, 0.4))
    add(contorni, penna([...q([280, 238], [314, 236], [308, 257]), ...q([308, 257], [302, 278], [270, 263]).slice(1)], 1.5, 0.4))
    add(fini, linea(q([312, 244], [318, 257], [309, 272])))
    // Il piattino.
    const p = g.piattino
    const ep = 0.18
    add(contorni, penna(arco(p.y, p.r, -1, 1, false, ep), 1.2, 0.4))
    add(contorni, penna(arco(p.y, p.r, -1, 1, true, ep), 2.6, 0.4))
    add(contorni, penna(arco(p.y + 4, p.r, -0.97, 0.97, true, ep), 1.4, 0.2))
    add(contorni, penna(arco(p.y - 4, p.pozzo, -0.9, 0.9, true, ep), 1.1, 0.2))
    for (const k of [0.66, 0.76, 0.86, 0.95]) add(fini, linea(arco(p.y, p.r * k, 0.45 + r() * 0.15, 0.97, true, ep)))
    for (let y = y1 + 2; y < y1 + 12; y += 2.6) add(fini, linea([[CX + 24 + r() * 6, y], [CX + 70 + r() * 20, y]]))
    base = p.y + ep * p.r + 6
    largo = p.r
  } else {
    // IL VETRO: bianco, con il riflesso lasciato a sinistra e il bordo in
    // ombra a destra fatto di poche righe che scendono.
    const giu = g.fondo ?? y1 - 3
    add(contorni, penna(meridiano(-0.74, y0 + 10, y0 + (giu - y0) * 0.55), 1.2, 0.1))
    add(contorni, penna(meridiano(-0.62, y0 + (giu - y0) * 0.62, y0 + (giu - y0) * 0.78), 1, 0.1))
    for (const sin of [0.84, 0.9, 0.95]) add(fini, linea(meridiano(sin, y0 + 3 + r() * 8, giu - r() * 10)))
    // e le righe corte che girano sul bordo in ombra, incrociate con quelle
    // che scendono: è il punto più scuro del vetro.
    for (let y = y0 + 7; y < g.livello - 2; y += 4.5) add(fini, linea(arco(y, R(y), 0.86 + r() * 0.05, 0.99)))

    // IL LIQUIDO: anelli che girano col bicchiere, tanto più fitti quanto
    // più il drink è scuro; il lato in luce resta bianco; i drink scuri
    // hanno il secondo strato incrociato, e a destra una scheggia nera.
    const L = g.livello
    const ri = (y) => R(y) * 0.95
    const fine = g.fondo ?? y1 - 1
    const fondoLargo = ri(fine) > 1
    liquidoForma = `${linea([
      ...arco(L, ri(L), -1, 1, false),
      ...passi(L, fine, 3).map((y) => [CX + ri(y), y]),
      ...(fondoLargo ? arco(fine, ri(fine), 1, -1) : []),
      ...passi(fine, L, 3).map((y) => [CX - ri(y), y]),
    ])}Z`
    const passo = 5.6 - peso * 2.6
    for (let y = L + passo; y < fine + e * ri(fine); y += passo) {
      const sa = Math.max(-0.95, -0.2 - peso * 0.6 + (r() - 0.5) * 0.2)
      add(liquidoTratti, linea(arco(y, ri(y), sa, 0.98)))
    }
    if (peso > 0.35) {
      const da = 0.9 - peso * 0.6
      for (let sin = da; sin < 0.97; sin += 4.5 / ri(L)) add(liquidoTratti, linea(meridiano(sin, L + r() * 10, fine, 0.95)))
    }
    add(contorni, penna(meridiano(0.9, L + 4, fine - 4, 0.95), 1.4 + peso * 2.4, 0.1))
    add(contorni, penna(arco(L, ri(L), -1, 1, false), 1, 0.3))
    add(contorni, penna(arco(L, ri(L), -1, 1), 1.5, 0.3))
  }

  // IL GHIACCIO: il cubetto chiaro dentro il liquido scuro, con due righe
  // nell'angolo in ombra. Toglie il tratteggio del liquido dove sta.
  const cubetti = (g.ghiaccio || []).map(([x, y, l, ang]) => {
    const a = (ang * Math.PI) / 180
    const v = (u, w) => [x + Math.cos(a) * u - Math.sin(a) * w, y + Math.sin(a) * u + Math.cos(a) * w]
    const h = l / 2
    const angoli = [v(-h, -h), v(h, -h), v(h, h), v(-h, h)]
    add(contorni, penna([...angoli, angoli[0]], 1.5, 0.7))
    for (const k of [0.35, 0.6]) add(fini, linea([v(h - l * k * 0.4, -h * 0.2), v(h - l * k * 0.4, h * 0.8)]))
    return `${linea(angoli)}Z`
  })
  for (const [x, y, rr] of g.bolle || []) add(fini, `M${x - rr} ${y}a${rr} ${rr} 0 1 0 ${2 * rr} 0a${rr} ${rr} 0 1 0 ${-2 * rr} 0`)

  // L'OMBRA SUL TAVOLO: righe orizzontali a destra, la luce viene da
  // sinistra; e qualche riga di terreno che si perde, come nelle tavole.
  const ombra = []
  for (let k = 0; k < 6; k++) {
    const t = (k + 0.5) / 6
    const y = base - 3 + k * 2.8
    const semi = largo * Math.sqrt(1 - (2 * t - 1) ** 2)
    const xa = CX - largo * 0.5 + semi * 0.2 + r() * 6
    const xb = Math.min(388, CX + largo * 0.3 + semi * 1.05 + r() * 8)
    add(ombra, penna(passi(xa, xb, 12).map((x) => [x, y]), 1.3, 0.15))
  }
  const terreno = [
    [CX - largo * 1.5, CX - largo * 0.8, base + 4],
    [CX - largo * 1.15, CX - largo * 0.55, base + 10],
    [CX + largo * 1.45, CX + largo * 1.95, base + 7],
  ]
  for (const [xa, xb, y] of terreno) {
    const a = Math.max(12, xa)
    const b = Math.min(388, xb)
    if (b - a > 10) add(ombra, penna(passi(a, b, 10).map((x) => [x, y]), 1.1, 0.1))
  }

  // L'ACQUERELLO: steso piatto, più carico sul bordo dove asciuga, con la
  // grana della carta, e spostato di un soffio rispetto al segno.
  const acquerello = (dentro) => `<g filter="url(#a)" style="mix-blend-mode:${fusione}">${dentro}</g>`
  const velo = (d, col, o) => `<path d="${d}" fill="${col}" fill-opacity="${op(o)}" stroke="${col}" stroke-opacity="${op(o * 0.7)}" stroke-width="3"/>`
  const ombraVelo = `<ellipse cx="${n1(CX + largo * 0.35)}" cy="${n1(base + 4)}" rx="${n1(largo * 0.95)}" ry="9" fill="${C.lilla}" fill-opacity="${op(0.22)}"/>`
  const macchiaDeco = deco?.macchia ? deco.macchia.replace(/(fill|stroke)-opacity="([\d.]+)"/g, (_, k, o) => `${k}-opacity="${op(Number(o))}"`) : ''
  const tondo = deco?.ombra

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400" style="isolation:isolate">
<defs>
<filter id="a" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="${seme % 997}" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="6" xChannelSelector="R" yChannelSelector="G" result="d"/><feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="1" seed="${(seme % 991) + 3}" result="g"/><feColorMatrix in="g" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -0.9 1.25" result="k"/><feComposite in="d" in2="k" operator="in"/></filter>
<clipPath id="l"><path d="${liquidoForma}"/></clipPath>
<mask id="g"><rect width="400" height="400" fill="#fff"/>${cubetti.map((d) => `<path d="${d}" fill="#000"/>`).join('')}</mask>
${tondo ? `<clipPath id="t">${deco.sagoma}</clipPath>` : ''}
</defs>
<g transform="translate(-2 1.5)">
${acquerello(ombraVelo)}
${acquerello(velo(liquidoForma, colore, 0.58))}
${macchiaDeco ? acquerello(macchiaDeco) : ''}
</g>
<g fill="none" stroke="${tratto}" stroke-linecap="round" stroke-linejoin="round">
<path d="${liquidoTratti.join('')}" stroke-width="1" clip-path="url(#l)" mask="url(#g)"/>
<path d="${fini.join('')}" stroke-width="1"/>
${tondo ? `<path d="${tratteggioTondo(...tondo)}" stroke-width="1" clip-path="url(#t)"/>` : ''}
${deco?.tratto ? `<g stroke-width="1.9">${deco.tratto}</g>` : ''}
</g>
<path d="${[...contorni, ...ombra].join('')}" fill="${tratto}"/>
${deco?.testo ? deco.testo.replace('__TRATTO__', tratto) : ''}
</svg>`
}

// «INCISIONE» (lo stile «Giornale»): la xilografia di un quotidiano
// d'altri tempi. Un solo inchiostro, niente acquerello né colore: il
// colore del drink diventa più o meno NERO, cioè tratteggio più o meno
// fitto. Una cornice da lastra intorno, una puntinatura di fondo, l'ombra
// a tratti orizzontali sotto il piede. Il contorno è più pesante di quello
// di Tenniel: a stampa, la riga sottile si perde.
const INCHIOSTRO = { scuro: '#eee8da', chiaro: '#1b1814' }

function svgIncisione(s, { chiaro }) {
  const f = FORME[s.bicchiere]
  const ink = INCHIOSTRO[chiaro ? 'chiaro' : 'scuro']
  const peso = PESO[s.colore] ?? 0.5
  const seme = semeDi(`inc|${s.bicchiere}|${s.colore}|${s.decorazione}`)
  const r = casuale(seme)
  const deco = decorazione(s.decorazione, f)
  // La puntinatura del fondo: fitta al centro, rada ai bordi della lastra.
  let punti = ''
  for (let i = 0; i < 260; i++) {
    const x = 40 + r() * 320
    const y = 40 + r() * 320
    const d = Math.hypot(x - 200, y - 230) / 190
    if (r() > 1 - d * 0.9) continue
    punti += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(0.5 + r() * 0.7).toFixed(2)}"/>`
  }
  // Il liquido: righe orizzontali, più una diagonale incrociata se il
  // colore è scuro. La distanza fra le righe dice il colore.
  const passo = (5.5 - peso * 3).toFixed(1)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
<defs>
<pattern id="h" width="${passo}" height="${passo}" patternUnits="userSpaceOnUse"><line x1="0" y1="${(passo / 2).toFixed(2)}" x2="${passo}" y2="${(passo / 2).toFixed(2)}" stroke="${ink}" stroke-width="0.9"/></pattern>
<pattern id="k" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="4" stroke="${ink}" stroke-width="0.9"/></pattern>
<pattern id="j" width="3.4" height="3.4" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><line x1="0" y1="0" x2="0" y2="3.4" stroke="${ink}" stroke-width="0.8"/></pattern>
<clipPath id="c"><path d="${f.corpo}"/></clipPath>
<clipPath id="l"><path d="${f.liquido}"/></clipPath>
</defs>
<rect x="14" y="14" width="372" height="372" fill="none" stroke="${ink}" stroke-width="2.4"/>
<rect x="22" y="22" width="356" height="356" fill="none" stroke="${ink}" stroke-width="0.8"/>
<g fill="${ink}" opacity="0.55">${punti}</g>
<g clip-path="url(#l)"><rect width="400" height="400" fill="url(#h)"/>${peso > 0.5 ? '<rect width="400" height="400" fill="url(#j)" opacity="0.7"/>' : ''}</g>
<g clip-path="url(#c)"><rect x="${f.ombra}" width="200" height="400" fill="url(#k)"/><rect x="${f.ombra + 22}" width="200" height="400" fill="url(#j)"/></g>
<g stroke="${ink}" stroke-width="1">${[0, 1, 2, 3, 4].map((i) => `<line x1="${110 + i * 6}" y1="${f.base + 10 + i * 4}" x2="${290 - i * 6}" y2="${f.base + 10 + i * 4}"/>`).join('')}</g>
<g fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
${f.vetro}
<path d="${f.riflesso}" stroke-width="1.4"/>
${f.ghiaccio || ''}
<g stroke-width="1.8">${f.bolle || ''}</g>
${deco?.tratto || ''}
</g>
${deco?.testo ? deco.testo.replace('__TRATTO__', ink) : ''}
</svg>`
}

// Il disegno come indirizzo da mettere in un <img>, tenuto in memoria: la
// stessa scelta si disegna una volta sola, per segno.
const cache = new Map()
export function urlDrink(scelta, { chiaro = false, segno = 'tenniel' } = {}) {
  const s = sceltaIllustrazione(scelta)
  if (!s) return null
  const seg = SEGNI.includes(segno) ? segno : 'tenniel'
  const chiave = `${s.bicchiere}|${s.colore}|${s.decorazione}|${chiaro ? 1 : 0}|${seg}`
  if (!cache.has(chiave)) {
    cache.set(chiave, `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgDrink(s, { chiaro, segno: seg }))}`)
  }
  return cache.get(chiave)
}
