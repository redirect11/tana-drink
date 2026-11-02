import { useEffect, useState } from 'react'
import { subscribeSettings, updateSettings, settingsIniziali, azioneModulo } from '../lib/api.js'
import { isAdmin } from '../lib/ruoli.js'
import { dataAvviso } from '../lib/aggiornamenti.js'
import { Sottosezioni } from '../lib/sottosezioni.js'
import { resolveThemeVars } from '../lib/themes.js'
import { TestataGiornale } from './MenuGiornale.jsx'
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
import {
  schedeModuli,
  listinoRicordato,
  scaricaListino,
  urlListino,
  urlAzioni,
  urlRitorno,
  acquistiDallApp,
  prezzoAlMese,
  esitoRitorno,
} from '../lib/marketplaceModuli.js'

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
//
// La quarta sezione, i MODULI (REQ-LIC-012), è un altro mestiere: non
// l'aspetto del menù ma cosa fa l'installazione. Sta qui perché è lo stesso
// gesto — sfogliare un catalogo e prendere quello che serve — e perché
// l'utente l'ha chiesta così: «anche per i moduli aggiuntivi andrebbe fatto
// il marketplace».

const SEZIONI = [
  { id: 'temi', icona: '🎨', label: 'Temi' },
  { id: 'stili', icona: '🖋️', label: 'Stili del menù' },
  { id: 'installati', icona: '✅', label: 'Installati' },
  { id: 'moduli', icona: '🧩', label: 'Moduli' },
]

// La sezione da aprire: quella dell'indirizzo, se esiste. Ci si arriva così
// tornando dalla pagina di pagamento (`?tab=marketplace&sezione=moduli`).
const sezioneIniziale = (search) => {
  const chiesta = new URLSearchParams(search || '').get('sezione')
  return SEZIONI.some((s) => s.id === chiesta) ? chiesta : 'temi'
}

const prova = (chiave, id) =>
  `${import.meta.env.BASE_URL || '/'}menu?vista=cliente&${chiave}=${encodeURIComponent(id)}`

