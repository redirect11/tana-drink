// ── RUOLI ────────────────────────────────────────────────────────────
// Il ruolo vive nei custom claims di Firebase Auth (`token.claims.role`),
// non in Firestore: così le regole del database possono fidarsene senza
// leggere altri documenti.
//
//   admin      comanda tutto, ed è l'unico che può nominare i ruoli
//   bartender  gestionale completo (cassa, inventario, menù, impostazioni)
//   staff      solo gli ordini pronti da servire
//   cliente    chi si registra dal sito: nessun privilegio gestionale
//
// "cliente" non è un claim: è l'assenza di claim. Chi si registra da
// /registrati nasce così, e l'admin decide se e cosa diventa.
//
// Prima questi confronti erano sparsi in una decina di file come
// `role === 'bartender'`: aggiungere un ruolo voleva dire trovarli tutti,
// e dimenticarne uno significa una porta aperta o una chiusa per sbaglio.

export const RUOLI = ['admin', 'bartender', 'staff']

// Assegnabili dalla pagina utenti: i tre ruoli più il declassamento a
// cliente (che toglie il claim).
export const RUOLI_ASSEGNABILI = [...RUOLI, 'cliente']

export const RUOLO_ETICHETTA = {
  admin: '👑 Admin',
  bartender: '🍸 Bartender',
  staff: '🫱 Staff',
  cliente: '🙋 Cliente',
}

export const RUOLO_DESCRIZIONE = {
  admin: 'Accesso completo, e in più nomina i ruoli degli altri utenti.',
  bartender: 'Gestionale completo: cassa, ordini, inventario, menù, impostazioni.',
  staff: 'Solo gli ordini pronti da servire e i propri ordini.',
  cliente: 'Nessun accesso al gestionale: vede il menù e i suoi ordini.',
}

// Ruolo effettivo: qualunque cosa non sia un ruolo noto è un cliente.
export function normalizzaRuolo(role) {
  return RUOLI.includes(role) ? role : 'cliente'
}

export function isAdmin(role) {
  return role === 'admin'
}

// GESTORE = accesso completo al gestionale. Admin e bartender fanno le
// stesse cose; l'admin in più nomina i ruoli.
export function isGestore(role) {
  return role === 'admin' || role === 'bartender'
}

// Chi appartiene al personale, a qualunque titolo (contrapposto al cliente).
export function isPersonale(role) {
  return isGestore(role) || role === 'staff'
}
