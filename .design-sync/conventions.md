# Come si disegna con Tana Drink

App di cassa e gestione per **La Tana del Coniglio**, cocktail bar a Nola. Non
è una vetrina: ci si battono gli ordini la sera, col locale pieno, su iPad al
banco e telefoni in sala. Le schermate si guardano di sfuggita, con un vassoio
in mano.

**Interfaccia in italiano**, sempre. Parole comuni, niente gergo tecnico,
nessun messaggio che scarichi la colpa su chi legge.

## Come si monta

I componenti stanno in `window.TanaDrink`. **Non serve nessun provider**: lo
stile arriva tutto da `styles.css`, che si porta dentro il foglio dell'app —
compresa la regola sul `<body>`, che dipinge il fondo scuro e mette il colore
del testo. Sono i due valori da cui dipende tutto il resto: su fondo chiaro il
testo (quasi bianco) sparisce.

Due sole eccezioni:

- `StatusBell` usa `<Link>` di react-router: va montata dentro un Router.
- `AnteprimaProvider` esiste **solo per le schede di anteprima** (mette un
  MemoryRouter e ridipinge il `body`, che nelle schede nasce bianco). In un
  disegno vero non serve, e il suo MemoryRouter darebbe fastidio a un router
  vero.

`Toasts` si monta **una volta sola** in alto nell'albero; i messaggi si mandano
da qualunque punto con `showToast`, `toastSync`, `toastSuccess`, `toastError`
(esportate dal bundle insieme ai componenti).

## Lo stile: classi globali + variabili CSS

Non ci sono classi per componente né utility generate: c'è **un foglio di stile
solo**, con un vocabolario di classi che si riusa ovunque. Per il proprio
impianto di pagina si usano quelle, non nomi nuovi.

| Famiglia | Classi vere |
|---|---|
| Tasti | `btn`, e le varianti `btn ghost`, `btn secondary`, `btn danger`, `btn small`, `btn block` |
| Pastiglie | `chip`, `chip active`, `chips-row`, `pill` |
| Contenitori | `card`, `overlay` + `confirm-box` (dialoghi), `section-panels` + `section-tab` |
| Impianto | `row`, `row between`, `grid-2`, `grow` |
| Testo | `muted` (attenuato), `small` |
| Interruttori | `toggle`, `toggle-row` |

I colori e le misure passano **sempre** per le variabili, mai per valori
scritti a mano — così il tema scelto dal locale (Impostazioni → Aspetto) le
segue:

`--bg` `--bg-2` (fondo) · `--card` `--tile-bg` (superfici) · `--accent`
(cremisi) `--accent-2` (oro) `--grad` · `--text` `--muted` · `--ok` `--warn` ·
`--line` (bordi) · `--radius` (16px) · `--serif` (Playfair Display: **solo**
per titoli e cifre importanti; il resto è di sistema).

## Dove sta la verità

Prima di inventare uno stile, si legge il foglio: `styles.css` e il file che
importa, `_ds_bundle.css` — è l'intero CSS dell'app, ci sono dentro tutte le
classi vere. Per ogni componente, `<Nome>.prompt.md` dice a cosa serve e
`<Nome>.d.ts` che props accetta.

## Un esempio nello stile giusto

```jsx
<div className="card">
  <div className="row between">
    <h3>Conto #12 — Marta</h3>
    <span className="chip active">Da incassare</span>
  </div>
  <p className="muted small">Tre righe, ultima aggiunta alle 23:40.</p>
  <div className="row" style={{ gap: 10, marginTop: 12 }}>
    <button className="btn ghost grow">
      <IconReceipt /> Stampa il conto
    </button>
    <button className="btn grow">
      <IconCard /> Incassa 34,50 €
    </button>
  </div>
</div>
```

Due abitudini della casa che si vedono qui: **le icone si disegnano** (le
`Icon*` del bundle, monocromatiche, che seguono `currentColor` e la scala del
testo) — le emoji su Windows diventano rettangolini storti; e **i bersagli sono
grossi**, perché si preme col pollice, di corsa, al buio.
