# Cosa fa Tana Drink

> Generato da `requirements/requirements.yaml` con
> `node scripts/requisiti.mjs --documento`. Non si modifica a mano:
> si modifica il file dei requisiti.

Alla data di generazione: **93 requisiti**.

| | Quanti | Cosa vuol dire |
|---|---|---|
| ✅ | 73 | fatto e coperto dai test |
| ⚠️  | 15 | fatto ma nessun test lo verifica |
| ⬜ | 5 | da fare |

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

La coda smista i conti per stato, conta e somma solo i non annullati e sa dire quanti conti sono ancora aperti. Con la gestione della preparazione attiva un conto pagato ma non servito resta da fare; senza, il pagamento chiude e basta.

*Dove*: `src/lib/coda.js`

*Lo dimostrano*: `tests/unit/coda.test.js`

## Cassa e POS

### ✅ REQ-POS-001 — L'ordine nasce al primo prodotto, senza cambiare schermata

Toccando il primo prodotto il conto viene creato in place: niente navigazione, niente ricaricamento, la schermata resta quella e da lì si continua come in modifica. Il nome del cliente si chiede all'uscita, una volta sola.

*Dove*: `src/components/OrderPosDetail.jsx, src/pages/PosPage.jsx`

*Lo dimostrano*: `tests/component/PosPage.test.jsx`

### ✅ REQ-POS-002 — Niente si perde mentre l'ordine sta nascendo

La creazione dura qualche decimo di secondo e in quei decimi al banco si continua a battere: le righe aggiunte nel frattempo devono finire nello stesso conto, senza sparire e senza far nascere un secondo conto. La bozza cambia chiave quando il conto nasce, e le righe rimaste vanno passate alla chiave nuova.

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

## Pagamenti

### ✅ REQ-PAG-001 — Incasso in contanti, carta o acconto, anche senza rete

Il conto si chiude subito a schermo e la scrittura va in coda: contanti, carta e acconti non aspettano il server. Un conto già pagato viene rifiutato subito, non dopo un timeout di rete. Il metodo scelto resta scritto sull'incasso: serve alla chiusura di cassa e allo scontrino.

*Dove*: `src/components/PaymentScreen.jsx, src/lib/api.js`

*Lo dimostrano*: `tests/unit/incassoOffline.test.js`, `tests/component/PaymentScreen.test.jsx`, `tests/unit/pagamento.test.js`, `tests/unit/payments.test.js`, `tests/unit/payment-core.test.js`

### ✅ REQ-PAG-002 — Il tasto Pagamento dice quanto resta da incassare

Sul tasto è scritta la cifra da incassare al netto di sconti e acconti già presi, e resta scritta anche dopo che l'ordine è stato creato. A conto saldato la cifra sparisce, perché non c'è più niente da incassare.

*Dove*: `src/components/OrderPosDetail.jsx`

*Lo dimostrano*: `tests/component/OrderPosDetail.test.jsx`

### ✅ REQ-PAG-003 — Sconto sul conto, con tre strategie a scelta

Lo sconto si applica dal tastierino e si può impostare come tetto al totale, come proporzione sulle righe o come semplice avviso; la strategia si sceglie nelle impostazioni (default: tetto al totale). Le statistiche e il rendiconto devono sempre scorporare lo sconto, mai mostrare il prezzo di listino come venduto.

*Dove*: `src/lib/pricing.js, src/components/SettingsTab.jsx`

*Lo dimostrano*: `tests/unit/pricing.test.js`, `tests/component/PaymentScreen.test.jsx`

### ✅ REQ-PAG-004 — Lettore SumUp: pairing e incasso con carta

Il lettore si associa con un codice di pairing (riservato a chi sta al banco); da lì si incassa con carta direttamente dall'app. Il webhook verifica l'esito tramite la Transactions API prima di segnare il conto pagato.

*Dove*: `functions/lib/payment-service.js, src/lib/paymentsApi.js`

*Lo dimostrano*: `tests/bdd/payment-reader.test.js`

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

## Cassa di serata e statistiche

### ✅ REQ-CASSA-001 — La giornata di lavoro finisce dopo la mezzanotte

La serata appartiene al proprio giorno anche dopo la mezzanotte, fino all'ora di taglio configurata: un drink servito all'una di notte è della serata precedente. L'ora di taglio è un'impostazione (0 = giorno solare).

*Dove*: `src/lib/businessDay.js`

*Lo dimostrano*: `tests/unit/businessDay.test.js`

### ✅ REQ-CASSA-002 — Apertura e chiusura cassa, con fondo e conteggio

