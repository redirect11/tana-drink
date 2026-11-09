# Casi d'uso — le domande aperte della bozza

La bozza dei casi d'uso ([requirements/casi-uso.yaml](../requirements/casi-uso.yaml),
letta in [specifica-prodotto.md](specifica-prodotto.md)) è stata scritta il
09/11/2026 dai registri, dai test e dal codice (REQ-DEV-019). Stendendola
sono venute fuori cose che il codice non basta a decidere: comportamenti
che l'app ha ma che nessuno ha mai scelto, testi a schermo che dicono il
contrario del registro, buchi probabili. Vanno chiuse **prima** di scrivere
i test end-to-end dei casi d'uso che toccano: un test scritto su una
risposta indovinata prova la cosa sbagliata.

Una volta decisa, una domanda esce da qui e finisce dove deve: nel caso
d'uso (passo o variante), nel registro dei requisiti, o in `bugs.yaml` se è
un difetto.

## Probabili difetti, da verificare

1. **Rimettere in corso un conto incassato.** La finestra «Rimettere in
   corso il conto?» dice che gli incassi già registrati restano; la regola
   (`src/lib/ripristino.js`, REQ-ORD-008) li toglie e li mette in
   `payments_annullati`. Uno dei due è sbagliato — verificato nel codice,
   il testo a schermo è in `src/components/StoriaOrdine.jsx`.
2. **La comanda della sala che non stampa nessuno.** Con il locale su «La
   stampa il telefono», un conto battuto dalla sala con «Nuovo ordine» lo
   stampa solo il telefono della sala, e solo se lì è acceso «Stampa la
   comanda all'arrivo dell'ordine» — che sta in Impostazioni → Cassa e
   giornata, dove la sala non entra.
3. **Il bartender e le paghe orarie.** Il bartender vede Staff → Paghe
   orarie e può provare a salvare, ma le paghe sono solo dell'admin
   (REQ-SIC-001). Cosa gli succede al salvataggio?
4. **Il gruppo pagato senza rete.** L'incasso in contanti di un gruppo
   rilegge i conti prima di scrivere: a rete staccata non è dimostrato che
   non si blocchi.
5. **Comanda doppia.** Con la stampa automatica accesa, «Invia comanda»
   mentre il conto sta nascendo e poi l'uscita dal conto fanno due copie?
6. **Le righe del conto sommate o no, a seconda della rete.** Nel
   documento del conto (`items`) due Negroni battuti di fila diventano
   `2×Negroni` se il secondo arriva come aggiunta a un conto già nato, ma
   restano due righe `1×Negroni` se il conto nasce dopo, con tutte le righe
   insieme (`createOrder` le scrive una per tocco, `aggregateItems` le somma
   solo alle aggiunte). Visto il 09/11/2026: sugli emulatori il primo caso,
   sul progetto e2e vero il secondo. Totale, conteggio e scontrino accorpato
   (BUG-083) tornano uguali; da verificare chi legge `items` riga per riga
   (statistiche, esportazioni, magazzino).

## Comportamenti da confermare

- **Cassa chiusa e conti già aperti**: dal 08/11 a cassa chiusa non si
  incassa più neanche un conto aperto prima (REQ-CASSA-017).
- **Il ruolo cambiato**: la finestra dice «vale dal prossimo accesso»,
  REQ-STAFF-004 dice che il gestionale lo prende da sé. Su un tablet già
  collegato, quando si vede?
- **Chi apre la cassa al primo avvio senza rete**: oggi la serata la firma
  l'account collegato, senza chiedere.
- **Aspetto per il locale, non per la persona**: temi, icone e aiuti valgono
  per tutto il locale (REQ-STAFF-017 è da fare).
- **In che passo nasce una comanda battuta al POS**: «già in preparazione»
  (REQ-NOTIF-002) o «Da fare» (REQ-ORD-016)?
- **L'impagato dopo la chiusura di cassa**: dove lo si ritrova, e va
  riaperto prima di riscuoterlo?
- **La sala e «Riapri conto» / «Annulla ordine»**: può usarli?
- **Incassato ma non servito**: con gli stati del servizio accesi, dove sta
  in coda un conto incassato (REQ-ORD-014 e BUG-018)?
- **Gli ordini dei clienti dal telefono**: li stampa qualunque terminale con
  la stampa automatica accesa (REQ-STAMPA-013, ipotesi non confermata)?
- **La pagina dell'ordine dal QR**: la apre anche un cliente senza account?
- **Gruppi**: la sala può creare e incassare un gruppo?
- **Il gestionale senza rete**: carico, scheda prodotto, inventario devono
  funzionare a rete staccata? Oggi il local-first è provato solo per
  ordini ai fornitori, modelli e spese.
- **Statistiche e chiusura**: l'incasso della serata nelle statistiche deve
  coincidere al centesimo con la chiusura di cassa?
- **L'import del catalogo SumUp**: serve ancora? Solo all'admin?
- **Il Marketplace degli stili**: anche il bartender cambia l'aspetto del
  menù dei clienti?
- **Il «Controllo» del magazzino (prova)**: resta o si toglie?
- **L'inventario della Tana**: riparte da solo alla chiusura o a mano?

## Il registro non corrisponde all'app

- REQ-ORD-018 e REQ-ORD-019 descrivono un dettaglio ordine dello staff con
  «Salva modifiche» e «Modifica ordine · aggiungi prodotti»: da REQ-ORD-022
  lo staff entra direttamente nel conto.
- REQ-CODA-001 nomina tasti («Lo preparo io», «È pronto», «Consegnato») e
  colonne («Al banco», «Al ritiro») che oggi si chiamano col nome del passo.
- REQ-CASSA-008 cita «Prima chiudi 2 conti e servi 3 comande»; l'app
  scrive «Chiudi 2 conti e 3 comande».
- REQ-GRP-004 e REQ-CLI-005 sono `implemented` senza test.

## Bisogni che mancano

Dodici casi d'uso non servono nessuno dei bisogni registrati
(`bisogni: []`). Le proposte, da scrivere in `bisogni.yaml` col loro
criterio di accettazione:

- **Il titolare governa il suo abbonamento**: cosa ha, cosa può provare o
  comprare, perché il locale è fermo, quali aggiornamenti prendere
  (Licenza e moduli).
- **Il personale si organizza**: turni, timbrature, paghe.
- **Gli acquisti tornano**: dal listino del fornitore all'ordine, alla
  consegna, alla fattura.
- **Il gestore sa com'è andata**: la serata, il mese, il bilancio.
- **I dati del locale non si perdono**: backup e ripristino.
- **Banco e sala si parlano senza alzare la voce**: le chiamate.
- **Una tavolata paga insieme o divisa**: i gruppi.

## Cosa non si prova nel browser

- Le notifiche push sugli emulatori non arrivano: pronto al cliente,
  «Aggiunta al conto», chiamate con l'app in sottofondo.
- La stampante finta sa fingere «Carta finita» e «Nessuna risposta», non
  una stampante spenta: il pallino rosso e la riconnessione oggi si provano
  solo a mano.
