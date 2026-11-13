// ── L'ORDINE MODIFICATO DAL BANCO TORNA AL CLIENTE (REQ-CLI-009) ──────
//
// Daniele, 13/11/2026: un ordine dal telefono lo conferma chi lo riceve al
// banco, che può modificarlo prima — cambiare un ingrediente o il prezzo,
// per una scelta del cliente o per la sua nota. Se cambia prezzo o
// ingredienti, l'ordine aspetta il cliente: lui lo vede modificato, col
// prezzo nuovo, e lo accetta o lo rifiuta. Rifiutato è annullato, annullato
// dal cliente. Il tempo per rispondere lo decide il titolare (10 minuti di
// partenza); scaduto, l'ordine si annulla.
//
// PERCHÉ È UN CAMPO DEL CONTO E NON UN PASSO DELLE COMANDE. Gli stati delle
// comande li leggono la coda (colonne, corsie), la stampa, le statistiche,
// le regole e il tabellone: un passo in più andava insegnato a tutti, e
// quello dimenticato avrebbe fatto sparire il conto da qualche parte. Un
// conto in attesa resta dov'è, col suo passo, e porta
//   attesa_cliente: { dal, scade, totale_prima }
// che la coda mostra e che ferma l'avanzamento e la stampa. La risposta
// resta scritta in `risposta_cliente: { esito, at, al_banco? }`.
//
// Logica pura: l'ora la passa chi chiama.

export const MINUTI_ATTESA_PREDEFINITI = 10
const MINUTI_ATTESA_MASSIMI = 120

// Le comande che il banco può ancora rimettere in discussione: non pronte.
const PASSI_MODIFICABILI = ['ricevuto', 'in_preparazione']

export function minutiAttesa(impostazioni) {
  const n = Number(impostazioni?.attesa_cliente_minuti)
  if (!Number.isFinite(n) || n < 1) return MINUTI_ATTESA_PREDEFINITI
  return Math.min(Math.round(n), MINUTI_ATTESA_MASSIMI)
}

// Un ordine dal telefono: nessuno del personale l'ha battuto.
export const ordineDalTelefono = (ordine) => Boolean(ordine) && !ordine.placed_by

// Quello che il cliente PAGA e RICEVE di una riga: prodotto, nome, prezzo,
// ricetta. La nota no: una nota del banco non cambia il drink né il conto.
function firma(riga) {
  const ricetta = Array.isArray(riga.recipe_items)
    ? riga.recipe_items
        .map((r) => `${r.inventory_item_id || r.name}:${r.qty}`)
        .sort()
        .join(',')
    : ''
  return [riga.drink_id ?? '', (riga.name ?? '').trim().toLowerCase(), Number(riga.unit_price ?? riga.price ?? 0), ricetta].join('|')
}

function quantitaPerFirma(righe) {
  const m = new Map()
  for (const r of righe || []) m.set(firma(r), (m.get(firma(r)) || 0) + (Number(r.qty) || 0))
  for (const [k, q] of m) if (q === 0) m.delete(k)
  return m
}

// Il banco ha cambiato prezzo o ingredienti? Righe tolte, aggiunte o
// ritoccate contano; lo stesso contenuto in un altro ordine no.
export function cambiaPerIlCliente(prima, dopo) {
  const a = quantitaPerFirma(prima)
  const b = quantitaPerFirma(dopo)
  if (a.size !== b.size) return true
  for (const [k, q] of a) if (b.get(k) !== q) return true
  return false
}

// Le righe come le ha ordinate il cliente, in una stringa: serve a
// riconoscere il banco che le rimette com'erano.
export const firmaRighe = (righe) =>
  [...quantitaPerFirma(righe)]
    .map(([k, q]) => `${k}=${q}`)
    .sort()
    .join(';')