La cassa si apre con un fondo e si chiude con il riepilogo della serata: incassato per metodo e per ora, conti chiusi, conti ancora da incassare. Senza cassa aperta non si battono ordini.

*Dove*: `src/lib/cassa.js, src/components/CashFlow.jsx`

*Lo dimostrano*: `tests/unit/cassa.test.js`

### ✅ REQ-CASSA-003 — La carta non finisce mai nei contanti

Il contante atteso in cassa conta solo il contante. Ogni metodo è contato col suo nome, anche uno mai visto prima, e i metodi noti compaiono sempre, pure a zero. Le chiusure vecchie senza metodo indicato restano contate come contanti.

*Dove*: `src/lib/cassa.js`

*Lo dimostrano*: `tests/unit/cassa.test.js`

### ✅ REQ-CASSA-004 — Rendiconto della serata: ordini e prodotti venduti

Il rendiconto mostra gli ordini (in lista o in tabella, apribili nel dettaglio) e il cumulativo per prodotto e categoria, con sconto e guadagno per ordine. I prezzi sono quelli VENDUTI, al netto degli sconti, non il listino.

*Dove*: `src/lib/rendiconto.js, src/components/RendicontoSerata.jsx`

*Lo dimostrano*: `tests/unit/rendiconto.test.js`

### ✅ REQ-CASSA-005 — Statistiche per serata, con tempi e margini

Statistiche per serata: incassi, prodotti più venduti, tempi di preparazione e consegna misurati, preparazione più lunga. I tempi misurati raffinano progressivamente la stima mostrata al cliente.

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

*Lo dimostrano*: `tests/unit/inventory.test.js`

### ✅ REQ-MAG-003 — Le scorte si scalano quando il drink si fa

Passando una comanda in preparazione si scalano gli ingredienti secondo le ricette, salvando lo snapshot del consumo sulla comanda: serve per stornare in caso di annullo e per non scalare due volte. Il magazzino che non risponde non blocca la comanda: viene segnata come non scaricata e si recupera dopo.

*Dove*: `src/lib/inventory.js computeConsumption, src/lib/api.js`

*Lo dimostrano*: `tests/unit/inventory.test.js`, `tests/unit/incassoOffline.test.js`

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

### ✅ REQ-MAG-009 — Macro-categorie: il magazzino letto per famiglie

Le categorie di magazzino si raggruppano in macro-categorie (distillati, birre, bibite…): servono a leggere consumi, valore e margini per famiglia invece che articolo per articolo, e a capire dove se ne va il denaro.

*Dove*: `src/lib/macros.js, src/lib/macroStats.js, src/components/MacroCategoryManager.jsx`

*Lo dimostrano*: `tests/unit/macros.test.js`, `tests/unit/macroStats.test.js`

## Menù e catalogo

### ⚠️  REQ-MENU-001 — Il menù dice se un drink si può fare

Ogni voce del menù mostra la disponibilità con gli stessi colori dell'inventario: verde si può fare, arancione un ingrediente sta finendo, rosso spento a mano o ingrediente esaurito.

*Dove*: `src/components/MenuManager.jsx, src/lib/inventory.js`

*Nessun test lo verifica.*

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

L'admin fa tutto quello che fa il bartender e in più nomina i ruoli; il bartender ha il gestionale completo; lo staff di sala vede solo i drink pronti da servire; il cliente il menù e i propri ordini. Il ruolo vive nei claim del token e le regole del database guardano quello.

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

Dal gestionale si chiama un membro dello staff con un messaggio: il suo dispositivo vibra con insistenza finché non risponde.

*Dove*: `src/components/StaffCallList.jsx, functions/lib/push-core.js`

*Lo dimostrano*: `tests/bdd/notify-staff-call.test.js`

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

### ⚠️  REQ-STAMPA-004 — Chiusura di cassa stampata con tutti i metodi

Lo scontrino di chiusura riporta gli incassi divisi per metodo di pagamento, elencando quelli davvero usati e non un elenco fisso.

*Dove*: `src/lib/printer.js`

*Nessun test lo verifica.*

## Notifiche

### ✅ REQ-NOTIF-001 — Il cliente sa quando il suo drink è pronto

Quando una comanda passa a pronto, al cliente arriva una notifica; idem quando il suo ordine viene annullato, con la frase scelta da chi lo annulla.

*Dove*: `functions/lib/push-core.js decideOrderPush`

*Lo dimostrano*: `tests/bdd/notify-order.test.js`

### ✅ REQ-NOTIF-002 — Il banco sa quando arriva un ordine nuovo

Un ordine nuovo — o un'aggiunta a un conto esistente — avvisa il banco. Non avvisano gli ordini battuti al banco stesso: chi li ha appena inseriti non ha bisogno che glielo dicano.

