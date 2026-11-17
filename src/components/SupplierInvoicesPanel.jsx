import { useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchSuppliers,
  fetchSupplierInvoices,
  createSupplierInvoice,
  updateSupplierInvoice,
  deleteSupplierInvoice,
  fetchInventoryItems,
  fetchSupplierPrices,
  fetchPurchaseOrders,
  aggiungiProdottiAFattura,
  collegaFatturaAFetta,
  allegaDocumentoAFattura,
  togliAllegatoDaFattura,
  modificaFattura,
} from '../lib/api.js'
import { formatPrice } from '../lib/orderStatus.js'
import { giornoEOra } from '../lib/ore.js'
import { descriviMovimento, storiaDi } from '../lib/statiOrdine.js'
import { contenutoDelPezzo, formatQty, magazzinoBloccato } from '../lib/inventory.js'
import Icona, { ConIcona } from './Icona.jsx'
import {
  invoiceTotals,
  eNotaDiCredito,
  importoLeggibile,
  etichettaSaldo,
  righeFattura,
  totaliRigheFattura,
  prezzoInArchivio,
  prezzoDiverso,
  rigaDaProdotto,
  righeDaOrdine,
  fetteDellaFattura,
  elencoOrdini,
  fetteCollegabili,
  fattureSenzaFetta,
  fatturaGenerata,
  DOC_NESSUNO,
  DOC_NOTA_CREDITO,
  TIPI_DOCUMENTO,
  etichettaTipoDocumento,
} from '../lib/fatture.js'
import {
  PESO_MASSIMO,
  allegatoDi,
  fattureSenzaAllegato,
  pesoLeggibile,
} from '../lib/allegati.js'
import AiutoCampo from './AiutoCampo.jsx'
import FatturaDaAI from './FatturaDaAI.jsx'
import TastoAI from './TastoAI.jsx'
import { aiRaggiungibile } from '../lib/aiApi.js'
import { tr } from '../lib/lingua.js'

// Il magazzino è quasi quattrocento prodotti: nessuno li scorre, si cercano.
// Poche righe per volta e non sessanta come nella schermata degli ordini,
// perché qui si sta dentro una finestrella: i prodotti già scelti stanno
// sotto l'elenco, e un elenco lungo li spinge fuori dallo schermo. Il limite
// si dice, così chi non trova qualcosa sa che deve restringere.
const LIMITE_RICERCA = 8

// Come si nomina un documento quando bisogna dirlo a voce alta: nel testo di
// una conferma, nell'etichetta di un tasto. Era ricopiato in quattro punti, e
// quattro copie della stessa frase prima o poi non dicono più la stessa cosa.
const nomeDocumento = (fattura) =>
  `${fattura?.supplier_name || tr('fornitore')}${fattura?.number ? ` #${fattura.number}` : ''}`

