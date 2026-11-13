import { useId, useMemo, useState } from 'react'
import { aggiornaVoceCarta } from '../lib/api.js'
import {
  etichetteDellaVoce,
  etichetteDaTesto,
  etichettaLibera,
  etichettaPulita,
  propostaDallaRicetta,
  suggerimenti,
  GRUPPI_SUGGERIMENTO,
} from '../lib/etichetteIngredienti.js'

const testo = (v) => (typeof v === 'string' ? v.trim() : '')
const chiave = (e) => `${e.tipo}:${e.id ?? e.nome.toLowerCase()}`
const NOME_GRUPPO = Object.fromEntries(GRUPPI_SUGGERIMENTO.map((g) => [g.id, g.nome]))

// ── GLI INGREDIENTI DI UNA VOCE, A ETICHETTE (REQ-MENU-040) ───────────
//
// Nell'editor del menù dei clienti. Si scrive, e mentre si scrive sotto
// compaiono i suggerimenti, distinti per gruppo (dalla ricetta del prodotto
// collegato, le sue categorie, il resto del magazzino, le categorie della
// cassa); Invio prende il primo, o scrive un'etichetta libera. Le etichette
// della ricetta che mancano stanno sotto come PROPOSTE tratteggiate, da
// aggiungere con un tocco: non entrano da sole (Flavio, 04/11/2026: «non li
// devi prendere dalla ricetta»). Una voce che non ha mai avuto etichette
// parte dal testo di prima, spezzato, e lo riscrive solo quando la si tocca.
// Ogni cambio si salva subito, come gli altri testi della voce.
export default function IngredientiVoce({ voce, drink, items = [], categorieMagazzino = [], categorieCassa = [] }) {
  const id = useId()
  const [scritto, setScritto] = useState('')
  const proprie = etichetteDellaVoce(voce.etichette)
  const base = testo(voce.ingredienti) || testo(drink?.ingredienti)
  const attuali = proprie ?? etichetteDaTesto(base)
  const nascosti = voce.ingredienti_nascosti === true
  const proposta = useMemo(() => propostaDallaRicetta(drink, items), [drink, items])
  const presenti = new Set(attuali.map(chiave))
  const daProporre = proposta.filter((e) => !presenti.has(chiave(e)))
  const lista = suggerimenti(scritto, { drink, items, categorieMagazzino, categorieCassa, scelte: attuali })

  const salva = (nuove) => aggiornaVoceCarta(voce.id, { etichette: nuove.map(etichettaPulita).filter(Boolean) })
  const aggiungi = (e) => {
    const pulita = etichettaPulita(e)
    if (!pulita || presenti.has(chiave(pulita))) return
    salva([...attuali, pulita])
    setScritto('')
  }
  const togli = (e) => salva(attuali.filter((x) => chiave(x) !== chiave(e)))

  const origine = proprie ? 'solo in questa voce' : testo(voce.ingredienti) ? 'testo della voce' : base ? 'dalla scheda prodotto' : ''

  return (
    <div className="wys-campo ingredienti-voce">
      <div className="wys-etichetta">
        <label htmlFor={id}>Ingredienti</label>
        {origine && <span className={`wys-origine${proprie ? ' proprio' : ''}`}>{origine}</span>}
      </div>

      <div className={`etichette${nascosti ? ' nascoste' : ''}`}>
        {attuali.map((e) => (
          <span key={chiave(e)} className={`etichetta tipo-${e.tipo}`}>
            {e.nome}
            <button type="button" aria-label={`Togli ${e.nome}`} onClick={() => togli(e)}>
              ×
            </button>
          </span>
        ))}
        <input
          id={id}
          className="wys etichette-campo"
          value={scritto}
          placeholder={attuali.length ? 'Aggiungi' : 'Scrivi un ingrediente'}
          onChange={(e) => setScritto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            e.preventDefault()
            if (!scritto.trim()) return
            aggiungi(lista[0] ?? etichettaLibera(scritto))
          }}
          aria-label="Aggiungi un ingrediente"
        />
      </div>

      {scritto.trim() && (
        <ul className="etichette-suggerimenti" role="listbox" aria-label="Suggerimenti">
          {lista.map((s) => (
            <li key={chiave(s)}>
              <button type="button" className={`suggerimento gruppo-${s.gruppo}`} onClick={() => aggiungi(s)}>
                {s.nome} <span className="muted small">{NOME_GRUPPO[s.gruppo]}</span>
              </button>
            </li>
          ))}
          <li>
            <button type="button" className="suggerimento gruppo-testo" onClick={() => aggiungi(etichettaLibera(scritto))}>
              «{scritto.trim()}» <span className="muted small">testo libero</span>
            </button>
          </li>
        </ul>
      )}

      {daProporre.length > 0 && (
        <div className="etichette-proposte">
          <span className="muted small">Dalla ricetta:</span>
          {daProporre.map((e) => (
            <button key={chiave(e)} type="button" className="etichetta proposta" onClick={() => aggiungi(e)}>
              + {e.nome}
            </button>
          ))}
        </div>
      )}

      <div className="row" style={{ gap: 12, flexWrap: 'wrap', marginTop: 4 }}>
        {proposta.length > 0 && (
          <button type="button" className="btn ghost small" onClick={() => salva(proposta)}>
            ↺ come la ricetta
          </button>
        )}
        <label className="row small" style={{ gap: 6, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={nascosti}
            onChange={(e) => aggiornaVoceCarta(voce.id, { ingredienti_nascosti: e.target.checked })}
          />
          Nascondi gli ingredienti al cliente
        </label>
      </div>
    </div>
  )
}
