// ── LA SCRITTURA CONFERMATA DALLA CACHE, NON DAL SERVER (REQ-FLOTTA-019) ──
//
// Con la rete di Firestore spenta — ed è così che lavora la demo, sempre —
// la promessa di setDoc/updateDoc/addDoc/deleteDoc/commit si risolve solo
// alla conferma del server, cioè MAI. La scrittura intanto è già nella cache
// locale: le liste la mostrano, le letture la vedono. Ma chi ha scritto
// `await updateDrink(...)` resta lì ad aspettare, e la schermata con lui:
// nel gestionale sono 68 punti (magazzino, menù, fornitori, impostazioni,
// staff…), contati il 30/10/2026.
//
// Qui la stessa scrittura parte e la promessa si risolve SUBITO: per chi
// chiama è «fatto» appena Firestore l'ha presa in carico. L'ordine resta
// quello giusto: Firestore esegue le operazioni di un client nell'ordine in
// cui arrivano, quindi una lettura chiesta dopo vede già questa scrittura.
// `addDoc` sceglie l'id in locale (`doc(collezione)`), come fa lui, e
// restituisce subito il riferimento.
//
// Un errore della scrittura vera (a rete spenta non ne arrivano: non c'è
// nessuno che rifiuti) si scrive in console e non si perde in silenzio.
//
// SOLO PER LA DEMO: nei locali veri la conferma del server conta — è lì
// che arriva un permesso negato — e `scritture.js` usa questa funzione solo
// quando la build è la demo.

const segnala = (e) => console.warn('[demo] scrittura locale non riuscita:', e?.message || e)

export function confermaLocale(sdk) {
  const subito = (promessa, valore) => {
    Promise.resolve(promessa).catch(segnala)
    return Promise.resolve(valore)
  }
  return {
    setDoc: (...a) => subito(sdk.setDoc(...a)),
    updateDoc: (...a) => subito(sdk.updateDoc(...a)),
    deleteDoc: (...a) => subito(sdk.deleteDoc(...a)),
    addDoc: (collezione, dati) => {
      const ref = sdk.doc(collezione)
      return subito(sdk.setDoc(ref, dati), ref)
    },
    writeBatch: (db) => {
      const lotto = sdk.writeBatch(db)
      const commitVero = lotto.commit.bind(lotto)
      lotto.commit = () => subito(commitVero())
      return lotto
    },
  }
}
