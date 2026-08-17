// Logout dello staff col BADGE VIRTUALE: prima di disconnettere timbra
// l'uscita (chiude la sessione aperta), poi esegue il signOut. Il
// clock-out è best-effort: se fallisce (es. offline con cache fredda) si
// esce comunque e il bartender corregge la timbratura dal backoffice.
import { signOut } from 'firebase/auth'
import { auth } from './firebaseClient.js'
import { clockOut, rimuoviStaffToken } from './api.js'
import { idDispositivo } from './dispositivo.js'

export async function logoutStaff() {
  const uid = auth.currentUser?.uid
  if (uid) {
    try {
      await clockOut({ uid })
    } catch {
      /* best-effort: si esce comunque */
    }
    // E SI SPENGONO GLI AVVISI DI QUESTO DISPOSITIVO. Il token push è del
    // browser e resta valido dopo il logout: chi si era scollegato sentiva
    // suonare gli ordini del locale sul telefono di casa. Al prossimo
    // accesso il dispositivo si registra da sé.
    try {
      await rimuoviStaffToken(uid, idDispositivo())
    } catch {
      /* best-effort: si esce comunque */
    }
  }
  return signOut(auth)
}
