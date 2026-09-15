# Il certificato della stampante, una volta per tutte

Questa è la procedura per togliere **per sempre** l'avviso di sicurezza che
costringe ad aprire Safari e accettare a mano il certificato della stampante
prima di poter stampare (REQ-STAMPA-003).

Si fa **una volta sola**, dal locale, con il portatile sulla stessa rete.
Dura una ventina di minuti.

---

## Perché succede, davvero

Non è il certificato che «scade ogni volta», ed è il motivo per cui finora
il problema è tornato: la causa è un'altra.

L'app è servita in HTTPS, quindi il browser pretende che anche la stampante
parli in sicuro (WSS, porta 8043). La stampante si presenta con un
certificato che si è fatto da sola. Fin qui è normale. Il guaio è che quel
certificato — così come esce di fabbrica — **non contiene l'indirizzo IP nel
campo SAN** (*Subject Alternative Name*).

Dal 2019 iOS e Safari guardano solo il SAN: il vecchio campo «Common Name»
da solo non basta più. Un certificato senza SAN non è valido per quell'IP
**qualunque cosa si faccia** — installarlo fra quelli attendibili non serve,
perché iOS lo rifiuta lo stesso. Da qui l'eccezione da rifare, e la
sensazione che scada di continuo.

La cura è in due mosse: **rigenerare** il certificato sulla stampante
mettendoci dentro l'indirizzo giusto, e poi **installarlo sull'iPad**
dichiarando che ci si fida.

---

## Prima di cominciare

Serve avere sottomano:

