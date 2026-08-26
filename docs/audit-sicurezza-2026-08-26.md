# Audit di sicurezza — Tana Drink

**Data:** 2026-08-26 · **Ambito:** backend (Cloud Functions), frontend (PWA React),
regole Firebase, dati sensibili, segreti e infrastruttura (CI/CD, script, storia git).
**Modalità:** sola lettura, nessuna modifica al codice. Repo: `redirect11/tana-drink`.

> Nota di lettura. Molti finding convergono: gli stessi due-tre buchi (repo pubblico,
> App Check non imposto, `counters`/`orders` aperti) emergono da più angolazioni. Qui
> sono **deduplicati** e ordinati per gravità reale, non per area.

---

## Quadro d'insieme

L'impianto è **ben ragionato**: i ruoli vivono nei custom claims (nessuno può
auto-promuoversi), i webhook di pagamento non si fidano mai del payload e rileggono
l'esito da SumUp, gli importi si ricalcolano lato server, i segreti veri stanno nelle
Functions e non nel bundle, la superficie XSS è di fatto nulla. I problemi seri sono
**pochi ma concreti** e si concentrano in tre punti: **un problema di privacy sul repo
pubblico**, **percorsi Firestore aperti agli anonimi**, e **App Check inizializzato ma
mai imposto**, che è proprio la cintura che dovrebbe proteggere quei percorsi.

| Gravità | Finding |
|---|---|
| 🔴 Critica | 1. Vocali/foto di persone reali in un repo **pubblico** (storia + rami vivi) |
| 🔴 Critica | 2. `counters/{dateKey}` scrivibile da chiunque, anche non autenticato |
| 🟠 Alta | 3. App Check inizializzato ma **mai imposto** (Functions/Firestore/Storage) |
| 🟠 Alta | 4. `orders` leggibili e creabili da chiunque — dati personali esposti |
| 🟠 Alta | 5. Tre callable SumUp POS Pro senza auth né ruolo (latente: SumUp spento) |
| 🟠 Alta | 6. `sumupWebhook` si fida del payload senza firma né ri-verifica (latente) |
| 🟡 Media | 7. Script di manutenzione con default sulla **produzione** |
| 🟡 Media | 8. Cache offline e localStorage in chiaro sul tablet condiviso |
| 🟡 Media | 9. Assenza di CSP e header di sicurezza sull'hosting |
| 🟡 Media | 10. `settings/printer` e `sumup_reader_id` a lettura pubblica |
| 🟡 Media | 11. `staff_shifts`: uno staff può modificare la timbratura altrui |
| 🟡 Media | 12. CI: trigger `@claude` da terzi + action non pinnate a SHA + SA sovraprivilegiato |
| 🟡 Media | 13. Corpi di errore SumUp rifluiscono al client |
| ⚪ Bassa | 14. `service_stats` senza validazione valore · `document.write` stampante finta · mailto · `npm audit` |

---

## 🔴 Critica

### 1. Vocali e foto dal banco in un repository pubblico

Il repo è **PUBLIC** (verificato). In `registrazioni/` ci sono **63 file** — note vocali
WhatsApp e foto (26/07→10/08/2026) che, per stessa ammissione del `.gitignore` e di
`scripts/trascrivi-registrazioni.py`, contengono **nomi di clienti e voci di chi lavora
al locale**. Sono dati personali (voce e immagine identificabili) pubblicati senza base
giuridica — un problema GDPR prima ancora che di sicurezza.

Il commit di rimozione (`c002eb1`, «fuori dal versionamento i vocali dal banco») li ha
tolti **solo dal tip**. Restano scaricabili da:
- i tip dei rami remoti **vivi** `origin/release/1.3.0` e `origin/release/1.4.0` (63 file ciascuno — verificato);
- la **storia raggiungibile** di `main` e `develop` (i commit che li aggiungono, es. `c89e4f5`, `fefa53a`, `64573ad`, sono antenati del tip — verificato);
- i rami locali `agents/configurazione-agenti` e `feature/riordino-css`.

