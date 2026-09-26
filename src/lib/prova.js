// ── LE PAGINE DI PROVA (REQ-MAG-050) ─────────────────────────────────
//
// Daniele, 26/09/2026: «implementa come ha detto Flavio, e poi fai una
// nuova pagina inventario come la faresti tu. Una pagina attivabile, solo
// per test al momento, in modo da poter vedere la differenza».
//
// DUE CHIAVI, tutte e due necessarie. La prima non si può girare da
// un'impostazione: in produzione la pagina non esiste, qualunque cosa ci
// sia scritto in settings/bar — lì ci sono i soldi veri e i numeri veri del
// locale, e una vista a metà strada non ci va. La seconda è l'interruttore
// (Impostazioni → Funzioni premium), che sul test la accende e la spegne.

export const PROGETTO_PRODUZIONE = 'tana-drink'

export const inProduzione = (progetto = import.meta.env.VITE_FIREBASE_PROJECT_ID) =>
  progetto === PROGETTO_PRODUZIONE

export const controlloMagazzinoVisibile = (settings, progetto) =>
  !inProduzione(progetto) && settings?.controllo_magazzino_prova === true
