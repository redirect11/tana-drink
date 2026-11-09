# Il modello a V — come nasce e come si chiude una richiesta

Dall'8 novembre 2026 il progetto segue il modello a V, applicato **a ogni
richiesta** e non all'intera release. Il motivo è uno solo: più qualità e
meno regressioni al banco. I test c'erano già, ed erano tanti; quello che
mancava era sapere **cosa verifica ciascuno** e **quale bisogno del locale
serve ogni requisito**. Un test di unità verde non dice niente sul giro di
una serata, e un requisito che nessun bisogno chiede è difficile da
difendere quando lo si deve cambiare.

Il requisito che lo descrive è REQ-DEV-018; il test che lo fa rispettare è
[`tests/unit/modelloAV.test.js`](../tests/unit/modelloAV.test.js).

## I gradini e i loro specchi

```
Bisogni del locale ─────────────────── Test di accettazione
  Specifica di sistema ──────────── Test di sistema
    Architettura ───────────── Test di integrazione
      Progetto di dettaglio ─ Test di unità
                   Codice
```

| Gradino | Dove si scrive | Si prova con | Dove stanno i test |
|---|---|---|---|
| **Bisogno** (`UR-*`): cosa serve a chi lavora o a chi ordina, senza dire come | [`requirements/bisogni.yaml`](../requirements/bisogni.yaml) | **accettazione**: il giro come lo farebbe chi sta al banco, sull'app intera | `tests/accettazione/` |
| **Requisito** (`REQ-*`): cosa fa l'app, un comportamento alla volta | [`requirements/requirements.yaml`](../requirements/requirements.yaml) | **sistema**: il comportamento sull'app compilata, con gli emulatori | `tests/sistema/` |
| **Componente** (`ARC-*`): un meccanismo su cui poggiano molti requisiti | [`requirements/architettura.yaml`](../requirements/architettura.yaml), racconto in [architettura.md](architettura.md) | **integrazione**: il pezzo insieme a quelli con cui lavora davvero | `tests/component/`, `tests/bdd/`, `tests/regole/` |
| **Modulo**: il progetto di dettaglio, cioè il file e il commento che ne spiega il perché | `src/lib/`, `functions/lib/` | **unità**: il modulo da solo | `tests/unit/` |

Le due regole che reggono la V:

- **La prova si scrive col gradino, non dopo il codice.** Un bisogno nasce
  col suo criterio di accettazione (`accettazione:` in prosa); un
  requisito nasce coi test che lo dimostreranno. Scritto dopo, il test
  finisce per descrivere quello che il codice fa, non quello che doveva
  fare.
- **Ogni legame si scrive in un verso solo.** Il bisogno elenca i suoi
  requisiti; il requisito elenca i suoi test; il difetto elenca il
  requisito che tradisce. Il verso opposto lo ricava lo script: scritto in
  due posti, prima o poi i due posti dicono cose diverse.

## Il livello di un test

Lo dice la cartella. Ma quasi cinquanta file di `tests/unit` sono nati
prima della V e mettono insieme il codice vero (`api.js`, `progressivi.js`…)
con un Firestore finto: è integrazione. Si riconoscono da soli, da quello
che fanno: in `tests/unit`, un test con `vi.mock('firebase/firestore')` è di
integrazione.

Per gli altri casi in cui la cartella non dice il vero, il test lo dichiara
in testa, come già fa con l'ambiente, e la dichiarazione vince:

```js
// @vitest-environment happy-dom
// @livello integrazione: perché, in una riga
```

I livelli sono `unita`, `integrazione`, `sistema`, `accettazione`. I file
non si spostano: vorrebbe dire riscrivere i percorsi in centinaia di voci
del registro.

## Una V per richiesta

Ogni richiesta lavorata — funzione o difetto — scende e risale così.

**Scendendo, prima del codice:**

1. **Il bisogno.** Si cerca in `bisogni.yaml` quello che la richiesta
   serve. Se non c'è, si scrive: titolo, chi lo vive, descrizione e
   **come si accetta**. Un bisogno nuovo è raro; di solito la richiesta
   ne serve uno che esiste già.
2. **Il requisito.** Si scrive o si aggiorna la voce `REQ-*`, e la si
   aggiunge ai `requisiti` del bisogno.
3. **Il componente.** Se la richiesta tocca un meccanismo di
   `architettura.yaml` (la cache, le scritture in sottofondo, le regole),
   si rilegge la sua promessa: la richiesta la deve rispettare, e se la
   cambia si aggiorna il componente.
