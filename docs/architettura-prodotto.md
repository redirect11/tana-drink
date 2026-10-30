# Il prodotto: architettura e funzionamento

Stato al 30 ottobre 2026. Questo documento spiega **com'è fatto e come
funziona** il prodotto che vende l'app della Tana ad altri locali. Il
dettaglio di quello che sta in questo repository sta in
[flotta.md](flotta.md). **La flotta — attivazione, Terraform, workflow e
script delle istanze — sta nella regia**, il repository drink-regia
(`docs/flotta-nella-regia.md`): dal 29/10/2026 non è più qui.

## 1. L'idea in una frase

Un solo codice, **un'installazione separata per ogni locale**, e un
**sito** da cui il titolare di un locale si abbona e ottiene la sua
installazione senza che nessuno tocchi Firebase a mano. La Tana è il
primo locale della flotta e non cambia: resta sul suo progetto, col suo
dominio, coi suoi dati.

## 2. I pezzi

I repository sono due, fissi: uno per l'app e uno per il sito. Quello che
nasce per ogni locale nuovo non è un repository ma un **progetto
Firebase**, cioè il suo spazio su Google con database, hosting e accessi.

| Pezzo | Dove sta | Progetto Firebase | A cosa serve |
|---|---|---|---|
| **L'app** (cassa, comande, magazzino, statistiche) | repository `tana-drink` | uno per locale: `tana-drink` per la Tana, `drinkpos-<locale>` per gli altri | è quello che il locale usa ogni sera |
| **Il sito del prodotto** («regia») | repository `drink-regia` | `drink-regia` | prezzi, registrazione, accesso, dashboard del titolare, backoffice, abbonamento |
| **L'attivazione e gli aggiornamenti** (Terraform + workflow) | repository `drink-regia`, cartelle `infra/` e `.github/workflows/` (`provisiona-istanza.yml`, `aggiorna-istanza.yml`) | crea e aggiorna `drinkpos-<locale>` | trasforma una richiesta in un'installazione pronta, e le porta i rilasci |
| **La demo** | compilazione dell'app con `CLIENTE=demo`, pubblicata dalla regia come un'istanza qualsiasi | `drinkpos-demo` | provare e far vedere l'app neutra, senza dati veri |

Perché due repository: il sito ha vita e ritmo propri, e non deve
trascinarsi i 3.500 test dell'app a ogni modifica di un prezzo. Perché un
progetto Firebase per locale: isolamento totale dei dati, costi leggibili
per cliente, nessuna query che possa mischiare due locali.

## 3. Il marchio è un dato, non codice

L'app non sa più di essere «della Tana». Nome, slogan, indirizzo, email,
ragione sociale, social, intestazione dello scontrino vengono da due
strati:

1. **la build**: `clienti/<slug>/venue.json`. `CLIENTE=tana npm run build`
   produce l'app della Tana, byte per byte come prima; `CLIENTE=demo` quella
   neutra; `CLIENTE=bar-mario` quella del Bar Mario;
2. **le impostazioni**: Impostazioni → Il locale, dentro l'app. Quello che
   il locale scrive lì vince sulla build, senza ricompilare.

Un test automatico conta le parole «Tana» rimaste nel codice e permette
solo di farle scendere: oggi restano in quattro file, tutte giustificate.

## 3b. I moduli: cosa è di base e cosa si compra

| | Cosa comprende |
|---|---|
| **Di base** | coda ordini, cassa con contanti e carta, scontrino, menù (creazione delle voci), utenti e ruoli, impostazioni |
| **Menù digitale e tavoli** | il menù sul telefono del cliente, il QR al tavolo, la vista cliente |
| **Ordini dal telefono del cliente** | il cliente ordina dal menù e segue l'ordine; senza, il menù si legge e basta |
| **Gestione clienti** | account dei clienti, i loro ordini, i gruppi di conti |
| **Magazzino e fornitori** | giacenze, scarico dalle ricette, inventario, ordini e fatture dei fornitori |
| **Statistiche e bilancio** | incassi per serata e periodo, venduto per fascia, bilancio |
| **Personale e ore** | ore e paghe, chiamate allo staff |
| **Pagamenti con lettore SumUp** | il conto va al lettore e torna pagato |

