# La Tana nella regia di produzione: Flavio titolare, email e accesso unico

Richiesta della regia, 04/11/2026. Completa
[passaggio-dalla-regia.md](passaggio-dalla-regia.md) (REQ-FLOTTA-030): quello
è il contratto tecnico del passaggio; qui c'è cosa serve all'app, e in che
ordine, perché la Tana entri nella regia di produzione.

## La richiesta dell'utente

> «Mettiamo che vogliamo deployare la nuova regia e l'ultima versione di
> tana-drink in produzione. Come faccio a collegare l'utenza di Flavio
> attuale di tana-drink a quella della regia? Cioè regia deve sapere che
> Flavio è il titolare, deve poter inviare comunicazioni a lui via email
> rispetto al prodotto e deve poter effettuare il single sign on con la sua
> utenza.»

## Il principio: la stessa email

Gli account restano due, uno nel progetto `tana-drink` e uno in
`drink-regia`, con uid diversi. Non si unificano e non si cancellano:
quello di Flavio nella Tana è usato da tempo. Li lega **l'email**:

- la regia registra la Tana come «locale esistente» con l'email di Flavio:
  da lì `clienti/{uid}` dice che il titolare è lui, e le email della regia
  vanno a quell'indirizzo;
- il passaggio, nei due versi, accetta solo un account del locale con
  **la stessa email, verificata, e ruolo `admin`** (drink-regia,
  `functions/lib/passaggio.js`: `titolareNelLocale`, `titolareDallApp`).

Quindi, dal lato dell'app, l'email di Flavio nella Tana deve essere
verificata e lui deve essere admin. Se un giorno cambia email, va cambiata
in tutti e due i posti.

Nella regia arriva anche l'accesso con Google (drink-regia, 04/11/2026). Se
l'email di Flavio è Gmail, entra nella regia con Google e ritrova lo stesso
account. Il passaggio non cambia, perché confronta le email.

## Cosa manca nell'app (da fare qui)

Oggi né `develop` né `main` hanno il lato app del passaggio. Senza, il
titolare non passa: la regia crea il codice, ma l'app non lo riceve.

1. **REQ-FLOTTA-030 per intero**, come in
   [passaggio-dalla-regia.md](passaggio-dalla-regia.md):
   - ricevere `#accesso-regia=<codice>`;
   - il tasto «Area clienti»;
   - i quattro campi nuovi del titolare;
   - il banco con Google.
2. **L'email verificata del titolare.** `scripts/titolare-locale.mjs` (con
   `scripts/lib-titolare.js`) deve dire anche se l'email dell'account è
   verificata. Con un'opzione esplicita, per esempio `--verifica-email`
   insieme ad `--applica`, la segna come verificata. È un account che
   l'amministratore conosce: l'email è quella che Flavio usa da sempre. Senza
   quell'opzione lo script non la cambia.

   Sulla Tana il caso atteso resta «resta quello», cioè un uid diverso da
   quello della regia, e va bene così.
3. **La 1.10 su `main`.** La regia di produzione pubblica e propone solo
   quello che è su `main` di tana-drink (`FLOTTA_REF=main`, `APP_REF=main`).
   Oggi `main` è alla 1.9 (PR #220): la 1.10, col punto 1 dentro, va
   rilasciata col processo di sempre.

`VITE_REGIA_PROGETTO` è già a posto: `deploy.yml` mette `drink-regia` in
produzione e `drink-regia-test` in test.

## L'ordine del giorno del rilascio

Le righe segnate **(utente)** sono permessi o scritture su progetti veri:
le fa l'utente, o un agente col suo via libera esplicito.

1. **tana-drink:** la 1.10 con il punto 1 su `main`, poi il deploy della
   Tana in produzione, come sempre.
2. **drink-regia:** la 0.3.0 su `main` e il deploy di `drink-regia`
   **(utente)**.
3. **L'account di Flavio nella Tana:** `node scripts/titolare-locale.mjs
   --project tana-drink --email <email di Flavio>`, senza `--applica`.
   Deve risultare admin con l'email verificata. Se non lo è, lo si
   sistema con lo script **(utente)**.
4. **La regia, nel backoffice di produzione:**
   - si apre «Locale esistente» e si inseriscono:
     - il nome;
     - lo slug, per esempio `tana-del-coniglio`;
     - **la stessa email**;
     - il progetto `tana-drink`;
     - l'indirizzo dell'app;
     - «interna».
   - Flavio entra nella regia con «Password dimenticata?», oppure con
     Google se la sua email è Gmail.
5. **I permessi della regia sulla Tana** **(utente)**. Vanno all'account
   delle Functions di `drink-regia`. Quelli dati il 02/11 erano per la regia
   di test:
   - `roles/datastore.user` sul progetto `tana-drink`, per la licenza;
   - `roles/firebaseauth.viewer` sul progetto `tana-drink`, per trovare
     l'account di Flavio;
   - `roles/iam.serviceAccountTokenCreator` su
     `firebase-adminsdk-fbsvc@tana-drink.iam.gserviceaccount.com`, per
     firmare il suo accesso nella Tana;
   - lo stesso ruolo sull'account stesso, in `drink-regia`, per il ritorno
     alla regia.
6. **La licenza dalla regia:**
   - si applica il codice `TANA-100`;
   - in «Pubblicazione e licenza…» si sceglie «La licenza la scrive la
     regia».

   Da qui la licenza della Tana ha `regia_url`, e l'app mostra i tasti verso
   la regia. Prima la Tana non li mostra, ed è giusto così.
7. **Le email** **(utente)**: si crea l'account Resend col dominio
   verificato e si installa l'estensione Trigger Email su `drink-regia`. La
   regia scrive a `clienti/{uid}.email` attraverso la coda `mail`:
   - gli avvisi sul servizio (pagamenti, licenza, aggiornamenti) partono
     così;
   - le comunicazioni promozionali richiedono il consenso di Flavio, perché
     un locale registrato a mano nasce con `marketing: false`.
8. **La prova:**
   - dalla regia, «Apri la tua app»: Flavio entra nella Tana da admin;
   - dalla Tana, «Area clienti»: torna nella regia già entrato.

   Si prova prima tutto su `tana-drink-test` con `drink-regia-test`.

## Fuori da questa richiesta

L'identità unica vera, un solo account per regia e banco (Identity
Platform), resta un lavoro futuro e si appoggerà a questo scambio.
