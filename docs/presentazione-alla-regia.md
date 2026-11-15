# L'app si presenta alla regia (REQ-FLOTTA-026)

> **Il contratto con la regia** è in drink-regia, [`docs/contratto-regia-app.md`](https://github.com/redirect11/drink-regia/blob/develop/docs/contratto-regia-app.md): se non coincide con questo documento, vale quello. Qui restano i dettagli del lato dell'app.

Richiesta della regia (drink-regia, REQ-FLOTTA-026), 02/11/2026. La parte
della regia è pronta: [drink-regia PR #40](https://github.com/redirect11/drink-regia/pull/40).

## La decisione dell'utente

> «Non deve essere il deploy ad avvisare la regia ma l'istanza del sito
> stesso in qualche modo. Cioè regia e il sito custom del bar si devono
> parlare dopo il deploy e si scambiano dati tra loro rispetto alle licenze
> attivazione e etc.»

Quindi l'app stessa, quando parte con una versione nuova, dice alla regia
chi è e che versione ha. Vale da qualunque deploy: dalla regia o dal
`deploy.yml` di questo repository (la Tana).

**Non è l'attivazione** (vostra nota del 02/11/2026): l'app non fa accessi
anonimi, e su un'installazione nuova senza licenza la schermata «non
attivata» copre anche l'accesso. La licenza c'è prima dell'app:
l'attivazione della regia la scrive prima del deploy, e per la Tana la crea
il vostro deploy (PR #261). Se manca lo stesso e un dispositivo ha ancora
una sessione aperta, la presentazione la fa riscrivere alla regia.

## La chiamata

```
POST https://europe-west1-<VITE_REGIA_PROGETTO>.cloudfunctions.net/presentazione
Authorization: Bearer <ID token dell'utente che ha fatto l'accesso>
Content-Type: application/json

{ "versione": "v1.10.4", "dispositivo": "AbCdEfGhIjKlMnOpQrStUv" }
```

- **Il dispositivo** (dalla 1.10.51, REQ-FLOTTA-031; regia REQ-FLOTTA-112):
  un codice casuale di 16 byte in base64url senza padding, 22 caratteri
  (`^[A-Za-z0-9_-]{22}$`), creato al primo avvio e tenuto in
  `localStorage` (`drink:codice_regia`). Non contiene niente dell'utente né
  del locale; se la memoria del browser si svuota, ne nasce uno nuovo. Con
  questo la regia tiene una versione per dispositivo: `presentazione.versione`
  è la più alta fra i dispositivi attivi, `presentazione.minima` la più
  bassa, ed è quella che decide quando si può togliere un'interfaccia
  deprecata. Le app fino alla 1.10.50 non lo mandano, e la regia le conta
  come un dispositivo solo (`senza_codice`).

- **Il token**: quello che Firebase dà all'app nel progetto del locale,
  come per la scelta degli aggiornamenti (`sceltaDallApp`). Va bene un
  utente qualunque del locale: la licenza la decide la regia, non chi
  chiama.
- **La versione**: quella della build (`package.json`), con o senza la «v».
- **`VITE_REGIA_PROGETTO`**: il progetto della regia, nella build. I
  workflow della regia lo mettono già (`drink-regia` o `drink-regia-test`).
  Nel `deploy.yml` di qui va aggiunto: `drink-regia` per la produzione,
  `drink-regia-test` per il test. L'app accetta solo quei due, come
  `PROGETTI_REGIA` per `scelta_url`. Senza variabile, nessuna chiamata.

Risposte:

| Codice | Corpo | Cosa vuol dire |
|---|---|---|
| 200 | `{ ok: true, licenza: 'scritta' }` | Mancava, la regia l'ha riscritta: l'app la vede arrivare in tempo reale |
| 200 | `{ ok: true, licenza: 'presente' }` | C'era già |
| 200 | `{ ok: true, licenza: 'non_dalla_regia' }` | Un locale con la licenza sua (oggi la Tana): la regia segna solo la versione |
| 200 | `{ ok: true, licenza: 'non_attiva' }` | Nella regia l'istanza non è ancora attiva, o è chiusa |
| 400 | `{ errore }` | Versione non valida |
| 401 | `{ errore }` | Token mancante o non valido: entrare di nuovo |
| 404 | `{ errore }` | La regia non conosce questo progetto |
| 503 | `{ errore }` | La licenza non si è scritta: riprovare più tardi |

## Quando chiamare

Mai a tempo (l'utente: «ste cose in polling si portavano negli anni 90»).

- **Al più una volta al giorno per dispositivo**, dopo l'accesso, anche a
  versione invariata (dalla 1.10.51, REQ-FLOTTA-031): all'apertura e quando
  l'app torna in primo piano, se questo dispositivo non ha presentato questa
  versione nelle ultime 24 ore (`drink:presentata` e `drink:presentata_il`
  in `localStorage`). Prima era una volta per versione, ma la regia dimentica
  un dispositivo che non si presenta da 30 giorni: un tablet rimasto su una
  versione vecchia e usato ogni sera sarebbe uscito dal conto mentre
  chiamava ancora le interfacce vecchie. Il primo piano conta perché il
  tablet del banco resta aperto per giorni senza essere ricaricato. La
  regia scrive al più ogni 6 ore per dispositivo.
- **Solo con qualcuno collegato**: senza sessione non si chiama (niente
  accessi anonimi). Nessun tasto «Riprova» nella schermata «non attivata».
- Un errore di rete non blocca niente: si riprova alla prossima apertura.

## La Tana

Per ora la Tana risponde `non_dalla_regia`: la regia segna la versione ma
la licenza resta quella creata dal vostro deploy (PR #261). Quando la regia
di produzione sarà online e la Tana collegata (il permesso alla regia sui
due progetti, che dà l'utente, e la licenza dalla regia accesa), la regia
le scriverà la licenza come agli altri locali, prima di ogni suo
cambiamento, e il passo nel deploy si toglierà. La presentazione resterà
quello che è: la versione che gira davvero.

## Da fare qui

- La chiamata, con i tempi qui sopra, e l'indirizzo costruito da
  `VITE_REGIA_PROGETTO` con il controllo su `PROGETTI_REGIA`.
- `VITE_REGIA_PROGETTO` nel `deploy.yml`.
- I test: la chiamata parte una volta per versione, solo con una sessione,
  e non parte senza variabile o con un progetto non ammesso.