Gli id dei moduli sono gli stessi nel listino del sito e nell'app: quello
che si compra è quello che la licenza accende. La Tana, senza licenza
scritta, li ha tutti. Prezzi e taglio dei moduli sono da confermare.

## 4. Come funziona per il titolare di un locale

1. Apre il sito del prodotto e legge piani e prezzi.
2. **Si registra** in quattro passi: account (email e password), locale
   (nome, tipo, indirizzo, telefono), fatturazione (ragione sociale,
   partita IVA, PEC o codice destinatario, sede legale), referente e
   consensi. Riceve un'email da confermare.
3. **Sceglie il piano** nella sua dashboard e paga con Stripe (abbonamento
   mensile). Finché Stripe non è configurato, l'amministratore segna il
   piano a mano dal backoffice.
4. Preme **«Attiva»**. Da lì in poi non fa niente: dopo qualche minuto la
   dashboard dice «Attiva» e mostra l'indirizzo della sua app.
5. Entra nella sua app come amministratore, con l'email dell'account, e
   lavora: menù, magazzino, personale, stampante, lettore SumUp.

## 5. Come funziona dietro: l'attivazione

```
sito (drink-regia)                  GitHub Actions (drink-regia)
──────────────────                  ────────────────────────────
«Attiva» → richieste/{slug}
   Function avviaProvisioning  ──▶  provisiona-istanza.yml
                                      1. terraform apply: progetto drinkpos-<slug>,
                                         Firestore, Hosting, web app, Auth, ruoli
                                      2. l'app di tana-drink al ref chiesto, in app/;
                                         genera-cliente.mjs: clienti/<slug>/venue.json
                                      3. build CLIENTE=<slug>
                                      4. deploy regole, indici, Functions, hosting
                                      5. licenza e nome del locale nell'istanza
   Function esitoProvisioning  ◀──  6. esito (sempre, anche in errore)
dashboard: «Attiva», indirizzo
```

La **licenza** (`settings/bar.licenza` nell'istanza) dice quali moduli sono
accesi: è il piano comprato tradotto nelle funzioni premium dell'app.
L'app non dipende mai da Stripe o dal sito per funzionare: un pagamento
in ritardo cambia cosa dice la dashboard, non quello che la cassa fa.

**Un limite da sapere.** Un account Google personale non ha
un'Organizzazione Cloud, e senza Organizzazione un programma non può
creare progetti: li può creare solo una persona. Quindi oggi
l'attivazione è semi-automatica: alla richiesta, l'amministratore crea il
progetto vuoto con un comando e preme «Rilancia»; il resto va da solo.
Con un'Organizzazione (Cloud Identity Free, gratuita, vuole un dominio
verificato) diventa tutta automatica senza cambiare codice.

## 6. Sicurezza e separazione

- **La Tana non si tocca.** I workflow di tana-drink pubblicano solo i
  due progetti della Tana, compilati con `cliente: tana`; le istanze le
  pubblica la regia, con le sue credenziali, che qui non ci sono. Un test
  legge i workflow e lo garantisce.
- **Ogni locale ha il suo database**, le sue regole, il suo accesso. Il
  sito del prodotto non contiene mai dati operativi: solo account, piani,
  abbonamenti, stato delle installazioni.
- **I segreti stanno negli environment di GitHub** (`production` e `test`
  qui; `flotta` e `flotta-test` nella regia)
  e nei segreti delle Functions, mai nel codice. Le chiavi di prova di
  Stripe prima di quelle vere.
- **Il titolare vede solo il suo documento**; il backoffice richiede un
  claim di amministratore sull'account.

## 7. CI/CD, rilasci e repository privati

