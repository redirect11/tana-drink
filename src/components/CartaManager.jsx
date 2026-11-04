import { useMemo, useState } from 'react'
import {
  creaSezioneCarta,
  aggiornaSezioneCarta,
  eliminaSezioneCarta,
  creaVoceCarta,
  aggiornaVoceCarta,
  eliminaVoceCarta,
  updateSettings,
} from '../lib/api.js'
import { VISTE_CARTA, ordinaCarta, nomeVoce, PERCORSO_ANTEPRIMA_CARTA } from '../lib/carta.js'
import { formatPrice } from '../lib/orderStatus.js'

// LA CARTA DEI CLIENTI, DAL GESTIONALE (REQ-MENU-025): le sezioni del menù
// del tavolo e le loro voci, ognuna agganciata a una voce del menù del
// gestionale. Flavio, 04/11/2026: «un pannello dove creiamo tutte le voci
// che vanno all'interno del menù vista cliente». L'aggancio si sceglie
// qui, sulla voce, o dalla scheda della voce del gestionale (MenuManager,
// «In carta»): è lo stesso dato visto dai due lati.
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

// Le voci del gestionale per la tendina dell'aggancio, divise per la loro
// categoria: sono centinaia, e chi aggancia «Gin Mare» lo cerca fra i gin.
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
      <option value="">— Non agganciata —</option>
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

// Su e giù: si scambia col vicino e si rinumera tutta la lista, perché le
// voci scritte da uno script, o aggiunte in fretta, possono avere lo
// stesso numero d'ordine, e due numeri uguali non si scambiano. Si scrive
// solo chi cambia davvero.
function sposta(lista, idx, dir, aggiorna) {
  const j = idx + dir
  if (j < 0 || j >= lista.length) return
  const nuova = [...lista]
  ;[nuova[idx], nuova[j]] = [nuova[j], nuova[idx]]
  nuova.forEach((x, k) => {
    if (Number(x.ordine) !== k) aggiorna(x.id, { ordine: k })
  })
}

// LA CARTA VISTA DALLA VOCE DEL GESTIONALE. Flavio, 04/11/2026: «quando
// nel menù del gestionale fai attiva sul menù, dovrebbe apparire una
// tendina con tutti gli item dove uno seleziona quello a cui si deve
// agganciare». Qui si vedono le voci della carta che portano a questa, e
// se ne aggancia un'altra; una voce già agganciata altrove si sposta.
export function AgganciCarta({ drink, carta }) {
  const sezioni = carta?.sezioni || []
  const voci = carta?.voci || []
  if (!sezioni.length) return null
  const nomeSezione = new Map(sezioni.map((s) => [s.id, s.nome]))
  const mie = voci.filter((v) => v.drink_id === drink.id)
  const altre = ordinaCarta(voci.filter((v) => v.drink_id !== drink.id && nomeSezione.has(v.sezione_id)))
  return (
    <div className="carta-agganci" style={{ margin: '6px 0' }}>
      <span className="muted small">In carta:</span>{' '}
      {mie.length === 0 && <span className="muted small">nessuna voce</span>}
      {mie.map((v) => (
        <span className="chip" key={v.id} style={{ marginRight: 4 }}>
          {nomeVoce(v, drink)}
          <button
            type="button"
            className="btn ghost small"
            aria-label={`Sgancia ${nomeVoce(v, drink)}`}
            onClick={() => aggiornaVoceCarta(v.id, { drink_id: null })}
          >
            ✕
          </button>
        </span>
      ))}
      {altre.length > 0 && (
        <select
          value=""
          aria-label={`Aggancia ${drink.name} a una voce della carta`}
          onChange={(e) => e.target.value && aggiornaVoceCarta(e.target.value, { drink_id: drink.id })}
          style={{ marginTop: 4 }}
        >
          <option value="">Aggancia a una voce della carta…</option>
          {sezioni.map((s) => {
            const qui = altre.filter((v) => v.sezione_id === s.id)
            if (!qui.length) return null
            return (
              <optgroup key={s.id} label={s.nome}>
                {qui.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nome || '(senza nome)'}
                    {v.drink_id ? ' — già agganciata, si sposta qui' : ''}
                  </option>
                ))}
              </optgroup>
            )
          })}
        </select>
      )}
    </div>
  )
}