**Chi/come/danno:** chiunque — uno scraper, un ex dipendente, un concorrente — clona il
repo e ottiene audio con voci e nomi, riutilizzabili anche per impersonazione vocale.

**Cosa fare, in quest'ordine:**
1. Cancellare sul server i rami `release/1.3.0`, `release/1.4.0` (e i locali citati).
2. Riscrivere la storia di tutti i rami: `git filter-repo --path registrazioni/ --invert-paths` (o BFG), poi force-push.
3. Aprire un ticket al **GitHub Support** per purgare gli oggetti dalle cache/reflog lato server (i commit restano raggiungibili per SHA anche dopo il force-push) e verificare che non esistano fork.
4. Decidere se il repo debba restare pubblico: è il gestionale di cassa di un esercizio commerciale.

Non c'è un segreto da ruotare — è privacy, non credenziali — ma è il finding più grave dell'audit.

### 2. `counters/{dateKey}` scrivibile da chiunque

`firestore.rules:101-105` → `allow read, write: if true;`. Nessun login, nessun ruolo,
nessun App Check imposto. Chiunque abbia estratto `apiKey`+`projectId` dal bundle (pubblici
per design) può fare `setDoc(counters/2026-08-26, {last: 999999})` o azzerare il contatore.

**Danno:** la sera i nuovi conti prendono numeri assurdi o **duplicati** di conti già in
mano ai clienti — la comanda stampata «#15» e quella a schermo non coincidono più.
`risolviNumeroDuplicato` gestisce le collisioni accidentali fra terminali, non un
avvelenamento deliberato. È esattamente la classe di incidente che `progressivi.js`
documenta come già vissuta.

**Fix:** `allow write: if isStaffMember();`. Se serve l'incremento lato cliente anonimo,
vincolare a `request.resource.data.last == resource.data.last + 1` con App Check imposto,
o spostare l'assegnazione del progressivo interamente server-side.

