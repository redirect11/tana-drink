# Specifica del prodotto — i casi d'uso

> Documento **generato** da `requirements/casi-uso.yaml` con
> `node scripts/casi-uso.mjs --documento`. Non si modifica a mano: si
> modifica il registro e si rigenera.

Cosa fa chi usa Tana Drink, un obiettivo alla volta, dall'inizio alla
fine. Ogni caso d'uso si prova con un test end-to-end nel browser, fatto
come lo farebbe chi sta al banco, su un ambiente di prova generato per
l'occasione; il gestore lo valida poi sul sito di test.

**63 casi d'uso** in 15 gruppi, 2 con il test end-to-end.
54 requisiti fatti non compaiono in nessun caso d'uso (elenco in fondo).

## Indice

- **La cassa della serata**
  - [UC-CASSA-001 — Si apre la cassa a inizio serata, anche dopo aver già battuto i primi conti](#uc-cassa-001) ✅
  - [UC-CASSA-002 — A metà serata si controlla quanto deve esserci in cassa](#uc-cassa-002)
  - [UC-CASSA-003 — Si chiude la cassa a fine serata e il contante torna al centesimo](#uc-cassa-003)
  - [UC-CASSA-004 — Il gestore rivede com'è andata una serata, una settimana o un mese](#uc-cassa-004)
- **Il conto al banco**
  - [UC-BANCO-001 — Si batte un conto al banco e si manda la comanda](#uc-banco-001) ✅
  - [UC-BANCO-002 — Interrotti a metà battuta, il conto si ritrova com'era](#uc-banco-002)
  - [UC-BANCO-003 — Si aggiunge un giro a un conto aperto, anche da un altro terminale](#uc-banco-003)
  - [UC-BANCO-004 — Dalla coda si trova subito il conto che serve](#uc-banco-004)
  - [UC-BANCO-005 — Si incassa un conto in contanti, col resto](#uc-banco-005)
  - [UC-BANCO-006 — Si annulla un conto sbagliato e lo si rimette in corso](#uc-banco-006)
  - [UC-BANCO-007 — Una serata intera con la rete staccata](#uc-banco-007)
- **I pagamenti**
  - [UC-PAG-001 — Si incassa con la carta: col lettore SumUp o con un POS esterno](#uc-pag-001)
  - [UC-PAG-002 — Il tavolo chiede il conto e ognuno paga la sua parte](#uc-pag-002)
  - [UC-PAG-003 — Si fa uno sconto o si scala un buono VIP](#uc-pag-003)
  - [UC-PAG-004 — Si chiude un conto impagato e lo si riscuote in un altro giorno](#uc-pag-004)
  - [UC-PAG-005 — Una tavolata con più conti paga insieme o alla romana](#uc-pag-005)
- **La sala**
  - [UC-SALA-001 — La sala prende l'ordine al tavolo e il conto arriva al banco](#uc-sala-001)
  - [UC-SALA-002 — La sala porta i drink pronti e li segna serviti](#uc-sala-002)
- **Il cliente al telefono**
  - [UC-CLIENTE-001 — Il cliente ordina dal QR del tavolo e segue il suo ordine fino al servizio](#uc-cliente-001)
  - [UC-CLIENTE-002 — Il cliente corregge o annulla il suo ordine finché non è in preparazione](#uc-cliente-002)
  - [UC-CLIENTE-003 — Il cliente che ritira al banco viene avvisato quando il drink è pronto](#uc-cliente-003)
  - [UC-CLIENTE-004 — Il cliente segue dal telefono un ordine battuto dallo staff, col QR](#uc-cliente-004)
  - [UC-CLIENTE-005 — Il cliente paga online quando ordina dal telefono](#uc-cliente-005)
- **La stampa**
  - [UC-STAMPA-001 — La comanda esce da sola, una volta, dal terminale che ha battuto il conto](#uc-stampa-001)
  - [UC-STAMPA-002 — Il locale decide chi stampa le comande della sala, e la sala collega il suo telefono](#uc-stampa-002)
  - [UC-STAMPA-003 — Al cliente si stampano il preconto, lo scontrino e la ricevuta d'acconto](#uc-stampa-003)
  - [UC-STAMPA-004 — Il gestore decide come si presenta il locale: nome, intestazione, campi e logo sulle stampe](#uc-stampa-004)
  - [UC-STAMPA-005 — La stampante non risponde: lo si sa prima, si sa cosa non è uscito e si rimette a posto](#uc-stampa-005)
- **Gli avvisi fra chi lavora**
  - [UC-AVVISI-001 — Il banco sa che è arrivato un ordine, da qualunque terminale o dal telefono di un cliente](#uc-avvisi-001)
  - [UC-AVVISI-002 — Ognuno sceglie i suoi avvisi, ritrova lo storico e sa quando sono spenti](#uc-avvisi-002)
  - [UC-AVVISI-003 — Sala e bancone si chiamano a vicenda](#uc-avvisi-003)
- **Il magazzino**
  - [UC-MAG-001 — Si mette in magazzino un prodotto nuovo, con la sua scheda](#uc-mag-001)
  - [UC-MAG-002 — Si carica merce a mano, si rettifica una giacenza e si fa un reso al fornitore](#uc-mag-002)
  - [UC-MAG-003 — Il magazzino scala quello che il banco prepara, e dice cosa resterà a fine serata](#uc-mag-003)
  - [UC-MAG-004 — Si fa l'inventario del periodo, scaffale per scaffale](#uc-mag-004)
- **Fornitori, ordini e conti del mese**
  - [UC-MAG-005 — Si compila il listino di un fornitore](#uc-mag-005)
  - [UC-MAG-006 — Si compone un giro d'ordini e lo si manda ai fornitori](#uc-mag-006)
  - [UC-MAG-007 — Arriva la merce: si registra la consegna e il magazzino si carica](#uc-mag-007)
  - [UC-MAG-008 — Si registra la fattura del fornitore, si paga e si chiude l'ordine](#uc-mag-008)
  - [UC-MAG-009 — Si leggono i conti del mese: altre spese, acquisti e fatturato per macro-categoria](#uc-mag-009)
- **Il menù**
  - [UC-MENU-001 — Si mette in carta un drink nuovo, con la ricetta e il prezzo](#uc-menu-001)
  - [UC-MENU-002 — Si rivedono i prezzi del listino guardando i margini](#uc-menu-002)
  - [UC-MENU-003 — Si prepara il menù che vede il cliente: sezioni, voci e Special](#uc-menu-003)
  - [UC-MENU-004 — Si sceglie l'aspetto del menù dei clienti dal Marketplace](#uc-menu-004)
- **Statistiche**
  - [UC-STAT-001 — Si guarda com'è andata una serata](#uc-stat-001)
  - [UC-STAT-002 — Si analizza un periodo: incassi, venduto, utile e magazzino](#uc-stat-002)
- **I dati del locale**
  - [UC-DATI-001 — Si mette al sicuro il database e lo si ripristina da un file](#uc-dati-001)
  - [UC-DATI-002 — Si importa il catalogo da un export di SumUp](#uc-dati-002)
- **Il personale**
  - [UC-STAFF-001 — Chi lavora entra nel gestionale col proprio account](#uc-staff-001)
  - [UC-STAFF-002 — Ognuno vede e fa solo quello che il suo ruolo consente](#uc-staff-002)
  - [UC-STAFF-003 — L'admin mette in regola il personale: nuovi account, ruoli, sospensioni](#uc-staff-003)
  - [UC-STAFF-004 — Sul tablet condiviso si sceglie chi apre la cassa, senza rifare il login](#uc-staff-004)
  - [UC-STAFF-005 — Si programmano i turni, si correggono le timbrature e si fissano le paghe orarie](#uc-staff-005)
- **Licenza e moduli**
  - [UC-LIC-001 — Il titolare vede cosa comprende la licenza e accende i moduli inclusi](#uc-lic-001)
  - [UC-LIC-002 — Il titolare prova, aggiunge o disdice un modulo dal Marketplace](#uc-lic-002)
  - [UC-LIC-003 — Un locale col piano Free lavora dentro i limiti del piano, e sa perché](#uc-lic-003)
  - [UC-LIC-004 — Il locale fermo per la licenza lo dice, e i dati restano](#uc-lic-004)
  - [UC-LIC-005 — Il titolare legge le novità di una versione e sceglie se aggiornare](#uc-lic-005)
  - [UC-LIC-006 — Il titolare passa dall'area clienti della regia all'app, e ritorno, senza rifare l'accesso](#uc-lic-006)
- **Le impostazioni**
  - [UC-IMP-001 — Si sceglie l'aspetto del gestionale: tema, icone, card della coda, aiuti sotto i campi](#uc-imp-001)
  - [UC-IMP-002 — Si regola come la coda ordini mostra e cerca i conti](#uc-imp-002)
  - [UC-IMP-003 — Si fissano l'orario della giornata e la stampa automatica di ogni terminale](#uc-imp-003)
  - [UC-IMP-004 — Si prepara il terminale per la serata: zoom, schermo intero, menu laterale](#uc-imp-004)

## La cassa della serata

<a id="uc-cassa-001"></a>
### UC-CASSA-001 — Si apre la cassa a inizio serata, anche dopo aver già battuto i primi conti

**Chi:** Bartender · **Si prova:** nel browser, con l'app e il backend (anche emulato, Functions comprese)

**Obiettivo.** Il bartender apre la serata con il fondo cassa, così che da lì in poi ogni incasso finisca nella chiusura giusta; se i primi clienti arrivano prima, i loro conti si battono lo stesso e si incassano appena la cassa è aperta.

**Si parte da.** Entrato come bartender, sulla Coda ordini. Nessuna cassa aperta: in cima alla coda c'è l'avviso «Cassa chiusa — gli ordini si battono, per incassare va aperta la cassa.» con il tasto «Apri cassa». Nel menù ci sono Negroni (8,00 €) e Mojito (8,00 €).

1. Tocca «Nuovo ordine» e batte un Negroni: il conto nasce al primo tocco e il tasto in fondo dice «Pagamento · 8,00 €».
2. Tocca «Pagamento»: nella schermata di pagamento compare «Cassa chiusa: per incassare va aperta la cassa.»; «Riscuotere» e «Impagato» sono spenti, mentre «Preconto» e «Sconto» restano usabili.
3. Chiude il pagamento con «✕ Chiudi», torna con «Torna agli ordini» e, al box «Nome del conto», tocca «Salva senza nome»: in coda c'è la card del conto con 8,00 €.
4. Tocca «Apri cassa» nell'avviso in cima alla coda: si apre un box che chiede il fondo, facoltativo.
5. Scrive 50 nel fondo e conferma con «Apri cassa»: l'avviso sparisce e nel menù ⋯ della coda la voce diventa «Chiudi cassa».
6. Riapre il conto dalla card, tocca «Pagamento»: «Riscuotere · 8,00 €» ora è acceso, senza essere usciti e rientrati.

**Esito.** La cassa risulta aperta con fondo 50,00 €; il conto battuto prima dell'apertura c'è, è numerato e si può incassare. Nessun incasso è stato registrato mentre la cassa era chiusa. Il riepilogo in testata della coda conta i conti di questa apertura.

**Varianti**

- *Nel box del fondo si tocca «Annulla»* — La cassa resta chiusa e l'avviso «Cassa chiusa» resta in cima alla coda.
- *Il fondo si lascia vuoto* — La cassa si apre lo stesso, con fondo zero.
- *A guardare la coda è la sala (Ciro — Sala)* — L'avviso dice «gli ordini si battono, per incassare la deve aprire il banco.» e non c'è nessun tasto «Apri cassa», né nell'avviso né nel menù ⋯.
- *Sulle card della coda, a cassa chiusa* — I tasti «Contanti», «Carta» e «Incassa sul lettore» ci sono ma sono spenti, e il loro titolo dice il perché; il «+» per un nuovo ordine resta attivo.
- *La rete è staccata e l'app si è appena aperta* — Finché la sessione di cassa non è arrivata dalla cache non si spegne niente; il conto battuto prende comunque il numero giusto della serata.

- Bisogni: UR-005 (La cassa della serata torna al centesimo); UR-007 (Ognuno fa quello che il suo ruolo consente)
- Requisiti: REQ-CASSA-002, REQ-CASSA-008, REQ-CASSA-017, REQ-ORD-007, REQ-ORD-016
- Test e2e: `tests/e2e/apriCassa.spec.js`

<a id="uc-cassa-002"></a>
### UC-CASSA-002 — A metà serata si controlla quanto deve esserci in cassa

**Chi:** Bartender, Admin · **Si prova:** nel browser, con l'app e il backend (anche emulato, Functions comprese)

**Obiettivo.** Al cambio turno, o quando un conteggio non torna, chi tiene la cassa vuole sapere subito quanto contante deve esserci nel cassetto, quanto si è incassato e chi ha incassato, senza aspettare la chiusura.

**Si parte da.** Cassa aperta con fondo 50,00 €. Nella serata sono stati incassati un conto da 16,00 € in contanti (da Marzia) e uno da 8,00 € con «Carta di Credito» (da Banco, l'admin). Entrato come bartender, sulla Coda ordini.

1. Dal menù laterale apre «Cassa»: si apre sulla sottosezione «Flusso», con la pastiglia «Cassa aperta».
2. Legge «Incassato serata»: 24,00 €.
3. Legge «In cassa adesso»: 66,00 €, cioè il fondo più i soli contanti.
4. Legge «Conto medio», con il numero dei conti, dei coperti e quanto lascia una persona.
5. Legge «Chi ha incassato»: Marzia 16,00 €, l'admin 8,00 €.
6. Scorre fino ad «Andamento per ora» per vedere com'è andata l'ultima ora.

**Esito.** Il contante atteso in cassa è 66,00 €: la carta non è finita nei contanti. I numeri sono quelli della serata in corso e si aggiornano da soli a ogni nuovo incasso, anche fatto da un altro terminale.

**Varianti**

- *In tutta la serata ha incassato una persona sola* — L'elenco «Chi ha incassato» non compare.
- *Un incasso è stato registrato con un metodo mai usato prima* — Compare con il suo nome accanto agli altri metodi, che restano elencati anche a zero.
- *Dalla stessa pagina si apre «Storico ordini» o «Chiusure»* — Sono le altre due sottosezioni della stessa Cassa, nel menù laterale.

- Bisogni: UR-005 (La cassa della serata torna al centesimo)
- Requisiti: REQ-CASSA-007, REQ-CASSA-003, REQ-CASSA-006
- Test e2e: da scrivere

<a id="uc-cassa-003"></a>
### UC-CASSA-003 — Si chiude la cassa a fine serata e il contante torna al centesimo

**Chi:** Bartender · **Si prova:** nel browser, con stampante o lettore SumUp sostituiti da un finto

**Obiettivo.** A fine serata il bartender conta il contante, lo confronta con quello che dice l'app e chiude la serata con lo scontrino di chiusura, con ogni metodo di pagamento separato e gli impagati in evidenza.

**Si parte da.** Cassa aperta alle 19:00 con fondo 50,00 €. Nella serata: un conto da 16,00 € incassato in «Contante», uno da 8,00 € con «Carta di Credito» e uno da 6,00 € chiuso «Impagato». Nessun conto aperto, nessuna comanda da servire. Sono le 01:30 (dopo mezzanotte). Stampante finta accesa sul terminale. Sulla Coda ordini.

1. Dal menù ⋯ della coda tocca «Chiudi cassa» (sotto c'è scritto «Conta il contante e chiudi la serata.»).
2. Si apre il box «Chiudere la cassa?»: «Incassato serata» 24,00 €, «di cui contanti» 16,00 €, «Contante atteso» 66,00 €.
3. Il box dice anche «1 conto chiuso impagato» e «6,00 € da riscuotere».
4. Nel campo del contante contato scrive 65: compare «Mancano 1,00 € rispetto all'atteso.»
5. Corregge in 66: compare «Il conto torna.»
6. Tocca «Chiudi cassa»: compare «Cassa chiusa.» e in cima alla coda torna l'avviso «Cassa chiusa».

**Esito.** La sessione di cassa è chiusa con fondo 50, incassato 24, contanti 16, contante atteso 66, contato 66, differenza 0 e 6,00 € di impagato da riscuotere. La serata, anche se chiusa all'01:30, appartiene al giorno in cui era stata aperta. Dalla stampante esce lo scontrino di chiusura con gli incassi divisi per metodo, solo quelli usati. Nella coda i conti incassati e annullati di questa serata non compaiono più, in nessun filtro; il riepilogo in testata torna a zero.

**Varianti**

- *C'è ancora un conto aperto, o una comanda pagata ma non servita* — «Chiudi cassa» nel menù ⋯ è spento e sotto dice cosa manca in una riga, per esempio «Chiudi 2 conti e 3 comande».
- *La stampante è spenta o non risponde* — La cassa si chiude lo stesso, nell'istante del tocco; l'avviso «Chiusura non stampata» lo dice e l'esito resta nel registro delle stampe.
- *La rete è staccata* — La chiusura si vede subito a schermo e arriva al server da sola quando la rete torna.
- *Il conto impagato era stato aperto il giorno prima* — Conta per la serata in cui è stato chiuso, non per quella in cui era nato.
- *Il cambio di giornata (Impostazioni → Giornata di lavoro) cade dentro l'orario di apertura* — Le impostazioni mostrano un avviso: spezzerebbe la serata in due giornate.

- Bisogni: UR-005 (La cassa della serata torna al centesimo)
- Requisiti: REQ-CASSA-001, REQ-CASSA-002, REQ-CASSA-003, REQ-CASSA-008, REQ-CASSA-015, REQ-CASSA-016, REQ-ORD-007, REQ-STAMPA-004, REQ-STAMPA-016
- Test e2e: da scrivere

<a id="uc-cassa-004"></a>
### UC-CASSA-004 — Il gestore rivede com'è andata una serata, una settimana o un mese

**Chi:** Gestore · **Si prova:** nel browser, con l'app e il backend (anche emulato, Functions comprese)

**Obiettivo.** Il gestore ritrova una serata passata per verificarne incasso, scontrino medio e venduto per prodotto, e confronta le serate per settimana o per mese, al netto degli sconti.

**Si parte da.** Esistono chiusure di cassa per più serate di agosto 2026, fra cui sabato 15 (aperta alle 19:00, chiusa all'01:08 del 16) e nessuna per lunedì 17. Entrato come admin, sul gestionale.

1. Dal menù laterale apre «Cassa» → «Chiusure»: una riga per serata con data, apertura → chiusura, durata e incasso; la serata in corso, se c'è, ha la pastiglia «in corso» e un trattino al posto dell'incasso.
2. Nel campo data sceglie il 15 agosto: la lista non si filtra, scorre fino alla serata del 15 e la accende; una riga dice dove è evidenziata.
3. Sceglie il 17 agosto: compare «Nessuna chiusura di cassa registrata per lunedì 17 agosto» e la lista resta intera.
4. Sceglie il 16 agosto: la serata chiusa all'01:08 del 16 non risulta, perché appartiene al 15.
5. Tocca la riga del 15: sotto si apre il riepilogo con sconti concessi, conti chiusi, contante contato e il rendiconto della serata.
6. Nel rendiconto guarda i conti con listino, sconto, incassato, costo e guadagno, e il cumulativo per prodotto e categoria.
7. Tocca il gettone «Settimana»: ogni riga è una settimana da lunedì a domenica, con numero di serate, incasso totale e media a serata.
8. Tocca il gettone «Mese» e poi la riga di agosto: si apre sulle serate che contiene.
9. Apre «Cassa» → «Storico ordini» e nel calendario sceglie «ieri»: compaiono i conti di quella giornata commerciale, anche quelli battuti dopo mezzanotte.

**Esito.** La serata del 15 si trova nella giornata del 15 anche se chiusa all'01:08. I prezzi del rendiconto sono quelli venduti, con lo sconto scorporato, non il listino. Le settimane e i mesi sommano gli incassi congelati alla chiusura e la media divide solo per le serate già chiuse; le settimane senza chiusure non compaiono.

**Varianti**

- *Si raggruppa per settimana e poi si cerca una data* — Si apre la settimana che contiene quella serata e la riga si accende lì dentro; il raggruppamento scelto resta.
- *In «Storico ordini» ci sono anche ordini fatti dai clienti dal telefono* — Compare il filtro su chi ha aperto il conto (il locale o il cliente); se non ce ne sono, il filtro non compare.
- *Si apre «Statistiche» sulla stessa serata* — Si leggono incassi, prodotti più venduti e tempi di preparazione e consegna misurati.

- Bisogni: UR-005 (La cassa della serata torna al centesimo)
- Requisiti: REQ-CASSA-001, REQ-CASSA-004, REQ-CASSA-005, REQ-CASSA-006, REQ-CASSA-013, REQ-CASSA-014, REQ-ORD-015
- Test e2e: da scrivere

## Il conto al banco

<a id="uc-banco-001"></a>
### UC-BANCO-001 — Si batte un conto al banco e si manda la comanda

**Chi:** Bartender · **Si prova:** nel browser, con stampante o lettore SumUp sostituiti da un finto

**Obiettivo.** Il bartender batte quello che il cliente ha chiesto e manda la comanda a chi prepara, senza mai aspettare la rete, con il totale giusto a schermo in ogni momento.

**Si parte da.** Cassa aperta. Entrato come bartender (Marzia), sulla Coda ordini, con la stampante finta impostata sul terminale e la stampa automatica delle comande spenta. Il pallino della stampante in coda è verde. Nel menù ci sono Negroni (8,00 €) e Spritz Aperol (6,00 €).

1. Tocca «Nuovo ordine»: si apre la griglia dei prodotti divisa per categoria, con i preferiti e i recenti.
2. Tocca Negroni due volte: il conto nasce al primo tocco senza cambiare schermata. Ogni tocco dalla griglia è una riga a sé, da personalizzare e annotare separatamente: due righe Negroni, la tessera segna 2 e il tasto dice «Pagamento · 16,00 €».
3. Scrive «spri» nella ricerca e tocca Spritz Aperol: la riga si aggiunge e la ricerca si svuota da sola.
4. Tocca la riga Spritz Aperol, in «Nota per questa riga» scrive «senza ghiaccio» e tocca «Salva»: la nota compare sotto la riga.
5. Legge il riepilogo: «Subtotale» 22,00 € e in fondo il totale; il tasto dice «Pagamento · 22,00 €». Accanto alle righe c'è il quadratino con l'iniziale di chi le ha battute (title «Aggiunto da …»).
6. Tocca «Invia comanda»: compare «Comanda inviata al banco».
7. Tocca «Torna agli ordini»; nel box «Nome del conto» scrive «Giulia» e salva.

**Esito.** In coda c'è subito la card del conto, con un numero della serata mai usato da un altro conto, 22,00 € e «3 prodotti», con l'iniziale di chi l'ha aperto. Dalla stampante esce la comanda con tutte e tre le righe e la nota «senza ghiaccio». Gli altri terminali vedono comparire il conto da soli; questo terminale non si avvisa di un ordine che ha battuto lui.

**Varianti**

- *La stampa automatica delle comande è accesa e non si tocca «Invia comanda»* — Mentre si batte non esce niente; la comanda esce da sola, una e completa, quando si esce dalla schermata del conto.
- *La rete è staccata* — Tutto come sopra, nell'istante di ogni tocco: il conto nasce, la card compare con il totale giusto, e in alto c'è il nastro «Offline — puoi continuare a lavorare»; la sincronizzazione arriva dopo, una volta sola.
- *Si tocca due volte di fila «Pagamento» mentre il conto sta ancora nascendo* — Nasce un conto solo e la schermata di pagamento resta aperta.
- *Il pallino della stampante è rosso* — Lo si vede in coda prima di battere; toccandolo si legge il motivo. La comanda resta comunque a schermo, in coda.
- *Il cliente chiede una cosa che non è a menù* — Dal menù ⋯ del conto, «Prodotto libero»: nome, prezzo e ingredienti; la riga si aggiunge al conto con quel prezzo.
- *La ricerca non trova niente* — Lo dice, invece di lasciare la griglia com'era; la ✕ accanto al campo lo svuota con un tocco.
- *Il locale ha scelto «Accendi e porta lì» per la ricerca (Impostazioni → Vista ordine)* — La griglia non si restringe: scorre fino alla prima card che risponde e la accende.
- *Si batte dal telefono (schermo sotto i 700px)* — In pagina restano totale, righe e i tre tasti «Invia», «Paga», «Annulla»; prodotto libero, dati conto, unisci e separa stanno dietro i ⋯.
- *Il conto è da servire al tavolo e il cliente vuole ritirarlo al banco (locale con «Ritiro e servizio»)* — Da «Dati conto» si cambia il modo: coperto e servizio si azzerano, e si legge prima di confermare.
- *Gli stati del servizio sono accesi e il cliente vuole seguire il drink* — Dal ⋯ del conto, «Mostra al cliente» apre la pagina da girargli, con «📲 Mostra QR al cliente» e «✏️ Modifica» per tornare al conto; a stati spenti la voce non c'è.
- *Il bartender riordina la griglia in «Organizza»* — La card presa dalla maniglia segue il dito (col dito si arma tenendo premuto) e resta dove la si lascia, uguale su tutti i terminali.
- *La striscia delle card è impostata su «Scorte» e un ingrediente è finito* — La card del prodotto ha la striscia rossa; un prodotto fuori menù resta grigio.

- Bisogni: UR-001 (Un conto si batte e si incassa anche con la rete staccata); UR-002 (Quello che si vede a schermo è il conto vero); UR-004 (La comanda arriva a chi deve preparare); UR-012 (Su un conto si vede chi ha battuto cosa)
- Requisiti: REQ-POS-001, REQ-POS-005, REQ-POS-006, REQ-POS-007, REQ-POS-008, REQ-POS-011, REQ-POS-012, REQ-POS-013, REQ-POS-014, REQ-POS-016, REQ-POS-019, REQ-POS-020, REQ-ORD-001, REQ-ORD-009, REQ-ORD-016, REQ-ORD-017, REQ-ORD-020, REQ-ORD-022, REQ-ORD-023, REQ-STAMPA-001, REQ-STAMPA-007, REQ-STAMPA-013, REQ-OFFLINE-001
- Previsti, non ancora fatti: REQ-POS-017, REQ-POS-018, REQ-TAVOLI-002
- Test e2e: `tests/e2e/contoAlBanco.spec.js`

<a id="uc-banco-002"></a>
### UC-BANCO-002 — Interrotti a metà battuta, il conto si ritrova com'era

**Chi:** Bartender, Sala · **Si prova:** nel browser, con l'app e il backend (anche emulato, Functions comprese)

**Obiettivo.** Chi batte un conto e viene interrotto (un cliente, il telefono che si blocca, la pagina che si ricarica) ritrova le righe dove le aveva lasciate, senza ribatterle e senza far nascere un conto doppio.

**Si parte da.** Cassa aperta. Entrato come bartender, sulla Coda ordini.

1. Tocca «Nuovo ordine» e batte Negroni, Mojito e Gin Tonic, senza inviare la comanda.
2. Ricarica la pagina del browser.
3. L'app riapre lo stesso conto con le tre righe; non c'è un secondo conto in coda.
4. Torna alla coda con «Torna agli ordini» (e «Salva senza nome»): il conto è in coda con le tre righe.
5. Riapre il conto dalla card, aggiunge uno Spritz Aperol, poi esce dalla schermata con il menù laterale senza inviare.
6. Riapre il conto: lo Spritz c'è ancora, insieme alle altre tre righe.
7. Tocca «Nuovo ordine»: si apre un conto nuovo e vuoto, non quello di prima.

**Esito.** Nessuna riga battuta è andata persa, il conto è uno solo e il conto nuovo parte pulito. Inviata la comanda o incassato il conto, la bozza è vuota.

**Varianti**

- *Si batte velocissimo nei primi decimi di secondo, mentre il conto sta nascendo* — Tutte le righe finiscono nello stesso conto.
- *Le righe non confermate sono state riordinate a mano* — Uscendo e rientrando restano nell'ordine scelto.
- *In cima a una lista si continua a trascinare in giù* — La pagina non si ricarica: lo scorrimento si ferma lì.
- *Lo stesso gesto, in modifica di un conto già esistente* — Le righe non confermate si ritrovano rientrando in quel conto.
- *Si usa «Svuota il conto» dal menù ⋯* — Chiede conferma («Svuotare il conto?») e toglie tutte le righe in un colpo.
- *Il conto ricordato ha più di otto ore o è stato chiuso* — Dopo il ricaricamento non viene ripreso.

- Bisogni: UR-003 (Niente di quello che si sta battendo va perso)
- Requisiti: REQ-POS-002, REQ-POS-003, REQ-POS-004, REQ-POS-009
- Test e2e: da scrivere

<a id="uc-banco-003"></a>
### UC-BANCO-003 — Si aggiunge un giro a un conto aperto, anche da un altro terminale

**Chi:** Sala, Bartender · **Si prova:** nel browser, con l'app e il backend (anche emulato, Functions comprese)

**Obiettivo.** Chi è al tavolo aggiunge quello che il cliente chiede dopo, o corregge un drink sbagliato, sullo stesso conto: senza riaprire quello che è già stato servito e lasciando traccia di chi ha battuto cosa.

**Si parte da.** Cassa aperta, stati del servizio accesi (Impostazioni → Gestione preparazione → «Segui la preparazione degli ordini»). Marzia al banco ha battuto un conto con un Negroni e ha inviato la comanda; al banco la comanda è già stata presa in carico e portata a «Pronto». Ciro (sala) è entrato dal suo telefono, sulla Coda ordini.

1. Ciro tocca la card del conto: entra nella schermata del conto, la stessa del banco, con la griglia dei prodotti.
2. Batte uno Spritz Aperol e tocca «Invia»: compare «Comanda inviata al banco».
3. Torna alla coda: la card dice 14,00 € e «2 prodotti»; il quadratino sulla card resta quello di Marzia, che l'ha aperto.
4. Riapre il conto: accanto al Negroni c'è l'iniziale di Marzia, accanto allo Spritz quella di Ciro, ognuna nel suo colore.
5. Toglie lo Spritz con il «−»: la riga sparisce e il totale torna a 8,00 €; il Negroni, già pronto, non si può togliere.

**Esito.** Lo Spritz è nato in una comanda nuova (comanda 2) e non dentro quella già presa in carico: chi ha già il Negroni in mano non si vede allungare il ticket. Al banco il conto si è aggiornato da solo. Il totale in coda, nel conto e nel pagamento è lo stesso.

**Varianti**

- *La comanda di prima è ancora «Da fare» (nessuno l'ha presa in carico)* — Lo Spritz entra nella stessa comanda, la comanda si ristampa completa, e le sue righe si possono ancora togliere.
- *Gli stati del servizio sono spenti* — Rientrando in modifica, sotto il totale compare «Le righe nuove dove vanno?» con «Nella comanda» e «Comanda nuova»; uscendo senza scegliere le righe vanno nella comanda.
- *Il telefono della sala è senza rete* — Lo Spritz compare subito sul conto e sulla card, con l'iniziale di Ciro; arriva al banco quando la rete torna.
- *Due persone toccano lo stesso conto quasi insieme* — Nessuno dei due gesti cancella l'altro: restano tutte e due le righe.
- *Le righe uguali sono separate, o una riga ha più pezzi* — Il tasto sopra la lista dice «Unisci» o «Separa» a seconda di cosa si può fare, ed è spento (non sparito) quando non c'è niente da fare.
- *Si tolgono tutte le righe di un conto appena aperto e senza incassi* — Il conto si annulla da solo e si torna alla coda.
- *Il telefono di Alex è senza rete* — Iniziali, righe e totale si vedono subito; il banco li riceve quando la rete torna.
- *La comanda da correggere è già servita, o è annullata* — Il «−» su quelle righe resta spento: quello che è stato servito non si toglie.
- *Alex apre il ⋯ di una comanda* — Può ristamparla, ma non trova «Torna a…» né la preparazione parziale: tornare indietro di uno stato, dividere e annullare restano del banco.
- *Alex prova ad annullare tutto il conto* — Non può: annullare un conto è del banco, e il database lo rifiuta anche se lo si tentasse.

- Bisogni: UR-002 (Quello che si vede a schermo è il conto vero); UR-010 (Un conto si corregge anche dopo averlo mandato); UR-012 (Su un conto si vede chi ha battuto cosa); UR-007 (Ognuno fa quello che il suo ruolo consente)
- Requisiti: REQ-ORD-003, REQ-ORD-004, REQ-ORD-009, REQ-ORD-016, REQ-ORD-018, REQ-ORD-019, REQ-ORD-022, REQ-ORD-023, REQ-POS-005, REQ-POS-010, REQ-POS-015, REQ-STAFF-014, REQ-STAFF-020
- Previsti, non ancora fatti: REQ-ORD-021
- Test e2e: da scrivere

<a id="uc-banco-004"></a>
### UC-BANCO-004 — Dalla coda si trova subito il conto che serve

**Chi:** Bartender, Sala · **Si prova:** nel browser, con l'app e il backend (anche emulato, Functions comprese)

**Obiettivo.** A metà serata chi è al banco ritrova un conto fra decine (i suoi, quelli chiusi, quelli annullati, quelli rimasti aperti da ieri) e sa con chi sta lavorando, senza che la coda nasconda lavoro da fare.

**Si parte da.** Cassa aperta. In coda ci sono conti aperti di Marzia e di Ciro, due conti chiusi, uno annullato e un conto rimasto aperto dalla serata di ieri. Marzia (bartender) è sulla Coda ordini; Ciro è collegato da un altro terminale.

1. Marzia apre la coda: compare subito, dalla copia locale, senza attese; il riepilogo in testata dice quanti conti sono aperti, chiusi e annullati in questa apertura.
2. Nella legenda vede le iniziali di chi ha aperto i conti e chi è collegato adesso, Ciro compreso.
3. In fondo alla coda il conto di ieri sta sotto la sua data, con la riga «⏳ Da chiudere».
4. Tocca «Filtri»: sotto si apre la fila dei filtri.
5. Accende anche «Chiusi» oltre ad «Aperti»: vede gli uni e gli altri; spegne «Aperti»: restano i chiusi.
6. Nella tendina degli autori lascia solo sé stessa: restano i suoi conti, in qualunque stato.
7. Chiude la fila: il tasto dei filtri dice cosa è acceso (per esempio «Chiusi +1»).
8. Accende «Annullati»: compare il conto annullato, che non conta fra i chiusi.

**Esito.** Il riepilogo in testata non cambia cambiando filtro. Il conto di ieri non si mescola a quelli di stasera ma non sparisce. I filtri restano come li si è lasciati su questo terminale.

**Varianti**

- *Si spengono sia «Chiusi» sia «Annullati»* — «Aperti» si riaccende da solo: la coda non resta mai vuota per un filtro.
- *Si accende «Solo oggi»* — I conti dei giorni scorsi spariscono dalla vista e il filtro dice quanti sono.
- *A guardare è la sala* — Vede la legenda di chi ha aperto i conti ma non chi è collegato.
- *Si chiude un conto da questo terminale* — Sparisce dagli aperti nell'istante in cui si torna alla coda, senza aspettare il server.
- *La cassa è stata chiusa e riaperta nella stessa sera* — I conti chiusi o annullati prima dell'ultima chiusura non compaiono più in nessun filtro; i conti aperti restano sempre.

- Bisogni: UR-002 (Quello che si vede a schermo è il conto vero); UR-007 (Ognuno fa quello che il suo ruolo consente)
- Requisiti: REQ-ORD-006, REQ-ORD-007, REQ-ORD-010, REQ-CODA-005, REQ-CODA-006, REQ-CODA-008, REQ-CODA-009, REQ-OFFLINE-002
- Test e2e: da scrivere

<a id="uc-banco-005"></a>
### UC-BANCO-005 — Si incassa un conto in contanti, col resto

**Chi:** Bartender · **Si prova:** nel browser, con stampante o lettore SumUp sostituiti da un finto

**Obiettivo.** Il bartender incassa un conto in contanti, sa quanto resto dare e chiude il conto con lo scontrino, senza aspettare la rete.

**Si parte da.** Cassa aperta. In coda c'è un conto aperto con Negroni, Mojito e Spritz Aperol (22,00 €). In Impostazioni → Pagamenti è acceso «Calcolo del resto in contanti». Stati del servizio spenti. Stampa automatica degli scontrini accesa, stampante finta.

1. Tocca la card del conto: il tasto in fondo dice «Pagamento · 22,00 €».
2. Tocca «Pagamento»: le righe sono già separate una per una e tutte selezionate; in alto «PAGAMENTO» 22,00 €, «Ammontare dovuto» 22,00 €.
3. Tocca «Contante»: compare il riquadro «Il cliente dà» con i tagli tondi che coprono l'importo (fra cui 50 €) e il campo «Altro».
4. Tocca 50: sotto compare «Resto da dare» 28,00 €.
5. Tocca «Riscuotere · 22,00 €».

**Esito.** Il conto si chiude nell'istante del tocco, si torna alla coda e la card non è più fra gli aperti; il riepilogo dice un aperto in meno. L'incasso è registrato come contante da 22,00 € con chi l'ha incassato ed esce lo scontrino col metodo scritto per esteso. Il resto non cambia l'importo incassato.

**Varianti**

- *La rete è staccata* — Tutto come sopra, subito; il conto arriva al server pagato, una volta sola, quando la rete torna.
- *Il cliente non vuole lo scontrino e il locale ha acceso «Un tasto per incassare senza stampare»* — «Riscuoti (senza stampa)» incassa e chiude uguale, e la stampante tace; se il conto verrà riaperto e riscosso, lo scontrino uscirà normalmente.
- *Gli stati del servizio sono accesi e i drink non sono ancora serviti* — «Riscuotere» incassa ma non chiude il conto (lo dice il suo titolo); se il locale ha acceso «Un tasto per incassare e servire insieme», «Riscuoti e servi · chiude il conto» incassa e chiude in un colpo.
- *Si incassa direttamente dalla card in coda* — I tasti «Contanti» e «Carta» chiudono il conto con quel metodo e stampano lo scontrino, senza aprire il conto.
- *Il «Calcolo del resto» è spento e si batte 50 sul tastierino* — La schermata dice «Resto: 28,00 € (si incassano 22,00 €)».
- *La cassa è chiusa* — «Riscuotere» è spento con «Cassa chiusa: per incassare va aperta la cassa.»
- *Il conto è già stato pagato da un altro terminale* — L'incasso viene rifiutato subito, non dopo un'attesa di rete.
- *Le colonne della schermata di pagamento sono strette per il lavoro di questo terminale* — Le due maniglie fra le colonne si trascinano e la misura resta su questo terminale.

- Bisogni: UR-001 (Un conto si batte e si incassa anche con la rete staccata); UR-002 (Quello che si vede a schermo è il conto vero); UR-005 (La cassa della serata torna al centesimo)
- Requisiti: REQ-PAG-001, REQ-PAG-002, REQ-PAG-009, REQ-PAG-012, REQ-PAG-014, REQ-PAG-015, REQ-ORD-006, REQ-ORD-014, REQ-STAMPA-001, REQ-STAMPA-005
- Test e2e: da scrivere

<a id="uc-banco-006"></a>
### UC-BANCO-006 — Si annulla un conto sbagliato e lo si rimette in corso

**Chi:** Bartender · **Si prova:** nel browser, con l'app e il backend (anche emulato, Functions comprese)

**Obiettivo.** Il bartender annulla un conto battuto per errore (le scorte tornano e il cliente viene avvisato), oppure riapre un conto chiuso o annullato per sbaglio, senza perdere niente e lasciando traccia del perché.

**Si parte da.** Cassa aperta, stati del servizio accesi. In coda c'è un conto aperto con un Negroni in preparazione (la giacenza del gin è già stata annotata) e un conto da 16,00 € incassato in contanti e chiuso. Entrato come bartender.

1. Apre il conto col Negroni e tocca «Annulla ordine»: si apre «Annullare l'ordine #…?» con «Le eventuali scorte usate verranno ripristinate.»
2. Sceglie la frase per il cliente, lascia acceso «Notifica il cliente» e tocca «Conferma»: si torna alla coda e il conto non è più fra gli aperti.
3. Apre «Filtri» → «Annullati»: il conto è lì.
4. Apre il conto annullato: al posto di «Pagamento» c'è «Riapri conto». Lo tocca: «Rimettere in corso il conto?», con «Perché lo riapri? (facoltativo)».
5. Scrive «annullato per errore» e tocca «Riapri»: il conto torna fra gli aperti, con il motivo leggibile dentro il conto.
6. Dal ⋯ apre «Storia del conto»: aperto, annullato e riaperto, con chi (nome e ruolo) e perché.
7. Apre il conto chiuso da 16,00 €, tocca «Riapri conto» e conferma con «Riapri».

**Esito.** Annullando, le scorte scalate sono tornate in magazzino com'erano state scalate (non ricalcolate dalla ricetta di adesso). Riaperto, il conto annullato ha le comande annullate di nuovo da fare. Il conto incassato riaperto torna da incassare: il suo incasso da 16,00 € esce dai guadagni della serata e dal contante atteso, e la storia dice «riaperto — tolti 16,00 € dagli incassi»; le righe si possono di nuovo modificare. Gli altri terminali vedono l'avviso «Conto ripristinato», questo no.

**Varianti**

- *Il conto era stato scontato o pagato con un buono VIP* — Annullando, il credito torna al beneficiario; riaprendo un conto annullato e scontato col buono, il saldo si ri-addebita (fino a quanto ce n'è).
- *Il drink era già stato preparato e il cliente non l'ha ritirato* — Si segna «non ritirato» / «non servito»: il conto si annulla ma le scorte restano scalate.
- *Il locale fa solo servizio al tavolo* — Nel dialogo di annullo la frase «Prego recarsi al bancone» non viene proposta.
- *La rete è staccata* — Annullo e riapertura si vedono subito in coda; la scrittura parte quando la rete torna.

- Bisogni: UR-006 (Il magazzino scala quello che è stato venduto davvero); UR-010 (Un conto si corregge anche dopo averlo mandato)
- Requisiti: REQ-ORD-005, REQ-ORD-006, REQ-ORD-008, REQ-ORD-009, REQ-ORD-010, REQ-PAG-006, REQ-NOTIF-001
- Previsti, non ancora fatti: REQ-ORD-021
- Test e2e: da scrivere

<a id="uc-banco-007"></a>
### UC-BANCO-007 — Una serata intera con la rete staccata

**Chi:** Bartender · **Si prova:** nel browser, con l'app e il backend (anche emulato, Functions comprese)

**Obiettivo.** Il bartender continua a battere, mandare comande e incassare quando la rete del locale cade, senza attese e senza conti sbagliati; quando la rete torna, tutto arriva al server da solo, una volta sola.

**Si parte da.** Cassa aperta con fondo 50,00 €, entrato come bartender da un browser appena collegato che non ha mai aperto un conto. Stati del servizio spenti. Poi la rete del browser viene staccata.

1. Compare il nastro «Offline — puoi continuare a lavorare, tutto si sincronizza al ritorno della connessione».
2. Tocca «Nuovo ordine»: la griglia dei prodotti c'è, perché la coda l'aveva già caricata.
3. Batte Negroni, Spritz Aperol e Mojito: il tasto dice «Pagamento · 22,00 €».
4. Tocca «Invia comanda»: compare «Comanda inviata al banco».
5. Torna alla coda: la card c'è già, con 22,00 € e «3 prodotti».
6. Riapre il conto, aggiunge un Gin Tonic e invia: «Pagamento · 30,00 €»; tornato in coda la card dice 30,00 € e «4 prodotti».
7. Riapre il conto, tocca «Pagamento», «Contante» e «Riscuotere · 30,00 €»: il riepilogo dice «0 aperti» e la card non c'è più.
8. Riattacca la rete: il nastro sparisce; la campanella mostra lo stato della sincronizzazione solo finché ha qualcosa da dire.

**Esito.** Nel database c'è un conto solo, pagato in contanti, con 4 pezzi e 30,00 € incassati. Ogni gesto si è visto nell'istante in cui è stato fatto, mai «quando sincronizza». Gli altri terminali vedono lo stesso conto, incassato, una volta sola.

**Varianti**

- *Si ricarica la pagina mentre si è senza rete* — L'app si apre lo stesso, col logo, dalla copia locale.
- *Una scrittura viene rifiutata quando la rete torna* — Si riprova da sola fino a tre volte; oltre, la campanella resta rossa, dice il motivo a parole e permette di ripetere l'ultima modifica o tutte.
- *Si prova a incassare col lettore SumUp senza rete* — SumUp è spento a vedersi; toccandolo dice che senza rete non può autorizzare e di registrare come «Carta di Credito».
- *Due terminali offline danno lo stesso numero a due conti* — Al ritorno della rete il server lo risolve da solo: chi è arrivato dopo prende il primo numero libero, e il numero vecchio resta scritto sul conto.
- *Esce una versione nuova dell'app* — Con la rete compare la proposta di aggiornare; senza rete non c'è nessun falso avviso.

- Bisogni: UR-001 (Un conto si batte e si incassa anche con la rete staccata)
- Requisiti: REQ-OFFLINE-001, REQ-OFFLINE-002, REQ-OFFLINE-003, REQ-OFFLINE-004, REQ-OFFLINE-006, REQ-OFFLINE-007, REQ-ORD-016, REQ-POS-005, REQ-PAG-001, REQ-PAG-004
- Test e2e: da scrivere

## I pagamenti

<a id="uc-pag-001"></a>
### UC-PAG-001 — Si incassa con la carta: col lettore SumUp o con un POS esterno

**Chi:** Bartender · **Si prova:** nel browser, con stampante o lettore SumUp sostituiti da un finto

**Obiettivo.** Il bartender incassa con la carta del cliente; il conto risulta pagato solo quando il lettore conferma, e un pagamento rifiutato lascia il conto da incassare con lo stesso importo.

**Si parte da.** Cassa aperta. In Impostazioni → Pagamenti «Lettore SumUp Solo» è acceso e associato (nell'ambiente di prova, il lettore simulato). In coda c'è un conto aperto da 15,00 €. Entrato come bartender.

1. Apre il conto, tocca «Pagamento · 15,00 €» e nella colonna dei metodi tocca «SumUp» (col nome del lettore).
2. Tocca «Riscuotere · 15,00 €»: compare «Transazione avviata sul lettore: il conto si aggiorna da solo all'esito.»
3. Il lettore conferma il pagamento: il conto risulta pagato senza toccare altro.

**Esito.** Il conto è chiuso e l'incasso è registrato come carta col lettore, separato dai contanti: nella chiusura di cassa non entra nel contante atteso. Il conto è stato segnato pagato solo dopo l'esito confermato dal lettore.

**Varianti**

- *La carta viene rifiutata* — Il conto resta aperto con lo stesso importo da incassare e la card in coda mostra «Pagamento fallito»; si può ripetere o cambiare metodo.
- *Si incassa dalla card in coda* — «Incassa sul lettore» avvia la transazione; mentre è in corso la card dice «In corso sul lettore… carta del cliente sul Solo.» e c'è «Annulla sul lettore».
- *Il lettore non è ancora associato* — «SumUp» è spento a vedersi ma si può toccare: dice che il lettore si attiva in Impostazioni → Pagamenti.
- *Il bancone incassa su un POS di un'altra banca* — Si sceglie «Carta di Credito»: l'incasso si registra subito come carta, anche senza rete, e non entra nei contanti.
- *Si associa il lettore* — In Impostazioni → Pagamenti, con «Lettore SumUp Solo» acceso, si scrive il codice di pairing mostrato dal lettore e si tocca «Associa»; un codice scaduto lo dice in chiaro. Associare è di chi sta al banco.
- *La rete è staccata* — SumUp è spento e al tocco dice di registrare come «Carta di Credito».

- Bisogni: UR-009 (Si paga con la carta, al lettore o con un link); UR-005 (La cassa della serata torna al centesimo)
- Requisiti: REQ-PAG-001, REQ-PAG-004, REQ-CASSA-003
- Test e2e: da scrivere

<a id="uc-pag-002"></a>
### UC-PAG-002 — Il tavolo chiede il conto e ognuno paga la sua parte

**Chi:** Bartender · **Si prova:** nel browser, con l'app e il backend (anche emulato, Functions comprese)

**Obiettivo.** Il bartender mostra il preconto al tavolo e poi incassa il conto a pezzi: chi paga i suoi drink, chi lascia una cifra, chi chiude il resto; a ogni passo si sa cosa è pagato e cosa resta.

**Si parte da.** Cassa aperta. In coda c'è il conto del tavolo 4 con 2 × Daiquiri (8,00 €), 1 × Birra in Bottiglia (5,00 €) e 2 × Negroni (8,00 €): 37,00 €. Stampante finta. Entrato come bartender.

1. Apre il conto, tocca «Pagamento · 37,00 €» e poi «Preconto»: esce il preconto e il conto resta aperto e modificabile.
2. Tocca «Deseleziona tutti»: tutte le voci passano a zero e si vedono smorte; in alto «NESSUNA RIGA SCELTA», 0,00 €, e «Riscuotere» è spento.
3. Tocca le etichette dei due Daiquiri e della Birra in Bottiglia: in alto «RIGHE SCELTE (3)» e 21,00 €.
4. Tocca «Contante» e «Riscuotere · 21,00 €»: il conto resta aperto; sotto «GIÀ PAGATO» c'è «Pagate · Contante» con «2× Daiquiri · 1× Birra in Bottiglia».
5. Il secondo cliente lascia 10 €: batte 10 sul tastierino; in alto «IMPORTO A MANO» e sotto «Acconto: resta sul conto, non copre righe precise.» Riscuote in «Carta di Credito».
6. Tocca «Seleziona tutti»: «Riscuotere · 6,00 €». Riscuote in contanti.

**Esito.** Il conto è chiuso con tre incassi distinti (21,00 € pagate in contanti, 10,00 € di acconto in carta, 6,00 € di saldo in contanti), ognuno col suo metodo e la sua ora. Il tasto Pagamento ha detto a ogni passo quanto restava. Lo scontrino finale riporta i metodi davvero usati.

**Varianti**

- *Dopo il primo tocco su una voce* — Il primo tocco restringe la selezione a quella voce, i tocchi successivi aggiungono; il «−» toglie sempre una unità.
- *Chi ha pagato la sua parte vuole una ricevuta e il locale ha acceso lo scontrino d'acconto* — «Acconto con scontrino» incassa la parte e stampa la ricevuta; se quell'incasso chiuderebbe il conto, è spento e al tocco spiega perché.
- *Il tavolo vuole dividere in parti uguali* — I tasti «/2» e «/3» del tastierino dividono l'importo.
- *Il cliente chiede il codice lotteria* — «Codice Lotteria»: si scrive il codice, «Salva codice», e il tasto mostra ✓; il codice esce sullo scontrino.
- *Il cliente chiede una fattura di cortesia (funzione premium accesa)* — «Invia fattura» emette la fattura numerata, la si invia per email o si stampa, e la si ritrova nel gestionale in «Fatture».
- *La rete è staccata* — Ogni incasso si vede subito sotto «GIÀ PAGATO» e parte in sottofondo.

- Bisogni: UR-002 (Quello che si vede a schermo è il conto vero)
- Requisiti: REQ-PAG-002, REQ-PAG-007, REQ-PAG-008, REQ-PAG-009, REQ-PAG-010, REQ-PAG-013, REQ-STAMPA-015
- Previsti, non ancora fatti: REQ-PAG-011
- Test e2e: da scrivere

<a id="uc-pag-003"></a>
### UC-PAG-003 — Si fa uno sconto o si scala un buono VIP

**Chi:** Bartender · **Si prova:** nel browser, con l'app e il backend (anche emulato, Functions comprese)

**Obiettivo.** Il bartender sconta i drink che sta incassando, o li fa pagare col credito prepagato di un cliente, con i conti che tornano sullo scontrino e in chiusura.

**Si parte da.** Cassa aperta. In coda c'è un conto con 3 × Birra in Bottiglia (5,00 €) e 2 × Negroni (8,00 €): 31,00 €. Esiste un buono VIP intestato a Mario con saldo 20,00 €. Strategia di sconto di partenza («tetto al totale»).

1. Apre il conto, tocca «Pagamento», poi «Deseleziona tutti» e tocca le tre birre: «RIGHE SCELTE (3)», 15,00 €.
2. Tocca «Sconto», sceglie «%» e batte 10: «Sconto su quello che stai riscuotendo: −1,50 €». Tocca «Applica (−1,50 €)».
3. Il tasto dice «Riscuotere · 13,50 €». Riscuote in contanti.
4. Tocca «Seleziona tutti» (i due Negroni, 16,00 €), apre «Sconto», sceglie il buono e in «Buono di» sceglie Mario: «Dal buono: −16,00 €». Tocca «Applica».
5. Il conto è coperto: tocca «Chiudi conto · 0,00 €».

**Esito.** Sul conto ci sono due sconti distinti, ognuno sulle sue righe; lo scontrino li elenca uno per uno («Sconto 10% su 3 prodotti −1,50 €»). Il saldo del buono di Mario scende a 4,00 €. Rendiconto e statistiche riportano i prezzi venduti al netto degli sconti, mai il listino.

**Varianti**

- *Dopo aver preparato lo sconto si cambiano le righe scelte* — Lo sconto si ricalcola sulle righe rimaste; con «Deseleziona tutti» resta sospeso e torna a seguire la selezione al primo tocco.
- *Lo sconto in euro supera quello che si sta riscuotendo* — Compare l'avviso che lo sconto supera l'importo e «Riscuotere» resta spento finché non lo si corregge.
- *Il buono ha meno saldo di quanto si vuole scalare* — Si scala quello che c'è («saldo/totale insufficiente») e il resto si incassa.
- *Non esistono buoni con saldo* — Il tasto del buono è spento con «Nessun buono con saldo».
- *Si vuole togliere lo sconto preparato* — «Rimuovi sconto» nella finestra dello sconto.
- *Il conto viene annullato dopo aver usato il buono* — Il credito torna a Mario.

- Bisogni: UR-002 (Quello che si vede a schermo è il conto vero); UR-005 (La cassa della serata torna al centesimo)
- Requisiti: REQ-PAG-003, REQ-PAG-006, REQ-PAG-010, REQ-PAG-013, REQ-CASSA-004
- Test e2e: da scrivere

<a id="uc-pag-004"></a>
### UC-PAG-004 — Si chiude un conto impagato e lo si riscuote in un altro giorno

**Chi:** Bartender · **Si prova:** nel browser, con stampante o lettore SumUp sostituiti da un finto

**Obiettivo.** Il bartender libera il tavolo di un cliente che pagherà dopo, senza perdere il credito e senza bloccare la chiusura di cassa, e quando il cliente torna incassa quel conto come un altro.

**Si parte da.** Cassa aperta, stampante finta. In coda c'è un conto aperto con uno Spritz Aperol (6,00 €). Entrato come bartender.

1. Apre il conto, tocca «Pagamento · 6,00 €» e, sotto i metodi, «Impagato».
2. Si apre «Chiudi impagato»: «Il conto si chiude senza incasso: 6,00 € restano da riscuotere.»
3. In «Note (stampate in grande sullo scontrino)» scrive «paga Mario domani» e tocca «Chiudi impagato».
4. Si torna alla coda: il conto non è più fra gli aperti; fra i chiusi ha la striscia arancione e la pillola «Impagato».
5. Il giorno dopo, con la cassa aperta, ritrova il conto in «Cassa» → «Storico ordini» (giornata di ieri), lo apre, tocca «Riapri conto» e poi «Riapri».
6. Tocca «Pagamento · 6,00 €», «Contante», «Riscuotere · 6,00 €».

**Esito.** Alla chiusura impagata esce lo scontrino con «Da riscuotere» 6,00 €, «IMPAGATO» e la nota in grande; le comande risultano servite e il magazzino scalato. La chiusura di cassa di quella sera non è stata bloccata e ha riportato «1 conto chiuso impagato · 6,00 € da riscuotere». Il giorno dopo l'incasso entra nella cassa del giorno dopo e il segno di impagato resta come storia.

**Varianti**

- *La cassa è chiusa* — «Impagato» è spento, come «Riscuotere».
- *La stampa automatica degli scontrini è spenta* — Lo scontrino dell'impagato esce lo stesso.
- *La rete è staccata* — Il conto si chiude impagato nell'istante del tocco e la scrittura parte dopo.

- Bisogni: UR-005 (La cassa della serata torna al centesimo)
- Requisiti: REQ-CASSA-016, REQ-ORD-008
- Test e2e: da scrivere

<a id="uc-pag-005"></a>
### UC-PAG-005 — Una tavolata con più conti paga insieme o alla romana

**Chi:** Bartender, Sala · **Si prova:** nel browser, con l'app e il backend (anche emulato, Functions comprese)

**Obiettivo.** Quando più conti separati devono pagare insieme (una tavolata, un evento) il bartender li raccoglie in un gruppo e li incassa in blocco o in quote uguali.

**Si parte da.** Cassa aperta, «Abilita i gruppi» acceso in Impostazioni → Gruppi di ordini. In coda ci sono tre conti aperti (8,00 €, 15,00 € e 14,00 €). Entrato come bartender.

1. Crea il gruppo «Compleanno» dal pannello dei gruppi in coda.
2. Apre ciascuno dei tre conti e dal ⋯ «Associa a un gruppo» sceglie «Compleanno».
3. Apre il gruppo: vede i tre conti, il totale 37,00 € e quanto resta da pagare.
4. Tocca «Dividi», accanto a «Dividi per» porta le parti a 3 con «+» e «−», e tocca «3 quote» col segno dei contanti.

**Esito.** I tre conti sono saldati; la somma delle quote fa esattamente 37,00 € e il centesimo di resto va sull'ultima. Il gruppo risulta saldato.

**Varianti**

- *Si paga tutto il gruppo in un colpo* — «Contanti» o «Carta» saldano tutti i conti da pagare del gruppo.
- *Si paga un conto solo del gruppo* — Dall'elenco del gruppo si incassa quel conto, gli altri restano da pagare.
- *Il gruppo ha sottogruppi* — Il totale somma tutto l'albero; un gruppo contenitore non riceve ordini diretti.
- *Un conto annullato sta nel gruppo* — Non entra nel totale.
- *Il lettore SumUp o il pagamento online sono attivi* — «Lettore» o «Online» incassano l'intero gruppo con la carta, e il pagamento chiude tutti i conti del gruppo.
- *Si paga tutto insieme invece che a quote* — «Contanti» o «Carta» saldano il resto del gruppo in un colpo, ciascuno col suo metodo.
- *Ogni persona paga il suo conto* — Con «Paga per singolo ordine» si incassa un conto per volta, in contanti o con carta.
- *Il gruppo contiene sottogruppi (es. «Tavolo A» e «Tavolo B»)* — Il totale somma tutti i conti dei sottogruppi; nel gruppo che li contiene non si possono mettere conti diretti, si ordina nei figli.
- *Un conto del gruppo è stato annullato* — Non entra nel totale del gruppo.
- *I gruppi sono spenti in Impostazioni* — Non compaiono da nessuna parte e nulla cambia nel resto del lavoro.

- Bisogni: UR-002 (Quello che si vede a schermo è il conto vero)
- Requisiti: REQ-GRP-001, REQ-GRP-002, REQ-GRP-003, REQ-GRP-004, REQ-PAG-005
- Test e2e: da scrivere

## La sala

<a id="uc-sala-001"></a>
### UC-SALA-001 — La sala prende l'ordine al tavolo e il conto arriva al banco

**Chi:** Sala, Bartender · **Si prova:** nel browser, con stampante o lettore SumUp sostituiti da un finto

**Obiettivo.** Chi serve ai tavoli batte l'ordine dal suo telefono, sul posto, e vuole che il banco lo veda subito e lo prepari senza bisogno di andarlo a dire a voce.

**Si parte da.** Due terminali. Al banco è entrata Marzia (bartender) col tablet: cassa aperta, coda ordini a schermo, nessun conto in coda. In sala è entrato Ciro (account sala) col telefono ed è sulla coda ordini: nel menu laterale ha solo «Coda ordini», «Da servire» e «Stampante». Nel menù ci sono Negroni e Hugo (15,00 € in tutto nel listino di prova).

1. Ciro, dalla coda, tocca «Nuovo ordine»: si apre la schermata del conto con la griglia dei prodotti.
2. Tocca Negroni, poi Hugo: le due righe compaiono subito nel conto e il tasto «Pagamento» mostra 15,00 €.
3. Tocca «Invia comanda»: compare «Comanda inviata al banco».
4. Tocca «Torna agli ordini» e, alla richiesta del nome, sceglie «Salva senza nome».
5. Sul telefono di Ciro la card del conto è in coda: 15,00 €, 2 prodotti.
6. Sul tablet del banco, senza che Marzia tocchi niente, compare la stessa card: 15,00 €, 2 prodotti, col quadratino di chi l'ha aperta («Aperto da Ciro — Sala»).
7. Al banco arriva l'avviso «Nuovo ordine» con «Ordine #1 ricevuto.»; sul telefono di Ciro, che l'ha mandato, nessun avviso.

**Esito.** Il conto esiste una volta sola, uguale sui due terminali, con righe e totale giusti e firmato da chi l'ha aperto. Al banco è arrivato come ordine nuovo; chi l'ha battuto non è stato disturbato da un avviso su quello che ha appena fatto.

**Varianti**

- *Il telefono di Ciro è senza rete* — Righe, totale, «Comanda inviata al banco» e la card in coda si vedono subito sul telefono, nell'istante del gesto; il banco vede il conto quando la rete torna, una volta sola.
- *Ciro prende l'ordine dalla carta: menu laterale → «Ordina dal menù»* — Si apre il menù come lo vede il cliente, con «Inserimento ordine da Ciro — Sala» e la ricerca «Cerca nel menù…». Tocca «Aggiungi» su Negroni e Hugo, poi «Rivedi ordine»; nel riepilogo scrive il tavolo (campo «Tavolo», vuoto vuol dire banco) e il nome, e tocca «Conferma ordine». Entra nel conto appena nato; al banco compare la card col tavolo.
- *Con «Ordina dal menù», il locale lascia stampare il telefono («La stampa il telefono») e il telefono ha la stampante impostata* — La comanda esce dal telefono di Ciro, una volta sola; l'ordine è salvato anche se la stampa non parte, e in quel caso lo dice il pallino della stampante in coda.
- *Il locale ha scelto «La stampa il banco»* — Il telefono non stampa niente: la comanda esce dal tablet del banco che tiene la coda aperta con la stampa automatica accesa.
- *La cassa è chiusa* — Il conto si batte e arriva in coda lo stesso; è l'incasso a restare spento finché qualcuno non apre la cassa.

- Bisogni: UR-004 (La comanda arriva a chi deve preparare); UR-001 (Un conto si batte e si incassa anche con la rete staccata)
- Requisiti: REQ-ORD-009, REQ-STAFF-008, REQ-STAFF-013, REQ-STAMPA-006, REQ-STAMPA-008, REQ-CASSA-017, REQ-ORD-016
- Previsti, non ancora fatti: REQ-TAVOLI-002
- Test e2e: da scrivere

<a id="uc-sala-002"></a>
### UC-SALA-002 — La sala porta i drink pronti e li segna serviti

**Chi:** Sala, Bartender · **Si prova:** nel browser, con l'app e il backend (anche emulato, Functions comprese)

**Obiettivo.** Chi gira coi vassoi vuole sapere quali drink sono pronti e per quale tavolo, portarli e segnarli serviti, senza poter toccare per sbaglio il lavoro di chi prepara.

**Si parte da.** Cassa aperta, «Segui la preparazione degli ordini» acceso, consegna «Solo servizio». In coda c'è il conto #3 del tavolo 5 (un Negroni con la nota «senza ghiaccio») in preparazione. Ciro (sala) ha il telefono sulla coda; Marzia (bartender) è al banco.

1. Sul telefono di Ciro la comanda in preparazione si vede nella sua colonna, ma senza il tasto per farla avanzare.
2. Marzia, al banco, la porta a «Pronto».
3. Sul telefono di Ciro, che ha la coda aperta, compare l'avviso «Pronto» con «Ordine #3»; sul tablet di Marzia no, perché il tasto l'ha premuto lei.
4. Ciro apre «Da servire» dal menu laterale: c'è la card #3 col tavolo 5, il Negroni e la nota «↳ senza ghiaccio».
5. Porta il drink e tocca «✓ Servito»: la card sparisce da «Da servire» e in coda il conto passa fra i serviti.

**Esito.** Il drink pronto è stato annunciato a chi lo deve portare, la sala l'ha segnato servito, e gli stati della preparazione li ha mossi solo il banco.

**Varianti**

- *Non c'è niente da servire* — «Da servire» dice «Nessun drink pronto da servire.»
- *Il conto è da ritirare al banco (consegna «Ritiro e servizio», conto con «Ritiro al banco»)* — Non compare in «Da servire»: in coda sta nella colonna dei drink da ritirare, e l'avviso dice «da consegnare» invece di «da servire».
- *Ciro segna il servito dalla coda invece che da «Da servire»* — La card nella colonna dei pronti ha il tasto per segnarla servita; dopo, sui serviti, compare «Incassa».
- *Il telefono di Ciro è chiuso o in tasca* — L'avviso «Drink pronti da servire» arriva come notifica di sistema (prova a mano: le notifiche push sugli emulatori non si provano).
- *Marzia ha segnato «Pronto» per sbaglio* — Dal dettaglio della comanda la pastiglia «↩︎ Torna a…» la riporta indietro, anche di più passi.
- *Marzia preferisce trascinare* — Tenendo premuta la card la sposta in un'altra colonna, anche all'indietro o saltando passi; le colonne che non accettano il rilascio si vedono sbiadite.
- *A battere è la sala e prova a far avanzare la comanda* — La sala non ha il tasto per «In preparazione» o «Pronto»: può solo segnare «Servito».
- *Al banco si preparano insieme i drink uguali di più comande* — Dal conto → Comande, «Preparazione parziale» su una comanda «Da fare»: si scelgono le unità («Preparo questi») e nascono due comande, una in preparazione e una ancora da fare, senza perdere un'unità.
- *La comanda della sala deve uscire su carta* — Esce una volta sola: dal telefono di chi l'ha presa o dal banco, secondo la scelta del locale in Impostazioni → Stampa automatica (si prova con la stampante finta).
- *Il conto ha più comande e si vogliono rifare su carta* — Dalle comande del conto si ristampano separate o tutte insieme in una sola.
- *Il locale fa anche ritiro al banco* — La colonna si chiama «Da servire/Ritirare» e col tastino ✂️ si divide in «Da servire» e «Da ritirare», solo su quel terminale.
- *Il tablet è stretto o l'app è molto zoomata* — Le corsie si impilano una sotto l'altra invece di stringersi.
- *Gli stati del servizio sono spenti* — La vista a corsie delle comande non esiste: il banco vede la coda dei conti come tutti.
- *La rete del banco è staccata* — Gli avanzamenti si vedono subito e partono in sottofondo; la comanda della sala arriva quando la rete torna.

- Bisogni: UR-007 (Ognuno fa quello che il suo ruolo consente); UR-004 (La comanda arriva a chi deve preparare); UR-006 (Il magazzino scala quello che è stato venduto davvero)
- Requisiti: REQ-STAFF-014, REQ-NOTIF-003, REQ-ORD-020, REQ-ORD-009, REQ-STAFF-013, REQ-CODA-001, REQ-CODA-002, REQ-CODA-003, REQ-CODA-004, REQ-CODA-007, REQ-ORD-001, REQ-NOTIF-002, REQ-STAMPA-006, REQ-STAMPA-012
- Previsti, non ancora fatti: REQ-PAG-011
- Test e2e: da scrivere

## Il cliente al telefono

<a id="uc-cliente-001"></a>
### UC-CLIENTE-001 — Il cliente ordina dal QR del tavolo e segue il suo ordine fino al servizio

**Chi:** Cliente, Bartender · **Si prova:** nel browser, con l'app e il backend (anche emulato, Functions comprese)

**Obiettivo.** Il cliente vuole ordinare dal tavolo senza aspettare nessuno e sapere a che punto è il suo drink e quanto manca, senza chiederlo.

**Si parte da.** Locale con gli ordini dal telefono attivi nella licenza, «Segui la preparazione degli ordini» e «Mostra tempo stimato ai clienti» accesi, consegna «Solo servizio». Cassa aperta, Marzia al banco sulla coda. Il cliente non ha un account e apre sul telefono il collegamento del QR del tavolo 12 (/menu?tavolo=12).

1. Si apre il menù col nome del locale in testa e la riga «Tavolo 12»; la prima volta compare il benvenuto con i passi dell'ordinazione: tocca «Inizia».
2. Sotto la testata legge «Tempo di servizio: ~N min».
3. Tocca «Aggiungi» su due drink: in fondo compare il carrello con i due drink e il totale.
4. Tocca «Rivedi ordine»: il riepilogo dice «Tavolo 12», la stima e le righe; il tasto dice «Inserisci il nome» ed è spento.
5. Scrive il nome in «Nome/Pseudonimo» e tocca «Conferma ordine».
6. Si apre la pagina dell'ordine: «Il tuo numero», il numero grande, «Ordine ricevuto», la stima «Ti serviamo in ~N min» e la frase «Non devi fare niente: te lo portiamo al tavolo.»
7. Al banco compare il conto col tavolo 12 e arriva l'avviso «Nuovo ordine».
8. Marzia lo porta a «In preparazione» e poi a «Pronto»: la pagina del cliente cambia stato da sola, senza ricaricare.

**Esito.** Il conto del cliente è in coda al banco col suo tavolo e il suo nome; il cliente ha seguito ogni passo dalla pagina dell'ordine, che si aggiorna da sola, e ritorna sul menù ritrova l'ordine in cima («Ordine #N»).

**Varianti**

- *Le ordinazioni sono sospese (solo consultazione)* — Il menù si legge ma non c'è «Aggiungi» né carrello; in alto: «Solo consultazione: le ordinazioni sono momentaneamente sospese. Rivolgersi allo staff per ordinare.»
- *Il locale non ha il modulo degli ordini dal telefono* — Il menù si legge e basta, con «Il menù si consulta da qui: per ordinare rivolgersi allo staff.»
- *È accesa «Posizione obbligatoria per ordinare» e il telefono è fuori dal raggio* — In alto: «Devi essere al locale per ordinare (sei a ~… m, massimo … m).» con «Riprova»; non c'è «Aggiungi». Dentro il raggio si ordina come sopra, e la posizione si ricontrolla anche toccando «Rivedi ordine».
- *Il cliente nega il permesso della posizione* — «Per ordinare serve la tua posizione…» con «Riprova»: non si ordina.
- *Consegna «Ritiro e servizio» con «Lo sceglie il cliente» acceso* — Nel riepilogo sceglie fra «Servito al tavolo» e «Ritiro al banco»; scegliendo il ritiro legge che non paga coperto né costo di servizio.
- *Gli stati del servizio sono spenti* — La pagina dell'ordine non mostra i passi né la stima e dice «Questa pagina resta aggiornata: ritira al banco quando il drink è pronto.»
- *Il cliente apre la vetrina sul telefono* — Il menù occupa tutta la larghezza; «I miei ordini» e «Accedi» stanno su una riga sotto la barra, già al caricamento.

- Bisogni: UR-008 (Il cliente ordina dal telefono e sa quando il drink è pronto)
- Requisiti: REQ-CLI-001, REQ-CLI-002, REQ-CLI-003, REQ-CLI-004, REQ-CLI-005, REQ-ORD-020, REQ-NOTIF-002, REQ-ORD-009
- Previsti, non ancora fatti: REQ-TAVOLI-001, REQ-TAVOLI-002
- Test e2e: da scrivere

<a id="uc-cliente-002"></a>
### UC-CLIENTE-002 — Il cliente corregge o annulla il suo ordine finché non è in preparazione

**Chi:** Cliente, Bartender · **Si prova:** nel browser, con l'app e il backend (anche emulato, Functions comprese)

**Obiettivo.** Il cliente ha sbagliato una quantità o ha cambiato idea, e vuole sistemarlo da sé prima che il banco cominci; se è il banco ad annullare, vuole sapere perché e cosa fare.

**Si parte da.** Come UC-CLIENTE-001: il cliente ha appena mandato un ordine di due drink, che è «Ordine ricevuto» e nessuno ha ancora preso in mano. È sulla pagina dell'ordine.

1. Nel «Riepilogo» tocca «+» su un drink: il totale si aggiorna.
2. Tocca «Salva modifiche»: compare «Modifiche salvate» e al banco la card mostra il totale nuovo.
3. Tocca «Annulla ordine»: la finestra chiede «Annullare il tuo ordine?» e avverte che l'ordine verrà annullato definitivamente.
4. Conferma con «Annulla ordine»: la pagina dice «Ordine annullato» e offre «← Torna al menù».
5. Al banco il conto esce dagli aperti e va fra gli annullati.

**Esito.** Le correzioni del cliente arrivano al banco col totale giusto; l'ordine annullato non resta fra quelli da preparare.

**Varianti**

- *Il banco ha già portato l'ordine «In preparazione», o ha aggiunto una comanda* — Spariscono «Salva modifiche» e «Annulla ordine»: da lì si chiede allo staff.
- *Il banco annulla l'ordine del cliente con la frase «Prego recarsi al bancone» e un motivo* — La pagina del cliente mostra «C'è stato un problema con il tuo ordine.», la frase scelta e «Motivazione: …»; se il cliente ha attivato le notifiche gli arriva anche «Problema con il tuo ordine» (prova a mano).
- *Il cliente ha già pagato online* — Le righe non si toccano più e l'ordine non si annulla dal telefono.

- Bisogni: UR-008 (Il cliente ordina dal telefono e sa quando il drink è pronto)
- Requisiti: REQ-CLI-001, REQ-NOTIF-001, REQ-ORD-007, REQ-ORD-010
- Test e2e: da scrivere

<a id="uc-cliente-003"></a>
### UC-CLIENTE-003 — Il cliente che ritira al banco viene avvisato quando il drink è pronto

**Chi:** Cliente, Bartender · **Si prova:** nel browser, con l'app e il backend (anche emulato, Functions comprese)

**Obiettivo.** Chi ha ordinato col ritiro al banco deve alzarsi al momento giusto: vuole essere avvisato quando il drink è pronto, una volta sola, e non restare a fissare il telefono.

**Si parte da.** Locale con consegna «Ritiro e servizio», gli stati del servizio accesi e il tabellone «stiamo servendo» acceso in Impostazioni → Menù clienti. Il cliente ha mandato un ordine col «Ritiro al banco» ed è sulla pagina dell'ordine; il browser non gli ha ancora chiesto le notifiche.

1. Sulla pagina vede «Avvisami quando è pronto» e la frase che senza notifiche la pagina si aggiorna da sola.
2. Tocca «Avvisami quando è pronto» e accetta il permesso: legge «Notifiche attive: ti avviseremo quando è pronto.»
3. Al banco Marzia porta la comanda a «Pronto».
4. La pagina del cliente passa a «Pronto al servizio» da sola; sul menù il tabellone mostra «Pronto al ritiro il numero» col suo numero.
5. Al cliente arriva la notifica «Il tuo drink è pronto!» con «Ordine #N pronto al ritiro.» (prova a mano).

**Esito.** Il cliente sa che il drink è pronto da tre strade — la pagina, il tabellone, la notifica — e la notifica arriva una volta per comanda.

**Varianti**

- *Il cliente non concede le notifiche* — Niente squillo: la pagina lo dice («Senza notifiche non si perde niente…») e passa a pronto da sola.
- *Il banco riporta la comanda indietro e la rimette a «Pronto»* — Il cliente non riceve un secondo avviso per lo stesso drink (prova a mano).
- *L'ordine è servito al tavolo* — «Avvisami quando è pronto» non c'è; la pagina dice «Non devi fare niente: te lo portiamo al tavolo.»
- *Gli stati del servizio sono spenti* — Nessun tasto d'avviso: la pagina dice di ritirare al banco quando il drink è pronto.
- *Il cliente ha ordinato a voce al banco, senza telefono* — Il suo numero, stampato sullo scontrino, compare nel tabellone del menù fra i pronti al ritiro.

- Bisogni: UR-008 (Il cliente ordina dal telefono e sa quando il drink è pronto)
- Requisiti: REQ-CLI-006, REQ-NOTIF-001, REQ-CLI-001
- Test e2e: da scrivere

<a id="uc-cliente-004"></a>
### UC-CLIENTE-004 — Il cliente segue dal telefono un ordine battuto dallo staff, col QR

**Chi:** Bartender, Sala, Cliente · **Si prova:** nel browser, con l'app e il backend (anche emulato, Functions comprese)

**Obiettivo.** Chi ha ordinato a voce vuole comunque seguire il suo drink dal telefono; chi lavora vuole girargli una schermata adatta a lui e tornare subito al conto.

**Si parte da.** Stati del servizio accesi, cassa aperta. Marzia ha battuto al banco un conto di un Negroni ed è nella schermata del conto. Il cliente ha il telefono in mano.

1. Marzia apre il ⋯ del conto e tocca «Mostra al cliente».
2. Si apre la schermata da girare al cliente: «Ordine #N» con lo stato, «✏️ Modifica», e «Mostra QR al cliente»; non c'è il riquadro «Il tuo numero».
3. Tocca «Mostra QR al cliente»: compare il QR con «Il cliente scansiona e segue l'ordine dal suo telefono.»
4. Il cliente apre sul suo telefono il collegamento del QR: vede «Il tuo numero», il numero e lo stato del suo ordine.
5. Marzia tocca «✏️ Modifica»: torna nel conto.
6. Marzia porta la comanda a «Pronto»: la pagina sul telefono del cliente cambia da sola.

**Esito.** Il cliente segue lo stesso conto che il banco lavora; lo staff ha girato la schermata giusta ed è tornato al conto senza passare dalla coda.

**Varianti**

- *Gli stati del servizio sono spenti* — «Mostra al cliente» e «Mostra QR al cliente» non compaiono: non ci sarebbe niente da seguire.
- *Chi lavora apre il collegamento dell'ordine senza la vista cliente* — Entra nella schermata del conto, qualunque ruolo abbia (banco o sala).

- Bisogni: UR-008 (Il cliente ordina dal telefono e sa quando il drink è pronto)
- Requisiti: REQ-ORD-017, REQ-ORD-022, REQ-CLI-002
- Test e2e: da scrivere

<a id="uc-cliente-005"></a>
### UC-CLIENTE-005 — Il cliente paga online quando ordina dal telefono

**Chi:** Cliente, Bartender · **Si prova:** nel browser, con stampante o lettore SumUp sostituiti da un finto

**Obiettivo.** Il cliente vuole pagare subito con la carta dal telefono, e il banco vuole che il conto risulti pagato solo quando il pagamento è andato a buon fine.

**Si parte da.** Licenza con SumUp; in Impostazioni → Pagamenti è acceso «Pagamento online (SumUp)». Il lettore e il servizio SumUp sono sostituiti da un finto che risponde «riuscito» o «rifiutato». Il cliente ha due drink nel carrello.

1. Tocca «Rivedi ordine»: sotto «Pagamento» sceglie «Paga ora» (l'altra scelta è «Paga al bancone»).
2. Scrive il nome e tocca «Conferma e paga».
3. Sulla pagina dell'ordine, nel riquadro «Pagamento», tocca «Paga ora» col totale e completa il pagamento.
4. Legge «Verifico il pagamento…» e poi il pagamento risulta fatto.
5. Al banco il conto risulta pagato online.

**Esito.** Il conto è saldato col metodo online, con l'importo dell'ordine, e le righe non si possono più cambiare dal telefono.

**Varianti**

- *Il pagamento viene rifiutato* — Il conto resta da pagare; il tasto diventa «Riprova il pagamento» e il cliente può di nuovo correggere l'ordine.
- *Il locale richiede il pagamento online per ordinare* — Il riepilogo avverte che la carta verrà chiesta dopo la conferma; il conto entra nella coda del banco, e lo annuncia l'avviso «Nuovo ordine», solo quando è pagato.
- *Pagando al bancone col vincolo «ritiro se non pagato»* — Il servizio al tavolo è spento e il riepilogo spiega che per il servizio al tavolo si paga online.
- *La carta viene rifiutata* — Compare «Il pagamento non è andato a buon fine. Riprova» e il tasto «Riprova il pagamento»; l'ordine resta da pagare e non entra in coda.
- *Il pagamento non è obbligatorio* — L'ordine entra in coda subito; se il pagamento fallisce il cliente può pagare al bancone.
- *Il pagamento online non è disponibile* — La pagina dice che non è al momento disponibile e cosa fare.

- Bisogni: UR-009 (Si paga con la carta, al lettore o con un link); UR-008 (Il cliente ordina dal telefono e sa quando il drink è pronto)
- Requisiti: REQ-PAG-005, REQ-NOTIF-002, REQ-CLI-001
- Previsti, non ancora fatti: REQ-TAVOLI-001
- Test e2e: da scrivere

## La stampa

<a id="uc-stampa-001"></a>
### UC-STAMPA-001 — La comanda esce da sola, una volta, dal terminale che ha battuto il conto

**Chi:** Bartender · **Si prova:** nel browser, con stampante o lettore SumUp sostituiti da un finto

**Obiettivo.** Chi batte un conto vuole che la comanda esca su carta senza premere niente, una volta sola e accanto a sé, non sul tablet in fondo alla sala; e quando serve vuole poterla rifare a mano.

**Si parte da.** Due terminali di banco, tutti e due con la stampante impostata e, in Impostazioni → Cassa e giornata → Stampa automatica, «Stampa la comanda all'arrivo dell'ordine» acceso con «Banco e sala». Cassa aperta. La stampante è quella finta: ogni foglio uscito si conta.

1. Sul tablet A, Marzia tocca «Nuovo ordine» e batte due Negroni e un Hugo: mentre compone il conto non esce niente.
2. Tocca «Torna agli ordini»: dal tablet A esce una comanda con «COMANDA 1 - ORDINE N», i due Negroni su una riga sola («2») e l'Hugo.
3. Dal tablet B, con la coda aperta, non esce niente.
4. Ricaricando la coda sul tablet A la comanda non esce una seconda volta.
5. Marzia riapre il conto, aggiunge uno Spritz e manda la comanda: esce dal tablet A una comanda con lo Spritz.
6. Nel conto apre «Comande»: ci sono due comande e sopra i tasti «Una per comanda (2)» e «Tutto su una».
7. Tocca «Tutto su una»: esce un foglio solo con tutti i prodotti del conto, quantità sommate.
8. Tocca «Una per comanda (2)»: escono due fogli separati, uno per comanda.

**Esito.** Ogni comanda è uscita una volta, dal terminale che l'ha battuta, con le voci uguali accorpate; le ristampe a mano fanno esattamente i fogli che dicono i tasti, e contengono solo quel conto.

**Varianti**

- *Marzia annulla il conto mentre lo sta ancora componendo* — Non esce nessuna comanda, nemmeno con la stampa automatica accesa.
- *L'ordine arriva da un cliente col telefono (non ha un terminale che l'ha battuto)* — Lo stampa il terminale con la stampa automatica accesa che lo vede per primo, una volta sola.
- *Stampa automatica impostata «Solo dalla sala»* — Le comande battute al banco non escono da sole; quelle della sala sì.
- *Il conto ha una comanda annullata* — Né «Una per comanda» né «Tutto su una» la rimettono su carta.
- *Il conto ha una comanda sola* — I due tasti di ristampa insieme non compaiono; resta la stampa della singola comanda.
- *Una riga ha una nota* — Sulla comanda la riga con la nota resta separata da quelle uguali senza nota, e la nota si legge.

- Bisogni: UR-004 (La comanda arriva a chi deve preparare)
- Requisiti: REQ-STAMPA-001, REQ-STAMPA-013, REQ-STAMPA-012, REQ-STAMPA-021, REQ-STAMPA-010, REQ-STAMPA-014, REQ-UI-025
- Test e2e: da scrivere

<a id="uc-stampa-002"></a>
### UC-STAMPA-002 — Il locale decide chi stampa le comande della sala, e la sala collega il suo telefono

**Chi:** Admin, Sala · **Si prova:** nel browser, con stampante o lettore SumUp sostituiti da un finto

**Obiettivo.** Il gestore vuole che le comande prese ai tavoli escano di sicuro, dal telefono di chi le prende o dal banco; chi è in sala vuole collegare il suo telefono alla stampante da sé e sapere prima se la comanda uscirà.

**Si parte da.** Flavio (admin) sul tablet del banco, in Impostazioni → Cassa e giornata → Stampa automatica. Ciro (sala) è entrato col telefono, che non ha ancora nessuna stampante impostata. Stampante finta.

1. Flavio, sotto «Comande prese in sala», lascia «La stampa il telefono» e legge che il pallino nella coda dice se funziona.
2. Ciro, in coda, vede il pallino della stampante bianco; toccandolo legge «Qui non c'è nessuna stampante impostata. Impostala dal menu, in Stampante.»
3. Ciro apre «Stampante» dal menu laterale: vede indirizzo, porta, HTTPS e «Test stampa», e la nota che l'indirizzo vale per questo telefono; non vede i dati del locale sulla carta.
4. Scrive l'indirizzo, tocca «Test stampa» (esce la prova) e «Salva».
5. Torna in coda: il pallino diventa verde e toccandolo dice «La stampante risponde: le comande escono.»
6. Ciro prende un ordine con «Ordina dal menù» e lo conferma: la comanda esce dal suo telefono.

**Esito.** Il telefono della sala è collegato senza passare dal gestore, la configurazione condivisa del locale è rimasta quella di prima, e la comanda presa al tavolo è uscita.

**Varianti**

- *Flavio sceglie «La stampa il banco»* — Il telefono di Ciro non stampa; al posto del pallino la sua coda dice «Stampa il banco»; la comanda esce dal tablet del banco con la coda aperta e la stampa automatica accesa.
- *«La stampa il banco» ma la stampa automatica della comanda è spenta* — L'impostazione avverte: «La stampa automatica della comanda è spenta: così le comande della sala non le stampa nessuno.»
- *«La stampa il banco» con le comande automatiche «Solo dal banco»* — L'impostazione avverte che le comande della sala non le stamperebbe nessuno.
- *«Test stampa» non riesce (certificato non accettato, rete diversa)* — Sotto il tasto compare il collegamento all'indirizzo della stampante da aprire una volta per accettare il certificato, con cosa controllare (accesa, stessa rete, SSL).

- Bisogni: UR-004 (La comanda arriva a chi deve preparare)
- Requisiti: REQ-STAMPA-008, REQ-STAMPA-020, REQ-STAMPA-006, REQ-STAMPA-007, REQ-STAMPA-010, REQ-STAMPA-021, REQ-UI-025
- Previsti, non ancora fatti: REQ-STAMPA-003
- Test e2e: da scrivere

<a id="uc-stampa-003"></a>
### UC-STAMPA-003 — Al cliente si stampano il preconto, lo scontrino e la ricevuta d'acconto

**Chi:** Bartender · **Si prova:** nel browser, con stampante o lettore SumUp sostituiti da un finto

**Obiettivo.** Il cliente vuole un foglio che dica quanto deve, poi lo scontrino di quello che ha pagato; chi paga una parte e se ne va vuole la sua ricevuta. Chi incassa non vuole che la carta esca due volte o non esca.

**Si parte da.** Cassa aperta, stampante finta. «Stampa lo scontrino alla riscossione del conto» acceso con «Banco e sala». Un conto aperto al tavolo 4 con tre drink, nessun incasso.

1. Marzia tocca «Pagamento» e poi «Preconto»: esce un foglio col totale; il conto resta aperto e modificabile.
2. Nella schermata di pagamento lascia selezionato un solo drink, sceglie «Contante» e tocca «Riscuotere»: lo scontrino finale non esce, il conto resta aperto.
3. Ristampa il preconto: elenca l'incasso preso e la riga «Resta da pagare» con la differenza.
4. Seleziona il resto, sceglie la carta e tocca «Riscuotere»: esce lo scontrino, una volta sola, con i metodi scritti per esteso («Contante», «Carta di Credito»).
5. Sullo scontrino ci sono numero e data, il tavolo 4, e la riga di chi stampa porta il nome di chi è collegato (Marzia).

**Esito.** Preconto e scontrino riportano le stesse cifre del conto; lo scontrino è uscito una volta, al gesto della riscossione che chiude il conto.

**Varianti**

- *In Cassa e giornata è acceso «Un tasto per l'acconto con lo scontrino»* — Nella schermata di pagamento c'è «Acconto con scontrino»: incassa la parte scelta ed esce la ricevuta con la fascia «ACCONTO», le righe pagate, il metodo e quanto resta; il conto resta aperto. Quando l'incasso chiuderebbe il conto il tasto è spento e, toccato, dice perché.
- *È acceso «Lo scontrino d'acconto a ogni riscossione»* — Ogni incasso che non chiude il conto fa uscire da sé la ricevuta d'acconto; l'interruttore del tasto è spento e dice perché.
- *Si riscuote con «Riscuoti (senza stampa)»* — Il conto si chiude e la carta non esce.
- *Si riapre un conto già chiuso e lo si riscuote di nuovo* — Lo scontrino esce di nuovo.
- *Rientrando in coda su un terminale con la memoria vuota* — Non esce nessuno scontrino dei conti già pagati: la coda stampa solo comande.
- *A fine serata si chiude la cassa* — Esce la chiusura con gli incassi divisi per i metodi davvero usati, scritti per esteso.

- Bisogni: UR-002 (Quello che si vede a schermo è il conto vero); UR-005 (La cassa della serata torna al centesimo)
- Requisiti: REQ-STAMPA-001, REQ-STAMPA-005, REQ-STAMPA-015, REQ-STAMPA-004, REQ-STAMPA-014, REQ-STAMPA-021, REQ-PAG-008, REQ-PAG-012
- Previsti, non ancora fatti: REQ-STAFF-018
- Test e2e: da scrivere

<a id="uc-stampa-004"></a>
### UC-STAMPA-004 — Il gestore decide come si presenta il locale: nome, intestazione, campi e logo sulle stampe

**Chi:** Admin, Cliente · **Si prova:** nel browser, con stampante o lettore SumUp sostituiti da un finto

**Obiettivo.** Il gestore vuole che nome, indirizzo e logo del locale siano quelli giusti ovunque li legga un cliente — vetrina, menù, scontrino — e scegliere quali voci compaiono sullo scontrino e sulla comanda.

**Si parte da.** Flavio (admin) è in Impostazioni. Nessun valore salvato in «Il locale» né nei campi di stampa: valgono quelli della build. Stampante finta.

1. In Impostazioni → Il locale scrive un nome del locale, l'indirizzo e la ragione sociale.
2. Apre la vetrina e il menù in un'altra finestra, come cliente: nome nella barra, nella testata del menù e nel benvenuto.
3. In Impostazioni → Stampante, in «Cosa c'è sullo scontrino», spegne l'intestazione delle colonne e accende la riga di saluto scrivendone il testo.
4. Tocca la prova di stampa del riquadro: lo scontrino di prova ha il nuovo indirizzo in testa, la ragione sociale in fondo, la riga di saluto, niente intestazione delle colonne, e sempre la lista dei prodotti e il totale.
5. In «Cosa c'è sulla comanda» spegne l'ora nella fascia: la comanda di prova ha la fascia «COMANDA 1 - ORDINE N» senza ora.
6. In «Logo sulle stampe» carica un logo chiaro e piccolo: viene accettato; lo accende per lo scontrino e il preconto e lo lascia spento per la comanda.

**Esito.** Le pagine del cliente e la carta parlano col nome del locale; le stampe escono coi campi scelti, e su tutti i terminali, perché sono impostazioni del locale.

**Varianti**

- *Il logo caricato è una foto scura, o quasi bianca, o molto più alta che larga* — Viene rifiutato subito, dicendo perché; resta il logo di prima.
- *Il logo non si carica al momento della stampa* — Lo scontrino esce lo stesso, senza logo.
- *Chi è collegato è un bartender o la sala* — Non può caricare il logo né cambiare l'identità del locale.
- *Un locale che non ha mai aperto questi riquadri* — La carta esce identica a prima.
- *L'intestazione era già stata scritta in Impostazioni → Stampante, «Dati del locale»* — Sullo scontrino vince quella già scritta: «Il locale» riempie solo dove non c'è niente.

- Bisogni: UR-013 (Il gestionale si legge e si compila senza fatica)
- Requisiti: REQ-VENUE-001, REQ-VENUE-002, REQ-VENUE-003, REQ-STAMPA-011, REQ-STAMPA-014
- Test e2e: da scrivere

<a id="uc-stampa-005"></a>
### UC-STAMPA-005 — La stampante non risponde: lo si sa prima, si sa cosa non è uscito e si rimette a posto

**Chi:** Bartender, Sala · **Si prova:** nel browser, con stampante o lettore SumUp sostituiti da un finto

**Obiettivo.** Con la stampante spenta, senza carta o col certificato scaduto, chi lavora vuole saperlo prima di averne bisogno, sapere quale foglio non è uscito e perché, e non restare con l'app bloccata.

**Si parte da.** Cassa aperta, Marzia al banco sulla coda con la stampante impostata e il pallino verde. Stampante finta, che dal pannello Dev sa fingere «Carta finita» e «Nessuna risposta».

1. Dal pannello Dev si finge «Carta finita».
2. Marzia batte un conto e lo riscuote: il conto si chiude subito, come sempre, anche se la carta non esce.
3. Arriva l'avviso «Stampa non riuscita» che dice quale foglio non è uscito e «la carta è finita»; l'avviso resta nella campanella.
4. In Impostazioni → Stampante, nel «Registro delle stampe», la voce dello scontrino dice «Non stampata» con il motivo; sopra, lo stato della coda delle stampe («Nessuna stampa in corso», «Coda vuota»).
5. Si toglie il guasto e si riscuote un altro conto: lo scontrino esce, senza uscire dall'app né ricollegare niente, e nel registro la voce risulta stampata.

**Esito.** Nessun gesto è rimasto ad aspettare la stampante, il foglio non uscito è scritto sia nell'avviso sia nel registro, e la stampa riprende da sola appena il guasto passa.

**Varianti**

- *La stampante riceve ma non conferma («Nessuna risposta» dal pannello Dev)* — Nel registro la voce resta «In attesa di risposta»; nessun avviso d'errore.
- *Lo stesso guasto si ripete più volte in un minuto* — Arriva un avviso solo, non uno per foglio; il registro le ha tutte.
- *La stampa resta appesa* — Dopo quindici secondi la stampa si arrende e lo dice; il conto si può ristampare.
- *La stampante è spenta o il certificato non è più accettato (prova a mano, al locale)* — Entro mezzo minuto il pallino in coda diventa rosso; toccandolo si legge «Adesso la comanda non uscirebbe: …» e il collegamento all'indirizzo della stampante per accettare l'avviso di sicurezza. Riaccesa, il pallino torna verde e la comanda successiva esce.
- *Il pallino rosso lo guarda chi è in sala* — Non gli si dice di andare nelle impostazioni, che non ha.
- *Stampante vera: carta finita o coperchio aperto a metà serata (prova a mano)* — Avviso con la frase giusta, e il collegamento non viene buttato: tolto il guaio, si stampa subito.

- Bisogni: UR-004 (La comanda arriva a chi deve preparare); UR-001 (Un conto si batte e si incassa anche con la rete staccata)
- Requisiti: REQ-STAMPA-007, REQ-STAMPA-002, REQ-STAMPA-016, REQ-STAMPA-017, REQ-STAMPA-018, REQ-STAMPA-001
- Previsti, non ancora fatti: REQ-STAMPA-003
- Test e2e: da scrivere

## Gli avvisi fra chi lavora

<a id="uc-avvisi-001"></a>
### UC-AVVISI-001 — Il banco sa che è arrivato un ordine, da qualunque terminale o dal telefono di un cliente

**Chi:** Bartender, Sala · **Si prova:** nel browser, con l'app e il backend (anche emulato, Functions comprese)

**Obiettivo.** Chi sta al banco con le mani occupate vuole sentire e vedere che è entrato un ordine nuovo o un'aggiunta, una volta sola, e chi l'ha mandato non vuole l'avviso di quello che ha appena fatto.

**Si parte da.** Cassa aperta. Marzia al banco sulla coda, avvisi permessi dal browser; Ciro (sala) sulla coda dal telefono. In «Il mio profilo» → Notifiche, su tutti e due, «Dove compaiono, ad app aperta» è «In alto, ovunque».

1. Ciro batte un conto e manda la comanda.
2. Sul tablet di Marzia compare in alto l'avviso «Nuovo ordine» con «Ordine #N ricevuto.» e suona; la campanella mostra una notifica da leggere.
3. Sul telefono di Ciro nessun avviso per quel conto.
4. Ciro aggiunge una riga allo stesso conto e manda la comanda: al banco non arriva un secondo «Nuovo ordine».
5. Marzia apre la campanella: la notifica da leggere è lì; la tocca e passa fra le lette (con «Storico» la ritrova).

**Esito.** Ogni ordine nuovo è stato annunciato una volta a tutti i terminali tranne quello da cui è partito, e l'avviso si ritrova nella campanella finché non lo si legge.

**Varianti**

- *In profilo è scelto «Dalla campanella, solo in coda»* — L'avviso esce come fumetto dalla campanella solo in coda e sparisce da sé; toccandolo si aprono gli avvisi. Fuori dalla coda (es. in Cassa) non compare niente, ma la campanella conta la notifica.
- *L'ordine lo manda un cliente dal telefono* — L'avviso arriva a tutti i terminali dello staff.
- *Un conto annullato viene ripristinato da un altro terminale* — Arriva «Conto ripristinato»; non torna a essere «Nuovo ordine». Chi ha premuto «Ripristina» non lo riceve.
- *Il tablet del banco ha lo schermo spento o l'app in secondo piano* — L'avviso arriva come notifica di sistema, fusa con quella dell'app (prova a mano: le push sugli emulatori non si provano).
- *Un'aggiunta a un conto già aperto, con il tablet del banco in secondo piano* — Arriva la notifica di sistema «Aggiunta al conto» con «Nuova comanda sull'ordine #N.» (prova a mano).
- *Lo stesso account è collegato sul tablet e sul telefono* — Suonano tutti e due i dispositivi tranne quello da cui è partito l'ordine (prova a mano).

- Bisogni: UR-004 (La comanda arriva a chi deve preparare)
- Requisiti: REQ-ORD-009, REQ-NOTIF-002, REQ-AVVISI-005
- Test e2e: da scrivere

<a id="uc-avvisi-002"></a>
### UC-AVVISI-002 — Ognuno sceglie i suoi avvisi, ritrova lo storico e sa quando sono spenti

**Chi:** Sala, Bartender · **Si prova:** nel browser, con l'app e il backend (anche emulato, Functions comprese)

**Obiettivo.** Al banco serve «nuovo ordine», in sala serve «pronto»: chi lavora vuole tenere solo gli avvisi del suo mestiere su quel dispositivo, ritrovare quelli arrivati, e accorgersi se il dispositivo non suona affatto.

**Si parte da.** Ciro (sala) è entrato sul telefono; il browser non ha ancora deciso sui permessi delle notifiche. È sulla coda.

1. In cima alla pagina compare «Gli avvisi sono spenti su questo dispositivo.» con «Attiva gli avvisi».
2. Tocca «Attiva gli avvisi» e accetta: la riga sparisce; aprendo la campanella legge «Gli avvisi arrivano su questo terminale.»
3. Dal menu laterale tocca il suo nome e apre «Il mio profilo»: nel riquadro «Notifiche» spegne «Nuovo ordine» e lascia acceso «Diventa pronto».
4. Al banco entra un ordine nuovo: a Ciro non arriva nessun avviso. Il banco porta una comanda a «Pronto»: a Ciro arriva.
5. Nella campanella tocca «Segna tutte lette»: le notifiche escono dalla lista; con «Storico» le ritrova, le già lette sbiadite.
6. Lo «Storico delle notifiche» nel profilo mostra lo stesso elenco; «Svuota storico» lo svuota anche nella campanella.

**Esito.** Su quel telefono arrivano solo gli avvisi scelti, la scelta non tocca né il tablet del banco né gli altri colleghi, e lo storico racconta cosa è arrivato su quello schermo.

**Varianti**

- *Ciro rifiuta il permesso* — La riga ricompare con «Non sono stati attivati. Riprova: senza, qui non arriva nessun ordine.» e il tasto per riprovare.
- *Il browser ha bloccato le notifiche* — La riga spiega che si riaccendono dalle impostazioni del browser, alla voce Notifiche per questo sito, e non mostra un tasto che non farebbe niente.
- *Ciro esce («Esci») e al banco arriva un ordine* — Il suo telefono non suona più; rientrando si registra di nuovo da sé, senza passare dalla coda (prova a mano per la push).
- *Ciro esce senza rete* — Esce comunque entro pochi secondi, senza restare bloccato.
- *In Impostazioni → Notifiche (gestore)* — C'è solo un cartello che porta al profilo.

- Bisogni: UR-004 (La comanda arriva a chi deve preparare); UR-007 (Ognuno fa quello che il suo ruolo consente)
- Requisiti: REQ-NOTIF-004, REQ-AVVISI-004, REQ-AVVISI-005, REQ-ORD-009, REQ-NOTIF-002
- Test e2e: da scrivere

<a id="uc-avvisi-003"></a>
### UC-AVVISI-003 — Sala e bancone si chiamano a vicenda

**Chi:** Sala, Admin, Bartender · **Si prova:** nel browser, con l'app e il backend (anche emulato, Functions comprese)

**Obiettivo.** Chi è al banco vuole chiamare un collega in sala, e chi è in sala vuole chiamare il bancone, senza gridare né scrivere messaggi: la chiamata deve farsi notare finché qualcuno non risponde.

**Si parte da.** Flavio (admin) al banco sulla coda; Ciro (sala) col telefono sulla coda. Nessuna chiamata in corso.

1. Ciro, dal menu laterale, tocca «Chiama il bancone»: la voce diventa «In attesa del bancone…» e un secondo tocco non ne manda un'altra.
2. Sul tablet di Flavio compare a tutto schermo «Chiamata dalla sala», con chi chiama, e «✓ Rispondo».
3. Flavio tocca «✓ Rispondo»: il riquadro sparisce e sul telefono di Ciro la voce torna «Chiama il bancone».
4. Flavio apre il ⋯ della coda e tocca «Chiamate staff e gruppi»: nel riquadro «Chiama lo staff» c'è Ciro.
5. Tocca «Chiama» accanto a Ciro, scrive «Vieni al bancone» e tocca «Invia chiamata»: accanto a Ciro compare «In chiamata…».
6. Sul telefono di Ciro, su qualunque schermata, compare «Chiamata dal bancone» col messaggio; tocca «✓ Rispondo».

**Esito.** Ogni chiamata è arrivata alla persona o al ruolo giusto, è rimasta in vista finché non c'è stata risposta, e la risposta l'ha chiusa per tutti e due.

**Varianti**

- *Non c'è nessun altro account dello staff da chiamare* — Il riquadro aperto dal ⋯ lo dice, e dice che gli account si creano in «Utenti e ruoli».
- *Il telefono chiamato è in tasca o l'app è chiusa* — Arriva come notifica di sistema e il telefono vibra con insistenza (prova a mano).
- *Un cliente prova a chiamare qualcuno* — Non può: il database lo rifiuta.
- *La rete è staccata sul telefono della sala quando tocca «Chiama il bancone»* — La voce passa subito a «In attesa del bancone…»; la chiamata parte quando la rete torna.
- *Nel locale c'è un solo account del personale* — Aprendo «Chiamate staff e gruppi» si legge «Non c'è nessun altro da chiamare: gli account dello staff si creano in Utenti e ruoli».
- *Chi riceve la chiamata sta guardando un conto o la cassa* — La chiamata compare lo stesso sopra quella schermata.
- *Il dispositivo che riceve è in tasca con l'app chiusa* — Arriva la notifica push che vibra (da verificare a mano su un telefono vero).

- Bisogni: UR-004 (La comanda arriva a chi deve preparare)
- Requisiti: REQ-STAFF-007, REQ-STAFF-019
- Test e2e: da scrivere

## Il magazzino

<a id="uc-mag-001"></a>
### UC-MAG-001 — Si mette in magazzino un prodotto nuovo, con la sua scheda

**Chi:** Gestore · **Si prova:** nel browser, con l'app e il backend (anche emulato, Functions comprese)

**Obiettivo.** Censire un articolo appena entrato nel listino d'acquisto, con costo, contenuto del pezzo, giacenza iniziale e scorta minima, perché si possa usare nelle ricette e venga scaricato a ogni vendita.

**Si parte da.** Accesso come bartender o admin, modulo «Magazzino e fornitori» attivo. In magazzino esiste la categoria «Gin»; non esiste il fornitore «Nova». Si è nel gestionale, sulla coda.

1. Dal menu laterale apre «Magazzino»: il titolo nella barra in alto dice «Prodotti».
2. Sopra la lista legge la legenda: il pallino dice quanta merce c'è (verde, giallo in esaurimento, rosso esaurito), la striscia a sinistra l'assortimento.
3. Tocca «+ Nuovo prodotto»: si apre la scheda «Nuovo prodotto».
4. Scrive «Gin Prova» in «Nome *» e sceglie «Gin» in «Categoria».
5. Nella tendina «Fornitore» sceglie «+ Nuovo fornitore…», scrive «Nova» e conferma: la tendina mostra Nova scelto, senza uscire dalla scheda.
6. In «Stato» lascia «In linea»; in «Costo €/pz (netto)» scrive 20 e lascia «IVA acquisto %» a 22: sotto il costo si legge il costo IVA compresa, 24,40 € al pezzo.
7. In «A quanto corrisponde un pezzo? (facoltativo)» scrive 70 e sceglie «cl».
8. In «Quantità iniziale (pz)» scrive 2 e in «Soglia di avviso (pz)» scrive 1, poi tocca «Salva».
9. Scrive «Gin Prova» in «Cerca prodotto…»: la riga dice 2 pz, col pallino verde.
10. Apre la card: la riga «Pezzi» dice «2 pz · 2 piene · 1 pz = 70 cl»; nella scheda non c'è nessuna casella per escludere il prodotto dallo scarico.

**Esito.** Gin Prova è in Magazzino → Prodotti, contato a pezzi: giacenza 2 pz, cioè 140 cl (1.400 ml in unità base), costo 20 € netti al pezzo, IVA d'acquisto 22%, soglia di avviso 1 pz. Il fornitore Nova esiste in Fornitori → Gestione fornitori. A schermo si legge sempre «pz», mai «bottiglie». Il prodotto compare fra gli ingredienti sceglibili di una ricetta e si dosa in cl o ml.

**Varianti**

- *Il contenuto si scrive come sta sull'etichetta («0,7» e «L»)* — Il prodotto risulta identico: 1 pz = 70 cl. Cambia solo come lo si digita, non il valore salvato.
- *L'articolo non si versa né si pesa (per esempio «Tempo di lavorazione»)* — In «A quanto corrisponde un pezzo?» si sceglie «U»: l'articolo ha un costo per unità, entra nel costo delle ricette e si scarica come gli altri; non compare negli ingredienti mostrati al cliente.
- *Il prodotto si compra a peso (kg o g)* — La scheda avvisa che la giacenza in pezzi è una stima.
- *Dalla card si tocca «⧉ Duplica»* — Si apre una scheda nuova già compilata con i dati del prodotto di partenza; salvandola nasce un prodotto distinto, l'originale non cambia.
- *La giacenza scende sotto la soglia di avviso* — Il pallino diventa giallo e il prodotto compare col filtro «In esaurimento»; a zero o sotto diventa rosso ed entra fra gli «Esauriti».

- Bisogni: UR-006 (Il magazzino scala quello che è stato venduto davvero); UR-013 (Il gestionale si legge e si compila senza fatica)
- Requisiti: REQ-MAG-001, REQ-MAG-002, REQ-MAG-007, REQ-MAG-010, REQ-MAG-011, REQ-MAG-012, REQ-MAG-013, REQ-MAG-016, REQ-MAG-017, REQ-MAG-019, REQ-MAG-027, REQ-MAG-044
- Previsti, non ancora fatti: REQ-MAG-020
- Test e2e: da scrivere

<a id="uc-mag-002"></a>
### UC-MAG-002 — Si carica merce a mano, si rettifica una giacenza e si fa un reso al fornitore

**Chi:** Gestore · **Si prova:** nel browser, con l'app e il backend (anche emulato, Functions comprese)

**Obiettivo.** Tenere la giacenza allineata allo scaffale fuori dal giro degli ordini: un carico diretto, una rettifica dopo un controllo, una bottiglia resa, e poi ritrovare tutto nella movimentazione del prodotto.

**Si parte da.** Gestore in Magazzino → Prodotti. «Gin Prova» ha 2 pz (1 pz = 70 cl), costo 20 €/pz netti; nessun movimento negli ultimi 90 giorni.

1. Apre la card di Gin Prova e tocca «Carico»: in «Verso del movimento» è scelto «Carico».
2. Scrive 3 come quantità caricata in pz, lascia «Costo unitario (€, netto)» a 20 e tocca «Conferma carico»: la giacenza passa a 5 pz.
3. Tocca «Contenuto reale», scrive 4,5 in «Contenuto effettivo di “Gin Prova”» con l'unità pz e tocca «Salva contenuto»: la giacenza diventa 4,5 pz.
4. Tocca di nuovo «Carico», sceglie «Reso al fornitore», scrive 1 come quantità resa e tocca «Conferma reso»: la giacenza scende a 3,5 pz.
5. Tocca «Movimenti»: si apre la movimentazione di Gin Prova, sul periodo «90 giorni».
6. Legge i totali per tipo: «Carico diretto» +3 pz, «Contenuto reale» −0,5 pz, «Reso al fornitore» −1 pz; sotto, il «Venduto mese per mese» e l'elenco dei movimenti dal più recente.
7. Chiude la movimentazione e dalla barra in alto passa alla sezione «Movimenti» del magazzino: i tre movimenti sono fra gli ultimi di tutto il magazzino.

**Esito.** Giacenza di Gin Prova 3,5 pz. Ci sono tre movimenti col loro motivo: carico, rettifica (contenuto reale) e reso al fornitore. Il reso esce dalla giacenza e si sottrae dagli acquisti del periodo al costo del prodotto: non viene contato come consumo. Il prezzo di vendita delle voci di menù che usano il gin non cambia.

**Varianti**

- *La giacenza è sotto zero (−1 pz) e si caricano 5 pz* — La giacenza diventa 4 pz: il carico si somma alla giacenza com'è, non riparte da zero.
- *Nel carico si scrive un costo unitario diverso (22 invece di 20)* — Il costo di riferimento del prodotto passa a 22 €/pz; il prezzo di vendita del menù non si muove.
- *La merce arriva a cartoni: si accende «Carico a colli», «Pezzi per collo» 6 e «Colli ricevuti» 2* — La quantità si riempie da sé a 12 pz e il prezzo si ricava dal totale del collo.
- *C'è un inventario in corso* — Nell'inventario il carico va in ACQ, il contenuto reale cambia RIM e CONS (non il DEP), il reso toglie da ACQ e non tocca il CONS.
- *Si sceglie il periodo «Tutto» su un prodotto venduto prima dell'app* — Fra i totali compaiono anche le «Vendite su Tiller», e il venduto mese per mese ha le due colonne App e Tiller.

- Bisogni: UR-006 (Il magazzino scala quello che è stato venduto davvero)
- Requisiti: REQ-MAG-001, REQ-MAG-010, REQ-MAG-011, REQ-MAG-013, REQ-MAG-045, REQ-MAG-048, REQ-MAG-049, REQ-MAG-053
- Test e2e: da scrivere

<a id="uc-mag-003"></a>
### UC-MAG-003 — Il magazzino scala quello che il banco prepara, e dice cosa resterà a fine serata

**Chi:** Gestore, Bartender · **Si prova:** nel browser, con l'app e il backend (anche emulato, Functions comprese)

**Obiettivo.** Sapere durante il servizio quanta merce c'è davvero e quanta ne resterà a fine serata, con una giacenza che scende per la ricetta con cui ogni drink è stato fatto.

**Si parte da.** Cassa aperta, locale che segue gli stati del servizio (Impostazioni → Gestione preparazione). Gin Prova ha 2 pz (1 pz = 70 cl). In menù c'è «Gin Tonic Prova» con ricetta 4 cl di Gin Prova. Nessun conto aperto. Un terminale è sulla coda, un altro in Magazzino → Prodotti, vista «A lista».

1. Dalla coda si apre un conto nuovo con un Gin Tonic Prova e lo si conferma: la comanda compare in coda come ricevuta.
2. In Magazzino compare la colonna «A fine serata»: per Gin Prova la giacenza è ancora 2 pz, a fine serata 1,94 pz; per i prodotti che nessun conto chiede la colonna dice «—».
3. In coda il bartender porta la comanda a «In preparazione» e poi a «Pronto».
4. In Magazzino la giacenza di Gin Prova è 1,94 pz e la card dice «1 piene · 1 aperta (66 cl)»; la previsione a fine serata resta 1,94 pz: il drink non è contato due volte.
5. Nel Menù, in «Modifica menù», si porta il gin del Gin Tonic Prova a 5 cl e si salva.
6. Nella movimentazione di Gin Prova lo scarico già fatto resta di 4 cl.
7. Si batte un secondo conto con un Gin Tonic Prova, lo si porta a «Pronto»: la giacenza scende di 5 cl. Poi si annulla quel conto: la giacenza torna a 1,94 pz.

**Esito.** Ogni drink portato a «Pronto» scala la ricetta con cui è stato fatto, in unità base: 4 cl sono 40 ml, cioè 0,057 pz di una bottiglia da 70 cl, mai 4 pezzi. Il cambio di ricetta vale solo per i drink fatti dopo. Il conto annullato restituisce esattamente quello che aveva scaricato. La colonna «A fine serata» toglie dalla giacenza solo quello che i conti aperti chiedono e il magazzino non ha ancora scalato.

**Varianti**

- *La rete è staccata sul terminale del banco* — Il passaggio a «Pronto» si vede subito in coda e non aspetta il magazzino; se lo scarico non va a segno la comanda resta segnata come non scaricata e si recupera alla riscossione.
- *La sala segna la comanda «Servito»* — Il magazzino non si muove: lo scarico è già avvenuto a «Pronto», e la sala non scrive sulle giacenze.
- *Una comanda torna da «Pronto» a «In preparazione» e poi di nuovo a «Pronto»* — Si scala una volta sola.
- *Gli stati del servizio sono spenti* — Lo scarico avviene alla riscossione del conto.
- *Si modifica un conto già scalato togliendo un drink* — Torna in giacenza solo la differenza, con un movimento di correzione.
- *La giacenza scende sotto la soglia, poi a zero* — Nel Menù la card del Gin Tonic Prova dice «Ingrediente in esaurimento» (striscia arancione), poi «Ingrediente esaurito» (rossa); la giacenza può andare sotto zero.
- *La cassa è chiusa* — La colonna «A fine serata» non c'è.

- Bisogni: UR-001 (Un conto si batte e si incassa anche con la rete staccata); UR-006 (Il magazzino scala quello che è stato venduto davvero)
- Requisiti: REQ-MAG-001, REQ-MAG-002, REQ-MAG-003, REQ-MAG-004, REQ-MAG-011, REQ-MAG-014, REQ-MAG-044, REQ-MENU-001, REQ-ORD-005, REQ-STAFF-014
- Test e2e: da scrivere

<a id="uc-mag-004"></a>
### UC-MAG-004 — Si fa l'inventario del periodo, scaffale per scaffale

**Chi:** Gestore · **Si prova:** nel browser, con l'app e il backend (anche emulato, Functions comprese)

**Obiettivo.** Rilevare le rimanenze vere, leggere il consumo del periodo (DEP + ACQ − RIM) e riallineare le giacenze, come sul foglio INV.

**Si parte da.** Modulo «Inventario» attivo. Nessun inventario aperto. Prodotti in più categorie e assortimenti (in linea, premium, fuori assortimento). Gin Prova ha 2 pz.

1. In Magazzino sceglie «Inventario» dal titolo nella barra in alto e tocca «Apri l’inventario».
2. In testa legge «Inventario in corso dal …», i giorni trascorsi e quanti prodotti sono contati sul totale; ogni riga mostra DEP, ACQ, CONS e RIM.
3. Torna in Prodotti e carica 1 pz di Gin Prova: rientrando nell'inventario, Gin Prova ha ACQ 1 e la RIM registrata è salita a 3.
4. A sinistra sceglie la categoria «Gin»: restano solo i gin, in ordine alfabetico.
5. Su Gin Prova scrive 2,5 nella casella RIM; su un altro gin tocca ✓ per confermare la rimanenza registrata.
6. In «Filtra i prodotti» sceglie «In linea» e «Premium»: gli altri spariscono e una nota dice che i prodotti esclusi, senza rimanenza inserita, chiuderanno con la giacenza registrata.
7. Esce dalla pagina e rientra: le rimanenze scritte ci sono ancora.
8. Tocca «Chiudi l’inventario»: il dialogo «Chiudere l’inventario?» dice i prodotti contati, la differenza in euro e il consumo del periodo; conferma.
9. In Prodotti la giacenza di Gin Prova è 2,5 pz.
10. Apre «Storico inventari»: l'inventario chiuso è in «Inventari chiusi» con data di apertura e chiusura; aperto, le RIM sono bloccate e si leggono i consumi.

**Esito.** Per Gin Prova DEP 2, ACQ 1, RIM 2,5, CONS 0,5 pz. Le giacenze dei prodotti contati diventano il numero contato; quelli non contati tengono la giacenza registrata. Il consumo a settimana è diviso per le settimane vere del periodo, e i valori sono a costo con l'IVA. L'inventario resta consultabile nello storico.

**Varianti**

- *Durante l'inventario si usa «Contenuto reale» su un prodotto* — Cambiano la sua RIM e il suo CONS; il DEP resta quello dell'apertura.
- *Il locale ha la riapertura automatica (Impostazioni → Funzioni premium)* — Chiuso l'inventario ne parte subito un altro, da oggi; senza, il prossimo si apre a mano.
- *Il modulo Inventario è spento* — Le voci «Inventario» e «Storico inventari» non compaiono fra le sezioni del magazzino.
- *Ambiente di test con «Controllo del magazzino (prova)» acceso in Impostazioni → Funzioni premium* — In Magazzino c'è «Controllo (prova)»: in «Conta» si corregge un prodotto alla volta, subito; in «Rapporto» si leggono acquisti, venduto, differenza fra contato e risultante e valore a fine periodo, su 7, 30 o 90 giorni. In produzione la voce non esiste.

- Bisogni: UR-006 (Il magazzino scala quello che è stato venduto davvero); UR-013 (Il gestionale si legge e si compila senza fatica)
- Requisiti: REQ-MAG-005, REQ-MAG-007, REQ-MAG-010, REQ-MAG-024, REQ-MAG-046, REQ-MAG-047, REQ-MAG-049, REQ-MAG-050, REQ-MAG-051, REQ-MAG-052
- Test e2e: da scrivere

## Fornitori, ordini e conti del mese

<a id="uc-mag-005"></a>
### UC-MAG-005 — Si compila il listino di un fornitore

**Chi:** Admin · **Si prova:** nel browser, con l'app e il backend (anche emulato, Functions comprese)

**Obiettivo.** Dire da chi si compra cosa e a che prezzo, anche lo stesso prodotto da più fornitori e a colli diversi, così che gli ordini si compongano coi prezzi giusti.

**Si parte da.** Accesso come admin. In magazzino ci sono «Gin Prova» e «Birra Bjorne»; esiste il fornitore «Nova», senza listino.

1. Dal menu laterale apre «Fornitori»: si apre «Gestione fornitori» con l'elenco.
2. Scrive «Font» in «Nuovo fornitore (es. NOVA)» e tocca «Aggiungi».
3. Sulla riga di Nova tocca «Listino»: si apre la scheda del listino, con «← Fornitori» in cima.
4. In «Cerca un prodotto in magazzino» scrive «Gin» e sulla riga di Gin Prova tocca «＋»: il prodotto entra in «Prodotti a listino».
5. Scrive il prezzo 19,50 e il «Codice del fornitore», poi tocca «Salva».
6. Torna ai fornitori, apre il listino di Font, associa Birra Bjorne, sceglie «Prezzo espresso per» collo, scrive 24 in «Pezzi per collo» e 25 come prezzo, e salva.
7. Cerca «Tonica Nuova», che in magazzino non c'è, e tocca «＋ Crea «Tonica Nuova» in magazzino».
8. In Magazzino → Prodotti c'è Tonica Nuova, segnata come scheda da completare.

**Esito.** Gin Prova ha un prezzo di listino da Nova (19,50 €/pz); Birra Bjorne da Font costa 25 € al collo da 24, cioè 1,04 €/pz. Un prodotto può stare nel listino di più fornitori. Tonica Nuova è in magazzino e nel listino da cui è nata.

**Varianti**

- *Si cambia un prezzo di listino già salvato (19,50 → 21)* — Sotto la riga compaiono le «Variazioni di prezzo» con la data e il passaggio dal vecchio al nuovo.
- *Si entra come bartender* — La voce «Fornitori» non c'è nel menu laterale, e l'indirizzo della sezione battuto a mano riporta alla coda. Un fornitore nuovo si crea comunque dalla tendina della scheda prodotto.

- Bisogni: UR-007 (Ognuno fa quello che il suo ruolo consente)
- Requisiti: REQ-MAG-017, REQ-MAG-028, REQ-MAG-029, REQ-MAG-035, REQ-MAG-040
- Test e2e: da scrivere

<a id="uc-mag-006"></a>
### UC-MAG-006 — Si compone un giro d'ordini e lo si manda ai fornitori

**Chi:** Admin · **Si prova:** nel browser, con l'app e il backend (anche emulato, Functions comprese)

**Obiettivo.** Rifornire quello che manca componendo in una sola tabella gli ordini per più fornitori, rivederli uno per uno e mandarli, oppure tenerli in bozza.

**Si parte da.** Accesso come admin. Listini compilati: Gin Prova da Nova a 19,50 €/pz, Birra Bjorne da Font a 25 € al collo da 24. Gin Prova è sotto la soglia di avviso, in stato «In linea». Nessun ordine aperto, nessun modello salvato.

1. In Fornitori apre «Nuovo ordine»: una tabella sola con Prodotto, Disponibilità, Fornitore, €/pz, Pezzi e Totale.
2. Tocca «Quello che manca»: si spuntano da soli i prodotti esauriti o sotto soglia, Gin Prova compreso.
3. Sulla riga di Gin Prova il fornitore è Nova e il prezzo 19,50 dal listino; scrive 6 pezzi: il totale riga è 117,00.
4. Cerca «Bjorne», sceglie Font, sceglie «Colli» e scrive 2: il totale riga è 50,00.
5. A lato, «Ordine in composizione» riporta pezzi, netto e totale +IVA. Tocca «Salva come modello» e lo chiama «Giro della settimana».
6. Tocca «Rivedi e conferma»: si apre il «Riepilogo dell’ordine», una riga per fornitore.
7. Apre Nova, controlla la tabella e tocca «Crea l’ordine»: la riga dice «Ordinato».
8. Su Font tocca «Salva in bozza»: la riga dice «In bozza».
9. In Magazzino, Gin Prova ha lo stato «In assortimento»; Birra Bjorne è rimasta com'era.
10. In «Lista ordini» l'ordine di Nova è «Richiesto» e quello di Font è «Bozza»; il filtro per stato porta il numero accanto a ogni voce.

**Esito.** Sono nati due ordini distinti, uno per fornitore, coi prezzi dei listini. Solo il prodotto dell'ordine confermato è passato «In assortimento», e ricorda lo stato da cui viene. La bozza non tocca il magazzino. Il modello «Giro della settimana» ricorda prodotti, fornitori e quantità, non i prezzi.

**Varianti**

- *La rete è staccata* — «Crea l’ordine», «Salva in bozza» e «Salva come modello» rispondono subito, e il prodotto passa in assortimento nello stesso istante; la scrittura parte dopo.
- *In un nuovo giro si sceglie «Giro della settimana» in «— Scegli un modello —»* — La tabella si precompila coi prodotti e le quantità del modello, per fornitore, e coi prezzi attuali dei listini.
- *Dalla Lista ordini si riprende la bozza di Font e si tocca «Manda l’ordine»* — L'ordine passa a «Richiesto» e Birra Bjorne va in assortimento.
- *Nell'ordine c'è un prodotto «Fuori assortimento»* — Alla conferma non passa in assortimento.
- *Si elimina un ordine richiesto* — I suoi prodotti tornano allo stato che avevano prima.
- *Un prodotto non ha prezzo nel listino del fornitore scelto* — La riga lo dice («Nessun prezzo di listino») e il prezzo si scrive a mano.
- *Su un ordine della Lista si usa «Invia a …», «Copia il testo» o «Rifarlo uguale»* — Si apre la mail al fornitore, il testo dell'ordine va negli appunti, oppure si riparte da un ordine uguale.

- Requisiti: REQ-MAG-006, REQ-MAG-007, REQ-MAG-028, REQ-MAG-036, REQ-MAG-037, REQ-MAG-038, REQ-MAG-039, REQ-MAG-040
- Previsti, non ancora fatti: REQ-MAG-023, REQ-MAG-026
- Test e2e: da scrivere

<a id="uc-mag-007"></a>
### UC-MAG-007 — Arriva la merce: si registra la consegna e il magazzino si carica

**Chi:** Admin · **Si prova:** nel browser, con l'app e il backend (anche emulato, Functions comprese)

**Obiettivo.** Caricare in magazzino quello che è arrivato davvero, coi pezzi e i prezzi del documento di consegna, e lasciare in attesa quello che manca.

**Si parte da.** Accesso come admin. Ordine a Nova «Richiesto» con due righe: Gin Prova 6 pz a 19,50 € e Vermouth Prova 3 pz a 12 €. Gin Prova ha 2 pz ed è «In assortimento».

1. In Fornitori → «Lista ordini» sceglie il filtro «Richiesti»: c'è l'ordine di Nova.
2. Tocca «Consegnato»: si apre «Merce arrivata da Nova?» con tutte le righe spuntate; ogni riga dice pezzi × prezzo e il suo totale, in fondo il «Totale netto».
3. Su Gin Prova corregge i pezzi da 6 a 5 e il prezzo da 19,50 a 20: il totale riga diventa 100,00 e il netto si rifà a ogni battuta.
4. Toglie la spunta al Vermouth Prova, non arrivato: il tasto diventa «Carica i selezionati (1)». Lo tocca.
5. In Magazzino Gin Prova ha 7 pz; nella sua movimentazione c'è una «Consegna ordine fornitore» di +5 pz.
6. Nel listino di Nova il prezzo di Gin Prova è 20,00, con la variazione registrata.
7. Sull'ordine il Vermouth Prova risulta ancora da ricevere; ripetendo «Consegnato» compare solo lui.

**Esito.** Il magazzino è stato caricato sulle quantità ricevute; il prezzo del documento è diventato il prezzo di listino di Nova e il costo del prodotto. Quando l'ordine non ha più righe da ricevere passa a «Consegnato», con la scritta «senza documento» finché non ha una fattura, e i suoi prodotti escono da «In assortimento» tornando allo stato di prima.

**Varianti**

- *Tutto è arrivato come ordinato* — Il tasto dice «Carica tutti (2)» e carica tutte le righe in un gesto.
- *Una riga dell'ordine riguarda un prodotto che in magazzino non esiste* — Alla consegna il prodotto nasce con nome, prezzo e IVA della riga, contato a pezzi e con la merce già dentro, segnato come scheda da completare finché non gli si dà la categoria.
- *Gin Prova era sotto zero (−1 pz) prima della consegna* — Dopo la consegna di 5 pz la giacenza è 4 pz.

- Bisogni: UR-006 (Il magazzino scala quello che è stato venduto davvero)
- Requisiti: REQ-MAG-029, REQ-MAG-032, REQ-MAG-037, REQ-MAG-038, REQ-MAG-043, REQ-MAG-045, REQ-MAG-048
- Test e2e: da scrivere

<a id="uc-mag-008"></a>
### UC-MAG-008 — Si registra la fattura del fornitore, si paga e si chiude l'ordine

**Chi:** Admin · **Si prova:** nel browser, con l'app e il backend (anche emulato, Functions comprese)

**Obiettivo.** Tenere nello scadenzario il documento vero del fornitore, legato all'ordine che paga, verificare che ordinato, ricevuto e fatturato tornino, e sapere quanto resta da pagare.

**Si parte da.** Accesso come admin. L'ordine a Nova è «Consegnato» senza documento (Gin Prova 5 pz a 20 €). È disponibile il PDF della fattura n. 1556, sotto gli 8 MB.

1. In Fornitori apre «Scadenzario»: in testa «Da pagare» col totale e i chip «Solo da pagare», «Senza ordine (N)» e «Senza allegato (N)».
2. Tocca «+ Nuovo documento»: sceglie Nova in «Fornitore *», scrive 1556 in «Numero doc.», la data, il tipo e 122,00 in «Importo € *», e tocca «Salva».
3. Sul documento tocca «Collega a un ordine» e sceglie l'ordine di Nova.
4. Tocca «Allega» e sceglie il PDF: sul documento si leggono nome e peso del file, e il conteggio di «Senza allegato» scende di uno.
5. Tocca «Aggiungi prodotti»: le righe si propongono dall'ordine collegato; la casella del carico avverte che la merce è già entrata alla consegna. Conferma.
6. In «Lista ordini», sull'ordine di Nova, il blocco «Ordinato, ricevuto, fatturato» mette in colonna Ordinato, Ricevuto, In fattura e Differenza, col segno.
7. I tre elenchi tornano: tocca «Chiudi» e l'ordine diventa «Chiuso».
8. Nello scadenzario segna il documento come pagato: il totale «Da pagare» scende di 122,00.
9. Apre la correzione del documento e cambia l'importo in 121,50, poi «Salva le correzioni»: il documento tiene righe, allegato e legame con l'ordine.

**Esito.** Il documento 1556 è nello scadenzario, pagato, con l'allegato, le righe e il legame con l'ordine di Nova; l'ordine è chiuso; la merce è stata caricata una volta sola, alla consegna.

**Varianti**

- *Il documento si fa leggere all'AI: «Leggi con l'AI» con la foto o il PDF della fattura* — Compare la proposta: fornitore riconosciuto, numero, data, importo e righe abbinate ai prodotti, coi punti da verificare e il costo della lettura. Si corregge, «Registra il documento» la registra con le righe spuntate e il file letto allegato; il carico a magazzino resta spento finché non lo si accende.
- *La fattura arriva senza un ordine: «Aggiungi prodotti» con la ricerca, casella «Carica la merce a magazzino» accesa* — Il tasto dice «Aggiungi e carica»: la merce entra in giacenza con un movimento «Carico da fattura». Spenta la casella il tasto dice «Aggiungi senza caricare» e le giacenze non cambiano.
- *Fra le righe della fattura un prezzo è diverso da quello in archivio* — Compare «Aggiorna il prezzo: in archivio … → …», spento di partenza; acceso aggiorna listino e costo del prodotto, mai il prezzo di vendita del menù.
- *Dalla Lista ordini si usa «Genera dall’ordine»* — Nasce un documento coi prezzi dell'ordine, segnato «Generata dall’ordine».
- *Dalla Lista ordini si usa «Pagato senza documento»* — Nasce la riga di scadenzario già pagata, senza carta.
- *Ordinato, ricevuto e fatturato non tornano* — «Chiudi» è spento e dice perché; la differenza di prezzo si legge col segno e da lì si allinea il listino.
- *Il caricamento dell'allegato non riesce* — Lo dice, e il documento resta com'era.

- Requisiti: REQ-MAG-025, REQ-MAG-028, REQ-MAG-029, REQ-MAG-030, REQ-MAG-031, REQ-MAG-033, REQ-MAG-038, REQ-MAG-041, REQ-AI-001
- Previsti, non ancora fatti: REQ-AI-003
- Test e2e: da scrivere

<a id="uc-mag-009"></a>
### UC-MAG-009 — Si leggono i conti del mese: altre spese, acquisti e fatturato per macro-categoria

**Chi:** Admin · **Si prova:** nel browser, con l'app e il backend (anche emulato, Functions comprese)

**Obiettivo.** Mettere a confronto, mese per mese e per famiglia di prodotti, quello che esce (merce e altre spese) e quello che entra, come nel rapporto per macro del foglio.

**Si parte da.** Accesso come admin. Nel mese ci sono consegne di ordini e vendite di Gin Tonic Prova. Nessuna macro-categoria, nessuna altra spesa.

1. In Magazzino sceglie «Macro-categorie», scrive «Distillati» in «Nuova macro (es. Distillati)» e tocca «Aggiungi».
2. Apre Distillati: a sinistra «Prodotti del magazzino», a destra «Voci del menù», in ordine alfabetico, ognuno con la casella della percentuale.
3. Mette Gin Prova e Gin Tonic Prova al 100%; mette un prodotto condiviso al 60%, e al 40% in una seconda macro.
4. In Fornitori apre «Altre spese», tocca «+ Nuova spesa», scrive «Sgabelli» in «Articolo *», quantità 4 e prezzo 200, segna «Già comprata» con la «Data dell’acquisto» di oggi e salva.
5. In Fornitori apre «Riepilogo»: per il mese, la merce dalle fatture, le altre spese comprate e quanto resta da pagare.
6. Dal menu laterale apre «Bilancio» → «Acquisti × Fatturato» e sceglie «Mese»: per riga le macro, per colonna i periodi; in ogni cella Acquisti, Fatturato, Utile e Fat/Acq.
7. Passa da «Lordo IVA» a «Netto IVA»: i numeri cambiano, la struttura no.
8. Apre «Venduto × Incassato»: per ogni macro incassato, costo del venduto, margine e Inc/Costo.

**Esito.** Distillati raccoglie gli acquisti di Gin Prova (merce entrata dalla porta nel mese) e il fatturato di Gin Tonic Prova; il prodotto diviso pesa 60% e 40% sulle due macro, e la parte non coperta da quote resta «Non attribuito». Gli sgabelli pesano sul mese della data d'acquisto nel Riepilogo, non sugli acquisti di merce.

**Varianti**

- *Una spesa è ancora da comprare* — Non pesa su nessun mese; segnata comprata dalla riga prende la data di oggi.
- *Una spesa è segnata comprata senza prezzo* — Porta la scritta «senza prezzo» in ambra.
- *La rete è staccata* — La spesa nuova o corretta compare subito nell'elenco; la scrittura parte dopo.
- *Si entra come bartender* — Le voci «Bilancio» e «Fornitori» non ci sono; Magazzino → Macro-categorie sì.
- *Entra un bartender o la sala* — La voce «Bilancio» non c'è nel menù laterale.
- *Le spese del mese non sono state inserite* — Il netto del mese non si può ancora calcolare: le spese si scriveranno nell'app (previsto).

- Bisogni: UR-007 (Ognuno fa quello che il suo ruolo consente)
- Requisiti: REQ-MAG-009, REQ-MAG-015, REQ-MAG-022, REQ-MAG-034, REQ-MAG-042, REQ-CASSA-010, REQ-CASSA-009, REQ-CASSA-011
- Previsti, non ancora fatti: REQ-MAG-021, REQ-CASSA-012
- Test e2e: da scrivere

## Il menù

<a id="uc-menu-001"></a>
### UC-MENU-001 — Si mette in carta un drink nuovo, con la ricetta e il prezzo

**Chi:** Gestore · **Si prova:** nel browser, con l'app e il backend (anche emulato, Functions comprese)

**Obiettivo.** Creare una voce di menù collegata agli ingredienti di magazzino, così che se ne conosca il costo reale, si scelga il prezzo col ricarico del locale e ogni vendita scarichi le dosi giuste.

**Si parte da.** Gestore in Menù → «Modifica menù». In magazzino Gin Prova (20 €/pz netti, IVA 22%, 1 pz = 70 cl) e una tonica a pezzi con costo. Ricarico impostato in Impostazioni → «Prezzo consigliato». Esiste la categoria «Gin Tonic».

1. Tocca «+ Aggiungi prodotto»: si apre «Nuovo prodotto».
2. Scrive «Gin Tonic Prova» in «Nome *» e sceglie «Gin Tonic» in «Categoria».
3. In «Ricetta / ingredienti» tocca «+ Ingrediente», sceglie Gin Prova, scrive 4 e sceglie «cl»; aggiunge la tonica, 1 pz.
4. Compare il riquadro del costo: «Prezzo reale (costo ingredienti)» e «Consigliato (×…)»; tocca «Usa prezzo consigliato», poi corregge a 8 in «Prezzo (€)»: la riga «Con 8,00 € guadagni …» dice il guadagno e il moltiplicatore.
5. Lascia vuota «IVA vendita %» (vale quella del locale), scrive i passaggi in «Come si prepara», lascia acceso «Disponibile nel menù» e tocca «Salva».
6. La card di Gin Tonic Prova è nella sua categoria, a 8,00 €, con lo stato «Disponibile».
7. Da «⋯ Azioni» tocca «Duplica»: si apre la scheda già compilata, col nome marcato «(copia)»; la rinomina «Gin Tonic Prova Analcolico», cambia gli ingredienti e salva. L'originale non cambia.
8. Sull'originale tocca «Rendi non disp.»: la card passa a fondo scuro e scritta bianca e dice «Non in menu».
9. Al banco, in un conto, la ⓘ della card di un drink disponibile apre la sua scheda con gli ingredienti, le dosi e «Come si prepara».

**Esito.** Gin Tonic Prova esiste con ricetta 4 cl di Gin Prova + 1 pz di tonica, prezzo 8,00 €, IVA di vendita del locale, costo reale calcolato dal magazzino. La copia è una voce distinta. Lo stato della card si legge dalla striscia (disponibile, ingrediente in esaurimento, esaurito, spento) e il colore del prodotto dal segno nell'angolo.

**Varianti**

- *Su una bottiglia intera si scrive 22 in «IVA vendita %»* — Quella voce si scorpora al 22%; le altre restano all'aliquota del locale.
- *Un ingrediente non ha costo* — Il riquadro dice «Stima parziale: manca il costo al dettaglio di …».
- *Si crea una categoria da Menù → «Categorie (N)»* — La categoria ha un colore stabile, lo stesso nel POS, nel menù e nelle statistiche.
- *Al banco si ritocca una riga di un conto (nome, prezzo, ingredienti) e si tocca «Salva nuova»* — Si apre la scheda «Nuovo prodotto» compilata col ritocco; salvata, si torna alla coda e la voce è nel menù. La riga del conto non cambia.
- *In Impostazioni → Aspetto si accende «Aiuti sotto i campi»* — Sotto i campi della scheda compaiono le righe d'aiuto; spento, non ci sono.
- *Si tocca «Elimina» e si conferma* — Dopo la conferma la voce sparisce dal menù.

- Bisogni: UR-006 (Il magazzino scala quello che è stato venduto davvero); UR-013 (Il gestionale si legge e si compila senza fatica)
- Requisiti: REQ-MENU-001, REQ-MENU-004, REQ-MENU-006, REQ-MENU-010, REQ-MENU-011, REQ-MENU-013, REQ-MENU-014, REQ-MENU-016, REQ-MAG-001, REQ-MAG-012, REQ-POS-014, REQ-UI-032
- Previsti, non ancora fatti: REQ-MAG-008
- Test e2e: da scrivere

<a id="uc-menu-002"></a>
### UC-MENU-002 — Si rivedono i prezzi del listino guardando i margini

**Chi:** Gestore · **Si prova:** nel browser, con l'app e il backend (anche emulato, Functions comprese)

**Obiettivo.** Trovare le voci che rendono meno di quanto dovrebbero, una famiglia alla volta, e correggerne il prezzo.

**Si parte da.** Gestore. Il menù ha più categorie; fra le birre alcune hanno prezzo sotto il consigliato e una ha un ingrediente senza costo.

1. Apre Menù e sceglie «Marginalità listino»: la tabella ha le colonne Voce, Costo, Vendita, Consigliato, Moltiplicatore e Utile, divisa per categorie, con i numeri incolonnati sotto le intestazioni.
2. Tocca l'intestazione «Utile»: le righe si ordinano per utile; un secondo tocco inverte l'ordine.
3. A sinistra tocca «Birre»: restano solo le birre.
4. Tocca «Da rivedere»: restano le birre sotto il prezzo consigliato; «Costo incompleto» isola quella senza costo; i conteggi dei filtri valgono dentro la categoria scelta.
5. Passa da «Per categoria» a «Tutto insieme» e torna indietro.
6. Tocca una birra da rivedere: si apre la sua scheda; tocca «Usa prezzo consigliato» e salva.
7. Torna in «Marginalità listino» → «Birre»: quella birra è fra le «In linea».

**Esito.** Il prezzo della birra è il consigliato; la tabella la conta in linea. Le altre voci non sono cambiate.

**Varianti**

- *In una categoria tutte le voci calcolabili sono in linea* — Col filtro «Da rivedere» compare «Tutti i drink calcolabili sono in linea.» invece di una tabella vuota.

- Bisogni: UR-013 (Il gestionale si legge e si compila senza fatica)
- Requisiti: REQ-MENU-002, REQ-MENU-004, REQ-MENU-032
- Test e2e: da scrivere

<a id="uc-menu-003"></a>
### UC-MENU-003 — Si prepara il menù che vede il cliente: sezioni, voci e Special

**Chi:** Gestore · **Si prova:** nel browser, con l'app e il backend (anche emulato, Functions comprese)

**Obiettivo.** Presentare al tavolo un menù pensato per chi ordina, diverso dalla disposizione del banco, con gli Special della casa in evidenza e un QR che apre solo loro.

**Si parte da.** Gestore. Nel menù della cassa ci sono le categorie «Gin e Vodka» e «Shot»; il menù dei clienti non è mai stato personalizzato. Licenza con i disegni dei drink (come la Tana).

1. Apre Menù e sceglie «Menù dei clienti»: senza struttura il menù dei clienti segue le categorie della cassa.
2. Tocca «Prepopola con le voci della cassa»: nasce una sezione per categoria, con dentro i suoi prodotti.
3. In «Nuova sezione» scrive «Vodka» e aggiunge: la sezione compare in cima.
4. Su una vodka di «Gin e Vodka» usa «Sposta … in un’altra sezione» e sceglie «Vodka».
5. Su una voce scrive il «Nome» letto dal cliente, una «Descrizione» e gli «Ingredienti» separati da virgola.
6. Rende nascosta la sezione «Shot»: la sezione dice «Nascosta: al tavolo la sezione non compare.»
7. Sceglie «Special (N)»: accende «Menù Special attivo», scrive Titolo e Sottotitolo; sotto c'è il «QR del menù Special».
8. Apre la scheda di un drink, accende «Drink speciale», sceglie bicchiere, colore e decorazione del disegno e salva.
9. Dal menu apre «Vista cliente» (il menù come lo vede chi ordina): in cima il carosello degli Special; sotto le sezioni nell'ordine scelto, senza «Shot».
10. Tocca una card: si apre il dettaglio con l'immagine grande, nome e prezzo, la descrizione intera e gli ingredienti uno per riga.
11. Nel carosello tocca «Vedi tutti ›»: si apre il menù Special; «← Tutto il menù» riporta al menù.

**Esito.** Il cliente che apre il menù dal QR del tavolo vede le sezioni scelte, coi nomi, le descrizioni e gli ingredienti scritti per lui; ogni voce resta collegata a un prodotto della cassa, quindi si ordina e si scarica come sempre. Il QR del menù Special apre solo gli Special.

**Varianti**

- *Una voce è «Non in menu» nel gestionale* — Non compare al cliente, nemmeno nella sua sezione.
- *Il campo «Ingredienti» di una voce è vuoto* — Al cliente si mostrano gli ingredienti della ricetta, senza quelli in unità «U».
- *Si tocca «Riparti dalle voci della cassa» o il ritorno al menù per categorie* — Una conferma lo chiede prima; i prodotti della cassa restano.
- *Il locale è impostato a «solo menù»* — Al cliente spariscono i tasti per aggiungere; chi è dello staff, dalla stessa pagina, può ancora inserire un ordine.
- *Il locale non ha la licenza dei disegni* — Al posto del disegno si vede la foto della voce, o un bicchiere neutro.

- Bisogni: UR-008 (Il cliente ordina dal telefono e sa quando il drink è pronto)
- Requisiti: REQ-MENU-005, REQ-MENU-018, REQ-MENU-019, REQ-MENU-020, REQ-MENU-025, REQ-MENU-026, REQ-LIC-013, REQ-AI-002
- Previsti, non ancora fatti: REQ-MENU-017, REQ-AI-004
- Test e2e: da scrivere

<a id="uc-menu-004"></a>
### UC-MENU-004 — Si sceglie l'aspetto del menù dei clienti dal Marketplace

**Chi:** Gestore · **Si prova:** nel browser, con l'app e il backend (anche emulato, Functions comprese)

**Obiettivo.** Dare al menù dei clienti la forma e i colori del locale, provando un tema o uno stile sul proprio menù prima di metterlo in uso.

**Si parte da.** Gestore. Licenza con gli stili «Notte», «Meraviglie» e «Carte» (come la Tana). Il menù dei clienti usa lo stile «Classico».

1. Dal menu laterale apre «Marketplace»: le sottosezioni sono «Temi», «Stili del menù», «Installati» e «Moduli» (più «I tuoi temi» se la licenza ne porta).
2. In «Temi» ogni tema ha la sua vetrina con due voci d'esempio, «Prova sul menù» e «Installa».
3. Tocca «Prova sul menù» su un tema: si apre il menù dei clienti vestito con quel tema; per i clienti non è cambiato niente.
4. Torna, tocca «Installa» e poi «Usa»: il tema dice «In uso» e il menù dei clienti lo porta.
5. In «Stili del menù» installa e usa lo stile «Giornale»: il menù dei clienti ha testata, sommario agganciato e sezioni.
6. In Impostazioni → «Menù clienti», nel riquadro «Stile del menù», sceglie di nuovo «Classico»: il menù torna com'era, con gli stessi colori del tema.
7. In «Installati» tocca «Disinstalla» su uno stile non in uso: sparisce dagli installati.

**Esito.** Il menù dei clienti, il menù Special e il carosello portano lo stile e i colori scelti; voci, prezzi e struttura non cambiano. Lo stile «Meraviglie» veste anche la home pubblica e le pagine dell'ordine.

**Varianti**

- *La licenza non ha «Notte»* — Lo stile «Notte» non compare né in Marketplace né nelle impostazioni.
- *Si usa lo stile «Carte»* — Il menù è un mazzo con un seme per gruppo di sezioni; toccando una carta si apre e mostra le voci.
- *La regia ha mandato temi su misura con la licenza* — Compaiono in «I tuoi temi», si provano, si installano e si usano come gli altri.
- *Il catalogo della regia non risponde* — Si sfoglia il catalogo ricordato; stili e temi installati continuano a funzionare.

- Requisiti: REQ-MENU-021, REQ-MENU-022, REQ-MENU-023, REQ-MENU-024, REQ-MENU-027, REQ-MENU-029, REQ-MENU-030, REQ-MENU-031, REQ-LIC-010
- Test e2e: da scrivere

## Statistiche

<a id="uc-stat-001"></a>
### UC-STAT-001 — Si guarda com'è andata una serata

**Chi:** Gestore · **Si prova:** nel browser, con l'app e il backend (anche emulato, Functions comprese)

**Obiettivo.** Ritrovare una serata — quella in corso, ieri o sei mesi fa — e leggerne incasso, conti, scontrino medio, orari e prodotti, dalla chiusura di cassa.

**Si parte da.** Gestore. Due chiusure di cassa con conti incassati, una con un conto aperto alle 22:00 e un secondo giro battuto all'01:00. La cassa è aperta adesso con qualche conto. Una voce venduta ha un ingrediente senza costo.

1. Dal menu laterale apre «Statistiche»: si apre «Per serata» con la lista delle chiusure, la più recente in cima.
2. La prima riga è la cassa aperta, in corso, coi numeri di adesso; ogni riga dice giorno, apertura → chiusura e durata, con incasso, conti e scontrino medio incolonnati.
3. Tocca la serata di ieri: si apre il dettaglio con «Serata del … — dall’apertura alla chiusura della cassa, mezzanotte compresa.»
4. Legge i riquadri, l'«Incasso per fascia oraria» (il conto delle 22:00 ha la sua seconda comanda nella fascia dell'01:00), i «Top prodotti per incasso», l'«Incasso per categoria» e l'«Utile per categoria».
5. Nell'«Utile per categoria» la categoria con l'ingrediente senza costo porta l'asterisco e la nota «Costo incompleto».
6. Tocca «← Chiusure»: torna la lista.
7. Tocca «📅 Calendario»: i giorni con servizio sono verdi, gli altri grigi, quelli a venire spenti; tocca un giorno verde e si apre direttamente quella serata.
8. Torna alla lista e scrive in «Data» un giorno senza servizio: compare «Nessun servizio …».

**Esito.** Il dettaglio comprende tutti i conti della finestra di cassa, anche dopo mezzanotte. L'incasso della riga è uguale a quello del dettaglio, e incasso = conti × scontrino medio. Uscendo da Statistiche e rientrando si riparte dalla lista.

**Varianti**

- *Si sceglie un giorno di prima dell'app (vendite importate da Tiller)* — Il giorno è verde nel calendario e il dettaglio dice «Giornata del … battuta su Tiller — dal primo conto all’ultimo.»
- *Un conto con più comande ha uno sconto* — Nelle fasce orarie lo sconto è diviso in parti uguali fra le comande, e la somma torna con l'incasso del conto.
- *Si entra come sala* — La voce «Statistiche» non c'è.

- Requisiti: REQ-STAT-001, REQ-STAT-005, REQ-STAT-006, REQ-STAT-007, REQ-STAT-008, REQ-MENU-004
- Test e2e: da scrivere

<a id="uc-stat-002"></a>
### UC-STAT-002 — Si analizza un periodo: incassi, venduto, utile e magazzino

**Chi:** Gestore · **Si prova:** nel browser, con l'app e il backend (anche emulato, Functions comprese)

**Obiettivo.** Capire come è andato un intervallo scelto (un mese, le feste, la stessa settimana dell'anno prima): quanto si è incassato, a che ore, cosa si è venduto e reso, quanta merce è entrata e uscita.

**Si parte da.** Gestore. Ordini incassati nel giugno scorso; una giornata di giugno con la cassa aperta e chiusa senza conti; movimenti di magazzino nel mese.

1. In Statistiche sceglie «Per periodo»: ci sono le scorciatoie «7 giorni», «10 giorni», «20 giorni», «30 giorni», «60 giorni» e «Personalizzato».
2. Tocca «30 giorni»: sotto si legge «Dal … al …: N giornate con ordini su 30».
3. Tocca «Personalizzato», imposta «Inizio» al 1° giugno ore 18:00 e «Fine» al 1° luglio ore 04:00, scrivendo o dal calendario accanto, e tocca «Applica».
4. In «Incasso per giornata» c'è anche la giornata a cassa aperta senza conti, a 0 €.
5. In «Venduto nella fascia oraria» stringe l'ora fra le 22 e l'1: una riga per categoria con pezzi e incasso, che si apre sui suoi prodotti.
6. Nella «Classifica del venduto» tocca «Ordina per incasso», poi «Ordina per pezzi»: tutte le voci vendute, non solo le prime dieci.
7. Sotto «Incasso per categoria» legge «Utile per categoria»: Categoria, Incassato, Costo del venduto, Utile, con la posizione e il totale.
8. In «Magazzino nel periodo» tocca «Calcola»: in testa «Comprato nel periodo», «Consumato nel periodo» e «Valore di quel che resta»; sotto, l'elenco per prodotto.

**Esito.** Tutti i riquadri lavorano sullo stesso intervallo, in giornate commerciali (la notte dopo mezzanotte appartiene alla giornata in cui è cominciata). La fascia oraria stringe solo l'ora. Le cifre di utile sono al netto degli sconti, con i costi delle ricette attuali.

**Varianti**

- *La fine viene prima dell'inizio* — Compare «L’ora di fine deve venire dopo quella di inizio.» e il periodo non si calcola.
- *Si scrivono le date senza toccare «Applica»* — Compare «Tocca «Applica» per calcolare il periodo scritto.»
- *Il periodo comprende giornate di prima dell'app* — Le vendite importate da Tiller entrano negli incassi e nel venduto.

- Requisiti: REQ-STAT-002, REQ-STAT-003, REQ-STAT-005, REQ-STAT-006, REQ-STAT-007, REQ-STAT-008
- Test e2e: da scrivere

## I dati del locale

<a id="uc-dati-001"></a>
### UC-DATI-001 — Si mette al sicuro il database e lo si ripristina da un file

**Chi:** Admin · **Si prova:** nel browser, con l'app e il backend (anche emulato, Functions comprese)

**Obiettivo.** Avere una copia di tutto (ordini, incassi, magazzino, menù, ore) prima di un'operazione grossa, e poterla rimettere senza perdere quello che è arrivato dopo.

**Si parte da.** Accesso come admin, su un ambiente di test con dati. Gin Tonic Prova costa 8,00 €.

1. In Impostazioni apre «Backup e ripristino»: ci sono «Esporta tutto» e «Ripristina da file».
2. Tocca «Esporta tutto»: il tasto dice «Scarico…» e il browser scarica un file JSON.
3. Nel Menù porta Gin Tonic Prova a 9,00 € e crea una voce nuova «Voce dopo il backup».
4. Torna in «Backup e ripristino», tocca «Ripristina da file» e sceglie il file: il dialogo «Ripristinare da questo file?» dice data del backup, quanti documenti in quali collezioni, e che quelli con lo stesso identificativo verranno sovrascritti.
5. Tocca «Ripristina»: alla fine compare l'esito.
6. Nel Menù Gin Tonic Prova costa di nuovo 8,00 €; «Voce dopo il backup» c'è ancora.

**Esito.** Il database ha i documenti del file; quello che è nato dopo il backup non è stato cancellato; la licenza del locale è quella di prima del ripristino, anche se il file ne conteneva un'altra.

**Varianti**

- *Si sceglie un file che non è un backup* — Viene rifiutato prima di scrivere qualunque cosa, e il database non cambia.
- *Si entra come bartender* — C'è solo «Esporta tutto»; la nota dice «Il ripristino è riservato all’admin.»
- *Nel dialogo si annulla* — Non si scrive niente.

- Bisogni: UR-007 (Ognuno fa quello che il suo ruolo consente)
- Requisiti: REQ-DATI-001
- Test e2e: da scrivere

<a id="uc-dati-002"></a>
### UC-DATI-002 — Si importa il catalogo da un export di SumUp

**Chi:** Gestore · **Si prova:** nel browser, con l'app e il backend (anche emulato, Functions comprese)

**Obiettivo.** Partire con menù, categorie e magazzino già compilati dal listino che il locale aveva sulla cassa precedente, invece di ribatterli a mano.

**Si parte da.** Gestore. File CSV «carte» esportato da SumUp, con prodotti in più categorie. Il menù attuale ha qualche voce di prova.

1. In Impostazioni apre «Catalogo prodotti»: «Importa da CSV SumUp», con l'avviso che sostituisce l'intero menù e le categorie e che foto e ricette esistenti vengono perse.
2. Tocca «Carica CSV» e sceglie il file: il dialogo «Importare il catalogo?» dice quanti prodotti in quante categorie, le elenca, conta le righe non valide saltate e avverte che il menù attuale verrà sostituito.
3. Tocca «Importa»: il tasto dice «Importo…», poi compare «✓ Importati N prodotti in M categorie.»
4. In Menù → «Modifica menù» le categorie sono nell'ordine in cui comparivano nel file e le voci di prova non ci sono più.
5. In Magazzino ci sono i prodotti dedotti (bottiglie e prodotti pronti, senza fasce prezzo e preparazioni); le voci con un collegamento evidente hanno già la ricetta.

**Esito.** Menù e categorie sono quelli del file; il magazzino ha gli articoli dedotti; le ricette evidenti sono collegate, le altre vanno completate dalla scheda della voce.

**Varianti**

- *Il file non è un export di SumUp* — Compare l'errore e niente cambia.
- *Nel dialogo si tocca Annulla* — Niente cambia.

- Requisiti: REQ-MENU-003
- Test e2e: da scrivere

## Il personale

<a id="uc-staff-001"></a>
### UC-STAFF-001 — Chi lavora entra nel gestionale col proprio account

**Chi:** Admin, Bartender, Sala · **Si prova:** nel browser, con l'app e il backend (anche emulato, Functions comprese)

**Obiettivo.** Chi arriva in turno entra nell'app col suo account per trovarsi davanti gli strumenti del proprio ruolo, e l'app installata sul telefono dice di chi è.

**Si parte da.** Nessuno è collegato sul dispositivo. Esistono tre account del personale (un admin, un bartender, uno di sala) e un cliente registrato. Si apre l'indirizzo del gestionale (/bar): compare il riquadro «Accesso staff».

1. Scrive l'email del bartender e la password nel campo «Password»: i caratteri compaiono coperti.
2. Tocca l'occhio accanto al campo («Mostra la password»): la password si legge in chiaro; ritoccandolo («Nascondi la password») torna coperta.
3. Tocca «Entra»: il tasto dice «Accesso…» e poi compare l'attesa animata «Ti sto facendo entrare…».
4. Si apre la coda ordini; in alto a destra c'è il nome di chi è collegato, con l'iniziale nel quadratino.
5. La linguetta del browser si chiama «La Tana del Coniglio - bartender».
6. Dal menu laterale (☰) tocca «Esci»: si torna al riquadro «Accesso staff».
7. Ripete l'accesso con l'account admin: la linguetta dice «La Tana del Coniglio - admin».

**Esito.** Ogni account entra e si trova nel gestionale col nome del locale seguito dal suo ruolo; la password non si vede finché non lo si chiede; durante l'attesa una scritta dice che cosa si sta aspettando.

**Varianti**

- *La password è sbagliata* — Resta il riquadro d'accesso con la scritta «Email o password non corretti.»; email e password scritte restano nei campi.
- *Si entra con l'account di un cliente registrato* — Compare «Quest’area è riservata allo staff.» col tasto «Esci e accedi come staff»; nessuna voce del gestionale nel menu laterale.
- *Si tocca «Entra con Google» con un account Google la cui email è quella di un account del personale* — Si entra con lo stesso account e lo stesso ruolo. Con un account Google senza ruolo del personale si legge «Quest’area è riservata allo staff.»
- *La rete è staccata al momento dell'accesso* — Si legge «Errore di rete. Controlla la connessione.» e il modulo resta compilato.
- *Il tablet del banco era già collegato il giorno prima* — Riaprendo l'app non si chiede nessuna password: si entra direttamente nella coda, anche con la rete staccata.
- *L'account è stato sospeso dall'admin* — L'accesso non riesce e resta il riquadro d'accesso con un messaggio d'errore (vedi UC-STAFF-003).
- *È il primo accesso del titolare di un locale appena attivato dalla regia* — Il suo account esiste già, admin e senza password: la imposta dal link dell'email e poi entra con «Entra», trovando le sezioni dell'admin.

- Bisogni: UR-007 (Ognuno fa quello che il suo ruolo consente)
- Requisiti: REQ-STAFF-001, REQ-UI-016, REQ-UI-017, REQ-UI-010, REQ-FLOTTA-030, REQ-FLOTTA-029
- Test e2e: da scrivere

<a id="uc-staff-002"></a>
### UC-STAFF-002 — Ognuno vede e fa solo quello che il suo ruolo consente

**Chi:** Admin, Bartender, Sala · **Si prova:** nel browser, con l'app e il backend (anche emulato, Functions comprese)

**Obiettivo.** Il titolare vuole che la sala serva e corregga i conti senza toccare il lavoro del banco, e che i conti del locale (bilancio, fornitori) li veda solo lui, anche se qualcuno prova a forzare l'indirizzo.

**Si parte da.** Cassa aperta, un conto in coda con una comanda «in preparazione» e una «pronta». Si entra a turno con gli account di sala, bartender e admin (UC-STAFF-001).

1. Come sala: il menu laterale ha «Coda ordini», «Da servire», «Stampante», «Ordina dal menù» e «Chiama il bancone»; non ci sono «Cassa», «Statistiche», «Magazzino», «Utenti e ruoli», «Impostazioni».
2. Come sala, nella coda, la comanda «pronta» si porta a «servito»; la comanda «in preparazione» non ha i tasti per portarla a «pronto» o per tornare indietro.
3. Come sala apre il conto e toglie con «−» una riga della comanda in preparazione: la riga sparisce e il totale scende subito.
4. Come sala aggiunge un drink al conto e conferma: nella coda compare una comanda nuova, separata da quelle che c'erano.
5. Come sala scrive a mano nell'indirizzo /bar?tab=impostazioni: si ritrova sulla coda ordini.
6. Come bartender: il menu laterale ha Coda ordini, Cassa, Statistiche, Menù, Magazzino, Staff, Utenti e ruoli, Impostazioni, ma non «Bilancio» né «Fornitori».
7. Come bartender scrive a mano /bar?tab=bilancio: si ritrova sulla coda, senza una pagina che dice «non puoi».
8. Come bartender apre «Utenti e ruoli»: vede l'elenco del personale con la scritta «I ruoli li assegna l’admin…», senza i tasti «Ruolo», sospendi ed elimina.
9. Come admin: nel menu laterale ci sono anche «Bilancio» e «Fornitori», e in «Utenti e ruoli» le sezioni «Utenze registrate», «Chi apre la cassa», «Nuovo account», «Buoni VIP».

**Esito.** Le sezioni del menu laterale e i tasti delle comande corrispondono al ruolo; un indirizzo scritto a mano non apre una sezione riservata; le correzioni fatte dalla sala si vedono subito sulla card in coda.

**Varianti**

- *La rete è staccata mentre la sala toglie una riga o porta una comanda a «servito»* — La card in coda cambia nell'istante del gesto; la sincronizzazione arriva dopo.
- *La sala prova a togliere una riga da una comanda già servita o annullata* — Il «−» resta spento: quello che è stato servito non si tocca.
- *La sala prova ad annullare il conto o dividere una comanda* — I tasti non ci sono: restano del banco.
- *Un cliente registrato o la sala provano, dalla console del browser, a scrivere un ordine non loro, a portare un conto ad «annullato» o a scrivere le paghe* — Il database rifiuta la scrittura (permesso negato); a schermo non cambia niente sugli altri terminali.

- Bisogni: UR-007 (Ognuno fa quello che il suo ruolo consente); UR-010 (Un conto si corregge anche dopo averlo mandato)
- Requisiti: REQ-STAFF-001, REQ-STAFF-008, REQ-STAFF-013, REQ-STAFF-014, REQ-STAFF-020, REQ-SIC-001, REQ-UI-015
- Test e2e: da scrivere

<a id="uc-staff-003"></a>
### UC-STAFF-003 — L'admin mette in regola il personale: nuovi account, ruoli, sospensioni

**Chi:** Admin · **Si prova:** nel browser, con l'app e il backend (anche emulato, Functions comprese)

**Obiettivo.** Il titolare dà accesso a un nuovo collaboratore col ruolo giusto, nomina chi si è registrato da sé, e toglie l'accesso a chi non lavora più nel locale, senza riga di comando.

**Si parte da.** Collegato come admin. Esistono un account bartender, un cliente registrato dal sito («Marco») e nessun account per la nuova cameriera. Si apre «Utenti e ruoli» dal menu laterale: la sezione aperta è «Utenze registrate», con «Personale (N)» e «Clienti registrati (N)».

1. Sceglie la sezione «Nuovo account»; compila «Nome» (Giulia), «Email», «Password (min 6 caratteri)», sceglie il ruolo «Staff» e legge sotto la sua descrizione.
2. Tocca «Crea account»: il tasto dice «Creo…», poi in «Utenze registrate» Giulia compare in «Personale» col ruolo Staff.
3. In «Clienti registrati» cerca «Marco» nella casella «Cerca per nome o email…» e tocca «Ruolo» sulla sua riga.
4. Nella finestra «Ruolo di Marco» sceglie «Bartender», legge «Il nuovo ruolo vale dal suo prossimo accesso.» e tocca «Assegna»: Marco passa in «Personale».
5. Tocca «Ruolo» sul bartender esistente e sceglie «Admin»: compare la conferma «Nominare admin …?» con «Un admin ha accesso completo e può cambiare i ruoli di tutti, incluso il tuo.»; tocca «Conferma».
6. Sulla riga di Giulia tocca il tasto di sospensione: conferma «Sospendere …?» («Non potrà più accedere. L’account e il suo storico restano…»). La riga mostra «sospeso».
7. Ritocca lo stesso tasto («Riattiva l’accesso») e conferma: «sospeso» sparisce.
8. Sulla riga di un account da togliere tocca «Elimina definitivamente»: conferma rossa «Eliminare …?» con «Operazione irreversibile…»; dopo «Conferma» la riga non c'è più.
9. Sulla propria riga, segnata «(tu)», non ci sono i tasti Ruolo, sospendi ed elimina.

**Esito.** Giulia entra col ruolo Staff, Marco col ruolo Bartender al suo accesso successivo, il nuovo admin vede le sezioni dell'admin; un account sospeso non entra finché non viene riattivato; un account eliminato non c'è più; nessuno può cambiare il ruolo a sé stesso.

**Varianti**

- *Giulia prova a entrare mentre è sospesa* — L'accesso non riesce; riattivata, entra con le stesse credenziali.
- *Marco era già collegato su un altro dispositivo quando gli è stato cambiato il ruolo* — Il gestionale prende il ruolo nuovo da sé, senza aspettare la scadenza della sessione (vedi dubbi: con quale ritardo).
- *Il piano è Free (un solo utente)* — La pagina dice «Nel piano Free l’app la usa solo il titolare. Per aggiungere lo staff passa a un piano a pagamento.» con «Vedi i piani» (UC-LIC-003).
- *La rete è staccata* — La creazione non riesce e la pagina mostra «Errore: …» sopra l'elenco; l'elenco già caricato resta.

- Bisogni: UR-007 (Ognuno fa quello che il suo ruolo consente)
- Requisiti: REQ-STAFF-003, REQ-STAFF-004, REQ-UI-015
- Test e2e: da scrivere

<a id="uc-staff-004"></a>
### UC-STAFF-004 — Sul tablet condiviso si sceglie chi apre la cassa, senza rifare il login

**Chi:** Admin · **Si prova:** nel browser, con l'app e il backend (anche emulato, Functions comprese)

**Obiettivo.** Il tablet del banco resta collegato con l'account di un solo titolare, ma la serata la apre e la firma chi c'è davvero (Flavio o Vittorio).

**Si parte da.** Due account admin attivi (Flavio e Vittorio) più l'account con cui il tablet è collegato (Flavio). Cassa chiusa. Collegati come Flavio.

1. In «Utenti e ruoli» → «Chi apre la cassa» c'è un blocco per ogni admin, «Col login di Flavio …», con le pastiglie degli admin; quella di Flavio è segnata «(sempre)» e non si spegne.
2. Nel blocco di Flavio spegne la pastiglia di un terzo admin (se presente) e lascia accesa quella di Vittorio.
3. Torna alla coda e tocca «Apri cassa»: nella finestra «Apri la cassa» compare «Chi apre la cassa?» con Flavio e Vittorio.
4. Sceglie Vittorio, scrive 50 in «Fondo cassa iniziale (€) — se ce n'è» e tocca «Apri cassa».
5. In cima alla barra il nome di chi è collegato diventa Vittorio; la serata risulta aperta da Vittorio.
6. Il giorno dopo, chiusa la cassa, riapre la cassa: la scelta proposta è già Vittorio.

**Esito.** La sessione di cassa risulta aperta dalla persona scelta e il suo nome sta in barra; l'account collegato non cambia e non serve nessuna password.

**Varianti**

- *C'è un solo admin* — La domanda «Chi apre la cassa?» non compare; in «Chi apre la cassa» si legge «C’è un solo account admin: all’apertura della cassa non c’è niente da scegliere…».
- *Nel blocco di un account non è spuntato nessuno* — All'apertura compaiono tutti gli admin attivi.
- *Un admin è stato sospeso o declassato* — Non compare più fra quelli da scegliere, anche sul tablet che lo ricordava.
- *Al tablet si collega un altro account* — La scelta della sera prima non si eredita: si sceglie di nuovo fra gli admin associati a quell'account.
- *La rete è staccata all'apertura della cassa* — L'elenco delle persone viene da quello ricordato sul tablet e la finestra non aspetta niente (vedi dubbi: primo avvio senza elenco ricordato).

- Bisogni: UR-005 (La cassa della serata torna al centesimo); UR-012 (Su un conto si vede chi ha battuto cosa)
- Requisiti: REQ-STAFF-016
- Previsti, non ancora fatti: REQ-STAFF-017, REQ-STAFF-018
- Test e2e: da scrivere

<a id="uc-staff-005"></a>
### UC-STAFF-005 — Si programmano i turni, si correggono le timbrature e si fissano le paghe orarie

**Chi:** Admin · **Si prova:** nel browser, con l'app e il backend (anche emulato, Functions comprese)

**Obiettivo.** Il titolare pianifica chi lavora, confronta le ore programmate con quelle effettive e ha il costo del personale calcolato con la tariffa in vigore quel giorno, senza fogli a parte.

**Si parte da.** Collegato come admin; due membri dello staff (Giulia e Marco), nessuna tariffa. Si apre «Staff» dal menu laterale: sezioni «Calendario», «Timbrature», «Nuovo turno», «Paghe orarie».

1. In «Paghe orarie» sceglie Giulia in «Chi», lascia «Da» a oggi, scrive 6,25 in «€/ora» e tocca «Salva tariffa»: la riga di Giulia dice «oggi 6,25 €/h»; Marco mostra «— nessuna tariffa».
2. In «Nuovo turno» sceglie «Programmato», Giulia in «Chi *», il giorno di sabato, «Entrata *» 20:00, «Uscita *» 02:00: il tasto dice «Aggiungi · 6 h (oltre mezzanotte)»; lo tocca.
3. Nel «Calendario» il sabato riporta il turno di Giulia con la pastiglia «prog.».
4. In «Timbrature» timbra l'entrata di Marco; poi in «Calendario» apre la sua voce «in corso» e con «Correggi timbratura» imposta l'«Uscita» e tocca «Salva».
5. Il giorno mostra le ore effettive accanto a quelle programmate («… h / … h prog.»).
6. Alza la tariffa di Giulia da una data futura: i turni già lavorati restano valorizzati alla tariffa di prima.

**Esito.** Turni programmati ed effettivi stanno nello stesso calendario, le timbrature si correggono a mano, e il costo del personale usa la tariffa valida in ogni giorno.

**Varianti**

- *Non ci sono membri dello staff* — In «Paghe orarie» si legge «Nessun membro dello staff: aggiungili nella scheda “Staff”, poi qui imposti la loro paga.»
- *Un bartender apre «Staff» e prova a salvare una tariffa* — Da stabilire (vedi dubbi): le paghe sono riservate all'admin nelle regole del database, ma la sezione «Paghe orarie» non è nascosta al bartender.
- *Il modulo «Personale e ore» non è incluso nella licenza* — La voce «Staff» non c'è nel menu laterale (UC-LIC-001).

- Requisiti: REQ-STAFF-006, REQ-UI-015
- Previsti, non ancora fatti: REQ-STAFF-015
- Test e2e: da scrivere

## Licenza e moduli

<a id="uc-lic-001"></a>
### UC-LIC-001 — Il titolare vede cosa comprende la licenza e accende i moduli inclusi

**Chi:** Admin · **Si prova:** nel browser, con l'app e il backend (anche emulato, Functions comprese)

**Obiettivo.** Il titolare vuole sapere che piano ha, fino a quando vale e quali funzioni ha comprato, e accendere o spegnere quelle incluse; quello che il locale non ha non deve comparire da nessuna parte.

**Si parte da.** Collegato come admin. La licenza del locale (scritta dalla regia, o dal seme del test) include «Magazzino e fornitori» e «Statistiche e bilancio», non include «Inventario di magazzino», «Fatture ai clienti» né «Menù digitale e tavoli»; valida fino a una data futura; stili del menù: nessuno.

1. Apre «Impostazioni» e sceglie il gruppo «Licenza»: nel riquadro «Licenza» legge Piano, «Stato: Attiva», «Validità: Valida fino al …», «Moduli premium inclusi: N su M», e il tasto «Gestisci la licenza».
2. Sotto, nel riquadro «Funzioni premium», «Magazzino e fornitori» ha l'interruttore acceso con «Funzione premium, inclusa in questa installazione.»
3. «Fatture ai clienti» ha l'interruttore spento e bloccato con «Funzione premium: non inclusa.» e il motivo «Funzione premium: fa parte della licenza dell’installazione e non si attiva da questa schermata.»
4. Spegne «Magazzino e fornitori»: la voce «Magazzino» sparisce dal menu laterale; la riaccende e torna.
5. Nel menu laterale non ci sono «Fatture» né «Vista cliente»; scrive a mano /bar?tab=fatture e si ritrova sulla coda.
6. Da un altro dispositivo, senza accesso, apre /menu: compare «Il menù digitale non è attivo» con «Questa funzione non fa parte del piano di questo locale.»

**Esito.** Il riepilogo della licenza è in sola lettura; un modulo lavora solo se è incluso e acceso; le voci, le pagine e gli indirizzi dei moduli che il locale non ha non si aprono per nessuno.

**Varianti**

- *Un modulo è incluso ma gli manca quello che richiede (l'inventario senza il magazzino)* — L'interruttore dice quale modulo manca e che «Si attiva quando è attivo anche quello.»
- *Il modulo è in prova* — Accanto si legge «In prova fino al …».
- *La licenza è quella scritta nell'installazione (la Tana), senza indirizzo della regia* — Non c'è il tasto «Gestisci la licenza»; il testo dice che si modifica «presso chi gestisce l’installazione».
- *La licenza nomina lo stile «Notte»* — Il riquadro mostra la riga «Stili del menù» e in «Menù clienti» lo stile Notte si può scegliere; senza, non compare e i disegni dei drink non si vedono: al loro posto la foto caricata o un bicchiere neutro.
- *Si accede come bartender* — Il gruppo «Licenza» mostra solo «Funzioni premium», senza il riquadro «Licenza».
- *Dalla console del browser si prova a scrivere nel magazzino di un locale che non ha il modulo* — Il database rifiuta la scrittura; i dati già presenti restano leggibili.

- Requisiti: REQ-LIC-001, REQ-LIC-002, REQ-LIC-007, REQ-LIC-008, REQ-LIC-010, REQ-LIC-013, REQ-LIC-015, REQ-UI-002
- Previsti, non ancora fatti: REQ-LIC-014
- Test e2e: da scrivere

<a id="uc-lic-002"></a>
### UC-LIC-002 — Il titolare prova, aggiunge o disdice un modulo dal Marketplace

**Chi:** Admin · **Si prova:** nel browser, con stampante o lettore SumUp sostituiti da un finto

**Obiettivo.** Il titolare allarga o restringe quello che l'app fa, al mese, senza uscire dall'app e senza chiedere a nessuno, e vede il modulo comparire appena la licenza cambia.

**Si parte da.** Collegato come admin su un locale con licenza della regia (con indirizzo della regia). La regia di prova risponde col listino e accetta le azioni; Stripe è sostituito da una pagina finta. «Inventario di magazzino» non è incluso, «Magazzino e fornitori» sì.

1. Dal menu laterale apre «Marketplace» e sceglie la sezione «Moduli»: una scheda per modulo con lo stato («Incluso», «Non incluso», «In prova fino al …») e il prezzo al mese.
2. Sulla scheda di un modulo non incluso con prova tocca «Prova gratis N giorni»: si legge «Prova di «…» attivata: il modulo compare fra pochi istanti.»; poco dopo lo stato diventa «In prova fino al …» e la voce compare nel menu laterale.
3. Su un altro modulo non incluso tocca «Aggiungi»: si apre la pagina di pagamento; al ritorno si legge «Pagamento ricevuto. Il modulo si attiva appena la regia aggiorna la licenza.»
4. Sulla scheda «Magazzino e fornitori» tocca «Disdici»: la conferma «Disdire «…»?» avvisa che resta attivo fino alla fine del periodo pagato e che si spegne anche «Inventario di magazzino», se c'è; tocca «Disdici».
5. Si legge «Disdetta registrata: «…» resta attivo fino al …».

**Esito.** Prove, acquisti e disdette partono dall'app e la licenza cambia dalla regia; l'app la vede cambiare da sola e accende o spegne le voci del modulo.

**Varianti**

- *Il modulo richiede una base che il locale non ha (l'inventario senza il magazzino)* — Sulla scheda non ci sono «Prova» e «Aggiungi», solo la frase «Richiede …».
- *Il piano è gestito a mano (pagato fuori da Stripe)* — «Aggiungi» non porta al pagamento: si legge «Richiesta di «…» inviata all'assistenza: il modulo si attiva alla conferma del pagamento.»
- *Il pagamento viene annullato sulla pagina di pagamento* — Al ritorno: «Pagamento annullato: nessun addebito e nessuna modifica alla licenza.»
- *La regia non risponde (rete staccata)* — Si legge «Il listino della regia non risponde: prezzi e prove sono quelli già noti a questo dispositivo.»; un'azione tentata dà «La regia non risponde. Verificare la connessione e riprovare.»
- *Si entra come bartender* — Le schede si vedono senza tasti, con «Moduli e abbonamenti li gestisce il titolare.»
- *La licenza è quella scritta nell'installazione (la Tana)* — Si legge «La licenza di questa installazione si gestisce presso chi la amministra: qui si consulta soltanto.» e non ci sono tasti.

- Requisiti: REQ-LIC-012, REQ-LIC-015
- Previsti, non ancora fatti: REQ-LIC-011
- Test e2e: da scrivere

<a id="uc-lic-003"></a>
### UC-LIC-003 — Un locale col piano Free lavora dentro i limiti del piano, e sa perché

**Chi:** Admin · **Si prova:** nel browser, con l'app e il backend (anche emulato, Functions comprese)

**Obiettivo.** Il titolare di un locale Free usa l'app per le cose di base e, quando incontra un limite, legge quale è e dove si passa a un piano a pagamento, senza errori incomprensibili.

**Si parte da.** Collegato come admin su un locale Free: la licenza ha piano «free» e i limiti prodotti_max 10, conti_aperti_max 5, sconti no, storico 7 giorni, utenti 1, marchio sì, e l'indirizzo della regia. Il menù ha già 10 prodotti; cassa aperta; il locale è pubblicato senza Functions né Storage.

1. In «Menù» il tasto «+ Aggiungi prodotto» è spento e si legge «Nel piano Free il menù ha al massimo 10 prodotti. Per aggiungerne passa a un piano a pagamento.» con «Vedi i piani».
2. Si aprono cinque conti; al sesto «Nuovo ordine» si legge «Nel piano Free puoi avere al massimo 5 conti aperti insieme.»
3. Su un conto aperto, nella schermata di pagamento, non c'è il tasto dello sconto né SumUp: ci sono «Contante» e «Carta di Credito». Il conto si incassa in contanti.
4. Lo scontrino d'esempio e il menù digitale finiscono con «Creato con …» (il nome del prodotto).
5. Nello storico ordini e nelle chiusure di cassa compaiono solo gli ultimi 7 giorni (più i conti ancora aperti).
6. In «Utenti e ruoli» si legge «Nel piano Free l’app la usa solo il titolare. Per aggiungere lo staff passa a un piano a pagamento.»
7. In «Impostazioni» → «Licenza» il riquadro «Licenza» elenca i «Limiti del piano» in chiaro.

**Esito.** Ogni limite si fa rispettare dove lo si incontra e lo dice con una frase piana e il collegamento «Vedi i piani»; quello che c'è già (prodotti, conti, uno sconto già sul conto) resta e si modifica.

**Varianti**

- *Sul conto c'era già uno sconto prima del passaggio a Free* — Il tasto dello sconto resta visibile, per poterlo togliere.
- *La licenza del Free scrive anche `comande: false`* — La cassa è semplice: niente stati del servizio né coda di preparazione, i conti aperti si vedono come elenco da incassare e all'incasso tutto risulta servito. In «Impostazioni» → «Servizio», al posto della preparazione, si legge «Nel piano Free la cassa è semplice: …» con «Vedi i piani».
- *La licenza del Free scrive anche `stampa: false` (dal 12/11/2026)* — Dalla stampante non esce niente e non c'è nessun tasto di stampa; in «Impostazioni» → «Stampante» si legge «La stampa di comande e scontrini è dei piani a pagamento.» con «Vedi i piani». Il conto si incassa e la cassa si chiude come sempre.
- *Si crea un prodotto con la foto* — La scheda dice «Le foto dei prodotti sono dei piani a pagamento.» e non offre il caricamento.
- *La licenza non scrive limiti (un piano a pagamento, la Tana)* — Nessuno dei limiti vale: menù, conti, sconti, storico e utenti come sempre.
- *La rete è staccata* — I limiti valgono lo stesso: si leggono dalla licenza già in memoria.

- Requisiti: REQ-LIC-003, REQ-LIC-004, REQ-LIC-005, REQ-LIC-007, REQ-LIC-016
- Previsti, non ancora fatti: REQ-LIC-006
- Test e2e: da scrivere

<a id="uc-lic-004"></a>
### UC-LIC-004 — Il locale fermo per la licenza lo dice, e i dati restano

**Chi:** Admin, Bartender, Sala · **Si prova:** nel browser, con l'app e il backend (anche emulato, Functions comprese)

**Obiettivo.** Quando l'abbonamento non è in regola chi apre l'app deve capire che non è un guasto, che i dati non sono persi e cosa fare; il titolare deve sapere con anticipo se e quando i dati verranno cancellati.

**Si parte da.** Un locale con cassa e conti dei giorni prima. La licenza viene portata, dal seme del test, a «sospesa» con un motivo e una data.

1. Aprendo l'app, al posto di tutto compare «Installazione sospesa»: «L’app di <nome del locale> è sospesa dal … . Motivo: … .», «Non è un guasto e i dati non sono andati persi.» e «Vai alla pagina del prodotto».
2. Dalla console del browser una scrittura su un ordine viene rifiutata dal database.
3. La licenza torna «attiva»: l'app si riapre da sola sulla coda, con i conti di prima.
4. Alla licenza si aggiunge una cancellazione programmata: su ogni schermata di chi lavora compare in cima «I dati del locale verranno cancellati il …» con cosa fare e «Vai all’area clienti»; l'avviso non si chiude.

**Esito.** Sospesa, chiusa, scaduta o non attivata, l'app si ferma con una schermata che spiega lo stato; le letture restano possibili e niente viene cancellato dalla sospensione; l'avviso della cancellazione resta in vista finché la regia non lo toglie.

**Varianti**

- *La licenza è scaduta (valida fino a ieri) e alla scadenza «ferma»* — Compare «Licenza scaduta» con la data, anche con la rete staccata.
- *La licenza è scaduta e alla scadenza «free»* — L'app non si ferma: valgono i limiti del piano Free (UC-LIC-003).
- *La licenza non c'è* — Compare «Installazione non attivata»; appena la licenza arriva, l'app si apre da sola.
- *La licenza è «chiusa»* — Compare «Installazione chiusa» con «I dati restano consultabili fino alla loro cancellazione.»
- *A guardare è un cliente sul menù* — L'avviso della cancellazione non gli compare.

- Requisiti: REQ-FLOTTA-008, REQ-LIC-009, REQ-FLOTTA-026
- Test e2e: da scrivere

<a id="uc-lic-005"></a>
### UC-LIC-005 — Il titolare legge le novità di una versione e sceglie se aggiornare

**Chi:** Admin · **Si prova:** nel browser, con stampante o lettore SumUp sostituiti da un finto

**Obiettivo.** Il titolare non vuole trovarsi una versione nuova al banco senza saperlo: legge prima cosa cambia e decide se aggiornare adesso, rimandare o saltare quella versione.

**Si parte da.** Collegato come admin. La licenza dice «aggiornamenti a scelta» e propone una versione più nuova con le sue note; la regia di prova accetta la scelta.

1. All'apertura compare la finestra «Versione X disponibile» con «Prima di aggiornare, ecco cosa cambia:» e le note.
2. Tocca «Più tardi»: la finestra si chiude e torna alla prossima apertura dell'app.
3. Alla riapertura tocca «Salta questa versione»: la finestra si chiude; in «Impostazioni» → «Sistema» → «Informazioni», sotto «Aggiornamenti», resta «Disponibile la versione X» col suo «Aggiorna».
4. Da lì tocca «Aggiorna»: compare «Versione X» col messaggio che l'aggiornamento è partito, e «Chiudi».

**Esito.** La scelta arriva alla regia senza far aspettare chi la fa; la proposta saltata resta recuperabile da Informazioni.

**Varianti**

- *La regia pubblica un avviso sulle condizioni del servizio* — Prima della proposta compare «Condizioni del servizio» col testo, «In vigore dal …» e «Ho letto»; esce una volta sola e resta in campanella.
- *La modalità è «obbligatori», o la licenza non ne parla* — Nessuna finestra: l'app si aggiorna come sempre.
- *Si entra come bartender o sala* — La finestra non compare.
- *La licenza non dice dove mandare la scelta* — Nella finestra non ci sono «Aggiorna» e «Salta»: c'è il rimando «Apri l’area clienti».
- *La regia non risponde* — Sotto i tasti compare il messaggio d'errore della scelta; la proposta resta.
- *Il locale è fermo per la licenza* — La finestra non compare sopra la schermata del locale fermo.

- Bisogni: UR-011 (Quello che funzionava ieri funziona anche stasera)
- Requisiti: REQ-FLOTTA-020
- Test e2e: da scrivere

<a id="uc-lic-006"></a>
### UC-LIC-006 — Il titolare passa dall'area clienti della regia all'app, e ritorno, senza rifare l'accesso

**Chi:** Admin · **Si prova:** nel browser, con stampante o lettore SumUp sostituiti da un finto

**Obiettivo.** Il titolare gestisce abbonamento e locale da due posti (area clienti della regia e app del locale) e vuole saltare dall'uno all'altro con un tocco, già riconosciuto.

**Si parte da.** Il titolare ha nel locale un account admin con la stessa email (verificata) dell'area clienti. La licenza porta l'indirizzo della regia; la regia di prova emette il codice di passaggio.

1. Si apre l'app con l'indirizzo che porta il codice di passaggio della regia: l'app entra da sola col suo account e il codice sparisce dall'indirizzo.
2. Nel menu laterale tocca «Area clienti»: la voce dice «Apro l’area clienti…» e si apre la pagina della regia, già entrati.

**Esito.** Il passaggio non chiede password in nessuna delle due direzioni e il codice non resta nell'indirizzo, né si riusa.

**Varianti**

- *Il codice è scaduto o già usato* — Si arriva al riquadro «Accesso staff» con una riga che dice perché, sopra il modulo.
- *La regia non risponde a «Area clienti»* — Si resta nell'app con un messaggio d'errore in una riga.
- *Si è collegati come bartender* — La voce «Area clienti» non c'è.
- *Il titolare vuole correggere telefono, partita IVA, codice fiscale o sede legale scritti dalla regia* — Da stabilire (vedi dubbi): il riquadro «Il locale» che li contiene non compare in nessun gruppo delle Impostazioni.

- Requisiti: REQ-FLOTTA-030
- Test e2e: da scrivere

## Le impostazioni

<a id="uc-imp-001"></a>
### UC-IMP-001 — Si sceglie l'aspetto del gestionale: tema, icone, card della coda, aiuti sotto i campi

**Chi:** Admin, Bartender · **Si prova:** nel browser, con l'app e il backend (anche emulato, Functions comprese)

**Obiettivo.** Chi lavora tutto il giorno sul gestionale lo vuole leggibile e sobrio: un tema chiaro o scuro, icone monocrome, card riconoscibili, e schede senza righe d'aiuto ripetute ogni giorno.

**Si parte da.** Collegato come admin, da tablet o PC. Si apre «Impostazioni» e si sceglie il gruppo «Aspetto»: riquadro «Aspetto» con «Gestionale — quello che vedi ora», «Le card della coda», «Le icone del gestionale», «Aiuti sotto i campi».

1. Dalla tendina del tema sceglie «☀️ Chiaro»: tutta la pagina cambia colori subito, tasti e angoli compresi.
2. Sceglie «🔷 Pico scuro»: cambiano anche le forme (angoli, tasti, ombre), non solo i colori.
3. Tocca «Personalizza colori», cambia «Colore accento» e tocca «Salva tema»: accanto al titolo compare «· personalizzato»; «↩︎ Ripristina preset» lo riporta al tema scelto.
4. In «Le icone del gestionale», per «Navigazione» sceglie «Emoji»: le icone del menu laterale tornano emoji colorate; per «Tasti e stati» lascia «Silhouette».
5. In «Le card della coda» sceglie «Il colore del conto»: nella coda la striscia a sinistra delle card porta il colore del conto invece dello stato.
6. Apre la scheda di un drink in «Menù»: fra un campo e l'altro non ci sono righe d'aiuto; gli avvisi su un dato mancante si vedono lo stesso.
7. Torna in «Aspetto» → «Aiuti sotto i campi» e sceglie «Visibili»: riaprendo la scheda del drink, e quella di un prodotto di magazzino, le righe d'aiuto ci sono, in frasi impersonali nel registro del mestiere.

**Esito.** Le scelte valgono per tutti i terminali del locale e arrivano agli altri dispositivi senza ricaricare; il menù dei clienti non cambia, perché ha il suo tema in «Menù clienti».

**Varianti**

- *Il tablet del banco è collegato con un altro account* — Vede lo stesso tema: oggi l'aspetto è del locale, non della persona.
- *La rete è staccata mentre si cambia tema* — Il tema cambia subito su questo dispositivo; gli altri lo ricevono quando la rete torna.
- *Si sceglie un tema scuro e uno chiaro con lo stesso conto colorato in coda* — Le card colorate e i colori degli stati restano leggibili su entrambi.

- Bisogni: UR-013 (Il gestionale si legge e si compila senza fatica)
- Requisiti: REQ-UI-002, REQ-UI-005, REQ-UI-019, REQ-UI-031, REQ-UI-032, REQ-UI-026, REQ-UI-020
- Previsti, non ancora fatti: REQ-UI-024, REQ-UI-027, REQ-STAFF-017
- Test e2e: da scrivere

<a id="uc-imp-002"></a>
### UC-IMP-002 — Si regola come la coda ordini mostra e cerca i conti

**Chi:** Admin, Bartender · **Si prova:** nel browser, con l'app e il backend (anche emulato, Functions comprese)

**Obiettivo.** Il titolare adatta la coda al modo di lavorare del locale: la vista, i conti colorati per riconoscere le comande dello stesso tavolo, e cosa fa la ricerca.

**Si parte da.** Collegato come admin, cassa aperta, tre conti in coda di cui uno con due comande in colonne diverse. «Impostazioni» → gruppo «Banco: coda e ordine», riquadro «Coda ordini».

1. Sceglie «Corsie di stato»: la coda mostra una colonna per passo del lavoro.
2. In «Il colore del conto» accende «Ogni conto nuovo nasce col suo colore»; batte un conto nuovo: la card del conto e le card delle sue comande hanno lo stesso colore.
3. In «La ricerca» sceglie «Accendi il conto e portami lì»; nella coda cerca il numero di un conto: la coda resta intera, scorre fino al conto e lo segna con un anello.
4. Tocca un conto qualsiasi: la ricerca si azzera.
5. Torna in «La ricerca» e sceglie «Filtra la coda»: la stessa ricerca lascia in pagina solo il conto che risponde.

**Esito.** La coda segue le scelte fatte, su tutti i terminali; un conto colorato lo resta anche se si cambia la tavolozza.

**Varianti**

- *La ricerca non trova niente* — La coda lo dice, invece di restare immobile; se il conto c'è ma sta in un'altra scheda, dice anche quello.
- *I conti automatici colorati sono spenti* — Il colore si dà lo stesso a mano dal «⋯ Azioni» della card, anche ai conti già aperti.
- *Gli stati del servizio sono spenti* — In «La vista del banco» la scelta «Corsie di stato» è spenta e il testo dice perché.

- Bisogni: UR-004 (La comanda arriva a chi deve preparare)
- Requisiti: REQ-UI-009, REQ-UI-020
- Test e2e: da scrivere

<a id="uc-imp-003"></a>
### UC-IMP-003 — Si fissano l'orario della giornata e la stampa automatica di ogni terminale

**Chi:** Admin · **Si prova:** nel browser, con stampante o lettore SumUp sostituiti da un finto

**Obiettivo.** Il titolare dice all'app quando lavora il locale e dove finisce una serata, e decide quale terminale stampa da sé comande e scontrini.

**Si parte da.** Collegato come admin dal tablet del banco. «Impostazioni» → gruppo «Cassa e giornata»: riquadri «Pagamenti», «Stampa automatica», «Giornata di lavoro». Una stampante finta risponde all'indirizzo configurato.

1. In «Giornata di lavoro» imposta «Apertura» 19:00, «Chiusura» 03:00 e «Cambio di giornata (ora)» 5.
2. Prova a mettere il cambio di giornata a 23: compare l'avviso «Il cambio di giornata cade dentro l’orario di apertura: una serata verrebbe divisa su due giornate.»; lo riporta a 5.
3. In «Stampa automatica» → «Su questo terminale» accende «Stampa la comanda all’arrivo dell’ordine» e, sotto «Comande prese», sceglie da dove.
4. Accende «Stampa lo scontrino alla riscossione del conto».
5. In «Comande prese in sala» sceglie «La stampa il banco».
6. Dal telefono della sala si batte un conto e si manda la comanda: la comanda esce dalla stampante del banco una volta sola.

**Esito.** Le scelte «Su questo terminale» valgono solo per il tablet del banco, quelle «Per tutto il locale» per tutti; i conti battuti dopo mezzanotte restano nella stessa giornata.

**Varianti**

- *Si sceglie «La stampa il banco» con la stampa automatica della comanda spenta* — Compare l'avviso «La stampa automatica della comanda è spenta: così le comande della sala non le stampa nessuno.»
- *La comanda automatica è impostata solo dal banco con «La stampa il banco»* — Compare l'avviso «La comanda automatica è impostata solo dal banco: così le comande della sala non le stampa nessuno.»
- *È acceso «Lo scontrino d’acconto a ogni riscossione»* — «Un tasto per l’acconto con lo scontrino» resta in pagina, spento, col motivo.
- *Si apre lo stesso gruppo dal telefono della sala* — La stampa automatica del telefono è spenta finché non la si accende lì.

- Bisogni: UR-004 (La comanda arriva a chi deve preparare); UR-005 (La cassa della serata torna al centesimo)
- Requisiti: REQ-UI-025, REQ-UI-002
- Test e2e: da scrivere

<a id="uc-imp-004"></a>
### UC-IMP-004 — Si prepara il terminale per la serata: zoom, schermo intero, menu laterale

**Chi:** Bartender, Admin, Sala · **Si prova:** nel browser, con l'app e il backend (anche emulato, Functions comprese)

**Obiettivo.** Chi sta ore davanti al tablet del banco o al PC lo regola una volta per leggere bene e avere tutto a portata, e trova la regolazione uguale il giorno dopo.

**Si parte da.** Collegato come bartender sul tablet del banco (larghezza da 768px in su), dal browser, app non installata; la coda ordini è aperta.

1. Nella coda tocca «Ingrandisci» due volte: la pagina si ingrandisce senza deformarsi; «Torna al 100%» la riporta.
2. Apre «Impostazioni»: i tasti dello zoom non ci sono, ma il livello scelto resta.
3. Tocca il tasto ⛶ («Schermo intero»): le barre del browser spariscono; ritoccandolo («Esci da schermo intero») tornano.
4. In «Impostazioni» apre il menu laterale col ☰: da tablet resta aperto come colonna e il contenuto si stringe; tirandone il bordo si allarga. Lo chiude col ☰.
5. In «Magazzino» stringe la barra delle sezioni («Nascondi le sezioni»): resta il tasto «Mostra le sezioni» per rimetterla.
6. Il giorno dopo, riaprendo, menu laterale e barra delle sezioni sono come li aveva lasciati.

**Esito.** Ogni terminale tiene le sue regolazioni; nella barra in alto ci sono sempre, a sinistra il ☰ o la freccia indietro, al centro il titolo della pagina e della sezione, a destra campanella e azioni.

**Varianti**

- *Lo stesso giro si fa sul telefono* — In barra restano ☰, titolo, campanella e ⋮; «Schermo intero» ed «Esci» stanno nel menu ⋮; i tasti dello zoom stanno nella testata del conto; il menu laterale è sempre a scomparsa.
- *Lo spazio in barra manca* — Spariscono prima il nome del locale, poi l'indietro, poi il logo; il titolo si accorcia coi puntini ma resta.
- *L'app è installata sul telefono* — Il tasto ⛶ non compare; l'app installata porta il nome col ruolo di chi l'ha installata.
- *Un pannello è aperto (il foglio dei ⋯, una conferma)* — I tasti dello zoom stanno dietro e non si toccano per sbaglio.

- Bisogni: UR-013 (Il gestionale si legge e si compila senza fatica)
- Requisiti: REQ-UI-004, REQ-UI-008, REQ-UI-012, REQ-UI-014, REQ-UI-003, REQ-UI-006, REQ-UI-011, REQ-UI-001, REQ-UI-010
- Test e2e: da scrivere

## Requisiti fatti che nessun caso d'uso racconta

Meccanismi interni o comportamenti che aspettano il loro caso d'uso.

- REQ-ORD-002 — Gli ordini vecchi continuano a funzionare
- REQ-UI-018 — Le righe del conto si riordinano come le card della griglia
- REQ-MAG-018 — I prodotti che ci sono già si travasano al modello nuovo aggiornando l'app, non li riapre uno per uno chi sta al banco
- REQ-MENU-028 — Il contratto degli stili strutturati: ogni stile che disegna il menù a modo suo riceve lo stesso pacchetto e promette le stesse cose
- REQ-STAFF-002 — I confronti sui ruoli si fanno in un posto solo
- REQ-STAFF-005 — Registrazione cliente e account personali
- REQ-CLI-007 — Gli ordini del cliente stanno in «I miei ordini», non in mezzo al menù
- REQ-STAMPA-009 — In locale la stampante è di carta finta
- REQ-DATI-002 — Travaso e ripristino da riga di comando
- REQ-SIC-002 — App Check protegge la produzione senza chiudere fuori il locale
- REQ-SIC-004 — Caratteri e script dallo stesso indirizzo dell'app: niente richieste a terzi senza consenso
- REQ-MENU-033 — Il ricarico del prezzo consigliato si imposta anche come drink cost
- REQ-MENU-036 — Dal menù dei clienti si crea un prodotto della cassa che non c'è, e diventa subito una voce della sezione
- REQ-MENU-039 — La foto di un prodotto si ritaglia nella sua scheda prima di caricarla: tutte nella stessa cornice quadrata
- REQ-MENU-038 — Il formato dei prezzi nel menù dei clienti si sceglie: di partenza il numero, senza simbolo dell'euro e senza decimali inutili
- REQ-MENU-037 — Le sezioni di soli Special stanno fuori dal menù, e si aprono dal carosello e dal QR: è la stessa carta
- REQ-MENU-035 — L'editor del menù dei clienti è compatto: sezioni che si aprono, una riga per voce, voci spostate insieme
- REQ-MENU-034 — Ogni riga della ricetta mostra quanto costa
- REQ-LIC-017 — Nel Free non c'è l'AI: niente tasti AI, chat né credito
- REQ-VENUE-004 — Test-guardia anti-marchio: le parole della Tana in src/ e functions/ stanno in una whitelist che puo' solo accorciarsi
- REQ-VENUE-005 — Spazi tecnici neutri: chiavi locali, cache del service worker, nome del pacchetto e descrizioni dei pagamenti senza «tana», e nessuno perde niente
- REQ-FLOTTA-001 — La CI di tana-drink pubblica solo i progetti della Tana, compilati per la Tana; e compila anche il cliente demo
- REQ-VENUE-006 — La cartella di un cliente nuovo in un comando: genera-cliente.mjs --slug --nome
- REQ-FLOTTA-019 — La demo pubblica: dati di prova nella build, niente database, la sessione nel browser
- REQ-UI-007 — La testata della coda sta su una riga sola
- REQ-DEV-001 — I requisiti restano attaccati ai test
- REQ-DEV-002 — Si sa sempre quale versione si sta guardando
- REQ-DEV-003 — Changelog delle versioni, leggibile anche dall'app
- REQ-DEV-004 — Il cancello di qualità prima del merge in develop
- REQ-DEV-006 — Le due lavagne a corsie sono lo stesso componente scritto due volte
- REQ-DEV-007 — La coda ricalcola tutte e tre le viste a ogni disegno, e ne mostra una
- REQ-DEV-008 — Scritture che rileggono l'ordine per un valore che nessuno guarda
- REQ-DEV-009 — Quattro copie del ricalcolo del totale di un conto
- REQ-DEV-010 — Metà di «corsie di stato» non la chiama più nessuno
- REQ-DEV-011 — Ripetizioni che si tolgono in mezz'ora, tutte insieme
- REQ-DEV-012 — docs/system_specifications.md e' la specifica di sistema, e si genera
- REQ-UI-021 — Tre nomi per lo stesso passo del servizio
- REQ-ORD-024 — Il «+» e il «−» di una riga li usa solo chi l'ha caricata, se l'iniziale è accesa
- REQ-UI-022 — Le categorie senza macro si vedono a colpo d'occhio, in magazzino e nel menù
- REQ-DEV-013 — Una voce scartata si chiude dicendo che non la faremo, e resta scritta
- REQ-UI-023 — La card della comanda si legge da lontano: numero e nome grandi, meno righe
- REQ-DEV-014 — La stampa simulata si accende anche sul sito di test, dalla sezione Dev
- REQ-DEV-015 — Le regole Firestore hanno delle prove, e ogni prova è doppia
- REQ-UI-028 — Sconto e ricetta in finestre più larghe, e la ricetta si apre senza tastiera
- REQ-UI-029 — Bilancio: cosa misura ogni tabella, in una spiegazione a scomparsa in cima
- REQ-MENU-015 — Il ghiaccio nelle ricette: 1,6 volte la dose scritta in origine
- REQ-MAG-054 — Un ingrediente nuovo in ricetta parte in millilitri
- REQ-STAMPA-019 — La stampante lascia un diario sul server: una serata, un documento
- REQ-DEV-016 — Quello che dice quali pezzi caricare non si tiene in cache
- REQ-DEV-017 — La matrice dei moduli: ogni modulo premium provato da solo, in coppia con ogni altro, tutti e nessuno
- REQ-DEV-020 — La squadra di Stonebit: una sezione in CLAUDE.md, AGENTS.md e i sub-agenti (ruoli SUPERATI da REQ-DEV-022)
- REQ-DEV-021 — La sezione Stonebit e gli agenti corretti: dove contraddicono il repo valgono le regole del repo, e il processo è storia, revisore, squadra solo per i lavori grossi
- REQ-DEV-022 — I ruoli: la sessione sul repo è il tech lead e lavora come sempre, il PM è un controllo sui requisiti, e l'agente tech-lead si toglie
- REQ-DEV-023 — Il merge in develop aspetta anche le regole Firestore e i test di sistema; il revisore si chiama quando serve
