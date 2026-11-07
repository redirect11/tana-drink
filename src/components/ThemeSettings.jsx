import { useState } from 'react'
import { Link } from 'react-router-dom'
import { stiliDisponibili, stileMenu, patchDisinstalla, vesteDelloStile, stiliRicettaInstallati } from '../lib/stileMenu.js'
import { urlProvaMenu } from '../lib/marketplaceTemi.js'
import { formatPrice } from '../lib/orderStatus.js'
import Icona, { TemaIcone } from './Icona.jsx'
import { temaIconeDi, GRUPPI_ICONE } from '../lib/icone.js'
import {
  THEME_FIELDS,
  THEME_PRESETS,
  DEFAULT_THEME,
  resolveThemeVars,
  applyTheme,
} from '../lib/themes.js'

// Sezione "Aspetto" delle impostazioni: scelta del tema (preset scuri e
// chiari) e personalizzazione dei colori principali, separatamente per il
// gestionale (staff/bartender) e per la vista cliente. Il tema scelto è
// salvato in settings/bar e arriva a tutti i dispositivi in tempo reale.
//
// I due temi si scelgono da qui, ma non si applicano per indirizzo: seguono
// CHI GUARDA. Chi è dello staff vede il gestionale su ogni schermata — il
// proprio profilo, la lista ordini, il menù per gli ordini manuali; chi
// ordina vede il suo. Per questo le etichette dicono a chi tocca cosa: da
// sole, "Gestionale" e "Vista cliente" sembravano due pagine.
// I DUE TEMI STANNO DOVE STA LA COSA CHE COLORANO: quello del gestionale
// in «Aspetto», quello del menù dei clienti in «Menù clienti», insieme a
// tutto il resto di quella schermata. Messi uno sotto l'altro sembravano
// due varianti della stessa cosa, e non si capiva quale delle due si stesse
// toccando.
export default function ThemeSettings({ settings, onSave }) {
  return (
    <div className="card settings-section">
      <h3><Icona nome="temi" /> Aspetto</h3>
      <ThemeEditor
        title="Gestionale — quello che vedi ora"
        hint="I colori di chi lavora: coda, cassa, impostazioni, profilo."
        value={settings.theme_staff}
        // Anteprima immediata: il gestionale è la vista in cui ci troviamo.
        livePreview
        onSave={(t) => onSave({ theme_staff: t })}
      />
      <CardDellaCoda settings={settings} onSave={onSave} />
      <IconeDelGestionale settings={settings} onSave={onSave} />
    </div>
  )
}

// ── LE ICONE DEL GESTIONALE (REQ-UI-031) ──────────────────────────────
//
// Flavio, 07/11/2026: le emoji colorate «danno un senso un po' troppo a
// pazziella»; nei programmi professionali le icone sono silhouette
// monocrome. «Silhouette» è il tema di partenza (decisione dell'utente);
// «Emoji» rimette quelle di prima. UN TEMA PER GRUPPO (decisione
// dell'utente, 07/11/2026): navigazione, tasti e stati, segnali e messaggi
// si scelgono a parte. Ogni scelta mostra cinque icone del suo gruppo nel
// suo tema, così si vede cosa si sceglie prima di sceglierlo.
const ICONE_DI_PROVA = {
  navigazione: ['coda', 'cassa', 'magazzino', 'staff', 'impostazioni'],
  tasti: ['modifica', 'elimina', 'aggiungi', 'stampa', 'contanti'],
  segnali: ['avviso', 'fatto', 'attesa', 'licenza', 'cerca'],
}
const DESCRIZIONE_GRUPPO = {
  navigazione: 'Menu laterale, sezioni e sottosezioni, barra in alto, moduli.',
  tasti: 'Tasti, titoli delle sezioni, metodi di pagamento, stati dei conti.',
  segnali: 'Avvisi e conferme nei testi, messaggi, campi di ricerca.',
}

function IconeDelGestionale({ settings, onSave }) {
  return (
    <div style={{ marginTop: 18 }}>
      <h4 style={{ margin: '0 0 4px' }}>Le icone del gestionale</h4>
      <p className="muted" style={{ margin: '0 0 10px', fontSize: '0.85rem' }}>
        Il disegno delle icone del gestionale, gruppo per gruppo. Le pagine dei clienti seguono lo stile del
        loro menù. I segnali di stato restano colorati in entrambi i casi.
      </p>
      {Object.entries(GRUPPI_ICONE).map(([gruppo, g]) => (
        <SceltaIcone
          key={gruppo}
          gruppo={gruppo}
          label={g.label}
          tema={temaIconeDi(settings, gruppo)}
          scegli={(id) => onSave({ [g.chiave]: id })}
        />
      ))}
    </div>
  )
}

