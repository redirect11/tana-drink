// ── IL CONTRATTO DI UNO STILE STRUTTURATO (REQ-MENU-028) ─────────────────
//
// Uno stile «a veste» («Lavagna», «Déco», «Meraviglie») cambia caratteri,
// colori e cornici sopra le card del menù classico. Uno stile STRUTTURATO
// («Giornale», e domani quello a carte di Flavio, REQ-MENU-029) disegna il
// menù a modo suo: impaginazione, gesti, animazioni. Fino al 05/11/2026
// «Giornale» era agganciato a MenuPage in cinque punti, coi dati in forme
// diverse da quelle che usava «Notte»; l'utente, quel giorno, verso uno
// stile nuovo di Flavio: «scrivo il contratto dello stile» — sì, «perché
// poi aggiungeremo un menù con una nuova struttura».
//
// CHE COSA RICEVE (le props, uguali per ogni stile e per i suoi due pezzi,
// la Testata in cima e il Corpo sotto gli avvisi del menù):
//   · venue          — il locale (venueDi): nome, slogan, contatti;
//   · sezioni        — [{ id, nome, vista: 'piena'|'snella', voci }], già
//                      nell'ordine del menù dei clienti, con le voci
//                      personalizzate (nome in carta, descrizione) e solo
//                      quelle disponibili;
//   · speciali       — le voci Special;
//   · soloSpeciali   — true sulla pagina /menu/special;
//   · special        — { titolo, sottotitolo } degli Special della sera;
//   · linkMenu       — l'indirizzo del menù completo, col tavolo;
//   · immagine(d)    — la foto, o il disegno nel segno dello stile, o null;
//   · apri(d)        — apre il dettaglio della voce;
//   · tastiOrdine(d) — i tasti per ordinare quella voce, già fatti;
//   · quantita       — se gli ingredienti vanno con le quantità;
//   · testo(k, di)   — le frasi dello stile (testiStile.js).
//
// CHE COSA GARANTISCE (lo controlla tests/component/stiliStrutturati.test):
//   · ogni voce ricevuta si vede, col suo nome e col prezzo letto dai dati
//     (formatPrice): mai un prezzo scritto a mano o ricalcolato;
//   · ogni voce ha i suoi tastiOrdine: «Aggiungi», carrello e invio sono
//     quelli del menù, e restano locali, istantanei, anche senza rete;
//   · niente letture né scritture: uno stile non importa api.js né
//     firebase, e non aspetta niente — ha già tutto quello che gli serve;
//   · con «riduci movimento» non si muove niente; si animano solo
//     transform e opacity (DESIGN.md);
//   · le voci restano leggibili e raggiungibili da tastiera e da chi legge
//     lo schermo: il nome che apre il dettaglio è un tasto vero.
//
// Il resto della pagina — gli avvisi, gli ordini in corso, il carrello, il
// riepilogo, il dettaglio della voce — resta del menù, uguale per tutti.

// Le sezioni del menù, come le prepara MenuPage (`[nome, voci, sezione]`,
// dove `sezione` c'è solo con la struttura personalizzata), nella forma del
// contratto.
export function sezioniPerLoStile(categorie) {
  return categorie.map(([nome, voci, sezione]) => ({
    id: sezione?.id ?? nome,
    nome,
    vista: sezione?.vista === 'snella' ? 'snella' : 'piena',
    voci,
  }))
}
