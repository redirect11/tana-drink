// ── IL CLIENTE (REQ-FLOTTA-003): logica pura ──────────────────────────

import { TIPI_LOCALE } from './validazione.js'

// Lo slug dal nome del locale: minuscole, senza accenti, trattini. È il
// prefisso del progetto Firebase dell'istanza (`drinkpos-<slug>`), quindi
// vale la regola dei project id: da 6 a 30 caratteri, lettere minuscole,
// cifre e trattini, non finisce con un trattino.
export function slugDi(nome) {
  return String(nome || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 30)
    .replace(/-+$/g, '')
}

export const SLUG_VALIDO = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/

// Perché uno slug non va bene, o null se va bene.
export function problemaSlug(slug) {
  if (!slug) return 'Serve un nome per il locale.'
  if (slug.length < 6) return 'Troppo corto: almeno 6 caratteri.'
  if (slug.length > 30) return 'Troppo lungo: al massimo 30 caratteri.'
  if (!SLUG_VALIDO.test(slug)) return 'Solo lettere minuscole, cifre e trattini; comincia con una lettera.'
  if (['tana', 'demo', 'regia', 'admin', 'test'].some((r) => slug === r || slug.startsWith(`${r}-`) && slug.length <= r.length + 1)) return 'Questo nome è riservato.'
  return null
}

const pulito = (v) => String(v || '').trim()
const maiuscolo = (v) => pulito(v).toUpperCase()

// IL DOCUMENTO clienti/{uid} COME NASCE ALLA REGISTRAZIONE (schema 2).
// `nome_locale` e `slug` restano in cima perché istanze, richieste e
// backoffice li leggono da lì; il resto è a blocchi: locale, fatturazione,
// referente, consensi. I consensi portano l'istante in cui sono stati dati.
export function nuovoCliente({ uid, email, account, locale, fatturazione, referente, adesso = new Date() }) {
  const nomeLocale = pulito(locale?.nome ?? account?.nomeLocale)
  const slug = slugDi(nomeLocale)
  const problema = problemaSlug(slug)
  if (problema) throw new Error(problema)
  const ora = adesso.toISOString()
  const sedeLocale = {
    via: pulito(locale?.via),
    cap: pulito(locale?.cap),
    citta: pulito(locale?.citta),
    provincia: maiuscolo(locale?.provincia),
  }
  return {
    uid,
    versione_schema: 2,
    email: pulito(email).toLowerCase(),
    nome_locale: nomeLocale,
    slug,
    locale: {
      tipo: TIPI_LOCALE.includes(locale?.tipo) ? locale.tipo : 'altro',
      indirizzo: sedeLocale,
      telefono: pulito(locale?.telefono),
      sito: pulito(locale?.sito),
    },
    fatturazione: {
      ragione_sociale: pulito(fatturazione?.ragione_sociale),
      partita_iva: pulito(fatturazione?.partita_iva).replace(/^IT/i, ''),
      codice_fiscale: maiuscolo(fatturazione?.codice_fiscale),
      pec: pulito(fatturazione?.pec).toLowerCase(),
      sdi: maiuscolo(fatturazione?.sdi),
      sede_legale: fatturazione?.stessa_sede
        ? sedeLocale
        : {
            via: pulito(fatturazione?.via),
            cap: pulito(fatturazione?.cap),
            citta: pulito(fatturazione?.citta),
            provincia: maiuscolo(fatturazione?.provincia),
          },
    },
    referente: {
      nome: pulito(referente?.nome),
      cognome: pulito(referente?.cognome),
      ruolo: pulito(referente?.ruolo),
      telefono: pulito(referente?.telefono),
    },
    consensi: {
      termini_il: ora,
      privacy_il: ora,
      marketing: Boolean(referente?.marketing),
    },
    creato_il: ora,
  }
}

// Il nome da mostrare per un cliente, qualunque versione dello schema.
export const contattoDi = (c) =>
  c?.referente?.nome ? `${c.referente.nome} ${c.referente.cognome || ''}`.trim() : c?.contatto || ''
