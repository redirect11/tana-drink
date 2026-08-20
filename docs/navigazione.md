# Come si naviga qui

Regole di navigazione, scritte una volta per non ridiscuterle a ogni
schermata. Nascono da una barra in alto che sul telefono si era affollata:
☰, ←, logo, nome del locale, titolo, sezione, campanella, ⋮ — otto cose in
una riga, e il nome del locale ridotto a «La …».

## La barra in alto: tre zone, sempre le stesse

| Zona | Cosa ci sta | Domanda a cui risponde |
|---|---|---|
| Sinistra | ☰ oppure ← | «Come esco da qui?» |
| Centro | marchio · titolo della pagina e della sezione | «Dove sono?» |
| Destra | campanella, ⋮ / chi sono | «Cosa posso fare adesso?» |

L'ordine non cambia mai. Chi cerca il menu guarda a sinistra anche in una
schermata che non ha mai visto.

## Cosa si sacrifica per primo, quando lo spazio manca

Non si rimpiccioliscono i tasti: al banco si tocca con le dita bagnate, e
sotto i 44px si sbaglia. Si **toglie**, in quest'ordine:

1. **il nome del locale** (sotto i 700px resta il logo): chi lavora sa in che
   app è — è a tutto schermo;
2. **l'«indietro»**: sul telefono il ☰ fa quello che fa lui **e in più** —
   dalla coda alle impostazioni in un tocco solo, invece di uscire e poi
   scegliere. Due tasti per la stessa domanda sono uno di troppo;
3. **il logo** (sotto i 400px);
4. il **titolo della sezione** si accorcia con i puntini, ma non sparisce mai:
   è l'unica cosa che dice dove sei;
5. non cadono mai: **☰, campanella, ⋮**.

## Le gerarchie: una per volta, e ognuna al suo posto

- **Le pagine** stanno nel menu laterale (☰). Punto.
- **Una pagina che non è di tutti si TOGLIE dal menu**, non si apre per dire
  «non puoi»: una schermata che si è già fatta vedere ha già risposto alla
  domanda. Chi vede quale voce sta accanto alla voce stessa
  (`src/lib/sezioni.js`), con la funzione di `src/lib/ruoli.js` che lo
  decide — `isAdmin` per «Bilancio». Lo stesso filtro vale per l'indirizzo
  battuto a mano (`?tab=…`): togliere la voce dal menu non basta.
- **Le sottosezioni di una pagina** (Inventario: Prodotti, Conta, Ordini…;
  Impostazioni: Aspetto, Pagamenti…) stanno **nel menu a scomparsa**,
  rientrate sotto la pagina aperta. Un posto solo per navigare, uguale sul
  telefono e sul computer.

  Le altre strade le abbiamo provate tutte, e non reggono: una **riga di
  schede** in pagina costa altezza e sul telefono non ci sta; le **schede
  nella barra** reggono cinque voci, non ventidue; una **tendina** costringe
  ad aprirla per sapere cosa c'è dentro. Il menu invece scorre, ed è già il
  posto dove si va per cambiare pagina.

  Nel menu compaiono le sezioni della **pagina aperta**: sono le uniche che
  si conoscono senza esserci passati.
- **Dove la pagina ha sezioni sue, il menu resta agganciato**: da 768px in
  su non copre il contenuto, è una colonna della pagina e il contenuto si
  stringe per fargli posto. Lì dentro si salta da una sezione all'altra
  venti volte di seguito, e un menu che copre significa aprire, cercare,
  scegliere — e intanto non vedere più dove si era.

  **Si apre e si chiude col ☰**, come ovunque: niente secondo tasto per
  «agganciarlo». A chi lavora interessa che il menu ci sia o non ci sia —
  che resti dentro la pagina invece di coprirla è come si presenta, non
  un'altra funzione. La scelta resta anche il giorno dopo
  (`tana:drawer-agganciato`). Sulla coda
  ordini non si aggancia — lì non ci sono sezioni e sarebbe una colonna in
  meno di conti.

  **Da dove in su** è un conto sulla larghezza che resta: sul telefono
  (360–430px) 250px sono più di metà schermo e il contenuto diventa
  inutilizzabile, quindi lì il menu resta a scomparsa; da 768px — l'iPad in
  verticale, il tablet del banco — restano 500px e la scelta ha senso. Fino
  ai 900px la colonna si stringe a 200px.

- **Come si guarda una pagina non è navigazione**: le quattro viste della coda
  (griglia, corsie di stato, schede, lista) si scelgono in Impostazioni → Coda
  ordini e restano. Niente riga di schede sopra la coda per cambiarle: si
  decide una volta e si lavora, e quella riga sarebbe altezza tolta ai conti
  per una cosa che si tocca due volte l'anno.
- **Il banco ha una coda sua, e si apre da sé.** Ad accenderla sono gli
  stati del servizio; come disegnarla si sceglie in Impostazioni → Coda
  ordini → «La vista del banco», accanto alla vista della coda — stessa
  regola di sempre: come si guarda una pagina non è navigazione, si decide
  una volta e si lavora. La coda di chi guarda la serata non cambia.
