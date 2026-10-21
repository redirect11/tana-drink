// ── I PIANI E I PREZZI (REQ-FLOTTA-002) ───────────────────────────────
//
// Prezzi in un posto solo, DA CONFERMARE con l'utente prima di pubblicare
// (stime del 21/10/2026: base 19-29, terminale +10-15, moduli 10-20,
// completo 59-79, attivazione 150-300). Importi mensili, IVA esclusa.
//
// Il piano base è la porta d'ingresso; il margine sta nei moduli, che
// sono le stesse funzioni premium della licenza (src/lib/licenza.js
// nell'app): quello che si compra qui è quello che l'istanza accende.

export const MODULI = [
  { id: 'magazzino', nome: 'Magazzino e inventario', prezzo: 15, descrizione: 'Giacenze, scarico automatico dalle ricette, inventario periodico, ordini ai fornitori.' },
  { id: 'menu_tavoli', nome: 'Menù digitale e tavoli', prezzo: 12, descrizione: 'Menù con QR al tavolo, ordini dal telefono del cliente, stato dell’ordine.' },
  { id: 'statistiche', nome: 'Statistiche e bilancio', prezzo: 15, descrizione: 'Incassi per serata e periodo, venduto per fascia oraria, bilancio per macro-categorie.' },
  { id: 'staff', nome: 'Personale e ore', prezzo: 10, descrizione: 'Utenze del personale, ore e paghe, chiamate allo staff.' },
  { id: 'pagamenti', nome: 'Pagamenti con lettore SumUp', prezzo: 10, descrizione: 'Il conto va al lettore di carte e torna pagato da solo.' },
]

export const PIANI = {
  base: {
    id: 'base',
    nome: 'Base',
    prezzo: 24,
    descrizione: 'Cassa, comande, pagamenti in contanti e carta, scontrino sulla stampante, lavoro senza rete. Un terminale.',
    include: [],
  },
  completo: {
    id: 'completo',
    nome: 'Completo',
    prezzo: 69,
    descrizione: 'Tutto: cassa e comande, magazzino, menù e tavoli, statistiche e bilancio, personale, SumUp. Due terminali.',
    include: MODULI.map((m) => m.id),
    terminali: 2,
  },
}

export const TERMINALE_IN_PIU = 12
export const ATTIVAZIONE = 250

// Quanto costa al mese una scelta: piano, moduli in più, terminali in più.
//   { piano: 'base'|'completo', moduli: ['magazzino', …], terminali: 1 }
export function prezzoMensile({ piano = 'base', moduli = [], terminali = 1 } = {}) {
  const p = PIANI[piano] || PIANI.base
  const inclusi = new Set(p.include)
  const extra = MODULI.filter((m) => moduli.includes(m.id) && !inclusi.has(m.id))
  const terminaliInclusi = p.terminali || 1
  const terminaliExtra = Math.max(0, (Number(terminali) || 1) - terminaliInclusi)
  return p.prezzo + extra.reduce((s, m) => s + m.prezzo, 0) + terminaliExtra * TERMINALE_IN_PIU
}

// I moduli che un'istanza deve accendere per una scelta: è quello che la
// licenza scrive (REQ-FLOTTA-007).
export function moduliDellaScelta({ piano = 'base', moduli = [] } = {}) {
  const p = PIANI[piano] || PIANI.base
  return [...new Set([...p.include, ...moduli.filter((id) => MODULI.some((m) => m.id === id))])]
}

// Il punto delle migliaia a mano: in CI il Node della macchina non ha i
// dati di lingua italiani e toLocaleString scriveva «1250».
export const euro = (n) => `${String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} €`
