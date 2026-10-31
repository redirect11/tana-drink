# Gli aggiornamenti decisi dalla regia: obbligatori o a scelta del titolare

REQ-FLOTTA-020. Richiesta della regia (drink-regia, stesso id), 31/10/2026.
Qui c'è quello che serve **all'app**; il lato regia (interruttori, ondate,
rinnovi, dashboard) lo fa la regia e qui è raccontato solo per capire.

**Stato: fatto lato app** (31/10/2026, 1.10.3-beta). Dove sta: la logica
in `src/lib/aggiornamenti.js`, il box in
`src/components/PropostaAggiornamento.jsx`, la scheda in
`src/components/InfoTab.jsx`, la scrittura in `src/lib/api.js`
(`scegliAggiornamento`), le regole in `firestore.rules`. Una differenza da
quanto scritto sotto: la proposta esce se il tag è **più nuovo**
dell'installata, non solo diverso (una proposta rimasta indietro
offrirebbe un ritorno all'indietro). Il punto 6 è scritto in REQ-LIC-003.

## Cosa ha chiesto l'utente

> «possiamo configurarli in due modi: uno quello attuale, quando arriva un
> aggiornamento, esce il testo aggiorna, si aggiorna e poi mostra il
> changelog, il secondo invece dovrebbe mostrare prima il changelog con i
> cambiamenti e chiedere se si vuole aggiornare. Il titolare potrebbe voler
> anche saltare l'aggiornamento.»
>
> «nei vari piani siano garantiti aggiornamenti fino a che si paga. Se non
> si paga, si ritorna alla versione gratis ma senza possibilità di
> aggiornare.»

Decisioni dell'utente dello stesso giorno:

- un rilascio che la regia segna **obbligatorio** (sicurezza o
  compatibilità con la regia) arriva a tutti, anche a chi ha saltato o non
  paga;
- con la regola «aggiornamenti solo finché si paga» accesa, **il Free
  riceve solo gli obbligatori**;
- il titolare vede le novità e sceglie **nell'app e nella sua area clienti
  della regia**: vale la prima risposta che arriva;
- le due modalità le accende e le spegne l'admin della regia; chi ha già
  un piano non cambia niente fino al rinnovo, e riceve un avviso.

## Le due modalità, viste dal locale

