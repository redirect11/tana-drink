import { useMemo, useRef, useState } from 'react'
import { chiediAI, messaggioAI, problemaFileFattura, fileInBase64 } from '../lib/aiApi.js'
import { fotoDiFatturaLeggibile } from '../lib/storage.js'
import { createSupplierInvoice, aggiungiProdottiAFattura, allegaDocumentoAFattura } from '../lib/api.js'
import {
  propostaDaFattura,
  documentoDaProposta,
  righeDaProposta,
  propostaRegistrabile,
} from '../lib/fatturaAI.js'

// Il costo di una lettura è di qualche centesimo: fino a quattro decimali,
// come nella descrizione proposta (DescrizioneAI).
const euro = (v) => `${Number(v).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} €`

// ── IL DOCUMENTO LETTO DALL'AI (REQ-AI-001) ───────────────────────────
//
// Si sceglie la foto o il PDF della fattura; il cassetto AI della regia la
// legge e torna fornitore, numero, data, importo e righe. Qui diventano una
// PROPOSTA da rivedere campo per campo, nella forma di «Nuovo documento» e
// di «Aggiungi prodotti»: niente si registra senza «Registra il
// documento». Il documento letto si allega da sé, perché è la carta che
// il commercialista chiederà (REQ-MAG-033).
//
// Il carico a magazzino parte spento: le quantità di una fattura sono
// spesso in cartoni, quelle del magazzino in colli, e un carico sbagliato
// è una giacenza sbagliata. Si accende dopo aver controllato.
export default function FatturaDaAI({ suppliers, items, listini, onAnnulla, onRegistrata }) {
  const [stato, setStato] = useState({ fase: 'scegli' })
  const [proposta, setProposta] = useState(null)
  const [carica, setCarica] = useState(false)
  const [busy, setBusy] = useState(false)
  const [errore, setErrore] = useState(null)
  const fileRef = useRef(null)
  const prodotti = useMemo(
    () => [...(items || [])].sort((a, b) => String(a.name).localeCompare(String(b.name), 'it')),
    [items]
  )

  async function leggi(e) {
    const file = e.target.files?.[0]
    if (fileRef.current) fileRef.current.value = ''
    if (!file) return
    setErrore(null)
    setStato({ fase: 'attesa' })
    let pronto
    try {
      pronto = await fotoDiFatturaLeggibile(file)
    } catch {
      pronto = file
    }
    const problema = problemaFileFattura(pronto)
    if (problema) return setStato({ fase: 'errore', messaggio: problema })
    let base64
    try {
      base64 = await fileInBase64(pronto)
    } catch (err) {
      return setStato({ fase: 'errore', messaggio: err.message })
    }
    const r = await chiediAI({ tipo: 'fattura', file: base64, media_type: pronto.type })
    if (!r.ok) {
      // Anche quando il risultato non serve il costo resta: si dice.
      const costo = r.costo_eur != null ? ` Costo ${euro(r.costo_eur)}.` : ''
      return setStato({ fase: 'errore', messaggio: messaggioAI(r.codice) + costo })
    }
    setProposta(propostaDaFattura(r.risultato, { suppliers, items, listini }))
    setStato({ fase: 'proposta', file, costo: r.costo_eur, credito: r.credito_eur })
  }

  const cambia = (campo) => (e) => setProposta((p) => ({ ...p, [campo]: e.target.value }))
  const cambiaRiga = (chiave, patch) =>
    setProposta((p) => ({ ...p, righe: p.righe.map((r) => (r.chiave === chiave ? { ...r, ...patch } : r)) }))

  async function registra() {
    if (!propostaRegistrabile(proposta)) return
    setBusy(true)
    setErrore(null)
    try {
      const doc = await createSupplierInvoice(documentoDaProposta(proposta, suppliers))
      const righe = righeDaProposta(proposta, { items, listini })
      if (righe.length > 0) await aggiungiProdottiAFattura(doc.id, { righe, carica })
      // L'ALLEGATO NON FERMA LA REGISTRAZIONE: il documento c'è già, e un
      // allegato non riuscito (peso, rete) si rifà dalla riga, come sempre.
      let avviso = null
      try {
        await allegaDocumentoAFattura(doc.id, stato.file)
      } catch (err) {
        avviso = `Documento registrato, ma l’allegato non è stato caricato: ${err.message}`
      }
      // Il riassunto serve alla chat (REQ-AI-006), che lo rimanda al modello
      // al posto del documento: nomi e numeri, niente file.
      const sup = suppliers.find((x) => x.id === proposta.supplier_id)
      const riassunto = {
        fornitore: sup?.name ?? null,
        numero: proposta.number || null,
        data: proposta.date,
        totale: Number(proposta.amount) || 0,
        righe_trovate: righe.length,
        righe_da_abbinare: proposta.righe.length - righe.length,
      }
      onRegistrata?.({ id: doc.id, avviso, riassunto })
    } catch (err) {
      setErrore(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (stato.fase !== 'proposta') {
    return (
      <div className="card fattura-ai">
        <strong>Leggi un documento con l’AI</strong>
        <p className="muted small" style={{ margin: '4px 0 8px' }}>
          Dalla foto o dal PDF della fattura l’AI propone fornitore, numero, data, importo e righe, da rivedere prima
          di registrare. Usa il credito AI del locale.
        </p>
        {stato.fase === 'attesa' ? (
          <p role="status">Lettura del documento in corso… può richiedere qualche decina di secondi.</p>
        ) : (
          <>
            {stato.fase === 'errore' && (
              <p className="small" role="status" style={{ margin: '0 0 8px' }}>
                {stato.messaggio}
              </p>
            )}
            {/* `accept` largo, come per l'allegato: su certi Android un
                elenco di tipi toglie la fotocamera, che è da dove arriva
                una fattura. Il formato lo controlla problemaFileFattura. */}
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              aria-label="La foto o il PDF della fattura"
              onChange={leggi}
            />
          </>
        )}
        <div className="row" style={{ gap: 8, marginTop: 10 }}>
          <button type="button" className="btn ghost small" onClick={onAnnulla} disabled={stato.fase === 'attesa'}>
            Annulla
          </button>
        </div>
      </div>
    )
  }

  const p = proposta
  return (
    <div className="card fattura-ai" role="group" aria-label="Documento letto dall’AI">
      <strong>Documento letto dall’AI</strong>
      <p className="muted small" style={{ margin: '2px 0 8px' }}>
        Proposta da rivedere: ogni campo si corregge prima di registrare.
      </p>
      {errore && <div className="banner">Errore: {errore}</div>}

      <label htmlFor="fai-sup">Fornitore *</label>
      <select id="fai-sup" value={p.supplier_id} onChange={cambia('supplier_id')} required>
        <option value="">— Scegli —</option>
        {suppliers.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      {p.fornitore_letto && <p className="muted small">Sul documento: {p.fornitore_letto}</p>}

      <div className="grid-2">
        <div>
          <label htmlFor="fai-num">Numero doc.</label>
          <input id="fai-num" value={p.number} onChange={cambia('number')} />
        </div>
        <div>
          <label htmlFor="fai-data">Data</label>
          <input id="fai-data" type="date" value={p.date} onChange={cambia('date')} />
        </div>
      </div>
      <label htmlFor="fai-importo">Importo € *</label>
      <input id="fai-importo" type="number" step="any" min="0" value={p.amount} onChange={cambia('amount')} />

      {p.righe.length > 0 && (
        <>
          <h4 style={{ margin: '12px 0 4px' }}>Righe</h4>
          <p className="muted small" style={{ margin: '0 0 6px' }}>
            Si registrano le righe spuntate, abbinate a un prodotto del magazzino. Quantità in colli, costo unitario
            al netto dello sconto di riga.
          </p>
          {p.righe.map((r) => (
            <div key={r.chiave} className="fattura-ai-riga">
              <label className="row" style={{ gap: 6, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={r.includi}
                  disabled={!r.item_id}
                  onChange={(e) => cambiaRiga(r.chiave, { includi: e.target.checked })}
                />
                <span className="small">{r.letta || '(riga senza descrizione)'}</span>
              </label>
              <select
                aria-label={`Prodotto per «${r.letta}»`}
                value={r.item_id}
                onChange={(e) => cambiaRiga(r.chiave, { item_id: e.target.value, includi: Boolean(e.target.value) })}
              >
                <option value="">— Prodotto da abbinare —</option>
                {prodotti.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
              <div className="fattura-ai-numeri">
                <label>
                  Qtà
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={r.quantita}
                    onChange={(e) => cambiaRiga(r.chiave, { quantita: e.target.value })}
                  />
                </label>
                <label>
                  Costo €
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={r.costo}
                    onChange={(e) => cambiaRiga(r.chiave, { costo: e.target.value })}
                  />
                </label>
                <label>
                  IVA %
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={r.iva}
                    onChange={(e) => cambiaRiga(r.chiave, { iva: e.target.value })}
                  />
                </label>
              </div>
            </div>
          ))}
          <label className="row" style={{ gap: 6, alignItems: 'center', marginTop: 8 }}>
            <input type="checkbox" checked={carica} onChange={(e) => setCarica(e.target.checked)} />
            <span className="small">Carica le righe a magazzino</span>
          </label>
        </>
      )}

      {p.daVerificare.length > 0 && (
        <div className="small" style={{ marginTop: 10 }}>
          <strong>Da verificare</strong>
          <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
            {p.daVerificare.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </div>
      )}

      {stato.costo != null && (
        <p className="muted small" style={{ margin: '8px 0 0' }}>
          Costo della lettura {euro(stato.costo)}
          {stato.credito != null ? ` · credito rimasto ${euro(stato.credito)}` : ''}
        </p>
      )}

      <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <button type="button" className="btn small" onClick={registra} disabled={busy || !propostaRegistrabile(p)}>
          {busy ? 'Registrazione…' : 'Registra il documento'}
        </button>
        <button type="button" className="btn ghost small" onClick={onAnnulla} disabled={busy}>
          Annulla
        </button>
      </div>
    </div>
  )
}
