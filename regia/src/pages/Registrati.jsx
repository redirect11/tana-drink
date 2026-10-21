import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { registra } from '../lib/db.js'
import { slugDi, problemaSlug } from '../lib/clienti.js'
import { urlDi } from '../lib/istanze.js'
import { TIPI_LOCALE, problemiAccount, problemiLocale, problemiFatturazione, problemiReferente } from '../lib/validazione.js'

// LA REGISTRAZIONE DEL TITOLARE (REQ-FLOTTA-003), in quattro passi: account,
// locale, fatturazione, referente e consensi. Ogni passo si controlla prima
// di andare avanti, e gli errori stanno accanto alla casella. Lo slug si
// vede mentre si scrive il nome, perché è l'indirizzo che l'app avrà e non
// si cambia dopo. Alla fine parte l'email di verifica.

const PASSI = ['Account', 'Il locale', 'Fatturazione', 'Referente']

export default function Registrati() {
  const navigate = useNavigate()
  const [passo, setPasso] = useState(0)
  const [account, setAccount] = useState({ email: '', password: '', conferma: '' })
  const [locale, setLocale] = useState({ nome: '', tipo: '', via: '', cap: '', citta: '', provincia: '', telefono: '', sito: '' })
  const [fatturazione, setFatturazione] = useState({ ragione_sociale: '', partita_iva: '', codice_fiscale: '', pec: '', sdi: '', stessa_sede: true, via: '', cap: '', citta: '', provincia: '' })
  const [referente, setReferente] = useState({ nome: '', cognome: '', ruolo: '', telefono: '', termini: false, privacy: false, marketing: false })
  const [errori, setErrori] = useState({})
  const [errore, setErrore] = useState(null)
  const [inCorso, setInCorso] = useState(false)

  const slug = slugDi(locale.nome)
  const problemaNome = locale.nome ? problemaSlug(slug) : null

  const controlli = [
    () => problemiAccount(account),
    () => ({ ...problemiLocale(locale), ...(problemaNome ? { nome: problemaNome } : {}) }),
    () => problemiFatturazione(fatturazione),
    () => problemiReferente(referente),
  ]

  const avanti = () => {
    const p = controlli[passo]()
    setErrori(p)
    if (Object.keys(p).length === 0) setPasso((x) => x + 1)
  }

  const invia = async (e) => {
    e.preventDefault()
    const p = controlli[passo]()
    setErrori(p)
    if (Object.keys(p).length) return
    setErrore(null)
    setInCorso(true)
    try {
      await registra({ email: account.email, password: account.password, locale, fatturazione, referente })
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setErrore(messaggio(err))
    } finally {
      setInCorso(false)
    }
  }

  const campo = (id, etichetta, valore, onChange, props = {}) => (
    <div className="campo">
      <label htmlFor={id}>{etichetta}</label>
      <input id={id} value={valore} onChange={(e) => onChange(e.target.value)} aria-invalid={Boolean(errori[props.chiave || id])} {...props} />
      {errori[props.chiave || id] && <p className="errore small">{errori[props.chiave || id]}</p>}
    </div>
  )

  return (
    <main className="pagina stretta">
      <form className="card" onSubmit={invia} noValidate>
        <h2>Registra il tuo locale</h2>
        <ol className="passi" aria-label="Passi della registrazione">
          {PASSI.map((n, i) => (
            <li key={n} className={i === passo ? 'corrente' : i < passo ? 'fatto' : ''} aria-current={i === passo ? 'step' : undefined}>
              {n}
            </li>
          ))}
        </ol>

        {passo === 0 && (
          <fieldset>
            <legend>Il tuo account</legend>
            {campo('email', 'Email', account.email, (v) => setAccount({ ...account, email: v }), { type: 'email', autoComplete: 'email' })}
            {campo('password', 'Password (almeno 10 caratteri, con una cifra)', account.password, (v) => setAccount({ ...account, password: v }), { type: 'password', autoComplete: 'new-password' })}
            {campo('conferma', 'Ripeti la password', account.conferma, (v) => setAccount({ ...account, conferma: v }), { type: 'password', autoComplete: 'new-password' })}
          </fieldset>
        )}

        {passo === 1 && (
          <fieldset>
            <legend>Il locale</legend>
            {campo('nome', 'Nome del locale', locale.nome, (v) => setLocale({ ...locale, nome: v }))}
            {locale.nome && !errori.nome && <p className="muted small">L’indirizzo dell’app sarà {urlDi(slug)}</p>}
            <div className="campo">
              <label htmlFor="tipo">Tipo di locale</label>
              <select id="tipo" value={locale.tipo} onChange={(e) => setLocale({ ...locale, tipo: e.target.value })} aria-invalid={Boolean(errori.tipo)}>
                <option value="">Scegli…</option>
                {TIPI_LOCALE.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              {errori.tipo && <p className="errore small">{errori.tipo}</p>}
            </div>
            {campo('via', 'Indirizzo', locale.via, (v) => setLocale({ ...locale, via: v }), { autoComplete: 'street-address' })}
            <div className="grid-3">
              {campo('cap', 'CAP', locale.cap, (v) => setLocale({ ...locale, cap: v }), { inputMode: 'numeric', autoComplete: 'postal-code' })}
              {campo('citta', 'Città', locale.citta, (v) => setLocale({ ...locale, citta: v }), { autoComplete: 'address-level2' })}
              {campo('provincia', 'Provincia', locale.provincia, (v) => setLocale({ ...locale, provincia: v.toUpperCase() }), { maxLength: 2, placeholder: 'NA' })}
            </div>
            {campo('telefono', 'Telefono del locale', locale.telefono, (v) => setLocale({ ...locale, telefono: v }), { type: 'tel', autoComplete: 'tel' })}
            {campo('sito', 'Sito o pagina social (facoltativo)', locale.sito, (v) => setLocale({ ...locale, sito: v }), { type: 'url', placeholder: 'https://' })}
          </fieldset>
        )}

        {passo === 2 && (
          <fieldset>
            <legend>Dati di fatturazione</legend>
            {campo('ragione_sociale', 'Ragione sociale', fatturazione.ragione_sociale, (v) => setFatturazione({ ...fatturazione, ragione_sociale: v }), { autoComplete: 'organization' })}
            {campo('partita_iva', 'Partita IVA', fatturazione.partita_iva, (v) => setFatturazione({ ...fatturazione, partita_iva: v }), { inputMode: 'numeric' })}
            {campo('codice_fiscale', 'Codice fiscale (se diverso dalla partita IVA)', fatturazione.codice_fiscale, (v) => setFatturazione({ ...fatturazione, codice_fiscale: v.toUpperCase() }))}
            <p className="muted small">Per la fattura elettronica serve almeno uno dei due:</p>
            {campo('pec', 'PEC', fatturazione.pec, (v) => setFatturazione({ ...fatturazione, pec: v }), { type: 'email' })}
            {campo('sdi', 'Codice destinatario (SDI)', fatturazione.sdi, (v) => setFatturazione({ ...fatturazione, sdi: v.toUpperCase() }), { maxLength: 7 })}
            <label className="opzione">
              <input type="checkbox" checked={fatturazione.stessa_sede} onChange={(e) => setFatturazione({ ...fatturazione, stessa_sede: e.target.checked })} />
              La sede legale è l’indirizzo del locale
            </label>
            {!fatturazione.stessa_sede && (
              <>
                {campo('sede_via', 'Indirizzo della sede legale', fatturazione.via, (v) => setFatturazione({ ...fatturazione, via: v }), { chiave: 'via' })}
                <div className="grid-3">
                  {campo('sede_cap', 'CAP', fatturazione.cap, (v) => setFatturazione({ ...fatturazione, cap: v }), { chiave: 'cap', inputMode: 'numeric' })}
                  {campo('sede_citta', 'Città', fatturazione.citta, (v) => setFatturazione({ ...fatturazione, citta: v }), { chiave: 'citta' })}
                  {campo('sede_provincia', 'Provincia', fatturazione.provincia, (v) => setFatturazione({ ...fatturazione, provincia: v.toUpperCase() }), { chiave: 'provincia', maxLength: 2 })}
                </div>
              </>
            )}
          </fieldset>
        )}

        {passo === 3 && (
          <fieldset>
            <legend>Referente e consensi</legend>
            <div className="grid-2">
              {campo('ref_nome', 'Nome', referente.nome, (v) => setReferente({ ...referente, nome: v }), { chiave: 'nome', autoComplete: 'given-name' })}
              {campo('ref_cognome', 'Cognome', referente.cognome, (v) => setReferente({ ...referente, cognome: v }), { chiave: 'cognome', autoComplete: 'family-name' })}
            </div>
            {campo('ruolo', 'Ruolo (titolare, responsabile…)', referente.ruolo, (v) => setReferente({ ...referente, ruolo: v }))}
            {campo('ref_telefono', 'Telefono diretto (facoltativo)', referente.telefono, (v) => setReferente({ ...referente, telefono: v }), { chiave: 'telefono', type: 'tel' })}
            <label className="opzione">
              <input type="checkbox" checked={referente.termini} onChange={(e) => setReferente({ ...referente, termini: e.target.checked })} />
              Ho letto e accetto i <Link to="/termini" target="_blank">termini di servizio</Link>
            </label>
            {errori.termini && <p className="errore small">{errori.termini}</p>}
            <label className="opzione">
              <input type="checkbox" checked={referente.privacy} onChange={(e) => setReferente({ ...referente, privacy: e.target.checked })} />
              Ho letto l’<Link to="/privacy" target="_blank">informativa sulla privacy</Link> e acconsento al trattamento dei dati per il servizio
            </label>
            {errori.privacy && <p className="errore small">{errori.privacy}</p>}
            <label className="opzione">
              <input type="checkbox" checked={referente.marketing} onChange={(e) => setReferente({ ...referente, marketing: e.target.checked })} />
              Voglio ricevere le novità del prodotto (facoltativo)
            </label>
          </fieldset>
        )}

        {errore && <p className="errore">{errore}</p>}
        <div className="azioni">
          {passo > 0 && (
            <button type="button" className="btn ghost" onClick={() => setPasso((x) => x - 1)}>
              Indietro
            </button>
          )}
          {passo < PASSI.length - 1 ? (
            <button type="button" className="btn" onClick={avanti}>
              Avanti
            </button>
          ) : (
            <button type="submit" className="btn" disabled={inCorso}>
              {inCorso ? 'Un momento…' : 'Crea l’account'}
            </button>
          )}
        </div>
        <p className="muted small">
          Hai già un account? <Link to="/accedi">Accedi</Link>
        </p>
      </form>
    </main>
  )
}

export function messaggio(err) {
  const codice = err?.code || ''
  if (codice.includes('email-already-in-use')) return 'Questa email ha già un account: accedi.'
  if (codice.includes('invalid-email')) return 'L’email non è scritta bene.'
  if (codice.includes('weak-password')) return 'La password è troppo corta.'
  if (codice.includes('too-many-requests')) return 'Troppi tentativi: riprova fra qualche minuto.'
  if (codice.includes('invalid-credential') || codice.includes('wrong-password') || codice.includes('user-not-found')) {
    return 'Email o password non corrispondono.'
  }
  return err?.message || 'Qualcosa non è andato. Riprova.'
}
