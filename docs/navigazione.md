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
  Impostazioni: Aspetto, Pagamenti…) stanno **nella pagina**, aperte, in una
  barra a sinistra: il contenuto si stringe per far loro posto invece di
  finirci sotto. Chi ha bisogno di spazio la **stringe a icone** col « in
  cima, e la ritrova stretta la volta dopo (una memoria per pagina).

  Un menu che copre il contenuto sembra gratis e non lo è: dentro
  l'inventario si salta fra Prodotti e Conta venti volte di seguito, e ogni
  volta bisogna aprirlo, cercare, scegliere — e mentre è aperto non si vede
  più dove si era. Meglio spendere una colonna che si può chiudere.

  Le sezioni compaiono **anche nel menu laterale**, rientrate sotto la pagina
  aperta: da lì ci si arriva stando su un'altra pagina, dalla barra in pagina
  ci si gira dentro. Due strade per la stessa cosa, non due cose diverse.

  Le altre strade non reggono: una **riga di schede** in pagina costa altezza
  e sul telefono non ci sta; le **schede nella barra** reggono cinque voci,
  non ventidue; una **tendina** costringe ad aprirla per sapere cosa c'è
  dentro.

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
