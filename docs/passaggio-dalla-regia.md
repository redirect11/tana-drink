# Il passaggio fra la regia e l'app, e i dati del titolare (REQ-FLOTTA-030)

Richiesta della regia, 02/11/2026. La parte della regia è pronta:
[drink-regia PR #49](https://github.com/redirect11/drink-regia/pull/49).

## La decisione dell'utente

> «Dobbiamo prevedere un single sign-on che se siamo loggati su backoffice
> o siamo loggati sulla nostra istanza tana, risulta loggato sia backoffice
> sia istanza per quell'utente» — «mi serve qualcosa che sia sicuro e
> robusto» — «in generale però questo deve valere per tutte le istanze».

Ogni locale è un progetto Firebase con i suoi account, e due siti su domini
diversi non condividono la sessione. Quindi il titolare passa con un clic:
«Apri la tua app» dalla sua area nella regia, «Area clienti» dall'app. Più
avanti l'identità diventerà centrale (Identity Platform nella regia, il
banco che entra con l'account della regia), e si appoggerà a questo stesso
scambio.

## 1. Ricevere il codice dalla regia

La regia apre l'app a `<url del locale>/#accesso-regia=<codice>`. All'avvio,
prima di tutto il resto:

1. leggere `accesso-regia` dal frammento (dopo il `#`) e **toglierlo subito**
   dall'indirizzo (`history.replaceState`), così non resta in cronologia;
2. `POST https://europe-west1-<VITE_REGIA_PROGETTO>.cloudfunctions.net/scambiaPassaggio`
   con `Content-Type: application/json` e corpo `{ "codice": "…" }`. Solo i
   progetti in `PROGETTI_REGIA` (`drink-regia`, `drink-regia-test`);
3. con `200 { token }`: `signInWithCustomToken(auth, token)`. L'utente è
   quello del titolare nel locale, con i suoi claim (admin): l'app va dove
   va un admin appena entrato;
4. con un errore (`400` codice non valido, `403` scaduto, già usato o da un
   altro sito, `503`): si dice in una riga e si mostra il login normale.

Il codice vale 60 secondi e una volta sola: niente nuovi tentativi
automatici. Funziona anche con la schermata «Installazione non attivata»:
lì il codice si scambia lo stesso (l'account esiste comunque).

## 2. «Area clienti»: dall'app alla regia

Solo per il titolare: chi ha ruolo `admin` **e** l'email del titolare. Il
tasto chiede alla regia, e la regia controlla l'email. Per non mostrare un
tasto che fallisce, basta mostrarlo agli admin.

1. `const token = await auth.currentUser.getIdToken(true)`. La regia vuole un
   token rinnovato da meno di 5 minuti;
2. `POST https://europe-west1-<VITE_REGIA_PROGETTO>.cloudfunctions.net/passaggioVersoRegia`
   con `Authorization: Bearer <token>`;
3. con `200 { url }`: `window.location.href = url`. La regia apre l'area del
   titolare già entrato;
4. con `403` (non è il titolare, o il token è vecchio) o `404`: si dice in
   una riga.

## 3. I dati del titolare nelle impostazioni

A ogni deploy riuscito la regia scrive in `settings/bar`, **solo dove i
campi sono vuoti**, i dati che il titolare ha dato registrandosi:

| Campo | Cosa | C'è già nell'app? |
|---|---|---|
| `venue_name` | il nome del locale | sì |
| `venue_legal_name` | la ragione sociale | sì |
| `venue_address` | via e civico | sì |
| `venue_postal_city` | «00100 Roma (RM)» | sì |
| `venue_city` | la città | sì |
| `venue_phone` | il telefono del locale | **no, da aggiungere** |
| `venue_vat_number` | la partita IVA | **no, da aggiungere** |
| `venue_tax_code` | il codice fiscale | **no, da aggiungere** |
| `venue_legal_address` | la sede legale, in una riga | **no, da aggiungere** |

I quattro nuovi vanno in `CHIAVI_VENUE` (`src/lib/venue.js`), in
Impostazioni → Il locale, e dove servono: lo scontrino (intestazione
fiscale, `ragione_sociale` in `campiStampa.js`) e le fatture di cortesia.

## 4. Entrare al banco con Google

Il banco (`BartenderPage.jsx`) oggi accetta solo email e password; Google
c'è solo nell'area clienti (`customerAuth.js`). L'utente vuole che il
titolare possa entrare anche con Google. Con la stessa email Gmail l'account
resta quello, ruolo compreso (da provare sul test). Sui progetti della regia
il fornitore Google va acceso: lo decide l'utente, una volta per progetto.
