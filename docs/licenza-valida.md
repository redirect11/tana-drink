# Senza licenza valida l'app non parte (REQ-LIC-009)

Richiesta della regia (drink-regia, REQ-FLOTTA-025), 02/11/2026. La regia
è già pronta: [drink-regia PR #38](https://github.com/redirect11/drink-regia/pull/38),
ramo `feature/conservazione-dati`.

## La decisione dell'utente

> «Se non c'è nessuna licenza non dovrebbe partire proprio il prodotto, o
> licenza scaduta, e dovrebbe essere già così. Anzi, al massimo, se dalla
> regia è attiva l'opzione, dovrebbe diventare versione free ma senza far
> perdere i dati al cliente, ma dovremmo avvisare il cliente che, anche per
> una questione regolamentatoria, dobbiamo cancellare i suoi dati entro un
> tot e avvisarlo quando stiamo per cancellarli.»

Decisioni dello stesso giorno: i dati di un locale fermo restano 90
giorni, poi si cancellano; un locale tornato al Free non perde niente; gli
avvisi arrivano subito, 7 giorni prima e il giorno prima, per email, nella
dashboard della regia e nell'app.

## Cosa cambia per tana-drink

### 1. Le regole: senza licenza valida si nega, non si apre

Oggi REQ-LIC-008 dice «SENZA DOCUMENTO DELLA LICENZA NON SI LIMITA NIENTE»
(`!licenzaScritta() || …` in `firestore.rules`). Con la decisione
dell'utente va rovesciato, per **tutti** i locali, la Tana compresa:

- **senza `licenza/attuale`** le scritture dell'app si negano (resta
  leggibile la licenza stessa, e quello che serve per mostrare «Installazione
  non attivata»: utenti, accesso);
- **`stato: 'sospesa' | 'chiusa'`**: si nega come senza licenza;
- **licenza scaduta** (`valida_fino` passata): se `alla_scadenza ==
  'free'` valgono i limiti del Free; se `'ferma'`, si nega. La regia, alla
  scadenza, riscrive comunque la licenza (Free o sospesa): questo serve
  per il tratto in cui l'app è senza rete o la regia non ha ancora scritto.
  Le regole non leggono una data scritta come testo: se serve, la regia può
  scrivere anche `valida_fino_ts` come Timestamp. Ditelo nella risposta.

Le letture dei dati restano permesse anche da fermo: il titolare deve
poter vedere e scaricare quello che ha, fino alla cancellazione.

### 2. L'app: non parte senza licenza valida

- Senza `licenza/attuale`: «Installazione non attivata» (c'è già, BUG-125).
- `stato` sospesa o chiusa: una schermata che dice che il servizio è fermo,
  con il motivo (`motivo`) e cosa fare.
- `valida_fino` passata **anche senza rete**: con `alla_scadenza: 'free'`
  l'app lavora col Free (i limiti di `REQ-LIC-003`, gli stessi che la
  regia scriverà); con `'ferma'` si comporta come sospesa. `valida_fino`
  cade sempre al taglio della giornata del locale (`business_day_cutoff_hour`),
  quindi non ferma mai l'app in pieno servizio.

### 3. L'avviso della cancellazione dei dati

La licenza porta `cancellazione: { il, richiedente } | null`:

- `richiedente: 'conservazione'`: il locale è fermo per il pagamento, i dati
  restano fino a `il`; riattivare l'abbonamento annulla la cancellazione;
- `'titolare'`: l'ha chiesta il titolare dalla dashboard (la può annullare
  lì);
- `'admin'`: l'ha decisa il fornitore.

L'app la mostra **sempre**, sopra a tutto, anche nella schermata del locale
fermo: la data, che prima si fa un backup che il titolare scarica dalla
sua area clienti per 180 giorni, e cosa fare per evitarla. Testo di
riferimento (quello della dashboard della regia): «L'app del locale è
ferma. I dati restano conservati fino al 31 gennaio 2027: quel giorno
l'installazione e i suoi dati verranno cancellati definitivamente, dopo un
backup che potrai scaricare dalla tua area clienti per 180 giorni. Per
evitarlo basta riattivare l'abbonamento.»

### 4. La Tana

Con le regole rovesciate, la Tana senza `licenza/attuale` si fermerebbe:
la licenza nella build (`clienti/<slug>/licenza.json`) le regole non la
vedono. Prima di rilasciare le regole nuove:

- si scrive **una volta** `licenza/attuale` nel progetto `tana-drink` con
  tutti i moduli, **col via libera dell'utente** (è la produzione), e
  prima ancora su `tana-drink-test`;
- il file di licenza nella build non serve più e si toglie;
- più avanti la scriverà la regia, quando la Tana sarà collegata alla
  regia per la licenza.

## Il contratto della licenza, aggiornato

```
licenza/attuale = {
  piano, moduli: { id: bool }, terminali, limiti, prove,
  stato: 'attiva' | 'sospesa' | 'chiusa', motivo, dal,
  slug, regia_url, aggiornamenti,
  valida_fino: ISO | null,        // al taglio della giornata dopo la scadenza
  alla_scadenza: 'free' | 'ferma',
  cancellazione: { il: ISO, richiedente: 'conservazione' | 'titolare' | 'admin' } | null,
  scritta_il
}
```

Resta valido tutto quello che la regia già rispetta: il documento c'è prima
dell'app, `moduli` nomina tutti i moduli, non si cancella mai, gli sconti
si spengono solo con `limiti.sconti: false`, le riduzioni arrivano al
taglio della giornata.
