# Come si lavora: GitFlow

Regola unica, vale anche per una modifica di una riga.

## I rami

| Ramo | Nasce da | Finisce in | Dove viene pubblicato |
|---|---|---|---|
| `feature/<nome>` | `develop` | `develop` | **test** (`tana-drink-test`) |
| `develop` | — | `main` | **test** |
| `release/<versione>` | `develop` | `main` **e** `develop` | **test** |
| `hotfix/<nome>` | `main` | `main` **e** `develop` | **test**, poi produzione |
| `main` | — | — | **produzione** (`tana-drink`) |

Su `develop` e `main` non si committa mai direttamente.

## Il deploy

Ogni push su `main`, `develop`, `feature/**`, `release/**`, `hotfix/**` fa partire
[la pipeline](../.github/workflows/firebase-hosting.yml): compila, deploya
hosting, Functions e regole. Il progetto di destinazione è `tana-drink`
solo per `main`; per tutto il resto è `tana-drink-test`.

**L'ambiente di test è uno solo.** Ci finiscono a turno `develop` e i
branch in lavorazione: l'ultimo push è quello pubblicato, e i deploy dello
stesso ambiente si annullano a vicenda invece di sovrapporsi. Per sapere
cosa si sta guardando, l'app lo scrive in fondo al menu laterale (si tocca
per copiarlo in un messaggio):

| Dove | Cosa si legge |
|---|---|
| produzione (`main`) | `v1.1.0` — solo il numero: il ramo è sempre quello |
| test (`develop`, `feature/**`, `hotfix/**`) | `v1.1.0 · develop · b50bb1c` |

La versione è **l'ultimo tag raggiungibile**; senza tag si ripiega su
`package.json`. Gli stessi valori stanno in `/version.json`.

Se serve provare due branch insieme senza che si diano fastidio, la strada
è un canale di anteprima di Firebase Hosting
(`firebase hosting:channel:deploy <nome>`), che dà un indirizzo temporaneo
a sé: oggi non è nella pipeline, si aggiunge quando servirà davvero.

## I rami di rilascio

Quando un rilascio va preparato con calma — ultime correzioni, prove al
banco per una sera intera — si stacca `release/<versione>` da `develop`.
Ci si mettono solo correzioni, mai funzioni nuove: quelle continuano su
`develop` senza disturbare. Va su test come tutti gli altri, così si prova
esattamente quello che finirà in produzione. Poi si tagga, si mergia in
`main` e si riporta in `develop`.

Per un rilascio semplice non serve: si tagga `develop` e si mergia.

## I rilasci

Ogni rilascio su `develop` ha una versione **x.y.z** semantica:

- **x** cambia quando si rompe qualcosa di come si lavorava prima;
- **y** quando si aggiunge una funzione;
- **z** per correzioni.

Il tag si mette **su `develop`, subito prima del merge su `main`**:

```sh
git checkout develop && git pull
git tag -a v1.4.0 -m "Descrizione del rilascio"
git push origin v1.4.0
git checkout main && git merge develop --no-ff
git push origin main
```

**Prima di ogni merge su `develop` e su `main` si chiede conferma.** Il
push di un branch `feature/` invece è libero: serve proprio a provare.

## Urgenze in produzione

1. `hotfix/<nome>` da `main`
2. push → si prova su test
3. merge in `main` (produzione) **e** in `develop`, così la correzione non
   si perde al rilascio successivo.