function SceltaIcone({ gruppo, label, tema, scegli }) {
  const opzione = (id, nome) => (
    <button
      type="button"
      className={`mode-option${tema === id ? ' active' : ''}`}
      aria-pressed={tema === id}
      aria-label={`${label}: ${nome}`}
      onClick={() => scegli(id)}
    >
      <TemaIcone.Provider value={{ [gruppo]: id }}>
        <span className="icone-prova" aria-hidden="true">
          {ICONE_DI_PROVA[gruppo].map((n) => (
            <Icona key={n} nome={n} gruppo={gruppo} />
          ))}
        </span>
      </TemaIcone.Provider>{' '}
      {nome}
    </button>
  )
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{label}</div>
      <div className="muted" style={{ fontSize: '0.8rem', margin: '0 0 6px' }}>
        {DESCRIZIONE_GRUPPO[gruppo]}
      </div>
      <div className="mode-choice">
        {opzione('silhouette', 'Silhouette')}
        {opzione('emoji', 'Emoji')}
      </div>
    </div>
  )
}

// ── LE CARD DELLA CODA ────────────────────────────────────────────────
//
// STA QUI, dentro «Aspetto», e non in «Coda ordini»: la regola l'ha data
// l'utente il 20/08/2026 — «tutto ciò che riguarda l'aspetto degli
// elementi, di qualsiasi sezione del sito, dovrebbe essere messo sotto
// Aspetto». Chi cerca "come si vedono le card" adesso ha un posto solo
// dove guardare, invece di doverlo indovinare dalla sezione.
//
// LA DOMANDA È «COSA DICE LA STRISCIA», non «acceso o spento»: sono due
// risposte con lo stesso peso, e un interruttore avrebbe costretto a
// scrivere nell'etichetta quale delle due è il "no". Due tasti affiancati
// dicono le due cose per intero, come per la ricerca nella coda.
function CardDellaCoda({ settings, onSave }) {
  const colore = settings.bordo_colore_conto === true
  return (
    <div style={{ marginTop: 18 }}>
      <h4 style={{ margin: '0 0 4px' }}>Le card della coda</h4>
      <p className="muted" style={{ margin: '0 0 10px', fontSize: '0.85rem' }}>
        La <strong>striscia colorata</strong> a sinistra di ogni card, nella coda e
        sulla lavagna del banco. Può dire <strong>com&apos;è messo il conto</strong> —
        da incassare, acconto, pagato, annullato — oppure portare il{' '}
        <strong>colore del conto</strong>, quello scelto dal «⋯ Azioni» della card o
        assegnato da solo ai conti nuovi. Il colore sul fondo della card resta in
        ogni caso. Un conto senza colore, e un conto annullato, tengono sempre la
        striscia dello stato.
      </p>
      <div className="mode-choice">
        <button
          className={`mode-option${colore ? '' : ' active'}`}
          onClick={() => onSave({ bordo_colore_conto: false })}
        >
          💳 Com&apos;è messo il conto
        </button>
        <button
          className={`mode-option${colore ? ' active' : ''}`}
          onClick={() => onSave({ bordo_colore_conto: true })}
        >
          🎨 Il colore del conto
        </button>
      </div>
    </div>
  )
}

// Il tema del menù dei clienti, da mostrare nella sua sezione: prima la
// forma (lo stile, REQ-MENU-021), poi i colori, che valgono per tutti e due
// gli stili.
export function TemaMenuClienti({ settings, onSave }) {
  return (
    <>
      <StileMenuClienti settings={settings} onSave={onSave} />
      <ThemeEditor
      title="Colori del menù"
      hint="Come lo vedono i clienti sul telefono. Per provarlo: menu ▸ Vista cliente."
      value={settings.theme_client}
      onSave={(t) => onSave({ theme_client: t })}
      />
    </>
  )
}

// LO STILE DEL MENÙ (REQ-MENU-021, REQ-MENU-022): qui si sceglie fra gli
// stili che il locale ha; il catalogo, per installarne altri, sta nel
// Marketplace (REQ-MENU-023). Ogni stile si può PROVARE sul proprio menù
// prima di sceglierlo: l'anteprima del cliente, con lo stile in prova, la
// vede solo chi la apre.
// Ogni scheda ha un assaggio dello stile (nome e prezzo di un drink) scritto
// con le sue regole: si vede la differenza senza leggere la descrizione.

function AssaggioStile({ id, settings }) {
  const veste = vesteDelloStile(settings, id)
  return (
    <span className={`assaggio-stile ${veste.className || 'stile-classico'}`} style={veste.style} aria-hidden="true" {...veste.attributi}>
      <span className="assaggio-nome">Negroni</span>
      <span className="assaggio-prezzo">{formatPrice(9)}</span>
    </span>
  )
}

