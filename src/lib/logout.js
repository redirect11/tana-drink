// Logout dello staff col BADGE VIRTUALE: prima di disconnettere timbra
// l'uscita (chiude la sessione aperta), poi esegue il signOut. Il
// clock-out è best-effort: se fallisce (es. offline con cache fredda) si
// esce comunque e il bartender corregge la timbratura dal backoffice.
import { signOut } from 'firebase/auth'
import { auth } from './firebaseClient.js'
import { clockOut, rimuoviStaffToken } from './api.js'
import { idDispositivo } from './dispositivo.js'
import { spegniPush } from './push.js'
import { dimenticaTutto } from './notifyStore.js'

// NIENTE PUÒ TENERE DENTRO CHI VUOLE USCIRE. Timbratura e rubrica degli
// avvisi sono scritture su Firestore, e una scrittura offline non torna
// mai (docs/architettura.md): senza questo, «Esci» restava a girare a
// vuoto col locale pieno e il telefono senza campo. Passati due secondi e
// mezzo si esce comunque — quello che non è partito lo si sistema dopo.
const ATTESA_MAX = 2500

function conScadenza(promessa) {
  return Promise.race([
    Promise.resolve(promessa).catch(() => null),
    new Promise((ok) => setTimeout(() => ok(null), ATTESA_MAX)),
  ])
}

export async function logoutStaff() {
  const uid = auth.currentUser?.uid
  if (uid) {
    await conScadenza(clockOut({ uid }))
    // E SI SPENGONO GLI AVVISI DI QUESTO DISPOSITIVO. Il token push è del
    // browser e resta valido dopo il logout: chi si era scollegato sentiva
    // suonare gli ordini del locale sul telefono di casa. Al prossimo
    // accesso il dispositivo si registra da sé.
    await conScadenza(rimuoviStaffToken(uid, idDispositivo()))
  }
  // Fuori dalla rubrica dello staff, ma il token del browser vale ancora:
  // gli avvisi scritti sugli ORDINI arriverebbero lo stesso. Si spegne il
  // token, e allora non suona più niente da nessun mittente.
  await conScadenza(spegniPush())
  // Gli avvisi erano suoi: chi entra dopo non deve trovarli.
  dimenticaTutto()
  return signOut(auth)
}
