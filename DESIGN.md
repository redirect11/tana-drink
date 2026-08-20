# DESIGN.md — Tana Drink, gestionale

Come deve apparire e comportarsi l'interfaccia. Chi tocca la UI — persona
o agente — segue questo file; i valori operativi vivono in
`src/lib/themes.js` e `src/index.css`, e questo documento non deve mai
contraddirli: se cambiano i token, si aggiorna anche qui, nello stesso
commit.

## Tema e atmosfera

Strumento di lavoro, non vetrina: l'app si usa di sera, di fretta, con il
locale pieno. Il gestionale è **sobrio, scuro e ad alta leggibilità**, con
un calore misurato: la personalità sta negli accenti e nei dettagli, mai
al costo della velocità di lettura. La vetrina cliente (menù, landing)
mantiene il registro speakeasy; questo documento riguarda soprattutto il
lato di chi lavora.

Il preset di riferimento per il gestionale è **Catppuccin** — palette
ufficiale — sopra la struttura a tre livelli di profondità che l'app già
usa: **Mocha** per lo scuro, **Latte** per il chiaro, stessi ruoli e
stessa gerarchia. Il preset storico `tana-scuro` resta disponibile e
predefinito finché il locale non sceglie diversamente dalle impostazioni.

## Palette (ruoli semantici)

I temi agiscono su 7 variabili CSS (`:root`), risolte da
`src/lib/themes.js`. Ruoli, non colori a caso:

| Variabile | Ruolo | Mocha (scuro) | Latte (chiaro) | Tana scuro |
|---|---|---|---|---|
| `--bg` | fondale pagina (il livello di base) | `#11111b` crust | `#dce0e8` crust | `#0e0e15` |
| `--bg-2` | fondale secondario, topbar | `#181825` mantle | `#e6e9ef` mantle | `#15151f` |
| `--card` | superfici: card, drawer, dialoghi | `#1e1e2e` base | `#eff1f5` base | `#1a1a26` |
| `--accent` | identità e stati attivi (chip, evidenze) | `#cba6f7` mauve | `#8839ef` mauve | `#e52e71` |
| `--accent-2` | azione: bottoni primari, link, gradienti | `#fab387` peach | `#fe640b` peach | `#f5b94a` |
| `--text` | testo primario | `#cdd6f4` text | `#4c4f69` text | `#f5f5f7` |
| `--muted` | testo secondario, mai per info critiche | `#a6adc8` subtext0 | `#6c6f85` subtext0 | `#9b9ba8` |

Nota sulla coppia Mocha/Latte: i ruoli non cambiano, cambia la forza —
sul chiaro gli accenti sono più profondi perché il contrasto va
conquistato, non regalato.

C'è un ottavo token derivato, `--btn`: il **colore-azione dei bottoni
primari**. Di default segue `--accent-2`; i preset chiari lo dichiarano a
parte, perché lì l'accento-2 è scuro per reggere i link sul fondo chiaro
e come fondo di un bottone diventerebbe una macchia (visto succedere: il
«+» e «Pagamento» color senape). Regola: il fondo di un bottone primario
è sempre un tono chiaro col testo scuro `#1c1305`.

### Il gradiente dell'azione: due token, un colore solo

Il fondo dei bottoni primari è un gradiente fra **`--btn-1`** e
**`--btn-2`**. Di partenza sono l'oro di casa — `#f7c45e → #e8a32e`,
lo stesso che è in produzione — e sono i due token che usa **anche il tab
acceso** (`.chip.active`). Classi diverse, colore uno solo: erano due
gradienti scritti in due posti, e toccandone uno il «+» della coda e
«Pagamento» restavano indietro rispetto a «In corso», con la differenza
bene in vista.

Regole:

- **I temi di casa non toccano quei due token.** `chiaro` e `crema` sono
  la stessa Tana con un altro contorno: i tasti restano l'oro di sempre.
  Un tasto che cambia colore col tema di contorno si riconosce meno, e il
  «+» è quello che si prende di corsa con le mani occupate.
