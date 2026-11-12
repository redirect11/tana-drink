# Firebase Functions

Le Cloud Functions di Tana Drink. Fanno tre mestieri: **incassare** (SumUp,
lettore e checkout online), **avvisare** (notifiche push a cliente e
personale) e **amministrare** (account dello staff, numerazione dei conti).

- **Regione**: `europe-west1`
- **Runtime**: Node.js 20 · Gen2 (girano su Cloud Run)
- **Codice**: [functions/index.js](../functions/index.js) è solo il *wiring*
  (registrazione degli handler, lettura dei parametri, `fetch` reale, accesso
  a Firestore). La logica sta nei moduli di `functions/lib/`, puri e
  testabili senza emulatori.
- **Requisiti**: [requirements/requirements.yaml](../requirements/requirements.yaml)
- **Test**: [tests/unit/](../tests/unit/) e [tests/bdd/](../tests/bdd/)

> **SumUp Cassa Pro non c'è più.** Fino al 26/08/2026 qui viveva anche una
> seconda integrazione SumUp — *POS Pro* / Goodtill, *External Sales* — che
> ricopiava ogni vendita nel loro registratore di cassa: quattro functions
> (`syncSumUpProducts`, `createSumUpSale`, `updateSumUpSaleStatus`,
> `sumupWebhook`) e due moduli. Non è mai stata accesa ed è stata rimossa su
> decisione dell'utente. **Da non confondere col lettore**: incassare col POS
> SumUp è l'altra integrazione, quella descritta qui sotto, e funziona.

## Architettura

| Modulo | Responsabilità |
| --- | --- |
| `lib/payment-core.js` | Logica pura dei pagamenti (parsing dei webhook, decisioni di stato) |
| `lib/payment-service.js` | Orchestrazione pagamenti (Firestore + chiamate SumUp) |
| `lib/push-core.js` | Decide *cosa* notificare e *a chi* (puro) |
| `lib/staff-service.js` | Account dello staff e ruoli (custom claim) |
| `lib/numerazione.js` | Numero del conto, e cosa fare dei duplicati |

Le dipendenze (`db`, `fetch`, `isConfigured`, `serverTimestamp`…) sono
iniettate in `index.js` e sostituite da mock nei test.

## Configurazione

| Variabile | Tipo | Default | Descrizione |
| --- | --- | --- | --- |
| `SUMUP_API_KEY` | **secret** | — | Chiave API SumUp per i pagamenti |
| `SUMUP_MERCHANT_CODE` | env | `''` | Codice esercente (non è un segreto) |
| `SUMUP_PAYMENTS_BASE` | env | `https://api.sumup.com` | URL base dell'API pagamenti |
| `SUMUP_AFFILIATE_KEY` | env | `''` | Chiave affiliazione per il lettore Solo |
| `SUMUP_AFFILIATE_APP_ID` | env | `it.latanadelconiglio.drink` | Id applicativo per l'affiliazione |
| `REGIA_AI_KEY` | **secret** | — | La «Chiave AI» del locale verso la regia (`<slug>.<segreto>`, si crea nel backoffice della regia). Col segnaposto `non-configurato` l'AI è spenta (REQ-AI-003) |
| `REGIA_PROGETTO` | env | — | Il progetto della regia a cui l'AI chiede: `drink-regia` in produzione, `drink-regia-test` sul test. Senza, l'AI è spenta |

Il segreto si imposta così, e **non** finisce nel repo:

```bash
firebase functions:secrets:set SUMUP_API_KEY
```

**Ogni segreto dichiarato deve esistere prima del deploy**, anche solo col
segnaposto: Firebase non pubblica nessuna Function se ne manca uno. Per
`REGIA_AI_KEY`, in ogni progetto dove si pubblicano le Functions
(`tana-drink-test`, `tana-drink`, `drinkpos-prova-e2e`):

```bash
echo -n "non-configurato" | firebase functions:secrets:set REGIA_AI_KEY --data-file=- --project <progetto>
```

(in PowerShell il valore va scritto senza ritorno a capo, oppure con
`firebase functions:secrets:set REGIA_AI_KEY` e incollandolo quando lo chiede)
e poi, quando la regia ha creato la Chiave AI del locale, lo stesso comando
col valore vero. Nei locali della flotta il segnaposto **dovrà** crearlo la
regia: va aggiunto `REGIA_AI_KEY` a `SEGRETI_APP` dei suoi due workflow
(`provisiona-istanza.yml`, `aggiorna-istanza.yml`), che al 12/11/2026
contengono solo `SUMUP_API_KEY`, e la regia deve scrivere anche
`REGIA_PROGETTO` nel `functions/.env.<progetto>` del locale. Senza
`REGIA_PROGETTO` l'AI resta spenta.

