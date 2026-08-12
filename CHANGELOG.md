# Cosa è cambiato

Le note di ogni versione, dalla più recente. Si leggono anche dentro
l'app: **Impostazioni → Informazioni**.

I numeri seguono il versionamento semantico: il primo cambia quando si
rompe qualcosa di come si lavorava prima, il secondo quando si aggiunge
una funzione, il terzo per le correzioni.

---

## Non ancora rilasciata — 1.3.0

### Al banco

- **Gli item battuti mentre l'ordine sta nascendo non si perdono più.** Si
  aggiungeva un'acqua, un secondo dopo dell'altro, e quando il conto
  finiva di crearsi restava solo l'acqua.
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
- **I colori seguono chi guarda, non la pagina.** Chi lavora vede il tema
  del gestionale dappertutto — profilo, lista ordini, accesso compresi —;
  chi ordina vede il suo. Prima bastava un indirizzo dimenticato e in
  mezzo alla serata arrivavano i colori del cliente.
- Nelle impostazioni si cambia **il tema del gestionale e quello della
  vista cliente**, e adesso c'è scritto quale si sta toccando.
- Nella coda a griglia **titolo, ricerca, ⋯ e ➕ stanno sulla stessa
  linea**; conteggi e legenda vanno sulla riga sotto. Su tablet e desktop
  non era allineato niente.
- **Impostazioni a schede**: ventuno riquadri diventano voci di una barra
  laterale, una alla volta.
- **Backup e ripristino di tutto il database**, dall'app e da riga di
  comando.
- **Buoni VIP** dentro Utenti e ruoli; **stampante** dentro Impostazioni.
- La pagina riempie lo schermo invece di stare in una colonna da 760px.
- **L'app si installa anche su iPhone** come si deve (icona, invito, e
  senza l'app installata niente schermo intero né notifiche: ora lo dice).
- In fondo al menu c'è **la versione** che si sta guardando.

### Sotto il cofano

- La pipeline fa **prima lint e test, poi il deploy**: se qualcosa è rosso
  non si pubblica niente.
- Si lavora su un ramo di rilascio, e i branch di lavorazione vanno da
  soli sull'ambiente di test.
- **93 requisiti** scritti in `requirements/requirements.yaml`, legati ai
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
