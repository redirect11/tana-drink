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

Ogni rilascio su `develop` ha una versione **x.y.z** semantica:

- **x** cambia quando si rompe qualcosa di come si lavorava prima;
- **y** quando si aggiunge una funzione;
- **z** per correzioni.

Rilasciare vuol dire tre cose, in quest'ordine:

1. **allineare `package.json`** al numero della versione e datare le note in
   `CHANGELOG.md`, sul ramo di rilascio;
2. portare il ramo di rilascio in `develop` e poi in `main`;
3. **taggare `main`**, spingendo il tag **prima** del ramo — la pipeline
   legge i tag al checkout, e spingendo prima il ramo la build partirebbe
   senza.

```sh
# 1. sul ramo di rilascio: package.json + CHANGELOG datato
git commit -am "release: versione 1.4.0"

# 2. develop, poi main
git checkout develop && git pull && git merge --no-ff release/1.4.0
git push origin develop
git checkout main && git pull && git merge --no-ff release/1.4.0

# 3. il tag, prima del ramo
git tag -a v1.4.0 -m "Descrizione del rilascio"
git push origin v1.4.0
git push origin main
```

**Il numero di versione che l'app mostra lo dice `package.json`, non il
tag.** Il tag sta sul merge in `main`, che non è antenato di `develop` né dei
rami di lavoro: lì `git describe` risalirebbe al tag precedente e l'ambiente
di test direbbe una versione vecchia di un rilascio. È già successo. Il passo
1 non è una formalità: se si salta, tutti gli ambienti mentono sul numero.

**Prima di ogni merge su `develop` e su `main` si chiede conferma.** Il
push di un branch `feature/` invece è libero: serve proprio a provare.

## Urgenze in produzione

1. `hotfix/<nome>` da `main`
2. push → si prova su test
3. merge in `main` (produzione) **e** in `develop`, così la correzione non
   si perde al rilascio successivo.
