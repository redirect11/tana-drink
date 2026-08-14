# TODO — punti aperti (13–14 agosto 2026)

Cose dette e non ancora fatte, in ordine di urgenza. I bug vivono in
[requirements/bugs.yaml](requirements/bugs.yaml) e da lì diventano issue;
qui c'è il quadro completo, bug e non solo.

## Bug da sistemare (dettaglio in bugs.yaml)

- [ ] **BUG-001** — In produzione l'admin vede «Missing or insufficient
      permissions» sulla coda. Analisi fatta: il deny è su una collection
      pubblica, quindi il sospetto n.1 è App Check/reCAPTCHA (incidente già
      documentato negli script), poi regole live diverse dal repo, poi il
      banner che non si azzera mai. **Prossimo passo — verifiche in sola
      lettura:**
      - `node scripts/diagnostica-permessi.js --project tana-drink --prova --ruolo admin`
        (non passa da App Check: se qui è verde e il browser no, è App Check)
      - `node scripts/appcheck.js --project tana-drink` e `node scripts/recaptcha-domini.js`
      - confronto regole live in console ↔ repo
      - capire se succede su tutti i dispositivi o solo su uno
- [ ] **BUG-002** — L'ordine annullato si apre vuoto (0 € e nessun item):
      deve restare la fotografia di prima dell'annullamento; annullare
      neutralizza magazzino e guadagno, non svuota il conto.
- [ ] **BUG-003** — Notifiche di annullamento allo staff col testo del
      cliente: per admin/bartender/staff testo dedicato, niente push sul
      dispositivo, solo lista notifiche in-app (annullati e ricevuti).
- [ ] **BUG-004** — Subtotale di riga fermo al prezzo unitario (3× Tennent's
      → 4,00 €); e item da mostrare come righe separate, non aggregati.
      Da chiarire in fase di fix se servono entrambe le cose.
- [ ] **BUG-005** — Le note degli item non si vedono nelle code a schermo
      (solo dettaglio POS e comanda stampata): vanno sotto la riga anche
      nelle card di BartenderPage e ServiceQueue.

## In sospeso adesso

- [ ] **Commit del branch `feature/bugs-yaml`** (bugs.yaml + script issue +
      workflow): pronto nel worktree, aspetta il via libera.
- [ ] **Creazione delle issue GitHub dei 5 bug**: o subito con lo script
      (`GITHUB_TOKEN` da `gh auth token`), o automatica al merge su `main`.
      Dry-run già verificato: 10 voci, i 5 requisiti todo esistenti
      verranno saltati.

## Piano sbrandizzazione ([docs/piano-sbrandizzazione.md](docs/piano-sbrandizzazione.md))

- [ ] **Fase 0 (candidata release 1.5):** requisiti `REQ-VENUE-*` nel yaml,
      test-guardia anti-brand con whitelist a cricchetto, blocco `venue` in
      `settings/bar` + migrazione coi dati della Tana.
- [ ] **Pulizia segreti dal repo** (da fare comunque, a prescindere):
      API key di produzione in `scripts/diagnostica-permessi.js:32`,
      client id/secret in `scripts/set-role.js` e `scripts/lib-firestore.js`.
- [ ] **Segreti di produzione nell'environment `production`** con deployment
      branch = `main` (si sposa con REQ-SIC-003, già nel registro): dieci
      minuti nel browser, ma da fare con attenzione — un nome sbagliato
      significa deploy di produzione rotto al primo giro, e ce ne si accorge
      quando non pubblica più niente.
- [ ] **Accendere l'export fatturazione Google Cloud → BigQuery** sull'account
      di fatturazione: gratis e **non retroattivo** — prima si accende,
      prima esistono i dati per il futuro backoffice (Fase 6).
- [ ] Decidere i nomi: prodotto/dominio, progetto demo (`drink-demo`?),
      progetto regia (`drink-fleet`?).

## Metodo e strumenti

- [ ] **Skill del metodo in `.claude/skills/`** (poi plugin per altri
      progetti): `requisito`, `release`, `rilascio`, `issue` — da rodare
      qui sulla Tana prima di estrarle.
- [ ] **Coprire i 15 requisiti ⚠️** (implementati senza test), concentrati
      su stampa, gruppi e vista cliente — candidato naturale per un
      workflow multi-agente (un agente per requisito + verificatore).
      Nel piano è un prerequisito per vendere quelle aree come premium.
- [ ] **REQ-STAMPA-003** (certificato stampante che scade): todo storico,
      diventa urgente col primo cliente esterno con stampante.
- [ ] Valutare l'audit requisiti↔test↔codice via workflow (i test citati
      dimostrano davvero ciò che il requisito racconta?).

## Piccole cose

- [ ] Eventuale `.gitignore` per `.claude/` nella cartella principale
      (ora compare in `git status` per via dei worktree).
