import { useEffect, useState } from 'react'
import { venueDi, venuePredefinito, socialDaTesto, socialInTesto } from '../lib/venue.js'

// ── IMPOSTAZIONI → IL LOCALE (REQ-VENUE-001) ──────────────────────────
//
// Nome, slogan, «chi siamo», contatti, ragione sociale e intestazione
// dello scontrino, social: quello che l'app mostra di sé. Vuoto vuol dire
// «vale la build» (clienti/<slug>/venue.json), e il segnaposto di ogni
// casella dice qual è quel valore. Si salva all'uscita dalla casella, una
// chiave alla volta: niente tasto «Salva» da ricordarsi.

const CAMPI = [
  ['venue_name', 'Nome del locale', 'Nella barra, nel menù, nel titolo dell’app.'],
  ['venue_short_name', 'Nome corto', 'Sotto l’icona dell’app installata.'],
  ['venue_presso', 'Il locale nella frase', 'Con la preposizione: «al Bar Mario», «alla Locanda del Porto». Nel benvenuto del menù e nella registrazione dei clienti.'],
  ['venue_tagline', 'Slogan', 'Sotto il nome, nella pagina iniziale.'],
  ['venue_city', 'Città', 'Nei contatti della pagina iniziale.'],
  ['venue_email', 'Email', 'Nei contatti della pagina iniziale.'],
  ['venue_email_domain', 'Dominio delle email del personale', 'Suggerito creando un’utenza.'],
  ['venue_legal_name', 'Ragione sociale', 'In coda allo scontrino.'],
  ['venue_address', 'Indirizzo', 'In testa allo scontrino.'],
  ['venue_postal_city', 'CAP e città', 'In testa allo scontrino, sotto l’indirizzo.'],
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
      <h3>Il locale</h3>
      <p className="muted" style={{ margin: '0 0 10px', fontSize: '0.85rem' }}>
        Identità del locale: nome, contatti, intestazione dello scontrino e social. Una casella vuota
        lascia il valore predefinito, mostrato in grigio.
      </p>
      {CAMPI.map(([chiave, etichetta, aiuto]) => (
        <div key={chiave} style={{ marginBottom: 8 }}>
          <label htmlFor={`locale-${chiave}`}>{etichetta}</label>
          <input
            id={`locale-${chiave}`}
            value={bozza[chiave]}
            placeholder={build[chiave]}
            onChange={(e) => setBozza((b) => ({ ...b, [chiave]: e.target.value }))}
            onBlur={() => salva(chiave, bozza[chiave].trim())}
          />
          <div className="muted small">{aiuto}</div>
        </div>
      ))}
      <label htmlFor="locale-venue_about">Chi siamo</label>
      <textarea
        id="locale-venue_about"
        rows={3}
        value={bozza.venue_about}
        placeholder={build.venue_about}
        onChange={(e) => setBozza((b) => ({ ...b, venue_about: e.target.value }))}
        onBlur={() => salva('venue_about', bozza.venue_about.trim())}
      />
      <div className="muted small">Nella pagina iniziale. Vuoto, la sezione non compare.</div>
      <label htmlFor="locale-venue_socials" style={{ marginTop: 8 }}>
        Social
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
        Una riga per social: piattaforma e indirizzo (instagram, facebook, tiktok, telegram, tripadvisor,
        o link). Nel piede di pagina lato cliente. Oggi: {venue.venue_socials.length} collegamenti.
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
