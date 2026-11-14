# Il sito del locale e il suo tema (REQ-MENU-044, UR-018)

> **Il contratto con la regia** è in drink-regia, [`docs/contratto-regia-app.md`](https://github.com/redirect11/drink-regia/blob/develop/docs/contratto-regia-app.md): i temi stanno nella licenza e nei cataloghi della regia, quindi quello che qui cambia il modo di descriverli è un cambio d'interfaccia, da concordare.

Concetto da discutere, 14/11/2026. Niente di questo è ancora nel codice.

## La richiesta

Daniele, 14/11/2026:

> la home con i contatti e la front page dovrebbe essere parte del tema. Nel senso il tema non dovrebbe valere solo per il menù.

E poco dopo:

> Ogni sito avrà almeno una home, una pagina contatti etc. O meglio, queste cose dovrebbero essere modificabili. Nel senso il locale può decidere quali pagine visualizzare tra alcune predefinite che gli diamo noi. Dobbiamo solo capire se vogliamo consentirgli di fare pagine libere. Per ora facciamo in modo che il tema riguardi tutto, e ci sia un tema per la home e un tema per il menù. Quindi un sito minimale già deployato, che in realtà potrebbe essere un modulo a parte.

## Com'è oggi

- **Un solo tema**, `stile_menu` in `settings/bar`, scelto fra quelli che il locale ha: nella licenza (`licenza.temi`), installati gratis (`stili_installati`) o a ricetta (`stiliRicetta.js`).
- **Il tema veste il menù.** Solo «Meraviglie» veste anche le altre pagine dei clienti (`pagine: true` in `stileMenu.js`, `vestePagine`), con frasi sue (`testiStile.js`). «Carte», il tema della Tana, cambia solo il menù.
- **La pagina iniziale è una sola, uguale per tutti** (`src/pages/LandingPage.jsx`): immagine, logo e nome, benvenuto, slogan, il tasto del menù, «chi siamo», contatti. I testi vengono da Impostazioni → Identità del locale (`venue_*`, REQ-VENUE-002).
- **Non esistono pagine:** contatti, orari e «chi siamo» stanno tutti nella pagina iniziale.

## Il concetto

### 1. Il sito del locale: poche pagine, scelte dal locale

Il sito del locale è un insieme di **pagine predefinite**, che diamo noi. Il locale sceglie quali mostrare, e in che ordine nella navigazione. Proposta di partenza:

| Pagina | Cosa contiene | Da dove vengono i dati |
|---|---|---|
| **Home** | benvenuto, slogan, immagine, il tasto del menù quando c'è | Identità del locale |
| **Contatti** | indirizzo, telefono, email, social, come arrivare | Identità del locale |
| **Orari** | giorni e orari di apertura | apertura e chiusura che il locale già scrive |
| **Chi siamo** | il testo del locale, qualche immagine | Identità del locale |
| **Eventi** | serate in programma (il riquadro del karaoke di agosto ne era un abbozzo) | da definire |
| **Menù** | il menù dei clienti, se attivo | la carta (`carta_*`) |

La **Home** c'è sempre. Le altre si accendono e si spengono, come il menù: spenta una pagina, sparisce dalla navigazione e il suo indirizzo è chiuso.

I dati stanno dove già stanno, cioè Identità del locale e impostazioni. La scelta delle pagine è un campo nuovo in `settings/bar`, per esempio:

```js
sito: { pagine: [{ id: 'home' }, { id: 'contatti' }, { id: 'orari', visibile: false }] }
```

### 2. Due temi: il tema del sito e il tema del menù

Il tema non vale più per il solo menù. Ci sono **due scelte**:

- **il tema del sito**, che veste la Home e tutte le altre pagine del sito;
- **il tema del menù**, cioè `stile_menu` di oggi.

Un tema può portare **tutte e due le parti** (come oggi «Meraviglie»), oppure una sola. Quando il locale sceglie un tema che le ha tutte e due, il tema del sito lo segue di suo; può comunque sceglierne uno diverso. Così la Tana, con «Carte», ha la Home e il menù a carte; un locale col tema del menù «Lavagna» e nessun tema del sito ha la Home di base.

Il tema del sito decide colori, caratteri, frasi e la **forma** di ogni pagina: per esempio una Home di «Carte» con una carta grande in apertura, i Contatti scritti su un'altra carta.

### 3. Come si lega ai temi modulari

È lo stesso disegno dei temi modulari del 12/11, applicato alle pagine del sito. Un tema dichiara in un **manifest** le parti che implementa, che sono **interfacce** decise da noi:

- `sito.home`, `sito.contatti`, `sito.orari`, `sito.chi-siamo`, `sito.eventi`, `sito.navigazione`, `sito.piede`;
- `menu.*`, come oggi per il menù.

Ogni pagina riceve i **dati** che le servono (il locale, le pagine attive, il menù attivo o no, gli orari) e le **azioni** permesse (andare al menù, andare a una pagina). Quello che il tema non implementa, o che fallisce, torna al **disegno di base**: un tema che porta solo `sito.home` ha la sua Home e i Contatti di base.

Il caricamento è lo stesso deciso per i temi modulari: diretto per i temi nostri o firmati dalla regia, in un riquadro isolato quando si apriranno i temi a sviluppatori terzi.

### 4. Un sito minimale, già pubblicato, che può essere un modulo

Ogni locale nasce con un **sito minimale**, cioè Home e Contatti col tema di base, sullo stesso indirizzo dell'app. Non serve niente da installare: c'è con il primo deploy.

Il resto può essere un **modulo a parte** della licenza, per esempio `sito`:
- **senza il modulo:** Home e Contatti, col tema di base o con quello del menù quando porta anche il sito;
- **con il modulo:** tutte le pagine predefinite, il tema del sito separato e, più avanti, le pagine libere.

Per ogni cosa che aggiunge alla licenza o al catalogo dei temi (il modulo `sito`, le parti `sito.*` nei temi) serve la regia, e passa dal contratto.

### 5. Le pagine libere: dopo

Le pagine scritte dal locale (titolo, testo, immagini) sono un passo in più, con dei rischi:
- un editor da fare bene;
- contenuti che non controlliamo noi;
- pagine che il tema non conosce, quindi da vestire in modo generico.

Proposta: non adesso. Prima le pagine predefinite e i due temi; le pagine libere, se servono, come una pagina di un tipo solo («testo e immagini»), vestita dal tema.

## Cosa serve decidere

1. **Le pagine predefinite:** va bene l'elenco qui sopra? Ne manca qualcuna, per esempio prenotazioni o galleria?
2. **Un tema, due parti, o due scelte indipendenti:** un tema che porta sito e menù si sceglie una volta sola, e il locale può separarli. Va bene così?
3. **Il modulo `sito`:** il sito minimale per tutti, il resto a pagamento? E in quale piano?
4. **Le pagine libere:** sì, no, o più avanti?
5. **Chi scrive i temi del sito:** i nostri per primi («Carte» e «Meraviglie», che ha già le frasi per le pagine), poi la regia nel catalogo.

## Il primo passo proposto, piccolo

Senza aspettare tutte le risposte, si può cominciare da qui:
1. la **pagina Contatti** separata dalla Home, e la navigazione del sito;
2. il **tema del sito** come seconda scelta, accanto a `stile_menu`, che di suo segue il tema del menù;
3. **«Carte» che veste anche la Home e i Contatti**, così la Tana si vede uguale dall'inizio alla fine;
4. la scelta delle **pagine visibili**, in Impostazioni.

Ogni passo ha il suo requisito sotto UR-018, e il suo test.
