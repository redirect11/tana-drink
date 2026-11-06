# I temi su misura dalla regia, e la struttura del menù (REQ-MENU-030)

Richiesta della regia (drink-regia, REQ-FLOTTA-040, `docs/temi-su-misura.md`),
06/11/2026. Scritta dalla sessione della regia, da lavorare qui.

## La decisione dell'utente

> «Stavamo pensando di aggiungere la possibilità di ricreare la pagina del
> menu e le sue sezioni utilizzando un output di Canva. Vorrei un servizio
> premium che mi consente di caricare un mockup di un tema fatto con Canva
> e, se il cassetto AI ha dei crediti, creare il tema da agganciare al menu
> e inserirlo tra i temi custom del gestore del bar. Altro servizio è la
> creazione da parte nostra di temi che possiamo fare ad hoc su richiesta.
> […] Dovremmo fare in modo che si possa scegliere tra varie strutture di
> menu (ad esempio tutto in una pagina, una pagina per categoria o una per
> macro categoria).»

## Cosa fa la regia (fatto il 06/11/2026)

- Il titolare, dalla sua dashboard, carica il mockup (immagine o PDF da
  Canva), sceglie la struttura del menù e, col credito AI del locale, il
  modello ne ricava un tema; la regia lo controlla come ogni tema del
  catalogo (stesse regole di `leggiTema`, più il contrasto) e lo mette fra i
  temi del locale. Oppure chiede un tema fatto dal fornitore, che l'admin
  scrive dal backoffice.
- **I temi su misura arrivano all'app con la licenza**, in una voce nuova
  del contratto: `licenza.temi_su_misura`. Nessuna chiamata nuova verso la
  regia, nessun file.

## Il contratto: `licenza.temi_su_misura`

```js
licenza/attuale = {
  …,
  temi: ['notte'],
  temi_su_misura: [
    {
      id: 'su-misura-mhz3k1a2',
      nome: 'Bosco',
      descrizione: 'Verde profondo e oro.',
      prezzo: 0,
      tavolozza: { base: 'tana-scuro', colori: { '--bg': '#10201a', /* …i sette */ } },
      stile: 'deco',
      ricetta: { versione: 1, caratteri: { … }, titoli: { … }, intestazione: 'filetto',
                 voce: { … }, cornice: 'sottile', angoli: 'vivi', sfondo: 'carta',
                 impaginazione: 'per-categoria' },
    },
  ],
  …
}
```

- Ogni voce è **lo stesso oggetto del catalogo** (`docs/marketplace-temi.md`):
  `leggiTema` la accetta com'è. Solo i pubblicati e validi; `[]` se il locale
  non ne ha; la voce può mancare nelle licenze scritte prima del 06/11/2026
  (vale `[]`).
- **`ricetta`**, facoltativa: la ricetta di uno stile a ricetta
  (`docs/stili-a-ricetta.md`, REQ-MENU-031: scritta come REQ-MENU-024,
  rinumerata perché quell'id l'aveva già preso «Giornale»), **intera**: la regia riempie
  i valori che la ricetta non diceva, l'app non indovina niente. Con la
  ricetta il tema si disegna col motore; senza motore, o senza ricetta,
  con lo `stile` (uno di quelli dell'app, mai un esclusivo).
- **`impaginazione`** è una dimensione nuova della ricetta (vedi sotto).
- `stile` è lo stile dell'app più vicino: la regia non scrive mai `notte` o
  `meraviglie` in un tema su misura.

## Cosa serve nell'app

### 1. «I tuoi temi» nel marketplace

Nel Marketplace, una sezione **«I tuoi temi»** (prima di «Temi», o accanto):
i temi di `licenza.temi_su_misura`, letti da `licenzaDi(settings)` come
`temi` (REQ-LIC-010), con la vetrina, «Prova sul menù», «Installa» e «Usa»
come quelli del catalogo. Installato, il tema ha la sua copia in
`temi_installati` come gli altri: un tema che sparisce dalla licenza (il
titolare lo ha tolto dalla regia) resta installato e in uso, ma non si
reinstalla, e la sezione lo dice.

Un tema con `ricetta` si disegna col motore degli stili a ricetta: si
registra uno stile a ricetta con **l'id del tema** e quella ricetta, e «Usa»
scrive `stile_menu` con quell'id (lo stile sta nella copia installata del
tema, non nel catalogo). Senza motore, `stile`.

