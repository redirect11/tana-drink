import { useEffect, useMemo, useRef, useState } from 'react'
import {
  catalogoOrdinabile,
  filtraCatalogo,
  fornitoreProposto,
  fornitoriGiaUsati,
  piuEconomica,
  righeDiProdotto,
} from '../lib/listini.js'
import {
  ETICHETTA_ASSORTIMENTO,
  ETICHETTA_SCORTA,
  assortimentoDi,
  contenutoDelPezzo,
  formatQty,
  stockStatus,
} from '../lib/inventory.js'
import {
  PASSO_RIGHE,
  ordinaCatalogo,
  preselezioneIniziale,
  prezzoDiListino,
  prossimaFinestra,
  raggruppaPerFornitore,
  righeOrdine,
  righeScelte,
  vicinoAlFondo,
} from '../lib/composizioneOrdine.js'
import { purchaseOrderTotals } from '../lib/warehouse.js'
import { formatPrice } from '../lib/orderStatus.js'
import SortTh from './SortTh.jsx'

// ── NUOVO ORDINE: UNA TABELLA SOLA, E L'ORDINE DI FIANCO (REQ-MAG-036) ─
//
// Questa schermata era già stata fatta una volta, ed è stata bocciata
// (utente, 27/08/2026): «nella sezione ordini NON MI PIACE LA DOPPIA LISTA e
// quei box sono POSTICCI. Serve una UX e UI più moderna e semplice. Deve
// esserci UNA SOLA TABELLA dove su ogni riga vedrò il nome del prodotto e i
// vari campi per compilare l'ordine, compresa una dropdown per la scelta del
// fornitore». E: «è SCOMODISSIMO l'ordine in basso. Dobbiamo metterlo
// affianco, e già lì separare i prodotti di un fornitore rispetto a un
// altro».
//
// Quindi: a sinistra UNA tabella — spunta · prodotto · disponibilità ·
// fornitore · €/pz di listino · pezzi · totale · la riga che si apre — e a
// destra l'ordine che si sta componendo, già diviso per fornitore. I conti
// (ordinamento, preselezione, finestra, raggruppamento) stanno tutti in
// `lib/composizioneOrdine.js`, dove si provano senza Firebase.
//
// I doppioni non sono un difetto: lo stesso prodotto su due listini fa due
// righe, distinte dal nome del fornitore e dal colore della striscia
// (REQ-MAG-029).
export default function NuovoOrdinePanel({
  items = [],
  suppliers = [],
  listini = [],
  busy = false,
  onSalva,
}) {
  const [query, setQuery] = useState('')
  const [filtroFornitore, setFiltroFornitore] = useState('all')
  const [sort, setSort] = useState({ col: 'nome', dir: 'asc' })
  const toggleSort = (col) =>
    setSort((s) => (s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' }))
  // La riga aperta: una per volta, come nella lista del magazzino.
  const [aperta, setAperta] = useState(null)
  // Quello che si sta ordinando: chiave della riga → { qty, supplier_id,
  // totale }. `qty` e `totale` restano STRINGHE finché si scrive — un campo
  // svuotato deve poter restare vuoto, e con un numero diventerebbe «0» sotto
  // le dita di chi sta cancellando per riscrivere.
  const [selezioni, setSelezioni] = useState({})
  const [mostrate, setMostrate] = useState(PASSO_RIGHE)
  // La preselezione si fa UNA VOLTA SOLA: il magazzino si ricarica anche
  // dopo un salvataggio, e rifarla cancellerebbe le spunte tolte a mano.
  const preselezionato = useRef(false)

  // FUORI LINEA IN TABELLA SÌ, PRESELEZIONATO NO. Prima gli `out` erano
  // esclusi dal catalogo: così però non c'era modo di farli rientrare, e
  // ordinarne uno è esattamente il gesto con cui rientrano (REQ-MAG-036).
  const catalogo = useMemo(
    () => catalogoOrdinabile({ items, listini, suppliers }),
    [items, listini, suppliers]
  )
  const perChiave = useMemo(() => new Map(catalogo.map((r) => [r.key, r])), [catalogo])

  const visibili = useMemo(
    () => ordinaCatalogo(filtraCatalogo(catalogo, { query, supplierId: filtroFornitore }), sort),
    [catalogo, query, filtroFornitore, sort]
  )
  const finestra = useMemo(() => visibili.slice(0, mostrate), [visibili, mostrate])

  useEffect(() => {
    if (preselezionato.current || catalogo.length === 0) return
    preselezionato.current = true
    const pre = preselezioneIniziale(catalogo)
    const iniziali = {}
    for (const [key, qty] of pre) {
      iniziali[key] = { qty: String(qty), supplier_id: perChiave.get(key)?.supplier_id ?? null }
    }
    setSelezioni(iniziali)
  }, [catalogo, perChiave])

  // Cambiando filtro, ricerca o ordinamento si riparte dalla prima finestra:
  // restare a quattrocento righe caricate dopo aver cercato «campari» vuol
  // dire disegnare tutto il magazzino per mostrarne due.
  useEffect(() => {
    setMostrate(PASSO_RIGHE)
  }, [query, filtroFornitore, sort])

  const scelte = useMemo(
    () => righeScelte(selezioni, { perChiave, listini, suppliers }),
    [selezioni, perChiave, listini, suppliers]
  )
  const gruppi = useMemo(() => raggruppaPerFornitore(scelte), [scelte])
  const lines = useMemo(() => righeOrdine(scelte, { listini }), [scelte, listini])
  const totals = useMemo(() => purchaseOrderTotals(lines), [lines])
  const preselezionati = useMemo(
    () => scelte.filter((s) => stockStatus(s.item) !== 'ok').length,
    [scelte]
  )

  function spunta(riga, dentro) {
    if (!dentro) return togli(riga.key)
    setSelezioni((prev) => ({
      ...prev,
      [riga.key]: prev[riga.key] || { qty: '1', supplier_id: riga.supplier_id ?? null },
    }))
  }

  function togli(key) {
    setSelezioni((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  // SCRIVERE UNA QUANTITÀ SELEZIONA LA RIGA: «se aggiungo una quantità sulla
  // riga del prodotto, questo viene selezionato automaticamente per
  // l'ordine». Scrivere una quantità È la decisione di ordinarlo, e chiedere
  // anche la spunta sarebbe far dire due volte la stessa cosa.
  function cambiaQta(riga, qty) {
    setSelezioni((prev) => {
      const attuale = prev[riga.key] || { supplier_id: riga.supplier_id ?? null }
      // Il totale corretto a mano vale per QUEI pezzi: cambiando i pezzi
      // torna a farsi dal listino, se no resterebbe la cifra di prima
      // attaccata a una quantità diversa.
      const { totale: _via, ...resto } = attuale
      return { ...prev, [riga.key]: { ...resto, qty } }
    })
  }

  function cambiaTotale(riga, totale) {
    setSelezioni((prev) => {
      const attuale = prev[riga.key] || { supplier_id: riga.supplier_id ?? null }
      // Un totale scritto su una riga ancora vuota vale per un pezzo: senza
      // quantità sarebbe una cifra che non compra niente.
      const qty = Number(attuale.qty) > 0 ? attuale.qty : '1'
      return { ...prev, [riga.key]: { ...attuale, qty, totale } }
    })
  }

  // L'ASSORTIMENTO SI PREPARA MENTRE LA MERCE VIAGGIA (REQ-MAG-025 punto 5),
  // e il cambio scatta al carico: metterlo in assortimento adesso vorrebbe
  // dire offrire una bottiglia che non è ancora arrivata.
  function cambiaAssortimento(riga, assortimento) {
    setSelezioni((prev) => {
      const attuale = prev[riga.key] || { qty: '1', supplier_id: riga.supplier_id ?? null }
      return { ...prev, [riga.key]: { ...attuale, assortimento } }
    })
  }

  function cambiaFornitore(riga, supplier_id) {
    setSelezioni((prev) => {
      const attuale = prev[riga.key] || { qty: '1' }
      // Il prezzo viene dal listino del fornitore scelto: un totale corretto
      // a mano per l'altro fornitore non c'entra più niente.
      const { totale: _via, ...resto } = attuale
      return { ...prev, [riga.key]: { ...resto, supplier_id: supplier_id || null } }
    })
  }

  function altreRighe() {
    setMostrate((m) => prossimaFinestra(m, visibili.length))
  }

  // SCORRIMENTO CONTINUO. Si guarda quanto manca al fondo del riquadro che
  // scorre — non della finestra: la tabella ha una barra sua, perché
  // l'intestazione deve restare in alto mentre si scorrono seicento righe.
  function scorre(e) {
    const el = e.currentTarget
    if (mostrate >= visibili.length) return
    if (vicinoAlFondo(el)) altreRighe()
  }

  const salva = () => onSalva?.(lines, totals)

  return (
    <div className="card ordine-composizione">
      <strong>Nuovo ordine</strong>
      <p className="muted small" style={{ marginTop: 4 }}>
        Sono già spuntati i prodotti esauriti o sotto la soglia di riordino.
        Il fornitore e i pezzi si cambiano sulla riga; a destra l’ordine in
        composizione, diviso per fornitore.
      </p>

      <div className="ordine-filtri">
        <span className="grow">
          <label htmlFor="po-cerca">Cerca un prodotto</label>
          <input
            id="po-cerca"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Es. Campari"
          />
        </span>
        <span className="grow">
          <label htmlFor="po-filtro">Filtra per fornitore</label>
          <select
            id="po-filtro"
            value={filtroFornitore}
            onChange={(e) => setFiltroFornitore(e.target.value)}
          >
            <option value="all">Tutti i fornitori</option>
            <option value="none">Senza fornitore</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </span>
      </div>

      <div className="ordine-due-colonne">
        <div style={{ minWidth: 0 }}>
          {/* Finché il magazzino non è arrivato la tabella è vuota per un
              motivo diverso da «non c'è niente che corrisponda»: dirlo
              sbagliato manda a cercare un prodotto che c'è. */}
          {items.length === 0 ? (
            <div className="empty">Carico il magazzino…</div>
          ) : visibili.length === 0 ? (
            <p className="muted small">Nessun prodotto corrisponde alla ricerca.</p>
          ) : (
            <>
              <div className="inv-list inv-table ordine-tabella" onScroll={scorre}>
                <div className="inv-thead">
                  <span aria-hidden />
                  <SortTh label="Prodotto" col="nome" sort={sort} onSort={toggleSort} />
                  <SortTh label="Disponibilità" col="scorta" sort={sort} onSort={toggleSort} />
                  <SortTh label="Fornitore" col="fornitore" sort={sort} onSort={toggleSort} />
                  <SortTh label="€/pz" col="prezzo" sort={sort} onSort={toggleSort} num />
                  <span className="inv-th inv-cell-num" aria-hidden>Pezzi</span>
                  <span className="inv-th inv-cell-num" aria-hidden>Totale</span>
                  <span aria-hidden />
                </div>
                {finestra.map((riga) => (
                  <RigaCatalogo
                    key={riga.key}
                    riga={riga}
                    sel={selezioni[riga.key]}
                    suppliers={suppliers}
                    listini={listini}
                    scelte={scelte}
                    aperta={aperta === riga.key}
                    onApri={() => setAperta(aperta === riga.key ? null : riga.key)}
                    onSpunta={spunta}
                    onQta={cambiaQta}
                    onTotale={cambiaTotale}
                    onFornitore={cambiaFornitore}
                    onAssortimento={cambiaAssortimento}
                  />
                ))}
              </div>
              <p className="muted small ordine-conta">
                {mostrate < visibili.length ? (
                  <>
                    Mostrate {finestra.length} righe su {visibili.length}.{' '}
                    {/* Scorrendo si caricano da sole; il tasto serve a chi
                        arriva qui con la tastiera, che scorrendo col tabulatore
                        non fa scorrere niente. */}
                    <button type="button" className="btn ghost small" onClick={altreRighe}>
                      Mostra altre righe
                    </button>
                  </>
                ) : (
                  <>{visibili.length} righe, tutte in elenco.</>
                )}
              </p>
            </>
          )}
        </div>

        <aside className="ordine-carrello" aria-label="Ordine in composizione">
          <strong>Ordine in composizione</strong>
          {gruppi.length === 0 ? (
            <p className="muted small" style={{ marginTop: 6 }}>
              Nessun prodotto selezionato. Spunta una riga della tabella, o
              scrivi quanti pezzi ne servono.
            </p>
          ) : (
            <>
              <p className="muted small" style={{ marginTop: 2 }}>
                {preselezionati === 0
                  ? `${scelte.length} prodotti selezionati.`
                  : `${scelte.length} prodotti selezionati, ${preselezionati} sotto scorta.`}
              </p>
              {gruppi.map((g) => (
                <div
                  className="ordine-gruppo"
                  key={g.supplier_id || 'senza'}
                  style={{ borderLeftColor: g.colore || undefined }}
                >
                  <div className="row between">
                    <strong className="small">{g.supplier_name || 'Senza fornitore'}</strong>
                    <span className="muted small">{formatPrice(g.totale)}</span>
                  </div>
                  {g.righe.map((r) => (
                    <div className="row between ordine-gruppo-riga" key={r.key}>
                      <span className="muted small grow" style={{ minWidth: 0 }}>
                        {r.qty}× {r.item_name}
                      </span>
                      <span className="muted small">{formatPrice(r.totale)}</span>
                      <button
                        type="button"
                        className="btn ghost small"
                        aria-label={`Togli ${r.item_name} dall’ordine`}
                        title="Togli dall’ordine"
                        onClick={() => togli(r.key)}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              ))}
              <div className="row between ordine-totale">
                <span className="muted small">
                  {totals.pieces} pezzi · netto {formatPrice(totals.net)}
                </span>
                <strong>
                  {formatPrice(totals.gross)} <span className="muted small">+IVA</span>
                </strong>
              </div>
              <button
                className="btn block"
                style={{ marginTop: 8 }}
                onClick={salva}
                disabled={busy || lines.length === 0}
              >
                📤 Salva ordine
              </button>
            </>
          )}
        </aside>
      </div>
    </div>
  )
}

// Come si chiama una riga quando bisogna nominarla a voce (screen reader) o
// in un test: il prodotto DA CHI. Col solo nome due righe dello stesso
// Campari sarebbero indistinguibili, ed è esattamente il caso normale.
const nomeRiga = (r) => `${r.item_name} (${r.supplier_name || 'senza fornitore'})`

function RigaCatalogo({
  riga,
  sel,
  suppliers,
  listini,
  scelte,
  aperta,
  onApri,
  onSpunta,
  onQta,
  onTotale,
  onFornitore,
  onAssortimento,
}) {
  const item = riga.item
  const st = stockStatus(item)
  const scelta = sel ? scelte.find((s) => s.key === riga.key) : null
  const supplierId = sel?.supplier_id ?? riga.supplier_id ?? null
  const prezzo = prezzoDiListino(item, listini, supplierId)
  const nome = nomeRiga(riga)
  // Un fornitore già usato per QUESTO prodotto in QUESTO ordine non si può
  // riscegliere: due righe uguali sono un doppione, e un doppione si paga
  // due volte (Flavio, 26/08).
  const usati = fornitoriGiaUsati(
    scelte.filter((s) => s.key !== riga.key),
    riga.item_id
  )
  // I listini di QUESTO prodotto: servono ai due suggerimenti della scheda.
  const altriListini = righeDiProdotto(item, listini)
  const ultimo = altriListini.length > 1 ? fornitoreProposto(altriListini) : null
  const economica = altriListini.length > 1 ? piuEconomica(altriListini) : null
  const nomeFornitore = (id) => suppliers.find((s) => s.id === id)?.name || '—'
  // Quello che si legge nel campo: la cifra scritta a mano se c'è — anche
  // mentre la si sta cancellando, o il campo non si potrebbe svuotare per
  // riscriverlo — se no il conto pezzi × listino.
  const totale = sel?.totale ?? (scelta && scelta.qty > 0 ? String(arrotonda(scelta.totale)) : '')

  const campoFornitore = (dettaglio) => (
    <select
      aria-label={`Fornitore per ${nome}${dettaglio ? ' nella scheda' : ''}`}
      value={supplierId || ''}
      onChange={(e) => onFornitore(riga, e.target.value)}
    >
      <option value="">— Nessun fornitore —</option>
      {suppliers.map((s) => (
        <option key={s.id} value={s.id} disabled={usati.has(s.id)}>
          {s.name}{usati.has(s.id) ? ' (già in questo ordine)' : ''}
        </option>
      ))}
    </select>
  )
  const campoPezzi = (dettaglio) => (
    <input
      type="number"
      step="1"
      min="0"
      inputMode="numeric"
      aria-label={`Pezzi di ${nome}${dettaglio ? ' nella scheda' : ''}`}
      value={sel?.qty ?? ''}
      placeholder="pz"
      onChange={(e) => onQta(riga, e.target.value)}
    />
  )
  const campoTotale = (dettaglio) => (
    <input
      type="number"
      step="0.01"
      min="0"
      inputMode="decimal"
      aria-label={`Totale di ${nome}${dettaglio ? ' nella scheda' : ''}`}
      value={totale}
      placeholder="€"
      onChange={(e) => onTotale(riga, e.target.value)}
    />
  )

  return (
    <div
      className={`inv-row${aperta ? ' open' : ''}`}
      style={{ borderLeftColor: riga.colore || undefined }}
    >
      <div className="inv-row-main">
        {/* La spunta si tocca in piedi: il bersaglio è l'etichetta, alta
            quanto la riga, non il quadratino da venti pixel. */}
        <label className="ordine-spunta">
          <input
            type="checkbox"
            aria-label={`Ordina ${nome}`}
            checked={!!sel}
            onChange={(e) => onSpunta(riga, e.target.checked)}
          />
        </label>
        <span className="inv-row-name">
          {riga.item_name}
          {assortimentoDi(item) === 'out' && (
            <span className="muted small"> fuori linea</span>
          )}
          {/* Il fornitore accanto al nome si vede solo dove la sua colonna
              non c'è (telefono): due righe dello stesso Campari, senza,
              sarebbero identiche. */}
          <span className="muted small ordine-nome-fornitore" aria-hidden>
            {riga.supplier_name || 'senza fornitore'}
          </span>
        </span>
        <span className="muted small ordine-scorta">
          <span className={`dot dot-${st}`} aria-hidden /> {ETICHETTA_SCORTA[st]}
        </span>
        {campoFornitore(false)}
        <span className="inv-cell-num muted">{prezzo != null ? formatPrice(prezzo) : '—'}</span>
        {campoPezzi(false)}
        {campoTotale(false)}
        <button
          type="button"
          className="btn ghost small ordine-apri"
          aria-label={`Apri la scheda di ${nome}`}
          aria-expanded={aperta}
          onClick={onApri}
        >
          {aperta ? '▾' : '▸'}
        </button>
      </div>

      {/* LA RIGA CHE SI APRE: «mi dirà anche le info di quel prodotto — se in
          assortimento, out, in linea eccetera, quante scorte ho ancora in
          magazzino — più la possibilità di modificare gli stessi campi che
          modificherei inline sulla riga stessa». Le stesse cose, due strade:
          in linea per chi sa già cosa vuole, aperta per chi deve guardare
          prima di decidere. */}
      {aperta && (
        <div className="inv-row-dettaglio">
          <div className="muted small">
            {ETICHETTA_ASSORTIMENTO[assortimentoDi(item)]} · {ETICHETTA_SCORTA[st]}
          </div>
          <div className="muted small">
            In casa: {formatQty(item.stock, item.unit)}
            {Number(item.low_threshold) > 0
              ? ` · soglia ${formatQty(item.low_threshold, item.unit)}`
              : ''}
            {contenutoDelPezzo(item) ? ` · 1 pz = ${contenutoDelPezzo(item)}` : ''}
          </div>
          <div className="muted small">
            {prezzo != null ? `Listino ${formatPrice(prezzo)}/pz` : 'Nessun prezzo di listino'}
            {riga.package_label ? ` · ${riga.package_label}` : ''}
            {riga.code ? ` · codice ${riga.code}` : ''}
          </div>
          {/* CHI LO VENDE, E A QUANTO (REQ-MAG-029). Il fornitore proposto è
              quello dell'ULTIMO ACQUISTO; il più economico si MOSTRA e non si
              sceglie, perché il prezzo più basso in archivio è quasi sempre
              il più vecchio — nessuno aggiorna al rialzo il listino di un
              fornitore da cui non compra più. In tabella non ci stavano:
              stanno qui, che è dove si guarda prima di decidere. */}
          {altriListini.length > 1 && (
            <div className="muted small">
              Su {altriListini.length} listini
              {ultimo ? ` · ultimo acquisto ${nomeFornitore(ultimo.supplier_id)}` : ''}
              {economica
                ? ` · più economico ${nomeFornitore(economica.supplier_id)} a ${formatPrice(economica.price)}/pz`
                : ''}
            </div>
          )}
          <div className="ordine-campi-scheda">
            <span className="grow">
              <label>Fornitore</label>
              {campoFornitore(true)}
            </span>
            <span>
              <label>Pezzi</label>
              {campoPezzi(true)}
            </span>
            <span>
              <label>Totale</label>
              {campoTotale(true)}
            </span>
          </div>
          {/* La casella si chiede solo dove cambia qualcosa: su un prodotto
              già in assortimento sarebbe una casella che non fa niente. */}
          {assortimentoDi(item) !== 'assortimento' && (
            <label className="row small" style={{ gap: 6, alignItems: 'center', marginTop: 6 }}>
              <input
                type="checkbox"
                style={{ width: 'auto' }}
                checked={!!sel?.assortimento}
                aria-label={`Metti ${item.name} in assortimento quando arriva`}
                onChange={(e) => onAssortimento(riga, e.target.checked)}
              />
              <span className="muted">In assortimento quando arriva</span>
            </label>
          )}
        </div>
      )}
    </div>
  )
}

// Il totale mostrato nel campo è in centesimi tondi: è una cifra che si
// legge e si corregge, non il risultato di una divisione con sei decimali.
const arrotonda = (n) => Math.round((Number(n) || 0) * 100) / 100
