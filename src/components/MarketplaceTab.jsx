import { useEffect, useState } from 'react'
import { subscribeSettings, updateSettings, settingsIniziali } from '../lib/api.js'
import { Sottosezioni } from '../lib/sottosezioni.js'
import { resolveThemeVars } from '../lib/themes.js'
import {
  STILI_MENU,
  nomeStile,
  stiliInstallati,
  stileMenu,
  patchInstalla,
  patchDisinstalla,
} from '../lib/stileMenu.js'
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

// ── IL MARKETPLACE (REQ-MENU-023) ─────────────────────────────────────
// Una pagina sua, nel menu laterale, e non un riquadro delle Impostazioni.
// L'utente, 02/11/2026: «ti avevo chiesto una sezione marketplace separata,
// una finestra/pagina nuova che apro per navigare i temi come se fosse un
// catalogo e poi li installo sulla mia istanza». E la regola della
// navigazione lo dice (docs/navigazione.md): risponde a una domanda diversa
// — «che aspetto potrebbe avere il mio menù» — da quella delle Impostazioni.
//
// Tre sezioni, nel menu a scomparsa come per ogni pagina: i TEMI (tavolozza
// più stile), gli STILI da soli (sui colori del locale), e quello che il
// locale ha INSTALLATO. Ogni scheda è una vetrina: un pezzo del menù vero,
// una categoria e due voci, scritto con le classi del menù e coi colori del
// tema sull'elemento. Si prova sul menù, si installa, si usa. Per ora tutto
// gratis; «Compra» arriverà coi temi a pagamento (REQ-LIC-011).

const SEZIONI = [
  { id: 'temi', icona: '🎨', label: 'Temi' },
  { id: 'stili', icona: '🖋️', label: 'Stili del menù' },
  { id: 'installati', icona: '✅', label: 'Installati' },
]

const prova = (chiave, id) =>
  `${import.meta.env.BASE_URL || '/'}menu?vista=cliente&${chiave}=${encodeURIComponent(id)}`