- `tana-drink` è **pubblico**: Actions senza limiti. `drink-regia` è
  **privato**: su un account GitHub Free i repository privati hanno 2.000
  minuti di Actions al mese, gratis; la CI del sito gira in un minuto, quindi
  bastano per centinaia di esecuzioni. Funziona come per la Tana: lint,
  test e build a ogni push, deploy solo da un tag su `main` o a mano.
- Stesso GitFlow nei due repository: lavoro su `release/x.y.z`, pull
  request verso `develop` e `main`, tag per pubblicare.
- **Una versione sola, quella di tana-drink** (`package.json`, tag su
  `main`). La Tana la riceve con la pipeline di sempre. Ogni altro locale
  mostra nel backoffice la versione che ha, e la riceve quando lo si
  decide: «Aggiorna» su un locale, «Aggiorna tutte le istanze attive» su
  tutti; sotto c'è il workflow `aggiorna-istanza.yml` della regia, che compila l'app
  per quel locale dal ramo o tag scelto e la pubblica. Niente si aggiorna
  da solo a un push: un bug trovato alla Tana si porta ai clienti quando
  il rilascio è pronto, e un cliente si può tenere indietro o riportare a
  un tag precedente.
- **Ogni app di un locale è un'app di produzione**: build di produzione,
  pubblicata da un rilascio (`main` o un tag), con il progetto etichettato
  `ambiente=produzione`. Le prove si fanno sulla demo e sugli emulatori.
- **I servizi premium si comprano dalla dashboard** del titolare: «Cambia
  piano o moduli» aggiorna l'abbonamento Stripe con conguaglio, e la
  licenza dell'istanza si riscrive da sola: le funzioni compaiono nell'app
  entro un minuto. **Si fermano** dalla regia: Sospendi, Riattiva, Chiudi
  dal backoffice, o la sospensione automatica di chi non paga da più di
  sette giorni; l'app mostra una schermata che lo dice, i dati restano.

## 8. Cosa c'è oggi, cosa manca

**C'è e funziona**

- L'app compilata per un locale qualsiasi, provata su `drinkpos-demo`:
  https://drinkpos-demo.web.app
- Il sito del prodotto, online: https://drink-regia.web.app (prezzi,
  registrazione, dashboard, backoffice, pagine legali).
- Tutto il codice dell'attivazione e dell'abbonamento, con i test.

**Manca, e dipende da decisioni o passaggi in console**

| Cosa | Chi | Perché serve |
|---|---|---|
| Piano Blaze su `drink-regia` e `drinkpos-demo` | utente | le Functions (attivazione, Stripe) non si pubblicano senza |
| Firebase Auth «Inizia» + Email/password | utente, console | la registrazione sul sito non funziona senza |
| Service account di provisioning, bucket dello stato, token GitHub, segreti | utente, con l'aiuto degli script della regia | la prima attivazione automatica |
| Chiavi Stripe di prova | utente | il pagamento online |
| Dominio del prodotto | utente | indirizzi veri invece di `*.web.app`; e l'Organizzazione Cloud |
| Nome del prodotto e prezzi definitivi | utente | «Drink» e i prezzi sono segnaposto |
| Testi legali rivisti e dati della società | utente, consulente | prima di vendere |

## 9. Dove mettere le mani

| Per… | Vai in |
|---|---|
| cambiare nome o prezzi del prodotto | `drink-regia`: `src/lib/prodotto.js`, `piani.json` |
| la cartella di un locale | `tana-drink`: `scripts/genera-cliente.mjs` (la lancia la regia), `clienti/<slug>/` |
| capire cosa pubblica la CI della Tana | `tana-drink`: `.github/workflows/firebase-hosting.yml` |
| attivazione, aggiornamento, prerequisiti delle istanze | `drink-regia`: `docs/flotta-nella-regia.md`, `infra/README.md` |
| i requisiti e i test | `requirements/requirements.yaml` in ciascun repository |
