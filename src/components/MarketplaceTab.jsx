import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { subscribeSettings, updateSettings, settingsIniziali, azioneModulo } from '../lib/api.js'
import { isAdmin } from '../lib/ruoli.js'
import { dataAvviso } from '../lib/aggiornamenti.js'
import { Sottosezioni } from '../lib/sottosezioni.js'
import { resolveThemeVars } from '../lib/themes.js'
import { formatPrice } from '../lib/orderStatus.js'
import { TestataGiornale, VoceGiornale } from './MenuGiornale.jsx'
import Caricamento from './Caricamento.jsx'
import ConfirmDialog from './ConfirmDialog.jsx'
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
  urlProvaMenu,
  temiInstallati,
  temiSuMisura,
  suMisuraRitirati,
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
//
// «I TUOI TEMI» (REQ-MENU-030) sono quelli fatti dalla regia per questo
// locale, che arrivano con la licenza. La sezione c'è solo se ce n'è almeno
// uno, in licenza o installato: a un locale che non ne ha, una sezione vuota
// direbbe soltanto che esiste un servizio a pagamento.

const SEZIONI = [
  { id: 'tuoi', icona: '⭐', label: 'I tuoi temi' },
  { id: 'temi', icona: '🎨', label: 'Temi' },
  { id: 'stili', icona: '🖋️', label: 'Stili del menù' },
  { id: 'installati', icona: '✅', label: 'Installati' },
  { id: 'moduli', icona: '🧩', label: 'Moduli' },
]

// La sezione da aprire: quella dell'indirizzo, se esiste. Ci si arriva così
// tornando dalla pagina di pagamento (`?tab=marketplace&sezione=moduli`).
const sezioneDa = (chiesta, voci = SEZIONI) => (voci.some((s) => s.id === chiesta) ? chiesta : 'temi')

// Le due voci d'esempio delle vetrine, una volta sola per tutti gli stili.
const VOCI_ESEMPIO = [
  { id: 'negroni', name: 'Negroni', description: 'Gin, bitter e vermouth rosso', price: 9 },
  { id: 'spritz', name: 'Spritz', description: 'Aperitivo, prosecco e soda', price: 7 },
]

