'use strict'

// Gestione utenze (admin/bartender/staff/clienti) — logica con dipendenze
// iniettate (adminAuth) per essere testabile senza Firebase reale.
//
// Chi può fare cosa:
//   list          admin e bartender (serve la rubrica: cerca-persone, ore)
//   list tutti    solo admin (comprende i clienti registrati)
//   create        solo admin
//   setRole       solo admin
//   setDisabled   solo admin
//   delete        solo admin
//
// Il ruolo è un custom claim: le regole di Firestore leggono quello, quindi
// assegnarlo qui è a tutti gli effetti dare le chiavi del locale.

const { limitiInVigore } = require('./licenza-core')

const RUOLI = ['admin', 'bartender', 'staff']
const ASSEGNABILI = [...RUOLI, 'cliente']

// Ruolo effettivo del chiamante: senza claim è un cliente registrato
// (nessun privilegio gestionale).
function callerRole(auth) {
  if (!auth) return null
  return auth.token?.role ?? 'cliente'
}
const isAdmin = (r) => r === 'admin'
const isGestore = (r) => r === 'admin' || r === 'bartender'

const nego = (message) => {
  throw { code: 'permission-denied', message }
}
const invalido = (message) => {
  throw { code: 'invalid-argument', message }
}

// Tutte le utenze, a pagine: listUsers ne dà al massimo 1000 per volta e
// i clienti registrati, col tempo, saranno più di così.
async function tutteLeUtenze(adminAuth) {
  const out = []
  let pageToken
  do {
    const res = await adminAuth.listUsers(1000, pageToken)
    out.push(...(res.users || []))
    pageToken = res.pageToken
  } while (pageToken && out.length < 10000)
  return out
}

function vista(u) {
  return {
    uid: u.uid,
    email: u.email ?? null,
    name: u.displayName ?? null,
    role: u.customClaims?.role ?? 'cliente',
    disabled: !!u.disabled,
    created_at: u.metadata?.creationTime ?? null,
    last_login_at: u.metadata?.lastSignInTime ?? null,
  }
}

// L'ULTIMO ADMIN NON SI TOCCA. Togliendo il ruolo (o l'accesso) all'unico
// amministratore rimasto, nessuno potrebbe più nominarne un altro: il
// locale resterebbe chiuso fuori dal proprio gestionale, e si tornerebbe a
// dover intervenire da riga di comando.
async function vietaSeUltimoAdmin(adminAuth, uid, cosa) {
  const utenti = await tutteLeUtenze(adminAuth)
  const bersaglio = utenti.find((u) => u.uid === uid)
  if (!bersaglio || bersaglio.customClaims?.role !== 'admin') return
  const altri = utenti.filter(
    (u) => u.uid !== uid && u.customClaims?.role === 'admin' && !u.disabled
  )
  if (!altri.length) {
    throw {
      code: 'failed-precondition',
      message: `È l'unico admin rimasto: ${cosa} lascerebbe il gestionale senza amministratori. Nominane un altro prima.`,
    }
  }
}

// IL PIANO TIENE UN NUMERO DI UTENZE (BUG-165). Sul Free col profilo
// completo `staffAdmin` è pubblicata, e l'app che nasconde la gestione delle
// utenze non basta: chiamandola a mano se ne creavano quante si voleva. Si
// contano le utenze ATTIVE dello staff, e il tetto ferma solo le aggiunte —
// crearne una, promuovere un cliente, riattivarne una spenta. Quelle che ci
// sono restano: chi scende al Free con più persone non perde nessuno.
// Prima i limiti, poi l'elenco delle utenze, letto una volta sola: senza un
// tetto (la Tana, i piani a pagamento) non si legge niente in più.
// `aggiunge(utenti)` dice se il gesto porta davvero un'utenza attiva dello
// staff in più. Fra il conteggio e la scrittura passa un istante: due
// chiamate in parallelo dalla console possono sforare di una — sul Free no,
// il titolare occupa già l'unico posto. `leggiLicenza` manca solo nei test
// che non parlano di piani.
async function vietaOltreIlPiano(adminAuth, leggiLicenza, aggiunge = () => true) {
  if (!leggiLicenza) return
  const tetto = limitiInVigore(await leggiLicenza())?.utenti_max
  const max = Number(tetto)
  // Come l'app (limiti.js, `tetto`): un numero da zero in su è un tetto,
  // il resto — assente o illeggibile — non limita.
  if (tetto == null || !Number.isFinite(max) || max < 0) return
  const utenti = await tutteLeUtenze(adminAuth)
  if (!aggiunge(utenti)) return
  const attive = utenti.filter((u) => RUOLI.includes(u.customClaims?.role) && !u.disabled)
  if (attive.length >= max) {
    throw {
      code: 'failed-precondition',
      message:
        `Il piano del locale comprende al massimo ${max} ${max === 1 ? 'utenza attiva' : 'utenze attive'} dello staff. ` +
        'Per aggiungerne un’altra occorre sospenderne una o passare a un piano superiore.',
    }
  }
}

