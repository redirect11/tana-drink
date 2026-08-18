// Storico delle notifiche in-app, per rivederle anche dopo (campanella).
// Persistito in localStorage così sopravvive al refresh; tenuto corto.
//
// DA LEGGERE / LETTE. La campanella mostra solo quello che c'è ancora da
// leggere: una notifica letta se ne va dall'elenco, altrimenti in mezz'ora di
// servizio diventa un muro di righe vecchie e non ci si guarda più — che è il
// modo migliore per non accorgersi di quella che conta. Le lette non si
// buttano: finiscono nello STORICO, che si apre dalla campanella stessa
// («cos'era quell'avviso di prima?» è una domanda che si fa davvero).

const KEY = 'tana:notifs'
const MAX = 60

const readItems = () => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]')
    if (!Array.isArray(v)) return []
    // Le notifiche salvate dalla versione precedente non hanno `letta`:
    // erano tutte già state viste in un modo o nell'altro.
    return v.map((n) => ({ ...n, letta: n.letta ?? true }))
  } catch {
    return []
  }
}

let items = readItems()
const subs = new Set()

function snapshot() {
  const daLeggere = items.filter((n) => !n.letta)
  return {
    items: daLeggere, // quello che la campanella mostra
    archivio: items.filter((n) => n.letta), // lo storico, dietro un tocco
    // TUTTE, nell'ordine in cui sono arrivate. Serve allo storico delle
    // impostazioni: chi cerca l'avviso di mezz'ora fa non sa (né gli
    // importa) se nel frattempo è finito fra le lette. Rimetterle in fila
    // fuori di qui vuol dire ordinarle per orario, e due arrivate nello
    // stesso istante finiscono a caso.
    tutte: items,
    unseen: daLeggere.length,
  }
}
const emit = () => {
  const s = snapshot()
  subs.forEach((f) => f(s))
}
const persist = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)))
  } catch {
    /* quota/privata: resta in memoria */
  }
}

export function subscribeNotifs(fn) {
  subs.add(fn)
  fn(snapshot())
  return () => subs.delete(fn)
}

// Registra una notifica nello storico (chiamata da notify()).
// `href`: dove porta toccandola. Serve alle notifiche che non si esauriscono
//   nel leggerle — «l'app è cambiata, ecco cosa» deve poter aprire le
//   Informazioni, se no resta un avviso che non si può seguire.
// `letta`: nasce già archiviata. È il caso di quello che l'utente ha appena
//   visto a schermo (il box delle novità): la traccia serve, l'avviso no.
export function recordNotif(title, body, { href = null, letta = false } = {}) {
  items = [
    {
      id: `n${Date.now()}-${Math.floor(Math.random() * 1e4)}`,
      title: title || '',
      body: body || '',
      href,
      letta,
      at: Date.now(),
    },
    ...items,
  ].slice(0, MAX)
  persist()
  emit()
}

// Letta = archiviata: sparisce dall'elenco e resta nello storico.
export function segnaLetta(id) {
  let toccata = false
  items = items.map((n) => {
    if (n.id !== id || n.letta) return n
    toccata = true
    return { ...n, letta: true }
  })
  if (!toccata) return
  persist()
  emit()
}

export function segnaTutteLette() {
  if (!items.some((n) => !n.letta)) return
  items = items.map((n) => (n.letta ? n : { ...n, letta: true }))
  persist()
  emit()
}

// Svuota lo STORICO (le lette). Quelle da leggere restano: buttare via un
// avviso che nessuno ha ancora guardato non è "fare pulizia".
export function svuotaArchivio() {
  if (!items.some((n) => n.letta)) return
  items = items.filter((n) => !n.letta)
  persist()
  emit()
}

// ── USCENDO SI DIMENTICA TUTTO ───────────────────────────────────────
//
// Gli avvisi sono di CHI li ha ricevuti: parlano dei suoi ordini, dei conti
// del suo locale. Restando in memoria dopo il logout, il telefono passato a
// un altro — o il tablet ripreso da un cliente — mostrava la serata di prima
// dentro la campanella. Non è «archivio», è roba di qualcun altro.
//
// Diverso da svuotaArchivio, che tiene quelle ancora da leggere: qui non
// resta niente, perché non c'è più nessuno a cui potrebbero servire.
export function dimenticaTutto() {
  items = []
  persist()
  emit()
}

