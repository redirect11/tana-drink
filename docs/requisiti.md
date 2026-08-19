# Cosa fa Tana Drink

> Generato da `requirements/requirements.yaml` con
> `node scripts/requisiti.mjs --documento`. Non si modifica a mano:
> si modifica il file dei requisiti.

Alla data di generazione: **172 requisiti**.

| | Quanti | Cosa vuol dire |
|---|---|---|
| ✅ | 130 | fatto e coperto dai test |
| ⚠️  | 16 | fatto ma nessun test lo verifica |
| ⬜ | 26 | da fare |

Un requisito può essere dimostrato da più test; un test appartiene a
un requisito. Il legame è verificato da `tests/unit/requisiti.test.js`:
se qualcuno aggiunge un test senza requisito, la suite fallisce.

## Ordini e comande

### ✅ REQ-ORD-001 — Un conto aperto contiene più comande, ciascuna col suo stato

Un ordine è un CONTO che resta aperto (aperto/pagato/annullato) e contiene una o più comande. La lavorazione (ricevuto, in preparazione, pronto, ritirato) vive sulla singola comanda: un tavolo può avere un giro già servito e uno ancora al banco. La comanda attiva è quella al passo più indietro; a parità di passo vince la più vecchia.

*Dove*: `src/lib/comande.js, src/lib/api.js`

*Lo dimostrano*: `tests/unit/comande.test.js`, `tests/unit/orderStatus.test.js`, `tests/unit/orderLines.test.js`

### ✅ REQ-ORD-002 — Gli ordini vecchi continuano a funzionare

Gli ordini scritti prima del modello a comande hanno solo `items` e uno stato di lavorazione sul conto: vengono normalizzati al volo in un conto con una comanda sintetica che porta quello stato. Nessuna migrazione dei dati, e lo storico resta leggibile e calcolabile come il resto.

*Dove*: `src/lib/comande.js normalizeOrderDoc`

*Lo dimostrano*: `tests/unit/comande.test.js`

### ✅ REQ-ORD-003 — Aggiungere a un conto non riapre quello che è già stato servito

Gli aumenti confluiscono nella comanda ancora modificabile (ricevuta o in preparazione); se non ce n'è, nasce una comanda nuova. Le diminuzioni scalano solo da comande modificabili: quello che è già pronto o servito non si tocca, perché il drink è stato fatto davvero.

*Dove*: `src/lib/comande.js, src/components/OrderPosDetail.jsx`

*Lo dimostrano*: `tests/unit/comande.test.js`, `tests/component/OrderPosDetail.test.jsx`

### ✅ REQ-ORD-004 — Un conto rimasto senza righe si annulla da solo

Togliendo tutte le righe di un conto appena aperto, il conto viene annullato e si torna alla coda: un conto vuoto in lista è solo un ingombro. Non succede se qualcosa è già stato incassato — lì il conto esiste davvero e va chiuso a mano.

*Dove*: `src/components/OrderPosDetail.jsx`

*Lo dimostrano*: `tests/component/OrderPosDetail.test.jsx`

### ✅ REQ-ORD-005 — Annullando un conto le scorte tornano a magazzino

L'annullo rimette in magazzino quello che le comande avevano scalato, usando lo snapshot di consumo salvato al momento dello scarico e non ricalcolando la ricetta, che intanto può essere cambiata. Fa eccezione l'annullo per "non ritirato": lì il drink è stato preparato e il prodotto è consumato.

*Dove*: `src/lib/api.js cancelOrder`

*Lo dimostrano*: `tests/unit/warehouse.test.js`

### ✅ REQ-ORD-006 — Chiudendo un conto sparisce subito dalla coda

Chiudendo o annullando si torna alla lista ordini, dove quel conto non deve più comparire: la scrittura viaggia in sottofondo e la coda avrebbe ancora la versione di prima — lo si vedeva lì, e lo si guardava sparire. I conti chiusi da questo dispositivo escono subito dalla lista; se la scrittura fallisce ricompaiono, e la memoria scade da sé dopo un minuto.

*Dove*: `src/lib/ordiniNascosti.js, src/components/OrderPosDetail.jsx`

*Lo dimostrano*: `tests/unit/ordiniNascosti.test.js`, `tests/component/OrderPosDetail.test.jsx`

### ✅ REQ-ORD-007 — La coda distingue aperti e chiusi, e ignora gli annullati

La coda smista i conti per stato, conta e somma solo i non annullati e sa dire quanti conti sono ancora aperti. Con la gestione della preparazione attiva un conto pagato ma non servito resta da fare; senza, il pagamento chiude e basta — e nella schermata di pagamento non compare l'avviso «comande non ancora servite», che senza preparazione non vuol dire niente e uscirebbe a ogni incasso. E la coda è il lavoro di ADESSO: un conto incassato o annullato prima dell'ultima chiusura di cassa non compare, in nessuna tab — chiusi, annullati o tutti — perché quei conti sono già stati contati e rendicontati; stanno in Cassa, nella lista ordini. Non basta guardare la giornata: in una serata la cassa si chiude e si riapre. I conti APERTI restano sempre, cassa chiusa compresa: quelli sono da chiudere, e nasconderli vorrebbe dire perderli. Chiudendo o annullando un conto si scrive in QUALE cassa è successo, e la coda tiene d'occhio anche quelli: senza, un conto aperto giorni prima e annullato stasera usciva dall'elenco dei conti aperti, non entrava in quello di oggi — che guarda la data di apertura — e spariva dallo schermo nell'istante in cui lo si annullava. Vale anche per il rendiconto di cassa: un tavolo aperto ieri e incassato stasera è incasso di stasera. Conta QUANDO è stato chiuso, non quando è stato aperto: un conto di ieri rimasto aperto e annullato stasera è successo stasera, e guardando la sessione in cui era nato spariva dalla tab «annullati» nell'istante in cui lo si annullava — si agisce su un conto e quello svanisce, senza sapere se l'operazione è andata a buon fine. Il riepilogo in testata NON cambia cambiando tab: è cumulativo — aperti, chiusi e annullati di questa apertura — e si calcola sugli ordini grezzi, non su quelli che la tab sta mostrando. «In corso» nasconde i conti appena chiusi da qui e le altre tab no: il numero ballava solo perché si toccava un filtro. Il riepilogo in testata è di questa apertura di cassa — a cassa chiusa sono zeri — e accanto ad aperti e chiusi dice quanti conti sono stati ANNULLATI, che non fanno cassa ma sono un dato del banco. Chi la cassa non la apre mai continua a vedere la giornata: è l'unico riferimento che ha.

*Dove*: `src/lib/coda.js`

*Lo dimostrano*: `tests/unit/coda.test.js`, `tests/unit/codaCache.test.js`, `tests/unit/cashSessionHook.test.js`, `tests/component/PaymentScreen.test.jsx`

### ✅ REQ-ORD-014 — Riscuoti, oppure riscuoti e servi in un colpo solo

Con gli stati del servizio, incassare non chiude il conto: si paga anche in anticipo e restano drink da fare, e marcare tutto «servito» farebbe sparire dalla coda lavoro ancora da fare. Il conto si riscuote sempre, si chiude solo quando è servito. Al banco però capita spessissimo il contrario — si consegna e si incassa nello stesso gesto — e lì due passaggi sono uno di troppo: il locale può accendere «Un tasto per incassare e servire insieme» (Impostazioni → Gestione preparazione). Acceso, nella schermata di pagamento compare anche «Riscuoti e servi», che chiude il conto in un colpo. Spento di default: chi segue il servizio di solito lo segue apposta. Il tasto non compare dove non serve — servizio spento, conto già servito o già chiuso.

*Dove*: `src/components/PaymentScreen.jsx, src/lib/api.js`

*Lo dimostrano*: `tests/component/PaymentScreen.test.jsx`, `tests/unit/pagamentoNonServe.test.js`

### ✅ REQ-ORD-019 — Chi ha preso l'ordine lo modifica davvero: anche aggiungendo

Nel dettaglio di un ordine, la sala poteva solo cambiare le QUANTITÀ di quello che c'era già: chi aveva preso l'ordine e si sentiva dire «aggiungi anche una birra» doveva battere un secondo conto. «Modifica ordine · aggiungi prodotti» apre la schermata del conto: la stessa del banco, quella vera, con la griglia dei prodotti. Niente versione ridotta — chi prende un ordine al tavolo ci fa le stesse cose, e un tasto spento in una schermata e acceso nell'altra è solo una cosa che non si capisce. Aprire e chiudere la CASSA resta invece del banco (REQ-CASSA-008): quella è la serata, non il conto. «Salva modifiche» resta dov'è: correggere una quantità e aggiungere un drink sono due gesti diversi, e chi fa il primo non deve passare per una schermata intera. E c'è «Pagamento», che apre la stessa schermata già sul pagamento: al tavolo si incassa lì, e senza quel tasto bisognava tornare in coda, riaprire il conto dal banco e incassare da lì — col cliente che aspetta col portafogli in mano. Su un conto già saldato o annullato non compare. Al cliente niente di tutto questo: dal suo telefono modifica le quantità del proprio ordine finché è ricevuto, e basta.

*Dove*: `src/pages/OrderStatusPage.jsx, src/components/OrderPosDetail.jsx`

*Lo dimostrano*: `tests/component/OrderStatusPage.test.jsx`

### ✅ REQ-ORD-018 — Salvare le modifiche a un ordine lo dice, e riporta indietro

Nel dettaglio ordine della vista staff, «Salva modifiche» tornava «Salva modifiche» e basta: identico a prima di premerlo. Chi aveva cambiato una quantità restava lì a chiedersi se fosse andata, e spesso ripremeva. Ora la conferma si vede e si torna alla coda — da dove si è arrivati, e dove il conto si rilegge aggiornato. In errore invece si resta, e il motivo si dice anche col toast: l'avviso in fondo alla pagina, su un conto lungo, sta fuori schermo — chi ha premuto vede il tasto tornare com'era e crede che non sia successo niente.

*Dove*: `src/pages/OrderStatusPage.jsx`

*Lo dimostrano*: `tests/component/OrderStatusPage.test.jsx`

### ✅ REQ-ORD-017 — Il QR per il cliente c'è solo se c'è qualcosa da seguire

Sul dettaglio di un ordine battuto al banco, allo staff compare «Mostra QR al cliente»: chi lo scansiona segue il proprio drink dal telefono. Con gli stati del servizio SPENTI non c'è niente da seguire — la pagina dice solo cosa è stato ordinato — e offrirlo è promettere una cosa che non succede: lì il tasto non compare.

*Dove*: `src/pages/OrderStatusPage.jsx`

*Lo dimostrano*: `tests/component/OrderStatusPage.test.jsx`

### ✅ REQ-ORD-015 — Nella lista ordini si cercano anche le serate passate

La lista mostrava gli ultimi conti e basta: per ritrovare una serata di due settimane fa non c'era strada. C'è un selettore a calendario come quelli degli alberghi — si tocca il giorno d'inizio, poi quello di fine, e in mezzo si accende tutto; un tocco solo vuol dire quella serata e basta, che è il caso più frequente. Sopra ci sono le scorciatoie (oggi, ieri, ultimi 7 e 30 giorni), perché quasi sempre si cerca lì. I giorni sono GIORNATE COMMERCIALI: la serata del venerdì finisce alle quattro del sabato, e chi cerca «venerdì» cerca quella. I giorni futuri sono spenti. Scelto un periodo, i conti si vanno a leggere dal database: in tempo reale ci sono solo gli ultimi. C'è anche un filtro su CHI ha aperto il conto — il locale (banco e sala) o il cliente dal suo telefono — che compare solo se di ordini dai clienti ce n'è davvero: dove non succede sarebbe una domanda senza risposta.

*Dove*: `src/lib/periodo.js, src/components/SelettorePeriodo.jsx, src/components/OrdersHistory.jsx, src/lib/api.js`

*Lo dimostrano*: `tests/unit/periodo.test.js`

### ✅ REQ-ORD-016 — Battere un conto non aspetta la rete, e non ne nascono due

Prima di scrivere un ordine si facevano TRE letture al server — quale cassa è aperta, il progressivo della serata, quello assoluto — e solo dopo il conto compariva: era il mezzo secondo fra «Conferma» e il conto a schermo. Adesso quei numeri stanno in memoria, tenuti aggiornati da ascolti che partono all'avvio dell'app: alla creazione non si chiede niente a nessuno. E DUE CONTI NON PRENDONO PIÙ LO STESSO NUMERO. Il numero è il più grande fra quello del server e l'ultimo dato da questo dispositivo, più uno: due creazioni ravvicinate non possono più leggere lo stesso valore solo perché la scrittura del contatore è ancora per strada — è così che sono nati due conti #15 nella stessa serata. Quello che si è assegnato resta scritto anche dopo un ricaricamento, e il contatore si scrive con un incremento, che non torna mai indietro. Resta scoperto un solo caso: due DISPOSITIVI che battono nello stesso istante. Escluderlo vorrebbe dire una transazione, cioè aspettare il server a ogni ordine — il contrario di quello che serve al banco. UNA BATTUTA, UN CONTO. La schermata può chiedere la creazione due volte (l'auto-creazione che scatta mentre si preme «Paga», un doppio tocco): la chiave della battuta fa restituire il conto che sta già nascendo invece di farne un altro. E il «+» apre sempre un conto NUOVO: la memoria del conto in corso serve a riprenderlo dopo un ricaricamento della pagina, non a rimetterci dentro chi esce e rientra. DUE TERMINALI, LO STESSO NUMERO: la disputa la chiude il SERVER, che è l'unico posto dove esiste un «prima» e un «dopo» veri. Tiene il numero chi è arrivato prima; chi arriva dopo prende il primo libero dopo il più alto — un buco in mezzo sarebbe di un conto ancora per strada, e la disputa ricomincerebbe. A parità di istante decide l'id del documento: arbitrario, ma UGUALE per i due terminali, che è l'unica cosa che conta. Tutto automatico: al banco non si ferma una serata per un numero. Il numero cambia solo a chi ha perso, e resta scritto da dove veniva (`daily_number_precedente`), perché la comanda può essere già uscita dalla stampante col numero vecchio. LE TRE SCHERMATE DEL SERVIZIO — coda, conto, pagamento — LAVORANO IN LOCALE. Leggono dalla cache, scrivono in sottofondo e si aggiornano da sole quando il server manda qualcosa di nuovo. Niente attese per far vedere l'esito di un gesto: incassare, annullare, aggiungere una riga si vedono nell'istante in cui si tocca, e i numeri in cima si muovono con loro. Il dato che serve si PRECARICA — i progressivi, la cassa aperta — invece di andarlo a chiedere al momento del bisogno. QUELLO CHE HO APPENA FATTO IO STA IN UN POSTO SOLO (src/lib/comandeLocali.js): l'array `comande` come lo vede questo terminale, per conto, che se ne va da sé quando il server racconta la stessa cosa. «La stessa cosa» è la FIRMA DEL LAVORO (firmaLavoro in comande.js): i passi e le quantità, senza gli id — una comanda appena creata qui non ha ancora il nome che le darà il server — e senza i campi che il server aggiunge per conto suo. Si toglie solo allora, mai subito dopo la scrittura: quella risponde PRIMA dello snapshot, e toglierla lì farebbe riapparire per un battito lo stato di prima. Erano tre copie della stessa idea (la coda, il conto, il dettaglio della comanda) e si comportavano già in modo diverso. DOVE FINISCONO LE RIGHE AGGIUNTE a un conto aperto lo dice `comandaPerLeAggiunte` (comande.js), un punto solo per tutte le strade: nella comanda che sta già nel passo di nascita, o in una nuova. Non nella prima «toccabile», che vuol dire un'altra cosa (BUG-024). Una comanda provvisoria nasce col passo e il numero che avrà DAVVERO, o si vedrebbe cambiare da sé un istante dopo. IN CHE PASSO NASCE UNA COMANDA lo decide il locale («Le comande nascono già in preparazione», Impostazioni → Gestione preparazione; di suo SPENTA, quindi «da fare») e lo si chiede a `statoComandaNuova(settings)` in comande.js. Vale allo stesso modo per la prima comanda di un conto nuovo e per le aggiunte a metà serata: prima erano due regole diverse scritte in due posti, più una terza nel placeholder della coda, e le tre risposte non combaciavano — la card compariva «Al banco» e saltava in «Da fare» appena arrivava dal server. È una FUNZIONE e non una costante esportata apposta: con un valore da copiare basta che una strada scriva un «ricevuto» a mano per non seguire l'impostazione, e non se ne accorge nessuno. COL SALTO ACCESO IL PASSO «DA FARE» NON ESISTE, e non deve comparire da nessuna parte come destinazione: sparisce dalle pastiglie «↩︎ Torna a…» (statiPrimaComanda in comande.js: i passi già fatti, meno quelli PRIMA di dove nasce il lavoro) e dall'elenco delle colonne che si accendono a mano (corsieSceglibili). Non si tocca però quello che c'è già: una comanda ferma a «da fare» resta dov'è e va avanti normalmente, e la sua colonna compare da sé (corsieDaMostrare) — il lavoro non si nasconde mai, e a mostrarlo è l'app, non una voce di menu che l'utente deve trovare. LE PAROLE DEL BANCO NON SONO QUELLE DEL CLIENTE: al banco il passo si chiama «Da fare» come la colonna (statoAlBanco in orderStatus.js), al cliente «Ordine ricevuto», che è quello che gli serve sapere — non è lui che lo deve fare. Due etichette, non una sola «giusta». E UNA SCRITTURA IN SOTTOFONDO TOCCA SOLO I CAMPI CHE LE COMPETONO: `comande` è un array e Firestore lo riscrive intero, quindi chi scrive si rilegge il documento NELL'ISTANTE PRIMA DI SCRIVERE, non all'inizio del lavoro (vedi BUG-022: fra le due cose ci sono le letture di ricette e articoli, e l'array vecchio si portava via l'avanzamento appena fatto). Anche i tasti: «invia comanda» e «annulla ordine» funzionano su un conto appena battuto, senza aspettare che esista sul server. E annullare lascia SEMPRE un conto annullato, anche se l'ordine non era ancora nato: il numero è già stato mostrato e preso, e di quello che è stato battuto deve restare traccia. LA SCHERMATA DEL CONTO NUOVO SI APRE PULITA, senza pulizie all'apertura: uscendo — dalla freccia, dal menu, dal tasto indietro — quello che è stato battuto diventa un conto e la bozza si chiude. La «bozza che non si perde» continua a valere: non si perde perché diventa un conto, non perché resta in un cassetto da cui il conto dopo se la ritrova dentro. Un tasto 🧹 svuota tutte le righe in un colpo (con conferma), invece di toglierle una per una. E la bozza si svuota all'istante: aspettare la scrittura voleva dire aprire il conto dopo e trovarci dentro le righe di quello prima. LE MODIFICHE CHE NON PASSERANNO MAI si dicono e si scartano. «Il documento non esiste più» o «non hai i permessi» non cambiano al secondo tentativo — succede quando qualcuno cancella un prodotto mentre tu ne stavi scalando la scorta — quindi non si riprovano da sole, si spiegano a parole («una scheda del magazzino non esiste più») e si tolgono dalla lista con un tasto. Senza, la campanella resta rossa per sempre su roba che non si può salvare. E QUELLO CHE SI SCRIVE ARRIVA AGLI ALTRI DA SÉ. Ogni modifica entra prima nella memoria locale e parte per il server in sottofondo: gli altri terminali la vedono comparire senza che nessuno prema niente. Offline le scritture non falliscono — restano in coda dentro Firestore, che le conserva anche a app chiusa, e partono appena c'è linea. Quelle RIFIUTATE (un errore vero, la rete che si chiude a metà) si riprovano da sole al ritorno della rete, fino a tre volte: oltre, restano lì e lo dice la campanella, perché una scrittura che continua a essere rifiutata ha bisogno di una persona, non di un altro tentativo. E NIENTE ASPETTA IL SERVER. Ogni azione su un conto — incassare, annullare, avanzare, aggiungere righe — leggeva il documento dal SERVER prima di scrivere: da lì il ritardo fra il tocco e la coda che si muove, e il riepilogo in cima che sembrava aggiornarsi solo alla risposta del server. Si legge dalla cache, che l'ascolto della coda tiene già allineata. E USCIRE DAL CONTO NON ASPETTA NIENTE. Il box del nome aspettava che il conto fosse nato per sapere se chiederlo — ma il nome si sa già dalla schermata: l'unica cosa che quell'attesa produceva era il box in ritardo. Il conto nasce per conto suo, e il nome lo raggiunge appena c'è.

*Dove*: `src/lib/progressivi.js, src/lib/api.js, src/components/OrderPosDetail.jsx`

*Lo dimostrano*: `tests/unit/progressivi.test.js`, `tests/bdd/numerazione.test.js`, `tests/component/PosPage.test.jsx`, `tests/unit/sync.test.js`, `tests/unit/scritturaComande.test.js`

### ✅ REQ-ORD-008 — Un conto chiuso o annullato si può rimettere in corso

