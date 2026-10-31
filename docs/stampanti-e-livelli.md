# Stampanti e livelli di installazione: cloud, app, on premise

**Stato: proposta** (31/10/2026), da ragionare con la regia prima di
diventare requisiti. Nasce da una domanda dell'utente: come si
supportano le stampanti termiche non fiscali che i locali hanno già, per
sostituire i gestionali che lavorano con stampanti in rete. La risposta
porta a tre livelli di installazione: **cloud**, **app** e **on
premise** (fisico), ognuno con le sue stampanti e le sue funzioni.

## Il vincolo, in tre righe

1. **Una pagina web non può aprire un collegamento diretto alla porta
   9100**, che è quella su cui ascoltano quasi tutte le stampanti di rete
   (ESC/POS «nudo»). Dal browser si parla solo con le stampanti che hanno
   dentro un server web: le Epson con ePOS e le Star con WebPRNT.
2. **La stampante sta nella rete del locale, dietro il router: un server
   su internet non la raggiunge.** Fa eccezione solo una stampante che va
   lei a prendersi le stampe su internet (Epson Server Direct Print, Star
   CloudPRNT). Qualunque altra va raggiunta da qualcosa che sta dentro il
   locale. È così anche per i gestionali che vogliamo sostituire: stampa
   il PC della cassa, l'app sul tablet, o un programmino installato sul
   PC (per esempio QZ Tray).
3. **Dal browser servono due permessi.** Il primo è il certificato della
   stampante, installato a mano su ogni dispositivo
   ([certificato-stampante.md](certificato-stampante.md)). Il secondo è
   nuovo: **da Chrome 142 (ottobre 2025) una pagina pubblica che parla con
   un indirizzo della rete locale chiede il permesso** «accesso alla rete
   locale» (Local Network Access). Vale anche per la Epson di oggi sui
   dispositivi con Chrome. Si accetta una volta per sito; nelle
   installazioni gestite lo si concede in anticipo con la policy
   `LocalNetworkAccessAllowedForUrls`. Su Safari per iPad, oggi, non c'è.

## Le stampanti che si trovano nei locali

Ricerca del 31/10/2026. I modelli sono esempi tipici, non un elenco
completo. Le voci «da verificare» vanno provate su una stampante vera
prima di dichiararle supportate: in locale la stampa non si prova.

| Famiglia | Modelli tipici | Come riceve le stampe | Cloud (browser) | App | On premise |
|---|---|---|---|---|---|
| **Epson con ePOS** | TM-m30II/III, TM-m10, TM-m50, TM-T88VI/VII, TM-T20III e TM-T82III Ethernet | ePOS-Print (server web interno), ESC/POS | **Sì**, è quello di oggi | Sì (SDK Epson iOS/Android) | Sì |
| **Epson ad aghi, da cucina** | TM-U220 / TM-U220II | ESC/POS; ePOS solo con l'interfaccia di rete giusta (da verificare) | Da verificare | Sì | Sì |
| **Star con WebPRNT / CloudPRNT** | TSP100IV, mC-Print3, TSP650II (col firmware giusto), SP700 (ad aghi, da cucina) | WebPRNT (server web interno), CloudPRNT, StarPRNT/ESC/POS | Sì, con un traduttore nuovo | Sì (SDK Star) | Sì |
| **Custom** (italiana) | KUBE II ETH | ESC/POS compatibile, porta 9100 | No | Sì | Sì |
| **Bixolon** | SRP-350plusIII, SRP-Q300 | ESC/POS; il loro «Web Print SDK» richiede un'app di Bixolon installata sul dispositivo | No (o con la loro app) | Sì | Sì |
| **Economiche ESC/POS** | Xprinter (XP-Q80A…), Rongta, HPRT | ESC/POS, porta 9100, USB, Bluetooth | No | Sì | Sì |
| **Stampante dentro il terminale** | Sunmi T2 e simili (POS Android) | SDK del produttore | No | Sì (solo Android) | — |
| **Fiscali (RT)** — *fuori da questo piano* | Epson FP-81II/90III, Custom… | protocollo del produttore, in rete | No | Sì, un domani | Sì, un domani |

Due osservazioni che contano per il prodotto:

- **In cucina girano ancora tante stampanti ad aghi** (Epson TM-U220,
  Star SP700): con il nastro la carta non sbiadisce col calore e il
  grasso. Chi sostituisce un gestionale di ristorante le trova quasi
  sempre.
