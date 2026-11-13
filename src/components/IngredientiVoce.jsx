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
  alternativeDi,
  righeSostituite,
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
export default function IngredientiVoce({ voce, drink, items = [], categorieMagazzino = [], categorieCassa = [], supplementoPredefinito = 0 }) {
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
  // LA SCELTA DEL CLIENTE (REQ-MENU-042): accesa, offre tutte le
  // alternative col supplemento predefinito; poi si tolgono e si ritoccano.
  const cambiaEtichetta = (e, patch) => salva(attuali.map((x) => (chiave(x) === chiave(e) ? { ...x, ...patch } : x)))
  // Le righe della ricetta che la scelta sostituisce si ricalcolano a ogni
  // ritocco: la ricetta del prodotto può essere cambiata nel frattempo.
  const cambiaScelta = (e, offerti) =>
    cambiaEtichetta(e, { scelta: { offerti, sostituisce: righeSostituite(e, drink, items) } })
  const alternaScelta = (e) =>
    e.scelta
      ? cambiaEtichetta(e, { scelta: null })
      : cambiaScelta(e, alternativeDi(e, items).map((a) => ({ ...a, supplemento: supplementoPredefinito })))
  const conScelta = attuali.filter((e) => e.scelta)

  const origine = proprie ? 'solo in questa voce' : testo(voce.ingredienti) ? 'testo della voce' : base ? 'dalla scheda prodotto' : ''

  return (
    <div className="wys-campo ingredienti-voce">
      <div className="wys-etichetta">
        <label htmlFor={id}>Ingredienti</label>
        {origine && <span className={`wys-origine${proprie ? ' proprio' : ''}`}>{origine}</span>}
      </div>

      <div className={`etichette${nascosti ? ' nascoste' : ''}`}>
        {attuali.map((e) => (
          <span key={chiave(e)} className={`etichetta tipo-${e.tipo}${e.scelta ? ' con-scelta' : ''}`}>
            {e.nome}
            {(e.tipo === 'prodotto' || e.tipo === 'categoria') && (
              <button
                type="button"
                aria-pressed={Boolean(e.scelta)}
                aria-label={`Il cliente sceglie: ${e.nome}`}
                title="Il cliente sceglie"
                onClick={() => alternaScelta(e)}
              >
                ⇄
              </button>
            )}
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

      {conScelta.map((e) => {
        const possibili = alternativeDi(e, items)
        const offerti = new Map(e.scelta.offerti.map((o) => [o.id, o]))
        const aggiorna = (lista) => cambiaScelta(e, lista)
        return (
          <div key={chiave(e)} className="scelta-cliente" role="group" aria-label={`Il cliente sceglie: ${e.nome}`}>
            <p className="small" style={{ margin: '0 0 4px' }}>
              <strong>Il cliente sceglie: {e.nome}</strong> · chi non sceglie ha il prodotto della ricetta
            </p>
            {!righeSostituite(e, drink, items).length && (
              <p className="muted small" style={{ margin: '0 0 4px' }}>
                Nessuna riga della ricetta del prodotto collegato corrisponde a «{e.nome}»: la scelta arriva al banco
                nella nota della riga e lo scarico segue la ricetta invariata.
              </p>
            )}
            {possibili.length === 0 ? (
              <p className="muted small" style={{ margin: 0 }}>
                Nessun prodotto di questa categoria ha «Il cliente può sceglierlo dal menù» (scheda del prodotto di
                magazzino).
              </p>
            ) : (
              possibili.map((a) => {
                const o = offerti.get(a.id)
                return (
                  <div key={a.id} className="scelta-cliente-riga">
                    <label className="row small" style={{ gap: 6, alignItems: 'center' }}>
                      <input
                        type="checkbox"
                        checked={Boolean(o)}
                        onChange={(ev) =>
                          aggiorna(
                            ev.target.checked
                              ? [...e.scelta.offerti, { ...a, supplemento: supplementoPredefinito }]
                              : e.scelta.offerti.filter((x) => x.id !== a.id)
                          )
                        }
                      />
                      {a.nome}
                    </label>
                    {o && (
                      <input
                        className="wys scelta-supplemento"
                        type="number"
                        step="0.5"
                        min="0"
                        defaultValue={o.supplemento || ''}
                        placeholder="+ € 0"
                        aria-label={`Supplemento per ${a.nome}`}
                        onBlur={(ev) =>
                          aggiorna(e.scelta.offerti.map((x) => (x.id === a.id ? { ...x, supplemento: ev.target.value } : x)))
                        }
                      />
                    )}
                  </div>
                )
              })
            )}
          </div>
        )
      })}

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