Capita di chiudere un conto sul tavolo sbagliato, di annullarlo per un malinteso, o che il cliente torni e voglia ordinare ancora su quello. Nella storia CHI ha fatto una cosa si scrive sempre allo stesso modo: il NOME, col ruolo fra parentesi se si sa. Mai l'email, che è un indirizzo e non una persona. Prima la stessa persona compariva tre volte con tre etichette diverse — l'email all'apertura, il ruolo all'annullo (l'unica cosa che quella strada scriveva), il nome alla riapertura — e chi leggeva non poteva dire «è stato lui». Chi ha il gestionale può rimetterlo in corso: si conferma in un pannello che dice cosa succederà e si può scrivere il perché — FACOLTATIVO, perché se fosse obbligatorio si scriverebbe "x" per passare oltre, e al banco i secondi non ci sono. Il conto torna aperto e si può battere di nuovo. RIAPRIRE = COME SE NON FOSSE MAI STATO PAGATO. Gli incassi si tolgono: il conto riaperto è un conto normale, da battere e da incassare, con tutte le righe modificabili. Prima gli incassi restavano attaccati e il conto tornava «ad acconto»: le righe già pagate erano bloccate — e riaprire serve proprio a toccarle — e i soldi restavano nei guadagni della serata di un conto che era di nuovo da incassare, quindi a fine turno lo stesso conto risultava incassato due volte. La cassa legge gli incassi dagli ordini, perciò toglierli dal conto li toglie anche dal flusso di cassa. Non si butta via niente: quello che era entrato resta in `payments_annullati` con l'ora in cui è stato tolto, e il totale compare nella storia del conto («riaperto — tolti 15,50 € dagli incassi»), che è dove lo si va a cercare quando la cassa non torna. Le comande già servite restano servite: tornano da fare solo quelle annullate col conto. SU UN CONTO RIAPERTO SI TOCCA TUTTO, righe vecchie comprese. Di norma una comanda servita non si modifica più — il drink è stato fatto e portato — ma riaprire serve ESATTAMENTE a rimettere a posto quello che c'è dentro: un giro battuto sul tavolo sbagliato, una birra di troppo. Se le righe di prima restano bloccate, il conto riaperto non serve a niente. Le scorte si riallineano con la differenza, come per ogni altra modifica. Il tasto per riaprire NON è un tasto in più: è quello del PAGAMENTO, che su un conto chiuso o annullato era lì spento a non fare niente. ANNULLANDO, il saldo di un buono usato per pagare torna al beneficiario: il conto non si incassa più, e lasciarlo scalato significherebbe fargli perdere il credito per un conto mai pagato. Le righe restituite si segnano (`restituito_at`), così riaprendo lo stesso conto non tornano una seconda volta — sarebbe credito inventato, l'errore opposto. IL BUONO NON SI PAGA DUE VOLTE. Il saldo di un buono si scala quando lo si usa, non quando i soldi entrano in cassa. Se il conto era stato PAGATO con un buono, riaprendolo quella riga di incasso sparisce come le altre: il saldo torna al beneficiario, altrimenti avrebbe pagato due volte — una col buono che non torna, una quando ripaga il conto. Il buono usato come SCONTO invece resta dov'è: lo sconto è ancora sul conto, quindi qualcuno deve pagarlo, e ri-chiuderlo non lo scala una seconda volta. Se il conto annullato era stato scontato con un BUONO VIP, riaprendolo il saldo si ri-addebita: annullando era tornato al beneficiario, e lasciarlo lì significherebbe uno sconto che nessuno ha pagato e un credito in circolazione che non torna più con i conti. Se nel frattempo il buono è stato speso altrove e il saldo non basta, si addebita quel che c'è e lo sconto si riduce a quella cifra (fino a sparire): meglio un conto che chiede qualche euro in più che un buono in rosso. Su un conto CHIUSO non si tocca niente, perché lì il buono non era mai stato ristornato. Il motivo si legge DENTRO il conto riaperto, senza doverlo cercare, e la storia completa — aperto, chiuso, annullato, riaperto, con chi e perché — sta dietro i ⋯ del conto, sia nella coda sia nel dettaglio. La storia si ricostruisce da quello che il conto porta già addosso, quindi vale anche per i conti di ieri, senza migrazioni.

*Dove*: `src/lib/storiaOrdine.js, src/lib/api.js, src/components/StoriaOrdine.jsx`

*Lo dimostrano*: `tests/unit/storiaOrdine.test.js`, `tests/component/OrderPosDetail.test.jsx`, `tests/unit/vouchers.test.js`, `tests/unit/ripristino.test.js`

### ✅ REQ-ORD-010 — Gli annullati hanno una tab loro nella coda

La coda si filtra con «In corso», «Chiusi», «Annullati» e «Tutti». Gli annullati stavano fra i chiusi: facevano numero senza essere incassi — «Chiusi» sono i soldi della serata — e per ritrovarne uno da riaprire bisognava cercarlo in mezzo a quelli buoni. Un conto annullato non è un conto chiuso: è un conto che non c'è più. La regola è pura (`passaFiltroCoda`), così il filtro non si sposta di significato fra la griglia e i conteggi.

*Dove*: `src/lib/coda.js, src/pages/BartenderPage.jsx`

*Lo dimostrano*: `tests/unit/coda.test.js`

### ✅ REQ-ORD-020 — Servizio o ritiro: il locale dice come nascono i conti, lo staff cambia il suo

Un conto è servito al tavolo o ritirato al banco. Chi decide, in ordine: il LOCALE dice come NASCONO i conti — non quali modi esistono; il CLIENTE sceglie il suo, ma solo se glielo si lascia scegliere e solo se ordina da sé; lo STAFF può sempre cambiare quello che ha in mano. La scelta sta sul CONTO (`order.service_mode`), non sul terminale e non sul locale: due conti battuti dallo stesso tablet possono essere uno servito e uno da ritirare, ed è tutto il punto. Prima l'impostazione era un VINCOLO: finiva sull'ordine alla creazione e non c'era nessun posto in cui cambiarla.

*Dove*: `src/lib/consegna.js, src/components/SettingsTab.jsx, src/components/OrderPosDetail.jsx, src/components/OrderSummary.jsx, src/lib/coda.js, src/lib/api.js`

*Lo dimostrano*: `tests/unit/consegna.test.js`, `tests/component/OrderPosDetail.test.jsx`, `tests/component/CodaCorsie.test.jsx`

### ✅ REQ-ORD-009 — Un ordine battuto altrove si vede su tutti gli altri terminali

Chi manda un ordine — o lo annulla — non ha bisogno di un avviso che gli dica quello che ha appena fatto; tutti gli altri terminali sì. Vale anche per l'ANNULLAMENTO, che porta con sé il terminale (`cancelled_device`): chi annulla lo fa quasi sempre dal conto e non dalla coda, quindi «l'ho premuto io» non basterebbe — quella schermata è un'altra. Il metro è il DISPOSITIVO, non il ruolo: prima si tacevano tutti gli ordini battuti da un gestore su qualunque terminale, e chi stava in sala col telefono non sapeva mai che al banco era entrato un ordine — lo stesso account sta su tablet, telefono e portatile insieme. Ogni ordine porta l'identificativo del dispositivo che l'ha creato (un numero a caso per browser, non identifica una persona); gli ordini che non ce l'hanno avvisano, perché un avviso in più si chiude e uno in meno è un drink che non parte. Le notifiche della campanella si dividono in DA LEGGERE e lette: una letta sparisce dall'elenco — in mezz'ora di servizio un elenco che non si svuota mai diventa un muro di righe vecchie, e non ci si guarda più — e resta nello STORICO, che si apre dalla campanella. Aprire la campanella non è leggere: si segna leggendo, toccando la notifica, oppure con «segna tutte lette», che è una decisione. OGNI AVVISO SI PUÒ SPEGNERE, uno per uno: nuovo ordine, ciascuno stato della preparazione separatamente, le scorte (in esaurimento ed esaurita, solo per chi tiene il gestionale) e la nuova versione dell'app. La scelta è PER DISPOSITIVO E PER PERSONA e resta in memoria locale, perché non è una regola del bar: al banco «nuovo ordine» è la cosa più importante della serata, in sala serve «pronto», e sul portatile nel retro non serve niente. Un interruttore unico si spegnerebbe dove dà fastidio lasciando senza chi ne aveva bisogno; e due persone che si passano lo stesso tablet nei cambi turno non si sovrascrivono a vicenda. Di partenza sono tutti accesi: nessuno deve scoprire di essersi perso un ordine perché «era spento di default».

*Dove*: `src/lib/dispositivo.js, src/pages/BartenderPage.jsx, src/lib/notifyStore.js`

*Lo dimostrano*: `tests/unit/dispositivo.test.js`, `tests/unit/notifyStore.test.js`, `tests/unit/preferenzeNotifiche.test.js`

### ⬜ REQ-ORD-021 — Le comande annullate: o si rifanno, o si stornano dal conto

Chiesto dall'utente il 18/08. Annullare una comanda ferma la PREPARAZIONE, non tocca i soldi: quei drink restano sul conto finché qualcuno non decide cosa farne. Oggi invece spariscono dal totale in silenzio (aggregateItems salta le annullate), e nessuno se ne accorge. LA REGOLA, una sola, di cui la divisione è il caso particolare. Ogni unità di una comanda annullata sta in uno di tre posti: SOSTITUITA (è finita in una o più comande nuove nate al suo posto), STORNATA (tolta dal conto per davvero, e scritta come storno), DA DECIDERE (nessuna delle due: pesa ancora sul conto e si vede nel dettaglio, in attesa che qualcuno scelga). L'INVARIANTE, che è quello che tiene in piedi i soldi: per ogni comanda annullata `sostituite + stornate + da_decidere` fa sempre la quantità di partenza, e sul totale del conto pesa SOLO la parte da decidere — le sostituite pesano attraverso le comande nuove (se contassero entrambe il conto raddoppierebbe), le stornate non pesano più. Da qui la divisione smette di essere un'eccezione: è il caso in cui tutto è sostituito, il residuo è zero e il totale non si muove di un centesimo. COSA SI VEDE E COSA SI FA. Nel dettaglio del conto, fra i gruppi per passo del servizio, c'è anche il gruppo delle voci in comande annullate, distinto dagli altri: non sono lavoro in corso, sono roba da decidere. Da lì due strade: RIFARE (si stampa una comanda uguale, per tutto o per una parte, che nasce come una comanda qualsiasi — il bicchiere rotto si rifà) e STORNARE (col «−» si tolgono le voci, che escono dal conto segnate come stornate: non spariscono, restano scritte come storno). LO STORNO SI VEDE E SI STAMPA: nella colonna di sinistra della schermata di pagamento e sul preconto/scontrino, come riga propria con l'importo in negativo. Chi legge lo scontrino deve capire cosa è stato tolto e quanto, se no un conto che non torna diventa una discussione al tavolo. TRE DECISIONI PRESE (18/08, confermate dall'utente): 1) la regola vale solo per le comande annullate DA QUI IN AVANTI — quelle nuove portano i campi del rendiconto, le vecchie no e si comportano come oggi. Nessuna migrazione, e nessun conto già chiuso che cambia importo; 2) se il CONTO è annullato non pesa niente: eccezione esplicita, prima di ogni altro calcolo; 3) il gesto per annullare una singola comanda su un conto vivo oggi NON esiste (lo fanno solo la divisione e l'annullamento del conto) e va aggiunto nel dettaglio comanda: solo a conto aperto e solo se non è ancora stata servita — servita vuol dire che il drink è uscito, e lì la strada resta «Riapri conto». Vale solo con gli stati del servizio accesi.

*Dove*: `src/lib/comande.js, src/components/OrderPosDetail.jsx, src/lib/printer.js, src/components/PaymentScreen.jsx`

*Lo dimostrano*: `tests/unit/comande.test.js`, `tests/component/OrderPosDetail.test.jsx`

## Pagamenti

### ✅ REQ-PAG-010 — Si vede che cosa è stato pagato, e cosa copre

In fondo al conto c'era una riga sola: «Sconto e acconti già incassati −15,00 €». Quindici euro di che? Uno sconto, un acconto, con che metodo, per quali righe? Al banco, davanti al cliente che chiede, quella riga non risponde a niente. Ora sono righe distinte: lo sconto per conto suo, e ogni incasso col suo metodo e la sua ora. E si dice cosa copre. Un importo battuto a mano — «30 €» — NON copre nessuna riga: sono soldi lasciati sul conto, e si chiama ACCONTO. Chi paga scegliendo le righe copre esattamente quelle, e sotto l'incasso si leggono («2× Daiquiri · 1× Birra»). Non c'è una riga di istruzioni sopra le righe: a dire da dove viene il numero ci pensa l'etichetta sopra l'importo — «RIGHE SCELTE» o «IMPORTO A MANO» — che si legge nel momento in cui serve. Attribuire delle righe a un importo battuto a mano vorrebbe dire inventarselo: se servono attribuite, si scelgono nella schermata di pagamento — che è esattamente a cosa serve la selezione a sinistra.

*Dove*: `src/lib/pagamento.js, src/components/OrderPosDetail.jsx, src/components/PaymentScreen.jsx`

*Lo dimostrano*: `tests/unit/pagamento.test.js`

### ✅ REQ-PAG-001 — Incasso in contanti, carta o acconto, anche senza rete

Il conto si chiude subito a schermo e la scrittura va in coda: contanti, carta e acconti non aspettano il server. Un conto già pagato viene rifiutato subito, non dopo un timeout di rete. Il metodo scelto resta scritto sull'incasso: serve alla chiusura di cassa e allo scontrino.

*Dove*: `src/components/PaymentScreen.jsx, src/lib/api.js`

*Lo dimostrano*: `tests/unit/incassoOffline.test.js`, `tests/component/PaymentScreen.test.jsx`, `tests/unit/pagamento.test.js`, `tests/unit/payments.test.js`, `tests/unit/payment-core.test.js`

### ✅ REQ-PAG-002 — Il tasto Pagamento dice quanto resta da incassare

Sul tasto è scritta la cifra da incassare al netto di sconti e acconti già presi, e resta scritta anche dopo che l'ordine è stato creato. A conto saldato la cifra sparisce, perché non c'è più niente da incassare.

*Dove*: `src/components/OrderPosDetail.jsx`

*Lo dimostrano*: `tests/component/OrderPosDetail.test.jsx`

### ✅ REQ-PAG-003 — Sconto sul conto, con tre strategie a scelta

Lo sconto si applica dal tastierino e si può impostare come tetto al totale, come proporzione sulle righe o come semplice avviso; la strategia si sceglie nelle impostazioni (default: tetto al totale). Le statistiche e il rendiconto devono sempre scorporare lo sconto, mai mostrare il prezzo di listino come venduto. Il tastierino dello sconto ha le cifre nell'ordine di sempre (7 8 9 / 4 5 6 / 1 2 3 / C 0 ←), su tre colonne: si batte a memoria.

*Dove*: `src/lib/pricing.js, src/components/SettingsTab.jsx`

*Lo dimostrano*: `tests/unit/pricing.test.js`, `tests/component/PaymentScreen.test.jsx`

### ✅ REQ-PAG-004 — Lettore SumUp: pairing e incasso con carta

Il lettore si associa con un codice di pairing (riservato a chi sta al banco); da lì si incassa con carta direttamente dall'app. Il webhook verifica l'esito tramite la Transactions API prima di segnare il conto pagato. Nella schermata di pagamento SumUp resta sempre in lista: se il lettore non è configurato — o manca la rete — il tasto è spento a vedersi ma si può toccare, e al tocco dice il perché e dove si rimedia. Il motivo non sta scritto sotto al tasto: occupava una riga in una schermata che ne ha poche, e chi incassa non lo leggeva comunque.

*Dove*: `functions/lib/payment-service.js, src/lib/paymentsApi.js`

*Lo dimostrano*: `tests/bdd/payment-reader.test.js`, `tests/component/PaymentScreen.test.jsx`

### ✅ REQ-PAG-005 — Pagamento online con link o QR

Si può creare un checkout online per un conto e verificarne lo stato; il webhook salda il conto quando il pagamento arriva. Vale anche per i conti di gruppo, dove il pagamento chiude tutti gli ordini del gruppo.

*Dove*: `functions/lib/payment-service.js`

*Lo dimostrano*: `tests/bdd/payment-checkout.test.js`, `tests/bdd/payment-group.test.js`

### ✅ REQ-PAG-006 — Buoni VIP: credito prepagato intestato a una persona

Un buono ha un saldo che si consuma sui conti; si vede quanto credito è in circolazione e i buoni scaduti non sono spendibili. Annullando un conto che ha usato un buono, il credito torna al beneficiario.

*Dove*: `src/lib/vouchers.js, src/components/VipTab.jsx`

*Lo dimostrano*: `tests/unit/vouchers.test.js`

### ✅ REQ-PAG-007 — Codice lotteria e fattura di cortesia

Al pagamento si può registrare il codice lotteria del cliente ed emettere una fattura di cortesia numerata, con il suo registro nel gestionale.

*Dove*: `src/components/PaymentScreen.jsx, src/components/InvoicesTab.jsx`

*Lo dimostrano*: `tests/component/PaymentScreen.test.jsx`, `tests/component/InvoicesTab.test.jsx`

### ✅ REQ-PAG-008 — Preconto prima di incassare

Si può stampare o mostrare il conto al cliente prima dell'incasso, senza chiudere niente: il conto resta aperto e modificabile.

*Dove*: `src/components/PaymentScreen.jsx`

*Lo dimostrano*: `tests/component/PaymentScreen.test.jsx`

### ⬜ REQ-PAG-009 — Nel pagamento gli item sono separati di partenza

La schermata di incasso mostra gli item UNO PER RIGA fin da subito, senza dover premere «Separa uguali»: al banco si paga quasi sempre a pezzi — uno paga il suo, un altro offre due birre — e partire dal gruppo «3× Birra» vuol dire un tocco in piu' ogni volta, proprio mentre c'e' gente alla cassa. Restano possibili sia il raggruppamento («Unisci uguali», per un conto lungo che diventa illeggibile) sia l'incasso completo con un colpo solo. Ogni unita' e' una cosa a se': accenderne o spegnerne una non tocca le altre (vedi BUG-006, che nasce dallo stesso punto).

*Dove*: `src/components/PaymentScreen.jsx, src/lib/pagamento.js`

*Nessun test lo verifica.*

### ⬜ REQ-PAG-011 — Il pagamento si legge per comanda, e dalla card servita si incassa quella

Chiesto dall'utente il 18/08. Quando un conto ha più di una comanda, nella colonna di sinistra della schermata di pagamento le righe si raggruppano per comanda — stessa forma dei gruppi che ci sono già, intestazione e sotto le sue righe — e ogni gruppo ha i suoi due tasti, TUTTO e NIENTE, per prendere o lasciare in un colpo quello che contiene. Con una comanda sola non cambia niente: nessuna intestazione, nessun tasto in più, che non serve un titolo per dire una cosa sola. La selezione per riga e quantità che c'è oggi resta e non si rifà: quei tasti la muovono, non la sostituiscono. E dal banco: sulla card di una comanda SERVITA il tasto porta in cassa CON QUELLA COMANDA GIÀ SELEZIONATA. È quello che rende sensata la cosa: tre comande servite dello stesso tavolo non chiedono tre volte l'intero — ognuna porta in cassa la sua parte, e chi vuole incassare tutto tocca «tutto» sugli altri gruppi o parte dal conto.

*Dove*: `src/components/PaymentScreen.jsx, src/components/CorsieComande.jsx`

*Lo dimostrano*: `tests/component/PaymentScreen.test.jsx`

## Cassa e POS

### ✅ REQ-POS-001 — L'ordine nasce al primo prodotto, senza cambiare schermata

Toccando il primo prodotto il conto viene creato in place: niente navigazione, niente ricaricamento, la schermata resta quella e da lì si continua come in modifica. Il nome del cliente si chiede all'uscita, una volta sola.

*Dove*: `src/components/OrderPosDetail.jsx, src/pages/PosPage.jsx`

*Lo dimostrano*: `tests/component/PosPage.test.jsx`

### ✅ REQ-POS-002 — Niente si perde mentre l'ordine sta nascendo

La creazione dura qualche decimo di secondo e in quei decimi al banco si continua a battere: le righe aggiunte nel frattempo devono finire nello stesso conto, senza sparire e senza far nascere un secondo conto. La bozza cambia chiave quando il conto nasce, e le righe rimaste vanno passate alla chiave nuova. Nemmeno il PAGAMENTO si perde: premendo Pagamento mentre la creazione è ancora in volo, la schermata deve restare aperta anche quando il server risponde e il conto smette di essere "nuovo" — prima si chiudeva da sola e bisognava ripremere Pagamento, col cliente davanti.

*Dove*: `src/components/OrderPosDetail.jsx`

*Lo dimostrano*: `tests/component/OrderPosDetail.test.jsx`

### ✅ REQ-POS-003 — La bozza non si perde uscendo dalla schermata

Le righe non ancora confermate restano in memoria locale per contesto: uscendo e rientrando si riprende da dove si era. Vale anche per l'ordine visivo delle righe, riordinabile a mano.

*Dove*: `src/lib/useDraft.js`

*Lo dimostrano*: `tests/unit/useDraft.test.js`

### ⚠️  REQ-POS-004 — Un ricaricamento non fa perdere il conto in corso

In creazione il conto nasce senza cambiare pagina: dopo un ricaricamento l'app non saprebbe più su quale conto stava lavorando e ne aprirebbe un altro, lasciando il primo in coda con dentro la roba già battuta. L'id del conto viene ricordato e ripreso al rientro, se è ancora aperto; si dimentica uscendo, alla chiusura, o dopo otto ore.

*Dove*: `src/components/OrderPosDetail.jsx`

*Nessun test lo verifica.*

### ✅ REQ-POS-005 — Le modifiche sono istantanee a schermo, sincronizzate dopo

Aggiunte e diminuzioni compaiono subito e partono in sottofondo: nessuna schermata aspetta il server. Se la scrittura fallisce lo dice un avviso, ma il lavoro al banco non si ferma mai.

*Dove*: `src/components/OrderPosDetail.jsx, src/lib/sync.js`

*Lo dimostrano*: `tests/component/OrderPosDetail.test.jsx`, `tests/unit/incassoOffline.test.js`, `tests/unit/pendingOrders.test.js`

### ✅ REQ-POS-006 — Prodotto libero: una voce che non è a menù

Si aggiunge al conto una voce fuori catalogo, con nome, prezzo e ricetta incorporata. La ricetta incorporata ha precedenza su quella del catalogo quando si scaricano le scorte.

*Dove*: `src/components/CustomDrinkForm.jsx`

*Lo dimostrano*: `tests/component/CustomDrinkForm.test.jsx`, `tests/unit/inventory.test.js`

### ✅ REQ-POS-007 — Sul telefono la pagina è per le righe e la griglia

Sotto i 700px in pagina restano totale, righe del conto e i tre gesti della serata (Invia, Paga, Annulla); comande, prodotto libero, dati conto, unisci, separa e gruppo stanno dietro i tre puntini. Il pannello si apre mostrando l'ultima riga battuta e si alza da una maniglia.

*Dove*: `src/components/OrderPosDetail.jsx, src/components/ActionSheet.jsx`

*Lo dimostrano*: `tests/component/OrderPosDetail.test.jsx`

### ✅ REQ-POS-019 — La striscia delle card dice quello che serve a chi lavora

La striscia a sinistra delle card — griglia del conto e schede del menù — si sceglie, perché dipende da come si lavora: chi conosce il listino a memoria vuole i colori delle categorie per trovare il prodotto al tatto, chi sta finendo le bottiglie vuole vedere subito cosa non si può più fare, chi ha già abbastanza colori addosso la vuole spenta. Quattro modi: SPENTA (grigia, il colore resta nella linguetta), PRODOTTO (il suo colore, o quello della categoria se non ne ha uno), CATEGORIA (sempre la categoria: il colore del singolo prodotto lo dice la linguetta) e SCORTE (rosso ingrediente esaurito, arancione in esaurimento, e «ce n'è abbastanza» a scelta fra grigio e verde). Un prodotto fuori menu resta GRIGIO anche col verde acceso: è spento, non rotto — il rosso qui diceva due cose opposte, «l'ho tolto io» e «è finito il rum». La scelta è del LOCALE (settings/bar) e vale per tutti i terminali: la griglia dev'essere la stessa dovunque, o due persone parlano di due schermate diverse. Le due schermate si impostano separatamente. Le regole stanno in una funzione pura: la stessa striscia deve significare la stessa cosa in tutte le schermate, e con la logica dentro le pagine finiva per divergere. L'IMPOSTAZIONE È SOLO DELLA STRISCIA. La linguetta nell'angolo in alto a sinistra tiene sempre il colore del PRODOTTO — è quella che si tocca per cambiarlo — qualunque cosa dica la striscia. I due segni condividevano lo stesso valore, e scegliendo «categoria» il colore messo a mano spariva dalla vista pur essendo ancora lì. Ogni scelta sta DOVE SI LAVORA quella schermata: la griglia del conto in Impostazioni → Vista ordine, le schede del catalogo in Menù e catalogo — modo della striscia e colore del «ce n'è abbastanza», separati per le due. Non è la stessa domanda: nel conto si batte di corsa e una griglia tutta verde è rumore (lì interessano i guai), nel catalogo si guarda con calma cosa si può fare e il verde è un'informazione. Il MENÙ ha tre sottosezioni nel menu laterale — modifica menù, categorie, marginalità del listino — invece dei due pannelli a scomparsa in cima al catalogo, che si aprivano spingendo giù la griglia: chi voleva solo guardare i margini si portava dietro tutto il listino sotto. Le scorte si leggono SOLO se servono: con gli altri modi ricette e giacenze non si caricano nemmeno. NIENTE LAMPO ALL'APERTURA. Le impostazioni arrivano dal server e per un istante non ci sono: aprendo un conto le strisce comparivano colorate e sparivano un attimo dopo, in un locale che le aveva spente. L'ultima risposta del server resta in memoria locale (`impostazioniLocali.js`) e la schermata parte da lì — l'ultima verità nota, non i valori di fabbrica.

*Dove*: `src/lib/strisce.js, src/components/SettingsTab.jsx`

*Lo dimostrano*: `tests/unit/strisce.test.js`, `tests/component/PosProductPicker.test.jsx`, `tests/unit/impostazioniLocali.test.js`

### ✅ REQ-POS-013 — In «Organizza» la card segue il dito

Trascinando una card dalla maniglia, quella in mano segue il dito e le altre si spostano per farle posto; lasciandola, resta dove l'hai messa. Lo fa una libreria (dnd-kit), non codice nostro: la versione scritta a mano — cattura del puntatore, ciclo di auto-scroll, animazioni a mano — aveva un difetto dopo l'altro (lo scorrimento che non si fermava, le card che si spostavano solo mentre la griglia scorreva, il rilascio fuori area). Trascinare col dito è un problema risolto, con dieci casi limite che non si vedono finché non capitano al banco; in più arriva gratis il riordino da TASTIERA, che non avevamo. Quello che resta nostro è la regola: l'ordine è UNO SOLO e globale, anche quando a schermo c'è una sola categoria — se no spostare una birra dentro «Birre» la lascerebbe al suo posto in «Tutti». La maniglia sta SOPRA la card, sul suo bordo destro, e non a fianco: affiancata allargava ogni cella di 38px, e la griglia entrando in «organizza» cambiava numero di card per riga e misura — si sistemava una disposizione diversa da quella che poi si usa davvero. La cella occupa esattamente quello che occupa fuori da qui. Il contesto di trascinamento sta SEMPRE attorno alla griglia, anche fuori da «organizza» (senza gesti attivi e senza niente di trascinabile dentro, non fa nulla). Montarlo solo lì spostava la griglia in un altro posto dell'albero, e React a quel punto buttava il riquadro e ne faceva uno nuovo: il misuratore della larghezza — quello che decide quanto sono grandi le card e i loro testi — restava attaccato al vecchio, staccato dalla pagina e quindi largo zero, e le card tornavano alla misura di partenza coi testi rimpiccioliti. Sistemato quello restava comunque un lampo, il tempo di rifare il riquadro e rimisurarlo. Il misuratore, per sicurezza, si riaggancia comunque al riquadro che c'è (ref-funzione) e prende subito la misura. Dentro «organizza» la card riempie la sua casella come fuori: la griglia rende tutte le caselle di una riga alte uguali, ma in mezzo c'è il guscio che porta il trascinamento — si allungava lui e la card restava alta quanto il suo testo, con una riga di card di altezze diverse. La card in mano NON ESCE DALLA GRIGLIA. Trascinandola verso destra finiva oltre il bordo: lì fuori non c'è niente da riordinare, ma il riquadro — che scorre — si allargava per contenerla e partiva uno scorrimento orizzontale senza fine, da riportare indietro a mano. Il movimento si ferma ai bordi del riquadro (un modifier di dnd-kit) e la griglia non scorre di lato: va a capo. La card in mano è OPACA: il fondo delle card è un velo (--tile-bg, bianco al 5%), che appoggiate sulla pagina va bene ma alzandone una sopra le altre le faceva vedere attraverso — e non si capiva più quale si sta spostando. Sotto ci va il fondo della pagina, così in mano ha l'aspetto identico a quando è posata. Il minimo delle colonne — «almeno tre card per riga finché ci stanno» — lo calcola il CSS con min()/max(), non il JavaScript sulla larghezza misurata: la misura arriva sempre qualche fotogramma dopo, e trascinando la maniglia di fianco alla griglia per un attimo ci stavano due colonne invece di tre, fino a quando non arrivava. Nel CSS il conto si rifà insieme al ridimensionamento. Sempre per non far ballare la griglia, lo spazio della barra di scorrimento è riservato (`scrollbar-gutter: stable`): compariva e spariva a seconda di quanti prodotti ha la categoria, e al confine fra tre e quattro card per riga la griglia si riassestava da sola mentre la si guardava.

*Dove*: `src/components/PosProductPicker.jsx, src/index.css`

*Lo dimostrano*: `tests/component/PosProductPicker.test.jsx`

### ✅ REQ-POS-008 — Le maniglie, col dito, si prendono solo tenendo premuto

Col mouse si prende e si trascina; col dito la maniglia si arma dopo 400ms, con vibrazione e segnale visivo. Se prima dello scatto il dito si sposta di oltre 10px stava scorrendo, e non succede niente: sfiorare una maniglia mentre si scorre non deve cambiare la misura di nulla.

*Dove*: `src/lib/useResizable.js`

*Lo dimostrano*: `tests/unit/useResizable.test.js`

### ⚠️  REQ-POS-009 — Nelle schermate di lavoro non parte il tira-per-aggiornare

Arrivati in cima a una lista, continuando a trascinare in giù il browser ricaricava la pagina, in mezzo alla composizione di un ordine. Nelle schermate a tutto schermo lo scorrimento si ferma dov'è e non si propaga al documento.

*Dove*: `src/index.css, src/components/PosProductPicker.jsx`

*Nessun test lo verifica.*

### ⬜ REQ-POS-010 — Unisci e Separa: un tasto solo

Oggi sono due tasti distinti e solo uno dei due è utile alla volta. Vanno unificati in un comando unico che fa la cosa sensata a seconda delle righe: accorpa se ci sono righe uguali, separa se c'è una riga con quantità multipla.

*Dove*: `src/components/OrderPosDetail.jsx`

*Nessun test lo verifica.*

### ✅ REQ-POS-011 — La griglia del POS si organizza come si lavora

Nel POS i prodotti si trovano per categoria, per preferiti (fissati a mano) e per recenti (gli ultimi battuti davvero). L'ordine delle card si può cambiare trascinandole, e resta com'è stato messo.

*Dove*: `src/lib/posCatalog.js, src/components/PosProductPicker.jsx`

*Lo dimostrano*: `tests/unit/posCatalog.test.js`

### ✅ REQ-POS-012 — La ricerca prodotti: filtra, oppure accende la card e ci porta lì

Cercando un prodotto nella griglia del POS (creazione e modifica ordine) si sceglie fra due comportamenti, in Impostazioni → Vista ordine. «Filtra la griglia» lascia le sole card che rispondono, come è sempre stato. «Accendi e porta lì» non toglie niente: la griglia scorre fino alla prima card che risponde e la accende con un anello nel colore d'accento, così si vede dov'è rispetto alle altre — serve a chi la griglia la conosce a memoria e non vuole vederla cambiare sotto le dita. Mentre si cerca mostra tutto il catalogo, perché il prodotto giusto può stare in un'altra categoria; toccando una card la ricerca si azzera da sé. La regola di corrispondenza è una sola per tutti e due i modi, altrimenti cambiando impostazione lo stesso testo troverebbe prodotti diversi. Se non risponde niente lo dice, invece di lasciare la griglia apparentemente immobile.

*Dove*: `src/lib/posCatalog.js, src/components/PosProductPicker.jsx, src/components/SettingsTab.jsx`

*Lo dimostrano*: `tests/component/PosProductPicker.test.jsx`

### ✅ REQ-POS-014 — La riga del conto dice quanto fa; il calcolo è a richiesta

Ogni riga del conto mostra nome e SUBTOTALE (quantità × prezzo, già fatto), anche con un pezzo solo. Il calcolo per esteso — «2 × 5,00 €» — non sta più accanto al nome, dov'era rumore su ogni riga: si accende dal menù ⋯ del conto («Mostra i calcoli delle righe»), compare sotto l'item come le note, e se una riga ha nota e calcolo stanno su due righe distinte. La scelta si ricorda sul dispositivo. Il ⋯ per questo è visibile a tutte le taglie, non solo su telefono. E la dimensione del testo delle righe ha un MINIMO configurabile (Impostazioni → Vista ordine): il testo segue la larghezza del pannello ma sotto la soglia scelta non scende — il pavimento fisso di prima per qualcuno era un manifesto.

*Dove*: `src/components/OrderPosDetail.jsx, src/components/SettingsTab.jsx`

*Lo dimostrano*: `tests/component/OrderPosDetail.test.jsx`

### ✅ REQ-POS-015 — Unisci e Separa sono un tasto solo

Dei due, alla volta ne serve uno: il tasto mostra l'azione possibile e cambia faccia da sé — se c'è da unire, unisce; altrimenti separa. Quando servirebbero entrambe vince Unisci, e Separa resta raggiungibile dal menù ⋯ (dove le due voci esplicite restano comunque). Spento, non sparito, quando non c'è niente da fare: i tasti non ballano.

*Dove*: `src/components/OrderPosDetail.jsx`

*Lo dimostrano*: `tests/component/OrderPosDetail.test.jsx`

### ✅ REQ-POS-016 — I supplementi del conto in chiaro: subtotale, voci, totale

Nel riepilogo del conto prima c'era una riga cumulativa («Coperto/servizio/mancia · 5,50 €») e non si capiva né cosa fosse attivo né quanto pesasse ognuno. Ora: SUBTOTALE in evidenza (il conto nudo, in grassetto, appena più grande delle voci), sotto le voci attive una per riga in piccolo — Coperto, Servizio, Mancia, solo quelle maggiori di zero — e in fondo il TOTALE grande che somma tutto. Le righe sono strette: il blocco non deve crescere in altezza. Sul telefono il dettaglio parte chiuso e si apre toccando il Subtotale.

*Dove*: `src/components/OrderPosDetail.jsx`

*Lo dimostrano*: `tests/component/OrderPosDetail.test.jsx`

### ⬜ REQ-POS-017 — Coperto, servizio e mancia si accendono e spengono sul singolo conto

Dal menù ⋯ del conto si governano i supplementi PER QUEL CONTO: se un supplemento è disattivato nelle impostazioni lo si può accendere solo qui (uno, due o tutti e tre); se è attivo di default lo si può spegnere solo qui. Spegnendoli, le rispettive voci spariscono dal riepilogo — e se non resta nulla sparisce anche la riga Subtotale. Tocca i calcoli del conto: va fatto con i test della logica prezzi, non solo di interfaccia.

*Dove*: `src/components/OrderPosDetail.jsx, src/lib/pricing.js`

*Nessun test lo verifica.*

### ⬜ REQ-POS-018 — La barra azioni del conto si organizza come quella del browser

Una modalità «organizza» per i comandi del dettaglio conto, come la barra di Firefox o Chrome: si decide QUALI comandi stanno in vista (Unisci/Separa, Dati conto, Prodotto libero, le voci oggi nascoste nel ⋯) e DOVE, con posizionamento libero, e COME si mostrano — icona e testo, solo testo o sola icona. Anche il riquadro del tavolo è un elemento posizionabile. Il precedente è la griglia POS organizzabile (REQ-POS-011): stessa filosofia, qui applicata ai comandi.

*Dove*: `src/components/OrderPosDetail.jsx`

*Nessun test lo verifica.*

## Cassa di serata e statistiche

### ✅ REQ-CASSA-001 — La giornata di lavoro finisce dopo la mezzanotte

La serata appartiene al proprio giorno anche dopo la mezzanotte, fino all'ora di taglio configurata: un drink servito all'una di notte è della serata precedente. L'ora di taglio è un'impostazione (0 = giorno solare).

*Dove*: `src/lib/businessDay.js`

*Lo dimostrano*: `tests/unit/businessDay.test.js`

### ✅ REQ-CASSA-002 — Apertura e chiusura cassa, con fondo e conteggio

La cassa si apre con un fondo e si chiude con il riepilogo della serata: incassato per metodo e per ora, conti chiusi, conti ancora da incassare. Senza cassa aperta non si battono ordini.

*Dove*: `src/lib/cassa.js, src/components/CashFlow.jsx`

*Lo dimostrano*: `tests/unit/cassa.test.js`

### ✅ REQ-CASSA-007 — Il flusso cassa serve DURANTE la serata, non solo alla chiusura

Alla chiusura i numeri sono un verdetto; durante il servizio sono decisioni. La schermata dice, in tempo reale: quanto deve esserci in cassa ADESSO (fondo più i contanti incassati) — prima si sapeva solo alla chiusura, e serve al cambio turno o quando due numeri non tornano; il conto medio, con quanti conti e quanti coperti, e quanto lascia una persona — in un cocktail bar un tavolo da sei e uno da due fanno due serate diverse con lo stesso «conto medio»; chi ha incassato e quanto, perché in una serata si alternano in due o tre alla cassa e se il contante non torna è la prima domanda che ci si fa (l'elenco compare solo se sono stati in più di uno); com'è andata l'ultima ora, non solo la curva della serata: dice come sta andando adesso, se aprire un'altra cassa o mandare qualcuno in pausa. Chi ha incassato è scritto sul pagamento; sui conti battuti prima non c'è e si ripiega su chi ha aperto il conto — meglio un nome vicino al vero che una riga «sconosciuto».

*Dove*: `src/lib/cassa.js, src/components/CashFlow.jsx`

*Lo dimostrano*: `tests/unit/cassa.test.js`

### ✅ REQ-CASSA-008 — La cassa si apre e si chiude dalla coda, ed è cosa del banco

Aprire e chiudere la cassa sono le due cose che si fanno a inizio e fine serata, e si fanno dalla schermata in cui si sta già: nel menu ⋯ della coda c'è «Apri cassa» quando è chiusa e «Chiudi cassa» quando è aperta. SONO DEL BANCO: alla sala non compaiono affatto — né nel menu né come tasto sul banner della cassa chiusa, dove legge che la deve aprire il banco. Un tasto che risponde «non puoi» è peggio di un tasto che non c'è. Andarle a cercare nel flusso di cassa vuol dire uscire dalla coda proprio mentre la si sta guardando. «Chiudi cassa» è spento per DUE motivi, e lo dice in una riga sola. Il primo è di sempre: finché ci sono conti aperti — un conto aperto è un incasso che manca, e chiudere così vorrebbe dire far quadrare una serata con dentro un buco. Il secondo è arrivato con gli stati del servizio: finché ci sono COMANDE ancora da servire. Un conto può essere già incassato e avere drink al banco — si paga in anticipo tutte le sere — quindi «zero conti aperti» non vuol più dire «niente in ballo», e chiudere lì vorrebbe dire mandare a casa la serata con dei drink pagati e mai usciti. Il conteggio dei ticket lo fa comandeDaServire (coda.js): non serviti, non annullati, dei conti che esistono ancora — e vale solo con gli stati del servizio accesi, perché senza le comande risultano servite alla riscossione. Il motivo è corto e sta sotto il tasto: «Prima chiudi 2 conti», «Prima servi 3 comande», o tutti e due in una riga — «Prima chiudi 2 conti e servi 3 comande». Due frasi incolonnate non si leggono in un'occhiata, e quello che serve capire è «non si chiude, e perché». Acceso, porta al flusso di cassa, dove si conta il contante. «Apri cassa» — dal menu o dal banner della cassa chiusa — apre un box che chiede il fondo, facoltativo perché non tutti lo mettono, con «Apri» e «Annulla». Annulla lascia la cassa chiusa: premere per sbaglio e ritrovarsi una serata aperta col fondo sbagliato si sistema solo chiudendo e riaprendo.

*Dove*: `src/components/ApriCassaBox.jsx, src/pages/BartenderPage.jsx`

*Lo dimostrano*: `tests/component/ApriCassaBox.test.jsx`, `tests/unit/coda.test.js`, `tests/component/CodaCorsie.test.jsx`

### ✅ REQ-CASSA-003 — La carta non finisce mai nei contanti

Il contante atteso in cassa conta solo il contante. Ogni metodo è contato col suo nome, anche uno mai visto prima, e i metodi noti compaiono sempre, pure a zero. Le chiusure vecchie senza metodo indicato restano contate come contanti.

*Dove*: `src/lib/cassa.js`

*Lo dimostrano*: `tests/unit/cassa.test.js`

### ✅ REQ-CASSA-004 — Rendiconto della serata: ordini e prodotti venduti

Il rendiconto mostra gli ordini (in lista o in tabella, apribili nel dettaglio) e il cumulativo per prodotto e categoria, con sconto e guadagno per ordine. I prezzi sono quelli VENDUTI, al netto degli sconti, non il listino.

*Dove*: `src/lib/rendiconto.js, src/components/RendicontoSerata.jsx`

*Lo dimostrano*: `tests/unit/rendiconto.test.js`

### ✅ REQ-CASSA-006 — La cassa è una sola: flusso, lista ordini, chiusure

«Cassa» (prima «Flusso cassa») ha tre sottosezioni nel menu laterale: il FLUSSO della serata in corso, la LISTA ORDINI e le CHIUSURE. Erano tre posti per la stessa domanda — quanto ho incassato — e due si raggiungevano da tasti in fondo alla pagina del flusso, che si trovano solo scorrendo fino in fondo; la lista ordini aveva perfino una voce sua nel menu, accanto alla cassa, come se fosse un altro mestiere. Le TIMBRATURE stanno in Staff, in cima alle ore, non in cassa: erano in fondo alla pagina del flusso — dove ci si va per i soldi — e per battere l'ingresso di chi arriva bisognava passare di lì. Il vecchio indirizzo `?tab=storico` continua a funzionare: porta alla cassa, aperta sulla lista ordini. Sta nei collegamenti salvati e nei messaggi, e non deve finire in una pagina senza nome.

*Dove*: `src/components/CassaTab.jsx, src/lib/sezioni.js`

*Lo dimostrano*: `tests/unit/sezioni.test.js`

### ✅ REQ-CASSA-005 — Statistiche per serata, con tempi e margini

Statistiche per serata: incassi, prodotti più venduti, tempi di preparazione e consegna misurati, preparazione più lunga. I tempi misurati raffinano progressivamente la stima mostrata al cliente. SI APRONO SULL'ULTIMA CHIUSURA di cassa, e quel periodo sta PRIMA degli altri nella riga: la domanda del mattino dopo è «com'è andata ieri sera», non «com'è andata la settimana». Prima partivano da sette giorni — un'altra domanda — e la serata era in fondo alla riga. Chi sceglie un altro periodo se lo tiene: la preselezione vale solo alla prima apertura. Le due viste (giornaliero e mensile per macro) sono SOTTOSEZIONI della pagina, come in Magazzino e Impostazioni: stanno nel menu invece che in una riga di chip sopra il contenuto, che costava altezza a una schermata già fatta di tabelle.

*Dove*: `src/lib/stats.js, src/lib/eta.js, src/components/StatsTab.jsx`

*Lo dimostrano*: `tests/unit/stats.test.js`, `tests/unit/eta.test.js`, `tests/component/StatsTab.test.jsx`

## Magazzino

### ✅ REQ-MAG-001 — Le quantità si contano in unità base, si mostrano come si parla

In magazzino tutto è in unità base (ml, g, pz); la visualizzazione usa l'unità comoda (cl per i liquidi, L oltre il litro, g o kg per i solidi). Chi inserisce sceglie l'unità che preferisce e la conversione è automatica: "4 cl" non deve mai diventare 4 pezzi.

*Dove*: `src/lib/inventory.js`

*Lo dimostrano*: `tests/unit/inventory.test.js`, `tests/unit/ricetteUnita.test.js`

### ✅ REQ-MAG-002 — Bottiglie: quante piene, quale aperta, quanto resta

Per gli articoli con confezione nota si mostra quante bottiglie sono piene, quanta ne resta in quella aperta e quante sono finite. Il contenuto non si misura mai in pezzi.

*Dove*: `src/lib/inventory.js bottleBreakdown, bottleSummary`

*Lo dimostrano*: `tests/unit/inventory.test.js`, `tests/component/InventoryManager.test.jsx`

### ✅ REQ-MAG-003 — Le scorte si scalano quando il drink è servito

Il magazzino si scala quando la comanda risulta SERVITA: allora quel drink è uscito per certo. Prima si scaricava alla presa in carico, e un drink iniziato e poi non fatto — riga tolta, cliente che cambia idea, comanda annullata — aveva già portato via gli ingredienti. Con gli stati del servizio spenti non esistono comande da servire: risultano servite alla riscossione, ed è lì che si scala. Incassare, di per sé, non scala niente: seguendo il servizio si paga anche in anticipo, con tre drink ancora da fare. Fra l'una e l'altra cosa gli ingredienti sono IMPEGNATI e si leggono in magazzino (REQ-MAG-014). Si scala una volta sola, salvando lo snapshot del consumo sulla comanda: serve per stornare in caso di annullo e per non scalare due volte. Il magazzino che non risponde non blocca la comanda: resta segnata come non scaricata e si recupera dopo. SOTTO ZERO NON SI SCENDE: si toglie al massimo quello che risulta in giacenza, e un carico su una giacenza negativa riparte da zero. La vendita passa comunque (il conto è già scritto) e il magazzino si ferma a zero: altrimenti il buco resta, il carico dopo conta meno di una bottiglia e il valore in euro va in negativo.

*Dove*: `src/lib/inventory.js computeConsumption, src/lib/comande.js, src/lib/api.js`

*Lo dimostrano*: `tests/unit/inventory.test.js`, `tests/unit/incassoOffline.test.js`, `tests/unit/comande.test.js`

### ✅ REQ-MAG-004 — Modificare un ordine già scalato riallinea le scorte alla differenza

Cambiando le righe di una comanda già scaricata si scala o si restituisce solo la differenza, non l'intero consumo: altrimenti ogni correzione falserebbe il magazzino.

*Dove*: `src/lib/warehouse.js consumptionDiff`

*Lo dimostrano*: `tests/unit/warehouse.test.js`

### ✅ REQ-MAG-005 — Inventario fisico: conta, differenze, valorizzazione

Si registra una conta fisica e si vedono le differenze rispetto al teorico (DEP + ACQ − RIM = CONS, come sui fogli di inventario), con la valorizzazione a costo e IVA.

*Dove*: `src/lib/warehouse.js stockCountCompute, src/components/InventoryManager.jsx`

*Lo dimostrano*: `tests/unit/warehouse.test.js`

### ✅ REQ-MAG-006 — Ordini ai fornitori e fatture d'acquisto

Dal sottoscorta si genera una proposta d'ordine per fornitore, in confezioni intere, esportabile come testo; le fatture d'acquisto si registrano con i totali e aggiornano i costi.

*Dove*: `src/lib/warehouse.js purchaseOrderTotals, suggestedPackages, invoiceTotals`

*Lo dimostrano*: `tests/unit/warehouse.test.js`

### ✅ REQ-MAG-007 — Assortimento: quattro stati per capire cosa si tiene

Ogni articolo è assortimento, linea, premium o fuori servizio. Serve a distinguere quello che si tiene sempre da quello che si compra su richiesta, e a filtrare l'inventario di conseguenza.

*Dove*: `src/lib/inventory.js ASSORTIMENTI`

*Lo dimostrano*: `tests/unit/inventory.test.js`

### ⬜ REQ-MAG-008 — Ricette da riagganciare agli articoli nuovi

Dopo l'import dei costi restano ingredienti che puntano a id di magazzino non più esistenti: quei drink mostrano un costo parziale. Vanno riagganciati agli articoli corretti (alcuni sono accoppiamenti evidenti, altri vanno decisi a mano) e va impedito che una ricetta punti nel vuoto senza accorgersene.

*Dove*: `src/lib/saveDrink.js, requirements`

*Nessun test lo verifica.*

### ✅ REQ-MAG-010 — Il magazzino sta in una schermata, con le sezioni a lato

Prodotti, Conta, Ordini, Scadenzario, Categorie, Macro-categorie, Fornitori e Movimenti si scelgono dalla BARRA IN ALTO: il titolo della pagina è il comando. In pagina costavano spazio fisso tutto il giorno — due file di tasti più tre pannelli a scomparsa, poi una barra a sinistra (che rubava la colonna ai prodotti), poi una riga di schede — per una scelta che si fa ogni tanto. Sul telefono, dove nella barra non ci sta un elenco, si apre il foglio dal basso: lo stesso gesto di «⋯ Azioni», che al banco si conosce già. La ricerca sta sopra; sotto, una riga sola con due TENDINE (filtri di scorta e assortimento, fornitore), il valore di magazzino, card/lista come due icone e il tasto per un prodotto nuovo. Il tasto di una tendina dice cosa è scelto senza doverla aprire. I filtri (tutti, in scorta, in esaurimento, esauriti, e i quattro di assortimento) stanno su UNA RIGA sola, con scritto che sono filtri: sembravano un riepilogo, si leggevano i numeri senza capire che toccandoli la lista si restringeva. Il valore di magazzino è lì accanto ma non si tocca: è un numero da leggere, non un filtro. «IN SCORTA» È LA DOMANDA CHE MANCAVA (segnalato al banco il 18/08, coi 388 articoli veri sotto gli occhi: «al filtro manca quelli in magazzino»). Si poteva chiedere solo cosa sta finendo e cosa è finito; per vedere cosa c'è davvero sullo scaffale bisognava guardare «Tutti» e saltare a occhio due terzi di righe esaurite — 232 su 388. Sta per prima delle tre, che è l'ordine in cui ci si fa le domande, e ha il suo conteggio come le altre. GLI «IN ESAURIMENTO» CI STANNO DENTRO: sono in magazzino, solo pochi. «In esaurimento» è una lente più stretta dentro la stessa famiglia, non un'altra famiglia — e chi guarda cosa c'è vuole vedere anche l'ultima bottiglia di gin, che è proprio quella che gli serve sapere. Così il conto torna a vista: in scorta più esauriti fa il totale, e chi somma le voci non trova numeri che non tornano. QUELLO CHE NON È UNA SCORTA non sta né di qua né di là: il «Tempo di Lavorazione» non ha giacenza, e non è né disponibile né esaurito (vedi REQ-MAG-012). Metterlo fra i disponibili vorrebbe dire dire che c'è sullo scaffale una cosa che sullo scaffale non ci va; fra gli esauriti, mandare a comprare il tempo. Tutto sta nella finestra: filtri, ricerca e categorie restano fermi, a scorrere è solo l'elenco dei prodotti — prima, per tornare alla ricerca dopo aver guardato in fondo, si risaliva da capo. Anche i MOVIMENTI sono una sezione: stavano in fondo alla lista dei prodotti dietro un tasto largo quanto lo schermo, fuori contesto e in mezzo ai piedi.

*Dove*: `src/components/InventoryManager.jsx, src/components/CategoryRail.jsx`

*Lo dimostrano*: `tests/component/InventoryManager.test.jsx`

### ✅ REQ-MAG-012 — Unità generiche: la manodopera entra nel costo del drink

Un articolo di magazzino si può misurare in unità generiche «U», senza contenuto e senza conversioni: serve per quello che non si versa e non si pesa — il «Tempo di Lavorazione», che si aggancia come ingrediente ai drink che richiedono lavorazione perché il lavoro entri nel costo della ricetta e quindi nel prezzo consigliato. Ha un costo per unità, e basta. Prima l'unica scelta possibile era il grammo, e nella ricetta del Daiquiri si leggeva «Tempo di Lavorazione 1 g». Un articolo in U NON È UNA SCORTA, e da qui vengono tre regole: non si scarica quando il drink si fa (resta fuori dal consumo, quindi non si reintegra nemmeno all'annullo); non è mai «esaurito» né «in esaurimento», così il drink che lo usa non sparisce dalla carta al primo che se ne fa e non finisce nelle proposte d'ordine al fornitore; non vale niente nel valore del magazzino, che il lavoro non sta sullo scaffale. Al cliente non si mostra: le righe in unità generiche restano fuori dalla lista ingredienti in carta — «Tempo di Lavorazione 3 U» non è roba da far leggere a chi ordina — e la lista compare da due ingredienti veri in su. Restano visibili dove servono a chi gestisce: ricetta, costi, margini e prezzo consigliato.

*Dove*: `src/lib/inventory.js, src/lib/pricing.js, src/components/InventoryManager.jsx, src/pages/MenuPage.jsx`

*Lo dimostrano*: `tests/unit/inventory.test.js`, `tests/unit/pricing.test.js`, `tests/component/InventoryManagerCard.test.jsx`, `tests/component/MenuPage.test.jsx`

### ✅ REQ-MAG-016 — L'unità è sempre il pezzo: si sceglie solo a cosa corrisponde

Da tre note di Flavio (17/08, 21:11-21:14). Il modello delle unità regge i distillati e poco altro: in magazzino ci finiscono cose molto diverse — il ghiaccio a sacchi, i limoni al chilo, il tempo di lavoro — e ognuna oggi chiede una configurazione sua. Parole sue: «bisogna trovare una soluzione per unificare tutti questi elementi». Il caso che rompe il modello attuale: i LIMONI si comprano al chilo e si usano in cl (da 1 kg esce mezzo litro di succo). Oggi non si può dire, perché peso e volume sono famiglie separate — e giustamente, non esiste una conversione universale fra le due. Ma questa non è una conversione: è una RESA, dichiarata dal locale per quel prodotto. PROPOSTA da approvare con lui: ogni prodotto risponde sempre alle stesse due domande — «come lo compri» (l'unità in cui conti la merce e in cui c'è il prezzo) e «come lo usi in ricetta» — più una terza che compare SOLO se sono diverse: «una unità di acquisto quanto rende?». Una riga sola, letta come si parla: 1 bottiglia = 70 cl, 1 kg di limoni = 50 cl, 1 sacco = 5000 g, 1 confezione = 10 U. Niente sotto-unità, niente divisioni, e le famiglie non c'entrano più: la resa la dichiara chi compra. DECISO da Flavio (17/08): la giacenza si conta in QUELLO CHE SI COMPRA — i chili di limoni, i sacchi di ghiaccio, le bottiglie — perché l'inventario si fa contando quello che c'è sullo scaffale, non il succo che ne uscirà. Le ricette dosano nell'unità d'uso e scalano la loro frazione, come già fanno i cl di gin su una bottiglia. Il modello è quindi completo e si può scrivere: unità d'acquisto (giacenza e prezzo), unità d'uso (ricette), resa fra le due quando sono diverse. Con questo, BUG-014 si chiude da sé. FATTO (1.4.8). `resaUso` (lib/inventory.js) risponde a «una unità base d'acquisto quante unità base d'uso rende?», e da lì passano tutti e tre i conti che contano: lo scarico dal magazzino (qtyInStockUnit), il costo di quello che si versa (costPerUnit) e le unità che si possono scrivere in ricetta (entryUnits). La resa vive su due campi nuovi (`resa`, `resa_unit`) validi per qualunque articolo; per i PEZZI resta buono quello che c'era — `content_unit` + `package_size` — quindi i prodotti già in magazzino non si toccano e si comportano come prima. La scheda prodotto è rifatta sulle tre domande, col «?» in alto che le spiega. La terza — «Quanto rende», o «A quanto corrisponde un pezzo?» per chi si conta a pezzi — è sempre a vista ed è FACOLTATIVA: vuota vuol dire «si usa come si compra». Era dietro un interruttore, ma nasconderla costringeva a cercarla anche a chi la voleva scrivere — una birra, per sapere quanto costa al cl. Sparisce anche la domanda «quanto contiene una confezione» per chi non conta a pezzi: comprando a chili, una confezione È un chilo. Il prezzo si scrive nell'unità d'acquisto (€/kg, €/cl, €/pz, €/U) e sotto resta salvato il costo per confezione, che è quello che il resto dell'app legge da sempre; i prodotti già caricati tengono il loro contenuto e i loro numeri, perché riscriverli vorrebbe dire cambiare i conti di un articolo che nessuno ha toccato. «A QUANTO CORRISPONDE UN PEZZO» È IL CONTENUTO, non la dose del drink: quella la decide la ricetta, drink per drink, e chi confonde le due cose scrive lì i centilitri di un cocktail e scarica il magazzino con numeri che non tornano. Si può lasciare VUOTO — e allora in ricetta si dosa solo a pezzi, che è il caso della birra servita intera — oppure scriverlo, e allora la ricetta sceglie fra il pezzo e l'unità del contenuto (4 cl da una bottiglia da 100 cl scalano 0,04 pezzi). Lo dicono una didascalia sotto al campo e un «?» accanto alla domanda. E la SOGLIA DI AVVISO si scrive sempre nell'unità d'acquisto — è il prodotto comprato che sta finendo, ed è quello che si va a ricomprare: niente più tendina, e l'etichetta dice l'unità. E «SI SCARICA DAL MAGAZZINO?» LO DECIDE IL PRODOTTO, non la sua unità (`eScorta`). La regola stava sull'unità — quello che si conta a unità generiche non si scarica — ed è giusta per la manodopera, che non sta su nessuno scaffale, ma non per il GHIACCIO: si conta a unità e finisce eccome. Il consumo ora conta tutto quello che la ricetta chiede, e a decidere cosa togliere dalla giacenza è chi la scrive, che l'articolo ce l'ha in mano — scarico, riallineo di una comanda modificata, reintegro all'annullo e previsione «a fine serata». Nella scheda, per i soli articoli a unità, c'è la casella «È una scorta: si scarica quando si usa»; di suo è spenta, così la manodopera già a listino non cambia comportamento. Senza resa dichiarata non si inventa niente: costo null e consumo invariato, che è meglio di un numero uscito da una moltiplicazione a caso. RIVISTA (1.4.8, secondo giro, approvato): la scheda parte da UNA domanda — «che tipo di prodotto è?» — con quattro card illustrate in griglia 2×2. «Lo vendo intero» (bottiglie e lattine: pezzi, contenuto facoltativo che serve solo al costo al cl di confronto), «Lo verso nei drink» (pezzi, e «una bottiglia fa…» è OBBLIGATORIO: senza, niente costo al cl né scarico frazionato, e il salvataggio si ferma spiegandolo), «Sfuso, a peso o volume» (limoni al chilo, spina, ghiaccio: unità d'acquisto a scelta fra kg/l/cl/g/U, resa facoltativa «5 kg fanno 1,5 l» con la quantità sui due lati), «Lavoro o servizio» (solo costo per unità: niente giacenza, mai esaurito, in carta non compare). Il tipo decide unità e scorta: spariscono il selettore «Unità d'acquisto» a famiglie, la casella «È una scorta» e ogni «lo uso come lo compro». Il MODELLO DATI NON CAMBIA: si aggiunge solo un campo `tipo` sull'item per le prossime aperture; le schede vecchie, che non ce l'hanno, si riaprono nel tipo dedotto da unità, contenuto e scorta (U non-scorta → lavoro, U con scorta → sfuso, pezzo con contenuto → versato, pezzo senza → intero, il resto → sfuso), senza migrazione. Cambiando tipo su un prodotto esistente valgono gli avvisi di conversione della giacenza di sempre. RIPENSATO (18/08, tre vocali di Flavio uno via l'altro — 14:53, 15:17, 15:22 — vince l'ultimo, che è la sintesi e decide). Prima idea (14:53): «l'unità di misura sono i pezzi, poi dopo i pezzi vengono divisi in cl, grammi e unità di misura non definita» — non più la resa fra unità d'acquisto e unità d'uso di sopra: sempre e solo PEZZO, frazionato da una seconda unità. Guardando l'app (15:17), Flavio boccia la domanda RIVISTA qui sopra («che tipo di prodotto è?», le quattro card): «questa cosa non è male, però secondo me non è molto corretta per un gestionale, cioè va un po' troppo nello specifico». Lo stesso articolo si vende in più modi — il Jägermeister va nel Jägerbombo E si vende a cicchetto da solo, mai la bottiglia intera — e una card sola per prodotto non lo permette. Segnala anche diciture da rivedere: «una bottiglia fa» (100 cl) «non credo sia molto italiana» — la scheda va riletta con questo in mente, non solo quella frase. DECISO (15:22, l'ultima parola: qui non è più una proposta da confermare). «L'unità di misura iniziale deve scomparire, perché non è più selezionabile, in automatico è il pezzo» — FISSO E BLOCCATO, non un campo `tipo` né una scelta fra famiglie. Il campo `tipo` previsto nella revisione qui sopra NON si aggiunge più, e con lui cadono il selettore a quattro card e ogni distinzione fra «lo vendo intero / lo verso nel drink / sfuso / lavoro». La SOLA domanda che il modulo fa è «a quanto corrisponde un pezzo», con tre risposte possibili: unità di CAPACITÀ (l, cl, ml), di PESO (kg, g), o «U» non definita — mai una quarta a piacere: «potremmo caricare tantissime cose con tantissime unità di misura che non sappiamo, e non ce le possiamo mettere a creare ogni volta» — la U resta volutamente generica, il significato sta in testa a chi la usa («lo so io che sono minuti, ma non fa niente»). NESSUN REQUISITO deve prevedere unità di misura personalizzabili dall'utente. CHI DECIDE, TOLTA LA DOMANDA: nessuno dichiara più come si vende un prodotto — la domanda «lo vendo intero / sfuso a peso o volume / lavoro a servizio» sparisce e NON SI SOSTITUISCE con un'altra: quello che decideva lei lo decide adesso la RICETTA. Sue parole: «bisogna fare i conti rispetto all'utilizzo che viene fatto della merce. Quando la merce viene usata in una ricetta, allora la scarichiamo dell'unità di misura che può essere una qualsiasi che sia convertibile dall'unità di misura del prodotto». La quantità di un ingrediente in ricetta si scrive a PEZZI — sempre disponibile, perché è la base — o nell'unità in cui si frazionava (cl, g, U). A rendere possibile il passaggio è proprio «a quanto corrisponde un pezzo» (1 pz = 25 cl, per dire): con quel dato, quello che la ricetta chiede in cl si converte in pezzi per la giacenza. LA GIACENZA NON CAMBIA MAI UNITÀ — resta sempre in pezzi — a convertirsi è solo quello che la ricetta chiede. CASO LIMITE (deduzione di chi scrive questo requisito, non parola sua — DA CONFERMARE): un prodotto senza corrispondenza impostata (nessun «1 pz = …») si può usare SOLO A PEZZI, perché non c'è niente con cui convertire; l'app deve dirlo — proponendo solo i pezzi in ricetta, o chiedendo di compilare la corrispondenza — invece di lasciare scrivere «40 ml» di una cosa di cui non si sa quanto contiene un pezzo, che è il modo più veloce per scaricare numeri a caso. E la «U» non si converte con nulla: un prodotto in unità non definite si usa in pezzi o in U, e va bene così — non è un buco, è la natura di quell'unità. La scelta pezzo-o-frazione non è solo del CARICO, come diceva il primo vocale: vale per QUALUNQUE movimento — «se farmo un carico, uno scarico, qualsiasi cosa esso sia di movimentazione» — chiedendo ogni volta se muovere a pezzi o nell'unità che compone il pezzo. Casi-prova citati a voce: un distillato codificato «1 pezzo = X cl» chiede se caricare a pezzi o a centilitri; il ghiaccio codificato «1 pezzo = X grammi» chiede pezzi o grammi (il numero detto a voce, «8 grammi», è il peso di UN CUBETTO, non di una confezione — vedi sotto); il tempo di lavorazione, pezzi o «U» (minuti, nella testa di chi lo carica). I TRE LIVELLI, e risolvono anche lo SFUSO (chiarito 18/08, oltre i tre vocali sopra): il PEZZO è quello che si prende in mano — un cubetto, un limone, un barattolo, una bottiglia; il CONTENUTO dice a quanto corrisponde quel pezzo, in capacità, peso o U — un cubetto 8 g, una bottiglia 70 cl; il COLLO dice quanti pezzi ci sono nella confezione che si compra — 30 cubetti, 24 birre, una cassetta di limoni. Sono i tre concetti che c'erano già (pezzo, contenuto, collo — quest'ultimo in REQ-MAG-011): il ghiaccio è il caso-prova buono, 1 pz = 8 g e un collo = 30 pz, quindi caricando «1 collo» entrano 30 pezzi, cioè 240 g. Con questo si chiude anche il caso dei LIMONI (comprati al chilo, usati in cl) che era rimasto apertissimo dalla prima nota di Flavio: un limone è un pezzo, e il fatto che si comprino al chilo non rompe niente — è proprio per questo che Flavio vuole poter scegliere l'unità a ogni movimento; si compra 5 kg, si carica A GRAMMI, e i pezzi si ricavano dal contenuto del pezzo. AVVERTENZA ONESTA da scrivere in interfaccia: per la roba comprata a peso il conteggio in pezzi è una STIMA — un limone non pesa sempre uguale — e va bene finché quello che conta davvero è il peso, ma chi legge «47 pz» di limoni deve sapere che nessuno li ha contati uno per uno. IL CARICO A COLLO RESTA (vedi REQ-MAG-011, dove la parola che usa il codice è già «collo», non «cartone»): comprando confezioni intere — 24 birre, per dire — si scrive il prezzo totale del collo e si scompone da sé, prima al singolo pezzo, poi al singolo cl (una bottiglia a 33 cl, non gli «8 cl» della trascrizione del vocale delle 15:17 — il senso è quello della birra da 33, ripetuto poco prima nella stessa frase). Con questo si scioglie anche il punto rimasto aperto in BUG-014 (la «U» nella prima domanda): la prima domanda non c'è più, è sempre pezzo, e la «U» sta sempre — e solo — nella seconda. La MIGRAZIONE dei prodotti già in magazzino a questo modello è un lavoro separato, che si prova diversamente e può essere pronto in un momento diverso da questo requisito: vedi REQ-MAG-018. DA CHIARIRE (AskUserQuestion non disponibile in questo passaggio, quindi non deciso qui): 1) nel vocale delle 15:22 (min 1:00) il distillato d'esempio suona come «il Tangerai» — quasi certamente Tanqueray, ma la trascrizione non è chiara; 2) nel vocale delle 15:17 (min 2:01) un prodotto suona come «la maro del capo», trascrizione poco chiara — non si capisce a cosa si riferisse l'esempio. FATTO (1.5.0). La scheda prodotto non ha più né le quattro card né il selettore dell'unità d'acquisto: si salva sempre `unit: 'pz'` e `display_unit: 'pz'`, e la sola domanda è «a quanto corrisponde un pezzo» — numero più unità fra l, cl, ml, kg, g, U, e nient'altro (le unità non sono personalizzabili, mai). Vuota vuol dire che in ricetta si dosa solo a pezzi. Il campo `tipo` non si scrive più e si azzera su chi l'aveva; la `resa` idem, perché con il pezzo fisso lo stesso legame lo dice già il contenuto e due risposte alla stessa domanda litigano (resaUso preferisce la resa). Il modello dati resta quello di sempre: `package_size` è il contenuto in unità base e `content_unit` dice di che famiglia è. SI SCARICA DAL MAGAZZINO? Resta una casella sulla scheda («È una scorta: si scarica quando si usa», accesa di suo). NON è la domanda tolta il 18/08 — quella diceva come si VENDE — ma la decisione che questo stesso requisito aveva già messo sul prodotto: senza, con l'unità bloccata sul pezzo, il «Tempo di Lavorazione» diventerebbe merce, andrebbe a zero al primo drink e il menù farebbe sparire dalla carta i drink che lo usano. OGNI MOVIMENTO CHIEDE L'UNITÀ: carico e conta hanno accanto alla quantità la scelta fra pezzi e contenuto (`unitaMovimento`), la conversione la fa `qtyInStockUnit` — lo stesso conto dello scarico — e sotto si legge quanto entra davvero prima di confermare. A colli si contano pezzi e basta: un cartone ha dentro pezzi, non centilitri. La giacenza NON cambia mai unità: resta in pezzi. L'AVVERTENZA ONESTA c'è: col contenuto a peso la scheda dice che il conteggio in pezzi è una stima, e il carico lo ripete. Le schede storiche (ml, g, U) si riaprono e passano ai pezzi al salvataggio, con l'avviso di conversione della giacenza di sempre: a volume o a peso si divide per il contenuto di un pezzo, la «U» vale uno a uno perché era già una cosa che si conta. Il travaso in blocco resta REQ-MAG-018.

