# Come si lavora: GitFlow

## Dove si lavora, in pratica

Il lavoro normale — correzioni, ritocchi di interfaccia, modifiche di
media taglia — va **direttamente su `release/x.y.z`**, staccato da
`develop`, col numero della prossima versione. Le modifiche si accumulano
lì e si mergiano tutte insieme.

Un branch `feature/` si stacca **solo per una funzione grossa**, o quando
serve provarla in isolamento con prove serie end-to-end: in quel caso si
decide caso per caso se staccarlo da `release/x.y.z` o da `develop`.

Il motivo è che qui sviluppa una persona sola, con un ambiente di test
solo: venti branch separati vogliono venti deploy e venti prove, mentre
quello che serve è provare le modifiche **insieme**, com'è la serata vera.


## I rami

| Ramo | Nasce da | Finisce in | Dove viene pubblicato |
|---|---|---|---|
| `release/<versione>` | `develop` | `develop`, poi `main` | **test** (`tana-drink-test`) |
| `feature/<nome>` | `release/**` o `develop` | da dove è nato | **test** |
| `develop` | — | `main` | **test** |
| `hotfix/<nome>` | `main` | `main` **e** `develop` | **test**, poi produzione |
| `main` | — | — | **produzione** (`tana-drink`) |

Su `develop` e `main` non si committa mai direttamente.

## Il deploy

Ogni push su `main`, `develop`, `feature/**`, `release/**`, `hotfix/**` fa partire
[la pipeline](../.github/workflows/firebase-hosting.yml): **prima lint e
test**, e solo se sono verdi compila e deploya hosting, Functions e regole.
Se un test fallisce non viene pubblicato niente — prima erano due
workflow che partivano insieme, e la roba rotta finiva online lo stesso. Il progetto di destinazione è `tana-drink`
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

## Il ramo di rilascio

È il posto dove si lavora tutti i giorni. Si apre col numero della
prossima versione:

```sh
git checkout develop && git pull
git checkout -b release/1.3.0
```

Ci finisce dentro tutto quello che si fa; ogni push lo pubblica su test,
quindi si prova sempre l'insieme e non il pezzo singolo. Quando la
versione è pronta si mergia su `develop`, si tagga e si va in `main`.

## I rilasci

Ogni rilascio ha una versione **x.y.z** semantica:

- **x** cambia quando si rompe qualcosa di come si lavorava prima;
- **y** quando si aggiunge una funzione;
- **z** per le correzioni.

### Come si susseguono i rami

Il ramo di lavoro porta il nome della **linea** su cui si sta: `release/1.4.x`
è la linea della 1.4 — lì dentro finiscono correzioni e ritocchi, che alzano
la **z** (1.4.1, 1.4.2…). Quando arriva una **funzione nuova** quella linea si
chiude e se ne apre un'altra: `release/1.5.x`.

```
develop  ──●(v1.4.0)────────────────●(v1.4.1)──────────●(v1.5.0)──▶
            \                      /                  /
             release/1.4.x ──●──●──                   /
                                    \               /
                                     release/1.5.x ─
```

1. **Si rilascia su `develop`**: si allinea `package.json`, si datano le note
   in `CHANGELOG.md`, si mergia il ramo di lavoro in `develop` e si **tagga
   `develop`**.
2. **Si apre subito la linea successiva** da `develop`: `release/1.4.x` per
   continuare con le correzioni, `release/1.5.x` se si sta per aggiungere una
   funzione. Su `develop` non si lavora mai: è il posto dove le cose arrivano
   già fatte.
3. **La produzione è una decisione a sé**: `develop` → `main` si fa quando lo
   si dice, non a ogni rilascio.

```sh
# 1. sul ramo di lavoro: package.json + CHANGELOG datato
git commit -am "release: versione 1.4.0"

# 2. in develop, e si tagga lì
git checkout develop && git pull && git merge --no-ff release/1.4.x
git tag -a v1.4.0 -m "Descrizione del rilascio"
git push origin v1.4.0 && git push origin develop

# 3. la linea successiva parte da develop
git checkout -b release/1.4.x   # correzioni
git checkout -b release/1.5.x   # oppure: funzione nuova
```

**Il numero di versione che l'app mostra lo dice `package.json`, non il
tag.** Il tag può stare dove capita nella storia; `package.json` invece sta su
ogni ramo e viene allineato al passo 1. Se si salta quel passo, tutti gli
ambienti mentono sul numero — è già successo, e chi segnalava un problema
dichiarava una versione che non era quella che aveva davanti.

**Prima di ogni merge su `develop` e su `main` si chiede conferma.** Il
push di un branch `feature/` invece è libero: serve proprio a provare.

## Urgenze in produzione

1. `hotfix/<nome>` da `main`
2. push → si prova su test
3. merge in `main` (produzione) **e** in `develop`, così la correzione non
   si perde al rilascio successivo.
