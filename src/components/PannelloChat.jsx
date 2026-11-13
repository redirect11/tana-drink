import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { prodottoDaMagazzino, mettiProdottoInArrivo } from '../lib/prodottoDaMagazzino.js'
import { chiediChat, chiediAI, leggiCreditoAI, messaggioAI, costoAI as euro } from '../lib/aiApi.js'
import {
  strumentiPerRuolo,
  conTesto,
  conTurno,
  conEsiti,
  quasiPiena,
  chiedeConversazioneNuova,
  MAX_GIRI_STRUMENTI,
} from '../lib/chatAI.js'
import { giacenza, cercaProdotti, vendite, giornata } from '../lib/strumentiChat.js'
import {
  fetchInventoryItems,
  fetchDrinks,
  fetchCategories,
  fetchInventoryCategories,
  fetchOrdersRange,
  fetchSuppliers,
  fetchSupplierPrices,
  updateDrink,
} from '../lib/api.js'
import FatturaDaAI from './FatturaDaAI.jsx'


// Cosa si legge mentre uno strumento lavora: chi aspetta deve sapere cosa
// sta succedendo, in parole del gestionale.
const ATTIVITA = {
  giacenza: 'Lettura delle giacenze',
  vendite: 'Lettura delle vendite',
  cerca_prodotti: 'Ricerca fra magazzino e menù',
  proponi_descrizione: 'Proposta di una descrizione',
  proponi_voce_menu: 'Proposta di un prodotto della cassa',
  leggi_fattura: 'Lettura di un documento del fornitore',
}

