# Richieste della regia del 13/11/2026

Dalla sessione della regia (drink-regia), con le decisioni prese da
Daniele in chat il 13/11/2026. Il contratto vero sta in drink-regia,
`docs/handover.md` §7: qui c'è quello che serve all'app. Requisiti:
REQ-AI-008 (credito, ricarica, chat) e REQ-LIC-019 (sospensione per
pagamento).

## 1. Il credito AI: si può ricaricare, e dove (REQ-AI-008)

**Già pubblicato sul test** (drink-regia REQ-FLOTTA-091, PR #229, tag
`v0.3.0-beta.25`). La risposta 200 di `{ tipo: 'credito' }` porta due
campi in più:

| Campo | Valore |
|---|---|
| `ricaricabile` | `true` se il titolare può comprare credito dal sito adesso: pagamenti online accesi, sito aperto, locale non interno |
| `ricarica_url` | con `true`: `<origine della regia>/dashboard/credito-ai`, la sezione «Credito AI» dell'area del titolare; con `false`: `null` |

Con `ricaricabile: false` l'app dice di rivolgersi all'assistenza invece
di mandare al sito: è la richiesta partita da qui. La Tana è un locale
interno, quindi per lei vale sempre `false`, perché il credito lo
ricarichiamo noi.

## 2. Il credito non va mai sotto zero (REQ-AI-008)

**In lavorazione nella regia** (drink-regia REQ-FLOTTA-093). Daniele:
lo sforamento «Non deve mai succedere». Prima di ogni richiesta la regia
conta i token esatti e mette da parte il costo massimo. Se il credito
non basta risponde `402 credito`, come oggi. Per l'app cambia poco:

- `credito_eur` non sarà mai negativo;
- una fattura o un tema di cui la regia non riesce a misurare il costo
  riceve `503` (codice `servizio`): «riprova tra poco», come gli altri
  503.

## 3. La chat (REQ-AI-008, per REQ-AI-006)

**Specificata nella regia, non ancora implementata** (drink-regia
REQ-FLOTTA-094, issue #232). Il contratto concordato resta valido.
Daniele ha deciso in più:

- **Modello**: Sonnet per tutte le richieste AI. Il modello di ogni tipo
  lo sceglie l'admin dal backoffice della regia; l'app non deve saperlo.
- **Limiti**: li decide l'admin nel backoffice. Valori iniziali:
  risposta 4.000 token, conversazione 50.000, 5 strumenti per messaggio,
  righe 5/20/15.
- **`limiti_strumenti`** arriva in ogni risposta 200 della chat e dice
  quante righe restituire per `giacenza`, `vendite` e `cerca_prodotti`.
  L'app li applica quando esegue gli strumenti, al posto di valori
  scritti nel codice. Oggi `interpreta` (`functions/lib/ai-service.js`)
  scarta il campo: va letto.
- **`409 { codice: 'troppo-lunga' }`**: la conversazione ha superato il
  limite. È diverso da `409 { codice: 'versione' }`. Tutti e due aprono
  una conversazione nuova, ma il messaggio a schermo deve dire il motivo
  giusto. Oggi `interpreta` tratta ogni 409 come «versione».
- **`503`** anche quando la regia non riesce a misurare il costo della
  conversazione: «riprova tra poco».

## 4. La sospensione per pagamento arriva fuori servizio (REQ-LIC-019)

**In lavorazione nella regia** (drink-regia REQ-FLOTTA-095, issue #233).
Cambia una premessa di REQ-LIC-018, cioè «il servizio si sospende subito,
anche a metà serata». Daniele, 13/11/2026: «Decidiamo la sospensione per
Stripe fuori dall'orario di servizio quindi di sicuro non subito».

- Alla registrazione il titolare indica gli **orari di servizio**, uno
  per giorno. Dopo una settimana cambiano solo con l'approvazione
  dell'admin. Stanno nella regia, non nella licenza.
- Lo stato `sospesa` (o `chiusa`) **per pagamento** la regia lo scrive
  alla stessa ora del giorno in cui l'abbonamento è stato attivato. Se
  quell'ora cade in servizio, lo scrive alla chiusura. `valida_fino` è
  quello stesso momento. Per un locale aperto 24 ore può cadere in
  servizio, e il titolare lo sa dalla registrazione.
- Le sospensioni e le chiusure **dell'admin** restano immediate, anche a
  metà serata.
- Daniele: «L'app che si carica ed è sospesa si sospende subito». E
  ancora: «Si ferma tutto così com'è. Alla riattivazione del servizio non
  si è mosso nulla e così deve essere».

Per l'app:

1. Lo stato `sospesa` si applica **appena si legge**, all'avvio e in
   servizio. I terminali ascoltano già la licenza in tempo reale.
2. **Si ferma tutto così com'è**: niente conti chiusi o annullati,
   niente ordini spostati. Alla riattivazione tutto è dove era.
3. **Le scritture fatte prima della sospensione e ancora in coda** (un
   terminale senza rete) **non si devono perdere**. Se le regole le
   rifiutano quando arrivano, Firestore le scarta. Va scelto come
   tenerle: accettarle se fatte prima dell'ora della sospensione, oppure
   farle tenere dall'app fino alla riattivazione.
4. Il taglio della giornata non è più l'ora della sospensione per
   pagamento. Resta l'ora delle **riduzioni** della licenza
   (REQ-FLOTTA-024 della regia).
