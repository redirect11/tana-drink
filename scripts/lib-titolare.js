// ── IL TITOLARE DEL LOCALE: LO STESSO ACCOUNT DELLA REGIA (REQ-FLOTTA-029) ──
//
// La regia (drink-regia), quando attiva o aggiorna un locale della flotta,
// crea nel progetto del locale l'account del titolare con lo STESSO uid e
// la stessa email che ha nella regia, col ruolo `admin` nei custom claims
// (il ruolo dell'app, src/lib/ruoli.js), e senza password: la imposta lui
// dall'email «reimposta la password» di Firebase (M7, 02/11/2026). Lo fa lo
// script della regia scripts/titolare-istanza.mjs con la regola
// functions/lib/titolare.js di drink-regia.
//
// I workflow della regia saltano i locali esistenti (la Tana: ha i suoi
// admin). Per quelli c'è scripts/titolare-locale.mjs, lanciato a mano, che
// usa QUESTA regola: una copia di quella della regia, come lib-firestore.js
// è una copia fra i due repository. Se una cambia, si cambia anche l'altra:
// i casi dei test (tests/unit/titolareLocale.test.js) sono gli stessi.
//
// Perché l'uid conta: è l'identità. Con lo stesso uid nei due progetti il
// titolare è la stessa persona nei log, nei passaggi fra regia e app, e se
// cambia email nella regia il locale lo riconosce ancora. L'uid di Firebase
// Auth però non si cambia: un account che c'è con un uid diverso si può
// solo cancellare e ricreare, e lo si fa SOLO se è un segnaposto mai usato.
// Un account usato (Flavio alla Tana) resta com'è, con un avviso.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

// L'email del titolare, pulita; '' se manca, null se non è un'email.
export function emailTitolare(v) {
  const e = String(v ?? '').trim().toLowerCase()
  if (!e) return ''
  return EMAIL.test(e) && e.length <= 254 ? e : null
}

// L'uid della regia, pulito; '' se manca, null se non è un uid.
export function uidTitolare(v) {
  const u = String(v ?? '').trim()
  if (!u) return ''
  return /^[A-Za-z0-9]{1,128}$/.test(u) ? u : null
}

const haPassword = (u) => Boolean(u?.passwordHash) || (u?.providerData || []).some((p) => p?.providerId === 'password')

// Mai entrato: nessun rinnovo del token e nessun accesso dopo la creazione.
// L'emulatore di Auth segna un accesso già alla creazione (lastSignInTime
// uguale a creationTime): da solo, lastSignInTime ingannerebbe.
function maiEntrato(u) {
  const m = u?.metadata || {}
  if (m.lastRefreshTime) return false
  return !m.lastSignInTime || (Boolean(m.creationTime) && m.lastSignInTime === m.creationTime)
}

// Un account mai usato, senza password né altri accessi, con al più il
// ruolo admin: nato dal passo della regia, niente di suo da perdere.
export function segnaposto(u) {
  if (!u || haPassword(u) || !maiEntrato(u)) return false
  if ((u.providerData || []).length > 0) return false
  const claims = Object.keys(u.customClaims || {})
  return claims.length === 0 || (claims.length === 1 && u.customClaims.role === 'admin')
}

// Il piano: { azione: 'crea' | 'ricrea' | 'tieni', uid, ruolo, link, avvisi,
// daCancellare }. Dopo la prima volta dà sempre 'tieni' con ruolo null:
// rilanciarlo non cambia niente.
export function pianoTitolare({ uid = '', email, perUid = null, perEmail = null }) {
  const avvisi = []
  const tieni = (u) => {
    const claims = u.customClaims || {}
    return {
      azione: 'tieni',
      uid: u.uid,
      ruolo: claims.role === 'admin' ? null : { ...claims, role: 'admin' },
      // Il link va all'email: se è di un altro account, arriverebbe a lui.
      link: !haPassword(u) && maiEntrato(u) && emailTitolare(u.email) === email,
      avvisi,
      daCancellare: null,
    }
  }
  const crea = (daCancellare = null) => ({ azione: daCancellare ? 'ricrea' : 'crea', uid: uid || null, ruolo: { role: 'admin' }, link: true, avvisi, daCancellare })

  if (!uid) {
    if (perEmail) return tieni(perEmail)
    avvisi.push('Nessun uid della regia: l’account nasce con un uid suo.')
    return crea()
  }
  if (perUid) {
    if (emailTitolare(perUid.email) !== email) avvisi.push(`L’account del titolare ha un’altra email (${perUid.email || 'nessuna'}): non si cambia da qui.`)
    if (perEmail && perEmail.uid !== uid) avvisi.push(`L’email ${email} è di un altro account (${perEmail.uid}): non si tocca.`)
    return tieni(perUid)
  }
  if (perEmail) {
    if (segnaposto(perEmail)) return crea(perEmail.uid)
    avvisi.push(`L’account ${email} c’è già con un altro uid (${perEmail.uid}) ed è stato usato: resta quello.`)
    return tieni(perEmail)
  }
  return crea()
}

// L'utente come lo dà l'API REST di Identity Toolkit (accounts:lookup),
// nella forma dello UserRecord dell'Admin SDK che il piano si aspetta.
// Lo script usa il REST perché gira con la sessione del Firebase CLI, come
// scripts/set-role.js: niente chiavi di service account sulla macchina.
export function daRest(u) {
  if (!u) return null
  let customClaims = {}
  try {
    customClaims = JSON.parse(u.customAttributes || '{}')
  } catch {
    /* attributi illeggibili: come nessun claim */
  }
  return {
    uid: u.localId,
    email: u.email || null,
    customClaims,
    passwordHash: u.passwordHash || null,
    providerData: (u.providerUserInfo || []).map((p) => ({ providerId: p.providerId })),
    metadata: { creationTime: u.createdAt || null, lastSignInTime: u.lastLoginAt || null, lastRefreshTime: u.lastRefreshAt || null },
  }
}
