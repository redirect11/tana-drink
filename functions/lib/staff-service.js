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

// Esegue un'azione di amministrazione utenze. Lancia { code, message }
// compatibile con HttpsError. `adminAuth` = firebase-admin/auth.
async function staffAdmin(adminAuth, auth, data) {
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

module.exports = { staffAdmin, ROLES: RUOLI, RUOLI, ASSEGNABILI }