// Un pezzo del menù vero, con le classi del menù: ogni stile lo disegna con
// le sue regole, come disegna il menù dei clienti.
function Vetrina({ colori, stile }) {
  return (
    <div className={`vetrina-tema stile-${stile}`} style={resolveThemeVars(colori)} aria-hidden="true">
      <h3 className="cat-header">Cocktail</h3>
      {[
        ['Negroni', 'Gin, bitter e vermouth rosso', '9,00 €'],
        ['Spritz', 'Aperitivo, prosecco e soda', '7,00 €'],
      ].map(([nome, desc, prezzo]) => (
        <div className="card menu-item" key={nome}>
          <div className="row between">
            <div className="grow">
              <h3>
                <span className="menu-item-nome">{nome}</span>
              </h3>
              <p className="muted menu-item-descrizione">{desc}</p>
              <span className="price">{prezzo}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function Scheda({ titolo, sottotitolo, descrizione, vetrina, children }) {
  return (
    <article className="scheda-marketplace">
      {vetrina}
      <div className="scheda-marketplace-testo">
        <h3>{titolo}</h3>
        <p className="muted small">{descrizione}</p>
        <p className="muted small">{sottotitolo}</p>
      </div>
      <div className="scheda-marketplace-azioni">{children}</div>
    </article>
  )
}

const STATI = {
  carica: 'Aggiornamento del catalogo in corso…',
  senza_rete: 'Il catalogo della regia non risponde: si vedono i temi già noti a questo dispositivo.',
}

export default function MarketplaceTab() {
  const [settings, setSettings] = useState(() => settingsIniziali())
  const [errore, setErrore] = useState(null)
  const [sezione, setSezione] = useState('temi')
  const [daRegia, setDaRegia] = useState(() => catalogoRicordato())
  const [stato, setStato] = useState(() => (urlCatalogo() ? 'carica' : null))

  useEffect(() => subscribeSettings(setSettings, (e) => setErrore(e.message)), [])
  // Il catalogo della regia si legge quando si apre la pagina, mai a tempo.
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

  // Come le Impostazioni: si vede subito, la scrittura parte in sottofondo.
  const salva = (patch) => {
    if (!patch) return
    setErrore(null)
    setSettings((s) => ({ ...s, ...patch }))
    updateSettings(patch).catch((e) => setErrore(e.message))
  }

  const installati = temiInstallati(settings)
  const inUso = temaInUso(settings)
  const stileInUso = stileMenu(settings)
  const coloriDelLocale = settings.theme_client || null

  const schedaTema = (t) => {
    const installato = installati.some((i) => i.id === t.id)
    return (
      <Scheda
        key={t.id}
        titolo={t.nome}
        descrizione={t.descrizione}
        sottotitolo={`Stile «${nomeStile(t.stile)}» · Gratis`}
        vetrina={<Vetrina colori={temaComeColori(t)} stile={t.stile} />}
      >
        <a className="link-inline small" href={prova('tema', t.id)}>
          Prova sul menù
        </a>
        {inUso === t.id ? (
          <span className="small">In uso</span>
        ) : installato ? (
          <button type="button" className="btn small" aria-label={`Usa ${t.nome}`} onClick={() => salva(patchUsaTema(settings, t))}>
            Usa
          </button>
        ) : (
          <button
            type="button"
            className="btn small"
            aria-label={`Installa ${t.nome}`}
            onClick={() => salva(patchInstallaTema(settings, t))}
          >
            Installa
          </button>
        )}
        {installato && sezione === 'installati' && (
          <button
            type="button"
            className="link-inline small"
            aria-label={`Disinstalla ${t.nome}`}
            onClick={() => salva(patchDisinstallaTema(settings, t.id))}
          >
            Disinstalla
          </button>
        )}
      </Scheda>
    )
  }

  const schedaStile = (s) => {
    const installato = stiliInstallati(settings).includes(s.id)
    return (
      <Scheda
        key={s.id}
        titolo={s.nome}
        descrizione={s.desc}
        sottotitolo="Sui colori del menù del locale · Gratis"
        vetrina={<Vetrina colori={coloriDelLocale} stile={s.id} />}
      >
        <a className="link-inline small" href={prova('stile', s.id)}>
          Prova sul menù
        </a>
        {stileInUso === s.id ? (
          <span className="small">In uso</span>
        ) : installato ? (
          <button
            type="button"
            className="btn small"
            aria-label={`Usa lo stile ${s.nome}`}
            onClick={() => salva({ stile_menu: s.id })}
          >
            Usa
          </button>
        ) : (
          <button
            type="button"
            className="btn small"
            aria-label={`Installa lo stile ${s.nome}`}
            onClick={() => salva(patchInstalla(settings, s.id))}
          >
            Installa
          </button>
        )}
        {installato && sezione === 'installati' && (
          <button
            type="button"
            className="link-inline small"
            aria-label={`Disinstalla lo stile ${s.nome}`}
            onClick={() => salva(patchDisinstalla(settings, s.id))}
          >
            Disinstalla
          </button>
        )}
      </Scheda>
    )
  }

  const stiliGratis = STILI_MENU.filter((s) => s.gratis)
  const stiliDelLocale = STILI_MENU.filter((s) => stiliInstallati(settings).includes(s.id))

  return (
    <div className="pagina-marketplace">
      <Sottosezioni voci={SEZIONI} attiva={sezione} scegli={setSezione} />
      {errore && <div className="banner">Errore: {errore}</div>}

      {sezione === 'temi' && (
        <section>
          <h2>Temi</h2>
          <p className="muted">
            Un tema è una tavolozza di colori con uno stile del menù. Vale per il menù dei clienti: i colori del
            gestionale non cambiano.
          </p>
          {stato && <p className="muted small">{STATI[stato]}</p>}
          <div className="griglia-marketplace">{catalogo(settings, daRegia).map(schedaTema)}</div>
        </section>
      )}

      {sezione === 'stili' && (
        <section>
          <h2>Stili del menù</h2>
          <p className="muted">
            La forma del menù dei clienti — impaginazione, caratteri, filetti — sui colori che il locale usa già.
          </p>
          <div className="griglia-marketplace">{stiliGratis.map(schedaStile)}</div>
        </section>
      )}

      {sezione === 'installati' && (
        <section>
          <h2>Installati</h2>
          {installati.length === 0 && stiliDelLocale.length === 0 ? (
            <p className="muted">
              Nessun tema né stile installato. Si scelgono in «Temi» e in «Stili del menù».
            </p>
          ) : (
            <div className="griglia-marketplace">
              {installati.map(schedaTema)}
              {stiliDelLocale.map(schedaStile)}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
