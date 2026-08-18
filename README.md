# 🍸 Tana Drink — La Tana del Coniglio

Web app (React + Vite) per la **prenotazione dei drink** del cocktail bar
*La Tana del Coniglio*. I clienti scansionano un **QR code**, sfogliano il
menù, ordinano e seguono lo stato del proprio ordine **in tempo reale** —
come un “Deliveroo dei drink”, con **numero progressivo tipo salumeria**.

Backend: **Firebase** (Cloud Firestore + realtime via `onSnapshot`). Deploy: **Firebase Hosting**.

## Funzionalità

- **Lato cliente**
  - Menù drink per categoria + carrello.
  - Invio ordine con assegnazione di un **numero progressivo giornaliero**.
  - **Tracciamento dello stato in realtime**: `Ricevuto → In preparazione →
    Pronto → Ritirato`.
  - **Notifiche** (in-app e di sistema) quando il drink è **pronto**.
  - “I miei ordini”: ritrova gli ordini fatti da questo dispositivo.
  - PWA installabile (manifest + service worker).
- **Lato bartender (backoffice, protetto da PIN)**
  - **Coda ordini in realtime**, con avanzamento di stato a un tap.
  - Notifica all’arrivo di un **nuovo ordine**.
  - **Gestione menù/ricette**: aggiungi, modifica, rimuovi drink e cambia la
    disponibilità.

## Avvio in locale

> **Per provare l'app come al bar** — con gli emulatori Firebase, i dati
> finti e nessun progetto vero coinvolto — la ricetta completa (e i due
> inciampi noti: **Java 21** e la **porta 8080 occupata**) sta in
> [docs/ambiente-locale.md](docs/ambiente-locale.md). In breve:
>
> ```powershell
> npx firebase emulators:start --project demo-tana-drink `
>   --only auth,firestore,storage --config firebase.collaudo.json
> node scripts/seed.js && node scripts/mock-orders.js
> npm run dev -- --port 5175
> ```

### Contro un progetto Firebase vero

1. Installa le dipendenze:
   ```bash
   npm install
   ```
2. Crea un progetto su [Firebase](https://console.firebase.google.com),
   aggiungi un'app **Web** e abilita **Cloud Firestore**. Pubblica le regole
   di sicurezza del file [`firestore.rules`](firestore.rules).
3. Copia `.env.example` in `.env` e inserisci i valori del tuo progetto:
   ```bash
   cp .env.example .env
   ```
   - `VITE_FIREBASE_*` → da *Firebase Console → Impostazioni progetto → Le tue
     app → Web app* (apiKey, authDomain, projectId, ecc.).
   - `VITE_BARTENDER_PIN` → il PIN per accedere al backoffice bartender.
4. (Facoltativo) Popola il menù con alcuni drink di esempio:
   ```bash
   npm run seed
   ```
5. Avvia:
   ```bash
   npm run dev
   ```

## Sviluppo/testing con Docker

In alternativa all'avvio locale puoi usare un ambiente **Docker** che include
già **Node.js** e la **Firebase CLI** (con gli **emulatori**), così non servono
né Firebase installato in locale né un progetto Firebase reale.

```bash
docker compose up --build
```

Si avviano due servizi:

| Servizio    | URL / Porta                     | Descrizione                          |
| ----------- | ------------------------------- | ------------------------------------ |
| `web`       | http://localhost:5173           | Vite dev server (hot reload)         |
| `emulators` | http://localhost:4000           | Firebase **Emulator UI**             |
|             | `localhost:8080`                | Emulatore **Firestore**              |

Il client si collega **automaticamente** all'emulatore Firestore (variabili
`VITE_USE_FIREBASE_EMULATOR` / `VITE_FIRESTORE_*` impostate in
[`docker-compose.yml`](docker-compose.yml)). Si usa un progetto `demo-tana-drink`
che gira **completamente offline**, senza credenziali Firebase reali.

Popola l'emulatore con i drink di esempio (l'host dell'emulatore, visto dal
container `web`, è il nome del servizio `emulators`):

```bash
docker compose exec -e VITE_FIRESTORE_EMULATOR_HOST=emulators web npm run seed
```

> I dati dell'emulatore sono **effimeri**: si azzerano a ogni riavvio.
> Per eseguire gli emulatori senza Docker (richiede una JRE installata):
> `npm run emulators`.

## Percorsi (routing)

L’app usa `BrowserRouter` (URL puliti, serviti da Firebase Hosting tramite
rewrite SPA su `index.html`):

- `/` — menù cliente (accetta `?tavolo=12` dal QR code).
- `/ordine/:id` — stato di un ordine (realtime).
- `/ordini` — gli ordini di questo dispositivo.
- `/bar` — backoffice bartender (PIN).

### QR code

Genera un QR che punti all’URL pubblico dell’app, eventualmente con il tavolo:

```
https://<il-tuo-progetto>.web.app/?tavolo=12
```

## Deploy su Firebase Hosting

Il workflow
[`.github/workflows/firebase-hosting.yml`](.github/workflows/firebase-hosting.yml)
builda e pubblica su Firebase Hosting a ogni push su `main`.

### Configurazione una tantum

1. Imposta il progetto in [`.firebaserc`](.firebaserc): sostituisci
   `il-tuo-progetto` con l'**ID del tuo progetto Firebase** (lo stesso che usi
   per Firestore).
2. In **Settings → Secrets and variables → Actions**, aggiungi i secret:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   - `VITE_BARTENDER_PIN`
   - `FIREBASE_SERVICE_ACCOUNT` → il JSON di un **service account** con permesso
     di deploy su Hosting. Lo ottieni con
     `firebase init hosting:github`, oppure dalla *Google Cloud Console →
     IAM e amministrazione → Account di servizio* (ruolo *Firebase Hosting
     Admin*). Incolla l'intero contenuto del file JSON come valore del secret.
3. Esegui il push su `main`: il sito sarà su
   `https://<il-tuo-progetto>.web.app/`.

### Deploy manuale (facoltativo)

```bash
npm install -g firebase-tools
firebase login
npm run build
firebase deploy --only hosting
```

> Il `base` path di Vite è `/` (radice). Per un eventuale deploy su GitHub
> Pages di progetto puoi sovrascriverlo in build con `BASE_PATH=/<nome-repo>/`.

## Note sulle notifiche

- Le notifiche di sistema usano la **Web Notifications API**. Su iOS funzionano
  solo se l’app è **installata come PWA**.
- Gli aggiornamenti **in-app** sono sempre realtime grazie a Firestore
  (`onSnapshot`), anche senza permesso notifiche.

## Sicurezza

Per semplicità (locale senza login) le regole Firestore sono permissive e la
`apiKey` è pubblica per design (l'accesso è protetto dalle Firestore Rules). In
produzione si consiglia di restringere `update`/`delete` degli ordini e la
scrittura del menù a un ruolo bartender autenticato (Firebase Auth). Vedi i
commenti in [`firestore.rules`](firestore.rules).

## Scripts

| Comando           | Descrizione                          |
| ----------------- | ------------------------------------ |
| `npm run dev`     | Avvio in sviluppo                    |
| `npm run build`   | Build di produzione in `dist/`       |
| `npm run preview` | Anteprima della build                |
| `npm run lint`    | Lint del codice                      |
| `npm run seed`    | Popola Firestore con drink di esempio |
