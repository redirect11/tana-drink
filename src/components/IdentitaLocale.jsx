import { useEffect, useState } from 'react'
import { venueDi, venuePredefinito, socialDaTesto, socialInTesto } from '../lib/venue.js'
import { tr, daTradurre, trSegnato } from '../lib/lingua.js'

// ── IMPOSTAZIONI → IL LOCALE (REQ-VENUE-001) ──────────────────────────
//
// Nome, slogan, «chi siamo», contatti, ragione sociale e intestazione
// dello scontrino, social: quello che l'app mostra di sé. Vuoto vuol dire
// «vale la build» (clienti/<slug>/venue.json), e il segnaposto di ogni
// casella dice qual è quel valore. Si salva all'uscita dalla casella, una
// chiave alla volta: niente tasto «Salva» da ricordarsi.

const CAMPI = [
  ['venue_name', daTradurre('Nome del locale'), daTradurre('Nella barra, nel menù, nel titolo dell’app.')],
  ['venue_short_name', daTradurre('Nome corto'), daTradurre('Sotto l’icona dell’app installata.')],
  [
    'venue_presso',
    daTradurre('Il locale nella frase'),
    daTradurre('Con la preposizione: «al Bar Mario», «alla Locanda del Porto». Nel benvenuto del menù e nella registrazione dei clienti.'),
  ],
  ['venue_tagline', daTradurre('Slogan'), daTradurre('Sotto il nome, nella pagina iniziale.')],
  ['venue_city', daTradurre('Città'), daTradurre('Nei contatti della pagina iniziale.')],
  ['venue_email', daTradurre('Email'), daTradurre('Nei contatti della pagina iniziale.')],
  ['venue_email_domain', daTradurre('Dominio delle email del personale'), daTradurre('Suggerito creando un’utenza.')],
  ['venue_legal_name', daTradurre('Ragione sociale'), daTradurre('In coda allo scontrino.')],
  ['venue_address', daTradurre('Indirizzo'), daTradurre('In testa allo scontrino.')],
  ['venue_postal_city', daTradurre('CAP e città'), daTradurre('In testa allo scontrino, sotto l’indirizzo.')],
  // I dati del titolare: li scrive la regia dalla sua registrazione, dove
  // sono vuoti (REQ-FLOTTA-030), e qui si correggono.
  ['venue_phone', daTradurre('Telefono'), daTradurre('Nei contatti della pagina iniziale.')],
  [
    'venue_vat_number',
    daTradurre('Partita IVA'),
    daTradurre('In coda allo scontrino, con la ragione sociale, e sulle fatture di cortesia.'),
  ],
  ['venue_tax_code', daTradurre('Codice fiscale'), daTradurre('Sulle fatture di cortesia, se diverso dalla partita IVA.')],
  [
    'venue_legal_address',
    daTradurre('Sede legale'),
    daTradurre('Sulle fatture di cortesia, in una riga: via, civico, CAP, città.'),
  ],
]

export default function IdentitaLocale({ settings, onSave }) {
  const build = venuePredefinito()
  const venue = venueDi(settings)
  // Quello che si sta scrivendo: parte dalle impostazioni (vuote dove non
  // scritte), non dal valore fuso, se no il segnaposto non si vede mai.
  const [bozza, setBozza] = useState(() => daImpostazioni(settings))
  useEffect(() => {
    setBozza(daImpostazioni(settings))
  }, [settings])

  const salva = (chiave, valore) => {
    if ((settings?.[chiave] ?? '') === valore) return
    onSave({ [chiave]: valore })
  }

  return (
    <div className="card settings-section">
      <h3>{tr('Il locale')}</h3>
      <p className="muted" style={{ margin: '0 0 10px', fontSize: '0.85rem' }}>
        {tr(
          'Identità del locale: nome, contatti, intestazione dello scontrino e social. Una casella vuota lascia il valore predefinito, mostrato in grigio.'
        )}
      </p>
      {CAMPI.map(([chiave, etichetta, aiuto]) => (
        <div key={chiave} style={{ marginBottom: 8 }}>
          <label htmlFor={`locale-${chiave}`}>{trSegnato(etichetta)}</label>
          <input
            id={`locale-${chiave}`}
            value={bozza[chiave]}
            placeholder={build[chiave]}
            onChange={(e) => setBozza((b) => ({ ...b, [chiave]: e.target.value }))}
            onBlur={() => salva(chiave, bozza[chiave].trim())}
          />
          <div className="muted small">{trSegnato(aiuto)}</div>
        </div>
      ))}
      <label htmlFor="locale-venue_about">{tr('Chi siamo')}</label>
      <textarea
        id="locale-venue_about"
        rows={3}
        value={bozza.venue_about}
        placeholder={build.venue_about}
        onChange={(e) => setBozza((b) => ({ ...b, venue_about: e.target.value }))}
        onBlur={() => salva('venue_about', bozza.venue_about.trim())}
      />
      <div className="muted small">{tr('Nella pagina iniziale. Vuoto, la sezione non compare.')}</div>
      <label htmlFor="locale-venue_socials" style={{ marginTop: 8 }}>
        {tr('Social')}
      </label>
      <textarea
        id="locale-venue_socials"
        rows={3}
        value={bozza.venue_socials}
        placeholder={socialInTesto(build.venue_socials) || 'instagram https://…'}
        onChange={(e) => setBozza((b) => ({ ...b, venue_socials: e.target.value }))}
        onBlur={() => {
          const nuovi = socialDaTesto(bozza.venue_socials)
          if (socialInTesto(settings?.venue_socials) === socialInTesto(nuovi)) return
          onSave({ venue_socials: nuovi })
        }}
      />
      <div className="muted small">
        {tr(
          'Una riga per social: piattaforma e indirizzo (instagram, facebook, tiktok, telegram, tripadvisor, o link). Nel piede di pagina lato cliente.'
        )}{' '}
        {venue.venue_socials.length === 1
          ? tr('Oggi: 1 collegamento.')
          : tr('Oggi: {n} collegamenti.', { n: venue.venue_socials.length })}
      </div>
    </div>
  )
}

function daImpostazioni(settings) {
  const b = {}
  for (const [chiave] of CAMPI) b[chiave] = settings?.[chiave] ?? ''
  b.venue_about = settings?.venue_about ?? ''
  b.venue_socials = socialInTesto(settings?.venue_socials)
  return b
}