// Un pezzo del menù vero, con le classi del menù: ogni stile lo disegna con
// le sue regole, come disegna il menù dei clienti. Uno stile con una
// struttura sua (il «Giornale», REQ-MENU-024) mostra quella.
function Vetrina({ colori, stile }) {
  if (stile === 'giornale') {
    return (
      <div className="vetrina-tema stile-giornale" style={resolveThemeVars(colori)} aria-hidden="true">
        <TestataGiornale venue={{ venue_name: 'Il Locale' }} />
        <h3 className="g-sezione-titolo">
          <span>Cocktail</span>
          <span className="g-sezione-conto">2 voci</span>
        </h3>
        {[
          ['Negroni', '9,00 €', 'Gin, bitter e vermouth rosso'],
          ['Spritz', '7,00 €', 'Aperitivo, prosecco e soda'],
        ].map(([nome, prezzo, desc]) => (
          <article className="g-voce" key={nome}>
            <h4>
              <span>{nome}</span>
              <span className="g-puntini" />
              <span className="g-prezzo">{prezzo}</span>
            </h4>
            <p className="g-testo">{desc}</p>
          </article>
        ))}
      </div>
    )
  }
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

// ── I MODULI ──────────────────────────────────────────────────────────
// Lo stato di ogni modulo viene dalla licenza; prezzi e giorni di prova dal
// listino della regia. I tasti — prova, acquisto, disdetta — li vede solo il
// titolare (decisione dell'utente, 02/11/2026), e solo se la licenza è
// della regia (acquistiDallApp). Il pagamento si fa sulla pagina di Stripe:
// l'app ci manda il titolare e la regia lo riporta qui, sui moduli.
const ICONE_MODULI = {
  menu_tavoli: '📱',
  ordini_cliente: '🛎️',
  clienti: '👥',
  magazzino: '📦',
  statistiche: '📊',
  staff: '🧑‍🍳',
  sumup: '💳',
  conta: '📋',
  fatture: '🧾',
  scadenzario: '📅',
}

const ESITI_RITORNO = {
  pagato: { tipo: 'ok', testo: 'Pagamento ricevuto. Il modulo si attiva appena la regia aggiorna la licenza.' },
  annullato: { tipo: 'info', testo: 'Pagamento annullato: nessun addebito e nessuna modifica alla licenza.' },
}

// Il testo di una richiesta non andata. Quello della regia, se lo manda (è
// il caso che conosce lei: prova già usata, modulo compreso nel piano…).
function testoErrore(r) {
  if (r.errore) return r.errore
  if (r.status === 0) return 'La regia non risponde. Verificare la connessione e riprovare.'
  if (r.status === 401 || r.status === 403) return 'Moduli e abbonamenti li modifica solo il titolare, con il proprio accesso.'
  return 'Operazione non riuscita. Riprovare tra qualche minuto.'
}

const statoInChiaro = (m) =>
  m.stato === 'prova' ? `In prova fino al ${dataAvviso(m.prova_fino)}` : m.stato === 'incluso' ? 'Incluso' : 'Non incluso'

function SezioneModuli({ settings, role }) {
  const [listino, setListino] = useState(() => listinoRicordato())
  const [statoListino, setStatoListino] = useState(() => (urlListino() ? 'carica' : null))
  const [avviso, setAvviso] = useState(() => ESITI_RITORNO[esitoRitorno(globalThis.location?.search)] || null)
  const [inCorso, setInCorso] = useState(null)
  const [conferma, setConferma] = useState(null)

  // Il listino si legge quando si aprono i moduli, mai a tempo.
  useEffect(() => {
    if (!urlListino()) return undefined
    let vivo = true
    scaricaListino().then((voci) => {
      if (!vivo) return
      if (voci) setListino(voci)
      setStatoListino(voci ? null : 'senza_rete')
    })
    return () => {
      vivo = false
    }
  }, [])

  // L'esito del ritorno da Stripe si dice una volta: tolto dall'indirizzo,
  // un ricaricamento della pagina non lo ripete.
  useEffect(() => {
    const url = new URL(globalThis.location.href)
    if (!url.searchParams.has('esito')) return
    url.searchParams.delete('esito')
    globalThis.history?.replaceState(globalThis.history.state, '', url)
  }, [])

  const titolare = isAdmin(role)
  const acquisti = acquistiDallApp(settings)
  const moduli = schedeModuli(settings, listino)

  const esegui = async (m, azione) => {
    setConferma(null)
    setAvviso(null)
    setInCorso(m.id)
    const r = await azioneModulo(urlAzioni(), m.id, azione, urlRitorno())
    if (r.ok && r.checkout_url) {
      // Si resta «in corso» finché il browser non cambia pagina.
      globalThis.location.assign(r.checkout_url)
      return
    }
    setInCorso(null)
    if (!r.ok) {
      setAvviso({ tipo: 'errore', testo: testoErrore(r) })
      return
    }
    const testi = {
      prova: `Prova di «${m.nome}» attivata: il modulo compare fra pochi istanti.`,
      aggiungi: `«${m.nome}» aggiunto: il modulo compare fra pochi istanti.`,
      disdici: r.dal
        ? `Disdetta registrata: «${m.nome}» resta attivo fino al ${dataAvviso(r.dal)}.`
        : `Disdetta registrata: «${m.nome}» resta attivo fino alla fine del periodo pagato.`,
    }
    setAvviso({ tipo: 'ok', testo: testi[azione] })
  }

  const tasti = (m) => {
    if (!titolare || !acquisti) return null
    if (!m.in_vendita) {
      return m.stato === 'non_incluso' ? <span className="muted small">Non acquistabile singolarmente</span> : null
    }
    const occupato = inCorso !== null
    if (conferma === m.id) {
      return (
        <>
          <span className="small">Confermare la disdetta?</span>
          <span className="row" style={{ gap: 8 }}>
            <button type="button" className="btn ghost small" onClick={() => setConferma(null)}>
              Annulla
            </button>
            <button
              type="button"
              className="btn small"
              aria-label={`Conferma la disdetta di ${m.nome}`}
              onClick={() => esegui(m, 'disdici')}
            >
              Disdici
            </button>
          </span>
        </>
      )
    }
    if (m.stato === 'incluso') {
      return (
        <button
          type="button"
          className="link-inline small"
          aria-label={`Disdici ${m.nome}`}
          disabled={occupato}
          onClick={() => setConferma(m.id)}
        >
          Disdici
        </button>
      )
    }
    return (
      <>
        {m.stato === 'non_incluso' && m.prova_giorni > 0 ? (
          <button
            type="button"
            className="link-inline small"
            aria-label={`Prova ${m.nome} gratis per ${m.prova_giorni} giorni`}
            disabled={occupato}
            onClick={() => esegui(m, 'prova')}
          >
            Prova gratis {m.prova_giorni} giorni
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          className="btn small"
          aria-label={`Aggiungi ${m.nome}`}
          disabled={occupato}
          onClick={() => esegui(m, 'aggiungi')}
        >
          {inCorso === m.id ? 'Attendere…' : 'Aggiungi'}
        </button>
      </>
    )
  }

  return (
    <section>
      <h2>Moduli</h2>
      <p className="muted">
        Le funzioni oltre a menù, ordini e cassa. Si attivano sulla licenza dell'installazione, con abbonamento
        mensile; dove previsto, una prova gratuita prima dell'acquisto.
      </p>
      {!acquisti && (
        <p className="muted small">
          La licenza di questa installazione si gestisce presso chi la amministra: qui si consulta soltanto.
        </p>
      )}
      {acquisti && !titolare && (
        <p className="muted small">Moduli e abbonamenti li gestisce il titolare.</p>
      )}
      {statoListino && (
        <p className="muted small">
          {statoListino === 'carica'
            ? 'Aggiornamento del listino in corso…'
            : 'Il listino della regia non risponde: prezzi e prove sono quelli già noti a questo dispositivo.'}
        </p>
      )}
      {/* Un errore è un avviso (il banner giallo di sempre); un esito andato
          bene no: il giallo con la scritta rossa lo farebbe sembrare un guaio. */}
      {avviso && (
        <div className={avviso.tipo === 'errore' ? 'banner' : 'avviso-marketplace'} role="status">
          {avviso.testo}
        </div>
      )}
      <div className="griglia-marketplace">
        {moduli.map((m) => (
          <Scheda
            key={m.id}
            titolo={m.nome}
            descrizione={m.descrizione}
            sottotitolo={m.in_vendita ? prezzoAlMese(m.prezzo) : ''}
            vetrina={
              <div className={`vetrina-modulo vetrina-modulo-${m.stato}`}>
                <span className="vetrina-modulo-icona" aria-hidden="true">
                  {ICONE_MODULI[m.id]}
                </span>
                <span className="vetrina-modulo-stato">{statoInChiaro(m)}</span>
              </div>
            }
          >
            {tasti(m)}
          </Scheda>
        ))}
      </div>
    </section>
  )
}

export default function MarketplaceTab({ role = null }) {
  const [settings, setSettings] = useState(() => settingsIniziali())
  const [errore, setErrore] = useState(null)
  const [sezione, setSezione] = useState(() => sezioneIniziale(globalThis.location?.search))
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

      {sezione === 'moduli' && <SezioneModuli settings={settings} role={role} />}
    </div>
  )
}
