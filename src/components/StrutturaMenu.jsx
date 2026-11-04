import { useMemo, useState } from 'react'
import {
  creaSezioneCarta,
  aggiornaSezioneCarta,
  eliminaSezioneCarta,
  scriviStruttura,
  creaVoceCarta,
  aggiornaVoceCarta,
  eliminaVoceCarta,
} from '../lib/api.js'
import {
  VISTE_SEZIONE,
  ordina,
  nomeVoce,
  nomeSezione,
  perIlCliente,
  righeStruttura,
  PERCORSO_ANTEPRIMA,
} from '../lib/strutturaMenu.js'
import { formatPrice } from '../lib/orderStatus.js'

// LA STRUTTURA DEL MENÙ DEI CLIENTI, DAL GESTIONALE (REQ-MENU-025): le
// sezioni del menù del tavolo, nell'ordine in cui compaiono. Una sezione
// segue una categoria del gestionale o ha le voci scelte a mano; di suo
// c'è una sezione per categoria, e il menù è quello di sempre. Flavio,
// 04/11/2026: «un pannello dove creiamo tutte le voci che vanno all'interno
// del menù vista cliente». Una voce scelta a mano si aggiunge qui o dalla
// scheda del prodotto (MenuManager, InStruttura): è lo stesso dato visto
// dai due lati.
//
// Le scritture partono in sottofondo (api.js) e la sottoscrizione le
// mostra subito: niente «Salva», un campo si registra uscendone.

// Un campo che si registra quando lo si lascia. Rinasce (key) quando il
// valore cambia da fuori — un altro terminale, o il proprio salvataggio
// tornato dalla cache —, così non resta a mostrare il testo di prima.
function Campo({ valore, salva, area = false, ...props }) {
  const Tag = area ? 'textarea' : 'input'
  return (
    <Tag
      key={valore}
      defaultValue={valore}
      onBlur={(e) => {
        if (e.target.value.trim() !== (valore || '').trim()) salva(e.target.value.trim())
      }}
      {...props}
    />
  )
}

// I prodotti del gestionale per la tendina di una voce, divisi per la loro
// categoria: sono centinaia, e chi cerca «Gin Mare» lo cerca fra i gin.
function opzioniGestionale(drinks, categories) {
  const nomeCat = new Map((categories || []).map((c) => [c.id, c]))
  const gruppi = new Map()
  for (const d of drinks || []) {
    const cat = nomeCat.get(d.category_id)
    const nome = cat?.name || d.category || 'Senza categoria'
    if (!gruppi.has(nome)) gruppi.set(nome, { nome, ordine: cat?.sort_order ?? 9999, voci: [] })
    gruppi.get(nome).voci.push(d)
  }
  return [...gruppi.values()]
    .sort((a, b) => a.ordine - b.ordine || a.nome.localeCompare(b.nome))
    .map((g) => ({ ...g, voci: g.voci.sort((a, b) => (a.name || '').localeCompare(b.name || '')) }))
}