I pagamenti sono **no-op** finché `SUMUP_API_KEY` e `SUMUP_MERCHANT_CODE` non
ci sono entrambi: `isConfigured()` risponde `false` e non parte nessuna
chiamata di rete.

[`functions/.env`](../functions/.env) è committato apposta (ed esentato nel
`.gitignore`): è il posto dichiarato per la configurazione **non segreta**, e
serve a non far bloccare il deploy non interattivo, che senza un valore —
anche vuoto — per le variabili attese si mette a chiederle da tastiera.

> Il deploy delle functions nel workflow CI è disattivato di default ed è gated
> dalla variabile di repository `DEPLOY_FUNCTIONS` (vedi
> [.github/workflows/firebase-hosting.yml](../.github/workflows/firebase-hosting.yml)).
> Richiede la Cloud Build API attiva sul progetto.

---

## Pagamenti — checkout online

### `createPaymentCheckout` — callable

Apre un checkout SumUp per un conto. Chiamabile anche da un cliente anonimo:
l'id dell'ordine fa da *capability token*, come per la pagina pubblica
dell'ordine.

### `getPaymentStatus` — callable

Chiede a SumUp com'è finito un checkout e riporta l'esito sull'ordine. Lo
stato **si rilegge sempre dall'API**: quello che dice il browser non basta.

### `paymentWebhook` — HTTP

Riceve gli esiti (checkout online e `return_url` del lettore) e smista per
forma del payload. L'esito viene **sempre ri-verificato via API SumUp**,
quindi un payload malformato è innocuo — ed è per questo che non serve una
firma. Risponde sempre `200`: un errore farebbe ritentare SumUp per un'ora.

### `autoAdvancePaid` — trigger su `orders/{orderId}`

Cintura lato server: un ordine ritirato **e** pagato — in qualunque ordine
succedano le due cose — si chiude da solo.

## Pagamenti — lettore SumUp Solo

`pairSumUpReader` e `unpairSumUpReader` accoppiano (e staccano) il lettore al
locale; `readerCheckout` gli manda l'importo da riscuotere e
`readerTerminate` annulla la richiesta in corso.

## Pagamenti di gruppo

`createGroupCheckout`, `getGroupPaymentStatus` e `groupReaderCheckout`: gli
stessi tre gesti quando a pagare è un gruppo di conti insieme.

## Notifiche push

- `notifyOrderUpdate` — trigger su `orders/{orderId}`: avvisa il **cliente**
  quando il drink è pronto o l'ordine è annullato.
- `notifyNewOrder` — trigger su `orders/{orderId}`: avvisa il **personale** di
  un ordine appena arrivato.
- `notifyStaffCall` — trigger su `staff_calls/{callId}`: la chiamata al tavolo.

## Amministrazione

- `staffAdmin` — callable (solo bartender): crea, elenca, modifica ed elimina
  gli account dello staff col loro ruolo (custom claim).
- `risolviNumeroDuplicato` — trigger su `orders/{orderId}`: se due conti
  nascono con lo stesso numero, ne riassegna uno.

---

## Requisiti → Issue GitHub

I requisiti sono in [requirements/requirements.yaml](../requirements/requirements.yaml).
Impostando `generate_issue: true` su un requisito e facendo push su `main`, il workflow
[generate-issues.yml](../.github/workflows/generate-issues.yml) crea automaticamente
un'issue GitHub (idempotente: non duplica issue con lo stesso titolo).

```bash
# Anteprima senza creare nulla
node scripts/generate-issues.mjs --dry-run

# Creazione reale (richiede token)
GITHUB_TOKEN=<token> npm run requirements:issues
```

Si può anche lanciare manualmente da **GitHub → Actions → "Generate Issues from
Requirements" → Run workflow** (con opzione dry-run).

## Test

```bash
npm test              # unit + BDD (vitest run)
npm run test:watch    # modalità watch
npm run test:coverage # con coverage su functions/lib
```

- **Unit** ([tests/unit/](../tests/unit/)): la logica pura (decisioni, parsing, payload).
- **BDD** ([tests/bdd/](../tests/bdd/)): scenari Given/When/Then per ciascuna function,
  con Firestore in-memory ([tests/helpers/fakeFirestore.js](../tests/helpers/fakeFirestore.js))
  e `fetch` SumUp mockato. Ogni test è tracciato da un ID `TC-*` referenziato nei requisiti.

I test girano in CI tramite [test.yml](../.github/workflows/test.yml): a ogni push tranne sui rami `release/**`, e sulle pull request verso `develop` e `main`.
