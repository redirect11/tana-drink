import { useMemo, useState } from 'react'
import { pianoSwitch } from '../lib/switchProdotto.js'
import { switchProdotto } from '../lib/api.js'
import { tr } from '../lib/lingua.js'

// LO SWITCH PRODOTTO (REQ-MENU-043), in cima a Modifica menù. Flavio,
// 14/11/2026: il fornitore gli aveva cambiato il Carpano Dry con un Noilly
// Prat, e il Carpano stava in tutte le ricette dei Martini. Si sceglie il
// prodotto in uscita e quello in ingresso, si guarda cosa cambia, si
// conferma. Le regole stanno in lib/switchProdotto.js.
export default function SwitchProdotto({ drinks = [], inventory = [], voci = [], onFatto }) {
  const [aperto, setAperto] = useState(false)
  const [uscitaId, setUscitaId] = useState('')
  const [ingressoId, setIngressoId] = useState('')
  const [busy, setBusy] = useState(false)
  const [esito, setEsito] = useState(null) // { ok, testo }

  const prodotti = useMemo(
    () => [...(inventory || [])].sort((a, b) => String(a.name).localeCompare(String(b.name), 'it')),
    [inventory]
  )
  // Accanto a ogni prodotto in uscita, in quante ricette sta: si sceglie
  // sapendo cosa si tocca.
  const quante = useMemo(() => {
    const m = new Map()
    for (const d of drinks || [])
      for (const id of new Set((d.recipe_items || []).map((r) => r.inventory_item_id))) m.set(id, (m.get(id) || 0) + 1)
    return m
  }, [drinks])
  const uscita = prodotti.find((p) => p.id === uscitaId) || null
  const ingresso = prodotti.find((p) => p.id === ingressoId) || null
  const piano = useMemo(() => pianoSwitch({ drinks, voci, uscita, ingresso }), [drinks, voci, uscita, ingresso])
  const daFare = piano && (piano.ricette.length > 0 || piano.voci.length > 0)
  const bloccato = !!piano?.incompatibili.length

  async function esegui() {
    if (!daFare || bloccato || busy) return
    setBusy(true)
    setEsito(null)
    try {
      const fatto = await switchProdotto(piano)
      setEsito({
        ok: true,
        testo: tr('{uscita} sostituito da {ingresso}: {ricette} ricette, {voci} voci del menù dei clienti.', {
          uscita: uscita.name,
          ingresso: ingresso.name,
          ricette: fatto.ricette,
          voci: fatto.voci,
        }),
      })
      setUscitaId('')
      setIngressoId('')
      onFatto?.()
    } catch (e) {
      setEsito({ ok: false, testo: tr('Switch non riuscito: {errore}', { errore: e.message }) })
    } finally {
      setBusy(false)
    }
  }

  if (!aperto) {
    return (
      <button type="button" className="btn ghost block" style={{ marginBottom: 8 }} onClick={() => setAperto(true)}>
        ⇄ {tr('Switch prodotto')}
      </button>
    )
  }

  return (
    <div className="card" role="group" aria-label={tr('Switch prodotto')} style={{ marginBottom: 8 }}>
      <div className="row between" style={{ alignItems: 'center' }}>
        <strong>⇄ {tr('Switch prodotto')}</strong>
        <button type="button" className="btn ghost small" onClick={() => setAperto(false)} aria-label={tr('Chiudi lo switch')}>
          ✕
        </button>
      </div>
      <p className="muted small" style={{ margin: '4px 0 8px' }}>
        {tr(
          'Sostituisce un prodotto di magazzino con un altro in tutte le ricette che lo contengono, a parità di quantità, e nelle etichette del menù dei clienti. Le ricette che contengono solo il prodotto in ingresso restano invariate.'
        )}
      </p>
      <div className="grid-2">
        <div>
          <label htmlFor="switch-uscita">{tr('Prodotto in uscita')}</label>
          <select id="switch-uscita" value={uscitaId} onChange={(e) => setUscitaId(e.target.value)}>
            <option value="">{tr('— Scegli —')}</option>
            {prodotti.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {quante.get(p.id) ? ` (${quante.get(p.id)})` : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="switch-ingresso">{tr('Prodotto in ingresso')}</label>
          <select id="switch-ingresso" value={ingressoId} onChange={(e) => setIngressoId(e.target.value)}>
            <option value="">{tr('— Scegli —')}</option>
            {prodotti
              .filter((p) => p.id !== uscitaId)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </div>
      </div>

      {piano && (
        <div className="small" style={{ marginTop: 10 }} role="status">
          {!daFare ? (
            <p style={{ margin: 0 }}>
              {tr('{nome} non è in nessuna ricetta né in nessuna etichetta del menù dei clienti.', { nome: uscita.name })}
            </p>
          ) : (
            <>
              <p style={{ margin: 0 }}>
                {tr('{ricette} ricette e {voci} voci del menù dei clienti passano da {uscita} a {ingresso}.', {
                  ricette: piano.ricette.length,
                  voci: piano.voci.length,
                  uscita: uscita.name,
                  ingresso: ingresso.name,
                })}
              </p>
              {piano.ricette.length > 0 && (
                <ul aria-label={tr('Ricette che cambiano')} style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                  {piano.ricette.map((r) => (
                    <li key={r.id}>
                      {r.nome}
                      {r.conIngresso && (
                        <span className="muted"> · {tr('contiene già {nome}: avrà due righe di {nome}', { nome: ingresso.name })}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {piano.voci.length > 0 && (
                <ul aria-label={tr('Voci del menù dei clienti che cambiano')} style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                  {piano.voci.map((v) => (
                    <li key={v.id}>
                      {v.nome || tr('(voce senza nome)')} · {tr('etichetta')}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          {bloccato && (
            <div className="banner" style={{ marginTop: 8 }}>
              {tr(
                '{ingresso} non si dosa in {unita} come {uscita} in {ricette}: la quantità perderebbe significato. Lo switch richiede due prodotti misurati allo stesso modo.',
                {
                  ingresso: ingresso.name,
                  unita: [...new Set(piano.incompatibili.flatMap((i) => i.unita))].join(', '),
                  uscita: uscita.name,
                  ricette: piano.incompatibili.map((i) => i.nome).join(', '),
                }
              )}
            </div>
          )}
        </div>
      )}

      {esito && (
        <p className="small" role={esito.ok ? 'status' : 'alert'} style={{ margin: '10px 0 0' }}>
          {esito.testo}
        </p>
      )}

      <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <button type="button" className="btn small" disabled={!daFare || bloccato || busy} onClick={esegui}>
          {busy
            ? tr('Sostituzione…')
            : piano?.ricette.length === 1
              ? tr('Sostituisci in 1 ricetta')
              : piano?.ricette.length
                ? tr('Sostituisci in {n} ricette', { n: piano.ricette.length })
                : tr('Sostituisci')}
        </button>
        <button type="button" className="btn ghost small" disabled={busy} onClick={() => setAperto(false)}>
          {tr('Annulla')}
        </button>
      </div>
    </div>
  )
}
