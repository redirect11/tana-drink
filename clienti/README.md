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
CLIENTE=demo npm run build   # la build del locale neutro (la CI la fa a ogni push)
```

Un cliente nuovo: `node scripts/genera-cliente.mjs --slug <slug> --nome
"<nome>"` crea la cartella col nome e i file neutri di `demo/` (è quello
che lancia la regia, REQ-VENUE-006); oppure si copia `demo/`, si compila
`venue.json`, si mettono i suoi file in `public/`. Finché non ha i suoi, `python
scripts/immagini-neutre.py clienti/<slug>/public --colore "#2a6f97"` genera
logo, icone, favicon e copertina neutri col suo colore: senza, erediterebbe
quelli della Tana da `public/`. Attivazione, deploy e aggiornamento delle istanze stanno nella regia
(repository drink-regia), non qui. Le cartelle dei clienti che crea la regia
restano sul suo checkout: in questo repository stanno solo `tana` e `demo`.