*Dove*: `src/lib/inventory.js, src/components/InventoryManager.jsx`

*Lo dimostrano*: `tests/unit/inventory.test.js`, `tests/component/InventoryManagerCard.test.jsx`

### ✅ REQ-MAG-018 — I prodotti che ci sono già si travasano al modello nuovo aggiornando l'app, non li riapre uno per uno chi sta al banco

Nasce da REQ-MAG-016 (unità sempre pezzo, con una corrispondenza in capacità/peso/U) ma è un lavoro A PARTE: il modello nuovo e il travaso dei dati vecchi si provano in modo diverso, e uno può essere pronto quando l'altro non lo è ancora — per questo è un requisito suo, non un paragrafo dentro l'altro. IL FATTO: oggi i 388 prodotti di magazzino hanno unità diverse fra loro — liquidi in cl, solidi in grammi, alcuni già a pezzi — e il modello nuovo li vuole tutti a PEZZO con una sola corrispondenza (capacità, peso o U). DECISO da Flavio (18/08): «credo che dobbiamo migrare noi i prodotti al nuovo modello, poi capiamo come» — il travaso non lo fa chi sta al banco riaprendo 388 schede a mano. COME, precisato da lui poco dopo (18/08): «il travaso deve avvenire in fase di aggiornamento. Cioè non dobbiamo farlo direttamente sui db: quando si aggiorna il bundle si aggiornano i prodotti». Niente script di migrazione lanciato contro Firestore, quindi — né in test né altrove. Il travaso è dell'APP, e si fa come si è sempre fatto con gli ordini vecchi, che nessuno ha mai migrato: li rimette in riga `normalizeOrderDoc` alla lettura (REQ-ORD-002). E POI RIPENSATO, sempre il 18/08, guardando l'app: «il travaso dovrebbe farlo l'utente. Quando entra in magazzino un banner gli dice che deve iniziare la migrazione dei dati alla nuova gestione magazzino. Quando preme ok, parte prima un dry run che lo avvisa dei prodotti che devono essere sistemati prima, e poi, se tutto è come se lo aspetta e tutti i prodotti possono essere migrati, allora chiede conferma e migra i dati. Niente di automatico. Se non ha migrato i dati, una notifica fissa che non scompare finché non fa la migrazione deve ricordargli di fare la migrazione prima di inserire nuovi prodotti o modificare i prodotti (può modificare solo quelli da sistemare prima della migrazione)». E: «ovviamente se è già tutto migrato questa cosa non vale» — i dati possono arrivare già a posto da un'altra strada. FATTO (1.5.0), in quattro pezzi. 1) LETTURA TOLLERANTE, che resta: senza, un database non ancora aggiornato non si legge nemmeno. `articoloNormalizzato` (src/lib/inventory.js) prende un articolo com'è scritto e ne restituisce la forma nuova; ci passa `mapItem` in src/lib/api.js, che è il punto da cui entrano nell'app tutti gli articoli — magazzino, ricette, menù, costi. Chi è già a posto torna identico. 2) NIENTE RISCRITTURA SILENZIOSA: il database lo cambia solo un gesto esplicito. `loadStock` e `adjustStock` non riscrivono più niente di nascosto e anzi si fermano (`ATTESA_TRAVASO`) se l'articolo è ancora nella forma vecchia, che sommare pezzi a centilitri fa un numero senza senso. Lo scarico automatico delle comande NON passa di lì: lavora sul documento grezzo, nella sua unità, e la serata non aspetta nessuno. 3) IL GIRO IN MANO A CHI LAVORA (`PannelloTravaso` in InventoryManager.jsx): entrando in Magazzino un banner dice che i prodotti vanno aggiornati e cosa non si può fare nel frattempo; «Guarda cosa cambia» apre la PROVA A VUOTO, che non scrive niente ed elenca per NOME i prodotti da sistemare prima — chi legge deve sapere quali aprire — oppure, se non ce n'è nessuno, quanti prodotti si aggiornano e con quale giacenza prima/dopo. Solo allora compare «Aggiorna N prodotti». La scrittura (`travasaMagazzinoAPezzi` in api.js) va a LOTTI da 25 con l'avanzamento a schermo, ed è ripetibile: ogni giro rilegge cos'è rimasto da fare, quindi interrompersi e ricominciare non tocca due volte lo stesso prodotto. 4) FINCHÉ NON È FATTO il magazzino è in sola lettura: niente carico, niente conta, niente prodotti nuovi, e si possono aprire SOLO i prodotti da sistemare — è l'unico modo di sbloccare. La loro scheda dice cosa manca e a quanto diventa la giacenza. LO STATO NON È UN FLAG: `statoTravaso` guarda se esistono ancora articoli nella forma vecchia. Così resta vero anche se i dati arrivano sistemati da un'altra strada, e su un database a posto non compare niente — né banner né avviso. COSA FINISCE FRA I «DA SISTEMARE», e perché non si indovina: chi si compra in una misura e si usa in un'altra (i limoni al chilo, spremuti in cl: un pezzo può corrispondere a una cosa sola, e sceglierla al posto di chi lavora vuol dire buttare via l'altra — una ricetta che la usava scaricherebbe un chilo dove voleva un grammo); chi si conta a volume o a peso senza dire quanto contiene una confezione; e chi ha un contenuto SENZA MISURA — la «Birra Pils (spina)» vista in test dice che un pezzo contiene 330, ma 330 di cosa? cl, ml, grammi? Indovinare sbaglia il costo di un drink di dieci volte. LE REGOLE DELLA CONVERSIONE, e il perché di ognuna. Il PEZZO è la confezione che si comprava: una bottiglia da 70 cl era già «una confezione da 700 ml», e la giacenza in ml diventa pezzi frazionati — senza stime. Per la «U» il pezzo è l'unità: un sacco di ghiaccio era uno, resta uno. La RESA diventa il contenuto solo quando le due misure sono della stessa famiglia (il fusto comprato a litri e versato a cl). `scorta` va scritta nero su bianco: «si scarica dal magazzino?» aveva un valore di partenza legato all'unità, e portando tutto a pezzi il «Tempo di Lavorazione» diventerebbe merce — a zero al primo drink, e il menù farebbe sparire dalla carta i drink che lo usano. IL CONTENUTO SI LEGGE NELL'UNITÀ IN CUI IL NUMERO SI CAPISCE (`contenutoDelPezzo`): un fusto da venti litri si leggeva «2000 cl» e sembrava un numero inventato; adesso dice «1 pz = 20 L», mentre una bottiglia resta «70 cl» e un cubetto «8 g». SI PROVA IN LOCALE PRIMA, con dati come quelli veri: «dobbiamo fare degli script di seeding da provare in locale» (Flavio, 18/08). `npm run seed:vecchi` (scripts/seed-magazzino-vecchio.js) riempie l'emulatore di prodotti scritti in TUTTE le forme vecchie che esistono davvero — a pezzo con e senza contenuto, contenuto senza misura, a volume, a peso, a volume senza confezione, «U» con e senza scorta, con la resa della stessa famiglia e di due famiglie, col campo `tipo` delle quattro card, con la giacenza sotto zero — più una ricetta che li usa. Gira solo sull'emulatore, su progetto `demo-`, e sta fuori da `seed:tutto`. `node scripts/diagnosi-travaso.js` dice a che punto sta il travaso e, soprattutto, se leggerli a pezzi muove valore, pezzi o costi: non scrive niente, mai, da nessuna parte. DUE DIFETTI VISTI AL PRIMO GIRO VERO (18/08), tutti e due sistemati. Il primo: mentre l'aggiornamento girava, il magazzino dell'emulatore è stato sostituito da un'altra parte; la schermata aveva in mano la lista di un minuto prima, ha provato a scrivere su documenti spariti e il lotto è morto lì. Adesso OGNI LOTTO RILEGGE invece di fidarsi della lista di partenza, e chi non c'è più si salta e si conta a parte («2 prodotti non ci sono più: sono stati saltati. Gli altri sono a posto»). Vale anche al contrario: un prodotto NATO mentre l'aggiornamento gira viene preso dallo stesso giro, invece di restare indietro senza che nessuno lo sappia. E uno che proprio non si lascia scrivere si mette da parte, se no tornerebbe nella lista a ogni giro e la schermata resterebbe lì per sempre. Il secondo: a schermo è finito «NOT_FOUND: no entity to update: app dev~demo-tana-drink path < Element {…} >», in mezzo alla schermata di chi al banco deve solo capire cosa fare. Il motivo tecnico adesso va nella console; a schermo si legge cosa è passato, cosa no, e che si può riprovare senza fare danni — perché è vero, il giro riprende da dove si era fermato. E DA LÌ UNA REGOLA IN PIÙ: il cartello e la prova a vuoto non mentono mai. Il magazzino si legge una volta sola (non è la coda, e va bene così), ma la PROVA A VUOTO rilegge sempre prima di elencare — è quella che si guarda per decidere, e non può parlare di prodotti visti dieci minuti fa — e dopo l'aggiornamento la lista si ricarica, così il cartello sparisce da solo senza ricaricare la pagina a mano. Se nel frattempo è già tutto a posto, il cartello sparisce e basta. VERIFICATO SUI DATI VERI (18/08, sola lettura): su `tana-drink-test` 354 articoli, 350 già nella forma nuova, 4 che si leggono travasati (la mano d'opera in «U», due succhi fatti in casa e lo sciroppo), NESSUNO da sistemare a mano, e valore, pezzi e costi identici a prima. Sull'emulatore col seed dei vecchi: 34 travasati e 3 da sistemare, che sono esattamente i tre casi messi lì apposta. E IL GIRO INTERO SUI DATI VERI (18/08), col magazzino di test copiato nell'emulatore (`scripts/copia-magazzino-da-test.js`): 354 articoli, il cartello dice «4 da aggiornare, 0 da sistemare», l'aggiornamento scrive quei 4, il cartello sparisce da solo, e il valore di magazzino resta 6806,16 € prima e dopo — con nessun numero mosso, articolo per articolo, né in valore né in pezzi né nel costo per unità. QUATTRO VINCOLI DEL MESTIERE, che qui si dimenticano facile: 1) GLI SCRIPT NON TOCCANO LA PRODUZIONE DI PROPRIA INIZIATIVA (CLAUDE.md). Con il travaso fatto dall'app il problema non si pone nemmeno: non c'è niente da lanciare contro le giacenze vere. 2) IL TRAVASO DEVE ESSERE VERIFICABILE: prima e dopo, il VALORE di magazzino, la QUANTITÀ in pezzi e il COSTO delle ricette devono tornare uguali. Se cambiano, la conversione ha mentito — ed è l'unico controllo che se ne accorge da solo, perché un numero sbagliato in pezzi sembra comunque plausibile a chi lo legge. Lo controllano tests/unit/travasoInventario.test.js (compreso il costo di un drink intero, al centesimo) e lo script di diagnosi sui dati veri. 3) IL TRAVASO TOCCA SOLO IL MODO DI MISURARE, NIENT'ALTRO (Flavio, 18/08 ore 15:35): in produzione ha già sistemato a mano, uno per uno, menù e prodotti con i prezzi corretti e le ricette del menù. La conversione tocca unità, contenuto, giacenza, soglia e `scorta`: non prezzi, non ricette, non voci di menù. 4) C'È UNA FINESTRA DI TEMPO (stesso vocale, 15:35): l'unica cosa che Flavio non ha ancora fatto è il CARICO REALE delle giacenze. Con il travaso alla lettura la finestra conta meno — non c'è un momento in cui qualcuno converte tutto — ma resta vero che è meglio aggiornare prima che dopo. RESTA APERTO: gli articoli comprati in una misura e usati in un'altra (i limoni al chilo, spremuti in cl) non si convertono da soli e si leggono ancora nella forma vecchia. Vanno sistemati a mano, decidendo cos'è un pezzo — un limone, e quanto pesa — e sono pochi: la diagnosi li elenca per nome.

