# Provare un branch in locale, come se fosse il server

Serve per lavorare su un branch senza pubblicarlo: l'ambiente di test è
uno solo e ci passano a turno `develop` e i branch di tutti. In locale
invece si rompe quello che si vuole, si svuota il database e si ricomincia.

Nessun progetto vero viene toccato: gli emulatori girano su
`demo-tana-drink`, che vive solo sul tuo computer.

## Due modi

### 1. Sviluppo, per lavorare (ricarica a ogni salvataggio)

```sh
npm run emulators   # Auth, Firestore, Storage
npm run dev         # http://localhost:5173
```

Serve un file `.env` con `VITE_USE_FIREBASE_EMULATOR=true` (vedi
`.env.example`), oppure si usa Docker che lo imposta da sé:

```sh
docker compose up --build      # app su :5173, emulatori su :4000
```

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
```

Le utenze si creano dal pannello emulatori
(http://localhost:4000 → Authentication → Add user) e il ruolo si assegna
con:

```sh
node scripts/set-role.js --emulator --email tu@bar.it --role admin
```

## Cosa NON si prova in locale

- **La stampante**: è un apparecchio sulla rete del bar, e da qui non si
  raggiunge.
- **SumUp**: le chiamate vere vogliono le credenziali del locale; in
  emulatore si simulano dai DevTools.
- **App Check / reCAPTCHA**: in locale è disattivato (non c'è dominio da
  verificare). È acceso solo in produzione.
- **Le push**: vogliono un dominio in HTTPS e le chiavi vere.