export function TendinaGestionale({ valore, drinks, categories, onChange, ...props }) {
  const gruppi = useMemo(() => opzioniGestionale(drinks, categories), [drinks, categories])
  return (
    <select value={valore || ''} onChange={(e) => onChange(e.target.value || null)} {...props}>
      <option value="">— Nessun prodotto —</option>
      {gruppi.map((g) => (
        <optgroup key={g.nome} label={g.nome}>
          {g.voci.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} · {formatPrice(d.price)}
              {d.available ? '' : ' (fuori menù)'}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}

// Su e giù fra le voci di una sezione: si scambia col vicino e si rinumera
// tutta la lista, perché le voci scritte da uno script, o aggiunte in
// fretta, possono avere lo stesso numero d'ordine, e due numeri uguali non
// si scambiano. Si scrive solo chi cambia davvero.
function sposta(lista, idx, dir, aggiorna) {
  const j = idx + dir
  if (j < 0 || j >= lista.length) return
  const nuova = [...lista]
  ;[nuova[idx], nuova[j]] = [nuova[j], nuova[idx]]
  nuova.forEach((x, k) => {
    if (Number(x.ordine) !== k) aggiorna(x.id, { ordine: k })
  })
}

// IL MENÙ DEI CLIENTI VISTO DALLA SCHEDA DEL PRODOTTO. Flavio, 04/11/2026:
// «quando nel menù del gestionale fai attiva sul menù, dovrebbe apparire
// una tendina con tutti gli item dove uno seleziona quello a cui si deve
// agganciare». Qui si vede in quale sezione compare il prodotto per la sua
// categoria, e in quali sezioni scelte a mano; lo si aggiunge a un'altra,
// o lo si toglie.
export function InStruttura({ drink, carta, categories }) {
  const righe = righeStruttura(carta?.sezioni, categories)
  const aMano = righe.filter((r) => r.id && !r.categoria_id)
  if (!aMano.length) return null
  const perCategoria = righe.find((r) => r.categoria_id && r.categoria_id === drink.category_id)
  const nomeDi = new Map(aMano.map((r) => [r.id, nomeSezione(r, categories)]))
  const mie = (carta?.voci || []).filter((v) => v.drink_id === drink.id && nomeDi.has(v.sezione_id))
  return (
    <div className="carta-agganci" style={{ margin: '6px 0' }}>
      <span className="muted small">Menù dei clienti:</span>{' '}
      {perCategoria && (
        <span className="muted small">
          {nomeSezione(perCategoria, categories)}
          {perCategoria.nascosta ? ' (nascosta)' : ''}
          {mie.length ? ' · ' : ''}
        </span>
      )}
      {mie.map((v) => (
        <span className="chip" key={v.id} style={{ marginRight: 4 }}>
          {nomeDi.get(v.sezione_id)}
          <button
            type="button"
            className="btn ghost small"
            aria-label={`Togli ${drink.name} da ${nomeDi.get(v.sezione_id)}`}
            onClick={() => eliminaVoceCarta(v.id)}
          >
            ✕
          </button>
        </span>
      ))}
      <select
        value=""
        aria-label={`Aggiungi ${drink.name} a una sezione`}
        onChange={(e) => {
          const sezione_id = e.target.value
          if (!sezione_id) return
          const voci = (carta?.voci || []).filter((v) => v.sezione_id === sezione_id)
          creaVoceCarta({ sezione_id, drink_id: drink.id, ordine: voci.length })
        }}
        style={{ marginTop: 4 }}
      >
        <option value="">Aggiungi a una sezione…</option>
        {aMano.map((r) => (
          <option key={r.id} value={r.id}>
            {nomeDi.get(r.id)}
          </option>
        ))}
      </select>
    </div>
  )
}

// La struttura arriva da MenuManager, che la tiene già per le schede dei
// prodotti: una sottoscrizione sola.
export default function StrutturaMenu({ carta, drinks, categories }) {
  const [nuova, setNuova] = useState('')

  const perId = useMemo(() => new Map((drinks || []).map((d) => [d.id, perIlCliente(d)])), [drinks])
  const righe = righeStruttura(carta.sezioni, categories)
  const catPerId = new Map((categories || []).map((c) => [c.id, c]))
  const vociDi = (sezioneId) =>
    ordina(
      carta.voci.filter((v) => v.sezione_id === sezioneId),
      (v) => nomeVoce(v, perId.get(v.drink_id))
    )
  const disponibiliIn = (categoriaId) => (drinks || []).filter((d) => d.category_id === categoriaId && d.available).length

  // Una sezione nuova va in cima: di solito è la Signature, o quella dei
  // consigli dello staff, e scendere è un tocco su ↓.
  function aggiungiSezione() {
    if (!nuova.trim()) return
    const primo = Math.min(0, ...carta.sezioni.map((s) => Number(s.ordine) || 0))
    creaSezioneCarta({ nome: nuova, ordine: primo - 1 })
    setNuova('')
  }

  // Una riga ancora non scritta (una categoria che nessuna sezione segue)
  // si scrive insieme a tutte quelle che le stanno intorno: vedi
  // scriviStruttura.
  function modifica(idx, patch) {
    const r = righe[idx]
    if (r.id) aggiornaSezioneCarta(r.id, patch)
    else scriviStruttura(righe.map((x, k) => (k === idx ? { ...x, ...patch } : x)))
  }

  function spostaRiga(idx, dir) {
    const j = idx + dir
    if (j < 0 || j >= righe.length) return
    const nuove = [...righe]
    ;[nuove[idx], nuove[j]] = [nuove[j], nuove[idx]]
    scriviStruttura(nuove)
  }

  function eliminaSezione(r) {
    const voci = vociDi(r.id)
    const nome = nomeSezione(r, categories)
    const conVoci = voci.length ? ` e le sue ${voci.length === 1 ? 'voce' : `${voci.length} voci`}` : ''
    if (!confirm(`Eliminare la sezione «${nome}»${conVoci}? I prodotti del gestionale restano.`)) return
    eliminaSezioneCarta(
      r.id,
      voci.map((v) => v.id)
    )
  }

  return (
    <div>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>📖 Menù dei clienti</h3>
        <p className="muted small" style={{ margin: '0 0 10px' }}>
          Le sezioni del menù consultato al tavolo, nell'ordine in cui compaiono. Una sezione segue una categoria del
          gestionale, e ne mostra i prodotti disponibili, compresi quelli aggiunti in seguito; oppure ha voci scelte a
          mano, con nome, descrizione e ingredienti propri se diversi da quelli della scheda prodotto. Le categorie non
          ancora ordinate qui compaiono in fondo. Il personale ordina sempre dal menù del gestionale.
        </p>
        <a className="btn ghost small" href={PERCORSO_ANTEPRIMA} target="_blank" rel="noreferrer">
          👁 Anteprima del menù dei clienti
        </a>
      </div>

      <div className="card" style={{ marginTop: 8 }}>
        <div className="row" style={{ gap: 8 }}>
          <input
            value={nuova}
            onChange={(e) => setNuova(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && aggiungiSezione()}
            placeholder="Nuova sezione con voci scelte a mano (Signature, Suggeriti dallo staff…)"
            aria-label="Nome della nuova sezione"
          />
          <button className="btn small" onClick={aggiungiSezione}>
            Aggiungi
          </button>
        </div>
      </div>

      {righe.map((r, idx) => {
        const nome = nomeSezione(r, categories)
        const snella = r.vista === 'snella'
        const segue = Boolean(r.categoria_id)
        const categoria = segue ? catPerId.get(r.categoria_id) : null
        const voci = segue ? [] : vociDi(r.id)
        return (
          <section
            className="card carta-sezione"
            key={r.chiave}
            style={{ marginTop: 8, opacity: r.nascosta ? 0.6 : 1 }}
            aria-label={`Sezione ${nome}`}
          >
            <div className="row" style={{ gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <Campo
                valore={r.nome}
                salva={(valore) => (valore || segue) && modifica(idx, { nome: valore })}
                placeholder={categoria?.name || 'Nome della sezione'}
                aria-label="Nome della sezione"
                style={{ flex: '1 1 180px', fontWeight: 600 }}
              />
              <select
                value={r.vista}
                onChange={(e) => modifica(idx, { vista: e.target.value })}
                aria-label="Visualizzazione della sezione"
                style={{ width: 'auto' }}
              >
                {VISTE_SEZIONE.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
              <label className="row small" style={{ gap: 4, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={r.nascosta}
                  onChange={(e) => modifica(idx, { nascosta: e.target.checked })}
                />
                Nascosta
              </label>
              <button className="btn ghost small" aria-label="Sezione su" disabled={idx === 0} onClick={() => spostaRiga(idx, -1)}>
                ↑
              </button>
              <button
                className="btn ghost small"
                aria-label="Sezione giù"
                disabled={idx === righe.length - 1}
                onClick={() => spostaRiga(idx, 1)}
              >
                ↓
              </button>
              {/* Una sezione che segue una categoria non si elimina: la
                  categoria tornerebbe in fondo da sola. Si nasconde. */}
              {(!segue || !categoria) && (
                <button className="btn ghost small" aria-label={`Elimina la sezione ${nome}`} onClick={() => eliminaSezione(r)}>
                  🗑
                </button>
              )}
            </div>
            <p className="muted small" style={{ margin: '4px 0 0' }}>
              {segue
                ? categoria
                  ? `Segue la categoria «${categoria.name}» · ${disponibiliIn(r.categoria_id)} prodotti disponibili.`
                  : 'La categoria seguita non esiste più: la sezione è vuota.'
                : 'Voci scelte a mano.'}
            </p>
            <p className="muted small" style={{ margin: '2px 0 8px' }}>
              {snella
                ? 'Snella: nome e prezzo su una riga, senza immagine, descrizione e ingredienti.'
                : 'Dettagliata: immagine, descrizione e ingredienti.'}
            </p>

            {voci.map((v, j) => {
              const drink = perId.get(v.drink_id)
              return (
                <div className="carta-voce" key={v.id} style={{ borderTop: '1px solid var(--line)', padding: '8px 0' }}>
                  <div className="row" style={{ gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Campo
                      valore={v.nome}
                      salva={(valore) => aggiornaVoceCarta(v.id, { nome: valore })}
                      placeholder={drink?.name || 'Nome nella sezione'}
                      aria-label="Nome nella sezione"
                      style={{ flex: '1 1 160px' }}
                    />
                    <span className="muted small">{drink ? formatPrice(drink.price) : ''}</span>
                    <button className="btn ghost small" aria-label="Voce su" disabled={j === 0} onClick={() => sposta(voci, j, -1, aggiornaVoceCarta)}>
                      ↑
                    </button>
                    <button
                      className="btn ghost small"
                      aria-label="Voce giù"
                      disabled={j === voci.length - 1}
                      onClick={() => sposta(voci, j, 1, aggiornaVoceCarta)}
                    >
                      ↓
                    </button>
                    <button className="btn ghost small" aria-label={`Elimina la voce ${nomeVoce(v, drink)}`} onClick={() => eliminaVoceCarta(v.id)}>
                      🗑
                    </button>
                  </div>
                  <TendinaGestionale
                    valore={v.drink_id}
                    drinks={drinks}
                    categories={categories}
                    onChange={(id) => aggiornaVoceCarta(v.id, { drink_id: id })}
                    aria-label="Prodotto del gestionale"
                    style={{ marginTop: 6 }}
                  />
                  {!drink && (
                    <p className="muted small" style={{ margin: '4px 0 0' }}>
                      Nessun prodotto collegato: la voce non compare al tavolo.
                    </p>
                  )}
                  {drink && !drink.available && (
                    <p className="muted small" style={{ margin: '4px 0 0' }}>
                      Prodotto fuori menù: la voce non compare al tavolo.
                    </p>
                  )}
                  {!snella && (
                    <>
                      <Campo
                        area
                        rows={2}
                        valore={v.descrizione}
                        salva={(descrizione) => aggiornaVoceCarta(v.id, { descrizione })}
                        placeholder={drink?.description || 'Descrizione (provenienza, carattere, servizio)'}
                        aria-label="Descrizione nella sezione"
                        style={{ marginTop: 6 }}
                      />
                      <Campo
                        valore={v.ingredienti}
                        salva={(ingredienti) => aggiornaVoceCarta(v.id, { ingredienti })}
                        placeholder={drink?.ingredienti || 'Ingredienti, separati da virgola'}
                        aria-label="Ingredienti nella sezione"
                        style={{ marginTop: 6 }}
                      />
                    </>
                  )}
                </div>
              )
            })}
            {!segue && (
              <button
                className="btn secondary small"
                style={{ marginTop: 6 }}
                onClick={() => creaVoceCarta({ sezione_id: r.id, ordine: voci.length })}
              >
                + Voce
              </button>
            )}
          </section>
        )
      })}
    </div>
  )
}
