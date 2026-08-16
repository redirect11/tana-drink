// ── LA STAMPANTE FINTA, SOLO IN LOCALE ───────────────────────────────
//
// Al banco la stampante è un apparecchio sulla rete del locale: da un
// computer di sviluppo non si raggiunge, e ogni modifica a comande e
// scontrini si provava a occhio nel codice — oppure andando al bar.
//
// Qui la stampante c'è, ma è di carta finta: raccoglie le righe che l'app
// le manda e le apre in una finestra pronta per la stampa, dove si sceglie
// «Salva come PDF». Si prova quello che ESCE, che è la domanda vera
// («questa comanda si legge?»), non il collegamento.
//
// SOLO IN LOCALE. Sull'ambiente di test non si accende, perché lì ci si
// collega alla stampante VERA per provarla davvero; in produzione, va da
// sé, nemmeno si pone. Il segnale è l'ambiente di sviluppo o gli
// emulatori: entrambi vogliono dire «questo computer non è il bar».

const COL = 48 // colonne della testina 80 mm, come la stampante vera

export function stampanteFintaAttiva(env = import.meta.env) {
  if (env?.VITE_STAMPANTE_FINTA === 'false') return false
  // Forzabile a mano, per provarla dove serve.
  if (env?.VITE_STAMPANTE_FINTA === 'true') return true
  if (env?.DEV) return true
  if (env?.MODE === 'locale') return true
  // Gli emulatori Firebase: se il database è finto, lo è anche il bar.
  return env?.VITE_USE_FIREBASE_EMULATOR === 'true'
}

// Le righe come le vedrebbe la testina: testo grande raddoppiato, allineato
// nelle 48 colonne. Non è una simulazione fedele — è quanto basta per
// leggere la comanda com'è, invece di immaginarsela.
function componi(pezzi) {
  const out = []
  let allineamento = 'left'
  let doppio = false
  for (const p of pezzi) {
    if (p.tipo === 'align') allineamento = p.valore
    else if (p.tipo === 'size') doppio = p.doppio
    else if (p.tipo === 'feed') out.push(...Array(p.righe).fill(''))
    else if (p.tipo === 'cut') out.push('─'.repeat(COL))
    else if (p.tipo === 'text') {
      for (const riga of String(p.testo).split('\n')) {
        if (riga === '' && p.testo.endsWith('\n')) continue
        const t = doppio ? riga.split('').join(' ') : riga
        const largh = COL
        if (allineamento === 'center') out.push(t.trim().padStart(Math.floor((largh + t.trim().length) / 2)))
        else if (allineamento === 'right') out.push(t.trim().padStart(largh))
        else out.push(t)
      }
    }
  }
  return out
}

// Apre la finestra di stampa del browser con lo scontrino dentro: da lì
// «Salva come PDF». Se il browser blocca la finestra (succede), il testo
// finisce in console — meglio che perderlo.
function mostra(righe, titolo) {
  const testo = righe.join('\n')
  const w = typeof window !== 'undefined' ? window.open('', '_blank', 'width=420,height=700') : null
  if (!w) {
    console.info(`[stampante finta] ${titolo}\n${testo}`)
    return
  }
  w.document.write(
    `<!doctype html><meta charset="utf-8"><title>${titolo}</title>` +
      '<style>body{margin:0;padding:12px;background:#fff}' +
      'pre{font:12px/1.35 "Courier New",monospace;color:#000;white-space:pre-wrap;margin:0}' +
      '@page{size:80mm auto;margin:4mm}</style>' +
      `<pre>${testo.replace(/[<&]/g, (c) => (c === '<' ? '&lt;' : '&amp;'))}</pre>`
  )
  w.document.close()
  w.focus()
  // Un attimo per il layout, poi la finestra di stampa: da lì si salva in PDF.
  setTimeout(() => w.print(), 150)
}

// L'oggetto che l'app crede una stampante: gli stessi metodi dell'SDK
// Epson, per la parte che usiamo (vedi lib/printer.js).
export function creaStampanteFinta(titolo = 'Stampa') {
  const pezzi = []
  const finta = {
    ALIGN_LEFT: 'left',
    ALIGN_CENTER: 'center',
    ALIGN_RIGHT: 'right',
    COLOR_1: 'color1',
    CUT_FEED: 'cut',
    addTextLang: () => finta,
    addTextSmooth: () => finta,
    addTextAlign: (v) => (pezzi.push({ tipo: 'align', valore: v }), finta),
    addTextSize: (w) => (pezzi.push({ tipo: 'size', doppio: Number(w) > 1 }), finta),
    addTextStyle: () => finta,
    addText: (t) => (pezzi.push({ tipo: 'text', testo: t }), finta),
    addFeedLine: (n) => (pezzi.push({ tipo: 'feed', righe: Number(n) || 1 }), finta),
    addCut: () => (pezzi.push({ tipo: 'cut' }), finta),
    send: () => {
      mostra(componi(pezzi), titolo)
      pezzi.length = 0
      // L'SDK vero avvisa così: qualcuno guarda `onreceive`.
      finta.onreceive?.({ success: true, code: '', status: 0 })
      return finta
    },
    onreceive: null,
    ondisconnect: null,
  }
  return finta
}