- **Le stampanti «che vanno a prendersi le stampe»** (Epson Server Direct
  Print, Star CloudPRNT) funzionano senza certificati e senza niente nel
  locale, ma **senza internet non stampano**. Per comande e scontrini al
  banco vanno contro il local-first. Possono servire per gli **ordini dal
  telefono del cliente** quando nessuno è alla cassa.

## I tre livelli

### 1. Cloud: quello di oggi

L'app web (PWA), senza installare niente: Firebase, regole, Functions
secondo il piano.

- **Stampa**: solo Epson con ePOS oggi. Con poco lavoro anche Star
  WebPRNT (un traduttore in più), e in modalità «pull» le Epson e le Star
  che leggono da internet.
- **Limiti**: il certificato su ogni dispositivo, il permesso di Chrome,
  nessuna ESC/POS generica, nessuna stampante ad aghi senza interfaccia
  ePOS. Se manca internet, ogni dispositivo lavora da solo (la cache di
  Firestore è per dispositivo), e quello che batte la sala non arriva al
  banco finché la rete non torna.
- **Costo per il locale**: nessuna installazione.

### 2. App: Android e iOS

Lo stesso codice React dentro un guscio nativo (Capacitor), con un pezzo
nativo per quello che il browser non lascia fare.

- **Stampa**: qualunque stampante ESC/POS in rete (porta 9100),
  Bluetooth, USB su Android, gli SDK di Epson e Star, la stampante
  interna dei terminali Sunmi. Le stampanti si trovano da sole in rete.
  **Spariscono certificato e permesso di Chrome**.
- **In più**: notifiche più affidabili (su iPad soprattutto), schermo
  sempre acceso, un domani il registratore telematico.
- **Limiti**: ogni dispositivo che stampa deve avere l'app. Senza
  internet i dispositivi continuano a non vedersi fra loro.
- **Distribuzione**: un'app sola per tutti i locali, che sceglie il locale
  al primo avvio (codice o QR della regia), perché ogni locale ha il suo
  progetto Firebase. Gli aggiornamenti del codice web arrivano senza
  passare dagli store («live update»), con le stesse regole della regia
  (obbligatori o a scelta, REQ-FLOTTA-020); dagli store si passa solo
  quando cambia la parte nativa. Il cliente continua a usare il menù web.

### 3. On premise: una scatola nel locale

Un mini PC (classe Intel N100) o un Raspberry Pi 5, collegato via cavo
alla rete del locale, preparato dalla regia. È il livello che **sblocca
tutto**.

1. **Il server di stampa del locale.** Tutti i dispositivi, anche quelli
   col solo browser, mandano le stampe alla scatola; la scatola parla con
   qualunque stampante: ESC/POS, aghi in cucina, Epson, Star. Le
   stampanti si configurano una volta, in un posto solo.
