# Il tipo di locale, dalla regia all'app (REQ-VENUE-007)

Richiesta scritta dalla sessione di drink-regia il 12/11/2026, su decisione
di Daniele. Da implementare qui. Nessun cambiamento visibile per i locali.

## Perché

Decisione di Daniele del 05/11/2026: un prodotto solo, lancio sui bar, in
futuro anche ristoranti e pizzerie, a partire dai testi. Un giorno l'app di
un ristorante dirà «cucina» dove quella di un bar dice «banco».

Per arrivarci l'app deve sapere che tipo di locale è. Oggi non lo sa:

1. alla registrazione sul sito il titolare sceglie il tipo fra sette
   (cocktail bar, bar, pub, ristorante, pizzeria, enoteca, altro);
2. la regia lo salva nella scheda del cliente;
3. quando costruisce l'app, la regia lancia qui
   `node scripts/genera-cliente.mjs --slug <slug> --nome <nome>`
   (REQ-VENUE-006), e **il tipo non lo passa**.

Questa richiesta fa arrivare il dato fino a `venue.json`. Cosa l'app ne
farà è un lavoro successivo, che oggi non si fa.

## Cosa deve fare `genera-cliente.mjs`

Due cose nuove, e nient'altro che cambi.

### 1. Rispondere alla domanda «sai leggere il tipo di locale?»

```sh
node scripts/genera-cliente.mjs --sa tipo-locale
```

- esce con **0**, senza scrivere niente su disco;
- stampa su stdout **soltanto** una riga JSON coi valori che accetta, oggi
  `{"tipo-locale":["bar"]}`. Niente altro su stdout, nemmeno una riga di
  log: la regia legge tutto lo stdout come JSON. Gli avvisi, se servono,
  vanno su stderr, che la regia ignora;
- i valori stanno in un **elenco**, anche quando è uno solo.

La regia fa questa domanda prima di costruire l'app. Le versioni di oggi,
che non conoscono `--sa`, escono con 1 (manca `--slug`): la regia lo prende
come «no» e lancia lo script come oggi. Così una versione vecchia dell'app
non si rompe mai.

Qualunque altra cosa dopo `--sa` (una capacità che lo script non ha) esce
con 1, senza scrivere niente.

### 2. Accettare `--tipo-locale <valore>`

```sh
node scripts/genera-cliente.mjs --slug bar-mario --nome "Bar Mario" --tipo-locale bar
```

- Il valore va scritto in `clienti/<slug>/venue.json`. Il nome del campo lo
  sceglie questo repository; la regia non lo legge mai. Una proposta:
  `venue_tipo_locale`.
- **Valori accettati oggi: solo `bar`.** Un valore che lo script non
  conosce lo ferma **prima di scrivere**, con uscita 1 e un messaggio: la
  regia non lo manda, perché prima chiede l'elenco con `--sa`.
- **Senza `--tipo-locale`** lo script fa esattamente quello che fa oggi, e
  `venue.json` non ha il campo. Chi leggerà il campo, un domani, tratterà
  «assente» come `bar`.
- **Se la cartella del cliente esiste già** non la tocca, come oggi
  (REQ-VENUE-006): un cliente curato a mano, come la Tana, resta com'è.

## Cosa NON fa

- L'app non usa il campo: nessun testo cambia, nessuna schermata.
- Nessun altro argomento cambia. `--slug` e `--nome` restano come sono, e
  così le uscite di oggi.
- Nessun valore oltre `bar`. Quando arriverà il tipo «ristorante», sarà
  una richiesta nuova, e la regia saprà mandarlo perché `--sa` lo elencherà.

## Cosa farà la regia (drink-regia, non qui)

Nei workflow che costruiscono l'app di un locale (`provisiona-istanza.yml`
e `aggiorna-istanza.yml`):

```sh
SA=$(node scripts/genera-cliente.mjs --sa tipo-locale 2>/dev/null) || SA=''
if [ -n "$SA" ] && node -e '…elenco["tipo-locale"] contiene "bar"…' -- "$SA" bar; then
  node scripts/genera-cliente.mjs --slug "$SLUG" --nome "$NOME" --tipo-locale bar
else
  # se $SA non è vuoto, la regia lo segnala come avviso: formato sbagliato
  node scripts/genera-cliente.mjs --slug "$SLUG" --nome "$NOME"
fi
```

Cioè: la regia manda `--tipo-locale bar` solo se l'uscita è 0, lo stdout è
un JSON valido, e il suo `"tipo-locale"` è un elenco che contiene `bar`.
In ogni altro caso fa la chiamata di oggi. Se la risposta c'era ma non era
nel formato atteso, nel registro del workflow compare un avviso: così un
errore di formato da questa parte si vede.

Per ora manda sempre `bar`, a tutti: è la decisione di Daniele del
12/11/2026 («tutti i tipi vanno a bar finché non decido altrimenti»). Il
tipo scelto alla registrazione resta salvato nella regia com'è, così il
giorno che servirà è già lì.

## Criteri di accettazione

1. `--sa tipo-locale` esce con 0, non scrive niente, e su stdout c'è
   soltanto `{"tipo-locale":["bar"]}`.
2. `--sa` con un'altra capacità esce con 1 e non scrive niente.
3. `--tipo-locale bar` scrive il valore in `venue.json`.
4. `--tipo-locale` con un valore sconosciuto esce con 1 e non crea la
   cartella.
5. Senza `--tipo-locale`, `venue.json` è identico a quello di oggi.
6. Con la cartella del cliente già presente, nessun argomento la tocca.
7. I test esistenti di `tests/unit/generaCliente.test.js` restano verdi
   senza cambiarli: il contratto di oggi non si rompe.

Tutti provati in `tests/unit/generaCliente.test.js`, che lancia lo script
davvero in una cartella temporanea.

## Ordine dei rilasci

Nessun vincolo: la regia chiede prima con `--sa`, quindi può andare prima o
dopo questa modifica. In produzione la regia usa l'app di `main`, dove
`genera-cliente.mjs` oggi non c'è ancora: lì il controllo dirà «no» finché
la 1.10 non arriva su `main`.

## Due punti deboli

- Il dato arriva all'app ma nessuno lo usa: finché non c'è il primo testo
  che cambia, non si vede se il campo è nel posto giusto per chi lo leggerà.
- `--sa` è un piccolo protocollo nuovo fra due repository. Se un domani
  servono altre capacità, conviene tenerle tutte lì e non inventarne una
  seconda.

## Dove potrei sbagliare

Ho letto `genera-cliente.mjs` e il suo test sul ramo `develop` del
12/11/2026. Se nel frattempo un altro ramo ha cambiato lo script, i criteri
5 e 7 vanno riletti contro quella versione.
