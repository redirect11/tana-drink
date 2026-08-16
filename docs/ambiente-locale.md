# Provare un branch in locale, come se fosse il server

Serve per lavorare su un branch senza pubblicarlo: l'ambiente di test è
uno solo e ci passano a turno `develop` e i branch di tutti. In locale
invece si rompe quello che si vuole, si svuota il database e si ricomincia.

Nessun progetto vero viene toccato: gli emulatori girano su
`demo-tana-drink`, che vive solo sul tuo computer.

## Prima volta: due inciampi da togliere di mezzo

**Java 21.** `firebase-tools` dalla versione 15 non parte con Java più
vecchio, e sulle nostre macchine c'era il 17. L'errore lo dice chiaro
(«no longer supports Java version before 21»):

```powershell
winget install --id EclipseAdoptium.Temurin.21.JRE -e
```

Poi **si riapre il terminale**, se no resta il PATH di prima. Per una sola
sessione si può anche puntare al JRE senza riaprire niente:

```powershell
$env:PATH = "C:\Program Files\Eclipse Adoptium\jre-21.0.12.8-hotspot\bin;" + $env:PATH
```

**La porta 8080 è occupata.** Su questa macchina la tiene un servizio di
sistema (`AgentService`), e l'emulatore Firestore non parte. Per questo
esiste `firebase.collaudo.json`: è `firebase.json` con tre porte spostate —
Firestore **8081**, pannello **4001**, hub **4401** — e si passa con
`--config`. Il resto (Auth 9099, Storage 9199) resta dov'era.

Chi non ha quel servizio può ignorarlo e usare `firebase.json`; chi ce l'ha
ha una ricetta che funziona senza doverla ritrovare ogni volta.

## Due modi

### 1. Sviluppo, per lavorare (ricarica a ogni salvataggio)

Il giro completo, da zero, in due terminali:

```powershell
# TERMINALE 1 — emulatori (Auth, Firestore, Storage)
npx firebase emulators:start --project demo-tana-drink `
  --only auth,firestore,storage --config firebase.collaudo.json

# TERMINALE 2 — dati finti, utente, app
node scripts/seed.js          # menù, magazzino, impostazioni
node scripts/mock-orders.js   # una serata di ordini
node scripts/set-role.js --emulator --email banco@tana.local --role bartender
npm run dev -- --port 5175    # http://localhost:5175
```

Serve un file **`.env`** (non versionato) che dica al client di parlare con
gli emulatori sulla porta giusta:

```
VITE_USE_FIREBASE_EMULATOR=true
VITE_FIREBASE_PROJECT_ID=demo-tana-drink
VITE_FIREBASE_API_KEY=demo-api-key
VITE_FIREBASE_AUTH_DOMAIN=demo-tana-drink.firebaseapp.com
VITE_APP_ENV=test
VITE_FIRESTORE_EMULATOR_HOST=localhost
VITE_FIRESTORE_EMULATOR_PORT=8081
```

Gli stessi valori servono agli script del passo 2 (`seed`, `mock-orders`):
o stanno nell'ambiente del terminale, o si passano davanti al comando.

**L'utente con cui entrare** si crea dal pannello
(http://localhost:4001 → Authentication → Add user) e poi gli si dà il
ruolo con `set-role.js`. Per le prove va bene
`banco@tana.local` / `collaudo123`.

**La 5173 può essere già occupata** da un altro dev server: `--port 5175`
toglie il dubbio (Vite altrimenti ne sceglie una a caso e poi non si sa
dove guardare).

**Gli emulatori partono vuoti a ogni riavvio**: niente persistenza, si
risemina — sono dieci secondi. E tutto vive sul progetto finto
`demo-tana-drink`: né il test né la produzione vengono sfiorati.

### 2. Come il server, per provare davvero

```sh
npm run locale      # compila e avvia TUTTO
```

Compila l'app come in produzione (con `.env.locale`) e la fa servire
dall'**emulatore Hosting**, insieme ad Auth, Firestore, Storage e
**Functions**:

| Cosa | Indirizzo |
|---|---|
| App | http://localhost:5000 |
| Pannello emulatori | http://localhost:4000 |
| Functions | :5001 · Auth :9099 · Firestore :8080 · Storage :9199 |

È la differenza che conta: col dev server le Cloud Functions non ci sono e
il codice gira non compilato. Qui invece si prova quello che finirebbe
online — callable comprese (gestione utenti, pagamenti) — e in fondo al
menu si legge lo stesso ramo e commit che si vedrebbe sul server.

Prerequisiti: **Java** (lo vuole l'emulatore Firestore) e le dipendenze
delle Functions installate una volta (`cd functions && npm install`).

## Riempirlo di roba

Un database vuoto non si prova: si semina.

```sh
npm run seed:dev      # menù, inventario, impostazioni
npm run mock:orders   # ordini di una serata
npm run mock:history  # storico per le statistiche
npm run mock:casse    # chiude quelle serate: casse e incassi divisi per metodo
```

Le utenze si creano dal pannello emulatori
(http://localhost:4000 → Authentication → Add user) e il ruolo si assegna
con:

```sh
node scripts/set-role.js --emulator --email tu@bar.it --role admin
```

## Cosa NON si prova in locale

- **La stampante vera**: è un apparecchio sulla rete del bar, e da qui non
  si raggiunge. In locale però ce n'è una **finta**: le comande e gli
  scontrini si aprono nella finestra di stampa del browser, da cui si
  salvano in PDF. Si accende da sé (server di sviluppo, build `locale` o
  emulatori) e **non** vale sull'ambiente di test, dove ci si collega a
  quella vera. Per spegnerla: `VITE_STAMPANTE_FINTA=false`.
- **SumUp**: le chiamate vere vogliono le credenziali del locale; in
  emulatore si simulano dai DevTools.
- **App Check / reCAPTCHA**: in locale è disattivato (non c'è dominio da
  verificare). È acceso solo in produzione.
- **Le push**: vogliono un dominio in HTTPS e le chiavi vere.
