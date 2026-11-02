import { useEffect, useState } from 'react'
import { resolveThemeVars } from '../lib/themes.js'
import { nomeStile } from '../lib/stileMenu.js'
import {
  catalogo,
  catalogoRicordato,
  scaricaCatalogo,
  urlCatalogo,
  temiInstallati,
  temaInUso,
  temaComeColori,
  patchInstallaTema,
  patchUsaTema,
  patchDisinstallaTema,
} from '../lib/marketplaceTemi.js'

// ── IL MARKETPLACE DEI TEMI, IN IMPOSTAZIONI → ASPETTO (REQ-MENU-023) ──
// «Una pagina che carica tutti i temi disponibili» (l'utente, 02/11/2026).
// Sopra i temi del locale, sotto quelli del catalogo: l'iniziale dell'app e
// quello che la regia pubblica, letto all'apertura di questa pagina (mai a
// tempo). Ogni scheda è un assaggio del tema vero: i suoi colori e il suo
// stile, scritti con le stesse regole del menù. «Prova sul menù» apre il
// menù del cliente col tema, solo per chi la apre.
// Sui tasti basta il verbo («Installa», «Usa»): col nome del tema andavano
// a capo, e le schede di una riga venivano alte diverse. Il nome resta per
// chi legge lo schermo (aria-label).
// Per ora è tutto gratis: «Compra» arriverà coi temi a pagamento
// (REQ-LIC-011).

const urlProva = (id) => `${import.meta.env.BASE_URL || '/'}menu?vista=cliente&tema=${encodeURIComponent(id)}`

function AssaggioTema({ tema }) {
  const vars = resolveThemeVars(temaComeColori(tema))
  return (
    <div className="assaggio-tema" style={vars} aria-hidden="true">
      <span className={`assaggio-stile stile-${tema.stile}`}>
        <span className="assaggio-nome">Negroni</span>
        <span className="assaggio-prezzo">9,00 €</span>
      </span>
      <span className="assaggio-tavolozza">
        {['--bg', '--card', '--accent', '--accent-2', '--text'].map((k) => (
          <span key={k} style={{ background: `var(${k})` }} />
        ))}
      </span>
    </div>
  )
}

function SchedaTema({ tema, children }) {
  return (
    <div className="stile-scheda tema-scheda">
      <div className="mode-option">
        <AssaggioTema tema={tema} />
        <strong>{tema.nome}</strong>
        <span className="muted small" style={{ display: 'block', fontWeight: 400 }}>
          {tema.descrizione}
        </span>
        <span className="muted small" style={{ display: 'block', fontWeight: 400, marginTop: 4 }}>
          Stile «{nomeStile(tema.stile)}» · Gratis
        </span>
      </div>
      <div className="stile-azioni">
        <a className="link-inline small" href={urlProva(tema.id)}>
          Prova sul menù
        </a>
        {children}
      </div>
    </div>
  )
}

const STATI = {
  carica: 'Aggiornamento del catalogo in corso…',
  senza_rete: 'Il catalogo della regia non risponde: si vedono i temi già noti a questo dispositivo.',
}

export default function MarketplaceTemi({ settings, onSave }) {
  const [daRegia, setDaRegia] = useState(() => catalogoRicordato())
  const [stato, setStato] = useState(() => (urlCatalogo() ? 'carica' : null))

  useEffect(() => {
    if (!urlCatalogo()) return undefined
    let vivo = true
    scaricaCatalogo().then((temi) => {
      if (!vivo) return
      if (temi) setDaRegia(temi)
      setStato(temi ? null : 'senza_rete')
    })
    return () => {
      vivo = false
    }
  }, [])

  const installati = temiInstallati(settings)
  const inUso = temaInUso(settings)
  const daScoprire = catalogo(settings, daRegia).filter((t) => !installati.some((i) => i.id === t.id))

  return (
    <div className="card settings-section">
      <h3>Marketplace dei temi</h3>
      <p className="muted" style={{ margin: '0 0 10px', fontSize: '0.85rem' }}>
        Un tema è una tavolozza di colori con uno stile del menù. Vale per il menù dei clienti: i colori del
        gestionale restano quelli scelti qui sopra.
      </p>
      {stato && <p className="muted small">{STATI[stato]}</p>}

      {installati.length > 0 && (
        <>
          <h4 style={{ margin: '12px 0 6px' }}>I temi del locale</h4>
          <div className="mode-choice stili-menu">
            {installati.map((t) => (
              <SchedaTema key={t.id} tema={t}>
                {inUso === t.id ? (
                  <span className="small">In uso</span>
                ) : (
                  <button
                    type="button"
                    className="btn small"
                    aria-label={`Usa ${t.nome}`}
                    onClick={() => onSave(patchUsaTema(settings, t))}
                  >
                    Usa
                  </button>
                )}
                <button
                  type="button"
                  className="link-inline small"
                  aria-label={`Disinstalla ${t.nome}`}
                  onClick={() => onSave(patchDisinstallaTema(settings, t.id))}
                >
                  Disinstalla
                </button>
              </SchedaTema>
            ))}
          </div>
        </>
      )}

      {daScoprire.length > 0 && (
        <>
          <h4 style={{ margin: '16px 0 6px' }}>Nel marketplace</h4>
          <div className="mode-choice stili-menu">
            {daScoprire.map((t) => (
              <SchedaTema key={t.id} tema={t}>
                <button
                  type="button"
                  className="btn small"
                  aria-label={`Installa ${t.nome}`}
                  onClick={() => onSave(patchInstallaTema(settings, t))}
                >
                  Installa
                </button>
              </SchedaTema>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
