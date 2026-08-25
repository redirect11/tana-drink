// ── LE FUNZIONI PREMIUM: un posto solo che dice se sono accese ────────
// Decisione dell'utente del 26/08/2026: la conta di magazzino e le fatture
// ai fornitori si attivano all'occorrenza, e di partenza sono spente. Sono
// le prime due di una famiglia — il piano di sbrandizzazione (Fase 3,
// docs/piano-sbrandizzazione.md) prevede pacchetti interi — quindi la
// risposta sta QUI e non in un `if` dentro ogni schermata: due interruttori
// sparsi diventano tre, poi cinque, e a quel punto per sapere cosa vede un
// locale bisogna leggersi mezza app. Aggiungere il prossimo modulo è una
// voce in questa tabella; il resto del codice non cambia.
//
// COME SI AGGANCERÀ ALLA LICENZA VERA. La Fase 3 prevede un documento
// `settings/licenza` (piano + moduli attivi) e dice di estendere lo schema
// che c'è già, quello di `workflow_enabled` su settings/bar. Finché quel
// documento non esiste, un modulo è acceso da un flag booleano su
// settings/bar: stessa forma, stessa cache, nessuna lettura in più. Quando
// arriverà, chi lo collega tocca SOLO `moduloAttivo` — lo stato che le
// schermate passano già oggi si porterà dietro un campo `licenza`, e la
// licenza vincerà sui flag. Nessuna schermata se ne accorge, perché
// nessuna schermata sa da dove viene la risposta.
//
// ⚠️ IL FLAG NASCONDE, NON PROTEGGE. Oggi c'è un locale solo e la
// distinzione è teorica; il giorno che i locali sono tanti, il controllo
// vero va sul server (Cloud Functions e regole Firestore), perché chiunque
// apra la console del browser può accendersi un modulo da sé. Sta scritto
// anche nel requisito, così chi arriva dopo non pensa che basti questo.

// I MODULI, uno per riga. La chiave `id` è la stessa della sezione che il
// modulo accende (`conta`, `scadenzario` nel magazzino): così filtrare un
// elenco di sezioni è una riga sola e non una tabella di corrispondenze.
// `chiave` è il nome del flag su settings/bar — scritto per esteso e non
// calcolato, perché è un nome che finisce su documenti veri e chi lo cerca
// nel codice lo deve trovare.
export const MODULI_PREMIUM = {
  conta: {
    chiave: 'modulo_conta_enabled',
    label: 'Conta di magazzino',
    descrizione:
      'Inventario periodico: si contano le rimanenze, l’app calcola il consumo del periodo e allinea le giacenze.',
  },
  scadenzario: {
    chiave: 'modulo_scadenzario_enabled',
    label: 'Fatture ai fornitori',
    descrizione:
      'Registro delle fatture di acquisto con importi, scadenze e stato dei pagamenti.',
  },
}

// Quello che si legge al tocco di un interruttore spento. Dice il perché
// senza promettere niente: l'attivazione è una faccenda della licenza
// dell'installazione, non di questa schermata.
export const MOTIVO_PREMIUM =
  'Funzione premium: fa parte della licenza dell’installazione e non si attiva da questa schermata.'

// L'elenco dei moduli come lo mostra un pannello: id davanti, il resto
// dietro, nell'ordine in cui sono scritti qui sopra.
export const moduliPremium = () =>
  Object.entries(MODULI_PREMIUM).map(([id, m]) => ({ id, ...m }))

// Il flag su settings/bar che accende un modulo, per chi va a guardare (o a
// scrivere) il documento del locale. Null se l'id non è di un modulo.
export const chiaveModulo = (id) => MODULI_PREMIUM[id]?.chiave ?? null

// Questo id è una funzione premium? Serve dove si filtra un elenco misto:
// una voce che non è premium non ha una licenza da controllare.
export const ePremium = (id) => Object.hasOwn(MODULI_PREMIUM, id)

// LA DOMANDA: questo modulo è acceso per questo locale? `stato` sono le
// impostazioni del bar già in mano a chi chiama (settings/bar, dalla cache:
// nessuna lettura nuova, vedi CLAUDE.md sul local-first).
//
// Spento è il default in tutti i casi storti — impostazioni non ancora
// arrivate, documento salvato prima che il flag esistesse, id sconosciuto:
// una funzione a pagamento non si regala per una svista, e una sezione che
// compare per mezzo secondo e poi sparisce è peggio di una che non c'è.
export function moduloAttivo(stato, id) {
  const modulo = MODULI_PREMIUM[id]
  if (!modulo) return false
  // Il punto di innesto della licenza vera (Fase 3): se lo stato ne porta
  // una, comanda lei e i flag di settings/bar non si guardano nemmeno.
  const moduli = stato?.licenza?.moduli
  if (moduli && typeof moduli === 'object') return moduli[id] === true
  return stato?.[modulo.chiave] === true
}

// Una voce di un elenco (sezioni del magazzino, domani le voci del
// gestionale) si può mostrare? È la riga che serve a chi filtra: le voci
// che non sono premium passano sempre.
export const voceVisibile = (stato, id) => !ePremium(id) || moduloAttivo(stato, id)
