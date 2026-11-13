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

E poi, lo stesso giorno, dopo aver visto come lavora la regia:

- **piani online e piani gestiti a mano**: col piano pagato su Stripe il
  modulo si aggiunge all'abbonamento; col piano gestito a mano (pagato
  fuori da Stripe, `abbonamento.origine: 'manuale'` nella regia) «arriva
  una richiesta d'acquisto a me che attivo o disattivo il modulo richiesto
  se ho ricevuto il pagamento»;
- **la disdetta**, coi piani online: **a fine periodo**. Il modulo resta
  acceso fino alla fine del periodo già pagato, poi si spegne; niente
  conguaglio. Una disdetta toccata per sbaglio non spegne niente in piena
  serata, e non si attiva un modulo per un giorno pagandone uno.

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
   - **`aggiungi`**, secondo il piano:
     - *online* (abbonamento Stripe attivo): il modulo si aggiunge alla
       subscription, come fa `cambiaScelta` nella regia, e la risposta è
       `{ "ok": true }`. Un modulo in prova diventa comprato. Se la regia
       vuole far passare dal pagamento, risponde invece con `checkout_url`
       (Stripe Checkout, `success_url` = `ritorno` + `&esito=pagato`,
       `cancel_url` = `ritorno` + `&esito=annullato`): **la licenza si
       aggiorna dal webhook**, mai dal ritorno, perché chi torna con
       `esito=pagato` non ha dimostrato niente;
     - *gestito a mano*: la regia registra la richiesta e la fa arrivare
       all'admin; la risposta è `{ "ok": true, "in_attesa": true }`. Il
       modulo lo accende l'admin dal backoffice, a pagamento ricevuto;
     - *Free*: `409` col testo (il Free non accende moduli comprati);
   - **`disdici`**, secondo il piano:
     - *online*: il modulo resta fino alla fine del periodo già pagato;
       la regia risponde con `dal` (la data ISO in cui si spegne) e lo
       spegne in licenza a quella data;
     - *gestito a mano*: come l'aggiunta, una richiesta all'admin,
       `{ "ok": true, "in_attesa": true }`;
     - un modulo compreso nel piano non si disdice da solo → `409` col
       testo.

Risposte:

```json
{ "ok": true, "checkout_url": "https://checkout.stripe.com/c/pay/…" }
{ "ok": true }
{ "ok": true, "dal": "2026-12-01" }
{ "ok": true, "in_attesa": true }
{ "ok": false, "errore": "La prova di questo modulo è già stata usata." }
```

- `checkout_url` viene aperto dall'app **solo se** comincia con
  `https://checkout.stripe.com/`; ogni altro indirizzo si ignora.
- con `in_attesa: true` l'app non dice «aggiunto» ma «richiesta inviata
  all'assistenza»: il modulo cambia quando l'admin la evade, e l'app lo
  vede dalla licenza come ogni altro cambio.
- `errore` è mostrato al titolare così com'è: italiano, impersonale,
  registro del gestionale («La prova di questo modulo è già stata
  usata.», «Il modulo è compreso nel piano: si toglie cambiando piano.»).
  Senza `errore`, l'app dice un messaggio suo per `401`/`403`, per la
  rete assente e per il resto.

## I moduli che ne richiedono un altro (REQ-LIC-015)

Decisione dell'utente del 07/11/2026. Alcuni moduli da soli non stanno
in piedi:

| Modulo | Richiede | Perché |
|---|---|---|
| `conta` (Inventario di magazzino) | `magazzino` | conta le giacenze del magazzino, e chiudendo le riallinea |
| `ordini_cliente` (Ordini dal telefono) | `menu_tavoli` | il cliente ordina dal menù digitale: senza, non ha una pagina da cui farlo |

Le fatture ai fornitori (`scadenzario`) invece sono **autonome**: aprono
la sezione Fornitori anche senza il magazzino.

Cosa fa l'app (`richiede` in `MODULI_PREMIUM`): un modulo senza la sua
base nella licenza non si prova e non si aggiunge («Richiede …» al posto
dei tasti); incluso senza la base non lavora, e le impostazioni lo
dicono; la disdetta di una base avvisa dei moduli che si spengono con
lei.

**Cosa serve dalla regia**, perché l'app non è l'unica porta:

- `moduloDallApp` con `prova` o `aggiungi` su un modulo la cui base non è
  nella licenza → `409` col testo («Richiede il modulo Magazzino e
  fornitori.»);
- la disdetta di una base non spegne da sola i moduli che la richiedono:
  restano in licenza e in fattura, ma non lavorano. Va deciso con
  l'utente se disdirli insieme;
- il backoffice e i piani (`piani.json`) non dovrebbero comporre una
  licenza con un modulo senza la sua base.

## Fuori da qui, per ora

- Cambiare **piano** (Free → Pro) dall'app: resta dalla regia.
- Le fatture dell'abbonamento: le manda Stripe / la regia.
- I **temi a pagamento** (REQ-LIC-011): stesso schema, ma una tantum.