export function StileMenuClienti({ settings, onSave }) {
  const attuale = stileMenu(settings)
  const stili = stiliDisponibili(settings)
  return (
    <div style={{ margin: '14px 0 18px' }} role="group" aria-labelledby="stile-menu-titolo">
      <h4 id="stile-menu-titolo" style={{ margin: '0 0 4px' }}>Stile del menù</h4>
      <p className="muted" style={{ margin: '0 0 10px', fontSize: '0.85rem' }}>
        Impaginazione, caratteri e movimento del menù e degli Special per i clienti. I colori sono quelli
        scelti sotto. Il personale vede sempre lo stile classico.
      </p>
      <div className="mode-choice stili-menu">
        {stili.map((s) => (
          <div key={s.id} className={`stile-scheda${attuale === s.id ? ' active' : ''}`}>
            <button
              type="button"
              className={`mode-option${attuale === s.id ? ' active' : ''}`}
              aria-pressed={attuale === s.id}
              onClick={() => onSave({ stile_menu: s.id })}
            >
              <AssaggioStile id={s.id} settings={settings} />
              <strong>{s.nome}</strong>
              <span className="muted small" style={{ display: 'block', fontWeight: 400 }}>
                {s.desc}
              </span>
            </button>
            <div className="stile-azioni">
              <a className="link-inline small" href={urlProvaMenu('stile', s.id)}>
                Prova sul menù
              </a>
              {(s.gratis || stiliRicettaInstallati(settings).some((r) => r.id === s.id)) && (
                <button type="button" className="link-inline small" onClick={() => onSave(patchDisinstalla(settings, s.id))}>
                  Disinstalla
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Il catalogo degli stili (e dei temi) sta nella pagina del
          marketplace (REQ-MENU-023): qui si sceglie fra quelli installati. */}
      <p className="muted small" style={{ margin: '10px 0 0' }}>
        Altri stili e temi, gratis, nel{' '}
        <Link className="link-inline" to="/bar?tab=marketplace">
          marketplace
        </Link>
        .
      </p>
    </div>
  )
}

function ThemeEditor({ title, hint, value, onSave, livePreview = false }) {
  const current = value || { preset: DEFAULT_THEME, custom: null }
  const [customizing, setCustomizing] = useState(false)
  // Bozza degli override colore mentre si personalizza (non ancora salvata).
  const [draft, setDraft] = useState(null)

  const resolved = resolveThemeVars(
    draft ? { ...current, custom: draft } : current
  )
  const hasCustom = !!(current.custom && Object.keys(current.custom).length)

  function pickPreset(id) {
    setDraft(null)
    setCustomizing(false)
    const next = { preset: id, custom: null }
    onSave(next)
    if (livePreview) applyTheme(resolveThemeVars(next))
  }

  function startCustomize() {
    setDraft({ ...(current.custom || {}) })
    setCustomizing(true)
  }

  function setColor(key, color) {
    const next = { ...(draft || {}), [key]: color }
    setDraft(next)
    if (livePreview) applyTheme(resolveThemeVars({ ...current, custom: next }))
  }

  function saveCustom() {
    onSave({ preset: current.preset || DEFAULT_THEME, custom: draft })
    setCustomizing(false)
    setDraft(null)
  }

  function resetCustom() {
    setDraft(null)
    setCustomizing(false)
    const next = { preset: current.preset || DEFAULT_THEME, custom: null }
    onSave(next)
    if (livePreview) applyTheme(resolveThemeVars(next))
  }

  return (
    <div style={{ marginTop: 10 }}>
      <p className="muted" style={{ margin: '0 0 6px', fontSize: '0.9rem' }}>
        <strong>{title}</strong>
        {hasCustom && ' · personalizzato'}
      </p>
      {hint && (
        <p className="muted" style={{ margin: '0 0 6px', fontSize: '0.82rem' }}>
          {hint}
        </p>
      )}

      {/* A TENDINA, non a chip: con otto preset (e cresceranno) la fila
          di bottoni si mangiava la pagina due volte, gestionale e cliente. */}
      <select
        value={current.preset || DEFAULT_THEME}
        onChange={(e) => pickPreset(e.target.value)}
        style={{ width: '100%', margin: '2px 0 8px', padding: '10px 12px', fontSize: '1rem' }}
      >
        {Object.entries(THEME_PRESETS).map(([id, p]) => (
          <option key={id} value={id}>
            {p.label}
          </option>
        ))}
      </select>

      {!customizing ? (
        <button className="btn ghost small" onClick={startCustomize}>
          🎛 Personalizza colori
        </button>
      ) : (
        <div style={{ marginTop: 8 }}>
          {THEME_FIELDS.map((f) => (
            <div
              className="row between"
              key={f.key}
              style={{ alignItems: 'center', marginTop: 6 }}
            >
              <span style={{ fontSize: '0.9rem' }}>{f.label}</span>
              <input
                type="color"
                value={resolved[f.key]}
                onChange={(e) => setColor(f.key, e.target.value)}
                style={{ width: 52, height: 32, padding: 2, cursor: 'pointer' }}
              />
            </div>
          ))}
          <div className="grid-2" style={{ marginTop: 10 }}>
            <button className="btn ghost small" onClick={resetCustom}>
              ↩︎ Ripristina preset
            </button>
            <button className="btn small" onClick={saveCustom}>
              💾 Salva tema
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