> **✅ CHIUSO il 26/08/2026** (BUG-091). E la cura secca proposta qui sopra era
> **sbagliata**: il cliente che ordina dal menù non è autenticato e passa dallo
> **stesso** contatore, quindi `write: if isStaffMember()` gli spegnerebbe
> l'incremento — il conto uscirebbe lo stesso, il contatore no, e il cliente
> dopo prenderebbe **lo stesso numero**. Esattamente il doppione da evitare
> (dimostrato da un test: con quella regola l'uso legittimo diventa rosso).
> Fatto invece così: non si chiede *chi* scrive ma *cosa* scrive — a chi non è
> del personale si concede il solo gesto di `progressivi.js`, un `increment(1)`
> sul solo campo `last`, e un contatore nuovo può nascere solo a `1`. Le regole
> vedono il valore **dopo** il transform (verificato sull'emulatore), quindi il
> vincolo `+ 1` si scrive tale e quale. Il personale resta libero
> (`_active_cash`, `fatture-AAAA`, correzioni); il local-first è intatto.
> Resta il gocciolamento — N chiamate spingono avanti di N: numeri alti, mai
> duplicati. Lo chiude App Check (finding 3).
> Prove: `tests/regole/counters.test.js`, 14 casi (abuso + uso legittimo).
> **Da fare a mano:** pubblicare le regole (`firebase deploy --only firestore:rules`).

---

## 🟠 Alta

### 3. App Check inizializzato ma mai imposto

Il client registra App Check con reCAPTCHA v3 (`src/lib/firebaseClient.js:50-65`), ma:
- nessuna Cloud Function dichiara `enforceAppCheck: true` (`OPTS` è solo la region);
- l'enforcement non risulta acceso per Firestore/Storage;
- se `VITE_RECAPTCHA_SITE_KEY` manca, App Check si **spegne in silenzio**.

Risultato: il token viene prodotto e allegato, ma il backend non lo pretende — le
callable restano invocabili da qualunque client, anche fuori dall'app. È il moltiplicatore
che rende sfruttabili i finding 2, 4, 5, 6 e coerente con il sospetto già annotato per il
bug «permessi admin in produzione».

**Fix:** accendere l'enforcement in console per Firestore/Storage/Functions; aggiungere
`enforceAppCheck: true` alle callable riservate all'app (staffAdmin, sync/sale SumUp,
pagamenti staff), lasciando fuori con grazia quelle pensate per il cliente anonimo con
capability-token; far fallire la build in produzione se manca `VITE_RECAPTCHA_SITE_KEY`.

### 4. `orders` leggibili e creabili da chiunque

`firestore.rules:48-98` → `allow read: if true;` e `create` senza requisito di auth. È la
scelta di design «id ordine come capability token», ma gli ordini contengono `customer_name`,
`customer_uid`, `note`, `push_token` FCM, `placed_by` (email/ruolo staff).

**Danno:** con l'API REST di Firestore e l'apiKey pubblica, uno script itera/indovina gli
id ordine e raccoglie nomi clienti, consumazioni, importi e i token push di staff e
clienti; oppure crea migliaia di ordini fittizi che intasano la coda del banco.

**Fix:** mantenere il modello capability ma (a) accendere App Check per limitare la
creazione ai client legittimi; (b) non esporre `push_token`/`customer_uid`/`placed_by` in
documenti a lettura pubblica (sottodocumento a lettura ristretta, o proiezione via
callable); (c) valutare un rate-limit sulla creazione.

### 5. Callable SumUp POS Pro senza autenticazione né ruolo *(latente — SumUp spento)*

`functions/index.js:101,106,109` — `syncSumUpProducts`, `createSumUpSale`,
`updateSumUpSaleStatus` non leggono `request.auth`. Un `onCall` v2 non richiede auth di
default. Nessun `requireRole`, nessun App Check. A integrazione attiva:
- `syncSumUpProducts` riscrive l'intera collezione `drinks` (il menù) con la risposta SumUp;
- `createSumUpSale` prende `orderId`/`items`/`unit_price`/`qty` **dal client** e scrive `sumup_sale_id` su un ordine arbitrario con prezzi a piacere;
- `updateSumUpSaleStatus` cambia lo stato di qualunque vendita.

Innocuo finché SumUp è spento (`functions/.env` vuoto), ma da chiudere **prima** di
accenderlo. **Fix:** `requireRole(request.auth, BANCO)` come per i pagamenti, più
validazione di `orderId`/`items` e ricalcolo prezzi server-side.

### 6. `sumupWebhook` si fida del payload *(latente — SumUp spento)*

`functions/index.js:118` → `sumup-service.js:89`. Prende `sale_id` **e `status`** dal corpo
e li scrive sull'ordine, senza firma HMAC né ri-verifica via API (a differenza del webhook
pagamenti, che è fatto bene). Chi conosce/indovina un `sumup_sale_id` POSTa
`{sale_id, status:'COMPLETED'}` e fa avanzare ordini altrui. Manca anche la guardia
`isConfigured()`. **Fix:** verificare la firma del webhook oppure — come già per i
pagamenti — rileggere lo stato dall'API SumUp e non fidarsi mai del payload.

---

## 🟡 Media

### 7. Script di manutenzione con default sulla produzione

Contro la regola «gli script scrivono su `tana-drink-test`, la produzione si nomina a mano»:

| File | Default | Rischio |
|---|---|---|
| `scripts/set-role.js:23` | `tana-drink` | **scrive subito**, nessun `--apply`: promuove un utente ad admin in **produzione** |
| `scripts/recaptcha-domini.js:19` | `tana-drink` | `--aggiungi`/`--togli` scrivono subito sulla chiave reCAPTCHA di produzione (un `--togli` errato chiude fuori il locale se App Check è imposto) |
| `scripts/import-carte.js:24` | `tana-drink` | sostituisce drinks/categories (dry-run senza `--apply`) |
| `scripts/generate-inventory.js:21`, `import-costi-inventario.js:32`, `link-inventory.js:21` | `tana-drink` | dry-run senza `--apply` |

