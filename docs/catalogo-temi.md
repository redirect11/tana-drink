# I temi nella licenza, e il catalogo dei temi (REQ-LIC-010, REQ-LIC-011)

Per la regia (drink-regia) e per chi lavora qui. 02/11/2026.

## La decisione dell'utente

> «Dobbiamo fare in modo che lo stile notte sia utilizzabile solo da
> tana-drink e tana-drink-test. Sono esclusive loro. In questo senso,
> sarebbe bello fare una specie di marketplace per i temi in modo che i
> gestori possano installarli sulla propria installazione e/o comprarli.»

## 1. Fatto: i temi stanno nella licenza (REQ-LIC-010)

Una voce nuova del contratto della licenza:

```
licenza/attuale = {
  …,
  temi: ['notte'],     // gli stili che il locale ha, oltre a quelli di tutti
  …
}
```

- **Uno stile del menù può essere «della licenza».** Oggi c'è solo
  «Notte» (`src/lib/stileMenu.js`, `inLicenza: true`). Uno stile della
  licenza c'è solo dove `temi` lo nomina. «Classico» è di tutti.
- **Senza lo stile nella licenza, l'app non lo mostra né lo applica.** In
  Impostazioni la scelta non compare, e chi si scrive
  `stile_menu: 'notte'` dalla console vede comunque il classico. La licenza
  dall'app non la scrive nessuno (BUG-125), quindi l'esclusiva tiene.
- **La Tana** ha `temi: ['notte']` nella licenza iniziale, che il deploy
  crea, e sul test nel suo documento.
- **`temi` è una voce del contratto:** nella licenza iniziale va sempre
  scritta, anche vuota (`[]`). Il deploy si ferma se manca.
- **Impostazioni → Licenza** mostra gli stili che la licenza dà.

**Alla regia:** scrivete `temi` in ogni licenza, `[]` se il locale non ha
stili in più. **«Notte» non va mai in una licenza che non sia della Tana:**
è esclusivo suo.

## 2. Il catalogo dei temi (REQ-MENU-022 fatto, REQ-LIC-011 da fare)

Le decisioni dell'utente, 02/11/2026:

> «I temi in abbonamento non si possono sentire. Io per ora metterei un tot
> di temi gratis, escludiamo lo stile Notte. Parlo di temi per il menu.»
>
> «Qui gli acquisti sono in app. E su quelli gratis non facciamo partire
> stripe ovviamente. Facciamo solo installare il tema.»

Quindi:

- **Si parla di stili del menù**, non di temi di colore (quelli restano
  tutti liberi).
- **Il catalogo sta nell'app**, in Impostazioni → Menù clienti: sopra gli
  stili che il locale ha, sotto «Altri stili, gratis».
- **Gli stili gratis si installano e basta**: niente Stripe, niente regia.
  Quelli installati stanno nelle impostazioni del locale
  (`settings/bar.stili_installati`); sono gratis, non c'è niente da
  proteggere. Fatti: «Lavagna», «Déco», «Riviera», «Giornale»
  (REQ-MENU-022, DESIGN.md).
- **Ogni stile si prova sul proprio menù** prima di installarlo o
  sceglierlo: l'anteprima del cliente con lo stile in prova, solo per chi
  la apre.
- **Niente abbonamento.** Il giorno che ci sarà uno stile a pagamento: il
  tasto «Compra» nell'app, un pagamento **una tantum**, e dopo il pagamento
  la regia scrive lo stile in `licenza.temi`, come oggi per gli esclusivi.
  È l'unica parte che passa dalla regia, e resta da fare (REQ-LIC-011).

### Alla regia, per quando arriverà il primo stile a pagamento

- Un pagamento una tantum avviato dall'app (non dall'area clienti), con la
  conferma che torna all'app.
- Dopo il pagamento, l'id dello stile aggiunto a `licenza.temi`: per
  sempre, non in abbonamento, e senza toglierlo alle riduzioni di piano.
- Gli esclusivi (come «Notte») non sono in vendita.
