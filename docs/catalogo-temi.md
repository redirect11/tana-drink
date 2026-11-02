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

## 2. Da fare: il catalogo dei temi (REQ-LIC-011)

Un posto dove il gestore vede i temi, li prova, e li aggiunge alla sua
installazione: gratis o a pagamento. La forma che proponiamo:

- **Il catalogo sta nella regia**, accanto al listino dei piani
  (`piani.json`): ogni tema ha id, nome, descrizione, anteprima, prezzo (o
  gratis) e, se è esclusivo, il locale a cui appartiene. Gli esclusivi non
  si vedono nel catalogo degli altri.
- **Comprare o installare un tema** vuol dire che la regia lo aggiunge a
  `temi` nella licenza del locale. L'app lo vede arrivare in tempo reale,
  come i moduli. Toglierlo funziona allo stesso modo.
- **Nell'app**, in Impostazioni → Menù clienti, accanto agli stili che il
  locale ha, un collegamento «Altri stili» porta al catalogo nell'area
  clienti (`regia_url`). Dall'app non si compra niente.
- **Il codice degli stili sta nell'app.** Uno stile nuovo arriva con una
  versione dell'app; la licenza dice solo chi può usarlo. Uno stile
  esclusivo di un locale resta nel codice di tutti, ma acceso solo per lui.

### Da decidere (con l'utente)

1. **Cosa si vende:** solo gli stili del menù («Classico», «Notte», i
   prossimi), o anche i temi di colore (i preset di `themes.js`)?
2. **Come si paga:** una volta sola, o in abbonamento come i moduli?
3. **I temi gratuiti** si installano dal catalogo, o sono sempre accesi per
   tutti come «Classico»?
4. **L'anteprima:** basta un'immagine nel catalogo, o serve provarlo sul
   proprio menù prima di comprarlo?
5. **Gli esclusivi:** si possono comprare (un tema su misura per un
   locale), o restano un regalo deciso dal fornitore?
