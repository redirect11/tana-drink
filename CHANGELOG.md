# Cosa è cambiato

## Non ancora rilasciata — 1.5.0

### Sotto il cofano

- **Il database di prova nasce completo**: ogni articolo ha costo e IVA
  d'acquisto (così margini e prezzo consigliato hanno da lavorare) e ci sono
  quattro utenze, una per ruolo — admin, bartender, sala, cliente — con
  password `collaudo123`.

### Al banco

- **Chi ha il ruolo bartender ha una coda sua: quella del LAVORO.** Chi prepara
  non lavora un conto per volta, lavora un ticket per volta — e adesso ogni
  card è una comanda, col numero del conto e (solo se il conto ne ha più d'una)
  il numero della comanda, e il tasto fa avanzare quella lì, non tutto il
  conto. Si apre da sé: ad accenderla sono **gli stati del servizio** — se
  sono spenti quella coda non esiste, perché non ci sarebbe niente da mostrare,
  e al banco si vede la coda come la vedono tutti. Come disegnarla si sceglie in
  Impostazioni → Coda ordini → «La vista del banco», accanto alla vista della
  coda: per ora c'è «🚦 Corsie di stato», e da lì passeranno le prossime.
- **La coda di chi guarda la serata non cambia**: con «corsie di stato» l'admin
  vede sempre i conti in corso, chiusi e annullati. Se vuole sapere a che punto
  è la preparazione c'è la pastiglia «🍸 Comande», che porta a guardare il
  lavoro come il bartender — a mano, e solo su quel terminale.
- **Al banco le colonne si scelgono**: «▦ Colonne» spegne quelle che in quel
  momento non servono — «Da incassare» compresa, che chi sta allo shaker non
  incassa — e ne accende due per guardare indietro, «Chiuse» e «Annullate».
  È una scelta di quel terminale: al banco e alla cassa non si guardano le
  stesse cose, e si ritrova al ricarico.
- **Le colonne si chiamano come gli stati**: «In preparazione» al posto di «Al
  banco», «Ritiro/Servizio» al posto di «Al ritiro», e il tasto che ci porta
  dice la stessa parola — «In preparazione», non «Lo preparo io». Al banco c'è
  in più la colonna **«Ritirato/Servito»**: il lavoro finito si deve vedere
  finito, anche quando il conto è ancora da incassare.
- **Un acconto si vede dalla card**: il bollo «💳 Acconto» e la striscia
  arancione, come nella griglia. Senza, chi porta il conto al tavolo chiede
  l'intero — ed è già successo.
- **Un conto pagato in anticipo non sparisce dal banco**: la sua comanda resta
  nella colonna del suo passo, col bollo «Pagato» e la card accesa, perché i
  soldi ci sono ma il drink è ancora da fare. Una comanda risulta chiusa solo
  dopo essere stata servita.
- **Si può preparare mezza comanda.** Capita di vedere tre gin tonic in una
  comanda e due in un'altra e prepararli insieme, per farli uscire in una
  volta: nel conto → Comande, su una comanda ancora «da fare», c'è
  «✂️ Preparazione parziale». Si sceglie quanti se ne fanno adesso: quelli
  vanno al banco in una comanda nuova, il resto resta da fare, e la comanda di
  prima resta nella storia del conto, segnata «divisa» — così la copia già
  stampata ha ancora un riscontro e non si perde per strada un drink. Fra gli
  annullati non compare: quei drink non sono saltati, sono le due comande
  nate al loro posto.
- **Aprendo il conto si vede cosa è al banco e cosa è già uscito**: le righe si
  raggruppano sotto «In preparazione», «Pronto», «Servito», come già accade
  per quelle pagate. Con una comanda sola — il caso normale — non cambia
  niente: nessun titolo per dire una cosa sola.
- **I tasti sopra la lista si possono ridurre**: «Unisci», «Dati conto» e
  «Prodotto libero» sono tre righe di schermo prese alla lista dei drink, e col
  «▴» accanto ai ⋯ si tolgono di mezzo — restano tutti nel ⋯, e «Comande» resta
  comunque a vista. La scelta è di quel terminale e si ritrova al ritorno. Nel
  ⋯ sono finite anche la storia del conto e «Svuota», che stavano fra i tasti
  che si premono di corsa: svuotare un conto è la cosa più irreversibile della
  schermata.
- **Il lucchetto della cassa adesso ha un nome.** Sugli schermi larghi era
  un'icona grigia in fondo alla barra e nessuno sapeva cosa fosse: adesso c'è
  scritto «🔒 Chiudi cassa» (o «🟢 Apri cassa»), e quando non si può chiudere
  il perché sta sotto quel tasto: «Prima chiudi 2 conti».
- **La coda ordini si può guardare a «Corsie di stato»** (Impostazioni → Coda
  ordini): quattro colonne — da fare, in preparazione, ritiro/servizio, da
  incassare — con in testa quanti conti ci sono e quanto fanno, e ognuna che
  scorre per conto suo. Su ogni card un tasto solo, quello del passo dopo: «In
  preparazione», «È pronto», «Ritirato/Servito», «Incassa». Il conto già pagato ma non ancora
  consegnato resta al ritiro col bollo «Pagato» — non sparisce prima di essere
  servito — e quelli da incassare mostrano la cifra in grande. Toccando la card
  si apre il conto, come sempre. Con gli stati di servizio spenti le corsie
  diventano le tre di sempre: in corso, chiusi, annullati.
- **Il flusso di cassa si allarga sugli schermi grandi**: le tessere si
  affiancano invece di incolonnarsi in una striscia da scorrere, e restano
  larghe solo l'andamento per ora e la chiusura. Sul telefono niente cambia.
- **Le ore della serata sono in ordine di serata**: le 8 del mattino dopo
  venivano prima delle 23 della sera, perché contava l'orologio e non la
  nottata. Quando una serata tocca due giorni, ogni colonna porta la data.
- **Un conto nuovo nasce «da fare»**, non già «in preparazione»: si battono
  tre conti di fila e poi si comincia a versare. È il tasto «In preparazione»
  a dire quando si comincia.
- **Un ordine può tornare indietro**: nelle azioni della card e nel dettaglio
  ci sono le pastiglie «↩︎ Torna a…» con tutti gli stati già passati — non
  solo il precedente. Prima, se si segnava «pronto» il conto sbagliato,
  restava solo annullarlo e ribatterlo.
- **Niente più doppione «Consegnato» / «Segna come Ritirato-Servito»** nelle
  corsie: erano lo stesso gesto a un dito di distanza.
- **Sulla stampa il lettore si chiama «SumUp»** e la carta «Carta di
  Credito»: chi confronta la chiusura con l'estratto conto cerca quel nome.
- **I conti lunghi si leggono su due colonne** (da dieci righe in su, dove lo
  schermo lo regge): stessa roba in metà altezza.
- **Le card delle corsie non crescono più a dismisura**: si vedono sei
  righe, le altre sfumano e un piccolo «▾ altre 12» le apre. Ogni riga porta
  il suo prezzo e la sua nota, e la nota del conto respira.
- **Sulle card «⋯ Azioni» e il tasto della corsia stanno sulla stessa riga**,
  invece di occupare due fasce larghe tutta la card.
- **Le note del conto si scrivono in un riquadro grande**: in una casella da
  una riga una frase si scriveva alla cieca.
- **Nella coda, su tablet e computer i tasti stanno fuori dal ⋯**: pannelli,
  verso della lista e cassa sono icone accanto alla ricerca, e si vede quando
  i pannelli sono accesi. Sul telefono restano nel menu, che lì lo spazio non
  c'è.
- **Su un conto chiuso o annullato ci sono due sole azioni**: ristampare lo
  scontrino e riaprire il conto. Prima c'erano anche «Contanti» e «Carta»
  spenti, che sono solo rumore addosso a chi cerca l'unica cosa che serve.
- **Nelle corsie il tasto «↕» inverte davvero l'ordine**, in tutte le
  colonne insieme: prima girava solo la griglia e lì non faceva niente.
- **Nel riquadro di riapertura i tasti dicono «Annulla» e «Riapri»**, due
  parole invece di due frasi che andavano a capo.
- **Nelle corsie di stato le card hanno «⋯ Azioni»**: incassare, stampare
  comanda o scontrino, annullare — le stesse azioni della coda, senza
  cambiare vista.
- **Le corsie prendono tutta la larghezza**: con gli stati di servizio
  spenti sono tre, e restavano schiacciate a sinistra.
- **L'andamento per ora è un grafico nel tempo**: una colonna per ora, da
  sinistra a destra, così si vede la forma della serata — il picco, la coda.
  Era una riga per ora, una sotto l'altra.
- **I metodi di pagamento stanno dentro «Incassato serata»**, non più in un
  riquadro a sé che non si capiva a quale numero appartenesse.
- **Da sloggati la campanella non c'è**: chi non è entrato è un cliente
  qualunque sulla parte pubblica, e gli avvisi parlano di ordini che non ha
  fatto. Spariscono anche «registra questo terminale» e lo storico, che sono
  cose del gestionale.
- **In coda le card non hanno più «Storia» e «Ripristina»**: una riga intera
  su ogni conto, tutta la sera, per due cose che si fanno ogni tanto. Si
  trovano dentro il conto, in «⋯ Azioni».
- **Unisci e separa sono una voce sola** anche nel menu ⋯, come il tasto in
  barra: mostra quella che si può fare adesso.
- **Sul telefono «svuota il conto» sta nel ⋯**, dove c'è posto per dirlo a
  parole invece che con la sola icona.
- **Uscendo, gli avvisi si cancellano**: erano di chi li ha ricevuti, e il
  telefono passato a un altro mostrava la serata di prima.

## 1.4.8 — in collaudo

### Sotto il cofano

- **Le issue nascono anche dai rami di rilascio**: un push che tocca i
  registri (requisiti e bug) apre quelle che mancano, senza duplicarle e
  senza chiuderne nessuna. Prima bisognava aspettare `main`.

### Al banco

- **La scheda prodotto parte da una domanda: che tipo è?** Quattro card —
  «Lo vendo intero», «Lo verso nei drink», «Sfuso, a peso o volume»,
  «Lavoro o servizio» — e ognuna mostra solo i suoi campi: spariscono la
  tendina delle unità a famiglie e la casella «è una scorta», che adesso
  le decide il tipo. Per chi versa, «una bottiglia fa…» va scritto per
  forza: senza, non si sa il costo al cl e il magazzino non scala quello
  che si versa — e la scheda si ferma spiegandolo. Le schede già salvate
  si riaprono da sole nel tipo giusto.
- **Un drink si duplica**: nelle azioni della card del menù c'è «📋
  Duplica». Si apre la scheda già piena, col nome marcato «(copia)»: la
  ricetta non si riscrive ingrediente per ingrediente. Si salva quando è
  pronta, e l'originale non si tocca.
- **Niente più cartello «I gruppi sono spenti»** in coda per chi i gruppi
  non li usa: resta solo a chi li ha accesi ma tenuti fuori dalla coda.
- **Uscendo, il telefono smette davvero di suonare**: si spegne il token
  degli avvisi di quel browser, non solo la riga nell'elenco dello staff.
  Prima continuavano ad arrivare le notifiche degli ordini del cliente.
  Rientrando si riaccende da sé.
- **«Esci» non resta più appeso** quando la rete non c'è.
- **I temi cambiano davvero tutta la schermata**: l'oro di casa era scritto
  a mano in una dozzina di posti — il tab acceso, il «+», i tasti dei
  pannelli, gli aloni del fondo — e quelli restavano dorati con qualunque
  tema.
- **Con gli stati di servizio spenti, la vista a schede ha tre schede**: In
  corso, Chiusi e Annullati — le stesse della griglia, con le stesse regole.
  Prima mostrava i cinque passi del lavoro, quasi tutti vuoti, e i conti
  stavano tutti sotto «Ordine ricevuto». Ricerca e «Miei» filtrano dentro la
  scheda in cui si sta.
- **Il database di prova si apre sulla griglia**, che è la vista di casa: il
  seed imponeva la vista a schede.
- **Una ricetta cambiata al volo non si dimentica più**: il gin buono messo
  a mano su una riga tornava quello di listino, col suo costo, se si usciva
  subito.
- **Battendo in fretta e uscendo subito non si perde più niente** (BUG-016):
  tre tap sullo stesso drink e via verso la coda ne lasciavano uno. Adesso
  quello che si è battuto parte nell'istante in cui si esce.
- **Il pagamento vede sempre tutto il conto, anche mentre il conto nasce**
  (BUG-017): battendo di corsa e aprendo subito il pagamento — o
  chiudendolo, battendo ancora e riaprendolo prima che il server
  rispondesse — si vedeva solo il primo giro di righe, e chiudendo il
  pagamento il conto restava vuoto a schermo. Adesso il pagamento legge il
  conto com'è a schermo, le righe battute mentre l'ordine nasceva lo
  raggiungono da sole, e un prezzo o una ricetta ritoccati in quell'attimo
  non tornano più di listino.
- **Aprendo un prodotto si legge quanto ce n'è, per primo**: dove si conta a
  pezzi lo dice la riga «Pezzi» (quante piene, quella aperta, quanto fa una),
  altrove la giacenza. Prima c'erano soglia, costo e prezzo consigliato, ma
  non il numero per cui lo si apre.
- **«A quanto corrisponde un pezzo» adesso si spiega**: è quanto CONTIENE un
  pezzo, non quanto ne va in un drink — quello lo decide la ricetta. Si può
  lasciare vuoto (e in ricetta si dosa a pezzi, come la birra), e accanto
  c'è un «?» che racconta i due casi.
- **Il chilo fra le unità d'acquisto**: i limoni si comprano al chilo, e
  prima c'era solo il grammo.
- **La resa si scrive come si dice**: «5 kg rendono 1,5 l», con la quantità
  su tutti e due i lati, e l'unità d'uso si sceglie fra tutte — l'Aperol si
  compra a bottiglia e si versa in cl. Lo scarico fa la proporzione.
- **Anche pezzi e unità generiche hanno «Lo uso come lo compro»**: una birra
  si compra e si serve a bottiglia, e non le si chiede altro.
- **In creazione si scrive quanto se ne ha, nell'unità in cui si compra**,
  invece di «quante confezioni piene».
- **Il tasto indietro chiude la scheda prodotto** e riporta al magazzino,
  invece di uscire dalla pagina buttando via quello che si stava scrivendo.
- **La scheda prodotto chiede meno**: sparisce la domanda su quanto contiene
  una confezione (comprando a chili, una confezione è un chilo), e il
  contenuto di un pezzo — o la resa — resta a vista, da compilare solo se
  serve.
- **La soglia di avviso è sempre nell'unità in cui si compra** — è il
  prodotto comprato che sta finendo — e l'etichetta lo dice.
- **Il prezzo si scrive nell'unità in cui si compra**: «€/kg» per i limoni,
  «€/pz» per le bottiglie, «€/U» per il tempo di lavorazione. L'etichetta
  diceva sempre «€/pz» anche per un prodotto comprato a chili, e chi
  scriveva il numero non sapeva a cosa si riferisse.
- **Cambiando il modo di gestire un prodotto, l'avviso dice su cosa fa il
  conto** (il contenuto di una confezione) e avverte se la resa dichiarata
  non serve più.
- **Un prodotto contato a unità può essere una scorta**: il ghiaccio si
  conta a unità come il tempo di lavorazione, ma finisce — e ora si scarica.
  Nella scheda c'è la casella «È una scorta: si scarica quando si usa»,
  spenta di suo, così la manodopera resta com'era.
- **La scheda prodotto fa tre domande, sempre le stesse**: come lo compri,
  come lo usi in ricetta, e — solo se sono diverse — **quanto rende**. Così i
  limoni si comprano al chilo e si spremono in cl («1 kg rende 50 cl» —
  dietro un interruttore, perché quasi tutti i prodotti si usano come si
  comprano), il
  ghiaccio a sacchi e si usa a grammi, il gin a bottiglia e si versa a cl. In
  alto c'è un **«?»** che spiega le tre domande con gli esempi. I prodotti già
  in magazzino non cambiano di una virgola.
- **Le domande sulle unità del magazzino sono scritte come si parla**:
  «Quanto contiene una confezione che compri?» e «A quanto corrisponde un
  pezzo?», con scritto sotto che non toccano la giacenza. E un pezzo può
  contenere **unità** (1 pz = 10 U), che in ricetta si dosano a unità.
- **Il carico a colli sta dietro un interruttore**, e quando è acceso il
  riquadro del cartone viene prima: si scrive quanti pezzi ha e quanti ne
  arrivano, e la quantità si conta da sé — non si corregge a mano.
- **Le righe appena aggiunte non spariscono più**, nemmeno quando devono
  aprire una comanda nuova: restano a schermo mentre volano al server, e se
  la scrittura non passa tornano in bozza.
- **Il pagamento vede le righe appena battute** (BUG-015): battendo di corsa
  e aprendo subito il pagamento, le ultime righe restavano fuori — nel conto
  27 €, nel pagamento 21 € — perché la schermata guardava il conto come lo
  sapeva il server.
- **Su un conto chiuso «Rimetti in corso» c'è una volta sola**: stava sia in
  cima al pannello sia in fondo, al posto di «Pagamento».
- **Le macro-categorie sono due elenchi**: quelle del magazzino (quello che
  si compra) e quelle del menù (quello che si vende, nella nuova
  sottosezione «Macro-categorie» del menù). Su ogni macro di spesa si sceglie
  a quale macro di vendita corrisponde: è l'aggancio che servirà a confrontare
  speso e incassato.
- **Le griglie hanno tutte lo stesso vestito**: magazzino, modifica menù e
  griglia del conto, con la stessa striscia a sinistra. E il colore del
  prodotto prende la forma del tema: il nastro d'angolo di casa, la
  pastiglia stondata di Catppuccin, il pallino di Pico — questi ultimi in
  alto a destra, dov'è quello delle scorte in magazzino.
- **E un tema porta anche le forme**, non solo i colori: Pico è squadrato e
  piatto, Catppuccin tondo e senza aloni, la Tana resta la Tana.

## 1.4.7 — 17 agosto 2026

### Sotto il cofano

- **In locale, da un altro dispositivo della rete, i dati adesso
  arrivano**: col Firestore emulato si parla in long-polling. Prima la
  pagina si caricava, le connessioni c'erano, ma non consegnavano niente —
  e a schermo restava «il wifi risulta collegato ma non sta passando
  niente».

### Al banco

- **«Annulla» funziona mentre si batte un conto nuovo**: il tasto della barra
  azioni era spento per tutta la creazione, anche a righe già battute, e chi
  aveva aperto il conto per sbaglio non aveva un modo evidente di uscire.
  Adesso i due tasti «annulla» seguono la stessa regola; a conto ancora vuoto
  non chiede nemmeno conferma, torna in coda.

- **Nella vista menù, chi lavora non vede più i propri ordini in cima**:
  lì si prende un ordine, gli ordini stanno in coda.
- **In «Da servire» il tasto è «Aggiungi ordine»** e porta alla schermata
  del conto, la stessa del «+» in coda: prima mandava al menù del cliente.

- **Dal dettaglio di un ordine si aggiunge e si incassa.** «Modifica
  ordine» apre la schermata del conto con la griglia dei prodotti,
  «Pagamento» la apre già sul pagamento: prima si potevano solo cambiare le
  quantità di quello che c'era, e per una birra in più — o per incassare al
  tavolo — si tornava in coda a riaprire il conto dal banco.
- **Nel magazzino i titoletti del dettaglio sono in grassetto**: a fine
  serata, pezzi, soglia, costo e prezzo al cl si distinguono dai numeri.

- **Le card del magazzino sono un po' più larghe**: aperto il dettaglio,
  costo, IVA e prezzo consigliato non si spezzano più su tre righe.

- **«Salva modifiche» dice che ha salvato** e riporta alla coda: prima il
  tasto tornava com'era e non si capiva se fosse andata.

- **Gli avvisi si possono spostare nella campanella.** Nel profilo, accanto
  a quali avvisi ricevere, si sceglie: la strisciolina in alto su ogni schermata (come
  adesso), oppure un fumetto che esce dalla campanella e compare **solo
  nella coda ordini** — toccandolo si aprono gli avvisi. Chi sta in cassa o
  in magazzino non viene più interrotto.

- **La ⓘ si può spegnere** (Impostazioni → Vista ordine), per chi il
  listino lo sa a memoria e vuole le card pulite.
- **La riga «💳 Pagati» torna sulla sua riga**: finiva accanto al primo
  item pagato.
- **La ⓘ su ogni card dice come si fa il drink**: ingredienti con le
  quantità e la preparazione a parole. Nella scheda del prodotto c'è un
  campo nuovo, «Come si prepara» — shakerato o mescolato, il ghiaccio, il
  bicchiere — perché la ricetta dice cosa ci va, non il gesto. I drink di
  esempio ce l'hanno già tutti.

- **Il «+» sulla riga del conto aumenta e basta**: apriva anche la scheda
  dell'item, ogni volta.

- **Separando le righe uguali, ognuna ha la sua quantità.** Prima il «−»
  sulla prima di tre le spegneva tutte e tre: chi divideva il conto si
  ritrovava da capo, e se non se ne accorgeva il cliente pagava meno di
  quello che aveva preso. Ora si spegne quella che tocchi.

- **Il numero sulla card e le righe del conto dicono la stessa cosa** anche
  quando il conto porta l'id di un prodotto che non c'è più (cancellato e
  rifatto, o catalogo reimportato): si riconosce dal nome, invece di
  lasciare la card senza contatore con le righe lì sotto a vista.

- **Le modifiche che non passeranno mai ora si capiscono e si scartano.**
  Se una scheda del magazzino (o un conto) non esiste più, riprovare non
  serve: la campanella lo dice a parole e offre di toglierle, invece di
  restare rossa per sempre con un errore in inglese.

- **Le timbrature hanno la loro voce in Staff**: erano in cima al
  calendario, e per battere l'ingresso di chi arriva bisognava passare
  dalla schermata dei turni.

- **Le righe del conto si riordinano davvero**: tasto «organizza», maniglie,
  e la riga che segue il dito mentre le altre si scansano — la stessa cosa
  della griglia dei prodotti. Fuori da «organizza», toccare una riga la apre.
- **Aprendo le azioni di una card in coda cresce solo quella**, e le card
  sotto scendono: prima si allungavano tutte quelle della riga.

- **Aprire e chiudere la cassa è del banco**: alla sala quelle voci non
  compaiono più, né nel menu ⋯ né come tasto sul banner della cassa
  chiusa — dove ora legge che la deve aprire il banco.
- **«Mostra QR al cliente» compare solo con gli stati del servizio
  attivi**: senza, non ci sarebbe niente da seguire.

- **La password si può guardare**: l'occhio accanto al campo, all'accesso e
  nel profilo. Parte sempre coperta.

- **La schermata del conto nuovo si apre pulita, sempre.** Uscendo da
  qualunque parte, quello che è stato battuto diventa un conto e la bozza
  si chiude: non ci si ritrova più dentro le righe di quello prima.
- **Un tasto 🧹 per svuotare il conto**, invece di togliere venti righe una
  per una col «−». Chiede conferma.
- **Annullare un conto appena battuto lascia un conto annullato**, anche se
  l'ordine non era ancora nato: il numero era già stato preso e di quello
  che si è battuto resta traccia.
- **Nella storia del conto la stessa persona si chiama sempre allo stesso
  modo**: il nome, con il ruolo fra parentesi. Prima compariva tre volte
  con tre etichette diverse — l'email all'apertura, il ruolo all'annullo,
  il nome alla riapertura.
- **La storia del conto non perde più pezzi**: «Conto aperto» compare anche
  prima che il server risponda, e restano tutte le chiusure, non solo
  l'ultima.
- **Le impostazioni del menù sono tre voci distinte**: «Menù clienti» (con
  anche i suoi colori), «Gestione menù» e «Catalogo prodotti». Davanti a un
  interruttore non si capiva a quale delle tre appartenesse.

- **Quello che non è riuscito a partire riparte da solo** quando la rete
  torna: prima restava lì finché qualcuno non apriva la campanella e
  premeva «riprova» — e al banco non lo fa nessuno. Dopo tre tentativi si
  ferma e lo segnala, perché a quel punto serve una persona.

- **Il conto nuovo non eredita più le righe di quello prima.** La bozza
  aspettava la sincronizzazione per svuotarsi: uscendo prima, il conto
  dopo si apriva con dentro la roba già battuta.
- **«Invia comanda» e «Annulla ordine» funzionano subito**, anche su un
  conto appena battuto: prima erano spenti finché il server non
  rispondeva. Annullare un conto non ancora aperto butta la bozza e
  riporta alla coda.
- **Nella schermata di pagamento si capisce da dove viene il numero**:
  «RIGHE SCELTE» quando lo componi toccando le righe, «IMPORTO A MANO»
  quando lo batti — e in quel caso è un acconto, scritto lì sotto.

- **Si capisce che cosa è stato pagato.** Al posto di «Sconto e acconti già
  incassati −15,00 €» ci sono righe distinte: lo sconto, e ogni incasso col
  metodo e l'ora. Un importo battuto a mano si chiama **acconto** e non
  finge di coprire delle righe; chi paga scegliendo le righe le vede
  elencate sotto l'incasso.
- **Niente più attese del server quando si tocca un conto**: incassare,
  annullare, avanzare o aggiungere righe si vede all'istante, e il
  riepilogo in cima alla coda si muove con te.

- **Le attese ora si vedono**: entrando, aprendo la cassa o cercando nello
  storico, tre bollicine dicono che l'app sta lavorando — e dicono anche
  cosa sta aspettando, invece di una scritta ferma che sembra un blocco.

- **Il conto nasce all'istante e non si sdoppia.** Prima di scrivere un
  ordine l'app faceva tre domande al server: da lì l'attesa fra
  «Conferma» e il conto a schermo, e due conti battuti di fila potevano
  prendere lo stesso numero (i due #15 della stessa serata). Ora i numeri
  sono già in casa e ci si ricorda quelli dati.
- **Due terminali che battono insieme non litigano più sul numero**: se il
  telefono della sala e il tablet del banco prendono lo stesso #15, il
  server decide — tiene il numero chi è arrivato prima, l'altro passa al
  primo libero da solo, e sul conto resta scritto da quale numero veniva
  (la comanda può essere già uscita dalla stampante).
- **Tornare agli ordini non aspetta più il server**: il box del nome
  compare subito e il conto si scrive per conto suo.
- **Il «+» apre sempre un conto nuovo**: capitava che riaprisse quello
  appena battuto.

- **La cassa si apre e si chiude dalla coda**: nel menu ⋯ c'è «Apri cassa»
  se è chiusa e «Chiudi cassa» se è aperta — spento, con il perché
  scritto, finché ci sono conti aperti. «Apri cassa» chiede il fondo
  (facoltativo) in un box con Apri e Annulla, anche dal banner in alto.

- **Staff e Utenti hanno tre sezioni nel menu laterale**: calendario,
  nuovo turno, paghe orarie; utenze registrate, nuovo account, buoni VIP.
  Erano pannelli che aprendosi spingevano giù quello che si era venuti a
  guardare.
- **La maniglia del menu si prende davvero**: sta fra il menu e la pagina,
  non più sotto la barra di scorrimento. E nel menu non si scorre più in
  orizzontale: allargandolo, i nomi ci stanno.

- **Stringendo le categorie a lato non restano più le pastiglie grigie.**
  Dove le voci non hanno un'icona non c'era modo di capire quale fosse
  quale: ora si tolgono di mezzo e resta il tasto per rimetterle.

- **Il menu laterale si allarga tirando il bordo**, e cresce tutto
  insieme — testo e icone. Doppio clic sulla maniglia per tornare alla
  misura di partenza; la larghezza scelta resta anche domani.

- **Nel magazzino i numeri si scrivono come li si pensa**: il contenuto
  per confezione in litri o cl («0,7 l», com'è sull'etichetta) e la soglia
  di avviso **in pezzi** — «avvisami quando resta una bottiglia» — invece
  che in millilitri.

- **Uscendo, gli avvisi di quel dispositivo si spengono** — chi si era
  scollegato sentiva ancora suonare gli ordini del locale sul telefono di
  casa — e rientrando si riaccendono da soli.
- **Se gli avvisi sono spenti, ora si vede.** Una riga in cima lo dice e
  offre il tasto per attivarli; se si rifiuta per sbaglio ricompare,
  perché è proprio quello il caso da coprire.

- **Il flusso cassa parla durante la serata, non solo alla chiusura**:
  quanto deve esserci in cassa adesso (fondo + contanti), il conto medio
  con i coperti e quanto lascia una persona, chi ha incassato e quanto —
  se alla cassa si sono alternati in più d'uno — e com'è andata l'ultima
  ora, non solo la curva.

- **Nella lista ordini si cercano anche le serate passate.** C'è un
  calendario come quelli degli alberghi: tocchi un giorno per vedere
  quella serata, ne tocchi un altro per arrivare fin lì. Sopra, le
  scorciatoie: oggi, ieri, ultimi 7 e 30 giorni.
- **E si può guardare solo quello che arriva dai clienti**, o solo quello
  battuto al banco e in sala. Il filtro compare solo se di ordini dai
  clienti ce n'è.
- **Le scorte si scalano quando il drink è servito**, non quando lo si
  prende in carico: un drink iniziato e poi non fatto — riga tolta,
  cliente che cambia idea — portava via gli ingredienti lo stesso. Fino a
  lì restano *impegnati* e si leggono nella colonna «a fine serata».
  Senza gli stati del servizio non cambia niente: si scala alla riscossione.
- **«Riscuoti e servi», se lo volete.** Con gli stati del servizio
  incassare non chiude il conto (si paga anche in anticipo). Ma al banco
  spesso si consegna e si incassa nello stesso gesto: da Impostazioni →
  Gestione preparazione si accende un secondo tasto che fa le due cose
  insieme.
- **Nel riepilogo in cima alla coda ci sono anche gli annullati**, accanto
  ad aperti e chiusi. Fuori dal totale, che sono i soldi veri.
- **«A fine serata» contava anche i conti già chiusi**, e con un tavolo
  solo segnava mezzo listino in esaurimento. Ora guarda solo i conti
  ancora aperti — quelli incassati e serviti il magazzino l'hanno già
  scalato. E il riepilogo in cima alla coda conta esattamente i conti che
  si vedono sotto, qualunque tab sia aperta.
- **Il magazzino dice quello che ti ritrovi a fine serata.** Accanto alle
  scorte c'è una colonna con quello che resterà se tutti i conti aperti
  vengono incassati così come sono: i drink già fatti sui tavoli hanno
  promesso quegli ingredienti, e la domanda a metà servizio è «mando
  qualcuno a prendere una bottiglia?». Il numero cambia appena l'item
  entra nel conto; a cassa chiusa la colonna non c'è.
- **I numeri in cima alla coda sono di questa apertura di cassa.** Dopo
  una chiusura e una riapertura si leggeva ancora l'incasso della serata
  prima: contavano la giornata, non l'apertura. A cassa chiusa sono zeri.
- **I numeri in cima alla coda non cambiano più cambiando tab**: sono
  cumulativi — aperti, chiusi e annullati di questa apertura di cassa.
- **Un conto annullato adesso resta nella sua tab**, anche se era aperto
  giorni prima: spariva dallo schermo nell'istante in cui lo si annullava,
  e non si capiva se l'operazione fosse andata a buon fine. Stessa cosa
  per la cassa: un tavolo aperto ieri e incassato stasera è incasso di
  stasera.
- **Nella coda ci sono solo i conti di questa apertura di cassa.** Chiusi
  e annullati di prima dell'ultima chiusura non compaiono in nessuna tab:
  sono già stati contati e rendicontati, e stanno in Cassa → lista ordini.
  I conti *aperti* restano sempre, anche a cassa chiusa: quelli sono da
  chiudere.
- **Le impostazioni della stampante sono di chi è collegato**, oltre che
  del dispositivo: sullo stesso tablet ognuno ha il suo indirizzo e la sua
  stampa automatica. La prima volta si parte da quelle che il dispositivo
  aveva già, così nessuno resta senza stampante a servizio iniziato.
- **Le schede della griglia hanno il rilievo delle card della coda**:
  ombra e una sfumatura appena accennata. Erano riquadri piatti su fondo
  piatto, e con le colonne strette si leggevano come un blocco solo.
- **Le timbrature dello staff sono passate in Staff**, in cima alle ore:
  stavano in fondo alla cassa, e per battere l'ingresso di chi arriva
  bisognava passare dal flusso di cassa.
- **«Flusso cassa» si chiama Cassa e ha tre sezioni**: flusso, lista
  ordini, chiusure. Erano tre posti per la stessa domanda, e due si
  raggiungevano da tasti in fondo alla pagina — che si trovano solo
  scorrendo fino in fondo.
- **Il Menù ha tre sezioni nel menu laterale**: modifica menù, categorie,
  marginalità del listino. Erano due pannelli a scomparsa in cima al
  catalogo, e aprirli spingeva giù tutta la griglia.
- **Le schermate si aprono già com'erano.** Aprendo un conto le strisce
  comparivano colorate per un istante e poi sparivano, in un locale che le
  aveva spente: le impostazioni arrivano dal server e per quel momento non
  c'erano. Ora si riparte dall'ultima volta.
- **La striscia a sinistra delle card si sceglie.** Quattro modi:
  **spenta**, **colore del prodotto**, **colore della categoria** (quello
  del singolo prodotto resta nella linguetta) e **scorte** — rosso
  ingrediente esaurito, arancione in esaurimento, e «ce n'è abbastanza»
  grigio o verde, come preferisci. La griglia del conto si imposta in
  *Vista ordine*, le schede del catalogo in *Menù e catalogo*: dipende da
  come si lavora, e non c'era motivo che lo decidessimo noi. La
  **linguetta** nell'angolo continua a mostrare il colore del prodotto,
  qualunque cosa dica la striscia. Anche il verde/grigio del «ce n'è
  abbastanza» si sceglie separatamente per le due schermate: nel conto si
  batte di corsa e una griglia tutta verde è rumore, nel catalogo il verde
  dice che si può fare.
- **Le statistiche si aprono sull'ultima chiusura di cassa**, e quel
  periodo è il primo della riga: la domanda del mattino dopo è «com'è
  andata ieri sera», non «com'è andata la settimana». Chi sceglie un altro
  periodo se lo tiene.
- **Giornaliero e Mensile per macro sono passati nel menu**, come le
  sezioni di Magazzino e Impostazioni: una riga di chip in meno sopra una
  schermata già fatta di tabelle.
- **Il conto annullato mostra cosa c'era dentro.** Si apriva vuoto, a zero
  euro e senza una riga: non si capiva né cosa contenesse né se valesse la
  pena riaprirlo. Ora le righe si vedono, barrate — non fanno somma,
  perché quel conto non lo paga nessuno.
- **«Chiamate staff e gruppi» non è più un tasto che non fa niente.** Con
  un solo account non c'è nessuno da chiamare e il pannello spariva da sé:
  ora lo dice, e dice dove si creano gli account.
- **In «Organizza» la card non scappa più fuori dalla griglia.**
  Portandola oltre il bordo destro partiva uno scorrimento senza fine, e
  per rivedere le altre card bisognava riportare indietro la barra a mano.
- **Nella coda c'è la tab «✖️ Annullati».** Stavano fra i «Chiusi», che
  sono i soldi della serata: facevano numero senza essere incassi, e per
  ritrovarne uno da riaprire si cercava in mezzo a quelli buoni.
- **Il «+» della coda e il tasto del pagamento hanno lo stesso oro del tab
  acceso.** Sui temi chiari restavano più smorti: il colore dei tasti
  seguiva il tema di contorno, quello del tab no. Ora è lo stesso, e i
  temi di casa (Chiaro, Crema) non lo cambiano più — restano temi della
  Tana, non di un altro locale.

---

## 1.4.5 — 16 agosto 2026

### Al banco

- **Nelle pagine col menu aperto, menu e contenuto scorrono ognuno per
  conto suo.** Scorrendo il contenuto se ne andava via anche il menu, che
  di suo non ha niente da scorrere. E chiudendolo non passa più, per un
  istante, il pannellone a scomparsa che scivola via da sinistra.
- **Chi annulla un conto non riceve l'avviso del proprio annullamento.**
  Arrivava anche a lui: lo sa già, e in mezzo al servizio è rumore. Agli
  altri terminali arriva come prima.
- **I tasti tornano dell'oro di sempre.** Facendoli seguire il tema erano
  venuti più smorti — l'estremo scuro del gradiente non era più lo stesso
  — e il «+» della coda si riconosceva meno. Sul tema di casa il colore è
  identico a quello in produzione; sui temi che cambiano i bottoni resta
  il loro.

---

## 1.4.4 — 16 agosto 2026

### Per chi gestisce

- **Il menu torna a restare aperto** in Impostazioni e Inventario: non si
  apriva più e il tasto non rispondeva. Una parentesi graffa mancante nel
  foglio di stile — arrivata sciogliendo un conflitto — faceva ignorare al
  browser trecento righe, quelle del menu agganciato comprese.
- **In fondo al menu si legge di nuovo il ramo**: c'era la versione due
  volte (`v1.4.3 · v1.4.3 · …`). Da quando si pubblica taggando, al posto
  del ramo arrivava il nome del tag.

---

## 1.4.3 — 16 agosto 2026

### In sala

- **Chi prende l'ordine al tavolo stampa la sua comanda**, dal proprio
  telefono. Prima non usciva niente: la comanda arrivava al banco solo se
  lì qualcuno teneva aperta la coda ordini con la stampa automatica accesa
  — che era spenta. L'indirizzo della stampante i telefoni ce l'avevano
  già: mancava l'ordine di stamparla.
- **Un pallino nella coda dice se la comanda uscirà**, prima di averne
  bisogno: verde la stampante risponde, rosso adesso non uscirebbe — e
  toccandolo si legge perché e come rimetterla a posto — bianco qui non
  c'è nessuna stampante impostata. Non è una stampa di prova: è la stessa
  chiamata che farebbe la comanda, senza carta. Si ricontrolla da sé, e
  appena si torna sull'app: è lì che si scopre che il permesso di
  sicurezza della stampante è scaduto, invece che a metà servizio.
- **La sala lavora sulla stessa coda del banco.** «I miei ordini» non è
  più una pagina a parte: è il filtro «Miei» dentro la coda. Dal menu
  laterale si apre «Nuovo ordine dal menù» — lo stesso menù che si mostra
  al tavolo, che ora per chi lavora ha anche la ricerca per nome o
  ingrediente.

### Per chi gestisce

- **I tasti dello zoom stanno solo dove servono**: coda ordini, il conto
  (mentre lo batti, riaprendolo, all'incasso) e flusso cassa. Nelle altre
  schermate erano due tasti nell'angolo che coprivano il contenuto per una
  cosa che lì nessuno usa. Il livello scelto resta: si smette solo di
  poterlo cambiare da lì.
- **Nel menu le ultime voci non si accavallano più**: quando lo spazio
  finiva, «Capo Bar / Admin» e «Esci» si stringevano uno sopra l'altro.

- **Nelle pagine con più sezioni il menu resta aperto**, dal tablet in
  verticale in su:
  in Impostazioni e in Inventario non copre più il contenuto, è una colonna
  della pagina e il resto si stringe per fargli posto. Dentro l'inventario
  si salta fra Prodotti e Conta venti volte di seguito, e ogni volta
  bisognava aprire il menu, cercare, scegliere — e intanto non si vedeva
  più dove si era. È **incastrato nella pagina**, attaccato alla barra in
  alto e a filo del bordo — non una scheda arrotondata appoggiata sopra —
  e occupa poco: le voci sono parole corte, e prima mezza colonna restava
  vuota. Le sezioni della pagina aperta stanno **dentro** la loro voce,
  non in un blocco a parte. Si apre e si chiude **col ☰ di sempre**, e la
  scelta resta anche il giorno dopo. Sulla coda ordini resta a scomparsa, che lì
  sarebbe una colonna in meno di conti.

### Al banco

- **La card che stai spostando non è più trasparente**: alzandola si
  vedevano le altre attraverso, e non si capiva quale si stava spostando.
- **«Organizza» non cambia più la disposizione della griglia** — né
  quante card per riga, né la loro altezza. La maniglia
  stava a fianco della card e allargava ogni riquadro; e la card, dentro
  «organizza», non si allungava più fino a riempire la sua casella. Si
  finiva per sistemare una disposizione diversa da quella che si usa
  davvero. Ora la maniglia sta sopra la card, sul suo bordo, e la card
  riempie la casella come fuori; e le card non rimpiccioliscono più, né
  lampeggiano cambiando modo — entrando in organizza la griglia veniva
  rifatta da capo e per un attimo si vedevano le card della misura
  sbagliata. E **restringendo la griglia con la maniglia** non si vedono
  più due colonne a metà trascinamento: il minimo lo calcola il browser
  insieme al ridimensionamento, invece di una misura che arrivava dopo. La griglia non si riassesta nemmeno più
  da sola quando compare la barra di scorrimento.

- **Nella coda, «In servizio» torna vicino al ☰** e, sul telefono, sulla
  sua stessa linea: il rientro era scritto a mano e lasciava un buco, e la
  scritta si appoggiava all'altezza dei tasti scivolando sotto il ☰.
- **Il pallino della stampante si legge come un tasto** anche mentre
  controlla: prima, col pallino grigio, restava un'icona sospesa senza
  cornice.
- **Nel conto la riga dice quanto fa, non quanto costa uno.** Con tre
  birre uguali si leggeva «4,00 €»: il totale della riga non c'era
  proprio, e per sapere quanto faceva bisognava moltiplicare a mente col
  cliente davanti. Ora, come su uno scontrino: «3 × 4,00 €» accanto al
  nome e **12,00 €** a destra, vicino ai tasti.
- **Si sceglie chi stampa le comande prese in sala** (Impostazioni →
  Stampante): il telefono di chi prende l'ordine, oppure il banco. Se si
  sceglie il banco e la stampa automatica è spenta, l'impostazione lo dice
  subito — altrimenti non stamperebbe nessuno.
- Nel pagamento, **«Separa uguali» mostra le unità come tutte le altre
  righe**: nome, prezzo e il contatore − 1/1 +. Prima erano caselline da
  spuntare, e nella stessa colonna convivevano due modi diversi di dire la
  stessa cosa.
## 1.4.2 — 16 agosto 2026

Porta nella linea di sviluppo tutto quello che è uscito con la **1.3.2**
(qui sotto): il conto che si riapre dal tasto del pagamento e torna un
conto normale — incassi tolti anche dal flusso di cassa, righe di prima
modificabili, buoni rimessi a posto — e gli avvisi che arrivano davvero a
tutti i terminali tranne quello che ha battuto l'ordine.

Chi lavora sulla versione di prova trova in più, rispetto alla 1.3.2, le
cose che erano già in 1.4.0 e 1.4.1.

---

## 1.4.1 — 14 agosto 2026

### Al banco

- **Le Impostazioni entrano tutte nella finestra**, senza scorrere la
  pagina: la testata in alto, il piè di pagina in fondo, e in mezzo
  l'elenco delle sezioni e il contenuto, che **scorrono ognuno per conto
  suo** — l'elenco resta lì mentre si legge la sezione, invece di
  trascinarsi via insieme alla pagina.
- **Sulle card del menù i due segni dicono cose diverse, dove uno se le
  aspetta.** La **striscia a sinistra** dice come sta il prodotto — verde
  si può fare, arancione un ingrediente sta finendo, rosso non si può
  fare — come sulle card della coda dice com'è messo il conto. Il colore
  al banco è diventato una **linguetta nell'angolo**, disegnata come sulle
  tile del POS: si tocca per cambiarlo. Prima erano un quadratino che
  sembrava un'etichetta (ed era un tasto) e un pallino il cui rosso
  diceva due cose opposte.
- **Anche le tile del POS hanno la striscia a sinistra**, come le card
  della coda e del menù: lo stesso oggetto si riconosce allo stesso modo
  in ogni schermata.
- **«Ultimi movimenti» non è più un tastone in fondo alla lista**: è una
  sezione del menu del magazzino, con gli ultimi cento invece di trenta.
- **«Separa» ora separa davvero tutte le righe.** Si univa tutto, si
  premeva Separa e tornavano su solo le ultime voci: le altre mostravano
  quantità 1 e le righe in più non comparivano. Nascevano tutte con lo
  stesso identificativo, e a schermo le righe si distinguono per quello.
- **Nel magazzino i due segni dicono due cose.** Il **pallino** dice
  quanta roba c'è (verde/arancione/rosso), la **striscia** che assortimento
  è: grigia in assortimento, blu in linea, oro premium, rossa fuori
  assortimento. Prima dicevano tutti e due la stessa cosa.
- **Nel menù la striscia dice com'è messo il prodotto**: grigia non è in
  menu, verde le scorte ci sono, arancione un ingrediente sta finendo,
  rossa un ingrediente è finito. Il rosso prima diceva due cose opposte —
  «l'ho tolto io» e «è finito il rum» — che chiedono azioni diverse.
- **L'intestazione della tabella del magazzino non scorre più via**:
  scorrendo trecento prodotti si perdevano i nomi delle colonne, e «6,20 €»
  senza sapere se è con o senza IVA non vuol dire niente.
- **In «Organizza» il trascinamento funziona come ci si aspetta**: la card
  segue il dito, le altre si spostano per farle posto, e lasciandola resta
  dove l'hai messa. Si può riordinare anche **da tastiera**. La maniglia è
  attaccata alla card — erano due oggetti con una fessura in mezzo — e ha
  il colore di casa al posto della macchia senape.
- **Le sezioni di una pagina stanno nel menu a scomparsa**, rientrate sotto
  la pagina aperta: un posto solo per navigare, uguale sul telefono e sul
  computer. In pagina costavano una colonna o una riga tutto il giorno;
  nella barra reggevano cinque voci, non ventidue.
- Nel conto, **la storia è un'icona in alto** accanto al numero: da tasto
  largo si prendeva una riga intera accanto a Unisci, Separa e Comande.
- **Sul telefono la barra in alto respira.** C'erano otto cose in una riga
  e il nome del locale finiva in «La …»: ora sotto i 700px restano il
  logo, il menu, dove sei e le azioni. L'«indietro» sparisce perché il
  menu fa quello che fa lui e in più — dalla coda alle impostazioni in un
  tocco solo. I tasti restano grandi: si toglie, non si rimpicciolisce.
- **Le sezioni di una pagina si scelgono dalla barra in alto.** Nel
  magazzino (Prodotti, Conta, Ordini, Scadenzario, Categorie,
  Macro-categorie, Fornitori, Movimenti) e nelle Impostazioni: il **titolo
  della pagina è il comando**, con la freccia. Prima erano file di tasti o
  una colonna a sinistra — spazio occupato tutto il giorno per una scelta
  che si fa ogni tanto. **Sul telefono** si apre il foglio dal basso, lo
  stesso gesto di «⋯ Azioni».
- **I filtri del magazzino stanno su una riga sola**, e ora c'è scritto
  che sono filtri: sembravano un riepilogo, e nessuno pensava di toccarli.
  Il valore di magazzino resta lì accanto, ma non si tocca: è un numero da
  leggere.
- **Nel magazzino scorre solo la lista**: filtri, ricerca e categorie
  restano fermi. Prima si risaliva da capo per tornare alla ricerca.
- **Il titolo della pagina è passato nella barra in alto**, accanto al
  nome del locale: dentro la pagina si prendeva una riga in cima al
  contenuto, e su un tablet al banco quella riga si vede.

---

## 1.4.0 — 13 agosto 2026

### Al banco

- **La versione mostrata dall'app è quella giusta.** Sull'ambiente di
  test diceva 1.2.0 mentre ci girava sopra la 1.3.0.
- **Sullo scontrino c'è scritto «Carta di credito», non «Carta».** A fine
  serata la striscia si divide per metodo a colpo d'occhio: «Carta» e
  «Contante» si somigliano troppo. Stesse parole anche sulla chiusura di
  cassa, così i due fogli si confrontano senza tradurre a mente.
- **Dopo un aggiornamento l'app dice cosa è cambiato.** Il riquadro con le
  note esce ogni volta che arriva una versione nuova — che tu abbia toccato
  «Nuova versione disponibile», riaperto l'app da un tablet rimasto
  indietro o ricaricato la pagina. Una volta sola, e ne resta traccia
  nella campanella.
- **Le notifiche si dividono in da leggere e lette.** Una letta sparisce
  dall'elenco e finisce nello **storico**, che si apre dalla campanella:
  in mezz'ora di servizio un elenco che non si svuota mai diventa un muro
  di righe vecchie, e non ci si guarda più. Aprire la campanella non basta
  a segnarle lette: si toccano, oppure c'è «segna tutte lette».
- **Ogni avviso si può spegnere**, uno per uno: nuovo ordine, i singoli
  passaggi della preparazione, le scorte e la nuova versione. La scelta
  vale **su quel dispositivo e per chi è collegato** — al banco serve
  «nuovo ordine», in sala «pronto», sul portatile nel retro niente — e sta
  in Impostazioni → 🔔 Notifiche.
- **Un ordine battuto su un altro terminale ora si vede.** Prima, se lo
  mandava un bartender, gli altri dispositivi non ricevevano nulla: chi
  stava in sala col telefono non sapeva che al banco era entrato un
  ordine. Adesso avvisa tutti tranne chi l'ha appena mandato.
- **Un conto chiuso o annullato si può rimettere in corso.** Chiuso sul
  tavolo sbagliato, annullato per un malinteso, o il cliente che torna:
  dai ⋯ del conto si riapre, scrivendo — se si vuole — il perché. Gli
  incassi già presi restano dove sono e il dovuto si ricalcola da sé; le
  comande già servite restano servite, tornano da fare solo quelle
  annullate col conto. Se il conto annullato era pagato con un **buono
  VIP**, riaprendolo il saldo si ri-addebita: lo sconto deve restare
  pagato da qualcuno.
- **Ogni conto ha la sua storia**, dietro i ⋯: aperto, chiuso, annullato,
  riaperto — con l'ora, chi l'ha fatto e il motivo della riapertura. E il
  motivo si legge anche dentro il conto riaperto, senza cercarlo: un conto
  in corso con dentro un incasso, senza una spiegazione, è solo un
  mistero.
- **L'app si chiama «La Tana del Coniglio»**, non più con la sigla del
  progetto — e a chi lavora l'icona dice di chi è: col suffisso del ruolo
  (« - admin», « - bartender», « - staff»). Il cliente vede il nome nudo.
  Il telefono fissa quel nome quando si installa l'app: per averlo giusto,
  installala da collegato col ruolo che ti serve.
- **Le Impostazioni stanno tutte in uno schermo**: l'elenco delle sezioni
  scorre per conto suo invece di trascinarsi dietro tutta la pagina — e la
  testata non scivola più via proprio mentre si cerca una voce.
- **L'«indietro» è passato nella barra in alto**, fra il menu e il nome:
  dentro la pagina si mangiava la prima riga di ogni sezione.
- **Lo zoom non galleggia più sopra i pannelli aperti** (i ⋯, le conferme):
  stando in basso a sinistra finiva sopra le ultime voci e si toccava lui
  al posto della voce.
- Nella coda, da tablet in su, **«In servizio» è staccata dal tasto menu**:
  prima gli stava addosso.

---

## Non ancora rilasciata — 1.3.4

### Al banco

- **Il magazzino non scende più sotto zero.** Battendo un prodotto finito la
  giacenza andava in negativo (il Jagermeister a −0,04 pz, con «valore
  −0,67 €»), e il guaio si vedeva dopo: caricando la bottiglia comprata il
  conto ripartiva dal buco e ne risultava meno di una, mentre sullo scaffale
  c'era tutta. Adesso si scarica al massimo quello che c'è, un carico riparte
  sempre da zero e il valore in euro non va mai in negativo. Al banco non
  cambia niente: il conto si batte come prima, anche se la scorta è finita.
- **Sulle card del magazzino i numeri si scrivono come si leggono.** Sotto al
  Campari si leggeva «7.49000000001 pz», col punto e la coda di decimali del
  calcolo: adesso sono due decimali e la virgola, in tutto il magazzino. E
  sotto al numero grande dei pezzi ci va il **contenuto** — «749 cl» — invece
  di ripetere gli stessi pezzi: è il dato che serve a chi sta versando.
- **Il dettaglio di un prodotto resta dentro la card.** Aprendo un prodotto
  nella vista a Card il pannello sbordava e il testo si spezzava a
  fisarmonica, con costo, IVA e prezzo consigliato uno sopra l'altro. Adesso
  ogni voce è incolonnata — etichetta sopra, valore sotto — e si legge tutta.
  Anche la fila dei tasti **Modifica · Duplica · Elimina** sta nel riquadro:
  quando la card è stretta i tasti vanno a capo e si leggono per intero, invece
  di sfondare i bordi a destra e a sinistra. Nella vista a Lista, dove lo
  spazio c'è, non cambia niente.
- **La manodopera si mette a listino, in unità generiche.** Un prodotto del
  magazzino si può misurare in **U** — «Unità generiche», nel menu delle unità
  di misura — per quello che non si versa e non si pesa: il **tempo di
  lavorazione**. Si mette nella ricetta dei drink che richiedono preparazione,
  col suo costo per unità, e così il lavoro entra nel costo del drink e quindi
  nel prezzo consigliato. Prima si potevano scegliere solo litri, centilitri,
  grammi o pezzi, e nel Daiquiri si leggeva «Tempo di Lavorazione 1 g». Tre
  cose che contano: **non è una scorta** — non si scala quando il drink si fa e
  non risulta mai esaurito, quindi il drink non sparisce dalla carta e il tempo
  non finisce negli ordini al fornitore — **non entra nel valore del
  magazzino**, e **in carta al cliente non si vede**.

---

## 1.3.3 — 16 agosto 2026

### Al banco

- **Le scorte si contano in pezzi, con la virgola.** Una bottiglia da
  100 cl con dentro 50 cl è **0,5 pz**; due piene da mezzo litro e una a
  cui mancano 10 cl fanno **2,8 pz**. Prima si leggeva «3 bott.», che dice
  quante bottiglie si toccano e non quanto prodotto c'è: tre bottiglie di
  cui una quasi vuota contavano come tre, e per sapere se bastavano per la
  serata bisognava aprire il dettaglio. Sparisce anche il «piena / aperta
  46 cl / esaurito» di fianco: col conteggio a pezzi è già nel numero —
  «0,5 pz» dice da sé che è mezza, «0 pz» che è finita. Le bottiglie —
  piene, aperta, finite — restano nel dettaglio, per chi va a contarle
  sullo scaffale.
- **Le unità restano coerenti**: il pezzo è la bottiglia, il contenuto si
  legge sempre in cl (o in grammi). Nel dettaglio si leggeva «1 aperta
  (40 pz) · 1 conf. = 200 pz», che a chi sta versando non dice niente.
- **Caricando si può contare a cartoni**: dicendo quanti pezzi ha un
  cartone, i pezzi si riempiono da sé (2 × 24 = 48). Chi carica bottiglie
  sfuse lascia il cartone da parte e scrive i pezzi, come sempre.
- **«Inventario» si chiama Magazzino**, come lo chiama chi ci lavora.
- **Un prodotto si può duplicare**, fra Modifica ed Elimina: il magazzino
  è pieno di quasi-uguali — stessa bottiglia in due formati, lo stesso
  amaro di un altro fornitore — e rifarli da zero vuol dire ribattere
  costo, confezione, categoria, soglia e IVA. La copia parte **a zero** e
  si apre subito, perché il nome va cambiato.

---

## 1.3.2 — 15 agosto 2026

### Al banco

- **Un conto chiuso o annullato si può riaprire.** Chiuso sul tavolo
  sbagliato, annullato per un malinteso, o il cliente che torna e vuole
  ordinare ancora su quello: si riapre **dal tasto del pagamento**, che su
  un conto chiuso era lì spento a non fare niente, scrivendo — se si vuole
  — il perché.
  Torna un conto **normale, come se non fosse mai stato pagato**: le righe
  si modificano tutte e quello che era stato incassato **esce dagli
  incassi della serata**, perché quel conto è di nuovo da incassare. Resta
  scritto nella storia del conto quanto è stato tolto, e le comande già
  servite restano servite. **Se era stato pagato con un buono, il saldo
  torna al cliente**: se no lo pagherebbe due volte, una col buono e una
  quando ripaga il conto.
- **Nel conto riaperto si modificano anche le righe di prima.** Erano
  bloccate perché quelle comande risultavano servite: ma riaprire serve
  proprio a togliere il giro battuto sul tavolo sbagliato. Le scorte si
  riallineano da sé.
- **Chiudere, annullare e riaprire un conto non aspettano più la rete.**
  Prima di scrivere, l'app rileggeva il conto dal server: con una rete
  lenta la coda restava indietro e il conto chiuso compariva sotto
  «Chiusi» solo dopo. Ora legge la copia locale, che è quella che la coda
  sta già guardando.
- **Annullando un conto pagato con un buono, il credito torna al
  cliente.** Prima restava scalato: il conto non veniva incassato e il
  buono era speso lo stesso.
- **Ogni conto ha la sua storia**, dietro i ⋯: aperto, chiuso, annullato,
  riaperto — con l'ora, chi l'ha fatto e il motivo della riapertura. E il
  motivo si legge anche dentro il conto riaperto, senza cercarlo: un conto
  in corso con dentro un incasso, senza una spiegazione, è solo un
  mistero.
- **Riaprendo un conto annullato, il buono VIP torna a pagare lo sconto.**
  Annullando, il saldo tornava al beneficiario; riaprendo, lo sconto
  restava sul conto senza che lo pagasse più nessuno — credito regalato e
  conti che non tornano. Se nel frattempo il buono è stato speso altrove,
  si prende quel che c'è e lo sconto si riduce di conseguenza.
- **Nella coda, un conto chiuso compare subito sotto «Chiusi»**, e uno
  riaperto torna subito fra quelli in corso: sparivano da tutte e tre le
  liste fino a ricaricare la pagina. Sparire subito serve a «In corso» —
  il conto chiuso non deve restare lì a far dubitare — ma non allo
  storico, dove uno lo va a cercare apposta.
- **Sul telefono, a barra nascosta, la coda non finisce più sotto
  l'orologio.** Il ➕ spariva a metà sotto la barra di sistema, il ☰ si
  sovrapponeva ai conteggi e «In servizio» restava dietro la striscia: la
  coda si prendeva lo spazio dell'ora e della batteria invece di
  scansarlo.
- **La storia del conto è tornata un'icona in alto**, accanto al numero:
  da tasto largo si prendeva una riga intera accanto a Unisci, Separa e
  Comande, per una cosa che si guarda ogni tanto.
- **La notifica di un ordine nuovo arriva anche col gestionale aperto.**
  Prima veniva saltata apposta quando la coda era in primo piano — «là
  suona l'app» — ma il tablet del banco sta sulla coda tutta la sera, e
  l'avviso in pagina scartava proprio gli ordini battuti dagli altri
  terminali: in mezzo alle due regole restava il silenzio. Ora esce
  sempre, e le due notifiche si fondono in una invece di raddoppiarsi.
- **Gli ordini battuti alla cassa avvisano gli altri terminali.** Nascono
  già «in preparazione» — chi li batte sta facendo il drink — e per
  l'avviso non contavano come lavoro nuovo: chi batteva dal telefono non
  faceva squillare il tablet al banco.
- **Gli avvisi arrivano a tutti i terminali, non solo all'ultimo.** Erano
  registrati per persona: lo stesso account sul tablet e sul telefono si
  sovrascriveva, e squillava solo l'ultimo che aveva aperto il gestionale.
  Ora ogni dispositivo ha la sua registrazione.
- **La campanella dice se su questo schermo gli avvisi arrivano**, e se
  sono spenti — o se il terminale non risulta fra quelli avvisati — offre
  di sistemarlo lì. Su iPhone e iPad lo dice chiaro: la
  notifica di sistema esiste solo con l'app installata sulla schermata
  Home.
- **Gli avvisi seguono il terminale, non il ruolo.** Chi prende ordini col
  telefono con un account da gestore non li faceva più arrivare a nessuno:
  al banco non squillava niente. Ora l'unico a non essere avvisato è il
  dispositivo che ha battuto l'ordine — sa già di averlo mandato.

---

## 1.3.1 — 14 agosto 2026

### Al banco

- **Nel pagamento, due righe uguali si muovono una per volta.** Con
  «Negroni, Coca Cola, Negroni», premendo + o − su un Negroni si muoveva
  anche l'altro: la selezione andava per prodotto e le due righe
  condividevano il contatore. Peggio, togliendone una l'importo non
  cambiava — il conto risultava coperto per intero — e si incassava tutto.

---

## 1.3.0 — 12 agosto 2026

### Al banco

- **Gli item battuti mentre l'ordine sta nascendo non si perdono più.** Si
  aggiungeva un'acqua, un secondo dopo dell'altro, e quando il conto
  finiva di crearsi restava solo l'acqua.
- **Il pagamento non si chiude più da solo.** Battendo due drink di corsa
  e premendo subito Pagamento, un istante dopo ci si ritrovava sulla
  schermata dell'ordine e bisognava ripremere: la schermata spariva nel
  momento in cui il conto finiva di nascere. Dipendeva da quanto si era
  veloci, ed era peggio col cliente davanti.
- **Il totale da incassare resta scritto sul tasto Pagamento**, al netto
  di sconti e acconti già presi. Prima spariva un istante dopo il primo
  prodotto.
- **Chiudendo o annullando un conto, sparisce subito dalla coda**: non lo
  si vede più lì per un attimo, a chiedersi se l'operazione sia andata.
- **Annullando si torna alla lista ordini.**
- Il "tira per aggiornare" non parte più nelle schermate di lavoro, e se
  la pagina si ricarica lo stesso **il conto in corso viene ripreso**.

### Sul telefono

- Nel conto restano in pagina le righe, il totale e i tre gesti della
  serata — **Invia, Paga, Annulla** —; il resto sta dietro i ⋯. Ai tasti
  ingranditi al massimo restano le sole icone.
- **Il pannello del conto si alza e si abbassa** da una maniglia, da un
  quarto a tre quarti di schermo, e si apre mostrando l'ultima riga
  battuta. Le maniglie, col dito, si prendono tenendo premuto: sfiorarle
  scorrendo non cambia più niente.
- Barra in alto rifatta secondo le linee guida: tasto, titolo e due
  azioni, il resto in un menu. Niente più tasti che finiscono fuori
  schermo.
- La coda: conteggi su una riga loro, ricerca a tutta larghezza, e un ⋯
  con i pannelli e **il verso della lista** (dal primo della serata o
  dall'ultimo battuto).

### Ovunque

- **La barra in alto è la stessa su tutte le schermate** — menu, logo col
  nome, e a destra chi è collegato — e **il menu laterale si apre da
  ovunque**, anche per il cliente, col suo (menù, i propri ordini,
  accesso e profilo). Restano senza menu le due schermate in cui si
  compone un conto: da lì si esce con «← Ordini». Prima la barra cambiava
  forma a ogni pagina e il menu spariva.
- **Chi lavora non passa più dalla vetrina**: aprendo l'app, a bartender,
  staff e gestore si apre subito la lista ordini. Il QR del tavolo porta
  al menù come sempre, anche se a inquadrarlo è chi sta al banco.
- **All'accesso non ci si ritrova mai dentro il POS.** Se l'app era
  rimasta aperta su un ordine, riaprendola si tornava lì dentro — e la
  schermata riprende da sé il conto lasciato aperto: si finiva a battere
  righe in un conto che non si era scelto. Ora si parte sempre dalla
  lista ordini; al POS ci si va col ➕, come sempre.
- **I colori seguono chi guarda, non la pagina.** Chi lavora vede il tema
  del gestionale dappertutto — profilo, lista ordini, accesso compresi —;
  chi ordina vede il suo. Prima bastava un indirizzo dimenticato e in
  mezzo alla serata arrivavano i colori del cliente.
- Nelle impostazioni si cambia **il tema del gestionale e quello della
  vista cliente**, e adesso c'è scritto quale si sta toccando.
- Nella coda, **da tablet in su, titolo, ricerca e ⋯ stanno sulla stessa
  linea**, alti quanto il tasto menu; conteggi e legenda vanno sulla riga
  sotto. Prima non era allineato niente. Il ➕ resta grande com'era e
  sporge dalla riga: è il tasto che si prende di corsa. Anche il ☰ scende
  al centro della riga, a filo con «In servizio». Sul telefono i conteggi
  («3 aperti · 0 chiusi · …») partono dal bordo, allineati alla barra di
  ricerca, invece di restare sospesi a metà.
- **Impostazioni a schede**: ventuno riquadri diventano voci di una barra
  laterale, una alla volta.
- **Backup e ripristino di tutto il database**, dall'app e da riga di
  comando.
- **Buoni VIP** dentro Utenti e ruoli; **stampante** dentro Impostazioni.
- La pagina riempie lo schermo invece di stare in una colonna da 760px.
- **L'app si installa anche su iPhone** come si deve (icona, invito, e
  senza l'app installata niente schermo intero né notifiche: ora lo dice).
- **Da schermo intero si esce dallo stesso tasto** con cui si entra, che
  ora cambia icona e parole. Prima, entrati, il tasto spariva e restava
  solo F11 — che su un tablet montato al banco non c'è.
- **La ricerca dei prodotti nel POS può accendere invece di filtrare**:
  si sceglie in Impostazioni → Vista ordine. La griglia resta com'è —
  nessuna card sparisce sotto le dita — e la prima che risponde si
  illumina, con la griglia che ci scorre sopra; toccandone una la ricerca
  si azzera da sé.
- **Il menù è uno solo, quello che vede il cliente.** Aprendolo da
  bartender non si trova più un catalogo a due colonne diverso da quello
  che si sta mostrando al tavolo: gli ordini a mano si battono al POS.
  Ordinare dal menù si può lo stesso, quando le impostazioni lo
  consentono.
- **Le categorie non si nascondono più.** Il tasto che faceva sparire la
  barra a sinistra (menù, magazzino, impostazioni, rendiconto) non c'è
  più: sul telefono, dove le categorie sono già una riga che scorre, non
  serviva a niente e in cambio si perdeva l'unico modo di girare fra
  loro.
- In Impostazioni, **la giornata di lavoro è spiegata in italiano**: si
  dice a che ora finisce una giornata e ne comincia un'altra — da lì gli
  ordini ripartono dal numero 1 e le statistiche contano il giorno nuovo
  — invece di «far girare la giornata», che non voleva dire niente.
- **La ricerca nella coda può accendere invece di filtrare**: si sceglie in
  Impostazioni → Coda ordini. Lasciando la coda intera, scorre fino al
  primo conto che risponde e lo illumina — così si vede dov'è rispetto
  agli altri — e appena si tocca un conto la ricerca si azzera da sé.
- In fondo al menu c'è **la versione** che si sta guardando.
- Nel pagamento, **SumUp non porta più il sottotitolo** sotto al tasto: è
  spento e basta, e toccandolo dice che il lettore si configura in
  Impostazioni → Pagamenti (o che senza rete non può autorizzare).
- La lista degli articoli, aprendo il pagamento, **parte dal fondo**: si
  vede subito l'ultima riga battuta, non quelle di mezz'ora prima.
- Con la **gestione preparazione spenta**, nel pagamento non esce più
  l'avviso «comande non ancora servite»: senza preparazione non ci sono
  comande da servire, e usciva a ogni incasso.
- **Il tastierino dello sconto ha di nuovo le cifre in ordine** (7 8 9 /
  4 5 6 / 1 2 3): riusava la griglia del pagamento, larga quattro colonne
  per gli operatori, e i numeri finivano sparsi a caso.

### Sotto il cofano

- La pipeline fa **prima lint e test, poi il deploy**: se qualcosa è rosso
  non si pubblica niente.
- Si lavora su un ramo di rilascio, e i branch di lavorazione vanno da
  soli sull'ambiente di test.
- **96 requisiti** scritti in `requirements/requirements.yaml`, legati ai
  test da una prova che fallisce se qualcuno li lascia indietro.

---

## 1.2.0 — 11 agosto 2026

- **Ruolo admin** accanto a bartender e staff, con la pagina **Utenti e
  ruoli**: i clienti registrati dal sito si promuovono da lì, e l'ultimo
  admin non si può togliere di mezzo.
- Il ruolo si aggiorna da solo senza aspettare la scadenza del token: chi
  veniva promosso mentre era collegato si trovava permessi negati sparsi
  in giro.
- Menu laterale riorganizzato: gruppi a scomparsa, chi è collegato in
  fondo, una convenzione sola per le sottosezioni di ogni pagina.
- Vista cliente: niente tasto schermo intero, larghezza del dispositivo.
- Ambiente di sviluppo locale "come il server", e `npm test` che funziona
  anche su Windows.

## 1.1.0 — 11 agosto 2026

- Primo numero di versione da quando si lavora in GitFlow.
- Ramo e commit visibili in fondo al menu: sull'unico ambiente di test
  passano a turno più versioni, e senza saperlo "l'ho provato e non
  andava" non vuol dire niente.
- I branch di lavorazione vengono pubblicati da soli sull'ambiente di
  test.
