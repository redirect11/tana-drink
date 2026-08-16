// CHE COSA STIAMO GUARDANDO, scritto in fondo al menu.
//
// In produzione conta una cosa sola: quale VERSIONE è pubblicata. Ramo e
// commit lì non dicono niente a nessuno — è sempre main — e messi accanto
// al numero fanno solo confusione quando si segnala un problema.
//
// Fuori dalla produzione conta l'opposto: sullo stesso indirizzo di test
// passano a turno develop e i branch in lavorazione, quindi serve sapere
// da quale ramo e da quale commit arriva quello che si ha davanti. La
// versione resta, come riferimento di partenza.

export function etichettaVersione({ branch = '', commit = '', versione = '' } = {}) {
  const v = versione ? (versione.startsWith('v') ? versione : `v${versione}`) : ''
  if (branch === 'main') return v // produzione: solo il numero
  // IL RAMO NON RIPETE LA VERSIONE. Da quando si pubblica taggando, dove il
  // ramo non si sa arrivava il nome del TAG — e si leggeva «v1.4.3 · v1.4.3
  // · 11783f5»: due volte la stessa cosa, e l'informazione che serviva (da
  // dove viene) da nessuna parte. Se coincidono, il ramo si tace.
  const ramo = branch && branch !== v && branch !== versione ? branch : ''
  return [v, ramo, commit].filter(Boolean).join(' · ')
}

// È una build di produzione? (Serve anche a decidere cosa copiare.)
export const inProduzione = (branch) => branch === 'main'