- **Un tema di un'altra famiglia** (Catppuccin, Pico) dichiara `--btn` e
  i due estremi si ricalcolano da lì: schiarito da una parte, scaldato
  dall'altra. Tornando a un tema di casa il ricalcolo **si toglie**, se no
  i bottoni si tengono il colore del preset precedente.
- **Non si derivano i due estremi dall'accento con mescole "a occhio".**
  Provato: il risultato era più smorto dell'originale (`#e8a32e` →
  `#d5a03f`) e al banco si vedeva. Se un tema vuole bottoni suoi, li
  dichiara.

### Un tema porta anche le forme

Un tema non è una tavolozza. Pico e Catppuccin hanno un **modo di fare le
cose** — quanto sono tondi gli angoli, se un bottone è una campitura piatta
o un gradiente, se le superfici hanno un'ombra — e prendendone solo i
colori restava tutto con la faccia della Tana ridipinta: si sceglieva
«Pico» e si trovavano i nostri tasti dorati con gli angoli morbidi.

Le forme stanno in `FORME` (`src/lib/themes.js`), tre famiglie, e ogni
preset dichiara la sua con `forme:`. Sono i token che si vedono
da lontano: `--raggio-card`, `--raggio-btn`, `--raggio-pill`,
`--raggio-campo`, `--btn-bg`, `--ombra-btn`, `--ombra-card`,
`--forma-titoli`, `--segno-prodotto`.

| Famiglia | Angoli | Tasti | Ombre | Titoli |
|---|---|---|---|---|
| `tana` | 16/12px, pillole tonde | gradiente | alone sotto il tasto | serif Playfair |
| `catppuccin` | 10/8px | campitura piatta | ombra tenue | come il testo |
| `pico` | 4px ovunque | campitura piatta | nessuna | come il testo |

Il segno del colore sulle card (`--segno-prodotto`) è `nastro` per `tana`,
`pastiglia` per `catppuccin`, `pallino` per `pico`. `applyTheme` lo scrive anche come
`data-segno` sul documento, perché una variabile CSS non basta a scegliere
fra due geometrie: serve un aggancio nel selettore.

Regole:

- **Ogni famiglia dichiara TUTTI i token.** `applyTheme` scrive
  sullo stile di `:root`, e un token lasciato indietro resterebbe
  appiccicato al tema successivo — è già successo coi bottoni, che
  restavano dorati cambiando preset.
- **La personalizzazione tocca solo i colori.** I campi in Impostazioni
  sono i sette di `THEME_FIELDS`: le forme vengono dal preset, non si
  regolano a mano.
- **Il testo sui tasti è `--btn-ink`**, deciso dalla luminanza del colore
  d'azione: scuro sui tasti chiari, bianco su quelli scuri. Era cablato
  `#1c1305` — nato per l'oro — e su un tema con l'azione scura sarebbe
  stato nero su nero.
- **Il dorato non si riscrive a mano nel foglio di stile.** C'era in una
  dozzina di posti (il tab acceso, il «+», i tasti dei pannelli) e quelli
  ignoravano il tema: c'è un test in `tests/unit/css.test.js` che boccia
  `#f7c45e`, `#e8a32e` e `#1c1305` fuori dalla dichiarazione dei token.

Oltre alla coppia Catppuccin esiste la coppia **Pico** (`pico-scuro` /
`pico-chiaro`): la palette di Pico CSS v2 — ardesia blu, azzurro tecnico
`#01aaff`/`#0172ad`, look "documento" sul chiaro — adottata dentro i
nostri token. Dei design system esterni si importano i **colori nei
preset**, mai i fogli di stile: un CSS estraneo si sovrapporrebbe al
nostro e i guardrail smetterebbero di valere.

Colori di stato (fissi, fuori tema): `--ok #2ecc71`, `--warn #f39c12`;
gli stati degli ordini hanno le loro pill (ricevuto/in preparazione/
pronto/ritirato/pagato/annullato) e i loro colori non si riciclano per
altro. Il rosso è solo per annullare/errore.