// Scadenzario fornitori (come FORNITORI REC dell'Excel): documenti/proforma
// per fornitore con importo, stato pagato e note; totale da pagare a colpo
// d'occhio, complessivo e per fornitore.
export default function SupplierInvoicesPanel() {
  const [suppliers, setSuppliers] = useState([])
  const [invoices, setInvoices] = useState([])
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [adding, setAdding] = useState(false)
  // LA LETTURA CON L'AI (REQ-AI-001): un'alternativa a «Nuovo documento»,
  // una per volta, che finisce nello stesso elenco.
  const [leggendo, setLeggendo] = useState(false)
  const [supplierFilter, setSupplierFilter] = useState('all')
  const [onlyUnpaid, setOnlyUnpaid] = useState(false)
  // Il secondo dei due buchi (REQ-MAG-031): i documenti che non stanno su
  // nessun ordine. Si guardano a fine mese, quindi serve poterli isolare e
  // non solo riconoscerli uno per uno scorrendo.
  const [soloSenzaOrdine, setSoloSenzaOrdine] = useState(false)
  // Il terzo buco (REQ-MAG-033): i documenti registrati senza la carta. Si
  // guarda come gli altri due, perché è la stessa domanda del
  // commercialista fatta un mese dopo.
  const [soloSenzaAllegato, setSoloSenzaAllegato] = useState(false)
  // Quale documento sta caricando il suo allegato. Il caricamento aspetta —
  // qui si può, è gestione e non la coda — ma l'attesa si deve VEDERE: chi
  // ha toccato deve sapere che sta succedendo qualcosa.
  const [allegando, setAllegando] = useState(null)
  // UNA SOLA CASELLA DEL FILE PER TUTTO IL PANNELLO, aperta dal tasto della
  // riga: una per documento vorrebbe dire trenta caselle nascoste in pagina.
  const fileRef = useRef(null)
  const perAllegare = useRef(null)
  // Il magazzino serve solo a «Aggiungi prodotti», ma si carica insieme al
  // resto: aprire la finestra e trovarla vuota per mezzo secondo, con una
  // fattura in mano, è peggio di una lettura in più su una schermata che si
  // apre poche volte al giorno.
  const [items, setItems] = useState([])
  const [listini, setListini] = useState([])
  const [ordini, setOrdini] = useState([])
  const [prodottiPer, setProdottiPer] = useState(null)
  const [collegaPer, setCollegaPer] = useState(null)
  // Quale documento si sta correggendo (REQ-MAG-041). Uno per volta: il
  // modulo prende il posto della riga, cosi' si vede quale documento si sta
  // toccando senza doverlo cercare fra gli altri trenta.
  const [modificaPer, setModificaPer] = useState(null)

  async function load() {
    try {
      const [sups, invs, its, list, ords] = await Promise.all([
        fetchSuppliers(),
        fetchSupplierInvoices({ limit: 200 }),
        // Lo scadenzario deve reggere anche se il magazzino non risponde: la
        // testata dei documenti è la cosa che serve sempre, i prodotti sono
        // un di più.
        fetchInventoryItems().catch(() => []),
        fetchSupplierPrices().catch(() => []),
        fetchPurchaseOrders().catch(() => []),
      ])
      setSuppliers(sups)
      setInvoices(invs)
      setItems(its)
      setListini(list)
      setOrdini(ords)
    } catch (e) {
      setError(e.message)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const totals = useMemo(() => invoiceTotals(invoices), [invoices])
  const visible = useMemo(
    () =>
      invoices.filter((i) => {
        if (supplierFilter !== 'all' && i.supplier_id !== supplierFilter) return false
        if (onlyUnpaid && i.paid) return false
        if (soloSenzaOrdine && elencoOrdini(i).length > 0) return false
        if (soloSenzaAllegato && allegatoDi(i)) return false
        return true
      }),
    [invoices, supplierFilter, onlyUnpaid, soloSenzaOrdine, soloSenzaAllegato]
  )

  // IL MAGAZZINO IN SOLA LETTURA VALE ANCHE QUI (BUG-029): finché il
  // travaso non è fatto, il carico sommerebbe pezzi a giacenze ancora
  // scritte alla vecchia maniera. Le righe della fattura invece si
  // aggiungono lo stesso — sono carta, non giacenze. La regola sta in
  // inventory.js e la si chiede, non la si riscrive.
  const bloccato = useMemo(() => magazzinoBloccato(items), [items])

  // NIENTE `await` PRIMA DI MOSTRARE L'ESITO: `aggiungiProdottiAFattura`
  // compone il documento aggiornato in memoria e le scritture partono in
  // sottofondo.
  function aggiungiProdotti(righe, carica, order_id) {
    const fattura = prodottiPer
    setProdottiPer(null)
    setError(null)
    aggiungiProdottiAFattura(fattura.id, { righe, carica, order_id }).then(
      (agg) => setInvoices((prev) => prev.map((i) => (i.id === agg.id ? agg : i))),
      (e) => setError(e.message)
    )
  }

  // Attaccare e staccare sono lo stesso gesto al contrario, e passano dalla
  // stessa strada: `order_id` a null li stacca tutti, `stacca` ne toglie uno.
  function collega(fattura, order_id, stacca = false) {
    setCollegaPer(null)
    setError(null)
    collegaFatturaAFetta(fattura.id, { order_id, stacca }).then(
      (agg) => setInvoices((prev) => prev.map((i) => (i.id === agg.id ? agg : i))),
      (e) => setError(e.message)
    )
  }

  // ── CORREGGERE UN DOCUMENTO (REQ-MAG-041) ──────────────────────────
  //
  // «I documenti creati devono essere modificabili nel caso di variazione o
  // errore» (Flavio, 03/09/2026). NIENTE `await` PRIMA DI MOSTRARE L'ESITO:
  // `modificaFattura` compone il documento corretto in memoria e la scrittura
  // parte in sottofondo. Se la correzione non e' ammessa il modulo resta
  // aperto: chiuderlo butterebbe via quello che si e' appena scritto.
  function salvaModifica(fattura, dati) {
    setError(null)
    try {
      const agg = modificaFattura(fattura, dati)
      setInvoices((prev) => prev.map((i) => (i.id === agg.id ? agg : i)))
      setModificaPer(null)
    } catch (e) {
      setError(e.message)
    }
  }

  // ── L'ALLEGATO (REQ-MAG-033) ───────────────────────────────────────
  //
  // Scegliere il file apre la casella nascosta, e chi ha chiesto se lo
  // ricorda: il gesto parte dalla riga, il file arriva dal sistema.
  function scegliAllegato(inv) {
    perAllegare.current = inv.id
    setError(null)
    fileRef.current?.click()
  }

  async function allegaScelto(e) {
    const file = e.target.files?.[0]
    const id = perAllegare.current
    // La casella si svuota SEMPRE, anche quando non si è scelto niente:
    // senza, riscegliere lo stesso file due volte di fila non farebbe
    // scattare nessun cambiamento e sembrerebbe un tasto rotto.
    if (fileRef.current) fileRef.current.value = ''
    perAllegare.current = null
    if (!file || !id) return
    setError(null)
    setAllegando(id)
    try {
      const agg = await allegaDocumentoAFattura(id, file)
      setInvoices((prev) => prev.map((i) => (i.id === agg.id ? agg : i)))
    } catch (err) {
      // IL DOCUMENTO RESTA COM'ERA: se il caricamento non riesce, la riga in
      // pagina non si tocca — mostrare un allegato che non è mai partito
      // sarebbe peggio del caricamento fallito.
      setError(err.message)
    } finally {
      setAllegando(null)
    }
  }

  async function togliAllegato(inv) {
    const quale = nomeDocumento(inv)
    if (!confirm(tr('Togliere l’allegato dal documento di {nome}? Il file viene cancellato.', { nome: quale }))) return
    setError(null)
    try {
      const agg = await togliAllegatoDaFattura(inv.id)
      setInvoices((prev) => prev.map((i) => (i.id === agg.id ? agg : i)))
    } catch (err) {
      setError(err.message)
    }
  }

  async function togglePaid(inv) {
    setError(null)
    // Aggiornamento ottimistico.
    setInvoices((prev) => prev.map((i) => (i.id === inv.id ? { ...i, paid: !i.paid } : i)))
    try {
      await updateSupplierInvoice(inv.id, { paid: !inv.paid })
    } catch (e) {
      setError(e.message)
      await load()
    }
  }

  async function remove(inv) {
    if (!confirm(tr('Eliminare il documento {numero} di {nome}?', { numero: inv.number || '', nome: inv.supplier_name })))
      return
    try {
      await deleteSupplierInvoice(inv.id)
      setInvoices((prev) => prev.filter((i) => i.id !== inv.id))
    } catch (e) {
      setError(e.message)
    }
  }

  async function handleCreate(data) {
    setBusy(true)
    setError(null)
    try {
      await createSupplierInvoice(data)
      setAdding(false)
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      {error && <div className="banner">{tr('Errore: {errore}', { errore: error })}</div>}

      {/* `accept` LARGO APPOSTA: elencando i tipi uno per uno, su Android
          certi telefoni smettono di offrire la fotocamera — ed è proprio da
          lì che arriva una fattura. La selezione la stringe il controllo in
          `allegati.js`, che sa anche dirlo con parole. */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf"
        aria-label={tr('Il file da allegare al documento')}
        style={{ display: 'none' }}
        onChange={allegaScelto}
      />

      <div className="inv-summary">
        <span className="chip" style={{ cursor: 'default' }}>
          {tr('Da pagare')} <strong>{formatPrice(totals.unpaid)}</strong>
        </span>
        <button className={`chip ${onlyUnpaid ? 'active' : ''}`} onClick={() => setOnlyUnpaid((v) => !v)}>
          {tr('Solo da pagare')}
        </button>
        <button
          className={`chip ${soloSenzaOrdine ? 'active' : ''}`}
          onClick={() => setSoloSenzaOrdine((v) => !v)}
        >
          {tr('Senza ordine ({n})', { n: fattureSenzaFetta(invoices).length })}
        </button>
        {/* Lo stesso mestiere del chip qui accanto (REQ-MAG-031): un buco si
            conta in testa e si isola con un tocco. */}
        <button
          className={`chip ${soloSenzaAllegato ? 'active' : ''}`}
          onClick={() => setSoloSenzaAllegato((v) => !v)}
        >
          {tr('Senza allegato ({n})', { n: fattureSenzaAllegato(invoices).length })}
        </button>
      </div>

      {totals.bySupplier.length > 0 && (
        <div className="muted small" style={{ margin: '0 4px 8px' }}>
          {totals.bySupplier.map((s) => `${s.supplier_name || '—'}: ${formatPrice(s.unpaid)}`).join(' · ')}
        </div>
      )}

      {suppliers.length > 0 && (
        <div className="chips-row">
          <button className={`chip ${supplierFilter === 'all' ? 'active' : ''}`} onClick={() => setSupplierFilter('all')}>
            {tr('Tutti')}
          </button>
          {suppliers.map((s) => (
            <button
              key={s.id}
              className={`chip ${supplierFilter === s.id ? 'active' : ''}`}
              onClick={() => setSupplierFilter(s.id)}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {adding ? (
        <InvoiceForm suppliers={suppliers} busy={busy} onCancel={() => setAdding(false)} onSave={handleCreate} />
      ) : leggendo ? (
        <FatturaDaAI
          suppliers={suppliers}
          items={items}
          listini={listini}
          onAnnulla={() => setLeggendo(false)}
          onRegistrata={({ avviso }) => {
            setLeggendo(false)
            if (avviso) setError(avviso)
            load()
          }}
        />
      ) : (
        <div className="grid-2">
          <button className="btn block" onClick={() => setAdding(true)}>
            + {tr('Nuovo documento')}
          </button>
          {/* Dove l'AI non arriva (piano Free, demo) il tasto non c'è, e
              «Nuovo documento» prende tutta la riga. */}
          {aiRaggiungibile() && (
            <TastoAI className="btn ghost block" onClick={() => setLeggendo(true)}>
              {tr('Leggi con l’AI')}
            </TastoAI>
          )}
        </div>
      )}

      <div className="inv-list" style={{ marginTop: 8 }}>
        {visible.map((inv) => (
          <div className="inv-item" key={inv.id}>
            {modificaPer === inv.id ? (
              <InvoiceForm
                suppliers={suppliers}
                busy={false}
                fattura={inv}
                onCancel={() => setModificaPer(null)}
                onSave={(dati) => salvaModifica(inv, dati)}
              />
            ) : (
            <div className="inv-row" style={{ cursor: 'default' }}>
              <div className="grow">
                <div className="inv-name">
                  {inv.supplier_name || '—'} {inv.number && <span className="muted small">#{inv.number}</span>}
                </div>
                <div className="muted small">
                  {inv.date || '—'} · {etichettaTipoDocumento(inv.doc_type)}
                  {inv.notes && ` · ${inv.notes}`}
                </div>
                {/* GENERATA DA NOI, NON ARRIVATA DAL FORNITORE
                    (REQ-MAG-038): la cifra si legge uguale, ma la prima dice
                    quanto ci si aspetta di pagare e la seconda quanto lui
                    chiede. Il documento vero si allega qui sotto. */}
                {fatturaGenerata(inv) && (
                  <span className="pill small">{tr('Generata dall’ordine')}</span>
                )}
              </div>
              <div className="inv-qty">
                {/* IL VERDE E IL MENO, INSIEME (BUG-100). Flavio: «il colore
                    deve apparire in un altro colore, preferibilmente verde».
                    Il colore da solo non basta — si legge su un telefono al
                    banco, di sera, e un numero colorato resta un numero che
                    si somma: il segno lo dice anche a chi non lo vede. */}
                <div className={eNotaDiCredito(inv) ? 'importo-nota-credito' : undefined}>
                  {importoLeggibile(inv)}
                </div>
                <button
                  className={inv.paid ? 'chip active' : 'chip'}
                  style={{ marginTop: 4 }}
                  onClick={() => togglePaid(inv)}
                >
                  <ConIcona testo={etichettaSaldo(inv)} />
                </button>
              </div>
              <button
                className="btn ghost small"
                aria-label={tr('Modifica il documento di {nome}', { nome: nomeDocumento(inv) })}
                onClick={() => {
                  setAdding(false)
                  setModificaPer(inv.id)
                }}
              >
                <Icona nome="modifica" gruppo="tasti" />
              </button>
              <button
                className="btn ghost small"
                onClick={() => remove(inv)}
                aria-label={tr('Elimina')}
                title={tr('Elimina')}
              >
                <Icona nome="elimina" gruppo="tasti" />
              </button>
            </div>
            )}

            {/* I PRODOTTI DEL DOCUMENTO (REQ-MAG-030). Il tasto sta SOTTO la
                fattura, ed è quello che li mette: prima di questa voce una
                fattura era solo una testata. Non si chiama «carico» apposta
                — Flavio: «dobbiamo usare un'altra dicitura sicuramente» —
                perché il carico a magazzino è una conseguenza, e per giunta
                facoltativa. */}
            <RigheDelDocumento fattura={inv} />
            {/* IL LEGAME CON LA FETTA (REQ-MAG-031). Un documento senza
                ordine non è un errore — può essere una spesa telefonata al
                fornitore — ma a fine mese è una delle due cose che fanno
                tornare o non tornare i conti, e va vista senza cercarla. */}
            <LegameConLOrdine
              fattura={inv}
              ordini={ordini}
              suppliers={suppliers}
              onCollega={() => setCollegaPer(inv)}
              onScollega={(order_id) => collega(inv, order_id, true)}
            />
            {/* IL DOCUMENTO VERO (REQ-MAG-033). «Allegare = il documento
                vero (foto/PDF), non solo un numero» (l'utente, 20/08): il
                numero dice quale fattura è, la carta è quella che il
                commercialista chiede. */}
            <AllegatoDelDocumento
              fattura={inv}
              caricando={allegando === inv.id}
              onAllega={() => scegliAllegato(inv)}
              onTogli={() => togliAllegato(inv)}
            />
            <button
              className="btn secondary small block"
              style={{ marginTop: 6 }}
              onClick={() => setProdottiPer(inv)}
            >
              <Icona nome="aggiungi" gruppo="tasti" /> {tr('Aggiungi prodotti')}
            </button>
            {/* COSA È STATO CORRETTO (REQ-MAG-041): una modifica su un
                documento già pagato è legittima, ma è il gesto che a fine
                mese qualcuno vorrà spiegarsi. */}
            <LeCorrezioni fattura={inv} />
          </div>
        ))}
      </div>

      {visible.length === 0 && <div className="empty">{tr('Nessun documento.')}</div>}

      {prodottiPer && (
        <DialogoProdotti
          fattura={prodottiPer}
          items={items}
          listini={listini}
          ordini={ordini}
          fatture={invoices}
          suppliers={suppliers}
          bloccato={bloccato}
          onCancel={() => setProdottiPer(null)}
          onConfirm={aggiungiProdotti}
        />
      )}

      {collegaPer && (
        <DialogoOrdine
          fattura={collegaPer}
          ordini={ordini}
          fatture={invoices}
          suppliers={suppliers}
          onCancel={() => setCollegaPer(null)}
          onConfirm={(orderId) => collega(collegaPer, orderId)}
        />
      )}
    </div>
  )
}

// Quello che la fattura ha già dentro. «Caricati» dice che quella merce è
// entrata in magazzino da qui: senza quel segno, la volta dopo nessuno
// saprebbe più se le giacenze sono già state alzate.
function RigheDelDocumento({ fattura }) {
  const righe = righeFattura(fattura)
  if (righe.length === 0) return null
  const totali = totaliRigheFattura(righe)
  const caricate = righe.filter((l) => l.caricata).length
  return (
    <div className="muted small" style={{ margin: '4px 4px 0' }}>
      {righe.map((l) => `${l.qty_packages}× ${l.name}`).join(', ')}
      {' · '}
      {tr('netto {importo}', { importo: formatPrice(totali.net) })}
      {caricate > 0
        ? ` · ${caricate === righe.length ? tr('caricati a magazzino') : tr('{n} caricati a magazzino', { n: caricate })}`
        : ''}
    </div>
  )
}

// Come si nomina una fetta in un elenco: la data dell'ordine, quanti
// articoli e il netto. Il fornitore non ci va — sono tutte dello stesso
// fornitore, e ripeterlo toglierebbe spazio ai numeri che le distinguono.
function etichettaFetta(fetta) {
  return tr('{data} · {n} art. · netto {netto}', {
    data: String(fetta.created_at || '').slice(0, 10),
    n: fetta.lines.length,
    netto: formatPrice(fetta.total_net),
  })
}

// ── A QUALE PARTE DI QUALE ORDINE SI RIFERISCE ───────────────────────
//
// «La fattura è collegata all'ordine PER IL FORNITORE, perché è il
// fornitore che rilascia la fattura» (l'utente, 20/08). Qui si legge il
// legame dal lato del documento; dal lato dell'ordine lo mostra la fetta.
//
// L'ambra e non il rosso: un documento senza ordine non è un errore, è
// lavoro che manca (DESIGN.md — il rosso qui vuol dire annullato).
function LegameConLOrdine({ fattura, ordini, suppliers, onCollega, onScollega }) {
  // UN DOCUMENTO PUÒ COPRIRE PIÙ ORDINI (19/09/2026). Flavio: «sotto una
  // fattura devo poter aggiungere un ordine, e poi dopo ci deve essere
  // aggiungi altro ordine oppure scollega gli ordini». Nel weekend la merce
  // arriva senza carta e il lunedì il fornitore fa un documento solo per
  // tutto quello che ha portato.
  const righe = fetteDellaFattura(fattura, ordini, { suppliers })
  const quale = nomeDocumento(fattura)
  if (righe.length === 0) {
    return (
      <div className="row between" style={{ alignItems: 'center', gap: 8, margin: '4px 4px 0' }}>
        <span className="badge-low">{tr('senza ordine')}</span>
        <button
          className="btn ghost small"
          aria-label={tr('Collega a un ordine il documento di {nome}', { nome: quale })}
          onClick={onCollega}
        >
          <Icona nome="unisci" gruppo="tasti" /> {tr('Collega a un ordine')}
        </button>
      </div>
    )
  }
  return (
    <div style={{ margin: '4px 4px 0' }}>
      {righe.map(({ order_id, fetta }) => (
        <div className="row between" style={{ alignItems: 'center', gap: 8 }} key={order_id}>
          <span className="muted small grow" style={{ minWidth: 0 }}>
            {/* In mano ci sono gli ultimi venticinque ordini: di uno più
                vecchio si sa che il legame c'è, non cosa contiene — e dirlo
                è meglio che far sparire il legame. */}
            {fetta ? tr('Ordine {dettaglio}', { dettaglio: etichettaFetta(fetta) }) : tr('Ordine collegato')}
          </span>
          <button
            className="btn ghost small"
            aria-label={tr('Scollega questo ordine dal documento di {nome}', { nome: quale })}
            onClick={() => onScollega(order_id)}
          >
            {tr('Scollega')}
          </button>
        </div>
      ))}
      {/* «Aggiungi un altro ordine» e non «Collega»: qui ce n'è già almeno
          uno, e la parola deve dire che si somma invece di sostituire. */}
      <button
        className="btn ghost small"
        style={{ marginTop: 4 }}
        aria-label={tr('Aggiungi un altro ordine al documento di {nome}', { nome: quale })}
        onClick={onCollega}
      >
        ＋ {tr('Aggiungi un altro ordine')}
      </button>
    </div>
  )
}

// ── IL DOCUMENTO VERO: FOTO O PDF (REQ-MAG-033) ──────────────────────
//
// Stesso linguaggio del legame con l'ordine, qui sopra, e non un terzo modo
// di dire la stessa cosa: l'ambra della mancanza, il tasto a destra, il
// conto in testa alla pagina. Un documento senza allegato non è un errore —
// è la carta che manca, e la si cerca a fine mese.
//
// SI DICE PRIMA COSA CI STA: formati e peso sono sul tasto, non in un errore
// che arriva dopo aver aspettato il caricamento di una foto da cinque mega.
function AllegatoDelDocumento({ fattura, caricando, onAllega, onTogli }) {
  const allegato = allegatoDi(fattura)
  const quale = nomeDocumento(fattura)

  if (caricando) {
    return (
      <div className="muted small" style={{ margin: '4px 4px 0' }}>
        {tr('Carico l’allegato…')}
      </div>
    )
  }

  return (
    <div className="row between" style={{ alignItems: 'center', gap: 8, margin: '4px 4px 0' }}>
      {allegato ? (
        <>
          <span className="muted small grow" style={{ minWidth: 0 }}>
            <Icona nome="allegato" gruppo="tasti" />{' '}{allegato.name} · {pesoLeggibile(allegato.size)}
          </span>
          {/* UN LINK E NON UN TASTO: sul telefono apre la foto o il PDF con
              quello che la persona usa già per guardarli, e funziona anche
              tenendo premuto per salvarlo. */}
          <a
            className="btn ghost small"
            href={allegato.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={tr('Apri l’allegato del documento di {nome}', { nome: quale })}
          >
            {tr('Apri')}
          </a>
          <button
            className="btn ghost small"
            aria-label={tr('Sostituisci l’allegato del documento di {nome}', { nome: quale })}
            onClick={onAllega}
          >
            {tr('Sostituisci')}
          </button>
          <button
            className="btn ghost small"
            aria-label={tr('Togli l’allegato dal documento di {nome}', { nome: quale })}
            onClick={onTogli}
          >
            {tr('Togli')}
          </button>
        </>
      ) : fattura.doc_type === DOC_NESSUNO ? (
        // «NESSUN DOCUMENTO» DICE GIÀ CHE NON C'È NIENTE DA ALLEGARE: il
        // chip ambra su quella riga sarebbe un lavoro che manca segnalato a
        // chi ha appena dichiarato che non esiste, ed è così che si impara a
        // ignorare gli avvisi. Il tasto per allegare resta, perché una
        // ricevuta può arrivare dopo.
        <>
          <span className="muted small grow" style={{ minWidth: 0 }}>
            {tr('Nessun documento da allegare.')}
          </span>
          <button
            className="btn ghost small"
            aria-label={tr('Allega il documento di {nome}', { nome: quale })}
            onClick={onAllega}
          >
            <Icona nome="allegato" gruppo="tasti" /> {tr('Allega')}
          </button>
        </>
      ) : (
        <>
          <span className="badge-low">{tr('senza allegato')}</span>
          <button
            className="btn ghost small"
            aria-label={tr('Allega il documento di {nome}', { nome: quale })}
            onClick={onAllega}
          >
            <Icona nome="allegato" gruppo="tasti" />{' '}
            {tr('Allega foto o PDF, fino a {peso}', { peso: pesoLeggibile(PESO_MASSIMO) })}
          </button>
        </>
      )}
    </div>
  )
}

// La scelta dell'ordine, per chi parte dal documento. Le fette proposte sono
// solo quelle dello stesso fornitore e ancora libere: il fornitore sbagliato
// e la fetta già coperta non si possono nemmeno scegliere, che è meglio che
// spiegarli dopo con un errore.
function DialogoOrdine({ fattura, ordini, fatture, suppliers, onCancel, onConfirm }) {
  const [scelto, setScelto] = useState('')
  const fette = useMemo(
    () => fetteCollegabili(fattura, ordini, { suppliers, fatture }),
    [fattura, ordini, suppliers, fatture]
  )
  const nome = fattura.supplier_name || tr('questo fornitore')
  return (
    <div className="overlay confirm-overlay" onClick={onCancel}>
      <div className="confirm-box" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>
          <Icona nome="unisci" gruppo="tasti" /> {tr('Collega a un ordine')}
        </h3>
        <p className="muted">
          {tr('Il documento si collega alla parte dell’ordine di {nome}: un ordine può contenere più fornitori, e ognuno rilascia la sua fattura.', { nome })}
        </p>
        {fette.length === 0 ? (
          <p className="muted small">
            {tr('Nessun ordine di {nome} da collegare: o non ce ne sono fra gli ultimi, o la loro parte ha già un documento.', { nome })}
          </p>
        ) : (
          <>
            <label htmlFor="fo-ordine">{tr('Ordine')}</label>
            <select id="fo-ordine" value={scelto} onChange={(e) => setScelto(e.target.value)}>
              <option value="">{tr('— Scegli un ordine —')}</option>
              {fette.map((f) => (
                <option key={f.order_id} value={f.order_id}>
                  {etichettaFetta(f)}
                </option>
              ))}
            </select>
          </>
        )}
        <div className="row" style={{ gap: 10, marginTop: 16 }}>
          <button className="btn ghost grow" onClick={onCancel}>
            {tr('Annulla')}
          </button>
          <button className="btn grow" disabled={!scelto} onClick={() => onConfirm(scelto)}>
            {tr('Collega')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── COSA È STATO CORRETTO, E QUANDO (REQ-MAG-041) ────────────────────
//
// Stesso mestiere della storia dell'ordine, e stessi attrezzi: `storiaDi`
// per leggere l'array, `descriviMovimento` per la frase. Dal più recente,
// perché la domanda è «cos'è successo ultimamente a questo documento».
//
// Il blocco non c'è finché non c'è niente da dire: un «nessuna correzione»
// su trenta documenti sarebbe rumore su una schermata già fitta.
function LeCorrezioni({ fattura }) {
  const voci = storiaDi(fattura)
  if (voci.length === 0) return null
  return (
    <div className="muted small" style={{ margin: '6px 4px 0' }}>
      <strong>{tr('Correzioni')}</strong>
      <ul className="ordine-storia">
        {[...voci].reverse().map((v, k) => (
          <li key={`${v.at}-${k}`}>
            <span className="muted small">{giornoEOra(v.at)}</span>{' '}
            {descriviMovimento(v, { etichettaTipo: etichettaTipoDocumento })}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── IL MODULO: LO STESSO PER CREARE E PER CORREGGERE (REQ-MAG-041) ───
//
// I campi sono gli stessi — è lo stesso documento — e due copie del modulo
// prima o poi divergono: una impara a chiedere il fornitore e l'altra no.
// Passando una `fattura` il modulo corregge quella; senza, ne crea una nuova.
//
// COSA NON SI CORREGGE DA QUI: righe, allegato e legame con l'ordine. Ognuno
// ha già il suo gesto, che sa fare anche le cose attorno (il carico a
// magazzino, il file da cancellare su Storage, la guardia sulla fetta già
// coperta), e passarli di qui vorrebbe dire una seconda strada che quelle
// cose non le fa. Nemmeno «pagato»: quello è il tasto sulla riga, e resta
// uno solo.
function InvoiceForm({ suppliers, busy, fattura = null, onCancel, onSave }) {
  const modifica = !!fattura
  // UN DOCUMENTO IN ARCHIVIO PUÒ AVERE IL NOME VECCHIO: «Reso» e «Nota di
  // credito» sono la stessa cosa (BUG-100), e la tendina non troverebbe
  // niente da selezionare — chi salva si ritroverebbe il tipo cambiato senza
  // averlo chiesto. Il modulo mostra il nome nuovo. Un tipo che non conosce
  // affatto se lo tiene invece com'è, per la stessa ragione.
  const tipoIniziale = !modifica
    ? 'Proforma'
    : eNotaDiCredito(fattura)
      ? DOC_NOTA_CREDITO
      : fattura.doc_type || 'Proforma'
  const tipi = TIPI_DOCUMENTO.includes(tipoIniziale)
    ? TIPI_DOCUMENTO
    : [...TIPI_DOCUMENTO, tipoIniziale]

  const [form, setForm] = useState({
    supplier_id: fattura?.supplier_id || '',
    number: fattura?.number || '',
    doc_type: tipoIniziale,
    date: fattura?.date || new Date().toISOString().slice(0, 10),
    amount: modifica ? String(fattura.amount ?? '') : '',
    paid: !!fattura?.paid,
    notes: fattura?.notes || '',
  })
  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  // DUE MODULI APERTI INSIEME AVREBBERO GLI STESSI `id`, e ogni etichetta
  // punterebbe al primo: si scriverebbe in un campo e si vedrebbe muovere
  // quello di un altro documento.
  const campo = (nome) => `if-${fattura?.id || 'nuovo'}-${nome}`

  // IL FORNITORE DI UN DOCUMENTO AGGANCIATO NON SI CAMBIA: il legame con
  // l'ordine È la coppia ordine + fornitore (REQ-MAG-031). La regola sta in
  // `modificaAmmessa` e qui si spegne il campo, così non si spiega dopo con
  // un errore quello che si può impedire prima.
  const fornitoreBloccato = modifica && elencoOrdini(fattura).length > 0

  function submit(e) {
    e.preventDefault()
    if (!form.supplier_id || form.amount === '') return
    const sup = suppliers.find((s) => s.id === form.supplier_id)
    onSave({
      supplier_id: form.supplier_id,
      supplier_name: sup?.name ?? fattura?.supplier_name ?? '',
      number: form.number.trim() || null,
      doc_type: form.doc_type,
      date: form.date,
      amount: Number(String(form.amount).replace(',', '.')) || 0,
      notes: form.notes.trim() || null,
      // «PAGATO» NON ESCE DA QUI QUANDO SI CORREGGE: il suo tasto è quello
      // sulla riga, e resta uno solo (REQ-MAG-038). Alla creazione invece
      // serve, perché una riga «Nessun documento» nasce già pagata.
      ...(modifica ? {} : { paid: !!form.paid }),
    })
  }

  return (
    <form className="card" onSubmit={submit}>
      <strong>
        {modifica ? tr('Correggi il documento di {nome}', { nome: nomeDocumento(fattura) }) : tr('Nuovo documento')}
      </strong>
      {modifica && (
        <p className="muted small" style={{ marginTop: 2 }}>
          {tr('Prodotti, allegato e ordine collegato restano come sono. La correzione resta scritta sotto il documento.')}
        </p>
      )}

      <label htmlFor={campo('sup')} style={{ marginTop: 8 }}>
        {tr('Fornitore *')}
      </label>
      <select
        id={campo('sup')}
        value={form.supplier_id}
        onChange={set('supplier_id')}
        disabled={fornitoreBloccato}
        required
      >
        <option value="">{tr('— Scegli —')}</option>
        {suppliers.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
      {fornitoreBloccato && (
        <p className="muted small">
          {tr('Il documento è collegato a un ordine di questo fornitore: per cambiarlo, scollega prima l’ordine.')}
        </p>
      )}

      <div className="grid-2">
        <div>
          <label htmlFor={campo('num')}>{tr('Numero doc.')}</label>
          <input id={campo('num')} value={form.number} onChange={set('number')} placeholder={tr('Es. 1556')} />
        </div>
        <div>
          <label htmlFor={campo('date')}>{tr('Data')}</label>
          <input id={campo('date')} type="date" value={form.date} onChange={set('date')} />
        </div>
      </div>

      <div className="grid-2">
        <div>
          <label htmlFor={campo('type')}>{tr('Tipo')}</label>
          {/* «NESSUN DOCUMENTO» È UN TIPO COME GLI ALTRI (REQ-MAG-038):
              «il caso di pagare un fornitore senza fattura non c'è. Anche se
              può capitare, io creerò SEMPRE un item nello scadenzario che
              paga un ordine anche senza fattura allegata» (utente, 27/08).
              Il contante al piccolo fornitore deve comparire nel totale del
              mese come tutti gli altri soldi che escono. */}
          <select id={campo('type')} value={form.doc_type} onChange={set('doc_type')}>
            {/* Il valore è quello che si salva, sempre italiano; il testo
                è l'etichetta nella lingua di chi guarda (REQ-UI-039). */}
            {tipi.map((t) => (
              <option key={t} value={t}>
                {etichettaTipoDocumento(t)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={campo('amount')}>{tr('Importo € *')}</label>
          <input
            id={campo('amount')}
            type="number"
            step="any"
            min="0"
            value={form.amount}
            onChange={set('amount')}
            required
          />
        </div>
      </div>
      {/* L'IMPORTO SI SCRIVE COM'È SCRITTO SULLA CARTA (BUG-100): chi batte
          una nota di credito ha in mano un foglio con 120, non −120. Il
          segno lo mette il tipo di documento, e va detto qui perché è
          l'istante in cui uno si chiede se deve metterlo lui. */}
      {form.doc_type === DOC_NOTA_CREDITO && (
        <p className="muted small">
          {tr('L’importo si scrive positivo: una nota di credito viene sottratta dai totali dello scadenzario.')}
        </p>
      )}

      <label htmlFor={campo('notes')}>{tr('Note')}</label>
      <input
        id={campo('notes')}
        value={form.notes}
        onChange={set('notes')}
        placeholder={tr('Es. differenza di prezzo sulla fattura 1556')}
      />

      {/* «GIÀ PAGATO» SOLO ALLA CREAZIONE: correggendo, il pagamento resta il
          tasto sulla riga. Due posti per dire la stessa cosa vogliono dire
          due stati da tenere allineati. */}
      {!modifica && (
        <label className="row" style={{ marginTop: 10 }}>
          <input type="checkbox" style={{ width: 'auto' }} checked={form.paid} onChange={set('paid')} />
          <span>{tr('Già pagato')}</span>
        </label>
      )}

      <div className="grid-2" style={{ marginTop: 12 }}>
        <button type="button" className="btn ghost" onClick={onCancel} disabled={busy}>
          {tr('Annulla')}
        </button>
        <button type="submit" className="btn" disabled={busy}>
          {modifica ? tr('Salva le correzioni') : tr('Salva')}
        </button>
      </div>
    </form>
  )
}

// ── «AGGIUNGI PRODOTTI»: PRIMA I PRODOTTI, POI LA DOMANDA SUL PREZZO ──
//
// Flavio, 26/08/2026: «ci mettiamo anche i prodotti, in modo tale che li va
// già a caricare all'interno dei prodotti di magazzino. Sempre che poi dopo
// mi fa la domanda se voglio aggiornare il prezzo — nel caso lo vado a
// modificare — oppure lasciarlo invariato, così, senza carico, perché
// magari me li sono caricati già prima in altro modo».
//
// Da quella frase escono le tre regole di questa finestra:
//  1. i prodotti si aggiungono al DOCUMENTO, sempre;
//  2. il CARICO a magazzino è una scelta a parte, che si può dire di no;
//  3. il PREZZO si chiede solo dove è cambiato, e il pre-impostato è
//     «lascia com'è»: chi non risponde non muove niente.
function DialogoProdotti({ fattura, items, listini, ordini, fatture, suppliers, bloccato, onCancel, onConfirm }) {
  const [query, setQuery] = useState('')
  const [righe, setRighe] = useState([])
  // L'ordine da cui si riprendono le righe È l'ordine a cui il documento
  // resta agganciato: si parte da quello che ha già, se ce l'ha.
  const [ordineScelto, setOrdineScelto] = useState(elencoOrdini(fattura)[0] || '')
  // Col magazzino ancora da travasare il carico non si può fare (BUG-029),
  // ma le righe sì: la casella parte spenta e resta spenta.
  const [carica, setCarica] = useState(!bloccato)
  // Il `rid` è un numero interno che non cambia mai: se la chiave della riga
  // fosse il prodotto, aggiungendo due volte lo stesso React rimonterebbe i
  // campi e la quantità appena scritta sparirebbe.
  const prossimoRid = useRef(1)

  const supplierId = fattura.supplier_id ?? null
  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
  const trovati = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return items.filter((i) => (i.name || '').toLowerCase().includes(q))
  }, [items, query])

  // RIPRENDERE LE RIGHE E COLLEGARE LA FATTURA SONO LO STESSO GESTO
  // (REQ-MAG-031). Erano due cose separate: le righe si copiavano e il
  // legame restava non scritto proprio nell'istante in cui uno l'aveva
  // appena dimostrato — «questa fattura è di quest'ordine» — e a fine mese
  // quella fetta risultava senza documento. Da qui la scelta di unirli: si
  // sta ricopiando il documento dall'ordine che l'ha generato, ed è un gesto
  // solo. Chi vuole il legame senza le righe ha «Collega a un ordine» sulla
  // riga del documento; chi vuole le righe senza il legame le cerca per
  // nome, come per un documento qualsiasi.
  const collegabili = useMemo(
    () => fetteCollegabili(fattura, ordini, { suppliers, fatture }),
    [fattura, ordini, suppliers, fatture]
  )

  function aggiungi(item) {
    setRighe((prev) => [
      ...prev,
      {
        rid: prossimoRid.current++,
        aggiorna_prezzo: false,
        ...rigaDaProdotto(item, { listini, supplierId }),
      },
    ])
  }

  function riprendi(orderId) {
    const ordine = ordini.find((o) => o.id === orderId)
    if (!ordine) return
    setOrdineScelto(orderId)
    const copiate = righeDaOrdine(ordine, supplierId)
    setRighe(copiate.map((r) => ({ rid: prossimoRid.current++, aggiorna_prezzo: false, ...r })))
    // QUELLA MERCE È GIÀ IN MAGAZZINO: è entrata alla consegna dell'ordine.
    // Caricarla una seconda volta è l'errore da impedire, e qui si impedisce
    // spegnendo la casella invece di lasciarla accesa per abitudine.
    if (copiate.some((r) => r.gia_caricata)) setCarica(false)
  }

  const cambia = (rid, campo, valore) =>
    setRighe((prev) => prev.map((r) => (r.rid === rid ? { ...r, [campo]: valore } : r)))
  const togli = (rid) => setRighe((prev) => prev.filter((r) => r.rid !== rid))

  const totali = totaliRigheFattura(righe)
  const daOrdine = righe.some((r) => r.gia_caricata)

  return (
    <div className="overlay confirm-overlay" onClick={onCancel}>
      <div className="confirm-box" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>
          <Icona nome="aggiungi" gruppo="tasti" />{' '}
          {tr('Prodotti di {nome}', { nome: fattura.supplier_name || tr('questo fornitore') })}
          {fattura.number ? ` #${fattura.number}` : ''}
        </h3>
        <p className="muted">
          {tr('I prodotti restano sul documento. Il carico a magazzino si sceglie qui sotto, ed è una cosa a parte.')}
        </p>

        {collegabili.length > 0 && (
          <>
            <label htmlFor="fp-ordine">{tr('Riprendi le righe da un ordine, e collegalo')}</label>
            <select id="fp-ordine" value={ordineScelto} onChange={(e) => riprendi(e.target.value)}>
              <option value="">{tr('— Scegli un ordine —')}</option>
              {collegabili.map((f) => (
                <option key={f.order_id} value={f.order_id}>
                  {etichettaFetta(f)}
                </option>
              ))}
            </select>
            <AiutoCampo style={{ margin: '4px 0 0' }}>
              {ordineScelto
                ? tr('Il documento resta collegato alla parte dell’ordine che riguarda questo fornitore.')
                : tr('Le righe si copiano dall’ordine e il documento vi resta collegato.')}
            </AiutoCampo>
          </>
        )}

        <label htmlFor="fp-cerca" style={{ marginTop: 8 }}>
          {tr('Cerca un prodotto')}
        </label>
        <input
          id="fp-cerca"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={tr('Es. Campari')}
        />

        {query.trim() !== '' && trovati.length === 0 && (
          <p className="muted small" style={{ marginTop: 6 }}>
            {tr('Nessun prodotto corrisponde alla ricerca.')}
          </p>
        )}

        <div className="inv-list">
          {trovati.slice(0, LIMITE_RICERCA).map((it) => (
            <div className="inv-row" key={it.id}>
              <div className="inv-row-main">
                <span className="grow" style={{ minWidth: 0 }}>
                  <span className="inv-row-name">{it.name}</span>
                  <span className="muted small" style={{ display: 'block' }}>
                    {tr('In casa: {qta}', { qta: formatQty(it.stock, it.unit) })}
                    {contenutoDelPezzo(it) ? ` · ${tr('1 pz = {contenuto}', { contenuto: contenutoDelPezzo(it) })}` : ''}
                  </span>
                </span>
                <button
                  className="btn small"
                  aria-label={tr('Aggiungi {nome}', { nome: it.name })}
                  onClick={() => aggiungi(it)}
                >
                  ＋
                </button>
              </div>
            </div>
          ))}
        </div>
        {trovati.length > LIMITE_RICERCA && (
          <p className="muted small" style={{ marginTop: 6 }}>
            {tr('Mostrati {n} prodotti su {totale}: restringi la ricerca.', { n: LIMITE_RICERCA, totale: trovati.length })}
          </p>
        )}

        {righe.map((r) => {
          const archivio = prezzoInArchivio(itemsById.get(r.item_id), listini, supplierId)
          const cambiato = prezzoDiverso(archivio, r.unit_cost)
          return (
            <div key={r.rid} style={{ marginTop: 8 }}>
              <div className="row between" style={{ alignItems: 'center', gap: 8 }}>
                <span className="grow" style={{ minWidth: 0 }}>{r.name}</span>
                <input
                  type="number"
                  step="1"
                  min="0"
                  aria-label={tr('Quantità di {nome}', { nome: r.name })}
                  value={r.qty_packages ?? ''}
                  placeholder={tr('pz')}
                  onChange={(e) => cambia(r.rid, 'qty_packages', e.target.value)}
                  style={{ width: 68, textAlign: 'right' }}
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  aria-label={tr('Prezzo di {nome}', { nome: r.name })}
                  value={r.unit_cost ?? ''}
                  onChange={(e) => cambia(r.rid, 'unit_cost', e.target.value)}
                  style={{ width: 88, textAlign: 'right' }}
                />
                <button
                  className="btn ghost small"
                  title={tr('Togli dal documento')}
                  onClick={() => togli(r.rid)}
                >
                  ✕
                </button>
              </div>
              {/* LA DOMANDA SUL PREZZO COMPARE SOLO DOVE IL PREZZO È
                  CAMBIATO, con vecchio e nuovo affiancati. Spenta: «oppure
                  lasciarlo invariato» (Flavio) è il pre-impostato, e il
                  prezzo di vendita del menu non lo tocca comunque nessuno. */}
              {cambiato && (
                <label className="row small" style={{ gap: 6, alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    style={{ width: 'auto' }}
                    checked={!!r.aggiorna_prezzo}
                    onChange={(e) => cambia(r.rid, 'aggiorna_prezzo', e.target.checked)}
                  />
                  <span className="muted">
                    {tr('Aggiorna il prezzo: in archivio {vecchio} → {nuovo}', {
                      vecchio: formatPrice(archivio),
                      nuovo: formatPrice(r.unit_cost),
                    })}
                  </span>
                </label>
              )}
            </div>
          )
        })}

        {righe.length > 0 && (
          <>
            <div className="row between" style={{ marginTop: 10 }}>
              <span className="muted">{tr('Totale netto dei prodotti')}</span>
              <strong>{formatPrice(totali.net)}</strong>
            </div>

            <label className="row" style={{ marginTop: 10, gap: 6, alignItems: 'center' }}>
              <input
                type="checkbox"
                style={{ width: 'auto' }}
                checked={carica}
                disabled={bloccato}
                onChange={(e) => setCarica(e.target.checked)}
              />
              <span>{tr('Carica la merce a magazzino')}</span>
            </label>
            <p className="muted small">
              {bloccato
                ? tr('Il carico non è disponibile finché il magazzino non è aggiornato alla nuova gestione (Magazzino, il banner in alto). I prodotti si aggiungono lo stesso al documento.')
                : daOrdine
                  ? tr('Queste righe vengono da un ordine già consegnato: la merce è entrata in magazzino alla consegna.')
                  : tr('Senza carico i prodotti restano solo sul documento e le giacenze non cambiano.')}
            </p>
          </>
        )}

        <div className="row" style={{ gap: 10, marginTop: 16 }}>
          <button className="btn ghost grow" onClick={onCancel}>
            {tr('Annulla')}
          </button>
          <button
            className="btn grow"
            disabled={righe.length === 0}
            onClick={() => onConfirm(righe, carica, ordineScelto || null)}
          >
            {carica ? tr('Aggiungi e carica') : tr('Aggiungi senza caricare')}
          </button>
        </div>
      </div>
    </div>
  )
}
