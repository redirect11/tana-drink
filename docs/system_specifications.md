# Tana Drink — specifica di sistema

> **Questo file è generato: non si modifica a mano.** Si modificano
> `requirements/requirements.yaml` (i comportamenti) e
> `requirements/bugs.yaml` (i difetti), poi si rigenera con
> `node scripts/requisiti.mjs --documento`.
>
> Generato il 19 agosto 2026.

Qui c'è scritto **cosa fa Tana Drink**, area per area: la cassa di «La Tana
del Coniglio», quella che si usa al banco mentre il locale è pieno. Non è un
manuale d'uso e non è documentazione del codice — è il patto su come il
sistema si deve comportare.

Ogni comportamento porta **i test che lo dimostrano**. È la regola della
casa: i test sono la specifica eseguibile, questo documento ne è la faccia
leggibile, e quando le due si scollano è il documento ad avere torto. Il
legame lo tiene `tests/unit/requisiti.test.js`: un test senza requisito fa
fallire la suite, e un requisito che cita un test inesistente pure.

## A che punto siamo

| | Quante | Cosa vuol dire |
|---|---|---|
| ✅ | 155 | fatto e coperto dai test |
| ⚠️  | 15 | fatto ma nessun test lo verifica |
| ⬜ | 21 | da fare |
| 🗑 | 1 | non più valido |

**192 voci** in tutto. **170** descrivono il sistema com'è oggi e
stanno in «[Cosa fa il sistema](#cosa-fa-il-sistema)»; **21** sono lavori
previsti e stanno in un capitolo a parte, perché un impegno preso non è una
cosa che l'app fa; **6** difetti noti sono ancora aperti.

Le voci ⚠️ sono la parte scomoda: funzionano, ma **nessun test le tiene**.
Sono quelle che si rompono senza che nessuno se ne accorga, e vanno lette
come «vero oggi», non come «garantito».

### Le aree

| Area | Fatto | Previsto | Di cosa parla |
|---|---|---|---|
| [Ordini e comande](#ordini-e-comande) | 18 | 1 | Il conto e le sue comande: come nascono, come cambiano stato, come arrivano al banco. |
| [Cassa e POS](#cassa-e-pos) | 17 | 2 | La schermata più usata della serata: si compone un conto, si corregge, si chiude. |
| [Pagamenti](#pagamenti) | 10 | 1 | Come si incassa: contanti, carta, SumUp, pagamenti parziali e separati. |
| [La coda del banco](#la-coda-del-banco) | 5 | — | Quello che il banco vede mentre lavora: cosa c’è da fare adesso, e in che ordine. |
| [Gruppi di conti](#gruppi-di-conti) | 4 | — | Più conti che vanno insieme — un tavolo, una comitiva — senza fonderli in uno. |
| [Tavoli](#tavoli) | — | 2 | L’anagrafica dei tavoli e il modo in cui un ordine ci si aggancia. |
| [Menù e catalogo](#menù-e-catalogo) | 9 | — | Il listino: drink, categorie, disponibilità, prezzi. |
| [Magazzino](#magazzino) | 19 | 7 | Prodotti, ricette, scorte e consumi. Le quantità sono sempre in unità base. |
| [Cassa di serata e statistiche](#cassa-di-serata-e-statistiche) | 10 | 2 | La serata vista dai numeri: incassi, chiusura, statistiche, conti del locale. |
| [Stampa](#stampa) | 9 | 2 | La stampante termica al banco: comande, scontrini, chiusure di cassa. |
| [Vista cliente](#vista-cliente) | 6 | — | Quello che vede il cliente: vetrina, menù, stato del suo ordine. |
| [Notifiche](#notifiche) | 4 | — | Le notifiche push: a chi arrivano, quando, e quando invece non devono arrivare. |
| [Avvisi a schermo](#avvisi-a-schermo) | 2 | — | I messaggi a schermo dentro l’app — quelli che si leggono col vassoio in mano. |
| [Persone: ruoli, utenze, ore](#persone-ruoli-utenze-ore) | 10 | 1 | Chi può fare cosa, chi è al banco, quante ore ha fatto e quanto prende. |
| [Sicurezza](#sicurezza) | 2 | 1 | Regole di accesso, App Check, e cosa protegge cosa. |
| [Si lavora anche senza rete](#si-lavora-anche-senza-rete) | 4 | — | Cosa continua a funzionare quando la rete non c’è, e come lo si vede. |
| [Dati e ambienti](#dati-e-ambienti) | 2 | — | Il modello dei dati, gli ambienti (test e produzione) e il modo di travasarli. |
| [Integrazione SumUp](#integrazione-sumup) | 6 | — | Il dialogo con il terminale SumUp, dalle Cloud Functions. |
| [Intelligenza artificiale](#intelligenza-artificiale) | — | 1 | Dove l’intelligenza artificiale entra nel lavoro del locale. |
| [Interfaccia](#interfaccia) | 21 | — | Le regole dell’interfaccia: tema, navigazione, spazi, cosa si vede e cosa si toglie. |
| [Come si lavora al progetto](#come-si-lavora-al-progetto) | 12 | 1 | Non è comportamento dell’app: è il metodo con cui la si costruisce. |

## Cosa fa il sistema

Quello che segue è vero adesso. Dove una voce è segnata 🟡 «fatto a metà» la
sua descrizione dice anche cosa manca: si è preferito tenerla intera invece
di spezzarla in due mezze verità.

### Ordini e comande

Il conto e le sue comande: come nascono, come cambiano stato, come arrivano al banco.

#### REQ-ORD-001 — Un conto aperto contiene più comande, ciascuna col suo stato

Un ordine è un CONTO che resta aperto (aperto/pagato/annullato) e contiene una o più comande. La lavorazione (ricevuto, in preparazione, pronto, ritirato) vive sulla singola comanda: un tavolo può avere un giro già servito e uno ancora al banco. La comanda attiva è quella al passo più indietro; a parità di passo vince la più vecchia.

**Dove**: `src/lib/comande.js, src/lib/api.js` · **Lo dimostrano**: `tests/unit/comande.test.js`, `tests/unit/orderStatus.test.js`, `tests/unit/orderLines.test.js`

#### REQ-ORD-002 — Gli ordini vecchi continuano a funzionare

Gli ordini scritti prima del modello a comande hanno solo `items` e uno stato di lavorazione sul conto: vengono normalizzati al volo in un conto con una comanda sintetica che porta quello stato. Nessuna migrazione dei dati, e lo storico resta leggibile e calcolabile come il resto.

**Dove**: `src/lib/comande.js normalizeOrderDoc` · **Lo dimostrano**: `tests/unit/comande.test.js`

#### REQ-ORD-003 — Aggiungere a un conto non riapre quello che è già stato servito

Gli aumenti confluiscono nella comanda ancora modificabile (ricevuta o in preparazione); se non ce n'è, nasce una comanda nuova. Le diminuzioni scalano solo da comande modificabili: quello che è già pronto o servito non si tocca, perché il drink è stato fatto davvero.

**Dove**: `src/lib/comande.js, src/components/OrderPosDetail.jsx` · **Lo dimostrano**: `tests/unit/comande.test.js`, `tests/component/OrderPosDetail.test.jsx`

#### REQ-ORD-004 — Un conto rimasto senza righe si annulla da solo

Togliendo tutte le righe di un conto appena aperto, il conto viene annullato e si torna alla coda: un conto vuoto in lista è solo un ingombro. Non succede se qualcosa è già stato incassato — lì il conto esiste davvero e va chiuso a mano.

**Dove**: `src/components/OrderPosDetail.jsx` · **Lo dimostrano**: `tests/component/OrderPosDetail.test.jsx`

#### REQ-ORD-005 — Annullando un conto le scorte tornano a magazzino

L'annullo rimette in magazzino quello che le comande avevano scalato, usando lo snapshot di consumo salvato al momento dello scarico e non ricalcolando la ricetta, che intanto può essere cambiata. Fa eccezione l'annullo per "non ritirato": lì il drink è stato preparato e il prodotto è consumato.

**Dove**: `src/lib/api.js cancelOrder` · **Lo dimostrano**: `tests/unit/warehouse.test.js`

#### REQ-ORD-006 — Chiudendo un conto sparisce subito dalla coda

Chiudendo o annullando si torna alla lista ordini, dove quel conto non deve più comparire: la scrittura viaggia in sottofondo e la coda avrebbe ancora la versione di prima — lo si vedeva lì, e lo si guardava sparire. I conti chiusi da questo dispositivo escono subito dalla lista; se la scrittura fallisce ricompaiono, e la memoria scade da sé dopo un minuto.

**Dove**: `src/lib/ordiniNascosti.js, src/components/OrderPosDetail.jsx` · **Lo dimostrano**: `tests/unit/ordiniNascosti.test.js`, `tests/component/OrderPosDetail.test.jsx`

#### REQ-ORD-007 — La coda distingue aperti e chiusi, e ignora gli annullati

La coda smista i conti per stato, conta e somma solo i non annullati e sa dire quanti conti sono ancora aperti. Con la gestione della preparazione attiva un conto pagato ma non servito resta da fare; senza, il pagamento chiude e basta — e nella schermata di pagamento non compare l'avviso «comande non ancora servite», che senza preparazione non vuol dire niente e uscirebbe a ogni incasso. E la coda è il lavoro di ADESSO: un conto incassato o annullato prima dell'ultima chiusura di cassa non compare, in nessuna tab — chiusi, annullati o tutti — perché quei conti sono già stati contati e rendicontati; stanno in Cassa, nella lista ordini. Non basta guardare la giornata: in una serata la cassa si chiude e si riapre. I conti APERTI restano sempre, cassa chiusa compresa: quelli sono da chiudere, e nasconderli vorrebbe dire perderli. Chiudendo o annullando un conto si scrive in QUALE cassa è successo, e la coda tiene d'occhio anche quelli: senza, un conto aperto giorni prima e annullato stasera usciva dall'elenco dei conti aperti, non entrava in quello di oggi — che guarda la data di apertura — e spariva dallo schermo nell'istante in cui lo si annullava. Vale anche per il rendiconto di cassa: un tavolo aperto ieri e incassato stasera è incasso di stasera. Conta QUANDO è stato chiuso, non quando è stato aperto: un conto di ieri rimasto aperto e annullato stasera è successo stasera, e guardando la sessione in cui era nato spariva dalla tab «annullati» nell'istante in cui lo si annullava — si agisce su un conto e quello svanisce, senza sapere se l'operazione è andata a buon fine. Il riepilogo in testata NON cambia cambiando tab: è cumulativo — aperti, chiusi e annullati di questa apertura — e si calcola sugli ordini grezzi, non su quelli che la tab sta mostrando. «In corso» nasconde i conti appena chiusi da qui e le altre tab no: il numero ballava solo perché si toccava un filtro. Il riepilogo in testata è di questa apertura di cassa — a cassa chiusa sono zeri — e accanto ad aperti e chiusi dice quanti conti sono stati ANNULLATI, che non fanno cassa ma sono un dato del banco. Chi la cassa non la apre mai continua a vedere la giornata: è l'unico riferimento che ha.

**Dove**: `src/lib/coda.js` · **Lo dimostrano**: `tests/unit/coda.test.js`, `tests/unit/codaCache.test.js`, `tests/unit/cashSessionHook.test.js`, `tests/component/PaymentScreen.test.jsx`

#### REQ-ORD-014 — Riscuoti, oppure riscuoti e servi in un colpo solo

Con gli stati del servizio, incassare non chiude il conto: si paga anche in anticipo e restano drink da fare, e marcare tutto «servito» farebbe sparire dalla coda lavoro ancora da fare. Il conto si riscuote sempre, si chiude solo quando è servito. Al banco però capita spessissimo il contrario — si consegna e si incassa nello stesso gesto — e lì due passaggi sono uno di troppo: il locale può accendere «Un tasto per incassare e servire insieme» (Impostazioni → Gestione preparazione). Acceso, nella schermata di pagamento compare anche «Riscuoti e servi», che chiude il conto in un colpo. Spento di default: chi segue il servizio di solito lo segue apposta. Il tasto non compare dove non serve — servizio spento, conto già servito o già chiuso.

**Dove**: `src/components/PaymentScreen.jsx, src/lib/api.js` · **Lo dimostrano**: `tests/component/PaymentScreen.test.jsx`, `tests/unit/pagamentoNonServe.test.js`

#### REQ-ORD-019 — Chi ha preso l'ordine lo modifica davvero: anche aggiungendo

Nel dettaglio di un ordine, la sala poteva solo cambiare le QUANTITÀ di quello che c'era già: chi aveva preso l'ordine e si sentiva dire «aggiungi anche una birra» doveva battere un secondo conto. «Modifica ordine · aggiungi prodotti» apre la schermata del conto: la stessa del banco, quella vera, con la griglia dei prodotti. Niente versione ridotta — chi prende un ordine al tavolo ci fa le stesse cose, e un tasto spento in una schermata e acceso nell'altra è solo una cosa che non si capisce. Aprire e chiudere la CASSA resta invece del banco (REQ-CASSA-008): quella è la serata, non il conto. «Salva modifiche» resta dov'è: correggere una quantità e aggiungere un drink sono due gesti diversi, e chi fa il primo non deve passare per una schermata intera. E c'è «Pagamento», che apre la stessa schermata già sul pagamento: al tavolo si incassa lì, e senza quel tasto bisognava tornare in coda, riaprire il conto dal banco e incassare da lì — col cliente che aspetta col portafogli in mano. Su un conto già saldato o annullato non compare. Al cliente niente di tutto questo: dal suo telefono modifica le quantità del proprio ordine finché è ricevuto, e basta.

**Dove**: `src/pages/OrderStatusPage.jsx, src/components/OrderPosDetail.jsx` · **Lo dimostrano**: `tests/component/OrderStatusPage.test.jsx`

#### REQ-ORD-018 — Salvare le modifiche a un ordine lo dice, e riporta indietro

Nel dettaglio ordine della vista staff, «Salva modifiche» tornava «Salva modifiche» e basta: identico a prima di premerlo. Chi aveva cambiato una quantità restava lì a chiedersi se fosse andata, e spesso ripremeva. Ora la conferma si vede e si torna alla coda — da dove si è arrivati, e dove il conto si rilegge aggiornato. In errore invece si resta, e il motivo si dice anche col toast: l'avviso in fondo alla pagina, su un conto lungo, sta fuori schermo — chi ha premuto vede il tasto tornare com'era e crede che non sia successo niente.

**Dove**: `src/pages/OrderStatusPage.jsx` · **Lo dimostrano**: `tests/component/OrderStatusPage.test.jsx`

#### REQ-ORD-017 — Il QR per il cliente c'è solo se c'è qualcosa da seguire

Sul dettaglio di un ordine battuto al banco, allo staff compare «Mostra QR al cliente»: chi lo scansiona segue il proprio drink dal telefono. Con gli stati del servizio SPENTI non c'è niente da seguire — la pagina dice solo cosa è stato ordinato — e offrirlo è promettere una cosa che non succede: lì il tasto non compare.

**Dove**: `src/pages/OrderStatusPage.jsx` · **Lo dimostrano**: `tests/component/OrderStatusPage.test.jsx`

#### REQ-ORD-015 — Nella lista ordini si cercano anche le serate passate

La lista mostrava gli ultimi conti e basta: per ritrovare una serata di due settimane fa non c'era strada. C'è un selettore a calendario come quelli degli alberghi — si tocca il giorno d'inizio, poi quello di fine, e in mezzo si accende tutto; un tocco solo vuol dire quella serata e basta, che è il caso più frequente. Sopra ci sono le scorciatoie (oggi, ieri, ultimi 7 e 30 giorni), perché quasi sempre si cerca lì. I giorni sono GIORNATE COMMERCIALI: la serata del venerdì finisce alle quattro del sabato, e chi cerca «venerdì» cerca quella. I giorni futuri sono spenti. Scelto un periodo, i conti si vanno a leggere dal database: in tempo reale ci sono solo gli ultimi. C'è anche un filtro su CHI ha aperto il conto — il locale (banco e sala) o il cliente dal suo telefono — che compare solo se di ordini dai clienti ce n'è davvero: dove non succede sarebbe una domanda senza risposta.

**Dove**: `src/lib/periodo.js, src/components/SelettorePeriodo.jsx, src/components/OrdersHistory.jsx, src/lib/api.js` · **Lo dimostrano**: `tests/unit/periodo.test.js`

#### REQ-ORD-016 — Battere un conto non aspetta la rete, e non ne nascono due

Prima di scrivere un ordine si facevano TRE letture al server — quale cassa è aperta, il progressivo della serata, quello assoluto — e solo dopo il conto compariva: era il mezzo secondo fra «Conferma» e il conto a schermo. Adesso quei numeri stanno in memoria, tenuti aggiornati da ascolti che partono all'avvio dell'app: alla creazione non si chiede niente a nessuno. E DUE CONTI NON PRENDONO PIÙ LO STESSO NUMERO. Il numero è il più grande fra quello del server e l'ultimo dato da questo dispositivo, più uno: due creazioni ravvicinate non possono più leggere lo stesso valore solo perché la scrittura del contatore è ancora per strada — è così che sono nati due conti #15 nella stessa serata. Quello che si è assegnato resta scritto anche dopo un ricaricamento, e il contatore si scrive con un incremento, che non torna mai indietro. Resta scoperto un solo caso: due DISPOSITIVI che battono nello stesso istante. Escluderlo vorrebbe dire una transazione, cioè aspettare il server a ogni ordine — il contrario di quello che serve al banco.

UNA BATTUTA, UN CONTO. La schermata può chiedere la creazione due volte (l'auto-creazione che scatta mentre si preme «Paga», un doppio tocco): la chiave della battuta fa restituire il conto che sta già nascendo invece di farne un altro. E il «+» apre sempre un conto NUOVO: la memoria del conto in corso serve a riprenderlo dopo un ricaricamento della pagina, non a rimetterci dentro chi esce e rientra.

DUE TERMINALI, LO STESSO NUMERO: la disputa la chiude il SERVER, che è l'unico posto dove esiste un «prima» e un «dopo» veri. Tiene il numero chi è arrivato prima; chi arriva dopo prende il primo libero dopo il più alto — un buco in mezzo sarebbe di un conto ancora per strada, e la disputa ricomincerebbe. A parità di istante decide l'id del documento: arbitrario, ma UGUALE per i due terminali, che è l'unica cosa che conta. Tutto automatico: al banco non si ferma una serata per un numero. Il numero cambia solo a chi ha perso, e resta scritto da dove veniva (`daily_number_precedente`), perché la comanda può essere già uscita dalla stampante col numero vecchio.

LE TRE SCHERMATE DEL SERVIZIO — coda, conto, pagamento — LAVORANO IN LOCALE. Leggono dalla cache, scrivono in sottofondo e si aggiornano da sole quando il server manda qualcosa di nuovo. Niente attese per far vedere l'esito di un gesto: incassare, annullare, aggiungere una riga si vedono nell'istante in cui si tocca, e i numeri in cima si muovono con loro. Il dato che serve si PRECARICA — i progressivi, la cassa aperta — invece di andarlo a chiedere al momento del bisogno.

QUELLO CHE HO APPENA FATTO IO STA IN UN POSTO SOLO (src/lib/comandeLocali.js): l'array `comande` come lo vede questo terminale, per conto, che se ne va da sé quando il server racconta la stessa cosa. «La stessa cosa» è la FIRMA DEL LAVORO (firmaLavoro in comande.js): i passi e le quantità, senza gli id — una comanda appena creata qui non ha ancora il nome che le darà il server — e senza i campi che il server aggiunge per conto suo. Si toglie solo allora, mai subito dopo la scrittura: quella risponde PRIMA dello snapshot, e toglierla lì farebbe riapparire per un battito lo stato di prima. Erano tre copie della stessa idea (la coda, il conto, il dettaglio della comanda) e si comportavano già in modo diverso.

DOVE FINISCONO LE RIGHE AGGIUNTE a un conto aperto lo dice `comandaPerLeAggiunte` (comande.js), un punto solo per tutte le strade: nella comanda che sta già nel passo di nascita, o in una nuova. Non nella prima «toccabile», che vuol dire un'altra cosa (BUG-024). Una comanda provvisoria nasce col passo e il numero che avrà DAVVERO, o si vedrebbe cambiare da sé un istante dopo.

IN CHE PASSO NASCE UNA COMANDA lo decide il locale («Le comande nascono già in preparazione», Impostazioni → Gestione preparazione; di suo SPENTA, quindi «da fare») e lo si chiede a `statoComandaNuova(settings)` in comande.js. Vale allo stesso modo per la prima comanda di un conto nuovo e per le aggiunte a metà serata: prima erano due regole diverse scritte in due posti, più una terza nel placeholder della coda, e le tre risposte non combaciavano — la card compariva «Al banco» e saltava in «Da fare» appena arrivava dal server. È una FUNZIONE e non una costante esportata apposta: con un valore da copiare basta che una strada scriva un «ricevuto» a mano per non seguire l'impostazione, e non se ne accorge nessuno.

COL SALTO ACCESO IL PASSO «DA FARE»

NON ESISTE, e non deve comparire da nessuna parte come destinazione: sparisce dalle pastiglie «↩︎ Torna a…» (statiPrimaComanda in comande.js: i passi già fatti, meno quelli PRIMA di dove nasce il lavoro) e dall'elenco delle colonne che si accendono a mano (corsieSceglibili). Non si tocca però quello che c'è già: una comanda ferma a «da fare» resta dov'è e va avanti normalmente, e la sua colonna compare da sé (corsieDaMostrare) — il lavoro non si nasconde mai, e a mostrarlo è l'app, non una voce di menu che l'utente deve trovare.

LE PAROLE DEL BANCO NON SONO QUELLE DEL CLIENTE: al banco il passo si chiama «Da fare» come la colonna (statoAlBanco in orderStatus.js), al cliente «Ordine ricevuto», che è quello che gli serve sapere — non è lui che lo deve fare. Due etichette, non una sola «giusta». E UNA SCRITTURA IN SOTTOFONDO TOCCA SOLO I CAMPI CHE LE COMPETONO: `comande` è un array e Firestore lo riscrive intero, quindi chi scrive si rilegge il documento NELL'ISTANTE PRIMA DI SCRIVERE, non all'inizio del lavoro (vedi BUG-022: fra le due cose ci sono le letture di ricette e articoli, e l'array vecchio si portava via l'avanzamento appena fatto). Anche i tasti: «invia comanda» e «annulla ordine» funzionano su un conto appena battuto, senza aspettare che esista sul server. E annullare lascia SEMPRE un conto annullato, anche se l'ordine non era ancora nato: il numero è già stato mostrato e preso, e di quello che è stato battuto deve restare traccia.

LA SCHERMATA DEL CONTO NUOVO SI APRE PULITA, senza pulizie all'apertura: uscendo — dalla freccia, dal menu, dal tasto indietro — quello che è stato battuto diventa un conto e la bozza si chiude. La «bozza che non si perde» continua a valere: non si perde perché diventa un conto, non perché resta in un cassetto da cui il conto dopo se la ritrova dentro. Un tasto 🧹 svuota tutte le righe in un colpo (con conferma), invece di toglierle una per una. E la bozza si svuota all'istante: aspettare la scrittura voleva dire aprire il conto dopo e trovarci dentro le righe di quello prima.

LE MODIFICHE CHE NON PASSERANNO MAI si dicono e si scartano. «Il documento non esiste più» o «non hai i permessi» non cambiano al secondo tentativo — succede quando qualcuno cancella un prodotto mentre tu ne stavi scalando la scorta — quindi non si riprovano da sole, si spiegano a parole («una scheda del magazzino non esiste più») e si tolgono dalla lista con un tasto. Senza, la campanella resta rossa per sempre su roba che non si può salvare. E QUELLO CHE SI SCRIVE ARRIVA AGLI ALTRI DA SÉ. Ogni modifica entra prima nella memoria locale e parte per il server in sottofondo: gli altri terminali la vedono comparire senza che nessuno prema niente. Offline le scritture non falliscono — restano in coda dentro Firestore, che le conserva anche a app chiusa, e partono appena c'è linea. Quelle RIFIUTATE (un errore vero, la rete che si chiude a metà) si riprovano da sole al ritorno della rete, fino a tre volte: oltre, restano lì e lo dice la campanella, perché una scrittura che continua a essere rifiutata ha bisogno di una persona, non di un altro tentativo. E NIENTE ASPETTA IL SERVER. Ogni azione su un conto — incassare, annullare, avanzare, aggiungere righe — leggeva il documento dal SERVER prima di scrivere: da lì il ritardo fra il tocco e la coda che si muove, e il riepilogo in cima che sembrava aggiornarsi solo alla risposta del server. Si legge dalla cache, che l'ascolto della coda tiene già allineata. E USCIRE DAL CONTO NON ASPETTA NIENTE. Il box del nome aspettava che il conto fosse nato per sapere se chiederlo — ma il nome si sa già dalla schermata: l'unica cosa che quell'attesa produceva era il box in ritardo. Il conto nasce per conto suo, e il nome lo raggiunge appena c'è.

**Dove**: `src/lib/progressivi.js, src/lib/api.js, src/components/OrderPosDetail.jsx` · **Lo dimostrano**: `tests/unit/progressivi.test.js`, `tests/bdd/numerazione.test.js`, `tests/component/PosPage.test.jsx`, `tests/unit/sync.test.js`, `tests/unit/scritturaComande.test.js`, `tests/component/UnaMemoriaLocale.test.jsx`, `tests/component/ComandaSenzaAttesa.test.jsx`

#### REQ-ORD-008 — Un conto chiuso o annullato si può rimettere in corso

Capita di chiudere un conto sul tavolo sbagliato, di annullarlo per un malinteso, o che il cliente torni e voglia ordinare ancora su quello. Nella storia CHI ha fatto una cosa si scrive sempre allo stesso modo: il NOME, col ruolo fra parentesi se si sa. Mai l'email, che è un indirizzo e non una persona. Prima la stessa persona compariva tre volte con tre etichette diverse — l'email all'apertura, il ruolo all'annullo (l'unica cosa che quella strada scriveva), il nome alla riapertura — e chi leggeva non poteva dire «è stato lui». Chi ha il gestionale può rimetterlo in corso: si conferma in un pannello che dice cosa succederà e si può scrivere il perché — FACOLTATIVO, perché se fosse obbligatorio si scriverebbe "x" per passare oltre, e al banco i secondi non ci sono. Il conto torna aperto e si può battere di nuovo.

RIAPRIRE = COME SE NON FOSSE MAI STATO PAGATO. Gli incassi si tolgono: il conto riaperto è un conto normale, da battere e da incassare, con tutte le righe modificabili. Prima gli incassi restavano attaccati e il conto tornava «ad acconto»: le righe già pagate erano bloccate — e riaprire serve proprio a toccarle — e i soldi restavano nei guadagni della serata di un conto che era di nuovo da incassare, quindi a fine turno lo stesso conto risultava incassato due volte. La cassa legge gli incassi dagli ordini, perciò toglierli dal conto li toglie anche dal flusso di cassa. Non si butta via niente: quello che era entrato resta in `payments_annullati` con l'ora in cui è stato tolto, e il totale compare nella storia del conto («riaperto — tolti 15,50 € dagli incassi»), che è dove lo si va a cercare quando la cassa non torna. Le comande già servite restano servite: tornano da fare solo quelle annullate col conto.

SU UN CONTO RIAPERTO SI TOCCA TUTTO, righe vecchie comprese. Di norma una comanda servita non si modifica più — il drink è stato fatto e portato — ma riaprire serve ESATTAMENTE a rimettere a posto quello che c'è dentro: un giro battuto sul tavolo sbagliato, una birra di troppo. Se le righe di prima restano bloccate, il conto riaperto non serve a niente. Le scorte si riallineano con la differenza, come per ogni altra modifica. Il tasto per riaprire NON è un tasto in più: è quello del PAGAMENTO, che su un conto chiuso o annullato era lì spento a non fare niente.

ANNULLANDO, il saldo di un buono usato per pagare torna al beneficiario: il conto non si incassa più, e lasciarlo scalato significherebbe fargli perdere il credito per un conto mai pagato. Le righe restituite si segnano (`restituito_at`), così riaprendo lo stesso conto non tornano una seconda volta — sarebbe credito inventato, l'errore opposto.

IL BUONO NON SI PAGA DUE VOLTE. Il saldo di un buono si scala quando lo si usa, non quando i soldi entrano in cassa. Se il conto era stato PAGATO con un buono, riaprendolo quella riga di incasso sparisce come le altre: il saldo torna al beneficiario, altrimenti avrebbe pagato due volte — una col buono che non torna, una quando ripaga il conto. Il buono usato come SCONTO invece resta dov'è: lo sconto è ancora sul conto, quindi qualcuno deve pagarlo, e ri-chiuderlo non lo scala una seconda volta. Se il conto annullato era stato scontato con un BUONO VIP, riaprendolo il saldo si ri-addebita: annullando era tornato al beneficiario, e lasciarlo lì significherebbe uno sconto che nessuno ha pagato e un credito in circolazione che non torna più con i conti. Se nel frattempo il buono è stato speso altrove e il saldo non basta, si addebita quel che c'è e lo sconto si riduce a quella cifra (fino a sparire): meglio un conto che chiede qualche euro in più che un buono in rosso. Su un conto CHIUSO non si tocca niente, perché lì il buono non era mai stato ristornato. Il motivo si legge DENTRO il conto riaperto, senza doverlo cercare, e la storia completa — aperto, chiuso, annullato, riaperto, con chi e perché — sta dietro i ⋯ del conto, sia nella coda sia nel dettaglio. La storia si ricostruisce da quello che il conto porta già addosso, quindi vale anche per i conti di ieri, senza migrazioni.

**Dove**: `src/lib/storiaOrdine.js, src/lib/api.js, src/components/StoriaOrdine.jsx` · **Lo dimostrano**: `tests/unit/storiaOrdine.test.js`, `tests/component/OrderPosDetail.test.jsx`, `tests/unit/vouchers.test.js`, `tests/unit/ripristino.test.js`

#### REQ-ORD-010 — Gli annullati hanno una tab loro nella coda

La coda si filtra con «In corso», «Chiusi», «Annullati» e «Tutti». Gli annullati stavano fra i chiusi: facevano numero senza essere incassi — «Chiusi» sono i soldi della serata — e per ritrovarne uno da riaprire bisognava cercarlo in mezzo a quelli buoni. Un conto annullato non è un conto chiuso: è un conto che non c'è più. La regola è pura (`passaFiltroCoda`), così il filtro non si sposta di significato fra la griglia e i conteggi.

**Dove**: `src/lib/coda.js, src/pages/BartenderPage.jsx` · **Lo dimostrano**: `tests/unit/coda.test.js`

#### REQ-ORD-020 — Servizio o ritiro: il locale dice come nascono i conti, lo staff cambia il suo

Un conto è servito al tavolo o ritirato al banco. Chi decide, in ordine: il LOCALE dice come NASCONO i conti — non quali modi esistono; il CLIENTE sceglie il suo, ma solo se glielo si lascia scegliere e solo se ordina da sé; lo STAFF può sempre cambiare quello che ha in mano. La scelta sta sul CONTO (`order.service_mode`), non sul terminale e non sul locale: due conti battuti dallo stesso tablet possono essere uno servito e uno da ritirare, ed è tutto il punto. Prima l'impostazione era un VINCOLO: finiva sull'ordine alla creazione e non c'era nessun posto in cui cambiarla.

**Dove**: `src/lib/consegna.js, src/components/SettingsTab.jsx, src/components/OrderPosDetail.jsx, src/components/OrderSummary.jsx, src/lib/coda.js, src/lib/api.js` · **Lo dimostrano**: `tests/unit/consegna.test.js`, `tests/component/OrderPosDetail.test.jsx`, `tests/component/CodaCorsie.test.jsx`

#### REQ-ORD-009 — Un ordine battuto altrove si vede su tutti gli altri terminali

Chi manda un ordine — o lo annulla — non ha bisogno di un avviso che gli dica quello che ha appena fatto; tutti gli altri terminali sì. Vale anche per l'ANNULLAMENTO, che porta con sé il terminale (`cancelled_device`): chi annulla lo fa quasi sempre dal conto e non dalla coda, quindi «l'ho premuto io» non basterebbe — quella schermata è un'altra. Il metro è il DISPOSITIVO, non il ruolo: prima si tacevano tutti gli ordini battuti da un gestore su qualunque terminale, e chi stava in sala col telefono non sapeva mai che al banco era entrato un ordine — lo stesso account sta su tablet, telefono e portatile insieme. Ogni ordine porta l'identificativo del dispositivo che l'ha creato (un numero a caso per browser, non identifica una persona); gli ordini che non ce l'hanno avvisano, perché un avviso in più si chiude e uno in meno è un drink che non parte. Le notifiche della campanella si dividono in DA LEGGERE e lette: una letta sparisce dall'elenco — in mezz'ora di servizio un elenco che non si svuota mai diventa un muro di righe vecchie, e non ci si guarda più — e resta nello STORICO, che si apre dalla campanella. Aprire la campanella non è leggere: si segna leggendo, toccando la notifica, oppure con «segna tutte lette», che è una decisione.

OGNI AVVISO SI PUÒ SPEGNERE, uno per uno: nuovo ordine, ciascuno stato della preparazione separatamente, le scorte (in esaurimento ed esaurita, solo per chi tiene il gestionale) e la nuova versione dell'app. La scelta è PER DISPOSITIVO E PER PERSONA e resta in memoria locale, perché non è una regola del bar: al banco «nuovo ordine» è la cosa più importante della serata, in sala serve «pronto», e sul portatile nel retro non serve niente. Un interruttore unico si spegnerebbe dove dà fastidio lasciando senza chi ne aveva bisogno; e due persone che si passano lo stesso tablet nei cambi turno non si sovrascrivono a vicenda. Di partenza sono tutti accesi: nessuno deve scoprire di essersi perso un ordine perché «era spento di default».

**Dove**: `src/lib/dispositivo.js, src/pages/BartenderPage.jsx, src/lib/notifyStore.js` · **Lo dimostrano**: `tests/unit/dispositivo.test.js`, `tests/unit/notifyStore.test.js`, `tests/unit/preferenzeNotifiche.test.js`

#### REQ-ORD-022 — Lo staff che tocca un conto entra nel conto, non nella pagina del cliente

Chiesto dall'utente il 19/08. Con gli stati del servizio accesi, lo staff che tocca un ordine finisce sulla pagina di stato del CLIENTE — quella col riquadro «Il tuo numero» — che per chi lavora non vuol dire niente: lui deve entrare nella MODIFICA del conto. Due cose, e la seconda è una funzione che manca: 1) toccando un ordine lo staff va sempre nella schermata del conto, con o senza stati di servizio; 2) resta utile una schermata da mostrare al cliente col QR per seguire l'ordine — quella va bene, ma senza il riquadro «Il tuo numero», che è scritto per chi ordina e non per chi serve — e con un tasto «Modifica» che porta al conto. In pratica: la stessa pagina cambia di mestiere a seconda di chi guarda, e oggi non lo fa.

FATTO: chi è personale (admin, banco e sala) che apre `/ordine/:id` entra nel conto; con `?cliente=1` la stessa pagina torna quella da girare al cliente — senza «Il tuo numero», col QR e con «✏️ Modifica» che riporta al conto. Ci si arriva dal ⋯ del conto, voce «Mostra al cliente», che senza gli stati del servizio non compare (non ci sarebbe niente da seguire).

**Dove**: `src/pages/OrderStatusPage.jsx, src/pages/BartenderPage.jsx` · **Lo dimostrano**: `tests/component/OrderStatusPage.test.jsx`, `tests/component/OrderPosDetail.test.jsx`

### Cassa e POS

La schermata più usata della serata: si compone un conto, si corregge, si chiude.

#### REQ-POS-001 — L'ordine nasce al primo prodotto, senza cambiare schermata

Toccando il primo prodotto il conto viene creato in place: niente navigazione, niente ricaricamento, la schermata resta quella e da lì si continua come in modifica. Il nome del cliente si chiede all'uscita, una volta sola.

**Dove**: `src/components/OrderPosDetail.jsx, src/pages/PosPage.jsx` · **Lo dimostrano**: `tests/component/PosPage.test.jsx`

#### REQ-POS-002 — Niente si perde mentre l'ordine sta nascendo

La creazione dura qualche decimo di secondo e in quei decimi al banco si continua a battere: le righe aggiunte nel frattempo devono finire nello stesso conto, senza sparire e senza far nascere un secondo conto. La bozza cambia chiave quando il conto nasce, e le righe rimaste vanno passate alla chiave nuova. Nemmeno il PAGAMENTO si perde: premendo Pagamento mentre la creazione è ancora in volo, la schermata deve restare aperta anche quando il server risponde e il conto smette di essere "nuovo" — prima si chiudeva da sola e bisognava ripremere Pagamento, col cliente davanti.

**Dove**: `src/components/OrderPosDetail.jsx` · **Lo dimostrano**: `tests/component/OrderPosDetail.test.jsx`

#### REQ-POS-003 — La bozza non si perde uscendo dalla schermata

Le righe non ancora confermate restano in memoria locale per contesto: uscendo e rientrando si riprende da dove si era. Vale anche per l'ordine visivo delle righe, riordinabile a mano.

**Dove**: `src/lib/useDraft.js` · **Lo dimostrano**: `tests/unit/useDraft.test.js`

#### REQ-POS-004 — Un ricaricamento non fa perdere il conto in corso

In creazione il conto nasce senza cambiare pagina: dopo un ricaricamento l'app non saprebbe più su quale conto stava lavorando e ne aprirebbe un altro, lasciando il primo in coda con dentro la roba già battuta. L'id del conto viene ricordato e ripreso al rientro, se è ancora aperto; si dimentica uscendo, alla chiusura, o dopo otto ore.

**Dove**: `src/components/OrderPosDetail.jsx` · ⚠️ **Nessun test lo verifica.**

#### REQ-POS-005 — Le modifiche sono istantanee a schermo, sincronizzate dopo

Aggiunte e diminuzioni compaiono subito e partono in sottofondo: nessuna schermata aspetta il server. Se la scrittura fallisce lo dice un avviso, ma il lavoro al banco non si ferma mai.

**Dove**: `src/components/OrderPosDetail.jsx, src/lib/sync.js` · **Lo dimostrano**: `tests/component/OrderPosDetail.test.jsx`, `tests/unit/incassoOffline.test.js`, `tests/unit/pendingOrders.test.js`

#### REQ-POS-006 — Prodotto libero: una voce che non è a menù

Si aggiunge al conto una voce fuori catalogo, con nome, prezzo e ricetta incorporata. La ricetta incorporata ha precedenza su quella del catalogo quando si scaricano le scorte.

**Dove**: `src/components/CustomDrinkForm.jsx` · **Lo dimostrano**: `tests/component/CustomDrinkForm.test.jsx`, `tests/unit/inventory.test.js`

#### REQ-POS-007 — Sul telefono la pagina è per le righe e la griglia

Sotto i 700px in pagina restano totale, righe del conto e i tre gesti della serata (Invia, Paga, Annulla); comande, prodotto libero, dati conto, unisci, separa e gruppo stanno dietro i tre puntini. Il pannello si apre mostrando l'ultima riga battuta e si alza da una maniglia.

**Dove**: `src/components/OrderPosDetail.jsx, src/components/ActionSheet.jsx` · **Lo dimostrano**: `tests/component/OrderPosDetail.test.jsx`

#### REQ-POS-019 — La striscia delle card dice quello che serve a chi lavora

La striscia a sinistra delle card — griglia del conto e schede del menù — si sceglie, perché dipende da come si lavora: chi conosce il listino a memoria vuole i colori delle categorie per trovare il prodotto al tatto, chi sta finendo le bottiglie vuole vedere subito cosa non si può più fare, chi ha già abbastanza colori addosso la vuole spenta. Quattro modi:

SPENTA (grigia, il colore resta nella linguetta), PRODOTTO (il suo colore, o quello della categoria se non ne ha uno), CATEGORIA (sempre la categoria: il colore del singolo prodotto lo dice la linguetta) e SCORTE (rosso ingrediente esaurito, arancione in esaurimento, e «ce n'è abbastanza» a scelta fra grigio e verde). Un prodotto fuori menu resta GRIGIO anche col verde acceso: è spento, non rotto — il rosso qui diceva due cose opposte, «l'ho tolto io» e «è finito il rum». La scelta è del LOCALE (settings/bar) e vale per tutti i terminali: la griglia dev'essere la stessa dovunque, o due persone parlano di due schermate diverse. Le due schermate si impostano separatamente. Le regole stanno in una funzione pura: la stessa striscia deve significare la stessa cosa in tutte le schermate, e con la logica dentro le pagine finiva per divergere. L'IMPOSTAZIONE È SOLO DELLA STRISCIA. La linguetta nell'angolo in alto a sinistra tiene sempre il colore del PRODOTTO — è quella che si tocca per cambiarlo — qualunque cosa dica la striscia. I due segni condividevano lo stesso valore, e scegliendo «categoria» il colore messo a mano spariva dalla vista pur essendo ancora lì. Ogni scelta sta DOVE SI LAVORA quella schermata: la griglia del conto in Impostazioni → Vista ordine, le schede del catalogo in Menù e catalogo — modo della striscia e colore del «ce n'è abbastanza», separati per le due. Non è la stessa domanda: nel conto si batte di corsa e una griglia tutta verde è rumore (lì interessano i guai), nel catalogo si guarda con calma cosa si può fare e il verde è un'informazione. Il MENÙ ha tre sottosezioni nel menu laterale — modifica menù, categorie, marginalità del listino — invece dei due pannelli a scomparsa in cima al catalogo, che si aprivano spingendo giù la griglia: chi voleva solo guardare i margini si portava dietro tutto il listino sotto. Le scorte si leggono SOLO se servono: con gli altri modi ricette e giacenze non si caricano nemmeno.

NIENTE LAMPO ALL'APERTURA. Le impostazioni arrivano dal server e per un istante non ci sono: aprendo un conto le strisce comparivano colorate e sparivano un attimo dopo, in un locale che le aveva spente. L'ultima risposta del server resta in memoria locale (`impostazioniLocali.js`) e la schermata parte da lì — l'ultima verità nota, non i valori di fabbrica.

**Dove**: `src/lib/strisce.js, src/components/SettingsTab.jsx` · **Lo dimostrano**: `tests/unit/strisce.test.js`, `tests/component/PosProductPicker.test.jsx`, `tests/unit/impostazioniLocali.test.js`

#### REQ-POS-013 — In «Organizza» la card segue il dito

Trascinando una card dalla maniglia, quella in mano segue il dito e le altre si spostano per farle posto; lasciandola, resta dove l'hai messa. Lo fa una libreria (dnd-kit), non codice nostro: la versione scritta a mano — cattura del puntatore, ciclo di auto-scroll, animazioni a mano — aveva un difetto dopo l'altro (lo scorrimento che non si fermava, le card che si spostavano solo mentre la griglia scorreva, il rilascio fuori area). Trascinare col dito è un problema risolto, con dieci casi limite che non si vedono finché non capitano al banco; in più arriva gratis il riordino da TASTIERA, che non avevamo. Quello che resta nostro è la regola: l'ordine è UNO SOLO e globale, anche quando a schermo c'è una sola categoria — se no spostare una birra dentro «Birre» la lascerebbe al suo posto in «Tutti». La maniglia sta SOPRA la card, sul suo bordo destro, e non a fianco: affiancata allargava ogni cella di 38px, e la griglia entrando in «organizza» cambiava numero di card per riga e misura — si sistemava una disposizione diversa da quella che poi si usa davvero. La cella occupa esattamente quello che occupa fuori da qui. Il contesto di trascinamento sta SEMPRE attorno alla griglia, anche fuori da «organizza» (senza gesti attivi e senza niente di trascinabile dentro, non fa nulla). Montarlo solo lì spostava la griglia in un altro posto dell'albero, e React a quel punto buttava il riquadro e ne faceva uno nuovo: il misuratore della larghezza — quello che decide quanto sono grandi le card e i loro testi — restava attaccato al vecchio, staccato dalla pagina e quindi largo zero, e le card tornavano alla misura di partenza coi testi rimpiccioliti. Sistemato quello restava comunque un lampo, il tempo di rifare il riquadro e rimisurarlo. Il misuratore, per sicurezza, si riaggancia comunque al riquadro che c'è (ref-funzione) e prende subito la misura. Dentro «organizza» la card riempie la sua casella come fuori: la griglia rende tutte le caselle di una riga alte uguali, ma in mezzo c'è il guscio che porta il trascinamento — si allungava lui e la card restava alta quanto il suo testo, con una riga di card di altezze diverse. La card in mano NON ESCE DALLA GRIGLIA. Trascinandola verso destra finiva oltre il bordo: lì fuori non c'è niente da riordinare, ma il riquadro — che scorre — si allargava per contenerla e partiva uno scorrimento orizzontale senza fine, da riportare indietro a mano. Il movimento si ferma ai bordi del riquadro (un modifier di dnd-kit) e la griglia non scorre di lato: va a capo. La card in mano è OPACA: il fondo delle card è un velo (--tile-bg, bianco al 5%), che appoggiate sulla pagina va bene ma alzandone una sopra le altre le faceva vedere attraverso — e non si capiva più quale si sta spostando. Sotto ci va il fondo della pagina, così in mano ha l'aspetto identico a quando è posata. Il minimo delle colonne — «almeno tre card per riga finché ci stanno» — lo calcola il CSS con min()/max(), non il JavaScript sulla larghezza misurata: la misura arriva sempre qualche fotogramma dopo, e trascinando la maniglia di fianco alla griglia per un attimo ci stavano due colonne invece di tre, fino a quando non arrivava. Nel CSS il conto si rifà insieme al ridimensionamento. Sempre per non far ballare la griglia, lo spazio della barra di scorrimento è riservato (`scrollbar-gutter: stable`): compariva e spariva a seconda di quanti prodotti ha la categoria, e al confine fra tre e quattro card per riga la griglia si riassestava da sola mentre la si guardava.

**Dove**: `src/components/PosProductPicker.jsx, src/index.css` · **Lo dimostrano**: `tests/component/PosProductPicker.test.jsx`

#### REQ-POS-008 — Le maniglie, col dito, si prendono solo tenendo premuto

Col mouse si prende e si trascina; col dito la maniglia si arma dopo 400ms, con vibrazione e segnale visivo. Se prima dello scatto il dito si sposta di oltre 10px stava scorrendo, e non succede niente: sfiorare una maniglia mentre si scorre non deve cambiare la misura di nulla.

**Dove**: `src/lib/useResizable.js` · **Lo dimostrano**: `tests/unit/useResizable.test.js`

#### REQ-POS-009 — Nelle schermate di lavoro non parte il tira-per-aggiornare

Arrivati in cima a una lista, continuando a trascinare in giù il browser ricaricava la pagina, in mezzo alla composizione di un ordine. Nelle schermate a tutto schermo lo scorrimento si ferma dov'è e non si propaga al documento.

**Dove**: `src/index.css, src/components/PosProductPicker.jsx` · ⚠️ **Nessun test lo verifica.**

#### REQ-POS-010 — Unisci e Separa: un tasto solo

Oggi sono due tasti distinti e solo uno dei due è utile alla volta. Vanno unificati in un comando unico che fa la cosa sensata a seconda delle righe: accorpa se ci sono righe uguali, separa se c'è una riga con quantità multipla.

FATTO (1.5.0). Sopra la lista del conto c'è UN tasto solo, che cambia faccia secondo quello che si può fare: «🔗 Unisci» se ci sono righe uguali da accorpare, «⑃ Separa» se c'è una riga con più pezzi. Quando servirebbero tutte e due vince «Unisci» — la rimessa in gruppo è quella che si cerca su un conto lungo — e l'altra resta a portata nel «⋯», che è sempre una voce sola e cambia etichetta con lo stesso criterio. Il tasto c'è SEMPRE, anche quando non c'è niente da unire né da separare: spento, non sparito. Un tasto che va e viene sposta gli altri sotto il dito di chi sta battendo un ordine.

**Dove**: `src/components/OrderPosDetail.jsx` · **Lo dimostrano**: `tests/component/OrderPosDetail.test.jsx`, `tests/unit/orderLines.test.js`

#### REQ-POS-011 — La griglia del POS si organizza come si lavora

Nel POS i prodotti si trovano per categoria, per preferiti (fissati a mano) e per recenti (gli ultimi battuti davvero). L'ordine delle card si può cambiare trascinandole, e resta com'è stato messo.

**Dove**: `src/lib/posCatalog.js, src/components/PosProductPicker.jsx` · **Lo dimostrano**: `tests/unit/posCatalog.test.js`

#### REQ-POS-012 — La ricerca prodotti: filtra, oppure accende la card e ci porta lì

Cercando un prodotto nella griglia del POS (creazione e modifica ordine) si sceglie fra due comportamenti, in Impostazioni → Vista ordine. «Filtra la griglia» lascia le sole card che rispondono, come è sempre stato. «Accendi e porta lì» non toglie niente: la griglia scorre fino alla prima card che risponde e la accende con un anello nel colore d'accento, così si vede dov'è rispetto alle altre — serve a chi la griglia la conosce a memoria e non vuole vederla cambiare sotto le dita. Mentre si cerca mostra tutto il catalogo, perché il prodotto giusto può stare in un'altra categoria; toccando una card la ricerca si azzera da sé. La regola di corrispondenza è una sola per tutti e due i modi, altrimenti cambiando impostazione lo stesso testo troverebbe prodotti diversi. Se non risponde niente lo dice, invece di lasciare la griglia apparentemente immobile.

**Dove**: `src/lib/posCatalog.js, src/components/PosProductPicker.jsx, src/components/SettingsTab.jsx` · **Lo dimostrano**: `tests/component/PosProductPicker.test.jsx`

#### REQ-POS-014 — La riga del conto dice quanto fa; il calcolo è a richiesta

Ogni riga del conto mostra nome e SUBTOTALE (quantità × prezzo, già fatto), anche con un pezzo solo. Il calcolo per esteso — «2 × 5,00 €» — non sta più accanto al nome, dov'era rumore su ogni riga: si accende dal menù ⋯ del conto («Mostra i calcoli delle righe»), compare sotto l'item come le note, e se una riga ha nota e calcolo stanno su due righe distinte. La scelta si ricorda sul dispositivo. Il ⋯ per questo è visibile a tutte le taglie, non solo su telefono. E la dimensione del testo delle righe ha un MINIMO configurabile (Impostazioni → Vista ordine): il testo segue la larghezza del pannello ma sotto la soglia scelta non scende — il pavimento fisso di prima per qualcuno era un manifesto.

**Dove**: `src/components/OrderPosDetail.jsx, src/components/SettingsTab.jsx` · **Lo dimostrano**: `tests/component/OrderPosDetail.test.jsx`

#### REQ-POS-015 — Unisci e Separa sono un tasto solo

Dei due, alla volta ne serve uno: il tasto mostra l'azione possibile e cambia faccia da sé — se c'è da unire, unisce; altrimenti separa. Quando servirebbero entrambe vince Unisci, e Separa resta raggiungibile dal menù ⋯ (dove le due voci esplicite restano comunque). Spento, non sparito, quando non c'è niente da fare: i tasti non ballano.

**Dove**: `src/components/OrderPosDetail.jsx` · **Lo dimostrano**: `tests/component/OrderPosDetail.test.jsx`

#### REQ-POS-016 — I supplementi del conto in chiaro: subtotale, voci, totale

Nel riepilogo del conto prima c'era una riga cumulativa («Coperto/servizio/mancia · 5,50 €») e non si capiva né cosa fosse attivo né quanto pesasse ognuno. Ora:

SUBTOTALE in evidenza (il conto nudo, in grassetto, appena più grande delle voci), sotto le voci attive una per riga in piccolo — Coperto, Servizio, Mancia, solo quelle maggiori di zero — e in fondo il TOTALE grande che somma tutto. Le righe sono strette: il blocco non deve crescere in altezza. Sul telefono il dettaglio parte chiuso e si apre toccando il Subtotale.

**Dove**: `src/components/OrderPosDetail.jsx` · **Lo dimostrano**: `tests/component/OrderPosDetail.test.jsx`

### Pagamenti

Come si incassa: contanti, carta, SumUp, pagamenti parziali e separati.

#### REQ-PAG-010 — Si vede che cosa è stato pagato, e cosa copre

In fondo al conto c'era una riga sola: «Sconto e acconti già incassati −15,00 €». Quindici euro di che? Uno sconto, un acconto, con che metodo, per quali righe? Al banco, davanti al cliente che chiede, quella riga non risponde a niente. Ora sono righe distinte: lo sconto per conto suo, e ogni incasso col suo metodo e la sua ora. E si dice cosa copre. Un importo battuto a mano — «30 €» — NON copre nessuna riga: sono soldi lasciati sul conto, e si chiama ACCONTO. Chi paga scegliendo le righe copre esattamente quelle, e sotto l'incasso si leggono («2× Daiquiri · 1× Birra»). Non c'è una riga di istruzioni sopra le righe: a dire da dove viene il numero ci pensa l'etichetta sopra l'importo — «RIGHE SCELTE» o «IMPORTO A MANO» — che si legge nel momento in cui serve. Attribuire delle righe a un importo battuto a mano vorrebbe dire inventarselo: se servono attribuite, si scelgono nella schermata di pagamento — che è esattamente a cosa serve la selezione a sinistra.

**Dove**: `src/lib/pagamento.js, src/components/OrderPosDetail.jsx, src/components/PaymentScreen.jsx` · **Lo dimostrano**: `tests/unit/pagamento.test.js`

#### REQ-PAG-001 — Incasso in contanti, carta o acconto, anche senza rete

Il conto si chiude subito a schermo e la scrittura va in coda: contanti, carta e acconti non aspettano il server. Un conto già pagato viene rifiutato subito, non dopo un timeout di rete. Il metodo scelto resta scritto sull'incasso: serve alla chiusura di cassa e allo scontrino.

**Dove**: `src/components/PaymentScreen.jsx, src/lib/api.js` · **Lo dimostrano**: `tests/unit/incassoOffline.test.js`, `tests/component/PaymentScreen.test.jsx`, `tests/unit/pagamento.test.js`, `tests/unit/payments.test.js`, `tests/unit/payment-core.test.js`

#### REQ-PAG-002 — Il tasto Pagamento dice quanto resta da incassare

Sul tasto è scritta la cifra da incassare al netto di sconti e acconti già presi, e resta scritta anche dopo che l'ordine è stato creato. A conto saldato la cifra sparisce, perché non c'è più niente da incassare.

**Dove**: `src/components/OrderPosDetail.jsx` · **Lo dimostrano**: `tests/component/OrderPosDetail.test.jsx`

#### REQ-PAG-003 — Sconto sul conto, con tre strategie a scelta

Lo sconto si applica dal tastierino e si può impostare come tetto al totale, come proporzione sulle righe o come semplice avviso; la strategia si sceglie nelle impostazioni (default: tetto al totale). Le statistiche e il rendiconto devono sempre scorporare lo sconto, mai mostrare il prezzo di listino come venduto. Il tastierino dello sconto ha le cifre nell'ordine di sempre (7 8 9 / 4 5 6 / 1 2 3 / C 0 ←), su tre colonne: si batte a memoria.

**Dove**: `src/lib/pricing.js, src/components/SettingsTab.jsx` · **Lo dimostrano**: `tests/unit/pricing.test.js`, `tests/component/PaymentScreen.test.jsx`

#### REQ-PAG-004 — Lettore SumUp: pairing e incasso con carta

Il lettore si associa con un codice di pairing (riservato a chi sta al banco); da lì si incassa con carta direttamente dall'app. Il webhook verifica l'esito tramite la Transactions API prima di segnare il conto pagato. Nella schermata di pagamento SumUp resta sempre in lista: se il lettore non è configurato — o manca la rete — il tasto è spento a vedersi ma si può toccare, e al tocco dice il perché e dove si rimedia. Il motivo non sta scritto sotto al tasto: occupava una riga in una schermata che ne ha poche, e chi incassa non lo leggeva comunque.

**Dove**: `functions/lib/payment-service.js, src/lib/paymentsApi.js` · **Lo dimostrano**: `tests/bdd/payment-reader.test.js`, `tests/component/PaymentScreen.test.jsx`

#### REQ-PAG-005 — Pagamento online con link o QR

Si può creare un checkout online per un conto e verificarne lo stato; il webhook salda il conto quando il pagamento arriva. Vale anche per i conti di gruppo, dove il pagamento chiude tutti gli ordini del gruppo.

**Dove**: `functions/lib/payment-service.js` · **Lo dimostrano**: `tests/bdd/payment-checkout.test.js`, `tests/bdd/payment-group.test.js`

#### REQ-PAG-006 — Buoni VIP: credito prepagato intestato a una persona

Un buono ha un saldo che si consuma sui conti; si vede quanto credito è in circolazione e i buoni scaduti non sono spendibili. Annullando un conto che ha usato un buono, il credito torna al beneficiario.

**Dove**: `src/lib/vouchers.js, src/components/VipTab.jsx` · **Lo dimostrano**: `tests/unit/vouchers.test.js`

#### REQ-PAG-007 — Codice lotteria e fattura di cortesia

Al pagamento si può registrare il codice lotteria del cliente ed emettere una fattura di cortesia numerata, con il suo registro nel gestionale.

**Dove**: `src/components/PaymentScreen.jsx, src/components/InvoicesTab.jsx` · **Lo dimostrano**: `tests/component/PaymentScreen.test.jsx`, `tests/component/InvoicesTab.test.jsx`

#### REQ-PAG-008 — Preconto prima di incassare

Si può stampare o mostrare il conto al cliente prima dell'incasso, senza chiudere niente: il conto resta aperto e modificabile.

**Dove**: `src/components/PaymentScreen.jsx` · **Lo dimostrano**: `tests/component/PaymentScreen.test.jsx`

#### REQ-PAG-009 — Nel pagamento gli item sono separati di partenza

La schermata di incasso mostra gli item UNO PER RIGA fin da subito, senza dover premere «Separa uguali»: al banco si paga quasi sempre a pezzi — uno paga il suo, un altro offre due birre — e partire dal gruppo «3× Birra» vuol dire un tocco in piu' ogni volta, proprio mentre c'e' gente alla cassa. Restano possibili sia il raggruppamento («Unisci uguali», per un conto lungo che diventa illeggibile) sia l'incasso completo con un colpo solo. Ogni unita' e' una cosa a se': accenderne o spegnerne una non tocca le altre (vedi BUG-006, che nasce dallo stesso punto).

FATTO (1.5.x). La schermata di incasso nasce con le righe uguali già separate: «2× Mojito» sono due righe da «1/1». Il tasto che c'era resta ed e' lo stesso — cambia solo faccia: adesso all'apertura offre «🔗 Unisci uguali», e unendo ripropone «≣ Separa uguali». Dove non c'e' niente da unire ne' da separare (righe tutte da uno) non compare affatto, come prima. La selezione parte PIENA come sempre: chi incassa tutto preme «Riscuotere» senza toccare niente, e l'incasso pieno continua a partire senza dettaglio articoli.

**Dove**: `src/components/PaymentScreen.jsx, src/lib/pagamento.js` · **Lo dimostrano**: `tests/component/PaymentScreen.test.jsx`

### La coda del banco

Quello che il banco vede mentre lavora: cosa c’è da fare adesso, e in che ordine.

#### REQ-CODA-001 — La coda a «Corsie di stato»: una colonna per passo, un tasto per card

Quarta vista della coda ordini, si sceglie in Impostazioni → Coda ordini accanto a griglia, schede e lista. Gli ordini aperti stanno in quattro colonne — «Da fare» (ricevuto), «Al banco» (in preparazione), «Al ritiro» (pronto), «Da incassare» (consegnato e non saldato) — con in testa il conteggio, il totale della colonna e un filo del colore dello stato; ogni colonna scorre per conto suo, così le altre tre restano sott'occhio. Sulla card c'è UN tasto solo, quello che manda l'ordine al passo dopo: «Lo preparo io», «È pronto», «Consegnato», «Incassa». Sono le stesse azioni della griglia — l'avanzamento è updateOrderStatus, e «Incassa» apre il pagamento del conto, quello vero con sconto, conto diviso, contanti, carta e lettore: una vista è un modo di guardare, non un secondo modo di lavorare. Toccando la card (non il tasto) si apre il conto. Ricerca e filtro «Miei» valgono qui come nelle altre viste e filtrano dentro tutte le corsie insieme; le colonne restano tutte e quattro anche svuotate, perché la loro posizione si impara a memoria. Due casi che al banco costano un drink: il conto PAGATO ma non ancora consegnato resta in «Al ritiro» con il bollo «Pagato» invece del tempo (sparire vorrebbe dire dimenticarsi di servirlo), e «Da incassare» mostra la cifra al posto delle righe, perché lì la domanda è una sola. Con gli stati di servizio SPENTI i quattro passi non esistono e le corsie diventano le tre della griglia — in corso, chiusi, annullati — con le stesse etichette e le stesse regole (schedeCoda, passaFiltroCoda), e sui conti in corso resta l'incasso; quello che è già chiuso non ha tasti. Quello che esce dalla coda a fine cassa esce anche dalle corsie: la lista è la stessa (ordiniInCoda). Un conto appena battuto al POS compare in cima alla prima corsia già mentre parte verso il server: chi non lo vede lo ribatte.

**Dove**: `src/lib/coda.js, src/lib/comande.js, src/lib/ruoli.js, src/lib/impostazioniLocali.js, src/components/CorsieStato.jsx, src/components/CorsieComande.jsx, src/components/RigheCorsia.jsx, src/components/OrderPosDetail.jsx, src/pages/BartenderPage.jsx, src/components/SettingsTab.jsx` · **Lo dimostrano**: `tests/unit/coda.test.js`, `tests/unit/comande.test.js`, `tests/unit/ruoli.test.js`, `tests/component/CodaCorsie.test.jsx`, `tests/component/OrderPosDetail.test.jsx`, `tests/component/SettingsTab.test.jsx`

#### REQ-CODA-002 — Il dettaglio di una comanda: cosa devo fare adesso, e per chi

Schermata di una singola COMANDA, all'indirizzo /ordine/:id/comanda/:comandaId. Ci si arriva toccando la card nella vista del banco (REQ-CODA-001). È fatta come il dettaglio del conto ma risponde a un'altra domanda: quella del conto è della cassa — quanto fa, chi paga, cosa aggiungo — questa è del banco: cosa devo fare adesso, per chi, da quanto sta lì. Per questo sono due schermate e non una: riusare quella del conto avrebbe voluto dire portarsi dietro la griglia dei prodotti, lo sconto e il pagamento su un ticket, che sono tutte cose del conto. Quello che è di tutte e due sta già in comune: il flusso in lib/comande.js, i nomi degli stati in lib/orderStatus.js, la destinazione in lib/coda.js.

**Dove**: `src/pages/ComandaPage.jsx, src/components/ComandaDetail.jsx, src/lib/comande.js, src/components/CorsieComande.jsx, src/App.jsx` · **Lo dimostrano**: `tests/unit/comande.test.js`, `tests/component/ComandaDetail.test.jsx`

#### REQ-CODA-003 — La nota di una riga si legge in ogni coda a schermo

«Senza ghiaccio», «per Anna»: la nota della SINGOLA RIGA dice come si prepara quel drink e a chi va consegnato, ed è una cosa diversa dalla nota del CONTO — che vale per tutte le righe e resta in fondo alla card. Dovunque si veda l'elenco dei prodotti a schermo — la coda del gestionale, la coda di sala, le viste a corsie, il dettaglio della comanda — la nota compare sotto la sua riga, non a fianco: accanto al nome veniva tagliata dal prezzo allineato a destra, e «senza ghi…» non dice niente a chi prepara. La griglia compatta è l'eccezione voluta: non elenca i prodotti, mostra solo quanti sono. Nasce da BUG-005: la nota si vedeva solo dentro il conto e sulla comanda stampata, e chi lavora guardando lo schermo invece della stampante non la leggeva mai.

**Dove**: `src/pages/BartenderPage.jsx, src/components/ServiceQueue.jsx, src/components/RigheCorsia.jsx, src/components/ComandaDetail.jsx, src/index.css` · **Lo dimostrano**: `tests/component/NoteRigheCoda.test.jsx`, `tests/component/ComandaDetail.test.jsx`

#### REQ-CODA-004 — Sul telefono le corsie si impilano, non si stringono

Chiesto dall'utente il 19/08. La vista a corsie del banco su uno schermo di telefono mette cinque o sei colonne una accanto all'altra: non ci stanno, e ognuna diventa una striscia dove non entra nemmeno il nome di un drink. Su telefono le corsie vanno IMPILATE una sotto l'altra — la colonna diventa una sezione, col suo titolo e il suo totale — e si scorre in verticale, che è come si tiene il telefono. La soglia si decide sulla larghezza vera del contenitore (container query), non sul numero di corsie accese: è la stessa lezione delle card, dove contare gli elementi al posto dello spazio disponibile aveva spaccato il disegno.

FATTO in CSS, senza toccare i componenti: la testata di ogni corsia era già titolo + totale, e impilarle basta a farne sezioni. La lavagna (`.queue-board.corsie-board`) è il contenitore — `container: corsie / inline-size` — e le soglie stanno in `@container`: una colonna sola fino a 560px, due fino a 900px, tutte oltre. La finestra mente in due modi che al banco capitano ogni sera: col menu agganciato alla pagina la lavagna ha 200-250px in meno, e lo stesso col browser allo zoom. Della vecchia `@media (min-width: 901px)` resta solo l'altezza della lavagna, che è un'altra domanda (un elemento non può interrogare sé stesso con una @container).

**Dove**: `src/index.css, src/components/CorsieComande.jsx, src/components/CorsieStato.jsx` · **Lo dimostrano**: `tests/unit/css.test.js`

#### REQ-CODA-005 — Nella legenda della coda c'e' anche chi e' collegato adesso

Chiesto dall'utente il 19/08: «quando un utente si logga ed e' nel sistema deve uscire nella legenda nella coda ordini, dove vengono indicate le iniziali di chi apre un ordine». COM'ERA: la legenda si costruiva SOLO dai conti gia' battuti oggi (`placedByLetter` su ordersOggi). Chi si collegava e non aveva ancora aperto niente non compariva da nessuna parte — nemmeno per se' stesso, e quindi non sapeva con che lettera si sarebbe riconosciuto sulle card.

CHI VEDE COSA, deciso dall'utente il 19/08 e questa e' la parte da non sbagliare: «tutti quelli collegati, ma solo admin e bartender possono vedere chi e' collegato; staff puo' solo vedere chi ha aggiunto ordine con legenda, non vede chi e' online. I clienti non vedono niente». Quindi: chi e' collegato lo leggono solo ADMIN e BARTENDER (`isGestore`); la SALA vede la legenda di sempre, quella che nasce dai conti battuti; il CLIENTE non vede niente. E' riservatezza, non dettaglio: sapere chi e' collegato e' un'informazione sulle PERSONE, non sul lavoro, e non deve servire a controllare i colleghi.

MA IL COLPO DI VITA LO DA' CHIUNQUE sia del personale, sala compresa: un cameriere non sa chi c'e', ma gli altri sanno che c'e' lui.

COME SI SA CHI C'E'. Non esiste un logout affidabile — si chiude l'app, si blocca il tablet, finisce la batteria — quindi la presenza non si spegne: SCADE. Ogni terminale scrive «ci sono» ogni tre minuti mentre la pagina e' davanti, e chi tace da piu' di dieci minuti esce dall'elenco. Due colpi persi si sopportano (rete che va e viene, il tablet che dorme un momento) senza far sparire chi sta lavorando. Non serve nessuna pulizia: il tempo fa da solo.

SOLO MENTRE LA PAGINA E' DAVANTI: un tablet in tasca con l'app aperta direbbe «ci sono» tutta la notte. Al ritorno in primo piano parte subito un colpo, che e' quello che rimette la lettera in legenda.

DETTAGLI CHE FANNO LA DIFFERENZA: - UNA RIGA PER PERSONA, non per dispositivo: la legenda mostra PERSONE, e lo stesso Marco su tablet e telefono e' un Marco solo. E' il contrario di `staff_tokens`, che e' per dispositivo perche' li' si deve far squillare ogni apparecchio; - IL NOME si ricava con `placedByName`, la STESSA funzione che da' il nome sulle card: se i due divergessero, uno comparirebbe in legenda con una lettera e sui suoi conti con un'altra; - CHI HA GIA' BATTUTO NON SI DUPLICA: la sua voce nasce dai conti — il dato piu' vecchio e piu' sicuro — e resta com'e'; - «SEI TU» accanto alla propria voce: e' meta' del motivo per cui la cosa e' stata chiesta; - un CLIENTE collegato non e' mai una voce della legenda: quella dice chi lavora, e la riga «Cliente» nasce dagli ordini, non da chi ha l'app aperta; - L'ORARIO E' QUELLO DEL CLIENT (`last_seen` ISO, non `serverTimestamp`): la finestra si misura con lo stesso orologio che poi la legge, se no due terminali con l'ora storta si vedrebbero sempre online o mai; - LA SCRITTURA NON SI ASPETTA MAI: e' un colpo di vita, non un gesto. Se fallisce non deve rompere niente e non deve dire niente a nessuno.

IL LUCCHETTO STA ANCHE LATO SERVER (`firestore.rules`): legge solo `isBartender()` (che li' vuol dire admin+bartender), scrive solo se stesso chi e' del personale. Un permesso che esiste solo nell'interfaccia non e' un permesso.

**Dove**: `src/lib/presenza.js, src/lib/api.js, src/pages/BartenderPage.jsx, firestore.rules` · **Lo dimostrano**: `tests/unit/presenza.test.js`, `tests/component/CodaCorsie.test.jsx`

### Gruppi di conti

Più conti che vanno insieme — un tavolo, una comitiva — senza fonderli in uno.

#### REQ-GRP-001 — Più conti sotto un gruppo, anche annidati

I conti si possono raccogliere in gruppi (un tavolo, una comitiva), e i gruppi possono contenere sottogruppi. Un gruppo contenitore non riceve ordini diretti: si ordina in uno dei suoi sottogruppi.

**Dove**: `src/lib/groups.js` · **Lo dimostrano**: `tests/unit/groups.test.js`

#### REQ-GRP-002 — Il totale del gruppo somma tutto l'albero

Il totale di un gruppo somma i suoi ordini diretti e quelli dei sottogruppi, esclusi gli annullati. Un gruppo è saldato solo se ha ordini e nessuno resta da pagare: un gruppo vuoto non è "chiuso".

**Dove**: `src/lib/groups.js groupTotal` · **Lo dimostrano**: `tests/unit/groups.test.js`

#### REQ-GRP-003 — Pagare un gruppo, anche alla romana

Un gruppo si salda in un colpo solo, in contanti o con carta, oppure si divide in quote: la somma delle quote è esatta al centesimo e il resto va sull'ultima.

**Dove**: `src/lib/groups.js splitAmounts, functions/lib/payment-service.js` · **Lo dimostrano**: `tests/unit/groups.test.js`, `tests/bdd/payment-group.test.js`

#### REQ-GRP-004 — Un conto si sposta in un gruppo anche dopo

Un conto già aperto può essere associato a un gruppo, spostato o tolto: capita che il tavolo si formi dopo il primo giro.

**Dove**: `src/lib/api.js setOrderGroup` · ⚠️ **Nessun test lo verifica.**

### Menù e catalogo

Il listino: drink, categorie, disponibilità, prezzi.

#### REQ-MENU-010 — Come si fa questo drink: la ⓘ sulla card

Ogni card della griglia ha una ⓘ che apre la scheda del prodotto: ingredienti CON LE QUANTITÀ e come si prepara. «Quanto gin ci va nel Negroni?» al banco si chiede a voce, e a voce si perde: chi entra a dare una mano il sabato non ha le dosi in testa, e l'unico che le sa sta facendo drink. La ricetta strutturata c'era già — serve al magazzino per scalare le scorte — ma non la vedeva nessuno; e non basta: dice COSA ci va, non il gesto. Nella scheda del prodotto (Menù) c'è quindi anche «Come si prepara», scrittura libera: shakerato o mescolato, il ghiaccio, l'ordine, il bicchiere. Gli a capo restano dove li ha messi chi l'ha scritta, perché una preparazione è una sequenza di gesti. La ⓘ sta in basso a destra, lontana dai +/− e dalla stella: si guarda mentre si versa e non si preme per sbaglio. In «organizza» non c'è: lì le card si spostano, non si leggono.

SI PUÒ SPEGNERE (Impostazioni → Vista ordine): dove il listino lo sanno tutti a memoria è un segno in più su ogni card, e le card sono cento; dove invece cambia spesso, o si dà una mano il sabato, è la differenza fra saper fare un drink e doverlo chiedere. Accesa di suo.

**Dove**: `src/components/SchedaDrink.jsx, src/components/PosBits.jsx, src/components/DrinkForm.jsx` · **Lo dimostrano**: `tests/component/SchedaDrink.test.jsx`, `tests/component/OrderPosDetail.test.jsx`

#### REQ-MENU-001 — Il menù dice se un drink si può fare

Ogni voce del menù mostra la disponibilità con gli stessi colori dell'inventario: verde si può fare, arancione un ingrediente sta finendo, rosso spento a mano o ingrediente esaurito.

**Dove**: `src/components/MenuManager.jsx, src/lib/inventory.js` · ⚠️ **Nessun test lo verifica.**

#### REQ-MENU-011 — Un drink si duplica: la ricetta non si riscrive a mano

Nelle azioni della card del menù c'è «📋 Duplica». Mezzo listino sono variazioni — lo stesso drink col gin diverso, la versione analcolica, il formato grande — e rifarle a mano vuol dire riscrivere prezzo, categoria, descrizione e soprattutto la RICETTA ingrediente per ingrediente: è lì che si sbaglia una dose, e poi il magazzino scala storto. La copia NON si salva da sola: si apre la scheda già piena, col nome marcato «(copia)», così quello che cambia si sistema PRIMA che il drink esista — un doppione salvato di nascosto finirebbe in carta al cliente. Salvando nasce un prodotto nuovo: l'originale non si tocca. La foto resta all'originale: il file è agganciato al drink che l'ha caricata, e cancellando quello sparirebbe anche dalla copia.

**Dove**: `src/components/MenuManager.jsx` · **Lo dimostrano**: `tests/component/MenuManager.test.jsx`

#### REQ-MENU-006 — Sulle card i segni dicono cose diverse, dove uno se le aspetta

Un oggetto si riconosce allo stesso modo in ogni schermata. La STRISCIA A SINISTRA dice come sta la cosa: sulle card della coda com'è messo il conto, sulle card del menù se il prodotto si può fare (verde), se un ingrediente sta finendo (arancione) o se non si può fare (rosso, e la riga sotto al nome dice se è spento a mano o se manca l'ingrediente).

IL SEGNO NELL'ANGOLO è il colore che il prodotto ha al banco, e nel menù si tocca per cambiarlo. Che forma abbia lo decide il TEMA (`--segno-prodotto`, lib/themes.js, scritto anche come `data-segno` sul documento): di casa è il nastro d'angolo, largo e squillante; per Catppuccin una pastiglia (quadratino stondato), che è il suo modo di fare gli angoli; per Pico, look documento, il pallino. Gli ultimi due stanno in alto a destra sulle card del menù, dove le card del magazzino tengono lo stato delle scorte, e in alto a SINISTRA sulle tile del conto: lì a destra c'è la stella dei preferiti, che è un tasto e non si copre. Con trenta prodotti a schermo trenta bandiere colorate, su una palette da foglio di calcolo, restavano la cosa più rumorosa della pagina. Le tile del POS portano gli stessi due segni del menù, e la striscia è 4px come in magazzino (era 5): la griglia è la stessa in tutte e tre le schermate. Prima il menù aveva un quadratino che sembrava un'etichetta e invece era un tasto, e un pallino il cui rosso diceva due cose opposte — «l'ho spento io» e «è finito il rum» — che chiedono azioni diverse.

**Dove**: `src/components/MenuManager.jsx, src/components/PosBits.jsx, src/index.css` · **Lo dimostrano**: `tests/unit/temi.test.js`

#### REQ-MENU-005 — Il menù è uno solo, quello che vede il cliente

A /menu si apre sempre la stessa schermata, per chi ordina e per chi lavora: le categorie con le voci del listino, così come le vede il cliente. C'era anche una seconda vista, riservata allo staff — catalogo a due colonne con la ricerca — nata per gli ordini battuti a mano: quelli si battono al POS, e chi apriva il menù dal gestionale si trovava una pagina diversa da quella che stava mostrando al tavolo. Ordinare da qui resta possibile quando le impostazioni lo consentono: a «solo menù» i tasti per aggiungere spariscono per il cliente, mentre chi è dello staff può comunque inserire un ordine ed è segnato come autore. Allo staff la pagina dà in più la barra di ricerca, sopra le categorie: filtra per nome o ingrediente, perché chi prende l'ordine col cliente davanti non scorre otto categorie. Il cliente sfoglia la vetrina senza barra.

**Dove**: `src/pages/MenuPage.jsx` · **Lo dimostrano**: `tests/component/MenuPage.test.jsx`

#### REQ-MENU-002 — Marginalità del listino

Per ogni drink si vede costo reale, prezzo e margine, con il prezzo consigliato calcolato dal ricarico impostato: serve a capire dove si sta perdendo.

**Dove**: `src/lib/pricing.js, src/components/MarginList.jsx` · **Lo dimostrano**: `tests/unit/pricing.test.js`

#### REQ-MENU-003 — Import del catalogo da un export SumUp

Si importa il listino da un CSV di SumUp: prodotti, categorie in ordine di apparizione, inventario dedotto (bottiglie e prodotti pronti, escluse fasce prezzo e preparazioni) e collegamento automatico delle ricette evidenti. Un file che non è un export SumUp viene rifiutato.

**Dove**: `src/lib/carteImport.js` · **Lo dimostrano**: `tests/unit/carteImport.test.js`, `tests/unit/importExcel.test.js`, `tests/unit/nameMatch.test.js`

#### REQ-MENU-004 — Colori e icone di categoria uguali dappertutto

Il colore di una categoria è stabile (dipende dall'id, non dal nome) e lo stesso nel POS, nel menù e nelle statistiche: una categoria si riconosce a colpo d'occhio ovunque la si incontri.

**Dove**: `src/lib/categoryColors.js` · **Lo dimostrano**: `tests/unit/categoryColors.test.js`

#### REQ-MENU-013 — L'IVA di vendita si cambia sulla singola voce di menù

DECISO (19/08, dall'utente che riporta Flavio). L'IVA ha DUE LATI e vanno tenuti distinti: quella con cui si COMPRA e quella con cui si VENDE. Su tutti e due il valore generale sta nelle Impostazioni, e su tutti e due si deve poter fare l'eccezione sulla singola riga.

IL LATO ACQUISTO È GIÀ FATTO, verificato nel codice il 19/08: `purchase_vat` nelle impostazioni vale 22% di default (DEFAULT_SETTINGS in src/lib/api.js), la scheda del prodotto ha il campo «IVA acquisto %» che parte da quel default e si cambia per prodotto (InventoryManager.jsx, `vat` sull'articolo), e i conti al lordo passano da `costWithVat` (src/lib/inventory.js). Su questo lato non c'è niente da fare: è già come lo si voleva.

IL LATO VENDITA È QUELLO CHE MANCA: `sale_vat` nelle impostazioni vale 10% (somministrazione bar) ed è generale per tutto il locale; la voce di menù NON ha un campo suo, quindi una cosa che si rivende con un'aliquota diversa oggi non si può dire.

DA FARE: un campo IVA sulla voce di menù, vuoto = si usa quella del locale — così le eccezioni si scrivono dove sono, una per una, e chi non ne ha non deve compilare niente.

NON RIAPRE UNA COSA CHIUSA, LA COMPLETA. Il 18/08 si è deciso che l'incasso si scorpora con l'IVA di VENDITA e non con quella del prodotto d'acquisto (REQ-MAG-015: «Flavio compra al 22 e rivende al 10»). Resta così: cambia solo che alcune vendite hanno un'aliquota loro invece di quella generale. `macroStats.js` oggi prende `saleVat` una volta sola per tutto il report e andrà preso per voce, con quella delle impostazioni come ripiego.

PERCHÉ SERVE, per quel che si vede dai dati (non è una sua parola): nel menù esiste una categoria BOTTIGLIE, e una bottiglia intera non è la stessa cosa di un drink servito al banco. Mettere tutto al 10% gonfia il netto, e il netto è il numero da cui scendono margine, prime cost e il conto di fine mese.

LA REGOLA È CONFERMATA E NON VA PIÙ CHIESTA (utente, 19/08): «di default lui rivende al 10% di IVA, che è quello di default globale, e può essere modificato dalla relativa voce di menù». Quindi il 10% resta il generale e le eccezioni le mette lui, voce per voce, quando servono: non c'è nessuna aliquota da farsi dire prima: il campo esiste ed è dove uno la scriverebbe.

NON DIPENDE DA NIENTE: il lato acquisto è già fatto e `sale_vat` c'è. Conviene però che arrivi PRIMA delle tabelle del Bilancio: finché tutto si scorpora al 10% il netto di quello che si rivende con un'altra aliquota è gonfiato, e da quel netto scendono margine, incidenze e prime cost.

FATTO (19/08). La scheda del prodotto ha il campo «IVA vendita %» accanto al prezzo, e vuoto vuol dire «quella del locale»: chi non ha eccezioni non compila niente. Sotto c'è scritto quale aliquota vale lasciandolo vuoto, col numero.

UNO ZERO È UN'ALIQUOTA VERA (esente) e non «campo non compilato»: solo `null` ripiega sul generale. Se i due casi finissero in un falsy, una voce esente si scorporerebbe al 10% e il netto sarebbe più basso del vero — un errore che non si vede.

NEL CALCOLO: `aliquotaDiVendita` (macroStats.js) sceglie per riga quella della VOCE se c'è, quella del locale se no; una riga libera, che la voce di catalogo non ce l'ha, usa il generale. Le didascalie del Bilancio e la nota nelle Impostazioni lo dicono.

**Dove**: `src/components/MenuManager.jsx, src/lib/api.js, src/lib/macroStats.js, src/components/SettingsTab.jsx` · **Lo dimostrano**: `tests/unit/macroStats.test.js`, `tests/unit/ricetteUnita.test.js`, `tests/component/MenuManager.test.jsx`

### Magazzino

Prodotti, ricette, scorte e consumi. Le quantità sono sempre in unità base.

#### REQ-MAG-001 — Le quantità si contano in unità base, si mostrano come si parla

In magazzino tutto è in unità base (ml, g, pz); la visualizzazione usa l'unità comoda (cl per i liquidi, L oltre il litro, g o kg per i solidi). Chi inserisce sceglie l'unità che preferisce e la conversione è automatica: "4 cl" non deve mai diventare 4 pezzi.

**Dove**: `src/lib/inventory.js` · **Lo dimostrano**: `tests/unit/inventory.test.js`, `tests/unit/ricetteUnita.test.js`

#### REQ-MAG-002 — Bottiglie: quante piene, quale aperta, quanto resta

Per gli articoli con confezione nota si mostra quante bottiglie sono piene, quanta ne resta in quella aperta e quante sono finite. Il contenuto non si misura mai in pezzi.

**Dove**: `src/lib/inventory.js bottleBreakdown, bottleSummary` · **Lo dimostrano**: `tests/unit/inventory.test.js`, `tests/component/InventoryManager.test.jsx`

#### REQ-MAG-003 — Le scorte si scalano quando il drink è pronto

Il magazzino si scala quando la comanda è PRONTA: lì il drink è fatto — il gin è già nel bicchiere — e a segnarlo è chi l'ha fatto, il banco. «Servito» è un'altra cosa, è il drink arrivato al tavolo, e fra i due passi in magazzino non si muove più niente.

PRIMA SI SCARICAVA AL SERVITO, e non andava per due ragioni. Di sostanza: si aspettava la consegna per registrare un consumo già avvenuto, e un drink pronto sul banco restava fra gli «impegnati» come se potesse ancora non farsi. Pratica, ed è quella che ha deciso: «servito» lo segna la SALA (REQ-STAFF-014), e la sala sul magazzino non scrive — le regole glielo negano, ed è giusto così. Lo scarico falliva in silenzio e la giacenza restava ferma (BUG-040). Spostandolo a «pronto» il difetto sparisce da sé, e non perché si sia allargato un permesso. Non si scala PRIMA, alla presa in carico: un drink iniziato e poi non fatto — riga tolta, cliente che cambia idea, comanda annullata — avrebbe già portato via gli ingredienti. Con gli stati del servizio spenti non esiste nessun «pronto»: le comande risultano servite alla riscossione, ed è lì che si scala, e quella strada non è cambiata. Incassare, di per sé, non scala niente: seguendo il servizio si paga anche in anticipo, con tre drink ancora da fare.

PRIMA DI «PRONTO» gli ingredienti sono IMPEGNATI e si leggono in magazzino (REQ-MAG-014). Il metro dell'impegnato non è lo stato ma `inventory_applied`, ed è per questo che spostare lo scarico non ha richiesto di toccare `impegnato.js`: nell'istante in cui una comanda viene scaricata esce dai promessi ed entra nella giacenza, senza contarsi due volte e senza sparire per un battito.

AVANTI E INDIETRO NON SCALA DUE VOLTE: si scala una volta sola, salvando lo snapshot del consumo sulla comanda (serve anche per stornare in caso di annullo). Una comanda riportata da «pronto» a «in preparazione» si porta dietro lo scarico già fatto e non lo disfa — resta fuori dall'impegnato, perché quegli ingredienti sono nella giacenza — e ripassando a «pronto» non si scala di nuovo.

TORNARE INDIETRO NON RISTORNA, ED È UNA SCELTA — decisa il 19/08 spostando lo scarico, e scritta qui perché è la domanda che si rifarà il prossimo che passa. Tre ragioni: 1) I DUE CASI NON SI DISTINGUONO. «Ho segnato pronto il ticket sbagliato» (il drink non è fatto) e «lo rimetto in lavorazione perché manca qualcosa» (il gin è già versato) sono la STESSA transizione: ristornare sarebbe giusto nel primo caso e sbagliato nel secondo, e l'app non può sapere quale dei due sia.

2) RISTORNARE VUOL DIRE RIAPPLICARE. Servirebbe lo storno all'indietro E il riscarico in avanti: due scritture di magazzino per ogni andata e ritorno, che devono nettare a zero anche quando una delle due non parte (offline, app chiusa a metà). È lo stesso tipo di macchina che `impegnato.js` evita apposta, per non lasciare in giro impegni fantasma che nessuno sa più togliere.

3) IL GESTO GIUSTO ESISTE GIÀ. Per un drink che davvero non è stato fatto si annulla la comanda, che reintegra dallo snapshot di consumo (REQ-MAG-005). Lo stato intanto resta COERENTE: quegli ingredienti stanno nella giacenza scalata e fuori dall'impegnato, contati una volta e una sola, e «quello che ti ritrovi a fine serata» non si muove. Se un domani si decidesse di ristornare davvero, la strada è riusare il riallineo per DIFFERENZA che c'è già (`riallineaInSottofondo` / `consumptionDiff`, REQ-MAG-004), non scrivere un percorso nuovo. Il magazzino che non risponde non blocca la comanda: resta segnata come non scaricata e si recupera alla riscossione (`unappliedEntries`), che resta la rete di sicurezza anche con gli stati accesi.

SOTTO ZERO NON SI SCENDE: si toglie al massimo quello che risulta in giacenza, e un carico su una giacenza negativa riparte da zero. La vendita passa comunque (il conto è già scritto) e il magazzino si ferma a zero: altrimenti il buco resta, il carico dopo conta meno di una bottiglia e il valore in euro va in negativo.

**Dove**: `src/lib/inventory.js computeConsumption, src/lib/comande.js, src/lib/api.js` · **Lo dimostrano**: `tests/unit/inventory.test.js`, `tests/unit/incassoOffline.test.js`, `tests/unit/comande.test.js`, `tests/unit/scritturaComande.test.js`, `tests/unit/impegnato.test.js`, `tests/unit/salaEMagazzino.test.js`

#### REQ-MAG-004 — Modificare un ordine già scalato riallinea le scorte alla differenza

Cambiando le righe di una comanda già scaricata si scala o si restituisce solo la differenza, non l'intero consumo: altrimenti ogni correzione falserebbe il magazzino.

**Dove**: `src/lib/warehouse.js consumptionDiff` · **Lo dimostrano**: `tests/unit/warehouse.test.js`

#### REQ-MAG-005 — Inventario fisico: conta, differenze, valorizzazione

Si registra una conta fisica e si vedono le differenze rispetto al teorico (DEP + ACQ − RIM = CONS, come sui fogli di inventario), con la valorizzazione a costo e IVA.

**Dove**: `src/lib/warehouse.js stockCountCompute, src/components/InventoryManager.jsx` · **Lo dimostrano**: `tests/unit/warehouse.test.js`

#### REQ-MAG-006 — Ordini ai fornitori e fatture d'acquisto

Dal sottoscorta si genera una proposta d'ordine per fornitore, in confezioni intere, esportabile come testo; le fatture d'acquisto si registrano con i totali e aggiornano i costi.

**Dove**: `src/lib/warehouse.js purchaseOrderTotals, suggestedPackages, invoiceTotals` · **Lo dimostrano**: `tests/unit/warehouse.test.js`

#### REQ-MAG-007 — Assortimento: quattro stati per capire cosa si tiene

Ogni articolo è assortimento, linea, premium o fuori servizio. Serve a distinguere quello che si tiene sempre da quello che si compra su richiesta, e a filtrare l'inventario di conseguenza.

**Dove**: `src/lib/inventory.js ASSORTIMENTI` · **Lo dimostrano**: `tests/unit/inventory.test.js`

#### REQ-MAG-010 — Il magazzino sta in una schermata, con le sezioni a lato

Prodotti, Conta, Ordini, Scadenzario, Categorie, Macro-categorie, Fornitori e Movimenti si scelgono dalla BARRA IN ALTO: il titolo della pagina è il comando. In pagina costavano spazio fisso tutto il giorno — due file di tasti più tre pannelli a scomparsa, poi una barra a sinistra (che rubava la colonna ai prodotti), poi una riga di schede — per una scelta che si fa ogni tanto. Sul telefono, dove nella barra non ci sta un elenco, si apre il foglio dal basso: lo stesso gesto di «⋯ Azioni», che al banco si conosce già. La ricerca sta sopra; sotto, una riga sola con due TENDINE (filtri di scorta e assortimento, fornitore), il valore di magazzino, card/lista come due icone e il tasto per un prodotto nuovo. Il tasto di una tendina dice cosa è scelto senza doverla aprire. I filtri (tutti, in scorta, in esaurimento, esauriti, e i quattro di assortimento) stanno su UNA RIGA sola, con scritto che sono filtri: sembravano un riepilogo, si leggevano i numeri senza capire che toccandoli la lista si restringeva. Il valore di magazzino è lì accanto ma non si tocca: è un numero da leggere, non un filtro. «IN SCORTA» È LA DOMANDA CHE MANCAVA (segnalato al banco il 18/08, coi 388 articoli veri sotto gli occhi: «al filtro manca quelli in magazzino»). Si poteva chiedere solo cosa sta finendo e cosa è finito; per vedere cosa c'è davvero sullo scaffale bisognava guardare «Tutti» e saltare a occhio due terzi di righe esaurite — 232 su 388. Sta per prima delle tre, che è l'ordine in cui ci si fa le domande, e ha il suo conteggio come le altre. GLI «IN ESAURIMENTO»

CI STANNO DENTRO: sono in magazzino, solo pochi. «In esaurimento» è una lente più stretta dentro la stessa famiglia, non un'altra famiglia — e chi guarda cosa c'è vuole vedere anche l'ultima bottiglia di gin, che è proprio quella che gli serve sapere. Così il conto torna a vista: in scorta più esauriti fa il totale, e chi somma le voci non trova numeri che non tornano.

QUELLO CHE NON È UNA SCORTA non sta né di qua né di là: il «Tempo di Lavorazione» non ha giacenza, e non è né disponibile né esaurito (vedi REQ-MAG-012). Metterlo fra i disponibili vorrebbe dire dire che c'è sullo scaffale una cosa che sullo scaffale non ci va; fra gli esauriti, mandare a comprare il tempo. Tutto sta nella finestra: filtri, ricerca e categorie restano fermi, a scorrere è solo l'elenco dei prodotti — prima, per tornare alla ricerca dopo aver guardato in fondo, si risaliva da capo. Anche i MOVIMENTI sono una sezione: stavano in fondo alla lista dei prodotti dietro un tasto largo quanto lo schermo, fuori contesto e in mezzo ai piedi.

**Dove**: `src/components/InventoryManager.jsx, src/components/CategoryRail.jsx` · **Lo dimostrano**: `tests/component/InventoryManager.test.jsx`

#### REQ-MAG-012 — Unità generiche: la manodopera entra nel costo del drink

Un articolo di magazzino si può misurare in unità generiche «U», senza contenuto e senza conversioni: serve per quello che non si versa e non si pesa — il «Tempo di Lavorazione», che si aggancia come ingrediente ai drink che richiedono lavorazione perché il lavoro entri nel costo della ricetta e quindi nel prezzo consigliato. Ha un costo per unità, e basta. Prima l'unica scelta possibile era il grammo, e nella ricetta del Daiquiri si leggeva «Tempo di Lavorazione 1 g». Un articolo in U NON È UNA SCORTA, e da qui vengono tre regole: non si scarica quando il drink si fa (resta fuori dal consumo, quindi non si reintegra nemmeno all'annullo); non è mai «esaurito» né «in esaurimento», così il drink che lo usa non sparisce dalla carta al primo che se ne fa e non finisce nelle proposte d'ordine al fornitore; non vale niente nel valore del magazzino, che il lavoro non sta sullo scaffale. Al cliente non si mostra: le righe in unità generiche restano fuori dalla lista ingredienti in carta — «Tempo di Lavorazione 3 U» non è roba da far leggere a chi ordina — e la lista compare da due ingredienti veri in su. Restano visibili dove servono a chi gestisce: ricetta, costi, margini e prezzo consigliato.

**Dove**: `src/lib/inventory.js, src/lib/pricing.js, src/components/InventoryManager.jsx, src/pages/MenuPage.jsx` · **Lo dimostrano**: `tests/unit/inventory.test.js`, `tests/unit/pricing.test.js`, `tests/component/InventoryManagerCard.test.jsx`, `tests/component/MenuPage.test.jsx`

#### REQ-MAG-016 — L'unità è sempre il pezzo: si sceglie solo a cosa corrisponde

Da tre note di Flavio (17/08, 21:11-21:14). Il modello delle unità regge i distillati e poco altro: in magazzino ci finiscono cose molto diverse — il ghiaccio a sacchi, i limoni al chilo, il tempo di lavoro — e ognuna oggi chiede una configurazione sua. Parole sue: «bisogna trovare una soluzione per unificare tutti questi elementi». Il caso che rompe il modello attuale: i LIMONI si comprano al chilo e si usano in cl (da 1 kg esce mezzo litro di succo). Oggi non si può dire, perché peso e volume sono famiglie separate — e giustamente, non esiste una conversione universale fra le due. Ma questa non è una conversione: è una RESA, dichiarata dal locale per quel prodotto.

PROPOSTA da approvare con lui: ogni prodotto risponde sempre alle stesse due domande — «come lo compri» (l'unità in cui conti la merce e in cui c'è il prezzo) e «come lo usi in ricetta» — più una terza che compare SOLO se sono diverse: «una unità di acquisto quanto rende?». Una riga sola, letta come si parla: 1 bottiglia = 70 cl, 1 kg di limoni = 50 cl, 1 sacco = 5000 g, 1 confezione = 10 U. Niente sotto-unità, niente divisioni, e le famiglie non c'entrano più: la resa la dichiara chi compra.

DECISO da Flavio (17/08): la giacenza si conta in QUELLO CHE SI COMPRA — i chili di limoni, i sacchi di ghiaccio, le bottiglie — perché l'inventario si fa contando quello che c'è sullo scaffale, non il succo che ne uscirà. Le ricette dosano nell'unità d'uso e scalano la loro frazione, come già fanno i cl di gin su una bottiglia. Il modello è quindi completo e si può scrivere: unità d'acquisto (giacenza e prezzo), unità d'uso (ricette), resa fra le due quando sono diverse. Con questo, BUG-014 si chiude da sé.

FATTO (1.4.8). `resaUso` (lib/inventory.js) risponde a «una unità base d'acquisto quante unità base d'uso rende?», e da lì passano tutti e tre i conti che contano: lo scarico dal magazzino (qtyInStockUnit), il costo di quello che si versa (costPerUnit) e le unità che si possono scrivere in ricetta (entryUnits). La resa vive su due campi nuovi (`resa`, `resa_unit`) validi per qualunque articolo; per i PEZZI resta buono quello che c'era — `content_unit` + `package_size` — quindi i prodotti già in magazzino non si toccano e si comportano come prima. La scheda prodotto è rifatta sulle tre domande, col «?» in alto che le spiega. La terza — «Quanto rende», o «A quanto corrisponde un pezzo?» per chi si conta a pezzi — è sempre a vista ed è FACOLTATIVA: vuota vuol dire «si usa come si compra». Era dietro un interruttore, ma nasconderla costringeva a cercarla anche a chi la voleva scrivere — una birra, per sapere quanto costa al cl. Sparisce anche la domanda «quanto contiene una confezione» per chi non conta a pezzi: comprando a chili, una confezione È un chilo. Il prezzo si scrive nell'unità d'acquisto (€/kg, €/cl, €/pz, €/U) e sotto resta salvato il costo per confezione, che è quello che il resto dell'app legge da sempre; i prodotti già caricati tengono il loro contenuto e i loro numeri, perché riscriverli vorrebbe dire cambiare i conti di un articolo che nessuno ha toccato. «A QUANTO CORRISPONDE UN PEZZO» È IL CONTENUTO, non la dose del drink: quella la decide la ricetta, drink per drink, e chi confonde le due cose scrive lì i centilitri di un cocktail e scarica il magazzino con numeri che non tornano. Si può lasciare VUOTO — e allora in ricetta si dosa solo a pezzi, che è il caso della birra servita intera — oppure scriverlo, e allora la ricetta sceglie fra il pezzo e l'unità del contenuto (4 cl da una bottiglia da 100 cl scalano 0,04 pezzi). Lo dicono una didascalia sotto al campo e un «?» accanto alla domanda. E la SOGLIA DI AVVISO si scrive sempre nell'unità d'acquisto — è il prodotto comprato che sta finendo, ed è quello che si va a ricomprare: niente più tendina, e l'etichetta dice l'unità. E «SI SCARICA DAL MAGAZZINO?»

LO DECIDE IL PRODOTTO, non la sua unità (`eScorta`). La regola stava sull'unità — quello che si conta a unità generiche non si scarica — ed è giusta per la manodopera, che non sta su nessuno scaffale, ma non per il GHIACCIO: si conta a unità e finisce eccome. Il consumo ora conta tutto quello che la ricetta chiede, e a decidere cosa togliere dalla giacenza è chi la scrive, che l'articolo ce l'ha in mano — scarico, riallineo di una comanda modificata, reintegro all'annullo e previsione «a fine serata». Nella scheda, per i soli articoli a unità, c'è la casella «È una scorta: si scarica quando si usa»; di suo è spenta, così la manodopera già a listino non cambia comportamento. Senza resa dichiarata non si inventa niente: costo null e consumo invariato, che è meglio di un numero uscito da una moltiplicazione a caso.

RIVISTA (1.4.8, secondo giro, approvato): la scheda parte da UNA domanda — «che tipo di prodotto è?» — con quattro card illustrate in griglia 2×2. «Lo vendo intero» (bottiglie e lattine: pezzi, contenuto facoltativo che serve solo al costo al cl di confronto), «Lo verso nei drink» (pezzi, e «una bottiglia fa…» è OBBLIGATORIO: senza, niente costo al cl né scarico frazionato, e il salvataggio si ferma spiegandolo), «Sfuso, a peso o volume» (limoni al chilo, spina, ghiaccio: unità d'acquisto a scelta fra kg/l/cl/g/U, resa facoltativa «5 kg fanno 1,5 l» con la quantità sui due lati), «Lavoro o servizio» (solo costo per unità: niente giacenza, mai esaurito, in carta non compare). Il tipo decide unità e scorta: spariscono il selettore «Unità d'acquisto» a famiglie, la casella «È una scorta» e ogni «lo uso come lo compro». Il MODELLO DATI NON CAMBIA: si aggiunge solo un campo `tipo` sull'item per le prossime aperture; le schede vecchie, che non ce l'hanno, si riaprono nel tipo dedotto da unità, contenuto e scorta (U non-scorta → lavoro, U con scorta → sfuso, pezzo con contenuto → versato, pezzo senza → intero, il resto → sfuso), senza migrazione. Cambiando tipo su un prodotto esistente valgono gli avvisi di conversione della giacenza di sempre.

RIPENSATO (18/08, tre vocali di Flavio uno via l'altro — 14:53, 15:17, 15:22 — vince l'ultimo, che è la sintesi e decide). Prima idea (14:53): «l'unità di misura sono i pezzi, poi dopo i pezzi vengono divisi in cl, grammi e unità di misura non definita» — non più la resa fra unità d'acquisto e unità d'uso di sopra: sempre e solo PEZZO, frazionato da una seconda unità. Guardando l'app (15:17), Flavio boccia la domanda RIVISTA qui sopra («che tipo di prodotto è?», le quattro card): «questa cosa non è male, però secondo me non è molto corretta per un gestionale, cioè va un po' troppo nello specifico». Lo stesso articolo si vende in più modi — il Jägermeister va nel Jägerbombo E si vende a cicchetto da solo, mai la bottiglia intera — e una card sola per prodotto non lo permette. Segnala anche diciture da rivedere: «una bottiglia fa» (100 cl) «non credo sia molto italiana» — la scheda va riletta con questo in mente, non solo quella frase.

DECISO (15:22, l'ultima parola: qui non è più una proposta da confermare). «L'unità di misura iniziale deve scomparire, perché non è più selezionabile, in automatico è il pezzo» — FISSO E BLOCCATO, non un campo `tipo` né una scelta fra famiglie. Il campo `tipo` previsto nella revisione qui sopra NON si aggiunge più, e con lui cadono il selettore a quattro card e ogni distinzione fra «lo vendo intero / lo verso nel drink / sfuso / lavoro». La SOLA domanda che il modulo fa è «a quanto corrisponde un pezzo», con tre risposte possibili: unità di CAPACITÀ (l, cl, ml), di PESO (kg, g), o «U» non definita — mai una quarta a piacere: «potremmo caricare tantissime cose con tantissime unità di misura che non sappiamo, e non ce le possiamo mettere a creare ogni volta» — la U resta volutamente generica, il significato sta in testa a chi la usa («lo so io che sono minuti, ma non fa niente»).

NESSUN REQUISITO deve prevedere unità di misura personalizzabili dall'utente.

CHI DECIDE, TOLTA LA DOMANDA: nessuno dichiara più come si vende un prodotto — la domanda «lo vendo intero / sfuso a peso o volume / lavoro a servizio» sparisce e NON SI SOSTITUISCE con un'altra: quello che decideva lei lo decide adesso la RICETTA. Sue parole: «bisogna fare i conti rispetto all'utilizzo che viene fatto della merce. Quando la merce viene usata in una ricetta, allora la scarichiamo dell'unità di misura che può essere una qualsiasi che sia convertibile dall'unità di misura del prodotto». La quantità di un ingrediente in ricetta si scrive a PEZZI — sempre disponibile, perché è la base — o nell'unità in cui si frazionava (cl, g, U). A rendere possibile il passaggio è proprio «a quanto corrisponde un pezzo» (1 pz = 25 cl, per dire): con quel dato, quello che la ricetta chiede in cl si converte in pezzi per la giacenza.

LA GIACENZA NON CAMBIA MAI UNITÀ — resta sempre in pezzi — a convertirsi è solo quello che la ricetta chiede.

CASO LIMITE (deduzione di chi scrive questo requisito, non parola sua — DA CONFERMARE): un prodotto senza corrispondenza impostata (nessun «1 pz = …») si può usare SOLO A PEZZI, perché non c'è niente con cui convertire; l'app deve dirlo — proponendo solo i pezzi in ricetta, o chiedendo di compilare la corrispondenza — invece di lasciare scrivere «40 ml» di una cosa di cui non si sa quanto contiene un pezzo, che è il modo più veloce per scaricare numeri a caso. E la «U» non si converte con nulla: un prodotto in unità non definite si usa in pezzi o in U, e va bene così — non è un buco, è la natura di quell'unità. La scelta pezzo-o-frazione non è solo del CARICO, come diceva il primo vocale: vale per QUALUNQUE movimento — «se farmo un carico, uno scarico, qualsiasi cosa esso sia di movimentazione» — chiedendo ogni volta se muovere a pezzi o nell'unità che compone il pezzo. Casi-prova citati a voce: un distillato codificato «1 pezzo = X cl» chiede se caricare a pezzi o a centilitri; il ghiaccio codificato «1 pezzo = X grammi» chiede pezzi o grammi (il numero detto a voce, «8 grammi», è il peso di UN CUBETTO, non di una confezione — vedi sotto); il tempo di lavorazione, pezzi o «U» (minuti, nella testa di chi lo carica). I TRE LIVELLI, e risolvono anche lo SFUSO (chiarito 18/08, oltre i tre vocali sopra): il PEZZO è quello che si prende in mano — un cubetto, un limone, un barattolo, una bottiglia; il CONTENUTO dice a quanto corrisponde quel pezzo, in capacità, peso o U — un cubetto 8 g, una bottiglia 70 cl; il COLLO dice quanti pezzi ci sono nella confezione che si compra — 30 cubetti, 24 birre, una cassetta di limoni. Sono i tre concetti che c'erano già (pezzo, contenuto, collo — quest'ultimo in REQ-MAG-011): il ghiaccio è il caso-prova buono, 1 pz = 8 g e un collo = 30 pz, quindi caricando «1 collo» entrano 30 pezzi, cioè 240 g. Con questo si chiude anche il caso dei LIMONI (comprati al chilo, usati in cl) che era rimasto apertissimo dalla prima nota di Flavio: un limone è un pezzo, e il fatto che si comprino al chilo non rompe niente — è proprio per questo che Flavio vuole poter scegliere l'unità a ogni movimento; si compra 5 kg, si carica A GRAMMI, e i pezzi si ricavano dal contenuto del pezzo.

AVVERTENZA ONESTA da scrivere in interfaccia: per la roba comprata a peso il conteggio in pezzi è una STIMA — un limone non pesa sempre uguale — e va bene finché quello che conta davvero è il peso, ma chi legge «47 pz» di limoni deve sapere che nessuno li ha contati uno per uno.

IL CARICO A COLLO RESTA (vedi REQ-MAG-011, dove la parola che usa il codice è già «collo», non «cartone»): comprando confezioni intere — 24 birre, per dire — si scrive il prezzo totale del collo e si scompone da sé, prima al singolo pezzo, poi al singolo cl (una bottiglia a 33 cl, non gli «8 cl» della trascrizione del vocale delle 15:17 — il senso è quello della birra da 33, ripetuto poco prima nella stessa frase). Con questo si scioglie anche il punto rimasto aperto in BUG-014 (la «U» nella prima domanda): la prima domanda non c'è più, è sempre pezzo, e la «U» sta sempre — e solo — nella seconda. La MIGRAZIONE dei prodotti già in magazzino a questo modello è un lavoro separato, che si prova diversamente e può essere pronto in un momento diverso da questo requisito: vedi REQ-MAG-018.

DA CHIARIRE (AskUserQuestion non disponibile in questo passaggio, quindi non deciso qui): 1) nel vocale delle 15:22 (min 1:00) il distillato d'esempio suona come «il Tangerai» — quasi certamente Tanqueray, ma la trascrizione non è chiara; 2) nel vocale delle 15:17 (min 2:01) un prodotto suona come «la maro del capo», trascrizione poco chiara — non si capisce a cosa si riferisse l'esempio.

FATTO (1.5.0). La scheda prodotto non ha più né le quattro card né il selettore dell'unità d'acquisto: si salva sempre `unit: 'pz'` e `display_unit: 'pz'`, e la sola domanda è «a quanto corrisponde un pezzo» — numero più unità fra l, cl, ml, kg, g, U, e nient'altro (le unità non sono personalizzabili, mai). Vuota vuol dire che in ricetta si dosa solo a pezzi. Il campo `tipo` non si scrive più e si azzera su chi l'aveva; la `resa` idem, perché con il pezzo fisso lo stesso legame lo dice già il contenuto e due risposte alla stessa domanda litigano (resaUso preferisce la resa). Il modello dati resta quello di sempre: `package_size` è il contenuto in unità base e `content_unit` dice di che famiglia è.

SI SCARICA DAL MAGAZZINO? Resta una casella sulla scheda («È una scorta: si scarica quando si usa», accesa di suo). NON è la domanda tolta il 18/08 — quella diceva come si VENDE — ma la decisione che questo stesso requisito aveva già messo sul prodotto: senza, con l'unità bloccata sul pezzo, il «Tempo di Lavorazione» diventerebbe merce, andrebbe a zero al primo drink e il menù farebbe sparire dalla carta i drink che lo usano.

OGNI MOVIMENTO CHIEDE L'UNITÀ: carico e conta hanno accanto alla quantità la scelta fra pezzi e contenuto (`unitaMovimento`), la conversione la fa `qtyInStockUnit` — lo stesso conto dello scarico — e sotto si legge quanto entra davvero prima di confermare. A colli si contano pezzi e basta: un cartone ha dentro pezzi, non centilitri. La giacenza NON cambia mai unità: resta in pezzi. L'AVVERTENZA ONESTA c'è: col contenuto a peso la scheda dice che il conteggio in pezzi è una stima, e il carico lo ripete. Le schede storiche (ml, g, U) si riaprono e passano ai pezzi al salvataggio, con l'avviso di conversione della giacenza di sempre: a volume o a peso si divide per il contenuto di un pezzo, la «U» vale uno a uno perché era già una cosa che si conta. Il travaso in blocco resta REQ-MAG-018.

**Dove**: `src/lib/inventory.js, src/components/InventoryManager.jsx` · **Lo dimostrano**: `tests/unit/inventory.test.js`, `tests/component/InventoryManagerCard.test.jsx`

#### REQ-MAG-018 — I prodotti che ci sono già si travasano al modello nuovo aggiornando l'app, non li riapre uno per uno chi sta al banco

Nasce da REQ-MAG-016 (unità sempre pezzo, con una corrispondenza in capacità/peso/U) ma è un lavoro A PARTE: il modello nuovo e il travaso dei dati vecchi si provano in modo diverso, e uno può essere pronto quando l'altro non lo è ancora — per questo è un requisito suo, non un paragrafo dentro l'altro.

IL FATTO: oggi i 388 prodotti di magazzino hanno unità diverse fra loro — liquidi in cl, solidi in grammi, alcuni già a pezzi — e il modello nuovo li vuole tutti a PEZZO con una sola corrispondenza (capacità, peso o U).

DECISO da Flavio (18/08): «credo che dobbiamo migrare noi i prodotti al nuovo modello, poi capiamo come» — il travaso non lo fa chi sta al banco riaprendo 388 schede a mano. COME, precisato da lui poco dopo (18/08): «il travaso deve avvenire in fase di aggiornamento. Cioè non dobbiamo farlo direttamente sui db: quando si aggiorna il bundle si aggiornano i prodotti». Niente script di migrazione lanciato contro Firestore, quindi — né in test né altrove. Il travaso è dell'APP, e si fa come si è sempre fatto con gli ordini vecchi, che nessuno ha mai migrato: li rimette in riga `normalizeOrderDoc` alla lettura (REQ-ORD-002). E POI RIPENSATO, sempre il 18/08, guardando l'app: «il travaso dovrebbe farlo l'utente. Quando entra in magazzino un banner gli dice che deve iniziare la migrazione dei dati alla nuova gestione magazzino. Quando preme ok, parte prima un dry run che lo avvisa dei prodotti che devono essere sistemati prima, e poi, se tutto è come se lo aspetta e tutti i prodotti possono essere migrati, allora chiede conferma e migra i dati. Niente di automatico. Se non ha migrato i dati, una notifica fissa che non scompare finché non fa la migrazione deve ricordargli di fare la migrazione prima di inserire nuovi prodotti o modificare i prodotti (può modificare solo quelli da sistemare prima della migrazione)». E: «ovviamente se è già tutto migrato questa cosa non vale» — i dati possono arrivare già a posto da un'altra strada.

FATTO (1.5.0), in quattro pezzi.

1) LETTURA TOLLERANTE, che resta: senza, un database non ancora aggiornato non si legge nemmeno. `articoloNormalizzato` (src/lib/inventory.js) prende un articolo com'è scritto e ne restituisce la forma nuova; ci passa `mapItem` in src/lib/api.js, che è il punto da cui entrano nell'app tutti gli articoli — magazzino, ricette, menù, costi. Chi è già a posto torna identico.

2) NIENTE RISCRITTURA SILENZIOSA: il database lo cambia solo un gesto esplicito. `loadStock` e `adjustStock` non riscrivono più niente di nascosto e anzi si fermano (`ATTESA_TRAVASO`) se l'articolo è ancora nella forma vecchia, che sommare pezzi a centilitri fa un numero senza senso. Lo scarico automatico delle comande NON passa di lì: lavora sul documento grezzo, nella sua unità, e la serata non aspetta nessuno.

3) IL GIRO IN MANO A CHI LAVORA (`PannelloTravaso` in InventoryManager.jsx): entrando in Magazzino un banner dice che i prodotti vanno aggiornati e cosa non si può fare nel frattempo; «Guarda cosa cambia» apre la PROVA A VUOTO, che non scrive niente ed elenca per NOME i prodotti da sistemare prima — chi legge deve sapere quali aprire — oppure, se non ce n'è nessuno, quanti prodotti si aggiornano e con quale giacenza prima/dopo. Solo allora compare «Aggiorna N prodotti». La scrittura (`travasaMagazzinoAPezzi` in api.js) va a LOTTI da 25 con l'avanzamento a schermo, ed è ripetibile: ogni giro rilegge cos'è rimasto da fare, quindi interrompersi e ricominciare non tocca due volte lo stesso prodotto.

4) FINCHÉ NON È FATTO il magazzino è in sola lettura: niente carico, niente conta, niente prodotti nuovi, e si possono aprire SOLO i prodotti da sistemare — è l'unico modo di sbloccare. La loro scheda dice cosa manca e a quanto diventa la giacenza.

LO STATO NON È UN FLAG: `statoTravaso` guarda se esistono ancora articoli nella forma vecchia. Così resta vero anche se i dati arrivano sistemati da un'altra strada, e su un database a posto non compare niente — né banner né avviso.

COSA FINISCE FRA I «DA SISTEMARE», e perché non si indovina: chi si compra in una misura e si usa in un'altra (i limoni al chilo, spremuti in cl: un pezzo può corrispondere a una cosa sola, e sceglierla al posto di chi lavora vuol dire buttare via l'altra — una ricetta che la usava scaricherebbe un chilo dove voleva un grammo); chi si conta a volume o a peso senza dire quanto contiene una confezione; e chi ha un contenuto SENZA MISURA — la «Birra Pils (spina)» vista in test dice che un pezzo contiene 330, ma 330 di cosa? cl, ml, grammi? Indovinare sbaglia il costo di un drink di dieci volte.

LE REGOLE DELLA CONVERSIONE, e il perché di ognuna. Il PEZZO è la confezione che si comprava: una bottiglia da 70 cl era già «una confezione da 700 ml», e la giacenza in ml diventa pezzi frazionati — senza stime. Per la «U» il pezzo è l'unità: un sacco di ghiaccio era uno, resta uno. La RESA diventa il contenuto solo quando le due misure sono della stessa famiglia (il fusto comprato a litri e versato a cl). `scorta` va scritta nero su bianco: «si scarica dal magazzino?» aveva un valore di partenza legato all'unità, e portando tutto a pezzi il «Tempo di Lavorazione» diventerebbe merce — a zero al primo drink, e il menù farebbe sparire dalla carta i drink che lo usano.

IL CONTENUTO SI LEGGE NELL'UNITÀ IN CUI IL NUMERO SI CAPISCE (`contenutoDelPezzo`): un fusto da venti litri si leggeva «2000 cl» e sembrava un numero inventato; adesso dice «1 pz = 20 L», mentre una bottiglia resta «70 cl» e un cubetto «8 g».

SI PROVA IN LOCALE PRIMA, con dati come quelli veri: «dobbiamo fare degli script di seeding da provare in locale» (Flavio, 18/08). `npm run seed:vecchi` (scripts/seed-magazzino-vecchio.js) riempie l'emulatore di prodotti scritti in TUTTE le forme vecchie che esistono davvero — a pezzo con e senza contenuto, contenuto senza misura, a volume, a peso, a volume senza confezione, «U» con e senza scorta, con la resa della stessa famiglia e di due famiglie, col campo `tipo` delle quattro card, con la giacenza sotto zero — più una ricetta che li usa. Gira solo sull'emulatore, su progetto `demo-`, e sta fuori da `seed:tutto`. `node scripts/diagnosi-travaso.js` dice a che punto sta il travaso e, soprattutto, se leggerli a pezzi muove valore, pezzi o costi: non scrive niente, mai, da nessuna parte.

DUE DIFETTI VISTI AL PRIMO GIRO VERO (18/08), tutti e due sistemati. Il primo: mentre l'aggiornamento girava, il magazzino dell'emulatore è stato sostituito da un'altra parte; la schermata aveva in mano la lista di un minuto prima, ha provato a scrivere su documenti spariti e il lotto è morto lì. Adesso OGNI LOTTO RILEGGE invece di fidarsi della lista di partenza, e chi non c'è più si salta e si conta a parte («2 prodotti non ci sono più: sono stati saltati. Gli altri sono a posto»). Vale anche al contrario: un prodotto NATO mentre l'aggiornamento gira viene preso dallo stesso giro, invece di restare indietro senza che nessuno lo sappia. E uno che proprio non si lascia scrivere si mette da parte, se no tornerebbe nella lista a ogni giro e la schermata resterebbe lì per sempre. Il secondo: a schermo è finito «NOT_FOUND: no entity to update: app dev~demo-tana-drink path < Element {…} >», in mezzo alla schermata di chi al banco deve solo capire cosa fare. Il motivo tecnico adesso va nella console; a schermo si legge cosa è passato, cosa no, e che si può riprovare senza fare danni — perché è vero, il giro riprende da dove si era fermato. E DA LÌ UNA REGOLA IN PIÙ: il cartello e la prova a vuoto non mentono mai. Il magazzino si legge una volta sola (non è la coda, e va bene così), ma la PROVA A VUOTO rilegge sempre prima di elencare — è quella che si guarda per decidere, e non può parlare di prodotti visti dieci minuti fa — e dopo l'aggiornamento la lista si ricarica, così il cartello sparisce da solo senza ricaricare la pagina a mano. Se nel frattempo è già tutto a posto, il cartello sparisce e basta.

VERIFICATO SUI DATI VERI (18/08, sola lettura): su `tana-drink-test` 354 articoli, 350 già nella forma nuova, 4 che si leggono travasati (la mano d'opera in «U», due succhi fatti in casa e lo sciroppo), NESSUNO da sistemare a mano, e valore, pezzi e costi identici a prima. Sull'emulatore col seed dei vecchi: 34 travasati e 3 da sistemare, che sono esattamente i tre casi messi lì apposta. E IL GIRO INTERO SUI DATI VERI (18/08), col magazzino di test copiato nell'emulatore (`scripts/copia-magazzino-da-test.js`): 354 articoli, il cartello dice «4 da aggiornare, 0 da sistemare», l'aggiornamento scrive quei 4, il cartello sparisce da solo, e il valore di magazzino resta 6806,16 € prima e dopo — con nessun numero mosso, articolo per articolo, né in valore né in pezzi né nel costo per unità.

QUATTRO VINCOLI DEL MESTIERE, che qui si dimenticano facile:

1) GLI SCRIPT NON TOCCANO LA PRODUZIONE DI PROPRIA INIZIATIVA (CLAUDE.md). Con il travaso fatto dall'app il problema non si pone nemmeno: non c'è niente da lanciare contro le giacenze vere.

2) IL TRAVASO DEVE ESSERE VERIFICABILE: prima e dopo, il VALORE di magazzino, la QUANTITÀ in pezzi e il COSTO delle ricette devono tornare uguali. Se cambiano, la conversione ha mentito — ed è l'unico controllo che se ne accorge da solo, perché un numero sbagliato in pezzi sembra comunque plausibile a chi lo legge. Lo controllano tests/unit/travasoInventario.test.js (compreso il costo di un drink intero, al centesimo) e lo script di diagnosi sui dati veri.

3) IL TRAVASO TOCCA SOLO IL MODO DI MISURARE, NIENT'ALTRO (Flavio, 18/08 ore 15:35): in produzione ha già sistemato a mano, uno per uno, menù e prodotti con i prezzi corretti e le ricette del menù. La conversione tocca unità, contenuto, giacenza, soglia e `scorta`: non prezzi, non ricette, non voci di menù. 4) C'È UNA FINESTRA DI TEMPO (stesso vocale, 15:35): l'unica cosa che Flavio non ha ancora fatto è il CARICO REALE delle giacenze. Con il travaso alla lettura la finestra conta meno — non c'è un momento in cui qualcuno converte tutto — ma resta vero che è meglio aggiornare prima che dopo.

RESTA APERTO: gli articoli comprati in una misura e usati in un'altra (i limoni al chilo, spremuti in cl) non si convertono da soli e si leggono ancora nella forma vecchia. Vanno sistemati a mano, decidendo cos'è un pezzo — un limone, e quanto pesa — e sono pochi: la diagnosi li elenca per nome.

ESEGUITO IN PRODUZIONE il 18/08 con la 1.5.0, dall'utente (detto il 19/08). Da quel momento il magazzino vero e' tutto a pezzi: non e' piu' una cosa che aspetta, e chi legge questa voce non deve piu' chiedersi se il locale ha travasato.

QUINDI IL TRAVASO E' ORMAI UNA MACCHINA A RIPOSO. Il codice resta (`travasaMagazzinoAPezzi`, `statoTravaso`, il banner e il blocco di InventoryManager), e sta li' come un estintore: non serve piu' a nessuno finche' non nasce un'installazione che parte da dati vecchi — caso oggi inesistente, perche' il locale e' uno solo, ma previsto dal piano di sbrandizzazione (docs/piano-sbrandizzazione.md).

VERIFICATO IL 19/08 che dalla 1.5.0 il modello NON e' cambiato di nuovo: l'unico campo aggiunto ai documenti e' `sale_vat` sui drink (REQ-MENU-013), ed e' additivo — vuoto vuol dire «usa l'IVA del locale», quindi nessun dato vecchio da rimettere in riga. Se un giorno il modello cambiera' davvero, questa e' la voce da rileggere: dice come si fa un travaso senza toccare il database a mano.

**Dove**: `src/lib/inventory.js (articoloNormalizzato), src/lib/api.js (mapItem, loadStock, adjustStock)` · **Lo dimostrano**: `tests/unit/travasoInventario.test.js`, `tests/unit/travasoScrittura.test.js`, `tests/component/TravasoMagazzino.test.jsx`, `tests/unit/scritturaMagazzino.test.js`

#### REQ-MAG-017 — Il fornitore si aggiunge dalla tendina del prodotto, come già la categoria nel menù

Scritto da Flavio (18/08, due messaggi di seguito, 15:33 e 15:34 — il secondo semplifica il primo e vince), commentando il modulo «Modifica prodotto» del magazzino in test («Acqua Brillante Tonica»). La tendina Fornitore elenca solo i fornitori che esistono già: se manca quello giusto, oggi bisogna uscire dal prodotto, andare in Fornitori, crearlo, e tornare indietro a ricominciare la scheda — proprio nel momento in cui ci si accorge che manca. Sue parole (15:33): «nella tendina deve comparire il tab AGGIUNGI FORNITORE ed aggiungerlo direttamente da una finestra di info dove basterà confermare solo il nome per poi aggiungere in un secondo momento altre info aziendali». Come deve comportarsi (15:34) non è da inventare: il modello esiste già nell'app, e lui lo indica come esempio — «proprio come succede nel MENU che quando apri la tendina appare NUOVA CATEGORIA». Nel modulo del drink (src/components/DrinkForm.jsx) la tendina Categoria ha in fondo la voce «➕ Nuova categoria…», che apre al volo una finestra dove basta il nome per confermare (onCategoryChange, valore `__new__`). La tendina Fornitore del prodotto di magazzino deve comportarsi allo stesso modo: ultima voce che apre la creazione al volo, basta il nome — il resto dei dati aziendali (indirizzo, contatti…) si compila dopo, con tempo, dalla sezione Fornitori — e il fornitore appena creato resta SELEZIONATO sul prodotto che si stava compilando, senza doverlo riselezionare a mano: se toccasse rifarlo, il giro non si sarebbe accorciato.

DA CHIEDERE (segnalato, non deciso qui — per esplicita richiesta di Flavio di non allargare la richiesta da soli): nello stesso modulo, la tendina Categoria del prodotto di MAGAZZINO (non quella del menù, che il comportamento ce l'ha già) è oggi un elenco semplice, senza «+ Nuova categoria» — la stessa mancanza del fornitore, mai segnalata a voce finora. Vale lo stesso trattamento anche lì?

FATTO (1.5.0). La tendina Fornitore della scheda prodotto ha in fondo «➕ Nuovo fornitore…», identica alla «➕ Nuova categoria…» del modulo del drink: si sceglie, compare una riga dove basta scrivere il nome e confermare, e il fornitore appena creato resta SELEZIONATO sul prodotto che si stava compilando — se toccasse riselezionarlo a mano il giro non si sarebbe accorciato di niente. Il resto dei dati aziendali (indirizzo, contatti, email per gli ordini) si mette dopo, con calma, dalla sezione Fornitori. L'elenco in memoria si aggiorna da sé senza ricaricare il magazzino: la scheda che lo aspetta è aperta, e ricaricare la chiuderebbe. Ci si può anche ripensare («✕») senza aver creato niente.

RESTA DA CHIEDERE, e non l'abbiamo allargato di nostra iniziativa: la tendina Categoria dello stesso modulo (quella del prodotto di MAGAZZINO, non del menù) è ancora un elenco semplice. Vale lo stesso trattamento anche lì?

**Dove**: `src/components/InventoryManager.jsx (select #isup, form prodotto), src/components/DrinkForm.jsx onCategoryChange (il comportamento da copiare)` · **Lo dimostrano**: `tests/component/InventoryManagerCard.test.jsx`

#### REQ-MAG-019 — «pz» al posto di «bottiglie», dappertutto sullo schermo

Decisione di Flavio (18/08), sulle diciture segnalate in REQ-MAG-016 («una bottiglia fa 100 cl» «non credo sia molto italiana»). Testuale: «non dobbiamo vincolarci troppo a un gestionale per un bar. "Bottiglie" non è generico per un gestionale che in qualche modo deve essere generico. Quindi PZ DEVE ESSERE USATO AL POSTO DI BOTTIGLIE OVUNQUE». Riguarda le PAROLE CHE SI LEGGONO A SCHERMO — etichette, placeholder, testi d'aiuto, messaggi d'avviso — non i nomi interni del codice: `bottles_total`, `bottleBreakdown`, `bottleSummary` e i commenti restano come sono, che qui si cambia solo quello che legge chi ha in mano un vassoio. I PUNTI TROVATI (`grep -rn "bottigli" src/ --include=*.jsx`), perché chi implementa non debba ricercarli: 1) l'etichetta del campo contenuto, nel form del prodotto: «Una bottiglia fa…»; 2) il suo placeholder: «Es. 70 per una bottiglia da 70 cl»; 3) le due didascalie sotto lo stesso campo, una per «lo verso nei drink» («4 cl da una bottiglia da 70») e una per «lo vendo intero» («con le altre bottiglie»); 4) il messaggio d'avviso al salvataggio quando il contenuto obbligatorio manca: «Scrivi quanto fa una bottiglia (es. 70 cl)…»; 5) l'aiuto «A quanto corrisponde un pezzo» (tre paragrafi: «una bottiglia da 100 cl» due volte, «la birra in bottiglia»); 6) il sottotitolo «bottiglie, lattine» del tipo «Lo vendo intero», e l'aiuto della domanda «che tipo di prodotto è?», che ripete «bottiglia/bottiglie» cinque volte in tre paragrafi. Gli ultimi due (punto 6) vivono dentro la schermata a quattro card che REQ-MAG-016 (ripensamento 18/08) toglie di mezzo: se le due implementazioni si fanno insieme, quel testo semplicemente non c'è più e non va corretto due volte; se REQ-MAG-016 arriva dopo, va corretto comunque perché nel frattempo resta a schermo.

DUE AVVERTENZE. La prima: «una bottiglia fa 100 cl» era sbagliato due volte — la parola (bottiglia → pz) e il VERBO (fa → corrisponde), perché la sostanza del modello deciso il 18/08 è «a quanto corrisponde un pezzo», non «quanto fa» — chi corregge la parola senza correggere il verbo lascia la frase sbagliata a metà. La seconda: nel dettaglio aperto di un articolo (REQ-MAG-002, REQ-MAG-011) restano le «bottiglie piene / aperta / finite» che servono a chi va a contarle sullo scaffale — quella non è la dicitura da cambiare, è un'altra cosa: lì «bottiglia» descrive l'oggetto fisico, non l'unità di misura.

FATTO (1.5.0). I punti 1-6 dell'elenco qui sopra vivevano tutti nella scheda prodotto e nella schermata a quattro card, che REQ-MAG-016 ha riscritto: quel testo non esiste più, e al suo posto c'è «a quanto corrisponde un pezzo» — la parola giusta e anche il verbo giusto. Restano corretti qui i tre punti che erano fuori da quella scheda: il titolo dell'assortimento «Bottiglie premium» (ora «I prodotti buoni»), il costo nel dettaglio di un articolo, che si legge «€/pz» e non più «€/conf.», e la riga del generatore ordini, che diceva «1 conf. = 700 pz» — il contenuto letto nell'unità sbagliata, che con la giacenza contata a pezzi era anche un numero falso — e adesso dice «1 pz = 70 cl», con il suggerimento e il campo in pz. Restano volutamente com'erano: le «piene / aperta / finite» del dettaglio, che descrivono l'oggetto sullo scaffale, e le due righe d'aiuto che elencano cosa può essere un pezzo («un cubetto, un limone, una bottiglia, un barattolo») — lì la bottiglia è un esempio fra altri, non l'unità di misura.

**Dove**: `src/components/InventoryManager.jsx` · **Lo dimostrano**: `tests/component/InventoryManagerCard.test.jsx`

#### REQ-MAG-015 — Macro-categorie di magazzino e di menù, per incrociare speso e incassato

Chiesto da Flavio a voce (17/08, nota delle 20:13). Le macro-categorie oggi sono una cosa sola e stanno sul MAGAZZINO: raggruppano le categorie dei prodotti che si comprano. Servono anche sul MENÙ, sulle categorie dei drink che si vendono — e le due cose vanno tenute distinte («macro-categorie magazzino» e «macro-categorie menù»). A cosa servono davvero: incrociarle. Da una parte quanto si è SPESO in una macro d'acquisto, dall'altra quanto si è INCASSATO in una macro di vendita, e il confronto fra le due — che è la domanda che il locale si fa a fine mese e a cui oggi si risponde a mano. Da decidere prima di scrivere codice: se le due macro vivono nella stessa collezione con un campo che dice a chi appartengono o in due separate; e come si aggancia una macro d'acquisto alla macro di vendita corrispondente (una a una, o molte a molte).

FATTO (1.4.8) il primo pezzo: i due elenchi esistono davvero. Le macro hanno un `ambito` ('magazzino' o 'menu', le righe vecchie sono tutte di magazzino), il menù ha la sua sottosezione «Macro-categorie» che raggruppa le categorie dei drink, e su ogni macro di spesa si sceglie a quale macro di vendita corrisponde (`macro_menu_id`). Il pannello è uno solo, condiviso dalle due schermate.

DA FARE: il confronto vero e proprio — speso su una macro d'acquisto contro incassato sulla macro di vendita agganciata. Attenzione: la tabella «Mensile per macro» che c'è già confronta acquisti e fatturato sulle macro di MAGAZZINO, spalmando l'incasso di ogni drink sugli ingredienti in proporzione al costo. Le due letture rispondono a domande diverse e vanno tenute distinte, non sovrapposte.

RIPENSATO (18/08, vocale delle 15:47 — «discorso abbastanza complesso», parole sue). Il confronto sopra non basta quando un ingrediente finisce in un drink di una macro DIVERSA dalla propria: «un prodotto può essere venduto in due macro categorie differenti». Il gin è semplice — comprato in «distillati», venduto nel Gin Tonic che sta in «alcolici e distillati»: stessa macro, nessun conflitto. Il caso complesso è la SCHWEPPES: comprata come bibita (macro magazzino «birre e bibite»), ma quando finisce in un Gin Tonic — che nel menù sta in «alcolici e distillati» — quella porzione «deve migrare nei distillati». Stesso schema per la RED BULL, comprata come bibita e venduta in uno Jäger Bomb (alcolici e distillati). Sintesi sua: «il menù alla fine controlla il magazzino».

INTERPRETAZIONE DA CONFERMARE (non è la sua frase testuale, è la lettura che ne dà chi scrive questo requisito — riportata perché presa alla lettera la frase è irrealizzabile): non è il PRODOTTO a cambiare macro-categoria — la stessa Schweppes si vende anche da sola, quindi non può stare in una macro sola, e cambiarla nell'anagrafica romperebbe il magazzino. A migrare, ai soli fini del CONFRONTO acquistato/venduto/ margine, è il singolo CONSUMO: la porzione di Schweppes versata in quel Gin Tonic si attribuisce alla macro di vendita del drink (distillati), non alla macro d'acquisto del prodotto (bibite). L'anagrafica del prodotto — la sua macro di magazzino — non si tocca mai. Se questa lettura è sbagliata, il rischio è concreto: al primo Gin Tonic venduto il magazzino sballa.

CASI DI PROVA (le sue parole, non inventati): la Schweppes comprata in «birre e bibite» e venduta dentro un Gin Tonic conta, in quel consumo, su «alcolici e distillati»; la Red Bull comprata in «birre e bibite» e venduta dentro uno Jäger Bomb conta, in quel consumo, su «alcolici e distillati».

CONFERMATO E PRECISATO (18/08, vocale delle 15:52). La lettura qui sopra e' quella giusta, e lui la irrigidisce: non si scompone NIENTE. Parole sue: «non mi deve fare la scomposizione della ricetta [...] e' tutto l'items che va nella macro categoria», e ancora «la Schweppes l'ho venduta come se fosse un distillato in quel momento, perche' integrato». Quindi la vendita di una voce di menu si attribuisce INTERA alla macro di quella voce — incasso e costo di tutti i suoi ingredienti insieme — e non si spalma sulle macro dei singoli prodotti che la compongono. E dice anche cosa il programma NON deve fare, indicando una cosa che gia' fa: «credo che sia la cosa che sta facendo adesso». E' la tabella «Mensile per macro» descritta qui sopra, che spalma l'incasso di ogni drink sugli ingredienti in proporzione al costo: quella scomposizione va tolta, non affiancata.

DECISO (18/08, dall'utente): il COSTO DEL VENDUTO segue la vendita. La porzione di Schweppes finita in un Gin Tonic conta su «alcolici e distillati» insieme al suo incasso; in «birre e bibite» resta solo quello che e' stato venduto COME bibita, incasso e costo. Cosi' il margine per macro torna: ogni macro confronta soldi entrati e costo di quello che ha venduto davvero, senza pezzi che arrivano da un'altra parte.

IL ROVESCIO NON E' UN COMPROMESSO, E' LA COSA GIUSTA. Da questa tabella non si legge piu' «quanto ho speso in bibite», e va bene cosi' (parole sue: «ed e' giusto che non sia piu' leggibile da li'»). Questa tabella risponde a UNA domanda — quanto rende ogni macro di quello che vendo — e un numero che parla d'altro, in mezzo, la renderebbe ambigua invece che piu' ricca. «Quanto ho speso in bibite» resta una domanda vera, ma e' degli ACQUISTI — le fatture, quello che e' entrato dalla porta — e vive dove stanno gli acquisti, non qui. Non serve nemmeno spiegarlo sotto la tabella: non c'e' niente da giustificare, c'e' una colonna che non deve esserci.

DA TOGLIERE, non affiancare: la scomposizione di `splitLineRevenueByMacro` (src/lib/macroStats.js), che spalma l'incasso di ogni drink sugli ingredienti in proporzione al costo. Con la regola qui sopra non serve piu' a nessuno, e due letture diverse della stessa serata convivendo sono il modo migliore per non fidarsi di nessuna delle due.

GLI ELENCHI SONO DUE, E NON ERA UNA DOMANDA APERTA (chiuso il 19/08 dall'utente): «Le macro-categorie sono macro-categorie per gli ACQUISTI e macro-categorie per le VENDITE». Cioe' com'e' gia' fatto dalla 1.4.8, ed e' la stessa cosa chiesta il 17/08. La frase del vocale delle 15:47 — «sono le stesse, non sono separabili» — era stata segnata come possibile contraddizione, e non lo e': dice che le due famiglie si GUARDANO INSIEME, che e' esattamente quello che fanno stando in due elenchi agganciati. Un elenco solo non funzionerebbe: si compra «birre e bibite» e si vende «alcolici e distillati», e sono due tagli diversi della stessa merce. PERCHE' `macro_menu_id` RESTA anche se oggi nessun conto lo legge: e' l'aggancio fra una macro d'acquisto e la macro di vendita corrispondente, e serve il giorno in cui gli acquisti avranno la loro schermata — «quanto ho speso in bibite» vive li' (vedi `purchasesByMacro`, rimasta apposta). Senza quel campo, mettere le due colonne una accanto all'altra vorrebbe dire richiedere a mano un lavoro gia' fatto.

IN QUALE MESE cade quello che si e' comprato e' un'altra domanda ancora, e sta a parte in REQ-MAG-021 (vocali del 18/08 sera).

FATTO (1.5.x) il confronto, con la regola decisa il 18/08. La tabella «Statistiche → Mensile per macro» adesso ha per righe le macro del MENÙ, e ogni vendita ci conta INTERA: incasso della voce e costo di tutti i suoi ingredienti insieme, sulla macro della voce. La Schweppes versata in un Gin Tonic conta su «alcolici e distillati» con il suo costo; in «birre e bibite» resta solo quello venduto COME bibita. L'anagrafica del prodotto non si tocca: la sua macro di magazzino resta quella che è, e il magazzino si scala come prima.

TOLTA, non affiancata, la scomposizione: `splitLineRevenueByMacro` non esiste più. Al suo posto `lineByMacro` (dove va una vendita, quanto ha incassato, quanto è costata) e `venditeByMacro`.

LE RIGHE DELLA TABELLA sono cambiate di conseguenza: dove c'era «Acquisti / Fatturato / Utile / Fat-Acq» adesso c'è «Incassato / Costo del venduto / Margine / Inc-Costo». La riga «Acquisti» è la colonna che non doveva esserci: parlava di merce entrata dalla porta, non di merce venduta, e in mezzo a un margine rendeva ambiguo tutto il resto. «Quanto ho speso in bibite» resta una domanda vera e vive con gli acquisti: `purchasesByMacro` è rimasta lì, sulle macro di MAGAZZINO, per quando le si darà una schermata.

NUMERI PIÙ ONESTI, come effetto collaterale: il costo del venduto è al netto dell'IVA d'acquisto (l'incasso era già scorporato: due numeri con dentro cose diverse non si sottraggono), e lo sconto abbassa l'incasso ma non il costo — un drink regalato è costato lo stesso. L'IVA DELL'INCASSO È QUELLA DEL LOCALE, e non più quella di ogni prodotto: si scorpora con `sale_vat` (Impostazioni).

DECISO dall'utente (18/08), che ha chiuso la domanda con il caso vero: «Flavio compra al 22 e rivende al 10, sulle sue vendite c'è solo il 10% di IVA. Deve essere l'IVA del locale sul drink, quella indicata nelle impostazioni». Il per-prodotto era nato solo perché l'incasso veniva spezzato per ingrediente: senza scomposizione una vendita è una vendita sola, con una aliquota sola — e l'aliquota del PRODOTTO è quella con cui lo si compra, non quella con cui lo si rivende. Dove erano state messe aliquote diverse per prodotto i netti cambiano di qualche punto, ed è il verso giusto.

LA DOMANDA SUI DUE ELENCHI È CHIUSA (19/08): sono due — acquisti e vendite — come già sono. L'aggancio `macro_menu_id` resta e ha una ragione, scritta qui sopra: serve quando gli acquisti avranno la loro schermata, per mettere speso e incassato uno accanto all'altro. E NON C'È NIENTE DA SALVAGUARDARE, verificato il 18/08: la collezione `macro_categories` è VUOTA — zero documenti sia in produzione sia su `tana-drink-test`. Nessuno ha mai creato una macro, né di magazzino né di menù, quindi l'aggancio non è «compilato a mano» da nessuno.

SU TEST NON È PIÙ VERO (19/08): le macro adesso ci sono, create a mano su `tana-drink-test` — quattro d'ACQUISTO e quattro di VENDITA, con gli agganci `macro_menu_id` compilati. Le categorie collegate sono 24 su 25 in magazzino e 13 su 14 nel menù: restano fuori ALTRO (magazzino) e BOTTIGLIE (menù), e ci restano APPOSTA — è la ragione per cui «senza macro» deve vedersi a colpo d'occhio invece di sembrare una dimenticanza (REQ-UI-022).

IN PRODUZIONE `macro_categories` È ANCORA VUOTA, e ci resta finché non arriva il via libera esplicito: si semina a mano, come su test, e la produzione non si tocca di propria iniziativa.

SISTEMATO (19/08): il commento sopra `MacroMenuPanel` in `MenuManager.jsx` raccontava ancora una «domanda ancora aperta» e una collezione «vuota in produzione e in test». Adesso dice quello che è vero: gli elenchi sono due apposta, `macro_menu_id` resta perché è l'aggancio che servirà agli acquisti, su test le macro ci sono e vuota resta solo la produzione.

CONSEGUENZA DA DIRE A CHI GUARDA: finché le macro di menù non vengono create, «Mensile per macro» non mostra numeri — mostra il suo messaggio, che dice dove crearle (Menù → Macro-categorie) e che vanno collegate alle categorie dei drink. Non è un guasto ed è lo stesso comportamento di prima; cambia solo il posto dove si va a crearle, che adesso è il menù e non il magazzino.

**Dove**: `src/lib/macros.js, src/components/InventoryManager.jsx, src/components/StatsTab.jsx` · **Lo dimostrano**: `tests/unit/macroStats.test.js`, `tests/component/MacroCategoryManager.test.jsx`

#### REQ-MAG-014 — Le scorte dicono anche quello che ti ritrovi a fine serata

A metà serata, sui tavoli, ci sono drink già fatti e conti non ancora chiusi: quel gin è promesso anche se il magazzino non l'ha ancora scalato. Accanto alla giacenza c'è una colonna «A fine serata» con quello che resterà se tutti i conti aperti vengono incassati così come sono — perché la domanda vera, quando si guardano le scorte durante il servizio, è «mando qualcuno a prendere una bottiglia?». Si conta appena l'item entra nel conto, e si conta solo quello che il magazzino non ha GIÀ scalato: contare anche le comande già scaricate vorrebbe dire togliere due volte lo stesso drink. Lo scarico vero resta dov'è (comanda presa in carico o riscossione): questa è la parte ancora incerta, non un movimento di magazzino. Non si scrive niente sul database: il numero si rifà ogni volta dai conti aperti. Una prenotazione scritta andrebbe disfatta a ogni riga tolta, a ogni conto annullato o riaperto, e alla prima strada che salta resterebbe un impegno fantasma che nessuno sa più togliere. La colonna sparisce quando non c'è niente in ballo — cassa chiusa, o nessun conto aperto che chieda quel prodotto — invece di ripetere la giacenza che si legge accanto.

**Dove**: `src/lib/impegnato.js, src/components/InventoryManager.jsx` · **Lo dimostrano**: `tests/unit/impegnato.test.js`, `tests/component/InventoryManager.test.jsx`

#### REQ-MAG-013 — I numeri del magazzino si scrivono come li si pensa

Nel modulo di un prodotto, il contenuto per confezione e la soglia di avviso hanno accanto la scelta dell'unità. Il contenuto si scrive «0,7 l» com'è stampato sull'etichetta, invece di 700 su un articolo contato in ml; la soglia si scrive in PEZZI — «avvisami quando resta una bottiglia» — che è il modo in cui la domanda si fa al banco, e non in 700 ml. Le opzioni sono solo quelle che hanno senso per come si conta l'articolo (litri, cl, ml per un liquido; kg e grammi per un peso), più i pezzi sulla soglia. Il valore salvato non cambia: cambia come lo si digita, e la conversione è la stessa che usa lo scarico dalla ricetta — altrimenti la soglia direbbe una cosa e il magazzino un'altra.

**Dove**: `src/components/InventoryManager.jsx, src/lib/inventory.js` · **Lo dimostrano**: `tests/unit/inventory.test.js`

#### REQ-MAG-011 — In magazzino si contano i pezzi, con la virgola

La colonna delle scorte dice quanti PEZZI ci sono, decimali compresi: una bottiglia da 100 cl con dentro 50 cl è «0,5 pz»; due piene da 50 cl e una a cui mancano 10 cl fanno «2,8 pz». Prima si leggeva «3 bott.», che dice quante bottiglie si toccano e non quanto prodotto c'è dentro: tre bottiglie di cui una quasi vuota contavano come tre, e per sapere se bastavano per la serata bisognava aprire il dettaglio. Gli articoli già contati a pezzo (le bibite) dicono il loro numero. Accanto NON si scrive più «piena / aperta 46 cl / esaurito»: col conteggio a pezzi quello stato è già nel numero — «0,5 pz» dice da sé che è mezza, «0 pz» che è finita — e ripeterlo era una didascalia. Nel dettaglio restano le bottiglie — piene, aperta, finite — che servono a chi va a contarle sullo scaffale. La parola in tutta l'app è MAGAZZINO, non «Inventario»: è come lo chiama chi ci lavora. Gli identificativi interni (il tab `inventario`, la collezione `inventory_items`) restano, che cambiarli vorrebbe dire migrare dati e indirizzi per un nome.

LE UNITÀ RESTANO COERENTI: il pezzo è la bottiglia, il contenuto si misura sempre in cl/ml (o g/mg), mai in pezzi — si leggeva «1 aperta (40 pz) · 1 conf. = 200 pz». La scala è cartone → pezzi → contenuto: caricando, dicendo quanti pezzi ha un cartone i pezzi si riempiono da sé (2 × 24 = 48); chi carica bottiglie sfuse lascia il cartone da parte e scrive i pezzi. Non tutti i prodotti arrivano in cartone, quindi il cartone non è un dato del prodotto: è un modo di contare al momento del carico. Un prodotto si può DUPLICARE, fra Modifica ed Elimina: il magazzino è pieno di quasi-uguali — stessa bottiglia in due formati, lo stesso amaro di un altro fornitore — e rifarli da zero vuol dire ribattere costo, confezione, categoria, soglia e IVA. La copia nasce con la giacenza a ZERO (è un prodotto che non è mai entrato in magazzino) e apre subito la scheda, perché il nome «(copia)» va cambiato. I NUMERI SI SCRIVONO COME SI LEGGONO: due decimali al massimo e la virgola, mai il numero grezzo del calcolo — sulla card del Campari si leggeva «7.49000000001 pz». E sotto al numero grande dei pezzi ci va il CONTENUTO in cl (o in g), che è quello che serve a chi sta versando: per gli articoli contati a pezzo ripeteva lo stesso dato di sopra. Il dettaglio aperto STA DENTRO LA CARD: etichetta sopra e valore sotto, perché la griglia a due colonne della vista a Lista, dentro una card stretta, lascia al valore una colonna larga un dito e manda il testo a capo a fisarmonica. Vale anche per la fila dei tasti in fondo (modifica, duplica, elimina): le colonne si stringono e vanno a capo da sé secondo la larghezza della CARD e non della finestra — una @media non vedrebbe mai una card stretta su un monitor grande — e nel caso peggiore la parola si tronca invece di sfondare il bordo. Nella vista a Lista, dove lo spazio c'è, non cambia niente.

CONFERMATO (18/08, ore 15:17 — Flavio chiedeva a voce che la scala cartone → pezzi → contenuto valesse anche per il PREZZO): c'è già, dentro il form del prodotto (`InventoryManager.jsx`), dove il «cartone» si chiama COLLO. Si scrive «Totale collo (€, netto)» e il costo unitario si ricava dividendo per i pezzi del collo (`colloTot / p`); si legge anche il totale +IVA, per confrontarlo con quello del fornitore. Dal costo al pezzo discende il costo al cl (`costPerCl`, mostrato da `UnitPrice`) come per ogni altro prodotto. Nessun lavoro da fare qui: annotato perché la parola detta a voce («cartone») non è quella del codice («collo»), e cercandola con quella non si trova.

**Dove**: `src/lib/inventory.js, src/components/InventoryManager.jsx` · **Lo dimostrano**: `tests/unit/inventory.test.js`, `tests/component/InventoryManager.test.jsx`

#### REQ-MAG-009 — Macro-categorie: il magazzino letto per famiglie

Le categorie di magazzino si raggruppano in macro-categorie (distillati, birre, bibite…): servono a leggere consumi, valore e margini per famiglia invece che articolo per articolo, e a capire dove se ne va il denaro.

**Dove**: `src/lib/macros.js, src/lib/macroStats.js, src/components/MacroCategoryManager.jsx` · **Lo dimostrano**: `tests/unit/macros.test.js`, `tests/unit/macroStats.test.js`

#### REQ-MAG-024 — Il consumo a settimana si divide per le settimane vere

COSA FA IL FOGLIO (INV.xlsx, verificato). Ogni conta è un foglio con l'intervallo nel nome («07-06 01-07») e, per riga: DEP (giacenza iniziale), ACQ (comprato nel periodo), RIM (contato alla fine), CONS = DEP + ACQ − RIM, CONS/w, prezzo netto, prezzo ivato, VALORE € = RIM × prezzo, costo al cl, costo alla porzione (prezzo / (cl × 0,34)).

IL CONSUMO A SETTIMANA È DIVISO PER UNA COSTANTE, non per le settimane vere del periodo: nei primi due fogli è «÷ 3», poi «÷ 2» per cinque fogli, poi «÷ 1,5» per quindici, poi «÷ 4» negli ultimi nove. Il divisore lo si aggiorna a mano ogni tanto, e nel frattempo sbaglia di quanto è lontano dalla realtà: «16-02 02-04» sono sei settimane e vengono divise per 4, «07-06 01-07» sono tre settimane e mezzo e vengono divise per 4 anche loro. È il numero su cui si decide quanto ordinare (REQ-MAG-023), quindi l'errore non resta dov'è.

COSA FA L'APP: `stockCountCompute` calcola DEP + ACQ − RIM e la valorizzazione (REQ-MAG-005), ma non calcola nessun consumo a settimana — quella colonna non esiste. PROPOSTA. Il consumo per settimana si ricava dai GIORNI VERI fra due conte, che l'app conosce perché le conte hanno una data: consumo / giorni × 7. Nessun divisore da tenere aggiornato, e nessun modo di sbagliarlo dimenticandosene. Dove le conte sono meno di due, o troppo vicine per dire qualcosa, il numero non si mostra invece di mostrarne uno finto: un consumo inventato manda a ordinare merce che non serve.

NON DIPENDE DA NIENTE: le conte hanno già la loro data e `stockCountCompute` calcola già il consumo del periodo — qui si aggiunge una divisione e una colonna. Si può partire subito, ed è il pezzo che serve prima di REQ-MAG-023.

FATTO (19/08). `giorniDiConta` e `consumoSettimanale` (src/lib/warehouse.js) fanno la divisione sui giorni veri; `stockCountCompute` porta `cons_week` su ogni riga e `giorni` sul risultato. Nella conta APERTA il periodo arriva ad adesso e si allunga mentre la si compila; nel dettaglio di una conta CHIUSA i giorni sono quelli fra apertura e chiusura, e il numero si ricalcola dalle date — le conte vecchie un consumo settimanale salvato non l'hanno mai avuto.

SOTTO UN GIORNO PIENO NON SI DIVIDE: una conta aperta e chiusa in tre ore darebbe un settimanale di otto volte quello vero, e su quel numero si decide quanto ordinare. Il numero non si mostra invece di mostrarne uno finto. E SI ARROTONDA: 1500 / 14 × 7 in virgola mobile fa 749,9999999999999, e chi scrive le quantità non riconosce più i 75 cl tondi — lo stesso consumo finirebbe scritto in due modi diversi in due schermate.

**Dove**: `src/lib/warehouse.js stockCountCompute, src/components/InventoryManager.jsx` · **Lo dimostrano**: `tests/unit/warehouse.test.js`, `tests/component/StockCountPanel.test.jsx`

### Cassa di serata e statistiche

La serata vista dai numeri: incassi, chiusura, statistiche, conti del locale.

#### REQ-CASSA-001 — La giornata di lavoro finisce dopo la mezzanotte

La serata appartiene al proprio giorno anche dopo la mezzanotte, fino all'ora di taglio configurata: un drink servito all'una di notte è della serata precedente. L'ora di taglio è un'impostazione (0 = giorno solare).

**Dove**: `src/lib/businessDay.js` · **Lo dimostrano**: `tests/unit/businessDay.test.js`

#### REQ-CASSA-002 — Apertura e chiusura cassa, con fondo e conteggio

La cassa si apre con un fondo e si chiude con il riepilogo della serata: incassato per metodo e per ora, conti chiusi, conti ancora da incassare. Senza cassa aperta non si battono ordini.

**Dove**: `src/lib/cassa.js, src/components/CashFlow.jsx` · **Lo dimostrano**: `tests/unit/cassa.test.js`

#### REQ-CASSA-007 — Il flusso cassa serve DURANTE la serata, non solo alla chiusura

Alla chiusura i numeri sono un verdetto; durante il servizio sono decisioni. La schermata dice, in tempo reale: quanto deve esserci in cassa ADESSO (fondo più i contanti incassati) — prima si sapeva solo alla chiusura, e serve al cambio turno o quando due numeri non tornano; il conto medio, con quanti conti e quanti coperti, e quanto lascia una persona — in un cocktail bar un tavolo da sei e uno da due fanno due serate diverse con lo stesso «conto medio»; chi ha incassato e quanto, perché in una serata si alternano in due o tre alla cassa e se il contante non torna è la prima domanda che ci si fa (l'elenco compare solo se sono stati in più di uno); com'è andata l'ultima ora, non solo la curva della serata: dice come sta andando adesso, se aprire un'altra cassa o mandare qualcuno in pausa. Chi ha incassato è scritto sul pagamento; sui conti battuti prima non c'è e si ripiega su chi ha aperto il conto — meglio un nome vicino al vero che una riga «sconosciuto».

**Dove**: `src/lib/cassa.js, src/components/CashFlow.jsx` · **Lo dimostrano**: `tests/unit/cassa.test.js`

#### REQ-CASSA-008 — La cassa si apre e si chiude dalla coda, ed è cosa del banco

Aprire e chiudere la cassa sono le due cose che si fanno a inizio e fine serata, e si fanno dalla schermata in cui si sta già: nel menu ⋯ della coda c'è «Apri cassa» quando è chiusa e «Chiudi cassa» quando è aperta.

SONO DEL BANCO: alla sala non compaiono affatto — né nel menu né come tasto sul banner della cassa chiusa, dove legge che la deve aprire il banco. Un tasto che risponde «non puoi» è peggio di un tasto che non c'è. Andarle a cercare nel flusso di cassa vuol dire uscire dalla coda proprio mentre la si sta guardando. «Chiudi cassa» è spento per DUE motivi, e lo dice in una riga sola. Il primo è di sempre: finché ci sono conti aperti — un conto aperto è un incasso che manca, e chiudere così vorrebbe dire far quadrare una serata con dentro un buco. Il secondo è arrivato con gli stati del servizio: finché ci sono COMANDE ancora da servire. Un conto può essere già incassato e avere drink al banco — si paga in anticipo tutte le sere — quindi «zero conti aperti» non vuol più dire «niente in ballo», e chiudere lì vorrebbe dire mandare a casa la serata con dei drink pagati e mai usciti. Il conteggio dei ticket lo fa comandeDaServire (coda.js): non serviti, non annullati, dei conti che esistono ancora — e vale solo con gli stati del servizio accesi, perché senza le comande risultano servite alla riscossione. Il motivo è corto e sta sotto il tasto: «Prima chiudi 2 conti», «Prima servi 3 comande», o tutti e due in una riga — «Prima chiudi 2 conti e servi 3 comande». Due frasi incolonnate non si leggono in un'occhiata, e quello che serve capire è «non si chiude, e perché». Acceso, porta al flusso di cassa, dove si conta il contante. «Apri cassa» — dal menu o dal banner della cassa chiusa — apre un box che chiede il fondo, facoltativo perché non tutti lo mettono, con «Apri» e «Annulla». Annulla lascia la cassa chiusa: premere per sbaglio e ritrovarsi una serata aperta col fondo sbagliato si sistema solo chiudendo e riaprendo.

**Dove**: `src/components/ApriCassaBox.jsx, src/pages/BartenderPage.jsx` · **Lo dimostrano**: `tests/component/ApriCassaBox.test.jsx`, `tests/unit/coda.test.js`, `tests/component/CodaCorsie.test.jsx`

#### REQ-CASSA-003 — La carta non finisce mai nei contanti

Il contante atteso in cassa conta solo il contante. Ogni metodo è contato col suo nome, anche uno mai visto prima, e i metodi noti compaiono sempre, pure a zero. Le chiusure vecchie senza metodo indicato restano contate come contanti.

**Dove**: `src/lib/cassa.js` · **Lo dimostrano**: `tests/unit/cassa.test.js`

#### REQ-CASSA-004 — Rendiconto della serata: ordini e prodotti venduti

Il rendiconto mostra gli ordini (in lista o in tabella, apribili nel dettaglio) e il cumulativo per prodotto e categoria, con sconto e guadagno per ordine. I prezzi sono quelli VENDUTI, al netto degli sconti, non il listino.

**Dove**: `src/lib/rendiconto.js, src/components/RendicontoSerata.jsx` · **Lo dimostrano**: `tests/unit/rendiconto.test.js`

#### REQ-CASSA-006 — La cassa è una sola: flusso, lista ordini, chiusure

«Cassa» (prima «Flusso cassa») ha tre sottosezioni nel menu laterale: il FLUSSO della serata in corso, la LISTA ORDINI e le CHIUSURE. Erano tre posti per la stessa domanda — quanto ho incassato — e due si raggiungevano da tasti in fondo alla pagina del flusso, che si trovano solo scorrendo fino in fondo; la lista ordini aveva perfino una voce sua nel menu, accanto alla cassa, come se fosse un altro mestiere. Le TIMBRATURE stanno in Staff, in cima alle ore, non in cassa: erano in fondo alla pagina del flusso — dove ci si va per i soldi — e per battere l'ingresso di chi arriva bisognava passare di lì. Il vecchio indirizzo `?tab=storico` continua a funzionare: porta alla cassa, aperta sulla lista ordini. Sta nei collegamenti salvati e nei messaggi, e non deve finire in una pagina senza nome.

**Dove**: `src/components/CassaTab.jsx, src/lib/sezioni.js` · **Lo dimostrano**: `tests/unit/sezioni.test.js`

#### REQ-CASSA-005 — Statistiche per serata, con tempi e margini

Statistiche per serata: incassi, prodotti più venduti, tempi di preparazione e consegna misurati, preparazione più lunga. I tempi misurati raffinano progressivamente la stima mostrata al cliente.

SI APRONO SULL'ULTIMA CHIUSURA di cassa, e quel periodo sta PRIMA degli altri nella riga: la domanda del mattino dopo è «com'è andata ieri sera», non «com'è andata la settimana». Prima partivano da sette giorni — un'altra domanda — e la serata era in fondo alla riga. Chi sceglie un altro periodo se lo tiene: la preselezione vale solo alla prima apertura. Le due viste (giornaliero e mensile per macro) sono SOTTOSEZIONI della pagina, come in Magazzino e Impostazioni: stanno nel menu invece che in una riga di chip sopra il contenuto, che costava altezza a una schermata già fatta di tabelle.

**Dove**: `src/lib/stats.js, src/lib/eta.js, src/components/StatsTab.jsx` · **Lo dimostrano**: `tests/unit/stats.test.js`, `tests/unit/eta.test.js`, `tests/component/StatsTab.test.jsx`

#### REQ-CASSA-009 — Bilancio → Venduto × Incassato: la tabella trasloca, con le due incidenze

COSA FA IL FOGLIO (verificato: «ANALISI DATI.xlsx» → foglio «RAPPORTI ACQUISTI 2026»). Quattro blocchi — DISTILLATI, BIRRE + BIBITE, VINO, FOOD + MOKA — dodici colonne di mese più una colonna TOT. Le formule vere, lette con le formule e non coi valori, sono queste:

ACQUISTI e FATTURATO NON SONO CALCOLATI, sono numeri battuti a mano e nessuna formula li lega a nessun altro foglio;

UTILE GENERATO = FATTURATO − ACQUISTI;

RAPPORTO FAT/ACQ = FATTURATO / ACQUISTI;

INCIDENZA SOMMA UTILI = utile della macro / somma degli utili delle quattro macro in quel mese;

ACQ TOT, UTILE TOT, FATT TOT = somma delle quattro macro del mese;

INCIDENZA ANNO = fatturato totale del mese / fatturato totale dell'anno (una riga sola, sotto i totali, non per macro); la colonna TOT di ogni riga è la somma dei dodici mesi.

QUANTO DISTA DALLA TABELLA CHE C'È GIÀ («Statistiche → Mensile per macro», REQ-MAG-015). Tre righe su sei hanno già il loro posto:

FATTURATO sta a «Incassato», UTILE GENERATO a «Margine», RAPPORTO FAT/ACQ a «Inc-Costo», e la colonna TOT dell'anno c'è per ogni macro. Ne mancano due, ed è tutto quello che manca su questo fronte: l'INCIDENZA SOMMA UTILI (quanto pesa una macro sul margine del mese) e l'INCIDENZA ANNO (quanto pesa un mese sull'incassato dell'anno). La riga ACQUISTI è un'altra domanda e vive per conto suo, in REQ-MAG-022.

PROPOSTA, poi CONFERMATA il 19/08 insieme al trasloco (vedi in fondo). Nella tabella mensile per macro, due percentuali in più: sulla riga di ogni macro, quanto pesa il suo margine sul margine di tutte le macro in quel mese; sotto i totali, quanto pesa l'incassato del mese sull'incassato dell'anno mostrato. Sono due divisioni su numeri che la tabella ha già in mano: non servono altri dati.

DA SAPERE, e da dire a chi guarda, perché i due fogli non torneranno mai identici: il foglio confronta il fatturato con la merce ENTRATA e lavora al LORDO dell'IVA; la tabella dell'app confronta l'incassato col COSTO DEL VENDUTO e lavora al NETTO su tutti e due i lati (REQ-MAG-015). Le percentuali quindi si somigliano, i valori assoluti no.

DECISO (19/08, dall'utente che riporta Flavio):

QUESTA TABELLA CAMBIA CASA. Non sta più nelle Statistiche — che restano col solo Giornaliero, e le guarda chi lavora — ma nella pagina «Bilancio» (REQ-CASSA-010), dove stanno i conti del locale e che vede il solo admin. Lì si chiama «Venduto × Incassato», accanto alle altre due sottosezioni: «Mesi» (REQ-CASSA-011) e «Acquisti × Fatturato» (REQ-MAG-022).

IL TRASLOCO È UN CAMBIO DI POSTO, NON DI CONTENUTO: quello che la tabella calcola oggi — incassato, costo del venduto, margine, inc-costo, per macro di MENÙ, con la regola decisa il 18/08 e scritta in REQ-MAG-015 — non si tocca. Le due incidenze descritte qui sopra restano le uniche due righe che le mancano, e traslocano con lei.

DIDASCALIE, come su tutta la pagina (REQ-CASSA-010): margine, inc-costo e le due incidenze si spiegano sotto la tabella, in parole da banco. E lì va detta anche la differenza col foglio — l'app confronta l'incassato col costo del VENDUTO, al netto dell'IVA su tutti e due i lati, il foglio confronta il fatturato con la merce ENTRATA al lordo — perché è la prima cosa che si chiede chi mette i due numeri accanto.

PERCHÉ SI SPOSTA: quanto ha reso ogni macro è una domanda da conti di fine mese, non da serata. Chi apre le Statistiche vuole sapere com'è andata ieri, chi apre il Bilancio com'è andato il mese — due mestieri diversi, anche se i numeri escono dalla stessa cassa.

DIPENDE DA REQ-CASSA-010: il trasloco ha bisogno della pagina «Bilancio» dove andare, quindi si fa dopo — o nello stesso giro. Le due incidenze invece non dipendono da niente: sono due divisioni su numeri che la tabella ha già in mano, e si possono aggiungere anche prima.

FATTO (19/08). La tabella sta in Bilancio → Venduto × Incassato e le Statistiche sono rimaste col solo Giornaliero — e senza l'elenco delle sottosezioni, che con una sezione sola non ha niente da far scegliere. Il calcolo non è stato toccato: sono arrivate le due incidenze (`incidenza` su ogni cella di macro, `incidenzaAnno` sulle celle dei totali, in `macroMonthlyReport`) e le didascalie sotto la tabella, compresa quella che dice perché col foglio di Flavio non torna.

DOVE IL TOTALE NON È POSITIVO NON SI DIVIDE: un mese in perdita non ha una quota di margine da spartire, e la percentuale che ne uscirebbe — un −340%, un infinito — si legge come vera pur non volendo dire niente. Resta un trattino.

**Dove**: `src/lib/macroStats.js, src/components/MacroMonthlyTab.jsx, src/components/BilancioTab.jsx (nuovo)` · **Lo dimostrano**: `tests/unit/macroStats.test.js`, `tests/component/MacroMonthlyTab.test.jsx`, `tests/component/StatsTab.test.jsx`

#### REQ-CASSA-010 — «Bilancio»: i conti del locale hanno una pagina loro, e la vede solo l'admin

DECISO (19/08, dall'utente che riporta Flavio). Nasce una pagina «Bilancio» nel menu laterale, e la vede SOLO l'admin. Dentro ci stanno i conti del locale — quello che Flavio teneva su ANALISI DATI.xlsx — e sono un'altra cosa dalle STATISTICHE, che restano dove sono col solo Giornaliero e le guarda chi lavora.

PERCHÉ SEPARATE: incassi, stipendi, spese e netto del mese sono i conti di chi il locale lo paga; quanto ci mette un drink a uscire e cosa si è venduto ieri sera sono il lavoro di chi sta al banco. Oggi stanno nella stessa pagina solo perché sono tutti e due «numeri», e non è un motivo.

TRE SOTTOSEZIONI, nel menu laterale rientrate sotto la pagina aperta, come vuole docs/navigazione.md — le sottosezioni stanno nel menu, non in una riga di schede sopra il contenuto, che su una schermata fatta di tabelle costa altezza tutto il giorno: «Mesi» (REQ-CASSA-011), «Acquisti × Fatturato» (REQ-MAG-022) e «Venduto × Incassato» (REQ-CASSA-009, che trasloca qui dalle Statistiche). I RUOLI SI CONFRONTANO CON `src/lib/ruoli.js`, e qui serve `isAdmin`. Attenzione a dove: oggi il menu si costruisce da `NAV_GESTIONALE` (src/lib/sezioni.js) e lo filtra `isGestore` in StaffDrawer.jsx, che tiene dentro anche il bartender — «Bilancio» è la prima voce che vuole un filtro più stretto. Va tolta di lì, non nascosta dentro la pagina: una pagina che si apre e poi dice «non puoi» si è già fatta vedere.

DA DEFINIRE IN IMPLEMENTAZIONE: dopo il trasloco le Statistiche restano con una sottosezione sola (Giornaliero), e una pagina con una sezione sola non ha niente da far scegliere. L'elenco si toglie invece di lasciarne una spuntata da sé.

OGNI TABELLA HA LA SUA DIDASCALIA, e vale per tutte e tre le sottosezioni:

SENZA DIDASCALIE LA SCHERMATA NON È FINITA (deciso dall'utente il 19/08). Una tabella di conti è piena di parole che a chi non fa il contabile non dicono niente — utile, rapporto fat/acq, incidenza, prime cost, costo del venduto — e qui vale la regola di sempre: si spiega a chi ha in mano un vassoio, parole comuni, niente gergo. Sotto o accanto a ogni tabella e a ogni riga di sintesi va una frase corta che dica CHE NUMERO È e DA DOVE VIENE. Il tono (sono proposte, non testi definitivi): «Utile: quello che resta dopo aver pagato la merce»; «Rapporto: quante volte rientra quello che hai speso»; «Incidenza: quanto pesa questa macro sull'utile del mese»; «Prime cost: merce versata + personale, in centesimi per ogni euro incassato». E DOVE UN NUMERO HA UN'AVVERTENZA che cambia come si legge — gli acquisti che partono da oggi e non hanno storico 2026, il lordo e il netto commutabili, il costo del venduto calcolato dalle ricette che non torna col foglio — l'avvertenza sta LÌ, nella didascalia, sotto il numero a cui si riferisce. Non in un manuale, non in una nota a fondo pagina: chi guarda un totale che non torna deve trovare il perché nel punto in cui se lo chiede.

NON DIPENDE DA NIENTE, ed è il contenitore: finché la pagina non esiste le tre sottosezioni non hanno dove stare. Si parte da qui.

FATTO (19/08). La pagina c'è, con le sue tre sottosezioni nel menu («Mesi», «Acquisti × Fatturato», «Venduto × Incassato») e la didascalia di ognuna già scritta: le TABELLE arrivano con le voci loro (REQ-CASSA-011, REQ-MAG-022, REQ-CASSA-009), qui c'è il posto dove andranno e le parole con cui si leggeranno. COM'È RISOLTO IL PERMESSO: le voci del menu portano, dove serve, la funzione di `ruoli.js` che dice chi le vede (`isAdmin` per il Bilancio), e il filtro sta in `lib/sezioni.js` — `vociPerRuolo` per il menu, `sezioneConsentita` per l'indirizzo. Il filtro è uno solo perché il menu non è l'unico che deve saperlo: `?tab=bilancio` si batte a mano, e un bartender che ci arriva finisce sulla coda con l'indirizzo rimesso in pari, senza una schermata che si apre per dirgli «non puoi».

**Dove**: `src/lib/sezioni.js, src/components/StaffDrawer.jsx, src/lib/ruoli.js, src/components/BilancioTab.jsx (nuovo)` · **Lo dimostrano**: `tests/component/BilancioTab.test.jsx`, `tests/unit/sezioni.test.js`, `tests/component/StaffDrawer.test.jsx`

### Stampa

La stampante termica al banco: comande, scontrini, chiusure di cassa.

#### REQ-STAMPA-001 — Comanda al banco e scontrino al cliente

Si stampa la comanda in lavorazione (con dentro le aggiunte appena fatte) e lo scontrino non fiscale del conto, con i metodi di pagamento davvero usati. Entrambe possono essere automatiche.

IL LOGO IN CIMA è un di più: se non si carica, la carta esce lo stesso — uno scontrino senza logo è ancora uno scontrino, uno scontrino che non esce è un cliente che aspetta. E si tenta UNA VOLTA SOLA per sessione (BUG-032): prima ogni stampa rifaceva il caricamento e aspettava l'errore, e la carta usciva dopo ogni volta.

**Dove**: `src/lib/printer.js` · **Lo dimostrano**: `tests/unit/logoScontrino.test.js`

#### REQ-STAMPA-002 — La stampante non deve smettere di funzionare a metà serata

La connessione alla stampante viene tenuta viva e ricontrollata quando l'app torna in primo piano: non si deve uscire dal programma per farla ripartire.

**Dove**: `src/lib/printer.js` · ⚠️ **Nessun test lo verifica.**

#### REQ-STAMPA-005 — Sullo scontrino il metodo si legge per esteso

Sullo scontrino e sulla chiusura di cassa i metodi di pagamento si scrivono per esteso e con le stesse parole: «Carta di credito», non «Carta». A fine serata la striscia degli scontrini si divide per metodo a colpo d'occhio, e «Carta» e «Contante» si somigliano abbastanza da doverli leggere uno per uno. I nomi stanno in un posto solo, senza emoji (la testina stampa caratteri, non icone): due parole diverse per la stessa cosa costringono a tradurre a mente mentre si contano i soldi. Un metodo sconosciuto resta «Non indicato», mai un ripiego su «Contante».

**Dove**: `src/lib/orderStatus.js, src/lib/printer.js` · **Lo dimostrano**: `tests/unit/orderStatus.test.js`

#### REQ-STAMPA-004 — Chiusura di cassa stampata con tutti i metodi

Lo scontrino di chiusura riporta gli incassi divisi per metodo di pagamento, elencando quelli davvero usati e non un elenco fisso.

**Dove**: `src/lib/printer.js` · ⚠️ **Nessun test lo verifica.**

#### REQ-STAMPA-009 — In locale la stampante è di carta finta

Sull'ambiente di sviluppo la stampante non c'è — è un apparecchio sulla rete del locale — e ogni modifica a comande e scontrini si provava a occhio nel codice, o andando al bar. In locale l'app parla con una stampante finta che raccoglie le righe e le apre nella finestra di stampa del browser, da cui si salva in PDF: si prova quello che ESCE, che è la domanda vera («questa comanda si legge?»).

SOLO IN LOCALE, e questo è il punto: sull'ambiente di TEST resta la stampante vera, perché è lì che si prova il collegamento — certificato, rete, riconnessione — e chi prova le funzioni sul test la vuole collegata davvero. Il segnale è il server di sviluppo, la build «locale» o gli emulatori: se il database è finto, lo è anche il bar. Si può forzare nei due versi con VITE_STAMPANTE_FINTA.

**Dove**: `src/lib/stampanteFinta.js, src/lib/printer.js` · **Lo dimostrano**: `tests/unit/stampanteFinta.test.js`

#### REQ-STAMPA-006 — Lo staff di sala stampa le comande degli ordini che prende

Chi è in sala prende ordini dal menù, e la comanda di quell'ordine deve uscire. Prima non usciva niente: si sperava che al banco qualcuno tenesse aperta la coda con la stampa automatica accesa: se quella schermata non era aperta, l'ordine restava solo a schermo. L'IP il telefono ce l'ha già — la configurazione della stampante è condivisa e ogni dispositivo la riceve dal server (subscribePrinterConfig in App.jsx) — quindi a mancare era solo l'ordine di stampare. Ora l'ordine preso in sala stampa la sua comanda dal telefono che l'ha preso, salvo che il locale abbia scelto il rimbalzo (REQ-STAMPA-008). La stampa non si aspetta: l'ordine è salvato comunque, e se la stampa non parte lo dice il pallino nella coda (REQ-STAMPA-007). Resta da fare una volta, su ogni telefono, l'accettazione del certificato della stampante: è REQ-STAMPA-003.

**Dove**: `src/pages/MenuPage.jsx, src/lib/printer.js` · **Lo dimostrano**: `tests/component/MenuPage.test.jsx`

#### REQ-STAMPA-007 — Un pallino dice se la comanda uscirà, prima di averne bisogno

Nella coda ordini, per chiunque la guardi — banco e sala — un pallino dice se la stampante risponde: verde esce, rosso adesso non uscirebbe, bianco qui non c'è nessuna stampante impostata. Non è una stampa di prova: è la stessa stretta di mano che farebbe la comanda, senza carta. Si controlla ogni mezzo minuto finché qualcuno lo guarda e appena si torna sull'app — è lì che si scopre caduta l'eccezione del certificato, non a metà servizio. Toccandolo si legge il motivo e la strada per rimetterlo a posto; a chi è in sala non si dice di andare nelle impostazioni, che non ha. Una stretta di mano sola anche se a chiederla sono in tre: la stampante ne regge poche.

**Dove**: `src/lib/statoStampante.js, src/components/PallinoStampante.jsx, src/pages/BartenderPage.jsx` · **Lo dimostrano**: `tests/unit/statoStampante.test.js`, `tests/component/PallinoStampante.test.jsx`

#### REQ-STAMPA-010 — Le impostazioni della stampante sono del dispositivo e di chi ci lavora

Indirizzo della stampante, stampa automatica di comande e scontrini, dati del locale sullo scontrino: stanno nel dispositivo — l'indirizzo dipende da dove sei, il tablet del banco la raggiunge e il telefono della sala forse no — e sono di chi è collegato, perché sullo stesso tablet si alternano persone diverse e la stampa automatica la vuole accesa chi sta al banco, non chi passa a battere due conti. Chi entra per la prima volta su un dispositivo eredita le impostazioni che quel dispositivo aveva: al passaggio nessuno si è ritrovato senza stampante a servizio iniziato. Da lì in poi la scheda è sua. Conseguenza da sapere: su un ambiente diverso (test, produzione) la memoria è un'altra, e la stampante va impostata una volta anche lì.

**Dove**: `src/lib/printer.js, src/App.jsx` · **Lo dimostrano**: `tests/unit/impostazioniStampante.test.js`

#### REQ-STAMPA-008 — Il locale sceglie chi stampa le comande della sala

In Impostazioni → Stampante si sceglie, sul terminale del banco, fra due modi (le impostazioni sono del dispositivo e di chi ci lavora: REQ-STAMPA-010): «la stampa il telefono», cioè chi prende l'ordine al tavolo stampa dal suo, e «la stampa il banco», cioè la comanda esce al bancone all'arrivo dell'ordine. Di partenza stampa il telefono, anche per le configurazioni salvate prima che la scelta esistesse. Scegliendo il banco con la stampa automatica spenta non stamperebbe nessuno: l'impostazione lo dice, invece di lasciarlo scoprire a servizio iniziato. E col rimbalzo il pallino della sala non finge di sapere: dice che a stampare è il banco.

**Dove**: `src/components/PrinterSetup.jsx, src/lib/printer.js` · **Lo dimostrano**: `tests/component/MenuPage.test.jsx`, `tests/unit/statoStampante.test.js`

### Vista cliente

Quello che vede il cliente: vetrina, menù, stato del suo ordine.

#### REQ-CLI-001 — Il cliente ordina dal telefono e segue il suo ordine

Dal menù il cliente compone e invia l'ordine, poi vede lo stato della sua comanda con la stima di attesa; può modificarlo o annullarlo finché non entra in preparazione.

**Dove**: `src/pages/MenuPage.jsx, src/pages/OrderStatusPage.jsx` · **Lo dimostrano**: `tests/component/OrderStatusPage.test.jsx`

#### REQ-CLI-002 — Chi apre un ordine vede la schermata giusta

Admin e bartender aprono il dettaglio in stile POS, per lavorarci; staff di sala e clienti vedono lo stato. Con l'arrivo del ruolo admin questo controllo era rimasto indietro e chi stava al banco si trovava la schermata del cliente.

**Dove**: `src/pages/OrderStatusPage.jsx` · **Lo dimostrano**: `tests/component/OrderStatusPage.test.jsx`

#### REQ-CLI-003 — Stima di attesa onesta

La stima parte da un tempo base configurato e si raffina con i tempi realmente misurati; tiene conto di quanti ordini ci sono davanti e se il servizio è al tavolo o al banco.

**Dove**: `src/lib/eta.js` · **Lo dimostrano**: `tests/unit/eta.test.js`

#### REQ-CLI-004 — Ordinare solo se si è nel locale (facoltativo)

Si può richiedere che il cliente sia dentro un raggio dal locale per ordinare: raggio configurabile, minimo 10 metri, default 150.

**Dove**: `src/lib/geo.js` · **Lo dimostrano**: `tests/unit/geo.test.js`

#### REQ-CLI-005 — La vetrina e il menù si adattano allo schermo

Il menù occupa tutta la larghezza del dispositivo; nella vetrina marchio e nome stanno sulla stessa riga e il riquadro cresce col contenuto, senza tagliare il logo. Sul telefono "I miei ordini" e "Accedi" stanno su una riga sotto la barra, sempre presente, così non compaiono a caricamento avvenuto spostando la pagina.

**Dove**: `src/pages/LandingPage.jsx, src/index.css` · ⚠️ **Nessun test lo verifica.**

#### REQ-CLI-006 — Il cliente sa che il suo drink è pronto da ritirare

Chiesto dall'utente il 18/08. Su un conto da RITIRO, quando la comanda passa a «pronto» il cliente va avvisato: da lì in poi la palla è sua — deve alzarsi e venire al banco. Sul servizio al tavolo non serve: ci pensa chi porta il vassoio.

PARTE DA SOLA, al passaggio di stato: non è un tasto che qualcuno deve ricordarsi di premere.

TRE STRADE, e non si escludono: chi ha ordinato dal telefono segue l'ordine con la pagina del QR (c'è già) e riceve la notifica se ha dato il permesso; chi ha ordinato al banco non ha né l'una né l'altra, e per lui c'è il TABELLONE «stiamo servendo» (già in Impostazioni → Menù clienti) coi numeri pronti al ritiro, mentre il numero del conto è già stampato sullo scontrino.

DA VERIFICARE PRIMA DI SCRIVERE: cosa fa già la pagina di stato, come il cliente viene registrato per le notifiche, e se serve un deploy delle Cloud Functions — che va chiesto, non deciso.

DETTAGLI CHE FANNO LA DIFFERENZA: una volta sola per comanda (se qualcuno riporta indietro lo stato e lo rimette «pronto», il cliente non deve ricevere due squilli); senza permesso alle notifiche l'avviso non arriva e la pagina col QR resta la strada che funziona sempre; con gli stati di servizio spenti quel passaggio non esiste, e va detto cosa succede invece di lasciare il caso scoperto.

VERIFICATO PRIMA DI SCRIVERE (19/08). L'avviso al cliente c'era già: decideOrderPush manda «🔔 Il tuo drink è pronto!» quando una comanda di un conto `service_mode: 'banco'` passa a «pronto», e parte da sola dal trigger notifyOrderUpdate. Il token si aggancia al conto dalla pagina di stato («🔔 Avvisami quando è pronto», o da solo se il permesso c'era già e si è scansionato il QR). Mancavano i tre dettagli, e uno era una promessa falsa.

FATTO COSI'.

1) UNA VOLTA SOLA PER COMANDA: si guardava se le comande pronte erano AUMENTATE, e una comanda riportata indietro e rimessa pronta faceva risalire il conteggio — secondo squillo per un drink già in mano, e al secondo non si crede più al primo. Ora si guardano gli IDENTIFICATIVI: il messaggio dice quali comande annuncia (`msg.comande`) e il trigger le segna sull'ordine (`pronto_avvisate`, arrayUnion, solo dopo un invio riuscito). Quella scrittura fa ripartire il trigger, che con le comande ormai segnate non manda più niente: si ferma da sé.

2) SENZA PERMESSO ALLE NOTIFICHE non c'è token e non parte niente: resta la pagina del QR, che si aggiorna da sola, e ora lo DICE invece di lasciar aspettare uno squillo che non arriva.

3) COL SERVIZIO AL TAVOLO il tasto «Avvisami quando è pronto» non compare più: la push non è mai partita per quel modo, e il tasto prometteva una cosa che non succedeva — peggio di nessun tasto, che la volta dopo non ci si fida più dell'app. Al suo posto la verità: «te lo portiamo al tavolo».

4) CON GLI STATI DI SERVIZIO SPENTI nessuna comanda arriva mai a «pronto»: non è un caso scoperto, è che non c'è niente da annunciare — chi batte l'ordine lo prepara e lo consegna sul momento. La pagina lo dice («ritira al banco quando il drink è pronto») invece di offrire un tasto muto.

IL TABELLONE «stiamo servendo» resta la terza strada, per chi ha ordinato al banco: c'è già e non è stato toccato.

DEPLOY DELLE CLOUD FUNCTIONS NON AUTORIZZATO. Il punto 1 vive in functions/ e resta INEFFICACE in produzione finché non si deploya: fino ad allora l'avviso continua a partire sul passaggio di stato, cioè come prima — nessuna regressione, ma il doppio squillo resta possibile. Stesso caso di BUG-036, mergiato da giorni e ancora senza effetto in produzione per lo stesso motivo. I punti 2, 3 e 4 sono lato sito e vanno in produzione col normale rilascio.

**Dove**: `src/lib/push-core.js, functions/index.js, src/pages/OrderStatusPage.jsx, src/pages/MenuPage.jsx` · **Lo dimostrano**: `tests/unit/push-comande.test.js`, `tests/component/OrderStatusPage.test.jsx`

### Notifiche

Le notifiche push: a chi arrivano, quando, e quando invece non devono arrivare.

#### REQ-NOTIF-001 — Il cliente sa quando il suo drink è pronto

Quando una comanda passa a pronto, al cliente arriva una notifica; idem quando il suo ordine viene annullato, con la frase scelta da chi lo annulla.

**Dove**: `functions/lib/push-core.js decideOrderPush` · **Lo dimostrano**: `tests/bdd/notify-order.test.js`

#### REQ-NOTIF-002 — Il banco sa quando arriva un ordine nuovo

Un ordine nuovo — o un'aggiunta a un conto esistente — avvisa il banco. Avvisa quello che prima non c'era: si guardano QUALI comande sono da fare («ricevuto» o «in preparazione»), non quante. Un ordine battuto al POS nasce già in preparazione — chi lo batte sta facendo il drink — e guardando i soli «ricevuto» non risultava mai nuovo in coda: al banco non arrivava niente. Contarle non basterebbe: col cliente che ordina e gli stati accesi, «ricevuto» e «in preparazione» sono due momenti diversi — arriva l'ordine, poi qualcuno lo prende in mano — e un totale che non cambia non distingue «è avanzata quella di prima» da «ne è arrivata una nuova». Con gli identificativi, l'arrivo avvisa e l'avanzamento no: quella comanda il banco la conosce già, ed è il banco stesso ad averla presa in mano. Un conto fermo in attesa del pagamento obbligatorio entra in coda quando è saldato: lì è nuovo per il banco anche se le comande sono le stesse. A restare senza avviso è SOLO il dispositivo da cui è partito: sa già di averlo mandato. Non si guarda il ruolo: prima si buttava via l'avviso di ogni ordine battuto da un admin o da un bartender, dando per scontato che chi ha quel ruolo stia al banco — e chi gira ai tavoli col telefono, con un account da gestore, non faceva squillare niente a nessuno. I token push sono UNO PER DISPOSITIVO (`staff_tokens/<device>`), non per persona: prima lo stesso account su tablet e telefono si sovrascriveva la riga a vicenda e l'avviso arrivava solo all'ultimo che aveva aperto il gestionale — al banco, il tablet muto. Se lo stesso token compare due volte (la riga vecchia intestata alla persona e quella nuova al dispositivo) si avvisa una volta sola. Chi lavora può vedere se su QUESTO schermo gli avvisi arrivano: aprendo la campanella lo dice, e dove serve offre di attivarli. Su iPhone e iPad la push di sistema esiste solo con l'app installata sulla schermata Home, e questo va detto invece di lasciare pensare a un guasto. Il terminale viaggia con l'ordine (`placed_by.device`) e col token push del dispositivo; chi si è registrato prima che il dispositivo venisse segnato viene avvisato lo stesso — un avviso in più si chiude, uno in meno è un drink che non parte.

**Dove**: `functions/lib/push-core.js decideNewOrderStaffPush` · **Lo dimostrano**: `tests/bdd/notify-order.test.js`, `tests/unit/push-comande.test.js`

#### REQ-NOTIF-003 — Un drink pronto avvisa chi lo deve portare

Quando una comanda passa a «pronto» l'avviso parte verso TUTTI i terminali registrati, tranne quello che ha appena premuto il tasto (`avanzamento_device` sul conto): chi l'ha premuto sa già, tutti gli altri no.

NON SI SMISTA PER RUOLO. Questa voce diceva «avvisa la sala, non il banco», e la regola era scritta come un filtro sul campo `role` dei token: ma quel campo non era il ruolo della persona, era il nome della schermata che aveva registrato il dispositivo — sempre la coda, sempre 'bartender'. Non era 'staff' mai nessuno, e l'avviso non partiva più a nessuno (BUG-036). Chi porta i drink non è un ruolo: è chi in quel momento è in piedi.

VALE ANCHE PER IL RITIRO al banco, che prima usciva subito dando per scontato che ci pensasse il cliente: al cliente la push arriva solo se ha ordinato dal menù, e un conto battuto al POS non ha nessun token. Le due parole sono diverse perché sono due gesti diversi: «da servire» al tavolo, «da consegnare» al banco. Il service worker la mostra sempre, tranne quando il gestionale è DAVVERO sotto gli occhi — visibile, non solo «a fuoco»: il fuoco resta alla finestra anche a schermo spento, e un tablet lasciato aperto sulla coda si mangiava l'avviso.

**Dove**: `functions/lib/push-core.js, functions/index.js, public/sw.js` · **Lo dimostrano**: `tests/bdd/notify-staff-call.test.js`, `tests/unit/serviceWorkerAvvisi.test.js`

#### REQ-NOTIF-004 — Avvisi e storico stanno nel profilo, non nelle impostazioni del locale

Quali avvisi arrivare e lo storico di quelli arrivati stanno nel PROFILO di chi è collegato. La scelta è per persona e per dispositivo (`tana:avvisi:<uid>`), non una regola del locale: lo stesso account sul tablet della cassa e sul telefono in sala vuole cose diverse, e due che si passano il tablet nel cambio turno non si sovrascrivono niente. Nelle impostazioni del locale — dove stavano — non entra chi è in sala, cioè proprio chi ha più bisogno di sapere quando un drink è pronto: lì gli avvisi erano fuori portata per chi li usa. In Impostazioni → Notifiche resta un cartello che porta al profilo. Lo storico è lo STESSO elenco della campanella, non una copia: svuotarlo di qua lo svuota anche di là, e le notifiche ancora da leggere non si buttano insieme alle altre. Da leggere e già lette compaiono insieme, nell'ordine in cui sono arrivate; quelle già lette sbiadiscono e quelle con una destinazione restano porte. Attenzione a cosa è di chi: gli INTERRUTTORI sono per persona e dispositivo, lo STORICO è del dispositivo (`tana:notifs`, senza uid) — sono gli avvisi arrivati su quello schermo, e chi prende il turno dopo li vede. È voluto: servono a ricostruire cos'è successo qui, non a chi era collegato.

**Dove**: `src/pages/StaffProfilePage.jsx, src/components/AvvisiPanel.jsx, src/components/StoricoNotifiche.jsx` · **Lo dimostrano**: `tests/component/StoricoNotifiche.test.jsx`, `tests/component/AvvisiPanel.test.jsx`

### Avvisi a schermo

I messaggi a schermo dentro l’app — quelli che si leggono col vassoio in mano.

#### REQ-AVVISI-005 — Dove compaiono gli avvisi ad app aperta, lo sceglie il locale

Due modi, in Impostazioni → Notifiche: «in alto, su ogni schermata» — la strisciolina di sempre: non si perde, ma interrompe chiunque, anche chi sta contando la cassa o caricando il magazzino; «dalla campanella, solo in coda» — un fumetto che esce dalla campanella e compare SOLO nella coda ordini, che è il posto dove gli ordini si aspettano: lì un avviso non interrompe niente, è la ragione per cui si sta guardando quella schermata. Il fumetto sparisce da sé dopo qualche secondo — è un richiamo, non una finestra da chiudere — e toccandolo si aprono gli avvisi, perché chi lo tocca vuole vedere cos'è successo. Fuori dalla coda non compare niente: gli avvisi restano nella campanella, col loro conto. Di suo resta la strisciolina, che è come ha sempre funzionato. Un valore sconosciuto ricade lì: meglio la strisciolina di un avviso che non compare da nessuna parte. La scelta sta nel PROFILO, accanto a «quali avvisi ricevere»: è della stessa natura — vale per QUESTO dispositivo — e quello è il posto dove chi lavora li va a cercare. Nelle impostazioni del locale nessuno cercherebbe una cosa sua, e chi è in sala quel menu non ce l'ha nemmeno.

**Dove**: `src/lib/avvisiInApp.js, src/components/FumettoAvvisi.jsx, src/lib/notify.js` · **Lo dimostrano**: `tests/unit/avvisiInApp.test.js`, `tests/component/FumettoAvvisi.test.jsx`, `tests/component/AvvisiPanel.test.jsx`

#### REQ-AVVISI-004 — Uscendo si spengono gli avvisi, rientrando si riaccendono

Il token push è del DISPOSITIVO, non della persona, e dopo il logout restava valido: chi si era scollegato continuava a sentire suonare gli ordini del locale sul telefono di casa. Uscendo, quel dispositivo viene tolto dai destinatari; al primo accesso successivo si registra da sé, senza aspettare che si passi dalla coda. Se non ci riesce — offline, regole — si esce lo stesso: restare dentro sarebbe peggio, e il token scade da solo. E non ci si impianta aspettando: timbratura e rubrica sono scritture su Firestore, e una scrittura offline non torna mai — passati due secondi e mezzo si esce comunque.

NON BASTA LA RUBRICA: si spegne il TOKEN. `staff_tokens` è solo l'elenco dello staff; il token è del browser e resta valido, e gli avvisi al cliente («il tuo drink è pronto», «ordine annullato») lo tengono scritto sull'ORDINE, non nell'elenco. Chi si era scollegato continuava a sentire suonare il telefono. Uscendo si cancella il token: non resta nessun indirizzo a cui bussare, chiunque sia il mittente. Vale anche per il cliente che esce, e per «Esci e accedi come staff», che passava dal signOut secco e non toglieva niente. E QUANDO GLI AVVISI SONO SPENTI SI VEDE. Il permesso lo chiede il browser una volta sola, con una finestrella in alto che chi sta lavorando scarta senza leggerla: da quel momento quel tablet non suona più, e nessuno se ne accorge finché non manca un ordine. Una riga in cima lo dice su ogni schermata del gestionale, con il tasto per attivarli; rifiutando ricompare — non c'è «non mostrare più», perché è proprio il rifiuto per sbaglio il caso da coprire. Se il browser li ha bloccati del tutto, l'app non può più chiedere: si spiega dove riaccenderli invece di mostrare un tasto che non farebbe niente. Non è una finestra modale: al banco non si blocca il lavoro per una impostazione.

**Dove**: `src/lib/logout.js, src/lib/push.js, src/lib/customerAuth.js, src/lib/api.js, src/App.jsx, src/components/AvvisiSpenti.jsx` · **Lo dimostrano**: `tests/unit/logoutAvvisi.test.js`, `tests/component/AvvisiSpenti.test.jsx`

### Persone: ruoli, utenze, ore

Chi può fare cosa, chi è al banco, quante ore ha fatto e quanto prende.

#### REQ-STAFF-001 — Quattro ruoli: admin, bartender, staff, cliente

L'admin fa tutto quello che fa il bartender e in più nomina i ruoli; il bartender ha il gestionale completo; lo staff di sala lavora sulla stessa coda del banco e vede cosa c'è da servire, senza le sezioni amministrative; il cliente il menù e i propri ordini. Il ruolo vive nei claim del token e le regole del database guardano quello.

**Dove**: `src/lib/ruoli.js, firestore.rules` · **Lo dimostrano**: `tests/unit/ruoli.test.js`, `tests/unit/utenze.test.js`

#### REQ-STAFF-002 — I confronti sui ruoli si fanno in un posto solo

Nessun confronto diretto tipo `role === 'bartender'` sparso per il codice: si passa dalle funzioni di ruoli.js. Aggiungendo "admin" erano rimasti indietro cinque confronti e l'admin si vedeva la schermata del cliente. Un test scandaglia il codice e boccia i confronti diretti.

**Dove**: `src/lib/ruoli.js` · **Lo dimostrano**: `tests/unit/ruoli.test.js`

#### REQ-STAFF-003 — Pagina utenti: nominare i ruoli senza riga di comando

L'admin vede il personale e i clienti registrati dal sito, e da lì assegna i ruoli, crea account, sospende o elimina. Il bartender consulta l'elenco e usa il cerca-persone, ma non tocca i ruoli. L'ultimo admin non si può togliere di mezzo, e nessuno può cambiare il ruolo a sé stesso.

**Dove**: `src/components/UtentiTab.jsx, functions/lib/staff-service.js` · **Lo dimostrano**: `tests/unit/utenze.test.js`, `tests/component/UtentiTab.test.jsx`

#### REQ-STAFF-004 — Il ruolo si aggiorna da solo, senza aspettare la scadenza

Il ruolo vive dentro il token, che dura un'ora: chi era collegato quando gli è cambiato il ruolo continuava a girare col vecchio, con permessi negati sparsi in giro. Il gestionale mostra subito quello che ha in tasca e in sottofondo ne chiede sempre uno fresco.

**Dove**: `src/pages/BartenderPage.jsx` · ⚠️ **Nessun test lo verifica.**

#### REQ-STAFF-005 — Registrazione cliente e account personali

Il cliente si registra con nome, cognome, data di nascita, email e password, o entra con Google; riceve l'email di verifica e ritrova i propri ordini. Gli account clienti si possono spegnere da un'impostazione.

**Dove**: `src/pages/AccountPages.jsx, src/lib/customerAuth.js` · ⚠️ **Nessun test lo verifica.**

#### REQ-STAFF-006 — Turni, ore lavorate e paghe

Si registrano turni programmati e ore effettive (anche da timbratura), per giorno, settimana o mese, col costo del personale calcolato sulla tariffa in vigore quel giorno. I turni si assegnano scegliendo un membro dello staff, non digitando un nome.

**Dove**: `src/components/StaffHoursTab.jsx, src/lib/ore.js, src/lib/paghe.js` · **Lo dimostrano**: `tests/unit/ore.test.js`, `tests/unit/paghe.test.js`, `tests/component/StaffHoursTab.test.jsx`

#### REQ-STAFF-007 — Cerca-persone: chiamare un collega dal gestionale

Dal gestionale si chiama un membro dello staff con un messaggio: il suo dispositivo vibra con insistenza finché non risponde.

LA CHIAMATA SI PRESENTA DOVUNQUE si stia guardando — coda, conto, cassa — e c'è già al rientro nell'app: il riquadro è montato in cima (App.jsx), non dentro una sezione. Vale per chiunque sia dello staff, banco o sala. Il pannello si apre dal menu ⋯ della coda, e APERTO APPOSTA non resta mai muto: se non c'è nessun altro da chiamare lo dice, e dice dove si creano gli account. Prima spariva da sé — con un solo account l'elenco è vuoto — e si toccava una voce che non faceva niente, sembrando rotta. Dove il pannello compare da sé invece resta muto: una card «non c'è nessuno» fissa in coda sarebbe rumore.

**Dove**: `src/components/StaffCallList.jsx, src/components/ChiamataInArrivo.jsx, functions/lib/push-core.js` · **Lo dimostrano**: `tests/bdd/notify-staff-call.test.js`, `tests/component/StaffCallList.test.jsx`, `tests/component/ChiamataInArrivo.test.jsx`

#### REQ-STAFF-013 — Per chi lavora, la vista menù serve a battere un ordine

Nella vista menù il personale non vede più i propri ordini attivi in cima: quella schermata, per chi lavora, serve a UNA cosa — prendere un ordine dalla carta com'è fatta per il cliente. Gli ordini stanno in coda, che è un'altra pagina, e vederli anche qui mescolava due mestieri. Al cliente invece restano: è l'unico posto dove ritrova quello che ha ordinato. E in «Da servire» il tasto è «Aggiungi ordine», e porta dove porta il «+» della coda: la schermata del conto, con la griglia. Prima mandava al menù — la vista del cliente — che per prendere un ordine al tavolo è la strada lunga: si scorre una carta fatta per chi ordina, invece della griglia fatta per chi batte.

**Dove**: `src/pages/MenuPage.jsx, src/components/ServiceQueue.jsx` · **Lo dimostrano**: `tests/component/MenuPage.test.jsx`

#### REQ-STAFF-008 — La sala lavora sulla stessa coda del banco

La home dello staff di sala è la coda ordini, identica a quella del gestionale: quello che vede il banco lo vede anche chi porta i vassoi. Prima la sala aveva due pagine sue («Da servire» e «I miei ordini») e non vedeva mai la coda vera. «I miei ordini» non è più una pagina: è il filtro «Miei» della coda, che tiene solo i conti con la propria firma (placed_by) — e il vecchio indirizzo ?tab=miei-ordini ci arriva col filtro già acceso. «Da servire» resta come sezione. Le sezioni amministrative restano ai gestori: per la sala un tab non suo riporta alla coda. Dal menu laterale la sala apre «Nuovo ordine dal menù» (il menù che mostra al tavolo, con la ricerca), non il POS del banco.

**Dove**: `src/pages/BartenderPage.jsx, src/lib/sezioni.js, src/lib/coda.js` · **Lo dimostrano**: `tests/unit/coda.test.js`, `tests/component/StaffDrawer.test.jsx`

#### REQ-STAFF-014 — La sala serve, non prepara: gli stati delle comande non li tocca

Chiesto dall'utente il 19/08. Chi sta in sala VEDE a che punto sono le preparazioni — gli serve per sapere cosa portare — ma non le comanda: l'unico passo che può segnare è «servito», perché è lui a portare il drink al tavolo. Tutto il resto (prendere in carico, segnare pronto, tornare indietro, dividere una comanda, annullarla) è del banco.

SUGLI ORDINI invece la sala lavora: può aggiornare un conto — aggiungere righe, cambiare quantità — e quelle modifiche generano una NUOVA comanda, che il banco vedrà arrivare nella sua coda. Non tocca le comande esistenti: quelle sono il lavoro di chi versa.

DOVE VA SCRITTA la regola: in `src/lib/ruoli.js`, insieme alle altre — c'è un test che boccia i confronti di ruolo sparsi nel codice. E vale anche lato server (`firestore.rules`): un permesso che esiste solo nell'interfaccia non è un permesso. FATTO. In `ruoli.js`: `puoSegnare` (alla sala solo «servito»), `puoGestireComande` (tornare indietro, dividere, annullare, riscrivere una comanda già mandata) e `aggiunteInComandaNuova` (quello che la sala aggiunge nasce come comanda a sé, anche col «+» su una riga già confermata). Le due prime sono scritte al contrario — «non è la sala» — apposta: spengono dei tasti mentre il ruolo torna dal server, e spegnerli per un istante al banco vuol dire premere a vuoto.

LATO SERVER `firestore.rules` nega alla sala le due cose che il database sa vedere da sé: portare un conto ad «annullato» e far scendere il numero delle comande.

PERCHÉ LÌ CI SI FERMA, e non è pigrizia — questa è la parte che altrimenti il prossimo rifà da capo. Il controllo fine («ha solo aggiunto una comanda in fondo», «ha solo portato quella comanda da pronto a servito») è un confronto fra due array ELEMENTO PER ELEMENTO, e le regole Firestore non hanno cicli: l'unica strada sarebbe srotolare gli indici a mano — `dopo[0:n] == prima`, più un ramo per ogni posizione possibile — con un tetto arbitrario al numero di comande oltre il quale alla sala verrebbe rifiutato il lavoro buono. E soprattutto quel confronto NON REGGE come lavora l'app: `leggiOrdine` (api.js) legge il documento DALLA CACHE e riscrive l'array `comande` per intero, perché Firestore un array lo riscrive tutto — non esiste un percorso `comande.2.status`. Basta che la cache del terminale sia indietro di un battito, o che la normalizzazione (`normalizeOrderDoc`) completi un campo mancante su una comanda vecchia, e il prefisso non combacia più: il server rifiuterebbe una scrittura giusta. Al banco vuol dire un ordine che non parte, che è un danno peggiore del permesso che quella regola chiuderebbe.

SE UN GIORNO SERVE DAVVERO, la strada non è una regola più furba: è spostare l'avanzamento di stato dietro una Cloud Function (Admin SDK), che legge il documento fresco e applica la sola transizione consentita a chi chiama. Avvertenza: un deploy delle Functions lo autorizza l'utente, non noi. (BUG-040 sembrava chiedere la stessa medicina e invece no: quello si è curato spostando il MOMENTO dello scarico, non aggiungendo una macchina — vedi REQ-MAG-003.) Le regole si compilano con l'emulatore Firestore (`firebase emulators:exec --only firestore`): non c'è un test automatico che le esegua, `@firebase/rules-unit-testing` non è fra le dipendenze e non è stato aggiunto per questo.

**Dove**: `src/lib/ruoli.js, src/pages/BartenderPage.jsx, src/components/ComandaDetail.jsx, src/components/OrderPosDetail.jsx, firestore.rules` · **Lo dimostrano**: `tests/unit/ruoli.test.js`, `tests/unit/coda.test.js`, `tests/component/OrderPosDetail.test.jsx`, `tests/component/CodaCorsie.test.jsx`

### Sicurezza

Regole di accesso, App Check, e cosa protegge cosa.

#### REQ-SIC-001 — Le regole del database seguono i ruoli

Menù, impostazioni e ordini sono a lettura libera (servono al cliente); cassa, magazzino, gruppi, ore e fatture sono riservati al personale; le paghe e la gestione utenti all'admin. Nessuno può cancellare incassi o sessioni di cassa dall'app.

**Dove**: `firestore.rules` · **Lo dimostrano**: `tests/unit/utenze.test.js`

#### REQ-SIC-002 — App Check protegge la produzione senza chiudere fuori il locale

In produzione le richieste devono portare un gettone reCAPTCHA valido. Va acceso solo quando i gettoni non validi sono a zero, perché acceso di traverso blocca tutto — anche il menù, che è pubblico. Su test resta spento.

**Dove**: `scripts/appcheck.js, scripts/recaptcha-domini.js` · ⚠️ **Nessun test lo verifica.**

### Si lavora anche senza rete

Cosa continua a funzionare quando la rete non c’è, e come lo si vede.

#### REQ-OFFLINE-001 — Nessuna schermata aspetta il server

Tutte le scritture partono in sottofondo con lo stato di avanzamento visibile: in corso, sincronizzato, errore. In errore si può ripetere l'ultima modifica o tutte. Con la rete che va e viene il servizio non si ferma.

**Dove**: `src/lib/sync.js` · **Lo dimostrano**: `tests/unit/incassoOffline.test.js`, `tests/unit/toast.test.js`

#### REQ-OFFLINE-002 — La coda si apre subito, dalla cache

Gli ordini compaiono dalla copia locale senza aspettare il server, e vengono allineati appena il server risponde; il dato del server non viene ricoperto da una cache che arriva tardi. Senza cache non si inventa niente: si aspetta.

**Dove**: `src/lib/api.js subscribeActiveOrders` · **Lo dimostrano**: `tests/unit/codaCache.test.js`

#### REQ-OFFLINE-003 — Si vede quando si è offline

Un nastro avvisa che si è senza rete e che si può continuare a lavorare; la campanella mostra lo stato della sincronizzazione solo quando ha qualcosa da dire.

**Dove**: `src/App.jsx, src/components/StatusBell.jsx` · ⚠️ **Nessun test lo verifica.**

#### REQ-OFFLINE-004 — L'app avvisa quando c'è una versione nuova

La PWA resta aperta per giorni: l'app confronta la propria build con quella pubblicata e propone di aggiornare. Offline non dà falsi allarmi.

**Dove**: `src/lib/appVersion.js` · **Lo dimostrano**: `tests/unit/appVersion.test.js`

### Dati e ambienti

Il modello dei dati, gli ambienti (test e produzione) e il modo di travasarli.

#### REQ-DATI-001 — Backup ed esportazione di tutto il database

Si scarica in un file tutto quello che c'è nel database e lo si rimette da un file. Un file non valido viene rifiutato PRIMA di scrivere; l'import riscrive quello che il file contiene e non cancella il resto; oltre il limite di un lotto si spezza senza perdere righe.

**Dove**: `src/lib/backup.js, src/components/BackupPanel.jsx, scripts/backup-db.js` · **Lo dimostrano**: `tests/unit/backup.test.js`

#### REQ-DATI-002 — Travaso e ripristino da riga di comando

Gli script sanno rispecchiare un ambiente su un altro, migrare il solo catalogo rispettando lo storico di chi lo riceve, e ripristinare un backup. Tutti mostrano un'anteprima e scrivono solo con --apply; la produzione va indicata a mano.

**Dove**: `scripts/specchia-db.js, scripts/ripristina-db.js, scripts/migra-in-produzione.js` · ⚠️ **Nessun test lo verifica.**

### Integrazione SumUp

Il dialogo con il terminale SumUp, dalle Cloud Functions.

#### REQ-SUMUP-CONFIG-001 — Le functions SumUp sono no-op se non configurate

Se SUMUP_VENDOR_ID o SUMUP_OUTLET_ID non sono impostati, tutte le callable (syncSumUpProducts, createSumUpSale, updateSumUpSaleStatus) devono ritornare un esito { skipped: true } senza effettuare alcuna chiamata di rete verso SumUp né scritture su Firestore.

**Dove**: `functions/index.js isSumUpConfigured, functions/lib/sumup-service.js` · **Lo dimostrano**: `TC-SYNC-001`, `TC-SALE-001`, `TC-STATUS-001`

#### REQ-SUMUP-SYNC-001 — Sincronizzazione catalogo SumUp → Firestore drinks

syncSumUpProducts scarica il catalogo da GET /products e aggiorna la collezione `drinks`. I prodotti già presenti (identificati da sumup_product_id) vengono aggiornati; i nuovi vengono creati con un timestamp created_at. Ritorna { synced, total }.

**Dove**: `functions/index.js syncSumUpProducts, functions/lib/sumup-service.js syncProducts` · **Lo dimostrano**: `TC-SYNC-002`, `TC-SYNC-003`, `TC-SYNC-004`, `tests/bdd/sync-products.test.js`

#### REQ-SUMUP-SYNC-002 — Normalizzazione robusta della risposta prodotti SumUp

La risposta di /products può essere un array diretto o un oggetto con chiave "products"/"items"; input nullo o non valido produce zero prodotti. Ogni prodotto viene mappato sui campi drink (name, price numerico, category, description, available) con fallback sui nomi di campo alternativi; i prodotti privi di id vengono saltati. available è true salvo p.active===false o p.available===false.

**Dove**: `functions/lib/sumup-core.js extractProducts, mapProductToDrink` · **Lo dimostrano**: `TC-CORE-001`, `TC-CORE-002`, `TC-CORE-003`

#### REQ-SUMUP-SALE-001 — Invio ordine a SumUp come External Sale

createSumUpSale costruisce il payload External Sale dall'ordine (customer_name derivato dal tavolo, note, sale_items con product_id/quantity/unit_price e total_price arrotondato a 2 decimali) e lo invia in POST a /external_sales. Se la vendita ha un id e l'ordine ha un orderId, persiste sumup_sale_id sull'ordine Firestore. Ritorna { saleId }.

**Dove**: `functions/index.js createSumUpSale, functions/lib/sumup-service.js createSale` · **Lo dimostrano**: `TC-SALE-002`, `TC-SALE-003`, `TC-CORE-004`, `tests/bdd/create-sale.test.js`, `tests/unit/sumup-core.test.js`

#### REQ-SUMUP-STATUS-001 — Aggiornamento stato vendita su SumUp

updateSumUpSaleStatus invia in PUT a /external_sales/{saleId}/status il nuovo stato. Se saleId è assente ritorna { skipped: true, reason } senza chiamare SumUp. Ritorna { updated: true } in caso di successo.

**Dove**: `functions/index.js updateSumUpSaleStatus, functions/lib/sumup-service.js updateSaleStatus` · **Lo dimostrano**: `TC-STATUS-002`, `TC-STATUS-003`, `tests/bdd/update-sale-status.test.js`

#### REQ-SUMUP-WEBHOOK-001 — Webhook SumUp → aggiornamento stato ordine Firestore

sumupWebhook accetta solo richieste POST (altrimenti 405). Estrae sale_id (o id) e status dal corpo; senza sale_id risponde 400. Mappa lo stato SumUp su quello Tana Drink (ACCEPTED→in_preparazione, COMPLETED/CANCELLED→ritirato); stati non mappati rispondono 200 OK senza modifiche. Per stati mappati aggiorna lo status dell'ordine con sumup_sale_id corrispondente, rispondendo sempre 200 OK.

**Dove**: `functions/index.js sumupWebhook, functions/lib/sumup-service.js handleWebhook` · **Lo dimostrano**: `TC-HOOK-001`, `TC-HOOK-002`, `TC-HOOK-003`, `TC-HOOK-004`, `TC-HOOK-005`, `tests/bdd/webhook.test.js`

### Interfaccia

Le regole dell’interfaccia: tema, navigazione, spazi, cosa si vede e cosa si toglie.

#### REQ-UI-015 — Staff e Utenti hanno tre sezioni, come le altre pagine

Staff: calendario, timbrature, nuovo turno, paghe orarie. Utenti e ruoli: utenze registrate, nuovo account, buoni VIP. Erano pannelli a scomparsa in cima alla pagina: aprirli spingeva giù quello che si era venuti a guardare — il calendario, l'elenco delle utenze — e per tornarci bisognava richiuderli. Nel menu laterale costano zero e si raggiungono da qualsiasi punto della pagina. Chi non è amministratore, in Utenti, ha solo l'elenco: le altre due non sono cose sue.

**Dove**: `src/components/StaffHoursTab.jsx, src/components/UtentiTab.jsx` · **Lo dimostrano**: `tests/component/UtentiTab.test.jsx`, `tests/component/StaffHoursTab.test.jsx`

#### REQ-UI-016 — Le attese si vedono, e dicono cosa stanno aspettando

Dove l'app deve aspettare — l'accesso, la cassa, il listino, la ricerca nello storico — c'è un'attesa animata con scritto CHE COSA si sta aspettando. Una scritta ferma su una pagina vuota non si distingue da un'app piantata: chi guarda non sa se aspettare o ricaricare. Non c'è una percentuale: non si sa quanto ci vuole, e una barra che si ferma a metà è peggio del silenzio. Chi ha chiesto meno animazioni vede i pallini respirare invece di saltare.

**Dove**: `src/components/Caricamento.jsx` · **Lo dimostrano**: `tests/component/Caricamento.test.jsx`

#### REQ-UI-017 — La password si può guardare

Accanto a ogni campo password — accesso del banco, accesso e registrazione dei clienti, cambio password nel profilo, conferma per eliminare l'account — c'è l'occhio che la mostra. Al banco si entra da un tablet, spesso con le mani bagnate e una tastiera a schermo che sbaglia da sola: scritta a pallini, davanti a un «credenziali errate» non si sa se è sbagliata la password o una lettera partita male. Parte sempre COPERTA: al bancone c'è sempre qualcuno dietro le spalle, e mostrarla dev'essere una scelta, non la condizione di partenza. L'occhio sta fuori dal giro del tabulatore: chi compila con la tastiera passa dalla password al tasto «entra», non da un interruttore in mezzo.

**Dove**: `src/components/CampoPassword.jsx` · **Lo dimostrano**: `tests/component/CampoPassword.test.jsx`

#### REQ-UI-018 — Le righe del conto si riordinano come le card della griglia

Nel dettaglio del conto le righe si spostano trascinandole, con la stessa libreria della griglia dei prodotti: la riga segue il dito e le altre si scansano da sole. Prima era fatto a mano, a lungo-premuto: la riga saltava, le altre no, e capitava di spostarne una mentre si voleva solo toccarla. Si entra in «organizza» come nella griglia — un interruttore che fa comparire le maniglie — e fuori di lì toccare una riga la APRE, che è quello che si fa mille volte a sera. Le righe già pagate non si spostano: stanno in fondo, ferme. E nella coda, aprendo le azioni di una card, cresce SOLO quella: le altre della stessa riga restano come sono e quelle sotto scendono. Prima si allungavano tutte insieme — mezzo schermo di riquadri vuoti per un menu di sei tasti.

**Dove**: `src/components/OrderPosDetail.jsx, src/index.css` · **Lo dimostrano**: `tests/component/OrderPosDetail.test.jsx`

#### REQ-UI-014 — La barra delle sezioni si stringe a icone, o si toglie di mezzo

La barra delle sezioni a sinistra (magazzino, menù, impostazioni) si stringe col tasto in cima e la scelta resta, pagina per pagina. Stringere vuol dire «a icone» — ma solo dove le icone ci sono: se le voci non hanno né icona né colore, come le categorie del magazzino, restava una colonna di pastiglie grigie tutte uguali, brutte e mute, perché non c'era modo di sapere quale fosse quale. Lì le voci si tolgono di mezzo del tutto e resta il solo tasto per rimetterle: le sezioni sono a un clic invece che a un indovinello. Non c'è un modo per farla sparire senza ritorno: il tasto per riaprirla resta sempre visibile, altrimenti si perde l'unico modo di girare fra le sezioni.

**Dove**: `src/components/CategoryRail.jsx, src/index.css` · **Lo dimostrano**: `tests/component/CategoryRail.test.jsx`

#### REQ-UI-019 — Un tema porta anche le forme, e arriva su tutti i colori

Un tema non è una tavolozza. Pico e Catppuccin hanno un MODO di fare le cose — angoli, tasti piatti o col gradiente, ombre — e prendendone solo i colori restava tutto con la faccia della Tana ridipinta: si sceglieva «Pico» e si trovavano i tasti dorati con gli angoli morbidi. Le forme stanno in `FORME` (tre famiglie: tana, catppuccin, pico) e ogni preset dichiara la sua. Sono otto token — raggio di card, bottoni, pillole e campi, fondo del bottone, ombra del bottone e della card, font dei titoli — e OGNI famiglia li dichiara tutti, perché applyTheme scrive sullo stile di :root e un token lasciato indietro resterebbe appiccicato al tema successivo. E il tema arriva dappertutto: l'oro di casa era scritto a mano in una dozzina di posti (il tab acceso, il «+», i tasti dei pannelli, gli aloni del fondo pagina) e quelli ignoravano il tema. Adesso il colore dell'azione è uno solo e viene dai token; il testo sul tasto (`--btn-ink`) si decide dalla luminanza del colore d'azione, perché cablato scuro sarebbe stato nero su nero su un tema con l'azione scura. Un test boccia il dorato riscritto a mano nel foglio di stile. La personalizzazione a mano resta ai soli colori: le forme vengono dal preset.

**Dove**: `src/lib/themes.js, src/index.css, DESIGN.md` · **Lo dimostrano**: `tests/unit/temi.test.js`, `tests/unit/css.test.js`

#### REQ-UI-001 — Le sottosezioni di una pagina stanno sotto il titolo

Quello che si fa ogni tanto (paghe, un turno a mano, le categorie, la marginalità) sta in una fila di tasti subito sotto il titolo, e si apre lì: uno alla volta, e il contenuto si monta solo all'apertura.

**Dove**: `src/components/SectionPanels.jsx` · **Lo dimostrano**: `tests/component/SectionPanels.test.jsx`

#### REQ-UI-002 — Impostazioni in dieci gruppi, coi riquadri impilati

I riquadri delle impostazioni sono più di venti, ma le voci del sottomenu sono DIECI GRUPPI, accorpati per «a cosa afferisce» l'impostazione (Menù e catalogo, Servizio, Cassa e giornata, Prezzi e supplementi…): scegliendo un gruppo i suoi riquadri si impilano uno sotto l'altro, e la scelta si ricorda. Con una voce per riquadro l'elenco era più lungo delle impostazioni; prima ancora era una pagina lunghissima da scorrere a occhio. Da tablet in su la schermata sta TUTTA dentro il viewport: a scorrere sono i due pannelli — l'elenco delle sezioni e il contenuto — ognuno per conto suo, e non la pagina con dentro la testata, che scorrendo via si portava dietro l'elenco proprio mentre lo si usava. L'altezza NON si calcola: la pagina si divide in tre (testata, quello che resta, piè di pagina) e il mezzo si prende quello che avanza. Provando a farla col righello — 100dvh meno la testata, meno il piè di pagina, meno il respiro in fondo — restava fuori ogni volta un pezzo diverso: prima la pagina sforava, poi avanzava un buco sotto. Sul telefono, dove l'elenco passa in orizzontale sopra al contenuto, si scorre come sempre.

**Dove**: `src/components/SettingsTab.jsx` · **Lo dimostrano**: `tests/component/SettingsTab.test.jsx`

#### REQ-UI-003 — Sul telefono la barra ha il tasto, il titolo e due azioni

In barra ci stanno il menu, il logo col nome, la campanella e i tre puntini; tutto il resto sta nel menu dal basso, con bersagli da 44px. Chi è collegato si riconosce dall'iniziale nel quadratino, la stessa che marca gli ordini che ha aperto.

**Dove**: `src/App.jsx, src/components/ActionSheet.jsx` · **Lo dimostrano**: `tests/component/StaffDrawer.test.jsx`, `tests/unit/css.test.js`

#### REQ-UI-004 — Zoom della pagina per chi ci lavora ore

Nella PWA a tutto schermo il browser non offre lo zoom: l'app ha il suo, che scala la pagina senza deformarla. Sul telefono non flotta sull'angolo (dove finiva sopra i tasti) ma sta nella testata del conto. Con un pannello aperto — il foglio dei ⋯, una conferma, il menu laterale — passa dietro e non si lascia toccare: stando in basso a sinistra finiva sopra le ultime voci, e si premeva lo zoom al posto della voce. I tasti compaiono SOLO dove servono: coda ordini, il conto (creazione, apertura, incasso) e flusso cassa — le schermate dove si legge tanta roba fitta stando fermi a guardarla. Altrove sono due tasti flottanti che coprono il contenuto per una cosa che lì nessuno usa: nel magazzino e nelle impostazioni si scorre. Il livello scelto non si azzera cambiando pagina: si smette solo di poterlo cambiare da lì. Al cliente non servono, il suo browser lo zoom ce l'ha.

**Dove**: `src/components/ZoomControl.jsx, src/lib/zoomDove.js` · **Lo dimostrano**: `tests/component/ZoomControl.test.jsx`, `tests/unit/zoomDove.test.js`

#### REQ-UI-005 — Temi chiari e scuri, per il gestionale e per il cliente

Si scelgono due temi distinti: uno per le schermate di lavoro e uno per la vista cliente. I colori di stato restano leggibili su entrambi.

**Dove**: `src/lib/themes.js, src/components/ThemeSettings.jsx` · **Lo dimostrano**: `tests/unit/themes.test.js`, `tests/unit/themes-dom.test.js`

#### REQ-UI-006 — L'app segue chi guarda, non l'indirizzo

La barra in cima è la stessa su ogni schermata — menu, logo col nome e, a destra, chi è collegato — e il menu laterale risponde a tutti: allo staff il gestionale, a chi ordina il suo (menù, i propri ordini, accesso e profilo). Fanno eccezione le due schermate in cui si compone un conto, dove non c'è menu e si esce con «← Ordini». Nelle sezioni del gestionale l'«indietro» sta nella barra, fra il ☰ e il marchio: dentro la pagina si mangiava la prima riga di contenuto. E accanto al marchio c'è il TITOLO della pagina e della SEZIONE che si sta guardando (icona compresa). A cambiare sezione si va nel menu a scomparsa, che sotto la pagina aperta elenca le sue sezioni: un posto solo per navigare, uguale sul telefono e sul computer. Le altre strade non reggono — una colonna o una riga di schede in pagina costano spazio tutto il giorno, le schede in barra reggono cinque voci e non ventidue, una tendina va aperta per sapere cosa c'è dentro. Al posto di un titolo dentro il contenuto: su un tablet al banco una riga in meno di contenuto si vede. Le voci del menu laterale e i titoli sono lo stesso elenco, in un posto solo, se no prima o poi uno dice «Lista ordini» e l'altro «Storico». Sul telefono il titolo sparisce: lì la barra ha già poco spazio. Vale anche per il proprio profilo, dove stava in fondo alla pagina e si chiamava «Torna al gestionale» — lo si trovava solo scorrendo, ed era l'unico a chiamarsi in un altro modo. Nella coda non c'è, perché è la schermata di partenza. Anche i colori seguono il ruolo: chi lavora vede il tema del gestionale ovunque, profilo e accesso compresi; chi ordina vede il suo, e così l'anteprima «vista cliente». Sempre per la stessa ragione, chi è dello staff non passa dalla vetrina: aprendo la home finisce dritto nella lista ordini. Unica eccezione il QR del tavolo (?tavolo= / ?group=), che porta al menù anche se a inquadrarlo è chi sta dietro al banco. E all'inizio della sessione non si finisce mai dentro il POS: se l'app si riapre lì — scheda rimasta aperta, accesso appena fatto — si torna alla lista ordini, perché il POS riprende da sé il conto lasciato in corso e ci si ritroverebbe a battere righe in un conto che non si è scelto. Vale una volta sola, all'avvio: dopo, «Nuovo ordine» e il ➕ portano al POS come sempre.

**Dove**: `src/App.jsx, src/components/ClientDrawer.jsx` · **Lo dimostrano**: `tests/component/AppHeader.test.jsx`, `tests/unit/sezioni.test.js`

#### REQ-UI-007 — La testata della coda sta su una riga sola

Da tablet in su, nella testata della coda titolo, ricerca e ⋯ stanno tutti sulla stessa linea e alti quanto il ☰ (42px), che è fisso e fuori dal flusso; conteggi e legenda degli autori vanno sulla riga sotto. Prima i conteggi stavano dentro il titolo, il titolo cresceva in altezza e ognuno degli altri si centrava a un'altezza diversa. Il ➕ resta invece grande com'era (60px) e sporge dalla riga: è il tasto che si prende di corsa e con le mani occupate, e un bersaglio largo vale più di una riga allineata. Siccome è il ➕ a dare l'altezza alla riga, il ☰ flottante si scosta di 21px dal bordo e non di 12: così il suo centro cade su «In servizio» invece di restare un dito più in alto. Sul telefono la testata resta a due piani — titolo rientrato per fare posto al ☰, ricerca a tutta larghezza — e conteggi e legenda partono dal bordo, allineati alla barra di ricerca che hanno sotto invece di stare sospesi a metà.

**Dove**: `src/pages/BartenderPage.jsx, src/index.css` · ⚠️ **Nessun test lo verifica.**

#### REQ-UI-008 — Dallo schermo intero si esce dallo stesso tasto con cui si entra

Da browser il tasto ⛶ porta a schermo intero e, richiamato, ne fa uscire: vale sia per il tasto in barra sia per la voce nei ⋯ del telefono, che cambiano icona e parole quando si è dentro. Il tasto non compare a chi ha installato l'app, che gira già senza barre — ma "installata" non va confusa con "a schermo intero adesso": il browser risponde di sì a `display-mode: fullscreen` anche quando ci siamo andati noi con l'API, e il tasto per uscire spariva proprio quando serviva. Al banco il tablet è montato e la tastiera non c'è: senza tasto non si esce.

**Dove**: `src/lib/useSchermoIntero.js, src/App.jsx` · **Lo dimostrano**: `tests/component/SchermoIntero.test.jsx`

#### REQ-UI-009 — La ricerca nella coda: filtra, oppure accende il conto e ci porta lì

Cercando nella coda per numero, cliente, tavolo, chi ha battuto o drink si può scegliere fra due comportamenti, in Impostazioni → Coda ordini. «Filtra la coda» lascia in pagina solo i conti che rispondono, come è sempre stato. «Accendi e porta lì» non toglie niente: scorre fino al primo conto che risponde e lo accende con un anello nel colore d'accento, così si vede dov'è rispetto agli altri; toccando un conto qualsiasi la ricerca si azzera da sé. La regola di corrispondenza è una sola per tutti e due i modi, altrimenti cambiando impostazione lo stesso testo troverebbe conti diversi. Se non risponde nessuno lo dice, invece di lasciare la coda apparentemente immobile; e se il conto c'è ma sta in un'altra scheda, dice anche quello.

**Dove**: `src/lib/coda.js, src/pages/BartenderPage.jsx, src/components/SettingsTab.jsx` · **Lo dimostrano**: `tests/unit/coda.test.js`, `tests/component/SettingsTab.test.jsx`

#### REQ-UI-012 — Dove la pagina ha sezioni sue, il menu resta aperto nella pagina

Nelle pagine con sottosezioni (Impostazioni, Inventario) il menu laterale, da 768px in su, non copre il contenuto: è una colonna della pagina e il contenuto si stringe per fargli posto. Dentro l'inventario si salta fra Prodotti e Conta venti volte di seguito, e un menu che copre vuol dire aprirlo, cercare, scegliere — e intanto non vedere più dove si era. Si apre e si chiude col ☰, lo stesso tasto di sempre: niente secondo comando per «agganciarlo», che sarebbe una cosa in più da capire per una differenza che a chi lavora non interessa — il menu c'è o non c'è. La scelta resta anche il giorno dopo. Sulle pagine senza sezioni proprie — la coda ordini — resta a scomparsa: lì sarebbe una colonna in meno di conti. Da dove in su è un conto sulla larghezza che avanza: sul telefono (360-430px) una colonna da 250px è più di metà schermo e il contenuto diventa inutilizzabile, quindi lì resta a scomparsa; da 768px — l'iPad in verticale, il tablet del banco — restano 500px e la scelta ha senso, con la colonna stretta a 200px fino ai 900px. E SI ALLARGA TIRANDO IL BORDO. Le voci sono parole corte, le sottosezioni no — «Marginalità listino» a 178px si taglia — e su un monitor grande quella colonna stretta è spazio sprecato. La maniglia sul bordo destro la porta fra 150 e 360px, doppio clic per tornare alla misura di partenza, e la larghezza scelta resta anche domani. Cresce tutto insieme, testo e icone: una colonna larga con la scritta piccola in mezzo sembra rotta. Il nome che non ci sta va a capo: nel menu non si scorre mai in orizzontale, e la maniglia è una colonna sua fra menu e contenuto — dentro al menu scorreva col contenuto e finiva sotto la barra di scorrimento, e per prenderla bisognava azzeccare due pixel.

**Dove**: `src/components/StaffDrawer.jsx, src/index.css, docs/navigazione.md` · **Lo dimostrano**: `tests/component/StaffDrawer.test.jsx`

#### REQ-UI-011 — La navigazione ha delle regole, e sono scritte

La barra in alto ha tre zone, sempre nello stesso ordine: a sinistra come si esce (☰ oppure ←), al centro dove si è (marchio e titolo, che è anche il comando delle sottosezioni), a destra cosa si può fare (campanella, ⋮). Quando lo spazio manca NON si rimpiccioliscono i tasti — al banco si tocca con le dita bagnate e sotto i 44px si sbaglia — si toglie, in quest'ordine: il nome del locale (sotto i 700px resta il logo), l'«indietro» (sul telefono il ☰ fa quello che fa lui e in più: dalla coda alle impostazioni in un tocco solo), il logo (sotto i 400px). Il titolo della sezione si accorcia coi puntini ma non sparisce mai: è l'unica cosa che dice dove sei; ☰, campanella e ⋮ non cadono mai. Le gerarchie stanno una per volta e ognuna al suo posto: le pagine nel menu laterale, le sottosezioni nel titolo, i filtri in una tendina, e il contenuto non porta navigazione. Niente seconda riga sotto la barra, e un solo modo di tornare indietro per schermata. Le regole stanno in docs/navigazione.md: si seguono invece di ridiscuterle a ogni schermata.

**Dove**: `docs/navigazione.md, src/App.jsx, src/index.css` · ⚠️ **Nessun test lo verifica.**

#### REQ-UI-010 — L'app si chiama come il locale, e dice a chi appartiene

L'app installata si chiama «La Tana del Coniglio», non con la sigla del progetto. A chi lavora il nome porta il suffisso del ruolo — « - admin», « - bartender», « - staff» — così sul telefono l'icona dice di chi è, e chi tiene due profili non li confonde; il cliente, e chi non ha fatto accesso, vede il nome nudo. Il suffisso segue il ruolo di chi è collegato e vale per la linguetta del browser e per il nome proposto all'installazione: il telefono lo congela in quel momento, quindi l'app va installata da collegati col ruolo che serve. Il manifest riscritto porta avvio, ambito e icone per esteso, altrimenti l'app installata partirebbe da nessuna parte.

**Dove**: `src/lib/nomeApp.js, public/manifest.webmanifest` · **Lo dimostrano**: `tests/unit/nomeApp.test.js`

#### REQ-UI-020 — Ogni conto ha il suo colore, e le sue comande lo portano

Chiesto dall'utente il 18/08. Un conto con tre comande sparse in tre colonne diverse non si riconosce a colpo d'occhio: il colore serve a quello. Due cose distinte: 1) un'impostazione del LOCALE che accende i colori automatici: ogni conto nuovo nasce con un colore preso da una tavolozza, e quello è il suo — sta sulla card del conto e su TUTTE le card delle sue comande; 2) il colore si può scegliere A MANO, sempre, che l'automatico sia acceso o spento, e vale anche per i conti nati prima.

VINCOLI: il colore va SCRITTO sul conto, non ricalcolato dall'id — dev'essere lo stesso su ogni terminale e non deve cambiare se domani cambia la tavolozza. E dev'essere leggibile su tutti i temi, chiaro e scuro. Va deciso e scritto chi vince fra colore del conto e colore dello stato, invece di lasciarlo all'ordine delle regole CSS. DOV'E' IL COLORE, precisato dall'utente il 19/08 dopo aver visto la prima versione: «parlavo del colore della card intera, non di un pallino messo li'. Le card devono essere con un colore specifico, magari leggermente trasparente e sfumato». Il primo giro l'aveva messo come pallino da 10px accanto al numero, e non rispondeva alla domanda: questo colore serve da LONTANO — guardando la lavagna mentre si versa — e dieci pixel da lontano non ci sono.

FATTO COSI'. Il colore sta nel campo `colore` del documento ordine, scelto UNA VOLTA alla nascita dal progressivo del conto (resto della divisione per la tavolozza: due conti battuti di fila non sono mai dello stesso colore) e da lì non si ricalcola più — cambiare tavolozza o aggiornare un solo terminale non sposta i colori dei conti già aperti. La tavolozza è quella delle categorie (CATEGORY_PALETTE, dodici tinte): una sola da tenere in pari. L'impostazione del locale `conti_colorati` (Impostazioni → Coda ordini → «Il colore del conto») accende i colori automatici, di suo spenta; il colore a mano si dà dal «⋯ Azioni» della card — sia dalle corsie dei conti sia dal ⋯ della comanda, dove si scrive comunque sul CONTO — e vale anche sui conti nati prima.

CHI VINCE:

LO STATO. La striscia a sinistra resta quella della preparazione, sempre, ed è quella che dice cosa fare adesso — un vocabolario chiuso di sei tinte (arancio da fare, azzurro al banco, verde pronto, grigio uscito, ambra pagato), dove il colore del conto non poteva entrare senza cancellarlo.

IL COLORE DEL CONTO PRENDE IL FONDO DELLA CARD, che era libero: sfumato in diagonale dall'angolo, 16% in alto a sinistra e via via niente. Tenue apposta — dodici tinte sature stese sotto al testo lo renderebbero illeggibile su un tema o sull'altro e coprirebbero l'alone del passo di lavoro. In DIAGONALE perché da sinistra c'è già quell'alone, e due sfumature dallo stesso lato si impastano. Sta sulla card del conto (corsie, griglia e lista) e su tutte le card delle sue comande. E non è mai l'unica cosa che informa: il numero del conto è sulla stessa card.

PER ARRIVARCI il fondo della card e' passato da due `background` che si sovrascrivevano a vicenda a due VARIABILI (`--tinta-stato` e `--conto-colore`) composte in una regola sola: prima vinceva l'ultima regola letta e l'altro segno spariva. Le regole stanno in src/lib/coloriConto.js, che è dove è scritto il perché.

**Dove**: `src/lib/api.js, src/components/CorsieComande.jsx, src/components/CorsieStato.jsx, src/components/SettingsTab.jsx` · **Lo dimostrano**: `tests/unit/coloriConto.test.js`, `tests/component/CodaCorsie.test.jsx`

#### REQ-UI-021 — Tre nomi per lo stesso passo del servizio

Trovato dalla rilettura del diff della 1.5.0. Lo stesso passo si chiama in tre modi a seconda di dove lo si legge: «Pronto» nella tabella del servizio, «Pronto al servizio» nell'etichetta di stato, «Ritiro/Servizio» in testa alla colonna. Chi lavora vede tre parole per una cosa sola, ed è lo stesso guaio — più piccolo — della pastiglia che diceva «Ordine ricevuto» accanto alla colonna «Da fare».

DA DECIDERE, non da semplificare in silenzio: si sceglie la parola e si aggiornano le tabelle e il loro test, oppure si tiene la differenza e si scrive nel commento perché lì serve più corta.

DECISO (19/08): i nomi erano QUATTRO, non tre — c'era anche «È pronto» sul tasto della card. Al banco vince la più corta, «Pronto»: una testata di colonna si legge da lontano mentre si versa, e «Ritiro/Servizio» diceva DOVE VA il drink, che è un'altra domanda e ha già le sue due colonne quando il pronto si divide («Da servire» / «Da ritirare»).

LE PAROLE DEL BANCO STANNO IN UN POSTO SOLO: `statoAlBanco` in orderStatus.js, che c'era già per la stessa ragione («Da fare» contro «Ordine ricevuto»). Adesso ci passano anche la testata della colonna, il tasto della card, le pastiglie di stato sulle card, le linguette per stato e la notifica allo staff.

AL CLIENTE resta «Pronto al servizio» (STATUS_LABELS), ed è voluto: a lui «Pronto» da solo non dice se deve alzarsi o aspettare. Le due lingue restano due, e la differenza è scritta dove si legge.

**Dove**: `src/lib/comande.js, src/lib/orderStatus.js` · **Lo dimostrano**: `tests/unit/paroleDelBanco.test.js`

#### REQ-UI-022 — Le categorie senza macro si vedono a colpo d'occhio, in magazzino e nel menù

DECISO (19/08, dall'utente che riporta Flavio).

ALTRO (magazzino) e BOTTIGLIE (menù) restano SENZA macro, ed è una scelta: non vanno forzate dentro un gruppo per far tornare un elenco. Da lì nasce il bisogno opposto — si deve capire in un attimo quali categorie sono fuori, perché una fuori APPOSTA e una dimenticata oggi si somigliano troppo.

COSA C'È GIÀ, verificato nel codice il 19/08. `groupCategoriesByMacro` (src/lib/macros.js) torna già `unassigned`, e il pannello «🗂 Macro-categorie» — lo stesso per magazzino e menù, MacroCategoryManager.jsx — le scrive in fondo su una riga sola: «Categorie senza macro: …», i nomi separati da virgola. Quindi LÌ IL «SENZA MACRO»

SI VEDE, ma debolmente: è testo piccolo in coda alla schermata, e con venticinque categorie diventa una riga da leggere parola per parola per sapere se la tua c'è dentro.

DOVE NON SI VEDE AFFATTO: negli ELENCHI delle categorie, che sono l'altro posto dove uno le guarda. Magazzino → 🏷 Categorie (InvCategoryManager) mostra il solo nome; Menù → 🏷 Categorie (CategoryManager in MenuManager.jsx) mostra nome, icona e colore. Nessuno dei due dice a quale macro appartiene la categoria, né che non ne ha nessuna — e sono le stesse liste da cui si esce convinti di aver sistemato tutto.

DA FARE: nell'elenco delle categorie, da tutte e due le parti, si legge la macro di ogni categoria e si distingue quella che non ce l'ha.

PROPOSTA sulla forma (non è una sua parola): accanto al nome un'etichetta con la macro, e dove manca due parole — «senza macro» — con lo stesso peso, non un avviso. Non è un errore, e il rosso qui non c'entra: in questa app vuol dire annullato o sbagliato (DESIGN.md).

DA DEFINIRE IN IMPLEMENTAZIONE: se «apposta» sia un segno da mettere sulla categoria (un campo in più, e una spiegazione da scrivere) o basti che l'elenco si legga bene. Il secondo costa zero ma lascia il dubbio ogni volta che qualcuno di nuovo guarda quella lista.

NON DIPENDE DA NIENTE: `groupCategoriesByMacro` torna già `unassigned`, il lavoro sta negli elenchi delle categorie. Piccolo, e utile proprio adesso che le macro si stanno mappando.

FATTO (19/08). In tutti e due gli elenchi — Magazzino → 🏷 Categorie e Menù → 🏷 Categorie — accanto al nome c'è un'etichetta con la macro, e dove non c'è si legge «senza macro» con lo STESSO PESO: niente rosso, niente punto esclamativo. Non è un errore, è un fatto, e chi ha lasciato ALTRO fuori apposta non deve vedersi rimproverare ogni volta che apre la lista. L'unica differenza è il corsivo, che dice «questa è una constatazione, non un nome».

SCELTO IL SECONDO DEI DUE MODI: nessun campo «apposta» sulla categoria. L'elenco che si legge bene costa zero e non chiede a nessuno di compilare niente; il segno esplicito si potrà aggiungere il giorno in cui il dubbio si presenta davvero, e allora sarà una decisione presa su un caso vero invece che su un'ipotesi.

UNA MACRO CANCELLATA VALE COME NESSUNA MACRO, esatto come in `groupCategoriesByMacro`: il `macro_id` resta attaccato alla categoria, ma il gruppo non esiste più.

**Dove**: `src/components/MacroCategoryManager.jsx, src/components/InventoryManager.jsx (InvCategoryManager), src/components/MenuManager.jsx (CategoryManager)` · **Lo dimostrano**: `tests/unit/macros.test.js`, `tests/component/InventoryManager.test.jsx`, `tests/component/MenuManager.test.jsx`

### Come si lavora al progetto

Non è comportamento dell’app: è il metodo con cui la si costruisce.

#### REQ-DEV-001 — I requisiti restano attaccati ai test

Questo elenco dice cosa fa l'app; i test dicono cosa fa davvero. Un test controlla che le due cose non si stacchino: ogni file di test dev'essere citato da almeno un requisito, ogni test citato deve esistere, gli identificativi non si ripetono e non si apre un'issue per qualcosa di già fatto. Chi aggiunge un test senza dire a quale requisito appartiene se ne accorge subito, non fra sei mesi.

**Dove**: `requirements/requirements.yaml, tests/unit/requisiti.test.js` · **Lo dimostrano**: `tests/unit/requisiti.test.js`

#### REQ-DEV-002 — Si sa sempre quale versione si sta guardando

In fondo al menu laterale c'è la versione: in produzione il solo numero, altrove numero, ramo e commit — perché sull'unico ambiente di test passano a turno develop e i branch in lavorazione, e "l'ho provato e non andava" senza sapere cosa era pubblicato non vuol dire niente. Si tocca e si copia.

**Dove**: `src/lib/versione.js, src/components/VersionBadge.jsx, vite.config.js` · **Lo dimostrano**: `tests/unit/versione.test.js`

#### REQ-DEV-003 — Changelog delle versioni, leggibile anche dall'app

Ogni versione rilasciata ha le sue note in CHANGELOG.md, e le stesse note si leggono dentro l'app in Impostazioni → Informazioni, insieme ai dati tecnici (versione, ramo, commit, ambiente, progetto). Chi usa l'app deve poter sapere cosa è cambiato senza chiederlo a chi l'ha scritta. Il NUMERO di versione lo dice package.json, allineato al rilascio, non l'ultimo tag raggiungibile: il tag sta sul merge in main, che non è antenato dei rami di lavoro, e lì `git describe` risaliva al rilascio PRECEDENTE — l'ambiente di test diceva 1.2.0 mentre ci girava la 1.3.0. Un numero sbagliato è peggio di nessun numero: chi segnala un problema dichiara una versione che non è quella che ha davanti. E non deve andarle a cercare: l'app si aggiorna da sé mentre la si usa, e chi lavora si accorge del cambiamento solo perché qualcosa è finito in un altro posto. Toccando «Nuova versione disponibile», alla riapertura compare il BOX con le note di quella versione — una volta sola, poi mai più. Se invece l'aggiornamento arriva da sé (l'app riaperta il giorno dopo) niente box in faccia mentre si lavora: resta una NOTIFICA nella campanella che porta a Impostazioni → Informazioni. Alla prima apertura su un dispositivo nuovo non succede niente: un box di benvenuto con le note di rilascio non lo vuole nessuno.

**Dove**: `CHANGELOG.md, src/components/InfoTab.jsx` · **Lo dimostrano**: `tests/unit/novita.test.js`, `tests/component/AppHeader.test.jsx`, `tests/unit/notifyStore.test.js`

#### REQ-DEV-004 — Il cancello di qualità prima del merge in develop

Il merge in develop passa un cancello, descritto in docs/gitflow.md: requisiti e registro bug aggiornati coi test citati; lint, test e build; la COVERAGE sopra le soglie di vitest.config.mjs — un cricchetto tarato appena sotto il misurato, che si alza quando la copertura cresce e non si abbassa mai per far passare un merge (npm run test:coverage fallisce da solo, e con lui la CI delle pull request); e un giro di refactoring sul diff (riuso, complessità, commenti sul perché) prima di chiedere il merge.

**Dove**: `docs/gitflow.md, vitest.config.mjs, .github/workflows/test.yml` · ⚠️ **Nessun test lo verifica.**

#### REQ-DEV-006 — Le due lavagne a corsie sono lo stesso componente scritto due volte

Trovato da due revisioni indipendenti del diff della 1.5.0. Le viste a corsie dei conti e delle comande condividono, riga per riga: il guscio della colonna, la testata con conteggio e totale, la card dei conti «in arrivo» (22 righe identiche), il bollo dell'acconto e il piede con il ⋯ e il tasto grande. Sono circa 90 righe scritte due volte: oggi una modifica alla testata va fatta in due posti. COME: estrarre `Corsia` (guscio + testata + lista + card in arrivo) e il piede, come si è già fatto con `RigheCorsia`, `PreparazioneParziale` e `ScegliConsegna`, lasciando a ogni file solo il corpo della propria card. NON fondere del tutto i due componenti: una vista lavora sui conti e l'altra sulle comande, e solo quella dei conti ha la colonna della cifra grande. Fonderle cambierebbe comportamento.

FATTO (19/08): il contorno sta in `src/components/Corsia.jsx` — `Lavagna` (quante colonne), `Corsia` (guscio, testata, lista, card dei conti in arrivo), `BolloAcconto`, `PiedeCorsia`, `TastoAzioni`, `TastoCorsia`. Alle due viste resta il corpo della propria card: CorsieStato da 178 righe a 112, CorsieComande da 293 a 226. NON sono state fuse, come diceva la voce. La colonna della cifra grande nel frattempo era già sparita con REQ-DEV-010 (viveva nel ramo morto), ma la ragione resta: un conto e una comanda non sono la stessa cosa, ed è esattamente l'errore che la vista del banco è nata per correggere. L'unica differenza rimasta nella testata — il conteggio (conti di là, comande di qua) — si passa da fuori.

**Dove**: `src/components/CorsieStato.jsx, src/components/CorsieComande.jsx` · **Lo dimostrano**: `tests/component/Corsia.test.jsx`

#### REQ-DEV-007 — La coda ricalcola tutte e tre le viste a ogni disegno, e ne mostra una

Trovato dalla rilettura del diff della 1.5.0, coi numeri. Nel corpo della coda non c'è nessuna memoria fra un disegno e l'altro: griglia, lista e corsie vengono ricalcolate tutte, sempre, e se ne mostra una. Con 120 conti sono circa 18 passate complete sulla lista e 4 ordinamenti a ogni ridisegno — e ridisegnare capita a ogni tasto premuto nella ricerca, a ogni card aperta e a ogni snapshot dal server, che in una serata piena sono centinaia. Nello stesso posto: `contiScheda` viene chiamata sei volte per disegno sulla stessa lista (tre per i conteggi delle schede, due identiche a due righe di distanza), e ognuna è tre filtri in fila. COME: memorizzare le tre catene e smistare le schede una volta sola. Non cambia niente di quello che si vede.

FATTO (19/08), e in un modo diverso da quello scritto qui: ogni catena ha la sua GUARDIA sulla vista che è in pagina, invece di un `useMemo`. Il risultato è lo stesso — si prepara la vista che si guarda, non tutte e quattro — e le schede si smistano in una passata sola con `contiPerScheda` (una divisione della stessa lista: prima erano sei giri di tre filtri per disegno).

PERCHÉ NON `useMemo`: sarebbe stato un hook dopo l'uscita anticipata del caricamento (regola dei hook), e soprattutto le corsie leggono `comandeLocali`, un magazzino locale che cambia SENZA che cambi nessuno degli ingressi che un `useMemo` guarderebbe. Una corsia rimasta indietro al banco costa più di una passata rifatta: chi ha appena avanzato un ticket lo rivedrebbe dov'era. Se un giorno serve davvero la memoria fra un disegno e l'altro, prima va reso osservabile quel magazzino.

**Dove**: `src/pages/BartenderPage.jsx` · **Lo dimostrano**: `tests/unit/schedeCoda.test.js`

#### REQ-DEV-008 — Scritture che rileggono l'ordine per un valore che nessuno guarda

Trovato dalla rilettura del diff della 1.5.0. `advanceComanda`, `preparazioneParziale` e `setOrderServiceMode` rileggono l'ordine dopo aver scritto, per restituirlo — e nessuno dei loro chiamanti (verificati tutti e otto) usa quel valore: gli interessa solo l'eventuale errore. Ogni tocco su una card costa così due letture dello stesso documento invece di una, più una normalizzazione intera buttata via: con ~150 comande a sera sono ~450 letture a vuoto. Nella stessa famiglia: `notifyLowStock([])` legge comunque il localStorage in modo sincrono prima di ciclare su zero elementi. COME: comporre l'esito in memoria da quello che si è appena scritto, o non restituire niente.

FATTO (19/08): non restituiscono niente. Chi tocca una card guarda l'errore, non l'ordine — la schermata si è già aggiornata con la copia locale — e un tocco adesso costa una lettura sola. Nella stessa passata: `notifyLowStock` esce prima se non c'è niente da segnalare (le scorte le annuncia lo scarico quando ha finito davvero), e in `advanceComanda` sono spariti `lowStock`, che nessuno riempiva mai, e `statComanda`, che era l'ordine appena letto messo in una variabile per poi chiedersi se ci fosse.

**Dove**: `src/lib/api.js` · **Lo dimostrano**: `tests/unit/lettureSuUnGesto.test.js`

#### REQ-DEV-009 — Quattro copie del ricalcolo del totale di un conto

Trovato dalla rilettura del diff della 1.5.0. Le stesse cinque righe — aggrega le righe delle comande, somma coperto/servizio/mancia, ricalcola lo sconto — e la stessa scrittura compaiono in quattro funzioni di `api.js`, di cui una aggiunta da questa versione. COME: una funzione privata che salva le comande e ne ricalcola il totale, chiamata dalle quattro.

DA FARE CON CALMA E CON I TEST DAVANTI: è il punto in cui si scrivono i soldi di un conto. Non si tocca a ridosso di un rilascio, ed è il motivo per cui questa voce esiste invece della modifica.

FATTO (19/08) con i test scritti prima: `salvaComandeERifaiTotale` è chiamata dai quattro gesti che riscrivono le comande di un conto aperto — modifica del cliente, aggiunta al conto, divisione di una comanda, modifica dal banco. Una differenza vera fra i quattro c'era, ed è rimasta scritta invece che sparire in un riuso: la modifica del CLIENTE scrive le righe come sono arrivate, perché `aggregateItems` fonde due righe dello stesso drink e con loro se ne andrebbero note e prezzi cambiati a mano. Si passa da un parametro, con scritto perché.

**Dove**: `src/lib/api.js` · **Lo dimostrano**: `tests/unit/totaleDelConto.test.js`

#### REQ-DEV-010 — Metà di «corsie di stato» non la chiama più nessuno

Trovato dalla rilettura del diff della 1.5.0. `corsieDiStato` viene chiamata da un solo punto, con `workflowOn` cablato a `false`: il ramo con i quattro passi del servizio, le sue voci in `AZIONI_CORSIA`, il bollo «pagato ma non servito» sui conti e la classe CSS che lo disegna sono irraggiungibili. A tenerli in vita sono solo i test. Il costo non è lo spazio: i test sono la specifica, e chi legge «Da incassare sono i consegnati non saldati» crede che quella colonna esista. Nella stessa riga: la vista dei conti sceglie ancora l'azione della card per ID DI CORSIA — è esattamente da lì che è nato BUG-026 nella vista comande, dove ora si guarda lo stato. COME: togliere il ramo morto (e i suoi test) o dire chi lo accenderà, e portare anche la vista dei conti su `azioneCorsia(stato)`.

FATTO (19/08): il ramo è stato TOLTO, coi suoi test. Nessuno lo accenderà: i passi del servizio si guardano dalla vista del BANCO, che ragiona per COMANDE — un conto con tre comande in tre passi diversi non sta in una colonna sola, ed è il motivo per cui quella vista è nata. `corsieDiStato` adesso fa una cosa sola: le tre colonne dei conti (in corso, chiusi, annullati), con le voci e le regole della griglia. `AZIONI_CORSIA` è diventata `azioneCorsia(stato)`: il tasto della card segue lo STATO che la colonna rappresenta, non il suo id — la stessa lezione di BUG-026, dove un id nuovo faceva sparire il tasto. Con il ramo se ne sono andati anche il bollo «pagato ma non servito» sulle card dei conti, la colonna «Da incassare» con la cifra grande e la sua `.corsia-cifra`, che da quella parte non si potevano vedere. Il bollo resta dov'è vivo: sulla vista delle comande e sulla griglia.

**Dove**: `src/lib/coda.js, src/pages/BartenderPage.jsx` · **Lo dimostrano**: `tests/unit/coda.test.js`

#### REQ-DEV-011 — Ripetizioni che si tolgono in mezz'ora, tutte insieme

Raccolta dalla rilettura del diff della 1.5.0: cose piccole, nessuna urgente, che conviene fare in un colpo solo perché toccano file appena scritti — è il momento in cui costano meno. - `impostazioniLocali.js`: cinque coppie leggi/scrivi con lo stesso try/catch. Due funzioni private e restano cinque righe a preferenza. I commenti lunghi che spiegano perché ognuna è del DISPOSITIVO vanno tenuti tutti: sono la parte che vale. - `SettingsTab.jsx`: cinque volte lo stesso gruppo di pastiglie «scegli un modo» → un componente solo. - `InventoryManager.jsx`: il riquadro del travaso scrive tre volte lo stesso overlay e chiede due volte la stessa condizione; `CarcoForm` tiene uno stato che è ricavabile; due componenti gemelli calcolano la stessa previsione di fine serata. - `generate-issues.mjs`: rilegge una per una le issue che ha appena scaricato tutte insieme — fino a 190 chiamate in più per giro di CI. - i tre script nuovi dell'emulatore riscrivono il client REST che `lib-firestore.js` ha già: basta fargli accettare indirizzo e intestazioni.

FATTO (19/08), tutte e cinque, senza cambiare niente di quello che si vede. `impostazioniLocali.js`: due funzioni private (`leggi`, `scrivi`) e il try/catch sta in un posto solo — i commenti sul perché ogni preferenza è del DISPOSITIVO sono rimasti tutti. `SettingsTab.jsx`: un `SceltaModo` al posto di QUATTORDICI gruppi di pastiglie scritti a mano (erano cinque a occhio, quattordici a contarli), con la voce spenta che resta a vista col motivo nel titolo. `InventoryManager.jsx`: un `RiquadroTravaso` al posto di tre overlay uguali, ogni passo con la sua condizione una volta sola; la previsione di fine serata la fa `previstoFineSerata` per tutte e due le viste; nel carico a colli la quantità non è più uno stato da tenere allineato a mano ma il conto cartoni × pezzi (e tornando a mano il numero calcolato resta scritto, che ricontare i pezzi già contati non lo vuole nessuno). `generate-issues.mjs`: l'elenco porta già corpo ed etichette — la rilettura una per una era un'abitudine rimasta dai tempi della ricerca, ed erano fino a 190 chiamate in più a giro. `lib-firestore.js`: il client prende un `host`, e `clientEmulatore` è lo stesso client che punta all'emulatore — i tre script hanno smesso di riscriversi commit, elenco e paginazione, e il limite dei 200 per commit adesso sta in un posto solo.

**Dove**: `src/lib/impostazioniLocali.js, src/components/SettingsTab.jsx, src/components/InventoryManager.jsx, scripts/generate-issues.mjs, scripts/lib-firestore.js` · **Lo dimostrano**: `tests/unit/clientFirestore.test.js`

#### REQ-DEV-012 — docs/system_specifications.md e' la specifica di sistema, e si genera

Chiesto dall'utente il 19/08: «requisiti.md dovrebbe diventare la specifica di sistema dato che i requisiti li abbiamo in requirements.yaml e su GitHub» — e a stretto giro, sempre lui, il file e' stato rinominato in system_specifications.md, perche' il nome dicesse cos'e' (la specifica) e non da dove nasce (i requisiti). Il documento era lo specchio del registro — le stesse voci, nello stesso ordine, con dentro meno cose — e come tutti gli specchi scritti a mano era rimasto indietro: 94 voci raccontate su 187 esistenti, per mesi, senza che nessuno se ne accorgesse.

COSA E' ADESSO: un documento che si legge come una specifica. Le aree nell'ordine della serata (si prende un ordine, si compone il conto, si incassa, e solo dopo menu', magazzino e il resto), ognuna presentata da una riga che dice di cosa parla; in testa la data di generazione, i conteggi e l'avviso che il file e' generato, con il comando per rifarlo.

TRE CAPITOLI, E LA DIVISIONE E' IL PUNTO. «Cosa fa il sistema» tiene le voci implemented e la parte fatta delle partial: e' quello a cui uno si affida. «Lavori previsti» tiene le todo, che sono un impegno e non una descrizione — mescolarle al resto farebbe leggere come esistente della roba che non esiste. «Difetti noti» tiene i bug ancora aperti (requirements/bugs.yaml): sono i punti in cui il sistema NON fa quello che c'e' scritto sopra, e tacerli renderebbe bugiarda tutta la parte precedente. I deprecated restano in fondo, col solo titolo.

OGNI COMPORTAMENTO CITA I TEST CHE LO DIMOSTRANO, e chi non ne ha lo dichiara. E' il patto del progetto: i test sono la specifica eseguibile, il documento e' la sua faccia leggibile, e quando le due si scollano e' il documento ad avere torto.

RESTA GENERATO, ed e' l'unica cosa che lo tiene vivo: scritto a mano tornerebbe vecchio in una settimana, e la prova e' come stava prima. La resa vive in un modulo suo (`lib-specifica.mjs`) perche' cosi' si prova con un registro finto di sette voci, invece che coi 187 veri — un test che legge il registro vero prova il registro, non il documento.

**Dove**: `scripts/lib-specifica.mjs, scripts/requisiti.mjs, docs/system_specifications.md` · **Lo dimostrano**: `tests/unit/specifica.test.js`

#### REQ-DEV-013 — Una voce scartata si chiude dicendo che non la faremo, e resta scritta

Chiesto dall'utente il 19/08: «perche' cancelli i requisiti? E non li chiudi? Non devono scomparire da GitHub ne' dal file dei requisiti» — e subito dopo la regola: «se non vengono implementati vengono chiusi come won't do».

VERIFICATO CHE NON SI CANCELLA NIENTE, e il sospetto era infondato: dal rilascio 1.5.0 a oggi il registro requisiti e' passato da 172 a 190 voci e quello dei bug da 33 a 41 — solo aggiunte. Le voci non spariscono mai: cambia lo `status`, e sulla bacheca la card cambia colonna.

MA C'ERA IL PROBLEMA OPPOSTO, ed e' quello che questa voce sistema: una cosa scartata restava aperta per sempre su GitHub. REQ-MENU-012, buttato dall'utente il 19/08, nel registro era gia' `deprecated` e la sua issue #36 era ancora APERTA.

DUE CAUSE, una dietro l'altra: 1) gli stati che chiudevano un'issue erano solo quelli del lavoro finito (`fixed`, `implemented`, `done`): `deprecated` e `wontfix` non chiudevano niente; 2) chi scarta una voce di solito spegne anche `generate_issue`, e il generatore prendeva in mano SOLO le voci col flag acceso — quindi quell'issue non veniva nemmeno guardata. Orfana due volte.

COME FUNZIONA ADESSO. Gli stati di chiusura sono due famiglie tenute distinte: `STATI_FATTI` (fixed, implemented, done) e `STATI_SCARTATI` (deprecated, wontfix). Le scartate entrano nel giro ANCHE senza `generate_issue`, ma solo per essere chiuse — `deveNascere` non ne apre di nuove. E si chiudono con lo stato che GitHub chiama «not planned», non «completed»: sono due icone diverse, e fra sei mesi una cosa fatta e una che abbiamo deciso di non fare non devono leggersi uguali.

IL COMMENTO CHE RESTA SULL'ISSUE lo dice a parole: «Non la faremo», col rimando alla voce del registro e la frase che conta — la voce RESTA nel registro col suo perche', qui si chiude solo la richiesta di lavoro. E' la differenza fra archiviare una decisione e perderla.

QUANDO SUCCEDE: alla chiusura vera si arriva da `main`, come per tutte le altre (la pipeline chiude le issue solo li'). Da un ramo di rilascio il generatore ora lo dice e basta — «Non la faremo (deprecated) — l'issue si chiude da main» — invece di ignorare la voce.

**Dove**: `scripts/lib-requisiti.mjs, scripts/generate-issues.mjs` · **Lo dimostrano**: `tests/unit/issueScartate.test.js`

## Lavori previsti

Roba decisa e non ancora scritta. **Non è quello che il sistema fa**: sta
qui sotto e non sopra apposta. Da queste voci nascono le issue su GitHub
(`scripts/generate-issues.mjs`), ed è lì che si lavorano.

### Ordini e comande

#### REQ-ORD-021 — Le comande annullate: o si rifanno, o si stornano dal conto

Chiesto dall'utente il 18/08. Annullare una comanda ferma la PREPARAZIONE, non tocca i soldi: quei drink restano sul conto finché qualcuno non decide cosa farne. Oggi invece spariscono dal totale in silenzio (aggregateItems salta le annullate), e nessuno se ne accorge.

LA REGOLA, una sola, di cui la divisione è il caso particolare. Ogni unità di una comanda annullata sta in uno di tre posti:

SOSTITUITA (è finita in una o più comande nuove nate al suo posto), STORNATA (tolta dal conto per davvero, e scritta come storno), DA DECIDERE (nessuna delle due: pesa ancora sul conto e si vede nel dettaglio, in attesa che qualcuno scelga). L'INVARIANTE, che è quello che tiene in piedi i soldi: per ogni comanda annullata `sostituite + stornate + da_decidere` fa sempre la quantità di partenza, e sul totale del conto pesa SOLO la parte da decidere — le sostituite pesano attraverso le comande nuove (se contassero entrambe il conto raddoppierebbe), le stornate non pesano più. Da qui la divisione smette di essere un'eccezione: è il caso in cui tutto è sostituito, il residuo è zero e il totale non si muove di un centesimo.

COSA SI VEDE E COSA SI FA. Nel dettaglio del conto, fra i gruppi per passo del servizio, c'è anche il gruppo delle voci in comande annullate, distinto dagli altri: non sono lavoro in corso, sono roba da decidere. Da lì due strade:

RIFARE (si stampa una comanda uguale, per tutto o per una parte, che nasce come una comanda qualsiasi — il bicchiere rotto si rifà) e STORNARE (col «−» si tolgono le voci, che escono dal conto segnate come stornate: non spariscono, restano scritte come storno).

LO STORNO SI VEDE E SI STAMPA: nella colonna di sinistra della schermata di pagamento e sul preconto/scontrino, come riga propria con l'importo in negativo. Chi legge lo scontrino deve capire cosa è stato tolto e quanto, se no un conto che non torna diventa una discussione al tavolo.

TRE DECISIONI PRESE (18/08, confermate dall'utente): 1) la regola vale solo per le comande annullate DA QUI IN AVANTI — quelle nuove portano i campi del rendiconto, le vecchie no e si comportano come oggi. Nessuna migrazione, e nessun conto già chiuso che cambia importo; 2) se il CONTO è annullato non pesa niente: eccezione esplicita, prima di ogni altro calcolo; 3) il gesto per annullare una singola comanda su un conto vivo oggi NON esiste (lo fanno solo la divisione e l'annullamento del conto) e va aggiunto nel dettaglio comanda: solo a conto aperto e solo se non è ancora stata servita — servita vuol dire che il drink è uscito, e lì la strada resta «Riapri conto». Vale solo con gli stati del servizio accesi.

**Dove**: `src/lib/comande.js, src/components/OrderPosDetail.jsx, src/lib/printer.js, src/components/PaymentScreen.jsx`

### Cassa e POS

#### REQ-POS-017 — Coperto, servizio e mancia si accendono e spengono sul singolo conto

Dal menù ⋯ del conto si governano i supplementi PER QUEL CONTO: se un supplemento è disattivato nelle impostazioni lo si può accendere solo qui (uno, due o tutti e tre); se è attivo di default lo si può spegnere solo qui. Spegnendoli, le rispettive voci spariscono dal riepilogo — e se non resta nulla sparisce anche la riga Subtotale. Tocca i calcoli del conto: va fatto con i test della logica prezzi, non solo di interfaccia.

**Dove**: `src/components/OrderPosDetail.jsx, src/lib/pricing.js`

#### REQ-POS-018 — La barra azioni del conto si organizza come quella del browser

Una modalità «organizza» per i comandi del dettaglio conto, come la barra di Firefox o Chrome: si decide QUALI comandi stanno in vista (Unisci/Separa, Dati conto, Prodotto libero, le voci oggi nascoste nel ⋯) e DOVE, con posizionamento libero, e COME si mostrano — icona e testo, solo testo o sola icona. Anche il riquadro del tavolo è un elemento posizionabile. Il precedente è la griglia POS organizzabile (REQ-POS-011): stessa filosofia, qui applicata ai comandi.

**Dove**: `src/components/OrderPosDetail.jsx`

### Pagamenti

#### REQ-PAG-011 — Il pagamento si legge per comanda, e dalla card servita si incassa quella

Chiesto dall'utente il 18/08. Quando un conto ha più di una comanda, nella colonna di sinistra della schermata di pagamento le righe si raggruppano per comanda — stessa forma dei gruppi che ci sono già, intestazione e sotto le sue righe — e ogni gruppo ha i suoi due tasti, TUTTO e NIENTE, per prendere o lasciare in un colpo quello che contiene. Con una comanda sola non cambia niente: nessuna intestazione, nessun tasto in più, che non serve un titolo per dire una cosa sola. La selezione per riga e quantità che c'è oggi resta e non si rifà: quei tasti la muovono, non la sostituiscono. E dal banco: sulla card di una comanda SERVITA il tasto porta in cassa CON QUELLA COMANDA GIÀ SELEZIONATA. È quello che rende sensata la cosa: tre comande servite dello stesso tavolo non chiedono tre volte l'intero — ognuna porta in cassa la sua parte, e chi vuole incassare tutto tocca «tutto» sugli altri gruppi o parte dal conto.

**Dove**: `src/components/PaymentScreen.jsx, src/components/CorsieComande.jsx`

### Tavoli

#### REQ-TAVOLI-001 — I tavoli hanno un'anagrafica, e ognuno il suo QR generato in app

Nasce l'anagrafica dei tavoli: un tavolo ha un NOME e/o un NUMERO — almeno uno dei due, e nessuno dei due può essere una stringa vuota. Per ogni tavolo l'app genera il suo QR code (il collegamento al menù con il tavolo già agganciato), da stampare e mettere sul tavolo: la scansione porta al menù cliente col tavolo prepopolato. Oggi il tavolo è testo libero sull'ordine: l'anagrafica non lo sostituisce di colpo, ci si aggancia (il campo dell'ordine resta com'è, ma può venire da un tavolo censito).

**Dove**: `src/lib/api.js, firestore.rules, requirements`

#### REQ-TAVOLI-002 — Nome e tavolo nelle viste d'ordine: staff libero, cliente guidato

Nella vista «Nuovo ordine dal menù» dello staff si possono inserire NOME e numero del tavolo: il nome deve poterci stare (oggi c'è solo il tavolo) e il numero è opzionale. Nella vista cliente: se si arriva dal QR del tavolo (REQ-TAVOLI-001) il tavolo è prepopolato e NON modificabile; senza QR il tavolo non serve, ma il nome sì — è quello che permette al banco di chiamare l'ordine.

**Dove**: `src/pages/MenuPage.jsx, src/components/OrderSummary.jsx`

### Magazzino

#### REQ-MAG-008 — Ricette da riagganciare agli articoli nuovi

Dopo l'import dei costi restano ingredienti che puntano a id di magazzino non più esistenti: quei drink mostrano un costo parziale. Vanno riagganciati agli articoli corretti (alcuni sono accoppiamenti evidenti, altri vanno decisi a mano) e va impedito che una ricetta punti nel vuoto senza accorgersene.

**Dove**: `src/lib/saveDrink.js, requirements`

#### REQ-MAG-020 — La resa di un prodotto sta dietro un interruttore

Chiesto dall'utente il 18/08. Il blocco «Si usa in un'altra misura? (facoltativo)» sta sempre aperto nella scheda del prodotto, coi campi vuoti in grigio: occupa mezza scheda per una cosa che riguarda pochi prodotti, e chi apre la scheda per cambiare un prezzo se la trova davanti come se dovesse compilarla. Va dietro un interruttore, spento di suo, con l'etichetta in parole da locale e sotto la riga di spiegazione che c'è già (quella dei limoni).

DUE COSE DA NON SBAGLIARE: se il prodotto ha già una resa impostata l'interruttore nasce ACCESO e i campi si vedono — se no chi apre un prodotto già configurato crede di aver perso il dato, o peggio non si accorge che c'è e ragiona su numeri sbagliati; e spegnendolo con una resa dentro non deve sparire in silenzio, perché quel numero cambia come si scala il magazzino. Stessa forma dell'interruttore che c'è già in quella scheda: due interruttori scritti in due modi nella stessa schermata sembrano fare cose diverse.

**Dove**: `src/components/InventoryManager.jsx`

#### REQ-MAG-021 — Un acquisto conta nel mese in cui si consuma, non in quello in cui si compra

Chiesto da Flavio a voce (18/08, sei vocali di fila fra le 21:34 e le 21:40). Oggi un acquisto conta nel mese in cui è stato caricato. Lui vuole che conti nel mese in cui la merce viene CONSUMATA, cioè venduta: «in realtà non conta quando l'acquisto tanto quanto quando lo vendo». La tabella mensile serve a mettere di fronte quello che è entrato e quello che è uscito, e due numeri che parlano di merci diverse non si confrontano.

COME SI MUOVE. L'acquisto nasce nel mese in cui si carica; poi, man mano che quella merce viene consumata, la quota consumata ESCE dal mese di carico ed ENTRA nel mese del consumo. Parole sue: «me la toglie da febbraio e me la mette a marzo». Conseguenza che ha detto lui stesso, e che va accettata: i mesi passati non restano fermi, «gli acquisti non restano sempre uguali, possono aumentare possono diminuire a seconda di dove ho utilizzato quella materia».

LA GRANA È LA PORZIONE, non la fattura e non la bottiglia. Il suo esempio più chiaro: un rum Bumbu da 50 euro comprato il 20 febbraio, il primo Bumbu servito il 3 marzo. Quella porzione va su marzo, e «mano a mano che la vado a consumare a marzo, me la toglie da febbraio e me la mette a marzo»; se la bottiglia avanza, quello che si consuma ad aprile finisce ad aprile, «finché non acquisto una nuova bottiglia o finché non finisco quella».

SECONDO ESEMPIO, a unità intere: il 20 febbraio ci sono 10 Schweppes in casa e si compra un cartone da 24. A febbraio si consumano solo le 10 vecchie. Il 1° marzo il primo gin tonic prende la prima delle 24: quella singola unità passa a marzo.

PERCHÉ NASCE. Non è teoria contabile, è quello che gli sballa i conti: «finché queste cose succedono a inizio mese è probabile che acquisto in un mese e vendo nello stesso mese, ma quando faccio un acquisto a fine mese, quell'acquisto io probabilmente lo utilizzerò nel mese entrante». Una spesa grossa fatta il 30 del mese oggi affonda il mese che finisce e regala margine a quello che comincia.

DA CONFERMARE — quale carico si consuma per primo. Dalle sue parole («finché non acquisto una nuova bottiglia o finché non finisco quella») si legge che si consuma prima la merce più vecchia, e che a migrare è il costo del carico da cui si sta attingendo. Non l'ha però detto come regola, e cambia i numeri quando lo stesso prodotto è stato comprato a prezzi diversi: va confermato prima di scrivere codice.

DOMANDE APERTE, da portare a chi ha parlato e non da indovinare: (1) la merce che non viene MAI venduta — rotture, cali, sfrido, quello che sparisce e si scopre all'inventario — resta nel mese di acquisto per sempre, o esce nel mese in cui l'inventario la scarica? (2) un mese già guardato cambia anche mesi dopo: va bene che febbraio letto a maggio dia numeri diversi da come si leggeva a marzo, o a un certo punto un mese si chiude e non si tocca più? (3) questa regola vale solo per la vista mensile degli acquisti, o anche per il registro delle fatture e per la valorizzazione dell'inventario, dove l'acquisto è un fatto con la sua data?

DA SAPERE PRIMA DI STIMARLA: per dire da quale carico esce quello che si consuma serve tenere traccia dei carichi uno per uno, e oggi il magazzino tiene la giacenza, non i lotti. Il lavoro grosso è lì, non nella tabella.

SI INCASTRA CON REQ-MAG-015, e le due non si confondono: quella dice a quale MACRO va attribuita una vendita, questa dice in quale MESE va attribuito un acquisto. Vivono nella stessa tabella e vanno pensate insieme.

NON SI LAVORA finché le cinque domande qui sopra non hanno risposta (quale carico si consuma per primo, la merce mai venduta, i mesi passati che cambiano, il perimetro della regola): indovinarle significa scrivere il codice dei lotti — il lavoro grosso — su una regola che poi cambia. E UNA COSA È GIÀ CAMBIATA SOTTO: con REQ-MAG-015 la tabella «Mensile per macro» non mostra più gli acquisti del mese, mostra il COSTO DEL VENDUTO — che per costruzione cade nel mese in cui la merce è stata venduta, che è esattamente quello che questo requisito chiedeva PER QUELLA TABELLA. Il rum comprato il 20 febbraio e servito il 3 marzo pesa già su marzo. Quello che resta scoperto è il resto: il registro delle fatture e la valorizzazione dell'inventario, dove l'acquisto è un fatto con la sua data. Da riportare a chi ha parlato: forse la domanda vera adesso è un'altra, e più piccola.

**Dove**: `src/lib/macroStats.js, src/lib/stats.js, src/components/StatsTab.jsx (vista «Mensile per macro»)`

#### REQ-MAG-022 — Bilancio → Acquisti × Fatturato: gli acquisti per macro, mese per mese

COSA FA IL FOGLIO. La riga ACQUISTI del rapporto per macro è battuta a mano, mese per mese e macro per macro: nessuna formula dice da dove viene.

DA DOVE ARRIVANO QUEI NUMERI NON È DIMOSTRABILE dai file, e non va inventato. Due indizi, verificati tutti e due, e nessuno dei due torna al centesimo. (a) Il registro fatture (FORNITORI REC.xlsx), sommato per mese del 2026, dà 1180 / 1129 / 1680 / 2448 / 4400 / 9081 / 761 da gennaio a luglio, contro gli ACQ TOT del rapporto 1809 / 1063 / 1697 / 2884 / 4526 / 8673 / 2369: stesso ordine di grandezza, marzo e maggio quasi uguali, gennaio e luglio lontani. Il registro però tiene solo cinque fornitori, e negli ordini ne compaiono una decina. (b) GEN ORD REC.xlsx valorizza ogni fattura riga per riga (quantità × prezzo ivato) e ogni riga porta il suo TIPO, quindi da lì una somma per macro si può fare a mano. È il modo più plausibile, ma è una ricostruzione: nel rapporto non c'è nessun collegamento che lo provi.

QUELLO CHE È CERTO: gli ACQUISTI del foglio sono merce ENTRATA dalla porta, al LORDO dell'IVA (nel generatore il prezzo di riga è sempre «€/pz × 1,22»).

COSA HA GIÀ L'APP. `purchasesByMacro` (src/lib/macroStats.js) somma gli ordini fornitore RICEVUTI per macro di MAGAZZINO, al netto IVA. Nessuna schermata la chiama, e non ha il taglio per mese. È rimasta lì apposta: REQ-MAG-015 dice che «quanto ho speso in bibite» è una domanda vera che vive con gli acquisti e non nella tabella del venduto, e che l'aggancio `macro_menu_id` esiste per il giorno in cui gli acquisti avranno la loro schermata. Quel giorno è questo.

PROPOSTA, poi DECISA il 19/08 (vedi in fondo). Una vista «Acquisti per macro» con le macro di MAGAZZINO per riga e i mesi per colonna, e — dove la macro d'acquisto è agganciata a una macro di vendita (`macro_menu_id`) — l'incassato di quella accanto, che è il confronto che il locale fa a fine mese.

ERANO TRE DOMANDE, E DUE SONO CHIUSE (19/08, dall'utente che riporta Flavio). (1) L'ACQUISTO È L'ORDINE FORNITORE RICEVUTO: la merce conta quando entra dalla porta, non quando arriva la fattura — che in app è un'altra cosa e segue tempi suoi. (2) LORDO E NETTO SI VEDONO TUTTI E DUE: i fogli di Flavio sono al lordo ed è come lui legge da sempre, il resto dell'app ragiona al netto, e obbligare a sceglierne uno vorrebbe dire dare torto a lui o dare torto alle statistiche. Servono tutti e due sulla stessa tabella; quale dei due si apre per primo lo si sceglie provandolo con lui. (3) RESTA APERTA: in quale mese cade un acquisto è REQ-MAG-021 — la quota consumata che migra da un mese all'altro — e questa tabella va pensata insieme a quella.

DECISO ANCHE DOVE VIVE (19/08): nella pagina «Bilancio» (REQ-CASSA-010), sottosezione «Acquisti × Fatturato», accanto a «Mesi» e «Venduto × Incassato». È la tabella dell'Excel rifatta: per riga le macro d'ACQUISTO, per colonna i mesi, e in ogni cella acquisti, fatturato, utile (fatturato − acquisti), rapporto fat/acq e incidenza sull'utile del mese; in fondo i totali dell'anno e l'incidenza dell'anno.

IL FATTURATO DI UNA MACRO D'ACQUISTO è l'incassato della macro di VENDITA agganciata con `macro_menu_id`, l'aggancio che REQ-MAG-015 ha tenuto in vita apposta per questo giorno. Dove l'aggancio non c'è, la colonna fatturato resta vuota e si dice perché: uno zero lì dentro si legge come «non ho incassato niente», che è un'altra cosa.

GLI ACQUISTI SENZA MACRO NON SPARISCONO. `purchasesByMacro` li raccoglie già sotto UNASSIGNED, e adesso quella riga serve davvero:

ALTRO è una categoria di magazzino che resta fuori dalle macro APPOSTA (REQ-UI-022). Va mostrata, non nascosta — un totale che non torna con le fatture non lo guarda più nessuno. E UNA COSA VA DETTA SUBITO: dello storico non si ricostruisce niente. Gli ordini fornitore in app nascono da oggi, i numeri 2026 del foglio non hanno un corrispondente in banca dati. La tabella si riempie da quando gli ordini passano per l'app, e i primi mesi saranno mezzi vuoti: è la verità, e va scritta sulla schermata invece di lasciarla scoprire a chi guarda — nella DIDASCALIA della tabella, che è il posto dove stanno le avvertenze (REQ-CASSA-010). Lì si dicono anche le altre due: cosa vogliono dire utile, rapporto e incidenza in parole da banco, e se i numeri che si stanno guardando sono al lordo o al netto dell'IVA — con due letture commutabili, sapere quale è aperta non è un dettaglio.

DIPENDE DA REQ-CASSA-010 (la pagina che la ospita) e, per come si legge, da REQ-MAG-021 (P3, fermo finché non hanno risposta le cinque domande sui lotti): finché quello non è deciso un acquisto pesa sul mese in cui è ENTRATO e non su quello in cui si consuma, e la didascalia deve dirlo. Ma il vincolo che conta non è codice: la tabella resta vuota finché gli ordini fornitore non passano davvero dall'app, e dello storico 2026 non si ricostruisce niente. Per questo non è lavorabile adesso.

**Dove**: `src/lib/macroStats.js purchasesByMacro, src/components/BilancioTab.jsx (nuovo)`

#### REQ-MAG-023 — Quanto ordinare: il foglio guarda la giacenza, l'app guarda una soglia

COSA FA IL FOGLIO (GEN ORD REC.xlsx, verificato). Centotrenta fogli, uno per giro d'ordini, coi numeri dei documenti nel nome («1410+1438+AGO+PAD+PIC»). Ogni foglio è il CATALOGO INTERO ricopiato — circa 380 righe — con: articolo, formato in cl, TIPO (la categoria:

GIN, BIRRE, VINO, Z APE…), classe LINEA o PREM, una marca «OUT» per quello che non si tiene più, DEP (la giacenza), TRE colonne di quantità (A, B, C), il prezzo netto al pezzo, il prezzo ivato = netto × 1,22, l'importo di riga = quantità × prezzo ivato, il costo al cl = prezzo ivato / formato, e il fornitore. Il totale del giro è la somma delle tre colonne.

IL FORNITORE STA SULL'ARTICOLO, non sull'ordine: un foglio solo tiene dentro più fornitori insieme, e i nomi dei fogli lo dicono (NOVA + AGOSTINO + PICCOLO). Le tre colonne A/B/C servono a tenere separati i pezzi del giro dentro lo stesso foglio.

LO STESSO MODELLO SERVE PER LE RIMANENZE: i fogli «RES …» e «rimanenza giugno» sono lo stesso catalogo con le quantità CONTATE al posto di quelle ordinate, valorizzate dalle stesse colonne. Comprare e contare, per il foglio, sono lo stesso gesto.

QUANTO ORDINARE NON È CALCOLATO: nessuna formula lega le quantità a DEP o al consumo. Si guarda la giacenza e si scrive un numero. L'UNICA REGOLA NUMERICA che compare in tutti i file sta in INV.xlsx, foglio «ORD»: la colonna CONS/w è «= ORD / 3», cioè l'ordine è dimensionato su circa TRE settimane di consumo. Quel foglio però oggi ha una riga sola compilata: è un indizio, non una prova, e va chiesto.

COSA FA L'APP OGGI. Il generatore ordini fa un ordine per UN fornitore, coi soli prodotti di quel fornitore; «⚡ Precompila i sotto scorta» propone `suggestedPackages`, che riporta la giacenza a DUE VOLTE la soglia di avviso (`low_threshold`), minimo una confezione, e non propone niente se la soglia non è impostata. Al ricevimento la merce entra in magazzino in un colpo (REQ-MAG-006).

LE DIFFERENZE, in ordine di quanto pesano: (1) l'app parte da una SOGLIA scritta a mano sull'articolo, il foglio dal CONSUMO e dalla giacenza; (2) l'app fa un ordine per fornitore, il foglio ne mette insieme quanti ne servono in un giro solo; (3) l'app non sa cosa sia un consumo settimanale, vedi REQ-MAG-024; (4) nella schermata dell'ordine non si vede il costo per unità di misura, che nel foglio c'è su ogni riga ed è il numero con cui si decide se un prodotto conviene. PROPOSTA. Proporre la quantità dal CONSUMO invece che dalla soglia — «coprire N settimane al ritmo delle ultime conte», con la soglia che resta come rete per i prodotti senza storico — e un giro d'ordini che tenga dentro più fornitori insieme, spezzandosi in un ordine per fornitore solo al momento dell'invio.

LA DOMANDA SULLE SETTIMANE È STATA RITIRATA (19/08). Era nata da un indizio dei fogli (`ORD / 3` in INV.xlsx, che parrebbe dire «tre settimane di consumo») e l'avevo girata come una cosa da chiedere: per quanto tempo deve bastare un ordine. Non serve, e la risposta dell'utente chiude il discorso: «non c'entra quanto deve bastare o deve durare. Non lo sappiamo e non lo sapremo».

SI ORDINA PER DIFFERENZA, non per previsione: ogni prodotto ha una quantità minima da tenere in magazzino, scritta dall'admin, e si ordina quello che manca per tornarci (REQ-MAG-026). Due numeri che esistono, invece di una stima che nessuno sa fare.

COSA RESTA DI QUESTA VOCE. Il generatore vero è REQ-MAG-026, e non aspetta niente da qui. Qui resta il CONFRONTO COL FOGLIO — cosa fa lui che l'app non fa — e due cose ancora utili: il giro che tiene insieme più fornitori, e il costo per unità di misura sulla riga dell'ordine, che nel foglio c'è ed è il numero con cui si decide se un prodotto conviene.

IL CONSUMO A SETTIMANA (REQ-MAG-024) l'app ora lo calcola, ma non serve a proporre le quantità: serve a chi guarda, per accorgersi che una minima è tarata male.

**Dove**: `src/lib/warehouse.js suggestedPackages, src/components/PurchaseOrdersPanel.jsx`

#### REQ-MAG-025 — Ordini e fatture: una pagina sola, e una fattura paga un ordine

Chiesto dall'utente il 19/08. Oggi ordini fornitore e documenti stanno dentro Magazzino, in due sottosezioni che non si parlano: si ordina di la', si segna la fattura di qua, e nessuno sa quale fattura paghi quale ordine. Devono diventare UNA PAGINA LORO, «Ordini e fatture», nel menu laterale e visibile SOLO ALL'ADMIN, con due sottosezioni: «Ordini» e «Fatture». Sono i soldi che escono dal locale, e non e' roba da turno.

IL LEGAME, che e' il cuore della richiesta:

UNA FATTURA PAGA UN ORDINE (e un ordine e' di UN fornitore solo). Dall'ordine si arriva alla sua fattura e viceversa; un ordine senza fattura si vede a colpo d'occhio (la merce e' arrivata ma il documento no), e una fattura senza ordine pure — sono le due cose che a fine mese fanno tornare o non tornare i conti con il commercialista.

TRE LIVELLI, NON DUE (precisato dall'utente il 19/08). Non e' una fattura che copre piu' ordini: e' un GIRO D'ORDINI che ne contiene diversi, UNO PER FORNITORE, e ogni fornitore manda la SUA fattura. «Un giro di ordini, non un ordine. Sono piu' fatture perche' ci sono diversi fornitori» — parole sue. Quindi: giro -> N ordini (uno per fornitore) -> N fatture (una per ordine). Il legame fattura-ordine resta uno-a-uno; quello che sta sopra e' il giro, che tiene insieme la serata di ordinazione.

LO DICONO ANCHE I FOGLI, e adesso si spiegano: in GEN ORD REC ogni foglio e' un giro e si chiama coi numeri dei documenti che lo compongono («1410+1438+AGO+PAD+PIC», «nova+ago+picc»), col fornitore scritto sull'ARTICOLO e non sull'ordine — un foglio solo, piu' fornitori dentro (REQ-MAG-023).

COSA CAMBIA PER L'APP: oggi `purchase_orders` e' gia' UN ORDINE PER FORNITORE, quindi quel livello c'e' e non si tocca. Manca il giro sopra: si guarda il fabbisogno una volta sola e ne escono N ordini insieme, che poi vivono ognuno per conto suo (arriva, si carica, si fattura). Da decidere se il giro e' un dato scritto (una collezione sua, che tiene la data e i suoi ordini) o solo un modo di crearli in blocco: la prima strada permette di chiedersi «quanto e' costato il giro di martedi'», la seconda costa meno.

IL CARICO AL RICEVIMENTO C'E' GIA' e non va rifatto: receivePurchaseOrder in api.js, quando l'ordine passa a «ricevuto», alza la giacenza riga per riga (confezioni x contenuto, o pezzi), aggiorna le bottiglie totali e scrive un movimento «ordine fornitore». Questa voce ci aggiunge il pezzo che manca.

IL PRODOTTO NUOVO, che oggi si perde in silenzio. Quel ciclo salta le righe il cui articolo non esiste in anagrafica (`if (!s.exists()) continue`): se il fornitore manda una referenza nuova, la riga non carica niente e nessuno se ne accorge. Deve invece NASCERE il prodotto, inventariato con quello che l'ordine sa gia' (nome, fornitore, prezzo, confezione) e marcato come DA SISTEMARE — perche' quello che l'ordine non sa e' proprio cio' che serve al resto del sistema: la categoria (e quindi la macro d'acquisto), l'unita' di misura vera, la soglia di riordino.

ATTENZIONE AL NOME: nel magazzino esiste gia' una lista «da sistemare», ma e' del travaso a pezzi (i prodotti che la migrazione non sa convertire da sola) ed e' una cosa diversa. O si riusa quella stessa strada — e allora si dice perche' le due situazioni sono la stessa — o il nuovo stato ha un nome suo. Due liste omonime che vogliono dire cose diverse, sulla stessa schermata, sono un guaio che si paga dopo.

COME SI INCASTRA COL RESTO, ed e' la parte da non sbagliare: 1) MACRO-CATEGORIE. Un prodotto nuovo senza categoria non ha macro d'acquisto, quindi la sua spesa non compare in «Bilancio → Acquisti x Fatturato» (REQ-MAG-022): sparisce dai conti invece di risultare sbagliata, che e' peggio. Il prodotto da sistemare va quindi mostrato insieme alle categorie senza macro (REQ-UI-022): sono lo stesso buco visto da due lati. 2) SCARICO. La giacenza caricata da un ordine si scala con le regole di sempre — snapshot della ricetta, unita' base, scarico a «pronto»: qui non cambia niente, e non deve cambiare. 3) IVA. L'ordine porta il prezzo d'acquisto; l'IVA d'acquisto ha gia' il suo default (22%) e il campo per prodotto. Un prodotto nato da un ordine eredita il default finche' qualcuno non lo corregge.

4) SPESE DEL MESE (REQ-CASSA-012): le fatture fornitore sono spesa registrata. Va deciso — e scritto — se entrano da sole nel netto del mese o se restano due elenchi separati, altrimenti la stessa uscita si conta due volte.

ATTENZIONE, DUE «FATTURE»

NEL CODICE: `supplier_invoices` sono i documenti dei FORNITORI (quello di cui parla questa voce), `invoices` sono le fatture di VENDITA ai clienti. Nomi vicini, mestieri opposti.

**Dove**: `src/components/PurchaseOrdersPanel.jsx, src/components/SupplierInvoicesPanel.jsx, src/components/InventoryManager.jsx, src/lib/api.js, src/lib/ruoli.js, src/components/StaffDrawer.jsx`

#### REQ-MAG-026 — Gli ordini nascono dalle giacenze: chi e' in esaurimento entra da solo

Chiesto dall'utente il 19/08: «gli ordini andrebbero creati dalle giacenze di magazzino. Se un articolo e' in esaurimento dovrebbe essere aggiunto automaticamente all'ordine per quel fornitore».

OGGI E' AL CONTRARIO, ed e' il punto. Il generatore chiede PRIMA il fornitore: si apre un ordine per Nova, e solo dentro quell'ordine il tasto «Precompila i sotto scorta» propone le quantita' per i prodotti di Nova (`suggestedPackages`: sotto soglia si riporta la giacenza a due volte la soglia, minimo una confezione). Chi ordina deve quindi RICORDARSI da solo quali fornitori guardare: se non apre l'ordine di Piccolo, il prodotto di Piccolo sotto scorta non lo vede nessuno. E' esattamente il modo in cui si dimentica qualcosa.

COME DEVE ANDARE: si parte dal MAGAZZINO, non dal fornitore. Una passata su tutte le giacenze raccoglie chi e' in esaurimento e lo mette nell'ordine del SUO fornitore — il fornitore e' gia' scritto sull'articolo (`supplier_id` su `inventory_items`), quindi il raggruppamento non chiede niente a nessuno. Da una passata escono N ordini gia' compilati, uno per fornitore. E QUESTO E' IL GIRO di REQ-MAG-025: la seduta in cui si guarda il fabbisogno una volta sola e ne nascono piu' ordini. Con questa voce il giro smette di essere un contenitore e diventa il gesto: si guardano le giacenze, escono gli ordini, ognuno prende la sua strada (arriva, si carica, si fattura).

LA QUANTITA' NON LA DECIDE QUESTA VOCE: quanto ordinare e' REQ-MAG-023 (soglia scritta a mano contro consumo reale, con la domanda aperta su quante settimane coprire). Qui si decide CHI entra nell'ordine e in QUALE ordine; la quantita' resta quella che il calcolo di turno propone. Le due voci si incastrano ma non si sovrappongono.

COSA VA DECISO PRIMA DI SCRIVERE, e non si indovina: 1) «IN ESAURIMENTO»

OGGI VUOL DIRE `stock <= low_threshold`, e senza soglia impostata il prodotto non entra mai — silenziosamente. Su un magazzino dove le soglie non sono tutte compilate, «crea l'ordine dalle giacenze» produrrebbe un ordine che sembra completo e non lo e'. O si mostra chiaro quanti prodotti sono rimasti fuori per soglia mancante, o si trova una regola che non dipenda solo da quella (il consumo, appunto — REQ-MAG-023).

2) COSA SUCCEDE AGLI ORDINI GIA' APERTI per lo stesso fornitore: si aggiunge la riga a quello aperto o se ne fa un altro? Ordinare due volte la stessa cassa e' un errore che si paga in magazzino.

3) CHI NON HA FORNITORE: un prodotto senza `supplier_id` sotto scorta non ha un ordine dove andare. Va mostrato a parte, non lasciato cadere — e' lo stesso buco delle categorie senza macro (REQ-UI-022) e dei prodotti nuovi da sistemare (REQ-MAG-025).

4) LA PROPOSTA SI CORREGGE SEMPRE: quello che esce e' un ordine da guardare e ritoccare prima di mandarlo, non da spedire al buio. Chi sta al banco sa cose che la giacenza non sa — la festa di sabato, il fornitore che salta la consegna.

NON TOCCA LO SCARICO: le giacenze restano quelle che sono, con le regole di sempre. Questa voce le LEGGE soltanto. COM'E' FATTO OGGI IL GENERATORE, letto riga per riga il 19/08 (src/components/PurchaseOrdersPanel.jsx, 272 righe): si sceglie PRIMA il fornitore da una tendina; da quel momento la schermata mostra `supplierItems`, cioe' i soli prodotti di quel fornitore che non siano 'out'; un tasto «Precompila i sotto scorta» riempie le quantita' con `suggestedPackages` (riporta la giacenza a DUE VOLTE la soglia di avviso, minimo una confezione, e non propone niente se la soglia manca); si aggiusta a mano e le righe con quantita' maggiore di zero diventano l'ordine, con totale netto e lordo. Da li' l'ordine si stampa, si copia, si manda per email al fornitore (mailto precompilato) e, quando arriva, «ricevuto» carica il magazzino.

LE TRE DIFFERENZE con quello che serve, e sono precise: (a) OGGI SI VEDE UN FORNITORE PER VOLTA, non tutto l'inventario: chi ordina deve ricordarsi da solo quali fornitori aprire, ed e' cosi' che si dimentica qualcosa; (b) LA QUANTITA' PROPOSTA VIENE DALLA SOGLIA (2x), non da una quantita' minima d'ordine scritta sul prodotto — e senza soglia il prodotto non viene proposto MAI, in silenzio; (c) IL FILTRO ESCLUDE SOLO 'out': i prodotti in assortimento entrano nel precompilato come quelli in linea. Il resto della macchina — righe, totali, stampa, email, ricevimento e carico — c'e' gia' e non si rifa'.

COME FUNZIONA IL GESTO, deciso dall'utente il 19/08 e da qui si implementa. «L'ordine lo deve generare l'admin o il bartender, e quando lo genera genera l'ordine per fornitore, e sulla base dei prodotti esauriti o in esaurimento. Quando genero un ordine vedro' tutto l'inventario ma l'ordine generato conterra' solo quello che decide admin/bartender, prepopolato con le quantita' minime (decise da admin per prodotto di inventario) da ordinare».

IN ORDINE, cosa succede: 1) CHI: admin o bartender (mai la sala). Il confronto si fa con src/lib/ruoli.js, che e' l'unico posto dove i ruoli si guardano.

2) SI PARTE DAL MAGAZZINO, MA SOLO QUANDO LO SI CHIEDE. Parole dell'utente (19/08): «ovviamente lo fai solo quando admin crea un nuovo ordine e clicca, calcola da magazzino». Non e' una cosa che gira da sola ne' che si aggiorna mentre si guarda: e' un tasto, e quello che ne esce e' una proposta ferma su cui si lavora. Si guarda chi e' esaurito o in esaurimento, e ogni prodotto va nell'ordine del SUO fornitore — che e' gia' scritto sull'articolo. Una passata, N ordini.

3) SI VEDE TUTTO L'INVENTARIO, non solo i sotto scorta: la schermata mostra l'intero elenco e il prepopolato e' solo un punto di partenza. Chi ordina aggiunge quello che sa lui — la festa di sabato, il fornitore che salta la consegna — e toglie quello che non serve. 4) NELL'ORDINE FINISCE SOLO QUELLO CHE DECIDE CHI ORDINA. La proposta non parte mai da sola.

5) LA QUANTITA' SI CALCOLA PER DIFFERENZA, e non si stima niente. Precisato dall'utente il 19/08, dopo che avevo capito male: «non c'entra quanto deve bastare o deve durare. Non lo sappiamo e non lo sapremo». Ogni prodotto ha una QUANTITA' MINIMA DA TENERE IN MAGAZZINO, decisa dall'admin sull'anagrafica del prodotto; l'ordine propone quello che manca per tornarci: da ordinare = quantita' minima - giacenza attuale Nessuna previsione di consumo, nessun orizzonte di settimane: due numeri che l'app ha gia' o che l'admin scrive una volta.

CAMPO NUOVO da aggiungere all'articolo di magazzino (verificato il 19/08: oggi non esiste, nessuno dei 388 prodotti di test ce l'ha).

NON E' LA SOGLIA CHE C'E' GIA': `low_threshold` dice QUANDO avvisare («questo sta finendo»), la quantita' minima dice QUANTO deve essercene quando si e' a posto. Sono due numeri diversi e servono a due momenti diversi — oggi il generatore usa la soglia moltiplicata per due, che e' un modo di indovinare il secondo numero dal primo.

SENZA QUEL NUMERO non si sa quanto ordinare: e' l'unica cosa che l'admin deve scrivere perche' il resto funzioni, e va detto chiaro in schermata invece di proporre zero in silenzio.

6) CHI ENTRA NEL PREPOPOLATO: solo i prodotti IN LINEA o PREMIUM. Gli altri no. Il campo esiste gia' — `status` sull'articolo, valori in ASSORTIMENTI (src/lib/inventory.js): 'assortimento' (il default, «si tiene senza niente di speciale»), 'linea' (i cavalli di battaglia che non devono mancare), 'premium' (le bottiglie buone), 'out' (fuori assortimento, non si ricompra).

ATTENZIONE, UN FATTO DA GUARDARE PRIMA DI SCRIVERE (misurato su tana-drink-test il 19/08): dei 388 articoli solo 78 sono classificati linea (36) o premium (42). Duecentouno sono in 'assortimento' e centonove 'out'. Siccome 'assortimento' e' il DEFAULT di chi non ha mai dichiarato niente, la regola cosi' com'e' lascerebbe fuori dal prepopolato duecento prodotti — e non si sa se quei duecento sono «tenuti senza niente di speciale» per scelta o solo mai classificati. Se sono la seconda cosa, l'ordine prepopolato salterebbe in silenzio merce che serve, ed e' il tipo di buco di cui ci si accorge quando manca la bottiglia.

DA CHIEDERE A FLAVIO prima di implementare, e nel frattempo la regola resta quella detta: linea e premium.

**Dove**: `src/lib/warehouse.js, src/components/PurchaseOrdersPanel.jsx, src/lib/api.js`

### Cassa di serata e statistiche

#### REQ-CASSA-011 — Bilancio → Mesi: minimo, incassato e differenza, giorno per giorno

DECISO (19/08, dall'utente che riporta Flavio). È la versione navigabile dei fogli mensili di ANALISI DATI (com'erano fatti sta scritto per intero in REQ-STAFF-015). Si sceglie il mese; la tabella è divisa per SETTIMANE come il foglio, e ogni giorno porta tre numeri:

MINIMO (quanto doveva fare), INCASSATO (quanto ha fatto), DIFFERENZA.

SOTTO, I TOTALI DEL MESE: incassi, stipendi, spese, netto = incassi − spese − stipendi. Come nel foglio, con una differenza che pesa:

GLI STIPENDI SI CALCOLANO dalle ore già registrate nell'app (REQ-STAFF-006, ore × paga in vigore quel giorno), NON si ricopiano. Nel foglio quel numero viene battuto a mano da RAPP ORE, ed è già capitato che non torni: giugno 26, il foglio ore dà 3335 e ANALISI DATI dice 3500.

DUE RIGHE DI SINTESI che nel foglio non c'erano:

PRIME COST = costo del venduto + costo del lavoro, in percentuale sugli incassi; e COSTO DEL LAVORO %, il solo lavoro sugli incassi. Sono i due numeri con cui si capisce in mezzo secondo se il mese è andato.

DA DOVE ARRIVANO GLI ALTRI PEZZI: il MINIMO dalla formula decisa lo stesso giorno (REQ-STAFF-015 — somma delle paghe di chi lavora quel giorno più un extra a mano); le SPESE da REQ-CASSA-012, e senza quelle il netto del mese non esiste; l'INCASSATO per GIORNATA COMMERCIALE (REQ-CASSA-005), così la nottata che finisce alle tre resta la serata di ieri e non fa saltare il giorno dopo.

LE DIDASCALIE NON SONO UN ABBELLIMENTO: prime cost e costo del lavoro sono le due righe che questa tabella aggiunge al foglio, e sono anche le due che nessuno sa leggere senza che gliele si spieghi. Ognuna porta la sua frase, come vuole REQ-CASSA-010 — compresa quella che dice che la merce è quella calcolata dalle ricette e non gli acquisti del mese.

LA DIFFERENZA SI COLORA, MA NON DI ROSSO. In questa app il rosso vuol dire annullato o errore (DESIGN.md), e un giorno sotto il minimo non è né l'uno né l'altro: il verso lo dicono il segno e i colori di stato (--ok, --warn), che sono fuori tema apposta.

QUALE COSTO DELLA MERCE ENTRA NELLA PRIME COST: quello CALCOLATO DALLE RICETTE, macro per macro (REQ-MAG-015) — deciso dall'utente il 19/08. Non gli ACQUISTI del mese, che è il numero dei fogli di Flavio: è l'unico dei due che sta in pari con l'incassato dello stesso mese, e finché REQ-MAG-021 non è risolto un mese di acquisti non somiglia nemmeno al mese in cui quella merce è stata venduta. Va scritto sotto la tabella, così chi confronta col foglio sa in partenza perché non torna. Gli acquisti del mese restano dove stanno — la tabella «Acquisti × Fatturato» (REQ-MAG-022) — e con la prime cost non c'entrano.

DIPENDE DA REQ-CASSA-010 (la pagina), da REQ-CASSA-012 (senza le spese il netto del mese non esiste) e da REQ-STAFF-015 (senza il minimo restano due colonne su tre). Stipendi e costo del venduto invece ci sono già: REQ-STAFF-006 e REQ-MAG-015.

**Dove**: `src/components/BilancioTab.jsx (nuovo), src/lib/stats.js, src/lib/paghe.js, src/lib/ore.js`

#### REQ-CASSA-012 — Le spese del mese si scrivono nell'app, non su un foglio a parte

DECISO (19/08, dall'utente che riporta Flavio). Nei fogli mensili le SPESE sono una riga sola, battuta a mano, e senza quel numero il netto del mese non esiste: incassi − spese − stipendi. Serve un posto nell'app dove inserirle, altrimenti la tabella «Mesi» (REQ-CASSA-011) arriva fino a metà strada e poi si torna al foglio. COM'È FATTA UNA SPESA: voci semplici — descrizione, importo, mese. Niente categorie, niente allegati, niente partita doppia: quello che c'è nel foglio e non di più. Il totale del mese finisce nella riga «spese» di Bilancio → Mesi.

COSA NON SONO: non sono gli acquisti di merce, che vivono negli ordini fornitore e si contano da soli (REQ-MAG-022). Qui ci va l'affitto, la SIAE, il commercialista, le utenze — quello che esce e non entra in magazzino. Se le due cose si mescolano la merce viene contata due volte, e il netto del mese sbaglia in silenzio.

DA DEFINIRE IN IMPLEMENTAZIONE: se una spesa che si ripete (l'affitto è lo stesso tutti i mesi) si possa riportare sul mese dopo invece di riscriverla. Non è stato chiesto: si guarda dopo aver visto quante spese si scrivono davvero in un mese.

DIPENDE DA REQ-CASSA-010 per dove si scrivono e dove si sommano; la collezione e il modulo d'inserimento non aspettano nessun altro. È il primo pezzo da fare dei due che sbloccano REQ-CASSA-011.

**Dove**: `src/lib/api.js (collezione `spese`, nuova), src/components/BilancioTab.jsx (nuovo)`

### Stampa

#### REQ-STAMPA-003 — Il certificato della stampante non deve scadere ogni volta

L'avviso di sicurezza che costringe ad accettare a mano il certificato della stampante va eliminato alla radice: certificato con SAN corretto installato come attendibile sul dispositivo, oppure altra strada (Server Direct Print). Serve la verifica dal wifi del locale per decidere.

**Dove**: `scripts/certificato-stampante.js`

#### REQ-STAMPA-011 — Il logo sugli scontrini si sceglie: quale, e su quali stampe

Chiesto dall'utente il 19/08. Oggi il logo viene stampato in cima allo scontrino e basta: nessuno può spegnerlo, e per cambiarlo bisogna sostituire un file nel codice. Serve un'impostazione del locale con tre cose: se stampare il logo, SU QUALI stampe (comanda, preconto, scontrino, chiusura di cassa — sulla comanda al banco per esempio è solo carta consumata), e la possibilità di CARICARE l'immagine invece di cambiarla nel codice. Solo l'admin può toccarla: è l'identità del locale, non una preferenza del terminale. Da tenere a mente: la stampante termica vuole un'immagine in bianco e nero di una larghezza precisa, e il caricamento deve dire subito se quella scelta non va bene invece di stampare un rettangolo nero.

**Dove**: `src/lib/printer.js, src/components/SettingsTab.jsx, src/lib/api.js`

### Persone: ruoli, utenze, ore

#### REQ-STAFF-015 — Il minimo della serata: quanto deve fare stasera, e quanto ha fatto

COSA FANNO I FOGLI (verificato). In ANALISI DATI.xlsx ogni mese ha un foglio suo, diviso in settimane, e per ogni giorno tre righe:

MINIMO (quanto quel giorno deve fare), REALE (quanto ha fatto), RAPP. = REALE − MINIMO. In fondo al mese:

STIPENDI, SPESE, INCASSI (somma dei REALE delle cinque settimane), il netto = INCASSI − SPESE − STIPENDI, e la somma degli scarti.

IL MINIMO NON È CALCOLATO. Tutte le celle MINIMO sono numeri battuti a mano: in nessuno dei diciotto fogli mensili c'è una formula. Cambia per giorno della settimana (gennaio 2026: giovedì 300, venerdì 600, sabato 600, domenica 300, lunedì 100, martedì 100, mercoledì 150) e cambia da mese a mese. Accanto c'è un'etichetta di testo — «MEDIA 2450 €/w» — che è l'obiettivo settimanale: nei mesi vecchi coincide con la somma dei minimi della settimana (feb, mar, apr, set, ott 2025 e feb 2026), nei mesi recenti no (gen, apr, mag, giu, lug 2026), segno che l'etichetta non viene aggiornata insieme ai minimi.

DA DOVE VIENE LA RIGA STIPENDI: da RAPP ORE.xlsx, dove ogni persona ha le ore del mese × la paga oraria, e il totale finisce a mano in ANALISI DATI. Torna in quasi tutti i mesi provati (gen 26 800 + 700 = 1500; dic 25 650 + 750 + 160 = 1560; apr 26 650 + 800 + 170 = 1620; mag 26 850 + 750 + 575 = 2175) e NON torna in giugno 26, dove il foglio ore dà 3335 e ANALISI DATI dice 3500: qualcuno ha arrotondato.

COME SONO FATTE LE ORE E LE PAGHE: una griglia con le ore in riga (dalle 9-10 alle 04-05) e i giorni in colonna, una casella per ogni ora lavorata; in fondo, per persona, giorni = ore / 8, ore totali, €/h, totale = ore × €/h. Le tariffe viste: 6,25 €/h quasi per tutti, 5 €/h per gli extra, in passato 7,50 / 8,75 / 5,625 / 4,375. Sono tutte tariffe GIORNALIERE divise per 8 (50, 40, 60, 70, 45, 35 € al giorno): il locale ragiona a giornate, non a ore.

QUELLO CHE NON C'È, e che non va inventato. Nessun foglio calcola il minimo dalle paghe. L'ipotesi di chi ha chiesto questo lavoro — «i minimi dipendono dalle paghe orarie, più un extra che credo decida Flavio» — non è né confermata né smentita dai file: quella relazione non esiste in nessuna cella. Nei fogli il minimo resta un numero scritto a mano, e questo non cambia: cambia da dove lo prende l'app.

DECISO (19/08, dall'utente che riporta Flavio):

LA FORMULA È QUESTA — minimo del giorno = somma delle paghe di chi lavora quel giorno (ore × €/h, persona per persona) + un EXTRA messo a mano. Non è più un'ipotesi, è la regola con cui il minimo si calcola: la domanda scritta qui sopra è chiusa, e l'ipotesi era quella giusta. Il primo addendo l'app ce l'ha già per intero (REQ-STAFF-006), quindi non si ricopia da nessuna parte — nel foglio invece si ricopia, ed è già capitato che non torni. L'EXTRA:

COME SI METTE, deciso dall'utente il 19/08. «Un valore che può inserire l'admin per ogni giorno, o una serie che può essere impostata su tutte le settimane del mese». Quindi DUE STRADE, e la seconda è quella che si userà quasi sempre:

1) SUL SINGOLO GIORNO — l'admin scrive l'extra di quel giorno, e vince su tutto il resto. È il sabato della festa, la sera dell'evento;

2) UNA SERIE SETTIMANALE stesa su tutto il mese — sette valori, uno per giorno della settimana, che si applicano a tutte le settimane del mese in un colpo. È come ragiona il foglio, dove i minimi cambiano per giorno della settimana e restano uguali di settimana in settimana (gen 26: gio 300, ven 600, sab 600, dom 300, lun 100, mar 100, mer 150).

CHI VINCE: il valore del giorno sulla serie, sempre. Uno si prende la briga di scrivere il singolo giorno solo quando quel giorno è diverso, e se la serie lo sovrascrivesse quel gesto sarebbe inutile. Va scritto dove si calcola, non lasciato all'ordine in cui si leggono i dati. E SOLO L'ADMIN LO TOCCA: è un numero su cui si misura il lavoro di chi sta in sala, e non è roba da turno.

COSA HA GIÀ L'APP: le ore e le paghe per intero, storicizzate (REQ-STAFF-006), e l'incasso per giornata commerciale (REQ-CASSA-005). Manca il minimo, manca il confronto, manca l'obiettivo settimanale, e mancano le spese del mese — che nel foglio sono una riga sola battuta a mano, non un elenco.

DOVE SI VEDE. Il minimo e il confronto con quello che si è fatto stanno nella tabella «Mesi» della pagina Bilancio (REQ-CASSA-011), giorno per giorno: minimo, incassato, differenza. Nella schermata della serata, accanto all'incasso, quanto manca o quanto avanza. L'obiettivo settimanale si somma dai minimi dei sette giorni invece di essere scritto a parte, così non può più restare indietro come l'etichetta «MEDIA 2450 €/w» del foglio.

PROPOSTA (non è una sua parola): siccome il minimo nasce dalle ore, un giorno futuro ha un minimo solo dove i turni sono già programmati. Dove non lo sono il numero non si mostra, invece di mostrarne uno finto: un obiettivo inventato non lo insegue nessuno.

LE SPESE DEL MESE, che nel foglio sono una riga sola battuta a mano, vivono per conto loro in REQ-CASSA-012: senza quelle il netto del mese non esiste.

DIPENDE DA REQ-CASSA-011 per il posto dove il minimo si legge giorno per giorno, e quella a sua volta dalla pagina REQ-CASSA-010. La formula invece non aspetta nessuno: è decisa, e ore e paghe l'app le ha già per intero (REQ-STAFF-006).

**Dove**: `src/lib/stats.js, src/components/StatsTab.jsx, src/components/StaffHoursTab.jsx`

### Sicurezza

#### REQ-SIC-003 — App Check anche sull'ambiente di test

Oggi test gira senza App Check e con la chiave reCAPTCHA della produzione, che per il suo dominio non è valida. Se un giorno serve protezione anche lì: chiave dedicata, segreto registrato nel progetto di test e valore nella GitHub Environment "test".

**Dove**: `infrastruttura`

### Intelligenza artificiale

#### REQ-AI-001 — Scansione delle fatture d'acquisto con l'AI

Da una foto o un PDF della fattura fornitore ricavare righe, quantità, costi e IVA, da rivedere prima di registrare. Nelle impostazioni si abilita la scansione e si sceglie il servizio (Claude, ChatGPT, Gemini): o il nostro backend, o la propria API key, con le barre dei limiti di utilizzo. Si parte da Claude e ChatGPT. Il carico automatico in magazzino si valuta dopo.

**Dove**: `functions/, src/components/InvoicesTab.jsx`

### Come si lavora al progetto

#### REQ-DEV-005 — Alzare il cricchetto della coverage, e standard di complessità nel lint

Il cancello ora misura TUTTO il codice di prodotto, con una soglia per area tarata sul misurato del 16/08: functions/lib 92/76/88, src/lib 64/74/62, componenti 40/72/43, pagine 17/52/16 (src/dev è fuori: attrezzi, non prodotto). Le soglie basse — pagine su tutte — non certificano qualità: impediscono di peggiorare. Questo requisito è il lavoro di ALZARLE: coprire la logica delle pagine (BartenderPage e MenuPage in testa) e portare il cricchetto su. Insieme, gli standard di complessità nel lint (complexity, max-depth, dimensione delle funzioni): prima come avvisi per vedere dove siamo, poi come errori — i numeri esatti si decidono guardando il misurato, non a tavolino.

**Dove**: `vitest.config.mjs, eslint.config.js`

## Difetti noti

I punti in cui il sistema **non fa** quello che c'è scritto sopra. Stanno
in `requirements/bugs.yaml`, e sono qui perché una specifica che tace i
guai conosciuti fa sembrare garantito quello che non lo è. Quando uno viene
sistemato passa a `fixed` nel registro e sparisce da questo elenco: la prova
della correzione è il test citato nel requisito della sua area.

| | Cosa non va | Quanto fa male | Quando |
|---|---|---|---|
| 🔴 | [BUG-001](#bug-001--in-produzione-ladmin-vede-missing-or-insufficient-permissions-sulla-coda) — In produzione l'admin vede «Missing or insufficient permissions» sulla coda | bloccante | P1 |
| · | [BUG-029](#bug-029--il-magazzino-si-legge-da-una-porta-e-si-scrive-da-sette-finestre) — Il magazzino si legge da una porta e si scrive da sette finestre | grave | P1 |
| · | [BUG-030](#bug-030--il-menù-del-cliente-decide-da-solo-come-si-consegna) — Il menù del cliente decide da solo come si consegna | grave | P1 |
| · | [BUG-035](#bug-035--nel-facsimile-dello-scontrino-lintestazione-non-è-centrata-come-sulla-carta) — Nel facsimile dello scontrino l'intestazione non è centrata come sulla carta | lieve | P3 |
| 🔴 | [BUG-038](#bug-038--sulla-pwa-android-le-notifiche-arrivano-solo-accendendo-lo-schermo) — Sulla PWA Android le notifiche arrivano solo accendendo lo schermo | media | P2 |
| 🔴 | [BUG-043](#bug-043--due-nomi-con-la-stessa-iniziale-e-in-legenda-ne-resta-uno-solo) — Due nomi con la stessa iniziale, e in legenda ne resta uno solo | — | — |

🔴 succede **in produzione**, cioè al banco. `·` no. `?` non si sa ancora.

### I difetti, uno per uno

#### BUG-001 — In produzione l'admin vede «Missing or insufficient permissions» sulla coda

Banner giallo d'errore in cima alla coda «In servizio» e coda vuota (0 aperti · 0 chiusi) per l'utente admin. Analisi del 14/08: il banner ha una sola sorgente, l'onError di subscribeActiveOrders — ma la collection orders è in lettura pubblica, quindi con le regole del repo quel deny è impossibile. Candidati, in ordine: (1) App Check/reCAPTCHA che non rilascia il gettone (incidente identico già documentato nei commenti di scripts/appcheck.js e scripts/recaptcha-domini.js: nega tutto, anche le collection pubbliche, e dipende dal dispositivo o dal dominio, non dal ruolo); (2) regole live in produzione diverse dal repo (prima del commit f8cd5ed il ruolo admin era rifiutato ovunque tranne che su orders); (3) banner che non si azzera mai una volta comparso, quindi basta una scrittura fallita per tenerlo fisso tutta la sessione. Verifiche in sola lettura: diagnostica-permessi.js (non passa da App Check: se lì è verde e il browser no, è App Check), appcheck.js e recaptcha-domini.js, confronto rules live/repo. Da chiedere: succede su tutti i dispositivi o solo su uno? Comunque vada, la fix collaterale è azzerare il banner al primo snapshot buono e loggare gli errori dei listener oggi silenziati.

**Dove**: `src/lib/firebaseClient.js (App Check), firestore.rules, src/pages/BartenderPage.jsx`

#### BUG-029 — Il magazzino si legge da una porta e si scrive da sette finestre

Trovato dalla rilettura del diff della 1.5.0. La lettura tollerante del modello vecchio (`articoloNormalizzato`) è applicata in un punto solo, `mapItem`. Tutti i percorsi di SCRITTURA rileggono il documento grezzo e ragionano ancora col modello vecchio, e il controllo «prima aggiorna il magazzino» (`ATTESA_TRAVASO`) è stato copiato a mano in due casi su sette: ce l'hanno il carico e la conta, non ce l'hanno `receiveBottles`, `receivePurchaseOrder`, l'allineamento d'ordine e lo scarico delle comande. Il buco concreto: da Acquisti → «ricevi ordine» si scrive su un magazzino non ancora aggiornato, e quella schermata non è bloccata perché il blocco vive dentro `InventoryManager`.

COME SI SISTEMA: una `leggiArticoloPerScrittura(ref)` sola, che rilegge, controlla e restituisce l'articolo — e il blocco «in sola lettura» derivato dallo stato del travaso, non ricostruito nella schermata che se lo ricorda. Finché è una riga da ricopiare, ogni percorso nuovo nasce senza.

**Dove**: `src/lib/api.js, src/components/PurchaseOrdersPanel.jsx`

#### BUG-030 — Il menù del cliente decide da solo come si consegna

Trovato dalla rilettura del diff della 1.5.0. `consegna.js` dice che i mondi sono due e che `'banco'` è un valore vecchio da leggere con tolleranza; il conto, le impostazioni e il riepilogo sono stati portati lì, il MENÙ DEL CLIENTE no: legge ancora `service_mode` grezzo in quattro punti (tabellone, ETA, etichette). Conseguenza: un locale storicamente `'banco'` mostra una colonna sola; basta che un admin apra Impostazioni → Consegna e tocchi qualunque cosa perché il valore diventi quello nuovo e il tabellone del menù passi a due colonne, senza che nessuno abbia deciso niente sul menù. La migrazione del valore vecchio funziona in tre schermate su quattro, e la quarta è quella che vede il cliente.

**Dove**: `src/pages/MenuPage.jsx`

#### BUG-035 — Nel facsimile dello scontrino l'intestazione non è centrata come sulla carta

Segnalato dall'utente il 18/08 dopo BUG-034: le righe non vanno più a capo, ma l'intestazione (il nome del locale spaziato, l'indirizzo, il totale in grande) non risulta centrata come esce dalla stampante — il blocco è spostato di qualche carattere. Sospetto: il centraggio del testo lo fa la stampante con un suo comando (`addTextAlign`), mentre nel facsimile il testo arriva già impaginato e viene messo in un `pre` allineato a sinistra: le righe che la stampante centrerebbe da sé restano dove sono. Non urgente e detto dall'utente stesso: è una finestra di prova, la carta vera esce giusta. Si sistema quando si passa di lì.

**Dove**: `src/lib/stampanteFinta.js`

#### BUG-038 — Sulla PWA Android le notifiche arrivano solo accendendo lo schermo

Segnalato dall'utente il 19/08: sull'app installata su Android le notifiche non arrivano in tempo reale — restano ferme finché non si accende lo schermo. Al banco vuol dire che una chiamata dalla sala arriva quando ormai non serve più.

DIAGNOSI (19/08), e in buona parte non dipende da noi.

LA PRIORITÀ È GIÀ ALTA: tutte le push allo staff partono con `webpush: { headers: { Urgency: 'high' } }` — nuovo ordine e pronto con TTL 600, la chiamata con TTL 180 (functions/index.js). Lì non c'è niente da guadagnare: l'ipotesi «mandiamo una notifica normale» è esclusa. Quello che resta è il risparmio energetico di Android sull'app installata: a schermo spento il sistema sospende la consegna e la rilascia quando il telefono si sveglia. Non è una cosa che si corregge nel codice — si toglie l'ottimizzazione batteria per il browser/la PWA dalle impostazioni del telefono. Da dire all'utente così com'è, invece di inseguire una correzione impossibile. C'È PERÒ UN NOSTRO DIFETTO LATENTE, che si vedrà appena BUG-036 sarà risolto: in public/sw.js la notifica «drink pronti da servire» viene SALTATA se una finestra su /bar risulta `w.focused || w.visibilityState === 'visible'`. È un OR, cioè il controllo più largo possibile: un telefono lasciato aperto sulla coda con lo schermo spento può restare `focused`, e in quel caso la notifica non viene mostrata affatto. Va stretto a una sola condizione, la visibilità.

NON RIPRODOTTO: in locale le push non si provano (niente emulatore FCM, service worker non registrato in sviluppo). 19/08 — il difetto del service worker è CORRETTO (è andato con BUG-036: si guarda la visibilità, non il fuoco, e ora public/sw.js ha i suoi test). Resta aperto solo quello che non dipende da noi: il risparmio energetico di Android. Da chiudere con l'utente dopo il deploy, provando col telefono in mano.

**Dove**: `public/sw.js, functions/lib/push-core.js`

#### BUG-043 — Due nomi con la stessa iniziale, e in legenda ne resta uno solo

Trovato il 19/08 scrivendo i test di REQ-CODA-005: il caso e' saltato fuori da solo perche' nei dati di prova c'era gia' una MARTA, e il MARCO che stavo aggiungendo non compariva.

IL DIFETTO E' VECCHIO QUANTO LA LEGENDA e non nasce dalle presenze: la legenda raccoglie le iniziali in una mappa lettera -> nome, e se due persone hanno la stessa iniziale la seconda non entra. Marta batte un conto, Marco ne batte un altro: in legenda c'e' solo «M — Marta», e i conti di Marco portano una M che dice il nome sbagliato.

QUANTO FA MALE: non si perde nessun dato — sulla card resta scritto chi ha battuto — ma la legenda MENTE, e mente proprio su «di chi e' questo conto», che e' l'unica domanda a cui serve rispondere. In una sera con Marco e Marta, o con Sara e Simone, chi guarda attribuisce conti alla persona sbagliata.

NON L'HO RISOLTO IN QUEL GIRO perche' non era quello che si stava facendo, e perche' la cura tocca anche la lettera SULLE CARD (placedByLetter): metterne una in legenda e un'altra sulle card sarebbe peggio del difetto.

TRE STRADE, da pesare quando si lavora: due lettere quando la prima collide (Ma / Mo), il nome intero in legenda con la sola lettera sulle card, oppure un colore per persona come si e' fatto per i conti. La prima e' la piu' piccola e la piu' vicina a come si legge oggi.

**Dove**: `src/pages/BartenderPage.jsx (legenda), src/lib/presenza.js, src/lib/orderStatus.js (placedByLetter)`

## Non più valido

Voci che descrivevano il sistema e non lo descrivono più. Restano nel
registro perché cancellarle vorrebbe dire riproporle fra sei mesi come idee
nuove, ma **non sono specifica**: qui c'è solo il titolo.

- `REQ-MENU-012` — In carta due tipi di voce: il prodotto e la ricetta
