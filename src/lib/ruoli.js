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

// BANCO: chi sta allo shaker. Può quanto l'admin, ma non guarda le stesse
// cose: all'admin interessa com'è messo il CONTO — in corso, chiuso,
// annullato — mentre a chi prepara interessa il LAVORO, cioè le COMANDE,
// una per una, nel passo in cui stanno. È questa distinzione a decidere
// cosa mostrano le corsie della coda, e sta qui perché i ruoli si
// confrontano in un posto solo.
export function isBanco(role) {
  return role === 'bartender'
}

// SALA: chi serve ai tavoli e basta. Vede solo i drink pronti da portare,
// non la cassa.
export function isSala(role) {
  return role === 'staff'
}

// Chi appartiene al personale, a qualunque titolo (contrapposto al cliente).
export function isPersonale(role) {
  return isGestore(role) || isSala(role)
}
