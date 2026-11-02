# Il marketplace dei moduli (REQ-LIC-012)

Per la regia (drink-regia) e per chi lavora qui. 02/11/2026.

## La decisione dell'utente

> «Anche per i moduli aggiuntivi andrebbe fatto il marketplace.»

E, alle tre domande dello stesso giorno:

- **come si pagano**: «al mese, come nel listino» — l'abbonamento mensile
  di `functions/piani.json` della regia, IVA esclusa;
- **la prova**: «sì, una prova gratuita» — prima di pagare, per i giorni
  che dice la regia;
- **chi compra**: «solo il titolare» — il ruolo `admin`, non i bartender.

Gli acquisti sono **dentro l'app** (decisione del 02/11 sui temi, che vale
anche qui): niente rimando all'area clienti per comprare.

## Cosa fa l'app

Nel gestionale, «🛍️ Marketplace» → **Moduli**: una scheda per ogni modulo
dell'app (`MODULI_PREMIUM` in `src/lib/licenza.js`), con

- lo **stato**, dalla licenza: *Incluso*, *In prova fino al…*
  (`licenza.prove`), *Non incluso*;
- il **prezzo** mensile e i **giorni di prova**, dal listino della regia;
- i **tasti**, solo per il titolare e solo se la licenza è della regia
  (c'è `VITE_REGIA_PROGETTO` nella build **e** `licenza.regia_url`):
  - *Prova gratis N giorni* — modulo non incluso, con `prova_giorni > 0`;
  - *Aggiungi* — modulo non incluso o in prova;
  - *Disdici* — modulo incluso, con la finestra di conferma.

Un modulo che il listino non porta (oggi `conta`, `fatture`,
`scadenzario`) si vede, ma «Non acquistabile singolarmente».

La licenza della Tana è scritta dal deploy, senza `regia_url`: lì i
moduli si consultano soltanto. È voluto: la regia non saprebbe a chi
intestare l'acquisto.

L'app **non scrive niente** nel suo database per un modulo: chiede alla
regia, e la regia riscrive `licenza/attuale`. L'app vede il cambio in
tempo reale, come ogni cambio di licenza, e la sezione del modulo compare
da sola.

## Quello che serve dalla regia

Due Functions, nella regione `europe-west1` del progetto della regia
(`drink-regia`, `drink-regia-test`).

### `catalogoModuli` — il listino (GET, pubblico)

```json
{
  "moduli": [
    { "id": "magazzino", "prezzo": 15, "prova_giorni": 14 },
    { "id": "clienti", "prezzo": 6, "prova_giorni": 7 },
    { "id": "sumup", "prezzo": 10, "prova_giorni": 0 }
  ]
}
```

- `id`: lo stesso di `piani.json` e di `MODULI_PREMIUM`. Un id che l'app
  non conosce si ignora: un modulo nuovo arriva con l'app.
- `prezzo`: euro al mese, IVA esclusa (l'app scrive «15,00 € al mese + IVA»).
- `prova_giorni`: 0 o assente = niente prova.
- Nome e descrizione li tiene l'app: sono le parole delle sue schermate.

Si legge quando il titolare apre i Moduli, mai a tempo; l'app ricorda
l'ultimo listino letto per quando la rete manca. CORS aperto (la legge il
browser).

### `moduloDallApp` — prova, acquisto, disdetta (POST)

Con `Authorization: Bearer <ID token Firebase>` di chi ha fatto l'accesso
nell'app del locale, come per `presentazione` e per la scelta sugli
aggiornamenti. Corpo:

```json
{
  "modulo": "clienti",
  "azione": "prova | aggiungi | disdici",
  "ritorno": "https://<dominio del locale>/bar?tab=marketplace&sezione=moduli"
}
```

La regia:

1. **riconosce l'installazione** dal progetto del token, come per la
   presentazione;
2. **controlla che sia il titolare**: il claim del ruolo `admin`. Un altro
   ruolo → `403`;
3. **controlla `ritorno`**: deve essere un indirizzo dei domini
   dell'installazione (Hosting del progetto, domini personalizzati). Un
   indirizzo diverso → `400`. Non si usa mai un `ritorno` non controllato
   come pagina d'arrivo di Stripe;
4. esegue l'azione:
   - **`prova`**: accende il modulo in `licenza.moduli` e scrive la
     scadenza in `licenza.prove.<modulo>` (REQ-FLOTTA-016). Una prova sola
     per modulo e per installazione: la seconda → `409` col testo;
   - **`aggiungi`**: crea una sessione di Stripe Checkout in abbonamento
     mensile (il prezzo del listino), con `success_url` = `ritorno` +
     `&esito=pagato` e `cancel_url` = `ritorno` + `&esito=annullato`, e
     risponde con `checkout_url`. **La licenza si aggiorna dal webhook di
     Stripe**, non da questa chiamata e non dal ritorno: chi torna con
     `esito=pagato` non ha dimostrato niente. Un modulo in prova diventa
     comprato (si toglie da `licenza.prove`);
   - **`disdici`**: l'abbonamento del modulo finisce alla chiusura del
     periodo già pagato; la regia risponde con `dal` (la data ISO in cui
     il modulo si spegne) e spegne il modulo in licenza a quella data. Un
     modulo compreso nel piano non si disdice da solo → `409` col testo.

Risposte:

```json
{ "ok": true, "checkout_url": "https://checkout.stripe.com/c/pay/…" }
{ "ok": true }
{ "ok": true, "dal": "2026-12-01" }
{ "ok": false, "errore": "La prova di questo modulo è già stata usata." }
```

- `checkout_url` viene aperto dall'app **solo se** comincia con
  `https://checkout.stripe.com/`; ogni altro indirizzo si ignora.
- `errore` è mostrato al titolare così com'è: italiano, impersonale,
  registro del gestionale («La prova di questo modulo è già stata
  usata.», «Il modulo è compreso nel piano: si toglie cambiando piano.»).
  Senza `errore`, l'app dice un messaggio suo per `401`/`403`, per la
  rete assente e per il resto.

## Fuori da qui, per ora

- Cambiare **piano** (Free → Pro) dall'app: resta dalla regia.
- Le fatture dell'abbonamento: le manda Stripe / la regia.
- I **temi a pagamento** (REQ-LIC-011): stesso schema, ma una tantum.
