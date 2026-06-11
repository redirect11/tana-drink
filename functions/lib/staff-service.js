'use strict'

// Gestione utenze staff (bartender/cameriera) — logica con dipendenze
// iniettate (adminAuth) per essere testabile senza Firebase reale.

const ROLES = ['bartender', 'cameriera']

// Ruolo effettivo del chiamante: i token senza claim sono bartender
// (retrocompatibilità con gli account creati prima dei ruoli).
function callerRole(auth) {
  if (!auth) return null
  return auth.token?.role ?? 'bartender'
}

// Esegue un'azione di amministrazione staff. Lancia { code, message }
// compatibile con HttpsError. `adminAuth` = firebase-admin/auth.
async function staffAdmin(adminAuth, auth, data) {
  if (callerRole(auth) !== 'bartender') {
    throw { code: 'permission-denied', message: 'Operazione riservata al bartender.' }
  }
  const action = data?.action

  if (action === 'list') {
    const res = await adminAuth.listUsers(1000)
    return {
      users: res.users.map((u) => ({
        uid: u.uid,
        email: u.email,
        role: u.customClaims?.role ?? 'bartender',
        disabled: u.disabled,
        created_at: u.metadata?.creationTime ?? null,
      })),
    }
  }

  if (action === 'create') {
    const { email, password, role } = data
    if (!email || !password || password.length < 6) {
      throw { code: 'invalid-argument', message: 'Email e password (min 6 caratteri) obbligatorie.' }
    }
    if (!ROLES.includes(role)) {
      throw { code: 'invalid-argument', message: `Ruolo non valido: ${role}` }
    }
    const user = await adminAuth.createUser({ email, password })
    await adminAuth.setCustomUserClaims(user.uid, { role })
    return { uid: user.uid, email, role }
  }

  if (action === 'setRole') {
    const { uid, role } = data
    if (!uid || !ROLES.includes(role)) {
      throw { code: 'invalid-argument', message: 'uid e ruolo validi obbligatori.' }
    }
    if (uid === auth.uid) {
      throw { code: 'failed-precondition', message: 'Non puoi cambiare il tuo stesso ruolo.' }
    }
    await adminAuth.setCustomUserClaims(uid, { role })
    return { uid, role }
  }

  if (action === 'delete') {
    const { uid } = data
    if (!uid) throw { code: 'invalid-argument', message: 'uid obbligatorio.' }
    if (uid === auth.uid) {
      throw { code: 'failed-precondition', message: 'Non puoi eliminare il tuo stesso account.' }
    }
    await adminAuth.deleteUser(uid)
    return { uid, deleted: true }
  }

  throw { code: 'invalid-argument', message: `Azione sconosciuta: ${action}` }
}

module.exports = { staffAdmin, ROLES }