// La carta arriva da MenuManager, che la tiene già per le schede delle
// voci: una sottoscrizione sola.
export default function CartaManager({ carta, drinks, categories, settings }) {
  const [nuova, setNuova] = useState('')

  const perId = useMemo(() => new Map((drinks || []).map((d) => [d.id, d])), [drinks])
  const sezioni = carta.sezioni
  const vociDi = (sezioneId) =>
    ordinaCarta(
      carta.voci.filter((v) => v.sezione_id === sezioneId),
      (v) => nomeVoce(v, perId.get(v.drink_id))
    )
  const attiva = settings?.carta_attiva === true

  function aggiungiSezione() {
    if (!nuova.trim()) return
    creaSezioneCarta({ nome: nuova, ordine: sezioni.length })
    setNuova('')
  }

  function eliminaSezione(s) {
    const voci = vociDi(s.id)
    const conVoci = voci.length ? ` e le sue ${voci.length === 1 ? 'voce' : `${voci.length} voci`}` : ''
    if (!confirm(`Eliminare la sezione «${s.nome}»${conVoci}? Le voci del gestionale restano.`)) return
    eliminaSezioneCarta(
      s.id,
      voci.map((v) => v.id)
    )
  }

  return (
    <div>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>📖 Carta dei clienti</h3>
        <p className="muted small" style={{ margin: '0 0 10px' }}>
          Il menù consultato al tavolo, con sezioni e voci proprie. Ogni voce è agganciata a una voce del gestionale, da
          cui prende prezzo e disponibilità; le voci non agganciate non compaiono. Con la carta spenta il cliente vede il
          menù del gestionale, per categorie.
        </p>
        <label className="row" style={{ gap: 8, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={attiva}
            onChange={(e) => updateSettings({ carta_attiva: e.target.checked }).catch(() => {})}
          />
          <span>Carta in uso per i clienti</span>
        </label>
        {attiva && sezioni.length === 0 && (
          <p className="muted small" style={{ margin: '6px 0 0' }}>
            Finché la carta non ha voci, il cliente vede il menù del gestionale.
          </p>
        )}
        <a className="btn ghost small" style={{ marginTop: 10 }} href={PERCORSO_ANTEPRIMA_CARTA} target="_blank" rel="noreferrer">
          👁 Anteprima della carta
        </a>
      </div>

      <div className="card" style={{ marginTop: 8 }}>
        <div className="row" style={{ gap: 8 }}>
          <input
            value={nuova}
            onChange={(e) => setNuova(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && aggiungiSezione()}
            placeholder="Nuova sezione (Gin, Birre, Cocktail IBA…)"
            aria-label="Nome della nuova sezione"
          />
          <button className="btn small" onClick={aggiungiSezione}>
            Aggiungi
          </button>
        </div>
        {sezioni.length === 0 && <p className="muted small" style={{ margin: '8px 0 0' }}>Nessuna sezione.</p>}
      </div>

      {sezioni.map((s, idx) => {
        const voci = vociDi(s.id)
        const snella = s.vista === 'snella'
        return (
          <section className="card carta-sezione" key={s.id} style={{ marginTop: 8 }} aria-label={`Sezione ${s.nome}`}>
            <div className="row" style={{ gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <Campo
                valore={s.nome}
                salva={(nome) => nome && aggiornaSezioneCarta(s.id, { nome })}
                aria-label="Nome della sezione"
                style={{ flex: '1 1 180px', fontWeight: 600 }}
              />
              <select
                value={s.vista}
                onChange={(e) => aggiornaSezioneCarta(s.id, { vista: e.target.value })}
                aria-label="Visualizzazione della sezione"
                style={{ width: 'auto' }}
              >
                {VISTE_CARTA.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
              <button className="btn ghost small" aria-label="Sezione su" disabled={idx === 0} onClick={() => sposta(sezioni, idx, -1, aggiornaSezioneCarta)}>
                ↑
              </button>
              <button
                className="btn ghost small"
                aria-label="Sezione giù"
                disabled={idx === sezioni.length - 1}
                onClick={() => sposta(sezioni, idx, 1, aggiornaSezioneCarta)}
              >
                ↓
              </button>
              <button className="btn ghost small" aria-label={`Elimina la sezione ${s.nome}`} onClick={() => eliminaSezione(s)}>
                🗑
              </button>
            </div>
            <p className="muted small" style={{ margin: '4px 0 8px' }}>
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
                      salva={(nome) => aggiornaVoceCarta(v.id, { nome })}
                      placeholder={drink?.name || 'Nome in carta'}
                      aria-label="Nome in carta"
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
                    aria-label="Voce del gestionale agganciata"
                    style={{ marginTop: 6 }}
                  />
                  {!drink && (
                    <p className="muted small" style={{ margin: '4px 0 0' }}>
                      Non agganciata: al tavolo non compare.
                    </p>
                  )}
                  {drink && !drink.available && (
                    <p className="muted small" style={{ margin: '4px 0 0' }}>
                      La voce del gestionale è fuori menù: al tavolo non compare.
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
                        aria-label="Descrizione in carta"
                        style={{ marginTop: 6 }}
                      />
                      <Campo
                        valore={v.ingredienti}
                        salva={(ingredienti) => aggiornaVoceCarta(v.id, { ingredienti })}
                        placeholder="Ingredienti, separati da virgola"
                        aria-label="Ingredienti in carta"
                        style={{ marginTop: 6 }}
                      />
                    </>
                  )}
                </div>
              )
            })}
            <button
              className="btn secondary small"
              style={{ marginTop: 6 }}
              onClick={() => creaVoceCarta({ sezione_id: s.id, ordine: voci.length })}
            >
              + Voce
            </button>
          </section>
        )
      })}
    </div>
  )
}
