// ── LA RICERCA DRITTA AL SERVER, ADATTATORE FIREBASE (REQ-FLOTTA-021) ──
//
// Per le consultazioni che la cache rende lente (BUG-117): il client «lite»
// di Firestore va al server senza passare dalla cache del dispositivo
// (lib/firebaseClient.js spiega perché, coi tempi misurati).
//
// La ricerca si descrive con dati semplici e non coi vincoli della porta:
// quelli sono del client con la cache, e il client diretto ha i suoi.
//
//   cercaDalServer('stock_movements', {
//     dove: [['item_id', '==', id], ['created_at', '>=', new Date(...)]],
//     ordina: [['created_at', 'desc']],
//   })
//
// Le date si passano come `Date`. Senza rete, o nella demo, la promessa
// fallisce: chi chiama ripiega sulla ricerca di sempre.
import { firestoreLite } from '../../lib/firebaseClient.js'

export async function cercaDalServer(percorso, { dove = [], ordina = [] } = {}) {
  const { db, sdk } = await firestoreLite()
  const vincoli = [
    ...dove.map(([campo, op, valore]) => sdk.where(campo, op, valore)),
    ...ordina.map(([campo, verso = 'asc']) => sdk.orderBy(campo, verso)),
  ]
  const snap = await sdk.getDocs(sdk.query(sdk.collection(db, percorso), ...vincoli))
  return snap.docs
}