*Dove*: `src/lib/inventory.js (articoloNormalizzato), src/lib/api.js (mapItem, loadStock, adjustStock)`

*Lo dimostrano*: `tests/unit/travasoInventario.test.js`, `tests/unit/travasoScrittura.test.js`, `tests/component/TravasoMagazzino.test.jsx`

### ✅ REQ-MAG-017 — Il fornitore si aggiunge dalla tendina del prodotto, come già la categoria nel menù

Scritto da Flavio (18/08, due messaggi di seguito, 15:33 e 15:34 — il secondo semplifica il primo e vince), commentando il modulo «Modifica prodotto» del magazzino in test («Acqua Brillante Tonica»). La tendina Fornitore elenca solo i fornitori che esistono già: se manca quello giusto, oggi bisogna uscire dal prodotto, andare in Fornitori, crearlo, e tornare indietro a ricominciare la scheda — proprio nel momento in cui ci si accorge che manca. Sue parole (15:33): «nella tendina deve comparire il tab AGGIUNGI FORNITORE ed aggiungerlo direttamente da una finestra di info dove basterà confermare solo il nome per poi aggiungere in un secondo momento altre info aziendali». Come deve comportarsi (15:34) non è da inventare: il modello esiste già nell'app, e lui lo indica come esempio — «proprio come succede nel MENU che quando apri la tendina appare NUOVA CATEGORIA». Nel modulo del drink (src/components/DrinkForm.jsx) la tendina Categoria ha in fondo la voce «➕ Nuova categoria…», che apre al volo una finestra dove basta il nome per confermare (onCategoryChange, valore `__new__`). La tendina Fornitore del prodotto di magazzino deve comportarsi allo stesso modo: ultima voce che apre la creazione al volo, basta il nome — il resto dei dati aziendali (indirizzo, contatti…) si compila dopo, con tempo, dalla sezione Fornitori — e il fornitore appena creato resta SELEZIONATO sul prodotto che si stava compilando, senza doverlo riselezionare a mano: se toccasse rifarlo, il giro non si sarebbe accorciato. DA CHIEDERE (segnalato, non deciso qui — per esplicita richiesta di Flavio di non allargare la richiesta da soli): nello stesso modulo, la tendina Categoria del prodotto di MAGAZZINO (non quella del menù, che il comportamento ce l'ha già) è oggi un elenco semplice, senza «+ Nuova categoria» — la stessa mancanza del fornitore, mai segnalata a voce finora. Vale lo stesso trattamento anche lì? FATTO (1.5.0). La tendina Fornitore della scheda prodotto ha in fondo «➕ Nuovo fornitore…», identica alla «➕ Nuova categoria…» del modulo del drink: si sceglie, compare una riga dove basta scrivere il nome e confermare, e il fornitore appena creato resta SELEZIONATO sul prodotto che si stava compilando — se toccasse riselezionarlo a mano il giro non si sarebbe accorciato di niente. Il resto dei dati aziendali (indirizzo, contatti, email per gli ordini) si mette dopo, con calma, dalla sezione Fornitori. L'elenco in memoria si aggiorna da sé senza ricaricare il magazzino: la scheda che lo aspetta è aperta, e ricaricare la chiuderebbe. Ci si può anche ripensare («✕») senza aver creato niente. RESTA DA CHIEDERE, e non l'abbiamo allargato di nostra iniziativa: la tendina Categoria dello stesso modulo (quella del prodotto di MAGAZZINO, non del menù) è ancora un elenco semplice. Vale lo stesso trattamento anche lì?

*Dove*: `src/components/InventoryManager.jsx (select #isup, form prodotto), src/components/DrinkForm.jsx onCategoryChange (il comportamento da copiare)`

