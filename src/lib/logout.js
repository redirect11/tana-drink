// Logout dello staff col BADGE VIRTUALE: prima di disconnettere timbra
// l'uscita (chiude la sessione aperta), poi esegue il signOut. Il
// clock-out è best-effort: se fallisce (es. offline con cache fredda) si
// esce comunque e il bartender corregge la timbratura dal backoffice.
import { signOut } from 'firebase/auth'
import { auth } from './firebaseClient.js'
import { clockOut } from './api.js'

export async function logoutStaff() {
  const uid = auth.currentUser?.uid
  if (uid) {
    try {
      await clockOut({ uid })
    } catch {
      /* best-effort: si esce comunque */
    }
  }
  return signOut(auth)
}