2. **Un certificato valido, senza installare niente sui dispositivi.** La
   scatola ha un nome pubblico suo (es. `tana.locale.<dominio della
   regia>`) che punta al suo indirizzo nella rete del locale, e un
   certificato vero chiesto con la verifica DNS (Let's Encrypt, DNS-01),
   come fa Plex coi suoi server di casa. Il browser se ne fida da solo. Il
   permesso di Chrome si accetta comunque una volta.
3. **Il locale lavora anche senza internet, tutto insieme.** Oggi senza
   internet la sala e il banco non si vedono. Con la scatola come punto di
   incontro locale, le comande passano da un dispositivo all'altro anche a
   internet staccato, e si sincronizzano col cloud quando torna. È il
   pezzo più grande e più delicato (due fonti di verità da tenere in
   pari): **va progettato a parte**, non è un'aggiunta.
4. **Un domani**: registratore telematico, monitor di cucina su un
   televisore, backup in locale, cassetto.

- **Gestione**: la scatola si collega lei alla regia (solo connessioni in
  uscita, nessuna porta aperta verso internet). Si attiva con un codice,
  si aggiorna da remoto, e la regia vede se è accesa e se le stampanti
  rispondono.
- **Installazione**: due strade. Si spedisce già configurata e il locale
  la collega da sé, oppure va un tecnico. Il costo è da decidere (vedi le
  domande).
- **Rischi**: un apparecchio da sostituire quando si rompe, da tenere
  aggiornato e sicuro. Il valore di questo livello sta proprio nel
  prendersene carico al posto del locale.

## Cosa sblocca ogni livello

| | Cloud | App | On premise |
|---|---|---|---|
| Epson con ePOS | ✅ (certificato + permesso Chrome) | ✅ | ✅ |
| Star WebPRNT | ✅ (da fare) | ✅ | ✅ |
| ESC/POS generiche in rete | ❌ | ✅ | ✅ |
| Stampanti ad aghi da cucina | ⚠️ solo con interfaccia ePOS | ✅ | ✅ |
| Bluetooth / USB | ❌ | ✅ (USB solo Android) | ✅ (collegate alla scatola) |
| Stampa da dispositivi col solo browser | ✅ solo ePOS/WebPRNT | ❌ serve l'app | ✅ tutte |
| Niente certificati da installare | ❌ | ✅ | ✅ |
| Sala e banco si vedono senza internet | ❌ | ❌ | ✅ (da progettare) |
| Registratore telematico (domani) | ❌ | ✅ | ✅ |
| Installazione | nessuna | dagli store | scatola + attivazione |

## Ordine di lavoro proposto

0. **Lo strato di stampa neutro** (in tana-drink, serve a tutti e tre).
   Scontrini e comande diventano un elenco neutro (testo, grassetto, doppia
   altezza, logo, taglio, cassetto). Ogni stampante ha il suo traduttore,
   e la scelta del traduttore dipende dal livello. Con la sola Epson la
   carta deve uscire identica a oggi, e i test lo devono dimostrare.
1. **Star WebPRNT nel cloud**: il secondo traduttore, utile subito e
   banco di prova dello strato.
2. **Il prototipo on premise su un Raspberry**: server di stampa più
   certificato col nome pubblico. Toglie subito il problema del
   certificato alla Tana e apre alle ESC/POS.
3. **L'app Android, poi iOS**, sul traduttore nativo.
4. **La rete locale senza internet** (punto 3 dell'on premise), progettata
   a parte.

Il passo 2 viene prima dell'app perché sblocca le stampanti per **tutti**
i dispositivi, browser compresi, senza passare dagli store. L'app resta
la strada per chi non vuole una scatola nel locale.

## Domande per la regia

- **Livelli e piani**: come si legano i tre livelli ai piani (Free, Base,
  Pro…) e ai moduli; l'installazione on premise è nel prezzo o a parte?
- **Il dominio dei nomi locali**: sotto quale dominio della regia, e chi
  automatizza i certificati DNS-01.
- **Provisioning**: attivazione di app e scatola con un codice del locale,
  nello stesso giro dell'attivazione di oggi.
- **Monitoraggio**: la scatola e le sue stampanti nella dashboard della
  regia.
- **Store**: con quale soggetto si aprono gli account sviluppatore Apple
  (99 €/anno) e Google; l'app su iOS si distribuisce «non in elenco»?
- **Aggiornamenti**: i live update dell'app e gli aggiornamenti della
  scatola seguono le stesse regole di REQ-FLOTTA-020 (obbligatori o a
  scelta)?
- **Assistenza hardware**: chi sostituisce una scatola rotta, e in quanto
  tempo.

## Fonti della ricerca

- Epson, ePOS SDK for JavaScript 2.27.0 (stampanti supportate):
  https://download3.ebz.epson.net/dsc/f/03/00/15/16/08/912403dcd72ccb22fc13f41eec229b35e2a1ea9c/ov_ePOS_SDK_JavaScript_v2.27.0.pdf
- Epson, ePOS-Print XML User's Manual:
  https://files.support.epson.com/pdf/pos/bulk/epos-print_xml_um_en_rev_af.pdf
- Epson TM-T88VI (Server Direct Print):
  https://www.epson.eu/en_EU/products/printers/pos-printers/pos-printers/pc-pos-printers/epson-tm-t88vi-series/p/20551
- Epson TM-U220II, stampante ad aghi per cucina: https://epson.com/p/C31CL27032
- Star, CloudPRNT: https://star-m.jp/starcloudprnt-introduction.html
- Star, WebPRNT (compatibilità interfacce):
  https://star-m.jp/products/s_print/sdk/webprnt/manual/en/_interfaceTable.htm
- Bixolon Web Print SDK: https://www.bixolon.com/product_view.php?idx=320
- Custom KUBE II ETH:
  https://www.pos99.com.au/receipt-printers/thermal-receipt-printers/custom-kube-ii-thermal-receipt-printer-ethernet.html
- Xprinter XP-Q80A (ESC/POS, LAN):
  https://neotech.ae/products/xprinter-xp-q80a-thermal-receipt-printer-fast-reliable
- QZ Tray, stampa raw dal browser: https://qz.io/docs/raw
- Chrome, Local Network Access: https://developer.chrome.com/blog/local-network-access
- Certificati per apparecchi in rete locale (il modello Plex):
  https://words.filippo.io/how-plex-is-doing-https-for-all-its-users/