*Dove*: `functions/lib/push-core.js decideNewOrderStaffPush`

*Lo dimostrano*: `tests/bdd/notify-order.test.js`, `tests/unit/push-comande.test.js`

### ✅ REQ-NOTIF-003 — La sala sa cosa c'è da servire

I drink pronti da portare avvisano la sala, non il banco: al bartender sarebbero rumore, visto che è lui a segnarli pronti.

*Dove*: `functions/lib/push-core.js decideStaffServePush`

*Lo dimostrano*: `tests/bdd/notify-staff-call.test.js`

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

## Interfaccia

### ✅ REQ-UI-001 — Le sottosezioni di una pagina stanno sotto il titolo

Quello che si fa ogni tanto (paghe, un turno a mano, le categorie, la marginalità) sta in una fila di tasti subito sotto il titolo, e si apre lì: uno alla volta, e il contenuto si monta solo all'apertura.

*Dove*: `src/components/SectionPanels.jsx`

*Lo dimostrano*: `tests/component/SectionPanels.test.jsx`

### ✅ REQ-UI-002 — Impostazioni a schede, una per riquadro

Le impostazioni sono ventuno riquadri: sono voci di una barra laterale e se ne apre una alla volta, con la scelta ricordata. Erano una pagina lunghissima da scorrere a occhio.

*Dove*: `src/components/SettingsTab.jsx`

*Lo dimostrano*: `tests/component/SettingsTab.test.jsx`

### ✅ REQ-UI-003 — Sul telefono la barra ha il tasto, il titolo e due azioni

In barra ci stanno il menu, il logo col nome, la campanella e i tre puntini; tutto il resto sta nel menu dal basso, con bersagli da 44px. Chi è collegato si riconosce dall'iniziale nel quadratino, la stessa che marca gli ordini che ha aperto.

*Dove*: `src/App.jsx, src/components/ActionSheet.jsx`

*Lo dimostrano*: `tests/component/StaffDrawer.test.jsx`

### ✅ REQ-UI-004 — Zoom della pagina per chi ci lavora ore

Nella PWA a tutto schermo il browser non offre lo zoom: l'app ha il suo, che scala la pagina senza deformarla. Sul telefono non flotta sull'angolo (dove finiva sopra i tasti) ma sta nella testata del conto.

*Dove*: `src/components/ZoomControl.jsx`

*Lo dimostrano*: `tests/component/ZoomControl.test.jsx`

### ✅ REQ-UI-005 — Temi chiari e scuri, per il gestionale e per il cliente

Si scelgono due temi distinti: uno per le schermate di lavoro e uno per la vista cliente. I colori di stato restano leggibili su entrambi.

*Dove*: `src/lib/themes.js, src/components/ThemeSettings.jsx`

*Lo dimostrano*: `tests/unit/themes.test.js`, `tests/unit/themes-dom.test.js`

### ✅ REQ-UI-006 — L'app segue chi guarda, non l'indirizzo

La barra in cima è la stessa su ogni schermata — menu, logo col nome e, a destra, chi è collegato — e il menu laterale risponde a tutti: allo staff il gestionale, a chi ordina il suo (menù, i propri ordini, accesso e profilo). Fanno eccezione le due schermate in cui si compone un conto, dove non c'è menu e si esce con «← Ordini». Anche i colori seguono il ruolo: chi lavora vede il tema del gestionale ovunque, profilo e accesso compresi; chi ordina vede il suo, e così l'anteprima «vista cliente».

*Dove*: `src/App.jsx, src/components/ClientDrawer.jsx`

*Lo dimostrano*: `tests/component/AppHeader.test.jsx`

### ⚠️  REQ-UI-007 — La testata della coda sta su una riga sola

Nella coda a griglia titolo, ricerca, ⋯ e ➕ stanno tutti sulla stessa linea, alti uguale; conteggi e legenda degli autori vanno sulla riga sotto. Prima i conteggi stavano dentro il titolo, il titolo cresceva in altezza e ognuno degli altri si centrava a un'altezza diversa.

*Dove*: `src/pages/BartenderPage.jsx, src/index.css`

*Nessun test lo verifica.*

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

### ⚠️  REQ-DEV-003 — Changelog delle versioni, leggibile anche dall'app

Ogni versione rilasciata ha le sue note in CHANGELOG.md, e le stesse note si leggono dentro l'app in Impostazioni → Informazioni, insieme ai dati tecnici (versione, ramo, commit, ambiente, progetto). Chi usa l'app deve poter sapere cosa è cambiato senza chiederlo a chi l'ha scritta.

*Dove*: `CHANGELOG.md, src/components/InfoTab.jsx`

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
