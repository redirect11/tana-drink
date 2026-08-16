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
| `release/<versione>` | `develop` | `develop`, poi `main` | col tag: **test** (`tana-drink-test`) |
| `feature/<nome>` | `release/**` o `develop` | da dove è nato | col tag: **test** |
| `develop` | — | `main` | col tag: **test** |
| `hotfix/<nome>` | `main` | `main` **e** `develop` | col tag: **test**, poi produzione |
| `main` | — | — | col tag: **produzione** (`tana-drink`), da approvare |

Nessun ramo pubblica da sé: a pubblicare è il **tag**. Vedi «Il deploy».

Su `develop` e `main` non si committa mai direttamente.

## Il deploy

**Si pubblica solo con un tag.** Un push su un ramo — qualunque ramo, `main`
compreso — fa girare **lint, test e build**
([test.yml](../.github/workflows/test.yml)) e finisce lì: non pubblica
niente.

| Cosa fai | Cosa succede |
|---|---|
| push su un ramo qualsiasi | lint + test + build. Nessun deploy. |
| tag su un commit **non** in `main` | va **online sul test**, subito |
| tag su un commit **di `main`** | parte la pipeline, e il deploy in **produzione aspetta un'approvazione** |

Il ramo non c'entra più: conta **dove sta il commit taggato**. Un `v1.5.0`
messo su `develop` mentre matura pubblica sul test; lo stesso numero, dopo
che quel commit è entrato in `main`, chiede il via libera e va in
produzione.

Perché è cambiato: pubblicare a ogni push voleva dire due cose fastidiose.
L'ambiente di prova cambiava **sotto le mani** di chi ci stava provando
sopra — bastava che un altro spingesse il suo ramo — e un merge su `main`
mandava in produzione **senza che nessuno lo avesse deciso in quel
momento**: la decisione era stata presa mergiando, magari un'ora prima.
Il tag invece è un gesto solo, esplicito: si tagga quando si vuole
pubblicare quella cosa lì.

```sh
# provare sul test quello che si sta facendo
git tag prova-stampa-sala && git push origin prova-stampa-sala

# rilasciare in produzione (poi si approva su GitHub)
git tag -a v1.4.2 -m "Versione 1.4.2" && git push origin v1.4.2
```

Il nome del tag è libero per le prove; per i rilasci resta `vX.Y.Z`, che è
quello che l'app mostra come numero di versione.

**L'approvazione della produzione non sta nel codice**: è una regola del
repository, in *Settings → Environments → `production` → Required
reviewers*. Va messa una volta; senza quella spunta un tag su `main`
pubblicherebbe da sé, e la pipeline non se ne accorgerebbe. Chi approva
vede il deploy in attesa nella scheda Actions.

**L'ambiente di test è uno solo.** Ci finisce l'ultimo tag pubblicato, da
qualunque ramo venga. I deploy non si annullano a vicenda: si mettono in
fila, così uno fermo in attesa di approvazione non sparisce perché nel
frattempo è stato taggato altro. Per sapere cosa si sta guardando, l'app lo
scrive in fondo al menu laterale (si tocca per copiarlo in un messaggio):

| Dove | Cosa si legge |
|---|---|
| produzione | `v1.1.0` — solo il numero: là non c'è altro da sapere |
| test | `v1.1.0 · develop · b50bb1c` |

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
3. **La produzione è una decisione a sé**, e adesso sono due: prima
   `develop` → `main`, poi il **tag su `main`** che fa partire il deploy —
   che a sua volta aspetta l'approvazione. Mergiare non pubblica niente.

