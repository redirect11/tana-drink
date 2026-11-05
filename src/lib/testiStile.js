// ── LE FRASI DI UNO STILE (REQ-MENU-027) ───────────────────────────────
//
// Uno stile può avere parole sue, oltre alla forma. L'utente, 05/11/2026,
// per «Meraviglie»: uno stile alla Lewis Carroll in cui «anche la pagina
// deve richiamare un po' lo stile e anche i testi», con la scelta «titoli e
// frasi, tasti chiari». Quindi si cambiano i TITOLI e si aggiungono FRASI,
// ma i tasti e gli stati restano quelli di sempre: chi ordina deve capire al
// primo sguardo che cosa tocca e a che punto è il suo ordine. «Pronto al
// servizio» resta «Pronto al servizio»; sotto, la frase dello stile.
//
// Ogni schermata chiede la sua frase con la frase di sempre come ripiego
// (`testoStile(stile, chiave, diSempre)`): uno stile che non la scrive, o
// il classico, mostrano quella di sempre. Una chiave senza ripiego (null)
// è una frase IN PIÙ, che senza lo stile non c'è.
//
// Le frasi sono nostre: richiamano il libro (il Bianconiglio in ritardo, il
// tè del Cappellaio, il cartellino «bevimi») senza citarne una traduzione.

import { createContext, useContext } from 'react'

export const TESTI_STILE = Object.freeze({
  meraviglie: Object.freeze({
    // La home pubblica.
    'home.benvenuto': 'Benvenuti nel Paese delle Meraviglie',
    'home.chi-siamo': 'Chi abita la tana',
    'home.contatti': 'La strada per la tana',
    // Il menù.
    'menu.invito': 'Giù nella tana del coniglio: si sceglie, e l’ordine corre al bancone.',
    'menu.sola-lettura': 'La carta delle meraviglie',
    'riepilogo.titolo': 'Il tuo vassoio',
    // Lo stato dell'ordine: il titolo sopra il numero, e una frase sotto lo
    // stato, che resta scritto com'è.
    'stato.numero': 'Il tuo cartellino',
    'stato.frase.aperto': 'Il conto resta aperto: si torna giù quando si vuole.',
    'stato.frase.ricevuto': 'Il Bianconiglio è in viaggio verso il bancone…',
    'stato.frase.in_preparazione': 'Al bancone è sempre l’ora del tè: si mescola.',
    'stato.frase.pronto': 'Sul cartellino c’è scritto: bevimi.',
    'stato.frase.ritirato': 'Alla salute, dal Paese delle Meraviglie.',
    'stato.frase.pagato': 'Conto saldato. A presto, giù nella tana.',
    // I miei ordini, quando non ce n'è ancora uno.
    'ordini.vuoto': 'Nessun ordine da questo dispositivo, per ora: la tana è ancora tutta da esplorare.',
  }),
})

export function testoStile(stile, chiave, diSempre = null) {
  const t = TESTI_STILE[stile]?.[chiave]
  return typeof t === 'string' ? t : diSempre
}

// LO STILE DELLE PAGINE DEI CLIENTI, deciso una volta da App (stileInVista)
// e letto dalle schermate. Fuori da App — nei test di una schermata sola —
// non c'è: valgono le frasi di sempre.
export const StileCliente = createContext(null)

export function useTestoStile() {
  const stile = useContext(StileCliente)
  return (chiave, diSempre = null) => testoStile(stile, chiave, diSempre)
}