Regole:
- La profondità si esprime con i tre livelli `--bg → --bg-2 → --card`,
  non con ombre pesanti.
- `--accent-2` è "si può agire qui"; `--accent` è "questo è
  attivo/selezionato". Non invertirli.
- Testo su `--accent-2` (bottoni): scuro `#1c1305`, mai bianco — gli
  accenti-2 dei preset sono caldi e chiari.

## Tipografia

- Corpo: `system-ui` stack — il testo operativo non ha font di fantasia.
- Titoli (`h1–h3`): serif `Playfair Display` — è la firma del prodotto,
  usata con parsimonia; nel gestionale i titoli sono pochi per scelta
  (il titolo di sezione sta nella topbar, non in pagina).
- Numeri che contano (numero ordine, totali): grandi e in evidenza
  (`.bignum`, `.price`); un bartender legge il numero a un metro.
- Niente maiuscolo urlato, niente corsivi decorativi nel gestionale.

## Componenti

- **Bottoni** (`.btn`): gradiente derivato da `--accent-2` (135°, dal
  tono chiaro al tono scuro), testo scuro, raggio 12px, `min-height`
  generoso. Varianti: `secondary` (velo chiaro su card) e `ghost`
  (bordo, trasparente) per azioni non primarie. Un'azione primaria per
  schermata, non tre.
- **Card ordine**: bordo colorato per stato, contenuto essenziale
  (numero, cliente/tavolo, righe, totale). Le note (📝 conto, ↳ riga)
  si mostrano sempre dove si prepara o si serve.
