// ── IL CLIENTE (REQ-FLOTTA-003): logica pura ──────────────────────────

// Lo slug dal nome del locale: minuscole, senza accenti, trattini. È il
// prefisso del progetto Firebase dell'istanza (`drink-<slug>`), quindi
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

// Il documento clienti/{uid} come nasce alla registrazione.
export function nuovoCliente({ uid, email, nomeLocale, contatto = '', adesso = new Date() }) {
  const slug = slugDi(nomeLocale)
  const problema = problemaSlug(slug)
  if (problema) throw new Error(problema)
  return {
    uid,
    email: String(email || '').trim().toLowerCase(),
    nome_locale: String(nomeLocale || '').trim(),
    slug,
    contatto: String(contatto || '').trim(),
    creato_il: adesso.toISOString(),
  }
}