**Fix:** portare i default a `tana-drink-test` (come già fanno `backup-db.js`, `appcheck.js`,
`pulisci-ordini-aperti.js`) o rendere `--project` obbligatorio in scrittura; per `set-role.js`
e `recaptcha-domini.js` aggiungere il pattern anteprima/`--apply`.

### 8. Dati in chiaro sul tablet condiviso

Il tablet del banco è condiviso e sempre acceso. Restano leggibili da chi apre i DevTools o
il file system, **anche dopo il logout**:
- la **cache offline di Firestore** (`persistentLocalCache`, IndexedDB): ordini, incassi,
  `staff_rates` (paghe), `vouchers` (nomi VIP), `customers` — il `signOut` non la svuota;
- localStorage: `tana:staff` (elenco staff con email), `tana:ruolo`, IP stampante, carrello,
  id ordini.

Nessuna password né dato di pagamento carta in chiaro (bene). **Fix:** al logout
`terminate()` + `clearIndexedDbPersistence()` di Firestore e rimozione delle chiavi
sensibili; valutare di non persistere paghe/vouchers; documentare il lock di sistema sui tablet.

### 9. Nessuna CSP né header di sicurezza

`index.html` senza meta CSP e `firebase.json` senza blocco `headers`: mancano CSP,
`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`. L'app carica script
esterni (SumUp SDK, Google Fonts) e un `/epos-2.27.0.js` self-hosted senza SRI. Non è una
falla sfruttabile oggi, ma è la seconda linea di difesa mancante. **Fix:** blocco `headers`
in `firebase.json` con CSP che consenta `self` + `gateway.sumup.com` +
`firestore.googleapis.com`/`*.firebaseio.com` + `fonts.gstatic.com`, più `nosniff` e
`Referrer-Policy`; SRI sull'ePOS SDK.

### 10. `settings/printer` e `sumup_reader_id` a lettura pubblica

`firestore.rules:125-129`: tutti i `settings/*` hanno `read: if true`. Espongono l'IP/host
della stampante di cassa e il `sumup_reader_id` — ricognizione utile a un attaccante sulla
stessa LAN. **Fix:** separare i documenti che il cliente deve leggere (modalità menu, coperto)
da quelli di infrastruttura, con `read: if isStaffMember()` su questi ultimi.

### 11. `staff_shifts`: timbratura altrui modificabile

`firestore.rules:270-274` → `allow create, update: if isStaffMember();` senza vincolare la
voce alla persona che scrive (a differenza di `presenze`/`staff_tokens`). Uno staff può
alterare entrata/uscita di un collega — dato che alimenta registro ore e paghe. **Fix:**
vincolare a `request.resource.data.person_id == request.auth.uid`, lasciando al bartender la
correzione altrui.

### 12. Catena CI/CD

- `.github/workflows/claude.yml:42-46`: il gate controlla che il testo contenga `@claude`,
  **non chi lo scrive**. Su repo pubblico chiunque apre un'issue con `@claude`; quando un
  maintainer innesca Claude su testo di terzi, quel testo entra in un job con `contents:write`
  → rischio prompt injection. Aggiungere un vincolo su `author_association`.
- Action di terze parti a **tag mobili**: `FirebaseExtended/action-hosting-deploy@v0` riceve
  `FIREBASE_SERVICE_ACCOUNT`; `anthropics/claude-code-action@v1`. Pinnare a SHA almeno quelle
  che toccano il service account.
- `setup-firebase-env.sh` genera una **chiave JSON longeva** di un SA sovraprivilegiato
  (firebase.admin, run.admin, artifactregistry.admin…) messa nei GitHub Secrets. Migrare a
  Workload Identity Federation; in subordine ridurre i ruoli e ruotare la chiave.

### 13. Errori SumUp che rifluiscono al client

`functions/index.js:87,417`: il corpo grezzo della risposta SumUp finisce nel `message`
della `HttpsError` trasmessa al client (merchant id, struttura API). **Fix:** loggare il
dettaglio server-side e restituire un messaggio generico.

---

## ⚪ Bassa