### 2. `impaginazione` nel motore delle ricette

| Valore | Cosa disegna l'app |
|---|---|
| `unica` | il menù di sempre, tutto in una pagina (il valore se manca) |
| `per-categoria` | una pagina per sezione del menù dei clienti, con le schede fisse in alto per passare (la forma di REQ-MENU-025 con la struttura personalizzata, portata a pagine) |
| `per-macro-categoria` | una pagina per gruppo di sezioni (punto 3); senza gruppi scritti, come `per-categoria` |

Gli Special e i tasti del menù restano quelli del contratto degli stili
strutturati (REQ-MENU-028): ogni voce col suo prezzo, i suoi tasti, «riduci
movimento» rispettato.

### 3. Le macro categorie nella struttura del menù dei clienti

Un livello sopra le sezioni (REQ-MENU-025; è anche quello che serve
all'idea del mazzo di carte, REQ-MENU-029): **`carta_sezioni.gruppo`**
(nome e ordine), scritto dall'editor «Menù dei clienti» (una sezione si
mette in un gruppo con una tendina; un gruppo nuovo si scrive lì). Senza
gruppi non cambia niente: i menù di oggi restano com'erano.

### 4. Niente altro

Nessuna chiamata nuova verso la regia: tutto arriva con la licenza. Il
mockup lo carica il titolare dalla regia, non dall'app (il giorno che si
vorrà offrirlo dal marketplace, la regia apre la richiesta `tema` anche
alle installazioni).

## Cosa c'è nell'app (06/11/2026)

- **«⭐ I tuoi temi»** nel Marketplace, prima di «Temi», solo se la licenza
  porta almeno un tema su misura o ne resta uno installato. Un tema con uno
  stile esclusivo (`notte`, `meraviglie`) o sconosciuto si scarta. La copia
  installata in `temi_installati` tiene `su_misura: true` e la `ricetta`.
  Uno ritirato dalla licenza resta installato e in uso, e la scheda dice
  che, disinstallato, non si reinstalla.
- **`carta_sezioni.gruppo`**: una stringa (al massimo 40 caratteri) o
  `null`. L'ordine dei gruppi è quello della loro prima sezione: nessun
  secondo ordine da tenere d'accordo col primo. Nell'editor «Menù dei
  clienti» è una casella con le proposte dei gruppi già scritti.
- **Con la ricetta il tema si disegna col motore** (REQ-MENU-031): è uno
  stile a ricetta con l'id del tema, e «Usa» scrive quell'id in
  `stile_menu`. Una ricetta che l'app non sa disegnare (un valore che non
  conosce) si scarta, e il tema si disegna col suo `stile`.
- **`impaginazione`** è quella della ricetta dello stile in vista. Vale
  per i clienti (chi lavora ordina dal menù intero) e fuori dalla pagina
  Special. Le schede in alto diventano tasti che cambiano pagina; una
  sezione senza gruppo fa pagina da sé.
- **Ancora no**: le pagine negli stili strutturati («Giornale» riceve il
  menù intero: non è a ricetta).

## Come si prova

Sul test, con la licenza scritta dalla regia: un tema su misura fatto dalla
regia di test compare in «I tuoi temi», si prova e si usa; con la ricetta
si disegna col motore, e `impaginazione: 'per-categoria'` fa le pagine.
Sulla Tana, che ha la licenza dal deploy, `temi_su_misura` non c'è e la
sezione non compare.