- **Le corsie di stato** (una vista della coda): colonne uguali, in testa il
  nome dello stato col conteggio e il totale, sotto un filo di 2px del colore
  dello stato — gli stessi tre della striscia sulle card (`#f39c12`,
  `#3498db`, `#2ecc71`) più `--accent-2` per l'incasso. La card è una `card
  order-card` compatta con **un** tasto (`btn small block`, mai sotto i 44px):
  toccando il tasto si avanza, toccando la card si apre il conto. Le colonne
  ci sono tutte anche vuote: la loro posizione si impara a memoria.
  **Sul telefono si impilano**: una sotto l'altra, ognuna con la sua testata,
  e si scorre in verticale. A dirlo è la larghezza della **lavagna**
  (`container: corsie / inline-size` su `.queue-board.corsie-board`): una
  colonna sola fino a 560px, due fino a 900px, tutte oltre. Non la finestra —
  col menu agganciato la lavagna ha 200-250px in meno — e non il numero di
  corsie accese.
- **Una comanda in mano, e le colonne che rispondono.** Nella lavagna del
  banco una card si prende con una pressione lunga e si lascia in un'altra
  colonna (REQ-CODA-007). Mentre è in mano: la card di partenza resta al suo
  posto smorzata (`opacity: .35`), quella che segue il dito è un'altra
  (`.corsia-in-volo`, ombra e un grado di rotazione) e galleggia sopra tutto
  — dentro la colonna sarebbe ritagliata. Le colonne dicono PRIMA se
  accettano: chi accoglie prende un tratteggio `--accent-2` («si può agire
  qui», il suo ruolo), che diventa pieno sotto il dito; chi rifiuta sbiadisce
  e sotto il dito prende un contorno `--accent`. Il rosso resta per
  l'errore vero, e qui non c'è nessun errore: c'è un posto dove non si
  lascia.
- **Uno stato spento ha comunque la sua striscia.** Servito, chiuso,
  annullato, in invio: la striscia a sinistra usa `--strip-spenta` (che
  segue `--muted`, quindi il tema), non un bianco o un nero trasparente.
  Un rgba bianco nasce per il fondo scuro e sul tema chiaro sparisce — e
  una striscia invisibile è una card senza stato, proprio quando se ne
  stanno scorrendo trenta uguali. Più sobria degli stati vivi (quelli sono
  il lavoro di adesso e restano i più forti), ma **presente**.
- **Quando il contenuto va su due colonne lo decide il contenitore**, non
  la finestra: `container-type: inline-size` sul blocco e soglia in
  `@container`. Con sei corsie accese la finestra è larga e la card è una
  striscia: una media query sulla finestra spezzava i nomi e mandava i
  prezzi fuori dal riquadro. Il conteggio delle righe può dire se
  *conviene*, mai se *ci sta*.
- **Le card di una griglia hanno tutte lo stesso vestito** — magazzino,
  menù e griglia del conto. Due segni, sempre gli stessi due: la **striscia
  a sinistra** (4px) dice come sta la cosa; il **colore** (lo stato delle
  scorte in magazzino, il colore che il prodotto ha al banco nel menù e nel
  POS) sta nell'angolo in alto. Nel menù e nel POS quel segno è anche il
  tasto che apre la tavolozza.
  **Che forma abbia quel segno lo decide il tema** (`--segno-prodotto`),
  e ogni famiglia ha il suo: **nastro** d'angolo per la Tana, largo e
  squillante — è un locale, non un foglio di calcolo; **pastiglia**
  (quadratino stondato) per Catppuccin, che è il suo modo di fare gli
  angoli; **pallino** per Pico, il look documento. Gli ultimi due stanno
  nell'angolo in alto: a destra sulle card del menù, come lo stato delle
  scorte in magazzino, e **a sinistra sulle tile del conto**, dove a destra
  c'è la stella dei preferiti — un tasto, che non si copre.
  In magazzino è sempre un pallino: lì il segno è uno STATO, non un colore
  scelto a mano.
- **Il colore del conto è un pallino, e lo stato vince sempre.** Un conto
  può avere un colore suo (campo `colore` sul documento, tavolozza delle
  categorie): serve a riconoscere che tre comande finite in tre colonne
  diverse sono lo stesso tavolo. Sta in un **pallino da 10px accanto al
  numero**, sulla card del conto e su tutte le card delle sue comande —
  mai un fondo pieno sotto il testo (dodici tinte sature diventano
  illeggibili su un tema o sull'altro) e **mai la striscia a sinistra**:
  quella dice a che punto sta il lavoro, ed è quello che si legge di
  corsa. Due segni, due domande. Il colore non informa mai da solo: il
  numero del conto gli sta accanto. Le regole in `src/lib/coloriConto.js`.
- **Chip e filtri**: pillole compatte, stato attivo con `--accent`;
  i filtri della coda stanno su una riga sola.
- **Toast e banner**: brevi, in linguaggio comune, mai colpevolizzanti.

## Layout e spaziatura

- Il gestionale usa **tutta la larghezza** (niente colonna centrale);
  solo testo lungo e moduli si stringono a ~900px.
- Raggio superfici 16px (`--raggio-card`), bottoni 12px
  (`--raggio-btn`) — sui temi Pico e Catppuccin li decide la famiglia di
  forme, vedi sopra.
- Aria tra i blocchi funzionali (i chip non devono sembrare la prima
  riga delle card); dentro le card la densità è alta: è un POS, i dati
  contano più del bianco.
- **Le pastiglie** (`.chip`: filtri della coda, periodi, sezioni) misurano
  `font-size: 0.95rem`, `padding: 8px 14px`, `min-height: 40px`. Sono
  numeri tarati **a zoom 100**: prima erano stati guardati col browser al
  110 e alla dimensione vera risultavano piccoli, testo e bersaglio.
  L'altezza minima è esplicita e non lasciata all'imbottitura, o balla da
  una pastiglia all'altra a seconda di quanto è lungo il testo.
- **Le pastiglie della fila dei filtri della coda** (`.chips-filtri .chip`)
  stanno un filo sotto: `min-height: var(--tastino-alto)` (34px),
  `padding: 5px 11px`, `font-size: 0.86rem`. L'ha chiesto l'utente — «e i
  tasti dei filtri, tutti, devono essere leggermente più piccoli»
  (20/08/2026) — e in griglia sono sei o sette: alla misura piena si
  mangiavano la riga, e dev'esserne **una sola**. Alla stessa altezza
  stanno i due tasti che governano la fila (`.coda-tastino`: «▾ Filtri» e
  il verso della coda), che sono bottoni bordati ma bassi — sono la stessa
  specie di comando e in riga si devono somigliare. `--tastino-alto` è la
  misura sola da cui scendono tutti.
- **Le pastiglie in gruppo** (`.chip-gruppo`) si toccano: bordo condiviso
  (`margin-left: -1px`), angoli tondi solo agli estremi. Vuol dire «questi
  sono una cosa sola» e si usa **solo** dove è vero — in coda: la colonna
  del pronto col suo tastino ✂️/🔗, che la apre in «Da servire» e «Da
  ritirare» e la richiude. Restano **bottoni distinti** (ognuno il suo,
  ognuno il suo nome per lo screen reader): il gruppo unisce gli occhi,
  non i mestieri. Il tastino di un gruppo (`.chip-taglio`) è un segno solo
  e sta stretto: attorno a un carattere una pastiglia larga come le altre
  è tutta aria, e in una fila di sei o sette chip quell'aria è una riga in
  più.
- **La pastiglia minuta** (`.chip.mini`: le unità dentro una riga di testo,
  come «Al pz · pz · cl · ml» nella scheda di un prodotto) resta a
  `min-height: 22px` e `0.68rem`. Non è un bersaglio da barra: sta dentro
  una riga, e con la misura piena mandava a capo l'ultima unità, che
  restava appesa da sola sotto il resto.
- La topbar è sticky, traslucida sul tema (`color-mix` su `--bg-2`),
  e rispetta le safe-area dei tablet.

## Profondità

Ombre morbide e rare (bottoni primari, drawer); il resto della gerarchia
la fanno i tre livelli di fondo. Su temi chiari le ombre si attenuano da
sole per contrasto: non aggiungerne di dedicate.

## Guardrail (non negoziabili, per qualsiasi tema)

1. **Si legge al buio e di fretta**: contrasto testo/fondo mai sotto la
   soglia di comodità; le informazioni critiche mai affidate solo a
   `--muted` o solo al colore.
2. **Si tocca col pollice**: bersagli ≥ 44px, azioni distruttive lontane
   da quelle frequenti. Le deroghe scritte sono due, e sono nello stesso
   posto: le **pastiglie** dei filtri stanno a 40px — sono secondarie e
   vivono in una riga che scorre, e a 44 quella riga diventa una fascia —
   e **dentro la fila dei filtri della coda** scendono a 34px, coi due
   tasti che la governano, perché l'ha chiesto l'utente e perché quella
   fila si tocca **quando si decide cosa guardare**, non con l'ordine in
   mano. Tutto il resto (tasti del conto, della card, della testata) resta
   ≥ 44px.
3. **Le parole sono da vassoio**: comuni, brevi, in italiano; nessun
   gergo tecnico; nessun messaggio che scarichi la colpa su chi legge.
4. **Niente aspetta la rete**: ogni interazione risponde subito; spinner
   e attese lunghe sono un difetto, non uno stato normale.
5. **Gli stati degli ordini non cambiano colore** tra un tema e l'altro:
   la memoria cromatica del banco vale più dell'estetica.
6. **Niente animazioni oltre i 200ms** nel gestionale; le transizioni
   sono feedback, non spettacolo.
7. **Ogni tema nuovo è un preset in `themes.js`**, mai colori sparsi nei
   componenti: se un colore non passa dalle 7 variabili (o dagli stati),
   è nel posto sbagliato.

## Breakpoint

Mobile-first; il gestionale vive soprattutto su tablet e telefono al
banco. La coda a griglia si riorganizza da sola; la barra mobile compare
sotto i ~720px; nessuna schermata richiede scroll orizzontale.

## Guida per gli agenti

Quando lavori sulla UI: usa le variabili, mai esadecimali nei componenti;
rispetta i ruoli di `--accent`/`--accent-2`; testa mentalmente ogni
schermata sul preset più chiaro e sul più scuro; se aggiungi un
componente, descrivilo qui. In dubbio tra bello e leggibile, vince
leggibile.