// Un pezzo del menù vero, con le classi del menù: ogni stile lo disegna con
// le sue regole, come disegna il menù dei clienti. Uno stile con una
// struttura sua (il «Giornale», REQ-MENU-024) mostra quella, coi suoi
// componenti: la vetrina non può mostrare un giornale che non c'è.
function Vetrina({ colori, stile }) {
  if (stile === 'giornale') {
    return (
      <div className="vetrina-tema stile-giornale" style={resolveThemeVars(colori)} aria-hidden="true">
        <TestataGiornale venue={{ venue_name: 'Il Locale' }} />
        <h3 className="g-sezione-titolo">
          <span>Cocktail</span>
          <span className="g-sezione-conto">{VOCI_ESEMPIO.length} voci</span>
        </h3>
        {VOCI_ESEMPIO.map((d) => (
          <VoceGiornale key={d.id} d={d} />
        ))}
      </div>
    )
  }
  return (
    <div className={`vetrina-tema stile-${stile}`} style={resolveThemeVars(colori)} aria-hidden="true">
      <h3 className="cat-header">Cocktail</h3>
      {VOCI_ESEMPIO.map((d) => (
        <div className="card menu-item" key={d.id}>
          <div className="row between">
            <div className="grow">
              <h3>
                <span className="menu-item-nome">{d.name}</span>
              </h3>
              <p className="muted menu-item-descrizione">{d.description}</p>
              <span className="price">{formatPrice(d.price)}</span>
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

// I tasti di un tema o di uno stile: la prova a sinistra, a destra «Usa» o
// «Installa» (o «In uso»), e nella sezione Installati «Disinstalla».
// `etichetta` è il nome per chi legge lo schermo («Gazzetta», «lo stile
// Lavagna»): sui tasti basta il verbo.
function AzioniCatalogo({ provaHref, etichetta, inUso, installato, disinstallabile, onUsa, onInstalla, onDisinstalla }) {
  return (
    <>
      <a className="link-inline small" href={provaHref}>
        Prova sul menù
      </a>
      {inUso ? (
        <span className="small">In uso</span>
      ) : installato ? (
        <button type="button" className="btn small" aria-label={`Usa ${etichetta}`} onClick={onUsa}>
          Usa
        </button>
      ) : (
        <button type="button" className="btn small" aria-label={`Installa ${etichetta}`} onClick={onInstalla}>
          Installa
        </button>
      )}
      {installato && disinstallabile && (
        <button type="button" className="link-inline small" aria-label={`Disinstalla ${etichetta}`} onClick={onDisinstalla}>
          Disinstalla
        </button>
      )}
    </>
  )
}

// UN CATALOGO DELLA REGIA, letto quando serve la prima volta (`quando` è il
// suo indirizzo, o null finché non serve) e mai a tempo; nel frattempo, e
// senza rete, l'ultimo ricordato su questo dispositivo. Vale per i temi e
// per il listino dei moduli. Si legge una volta per apertura della pagina:
// tornare su una sezione non lo rilegge.
function useDallaRegia(quando, ricordato, scarica) {
  const [dati, setDati] = useState(ricordato)
  const [stato, setStato] = useState(() => (quando ? 'carica' : null))
  useEffect(() => {
    if (!quando) return undefined
    let vivo = true
    setStato('carica')
    scarica(quando).then((voci) => {
      if (!vivo) return
      if (voci) setDati(voci)
      setStato(voci ? null : 'senza_rete')
    })
    return () => {
      vivo = false
    }
  }, [quando, scarica])
  return [dati, stato]
}

const AVVISI_REGIA = {
  temi: {
    carica: 'Aggiornamento del catalogo in corso…',
    senza_rete: 'Il catalogo della regia non risponde: si vedono i temi già noti a questo dispositivo.',
  },
  moduli: {
    carica: 'Aggiornamento del listino in corso…',
    senza_rete: 'Il listino della regia non risponde: prezzi e prove sono quelli già noti a questo dispositivo.',
  },
}

function AvvisoRegia({ stato, di }) {
  if (!stato) return null
  if (stato === 'carica') return <Caricamento piccolo testo={AVVISI_REGIA[di].carica} />
  return <p className="muted small">{AVVISI_REGIA[di].senza_rete}</p>
}

// ── I MODULI ──────────────────────────────────────────────────────────
// Lo stato di ogni modulo viene dalla licenza; prezzi e giorni di prova dal
// listino della regia. I tasti — prova, acquisto, disdetta — li vede solo il
// titolare (decisione dell'utente, 02/11/2026), e solo se la licenza è
// della regia (acquistiDallApp). Il pagamento si fa sulla pagina di Stripe:
// l'app ci manda il titolare e la regia lo riporta qui, sui moduli.
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

const STATI_MODULO = {
  prova: (m) => `In prova fino al ${dataAvviso(m.prova_fino)}`,
  incluso: () => 'Incluso',
  non_incluso: () => 'Non incluso',
}

function SezioneModuli({ settings, role, listino, statoListino, esitoIniziale }) {
  const [avviso, setAvviso] = useState(() => ESITI_RITORNO[esitoIniziale] || null)
  const [inCorso, setInCorso] = useState(null)
  const [daDisdire, setDaDisdire] = useState(null)

  const titolare = isAdmin(role)
  const acquisti = acquistiDallApp(settings)
  const moduli = schedeModuli(settings, listino)

  const esegui = async (m, azione) => {
    setDaDisdire(null)
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
    const testi = r.in_attesa ? {
      aggiungi: `Richiesta di «${m.nome}» inviata all'assistenza: il modulo si attiva alla conferma del pagamento.`,
      disdici: `Richiesta di disdetta di «${m.nome}» inviata all'assistenza.`,
    } : {
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
    if (m.stato === 'incluso') {
      return (
        <button
          type="button"
          className="link-inline small"
          aria-label={`Disdici ${m.nome}`}
          disabled={occupato}
          onClick={() => setDaDisdire(m)}
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
      {acquisti && !titolare && <p className="muted small">Moduli e abbonamenti li gestisce il titolare.</p>}
      <AvvisoRegia stato={statoListino} di="moduli" />
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
                  {m.icona}
                </span>
                <span className="pill vetrina-modulo-stato">{STATI_MODULO[m.stato](m)}</span>
              </div>
            }
          >
            {tasti(m)}
          </Scheda>
        ))}
      </div>

      {daDisdire && (
        <ConfirmDialog
          title={`Disdire «${daDisdire.nome}»?`}
          message="Il modulo resta attivo fino alla fine del periodo già pagato, poi si spegne. I dati restano."
          confirmLabel="Disdici"
          danger
          onConfirm={() => esegui(daDisdire, 'disdici')}
          onCancel={() => setDaDisdire(null)}
        />
      )}
    </section>
  )
}

export default function MarketplaceTab({ role = null }) {
  const [params, setParams] = useSearchParams()
  const [settings, setSettings] = useState(() => settingsIniziali())
  const [errore, setErrore] = useState(null)
  const [sezione, setSezione] = useState(() => sezioneDa(params.get('sezione')))
  // L'esito del ritorno da Stripe si legge all'apertura e si dice una volta:
  // tolto dall'indirizzo, un ricaricamento della pagina non lo ripete.
  const [esitoIniziale] = useState(() => esitoRitorno(`?${params}`))
  useEffect(() => {
    if (!params.has('esito')) return
    setParams(
      (p) => {
        const senza = new URLSearchParams(p)
        senza.delete('esito')
        return senza
      },
      { replace: true }
    )
  }, [params, setParams])

  // Il catalogo dei temi si legge all'apertura; il listino dei moduli la
  // prima volta che si aprono i moduli.
  const [moduliAperti, setModuliAperti] = useState(sezione === 'moduli')
  const scegli = (id) => {
    setSezione(id)
    if (id === 'moduli') setModuliAperti(true)
  }
  const [daRegia, statoCatalogo] = useDallaRegia(urlCatalogo(), catalogoRicordato, scaricaCatalogo)
  const [listino, statoListino] = useDallaRegia(moduliAperti ? urlListino() : null, listinoRicordato, scaricaListino)

  useEffect(() => subscribeSettings(setSettings, (e) => setErrore(e.message)), [])

  // Come le Impostazioni: si vede subito, la scrittura parte in sottofondo.
  const salva = (patch) => {
    if (!patch) return
    setErrore(null)
    setSettings((s) => ({ ...s, ...patch }))
    updateSettings(patch).catch((e) => setErrore(e.message))
  }

  const installati = temiInstallati(settings)
  const suMisura = temiSuMisura(settings)
  const ritirati = suMisuraRitirati(settings)
  const conTuoi = suMisura.length + ritirati.length > 0
  const voci = conTuoi ? SEZIONI : SEZIONI.filter((s) => s.id !== 'tuoi')
  // Arrivati su «I tuoi temi» da un indirizzo, prima che le impostazioni
  // dicano se ce ne sono: senza, si resta sui temi.
  const aperta = sezioneDa(sezione, voci)
  const stiliDelLocale = stiliInstallati(settings)
  const inUso = temaInUso(settings)
  const stileInUso = stileMenu(settings)
  const coloriDelLocale = settings.theme_client || null
  const disinstallabile = aperta === 'installati'

  // Un tema su misura ritirato dalla licenza non si reinstalla: disinstallarlo
  // è definitivo, e la scheda lo dice prima.
  const ritirato = (t) => ritirati.some((r) => r.id === t.id)
  const sottotitoloTema = (t) =>
    t.su_misura
      ? `Su misura · Stile «${nomeStile(t.stile)}»${ritirato(t) ? ' · Non più in licenza: una volta disinstallato non si reinstalla' : ''}`
      : `Stile «${nomeStile(t.stile)}» · Gratis`

  const schedaTema = (t) => (
    <Scheda
      key={t.id}
      titolo={t.nome}
      descrizione={t.descrizione}
      sottotitolo={sottotitoloTema(t)}
      vetrina={<Vetrina colori={temaComeColori(t)} stile={t.stile} />}
    >
      <AzioniCatalogo
        provaHref={urlProvaMenu('tema', t.id)}
        etichetta={t.nome}
        inUso={inUso === t.id}
        installato={installati.some((i) => i.id === t.id)}
        disinstallabile={disinstallabile}
        onUsa={() => salva(patchUsaTema(settings, t))}
        onInstalla={() => salva(patchInstallaTema(settings, t))}
        onDisinstalla={() => salva(patchDisinstallaTema(settings, t.id))}
      />
    </Scheda>
  )

  const schedaStile = (s) => (
    <Scheda
      key={s.id}
      titolo={s.nome}
      descrizione={s.desc}
      sottotitolo="Sui colori del menù del locale · Gratis"
      vetrina={<Vetrina colori={coloriDelLocale} stile={s.id} />}
    >
      <AzioniCatalogo
        provaHref={urlProvaMenu('stile', s.id)}
        etichetta={`lo stile ${s.nome}`}
        inUso={stileInUso === s.id}
        installato={stiliDelLocale.includes(s.id)}
        disinstallabile={disinstallabile}
        onUsa={() => salva({ stile_menu: s.id })}
        onInstalla={() => salva(patchInstalla(settings, s.id))}
        onDisinstalla={() => salva(patchDisinstalla(settings, s.id))}
      />
    </Scheda>
  )

  const stiliGratis = STILI_MENU.filter((s) => s.gratis)
  const stiliInstallatiSchede = STILI_MENU.filter((s) => stiliDelLocale.includes(s.id))

  return (
    <div className="pagina-marketplace">
      <Sottosezioni voci={voci} attiva={aperta} scegli={scegli} />
      {errore && <div className="banner">Errore: {errore}</div>}

      {aperta === 'tuoi' && (
        <section>
          <h2>I tuoi temi</h2>
          <p className="muted">
            Temi realizzati su misura per questo locale e inclusi nella licenza. Si provano, si installano e si usano come
            quelli del catalogo.
          </p>
          <div className="griglia-marketplace">{[...suMisura, ...ritirati].map(schedaTema)}</div>
        </section>
      )}

      {aperta === 'temi' && (
        <section>
          <h2>Temi</h2>
          <p className="muted">
            Un tema è una tavolozza di colori con uno stile del menù. Vale per il menù dei clienti: i colori del
            gestionale non cambiano.
          </p>
          <AvvisoRegia stato={statoCatalogo} di="temi" />
          <div className="griglia-marketplace">{catalogo(settings, daRegia).map(schedaTema)}</div>
        </section>
      )}

      {aperta === 'stili' && (
        <section>
          <h2>Stili del menù</h2>
          <p className="muted">
            La forma del menù dei clienti — impaginazione, caratteri, filetti — sui colori che il locale usa già.
          </p>
          <div className="griglia-marketplace">{stiliGratis.map(schedaStile)}</div>
        </section>
      )}

      {aperta === 'installati' && (
        <section>
          <h2>Installati</h2>
          {installati.length === 0 && stiliInstallatiSchede.length === 0 ? (
            <p className="muted">
              Nessun tema né stile installato. Si scelgono in «Temi» e in «Stili del menù».
            </p>
          ) : (
            <div className="griglia-marketplace">
              {installati.map(schedaTema)}
              {stiliInstallatiSchede.map(schedaStile)}
            </div>
          )}
        </section>
      )}

      {aperta === 'moduli' && (
        <SezioneModuli
          settings={settings}
          role={role}
          listino={listino}
          statoListino={statoListino}
          esitoIniziale={esitoIniziale}
        />
      )}
    </div>
  )
}