*Lo dimostrano*: `tests/component/InventoryManagerCard.test.jsx`

### ✅ REQ-MAG-019 — «pz» al posto di «bottiglie», dappertutto sullo schermo

Decisione di Flavio (18/08), sulle diciture segnalate in REQ-MAG-016 («una bottiglia fa 100 cl» «non credo sia molto italiana»). Testuale: «non dobbiamo vincolarci troppo a un gestionale per un bar. "Bottiglie" non è generico per un gestionale che in qualche modo deve essere generico. Quindi PZ DEVE ESSERE USATO AL POSTO DI BOTTIGLIE OVUNQUE». Riguarda le PAROLE CHE SI LEGGONO A SCHERMO — etichette, placeholder, testi d'aiuto, messaggi d'avviso — non i nomi interni del codice: `bottles_total`, `bottleBreakdown`, `bottleSummary` e i commenti restano come sono, che qui si cambia solo quello che legge chi ha in mano un vassoio. I PUNTI TROVATI (`grep -rn "bottigli" src/ --include=*.jsx`), perché chi implementa non debba ricercarli: 1) l'etichetta del campo contenuto, nel form del prodotto: «Una bottiglia fa…»; 2) il suo placeholder: «Es. 70 per una bottiglia da 70 cl»; 3) le due didascalie sotto lo stesso campo, una per «lo verso nei drink» («4 cl da una bottiglia da 70») e una per «lo vendo intero» («con le altre bottiglie»); 4) il messaggio d'avviso al salvataggio quando il contenuto obbligatorio manca: «Scrivi quanto fa una bottiglia (es. 70 cl)…»; 5) l'aiuto «A quanto corrisponde un pezzo» (tre paragrafi: «una bottiglia da 100 cl» due volte, «la birra in bottiglia»); 6) il sottotitolo «bottiglie, lattine» del tipo «Lo vendo intero», e l'aiuto della domanda «che tipo di prodotto è?», che ripete «bottiglia/bottiglie» cinque volte in tre paragrafi. Gli ultimi due (punto 6) vivono dentro la schermata a quattro card che REQ-MAG-016 (ripensamento 18/08) toglie di mezzo: se le due implementazioni si fanno insieme, quel testo semplicemente non c'è più e non va corretto due volte; se REQ-MAG-016 arriva dopo, va corretto comunque perché nel frattempo resta a schermo. DUE AVVERTENZE. La prima: «una bottiglia fa 100 cl» era sbagliato due volte — la parola (bottiglia → pz) e il VERBO (fa → corrisponde), perché la sostanza del modello deciso il 18/08 è «a quanto corrisponde un pezzo», non «quanto fa» — chi corregge la parola senza correggere il verbo lascia la frase sbagliata a metà. La seconda: nel dettaglio aperto di un articolo (REQ-MAG-002, REQ-MAG-011) restano le «bottiglie piene / aperta / finite» che servono a chi va a contarle sullo scaffale — quella non è la dicitura da cambiare, è un'altra cosa: lì «bottiglia» descrive l'oggetto fisico, non l'unità di misura. FATTO (1.5.0). I punti 1-6 dell'elenco qui sopra vivevano tutti nella scheda prodotto e nella schermata a quattro card, che REQ-MAG-016 ha riscritto: quel testo non esiste più, e al suo posto c'è «a quanto corrisponde un pezzo» — la parola giusta e anche il verbo giusto. Restano corretti qui i tre punti che erano fuori da quella scheda: il titolo dell'assortimento «Bottiglie premium» (ora «I prodotti buoni»), il costo nel dettaglio di un articolo, che si legge «€/pz» e non più «€/conf.», e la riga del generatore ordini, che diceva «1 conf. = 700 pz» — il contenuto letto nell'unità sbagliata, che con la giacenza contata a pezzi era anche un numero falso — e adesso dice «1 pz = 70 cl», con il suggerimento e il campo in pz. Restano volutamente com'erano: le «piene / aperta / finite» del dettaglio, che descrivono l'oggetto sullo scaffale, e le due righe d'aiuto che elencano cosa può essere un pezzo («un cubetto, un limone, una bottiglia, un barattolo») — lì la bottiglia è un esempio fra altri, non l'unità di misura.

*Dove*: `src/components/InventoryManager.jsx`

*Lo dimostrano*: `tests/component/InventoryManagerCard.test.jsx`

### ⬜ REQ-MAG-015 — Macro-categorie di magazzino e di menù, per incrociare speso e incassato

Chiesto da Flavio a voce (17/08, nota delle 20:13). Le macro-categorie oggi sono una cosa sola e stanno sul MAGAZZINO: raggruppano le categorie dei prodotti che si comprano. Servono anche sul MENÙ, sulle categorie dei drink che si vendono — e le due cose vanno tenute distinte («macro-categorie magazzino» e «macro-categorie menù»). A cosa servono davvero: incrociarle. Da una parte quanto si è SPESO in una macro d'acquisto, dall'altra quanto si è INCASSATO in una macro di vendita, e il confronto fra le due — che è la domanda che il locale si fa a fine mese e a cui oggi si risponde a mano. Da decidere prima di scrivere codice: se le due macro vivono nella stessa collezione con un campo che dice a chi appartengono o in due separate; e come si aggancia una macro d'acquisto alla macro di vendita corrispondente (una a una, o molte a molte). FATTO (1.4.8) il primo pezzo: i due elenchi esistono davvero. Le macro hanno un `ambito` ('magazzino' o 'menu', le righe vecchie sono tutte di magazzino), il menù ha la sua sottosezione «Macro-categorie» che raggruppa le categorie dei drink, e su ogni macro di spesa si sceglie a quale macro di vendita corrisponde (`macro_menu_id`). Il pannello è uno solo, condiviso dalle due schermate. DA FARE: il confronto vero e proprio — speso su una macro d'acquisto contro incassato sulla macro di vendita agganciata. Attenzione: la tabella «Mensile per macro» che c'è già confronta acquisti e fatturato sulle macro di MAGAZZINO, spalmando l'incasso di ogni drink sugli ingredienti in proporzione al costo. Le due letture rispondono a domande diverse e vanno tenute distinte, non sovrapposte. RIPENSATO (18/08, vocale delle 15:47 — «discorso abbastanza complesso», parole sue). Il confronto sopra non basta quando un ingrediente finisce in un drink di una macro DIVERSA dalla propria: «un prodotto può essere venduto in due macro categorie differenti». Il gin è semplice — comprato in «distillati», venduto nel Gin Tonic che sta in «alcolici e distillati»: stessa macro, nessun conflitto. Il caso complesso è la SCHWEPPES: comprata come bibita (macro magazzino «birre e bibite»), ma quando finisce in un Gin Tonic — che nel menù sta in «alcolici e distillati» — quella porzione «deve migrare nei distillati». Stesso schema per la RED BULL, comprata come bibita e venduta in uno Jäger Bomb (alcolici e distillati). Sintesi sua: «il menù alla fine controlla il magazzino». INTERPRETAZIONE DA CONFERMARE (non è la sua frase testuale, è la lettura che ne dà chi scrive questo requisito — riportata perché presa alla lettera la frase è irrealizzabile): non è il PRODOTTO a cambiare macro-categoria — la stessa Schweppes si vende anche da sola, quindi non può stare in una macro sola, e cambiarla nell'anagrafica romperebbe il magazzino. A migrare, ai soli fini del CONFRONTO acquistato/venduto/ margine, è il singolo CONSUMO: la porzione di Schweppes versata in quel Gin Tonic si attribuisce alla macro di vendita del drink (distillati), non alla macro d'acquisto del prodotto (bibite). L'anagrafica del prodotto — la sua macro di magazzino — non si tocca mai. Se questa lettura è sbagliata, il rischio è concreto: al primo Gin Tonic venduto il magazzino sballa. CASI DI PROVA (le sue parole, non inventati): la Schweppes comprata in «birre e bibite» e venduta dentro un Gin Tonic conta, in quel consumo, su «alcolici e distillati»; la Red Bull comprata in «birre e bibite» e venduta dentro uno Jäger Bomb conta, in quel consumo, su «alcolici e distillati». CONFERMATO E PRECISATO (18/08, vocale delle 15:52). La lettura qui sopra e' quella giusta, e lui la irrigidisce: non si scompone NIENTE. Parole sue: «non mi deve fare la scomposizione della ricetta [...] e' tutto l'items che va nella macro categoria», e ancora «la Schweppes l'ho venduta come se fosse un distillato in quel momento, perche' integrato». Quindi la vendita di una voce di menu si attribuisce INTERA alla macro di quella voce — incasso e costo di tutti i suoi ingredienti insieme — e non si spalma sulle macro dei singoli prodotti che la compongono. E dice anche cosa il programma NON deve fare, indicando una cosa che gia' fa: «credo che sia la cosa che sta facendo adesso». E' la tabella «Mensile per macro» descritta qui sopra, che spalma l'incasso di ogni drink sugli ingredienti in proporzione al costo: quella scomposizione va tolta, non affiancata. DECISO (18/08, dall'utente): il COSTO DEL VENDUTO segue la vendita. La porzione di Schweppes finita in un Gin Tonic conta su «alcolici e distillati» insieme al suo incasso; in «birre e bibite» resta solo quello che e' stato venduto COME bibita, incasso e costo. Cosi' il margine per macro torna: ogni macro confronta soldi entrati e costo di quello che ha venduto davvero, senza pezzi che arrivano da un'altra parte. IL ROVESCIO NON E' UN COMPROMESSO, E' LA COSA GIUSTA. Da questa tabella non si legge piu' «quanto ho speso in bibite», e va bene cosi' (parole sue: «ed e' giusto che non sia piu' leggibile da li'»). Questa tabella risponde a UNA domanda — quanto rende ogni macro di quello che vendo — e un numero che parla d'altro, in mezzo, la renderebbe ambigua invece che piu' ricca. «Quanto ho speso in bibite» resta una domanda vera, ma e' degli ACQUISTI — le fatture, quello che e' entrato dalla porta — e vive dove stanno gli acquisti, non qui. Non serve nemmeno spiegarlo sotto la tabella: non c'e' niente da giustificare, c'e' una colonna che non deve esserci. DA TOGLIERE, non affiancare: la scomposizione di `splitLineRevenueByMacro` (src/lib/macroStats.js), che spalma l'incasso di ogni drink sugli ingredienti in proporzione al costo. Con la regola qui sopra non serve piu' a nessuno, e due letture diverse della stessa serata convivendo sono il modo migliore per non fidarsi di nessuna delle due. RESTA APERTA UNA COSA del vocale delle 15:47, e qui non e' decisa: lui dice che le macro-categorie «sono indissolubilmente legate», che magazzino e menu «convogliano insieme nelle macro categorie che sono le stesse, non sono separabili». Oggi invece gli elenchi sono DUE (campo `ambito`, magazzino e menu) con un aggancio dall'uno all'altro, e sono due perche' il 17/08 aveva chiesto di tenerli distinti. Le due frasi possono voler dire la stessa cosa — stessa famiglia di nomi, guardata da due parti — oppure che l'elenco dev'essere uno solo: da chiedere, perche' se e' uno solo l'aggancio `macro_menu_id` non serve piu' e le due sottosezioni tornano una. IN QUALE MESE cade quello che si e' comprato e' un'altra domanda ancora, e sta a parte in REQ-MAG-021 (vocali del 18/08 sera).

*Dove*: `src/lib/macros.js, src/components/InventoryManager.jsx, src/components/StatsTab.jsx`

*Lo dimostrano*: `tests/component/MacroCategoryManager.test.jsx`

### ✅ REQ-MAG-014 — Le scorte dicono anche quello che ti ritrovi a fine serata

A metà serata, sui tavoli, ci sono drink già fatti e conti non ancora chiusi: quel gin è promesso anche se il magazzino non l'ha ancora scalato. Accanto alla giacenza c'è una colonna «A fine serata» con quello che resterà se tutti i conti aperti vengono incassati così come sono — perché la domanda vera, quando si guardano le scorte durante il servizio, è «mando qualcuno a prendere una bottiglia?». Si conta appena l'item entra nel conto, e si conta solo quello che il magazzino non ha GIÀ scalato: contare anche le comande già scaricate vorrebbe dire togliere due volte lo stesso drink. Lo scarico vero resta dov'è (comanda presa in carico o riscossione): questa è la parte ancora incerta, non un movimento di magazzino. Non si scrive niente sul database: il numero si rifà ogni volta dai conti aperti. Una prenotazione scritta andrebbe disfatta a ogni riga tolta, a ogni conto annullato o riaperto, e alla prima strada che salta resterebbe un impegno fantasma che nessuno sa più togliere. La colonna sparisce quando non c'è niente in ballo — cassa chiusa, o nessun conto aperto che chieda quel prodotto — invece di ripetere la giacenza che si legge accanto.

*Dove*: `src/lib/impegnato.js, src/components/InventoryManager.jsx`

*Lo dimostrano*: `tests/unit/impegnato.test.js`, `tests/component/InventoryManager.test.jsx`

### ✅ REQ-MAG-013 — I numeri del magazzino si scrivono come li si pensa

Nel modulo di un prodotto, il contenuto per confezione e la soglia di avviso hanno accanto la scelta dell'unità. Il contenuto si scrive «0,7 l» com'è stampato sull'etichetta, invece di 700 su un articolo contato in ml; la soglia si scrive in PEZZI — «avvisami quando resta una bottiglia» — che è il modo in cui la domanda si fa al banco, e non in 700 ml. Le opzioni sono solo quelle che hanno senso per come si conta l'articolo (litri, cl, ml per un liquido; kg e grammi per un peso), più i pezzi sulla soglia. Il valore salvato non cambia: cambia come lo si digita, e la conversione è la stessa che usa lo scarico dalla ricetta — altrimenti la soglia direbbe una cosa e il magazzino un'altra.

*Dove*: `src/components/InventoryManager.jsx, src/lib/inventory.js`

*Lo dimostrano*: `tests/unit/inventory.test.js`

### ✅ REQ-MAG-011 — In magazzino si contano i pezzi, con la virgola

La colonna delle scorte dice quanti PEZZI ci sono, decimali compresi: una bottiglia da 100 cl con dentro 50 cl è «0,5 pz»; due piene da 50 cl e una a cui mancano 10 cl fanno «2,8 pz». Prima si leggeva «3 bott.», che dice quante bottiglie si toccano e non quanto prodotto c'è dentro: tre bottiglie di cui una quasi vuota contavano come tre, e per sapere se bastavano per la serata bisognava aprire il dettaglio. Gli articoli già contati a pezzo (le bibite) dicono il loro numero. Accanto NON si scrive più «piena / aperta 46 cl / esaurito»: col conteggio a pezzi quello stato è già nel numero — «0,5 pz» dice da sé che è mezza, «0 pz» che è finita — e ripeterlo era una didascalia. Nel dettaglio restano le bottiglie — piene, aperta, finite — che servono a chi va a contarle sullo scaffale. La parola in tutta l'app è MAGAZZINO, non «Inventario»: è come lo chiama chi ci lavora. Gli identificativi interni (il tab `inventario`, la collezione `inventory_items`) restano, che cambiarli vorrebbe dire migrare dati e indirizzi per un nome. LE UNITÀ RESTANO COERENTI: il pezzo è la bottiglia, il contenuto si misura sempre in cl/ml (o g/mg), mai in pezzi — si leggeva «1 aperta (40 pz) · 1 conf. = 200 pz». La scala è cartone → pezzi → contenuto: caricando, dicendo quanti pezzi ha un cartone i pezzi si riempiono da sé (2 × 24 = 48); chi carica bottiglie sfuse lascia il cartone da parte e scrive i pezzi. Non tutti i prodotti arrivano in cartone, quindi il cartone non è un dato del prodotto: è un modo di contare al momento del carico. Un prodotto si può DUPLICARE, fra Modifica ed Elimina: il magazzino è pieno di quasi-uguali — stessa bottiglia in due formati, lo stesso amaro di un altro fornitore — e rifarli da zero vuol dire ribattere costo, confezione, categoria, soglia e IVA. La copia nasce con la giacenza a ZERO (è un prodotto che non è mai entrato in magazzino) e apre subito la scheda, perché il nome «(copia)» va cambiato. I NUMERI SI SCRIVONO COME SI LEGGONO: due decimali al massimo e la virgola, mai il numero grezzo del calcolo — sulla card del Campari si leggeva «7.49000000001 pz». E sotto al numero grande dei pezzi ci va il CONTENUTO in cl (o in g), che è quello che serve a chi sta versando: per gli articoli contati a pezzo ripeteva lo stesso dato di sopra. Il dettaglio aperto STA DENTRO LA CARD: etichetta sopra e valore sotto, perché la griglia a due colonne della vista a Lista, dentro una card stretta, lascia al valore una colonna larga un dito e manda il testo a capo a fisarmonica. Vale anche per la fila dei tasti in fondo (modifica, duplica, elimina): le colonne si stringono e vanno a capo da sé secondo la larghezza della CARD e non della finestra — una @media non vedrebbe mai una card stretta su un monitor grande — e nel caso peggiore la parola si tronca invece di sfondare il bordo. Nella vista a Lista, dove lo spazio c'è, non cambia niente. CONFERMATO (18/08, ore 15:17 — Flavio chiedeva a voce che la scala cartone → pezzi → contenuto valesse anche per il PREZZO): c'è già, dentro il form del prodotto (`InventoryManager.jsx`), dove il «cartone» si chiama COLLO. Si scrive «Totale collo (€, netto)» e il costo unitario si ricava dividendo per i pezzi del collo (`colloTot / p`); si legge anche il totale +IVA, per confrontarlo con quello del fornitore. Dal costo al pezzo discende il costo al cl (`costPerCl`, mostrato da `UnitPrice`) come per ogni altro prodotto. Nessun lavoro da fare qui: annotato perché la parola detta a voce («cartone») non è quella del codice («collo»), e cercandola con quella non si trova.

*Dove*: `src/lib/inventory.js, src/components/InventoryManager.jsx`

*Lo dimostrano*: `tests/unit/inventory.test.js`, `tests/component/InventoryManager.test.jsx`

### ✅ REQ-MAG-009 — Macro-categorie: il magazzino letto per famiglie

Le categorie di magazzino si raggruppano in macro-categorie (distillati, birre, bibite…): servono a leggere consumi, valore e margini per famiglia invece che articolo per articolo, e a capire dove se ne va il denaro.

*Dove*: `src/lib/macros.js, src/lib/macroStats.js, src/components/MacroCategoryManager.jsx`

*Lo dimostrano*: `tests/unit/macros.test.js`, `tests/unit/macroStats.test.js`

### ⬜ REQ-MAG-020 — La resa di un prodotto sta dietro un interruttore

Chiesto dall'utente il 18/08. Il blocco «Si usa in un'altra misura? (facoltativo)» sta sempre aperto nella scheda del prodotto, coi campi vuoti in grigio: occupa mezza scheda per una cosa che riguarda pochi prodotti, e chi apre la scheda per cambiare un prezzo se la trova davanti come se dovesse compilarla. Va dietro un interruttore, spento di suo, con l'etichetta in parole da locale e sotto la riga di spiegazione che c'è già (quella dei limoni). DUE COSE DA NON SBAGLIARE: se il prodotto ha già una resa impostata l'interruttore nasce ACCESO e i campi si vedono — se no chi apre un prodotto già configurato crede di aver perso il dato, o peggio non si accorge che c'è e ragiona su numeri sbagliati; e spegnendolo con una resa dentro non deve sparire in silenzio, perché quel numero cambia come si scala il magazzino. Stessa forma dell'interruttore che c'è già in quella scheda: due interruttori scritti in due modi nella stessa schermata sembrano fare cose diverse.

*Dove*: `src/components/InventoryManager.jsx`

*Lo dimostrano*: `tests/component/InventoryManagerCard.test.jsx`

### ⬜ REQ-MAG-021 — Un acquisto conta nel mese in cui si consuma, non in quello in cui si compra

Chiesto da Flavio a voce (18/08, sei vocali di fila fra le 21:34 e le 21:40). Oggi un acquisto conta nel mese in cui è stato caricato. Lui vuole che conti nel mese in cui la merce viene CONSUMATA, cioè venduta: «in realtà non conta quando l'acquisto tanto quanto quando lo vendo». La tabella mensile serve a mettere di fronte quello che è entrato e quello che è uscito, e due numeri che parlano di merci diverse non si confrontano. COME SI MUOVE. L'acquisto nasce nel mese in cui si carica; poi, man mano che quella merce viene consumata, la quota consumata ESCE dal mese di carico ed ENTRA nel mese del consumo. Parole sue: «me la toglie da febbraio e me la mette a marzo». Conseguenza che ha detto lui stesso, e che va accettata: i mesi passati non restano fermi, «gli acquisti non restano sempre uguali, possono aumentare possono diminuire a seconda di dove ho utilizzato quella materia». LA GRANA È LA PORZIONE, non la fattura e non la bottiglia. Il suo esempio più chiaro: un rum Bumbu da 50 euro comprato il 20 febbraio, il primo Bumbu servito il 3 marzo. Quella porzione va su marzo, e «mano a mano che la vado a consumare a marzo, me la toglie da febbraio e me la mette a marzo»; se la bottiglia avanza, quello che si consuma ad aprile finisce ad aprile, «finché non acquisto una nuova bottiglia o finché non finisco quella». SECONDO ESEMPIO, a unità intere: il 20 febbraio ci sono 10 Schweppes in casa e si compra un cartone da 24. A febbraio si consumano solo le 10 vecchie. Il 1° marzo il primo gin tonic prende la prima delle 24: quella singola unità passa a marzo. PERCHÉ NASCE. Non è teoria contabile, è quello che gli sballa i conti: «finché queste cose succedono a inizio mese è probabile che acquisto in un mese e vendo nello stesso mese, ma quando faccio un acquisto a fine mese, quell'acquisto io probabilmente lo utilizzerò nel mese entrante». Una spesa grossa fatta il 30 del mese oggi affonda il mese che finisce e regala margine a quello che comincia. DA CONFERMARE — quale carico si consuma per primo. Dalle sue parole («finché non acquisto una nuova bottiglia o finché non finisco quella») si legge che si consuma prima la merce più vecchia, e che a migrare è il costo del carico da cui si sta attingendo. Non l'ha però detto come regola, e cambia i numeri quando lo stesso prodotto è stato comprato a prezzi diversi: va confermato prima di scrivere codice. DOMANDE APERTE, da portare a chi ha parlato e non da indovinare: (1) la merce che non viene MAI venduta — rotture, cali, sfrido, quello che sparisce e si scopre all'inventario — resta nel mese di acquisto per sempre, o esce nel mese in cui l'inventario la scarica? (2) un mese già guardato cambia anche mesi dopo: va bene che febbraio letto a maggio dia numeri diversi da come si leggeva a marzo, o a un certo punto un mese si chiude e non si tocca più? (3) questa regola vale solo per la vista mensile degli acquisti, o anche per il registro delle fatture e per la valorizzazione dell'inventario, dove l'acquisto è un fatto con la sua data? DA SAPERE PRIMA DI STIMARLA: per dire da quale carico esce quello che si consuma serve tenere traccia dei carichi uno per uno, e oggi il magazzino tiene la giacenza, non i lotti. Il lavoro grosso è lì, non nella tabella. SI INCASTRA CON REQ-MAG-015, e le due non si confondono: quella dice a quale MACRO va attribuita una vendita, questa dice in quale MESE va attribuito un acquisto. Vivono nella stessa tabella e vanno pensate insieme.

*Dove*: `src/lib/macroStats.js, src/lib/stats.js, src/components/StatsTab.jsx (vista «Mensile per macro»)`

*Nessun test lo verifica.*

## Interfaccia

### ✅ REQ-UI-015 — Staff e Utenti hanno tre sezioni, come le altre pagine

Staff: calendario, timbrature, nuovo turno, paghe orarie. Utenti e ruoli: utenze registrate, nuovo account, buoni VIP. Erano pannelli a scomparsa in cima alla pagina: aprirli spingeva giù quello che si era venuti a guardare — il calendario, l'elenco delle utenze — e per tornarci bisognava richiuderli. Nel menu laterale costano zero e si raggiungono da qualsiasi punto della pagina. Chi non è amministratore, in Utenti, ha solo l'elenco: le altre due non sono cose sue.

*Dove*: `src/components/StaffHoursTab.jsx, src/components/UtentiTab.jsx`

*Lo dimostrano*: `tests/component/UtentiTab.test.jsx`, `tests/component/StaffHoursTab.test.jsx`

### ✅ REQ-UI-016 — Le attese si vedono, e dicono cosa stanno aspettando

Dove l'app deve aspettare — l'accesso, la cassa, il listino, la ricerca nello storico — c'è un'attesa animata con scritto CHE COSA si sta aspettando. Una scritta ferma su una pagina vuota non si distingue da un'app piantata: chi guarda non sa se aspettare o ricaricare. Non c'è una percentuale: non si sa quanto ci vuole, e una barra che si ferma a metà è peggio del silenzio. Chi ha chiesto meno animazioni vede i pallini respirare invece di saltare.

*Dove*: `src/components/Caricamento.jsx`

*Lo dimostrano*: `tests/component/Caricamento.test.jsx`

### ✅ REQ-UI-017 — La password si può guardare

Accanto a ogni campo password — accesso del banco, accesso e registrazione dei clienti, cambio password nel profilo, conferma per eliminare l'account — c'è l'occhio che la mostra. Al banco si entra da un tablet, spesso con le mani bagnate e una tastiera a schermo che sbaglia da sola: scritta a pallini, davanti a un «credenziali errate» non si sa se è sbagliata la password o una lettera partita male. Parte sempre COPERTA: al bancone c'è sempre qualcuno dietro le spalle, e mostrarla dev'essere una scelta, non la condizione di partenza. L'occhio sta fuori dal giro del tabulatore: chi compila con la tastiera passa dalla password al tasto «entra», non da un interruttore in mezzo.

*Dove*: `src/components/CampoPassword.jsx`

*Lo dimostrano*: `tests/component/CampoPassword.test.jsx`

### ✅ REQ-UI-018 — Le righe del conto si riordinano come le card della griglia

