import { useRef, useState } from 'react'
import {
  CAMPI,
  CHIAVE_IMPOSTAZIONE,
  CHIAVE_LOGO,
  LARGHEZZA_LOGO,
  TIPI_LOGO,
  configStampa,
  immagineCaricata,
  logoAcceso,
  problemiLogo,
  quotaScura,
} from '../lib/campiStampa.js'
import { printAnteprima } from '../lib/printer.js'
import { isAdmin } from '../lib/ruoli.js'
import Icona from './Icona.jsx'
import { tr, daTradurre, trSegnato } from '../lib/lingua.js'

// ── COSA C'È SULLO SCONTRINO, E COSA C'È SULLA COMANDA ───────────────
//
// Il vocabolario dei campi sta in lib/campiStampa.js; qui c'è solo il
// pannello che lo mostra. Interruttore per campo, e dove il campo è puro
// testo la casella per cambiarlo. Niente campi liberi: si sceglie fra
// quelli che una stampa ha, non se ne inventano di nuovi.

const TITOLI = {
  scontrino: daTradurre('Cosa c’è sullo scontrino'),
  comanda: daTradurre('Cosa c’è sulla comanda'),
  acconto: daTradurre('Cosa c’è sullo scontrino d’acconto'),
}

const SPIEGAZIONI = {
  scontrino: daTradurre('Prodotti e totale si stampano sempre; gli altri campi si scelgono qui.'),
  comanda: daTradurre('I prodotti si stampano sempre; gli altri campi si scelgono qui.'),
  acconto: daTradurre(
    'La scritta ACCONTO, le righe pagate quando ci sono, l’importo versato e l’indicazione del conto ancora aperto si stampano sempre; gli altri campi si scelgono qui.'
  ),
}

export default function CampiStampa({ quale, settings, onSave }) {
  const [stampando, setStampando] = useState(false)
  const [esito, setEsito] = useState(null)
  const cfg = configStampa(settings, quale)
  const campi = CAMPI[quale] || []
  const chiave = CHIAVE_IMPOSTAZIONE[quale]

  // Si scrive SEMPRE l'oggetto intero: il salvataggio è ottimistico e
  // rimpiazza la voce in pagina: mandandone metà, l'altra metà sparirebbe
  // sotto gli occhi di chi sta scegliendo.
  const salva = (parte, id, valore) => {
    const attuale = settings?.[chiave] || {}
    onSave({
      [chiave]: {
        ...attuale,
        [parte]: { ...(attuale[parte] || {}), [id]: valore },
      },
    })
  }

  async function prova() {
    setStampando(true)
    setEsito(null)
    try {
      await printAnteprima(quale)
      setEsito({ ok: true, testo: tr('Prova inviata alla stampante.') })
    } catch (e) {
      setEsito({ ok: false, testo: e.message })
    } finally {
      setStampando(false)
    }
  }

  return (
    <div className="card settings-section">
      <h3>{trSegnato(TITOLI[quale])}</h3>
      <p className="muted" style={{ margin: '0 0 12px', fontSize: '0.9rem' }}>
        {trSegnato(SPIEGAZIONI[quale])}
      </p>

      {campi.map((campo) => {
        const acceso = cfg.mostra(campo.id)
        return (
          <div key={campo.id} style={{ marginBottom: 4 }}>
            <div className="toggle-row">
              <div>
                <div>{trSegnato(campo.label)}</div>
                {campo.desc && <div className="desc">{trSegnato(campo.desc)}</div>}
              </div>
              <input
                type="checkbox"
                className="toggle"
                aria-label={trSegnato(campo.label)}
                checked={acceso}
                onChange={(e) => salva('campi', campo.id, e.target.checked)}
              />
            </div>
            {/* La casella del testo compare solo col campo acceso: a
                interruttore spento non c'è niente da scrivere, e una
                casella che non serve fa perdere tempo a chi scorre. */}
            {campo.testo && acceso && (
              <div style={{ padding: '0 0 10px 12px' }}>
                <label htmlFor={`testo-${quale}-${campo.id}`}>{trSegnato(campo.testo.label)}</label>
                <input
                  id={`testo-${quale}-${campo.id}`}
                  type="text"
                  maxLength={40}
                  placeholder={campo.testo.placeholder || campo.testo.valore}
                  // Suggerimento e testo di partenza sono quelli STAMPATI:
                  // italiani apposta, come la carta (REQ-UI-039).
                  lang="it"
                  value={cfg.testo(campo.id)}
                  onChange={(e) => salva('testi', campo.id, e.target.value)}
                />
              </div>
            )}
          </div>
        )
      })}

      <button
        type="button"
        className="btn secondary"
        style={{ marginTop: 12 }}
        onClick={prova}
        disabled={stampando}
      >
        {stampando ? (
          tr('Stampo…')
        ) : (
          <>
            <Icona nome="stampa" gruppo="tasti" /> {tr('Prova di stampa')}
          </>
        )}
      </button>
      <p className="muted" style={{ fontSize: '0.8rem', margin: '6px 0 0' }}>
        {quale === 'comanda'
          ? tr('Stampa un ticket di prova con i campi scelti.')
          : tr('Stampa un conto di prova con i campi scelti.')}
      </p>
      {esito && (
        <div className={esito.ok ? 'muted' : 'banner'} style={{ marginTop: 8, fontSize: '0.9rem' }}>
          {esito.ok ? `✓ ${esito.testo}` : esito.testo}
        </div>
      )}
    </div>
  )
}

