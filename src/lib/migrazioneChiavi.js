// ── LE CHIAVI LOCALI CAMBIANO PREFISSO, E NESSUNO PERDE NIENTE (REQ-VENUE-005)
//
// Le chiavi di localStorage erano `tana:…` e `tana_…`; il prodotto le vuole
// neutre (`drink:…`, `drink_…`). Ma sui dispositivi della Tana ci sono
// dentro il carrello, l'IP della stampante, lo zoom, le preferenze del
// banco: un rinomino secco li farebbe sparire la sera dell'aggiornamento.
// Quindi, al primo avvio dopo l'aggiornamento, ogni chiave vecchia si
// COPIA su quella nuova se la nuova non c'è ancora; la vecchia resta (un
// dispositivo che torna alla versione prima la ritrova). Idempotente: si
// può chiamare a ogni avvio.
//
// Logica pura: lo storage si passa, così si prova senza browser.

const PREFISSI = [
  ['tana:', 'drink:'],
  ['tana_', 'drink_'],
]

export function migraChiaviLocali(storage = globalThis.localStorage) {
  if (!storage) return 0
  let copiate = 0
  try {
    const chiavi = []
    for (let i = 0; i < storage.length; i += 1) chiavi.push(storage.key(i))
    for (const vecchia of chiavi) {
      if (!vecchia) continue
      const coppia = PREFISSI.find(([da]) => vecchia.startsWith(da))
      if (!coppia) continue
      const nuova = coppia[1] + vecchia.slice(coppia[0].length)
      if (storage.getItem(nuova) != null) continue
      storage.setItem(nuova, storage.getItem(vecchia))
      copiate += 1
    }
  } catch {
    /* storage non disponibile (privato, pieno): si va avanti senza */
  }
  return copiate
}
