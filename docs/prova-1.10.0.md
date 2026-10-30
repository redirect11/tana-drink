# Prova della 1.10.0 sulla Tana di test

Da fare sul tablet del banco (o su quello che si usa la sera), puntato su
`tana-drink-test`, **dopo** il tag `v1.10.0` su `develop`. Il punto è
provare il primo avvio di un dispositivo che aveva la versione di prima:
le chiavi locali cambiano prefisso (`tana:` → `drink:`) e la cache del
service worker cambia nome, quindi è lì che si vede se qualcosa si perde.

## Prima del tag, sulla versione di adesso (1.9.10-beta)

- [ ] Annotare **IP della stampante** e **zoom** del tablet.
- [ ] Annotare il **numero dell'ultimo conto** battuto.
- [ ] Lasciare un conto con una **bozza non confermata** (righe aggiunte e
      non mandate), per vedere che sopravvive.

## Il primo avvio dopo l'aggiornamento

- [ ] Aprire l'app: compare «Nuova versione» o il box delle novità con la
      sezione **1.10.0**. Il primo avvio può metterci qualche secondo in più.
- [ ] In fondo al menu laterale si legge `v1.10.0 · develop · <commit>`.
- [ ] **Stampante**: l'IP è quello annotato, senza reimpostarlo.
- [ ] **Zoom**: quello di prima.
- [ ] **Preferenze del banco** ancora lì: preferiti e colori del POS,
      ordine della coda, sezione di Impostazioni aperta per ultima.
- [ ] La **bozza** lasciata prima c'è ancora, con le sue righe.
- [ ] Chiudere e riaprire l'app: il secondo avvio è normale e il box delle
      novità non ricompare.

## Una serata in piccolo

- [ ] **Un conto battuto e chiuso**: aprire un conto, aggiungere un paio di
      drink, incassare in contanti. Il **numero** è quello dopo l'ultimo
      annotato, non riparte da 1 e non salta.
- [ ] Con «Calcolo del resto in contanti» acceso (Impostazioni →
      Pagamenti): indicare quanto ha dato il cliente e controllare il resto.
- [ ] **Lo scontrino** esce dalla stampante, col logo e l'intestazione di
      sempre. In fondo **nessuna riga «Creato con»**.
- [ ] **SumUp come prima**: un incasso con il lettore, come lo si prova di
      solito sul test, va a buon fine e il conto si chiude; nelle
      impostazioni SumUp risulta attivo, senza avvisi di modulo «non nel
      piano».
- [ ] Le **comande** escono e si segnano servite come sempre.

## Il menù digitale

- [ ] Dal telefono, `/menu` sul test (anche dal QR di un tavolo): si apre,
      col carosello degli Special in cima.
- [ ] Toccando un drink si apre il **dettaglio** (immagine, descrizione,
      ingredienti, «Aggiungi»); «Aggiungi» mette il drink nel carrello.
- [ ] `/menu/special` si apre su due colonne.
- [ ] In fondo al menù **nessuna riga «Creato con»**, nessun riferimento a
      «Free» o ai piani.

## Impostazioni → Il locale

- [ ] La sezione c'è, con nome, nome corto, «Il locale nella frase»,
      slogan, «chi siamo», città, email, ragione sociale, intestazione
      dello scontrino e social. Le caselle vuote mostrano in grigio i
      valori della Tana.
- [ ] Senza toccare niente, nome nel menù, benvenuto e intestazione dello
      scontrino sono quelli di prima.
- [ ] Facoltativo: scrivere qualcosa in «Il locale nella frase», salvare,
      vederlo nel benvenuto del menù, poi svuotare la casella e controllare
      che torni «alla Tana del Coniglio».

## Tutte le funzioni di prima ci sono (BUG-122)

La Tana ha una licenza scritta dagli strumenti di sviluppo con i tre moduli
di allora. Controllare che con la 1.10.0 ci siano ancora, e si aprano:

- menù digitale e tavoli, e gli ordini dal telefono del cliente;
- clienti (account, gruppi di conti);
- magazzino e fornitori, inventario;
- statistiche e bilancio;
- personale e ore;
- SumUp in cassa e nelle impostazioni;
- lo scadenzario delle fatture ai fornitori.

## Niente Free sulla Tana

- [ ] In nessuna schermata (banco, gestionale, menù, scontrino) compaiono
      «Free», «Creato con», limiti di prodotti o di conti, o inviti alla
      pagina dei piani.
- [ ] Sconti, storico, account dello staff e foto dei prodotti funzionano
      come prima.

## Se va tutto bene

Si dice «ok» e si prosegue con la pull request `develop` → `main` e il tag
di produzione. Se qualcosa non torna, una nota vocale o una schermata in
`registrazioni/`, con il numero letto in fondo al menu laterale.
