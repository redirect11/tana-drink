// ── LA COMPOSIZIONE DEL MENÙ (REQ-MENU-025) ───────────────────────────
//
// COSA c'è nel menù dei clienti e come è diviso: la terza parte della
// VESTE, accanto alla tavolozza (i colori) e allo stile (la forma).
// L'utente, 04/11/2026: «la carta dei clienti è il menù stesso, non è una
// versione diversa del menù, e rientra nello stile del menù. Possiamo
// proporre varie carte, dove quella di default è il menù che già c'è», e i
// nomi li ha scelti lui: «Veste» per l'insieme, «Composizione del menù» per
// questa parte, «Di sala» per la carta scritta per il cliente — la parola
// di Flavio: «non metterò tutto quello che ho nel menù gestionale sul menù
// di sala».
//
//   · «Classica» — il catalogo del gestionale per categorie, com'è sempre
//     stato. Di tutti, senza fare niente.
//   · «Di sala» — sezioni e voci scritte per il cliente, agganciate ai
//     prodotti del gestionale (carta.js); si compila in Menù → Carta di
//     sala. Gratis: si installa con un tasto, come gli stili gratis.
//
// Si sceglie come uno stile (stileMenu.js): installata, in uso, provata
// sul proprio menù con `?vista=cliente&composizione=…`. Vale per chi
// ordina: chi lavora prende l'ordine dal catalogo del gestionale, che
// conosce. «Di sala» senza voci compilate resta la classica (carta.js,
// `cartaInUso`): il locale che la installa e non la compila non trova il
// menù vuoto.

export const COMPOSIZIONI_MENU = [
  {
    id: 'classica',
    nome: 'Classica',
    sempre: true,
    desc: 'Il catalogo del gestionale diviso per le sue categorie: tutto quello che è disponibile.',
  },
  {
    id: 'sala',
    nome: 'Di sala',
    gratis: true,
    desc: 'Sezioni e voci scritte per il cliente, con descrizioni e ingredienti propri, agganciate ai prodotti del gestionale. Si compila in Menù → Carta di sala.',
  },
]

export const COMPOSIZIONE_PREDEFINITA = 'classica'

const perId = (id) => COMPOSIZIONI_MENU.find((c) => c.id === id) || null
export const nomeComposizione = (id) => perId(id)?.nome || id

// Quelle gratis che il locale ha installato.
export function composizioniInstallate(settings) {
  const ids = Array.isArray(settings?.composizioni_installate) ? settings.composizioni_installate : []
  return ids.filter((id) => perId(id)?.gratis)
}

const haComposizione = (settings, c) => Boolean(c.sempre || (c.gratis && composizioniInstallate(settings).includes(c.id)))

export const composizioniDisponibili = (settings) => COMPOSIZIONI_MENU.filter((c) => haComposizione(settings, c))

// Quella in uso: la scelta, se il locale ce l'ha; se no la classica.
export function composizioneMenu(settings) {
  const id = settings?.composizione_menu
  return composizioniDisponibili(settings).some((c) => c.id === id) ? id : COMPOSIZIONE_PREDEFINITA
}

// Si prova sul proprio menù una composizione che si ha o che si potrebbe
// installare: oggi tutte.
export function composizioneProvabile(settings, id) {
  const c = perId(id)
  return Boolean(c && (haComposizione(settings, c) || c.gratis))
}

export function patchInstallaComposizione(settings, id) {
  if (!perId(id)?.gratis) return null
  return { composizioni_installate: [...new Set([...composizioniInstallate(settings), id])] }
}

// Disinstallando quella in uso si torna alla classica. Le sezioni e le
// voci di sala restano scritte: reinstallandola si ritrova la carta.
export function patchDisinstallaComposizione(settings, id) {
  const patch = { composizioni_installate: composizioniInstallate(settings).filter((x) => x !== id) }
  if (settings?.composizione_menu === id) patch.composizione_menu = COMPOSIZIONE_PREDEFINITA
  return patch
}

// «Usa»: in uso, e installata se non lo era.
export function patchUsaComposizione(settings, id) {
  return { ...(patchInstallaComposizione(settings, id) || {}), composizione_menu: id }
}
