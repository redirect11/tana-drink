// ── LE PAGINE DI PROVA (REQ-MAG-050) ─────────────────────────────────
//
// Daniele, 26/09/2026: «implementa come ha detto Flavio, e poi fai una
// nuova pagina inventario come la faresti tu. Una pagina attivabile, solo
// per test al momento, in modo da poter vedere la differenza».
//
// DUE CHIAVI, tutte e due necessarie. La prima non si può girare da
// un'impostazione: fuori dall'ambiente di test (e dal locale) la pagina non
// esiste, qualunque cosa ci sia scritto in settings/bar — in produzione ci
// sono i numeri veri del locale. È lo stesso controllo dei DevTools e della
// stampante finta (dev/devActions.js), costruito da VITE_APP_ENV. La seconda
// è l'interruttore (Impostazioni → Funzioni premium).

import { devToolsEnabled } from '../dev/devActions.js'

export const paginaDiProvaDisponibile = devToolsEnabled

export const controlloMagazzinoVisibile = (settings, disponibile = paginaDiProvaDisponibile) =>
  disponibile && settings?.controllo_magazzino_prova === true