Nel dettaglio del conto le righe si spostano trascinandole, con la stessa libreria della griglia dei prodotti: la riga segue il dito e le altre si scansano da sole. Prima era fatto a mano, a lungo-premuto: la riga saltava, le altre no, e capitava di spostarne una mentre si voleva solo toccarla. Si entra in «organizza» come nella griglia — un interruttore che fa comparire le maniglie — e fuori di lì toccare una riga la APRE, che è quello che si fa mille volte a sera. Le righe già pagate non si spostano: stanno in fondo, ferme. E nella coda, aprendo le azioni di una card, cresce SOLO quella: le altre della stessa riga restano come sono e quelle sotto scendono. Prima si allungavano tutte insieme — mezzo schermo di riquadri vuoti per un menu di sei tasti.

*Dove*: `src/components/OrderPosDetail.jsx, src/index.css`

*Lo dimostrano*: `tests/component/OrderPosDetail.test.jsx`

### ✅ REQ-UI-014 — La barra delle sezioni si stringe a icone, o si toglie di mezzo

La barra delle sezioni a sinistra (magazzino, menù, impostazioni) si stringe col tasto in cima e la scelta resta, pagina per pagina. Stringere vuol dire «a icone» — ma solo dove le icone ci sono: se le voci non hanno né icona né colore, come le categorie del magazzino, restava una colonna di pastiglie grigie tutte uguali, brutte e mute, perché non c'era modo di sapere quale fosse quale. Lì le voci si tolgono di mezzo del tutto e resta il solo tasto per rimetterle: le sezioni sono a un clic invece che a un indovinello. Non c'è un modo per farla sparire senza ritorno: il tasto per riaprirla resta sempre visibile, altrimenti si perde l'unico modo di girare fra le sezioni.

*Dove*: `src/components/CategoryRail.jsx, src/index.css`

*Lo dimostrano*: `tests/component/CategoryRail.test.jsx`

### ✅ REQ-UI-019 — Un tema porta anche le forme, e arriva su tutti i colori

Un tema non è una tavolozza. Pico e Catppuccin hanno un MODO di fare le cose — angoli, tasti piatti o col gradiente, ombre — e prendendone solo i colori restava tutto con la faccia della Tana ridipinta: si sceglieva «Pico» e si trovavano i tasti dorati con gli angoli morbidi. Le forme stanno in `FORME` (tre famiglie: tana, catppuccin, pico) e ogni preset dichiara la sua. Sono otto token — raggio di card, bottoni, pillole e campi, fondo del bottone, ombra del bottone e della card, font dei titoli — e OGNI famiglia li dichiara tutti, perché applyTheme scrive sullo stile di :root e un token lasciato indietro resterebbe appiccicato al tema successivo. E il tema arriva dappertutto: l'oro di casa era scritto a mano in una dozzina di posti (il tab acceso, il «+», i tasti dei pannelli, gli aloni del fondo pagina) e quelli ignoravano il tema. Adesso il colore dell'azione è uno solo e viene dai token; il testo sul tasto (`--btn-ink`) si decide dalla luminanza del colore d'azione, perché cablato scuro sarebbe stato nero su nero su un tema con l'azione scura. Un test boccia il dorato riscritto a mano nel foglio di stile. La personalizzazione a mano resta ai soli colori: le forme vengono dal preset.

*Dove*: `src/lib/themes.js, src/index.css, DESIGN.md`

*Lo dimostrano*: `tests/unit/temi.test.js`, `tests/unit/css.test.js`

### ✅ REQ-UI-001 — Le sottosezioni di una pagina stanno sotto il titolo

Quello che si fa ogni tanto (paghe, un turno a mano, le categorie, la marginalità) sta in una fila di tasti subito sotto il titolo, e si apre lì: uno alla volta, e il contenuto si monta solo all'apertura.

*Dove*: `src/components/SectionPanels.jsx`

*Lo dimostrano*: `tests/component/SectionPanels.test.jsx`

### ✅ REQ-UI-002 — Impostazioni in dieci gruppi, coi riquadri impilati

I riquadri delle impostazioni sono più di venti, ma le voci del sottomenu sono DIECI GRUPPI, accorpati per «a cosa afferisce» l'impostazione (Menù e catalogo, Servizio, Cassa e giornata, Prezzi e supplementi…): scegliendo un gruppo i suoi riquadri si impilano uno sotto l'altro, e la scelta si ricorda. Con una voce per riquadro l'elenco era più lungo delle impostazioni; prima ancora era una pagina lunghissima da scorrere a occhio. Da tablet in su la schermata sta TUTTA dentro il viewport: a scorrere sono i due pannelli — l'elenco delle sezioni e il contenuto — ognuno per conto suo, e non la pagina con dentro la testata, che scorrendo via si portava dietro l'elenco proprio mentre lo si usava. L'altezza NON si calcola: la pagina si divide in tre (testata, quello che resta, piè di pagina) e il mezzo si prende quello che avanza. Provando a farla col righello — 100dvh meno la testata, meno il piè di pagina, meno il respiro in fondo — restava fuori ogni volta un pezzo diverso: prima la pagina sforava, poi avanzava un buco sotto. Sul telefono, dove l'elenco passa in orizzontale sopra al contenuto, si scorre come sempre.

*Dove*: `src/components/SettingsTab.jsx`

*Lo dimostrano*: `tests/component/SettingsTab.test.jsx`

### ✅ REQ-UI-003 — Sul telefono la barra ha il tasto, il titolo e due azioni

In barra ci stanno il menu, il logo col nome, la campanella e i tre puntini; tutto il resto sta nel menu dal basso, con bersagli da 44px. Chi è collegato si riconosce dall'iniziale nel quadratino, la stessa che marca gli ordini che ha aperto.

*Dove*: `src/App.jsx, src/components/ActionSheet.jsx`

*Lo dimostrano*: `tests/component/StaffDrawer.test.jsx`, `tests/unit/css.test.js`

### ✅ REQ-UI-004 — Zoom della pagina per chi ci lavora ore

Nella PWA a tutto schermo il browser non offre lo zoom: l'app ha il suo, che scala la pagina senza deformarla. Sul telefono non flotta sull'angolo (dove finiva sopra i tasti) ma sta nella testata del conto. Con un pannello aperto — il foglio dei ⋯, una conferma, il menu laterale — passa dietro e non si lascia toccare: stando in basso a sinistra finiva sopra le ultime voci, e si premeva lo zoom al posto della voce. I tasti compaiono SOLO dove servono: coda ordini, il conto (creazione, apertura, incasso) e flusso cassa — le schermate dove si legge tanta roba fitta stando fermi a guardarla. Altrove sono due tasti flottanti che coprono il contenuto per una cosa che lì nessuno usa: nel magazzino e nelle impostazioni si scorre. Il livello scelto non si azzera cambiando pagina: si smette solo di poterlo cambiare da lì. Al cliente non servono, il suo browser lo zoom ce l'ha.

*Dove*: `src/components/ZoomControl.jsx, src/lib/zoomDove.js`

*Lo dimostrano*: `tests/component/ZoomControl.test.jsx`, `tests/unit/zoomDove.test.js`

### ✅ REQ-UI-005 — Temi chiari e scuri, per il gestionale e per il cliente

Si scelgono due temi distinti: uno per le schermate di lavoro e uno per la vista cliente. I colori di stato restano leggibili su entrambi.

*Dove*: `src/lib/themes.js, src/components/ThemeSettings.jsx`

*Lo dimostrano*: `tests/unit/themes.test.js`, `tests/unit/themes-dom.test.js`

### ✅ REQ-UI-006 — L'app segue chi guarda, non l'indirizzo

La barra in cima è la stessa su ogni schermata — menu, logo col nome e, a destra, chi è collegato — e il menu laterale risponde a tutti: allo staff il gestionale, a chi ordina il suo (menù, i propri ordini, accesso e profilo). Fanno eccezione le due schermate in cui si compone un conto, dove non c'è menu e si esce con «← Ordini». Nelle sezioni del gestionale l'«indietro» sta nella barra, fra il ☰ e il marchio: dentro la pagina si mangiava la prima riga di contenuto. E accanto al marchio c'è il TITOLO della pagina e della SEZIONE che si sta guardando (icona compresa). A cambiare sezione si va nel menu a scomparsa, che sotto la pagina aperta elenca le sue sezioni: un posto solo per navigare, uguale sul telefono e sul computer. Le altre strade non reggono — una colonna o una riga di schede in pagina costano spazio tutto il giorno, le schede in barra reggono cinque voci e non ventidue, una tendina va aperta per sapere cosa c'è dentro. Al posto di un titolo dentro il contenuto: su un tablet al banco una riga in meno di contenuto si vede. Le voci del menu laterale e i titoli sono lo stesso elenco, in un posto solo, se no prima o poi uno dice «Lista ordini» e l'altro «Storico». Sul telefono il titolo sparisce: lì la barra ha già poco spazio. Vale anche per il proprio profilo, dove stava in fondo alla pagina e si chiamava «Torna al gestionale» — lo si trovava solo scorrendo, ed era l'unico a chiamarsi in un altro modo. Nella coda non c'è, perché è la schermata di partenza. Anche i colori seguono il ruolo: chi lavora vede il tema del gestionale ovunque, profilo e accesso compresi; chi ordina vede il suo, e così l'anteprima «vista cliente». Sempre per la stessa ragione, chi è dello staff non passa dalla vetrina: aprendo la home finisce dritto nella lista ordini. Unica eccezione il QR del tavolo (?tavolo= / ?group=), che porta al menù anche se a inquadrarlo è chi sta dietro al banco. E all'inizio della sessione non si finisce mai dentro il POS: se l'app si riapre lì — scheda rimasta aperta, accesso appena fatto — si torna alla lista ordini, perché il POS riprende da sé il conto lasciato in corso e ci si ritroverebbe a battere righe in un conto che non si è scelto. Vale una volta sola, all'avvio: dopo, «Nuovo ordine» e il ➕ portano al POS come sempre.

*Dove*: `src/App.jsx, src/components/ClientDrawer.jsx`

*Lo dimostrano*: `tests/component/AppHeader.test.jsx`, `tests/unit/sezioni.test.js`

### ⚠️  REQ-UI-007 — La testata della coda sta su una riga sola

Da tablet in su, nella testata della coda titolo, ricerca e ⋯ stanno tutti sulla stessa linea e alti quanto il ☰ (42px), che è fisso e fuori dal flusso; conteggi e legenda degli autori vanno sulla riga sotto. Prima i conteggi stavano dentro il titolo, il titolo cresceva in altezza e ognuno degli altri si centrava a un'altezza diversa. Il ➕ resta invece grande com'era (60px) e sporge dalla riga: è il tasto che si prende di corsa e con le mani occupate, e un bersaglio largo vale più di una riga allineata. Siccome è il ➕ a dare l'altezza alla riga, il ☰ flottante si scosta di 21px dal bordo e non di 12: così il suo centro cade su «In servizio» invece di restare un dito più in alto. Sul telefono la testata resta a due piani — titolo rientrato per fare posto al ☰, ricerca a tutta larghezza — e conteggi e legenda partono dal bordo, allineati alla barra di ricerca che hanno sotto invece di stare sospesi a metà.

*Dove*: `src/pages/BartenderPage.jsx, src/index.css`

*Nessun test lo verifica.*

### ✅ REQ-UI-008 — Dallo schermo intero si esce dallo stesso tasto con cui si entra

Da browser il tasto ⛶ porta a schermo intero e, richiamato, ne fa uscire: vale sia per il tasto in barra sia per la voce nei ⋯ del telefono, che cambiano icona e parole quando si è dentro. Il tasto non compare a chi ha installato l'app, che gira già senza barre — ma "installata" non va confusa con "a schermo intero adesso": il browser risponde di sì a `display-mode: fullscreen` anche quando ci siamo andati noi con l'API, e il tasto per uscire spariva proprio quando serviva. Al banco il tablet è montato e la tastiera non c'è: senza tasto non si esce.

*Dove*: `src/lib/useSchermoIntero.js, src/App.jsx`

*Lo dimostrano*: `tests/component/SchermoIntero.test.jsx`

### ✅ REQ-UI-009 — La ricerca nella coda: filtra, oppure accende il conto e ci porta lì

Cercando nella coda per numero, cliente, tavolo, chi ha battuto o drink si può scegliere fra due comportamenti, in Impostazioni → Coda ordini. «Filtra la coda» lascia in pagina solo i conti che rispondono, come è sempre stato. «Accendi e porta lì» non toglie niente: scorre fino al primo conto che risponde e lo accende con un anello nel colore d'accento, così si vede dov'è rispetto agli altri; toccando un conto qualsiasi la ricerca si azzera da sé. La regola di corrispondenza è una sola per tutti e due i modi, altrimenti cambiando impostazione lo stesso testo troverebbe conti diversi. Se non risponde nessuno lo dice, invece di lasciare la coda apparentemente immobile; e se il conto c'è ma sta in un'altra scheda, dice anche quello.

*Dove*: `src/lib/coda.js, src/pages/BartenderPage.jsx, src/components/SettingsTab.jsx`

*Lo dimostrano*: `tests/unit/coda.test.js`, `tests/component/SettingsTab.test.jsx`

### ✅ REQ-UI-012 — Dove la pagina ha sezioni sue, il menu resta aperto nella pagina

Nelle pagine con sottosezioni (Impostazioni, Inventario) il menu laterale, da 768px in su, non copre il contenuto: è una colonna della pagina e il contenuto si stringe per fargli posto. Dentro l'inventario si salta fra Prodotti e Conta venti volte di seguito, e un menu che copre vuol dire aprirlo, cercare, scegliere — e intanto non vedere più dove si era. Si apre e si chiude col ☰, lo stesso tasto di sempre: niente secondo comando per «agganciarlo», che sarebbe una cosa in più da capire per una differenza che a chi lavora non interessa — il menu c'è o non c'è. La scelta resta anche il giorno dopo. Sulle pagine senza sezioni proprie — la coda ordini — resta a scomparsa: lì sarebbe una colonna in meno di conti. Da dove in su è un conto sulla larghezza che avanza: sul telefono (360-430px) una colonna da 250px è più di metà schermo e il contenuto diventa inutilizzabile, quindi lì resta a scomparsa; da 768px — l'iPad in verticale, il tablet del banco — restano 500px e la scelta ha senso, con la colonna stretta a 200px fino ai 900px. E SI ALLARGA TIRANDO IL BORDO. Le voci sono parole corte, le sottosezioni no — «Marginalità listino» a 178px si taglia — e su un monitor grande quella colonna stretta è spazio sprecato. La maniglia sul bordo destro la porta fra 150 e 360px, doppio clic per tornare alla misura di partenza, e la larghezza scelta resta anche domani. Cresce tutto insieme, testo e icone: una colonna larga con la scritta piccola in mezzo sembra rotta. Il nome che non ci sta va a capo: nel menu non si scorre mai in orizzontale, e la maniglia è una colonna sua fra menu e contenuto — dentro al menu scorreva col contenuto e finiva sotto la barra di scorrimento, e per prenderla bisognava azzeccare due pixel.

*Dove*: `src/components/StaffDrawer.jsx, src/index.css, docs/navigazione.md`

*Lo dimostrano*: `tests/component/StaffDrawer.test.jsx`

### ⚠️  REQ-UI-011 — La navigazione ha delle regole, e sono scritte

La barra in alto ha tre zone, sempre nello stesso ordine: a sinistra come si esce (☰ oppure ←), al centro dove si è (marchio e titolo, che è anche il comando delle sottosezioni), a destra cosa si può fare (campanella, ⋮). Quando lo spazio manca NON si rimpiccioliscono i tasti — al banco si tocca con le dita bagnate e sotto i 44px si sbaglia — si toglie, in quest'ordine: il nome del locale (sotto i 700px resta il logo), l'«indietro» (sul telefono il ☰ fa quello che fa lui e in più: dalla coda alle impostazioni in un tocco solo), il logo (sotto i 400px). Il titolo della sezione si accorcia coi puntini ma non sparisce mai: è l'unica cosa che dice dove sei; ☰, campanella e ⋮ non cadono mai. Le gerarchie stanno una per volta e ognuna al suo posto: le pagine nel menu laterale, le sottosezioni nel titolo, i filtri in una tendina, e il contenuto non porta navigazione. Niente seconda riga sotto la barra, e un solo modo di tornare indietro per schermata. Le regole stanno in docs/navigazione.md: si seguono invece di ridiscuterle a ogni schermata.

*Dove*: `docs/navigazione.md, src/App.jsx, src/index.css`

*Nessun test lo verifica.*

### ✅ REQ-UI-010 — L'app si chiama come il locale, e dice a chi appartiene

L'app installata si chiama «La Tana del Coniglio», non con la sigla del progetto. A chi lavora il nome porta il suffisso del ruolo — « - admin», « - bartender», « - staff» — così sul telefono l'icona dice di chi è, e chi tiene due profili non li confonde; il cliente, e chi non ha fatto accesso, vede il nome nudo. Il suffisso segue il ruolo di chi è collegato e vale per la linguetta del browser e per il nome proposto all'installazione: il telefono lo congela in quel momento, quindi l'app va installata da collegati col ruolo che serve. Il manifest riscritto porta avvio, ambito e icone per esteso, altrimenti l'app installata partirebbe da nessuna parte.

*Dove*: `src/lib/nomeApp.js, public/manifest.webmanifest`

*Lo dimostrano*: `tests/unit/nomeApp.test.js`

### ⬜ REQ-UI-020 — Ogni conto ha il suo colore, e le sue comande lo portano

Chiesto dall'utente il 18/08. Un conto con tre comande sparse in tre colonne diverse non si riconosce a colpo d'occhio: il colore serve a quello. Due cose distinte: 1) un'impostazione del LOCALE che accende i colori automatici: ogni conto nuovo nasce con un colore preso da una tavolozza, e quello è il suo — sta sulla card del conto e su TUTTE le card delle sue comande; 2) il colore si può scegliere A MANO, sempre, che l'automatico sia acceso o spento, e vale anche per i conti nati prima. VINCOLI: il colore va SCRITTO sul conto, non ricalcolato dall'id — dev'essere lo stesso su ogni terminale e non deve cambiare se domani cambia la tavolozza. E dev'essere leggibile su tutti i temi, chiaro e scuro: non un fondo pieno sotto il testo, ma dove i colori già stanno in questa app (la striscia a sinistra, un pallino). Va deciso e scritto chi vince fra colore del conto e colore dello stato, invece di lasciarlo all'ordine delle regole CSS.

*Dove*: `src/lib/api.js, src/components/CorsieComande.jsx, src/components/CorsieStato.jsx, src/components/SettingsTab.jsx`

*Lo dimostrano*: `tests/component/CodaCorsie.test.jsx`

### ⬜ REQ-UI-021 — Tre nomi per lo stesso passo del servizio

Trovato dalla rilettura del diff della 1.5.0. Lo stesso passo si chiama in tre modi a seconda di dove lo si legge: «Pronto» nella tabella del servizio, «Pronto al servizio» nell'etichetta di stato, «Ritiro/Servizio» in testa alla colonna. Chi lavora vede tre parole per una cosa sola, ed è lo stesso guaio — più piccolo — della pastiglia che diceva «Ordine ricevuto» accanto alla colonna «Da fare». DA DECIDERE, non da semplificare in silenzio: si sceglie la parola e si aggiornano le tabelle e il loro test, oppure si tiene la differenza e si scrive nel commento perché lì serve più corta.

*Dove*: `src/lib/comande.js, src/lib/orderStatus.js`

*Nessun test lo verifica.*

## Menù e catalogo

### ✅ REQ-MENU-010 — Come si fa questo drink: la ⓘ sulla card

Ogni card della griglia ha una ⓘ che apre la scheda del prodotto: ingredienti CON LE QUANTITÀ e come si prepara. «Quanto gin ci va nel Negroni?» al banco si chiede a voce, e a voce si perde: chi entra a dare una mano il sabato non ha le dosi in testa, e l'unico che le sa sta facendo drink. La ricetta strutturata c'era già — serve al magazzino per scalare le scorte — ma non la vedeva nessuno; e non basta: dice COSA ci va, non il gesto. Nella scheda del prodotto (Menù) c'è quindi anche «Come si prepara», scrittura libera: shakerato o mescolato, il ghiaccio, l'ordine, il bicchiere. Gli a capo restano dove li ha messi chi l'ha scritta, perché una preparazione è una sequenza di gesti. La ⓘ sta in basso a destra, lontana dai +/− e dalla stella: si guarda mentre si versa e non si preme per sbaglio. In «organizza» non c'è: lì le card si spostano, non si leggono. SI PUÒ SPEGNERE (Impostazioni → Vista ordine): dove il listino lo sanno tutti a memoria è un segno in più su ogni card, e le card sono cento; dove invece cambia spesso, o si dà una mano il sabato, è la differenza fra saper fare un drink e doverlo chiedere. Accesa di suo.

*Dove*: `src/components/SchedaDrink.jsx, src/components/PosBits.jsx, src/components/DrinkForm.jsx`

*Lo dimostrano*: `tests/component/SchedaDrink.test.jsx`, `tests/component/OrderPosDetail.test.jsx`

### ⚠️  REQ-MENU-001 — Il menù dice se un drink si può fare

Ogni voce del menù mostra la disponibilità con gli stessi colori dell'inventario: verde si può fare, arancione un ingrediente sta finendo, rosso spento a mano o ingrediente esaurito.

*Dove*: `src/components/MenuManager.jsx, src/lib/inventory.js`

*Nessun test lo verifica.*

### ⬜ REQ-MENU-012 — In carta due tipi di voce: il prodotto e la ricetta

Idea di Daniele (17/08) per semplificare la vita a chi carica il menù. Oggi ogni voce di carta è una RICETTA: anche la birra in bottiglia vuole la sua riga «1 pz di Birra», che è una scrittura in più per dire una cosa ovvia — e chi la dimentica si ritrova un prodotto che non scarica niente. La proposta: due tipi di voce. PRODOTTO — è un articolo di magazzino venduto così com'è: si sceglie l'articolo, si mette il prezzo di vendita, e basta. Carico e scarico seguono le regole di sempre (una birra venduta = una birra scaricata), il costo arriva dal costo dell'articolo — al pezzo o al cl, secondo come lo si usa — e da lì escono margine e prezzo consigliato senza che nessuno scriva una ricetta. RICETTA — quello che c'è adesso: più ingredienti con le loro dosi. Da decidere: se il tipo è un campo sulla voce di menù o si deduce (ricetta con un solo ingrediente in quantità «1 pz» = prodotto); e cosa succede a chi oggi ha già scritto le ricette a un ingrediente — la conversione dovrebbe essere automatica e senza perdite.

*Dove*: `src/components/MenuManager.jsx, src/lib/inventory.js, src/lib/saveDrink.js`

*Nessun test lo verifica.*

### ✅ REQ-MENU-011 — Un drink si duplica: la ricetta non si riscrive a mano

Nelle azioni della card del menù c'è «📋 Duplica». Mezzo listino sono variazioni — lo stesso drink col gin diverso, la versione analcolica, il formato grande — e rifarle a mano vuol dire riscrivere prezzo, categoria, descrizione e soprattutto la RICETTA ingrediente per ingrediente: è lì che si sbaglia una dose, e poi il magazzino scala storto. La copia NON si salva da sola: si apre la scheda già piena, col nome marcato «(copia)», così quello che cambia si sistema PRIMA che il drink esista — un doppione salvato di nascosto finirebbe in carta al cliente. Salvando nasce un prodotto nuovo: l'originale non si tocca. La foto resta all'originale: il file è agganciato al drink che l'ha caricata, e cancellando quello sparirebbe anche dalla copia.

*Dove*: `src/components/MenuManager.jsx`

*Lo dimostrano*: `tests/component/MenuManager.test.jsx`

### ✅ REQ-MENU-006 — Sulle card i segni dicono cose diverse, dove uno se le aspetta

Un oggetto si riconosce allo stesso modo in ogni schermata. La STRISCIA A SINISTRA dice come sta la cosa: sulle card della coda com'è messo il conto, sulle card del menù se il prodotto si può fare (verde), se un ingrediente sta finendo (arancione) o se non si può fare (rosso, e la riga sotto al nome dice se è spento a mano o se manca l'ingrediente). IL SEGNO NELL'ANGOLO è il colore che il prodotto ha al banco, e nel menù si tocca per cambiarlo. Che forma abbia lo decide il TEMA (`--segno-prodotto`, lib/themes.js, scritto anche come `data-segno` sul documento): di casa è il nastro d'angolo, largo e squillante; per Catppuccin una pastiglia (quadratino stondato), che è il suo modo di fare gli angoli; per Pico, look documento, il pallino. Gli ultimi due stanno in alto a destra sulle card del menù, dove le card del magazzino tengono lo stato delle scorte, e in alto a SINISTRA sulle tile del conto: lì a destra c'è la stella dei preferiti, che è un tasto e non si copre. Con trenta prodotti a schermo trenta bandiere colorate, su una palette da foglio di calcolo, restavano la cosa più rumorosa della pagina. Le tile del POS portano gli stessi due segni del menù, e la striscia è 4px come in magazzino (era 5): la griglia è la stessa in tutte e tre le schermate. Prima il menù aveva un quadratino che sembrava un'etichetta e invece era un tasto, e un pallino il cui rosso diceva due cose opposte — «l'ho spento io» e «è finito il rum» — che chiedono azioni diverse.

*Dove*: `src/components/MenuManager.jsx, src/components/PosBits.jsx, src/index.css`

*Lo dimostrano*: `tests/unit/temi.test.js`

### ✅ REQ-MENU-005 — Il menù è uno solo, quello che vede il cliente

A /menu si apre sempre la stessa schermata, per chi ordina e per chi lavora: le categorie con le voci del listino, così come le vede il cliente. C'era anche una seconda vista, riservata allo staff — catalogo a due colonne con la ricerca — nata per gli ordini battuti a mano: quelli si battono al POS, e chi apriva il menù dal gestionale si trovava una pagina diversa da quella che stava mostrando al tavolo. Ordinare da qui resta possibile quando le impostazioni lo consentono: a «solo menù» i tasti per aggiungere spariscono per il cliente, mentre chi è dello staff può comunque inserire un ordine ed è segnato come autore. Allo staff la pagina dà in più la barra di ricerca, sopra le categorie: filtra per nome o ingrediente, perché chi prende l'ordine col cliente davanti non scorre otto categorie. Il cliente sfoglia la vetrina senza barra.

*Dove*: `src/pages/MenuPage.jsx`

*Lo dimostrano*: `tests/component/MenuPage.test.jsx`

### ✅ REQ-MENU-002 — Marginalità del listino

Per ogni drink si vede costo reale, prezzo e margine, con il prezzo consigliato calcolato dal ricarico impostato: serve a capire dove si sta perdendo.

*Dove*: `src/lib/pricing.js, src/components/MarginList.jsx`

