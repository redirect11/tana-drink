# Firebase Functions — Integrazione SumUp POS Pro

Documentazione delle Cloud Functions di Tana Drink. Tutte le functions implementano
l'integrazione con **SumUp POS Pro** (sistema Goodtill) come proxy server-side: le
credenziali API non vengono mai esposte al client.

- **Regione**: `europe-west1`
- **Runtime**: Node.js 20
- **Codice**: [functions/index.js](../functions/index.js) (wiring) →
  [functions/lib/sumup-service.js](../functions/lib/sumup-service.js) (servizio) +
  [functions/lib/sumup-core.js](../functions/lib/sumup-core.js) (logica pura)
- **Requisiti**: [requirements/requirements.yaml](../requirements/requirements.yaml)
- **Test**: [tests/unit/](../tests/unit/) (unit) + [tests/bdd/](../tests/bdd/) (BDD)

## Architettura

`index.js` contiene solo il "wiring" Firebase (registrazione handler, lettura dei
parametri, `fetch` reale, accesso Firestore). La logica è separata in due moduli
testabili senza emulatori:

| Modulo | Responsabilità | Dipendenze |
| --- | --- | --- |
| `lib/sumup-core.js` | Trasformazioni pure (mapping, parsing, payload) | nessuna |
| `lib/sumup-service.js` | Orchestrazione (Firestore + chiamate SumUp) | iniettate via `deps` |

Le dipendenze (`db`, `sumupFetch`, `isConfigured`, `serverTimestamp`) sono iniettate
in `index.js` e sostituite da mock nei test.

## Configurazione

Le functions sono **no-op** finché non sono configurate (vedi `REQ-SUMUP-CONFIG-001`).
Imposta i secret prima del deploy:

```bash
firebase functions:secrets:set SUMUP_VENDOR_ID
firebase functions:secrets:set SUMUP_OUTLET_ID
```

| Variabile | Tipo | Default | Descrizione |
| --- | --- | --- | --- |
| `SUMUP_VENDOR_ID` | param/secret | `''` | Vendor-Id SumUp (richiesto via `pos.support.uk.ie@sumup.com`) |
| `SUMUP_OUTLET_ID` | param/secret | `''` | Outlet-Id del punto vendita |
| `SUMUP_API_BASE` | env | `https://api.thegoodtill.com/api` | URL base API (da confermare con SumUp) |

> Il deploy delle functions nel workflow CI è disattivato di default ed è gated dalla
> variabile di repository `DEPLOY_FUNCTIONS` (vedi
> [.github/workflows/firebase-hosting.yml](../.github/workflows/firebase-hosting.yml)).
> Richiede la Cloud Build API attiva sul progetto.

---

## Funzioni

### `syncSumUpProducts` — callable

Sincronizza il catalogo prodotti SumUp nella collezione Firestore `drinks`.

- **Tipo**: `onCall` (HTTPS callable)
- **Input**: nessuno
- **Output**: `{ synced: number, total: number }` oppure `{ skipped: true, message }`
- **Side effects**: legge `GET /products` da SumUp; crea/aggiorna documenti in `drinks`
- **Comportamento**:
  - Se non configurato → `{ skipped: true }`, nessuna chiamata di rete.
  - Normalizza la risposta (array diretto o `{ products }` / `{ items }`).
  - Per ogni prodotto con id: aggiorna quello esistente (per `sumup_product_id`) o
    ne crea uno nuovo con `created_at`. I prodotti senza id vengono saltati.
- **Requisiti**: `REQ-SUMUP-SYNC-001`, `REQ-SUMUP-SYNC-002`, `REQ-SUMUP-CONFIG-001`

### `createSumUpSale` — callable

Invia un ordine Tana Drink a SumUp POS Pro come *External Sale*.

- **Tipo**: `onCall`
- **Input**: `{ orderId, tableLabel, note, items: [{ sumup_product_id, name, qty, unit_price }] }`
- **Output**: `{ saleId: string | null }` oppure `{ skipped: true }`
- **Side effects**: `POST /external_sales`; se la vendita ha un id, scrive
  `sumup_sale_id` sull'ordine Firestore (`orders/{orderId}`)
- **Note**: `customer_name` = `Tavolo {tableLabel}` o `Cliente`; `total_price`
  arrotondato a 2 decimali.
- **Requisiti**: `REQ-SUMUP-SALE-001`, `REQ-SUMUP-CONFIG-001`

### `updateSumUpSaleStatus` — callable

Aggiorna lo stato di una vendita su SumUp POS Pro.

- **Tipo**: `onCall`
- **Input**: `{ saleId, status }`
- **Output**: `{ updated: true }` oppure `{ skipped: true, reason? }`
- **Side effects**: `PUT /external_sales/{saleId}/status`
- **Note**: senza `saleId` non chiama SumUp e ritorna `{ skipped: true }`.
- **Requisiti**: `REQ-SUMUP-STATUS-001`, `REQ-SUMUP-CONFIG-001`

### `sumupWebhook` — HTTP

Riceve gli aggiornamenti di stato dal Back Office SumUp e aggiorna l'ordine Firestore
corrispondente (riflesso in tempo reale sul cliente).

- **Tipo**: `onRequest` (HTTP), `cors: false`
- **URL**: `https://europe-west1-<project-id>.cloudfunctions.net/sumupWebhook`
- **Input**: corpo JSON `{ sale_id | id, status }`
- **Output**: `200 OK` / `400 Missing sale_id` / `405 Method Not Allowed`
- **Mappatura stati**:

  | Stato SumUp | Stato Tana Drink |
  | --- | --- |
  | `ACCEPTED` | `in_preparazione` |
  | `COMPLETED` | `ritirato` |
  | `CANCELLED` | `ritirato` |
  | altri (es. `CREATED`) | ignorato (200 OK) |

- **Side effects**: aggiorna `status` dell'ordine con `sumup_sale_id` corrispondente.
- **Requisiti**: `REQ-SUMUP-WEBHOOK-001`

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

- **Unit** ([tests/unit/sumup-core.test.js](../tests/unit/sumup-core.test.js)):
  testano la logica pura (mapping, payload, parsing).
- **BDD** ([tests/bdd/](../tests/bdd/)): scenari Given/When/Then per ciascuna function,
  con Firestore in-memory ([tests/helpers/fakeFirestore.js](../tests/helpers/fakeFirestore.js))
  e `fetch` SumUp mockato. Ogni test è tracciato da un ID `TC-*` referenziato nei requisiti.

I test girano in CI tramite [test.yml](../.github/workflows/test.yml) su push e PR.
