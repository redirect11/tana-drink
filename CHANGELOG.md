# Cosa è cambiato

Le note di ogni versione, dalla più recente. Si leggono anche dentro
l'app: **Impostazioni → Informazioni**.

I numeri seguono il versionamento semantico: il primo cambia quando si
rompe qualcosa di come si lavorava prima, il secondo quando si aggiunge
una funzione, il terzo per le correzioni.

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

---

## Non ancora rilasciata — 1.3.3

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