```sh
# 1. sul ramo di lavoro: package.json + CHANGELOG datato
git commit -am "release: versione 1.4.0"

# 2. in develop, e si tagga lì (il tag pubblica sul TEST)
git checkout develop && git pull && git merge --no-ff release/1.4.x
git tag -a v1.4.0 -m "Descrizione del rilascio"
git push origin develop && git push origin v1.4.0

# 3. la linea successiva parte da develop
git checkout -b release/1.4.x   # correzioni
git checkout -b release/1.5.x   # oppure: funzione nuova

# 4. quando si va in produzione: prima il merge, POI il tag su main
git checkout main && git merge --no-ff develop && git push origin main
git tag -a v1.4.0-prod -m "In produzione la 1.4.0" && git push origin v1.4.0-prod
# → su GitHub, Actions: il deploy aspetta l'approvazione
```

**Mentre si lavora, `package.json` porta il numero della PROSSIMA versione
col suffisso `-beta`** (es. `1.4.2-beta`): così l'app in test dice
`v1.4.2-beta · release/1.4.x · <commit>` e non si confonde con quello che è
davvero uscito. Al rilascio (passo 1) si toglie il `-beta`. Se le note in
`CHANGELOG.md` parlano di una versione e l'app ne dice un'altra, chi segnala
un problema dichiara un numero che non esiste.

**Il numero di versione che l'app mostra lo dice `package.json`, non il
tag.** Il tag può stare dove capita nella storia; `package.json` invece sta su
ogni ramo e viene allineato al passo 1. Se si salta quel passo, tutti gli
ambienti mentono sul numero — è già successo, e chi segnalava un problema
dichiarava una versione che non era quella che aveva davanti.

**Prima di ogni merge su `develop` e su `main` si chiede conferma**, e lo
stesso vale per i **tag**: sono loro a pubblicare. Il push di un branch
`feature/` invece è libero — non pubblica niente, fa solo girare i test.

**Un tag per la produzione non si riusa.** Se `v1.4.0` è già stato spinto
su `develop` (e ha pubblicato sul test), per la produzione serve un tag
nuovo sul commit di `main`: un tag esiste una volta sola, e spostarlo a
forza vuol dire non sapere più cosa è stato pubblicato quando.

## Urgenze in produzione

1. `hotfix/<nome>` da `main`
2. push → girano lint e test; per **provarlo davvero** si tagga il ramo
   (`git tag prova-hotfix-x && git push origin prova-hotfix-x`), e quel tag
   pubblica sul test
3. merge in `main` (che non pubblica) **e** in `develop`, così la
   correzione non si perde al rilascio successivo
4. tag sul commit di `main` → il deploy in produzione parte e **aspetta
   l'approvazione**

### Quando l'hotfix riporta indietro una funzione già scritta

Capita: una cosa è pronta sulla linea di sviluppo e serve in produzione
subito. La si porta con un `git cherry-pick` dei commit che la fanno.

**Nel messaggio del commit va scritto da dove viene**, con l'identificativo
originale:

```
(cherry-pick da 729f718, release/1.4.x)
```

Non è formalità. Quel commit, alla fine, esiste **due volte**: l'originale
sulla linea di sviluppo e la copia sull'hotfix — e la copia rientra in
`develop` col merge dell'hotfix. Nella storia si vedono due commit con lo
stesso titolo, e senza quella riga chi guarda si chiede se qualcosa sia
stato fatto due volte.

Tre cose da sapere, tutte già costate tempo:

- **`git cherry` non li riconosce come duplicati.** La copia nasce sopra un
  codice più vecchio, quindi la patch non è identica: per git sono due
  modifiche diverse. Il rebase non li scarta da sé, e non c'è niente da
  scartare a mano — vanno tenuti tutti e due.
- **Il conto si paga in conflitti, non in codice doppio.** Rientrando in
  `develop`, le due strade toccano le stesse righe: si sciolgono a mano,
  tenendo la linea di sviluppo e portandoci dentro le correzioni
  dell'hotfix. Dopo, si controlla che il contenuto sia UNO: nessun
  requisito ripetuto, nessun `describe` doppio, una sola funzione.
- **Dopo un rebase così, si fanno girare i test.** Sciogliendo un
  conflitto è facile incollare un blocco dentro un altro: lint e build non
  se ne accorgono, e un file di prove finisce saltato per intero. Se il
  numero totale dei test cala, è quello.