- **`service_stats`** (`firestore.rules:110-117`): limita bene le chiavi scrivibili ma non
  valida il valore — uno staff può scrivere un ETA assurdo mostrato al cliente. Vincolo di tipo/range.
- **`stampanteFinta.js:100-129`**: `document.write` con escape parziale (non `"`), ma è codice
  solo-emulatore. Usare `textContent`/escape completo.
- **mailto** (`InvoicesTab.jsx`, `PaymentScreen.jsx`): il destinatario email non è validato;
  rischio molto limitato. Validare il formato prima di comporre il link.
- **Sessione Firebase Auth** persistente su device condiviso: valutare
  `browserSessionPersistence` o auto-logout a inattività per i ruoli gestionali.

### Dipendenze (`npm audit`)

- **Root:** 23 vulnerabilità (2 critiche, 7 alte). Le critiche/alte sono **tutte in
  toolchain di sviluppo** (`vitest`, `@vitest/coverage-v8`, `vite`, `postcss`, `undici`,
  `js-yaml`, `nanoid`, `form-data`) — non finiscono nel bundle di produzione, ma `vite`/`vitest`
  hanno CVE sfruttabili in locale (path traversal, lettura file col dev server attivo).
  Aggiornabili con `npm audit fix` senza breaking, salva la catena `vitest` che richiede
  `--force`.
- **Functions:** 11 vulnerabilità (1 alta, `form-data`), tutte transitive sotto
  `firebase-admin`/`@google-cloud/*`. Nessuna dipendenza sospetta (no `git+`/tarball, nessun
  `postinstall`). Aggiornare `firebase-admin` alla minor sicura quando comodo.

---

## Cose fatte bene (da preservare)

- **Ruoli nei custom claims**, non in documenti auto-scrivibili: nessuno può auto-promuoversi. È la difesa più importante ed è corretta.
- **`staffAdmin`** con controlli server-side rigorosi: protezione dell'ultimo admin, divieto di auto-modifica del ruolo.
- **Webhook pagamenti a prova di forgery**: l'esito si rilegge sempre da SumUp; `cors:false`; risposta sempre 200.
- **Importi ricalcolati lato server**, mai presi dal client; nessun importo negativo o superiore al dovuto.
- **Segreti al posto giusto**: chiave API SumUp come `defineSecret`; `functions/.env` vuoto in tutta la storia; `.env` reale mai committato; nessuna chiave privata mai comparsa nella storia.
- **Superficie XSS nulla**: nessun `dangerouslySetInnerHTML`/`eval`/`innerHTML` nel percorso di produzione; React escapa i dati.
- **Widget carta SumUp**: i dati carta non transitano mai dall'app (PCI a carico SumUp).
- **Ledger append-only**: `payments` e `cash_sessions` senza `delete`.
- **Segmentazione dati persone**: `staff_rates` e `presenze` riservati; storage chiuso per default.
- **CI ben disegnata sul resto**: niente `pull_request_target`, `permissions: contents:read`, deploy solo da tag con approvazione manuale e «guardia ambiente».
- **Excel con ore dipendenti e dati aziendali** (`RAPP ORE.xlsx`, `INV.xlsx`, `backup/`…): tutti ignorati e mai comparsi nella storia git.

---

## Priorità operativa

1. **Finding 1** — repo pubblico con dati personali: cancellare rami, riscrivere la storia, GitHub Support, decidere pubblico/privato. *(Prima di tutto: è privacy di persone reali.)*
2. **Finding 2 + 3** — chiudere `counters` e imporre App Check: insieme eliminano la classe di abusi da anonimo.
3. **Finding 4** — restringere lettura/creazione `orders`.
4. **Finding 5 + 6** — chiudere le callable e il webhook SumUp **prima** di accendere l'integrazione.
5. **Finding 7** — default degli script sul test.
6. Il resto (8-14) come irrigidimento progressivo. Aggiungere una suite `@firebase/rules-unit-testing`: oggi le regole — l'unica barriera reale — non hanno alcun test.