// ── L'ASSISTENTE AI DEL GESTIONALE (REQ-AI-006) ───────────────────────
//
// Un pannello a portata, aperto dalla barra in alto, sopra la pagina in cui
// si è (Daniele, 12/11/2026). La conversazione vive finché il pannello è
// aperto: niente memoria, e chiudendolo si perde. Si vede solo dove l'AI
// arriva, e all'apertura si chiede il credito (gratis): se l'AI è ferma lo
// si dice e non si scrive niente.
//
// IL GIRO: chi scrive manda un testo; la regia risponde con un testo e/o
// con gli strumenti che il modello vuole usare. Quelli di lettura li esegue
// l'app subito; quelli che propongono mostrano una proposta, che si usa o
// si scarta — il modello non scrive mai da solo. Gli esiti tornano alla
// regia, e si ripete finché il modello non risponde senza strumenti (al
// massimo MAX_GIRI_STRUMENTI volte di fila).
export default function PannelloChat({ ruolo, onChiudi }) {
  const [credito, setCredito] = useState({ fase: 'attesa' })
  const [messaggi, setMessaggi] = useState([])
  const [vista, setVista] = useState([])
  const [testo, setTesto] = useState('')
  const [lavora, setLavora] = useState(false)
  const [costo, setCosto] = useState(0)
  const [proposta, setProposta] = useState(null)
  const versione = useRef(null)
  // L'elenco degli strumenti di QUESTA conversazione: fissato al primo
  // messaggio, perché cambiato a metà la regia la rifiuta (409).
  const strumentiConv = useRef(null)
  const dati = useRef(null)
  const ordiniPer = useRef(new Map())
  const fineRef = useRef(null)
  const strumenti = strumentiPerRuolo(ruolo)
  const navigate = useNavigate()

  useEffect(() => {
    let vivo = true
    leggiCreditoAI().then((r) => {
      if (!vivo) return
      if (!r.ok) setCredito({ fase: 'ferma', messaggio: messaggioAI(r.codice) })
      else if (!r.attivo)
        setCredito({
          fase: 'ferma',
          messaggio: r.motivo === 'tetto' ? messaggioAI('tetto') : messaggioAI('credito'),
        })
      else setCredito({ fase: 'pronta', credito: r.credito_eur })
    })
    return () => {
      vivo = false
    }
  }, [])

  useEffect(() => {
    fineRef.current?.scrollIntoView?.({ block: 'end' })
  }, [vista, proposta])

  const aggiungi = (riga) => setVista((v) => [...v, riga])

  // I dati che gli strumenti leggono, presi una volta per conversazione:
  // sono quelli che chi scrive vede già nel gestionale.
  async function datiDelGestionale() {
    if (!dati.current) {
      const [items, drinks, categorie] = await Promise.all([fetchInventoryItems(), fetchDrinks(), fetchCategories()])
      dati.current = { items, drinks, categorie }
    }
    return dati.current
  }

  // LA PROPOSTA A SCHERMO, che si risolve quando chi lavora decide: il
  // giro della conversazione aspetta, perché gli esiti di un turno tornano
  // alla regia tutti insieme.
  const attendi = (p) => new Promise((risolvi) => setProposta({ ...p, risolvi }))
  const chiudiProposta = (esito) => {
    proposta?.risolvi(esito)
    setProposta(null)
  }

  async function esegui({ nome, input }) {
    const d = await datiDelGestionale()
    if (nome === 'giacenza') return giacenza(input, d)
    if (nome === 'cerca_prodotti') return cercaProdotti(input, d)
    if (nome === 'vendite') {
      const dal = giornata(input?.dal)
      const al = giornata(input?.al) || dal
      if (!dal) return { errore: 'Il periodo va dato in date AAAA-MM-GG.' }
      // Lo stesso periodo si legge una volta: il modello lo richiama spesso
      // cambiando solo il prodotto.
      const k = `${dal}|${al}`
      if (!ordiniPer.current.has(k)) ordiniPer.current.set(k, fetchOrdersRange(dal, al))
      return vendite({ ...input, dal, al }, { ordini: await ordiniPer.current.get(k) })
    }
    if (nome === 'proponi_descrizione') {
      const trovato = cercaProdotti({ testo: input?.prodotto }, d).prodotti.find((p) => p.dove !== 'magazzino')
      const drink = trovato && d.drinks.find((x) => x.id === trovato.id)
      if (!drink) return { non_trovato: true, prodotto: input?.prodotto ?? null }
      const r = await chiediAI({ tipo: 'descrizione', nome: drink.name, ...(trovato.categoria ? { categoria: trovato.categoria } : {}) })
      if (!r.ok) return { errore: messaggioAI(r.codice) }
      if (r.costo_eur != null) setCosto((c) => c + r.costo_eur)
      const descrizione = String(r.risultato?.descrizione || '').trim()
      const daVerificare = Array.isArray(r.risultato?.da_verificare) ? r.risultato.da_verificare : []
      return attendi({ tipo: 'descrizione', drink, descrizione, daVerificare })
    }
    if (nome === 'proponi_voce_menu') {
      // La bottiglia del magazzino da cui nasce: la prima che si chiama così.
      const trovata = giacenza({ prodotto: input?.prodotto }, d).trovati[0]
      const item = trovata && d.items.find((x) => x.id === trovata.id)
      if (!item) return { non_trovato: true, prodotto: input?.prodotto ?? null }
      return attendi({ tipo: 'voce', item, prezzo: input?.prezzo_eur ?? null })
    }
    if (nome === 'leggi_fattura') {
      const [suppliers, listini] = await Promise.all([fetchSuppliers(), fetchSupplierPrices()])
      return attendi({ tipo: 'fattura', suppliers, listini, items: d.items })
    }
    return { errore: 'Strumento non disponibile.' }
  }

  async function giro(partenza) {
    let conv = partenza
    for (let i = 0; i < MAX_GIRI_STRUMENTI; i++) {
      if (!strumentiConv.current) strumentiConv.current = strumenti
      const r = await chiediChat({ messaggi: conv, strumenti: strumentiConv.current, versione: versione.current })
      if (!r.ok) {
        // La conversazione non può continuare: si riparte da capo, e la
        // frase della regia (com'è) resta in vista.
        if (chiedeConversazioneNuova(r.codice)) nuova()
        aggiungi({ tipo: 'errore', testo: r.errore || messaggioAI(r.codice) })
        return
      }
      // La versione è quella della PRIMA risposta, per tutta la conversazione.
      if (r.versione && !versione.current) versione.current = r.versione
      if (r.costo_eur != null) setCosto((c) => c + r.costo_eur)
      conv = conTurno(conv, r.turno)
      setMessaggi(conv)
      if (r.testo) aggiungi({ tipo: 'ai', testo: r.testo })
      if (r.strumenti_richiesti.length === 0) return
      const esiti = []
      for (const s of r.strumenti_richiesti) {
        aggiungi({ tipo: 'attivita', testo: `${ATTIVITA[s.nome] || 'Strumento'}…` })
        try {
          esiti.push({ id: s.id, esito: await esegui(s) })
        } catch (e) {
          esiti.push({ id: s.id, esito: { errore: e?.message || 'Lettura non riuscita.' }, errore: true })
        }
      }
      conv = conEsiti(conv, esiti, r.turno)
      setMessaggi(conv)
    }
    aggiungi({ tipo: 'errore', testo: 'L’assistente non è arrivato a una risposta: si può riformulare la domanda.' })
  }

  async function manda(e) {
    e?.preventDefault?.()
    const t = testo.trim()
    if (!t || lavora) return
    setTesto('')
    aggiungi({ tipo: 'tu', testo: t })
    setLavora(true)
    try {
      await giro(conTesto(messaggi, t))
    } finally {
      setLavora(false)
    }
  }

  function nuova() {
    setMessaggi([])
    setVista([])
    setCosto(0)
    versione.current = null
    strumentiConv.current = null
  }

  return (
    <aside className="pannello-chat" role="dialog" aria-label="Assistente AI">
      <div className="pannello-chat-testa">
        <strong>Assistente AI</strong>
        <div className="row" style={{ gap: 6 }}>
          {messaggi.length > 0 && (
            <button type="button" className="btn ghost small" onClick={nuova} disabled={lavora}>
              Nuova conversazione
            </button>
          )}
          <button type="button" className="btn ghost small" onClick={onChiudi} aria-label="Chiudi l’assistente">
            ✕
          </button>
        </div>
      </div>

      <div className="pannello-chat-corpo">
        {credito.fase === 'attesa' && <p className="muted small">Verifica del credito AI…</p>}
        {credito.fase === 'ferma' && (
          <p className="small" role="status">
            {credito.messaggio}
          </p>
        )}
        {credito.fase === 'pronta' && vista.length === 0 && (
          <p className="muted small">
            Domande su giacenze, vendite e prodotti; proposte di descrizioni per il menù
            {strumenti.includes('leggi_fattura') ? ' e lettura dei documenti dei fornitori' : ''}. Le modifiche si
            confermano sempre a schermo. La conversazione non si conserva alla chiusura del pannello.
          </p>
        )}
        {vista.map((r, i) => (
          <p key={i} className={`pannello-chat-riga ${r.tipo}`} role={r.tipo === 'errore' ? 'status' : undefined}>
            {r.testo}
          </p>
        ))}

        {proposta?.tipo === 'descrizione' && (
          <div className="descrizione-ai-proposta" role="group" aria-label="Descrizione proposta">
            <p className="small muted" style={{ margin: 0 }}>
              Descrizione proposta per {proposta.drink.name}
            </p>
            <p style={{ margin: '4px 0 6px' }}>{proposta.descrizione || '—'}</p>
            {proposta.daVerificare.length > 0 && (
              <p className="small" style={{ margin: '0 0 6px' }}>
                Da verificare: {proposta.daVerificare.join(', ')}
              </p>
            )}
            <div className="row" style={{ gap: 8 }}>
              <button
                type="button"
                className="btn small"
                disabled={!proposta.descrizione}
                onClick={() => {
                  updateDrink(proposta.drink.id, { description: proposta.descrizione }).catch(() => {})
                  aggiungi({ tipo: 'attivita', testo: `Descrizione di ${proposta.drink.name} aggiornata.` })
                  chiudiProposta({ prodotto: proposta.drink.name, descrizione: proposta.descrizione, stato: 'usata' })
                }}
              >
                Usa questa
              </button>
              <button
                type="button"
                className="btn ghost small"
                onClick={() => chiudiProposta({ prodotto: proposta.drink.name, descrizione: proposta.descrizione, stato: 'scartata' })}
              >
                Scarta
              </button>
            </div>
          </div>
        )}
        {proposta?.tipo === 'voce' && (
          <div className="descrizione-ai-proposta" role="group" aria-label="Prodotto della cassa proposto">
            <p style={{ margin: '0 0 6px' }}>
              Un prodotto della cassa da <strong>{proposta.item.name}</strong>
              {proposta.prezzo != null ? `, a ${euro(proposta.prezzo)}` : ''}. La scheda si apre nel Menù, collegata a
              questa bottiglia: si completano la quantità della ricetta e il prezzo, poi si salva.
            </p>
            <div className="row" style={{ gap: 8 }}>
              <button
                type="button"
                className="btn small"
                onClick={async () => {
                  const [categorieMagazzino, categorieCassa] = await Promise.all([
                    fetchInventoryCategories().catch(() => []),
                    fetchCategories().catch(() => []),
                  ])
                  mettiProdottoInArrivo(prodottoDaMagazzino(proposta.item, { categorieMagazzino, categorieCassa, prezzo: proposta.prezzo }))
                  navigate('/bar?tab=menu')
                  chiudiProposta({ voce: { nome: proposta.item.name, prezzo_eur: proposta.prezzo }, stato: 'scheda aperta, da completare e salvare' })
                }}
              >
                Apri la scheda
              </button>
              <button type="button" className="btn ghost small" onClick={() => chiudiProposta({ voce: { nome: proposta.item.name }, stato: 'scartata' })}>
                Scarta
              </button>
            </div>
          </div>
        )}
        {proposta?.tipo === 'fattura' && (
          <FatturaDaAI
            suppliers={proposta.suppliers}
            items={proposta.items}
            listini={proposta.listini}
            onAnnulla={() => chiudiProposta({ annullata: true })}
            onRegistrata={({ riassunto, avviso }) => {
              if (avviso) aggiungi({ tipo: 'errore', testo: avviso })
              chiudiProposta({ registrata: true, ...(riassunto || {}) })
            }}
          />
        )}
        {lavora && !proposta && <p className="muted small">L’assistente sta rispondendo…</p>}
        {quasiPiena(messaggi) && (
          <p className="small" role="status">
            La conversazione è lunga: per una domanda nuova conviene aprirne un’altra.
          </p>
        )}
        <div ref={fineRef} />
      </div>

      <form className="pannello-chat-piede" onSubmit={manda}>
        <textarea
          aria-label="Messaggio per l’assistente"
          rows={2}
          value={testo}
          disabled={credito.fase !== 'pronta' || lavora}
          onChange={(e) => setTesto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) manda(e)
          }}
        />
        <button type="submit" className="btn small" disabled={credito.fase !== 'pronta' || lavora || !testo.trim()}>
          Invia
        </button>
      </form>
      {costo > 0 && <p className="muted small pannello-chat-costo">Costo della conversazione {euro(costo)}</p>}
    </aside>
  )
}