// Esegue un'azione di amministrazione utenze. Lancia { code, message }
// compatibile con HttpsError. `adminAuth` = firebase-admin/auth.
// `deps.leggiLicenza`: () => la licenza del locale (licenza/attuale), o null.
async function staffAdmin(adminAuth, auth, data, { leggiLicenza } = {}) {
  const chiamante = callerRole(auth)
  const action = data?.action

  if (action === 'list') {
    // La rubrica serve anche al bartender (cerca-persone, turni, badge).
    if (!isGestore(chiamante)) nego('Operazione riservata allo staff di gestione.')
    // I clienti registrati li vede solo l'admin, ed è l'elenco da cui
    // nomina i ruoli.
    if (data.tutti && !isAdmin(chiamante)) nego("Elenco completo riservato all'admin.")
    const utenti = (await tutteLeUtenze(adminAuth)).map(vista)
    return { users: data.tutti ? utenti : utenti.filter((u) => RUOLI.includes(u.role)) }
  }

  if (!isAdmin(chiamante)) nego("Operazione riservata all'admin.")

  if (action === 'create') {
    const { email, password, role, name } = data
    if (!email || !password || password.length < 6) {
      invalido('Email e password (min 6 caratteri) obbligatorie.')
    }
    if (!RUOLI.includes(role)) invalido(`Ruolo non valido: ${role}`)
    await vietaOltreIlPiano(adminAuth, leggiLicenza)
    const user = await adminAuth.createUser({
      email,
      password,
      displayName: (name || '').trim() || undefined,
    })
    await adminAuth.setCustomUserClaims(user.uid, { role })
    return { uid: user.uid, email, name: user.displayName ?? null, role }
  }

  if (action === 'setRole') {
    const { uid, role } = data
    if (!uid || !ASSEGNABILI.includes(role)) invalido('uid e ruolo validi obbligatori.')
    if (uid === auth.uid) {
      throw { code: 'failed-precondition', message: 'Non puoi cambiare il tuo stesso ruolo.' }
    }
    if (role !== 'admin') await vietaSeUltimoAdmin(adminAuth, uid, 'cambiargli ruolo')
    // Un cliente attivo che diventa staff è un'utenza dello staff in più.
    if (RUOLI.includes(role)) {
      await vietaOltreIlPiano(adminAuth, leggiLicenza, (utenti) => {
        const prima = utenti.find((u) => u.uid === uid)
        return Boolean(prima) && !prima.disabled && !RUOLI.includes(prima.customClaims?.role)
      })
    }
    // "cliente" non è un claim: è l'assenza di claim.
    await adminAuth.setCustomUserClaims(uid, role === 'cliente' ? null : { role })
    return { uid, role }
  }

  if (action === 'setDisabled') {
    const { uid, disabled } = data
    if (!uid || typeof disabled !== 'boolean') invalido('uid e stato obbligatori.')
    if (uid === auth.uid) {
      throw { code: 'failed-precondition', message: 'Non puoi disattivare il tuo stesso account.' }
    }
    if (disabled) await vietaSeUltimoAdmin(adminAuth, uid, 'disattivarlo')
    else {
      // Riattivare un'utenza dello staff spenta la rimette nel conto.
      await vietaOltreIlPiano(adminAuth, leggiLicenza, (utenti) => {
        const prima = utenti.find((u) => u.uid === uid)
        return Boolean(prima?.disabled) && RUOLI.includes(prima?.customClaims?.role)
      })
    }
    await adminAuth.updateUser(uid, { disabled })
    return { uid, disabled }
  }

  if (action === 'delete') {
    const { uid } = data
    if (!uid) invalido('uid obbligatorio.')
    if (uid === auth.uid) {
      throw { code: 'failed-precondition', message: 'Non puoi eliminare il tuo stesso account.' }
    }
    await vietaSeUltimoAdmin(adminAuth, uid, 'eliminarlo')
    await adminAuth.deleteUser(uid)
    return { uid, deleted: true }
  }

  invalido(`Azione sconosciuta: ${action}`)
}

module.exports = { staffAdmin, ROLES: RUOLI, RUOLI, ASSEGNABILI, isGestore, isAdmin }