- il **portatile**, sulla stessa rete Wi-Fi della stampante (quella del
  locale, non l'ospite);
- l'**iPad del banco**;
- l'accesso al **router** del locale;
- il repo aggiornato sul portatile (`node` installato).

L'IP della stampante oggi in produzione è **192.168.1.4**, porta 8043. In
tutti i comandi qui sotto sostituisci l'indirizzo se nel frattempo è
cambiato.

---

## Passo 0 — Fissa l'IP sul router

**Questo passo non è facoltativo.** Il certificato varrà per un indirizzo
preciso: se domani il router ne assegna un altro alla stampante, il
certificato non combacia più e si ricomincia da capo.

1. Entra nel pannello del router (di solito `http://192.168.1.1`).
2. Cerca la sezione **DHCP** → *Prenotazione indirizzi* / *Address
   Reservation* / *Static DHCP* (il nome cambia da router a router).
3. Trova la stampante nell'elenco dei dispositivi collegati (si chiama
   `EPSON` seguito da sei cifre, oppure si riconosce dal MAC stampato
   sull'etichetta sotto la stampante).
4. **Prenota** per quel dispositivo l'indirizzo **192.168.1.4**.
5. Salva.

Da adesso quell'indirizzo è suo e non cambia più, nemmeno dopo un blackout.

---

## Passo 1 — Guarda che certificato c'è adesso

Dal portatile, nella cartella del progetto:

```sh
node scripts/certificato-stampante.js 192.168.1.4
```

Lo script legge il certificato **senza fidarsene** e stampa a chi è
intestato, fino a quando vale, per quali indirizzi vale e un verdetto.

Quello che conta è la riga `vale per:`

- se dice **`— NESSUN SAN —`**, oppure elenca nomi in cui **non** compare
  `IP Address:192.168.1.4` → prosegui col passo 2, il certificato va
  rigenerato;
- se `192.168.1.4` c'è già e la scadenza è lontana → **salta al passo 3**,
  il certificato va bene così e manca solo di installarlo.

Se lo script dice «non raggiungibile» o «nessuna risposta»: sei sulla rete
sbagliata, o la stampante è spenta, o l'IP non è quello.

---

## Passo 2 — Rigenera il certificato sulla stampante

1. Dal portatile apri **`http://192.168.1.4`** (in chiaro, senza la `s`).
2. Se chiede di autenticarsi: utente **`epson`**, password il **numero di
   serie** stampato sull'etichetta sotto la stampante. Sui firmware più
   vecchi la password può essere vuota o `epson`.
3. Vai nella sezione della **sicurezza** → **SSL/TLS** → **Certificato**
   (le diciture cambiano un po' da firmware a firmware: cerca
   *Authentication / Security* e dentro *Certificate* o *Self-signed
   certificate*).
4. Scegli **crea / aggiorna il certificato autofirmato**.
5. Compila così:
   - **Common Name**: `192.168.1.4` — esattamente l'indirizzo, niente
     `http://`, niente porta. I firmware recenti copiano il Common Name nel
     SAN, ed è tutto quello che serve. Se il modulo offre un campo apposta
     per il **SAN** (o *Alternative name*), scrivi lì `192.168.1.4`.
   - **Validità**: mettila lunga, il massimo che offre. Il certificato lo
     installi a mano sull'iPad, e per i certificati installati a mano iOS
     non applica il limite dei 398 giorni. Se dopo il passo 6 l'iPad
     continuasse a lamentarsi, torna qui e rifallo con **365 giorni**.
   - Gli altri campi (organizzazione, paese) sono liberi: `EFFEVI`, `IT`.
6. Salva. La stampante riavvia la parte di rete: **aspetta un minuto**.
7. Ricontrolla dal portatile:

   ```sh
   node scripts/certificato-stampante.js 192.168.1.4
   ```

   Adesso la riga `vale per:` deve contenere `IP Address:192.168.1.4` e il
   verdetto deve essere **`✔ VA BENE`**. Se non è così, non andare avanti:
   installarlo adesso non servirebbe a niente.

---

## Passo 3 — Scarica il certificato in un file

```sh
node scripts/certificato-stampante.js 192.168.1.4 --salva
```

Nella cartella del progetto compare **`stampante-192-168-1-4.cer`**.

---

## Passo 4 — Portalo sull'iPad

Dal portatile (Windows, quindi niente AirDrop) scegli la strada che
preferisci:

- **email**: mandati il file come allegato e aprilo dall'app Mail
  sull'iPad;
- **OneDrive / iCloud Drive**: mettilo in una cartella e aprilo dall'app
  File sull'iPad.

Sull'iPad **tocca il file**. Comparirà l'avviso «Profilo scaricato».
Il file è ora in attesa: se non lo installi entro qualche minuto scade e
va riaperto.

---

## Passo 5 — Installa il profilo

Sull'iPad:

1. **Impostazioni** → in cima compare **«Profilo scaricato»** → toccalo.
   (Se non c'è: Impostazioni → Generali → **VPN e gestione dispositivi**.)
2. **Installa** (in alto a destra).
3. Inserisci il **codice di sblocco** dell'iPad.
4. Compare un avviso che dice che il certificato non è verificato: è
   normale, è autofirmato. **Installa** ancora.
5. **Fine**.

---

## Passo 6 — Dichiara che ti fidi

**È il passo che si dimentica, ed è quello che fa funzionare tutto.**
Installare il certificato non basta: finché non attivi la fiducia, iOS lo
tiene lì e continua a mostrare l'avviso.

1. **Impostazioni** → **Generali** → **Info**.
2. In fondo alla pagina: **Impostazioni fiducia certificati**.
3. Sotto «Abilita fiducia completa per i certificati root» trovi il
   certificato della stampante (`192.168.1.4`): **attiva l'interruttore**.
4. Conferma.

---

## Passo 7 — Verifica

1. Su Safari nell'iPad apri **`https://192.168.1.4:8043`**. La pagina sarà
   vuota o darà un errore di protocollo — è normale, lì c'è un WebSocket,
   non un sito. Quello che conta è che **non compaia nessun avviso di
   sicurezza** e che accanto all'indirizzo ci sia il lucchetto chiuso.
2. Apri l'app → **Impostazioni** → **Stampante** → **Test stampa**. Deve
   uscire la carta.
3. Torna alla coda: il **pallino** in alto dev'essere verde.

Da adesso l'avviso non torna più: né dopo un aggiornamento dell'app, né
riavviando l'iPad, né cambiando serata.

---

## Cosa NON serve fare

**I telefoni della sala non vanno toccati.** In produzione la stampa della
sala è impostata su **rimbalzo**: chi prende l'ordine in sala non stampa
da sé, la comanda esce dal terminale del banco. L'unico dispositivo che
parla con la stampante è l'iPad del banco, ed è l'unico su cui installare
il certificato.

Se un domani si passa la sala a «stampa da sé», la stessa procedura dai
passi 4 a 7 va ripetuta su ogni telefono — e sugli Android il percorso è
diverso (Impostazioni → Sicurezza → Installa certificato → Certificato CA).

---

## Se qualcosa va storto

| Cosa vedi | Cosa vuol dire |
|---|---|
| Lo script dice «non raggiungibile» | Portatile su un'altra rete (ospite), stampante spenta, o IP sbagliato |
| Dopo il passo 2 il SAN è ancora vuoto | Il firmware è vecchio e non copia il Common Name nel SAN: cerca un campo SAN esplicito, o aggiorna il firmware della stampante |
| Il profilo si installa ma l'avviso resta | Manca il passo 6: la fiducia non è stata attivata |
| Fiducia attivata, ma l'avviso torna | Il certificato vale per un indirizzo diverso da quello che usa l'app: ricontrolla che in Impostazioni → Stampante ci sia esattamente `192.168.1.4` |
| Funzionava, poi ha smesso di colpo | L'IP della stampante è cambiato: manca il passo 0. Ricontrolla con lo script e rifai dal passo 2 |

Per capire **cosa è successo davvero al banco**, dalla 1.6.0 c'è il diario
della stampante sul server (REQ-STAMPA-019):

```sh
node scripts/diagnostica-stampante.js --project tana-drink --giorni 3
```

---

## Variante: il nome al posto dell'indirizzo

Le Epson TM-m30 si annunciano in rete con un nome Bonjour del tipo
**`EPSONxxxxxx.local`** (le sei cifre sono sull'etichetta sotto la
stampante). Usare quello al posto dell'IP ha un vantaggio: **anche se
l'indirizzo cambia, il nome continua a funzionare**.

Per farlo, al passo 2 metti nel Common Name `EPSONxxxxxx.local` invece
dell'IP, e nell'app scrivi lo stesso nome nel campo «IP stampante»
(lo accetta già, non è solo per i numeri). Il resto della procedura è
identico.

Due avvertenze: il nome si risolve solo se iPad e stampante sono sulla
**stessa rete** (Bonjour non attraversa le VLAN né il Wi-Fi ospiti), e gli
Android lo risolvono male o per niente. Anche scegliendo questa strada,
**fai comunque il passo 0**: costa cinque minuti e toglie una variabile.

---

## Quando va rifatto

- Quando il certificato **scade** (lo dice lo script: rilancialo ogni tanto).
- Se **cambia l'indirizzo** della stampante.
- Se si **sostituisce la stampante**.

In tutti gli altri casi — aggiornamenti dell'app compresi — non si tocca
niente.