*Lo dimostrano*: `tests/unit/pricing.test.js`

### ✅ REQ-MENU-003 — Import del catalogo da un export SumUp

Si importa il listino da un CSV di SumUp: prodotti, categorie in ordine di apparizione, inventario dedotto (bottiglie e prodotti pronti, escluse fasce prezzo e preparazioni) e collegamento automatico delle ricette evidenti. Un file che non è un export SumUp viene rifiutato.

*Dove*: `src/lib/carteImport.js`

*Lo dimostrano*: `tests/unit/carteImport.test.js`, `tests/unit/importExcel.test.js`, `tests/unit/nameMatch.test.js`

### ✅ REQ-MENU-004 — Colori e icone di categoria uguali dappertutto

Il colore di una categoria è stabile (dipende dall'id, non dal nome) e lo stesso nel POS, nel menù e nelle statistiche: una categoria si riconosce a colpo d'occhio ovunque la si incontri.

*Dove*: `src/lib/categoryColors.js`

*Lo dimostrano*: `tests/unit/categoryColors.test.js`

## AVVISI

### ✅ REQ-AVVISI-005 — Dove compaiono gli avvisi ad app aperta, lo sceglie il locale

Due modi, in Impostazioni → Notifiche: «in alto, su ogni schermata» — la strisciolina di sempre: non si perde, ma interrompe chiunque, anche chi sta contando la cassa o caricando il magazzino; «dalla campanella, solo in coda» — un fumetto che esce dalla campanella e compare SOLO nella coda ordini, che è il posto dove gli ordini si aspettano: lì un avviso non interrompe niente, è la ragione per cui si sta guardando quella schermata. Il fumetto sparisce da sé dopo qualche secondo — è un richiamo, non una finestra da chiudere — e toccandolo si aprono gli avvisi, perché chi lo tocca vuole vedere cos'è successo. Fuori dalla coda non compare niente: gli avvisi restano nella campanella, col loro conto. Di suo resta la strisciolina, che è come ha sempre funzionato. Un valore sconosciuto ricade lì: meglio la strisciolina di un avviso che non compare da nessuna parte. La scelta sta nel PROFILO, accanto a «quali avvisi ricevere»: è della stessa natura — vale per QUESTO dispositivo — e quello è il posto dove chi lavora li va a cercare. Nelle impostazioni del locale nessuno cercherebbe una cosa sua, e chi è in sala quel menu non ce l'ha nemmeno.

*Dove*: `src/lib/avvisiInApp.js, src/components/FumettoAvvisi.jsx, src/lib/notify.js`

*Lo dimostrano*: `tests/unit/avvisiInApp.test.js`, `tests/component/FumettoAvvisi.test.jsx`, `tests/component/AvvisiPanel.test.jsx`

### ✅ REQ-AVVISI-004 — Uscendo si spengono gli avvisi, rientrando si riaccendono

Il token push è del DISPOSITIVO, non della persona, e dopo il logout restava valido: chi si era scollegato continuava a sentire suonare gli ordini del locale sul telefono di casa. Uscendo, quel dispositivo viene tolto dai destinatari; al primo accesso successivo si registra da sé, senza aspettare che si passi dalla coda. Se non ci riesce — offline, regole — si esce lo stesso: restare dentro sarebbe peggio, e il token scade da solo. E non ci si impianta aspettando: timbratura e rubrica sono scritture su Firestore, e una scrittura offline non torna mai — passati due secondi e mezzo si esce comunque. NON BASTA LA RUBRICA: si spegne il TOKEN. `staff_tokens` è solo l'elenco dello staff; il token è del browser e resta valido, e gli avvisi al cliente («il tuo drink è pronto», «ordine annullato») lo tengono scritto sull'ORDINE, non nell'elenco. Chi si era scollegato continuava a sentire suonare il telefono. Uscendo si cancella il token: non resta nessun indirizzo a cui bussare, chiunque sia il mittente. Vale anche per il cliente che esce, e per «Esci e accedi come staff», che passava dal signOut secco e non toglieva niente. E QUANDO GLI AVVISI SONO SPENTI SI VEDE. Il permesso lo chiede il browser una volta sola, con una finestrella in alto che chi sta lavorando scarta senza leggerla: da quel momento quel tablet non suona più, e nessuno se ne accorge finché non manca un ordine. Una riga in cima lo dice su ogni schermata del gestionale, con il tasto per attivarli; rifiutando ricompare — non c'è «non mostrare più», perché è proprio il rifiuto per sbaglio il caso da coprire. Se il browser li ha bloccati del tutto, l'app non può più chiedere: si spiega dove riaccenderli invece di mostrare un tasto che non farebbe niente. Non è una finestra modale: al banco non si blocca il lavoro per una impostazione.

*Dove*: `src/lib/logout.js, src/lib/push.js, src/lib/customerAuth.js, src/lib/api.js, src/App.jsx, src/components/AvvisiSpenti.jsx`

*Lo dimostrano*: `tests/unit/logoutAvvisi.test.js`, `tests/component/AvvisiSpenti.test.jsx`

## Gruppi di conti

### ✅ REQ-GRP-001 — Più conti sotto un gruppo, anche annidati

I conti si possono raccogliere in gruppi (un tavolo, una comitiva), e i gruppi possono contenere sottogruppi. Un gruppo contenitore non riceve ordini diretti: si ordina in uno dei suoi sottogruppi.

*Dove*: `src/lib/groups.js`

*Lo dimostrano*: `tests/unit/groups.test.js`

### ✅ REQ-GRP-002 — Il totale del gruppo somma tutto l'albero

Il totale di un gruppo somma i suoi ordini diretti e quelli dei sottogruppi, esclusi gli annullati. Un gruppo è saldato solo se ha ordini e nessuno resta da pagare: un gruppo vuoto non è "chiuso".

*Dove*: `src/lib/groups.js groupTotal`

*Lo dimostrano*: `tests/unit/groups.test.js`

### ✅ REQ-GRP-003 — Pagare un gruppo, anche alla romana

Un gruppo si salda in un colpo solo, in contanti o con carta, oppure si divide in quote: la somma delle quote è esatta al centesimo e il resto va sull'ultima.

*Dove*: `src/lib/groups.js splitAmounts, functions/lib/payment-service.js`

*Lo dimostrano*: `tests/unit/groups.test.js`, `tests/bdd/payment-group.test.js`

### ⚠️  REQ-GRP-004 — Un conto si sposta in un gruppo anche dopo

Un conto già aperto può essere associato a un gruppo, spostato o tolto: capita che il tavolo si formi dopo il primo giro.

*Dove*: `src/lib/api.js setOrderGroup`

*Nessun test lo verifica.*

## Persone: ruoli, utenze, ore

### ✅ REQ-STAFF-001 — Quattro ruoli: admin, bartender, staff, cliente

L'admin fa tutto quello che fa il bartender e in più nomina i ruoli; il bartender ha il gestionale completo; lo staff di sala lavora sulla stessa coda del banco e vede cosa c'è da servire, senza le sezioni amministrative; il cliente il menù e i propri ordini. Il ruolo vive nei claim del token e le regole del database guardano quello.

*Dove*: `src/lib/ruoli.js, firestore.rules`

*Lo dimostrano*: `tests/unit/ruoli.test.js`, `tests/unit/utenze.test.js`

### ✅ REQ-STAFF-002 — I confronti sui ruoli si fanno in un posto solo

Nessun confronto diretto tipo `role === 'bartender'` sparso per il codice: si passa dalle funzioni di ruoli.js. Aggiungendo "admin" erano rimasti indietro cinque confronti e l'admin si vedeva la schermata del cliente. Un test scandaglia il codice e boccia i confronti diretti.

*Dove*: `src/lib/ruoli.js`

*Lo dimostrano*: `tests/unit/ruoli.test.js`

### ✅ REQ-STAFF-003 — Pagina utenti: nominare i ruoli senza riga di comando

L'admin vede il personale e i clienti registrati dal sito, e da lì assegna i ruoli, crea account, sospende o elimina. Il bartender consulta l'elenco e usa il cerca-persone, ma non tocca i ruoli. L'ultimo admin non si può togliere di mezzo, e nessuno può cambiare il ruolo a sé stesso.

*Dove*: `src/components/UtentiTab.jsx, functions/lib/staff-service.js`

*Lo dimostrano*: `tests/unit/utenze.test.js`, `tests/component/UtentiTab.test.jsx`

### ⚠️  REQ-STAFF-004 — Il ruolo si aggiorna da solo, senza aspettare la scadenza

Il ruolo vive dentro il token, che dura un'ora: chi era collegato quando gli è cambiato il ruolo continuava a girare col vecchio, con permessi negati sparsi in giro. Il gestionale mostra subito quello che ha in tasca e in sottofondo ne chiede sempre uno fresco.

*Dove*: `src/pages/BartenderPage.jsx`

*Nessun test lo verifica.*

### ⚠️  REQ-STAFF-005 — Registrazione cliente e account personali

Il cliente si registra con nome, cognome, data di nascita, email e password, o entra con Google; riceve l'email di verifica e ritrova i propri ordini. Gli account clienti si possono spegnere da un'impostazione.

*Dove*: `src/pages/AccountPages.jsx, src/lib/customerAuth.js`

*Nessun test lo verifica.*

### ✅ REQ-STAFF-006 — Turni, ore lavorate e paghe

Si registrano turni programmati e ore effettive (anche da timbratura), per giorno, settimana o mese, col costo del personale calcolato sulla tariffa in vigore quel giorno. I turni si assegnano scegliendo un membro dello staff, non digitando un nome.

*Dove*: `src/components/StaffHoursTab.jsx, src/lib/ore.js, src/lib/paghe.js`

*Lo dimostrano*: `tests/unit/ore.test.js`, `tests/unit/paghe.test.js`, `tests/component/StaffHoursTab.test.jsx`

### ✅ REQ-STAFF-007 — Cerca-persone: chiamare un collega dal gestionale

Dal gestionale si chiama un membro dello staff con un messaggio: il suo dispositivo vibra con insistenza finché non risponde. Il pannello si apre dal menu ⋯ della coda, e APERTO APPOSTA non resta mai muto: se non c'è nessun altro da chiamare lo dice, e dice dove si creano gli account. Prima spariva da sé — con un solo account l'elenco è vuoto — e si toccava una voce che non faceva niente, sembrando rotta. Dove il pannello compare da sé invece resta muto: una card «non c'è nessuno» fissa in coda sarebbe rumore.

*Dove*: `src/components/StaffCallList.jsx, functions/lib/push-core.js`

*Lo dimostrano*: `tests/bdd/notify-staff-call.test.js`, `tests/component/StaffCallList.test.jsx`

### ✅ REQ-STAFF-013 — Per chi lavora, la vista menù serve a battere un ordine

Nella vista menù il personale non vede più i propri ordini attivi in cima: quella schermata, per chi lavora, serve a UNA cosa — prendere un ordine dalla carta com'è fatta per il cliente. Gli ordini stanno in coda, che è un'altra pagina, e vederli anche qui mescolava due mestieri. Al cliente invece restano: è l'unico posto dove ritrova quello che ha ordinato. E in «Da servire» il tasto è «Aggiungi ordine», e porta dove porta il «+» della coda: la schermata del conto, con la griglia. Prima mandava al menù — la vista del cliente — che per prendere un ordine al tavolo è la strada lunga: si scorre una carta fatta per chi ordina, invece della griglia fatta per chi batte.

*Dove*: `src/pages/MenuPage.jsx, src/components/ServiceQueue.jsx`

*Lo dimostrano*: `tests/component/MenuPage.test.jsx`

### ✅ REQ-STAFF-008 — La sala lavora sulla stessa coda del banco

La home dello staff di sala è la coda ordini, identica a quella del gestionale: quello che vede il banco lo vede anche chi porta i vassoi. Prima la sala aveva due pagine sue («Da servire» e «I miei ordini») e non vedeva mai la coda vera. «I miei ordini» non è più una pagina: è il filtro «Miei» della coda, che tiene solo i conti con la propria firma (placed_by) — e il vecchio indirizzo ?tab=miei-ordini ci arriva col filtro già acceso. «Da servire» resta come sezione. Le sezioni amministrative restano ai gestori: per la sala un tab non suo riporta alla coda. Dal menu laterale la sala apre «Nuovo ordine dal menù» (il menù che mostra al tavolo, con la ricerca), non il POS del banco.

*Dove*: `src/pages/BartenderPage.jsx, src/lib/sezioni.js, src/lib/coda.js`

*Lo dimostrano*: `tests/unit/coda.test.js`, `tests/component/StaffDrawer.test.jsx`

## TAVOLI

### ⬜ REQ-TAVOLI-001 — I tavoli hanno un'anagrafica, e ognuno il suo QR generato in app

Nasce l'anagrafica dei tavoli: un tavolo ha un NOME e/o un NUMERO — almeno uno dei due, e nessuno dei due può essere una stringa vuota. Per ogni tavolo l'app genera il suo QR code (il collegamento al menù con il tavolo già agganciato), da stampare e mettere sul tavolo: la scansione porta al menù cliente col tavolo prepopolato. Oggi il tavolo è testo libero sull'ordine: l'anagrafica non lo sostituisce di colpo, ci si aggancia (il campo dell'ordine resta com'è, ma può venire da un tavolo censito).

*Dove*: `src/lib/api.js, firestore.rules, requirements`

*Nessun test lo verifica.*

### ⬜ REQ-TAVOLI-002 — Nome e tavolo nelle viste d'ordine: staff libero, cliente guidato

Nella vista «Nuovo ordine dal menù» dello staff si possono inserire NOME e numero del tavolo: il nome deve poterci stare (oggi c'è solo il tavolo) e il numero è opzionale. Nella vista cliente: se si arriva dal QR del tavolo (REQ-TAVOLI-001) il tavolo è prepopolato e NON modificabile; senza QR il tavolo non serve, ma il nome sì — è quello che permette al banco di chiamare l'ordine.

*Dove*: `src/pages/MenuPage.jsx, src/components/OrderSummary.jsx`

*Nessun test lo verifica.*

## Vista cliente

### ✅ REQ-CLI-001 — Il cliente ordina dal telefono e segue il suo ordine

Dal menù il cliente compone e invia l'ordine, poi vede lo stato della sua comanda con la stima di attesa; può modificarlo o annullarlo finché non entra in preparazione.

*Dove*: `src/pages/MenuPage.jsx, src/pages/OrderStatusPage.jsx`

*Lo dimostrano*: `tests/component/OrderStatusPage.test.jsx`

### ✅ REQ-CLI-002 — Chi apre un ordine vede la schermata giusta

Admin e bartender aprono il dettaglio in stile POS, per lavorarci; staff di sala e clienti vedono lo stato. Con l'arrivo del ruolo admin questo controllo era rimasto indietro e chi stava al banco si trovava la schermata del cliente.

*Dove*: `src/pages/OrderStatusPage.jsx`

*Lo dimostrano*: `tests/component/OrderStatusPage.test.jsx`

### ✅ REQ-CLI-003 — Stima di attesa onesta

La stima parte da un tempo base configurato e si raffina con i tempi realmente misurati; tiene conto di quanti ordini ci sono davanti e se il servizio è al tavolo o al banco.

*Dove*: `src/lib/eta.js`

*Lo dimostrano*: `tests/unit/eta.test.js`

### ✅ REQ-CLI-004 — Ordinare solo se si è nel locale (facoltativo)

Si può richiedere che il cliente sia dentro un raggio dal locale per ordinare: raggio configurabile, minimo 10 metri, default 150.

*Dove*: `src/lib/geo.js`

*Lo dimostrano*: `tests/unit/geo.test.js`

### ⚠️  REQ-CLI-005 — La vetrina e il menù si adattano allo schermo

Il menù occupa tutta la larghezza del dispositivo; nella vetrina marchio e nome stanno sulla stessa riga e il riquadro cresce col contenuto, senza tagliare il logo. Sul telefono "I miei ordini" e "Accedi" stanno su una riga sotto la barra, sempre presente, così non compaiono a caricamento avvenuto spostando la pagina.

*Dove*: `src/pages/LandingPage.jsx, src/index.css`

*Nessun test lo verifica.*

### ⬜ REQ-CLI-006 — Il cliente sa che il suo drink è pronto da ritirare

Chiesto dall'utente il 18/08. Su un conto da RITIRO, quando la comanda passa a «pronto» il cliente va avvisato: da lì in poi la palla è sua — deve alzarsi e venire al banco. Sul servizio al tavolo non serve: ci pensa chi porta il vassoio. PARTE DA SOLA, al passaggio di stato: non è un tasto che qualcuno deve ricordarsi di premere. TRE STRADE, e non si escludono: chi ha ordinato dal telefono segue l'ordine con la pagina del QR (c'è già) e riceve la notifica se ha dato il permesso; chi ha ordinato al banco non ha né l'una né l'altra, e per lui c'è il TABELLONE «stiamo servendo» (già in Impostazioni → Menù clienti) coi numeri pronti al ritiro, mentre il numero del conto è già stampato sullo scontrino. DA VERIFICARE PRIMA DI SCRIVERE: cosa fa già la pagina di stato, come il cliente viene registrato per le notifiche, e se serve un deploy delle Cloud Functions — che va chiesto, non deciso. DETTAGLI CHE FANNO LA DIFFERENZA: una volta sola per comanda (se qualcuno riporta indietro lo stato e lo rimette «pronto», il cliente non deve ricevere due squilli); senza permesso alle notifiche l'avviso non arriva e la pagina col QR resta la strada che funziona sempre; con gli stati di servizio spenti quel passaggio non esiste, e va detto cosa succede invece di lasciare il caso scoperto.

*Dove*: `src/lib/push-core.js, functions/index.js, src/pages/OrderStatusPage.jsx, src/pages/MenuPage.jsx`

*Lo dimostrano*: `tests/unit/push-comande.test.js`

## Stampa

### ⚠️  REQ-STAMPA-001 — Comanda al banco e scontrino al cliente

Si stampa la comanda in lavorazione (con dentro le aggiunte appena fatte) e lo scontrino non fiscale del conto, con i metodi di pagamento davvero usati. Entrambe possono essere automatiche.

*Dove*: `src/lib/printer.js`

*Nessun test lo verifica.*

### ⚠️  REQ-STAMPA-002 — La stampante non deve smettere di funzionare a metà serata

La connessione alla stampante viene tenuta viva e ricontrollata quando l'app torna in primo piano: non si deve uscire dal programma per farla ripartire.

*Dove*: `src/lib/printer.js`

*Nessun test lo verifica.*

### ⬜ REQ-STAMPA-003 — Il certificato della stampante non deve scadere ogni volta

L'avviso di sicurezza che costringe ad accettare a mano il certificato della stampante va eliminato alla radice: certificato con SAN corretto installato come attendibile sul dispositivo, oppure altra strada (Server Direct Print). Serve la verifica dal wifi del locale per decidere.

*Dove*: `scripts/certificato-stampante.js`

*Nessun test lo verifica.*

### ✅ REQ-STAMPA-005 — Sullo scontrino il metodo si legge per esteso

Sullo scontrino e sulla chiusura di cassa i metodi di pagamento si scrivono per esteso e con le stesse parole: «Carta di credito», non «Carta». A fine serata la striscia degli scontrini si divide per metodo a colpo d'occhio, e «Carta» e «Contante» si somigliano abbastanza da doverli leggere uno per uno. I nomi stanno in un posto solo, senza emoji (la testina stampa caratteri, non icone): due parole diverse per la stessa cosa costringono a tradurre a mente mentre si contano i soldi. Un metodo sconosciuto resta «Non indicato», mai un ripiego su «Contante».

*Dove*: `src/lib/orderStatus.js, src/lib/printer.js`

*Lo dimostrano*: `tests/unit/orderStatus.test.js`

### ⚠️  REQ-STAMPA-004 — Chiusura di cassa stampata con tutti i metodi

Lo scontrino di chiusura riporta gli incassi divisi per metodo di pagamento, elencando quelli davvero usati e non un elenco fisso.

*Dove*: `src/lib/printer.js`

*Nessun test lo verifica.*

### ✅ REQ-STAMPA-009 — In locale la stampante è di carta finta

Sull'ambiente di sviluppo la stampante non c'è — è un apparecchio sulla rete del locale — e ogni modifica a comande e scontrini si provava a occhio nel codice, o andando al bar. In locale l'app parla con una stampante finta che raccoglie le righe e le apre nella finestra di stampa del browser, da cui si salva in PDF: si prova quello che ESCE, che è la domanda vera («questa comanda si legge?»). SOLO IN LOCALE, e questo è il punto: sull'ambiente di TEST resta la stampante vera, perché è lì che si prova il collegamento — certificato, rete, riconnessione — e chi prova le funzioni sul test la vuole collegata davvero. Il segnale è il server di sviluppo, la build «locale» o gli emulatori: se il database è finto, lo è anche il bar. Si può forzare nei due versi con VITE_STAMPANTE_FINTA.

*Dove*: `src/lib/stampanteFinta.js, src/lib/printer.js`

*Lo dimostrano*: `tests/unit/stampanteFinta.test.js`

### ✅ REQ-STAMPA-006 — Lo staff di sala stampa le comande degli ordini che prende

Chi è in sala prende ordini dal menù, e la comanda di quell'ordine deve uscire. Prima non usciva niente: si sperava che al banco qualcuno tenesse aperta la coda con la stampa automatica accesa: se quella schermata non era aperta, l'ordine restava solo a schermo. L'IP il telefono ce l'ha già — la configurazione della stampante è condivisa e ogni dispositivo la riceve dal server (subscribePrinterConfig in App.jsx) — quindi a mancare era solo l'ordine di stampare. Ora l'ordine preso in sala stampa la sua comanda dal telefono che l'ha preso, salvo che il locale abbia scelto il rimbalzo (REQ-STAMPA-008). La stampa non si aspetta: l'ordine è salvato comunque, e se la stampa non parte lo dice il pallino nella coda (REQ-STAMPA-007). Resta da fare una volta, su ogni telefono, l'accettazione del certificato della stampante: è REQ-STAMPA-003.

*Dove*: `src/pages/MenuPage.jsx, src/lib/printer.js`

*Lo dimostrano*: `tests/component/MenuPage.test.jsx`

### ✅ REQ-STAMPA-007 — Un pallino dice se la comanda uscirà, prima di averne bisogno

Nella coda ordini, per chiunque la guardi — banco e sala — un pallino dice se la stampante risponde: verde esce, rosso adesso non uscirebbe, bianco qui non c'è nessuna stampante impostata. Non è una stampa di prova: è la stessa stretta di mano che farebbe la comanda, senza carta. Si controlla ogni mezzo minuto finché qualcuno lo guarda e appena si torna sull'app — è lì che si scopre caduta l'eccezione del certificato, non a metà servizio. Toccandolo si legge il motivo e la strada per rimetterlo a posto; a chi è in sala non si dice di andare nelle impostazioni, che non ha. Una stretta di mano sola anche se a chiederla sono in tre: la stampante ne regge poche.

*Dove*: `src/lib/statoStampante.js, src/components/PallinoStampante.jsx, src/pages/BartenderPage.jsx`

*Lo dimostrano*: `tests/unit/statoStampante.test.js`, `tests/component/PallinoStampante.test.jsx`

### ✅ REQ-STAMPA-010 — Le impostazioni della stampante sono del dispositivo e di chi ci lavora

Indirizzo della stampante, stampa automatica di comande e scontrini, dati del locale sullo scontrino: stanno nel dispositivo — l'indirizzo dipende da dove sei, il tablet del banco la raggiunge e il telefono della sala forse no — e sono di chi è collegato, perché sullo stesso tablet si alternano persone diverse e la stampa automatica la vuole accesa chi sta al banco, non chi passa a battere due conti. Chi entra per la prima volta su un dispositivo eredita le impostazioni che quel dispositivo aveva: al passaggio nessuno si è ritrovato senza stampante a servizio iniziato. Da lì in poi la scheda è sua. Conseguenza da sapere: su un ambiente diverso (test, produzione) la memoria è un'altra, e la stampante va impostata una volta anche lì.

*Dove*: `src/lib/printer.js, src/App.jsx`

*Lo dimostrano*: `tests/unit/impostazioniStampante.test.js`

### ✅ REQ-STAMPA-008 — Il locale sceglie chi stampa le comande della sala

In Impostazioni → Stampante si sceglie, sul terminale del banco, fra due modi (le impostazioni sono del dispositivo e di chi ci lavora: REQ-STAMPA-010): «la stampa il telefono», cioè chi prende l'ordine al tavolo stampa dal suo, e «la stampa il banco», cioè la comanda esce al bancone all'arrivo dell'ordine. Di partenza stampa il telefono, anche per le configurazioni salvate prima che la scelta esistesse. Scegliendo il banco con la stampa automatica spenta non stamperebbe nessuno: l'impostazione lo dice, invece di lasciarlo scoprire a servizio iniziato. E col rimbalzo il pallino della sala non finge di sapere: dice che a stampare è il banco.

*Dove*: `src/components/PrinterSetup.jsx, src/lib/printer.js`

*Lo dimostrano*: `tests/component/MenuPage.test.jsx`, `tests/unit/statoStampante.test.js`

## Notifiche

### ✅ REQ-NOTIF-001 — Il cliente sa quando il suo drink è pronto

Quando una comanda passa a pronto, al cliente arriva una notifica; idem quando il suo ordine viene annullato, con la frase scelta da chi lo annulla.

*Dove*: `functions/lib/push-core.js decideOrderPush`

*Lo dimostrano*: `tests/bdd/notify-order.test.js`

### ✅ REQ-NOTIF-002 — Il banco sa quando arriva un ordine nuovo

Un ordine nuovo — o un'aggiunta a un conto esistente — avvisa il banco. Avvisa quello che prima non c'era: si guardano QUALI comande sono da fare («ricevuto» o «in preparazione»), non quante. Un ordine battuto al POS nasce già in preparazione — chi lo batte sta facendo il drink — e guardando i soli «ricevuto» non risultava mai nuovo in coda: al banco non arrivava niente. Contarle non basterebbe: col cliente che ordina e gli stati accesi, «ricevuto» e «in preparazione» sono due momenti diversi — arriva l'ordine, poi qualcuno lo prende in mano — e un totale che non cambia non distingue «è avanzata quella di prima» da «ne è arrivata una nuova». Con gli identificativi, l'arrivo avvisa e l'avanzamento no: quella comanda il banco la conosce già, ed è il banco stesso ad averla presa in mano. Un conto fermo in attesa del pagamento obbligatorio entra in coda quando è saldato: lì è nuovo per il banco anche se le comande sono le stesse. A restare senza avviso è SOLO il dispositivo da cui è partito: sa già di averlo mandato. Non si guarda il ruolo: prima si buttava via l'avviso di ogni ordine battuto da un admin o da un bartender, dando per scontato che chi ha quel ruolo stia al banco — e chi gira ai tavoli col telefono, con un account da gestore, non faceva squillare niente a nessuno. I token push sono UNO PER DISPOSITIVO (`staff_tokens/<device>`), non per persona: prima lo stesso account su tablet e telefono si sovrascriveva la riga a vicenda e l'avviso arrivava solo all'ultimo che aveva aperto il gestionale — al banco, il tablet muto. Se lo stesso token compare due volte (la riga vecchia intestata alla persona e quella nuova al dispositivo) si avvisa una volta sola. Chi lavora può vedere se su QUESTO schermo gli avvisi arrivano: aprendo la campanella lo dice, e dove serve offre di attivarli. Su iPhone e iPad la push di sistema esiste solo con l'app installata sulla schermata Home, e questo va detto invece di lasciare pensare a un guasto. Il terminale viaggia con l'ordine (`placed_by.device`) e col token push del dispositivo; chi si è registrato prima che il dispositivo venisse segnato viene avvisato lo stesso — un avviso in più si chiude, uno in meno è un drink che non parte.

*Dove*: `functions/lib/push-core.js decideNewOrderStaffPush`

*Lo dimostrano*: `tests/bdd/notify-order.test.js`, `tests/unit/push-comande.test.js`

### ✅ REQ-NOTIF-003 — La sala sa cosa c'è da servire

I drink pronti da portare avvisano la sala, non il banco: al bartender sarebbero rumore, visto che è lui a segnarli pronti.

*Dove*: `functions/lib/push-core.js decideStaffServePush`

*Lo dimostrano*: `tests/bdd/notify-staff-call.test.js`

### ✅ REQ-NOTIF-004 — Avvisi e storico stanno nel profilo, non nelle impostazioni del locale

Quali avvisi arrivare e lo storico di quelli arrivati stanno nel PROFILO di chi è collegato. La scelta è per persona e per dispositivo (`tana:avvisi:<uid>`), non una regola del locale: lo stesso account sul tablet della cassa e sul telefono in sala vuole cose diverse, e due che si passano il tablet nel cambio turno non si sovrascrivono niente. Nelle impostazioni del locale — dove stavano — non entra chi è in sala, cioè proprio chi ha più bisogno di sapere quando un drink è pronto: lì gli avvisi erano fuori portata per chi li usa. In Impostazioni → Notifiche resta un cartello che porta al profilo. Lo storico è lo STESSO elenco della campanella, non una copia: svuotarlo di qua lo svuota anche di là, e le notifiche ancora da leggere non si buttano insieme alle altre. Da leggere e già lette compaiono insieme, nell'ordine in cui sono arrivate; quelle già lette sbiadiscono e quelle con una destinazione restano porte. Attenzione a cosa è di chi: gli INTERRUTTORI sono per persona e dispositivo, lo STORICO è del dispositivo (`tana:notifs`, senza uid) — sono gli avvisi arrivati su quello schermo, e chi prende il turno dopo li vede. È voluto: servono a ricostruire cos'è successo qui, non a chi era collegato.

*Dove*: `src/pages/StaffProfilePage.jsx, src/components/AvvisiPanel.jsx, src/components/StoricoNotifiche.jsx`

*Lo dimostrano*: `tests/component/StoricoNotifiche.test.jsx`, `tests/component/AvvisiPanel.test.jsx`

## Si lavora anche senza rete

### ✅ REQ-OFFLINE-001 — Nessuna schermata aspetta il server

Tutte le scritture partono in sottofondo con lo stato di avanzamento visibile: in corso, sincronizzato, errore. In errore si può ripetere l'ultima modifica o tutte. Con la rete che va e viene il servizio non si ferma.

*Dove*: `src/lib/sync.js`

*Lo dimostrano*: `tests/unit/incassoOffline.test.js`, `tests/unit/toast.test.js`

### ✅ REQ-OFFLINE-002 — La coda si apre subito, dalla cache

Gli ordini compaiono dalla copia locale senza aspettare il server, e vengono allineati appena il server risponde; il dato del server non viene ricoperto da una cache che arriva tardi. Senza cache non si inventa niente: si aspetta.

*Dove*: `src/lib/api.js subscribeActiveOrders`

*Lo dimostrano*: `tests/unit/codaCache.test.js`

### ⚠️  REQ-OFFLINE-003 — Si vede quando si è offline

Un nastro avvisa che si è senza rete e che si può continuare a lavorare; la campanella mostra lo stato della sincronizzazione solo quando ha qualcosa da dire.

*Dove*: `src/App.jsx, src/components/StatusBell.jsx`

*Nessun test lo verifica.*

### ✅ REQ-OFFLINE-004 — L'app avvisa quando c'è una versione nuova

La PWA resta aperta per giorni: l'app confronta la propria build con quella pubblicata e propone di aggiornare. Offline non dà falsi allarmi.

*Dove*: `src/lib/appVersion.js`

*Lo dimostrano*: `tests/unit/appVersion.test.js`

## Dati e ambienti

### ✅ REQ-DATI-001 — Backup ed esportazione di tutto il database

Si scarica in un file tutto quello che c'è nel database e lo si rimette da un file. Un file non valido viene rifiutato PRIMA di scrivere; l'import riscrive quello che il file contiene e non cancella il resto; oltre il limite di un lotto si spezza senza perdere righe.

*Dove*: `src/lib/backup.js, src/components/BackupPanel.jsx, scripts/backup-db.js`

*Lo dimostrano*: `tests/unit/backup.test.js`

### ⚠️  REQ-DATI-002 — Travaso e ripristino da riga di comando

Gli script sanno rispecchiare un ambiente su un altro, migrare il solo catalogo rispettando lo storico di chi lo riceve, e ripristinare un backup. Tutti mostrano un'anteprima e scrivono solo con --apply; la produzione va indicata a mano.

*Dove*: `scripts/specchia-db.js, scripts/ripristina-db.js, scripts/migra-in-produzione.js`

*Nessun test lo verifica.*

## Sicurezza

### ✅ REQ-SIC-001 — Le regole del database seguono i ruoli

Menù, impostazioni e ordini sono a lettura libera (servono al cliente); cassa, magazzino, gruppi, ore e fatture sono riservati al personale; le paghe e la gestione utenti all'admin. Nessuno può cancellare incassi o sessioni di cassa dall'app.

*Dove*: `firestore.rules`

*Lo dimostrano*: `tests/unit/utenze.test.js`

### ⚠️  REQ-SIC-002 — App Check protegge la produzione senza chiudere fuori il locale

In produzione le richieste devono portare un gettone reCAPTCHA valido. Va acceso solo quando i gettoni non validi sono a zero, perché acceso di traverso blocca tutto — anche il menù, che è pubblico. Su test resta spento.

*Dove*: `scripts/appcheck.js, scripts/recaptcha-domini.js`

*Nessun test lo verifica.*

### ⬜ REQ-SIC-003 — App Check anche sull'ambiente di test

Oggi test gira senza App Check e con la chiave reCAPTCHA della produzione, che per il suo dominio non è valida. Se un giorno serve protezione anche lì: chiave dedicata, segreto registrato nel progetto di test e valore nella GitHub Environment "test".

*Dove*: `infrastruttura`

*Nessun test lo verifica.*

## CODA

### ✅ REQ-CODA-001 — La coda a «Corsie di stato»: una colonna per passo, un tasto per card

Quarta vista della coda ordini, si sceglie in Impostazioni → Coda ordini accanto a griglia, schede e lista. Gli ordini aperti stanno in quattro colonne — «Da fare» (ricevuto), «Al banco» (in preparazione), «Al ritiro» (pronto), «Da incassare» (consegnato e non saldato) — con in testa il conteggio, il totale della colonna e un filo del colore dello stato; ogni colonna scorre per conto suo, così le altre tre restano sott'occhio. Sulla card c'è UN tasto solo, quello che manda l'ordine al passo dopo: «Lo preparo io», «È pronto», «Consegnato», «Incassa». Sono le stesse azioni della griglia — l'avanzamento è updateOrderStatus, e «Incassa» apre il pagamento del conto, quello vero con sconto, conto diviso, contanti, carta e lettore: una vista è un modo di guardare, non un secondo modo di lavorare. Toccando la card (non il tasto) si apre il conto. Ricerca e filtro «Miei» valgono qui come nelle altre viste e filtrano dentro tutte le corsie insieme; le colonne restano tutte e quattro anche svuotate, perché la loro posizione si impara a memoria. Due casi che al banco costano un drink: il conto PAGATO ma non ancora consegnato resta in «Al ritiro» con il bollo «Pagato» invece del tempo (sparire vorrebbe dire dimenticarsi di servirlo), e «Da incassare» mostra la cifra al posto delle righe, perché lì la domanda è una sola. Con gli stati di servizio SPENTI i quattro passi non esistono e le corsie diventano le tre della griglia — in corso, chiusi, annullati — con le stesse etichette e le stesse regole (schedeCoda, passaFiltroCoda), e sui conti in corso resta l'incasso; quello che è già chiuso non ha tasti. Quello che esce dalla coda a fine cassa esce anche dalle corsie: la lista è la stessa (ordiniInCoda). Un conto appena battuto al POS compare in cima alla prima corsia già mentre parte verso il server: chi non lo vede lo ribatte.

*Dove*: `src/lib/coda.js, src/lib/comande.js, src/lib/ruoli.js, src/lib/impostazioniLocali.js, src/components/CorsieStato.jsx, src/components/CorsieComande.jsx, src/components/RigheCorsia.jsx, src/components/OrderPosDetail.jsx, src/pages/BartenderPage.jsx, src/components/SettingsTab.jsx`

*Lo dimostrano*: `tests/unit/coda.test.js`, `tests/unit/comande.test.js`, `tests/unit/ruoli.test.js`, `tests/component/CodaCorsie.test.jsx`, `tests/component/OrderPosDetail.test.jsx`, `tests/component/SettingsTab.test.jsx`

### ✅ REQ-CODA-002 — Il dettaglio di una comanda: cosa devo fare adesso, e per chi

Schermata di una singola COMANDA, all'indirizzo /ordine/:id/comanda/:comandaId. Ci si arriva toccando la card nella vista del banco (REQ-CODA-001). È fatta come il dettaglio del conto ma risponde a un'altra domanda: quella del conto è della cassa — quanto fa, chi paga, cosa aggiungo — questa è del banco: cosa devo fare adesso, per chi, da quanto sta lì. Per questo sono due schermate e non una: riusare quella del conto avrebbe voluto dire portarsi dietro la griglia dei prodotti, lo sconto e il pagamento su un ticket, che sono tutte cose del conto. Quello che è di tutte e due sta già in comune: il flusso in lib/comande.js, i nomi degli stati in lib/orderStatus.js, la destinazione in lib/coda.js.

*Dove*: `src/pages/ComandaPage.jsx, src/components/ComandaDetail.jsx, src/lib/comande.js, src/components/CorsieComande.jsx, src/App.jsx`

*Lo dimostrano*: `tests/unit/comande.test.js`, `tests/component/ComandaDetail.test.jsx`

## Intelligenza artificiale

### ⬜ REQ-AI-001 — Scansione delle fatture d'acquisto con l'AI

Da una foto o un PDF della fattura fornitore ricavare righe, quantità, costi e IVA, da rivedere prima di registrare. Nelle impostazioni si abilita la scansione e si sceglie il servizio (Claude, ChatGPT, Gemini): o il nostro backend, o la propria API key, con le barre dei limiti di utilizzo. Si parte da Claude e ChatGPT. Il carico automatico in magazzino si valuta dopo.

*Dove*: `functions/, src/components/InvoicesTab.jsx`

*Nessun test lo verifica.*

## Come si lavora al progetto

### ✅ REQ-DEV-001 — I requisiti restano attaccati ai test

Questo elenco dice cosa fa l'app; i test dicono cosa fa davvero. Un test controlla che le due cose non si stacchino: ogni file di test dev'essere citato da almeno un requisito, ogni test citato deve esistere, gli identificativi non si ripetono e non si apre un'issue per qualcosa di già fatto. Chi aggiunge un test senza dire a quale requisito appartiene se ne accorge subito, non fra sei mesi.

*Dove*: `requirements/requirements.yaml, tests/unit/requisiti.test.js`

*Lo dimostrano*: `tests/unit/requisiti.test.js`

### ✅ REQ-DEV-002 — Si sa sempre quale versione si sta guardando

In fondo al menu laterale c'è la versione: in produzione il solo numero, altrove numero, ramo e commit — perché sull'unico ambiente di test passano a turno develop e i branch in lavorazione, e "l'ho provato e non andava" senza sapere cosa era pubblicato non vuol dire niente. Si tocca e si copia.

*Dove*: `src/lib/versione.js, src/components/VersionBadge.jsx, vite.config.js`

*Lo dimostrano*: `tests/unit/versione.test.js`

### ✅ REQ-DEV-003 — Changelog delle versioni, leggibile anche dall'app

Ogni versione rilasciata ha le sue note in CHANGELOG.md, e le stesse note si leggono dentro l'app in Impostazioni → Informazioni, insieme ai dati tecnici (versione, ramo, commit, ambiente, progetto). Chi usa l'app deve poter sapere cosa è cambiato senza chiederlo a chi l'ha scritta. Il NUMERO di versione lo dice package.json, allineato al rilascio, non l'ultimo tag raggiungibile: il tag sta sul merge in main, che non è antenato dei rami di lavoro, e lì `git describe` risaliva al rilascio PRECEDENTE — l'ambiente di test diceva 1.2.0 mentre ci girava la 1.3.0. Un numero sbagliato è peggio di nessun numero: chi segnala un problema dichiara una versione che non è quella che ha davanti. E non deve andarle a cercare: l'app si aggiorna da sé mentre la si usa, e chi lavora si accorge del cambiamento solo perché qualcosa è finito in un altro posto. Toccando «Nuova versione disponibile», alla riapertura compare il BOX con le note di quella versione — una volta sola, poi mai più. Se invece l'aggiornamento arriva da sé (l'app riaperta il giorno dopo) niente box in faccia mentre si lavora: resta una NOTIFICA nella campanella che porta a Impostazioni → Informazioni. Alla prima apertura su un dispositivo nuovo non succede niente: un box di benvenuto con le note di rilascio non lo vuole nessuno.

*Dove*: `CHANGELOG.md, src/components/InfoTab.jsx`

*Lo dimostrano*: `tests/unit/novita.test.js`, `tests/component/AppHeader.test.jsx`, `tests/unit/notifyStore.test.js`

### ⚠️  REQ-DEV-004 — Il cancello di qualità prima del merge in develop

Il merge in develop passa un cancello, descritto in docs/gitflow.md: requisiti e registro bug aggiornati coi test citati; lint, test e build; la COVERAGE sopra le soglie di vitest.config.mjs — un cricchetto tarato appena sotto il misurato, che si alza quando la copertura cresce e non si abbassa mai per far passare un merge (npm run test:coverage fallisce da solo, e con lui la CI delle pull request); e un giro di refactoring sul diff (riuso, complessità, commenti sul perché) prima di chiedere il merge.

*Dove*: `docs/gitflow.md, vitest.config.mjs, .github/workflows/test.yml`

*Nessun test lo verifica.*

### ⬜ REQ-DEV-005 — Alzare il cricchetto della coverage, e standard di complessità nel lint

Il cancello ora misura TUTTO il codice di prodotto, con una soglia per area tarata sul misurato del 16/08: functions/lib 92/76/88, src/lib 64/74/62, componenti 40/72/43, pagine 17/52/16 (src/dev è fuori: attrezzi, non prodotto). Le soglie basse — pagine su tutte — non certificano qualità: impediscono di peggiorare. Questo requisito è il lavoro di ALZARLE: coprire la logica delle pagine (BartenderPage e MenuPage in testa) e portare il cricchetto su. Insieme, gli standard di complessità nel lint (complexity, max-depth, dimensione delle funzioni): prima come avvisi per vedere dove siamo, poi come errori — i numeri esatti si decidono guardando il misurato, non a tavolino.

*Dove*: `vitest.config.mjs, eslint.config.js`

*Nessun test lo verifica.*

### ⬜ REQ-DEV-006 — Le due lavagne a corsie sono lo stesso componente scritto due volte

Trovato da due revisioni indipendenti del diff della 1.5.0. Le viste a corsie dei conti e delle comande condividono, riga per riga: il guscio della colonna, la testata con conteggio e totale, la card dei conti «in arrivo» (22 righe identiche), il bollo dell'acconto e il piede con il ⋯ e il tasto grande. Sono circa 90 righe scritte due volte: oggi una modifica alla testata va fatta in due posti. COME: estrarre `Corsia` (guscio + testata + lista + card in arrivo) e il piede, come si è già fatto con `RigheCorsia`, `PreparazioneParziale` e `ScegliConsegna`, lasciando a ogni file solo il corpo della propria card. NON fondere del tutto i due componenti: una vista lavora sui conti e l'altra sulle comande, e solo quella dei conti ha la colonna della cifra grande. Fonderle cambierebbe comportamento.

*Dove*: `src/components/CorsieStato.jsx, src/components/CorsieComande.jsx`

*Nessun test lo verifica.*

### ⬜ REQ-DEV-007 — La coda ricalcola tutte e tre le viste a ogni disegno, e ne mostra una

Trovato dalla rilettura del diff della 1.5.0, coi numeri. Nel corpo della coda non c'è nessuna memoria fra un disegno e l'altro: griglia, lista e corsie vengono ricalcolate tutte, sempre, e se ne mostra una. Con 120 conti sono circa 18 passate complete sulla lista e 4 ordinamenti a ogni ridisegno — e ridisegnare capita a ogni tasto premuto nella ricerca, a ogni card aperta e a ogni snapshot dal server, che in una serata piena sono centinaia. Nello stesso posto: `contiScheda` viene chiamata sei volte per disegno sulla stessa lista (tre per i conteggi delle schede, due identiche a due righe di distanza), e ognuna è tre filtri in fila. COME: memorizzare le tre catene e smistare le schede una volta sola. Non cambia niente di quello che si vede.

*Dove*: `src/pages/BartenderPage.jsx`

*Nessun test lo verifica.*

### ⬜ REQ-DEV-008 — Scritture che rileggono l'ordine per un valore che nessuno guarda

Trovato dalla rilettura del diff della 1.5.0. `advanceComanda`, `preparazioneParziale` e `setOrderServiceMode` rileggono l'ordine dopo aver scritto, per restituirlo — e nessuno dei loro chiamanti (verificati tutti e otto) usa quel valore: gli interessa solo l'eventuale errore. Ogni tocco su una card costa così due letture dello stesso documento invece di una, più una normalizzazione intera buttata via: con ~150 comande a sera sono ~450 letture a vuoto. Nella stessa famiglia: `notifyLowStock([])` legge comunque il localStorage in modo sincrono prima di ciclare su zero elementi. COME: comporre l'esito in memoria da quello che si è appena scritto, o non restituire niente.

*Dove*: `src/lib/api.js`

*Nessun test lo verifica.*

### ⬜ REQ-DEV-009 — Quattro copie del ricalcolo del totale di un conto

Trovato dalla rilettura del diff della 1.5.0. Le stesse cinque righe — aggrega le righe delle comande, somma coperto/servizio/mancia, ricalcola lo sconto — e la stessa scrittura compaiono in quattro funzioni di `api.js`, di cui una aggiunta da questa versione. COME: una funzione privata che salva le comande e ne ricalcola il totale, chiamata dalle quattro. DA FARE CON CALMA E CON I TEST DAVANTI: è il punto in cui si scrivono i soldi di un conto. Non si tocca a ridosso di un rilascio, ed è il motivo per cui questa voce esiste invece della modifica.

*Dove*: `src/lib/api.js`

*Nessun test lo verifica.*

### ⬜ REQ-DEV-010 — Metà di «corsie di stato» non la chiama più nessuno

Trovato dalla rilettura del diff della 1.5.0. `corsieDiStato` viene chiamata da un solo punto, con `workflowOn` cablato a `false`: il ramo con i quattro passi del servizio, le sue voci in `AZIONI_CORSIA`, il bollo «pagato ma non servito» sui conti e la classe CSS che lo disegna sono irraggiungibili. A tenerli in vita sono solo i test. Il costo non è lo spazio: i test sono la specifica, e chi legge «Da incassare sono i consegnati non saldati» crede che quella colonna esista. Nella stessa riga: la vista dei conti sceglie ancora l'azione della card per ID DI CORSIA — è esattamente da lì che è nato BUG-026 nella vista comande, dove ora si guarda lo stato. COME: togliere il ramo morto (e i suoi test) o dire chi lo accenderà, e portare anche la vista dei conti su `azioneCorsia(stato)`.

*Dove*: `src/lib/coda.js, src/pages/BartenderPage.jsx`

*Nessun test lo verifica.*

### ⬜ REQ-DEV-011 — Ripetizioni che si tolgono in mezz'ora, tutte insieme

Raccolta dalla rilettura del diff della 1.5.0: cose piccole, nessuna urgente, che conviene fare in un colpo solo perché toccano file appena scritti — è il momento in cui costano meno. - `impostazioniLocali.js`: cinque coppie leggi/scrivi con lo stesso try/catch. Due funzioni private e restano cinque righe a preferenza. I commenti lunghi che spiegano perché ognuna è del DISPOSITIVO vanno tenuti tutti: sono la parte che vale. - `SettingsTab.jsx`: cinque volte lo stesso gruppo di pastiglie «scegli un modo» → un componente solo. - `InventoryManager.jsx`: il riquadro del travaso scrive tre volte lo stesso overlay e chiede due volte la stessa condizione; `CarcoForm` tiene uno stato che è ricavabile; due componenti gemelli calcolano la stessa previsione di fine serata. - `generate-issues.mjs`: rilegge una per una le issue che ha appena scaricato tutte insieme — fino a 190 chiamate in più per giro di CI. - i tre script nuovi dell'emulatore riscrivono il client REST che `lib-firestore.js` ha già: basta fargli accettare indirizzo e intestazioni.

*Dove*: `src/lib/impostazioniLocali.js, src/components/SettingsTab.jsx, src/components/InventoryManager.jsx, scripts/generate-issues.mjs, scripts/lib-firestore.js`

*Nessun test lo verifica.*

## Integrazione SumUp

### ✅ REQ-SUMUP-CONFIG-001 — Le functions SumUp sono no-op se non configurate

Se SUMUP_VENDOR_ID o SUMUP_OUTLET_ID non sono impostati, tutte le callable (syncSumUpProducts, createSumUpSale, updateSumUpSaleStatus) devono ritornare un esito { skipped: true } senza effettuare alcuna chiamata di rete verso SumUp né scritture su Firestore.

*Dove*: `functions/index.js isSumUpConfigured, functions/lib/sumup-service.js`

*Lo dimostrano*: `TC-SYNC-001`, `TC-SALE-001`, `TC-STATUS-001`

### ✅ REQ-SUMUP-SYNC-001 — Sincronizzazione catalogo SumUp → Firestore drinks

syncSumUpProducts scarica il catalogo da GET /products e aggiorna la collezione `drinks`. I prodotti già presenti (identificati da sumup_product_id) vengono aggiornati; i nuovi vengono creati con un timestamp created_at. Ritorna { synced, total }.

*Dove*: `functions/index.js syncSumUpProducts, functions/lib/sumup-service.js syncProducts`

*Lo dimostrano*: `TC-SYNC-002`, `TC-SYNC-003`, `TC-SYNC-004`, `tests/bdd/sync-products.test.js`

### ✅ REQ-SUMUP-SYNC-002 — Normalizzazione robusta della risposta prodotti SumUp

La risposta di /products può essere un array diretto o un oggetto con chiave "products"/"items"; input nullo o non valido produce zero prodotti. Ogni prodotto viene mappato sui campi drink (name, price numerico, category, description, available) con fallback sui nomi di campo alternativi; i prodotti privi di id vengono saltati. available è true salvo p.active===false o p.available===false.

*Dove*: `functions/lib/sumup-core.js extractProducts, mapProductToDrink`

*Lo dimostrano*: `TC-CORE-001`, `TC-CORE-002`, `TC-CORE-003`

### ✅ REQ-SUMUP-SALE-001 — Invio ordine a SumUp come External Sale

createSumUpSale costruisce il payload External Sale dall'ordine (customer_name derivato dal tavolo, note, sale_items con product_id/quantity/unit_price e total_price arrotondato a 2 decimali) e lo invia in POST a /external_sales. Se la vendita ha un id e l'ordine ha un orderId, persiste sumup_sale_id sull'ordine Firestore. Ritorna { saleId }.

*Dove*: `functions/index.js createSumUpSale, functions/lib/sumup-service.js createSale`

*Lo dimostrano*: `TC-SALE-002`, `TC-SALE-003`, `TC-CORE-004`, `tests/bdd/create-sale.test.js`, `tests/unit/sumup-core.test.js`

### ✅ REQ-SUMUP-STATUS-001 — Aggiornamento stato vendita su SumUp

updateSumUpSaleStatus invia in PUT a /external_sales/{saleId}/status il nuovo stato. Se saleId è assente ritorna { skipped: true, reason } senza chiamare SumUp. Ritorna { updated: true } in caso di successo.

*Dove*: `functions/index.js updateSumUpSaleStatus, functions/lib/sumup-service.js updateSaleStatus`

*Lo dimostrano*: `TC-STATUS-002`, `TC-STATUS-003`, `tests/bdd/update-sale-status.test.js`

### ✅ REQ-SUMUP-WEBHOOK-001 — Webhook SumUp → aggiornamento stato ordine Firestore

sumupWebhook accetta solo richieste POST (altrimenti 405). Estrae sale_id (o id) e status dal corpo; senza sale_id risponde 400. Mappa lo stato SumUp su quello Tana Drink (ACCEPTED→in_preparazione, COMPLETED/CANCELLED→ritirato); stati non mappati rispondono 200 OK senza modifiche. Per stati mappati aggiorna lo status dell'ordine con sumup_sale_id corrispondente, rispondendo sempre 200 OK.

*Dove*: `functions/index.js sumupWebhook, functions/lib/sumup-service.js handleWebhook`

*Lo dimostrano*: `TC-HOOK-001`, `TC-HOOK-002`, `TC-HOOK-003`, `TC-HOOK-004`, `TC-HOOK-005`, `tests/bdd/webhook.test.js`