- **Una card che apre qualcosa apre la cosa che rappresenta.** Nella coda del
  banco le card sono comande, e toccarle apre il dettaglio della comanda
  (`/ordine/:id/comanda/:comandaId`); nelle corsie dei conti sono conti, e
  aprono il conto. Quello che sta un livello sopra — il conto, per una
  comanda — si raggiunge con un tasto scritto, mai rubando il gesto
  principale: il tasto grande della card resta quello che porta avanti il
  lavoro.
- **Un tocco apre, una pressione lunga sposta.** Sulle card della coda del
  banco il tocco resta quello di sempre (apre la comanda); tenendo premuto
  la card si stacca e si lascia in un'altra colonna, e lo stato della
  comanda diventa quello della colonna. È una strada ALTERNATIVA, non la
  strada: i tasti restano tutti dov'erano, e chi non proverà mai a
  trascinare non si accorge che si può. Le colonne che non accettano il
  rilascio lo dicono mentre la card è ancora in mano, non dopo.
- **Quello che si cambia nel mezzo del servizio sta nella riga dei filtri**,
  sopra la lista, e vale per QUESTO terminale: «▦ Colonne» (che spegne le
  corsie che in quel momento non servono) e il tasto con cui chi non è al
  banco va a guardare il lavoro. Non stanno in Impostazioni perché si
  toccano con l'ordine in mano, e non su `settings/bar` perché al banco e
  alla cassa non si guardano le stesse cose.
- **Nella riga dei filtri, il cambio vista sta A DESTRA.** A sinistra c'è
  quello che RESTRINGE la lista («Miei», «Solo oggi», «Colonne»), a destra
  quello che CAMBIA VISTA: stessa forma e stesso peso, perché si toccano
  allo stesso modo, ma staccati da un margine automatico — non da uno
  spazio messo a occhio — così nessuno lo legge come un filtro in più.
  Sotto il «+» era stato provato e non va: rettangolare sotto un tondo,
  appeso nel vuoto e disallineato da tutto.
- **Sulla lavagna a corsie la riga dei filtri È la riga dei conteggi.** Non
  è un'eccezione alla regola qui sopra: è la stessa riga di filtri, messa
  dove non costa niente. Lì i filtri sono due pastiglie corte, e una riga
  tutta per loro valeva 64px — un terzo livello fra i conteggi e la prima
  comanda, su una lavagna che si guarda da lontano mentre si versa. La riga
  dei conteggi è corta e ha spazio a destra: ci stanno accanto, con la
  regola di sempre (a sinistra chi restringe, a destra chi cambia vista,
  staccati da un margine automatico).
  **Sul telefono no**: lì quella riga è già piena — conti, avviso della
  ricerca, legenda degli autori — e i filtri tornano sotto, a filo a
  sinistra, e scorrono in orizzontale. A dire da dove in su è la
  **lavagna** (container query `corsie`, la stessa soglia delle due
  colonne), non la finestra: col menu agganciato ha 200-250px in meno.
  **La griglia resta com'è**: lì le pastiglie sono sette, e una riga se la
  merita.
- **Un tasto dice DOVE PORTA, non dove si è.** «🍸 Comande» guardando i
  conti, «🧾 Ordini» guardando le comande. Un interruttore che si accende
  quando sei già di là si legge solo sapendo com'è messo adesso — e per
  saperlo bisogna guardare la lista sotto.
- **I filtri stanno dietro un tasto solo, e il tasto dice cosa è scelto senza
  aprirlo.** Nella coda è «⚗️ Filtri» — lo stesso linguaggio del magazzino —
  e la fila nasce chiusa: sette pastiglie si mangiavano la riga in una
  lavagna che si guarda da lontano. Da chiuso porta scritto quello che è
  acceso («⚗️ Chiusi», «⚗️ Miei +2»), perché un filtro acceso e invisibile è
  una coda che sembra sbagliata; l'elenco per esteso sta nel titolo. Aperta,
  i chip compaiono NELLA STESSA RIGA e non in una tendina: si toccano a
  raffica mentre si lavora, e un pannello coprirebbe proprio quello che si
  sta guardando per decidere che filtro serve. La scelta vale per QUESTO
  terminale (`tana:coda:filtri-aperti`). Dentro ci va tutto quello che
  restringe la lista, «▦ Colonne» compreso; fuori il cambio vista, che non
  filtra, e il «＋», che crea. Un meccanismo solo per tutte le viste della
  coda.
- **Il contenuto non porta navigazione**: niente tasti «vai a…» in mezzo a una
  lista, che si trovano solo scorrendo.

## Due cose che non si fanno

- **Una seconda riga sotto la barra.** Costa altezza sempre, per
  un'informazione che serve una volta. Se qualcosa non ci sta, si toglie
  seguendo l'ordine qui sopra.
- **Due modi di tornare indietro nella stessa schermata.** Uno solo, e sempre
  nello stesso posto.

## Dove sta scritto nel codice

- barra e titolo: `src/App.jsx`
- nome della pagina per indirizzo: `src/lib/sezioni.js`
- sottosezioni dichiarate dalle pagine: `src/lib/sottosezioni.js`
- la schermata che sta tutta nella finestra: `src/lib/paginaPiena.js`
- tendine: `src/components/Tendina.jsx`
