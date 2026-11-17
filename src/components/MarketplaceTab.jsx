import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { subscribeSettings, updateSettings, settingsIniziali, azioneModulo } from '../lib/api.js'
import { isAdmin } from '../lib/ruoli.js'
import { MODULI_PREMIUM, fraseRichiede } from '../lib/licenza.js'
import Icona from './Icona.jsx'
import { dataAvviso } from '../lib/aggiornamenti.js'
import { Sottosezioni } from '../lib/sottosezioni.js'
import { resolveThemeVars } from '../lib/themes.js'
import { formatPrice } from '../lib/orderStatus.js'
import { strutturaDi } from './stiliStrutturati.js'
import Caricamento from './Caricamento.jsx'
import ConfirmDialog from './ConfirmDialog.jsx'
import { tr, daTradurre, trSegnato, trDato, useLingua } from '../lib/lingua.js'
import {
  STILI_MENU,
  nomeStile,
  stiliInstallati,
  stileMenu,
  patchInstalla,
  patchDisinstalla,
  vesteDelloStile,
  ricettaDelloStile,
  stiliRicettaInstallati,
} from '../lib/stileMenu.js'
import { stiliRicordati, coloriConRicetta } from '../lib/stiliRicetta.js'
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
  stileDelTema,
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
  { id: 'tuoi', icona: 'preferito', label: daTradurre('I tuoi temi') },
  { id: 'temi', icona: 'temi', label: daTradurre('Temi') },
  { id: 'stili', icona: 'stili', label: daTradurre('Stili del menù') },
  { id: 'installati', icona: 'fatto', label: daTradurre('Installati') },
  { id: 'moduli', icona: 'moduli', label: daTradurre('Moduli') },
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
// struttura sua («Giornale», «Carte») mostra la sua vetrina, dal registro
// degli stili strutturati: la vetrina non può mostrare card che non ha.
// Uno stile a ricetta (REQ-MENU-031) si veste col motore, come il menù, e
// coi suoi colori sopra quelli del tema.
// La vetrina È il menù dei clienti, e quello resta in italiano anche col
// gestionale in inglese (REQ-CLI-010): lo dice `lang="it"`.
function Vetrina({ colori, stile, settings }) {
  const struttura = strutturaDi(stile)
  if (struttura) {
    return (
      <div className={`vetrina-tema stile-${stile}`} style={resolveThemeVars(colori)} aria-hidden="true" lang="it">
        <struttura.Vetrina voci={VOCI_ESEMPIO} />
      </div>
    )
  }
  const veste = vesteDelloStile(settings, stile)
  const tinte = resolveThemeVars(coloriConRicetta(colori, ricettaDelloStile(settings, stile)))
  return (
    <div
      className={`vetrina-tema ${veste.className || 'stile-classico'}`}
      style={{ ...tinte, ...veste.style }}
      aria-hidden="true"
      lang="it"
      {...veste.attributi}
    >
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
        {tr('Prova sul menù')}
      </a>
      {inUso ? (
        <span className="small">{tr('In uso')}</span>
      ) : installato ? (
        <button type="button" className="btn small" aria-label={tr('Usa {nome}', { nome: etichetta })} onClick={onUsa}>
          {tr('Usa')}
        </button>
      ) : (
        <button type="button" className="btn small" aria-label={tr('Installa {nome}', { nome: etichetta })} onClick={onInstalla}>
          {tr('Installa')}
        </button>
      )}
      {installato && disinstallabile && (
        <button
          type="button"
          className="link-inline small"
          aria-label={tr('Disinstalla {nome}', { nome: etichetta })}
          onClick={onDisinstalla}
        >
          {tr('Disinstalla')}
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
    carica: daTradurre('Aggiornamento del catalogo in corso…'),
    senza_rete: daTradurre('Il catalogo della regia non risponde: si vedono i temi già noti a questo dispositivo.'),
  },
  moduli: {
    carica: daTradurre('Aggiornamento del listino in corso…'),
    senza_rete: daTradurre('Il listino della regia non risponde: prezzi e prove sono quelli già noti a questo dispositivo.'),
  },
}

function AvvisoRegia({ stato, di }) {
  if (!stato) return null
  if (stato === 'carica') return <Caricamento piccolo testo={trSegnato(AVVISI_REGIA[di].carica)} />
  return <p className="muted small">{trSegnato(AVVISI_REGIA[di].senza_rete)}</p>
}

// ── I MODULI ──────────────────────────────────────────────────────────
// Lo stato di ogni modulo viene dalla licenza; prezzi e giorni di prova dal
// listino della regia. I tasti — prova, acquisto, disdetta — li vede solo il
// titolare (decisione dell'utente, 02/11/2026), e solo se la licenza è
// della regia (acquistiDallApp). Il pagamento si fa sulla pagina di Stripe:
// l'app ci manda il titolare e la regia lo riporta qui, sui moduli.
const ESITI_RITORNO = {
  pagato: { tipo: 'ok', testo: daTradurre('Pagamento ricevuto. Il modulo si attiva appena la regia aggiorna la licenza.') },
  annullato: { tipo: 'info', testo: daTradurre('Pagamento annullato: nessun addebito e nessuna modifica alla licenza.') },
}

// Il testo di una richiesta non andata. Quello della regia, se lo manda (è
// il caso che conosce lei: prova già usata, modulo compreso nel piano…).
function testoErrore(r) {
  if (r.errore) return r.errore
  if (r.status === 0) return tr('La regia non risponde. Verificare la connessione e riprovare.')
  if (r.status === 401 || r.status === 403) return tr('Moduli e abbonamenti li modifica solo il titolare, con il proprio accesso.')
  return tr('Operazione non riuscita. Riprovare tra qualche minuto.')
}

const STATI_MODULO = {
  // Funzioni, non testi: si traducono quando si mostrano.
  prova: (m) => tr('In prova fino al {data}', { data: dataAvviso(m.prova_fino) }),
  incluso: () => tr('modulo|Incluso'),
  non_incluso: () => tr('modulo|Non incluso'),
}

function SezioneModuli({ settings, role, listino, statoListino, esitoIniziale }) {
  const [avviso, setAvviso] = useState(() => {
    const esito = ESITI_RITORNO[esitoIniziale]
    return esito ? { ...esito, testo: trSegnato(esito.testo) } : null
  })
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
    const modulo = trSegnato(m.nome)
    const testi = r.in_attesa ? {
      aggiungi: tr("Richiesta di «{modulo}» inviata all'assistenza: il modulo si attiva alla conferma del pagamento.", { modulo }),
      disdici: tr("Richiesta di disdetta di «{modulo}» inviata all'assistenza.", { modulo }),
    } : {
      prova: tr('Prova di «{modulo}» attivata: il modulo compare fra pochi istanti.', { modulo }),
      aggiungi: tr('«{modulo}» aggiunto: il modulo compare fra pochi istanti.', { modulo }),
      disdici: r.dal
        ? tr('Disdetta registrata: «{modulo}» resta attivo fino al {data}.', { modulo, data: dataAvviso(r.dal) })
        : tr('Disdetta registrata: «{modulo}» resta attivo fino alla fine del periodo pagato.', { modulo }),
    }
    setAvviso({ tipo: 'ok', testo: testi[azione] })
  }

  const tasti = (m) => {
    if (!titolare || !acquisti) return null
    if (!m.in_vendita) {
      return m.stato === 'non_incluso' ? <span className="muted small">{tr('Non acquistabile singolarmente')}</span> : null
    }
    const occupato = inCorso !== null
    const modulo = trSegnato(m.nome)
    // Senza la sua base non si vende (REQ-LIC-015): l'inventario senza il
    // magazzino non avrebbe niente da contare.
    if (m.stato === 'non_incluso' && m.richiede.length > 0) {
      return <span className="muted small">{fraseRichiede(m.richiede)}</span>
    }
    if (m.stato === 'incluso') {
      return (
        <button
          type="button"
          className="link-inline small"
          aria-label={tr('Disdici {modulo}', { modulo })}
          disabled={occupato}
          onClick={() => setDaDisdire(m)}
        >
          {tr('Disdici')}
        </button>
      )
    }
    return (
      <>
        {m.stato === 'non_incluso' && m.prova_giorni > 0 ? (
          <button
            type="button"
            className="link-inline small"
            aria-label={
              m.prova_giorni === 1
                ? tr('Prova {modulo} gratis per 1 giorno', { modulo })
                : tr('Prova {modulo} gratis per {n} giorni', { modulo, n: m.prova_giorni })
            }
            disabled={occupato}
            onClick={() => esegui(m, 'prova')}
          >
            {m.prova_giorni === 1 ? tr('Prova gratis 1 giorno') : tr('Prova gratis {n} giorni', { n: m.prova_giorni })}
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          className="btn small"
          aria-label={tr('Aggiungi {modulo}', { modulo })}
          disabled={occupato}
          onClick={() => esegui(m, 'aggiungi')}
        >
          {inCorso === m.id ? tr('Attendere…') : tr('Aggiungi')}
        </button>
      </>
    )
  }

  return (
    <section>
      <h2>{tr('Moduli')}</h2>
      <p className="muted">
        {tr("Le funzioni oltre a menù, ordini e cassa. Si attivano sulla licenza dell'installazione, con abbonamento mensile; dove previsto, una prova gratuita prima dell'acquisto.")}
      </p>
      {!acquisti && (
        <p className="muted small">
          {tr('La licenza di questa installazione si gestisce presso chi la amministra: qui si consulta soltanto.')}
        </p>
      )}
      {acquisti && !titolare && <p className="muted small">{tr('Moduli e abbonamenti li gestisce il titolare.')}</p>}
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
            titolo={trSegnato(m.nome)}
            descrizione={trSegnato(m.descrizione)}
            sottotitolo={m.in_vendita ? prezzoAlMese(m.prezzo) : ''}
            vetrina={
              <div className={`vetrina-modulo vetrina-modulo-${m.stato}`}>
                <span className="vetrina-modulo-icona" aria-hidden="true">
                  <Icona nome={m.icona} />
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
          title={tr('Disdire «{modulo}»?', { modulo: trSegnato(daDisdire.nome) })}
          message={`${tr('Il modulo resta attivo fino alla fine del periodo già pagato, poi si spegne. I dati restano.')}${
            daDisdire.con_lui.length
              ? ` ${tr('Si spengono anche {moduli}, che lo richiedono.', {
                  moduli: daDisdire.con_lui
                    .map((d) => `«${trSegnato(MODULI_PREMIUM[d].label)}»`)
                    .join(` ${tr('congiunzione|e')} `),
                })}`
              : ''
          }`}
          confirmLabel={tr('Disdici')}
          danger
          onConfirm={() => esegui(daDisdire, 'disdici')}
          onCancel={() => setDaDisdire(null)}
        />
      )}
    </section>
  )
}

export default function MarketplaceTab({ role = null }) {
  useLingua()
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
  const stileDi = (t) => tr('Stile «{nome}»', { nome: trDato(nomeStile(t.stile, settings)) })
  const sottotitoloTema = (t) =>
    t.su_misura
      ? [
          tr('Su misura'),
          !t.ricetta && stileDi(t),
          ritirato(t) && tr('Non più in licenza: una volta disinstallato non si reinstalla'),
        ]
          .filter(Boolean)
          .join(' · ')
      : `${stileDi(t)} · ${tr('Gratis')}`

  const schedaTema = (t) => (
    <Scheda
      key={t.id}
      titolo={trDato(t.nome)}
      descrizione={trDato(t.descrizione)}
      sottotitolo={sottotitoloTema(t)}
      vetrina={<Vetrina colori={temaComeColori(t)} stile={stileDelTema(t)} settings={settings} />}
    >
      <AzioniCatalogo
        provaHref={urlProvaMenu('tema', t.id)}
        etichetta={trDato(t.nome)}
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
      titolo={trDato(s.nome)}
      descrizione={trDato(s.desc)}
      sottotitolo={`${tr('Sui colori del menù del locale')} · ${tr('Gratis')}`}
      vetrina={<Vetrina colori={coloriDelLocale} stile={s.id} settings={settings} />}
    >
      <AzioniCatalogo
        provaHref={urlProvaMenu('stile', s.id)}
        etichetta={tr('lo stile {nome}', { nome: trDato(s.nome) })}
        inUso={stileInUso === s.id}
        installato={s.aRicetta ? ricettaInstallati.some((r) => r.id === s.id) : stiliDelLocale.includes(s.id)}
        disinstallabile={disinstallabile}
        onUsa={() => salva({ stile_menu: s.id })}
        onInstalla={() => salva(patchInstalla(settings, s.id))}
        onDisinstalla={() => salva(patchDisinstalla(settings, s.id))}
      />
    </Scheda>
  )

  // Gli stili a ricetta del catalogo della regia (REQ-MENU-031), nella
  // forma delle voci di STILI_MENU: si provano, si installano e si usano
  // come quelli dell'app. Si rileggono a ogni giro, perché arrivano col
  // catalogo dei temi.
  const comeScheda = (r) => ({ id: r.id, nome: r.nome, desc: r.descrizione, aRicetta: true })
  const ricettaInstallati = stiliRicettaInstallati(settings)
  const stiliGratis = [...STILI_MENU.filter((s) => s.gratis), ...stiliRicordati().map(comeScheda)]
  const stiliInstallatiSchede = [
    ...STILI_MENU.filter((s) => stiliDelLocale.includes(s.id)),
    ...ricettaInstallati.map(comeScheda),
  ]

  return (
    <div className="pagina-marketplace">
      <Sottosezioni voci={voci.map((v) => ({ ...v, label: trSegnato(v.label) }))} attiva={aperta} scegli={scegli} />
      {errore && <div className="banner">{tr('Errore: {messaggio}', { messaggio: errore })}</div>}

      {aperta === 'tuoi' && (
        <section>
          <h2>{tr('I tuoi temi')}</h2>
          <p className="muted">
            {tr('Temi realizzati su misura per questo locale e inclusi nella licenza. Si provano, si installano e si usano come quelli del catalogo.')}
          </p>
          <div className="griglia-marketplace">{[...suMisura, ...ritirati].map(schedaTema)}</div>
        </section>
      )}

      {aperta === 'temi' && (
        <section>
          <h2>{tr('Temi')}</h2>
          <p className="muted">
            {tr('Un tema è una tavolozza di colori con uno stile del menù. Vale per il menù dei clienti: i colori del gestionale non cambiano.')}
          </p>
          <AvvisoRegia stato={statoCatalogo} di="temi" />
          <div className="griglia-marketplace">{catalogo(settings, daRegia).map(schedaTema)}</div>
        </section>
      )}

      {aperta === 'stili' && (
        <section>
          <h2>{tr('Stili del menù')}</h2>
          <p className="muted">
            {tr('La forma del menù dei clienti — impaginazione, caratteri, filetti — sui colori che il locale usa già.')}
          </p>
          <div className="griglia-marketplace">{stiliGratis.map(schedaStile)}</div>
        </section>
      )}

      {aperta === 'installati' && (
        <section>
          <h2>{tr('Installati')}</h2>
          {installati.length === 0 && stiliInstallatiSchede.length === 0 ? (
            <p className="muted">
              {tr('Nessun tema né stile installato. Si scelgono in «Temi» e in «Stili del menù».')}
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