4. **Il modulo.** Il codice va nel modulo giusto, col commento sul perché.

**Risalendo, coi test:**

5. **Unità** sul modulo toccato.
6. **Integrazione** se la richiesta tocca un componente: per la coda, il
   conto e i pagamenti è il test senza rete, sul modello di
   [`giroInLocale.test.js`](../tests/unit/giroInLocale.test.js).
7. **Sistema** sul comportamento descritto dal requisito *(dalla fase 2)*.
8. **Accettazione** sul criterio del bisogno *(dalla fase 3)*.

**Un difetto** segue la stessa strada al contrario: dice quale requisito
tradisce (`requisiti:` nella voce `BUG-*`), e la correzione porta un test
**al livello che se l'era lasciato sfuggire**. Un conto sbagliato in coda
che i test di unità non vedevano vuole un test di integrazione, non un
altro test di unità.

## Le voci di prima, e il cricchetto

Quando la V è arrivata il registro aveva 320 requisiti e 134 difetti.
Pretendere subito da tutti il bisogno e le prove di ogni livello voleva
dire fermare il lavoro per settimane. Per questo:

- **le voci nuove nascono con la V intera.** «Nuova» si legge dal numero:
  per ogni area vale il più alto che c'era l'8 novembre
  (`PRIMA_DEL_MODELLO_A_V` in
  [`scripts/lib-modello-v.mjs`](../scripts/lib-modello-v.mjs)). Un
  requisito nuovo senza bisogno, o un difetto nuovo che non dice quale
  requisito tradisce, fanno fallire la suite;
- **le voci vecchie si collegano a mano a mano**, quando si lavora nella
  loro zona. Quante ne mancano lo dice `MASSIMO_SENZA_BISOGNO` in
  `modelloAV.test.js`: è un cricchetto, si abbassa a ogni collegamento e
  non si alza mai.

## I test di sistema

```sh
npm run test:sistema
```

Compila l'app con [`.env.sistema`](../.env.sistema), accende Auth e
Firestore emulati con le regole vere (`firebase emulators:exec`, la stessa
versione fissata della CI) e la guida con Playwright in un browser vero: in
locale il Chrome installato, in CI il Chromium di Playwright. Serve Java 21,
come per gli emulatori ([ambiente-locale.md](ambiente-locale.md)).

- **Ogni test parte da un database pulito**: Auth e Firestore si svuotano e
  si seminano come per lo sviluppo, più la licenza della Tana
  ([`tests/sistema/semina.mjs`](../tests/sistema/semina.mjs)).
- **I gesti del banco** (entrare, aprire la cassa, battere un drink,
  tornare in coda) stanno in
  [`tests/sistema/banco.mjs`](../tests/sistema/banco.mjs): i test si
  leggono come una sequenza di gesti, e un'etichetta che cambia si
  aggiorna in un posto solo. I test si importano da lì, non da
  `@playwright/test`.
- **La rete si stacca dal browser** (`context.setOffline(true)`): ogni cosa
  che si vede dopo è la prova che il gesto ha avuto effetto in locale.
- **Il risultato si controlla anche nel database**, con l'SDK di
  amministrazione sull'emulatore: a schermo giusto e al server sbagliato è
  comunque un conto sbagliato.
- In CI girano su ogni pull request (job «Sistema (Playwright)»); se uno
  fallisce, la traccia passo per passo si scarica dall'artefatto
  `rapporto-sistema`.

## A che punto siamo

```sh
node scripts/requisiti.mjs              # il riepilogo, con i test per livello
node scripts/requisiti.mjs --documento  # la specifica, coi capitoli dei bisogni e dell'architettura
```

## Le fasi

1. **I gradini nel registro** — fatto (08/11/2026). Bisogni e componenti di
   partenza, livello di ogni test, regole per le voci nuove, specifica coi
   capitoli nuovi.
2. **I test di sistema** — avviata (08/11/2026). L'infrastruttura e il
   primo test, il giro di una serata senza rete
   ([`serataSenzaRete.spec.js`](../tests/sistema/serataSenzaRete.spec.js)),
   che al primo giro ha trovato BUG-137. Restano i test di sistema degli
   altri requisiti dei bisogni.
3. **I test di accettazione.** Gli scenari della serata scritti dai criteri
   `accettazione:` dei bisogni, in `tests/accettazione/`, leggibili da chi
   lavora al banco.
4. **Il cancello.** In [gitflow.md](gitflow.md) e nella CI, una richiesta
   entra in `develop` solo con la sua V completa.