// UN PAGAMENTO GIÀ PARTITO NON SI RIMETTE IN DISCUSSIONE. Il pagamento
// online senza POS segna il conto «pagato» e lo lascia aperto finché i
// drink non sono serviti: un rifiuto o una scadenza lo annullerebbero già
// incassato, e un sì a un prezzo più alto lo lascerebbe «pagato» per meno
// del totale. Lì le modifiche si concordano al banco, come prima.
export const pagamentoAvviato = (ordine) =>
  ['pagato', 'parziale'].includes(ordine?.payment_status) ||
  (ordine?.payment_method === 'online' && ordine?.payment_status === 'in_attesa') ||
  (ordine?.payments || []).length > 0

// L'ATTESA DOPO UNA MODIFICA DEL BANCO a questa comanda. Torna:
//   undefined  niente da cambiare
//   { ... }    l'attesa che comincia (o riparte) adesso
//   null       finita: il banco ha rimesso l'ordine com'era
// Comincia solo per un ordine dal telefono ancora aperto, con la sola
// prima comanda, non pronta, e nessun pagamento avviato. Le aggiunte del
// banco a un conto avviato sono un'altra cosa (comande nuove), e qui non
// passano.
export function attesaDopoLaModifica(ordine, comandaId, righePrima, righeDopo, impostazioni, adesso = new Date()) {
  if (!ordineDalTelefono(ordine) || ordine.status !== 'aperto' || pagamentoAvviato(ordine)) return undefined
  const comande = ordine.comande || []
  if (comande[0]?.id !== comandaId || !PASSI_MODIFICABILI.includes(comande[0].status)) return undefined
  if (inAttesa(ordine)) {
    const originale = ordine.attesa_cliente.firma_prima
    if (originale != null && firmaRighe(righeDopo) === originale) return null
    return cambiaPerIlCliente(righePrima, righeDopo) ? attesaNuova(ordine, impostazioni, adesso, righePrima) : undefined
  }
  if (comande.length !== 1) return undefined
  return cambiaPerIlCliente(righePrima, righeDopo) ? attesaNuova(ordine, impostazioni, adesso, righePrima) : undefined
}

// L'attesa che comincia adesso. Una seconda modifica mentre si aspetta fa
// ripartire il tempo — il cliente deve poter leggere quella nuova — ma il
// totale e le righe «di prima» restano quelli che lui aveva ordinato.
export function attesaNuova(ordine, impostazioni, adesso = new Date(), righePrima = null) {
  const dal = new Date(adesso)
  const firma = ordine?.attesa_cliente?.firma_prima ?? (righePrima ? firmaRighe(righePrima) : null)
  return {
    dal: dal.toISOString(),
    scade: new Date(dal.getTime() + minutiAttesa(impostazioni) * 60000).toISOString(),
    totale_prima: Number(ordine?.attesa_cliente?.totale_prima ?? ordine?.total ?? 0),
    ...(firma != null ? { firma_prima: firma } : {}),
  }
}

// Il conto aspetta il cliente? (Anche a tempo scaduto, finché nessuno l'ha
// annullato: scaduta() dice se è il momento.)
export function inAttesa(ordine) {
  return Boolean(ordine?.attesa_cliente?.scade) && (ordine.status ?? 'aperto') === 'aperto'
}

export function scaduta(ordine, adesso = Date.now()) {
  return inAttesa(ordine) && Date.parse(ordine.attesa_cliente.scade) <= Number(adesso)
}

// I minuti che restano, arrotondati in su (mai sotto zero).
export function minutiRimasti(ordine, adesso = Date.now()) {
  if (!inAttesa(ordine)) return 0
  return Math.max(0, Math.ceil((Date.parse(ordine.attesa_cliente.scade) - Number(adesso)) / 60000))
}

// La patch della risposta: si chiude l'attesa e resta scritto com'è andata.
// `al_banco`: il sì è arrivato a voce, e lo ha segnato chi lavora.
export const rispostaAccettata = ({ adesso = new Date(), alBanco = false } = {}) => ({
  attesa_cliente: null,
  risposta_cliente: { esito: 'accettato', at: new Date(adesso).toISOString(), ...(alBanco ? { al_banco: true } : {}) },
})

// I due modi in cui un'attesa finisce in un annullo (cancel_kind).
export const ANNULLO_RIFIUTO = 'modifica_rifiutata'
export const ANNULLO_SCADUTO = 'attesa_scaduta'