// ── IL LOGO: SU QUALI STAMPE, E QUALE (REQ-STAMPA-011) ───────────────
//
// «Su quali stampe» lo può cambiare chi gestisce; l'IMMAGINE la cambia
// solo l'admin — è l'identità del locale, non una preferenza del
// terminale, e chi la sbaglia la sbaglia per tutti.
export function LogoStampe({ settings, onSave, role = null }) {
  const [problema, setProblema] = useState(null)
  const [lavorando, setLavorando] = useState(false)
  const fileRef = useRef(null)
  const immagine = immagineCaricata(settings)
  const puoCambiarla = isAdmin(role)

  const salva = (patch) => {
    onSave({ [CHIAVE_LOGO]: { ...(settings?.[CHIAVE_LOGO] || {}), ...patch } })
  }

  // ── SI DICE SUBITO, NON SULLA CARTA ────────────────────────────────
  //
  // L'immagine si riduce QUI, alla larghezza che vuole la testina, e si
  // guarda com'è venuta: una foto scura diventa un rettangolo nero in
  // cima a ogni scontrino della serata, e al banco nessuno capirebbe
  // perché. Se non va, non si salva e si dice cosa c'è che non va.
  async function scegliImmagine(e) {
    const file = e.target.files?.[0]
    if (fileRef.current) fileRef.current.value = ''
    if (!file) return
    setProblema(null)
    setLavorando(true)
    try {
      const sorgente = await leggiFile(file)
      const img = await caricaImmagine(sorgente)
      const altezza = Math.round((img.height / img.width) * LARGHEZZA_LOGO)
      const canvas = document.createElement('canvas')
      canvas.width = LARGHEZZA_LOGO
      canvas.height = altezza
      const ctx = canvas.getContext('2d')
      // Fondo bianco: la carta è bianca, e un PNG trasparente
      // diventerebbe una macchia nera.
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, LARGHEZZA_LOGO, altezza)
      ctx.drawImage(img, 0, 0, LARGHEZZA_LOGO, altezza)
      const ridotta = canvas.toDataURL('image/png')
      const dati = ctx.getImageData(0, 0, LARGHEZZA_LOGO, altezza)?.data
      const guaio = problemiLogo({
        larghezza: img.width,
        altezza: img.height,
        quotaScura: quotaScura(dati),
        peso: ridotta.length,
      })
      if (guaio) {
        setProblema(guaio)
        if (guaio.grave) return
      }
      salva({ immagine: ridotta })
    } catch {
      setProblema({
        grave: true,
        testo: tr('Questa immagine non si riesce ad aprire. Servono un PNG o un JPG.'),
      })
    } finally {
      setLavorando(false)
    }
  }

  return (
    <div className="card settings-section">
      <h3>{tr('Logo sulle stampe')}</h3>
      <p className="muted" style={{ margin: '0 0 12px', fontSize: '0.9rem' }}>
        {tr('Il logo si stampa in bianco e nero, largo poco meno di metà carta, sulle stampe scelte qui.')}
      </p>

      {TIPI_LOGO.map((tipo) => (
        <div className="toggle-row" key={tipo.id}>
          <div>
            <div>{trSegnato(tipo.label)}</div>
            {tipo.desc && <div className="desc">{trSegnato(tipo.desc)}</div>}
          </div>
          <input
            type="checkbox"
            className="toggle"
            aria-label={trSegnato(tipo.label)}
            checked={logoAcceso(settings, tipo.id)}
            onChange={(e) => salva({ [tipo.id]: e.target.checked })}
          />
        </div>
      ))}

      <div style={{ marginTop: 16 }}>
        <div style={{ marginBottom: 6 }}>{tr('L’immagine')}</div>
        <div className="row" style={{ gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Il fondo bianco è quello della carta: su un tema scuro un
              logo nero su trasparente sembrerebbe sparito. */}
          <img
            src={immagine || `${import.meta.env.BASE_URL || '/'}logo.png`}
            alt={tr('Il logo come esce dalla stampante')}
            style={{
              width: 110,
              background: '#fff',
              padding: 6,
              borderRadius: 6,
              objectFit: 'contain',
            }}
          />
          <div style={{ flex: '1 1 200px' }}>
            <p className="muted" style={{ fontSize: '0.85rem', margin: '0 0 8px' }}>
              {immagine
                ? tr('Questa è l’immagine caricata dal locale.')
                : tr('Questo è il logo di serie: caricane uno per cambiarlo.')}
            </p>
            {puoCambiarla ? (
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                <input
                  ref={fileRef}
                  id="logo-file"
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={scegliImmagine}
                />
                <button
                  type="button"
                  className="btn secondary small"
                  disabled={lavorando}
                  onClick={() => fileRef.current?.click()}
                >
                  {lavorando ? (
                    tr('Guardo l’immagine…')
                  ) : (
                    <>
                      <Icona nome="immagine" gruppo="tasti" /> {tr('Carica un’immagine')}
                    </>
                  )}
                </button>
                {immagine && (
                  <button
                    type="button"
                    className="btn ghost small"
                    onClick={() => {
                      setProblema(null)
                      salva({ immagine: null })
                    }}
                  >
                    {tr('Torna a quello di serie')}
                  </button>
                )}
              </div>
            ) : (
              <p className="muted" style={{ fontSize: '0.85rem', margin: 0 }}>
                {tr('L’immagine la cambia chi ha l’accesso da amministratore.')}
              </p>
            )}
          </div>
        </div>

        {problema && (
          <div
            className={problema.grave ? 'banner' : 'muted'}
            style={{ marginTop: 10, fontSize: '0.9rem' }}
          >
            {problema.grave && <><Icona nome="avviso" gruppo="segnali" />{' '}</>}
            {trSegnato(problema.testo)}
            {problema.grave && <> {tr('Il logo è rimasto quello di prima.')}</>}
          </div>
        )}
      </div>
    </div>
  )
}

// Il file scelto, come indirizzo che un <img> sa aprire.
function leggiFile(file) {
  return new Promise((ok, ko) => {
    const lettore = new FileReader()
    lettore.onload = () => ok(String(lettore.result))
    lettore.onerror = ko
    lettore.readAsDataURL(file)
  })
}

function caricaImmagine(src) {
  return new Promise((ok, ko) => {
    const img = new Image()
    img.onload = () => ok(img)
    img.onerror = ko
    img.src = src
  })
}
