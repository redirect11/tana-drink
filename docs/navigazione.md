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
- **I filtri** stanno in una tendina sopra il contenuto, e il tasto dice cosa
  è scelto senza doverla aprire.
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
