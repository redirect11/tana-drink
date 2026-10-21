# I clienti: un locale è una cartella

Un solo codice compilato con configurazioni diverse (docs/flotta.md,
REQ-VENUE-001). `CLIENTE=<slug>` sceglie la cartella; senza, è `tana`.

```
clienti/<slug>/
  venue.json      identità del locale: nome, slogan, indirizzo, email,
                  ragione sociale, social, colore del tema, descrizione
  public/         (facoltativa) file che SOSTITUISCONO quelli di public/:
                  logo.png, icon-192.png, icon-512.png,
                  icon-maskable-512.png, apple-touch-icon.png, favicon.svg,
                  cocktail-hero.jpg
```

Le chiavi di `venue.json` sono le stesse `venue_*` di `settings/bar`: quello
che il locale scrive in Impostazioni vince su quello che sta qui.

```sh
CLIENTE=demo npm run dev     # il locale neutro, in locale
CLIENTE=demo npm run build   # la build per drink-demo
```

Un cliente nuovo: si copia `demo/`, si compila `venue.json`, si mettono i
suoi file in `public/`. Il resto lo fa l'attivazione (REQ-FLOTTA-006).