**Obbligatori** (com'è oggi). La regia pubblica la versione nuova; l'app
mostra «Nuova versione disponibile — tocca per aggiornare» e poi il box
delle novità (`NovitaDialog`). **Qui non cambia niente.**

**A scelta.** La regia non pubblica: scrive una **proposta** nella licenza.
L'app mostra al titolare, prima, le novità della versione proposta e due
bottoni:

- **«Aggiorna»**: l'app scrive la scelta; la regia la legge entro una
  decina di minuti e pubblica. Poi tutto va come oggi: banner «Nuova
  versione disponibile», ricarica, box delle novità.
- **«Salta questa versione»**: il locale resta dov'è. La proposta non
  esce più da sola, ma resta in Impostazioni → Informazioni con il suo
  «Aggiorna», se il titolare cambia idea. Quando arriva una versione
  ancora più nuova, la proposta diventa quella, con le note di tutto
  quello che c'è in mezzo.
- **«Più tardi»** (o chiudere il box): niente scelta; il box torna alla
  prossima apertura dell'app.

Un rilascio **obbligatorio** non passa dalla proposta: la regia lo
pubblica e basta, in tutte e due le modalità.

**Aggiornamenti non inclusi.** Con la regola «solo finché si paga» accesa,
un locale che non paga (o è Free) riceve solo gli obbligatori: nessuna
proposta. Un locale che non paga torna anche al **piano Free** (la regia
scrive `licenza.piano: 'free'` e i `limiti`, come già oggi per il Free).

## Il contratto

### Dalla regia all'app: `settings/bar.licenza.aggiornamenti`

Lo scrive solo la regia, come il resto di `licenza`.

```js
licenza.aggiornamenti = {
  modalita: 'obbligatori' | 'a_scelta',
  inclusi: true | false,        // false: arrivano solo gli obbligatori
  motivo: null | 'non_pagato' | 'free',   // perché non sono inclusi
  proposta: null | {
    tag: 'v1.11.0',             // la versione proposta
    note: '## 1.11.0 — …\n…',   // Markdown: le sezioni del CHANGELOG dopo
                                //  la versione installata, fino al tag
    proposta_il: '2026-11-…Z',
    saltata_il: null | '2026-11-…Z',   // il titolare l'ha saltata
  },
  avviso: null | {
    id: 'condizioni-2026-11',   // cambia quando cambia l'avviso
    testo: '…',                 // il testo lo scrive la regia, qui si mostra
    dal: '2026-12-01T00:00:00Z' // da quando valgono le condizioni nuove
  },
}
```

**Senza `licenza.aggiornamenti`** (la Tana, le istanze di prima) l'app fa
esattamente quello che fa oggi. Lo stesso con `modalita: 'obbligatori'`.

### Dall'app alla regia: `aggiornamenti/scelta`

Un documento suo, **non** in `settings/`: `settings/{docId}` si legge da
chiunque e lo scrive ogni bartender, mentre la scelta è del titolare.

```js
aggiornamenti/scelta = {
  tag: 'v1.11.0',               // deve essere quello della proposta
  scelta: 'aggiorna' | 'salta',
  il: serverTimestamp(),
  da: '<uid del titolare>',
}
```

Regole: lo legge e lo scrive **solo il titolare** (ruolo `admin` nelle
regole di oggi); `tag` nella forma `^v\d+\.\d+\.\d+$`, `scelta` una delle
due, `il == request.time`, `da == request.auth.uid`, nessun altro campo.
La regia lo legge con le sue credenziali (non passa dalle regole), lo
confronta con la sua proposta, pubblica o segna saltata, e poi aggiorna
`licenza.aggiornamenti.proposta`. Una scelta su un tag che non è più
quello proposto la regia la ignora.

Perché la regia va a leggere invece di essere chiamata: il profilo
leggero non ha Functions, e una chiamata dal browser alla regia avrebbe
bisogno di una chiave nel browser. Così non serve niente di nuovo.

## Cosa deve fare l'app

1. **Il box della proposta**, solo per il titolare, con
   `modalita === 'a_scelta'`, `inclusi === true`, una `proposta` senza
   `saltata_il` e un `tag` diverso dalla versione installata. Titolo con la
   versione, le `note` col componente `Changelog` di oggi, i tre bottoni.
   Chi non è titolare non vede niente (al massimo, in Informazioni, «c'è
   una versione nuova: la decide il titolare»).
2. **Dopo «Aggiorna»**: «Aggiornamento chiesto: arriva entro una ventina
   di minuti». Il resto lo fanno il banner e il box di oggi. Se la scelta
   arriva prima dalla dashboard della regia, la regia cambia la proposta e
   l'app, che ascolta `settings/bar`, toglie il box da sola.
3. **Impostazioni → Informazioni**: la versione installata, e
   - con una proposta (anche saltata): «Disponibile la versione X» con le
     note e «Aggiorna»;
   - con `inclusi === false`: «Il piano di questo locale non comprende gli
     aggiornamenti: arrivano solo le correzioni di sicurezza e di
     compatibilità», con il collegamento a `licenza.regia_url`. Con
     `motivo: 'non_pagato'` la frase dice che l'abbonamento non risulta
     pagato e che il locale lavora col piano Free.
4. **L'avviso delle condizioni**: al titolare, una volta per `avviso.id`
   (ricordato sul dispositivo, come `novita.js`), un box col `testo` e la
   data `dal`, e una notifica in campanella che resta. Il testo non si
   riscrive qui: è un testo contrattuale, lo decide la regia.
5. **La demo** (`__DEMO__`) ignora tutto questo.
6. **Il ritorno al Free di un locale che pagava**: `licenza.piano: 'free'`
   coi `limiti` arriva su un locale che ha già più prodotti, conti o
   utenti dei limiti. **Non si cancella niente.** Va confermato (e scritto
   in REQ-LIC-003) che cosa fa oggi `src/lib/limiti.js` con quello che è
   già oltre il limite, e che il passaggio al profilo leggero di
   `licenza.piano === 'free'` non rompa un locale che le Functions le ha
   pubblicate.

## Test che servono

- logica pura: quando esce il box, quando no (titolare o no, modalità,
  inclusi, saltata, tag uguale all'installato, niente `aggiornamenti`);
- componente: i tre bottoni e cosa scrivono; il box che sparisce quando la
  proposta cambia; l'avviso una volta per id;
- regole: `aggiornamenti/scelta` scritto dal titolare con i campi giusti;
  rifiutato a bartender, sala, cliente, anonimo, e con campi in più o
  valori fuori forma.

## Lato regia (per capire, non da fare qui)

- Due interruttori dell'admin, «Aggiornamenti a scelta del titolare» e
  «Aggiornamenti solo finché si paga», e la modalità che si può fissare
  per un singolo locale (la Tana, quando la aggiorna la regia).
- Nei rilasci a ondate un locale «a scelta» riceve la proposta e non
  ferma l'ondata; un rilascio si può segnare obbligatorio.
- Le note le prende dal `CHANGELOG.md` di tana-drink al tag (il
  repository è pubblico): **il formato dei titoli `## X.Y.Z — data` è un
  contratto**, lo stesso che usa già `sezioneChangelog`.
- Le condizioni nuove valgono per chi ha già un piano dal suo prossimo
  rinnovo; fino ad allora riceve l'avviso.

## Da sapere, a parte

`settings/{docId}` si scrive da ogni bartender, quindi anche
`settings/bar.licenza`: oggi un bartender può accendersi da solo i moduli
a pagamento o togliere una sospensione. Con i piani che decidono anche
gli aggiornamenti la licenza conta di più. Proposta: un requisito a parte
perché le regole rifiutino a chiunque una scrittura che cambia `licenza`
(la regia scrive con le sue credenziali e non ne ha bisogno).
